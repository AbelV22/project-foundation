import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Downloads the official traffic feeds and stores the incidents around
 * Barcelona in public.traffic_incidents. Called every 3 min by pg_cron
 * (job "traffic-sync"); clients read the table through PostgREST.
 *
 * Runs as an Edge Function instead of inside the database because
 * gencat.cat drops connections coming from the database's network.
 */

const SCT_URL = 'https://www.gencat.cat/transit/opendata/incidenciesGML.xml'
const TRAMS_URL = 'https://opendata-ajuntament.barcelona.cat/data/dataset/8319c2b1-4c21-4962-9acd-6db4c5ff1148/resource/2d456eb5-4ea6-4f68-9794-2f3f1a58a933/download'
const AVISOS_URL = 'https://opendata-ajuntament.barcelona.cat/data/dataset/425f3411-963d-4ccc-a8de-c9422d923378/resource/2f308e87-8bb1-4145-97f2-3dcce62623b9/download'
const SECTIONS_URL = 'https://opendata-ajuntament.barcelona.cat/data/dataset/1090983a-1c40-4609-8620-14ad49aae3ab/resource/1d6c814c-70ef-4147-aa16-a49ddb952f72/download'

// Barcelona and the roads a taxi uses around it (airport, Rondas, C-31/C-32,
// B-23, C-58, AP-7 near the city).
const AREA = { minLat: 41.15, maxLat: 41.75, minLng: 1.7, maxLng: 2.55 }

