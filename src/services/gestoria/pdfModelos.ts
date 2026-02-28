/**
 * pdfModelos.ts — Generador de borradores PDF para Modelos 131, 130, 303
 *
 * Genera PDFs profesionales "borrador" que el taxista puede usar como referencia
 * para rellenar los modelos oficiales en la Sede Electrónica de AEAT.
 */

import jsPDF from 'jspdf';
import type { QuarterData, RegimenFiscal, ResumenFiscal, LibroContable } from '@/hooks/useGestoria';

// --- HELPERS ---

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

const EUR0 = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- PDF LAYOUT HELPERS ---

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addHeader(doc: jsPDF, title: string, subtitle: string, periodo: string) {
  // Background header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, PAGE_W, 38, 'F');

  // iTaxiBcn logo text
  doc.setTextColor(99, 102, 241); // indigo-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('iTaxiBcn', MARGIN, 12);

  // BORRADOR tag
  doc.setFillColor(239, 68, 68); // red-500
  doc.roundedRect(PAGE_W - MARGIN - 30, 6, 30, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text('BORRADOR', PAGE_W - MARGIN - 15, 12.5, { align: 'center' });

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, MARGIN, 25);

  // Subtitle
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${subtitle}  ·  ${periodo}`, MARGIN, 33);

  return 44; // Y position after header
}

function addSectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(text, MARGIN + 3, y + 5.5);
  return y + 12;
}

function addRow(doc: jsPDF, y: number, casilla: string, label: string, value: string, bold = false): number {
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(casilla, MARGIN + 2, y + 4);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(9);
  doc.text(label, MARGIN + 14, y + 4);

  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(10);
  doc.text(value, PAGE_W - MARGIN - 2, y + 4, { align: 'right' });

  // Subtle bottom line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 7, PAGE_W - MARGIN, y + 7);

  return y + 9;
}

function addResultRow(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFillColor(99, 102, 241); // indigo
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, MARGIN + 4, y + 9);
  doc.setFontSize(14);
  doc.text(value, PAGE_W - MARGIN - 4, y + 9.5, { align: 'right' });

  return y + 20;
}

function addInfoBox(doc: jsPDF, y: number, lines: string[]): number {
  const boxH = 6 + lines.length * 5;
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(217, 119, 6); // amber-600
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2, 2, 'FD');

  doc.setTextColor(146, 64, 14); // amber-800
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  lines.forEach((line, i) => {
    doc.text(line, MARGIN + 3, y + 5 + i * 5);
  });

  return y + boxH + 4;
}

function addFooter(doc: jsPDF) {
  const y = 280;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Generado por iTaxiBcn · Este documento es un BORRADOR informativo, no un documento oficial.', MARGIN, y + 5);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')} · No tiene validez legal.`, MARGIN, y + 9);
  doc.text('Presenta el modelo oficial en sede.agenciatributaria.gob.es', MARGIN, y + 13);
}

// ==============================
// MODELO 131 (Módulos)
// ==============================

