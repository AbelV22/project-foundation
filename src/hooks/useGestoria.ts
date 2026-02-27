/**
 * useGestoria — Motor fiscal para taxistas autónomos en Barcelona
 *
 * Mejorado con: Régimen Módulos vs Directa, IRPF Progresivo, IVA 10% real,
 * y los 15 tramos de cuota de autónomo 2025-2026.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { getItem, setItem } from '@/lib/storage';

export type RegimenFiscal = 'directa' | 'modulos';

// --- TYPES ---

export interface CarreraFiscal {
  id: string;
  importe: number;     // importe bruto, incluye IVA 10%
  propina: number;
  zona: string | null;
  metodo_pago: string;
  fecha: string;       // ISO
}

export interface GastoFiscal {
  id: string;
  categoria: string;
  subcategoria: string | null;
  amount: number;      // importe con IVA (total fra)
  fecha: string;       // ISO
  notas: string | null;
  deducibilidad: number; // 0-100 % (IRPF)
  porcentajeIva: number; // 21, 10, 4, 0 (IVA soportado)
  concepto: string;      // display name
}

export interface QuarterData {
  q: 1 | 2 | 3 | 4;
  label: string;
  deadline: string;
  deadlineISO: string;
  // IRPF (Módulos vs Directa)
  ingresos: number;        // base IRPF sin IVA (Directa)
  gastos: number;          // deducibles sin IVA (Directa)
  baseImponible: number;
  aPagarIRPF: number;      // Mod. 130 o 131
  modeloIRPF: '130' | '131';
  // IVA
  ivaRepercutido: number;  // 10% de la facturación
  ivaSoportado: number;    // sum de cuotas IVA de gastos
  aPagarIVA: number;       // repercutido - soportado (Mod. 303)

  status: 'pendiente' | 'proximo' | 'urgente' | 'pasado';
  daysLeft: number;
}

export interface Vencimiento {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  tipo: 'modelo130' | 'modelo131' | 'modelo303' | 'modelo390' | 'irpf-anual' | 'autonomo' | 'itv' | 'otro';
  urgencia: 'pasado' | 'verde' | 'amarillo' | 'rojo';
  daysLeft: number;
}

export interface AmortizacionVehiculo {
  precioCompra: number;
  fechaCompra: string;
  esNuevo: boolean;
  amortizacionAnual: number;
  amortizacionMensual: number;
  amortizacionAcumulada: number;
  valorResidual: number;
  anyosRestantes: number;
}

export interface ResumenFiscal {
  ano: number;
  regimen: RegimenFiscal;
  ingresosBrutos: number;       // con IVA
  baseIngresosIRPF: number;     // sin 10% de IVA
  gastosTotales: number;        // con IVA
  gastosDeduciblesIRPF: number; // sin IVA soportado
  beneficioNeto: number;        // Real o estimado
  irpfEstimadoAnual: number;    // Progresivo sobre B.Neto
  irpfPagadoTrimestralmente: number;
  irpfPendiente: number;
  cuotaAutonoMensual: number;
  cuotaAutonoAnual: number;
}

export interface LibroContable {
  mes: string;
  mesISO: string;
  ingresosBase: number;
  ivaRepercutido: number;
  gastosBase: number;
  ivaSoportado: number;
  beneficio: number;
  ingresoCount: number;
  gastoCount: number;
}

// --- DEDUCTIBILITY MAP (incl. % IVA) ---
// Keys: lowercase, sin acentos, espacios→_  (ver normalizeKey)
const DEDUCTIBILIDAD: Record<string, { nombre: string; pct: number; iva: number }> = {
  // Combustible
  fuel:              { nombre: 'Combustible', pct: 100, iva: 21 },
  gasolina:          { nombre: 'Gasolina / Diésel', pct: 100, iva: 21 },
  diesel:            { nombre: 'Gasolina / Diésel', pct: 100, iva: 21 },
  gnc:               { nombre: 'Gas Natural (GNC)', pct: 100, iva: 21 },
  electrico:         { nombre: 'Electricidad (carga)', pct: 100, iva: 21 },
  electric:          { nombre: 'Electricidad (carga)', pct: 100, iva: 21 },
  // Mantenimiento
  maintenance:       { nombre: 'Mantenimiento', pct: 100, iva: 21 },
  cambio_de_aceite:  { nombre: 'Aceite y Filtros', pct: 100, iva: 21 },
  reparacion:        { nombre: 'Reparación / Taller', pct: 100, iva: 21 },
  neumaticos:        { nombre: 'Neumáticos', pct: 100, iva: 21 },
  frenos:            { nombre: 'Frenos', pct: 100, iva: 21 },
  bateria:           { nombre: 'Batería', pct: 100, iva: 21 },
  filtros:           { nombre: 'Filtros', pct: 100, iva: 21 },
  revision:          { nombre: 'Revisión / Mantenimiento', pct: 100, iva: 21 },
  itv:               { nombre: 'ITV y tasas', pct: 100, iva: 21 },
  lavado:            { nombre: 'Lavado vehículo', pct: 100, iva: 21 },
  // Operativos
  operating:         { nombre: 'Gastos operativos', pct: 100, iva: 21 },
  seguro:            { nombre: 'Seguro Vehículo', pct: 100, iva: 0 },
  seguro_vehiculo:   { nombre: 'Seguro Vehículo', pct: 100, iva: 0 },
  seguro_vida:       { nombre: 'Seguro de Vida', pct: 50, iva: 0 },
  licencia:          { nombre: 'Licencia / Tasas AMB', pct: 100, iva: 0 },
  parking:           { nombre: 'Parking', pct: 100, iva: 21 },
  peajes:            { nombre: 'Peajes', pct: 100, iva: 21 },
  multas:            { nombre: 'Multas (NO deducible)', pct: 0, iva: 0 }, // ← NUNCA deducible
  tasas_municipales: { nombre: 'Tasas municipales', pct: 100, iva: 0 },
  alquiler_plaza:    { nombre: 'Alquiler plaza parking', pct: 100, iva: 21 },
  // Profesionales
  telefono:          { nombre: 'Teléfono móvil (50%)', pct: 50, iva: 21 },
  gestoria:          { nombre: 'Gestoría / Asesoría', pct: 100, iva: 21 },
  formacion:         { nombre: 'Formación profesional', pct: 100, iva: 0 },
  autonomo:          { nombre: 'Cuota Autónomo (SS)', pct: 100, iva: 0 },
  dietas:            { nombre: 'Dietas (comidas)', pct: 100, iva: 10 },
  // Otros
  other:             { nombre: 'Otros gastos', pct: 100, iva: 21 },
};

// Normaliza para matching con el mapa: sin acentos, minúsculas, espacios→_
function normalizeKey(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function getDeductibilidad(categoria: string, subcategoria?: string | null) {
  if (subcategoria) {
    const normSub = normalizeKey(subcategoria);
    if (DEDUCTIBILIDAD[normSub]) return DEDUCTIBILIDAD[normSub];
  }
  const normCat = normalizeKey(categoria);
  return DEDUCTIBILIDAD[normCat] || { nombre: 'Otros', pct: 100, iva: 21 };
}

// --- CONSTANTES MÓDULOS ---
// Rendimiento neto orientativo por módulo (vehículo, personal, distancia) en 2025 para taxis.
const BENEFICIO_MODULOS_ANUAL = 10361.25;
const CUOTA_MODULOS_TRIMESTRAL = 157.50;  // Pago fraccionado (Mod. 131)

// --- CUOTA AUTÓNOMO (15 tramos 2025-2026 RD 16/2025) ---
const TRAMOS_AUTONOMO: { max: number; cuotaMin: number }[] = [
  { max: 670, cuotaMin: 200 },
  { max: 900, cuotaMin: 225 },
  { max: 1166.7, cuotaMin: 260 },
  { max: 1300, cuotaMin: 275 },
  { max: 1500, cuotaMin: 290 },
  { max: 1700, cuotaMin: 294 },
  { max: 1850, cuotaMin: 350 },
  { max: 2030, cuotaMin: 370 },
  { max: 2330, cuotaMin: 390 },
  { max: 2760, cuotaMin: 415 },
  { max: 3190, cuotaMin: 440 },
  { max: 3620, cuotaMin: 465 },
  { max: 4050, cuotaMin: 490 },
  { max: 6000, cuotaMin: 530 },
  { max: Infinity, cuotaMin: 590 },
];

export function calcularCuotaAutonomo(rendimientoNetoMensual: number): number {
  if (rendimientoNetoMensual <= 0) return 200;
  const tramo = TRAMOS_AUTONOMO.find(t => rendimientoNetoMensual <= t.max);
  return tramo?.cuotaMin ?? 590;
}

// --- IRPF PROGRESIVO ---
export function calcularIRPFAnual(base: number): number {
  if (base <= 0) return 0;
  let impuesto = 0;
  let resto = base;
  if (resto > 12450) { impuesto += 12450 * 0.19; resto -= 12450; } else { return impuesto + resto * 0.19; }
  if (resto > (20200 - 12450)) { impuesto += (20200 - 12450) * 0.24; resto -= (20200 - 12450); } else { return impuesto + resto * 0.24; }
  if (resto > (35200 - 20200)) { impuesto += (35200 - 20200) * 0.30; resto -= (35200 - 20200); } else { return impuesto + resto * 0.30; }
  if (resto > (60000 - 35200)) { impuesto += (60000 - 35200) * 0.37; resto -= (60000 - 35200); } else { return impuesto + resto * 0.37; }
  if (resto > (300000 - 60000)) { impuesto += (300000 - 60000) * 0.45; resto -= (300000 - 60000); } else { return impuesto + resto * 0.45; }
  return impuesto + resto * 0.47;
}

// --- QUARTER HELPERS ---
function getQuarterRange(year: number, q: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  const ranges: Record<number, { start: Date; end: Date }> = {
    1: { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59) },
    2: { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59) },
    3: { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59) },
    4: { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59) },
  };
  return ranges[q];
}
function getQuarterDeadline(year: number, q: 1 | 2 | 3 | 4): Date {
  const deadlines: Record<number, Date> = {
    1: new Date(year, 3, 20),
    2: new Date(year, 6, 20),
    3: new Date(year, 9, 20),
    4: new Date(year + 1, 0, 30), // El Modelo 130/303 Q4 vence el 30 Enero (año+1)
  };
  return deadlines[q];
}
function getQuarterLabel(q: 1 | 2 | 3 | 4): string {
  return ['', 'T1 (Ene-Mar)', 'T2 (Abr-Jun)', 'T3 (Jul-Sep)', 'T4 (Oct-Dic)'][q];
}
function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function getUrgencia(days: number): Vencimiento['urgencia'] {
  if (days < 0) return 'pasado';
  if (days <= 7) return 'rojo';
  if (days <= 30) return 'amarillo';
  return 'verde';
}

// --- AMORTIZACIÓN VEHÍCULO ---
export function calcularAmortizacion(
  precioCompra: number,
  fechaCompra: string,
  esNuevo: boolean,
): AmortizacionVehiculo {
  const pct = esNuevo ? 0.16 : 0.08;
  const amortizacionAnual = precioCompra * pct;
  const amortizacionMensual = amortizacionAnual / 12;
  const compraDate = new Date(fechaCompra);
  const hoy = new Date();
  const mesesTranscurridos = Math.max(0,
    (hoy.getFullYear() - compraDate.getFullYear()) * 12
    + (hoy.getMonth() - compraDate.getMonth())
  );
  const amortizacionAcumulada = Math.min(precioCompra, amortizacionMensual * mesesTranscurridos);
  const valorResidual = Math.max(0, precioCompra - amortizacionAcumulada);
  const anyosRestantes = valorResidual > 0 ? Math.ceil(valorResidual / amortizacionAnual) : 0;
  return {
    precioCompra, fechaCompra, esNuevo, amortizacionAnual,
    amortizacionMensual, amortizacionAcumulada, valorResidual, anyosRestantes,
  };
}

// --- MAIN HOOK ---
export function useGestoria(year?: number) {
  const currentYear = year || new Date().getFullYear();

  const [carreras, setCarreras] = useState<CarreraFiscal[]>([]);
  const [gastos, setGastos] = useState<GastoFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regimen, setRegimenState] = useState<RegimenFiscal>('modulos');
  const [vehiculoFechaCompra, setVehiculoFechaCompra] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedRegimen = await getItem('regimen_fiscal');
      if (savedRegimen) setRegimenState(savedRegimen as RegimenFiscal);

      const vFecha = await getItem('amort_fecha');
      if (vFecha) setVehiculoFechaCompra(vFecha);

      const deviceId = getOrCreateDeviceId();
      const startISO = `${currentYear}-01-01T00:00:00`;
      const endISO = `${currentYear}-12-31T23:59:59`;

      const { data: carrerasData, error: carrerasErr } = await supabase
        .from('registros_carreras')
        .select('id, importe, propina, zona, metodo_pago, created_at')
        .eq('device_id', deviceId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: true });

      if (carrerasErr) throw carrerasErr;

      const { data: gastosData, error: gastosErr } = await supabase
        .from('expenses')
        .select('id, category, subcategory, amount, timestamp, notes')
        .eq('device_id', deviceId)
        .gte('timestamp', startISO)
        .lte('timestamp', endISO)
        .order('timestamp', { ascending: true });

      if (gastosErr) throw gastosErr;

      const carrerasMapped: CarreraFiscal[] = (carrerasData || []).map(c => ({
        id: c.id,
        importe: Number(c.importe) || 0,
        propina: Number(c.propina) || 0,
        zona: c.zona,
        metodo_pago: c.metodo_pago || 'efectivo',
        fecha: c.created_at,
      }));

      const gastosMapped: GastoFiscal[] = (gastosData || []).map(g => {
        const deduct = getDeductibilidad(g.category, g.subcategory);
        return {
          id: g.id,
          categoria: g.category,
          subcategoria: g.subcategory,
          amount: Number(g.amount) || 0,
          fecha: g.timestamp,
          notas: g.notes,
          deducibilidad: deduct.pct,
          porcentajeIva: deduct.iva,
          concepto: deduct.nombre,
        };
      });

      setCarreras(carrerasMapped);
      setGastos(gastosMapped);
    } catch (e) {
      console.error('[useGestoria] Error:', e);
      setError('Error cargando datos fiscales');
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setRegimen = (r: RegimenFiscal) => {
    setItem('regimen_fiscal', r);
    setRegimenState(r);
  };

  // --- FILTROS TRIMESTRALES ---
  function getQuarterCarreras(q: 1 | 2 | 3 | 4) {
    const { start, end } = getQuarterRange(currentYear, q);
    return carreras.filter(c => { const d = new Date(c.fecha); return d >= start && d <= end; });
  }
  function getQuarterGastos(q: 1 | 2 | 3 | 4) {
    const { start, end } = getQuarterRange(currentYear, q);
    return gastos.filter(g => { const d = new Date(g.fecha); return d >= start && d <= end; });
  }

  // --- QUARTER CALCULATION ---
  const quarters: QuarterData[] = ([1, 2, 3, 4] as const).map(q => {
    const deadline = getQuarterDeadline(currentYear, q);
    const days = daysUntil(deadline);
    const cb = getQuarterCarreras(q);
    const gb = getQuarterGastos(q);

    // Ingresos: Quitar IVA (10%) para llegar a la base imponible
    const ingresosBrutosQ = cb.reduce((sum, c) => sum + c.importe + c.propina, 0);
    const baseIngresos = ingresosBrutosQ / 1.10;
    const ivaRepercutido = ingresosBrutosQ - baseIngresos;

    // Gastos: Calcular el IVA soportado
    let baseGastos = 0;
    let ivaSoportado = 0;
    gb.forEach(g => {
      // Deducible proportion matters for IRPF and IVA
      const pctDeducible = g.deducibilidad / 100;
      const gastoProrrateado = g.amount * pctDeducible;
      // El ticket es TOTAL (con IVA). Para sacar la base: total / (1 + %iva)
      const divider = 1 + (g.porcentajeIva / 100);
      const base = gastoProrrateado / divider;
      const iva = gastoProrrateado - base;
      baseGastos += base;
      ivaSoportado += iva;
    });

    // Mod 303: IVA a Pagar
    const aPagarIVA = Math.max(0, ivaRepercutido - ivaSoportado);

    // Mod 130 o 131: IRPF
    let aPagarIRPF = 0;
    const modeloIRPF = regimen === 'modulos' ? '131' : '130';

    if (regimen === 'modulos') {
      aPagarIRPF = CUOTA_MODULOS_TRIMESTRAL;
    } else {
      // Modelo 130 Acumulativo
      let ingresosAcum = 0;
      let gastosAcum = 0;
      for (let prev = 1; prev <= q; prev++) {
        const tcb = getQuarterCarreras(prev as 1 | 2 | 3 | 4);
        const rgb = getQuarterGastos(prev as 1 | 2 | 3 | 4);

        const baseIngr = tcb.reduce((sum, c) => sum + c.importe + c.propina, 0) / 1.10;
        ingresosAcum += baseIngr;

        let baseGst = 0;
        rgb.forEach(xg => {
          const part = xg.amount * (xg.deducibilidad / 100);
          baseGst += part / (1 + xg.porcentajeIva / 100);
        });
        gastosAcum += baseGst;
      }
      const pagoAnteriorAcum = Math.max(0, (ingresosAcum - baseIngresos - (gastosAcum - baseGastos)) * 0.20);
      const cuotaAcum = Math.max(0, (ingresosAcum - gastosAcum) * 0.20);
      aPagarIRPF = Math.max(0, cuotaAcum - pagoAnteriorAcum);
    }

    return {
      q, label: getQuarterLabel(q),
      deadline: deadline.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
      deadlineISO: deadline.toISOString(),
      ingresos: baseIngresos,
      gastos: baseGastos,
      baseImponible: baseIngresos - baseGastos,
      aPagarIRPF,
      modeloIRPF,
      ivaRepercutido,
      ivaSoportado,
      aPagarIVA,
      status: days < 0 ? 'pasado' : (days <= 7 ? 'urgente' : (days <= 30 ? 'proximo' : 'pendiente')),
      daysLeft: days,
    };
  });

  // --- RESUMEN ANUAL ---
  const ingresosBrutosTotal = carreras.reduce((s, c) => s + c.importe + c.propina, 0);
  const baseIngresosIRPFTotal = ingresosBrutosTotal / 1.10;

  const gastosTotalesAnuales = gastos.reduce((s, g) => s + g.amount, 0);
  const gastosDeduciblesIRPFTotal = gastos.reduce((s, g) => {
    const val = g.amount * (g.deducibilidad / 100);
    return s + (val / (1 + g.porcentajeIva / 100));
  }, 0);

  // Beneficio Neto
  const beneficioNeto = regimen === 'modulos'
    ? BENEFICIO_MODULOS_ANUAL
    : (baseIngresosIRPFTotal - gastosDeduciblesIRPFTotal);

  const irpfEstimadoAnual = calcularIRPFAnual(beneficioNeto);
  const irpfPagadoTrimestralmente = quarters.reduce((s, q) => q.status === 'pasado' ? s + q.aPagarIRPF : s, 0);
  const irpfPendiente = Math.max(0, irpfEstimadoAnual - irpfPagadoTrimestralmente);

  const rendimientoNetoMensual = beneficioNeto / 12;
  const cuotaAutonoMensual = calcularCuotaAutonomo(rendimientoNetoMensual);
  const cuotaAutonoAnual = cuotaAutonoMensual * 12;

  const resumen: ResumenFiscal = {
    ano: currentYear,
    regimen,
    ingresosBrutos: ingresosBrutosTotal,
    baseIngresosIRPF: baseIngresosIRPFTotal,
    gastosTotales: gastosTotalesAnuales,
    gastosDeduciblesIRPF: gastosDeduciblesIRPFTotal,
    beneficioNeto,
    irpfEstimadoAnual,
    irpfPagadoTrimestralmente,
    irpfPendiente,
    cuotaAutonoMensual,
    cuotaAutonoAnual,
  };

  // --- OTRAS COLECCIONES ---
  const gastosDeduciblesLista = gastos.filter(g => g.deducibilidad > 0);

  const libroContable: LibroContable[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, i, 1);
    const mStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    const mCar = carreras.filter(c => c.fecha.startsWith(mStr));
    const mGas = gastos.filter(g => g.fecha.startsWith(mStr));

    const totalIng = mCar.reduce((s, c) => s + c.importe + c.propina, 0);
    const bIng = totalIng / 1.10;

    let bGst = 0, ivaSop = 0;
    mGas.forEach(g => {
      const part = g.amount * (g.deducibilidad / 100);
      const b = part / (1 + g.porcentajeIva / 100);
      bGst += b;
      ivaSop += (part - b);
    });

    return {
      mes: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
      mesISO: mStr,
      ingresosBase: bIng,
      ivaRepercutido: totalIng - bIng,
      gastosBase: bGst,
      ivaSoportado: ivaSop,
      beneficio: bIng - bGst,
      ingresoCount: mCar.length,
      gastoCount: mGas.length,
    };
  });

  // --- VENCIMIENTOS ---
  let vencimientosArr: Vencimiento[] = [];

  // Modelos Trimestrales (130/131 y 303)
  [1, 2, 3, 4].forEach(q => {
    const d = getQuarterDeadline(currentYear, q as 1 | 2 | 3 | 4);
    const days = daysUntil(d);

    // IRPF (130/131)
    vencimientosArr.push({
      id: `irpf-q${q}`,
      titulo: `Modelo ${regimen === 'modulos' ? '131' : '130'} — ${getQuarterLabel(q as 1 | 2 | 3 | 4)}`,
      descripcion: `IRPF pagos fraccionados (${regimen === 'modulos' ? 'Módulos' : 'Directa'})`,
      fecha: d.toISOString(),
      tipo: regimen === 'modulos' ? 'modelo131' : 'modelo130',
      urgencia: getUrgencia(days),
      daysLeft: days,
    });

    // IVA (303)
    vencimientosArr.push({
      id: `iva-q${q}`,
      titulo: `Modelo 303 — ${getQuarterLabel(q as 1 | 2 | 3 | 4)}`,
      descripcion: 'IVA Trimestral (Repercutido - Soportado)',
      fecha: d.toISOString(),
      tipo: 'modelo303',
      urgencia: getUrgencia(days),
      daysLeft: days,
    });
  });

  // Anuales: Modelo 100, Modelo 390
  const d100 = new Date(currentYear + 1, 5, 30); // 30 Junio
  vencimientosArr.push({
    id: `m100-${currentYear}`,
    titulo: `Renta ${currentYear} (Mod. 100)`,
    descripcion: 'Declaración anual IRPF. Revisa tramos y amortizaciones.',
    fecha: d100.toISOString(),
    tipo: 'irpf-anual',
    urgencia: getUrgencia(daysUntil(d100)),
    daysLeft: daysUntil(d100),
  });

  const d390 = new Date(currentYear + 1, 0, 30); // 30 Enero
  vencimientosArr.push({
    id: `m390-${currentYear}`,
    titulo: `Resumen IVA ${currentYear} (Mod. 390)`,
    descripcion: 'Resumen anual orientativo del IVA.',
    fecha: d390.toISOString(),
    tipo: 'modelo390',
    urgencia: getUrgencia(daysUntil(d390)),
    daysLeft: daysUntil(d390),
  });

  // Modelo 347 — Feb 28 (operaciones con terceros > 3.005€)
  const d347 = new Date(currentYear + 1, 1, 28);
  vencimientosArr.push({
    id: `m347-${currentYear}`,
    titulo: `Modelo 347 (${currentYear})`,
    descripcion: 'Declaración de operaciones con terceros > 3.005€. Solo si aplica.',
    fecha: d347.toISOString(),
    tipo: 'otro',
    urgencia: getUrgencia(daysUntil(d347)),
    daysLeft: daysUntil(d347),
  });

  // Cuotas Autónomo (Próximos 3 meses)
  Array.from({ length: 3 }).forEach((_, i) => {
    const now = new Date();
    const dAuto = new Date(now.getFullYear(), now.getMonth() + i + 1, 0); // Último día de mes SS
    const diasAuto = daysUntil(dAuto);
    if (diasAuto > -30) {
      vencimientosArr.push({
        id: `auto-${dAuto.toISOString()}`,
        titulo: `Cuota SS — ${dAuto.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
        descripcion: `Pago estimado Seguridad Social: ~${cuotaAutonoMensual}€/mes`,
        fecha: dAuto.toISOString(),
        tipo: 'autonomo',
        urgencia: getUrgencia(diasAuto),
        daysLeft: diasAuto,
      });
    }
  });

  // ITV basada en la fecha de compra del vehículo
  if (vehiculoFechaCompra) {
    const fc = new Date(vehiculoFechaCompra);
    const difAnyos = new Date().getFullYear() - fc.getFullYear();
    const isSemestral = difAnyos >= 5;

    if (difAnyos > 0 && difAnyos < 10) {
      // Fecha aniversario en año actual
      const itvBase = new Date(fc);
      itvBase.setFullYear(new Date().getFullYear());

      const itvFechas: Date[] = [itvBase];
      if (isSemestral) {
        // Segunda ITV a los 6 meses del aniversario
        const itv2 = new Date(itvBase);
        itv2.setMonth(itv2.getMonth() + 6);
        itvFechas.push(itv2);
      }

      itvFechas.forEach((itvDate, idx) => {
        // Si ya pasó hace más de 60 días, proyectar al año siguiente
        if (daysUntil(itvDate) < -60) itvDate.setFullYear(itvDate.getFullYear() + 1);
        const dI = daysUntil(itvDate);
        vencimientosArr.push({
          id: `itv-${currentYear}-${idx}`,
          titulo: isSemestral ? `ITV Taxi ${idx === 0 ? '(1ª semestral)' : '(2ª semestral)'}` : 'ITV Taxi (Anual)',
          descripcion: isSemestral
            ? `Vehículo de ${difAnyos} años — ITV semestral obligatoria`
            : `Vehículo de ${difAnyos} años — ITV anual`,
          fecha: itvDate.toISOString(),
          tipo: 'itv',
          urgencia: getUrgencia(dI),
          daysLeft: dI,
        });
      });
    }

    if (difAnyos >= 9) {
      vencimientosArr.push({
        id: 'vida-util',
        titulo: '⚠️ Fin vida útil PMTB',
        descripcion: `Vehículo de ${difAnyos} años. El reglamento AMB limita antigüedad a ~10 años para taxis en Barcelona.`,
        fecha: new Date().toISOString(),
        tipo: 'otro',
        urgencia: 'rojo',
        daysLeft: 0,
      });
    }
  }

  // Ordenar
  vencimientosArr = vencimientosArr.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  // Tramo autónomo detalle
  const tramoIdx = TRAMOS_AUTONOMO.findIndex(t => rendimientoNetoMensual <= t.max);
  const tramoInfo = {
    numero: tramoIdx + 1,
    total: TRAMOS_AUTONOMO.length,
    cuota: cuotaAutonoMensual,
    rendimientoMensual: Math.max(0, rendimientoNetoMensual),
  };

  const vehiculoAnos = vehiculoFechaCompra
    ? new Date().getFullYear() - new Date(vehiculoFechaCompra).getFullYear()
    : null;

  return {
    carreras, gastos, regimen, setRegimen,
    resumen, quarters, gastosDeduciblesLista, libroContable, vencimientos: vencimientosArr,
    loading, error, refresh: fetchData, currentYear,
    beneficioModulos: BENEFICIO_MODULOS_ANUAL,
    tramoInfo,
    vehiculoAnos,
  };
}