type Incident = {
  id: string
  kind: 'accidente' | 'corte' | 'retencion' | 'congestion' | 'aviso'
  severity: number
  road: string | null
  title: string
  detail: string | null
  lat: number | null
  lng: number | null
  started_at: string | null
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return await res.text()
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<cite:${name}>([\\s\\S]*?)</cite:${name}>`))
  return m ? m[1].trim() : ''
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

// The SCT feed is in Catalan; the app is in Spanish.
const DESCRIPCIO_ES: Array<[RegExp, string]> = [
  [/circulaci[oó] amb retencions/i, 'Retenciones'],
  [/circulaci[oó] amb congesti[oó]/i, 'Congestión'],
  [/circulaci[oó] intensa/i, 'Tráfico intenso'],
  [/circulaci[oó] lenta/i, 'Circulación lenta'],
  [/cal[cç]ada tallada/i, 'Calzada cortada'],
  [/cal[cç]ada restringida/i, 'Calzada restringida'],
  [/desviaments/i, 'con desvíos'],
]

const CAUSA_ES: Record<string, string> = {
  'accident': 'Accidente',
  'avaria': 'Vehículo averiado',
  'circulació': 'Volumen de tráfico',
  'retirada de vehicle': 'Retirada de vehículo',
  'manteniment de ponts': 'Mantenimiento de puentes',
  'treballs de manteniment': 'Trabajos de mantenimiento',
  'obres en general': 'Obras',
  'neteja': 'Limpieza',
  'esllavissada': 'Desprendimiento',
  'objectes a la calçada': 'Objetos en la calzada',
  'incendi': 'Incendio',
  'meteorologia': 'Meteorología',
}

function translateDescripcio(text: string): string {
  let out = text
  for (const [re, es] of DESCRIPCIO_ES) out = out.replace(re, es)
  return out.replace(/\.\s*con desvíos/, ' con desvíos')
}

function translateCausa(causa: string): string {
  return CAUSA_ES[causa.trim().toLowerCase()] ?? causa
}

// cap_a mixes the direction with lane status or schedule:
// "BARCELONA-UN CARRIL TALLAT", "NUS LLOBREGAT", "LLEIDA-HORARI: 8 a 18h".
function parseCapA(capA: string): { sentido: string | null; extra: string | null } {
  if (!capA) return { sentido: null, extra: null }
  const [first, ...rest] = capA.split('-')
  const looksLikeExtra = (t: string) => /^(horari|un |dos |tres |carril|lateral)/i.test(t.trim())
  const toEs = (t: string) => t.trim().toLowerCase()
    .replace(/\bhorari\b/g, 'horario')
    .replace(/\bcarrils\b/g, 'carriles')
    .replace(/\btallats?\b/g, (m) => (m.endsWith('s') ? 'cortados' : 'cortado'))
    .replace(/\boberts?\b/g, (m) => (m.endsWith('s') ? 'abiertos' : 'abierto'))
    .replace(/\blateral dret\b/g, 'lateral derecho')
    .replace(/\blateral esquerre\b/g, 'lateral izquierdo')
  if (looksLikeExtra(first)) return { sentido: null, extra: toEs(capA) }
  return {
    sentido: capitalize(first.trim()).replace(/\b\w/g, (c) => c.toUpperCase()),
    extra: rest.length ? toEs(rest.join('-')) : null,
  }
}

// --- Servei Català de Trànsit ------------------------------------------------
function parseSct(xml: string): Incident[] {
  const items: Incident[] = []
  const features = xml.match(/<cite:mct2_v_afectacions_data[\s\S]*?<\/cite:mct2_v_afectacions_data>/g) ?? []

  for (const f of features) {
    const coords = f.match(/<gml:coordinates[^>]*>([\d.\-]+),([\d.\-]+)/)
    if (!coords) continue
    const lng = Number(coords[1])
    const lat = Number(coords[2])
    if (lat < AREA.minLat || lat > AREA.maxLat || lng < AREA.minLng || lng > AREA.maxLng) continue

    const causa = tag(f, 'causa')
    const descripcio = tag(f, 'descripcio')
    const tipus = tag(f, 'tipus')
    const nivell = Number(tag(f, 'nivell')) || 1

    // tipus 3 = roadworks: only closures matter, lane restrictions are
    // constant noise. Everything else (accidents, breakdowns, queues,
    // weather...) is kept.
    let kind: Incident['kind']
    let severity: number
    if (/^accident/i.test(causa)) {
      kind = 'accidente'
      severity = Math.max(3, Math.min(5, nivell))
    } else if (/tallad/i.test(descripcio)) {
      kind = 'corte'
      severity = 5
    } else if (tipus !== '3') {
      kind = 'retencion'
      severity = Math.max(2, Math.min(5, nivell))
    } else {
      continue
    }

    const carretera = tag(f, 'carretera')
    const pkIni = tag(f, 'pk_inici')
    const pkFi = tag(f, 'pk_fi')
    const km = pkIni ? ` km ${pkIni}${pkFi && pkFi !== pkIni ? `–${pkFi}` : ''}` : ''
    const causaEs = translateCausa(causa)
    // Retentions are titled by their cause when it says more than "traffic".
    const label = kind === 'accidente' ? 'Accidente'
      : kind === 'corte' ? 'Corte'
      : causa && !/^circulaci/i.test(causa) ? causaEs
      : 'Retención'
    const { sentido, extra } = parseCapA(tag(f, 'cap_a'))
    const fecha = tag(f, 'data')
    const showCausa = kind === 'corte' && causa

    items.push({
      id: `sct:${tag(f, 'identificador')}`,
      kind,
      severity,
      road: carretera || null,
      title: `${label} en ${carretera}${km}`,
      detail: [
        translateDescripcio(descripcio),
        sentido ? `Sentido ${sentido}` : '',
        extra ?? '',
        showCausa ? causaEs : '',
      ].filter(Boolean).join(' · ') || null,
      lat,
      lng,
      started_at: fecha ? new Date(fecha).toISOString() : null,
    })
  }
  return items
}

// --- Ajuntament: estado de los tramos ----------------------------------------
type Section = { id: number; name: string; lat: number | null; lng: number | null }

function parseSectionsCsv(csv: string): Section[] {
  const out: Section[] = []
  for (const line of csv.split(/\r?\n/)) {
    const m = line.match(/^(\d+),"([^"]*)","([^"]*)"/)
    if (!m) continue
    const nums = m[3].split(',').map(Number)
    // Coordinates are lng,lat pairs along the section: take the middle point.
    const pairs = Math.floor(nums.length / 2)
    const mid = Math.floor(pairs / 2) * 2
    out.push({
      id: Number(m[1]),
      name: m[2],
      lng: Number.isFinite(nums[mid]) ? nums[mid] : null,
      lat: Number.isFinite(nums[mid + 1]) ? nums[mid + 1] : null,
    })
  }
  return out
}

// "YYYYMMDDHHMMSS" stamps in Barcelona time, as the TRAMS feed writes them.
function stampToMs(stamp: string): number {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN
}

function madridNowMs(): number {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
  return stampToMs(parts.replace(/\D/g, ''))
}

const TRAMS_MAX_AGE_MIN = 30

function parseTrams(dat: string, sections: Map<number, Section>): Incident[] {
  const items: Incident[] = []
  const lines = dat.split(/\r?\n/).filter((l) => l.includes('#'))

  // If the Ajuntament stops updating the file, its old closures and jams
  // would stay on screen forever: drop the source until it's fresh again.
  const stamp = lines[0]?.split('#')[1] ?? ''
  const ageMin = (madridNowMs() - stampToMs(stamp)) / 60000
  if (!(ageMin <= TRAMS_MAX_AGE_MIN)) {
    console.warn(`[traffic-sync] TRAMS feed is ${Math.round(ageMin)} min old, ignoring it`)
    return []
  }

  for (const line of lines) {
    const [id, , estat] = line.trim().split('#')
    // 5 = congestión, 6 = cortado (0 sin datos, 1-4 de muy fluido a muy denso)
    if (estat !== '5' && estat !== '6') continue
    const s = sections.get(Number(id))
    const name = s?.name ?? `Tramo ${id}`
    const closed = estat === '6'
    items.push({
      id: `bcn_trams:${id}`,
      kind: closed ? 'corte' : 'congestion',
      severity: closed ? 5 : 3,
      road: name.split(' (')[0],
      title: `${closed ? 'Cortado' : 'Congestión'}: ${name}`,
      detail: null,
      lat: s?.lat ?? null,
      lng: s?.lng ?? null,
      started_at: null,
    })
  }
  return items
}

// --- Ajuntament: avisos de tráfico ------------------------------------------
async function parseAvisos(txt: string): Promise<Incident[]> {
  const seen = new Set<string>()
  const items: Incident[] = []
  for (const raw of txt.split(/\s{3,}|\r?\n/)) {
    const text = raw.trim()
    if (text.length < 10 || seen.has(text)) continue
    seen.add(text)
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
    const hash = Array.from(new Uint8Array(digest)).slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')
    const accident = /accident/i.test(text)
    const closed = !accident && /tallad|tallat/i.test(text)
    const queue = !accident && !closed && /retenci/i.test(text)
    items.push({
      id: `bcn_avisos:${hash}`,
      kind: accident ? 'accidente' : closed ? 'corte' : queue ? 'retencion' : 'aviso',
      severity: accident ? 4 : closed ? 4 : queue ? 3 : 2,
      road: null,
      title: text,
      detail: null,
      lat: null,
      lng: null,
      started_at: null,
    })
  }
  return items
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Only the pg_cron job may run it, so outsiders can't make it hammer the
  // feeds or rewrite the table. The shared secret lives in Vault, read by
  // both sides.
  const { data: secret } = await supabase.rpc('fn_traffic_sync_secret')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result: Record<string, number | string> = {}

  // Each source is replaced independently: one failing keeps its last rows.
  const store = async (source: string, load: () => Promise<Incident[]>) => {
    try {
      const items = await load()
      const { data, error } = await supabase.rpc('fn_replace_traffic_incidents', {
        p_source: source,
        p_items: items,
      })
      if (error) throw error
      result[source] = data as number
    } catch (e) {
      result[source] = `error: ${e instanceof Error ? e.message : String(e)}`
      console.error(`[traffic-sync] ${source}:`, e)
    }
  }

  await store('sct', async () => parseSct(await fetchText(SCT_URL)))

  // The Ajuntament's server answers 503 to parallel downloads: go one by one.
  await store('bcn_trams', async () => {
    let { data: sections } = await supabase.from('bcn_traffic_sections').select('id, name, lat, lng')
    if (!sections || sections.length === 0) {
      const parsed = parseSectionsCsv(await fetchText(SECTIONS_URL))
      const { error } = await supabase.from('bcn_traffic_sections').upsert(parsed)
      if (error) throw error
      sections = parsed
    }
    const byId = new Map<number, Section>((sections as Section[]).map((s) => [s.id, s]))
    return parseTrams(await fetchText(TRAMS_URL), byId)
  })

  await store('bcn_avisos', async () => parseAvisos(await fetchText(AVISOS_URL)))

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
})
