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
    const tipusDesc = tag(f, 'descripcio_tipus')
    const nivell = Number(tag(f, 'nivell')) || 1

    // Roadworks that only narrow the road are constant noise: keep accidents,
    // closures and queues.
    let kind: Incident['kind']
    let severity: number
    if (/^accident/i.test(causa)) {
      kind = 'accidente'
      severity = Math.max(3, Math.min(5, nivell))
    } else if (/tallad/i.test(descripcio)) {
      kind = 'corte'
      severity = 5
    } else if (/retenci/i.test(tipusDesc)) {
      kind = 'retencion'
      severity = Math.max(2, Math.min(5, nivell))
    } else {
      continue
    }

    const carretera = tag(f, 'carretera')
    const pkIni = tag(f, 'pk_inici')
    const pkFi = tag(f, 'pk_fi')
    const km = pkIni ? ` km ${pkIni}${pkFi && pkFi !== pkIni ? `–${pkFi}` : ''}` : ''
    const label = kind === 'accidente' ? 'Accidente' : kind === 'corte' ? 'Corte' : 'Retención'
    const capA = tag(f, 'cap_a')
    const fecha = tag(f, 'data')

    items.push({
      id: `sct:${tag(f, 'identificador')}`,
      kind,
      severity,
      road: carretera || null,
      title: `${label} en ${carretera}${km}`,
      detail: [descripcio, capA ? `Sentido ${capitalize(capA)}` : '', kind !== 'accidente' && causa ? causa : '']
        .filter(Boolean).join(' · ') || null,
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

function parseTrams(dat: string, sections: Map<number, Section>): Incident[] {
  const items: Incident[] = []
  for (const line of dat.split(/\r?\n/)) {
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
    const closed = /tallad|tallat/i.test(text)
    items.push({
      id: `bcn_avisos:${hash}`,
      kind: closed ? 'corte' : 'aviso',
      severity: closed ? 4 : 2,
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
