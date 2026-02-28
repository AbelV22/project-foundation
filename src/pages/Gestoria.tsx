import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Euro, TrendingUp, TrendingDown,
  FileText, AlertTriangle, CheckCircle2, Clock, Calendar,
  Car, BookOpen, ChevronRight, Info, Download, Zap, Activity,
  ChevronLeft, Wrench, Banknote, Shield, Share2, Bell,
  BellOff, ExternalLink, HelpCircle, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGestoria, calcularAmortizacion, RegimenFiscal,
  QuarterData, Vencimiento, LibroContable,
} from "@/hooks/useGestoria";
import { getItem, setItem } from "@/lib/storage";
import { toast } from "sonner";
import {
  generateModelo131, generateModelo130, generateModelo303,
  generateResumenAnual, openPDF, sharePDF, downloadPDF,
} from "@/services/gestoria/pdfModelos";
import {
  exportLibroContableCSV, exportCarrerasCSV, exportGastosCSV,
  exportResumenTrimestralCSV, shareCSV, downloadCSV,
} from "@/services/gestoria/exportLibro";
import {
  scheduleVencimientoAlerts, requestNotificationPermission,
  checkNotificationPermission, cancelAllGestoriaAlerts,
} from "@/services/gestoria/localNotifications";
import GuiaClavePin from "@/components/gestoria/GuiaClavePin";

// --- HELPERS ---

const fmt = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const fmtDec = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- QUARTER STATUS STYLES ---

const quarterStyles: Record<QuarterData['status'], {
  border: string; badge: string; badgeText: string; icon: React.ReactNode;
}> = {
  urgente: {
    border: 'border-red-500/40',
    badge: 'bg-red-500/20 text-red-300',
    badgeText: '¡URGENTE!',
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
  },
  proximo: {
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300',
    badgeText: 'PRÓXIMO',
    icon: <Clock className="h-4 w-4 text-amber-400" />,
  },
  pendiente: {
    border: 'border-border/50',
    badge: 'bg-muted text-muted-foreground',
    badgeText: 'PENDIENTE',
    icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
  },
  pasado: {
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300',
    badgeText: 'PRESENTADO',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  },
};

// --- URGENCIA STYLES ---

const urgenciaStyles: Record<Vencimiento['urgencia'], { dot: string; text: string; bg: string }> = {
  pasado: { dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' },
  verde: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  amarillo: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  rojo: { dot: 'bg-red-400 animate-pulse', text: 'text-red-400', bg: 'bg-red-500/10' },
};

// --- TABS ---

type Tab = 'resumen' | 'trimestres' | 'deducibles' | 'vencimientos' | 'libro' | 'herramientas';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'resumen', label: 'Resumen', icon: '📊' },
  { id: 'trimestres', label: 'Impuestos', icon: '📋' },
  { id: 'deducibles', label: 'Deducibles', icon: '📁' },
  { id: 'vencimientos', label: 'Vencimientos', icon: '🗓️' },
  { id: 'libro', label: 'Libro', icon: '📚' },
  { id: 'herramientas', label: 'Presenta', icon: '🚀' },
];

// === SECTION: RESUMEN ===