export function generateModelo131(quarter: QuarterData, year: number): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const periodo = `${quarter.q}T ${year}`;

  let y = addHeader(doc, 'Modelo 131', 'Pago Fraccionado IRPF · Estimación Objetiva (Módulos)', periodo);

  // Datos Identificativos
  y = addSectionTitle(doc, y, 'DATOS IDENTIFICATIVOS');
  y = addRow(doc, y, '', 'NIF / Nombre y Apellidos', '(Completar en AEAT)');
  y = addRow(doc, y, '', 'Epígrafe IAE', '721.2 — Transporte por autotaxi');
  y = addRow(doc, y, '', 'Régimen', 'Estimación Objetiva (Módulos)');
  y += 4;

  // Actividades en Estimación Objetiva (Apartado I)
  y = addSectionTitle(doc, y, 'I. ACTIVIDADES EN ESTIMACIÓN OBJETIVA (excepto agrarias)');
  y = addRow(doc, y, '[01]', 'Rendimiento neto anual (módulos)', EUR(10361.25));
  y = addRow(doc, y, '[02]', 'Porcentaje aplicable', '4%');

  const cuotaCalc = 10361.25 * 0.04;
  y = addRow(doc, y, '[03]', 'Resultado ([01] × [02])', EUR(cuotaCalc), true);
  y += 2;

  // Liquidación
  y = addSectionTitle(doc, y, 'LIQUIDACIÓN');

  // Pagos anteriores acumulados
  const pagosAnteriores = (quarter.q - 1) * quarter.aPagarIRPF;
  y = addRow(doc, y, '[07]', `Suma de cuotas anteriores (Q1..Q${quarter.q - 1})`, EUR(pagosAnteriores));
  y = addRow(doc, y, '[08]', `Cuota este trimestre (${quarter.q}T)`, EUR(quarter.aPagarIRPF), true);
  y += 4;

  // Resultado
  y = addResultRow(doc, y, `A INGRESAR — Modelo 131 ${periodo}`, EUR(quarter.aPagarIRPF));

  // Info box
  y = addInfoBox(doc, y, [
    `⚠ Fecha límite presentación: ${quarter.deadline}`,
    '• Presentar en: sede.agenciatributaria.gob.es → Modelo 131',
    '• Identificarse con Cl@ve PIN o Certificado Digital',
    `• Seleccionar periodo: ${quarter.q}T ${year}`,
    '• Copiar los importes de este borrador en las casillas correspondientes',
  ]);

  // Modelo 303 complement
  y += 2;
  y = addSectionTitle(doc, y, 'MODELO 303 (IVA) — MISMO PERIODO');
  y = addRow(doc, y, '[01]', 'Base imponible (ventas sin IVA)', EUR(quarter.ingresos));
  y = addRow(doc, y, '[03]', 'IVA Repercutido (10%)', EUR(quarter.ivaRepercutido));
  y = addRow(doc, y, '[28]', 'IVA Soportado deducible', EUR(quarter.ivaSoportado));
  y += 2;
  y = addResultRow(doc, y, `A INGRESAR — Modelo 303 ${periodo}`, EUR(quarter.aPagarIVA));

  // Total summary
  y += 4;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, 'F');
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`TOTAL A PAGAR ${periodo}`, MARGIN + 4, y + 7);
  doc.setFontSize(16);
  doc.text(EUR(quarter.aPagarIRPF + quarter.aPagarIVA), PAGE_W - MARGIN - 4, y + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Mod. 131 + Mod. 303', MARGIN + 4, y + 13);

  addFooter(doc);
  return doc;
}

// ==============================
// MODELO 130 (Estimación Directa)
// ==============================

