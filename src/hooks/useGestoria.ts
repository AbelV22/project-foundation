/**
 * useGestoria — Motor fiscal para taxistas autónomos en Barcelona
 *
 * Qué hace una gestoría para un taxista:
 * - Declaraciones trimestrales Modelo 130 (IRPF pagos fraccionados)
 * - Control de gastos deducibles (combustible, seguro, mantenimiento…)
 * - Cuota de autónomo (SS) — cálculo por tramos de rendimiento neto
 * - Amortización del vehículo (16%/año, tabla simplificada Hacienda)
 * - Libro de ingresos y gastos (obligatorio en Estimación Directa Simplificada)
 * - Calendario de vencimientos fiscales
 *
 * NOTA FISCAL: Los taxis están EXENTOS de IVA (art. 20.1.17 Ley IVA).
 * NO cobran IVA a los clientes, por tanto NO pueden deducir IVA soportado.
 * Usan Estimación Directa Simplificada para IRPF.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

// --- TYPES ---

export interface CarreraFiscal {
  id: string;
  importe: number;
  propina: number;
  zona: string | null;
  metodo_pago: string;
  fecha: string; // ISO
}

export interface GastoFiscal {
  id: string;
  categoria: string;
  subcategoria: string | null;
  amount: number;
  fecha: string; // ISO
  notas: string | null;
  deducibilidad: number; // 0-100 %
  concepto: string; // display name
}

export interface QuarterData {
  q: 1 | 2 | 3 | 4;
  label: string;           // "T1 (Ene-Mar)"
  deadline: string;        // "20 Abr 2026"
  deadlineISO: string;     // ISO para comparar
  ingresos: number;
  gastos: number;
  baseImponible: number;   // ingresos - gastos
  cuotaBruta: number;      // 20% * baseImponible acumulada
  pagosAnteriores: number; // suma Q anteriores ya calculados
  aPagar: number;          // cuotaBruta - pagosAnteriores (min 0)
  status: 'pendiente' | 'proximo' | 'urgente' | 'pasado';
  daysLeft: number;
}

export interface Vencimiento {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;           // ISO deadline
  tipo: 'modelo130' | 'irpf-anual' | 'autonomo' | 'otro';
  urgencia: 'pasado' | 'verde' | 'amarillo' | 'rojo';
  daysLeft: number;
}

export interface AmortizacionVehiculo {
  precioCompra: number;
  fechaCompra: string;
  esNuevo: boolean;
  amortizacionAnual: number;   // 16% del precio
  amortizacionMensual: number;
  amortizacionAcumulada: number;
  valorResidual: number;
  anyosRestantes: number;
}

export interface ResumenFiscal {
  ano: number;
  ingresosBrutos: number;
  gastosTotales: number;
  gastosDeducibles: number;
  beneficioNeto: number;
  irpfEstimadoAnual: number;  // 20% del beneficio neto
  irpfPagadoTrimestralmente: number;
  irpfPendiente: number;
  cuotaAutonoMensual: number;
  cuotaAutonoAnual: number;
}

export interface LibroContable {
  mes: string;           // "Enero 2026"
  mesISO: string;        // "2026-01"
  ingresos: number;
  ingresoCount: number;
  gastos: number;
  gastoCount: number;
  beneficio: number;
}

// --- DEDUCTIBILITY MAP ---

const DEDUCTIBILIDAD: Record<string, { nombre: string; pct: number }> = {
  fuel:                  { nombre: 'Combustible', pct: 100 },
  gasolina:              { nombre: 'Gasolina / Diésel', pct: 100 },
  electric:              { nombre: 'Electricidad (carga)', pct: 100 },
  maintenance:           { nombre: 'Mantenimiento', pct: 100 },
  reparacion:            { nombre: 'Reparación / Taller', pct: 100 },
  neumaticos:            { nombre: 'Neumáticos', pct: 100 },
  itv:                   { nombre: 'ITV y tasas', pct: 100 },
  seguro_vehiculo:       { nombre: 'Seguro Vehículo', pct: 100 },
  seguro_vida:           { nombre: 'Seguro de Vida', pct: 50 },
  operating:             { nombre: 'Gastos operativos', pct: 100 },
  peajes:                { nombre: 'Peajes y aparcamiento', pct: 100 },
  telefono:              { nombre: 'Teléfono móvil', pct: 50 },
  gestoria:              { nombre: 'Gestoría / Asesoría', pct: 100 },
  formacion:             { nombre: 'Formación', pct: 100 },
  licencia:              { nombre: 'Licencia / Tasas municipales', pct: 100 },
  autonomo:              { nombre: 'Cuota Autónomo (SS)', pct: 100 },
  other:                 { nombre: 'Otros gastos', pct: 100 },
};

function getDeductibilidad(categoria: string, subcategoria?: string | null) {
  const key = subcategoria?.toLowerCase() || categoria?.toLowerCase() || 'other';
  return DEDUCTIBILIDAD[key] || DEDUCTIBILIDAD[categoria?.toLowerCase()] || { nombre: 'Otros', pct: 100 };
}

// --- CUOTA AUTÓNOMO (tramos 2025-2026) ---
// Sistema de cotización por ingresos reales (vigente desde 2023)

const TRAMOS_AUTONOMO: { max: number; cuotaMin: number }[] = [
  { max: 670.5,   cuotaMin: 200 },
  { max: 900,     cuotaMin: 220 },
  { max: 1166.7,  cuotaMin: 260 },
  { max: 1300,    cuotaMin: 275 },
  { max: 1500,    cuotaMin: 294 },
  { max: 1700,    cuotaMin: 294 },
  { max: 1850,    cuotaMin: 350 },
  { max: 2030,    cuotaMin: 370 },
  { max: 2330,    cuotaMin: 390 },
  { max: 2760,    cuotaMin: 420 },
  { max: 3190,    cuotaMin: 460 },
  { max: Infinity, cuotaMin: 530 },
];

export function calcularCuotaAutonomo(rendimientoNetoMensual: number): number {
  const tramo = TRAMOS_AUTONOMO.find(t => rendimientoNetoMensual <= t.max);
  return tramo?.cuotaMin ?? 530;
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
  // Q1: Apr 20, Q2: Jul 20, Q3: Oct 20, Q4: Jan 20 next year
  const deadlines: Record<number, Date> = {
    1: new Date(year, 3, 20),
    2: new Date(year, 6, 20),
    3: new Date(year, 9, 20),
    4: new Date(year + 1, 0, 20),
  };
  return deadlines[q];
}

function getQuarterLabel(q: 1 | 2 | 3 | 4): string {
  return ['', 'T1 (Ene-Mar)', 'T2 (Abr-Jun)', 'T3 (Jul-Sep)', 'T4 (Oct-Dic)'][q];
}

function formatDeadline(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
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

function getQuarterStatus(deadline: Date, daysLeft: number): QuarterData['status'] {
  if (daysLeft < 0) return 'pasado';
  if (daysLeft <= 7) return 'urgente';
  if (daysLeft <= 30) return 'proximo';
  return 'pendiente';
}

// --- AMORTIZACIÓN VEHÍCULO ---

export function calcularAmortizacion(
  precioCompra: number,
  fechaCompra: string,
  esNuevo: boolean,
): AmortizacionVehiculo {
  const pct = esNuevo ? 0.16 : 0.08; // 16% nuevo, 8% usado (tabla simplificada AEAT)
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
    precioCompra,
    fechaCompra,
    esNuevo,
    amortizacionAnual,
    amortizacionMensual,
    amortizacionAcumulada,
    valorResidual,
    anyosRestantes,
  };
}

// --- MAIN HOOK ---

export function useGestoria(year?: number) {
  const currentYear = year || new Date().getFullYear();

  const [carreras, setCarreras] = useState<CarreraFiscal[]>([]);
  const [gastos, setGastos] = useState<GastoFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const startISO = `${currentYear}-01-01T00:00:00`;
      const endISO = `${currentYear}-12-31T23:59:59`;

      // Fetch full year earnings
      const { data: carrerasData, error: carrerasErr } = await supabase
        .from('registros_carreras')
        .select('id, importe, propina, zona, metodo_pago, created_at')
        .eq('device_id', deviceId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: true });

      if (carrerasErr) throw carrerasErr;

      // Fetch full year expenses
      const { data: gastosData, error: gastosErr } = await supabase
        .from('expenses')
        .select('id, category, subcategory, amount, timestamp, notes')
        .eq('device_id', deviceId)
        .gte('timestamp', startISO)
        .lte('timestamp', endISO)
        .order('timestamp', { ascending: true });

      if (gastosErr) throw gastosErr;

      // Map carreras
      const carrerasMapped: CarreraFiscal[] = (carrerasData || []).map(c => ({
        id: c.id,
        importe: Number(c.importe) || 0,
        propina: Number(c.propina) || 0,
        zona: c.zona,
        metodo_pago: c.metodo_pago || 'efectivo',
        fecha: c.created_at,
      }));

      // Map gastos with deductibility
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

  // --- COMPUTED VALUES ---

  // Income/expenses per quarter
  function getQuarterIngresos(q: 1 | 2 | 3 | 4): number {
    const { start, end } = getQuarterRange(currentYear, q);
    return carreras
      .filter(c => {
        const d = new Date(c.fecha);
        return d >= start && d <= end;
      })
      .reduce((sum, c) => sum + c.importe + c.propina, 0);
  }

  function getQuarterGastos(q: 1 | 2 | 3 | 4): number {
    const { start, end } = getQuarterRange(currentYear, q);
    return gastos
      .filter(g => {
        const d = new Date(g.fecha);
        return d >= start && d <= end;
      })
      .reduce((sum, g) => sum + (g.amount * g.deducibilidad / 100), 0);
  }

  // Quarter cards
  const quarters: QuarterData[] = ([1, 2, 3, 4] as const).map(q => {
    const deadline = getQuarterDeadline(currentYear, q);
    const days = daysUntil(deadline);
    const ingresos = getQuarterIngresos(q);
    const gastos_q = getQuarterGastos(q);
    const baseImponible = ingresos - gastos_q;

    // Accumulated from previous quarters for Modelo 130
    let ingresosAcum = 0;
    let gastosAcum = 0;
    for (let prev = 1; prev < q; prev++) {
      ingresosAcum += getQuarterIngresos(prev as 1 | 2 | 3 | 4);
      gastosAcum += getQuarterGastos(prev as 1 | 2 | 3 | 4);
    }
    const cuotaBruta = Math.max(0, (ingresosAcum + ingresos - gastosAcum - gastos_q) * 0.20);
    const pagosAnteriores = Math.max(0, (ingresosAcum - gastosAcum) * 0.20);
    const aPagar = Math.max(0, cuotaBruta - pagosAnteriores);

    return {
      q,
      label: getQuarterLabel(q),
      deadline: formatDeadline(deadline),
      deadlineISO: deadline.toISOString(),
      ingresos,
      gastos: gastos_q,
      baseImponible,
      cuotaBruta,
      pagosAnteriores,
      aPagar,
      status: getQuarterStatus(deadline, days),
      daysLeft: days,
    };
  });

  // Resumen fiscal anual
  const ingresosBrutos = carreras.reduce((s, c) => s + c.importe + c.propina, 0);
  const gastosTotales = gastos.reduce((s, g) => s + g.amount, 0);
  const gastosDeducibles = gastos.reduce((s, g) => s + (g.amount * g.deducibilidad / 100), 0);
  const beneficioNeto = ingresosBrutos - gastosDeducibles;
  const irpfEstimadoAnual = Math.max(0, beneficioNeto * 0.20);
  const irpfPagadoTrimestralmente = quarters.reduce((s, q) => {
    return q.status === 'pasado' ? s + q.aPagar : s;
  }, 0);
  const irpfPendiente = Math.max(0, irpfEstimadoAnual - irpfPagadoTrimestralmente);

  const rendimientoNetoMensual = beneficioNeto / 12;
  const cuotaAutonoMensual = calcularCuotaAutonomo(Math.max(0, rendimientoNetoMensual));
  const cuotaAutonoAnual = cuotaAutonoMensual * 12;

  const resumen: ResumenFiscal = {
    ano: currentYear,
    ingresosBrutos,
    gastosTotales,
    gastosDeducibles,
    beneficioNeto,
    irpfEstimadoAnual,
    irpfPagadoTrimestralmente,
    irpfPendiente,
    cuotaAutonoMensual,
    cuotaAutonoAnual,
  };

  // Gastos deducibles (enriquecidos)
  const gastosDeduciblesLista: GastoFiscal[] = gastos.filter(g => g.deducibilidad > 0);

  // Libro contable por mes
  const libroContable: LibroContable[] = Array.from({ length: 12 }, (_, i) => {
    const mesDate = new Date(currentYear, i, 1);
    const mesLabel = mesDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const mesISO = `${currentYear}-${String(i + 1).padStart(2, '0')}`;

    const mesCarreras = carreras.filter(c => c.fecha.startsWith(mesISO));
    const mesGastos = gastos.filter(g => g.fecha.startsWith(mesISO));

    const ingr = mesCarreras.reduce((s, c) => s + c.importe + c.propina, 0);
    const gast = mesGastos.reduce((s, g) => s + (g.amount * g.deducibilidad / 100), 0);

    return {
      mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
      mesISO,
      ingresos: ingr,
      ingresoCount: mesCarreras.length,
      gastos: gast,
      gastoCount: mesGastos.length,
      beneficio: ingr - gast,
    };
  });

  // Vencimientos 2026
  const vencimientos: Vencimiento[] = [
    // Modelo 130 trimestral
    ...([1, 2, 3, 4] as const).map(q => {
      const deadline = getQuarterDeadline(currentYear, q);
      const days = daysUntil(deadline);
      return {
        id: `m130-${q}`,
        titulo: `Modelo 130 — ${getQuarterLabel(q)}`,
        descripcion: 'IRPF pagos fraccionados trimestral (Estimación Directa)',
        fecha: deadline.toISOString(),
        tipo: 'modelo130' as const,
        urgencia: getUrgencia(days),
        daysLeft: days,
      };
    }),
    // IRPF Anual
    {
      id: 'irpf-anual',
      titulo: `Renta ${currentYear} (Modelo 100)`,
      descripcion: 'Declaración anual de IRPF. Presentación abril-junio.',
      fecha: new Date(currentYear + 1, 5, 30).toISOString(),
      tipo: 'irpf-anual',
      urgencia: getUrgencia(daysUntil(new Date(currentYear + 1, 5, 30))),
      daysLeft: daysUntil(new Date(currentYear + 1, 5, 30)),
    },
    // Cuotas autónomo (próximos 3 meses)
    ...(Array.from({ length: 3 }, (_, i) => {
      const now = new Date();
      const mes = new Date(now.getFullYear(), now.getMonth() + i + 1, 20);
      const days = daysUntil(mes);
      return {
        id: `autonomo-${mes.toISOString()}`,
        titulo: `Cuota Autónomo — ${mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
        descripcion: `Pago mensual Seguridad Social. ~${cuotaAutonoMensual}€/mes`,
        fecha: mes.toISOString(),
        tipo: 'autonomo' as const,
        urgencia: getUrgencia(days),
        daysLeft: days,
      };
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    // Raw data
    carreras,
    gastos,
    // Computed
    resumen,
    quarters,
    gastosDeduciblesLista,
    libroContable,
    vencimientos,
    // State
    loading,
    error,
    refresh: fetchData,
    currentYear,
  };
}