function ResumenSection({
  resumen, loading, regimen, setRegimen, beneficioModulos, tramoInfo,
}: {
  resumen: ReturnType<typeof useGestoria>['resumen'];
  loading: boolean;
  regimen: RegimenFiscal;
  setRegimen: (r: RegimenFiscal) => void;
  beneficioModulos: number;
  tramoInfo: ReturnType<typeof useGestoria>['tramoInfo'];
}) {
  if (loading) return <SectionSkeleton rows={4} />;

  const items = [
    {
      label: 'Ingresos brutos (inc. IVA)',
      value: fmt(resumen.ingresosBrutos),
      color: 'text-emerald-400',
      icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
    },
    {
      label: 'Gastos deducibles (base+IVA)',
      value: `-${fmt(resumen.gastosTotales)}`,
      color: 'text-red-400',
      icon: <TrendingDown className="h-4 w-4 text-red-400" />,
    },
    {
      label: 'Beneficio neto (sujeto a IRPF)',
      value: fmt(resumen.beneficioNeto),
      color: resumen.beneficioNeto >= 0 ? 'text-primary' : 'text-red-400',
      icon: <Euro className="h-4 w-4 text-primary" />,
      separator: true,
      sub: regimen === 'modulos' ? '(Módulo Anual Orientativo)' : '(Estimación Directa real)'
    },
    {
      label: 'IRPF anual progresivo',
      value: fmt(resumen.irpfEstimadoAnual),
      color: 'text-amber-400',
      icon: <FileText className="h-4 w-4 text-amber-400" />,
    },
    {
      label: `Ya pagado (Mod. ${regimen === 'modulos' ? '131' : '130'})`,
      value: `-${fmt(resumen.irpfPagadoTrimestralmente)}`,
      color: 'text-slate-400',
      icon: <CheckCircle2 className="h-4 w-4 text-slate-400" />,
    },
    {
      label: 'IRPF pendiente',
      value: fmt(resumen.irpfPendiente),
      color: resumen.irpfPendiente > 0 ? 'text-red-400' : 'text-emerald-400',
      icon: <AlertTriangle className="h-4 w-4" />,
      separator: true,
    },
    {
      label: 'Cuota autónomo/mes',
      value: fmt(resumen.cuotaAutonoMensual),
      color: 'text-blue-400',
      icon: <Zap className="h-4 w-4 text-blue-400" />,
      sub: `~${fmt(resumen.cuotaAutonoAnual)}/año (Tramos 2025)`,
    },
  ];

  const beneficioDirecta = resumen.baseIngresosIRPF - resumen.gastosDeduciblesIRPF;
  const isMejorModulos = beneficioModulos < beneficioDirecta;

  return (
    <div className="space-y-4">
      {/* Regimen Selector */}
      <div className="rounded-2xl border border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Configuración Fiscal</span>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-xl border border-border/30">
          <button
            onClick={() => setRegimen('directa')}
            className={cn("px-3 py-2 text-xs font-semibold rounded-lg transition-all",
              regimen === 'directa' ? "bg-background shadow-sm text-foreground border border-border/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Est. Directa
          </button>
          <button
            onClick={() => setRegimen('modulos')}
            className={cn("px-3 py-2 text-xs font-semibold rounded-lg transition-all",
              regimen === 'modulos' ? "bg-background shadow-sm text-foreground border border-border/50" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Módulos
          </button>
        </div>

        {/* Comparador */}
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground mb-2">Rendimiento neto sujeto a retención (IRPF)</p>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="w-16">Módulos:</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-400" style={{ width: `${Math.min(100, (beneficioModulos / Math.max(beneficioModulos, beneficioDirecta)) * 100)}%` }} />
            </div>
            <span className="font-mono">{fmt(beneficioModulos)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16">Directa:</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, (beneficioDirecta / Math.max(beneficioModulos, beneficioDirecta)) * 100)}%` }} />
            </div>
            <span className="font-mono">{fmt(beneficioDirecta)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center flex gap-1 justify-center bg-muted/20 p-1.5 rounded-lg border border-border/20">
            💡 Te conviene más tributar por <strong className={isMejorModulos ? "text-blue-400" : "text-emerald-400"}>{isMejorModulos ? 'Módulos' : 'E. Directa'}</strong>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Beneficio neto {resumen.ano}
        </p>
        <p className={cn("text-4xl font-black font-mono tabular-nums",
          resumen.beneficioNeto >= 0 ? "text-primary" : "text-red-400"
        )}>
          {fmt(resumen.beneficioNeto)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-2">
          Incluye gastos prorrateados por deducibilidad
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-card/10">
        {items.map((item, i) => (
          <div key={i}>
            {item.separator && i > 0 && (
              <div className="h-px bg-primary/10 mx-4" />
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {item.icon}
                <span>{item.label}</span>
              </div>
              <div className="text-right">
                <span className={cn("font-bold font-mono", item.color)}>{item.value}</span>
                {item.sub && <p className="text-[10px] text-muted-foreground">{item.sub}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          El servicio de taxi devenga <strong className="text-foreground">10% IVA</strong> (tipo reducido).
          Se liquida trimestralmente con el <strong className="text-foreground">Modelo 303</strong>.
        </p>
      </div>

      {/* Tramo Autónomo */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold">Cuota Autónomo (RETA 2025-2026)</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, (tramoInfo.numero / tramoInfo.total) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            Tramo {tramoInfo.numero}/{tramoInfo.total}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Rend. neto mensual estimado</p>
            <p className="text-sm font-mono font-semibold">
              {tramoInfo.rendimientoMensual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}/mes
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Cuota mensual</p>
            <p className="text-xl font-black font-mono text-blue-400">
              {fmt(tramoInfo.cuota)}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Puedes cambiar de tramo hasta 6 veces/año en la Sede Electrónica de la SS.
        </p>
      </div>
    </div>
  );
}

// === SECTION: MODELOS TRIMESTRALES ===

function TrimestresSection({ quarters, regimen, loading, year }: { quarters: QuarterData[]; regimen: RegimenFiscal; loading: boolean; year: number }) {
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  if (loading) return <SectionSkeleton rows={4} />;

  const nextQ = quarters.find(q => q.status !== 'pasado');

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Modelo {regimen === 'modulos' ? '131' : '130'} (IRPF) + 303 (IVA)</strong>.
          Vencen antes del 20 del mes siguiente al trimestre. (El Q4 el 30 de enero).
        </p>
      </div>

      {nextQ && (nextQ.status === 'urgente' || nextQ.status === 'proximo') && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">Próximo vencimiento</p>
            <p className="text-xs text-muted-foreground">
              {nextQ.label} — {nextQ.deadline} · {nextQ.daysLeft > 0 ? `en ${nextQ.daysLeft} días` : 'HOY'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-black text-lg font-mono text-amber-400">{fmt(nextQ.aPagarIRPF + nextQ.aPagarIVA)}</p>
            <p className="text-[10px] text-amber-400/80 font-semibold uppercase">TOTAL</p>
          </div>
        </div>
      )}

      {quarters.map(q => {
        const style = quarterStyles[q.status];
        const isOpen = expandedQ === q.q;
        return (
          <div
            key={q.q}
            className={cn("rounded-2xl border overflow-hidden transition-colors", style.border, isOpen ? "bg-card/30" : "")}
          >
            <button
              className="w-full p-4 flex items-center gap-3 text-left"
              onClick={() => setExpandedQ(isOpen ? null : q.q)}
            >
              {style.icon}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{q.label}</span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", style.badge)}>
                    {style.badgeText}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vence: {q.deadline}
                  {q.daysLeft > 0 && q.status !== 'pasado' && ` · ${q.daysLeft} días`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn("font-black font-mono text-lg",
                  (q.aPagarIRPF + q.aPagarIVA) > 0 ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {fmt(q.aPagarIRPF + q.aPagarIVA)}
                </p>
                <p className="text-[10px] text-muted-foreground">a pagar</p>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 border-t border-border/30 pt-4 space-y-4">
                    {/* BLOQUE IVA */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">IVA (Modelo 303)</p>
                      {[
                        { label: 'IVA Repercutido (carreras)', val: fmtDec(q.ivaRepercutido) },
                        { label: 'IVA Soportado (gastos)', val: `-${fmtDec(q.ivaSoportado)}` },
                        { label: 'Total Mod. 303', val: fmtDec(q.aPagarIVA), separator: true }
                      ].map((row, i) => (
                        <div key={i}>
                          {row.separator && <div className="h-px bg-border/50 my-1" />}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className={row.separator ? "font-mono font-bold text-amber-400" : "font-mono text-foreground"}>{row.val}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* BLOQUE IRPF */}
                    <div className="space-y-2 pt-2 border-t border-border/30">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">IRPF (Modelo {q.modeloIRPF})</p>
                      {regimen === 'modulos' ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Cuota fija trimestral</span>
                          <span className="font-mono font-bold text-amber-400">{fmtDec(q.aPagarIRPF)}</span>
                        </div>
                      ) : (
                        <>
                          {[
                            { label: 'Base ingresos (sin IVA)', val: fmtDec(q.ingresos) },
                            { label: 'Base gastos deducibles', val: `-${fmtDec(q.gastos)}` },
                            { label: 'Total Mod. 130', val: fmtDec(q.aPagarIRPF), separator: true },
                          ].map((row, i) => (
                            <div key={i}>
                              {row.separator && <div className="h-px bg-border/50 my-1" />}
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{row.label}</span>
                                <span className={row.separator ? "font-mono font-bold text-amber-400" : "font-mono text-foreground"}>{row.val}</span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* DOWNLOAD BUTTONS */}
                    <div className="pt-3 border-t border-border/30 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            const doc = regimen === 'modulos'
                              ? generateModelo131(q, year)
                              : generateModelo130(q, year, quarters.filter(pq => pq.q < q.q));
                            openPDF(doc, `Borrador_Mod${q.modeloIRPF}_${q.q}T_${year}.pdf`);
                            toast.success(`Borrador Mod. ${q.modeloIRPF} generado`);
                          } catch (err) {
                            toast.error('Error generando PDF');
                            console.error(err);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Mod. {q.modeloIRPF} + 303
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            const doc = generateModelo303(q, year);
                            openPDF(doc, `Borrador_Mod303_${q.q}T_${year}.pdf`);
                            toast.success('Borrador Mod. 303 generado');
                          } catch (err) {
                            toast.error('Error generando PDF');
                            console.error(err);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Solo 303
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// === SECTION: GASTOS DEDUCIBLES ===

function DeduciblesSection({ gastos, loading }: {
  gastos: ReturnType<typeof useGestoria>['gastosDeduciblesLista'];
  loading: boolean;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  if (loading) return <SectionSkeleton rows={6} />;

  // Group by concept
  const byConcepto: Record<string, { total: number; count: number; pct: number }> = {};
  gastos.forEach(g => {
    const key = g.concepto;
    if (!byConcepto[key]) byConcepto[key] = { total: 0, count: 0, pct: g.deducibilidad };
    byConcepto[key].total += g.amount * g.deducibilidad / 100;
    byConcepto[key].count++;
  });

  const totalDeducible = gastos.reduce((s, g) => s + g.amount * g.deducibilidad / 100, 0);
  const sorted = Object.entries(byConcepto).sort(([, a], [, b]) => b.total - a.total);

  const gastosFiltrados = filtro
    ? gastos.filter(g => g.concepto === filtro)
    : gastos;

  return (
    <div className="space-y-3">
      {/* Total */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total gastos deducibles {new Date().getFullYear()}</p>
          <p className="font-black text-2xl font-mono text-emerald-400">{fmt(totalDeducible)}</p>
        </div>
        <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
      </div>

      {/* By category */}
      {sorted.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground px-1">Por categoría (toca para filtrar)</p>
          <div className="space-y-2">
            {sorted.map(([concepto, data]) => {
              const pct = totalDeducible > 0 ? (data.total / totalDeducible) * 100 : 0;
              const active = filtro === concepto;
              return (
                <button
                  key={concepto}
                  onClick={() => setFiltro(active ? null : concepto)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    active ? "border-primary/40 bg-primary/10" : "border-border/50 bg-card/50"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium">{concepto}</span>
                      {data.pct < 100 && (
                        <span className="ml-2 text-[10px] text-amber-400">{data.pct}% deducible</span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-sm text-emerald-400">{fmt(data.total)}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{data.count} registros · {pct.toFixed(0)}% del total</p>
                </button>
              );
            })}
          </div>

          {/* Filtered list */}
          {filtro && (
            <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
              {gastosFiltrados.slice(0, 20).map(g => (
                <div key={g.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm">{g.notas || g.concepto}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(g.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-emerald-400">{fmtDec(g.amount * g.deducibilidad / 100)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
          <p className="text-sm">Sin gastos registrados</p>
          <p className="text-xs mt-1">Añade gastos desde el Registro de Gastos</p>
        </div>
      )}

      {/* Tax tip */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          La <strong className="text-foreground">cuota de autónomo</strong> es 100% deducible en IRPF.
          El <strong className="text-foreground">teléfono</strong> solo el 50%.
          Guarda <strong className="text-foreground">todas las facturas</strong> durante 4 años.
        </p>
      </div>
    </div>
  );
}

// === SECTION: VENCIMIENTOS ===

const TIPO_ICONS: Record<Vencimiento['tipo'], React.ReactNode> = {
  modelo130:  <FileText className="h-4 w-4 text-amber-400 shrink-0" />,
  modelo131:  <FileText className="h-4 w-4 text-amber-400 shrink-0" />,
  modelo303:  <Banknote className="h-4 w-4 text-blue-400 shrink-0" />,
  modelo390:  <Banknote className="h-4 w-4 text-blue-400 shrink-0" />,
  'irpf-anual': <FileText className="h-4 w-4 text-purple-400 shrink-0" />,
  autonomo:   <Shield className="h-4 w-4 text-emerald-400 shrink-0" />,
  itv:        <Wrench className="h-4 w-4 text-orange-400 shrink-0" />,
  otro:       <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />,
};

function VencimientosSection({ vencimientos, loading, regimen }: {
  vencimientos: Vencimiento[];
  loading: boolean;
  regimen: RegimenFiscal;
}) {
  if (loading) return <SectionSkeleton rows={5} />;

  const upcoming = vencimientos.filter(v => v.urgencia !== 'pasado').slice(0, 12);
  const past = vencimientos.filter(v => v.urgencia === 'pasado');

  return (
    <div className="space-y-3">
      {upcoming.length === 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-400 font-semibold">Al día con Hacienda 🎉</p>
          <p className="text-xs text-muted-foreground">No hay vencimientos urgentes</p>
        </div>
      )}

      {upcoming.map(v => {
        const style = urgenciaStyles[v.urgencia];
        return (
          <div key={v.id} className={cn("rounded-xl border p-3 flex items-start gap-3", style.bg, "border-border/50")}>
            <div className="mt-0.5">{TIPO_ICONS[v.tipo]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{v.titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{v.descripcion}</p>
              <p className={cn("text-xs font-medium mt-1", style.text)}>
                {new Date(v.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                {v.daysLeft > 0 && ` — en ${v.daysLeft} días`}
                {v.daysLeft === 0 && ' — ¡HOY!'}
              </p>
            </div>
          </div>
        );
      })}

      {past.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground px-1 pt-2">Pasados</p>
          {past.slice(-3).map(v => (
            <div key={v.id} className="rounded-xl border border-border/30 p-3 flex items-center gap-3 opacity-50">
              <CheckCircle2 className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{v.titulo}</p>
                <p className="text-[10px] text-slate-600">
                  {new Date(v.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Presenta los modelos en <strong className="text-foreground">Sede Electrónica AEAT</strong> (aeat.es)
          con Cl@ve PIN o certificado digital.
          {regimen === 'modulos'
            ? ' Mod. 131 (IRPF) + 303 (IVA) trimestrales.'
            : ' Mod. 130 (IRPF) + 303 (IVA) trimestrales.'}
        </p>
      </div>
    </div>
  );
}

function LibroSection({ libro, ingresosBrutos, gastosDeducibles, loading, year, carreras, gastos }: {
  libro: LibroContable[];
  ingresosBrutos: number;
  gastosDeducibles: number;
  loading: boolean;
  year: number;
  carreras: ReturnType<typeof useGestoria>['carreras'];
  gastos: ReturnType<typeof useGestoria>['gastos'];
}) {
  if (loading) return <SectionSkeleton rows={12} />;

  const mesesConDatos = libro.filter(m => m.ingresoCount > 0 || m.gastoCount > 0);
  const maxIngr = Math.max(...libro.map(m => m.ingresosBase + m.ivaRepercutido), 1);

  return (
    <div className="space-y-3">
      {/* Export buttons */}
      <div className="rounded-xl border border-border/50 p-3 space-y-2 bg-card/50">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground flex-1">
            Libro de Ingresos y Gastos · Exportar para tu archivo
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              const csv = exportLibroContableCSV(libro, year);
              shareCSV(csv, `Libro_Contable_${year}.csv`);
              toast.success('Libro contable exportado');
            }}
            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            <FileSpreadsheet className="h-3 w-3" />
            Resumen
          </button>
          <button
            onClick={() => {
              const csv = exportCarrerasCSV(carreras, year);
              shareCSV(csv, `Carreras_${year}.csv`);
              toast.success('Carreras exportadas');
            }}
            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            <FileSpreadsheet className="h-3 w-3" />
            Ingresos
          </button>
          <button
            onClick={() => {
              const csv = exportGastosCSV(gastos, year);
              shareCSV(csv, `Gastos_${year}.csv`);
              toast.success('Gastos exportados');
            }}
            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            <FileSpreadsheet className="h-3 w-3" />
            Gastos
          </button>
        </div>
      </div>

      {/* Year summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Total ingresado (inc. IVA)</p>
          <p className="font-black font-mono text-emerald-400">{fmt(ingresosBrutos)}</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Total deducibles (base+IVA)</p>
          <p className="font-black font-mono text-red-400">{fmt(gastosDeducibles)}</p>
        </div>
      </div>

      {/* Monthly table */}
      {mesesConDatos.length > 0 ? (
        <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/20">
          {/* Header */}
          <div className="grid grid-cols-[1fr_75px_70px_65px] gap-2 px-3 py-2 bg-muted/40 border-b border-border/30">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Mes</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase text-right">Base</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase text-right">IVA</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase text-right">Neto</span>
          </div>
          <div className="divide-y divide-border/30">
            {libro.map((mes, idx) => {
              const hasDatos = mes.ingresoCount > 0 || mes.gastoCount > 0;
              const bNeto = mes.ingresosBase - mes.gastosBase;
              const barWidth = maxIngr > 0 ? ((mes.ingresosBase + mes.ivaRepercutido) / maxIngr) * 100 : 0;
              return (
                <div key={idx} className={cn("px-3 py-3", !hasDatos && "opacity-30")}>
                  <div className="grid grid-cols-[1fr_75px_70px_65px] gap-2 items-center">
                    <div className="overflow-hidden">
                      <span className="text-xs font-semibold">{mes.mes.split(' ')[0]}</span>
                      {hasDatos && (
                        <div className="mt-1.5 h-[3px] bg-muted/50 rounded-full w-full max-w-[80px]">
                          <div
                            className="h-full bg-emerald-400/60 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-xs text-emerald-400">{hasDatos ? fmt(Math.round(mes.ingresosBase)) : '—'}</span>
                      <span className="font-mono text-[10px] text-red-400">-{hasDatos ? fmt(Math.round(mes.gastosBase)) : '—'}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-xs text-emerald-400">{hasDatos ? fmt(Math.round(mes.ivaRepercutido)) : '—'}</span>
                      <span className="font-mono text-[10px] text-red-400">-{hasDatos ? fmt(Math.round(mes.ivaSoportado)) : '—'}</span>
                    </div>
                    <span className={cn("font-mono text-xs font-bold text-right",
                      bNeto >= 0 ? "text-primary" : "text-red-400",
                      !hasDatos && "text-muted-foreground"
                    )}>
                      {hasDatos ? fmt(Math.round(bNeto)) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Fila TOTAL */}
          {mesesConDatos.length > 0 && (() => {
            const totalBase = libro.reduce((s, m) => s + m.ingresosBase - m.gastosBase, 0);
            const totalIVANet = libro.reduce((s, m) => s + m.ivaRepercutido - m.ivaSoportado, 0);
            const totalNeto = libro.reduce((s, m) => s + m.beneficio, 0);
            return (
              <div className="grid grid-cols-[1fr_75px_70px_65px] gap-2 px-3 py-3 bg-muted/40 border-t border-border/50">
                <span className="text-xs font-bold uppercase text-foreground">TOTAL</span>
                <span className={cn("font-mono text-xs font-bold text-right",
                  totalBase >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {fmt(Math.round(totalBase))}
                </span>
                <span className={cn("font-mono text-xs font-bold text-right",
                  totalIVANet >= 0 ? "text-blue-400" : "text-red-400"
                )}>
                  {fmt(Math.round(totalIVANet))}
                </span>
                <span className={cn("font-mono text-xs font-black text-right",
                  totalNeto >= 0 ? "text-primary" : "text-red-400"
                )}>
                  {fmt(Math.round(totalNeto))}
                </span>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 p-8 text-center text-muted-foreground bg-card/20">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin datos registrados</p>
          <p className="text-xs mt-1">Registra carreras y gastos para ver el libro</p>
        </div>
      )}
    </div>
  );
}

// === AMORTIZACIÓN WIDGET ===

function AmortizacionWidget() {
  const [precio, setPrecio] = useState('');
  const [fecha, setFecha] = useState('');
  const [esNuevo, setEsNuevo] = useState(true);
  const [resultado, setResultado] = useState<ReturnType<typeof calcularAmortizacion> | null>(null);

  // Load saved values
  useEffect(() => {
    const load = async () => {
      const p = await getItem('amort_precio');
      const f = await getItem('amort_fecha');
      const n = await getItem('amort_nuevo');
      if (p) setPrecio(p);
      if (f) setFecha(f);
      if (n) setEsNuevo(n === 'true');
    };
    load();
  }, []);

  const calcular = async () => {
    const p = parseFloat(precio.replace(',', '.'));
    if (!p || !fecha) return;
    await setItem('amort_precio', precio);
    await setItem('amort_fecha', fecha);
    await setItem('amort_nuevo', String(esNuevo));
    setResultado(calcularAmortizacion(p, fecha, esNuevo));
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="rounded-xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Amortización del vehículo</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tabla simplificada AEAT: 16%/año vehículo nuevo, 8%/año usado
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Precio compra (€)</label>
            <input
              type="number"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              placeholder="25000"
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-muted border border-border/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fecha compra</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-muted border border-border/50 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEsNuevo(!esNuevo)}
            className="flex items-center gap-2 text-sm"
          >
            <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
              esNuevo ? "border-primary bg-primary" : "border-border"
            )}>
              {esNuevo && <span className="text-black text-[10px] font-bold">✓</span>}
            </div>
            <span className="text-sm">Vehículo nuevo</span>
          </button>
        </div>
        <button
          onClick={calcular}
          disabled={!precio || !fecha}
          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          Calcular
        </button>
      </div>

      {resultado && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          {[
            { label: 'Amortización anual', val: fmt(resultado.amortizacionAnual) },
            { label: 'Amortización mensual', val: fmt(resultado.amortizacionMensual) },
            { label: 'Acumulada hasta hoy', val: fmt(resultado.amortizacionAcumulada) },
            { label: 'Valor residual', val: fmt(resultado.valorResidual) },
            { label: 'Años restantes', val: `${resultado.anyosRestantes} años` },
          ].map((row, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono font-bold text-primary">{row.val}</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            La amortización anual se suma a tus gastos deducibles en el Modelo 130
          </p>
        </div>
      )}
    </div>
  );
}

// === SECTION: HERRAMIENTAS (Presenta) ===

function HerramientasSection({
  quarters, resumen, libro, regimen, year, vencimientos, carreras, gastos,
}: {
  quarters: QuarterData[];
  resumen: ReturnType<typeof useGestoria>['resumen'];
  libro: LibroContable[];
  regimen: RegimenFiscal;
  year: number;
  vencimientos: Vencimiento[];
  carreras: ReturnType<typeof useGestoria>['carreras'];
  gastos: ReturnType<typeof useGestoria>['gastos'];
}) {
  const [showGuia, setShowGuia] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    checkNotificationPermission().then(ok => setNotifEnabled(ok));
  }, []);

  const handleToggleNotifications = async () => {
    if (notifEnabled) {
      await cancelAllGestoriaAlerts();
      setNotifEnabled(false);
      setNotifCount(0);
      toast.success('Alertas desactivadas');
    } else {
      const granted = await requestNotificationPermission();
      if (granted) {
        const count = await scheduleVencimientoAlerts(vencimientos);
        setNotifEnabled(true);
        setNotifCount(count);
        toast.success(`${count} alertas programadas`);
      } else {
        toast.error('Permisos de notificación denegados');
      }
    }
  };

  if (showGuia) {
    return <GuiaClavePin onClose={() => setShowGuia(false)} />;
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 text-center">
        <p className="text-3xl mb-2">🚀</p>
        <h3 className="font-bold text-lg">Presenta tus modelos</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Genera borradores, exporta datos y aprende a presentar en AEAT
        </p>
      </div>

      {/* Guía Cl@ve */}
      <button
        onClick={() => setShowGuia(true)}
        className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3 text-left hover:border-amber-500/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <HelpCircle className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Guía: Presentar con Cl@ve PIN</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paso a paso para presentar sin gestoría
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>

      {/* PDF Borradores */}
      <div className="rounded-2xl border border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Borradores PDF</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Descarga borradores pre-rellenados con tus datos. Copia los importes en la Sede Electrónica de AEAT.
        </p>

        <div className="space-y-2">
          {quarters.map(q => (
            <button
              key={q.q}
              onClick={() => {
                try {
                  const doc = regimen === 'modulos'
                    ? generateModelo131(q, year)
                    : generateModelo130(q, year, quarters.filter(pq => pq.q < q.q));
                  openPDF(doc, `Borrador_${q.q}T_${year}_Mod${q.modeloIRPF}+303.pdf`);
                  toast.success(`Borrador ${q.q}T generado`);
                } catch (err) {
                  console.error(err);
                  toast.error('Error generando PDF');
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                <div className="text-left">
                  <p className="text-xs font-semibold">{q.label}</p>
                  <p className="text-[10px] text-muted-foreground">Mod. {q.modeloIRPF} + 303</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400">{fmt(q.aPagarIRPF + q.aPagarIVA)}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Resumen Anual PDF */}
      <button
        onClick={() => {
          try {
            const doc = generateResumenAnual(resumen, quarters, libro, regimen);
            openPDF(doc, `Resumen_Fiscal_${year}.pdf`);
            toast.success('Resumen anual generado');
          } catch (err) {
            console.error(err);
            toast.error('Error generando PDF');
          }
        }}
        className="w-full rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex items-center gap-3 text-left hover:border-purple-500/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Resumen Fiscal {year}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PDF con todos los datos preparados para la Renta
          </p>
        </div>
        <Download className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>

      {/* CSV Exports */}
      <div className="rounded-2xl border border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold">Exportar datos (CSV)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Compatible con Excel, Google Sheets y programas contables.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: 'Libro Contable',
              sub: 'Resumen mensual',
              action: () => {
                shareCSV(exportLibroContableCSV(libro, year), `Libro_${year}.csv`);
                toast.success('Libro exportado');
              },
            },
            {
              label: 'Carreras',
              sub: `${carreras.length} registros`,
              action: () => {
                shareCSV(exportCarrerasCSV(carreras, year), `Carreras_${year}.csv`);
                toast.success('Carreras exportadas');
              },
            },
            {
              label: 'Gastos',
              sub: `${gastos.length} registros`,
              action: () => {
                shareCSV(exportGastosCSV(gastos, year), `Gastos_${year}.csv`);
                toast.success('Gastos exportados');
              },
            },
            {
              label: 'Trimestres',
              sub: 'Resumen fiscal',
              action: () => {
                shareCSV(exportResumenTrimestralCSV(quarters, resumen, year), `Trimestres_${year}.csv`);
                toast.success('Trimestres exportados');
              },
            },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="p-3 rounded-xl border border-border/40 text-left hover:border-emerald-500/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{item.label}</span>
                <Download className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Notification Toggle */}
      <div className="rounded-2xl border border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold">Alertas de Vencimientos</span>
          </div>
          <button
            onClick={handleToggleNotifications}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              notifEnabled
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {notifEnabled ? (
              <>
                <Bell className="h-3 w-3" />
                Activas
              </>
            ) : (
              <>
                <BellOff className="h-3 w-3" />
                Activar
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {notifEnabled
            ? `Recibirás alertas 15 y 3 días antes de cada vencimiento fiscal.${notifCount > 0 ? ` (${notifCount} programadas)` : ''}`
            : 'Activa las notificaciones para no olvidar ningún vencimiento.'}
        </p>
      </div>

      {/* External links */}
      <div className="rounded-xl border border-border/50 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Enlaces útiles</p>
        {[
          { label: 'Sede Electrónica AEAT', url: 'https://sede.agenciatributaria.gob.es' },
          { label: 'Registro Cl@ve', url: 'https://clave.gob.es/clave_Home/registro.html' },
          { label: 'Cita previa AEAT', url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GC07.shtml' },
          { label: 'Seg. Social (Cambio tramo)', url: 'https://sede.seg-social.gob.es' },
        ].map(link => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline py-1"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// === SKELETON ===

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// === MAIN PAGE ===

export default function Gestoria() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const {
    carreras, gastos, regimen, setRegimen,
    resumen, quarters, gastosDeduciblesLista, libroContable,
    vencimientos, loading, error, refresh, currentYear, beneficioModulos,
    tramoInfo,
  } = useGestoria(selectedYear);

  // Auto-schedule notifications when vencimientos load
  useEffect(() => {
    if (!loading && vencimientos.length > 0) {
      scheduleVencimientoAlerts(vencimientos).catch(() => {});
    }
  }, [loading, vencimientos]);

  const nextUrgent = vencimientos.find(v => v.urgencia === 'rojo' || v.urgencia === 'amarillo');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 pt-4 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <Link
            to="/settings"
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Gestoría Digital</h1>
            <p className="text-xs text-muted-foreground">Ejercicio fiscal {selectedYear}</p>
          </div>
          {/* Selector año */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-xl border border-border/40 px-1 py-1">
            <button
              onClick={() => setSelectedYear(y => Math.max(2024, y - 1))}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-bold tabular-nums px-1">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear(y => Math.min(new Date().getFullYear(), y + 1))}
              disabled={selectedYear >= new Date().getFullYear()}
              className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => refresh()}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Urgency banner */}
        {nextUrgent && (
          <div className={cn(
            "mb-3 rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium",
            nextUrgent.urgencia === 'rojo' ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"
          )}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{nextUrgent.titulo} · {nextUrgent.daysLeft > 0 ? `${nextUrgent.daysLeft} días` : '¡HOY!'}</span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 pb-20 space-y-3">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'resumen' && (
              <div className="space-y-4">
                <ResumenSection resumen={resumen} loading={loading} regimen={regimen} setRegimen={setRegimen} beneficioModulos={beneficioModulos} tramoInfo={tramoInfo} />
                <AmortizacionWidget />
              </div>
            )}
            {tab === 'trimestres' && (
              <TrimestresSection quarters={quarters} regimen={regimen} loading={loading} year={selectedYear} />
            )}
            {tab === 'deducibles' && (
              <DeduciblesSection gastos={gastosDeduciblesLista} loading={loading} />
            )}
            {tab === 'vencimientos' && (
              <VencimientosSection vencimientos={vencimientos} loading={loading} regimen={regimen} />
            )}
            {tab === 'libro' && (
              <LibroSection
                libro={libroContable}
                ingresosBrutos={resumen.ingresosBrutos}
                gastosDeducibles={resumen.gastosTotales}
                loading={loading}
                year={selectedYear}
                carreras={carreras}
                gastos={gastos}
              />
            )}
            {tab === 'herramientas' && (
              <HerramientasSection
                quarters={quarters}
                resumen={resumen}
                libro={libroContable}
                regimen={regimen}
                year={selectedYear}
                vencimientos={vencimientos}
                carreras={carreras}
                gastos={gastos}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