export function generateModelo130(quarter: QuarterData, year: number, prevQuarters: QuarterData[]): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const periodo = `${quarter.q}T ${year}`;

  let y = addHeader(doc, 'Modelo 130', 'Pago Fraccionado IRPF · Estimación Directa Simplificada', periodo);

  // Datos
  y = addSectionTitle(doc, y, 'DATOS IDENTIFICATIVOS');
  y = addRow(doc, y, '', 'NIF / Nombre y Apellidos', '(Completar en AEAT)');
  y = addRow(doc, y, '', 'Epígrafe IAE', '721.2 — Transporte por autotaxi');
  y = addRow(doc, y, '', 'Régimen', 'Estimación Directa Simplificada');
  y += 4;

  // Acumulados hasta este trimestre
  const ingresosAcum = prevQuarters.reduce((s, q) => s + q.ingresos, 0) + quarter.ingresos;
  const gastosAcum = prevQuarters.reduce((s, q) => s + q.gastos, 0) + quarter.gastos;
  const pagosAnterioresAcum = prevQuarters.reduce((s, q) => s + q.aPagarIRPF, 0);

  y = addSectionTitle(doc, y, `I. ACTIVIDADES ECONÓMICAS (Acumulado Q1..Q${quarter.q})`);
  y = addRow(doc, y, '[01]', `Ingresos acumulados (base sin IVA)`, EUR(ingresosAcum));
  y = addRow(doc, y, '[02]', `Gastos deducibles acumulados`, EUR(gastosAcum));
  y = addRow(doc, y, '[03]', `Rendimiento neto ([01] - [02])`, EUR(ingresosAcum - gastosAcum), true);
  y = addRow(doc, y, '[04]', `20% de [03]`, EUR((ingresosAcum - gastosAcum) * 0.20));
  y = addRow(doc, y, '[07]', `Pagos fraccionados anteriores`, EUR(pagosAnterioresAcum));
  y += 2;

  const resultado = Math.max(0, (ingresosAcum - gastosAcum) * 0.20 - pagosAnterioresAcum);
  y = addResultRow(doc, y, `A INGRESAR — Modelo 130 ${periodo}`, EUR(resultado));

  // Desglose trimestre actual
  y += 2;
  y = addSectionTitle(doc, y, `DESGLOSE ${quarter.q}T (solo informativo)`);
  y = addRow(doc, y, '', 'Ingresos base (sin IVA) trimestre', EUR(quarter.ingresos));
  y = addRow(doc, y, '', 'Gastos deducibles trimestre', EUR(quarter.gastos));
  y = addRow(doc, y, '', 'Beneficio trimestre', EUR(quarter.ingresos - quarter.gastos));
  y += 4;

  // Info box
  y = addInfoBox(doc, y, [
    `⚠ Fecha límite: ${quarter.deadline}`,
    '• El Modelo 130 es ACUMULATIVO: las casillas [01] y [02] suman desde enero.',
    `• Pagos anteriores (Q1..Q${quarter.q - 1}): ${EUR(pagosAnterioresAcum)}`,
    '• Presentar en: sede.agenciatributaria.gob.es → Modelo 130',
  ]);

  // Modelo 303 complement
  y += 2;
  y = addSectionTitle(doc, y, 'MODELO 303 (IVA) — MISMO PERIODO');
  y = addRow(doc, y, '[01]', 'Base imponible (ventas sin IVA)', EUR(quarter.ingresos));
  y = addRow(doc, y, '[03]', 'IVA Repercutido (10%)', EUR(quarter.ivaRepercutido));
  y = addRow(doc, y, '[28]', 'IVA Soportado deducible', EUR(quarter.ivaSoportado));
  y += 2;
  y = addResultRow(doc, y, `A INGRESAR — Modelo 303 ${periodo}`, EUR(quarter.aPagarIVA));

  // Total
  y += 4;
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, 'F');
  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`TOTAL A PAGAR ${periodo}`, MARGIN + 4, y + 7);
  doc.setFontSize(16);
  doc.text(EUR(quarter.aPagarIRPF + quarter.aPagarIVA), PAGE_W - MARGIN - 4, y + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Mod. 130 + Mod. 303', MARGIN + 4, y + 13);

  addFooter(doc);
  return doc;
}

// ==============================
// MODELO 303 (IVA Trimestral)
// ==============================

