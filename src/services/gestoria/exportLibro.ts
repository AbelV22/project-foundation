/**
 * exportLibro.ts — Exportación del Libro Contable en CSV
 *
 * Genera un CSV compatible con Excel / Google Sheets / herramientas contables
 * con el formato requerido para autónomos en Estimación Directa.
 */

import type { LibroContable, CarreraFiscal, GastoFiscal, QuarterData, ResumenFiscal } from '@/hooks/useGestoria';

// --- CSV HELPERS ---

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatEur(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(c => escapeCsv(typeof c === 'number' ? formatEur(c) : c)).join(';');
}

// --- LIBRO CONTABLE MENSUAL ---

export function exportLibroContableCSV(
  libro: LibroContable[],
  year: number,
): string {
  const header = [
    'Mes',
    'Ingresos Base (€)',
    'IVA Repercutido (€)',
    'Ingresos Total (€)',
    'Gastos Base (€)',
    'IVA Soportado (€)',
    'Gastos Total (€)',
    'Beneficio Neto (€)',
    'Nº Carreras',
    'Nº Gastos',
  ];

  const rows: string[] = [
    `LIBRO DE INGRESOS Y GASTOS - EJERCICIO ${year}`,
    `Generado por iTaxiBcn el ${new Date().toLocaleDateString('es-ES')}`,
    '',
    header.join(';'),
  ];

  let totIngBase = 0, totIvaRep = 0, totGstBase = 0, totIvaSop = 0, totBenef = 0;
  let totCarreras = 0, totGastos = 0;

  libro.forEach(mes => {
    const ingTotal = mes.ingresosBase + mes.ivaRepercutido;
    const gstTotal = mes.gastosBase + mes.ivaSoportado;

    totIngBase += mes.ingresosBase;
    totIvaRep += mes.ivaRepercutido;
    totGstBase += mes.gastosBase;
    totIvaSop += mes.ivaSoportado;
    totBenef += mes.beneficio;
    totCarreras += mes.ingresoCount;
    totGastos += mes.gastoCount;

    rows.push(csvRow([
      mes.mes,
      mes.ingresosBase,
      mes.ivaRepercutido,
      ingTotal,
      mes.gastosBase,
      mes.ivaSoportado,
      gstTotal,
      mes.beneficio,
      mes.ingresoCount,
      mes.gastoCount,
    ]));
  });

  // Totals
  rows.push('');
  rows.push(csvRow([
    'TOTAL',
    totIngBase,
    totIvaRep,
    totIngBase + totIvaRep,
    totGstBase,
    totIvaSop,
    totGstBase + totIvaSop,
    totBenef,
    totCarreras,
    totGastos,
  ]));

  return rows.join('\n');
}

// --- DETALLE DE CARRERAS ---

export function exportCarrerasCSV(carreras: CarreraFiscal[], year: number): string {
  const header = [
    'Fecha',
    'Importe Bruto (€)',
    'Propina (€)',
    'Total (€)',
    'Base Imponible (€)',
    'IVA 10% (€)',
    'Zona',
    'Método Pago',
  ];

  const rows: string[] = [
    `REGISTRO DE INGRESOS (CARRERAS) - EJERCICIO ${year}`,
    `Generado por iTaxiBcn el ${new Date().toLocaleDateString('es-ES')}`,
    '',
    header.join(';'),
  ];

  carreras.forEach(c => {
    const total = c.importe + c.propina;
    const base = total / 1.10;
    const iva = total - base;

    rows.push(csvRow([
      new Date(c.fecha).toLocaleDateString('es-ES'),
      c.importe,
      c.propina,
      total,
      base,
      iva,
      c.zona || 'Sin zona',
      c.metodo_pago,
    ]));
  });

  return rows.join('\n');
}

// --- DETALLE DE GASTOS ---

export function exportGastosCSV(gastos: GastoFiscal[], year: number): string {
  const header = [
    'Fecha',
    'Concepto',
    'Categoría',
    'Subcategoría',
    'Importe Total (€)',
    'Base Imponible (€)',
    'IVA Soportado (€)',
    '% IVA',
    '% Deducible',
    'Base Deducible IRPF (€)',
    'Notas',
  ];

  const rows: string[] = [
    `REGISTRO DE GASTOS - EJERCICIO ${year}`,
    `Generado por iTaxiBcn el ${new Date().toLocaleDateString('es-ES')}`,
    '',
    header.join(';'),
  ];

  gastos.forEach(g => {
    const divider = 1 + (g.porcentajeIva / 100);
    const base = g.amount / divider;
    const iva = g.amount - base;
    const baseDeducible = (g.amount * g.deducibilidad / 100) / divider;

    rows.push(csvRow([
      new Date(g.fecha).toLocaleDateString('es-ES'),
      g.concepto,
      g.categoria,
      g.subcategoria || '',
      g.amount,
      base,
      iva,
      g.porcentajeIva,
      g.deducibilidad,
      baseDeducible,
      g.notas || '',
    ]));
  });

  return rows.join('\n');
}

// --- RESUMEN TRIMESTRAL ---

export function exportResumenTrimestralCSV(
  quarters: QuarterData[],
  resumen: ResumenFiscal,
  year: number,
): string {
  const rows: string[] = [
    `RESUMEN TRIMESTRAL - EJERCICIO ${year}`,
    `Régimen: ${resumen.regimen === 'modulos' ? 'Estimación Objetiva (Módulos)' : 'Estimación Directa Simplificada'}`,
    `Generado por iTaxiBcn el ${new Date().toLocaleDateString('es-ES')}`,
    '',
    ['Trimestre', 'Ingresos Base (€)', 'Gastos Base (€)', 'IVA Repercutido (€)', 'IVA Soportado (€)',
      `Mod. ${resumen.regimen === 'modulos' ? '131' : '130'} (€)`, 'Mod. 303 (€)', 'Total a Pagar (€)',
      'Fecha Límite', 'Estado'].join(';'),
  ];

  quarters.forEach(q => {
    rows.push(csvRow([
      q.label,
      q.ingresos,
      q.gastos,
      q.ivaRepercutido,
      q.ivaSoportado,
      q.aPagarIRPF,
      q.aPagarIVA,
      q.aPagarIRPF + q.aPagarIVA,
      q.deadline,
      q.status === 'pasado' ? 'Presentado' : q.status === 'urgente' ? '¡Urgente!' : 'Pendiente',
    ]));
  });

  // Totals
  rows.push('');
  rows.push(csvRow([
    'TOTAL ANUAL',
    quarters.reduce((s, q) => s + q.ingresos, 0),
    quarters.reduce((s, q) => s + q.gastos, 0),
    quarters.reduce((s, q) => s + q.ivaRepercutido, 0),
    quarters.reduce((s, q) => s + q.ivaSoportado, 0),
    quarters.reduce((s, q) => s + q.aPagarIRPF, 0),
    quarters.reduce((s, q) => s + q.aPagarIVA, 0),
    quarters.reduce((s, q) => s + q.aPagarIRPF + q.aPagarIVA, 0),
    '',
    '',
  ]));

  return rows.join('\n');
}

// --- DOWNLOAD CSV ---

export function downloadCSV(content: string, filename: string) {
  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareCSV(content: string, filename: string): Promise<void> {
  try {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });

    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'text/csv' });
      const shareData = { files: [file], title: filename };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    }

    downloadCSV(content, filename);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      downloadCSV(content, filename);
    }
  }
}