export function generateModelo303(quarter: QuarterData, year: number): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const periodo = `${quarter.q}T ${year}`;

  let y = addHeader(doc, 'Modelo 303', 'Autoliquidación IVA · Trimestral', periodo);

  y = addSectionTitle(doc, y, 'DATOS IDENTIFICATIVOS');
  y = addRow(doc, y, '', 'NIF / Nombre y Apellidos', '(Completar en AEAT)');
  y = addRow(doc, y, '', 'Actividad', '721.2 — Transporte por autotaxi');
  y = addRow(doc, y, '', 'Tipo IVA servicios', '10% (Tipo Reducido)');
  y += 4;

  // IVA Devengado (Repercutido)
  y = addSectionTitle(doc, y, 'IVA DEVENGADO');
  y = addRow(doc, y, '[01]', 'Base imponible (servicios 10%)', EUR(quarter.ingresos));
  y = addRow(doc, y, '[02]', 'Tipo impositivo', '10%');
  y = addRow(doc, y, '[03]', 'Cuota devengada (IVA Repercutido)', EUR(quarter.ivaRepercutido), true);
  y += 4;

  // IVA Deducible (Soportado)
  y = addSectionTitle(doc, y, 'IVA DEDUCIBLE');
  y = addRow(doc, y, '[28]', 'Cuotas soportadas en operaciones interiores', EUR(quarter.ivaSoportado));
  y = addRow(doc, y, '', '(Combustible, mantenimiento, reparaciones, etc.)', '');
  y += 4;

  // Resultado
  y = addSectionTitle(doc, y, 'RESULTADO');
  y = addRow(doc, y, '[40]', 'IVA devengado total', EUR(quarter.ivaRepercutido));
  y = addRow(doc, y, '[45]', 'IVA deducible total', EUR(quarter.ivaSoportado));
  y = addRow(doc, y, '[46]', 'Diferencia ([40] - [45])', EUR(quarter.ivaRepercutido - quarter.ivaSoportado), true);
  y += 4;

  if (quarter.aPagarIVA >= 0) {
    y = addResultRow(doc, y, `A INGRESAR — Modelo 303 ${periodo}`, EUR(quarter.aPagarIVA));
  } else {
    // A compensar
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`A COMPENSAR — Modelo 303 ${periodo}`, MARGIN + 4, y + 9);
    doc.setFontSize(14);
    doc.text(EUR(Math.abs(quarter.aPagarIVA)), PAGE_W - MARGIN - 4, y + 9.5, { align: 'right' });
    y += 20;
  }

  // Info
  y = addInfoBox(doc, y, [
    `⚠ Fecha límite: ${quarter.deadline}`,
    '• Presentar en: sede.agenciatributaria.gob.es → Modelo 303',
    '• El IVA taxi es tipo REDUCIDO (10%), no tipo general (21%)',
    '• Guarda todas las facturas de gastos durante al menos 4 años',
    '• Si el resultado es negativo, se compensa en trimestres siguientes',
  ]);

  // Breakdown detail
  y += 4;
  y = addSectionTitle(doc, y, 'DESGLOSE INFORMATIVO');

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const ingresosBrutos = quarter.ingresos * 1.10;
  doc.text(`Facturación bruta (inc. IVA): ${EUR(ingresosBrutos)}`, MARGIN + 3, y + 4);
  y += 6;
  doc.text(`Base imponible (sin IVA): ${EUR(quarter.ingresos)}`, MARGIN + 3, y + 4);
  y += 6;
  doc.text(`IVA repercutido a clientes: ${EUR(quarter.ivaRepercutido)}`, MARGIN + 3, y + 4);
  y += 6;
  doc.text(`IVA soportado en compras: ${EUR(quarter.ivaSoportado)}`, MARGIN + 3, y + 4);

  addFooter(doc);
  return doc;
}

// ==============================
// RESUMEN ANUAL PARA RENTA
// ==============================

export function generateResumenAnual(
  resumen: ResumenFiscal,
  quarters: QuarterData[],
  libro: LibroContable[],
  regimen: RegimenFiscal,
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');

  let y = addHeader(doc, `Resumen Fiscal ${resumen.ano}`, 'Datos preparados para la Declaración de la Renta (Mod. 100)', `Ejercicio ${resumen.ano}`);

  // Régimen
  y = addSectionTitle(doc, y, 'RÉGIMEN FISCAL');
  y = addRow(doc, y, '', 'Régimen tributario', regimen === 'modulos' ? 'Estimación Objetiva (Módulos)' : 'Estimación Directa Simplificada');
  y = addRow(doc, y, '', 'Actividad', 'IAE 721.2 — Transporte por autotaxi');
  y += 4;

  // Ingresos y Gastos
  y = addSectionTitle(doc, y, 'INGRESOS Y GASTOS');
  y = addRow(doc, y, '', 'Ingresos brutos (inc. IVA)', EUR(resumen.ingresosBrutos));
  y = addRow(doc, y, '', 'Base ingresos (sin IVA 10%)', EUR(resumen.baseIngresosIRPF));
  y = addRow(doc, y, '', 'Gastos totales', EUR(resumen.gastosTotales));
  y = addRow(doc, y, '', 'Gastos deducibles IRPF (base)', EUR(resumen.gastosDeduciblesIRPF));
  y = addRow(doc, y, '', 'Rendimiento neto', EUR(resumen.beneficioNeto), true);
  y += 4;

  // IRPF
  y = addSectionTitle(doc, y, 'IRPF');
  y = addRow(doc, y, '', 'IRPF progresivo estimado', EUR(resumen.irpfEstimadoAnual));

  quarters.forEach(q => {
    y = addRow(doc, y, '', `  Pago fraccionado ${q.q}T (Mod. ${q.modeloIRPF})`, EUR(q.aPagarIRPF));
  });

  y = addRow(doc, y, '', 'Total pagado trimestralmente', EUR(resumen.irpfPagadoTrimestralmente));
  y = addRow(doc, y, '', 'Pendiente regularización', EUR(resumen.irpfPendiente), true);
  y += 4;

  // IVA Resumen
  y = addSectionTitle(doc, y, 'IVA ANUAL (para Mod. 390)');
  const totalIvaRep = quarters.reduce((s, q) => s + q.ivaRepercutido, 0);
  const totalIvaSop = quarters.reduce((s, q) => s + q.ivaSoportado, 0);
  const totalIvaPagar = quarters.reduce((s, q) => s + q.aPagarIVA, 0);
  y = addRow(doc, y, '', 'IVA Repercutido total', EUR(totalIvaRep));
  y = addRow(doc, y, '', 'IVA Soportado total', EUR(totalIvaSop));
  y = addRow(doc, y, '', 'IVA neto anual', EUR(totalIvaPagar), true);
  y += 4;

  // Seguridad Social
  y = addSectionTitle(doc, y, 'SEGURIDAD SOCIAL');
  y = addRow(doc, y, '', 'Cuota autónomo mensual', EUR0(resumen.cuotaAutonoMensual));
  y = addRow(doc, y, '', 'Cuota autónomo anual (estimada)', EUR0(resumen.cuotaAutonoAnual));
  y = addRow(doc, y, '', '(Deducible en IRPF como gasto)', '100%');
  y += 4;

  // Result box
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, 'F');
  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RESULTADO ESTIMADO EJERCICIO', MARGIN + 4, y + 6);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('(Beneficio - IRPF - Cuota autónomos)', MARGIN + 4, y + 11);

  const resultadoFinal = resumen.beneficioNeto - resumen.irpfEstimadoAnual - resumen.cuotaAutonoAnual;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(resultadoFinal >= 0 ? 22 : 220, resultadoFinal >= 0 ? 163 : 38, resultadoFinal >= 0 ? 74 : 38);
  doc.text(EUR(resultadoFinal), PAGE_W - MARGIN - 4, y + 13, { align: 'right' });
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('neto estimado (antes de IVA, después de impuestos y SS)', PAGE_W - MARGIN - 4, y + 18, { align: 'right' });

  addFooter(doc);
  return doc;
}

// ==============================
// DOWNLOAD / SHARE
// ==============================

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export async function sharePDF(doc: jsPDF, filename: string, title?: string): Promise<void> {
  try {
    const blob = doc.output('blob');

    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareData = { files: [file], title: title || filename };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    }

    // Fallback: download
    downloadPDF(doc, filename);
  } catch (e) {
    // User cancelled share or not supported
    if ((e as Error).name !== 'AbortError') {
      downloadPDF(doc, filename);
    }
  }
}
