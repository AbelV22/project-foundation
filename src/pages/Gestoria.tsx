import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Euro, TrendingUp, TrendingDown,
  FileText, AlertTriangle, CheckCircle2, Clock, Calendar,
  Car, BookOpen, ChevronRight, Info, Download, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGestoria, calcularAmortizacion, calcularCuotaAutonomo,
  QuarterData, Vencimiento, LibroContable,
} from "@/hooks/useGestoria";
import { getItem, setItem } from "@/lib/storage";
import { useEffect } from "react";

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

type Tab = 'resumen' | 'modelo130' | 'deducibles' | 'vencimientos' | 'libro';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'resumen', label: 'Resumen', icon: '📊' },
  { id: 'modelo130', label: 'Modelo 130', icon: '📋' },
  { id: 'deducibles', label: 'Deducibles', icon: '📁' },
  { id: 'vencimientos', label: 'Vencimientos', icon: '🗓️' },
  { id: 'libro', label: 'Libro', icon: '📚' },
];

// === SECTION: RESUMEN ===

function ResumenSection({ resumen, loading }: { resumen: ReturnType<typeof useGestoria>['resumen']; loading: boolean }) {
  if (loading) return <SectionSkeleton rows={4} />;

  const items = [
    {
      label: 'Ingresos brutos',
      value: fmt(resumen.ingresosBrutos),
      color: 'text-emerald-400',
      icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
    },
    {
      label: 'Gastos deducibles',
      value: `-${fmt(resumen.gastosDeducibles)}`,
      color: 'text-red-400',
      icon: <TrendingDown className="h-4 w-4 text-red-400" />,
    },
    {
      label: 'Beneficio neto',
      value: fmt(resumen.beneficioNeto),
      color: resumen.beneficioNeto >= 0 ? 'text-primary' : 'text-red-400',
      icon: <Euro className="h-4 w-4 text-primary" />,
      separator: true,
    },
    {
      label: 'IRPF estimado (20%)',
      value: fmt(resumen.irpfEstimadoAnual),
      color: 'text-amber-400',
      icon: <FileText className="h-4 w-4 text-amber-400" />,
    },
    {
      label: 'Ya pagado (Mod. 130)',
      value: `-${fmt(resumen.irpfPagadoTrimestralmente)}`,
      color: 'text-slate-400',
      icon: <CheckCircle2 className="h-4 w-4 text-slate-400" />,
    },
    {
      label: 'IRPF pendiente estimado',
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
      sub: `~${fmt(resumen.cuotaAutonoAnual)}/año`,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Big number */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Beneficio neto {resumen.ano}
        </p>
        <p className={cn("text-4xl font-black font-mono tabular-nums",
          resumen.beneficioNeto >= 0 ? "text-primary" : "text-red-400"
        )}>
          {fmt(resumen.beneficioNeto)}
        </p>
        {resumen.ingresosBrutos === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Registra tus carreras para ver datos fiscales reales
          </p>
        )}
      </div>

      {/* Detail rows */}
      <div className="rounded-2xl border border-border/50 divide-y divide-border/40 overflow-hidden">
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

      {/* Tax disclaimer */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Los taxis están <strong className="text-foreground">exentos de IVA</strong> (art. 20.1.17 Ley IVA).
          Estimación Directa Simplificada. Datos orientativos — consulta tu gestor/a.
        </p>
      </div>
    </div>
  );
}

// === SECTION: MODELO 130 ===

function Modelo130Section({ quarters, loading }: { quarters: QuarterData[]; loading: boolean }) {
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  if (loading) return <SectionSkeleton rows={4} />;

  const nextQ = quarters.find(q => q.status !== 'pasado');

  return (
    <div className="space-y-3">
      {/* Info box */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Modelo 130</strong> — Pago fraccionado trimestral del IRPF.
          Fórmula: 20% × (ingresos acumulados − gastos deducibles acumulados) − pagos anteriores.
          Mínimo a pagar: 0€.
        </p>
      </div>

      {/* Next deadline highlight */}
      {nextQ && (nextQ.status === 'urgente' || nextQ.status === 'proximo') && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">Próximo vencimiento</p>
            <p className="text-xs text-muted-foreground">
              {nextQ.label} — {nextQ.deadline} · {nextQ.daysLeft > 0 ? `en ${nextQ.daysLeft} días` : 'HOY'}
            </p>
          </div>
          <p className="font-black text-lg font-mono text-amber-400">{fmt(nextQ.aPagar)}</p>
        </div>
      )}

      {/* Quarter cards */}
      {quarters.map(q => {
        const style = quarterStyles[q.status];
        const isOpen = expandedQ === q.q;
        return (
          <div
            key={q.q}
            className={cn("rounded-2xl border overflow-hidden", style.border)}
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
                  q.aPagar > 0 ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {fmt(q.aPagar)}
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
                  <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-2">
                    {[
                      { label: 'Ingresos del trimestre', val: fmtDec(q.ingresos), positive: true },
                      { label: 'Gastos deducibles trim.', val: `-${fmtDec(q.gastos)}` },
                      { label: 'Base imponible acum.', val: fmtDec(q.baseImponible), separator: true },
                      { label: 'Cuota bruta (20%)', val: fmtDec(q.cuotaBruta) },
                      { label: '− Pagos anteriores (Mod.130)', val: `-${fmtDec(q.pagosAnteriores)}`, separator: true },
                      { label: 'RESULTADO A INGRESAR', val: fmtDec(q.aPagar), big: true },
                    ].map((row, i) => (
                      <div key={i}>
                        {row.separator && <div className="h-px bg-border/50 my-1" />}
                        <div className="flex justify-between text-xs">
                          <span className={cn("text-muted-foreground", row.big && "font-semibold text-foreground")}>
                            {row.label}
                          </span>
                          <span className={cn("font-mono",
                            row.big ? 'font-black text-sm text-amber-400' : 'text-foreground'
                          )}>
                            {row.val}
                          </span>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground pt-2">
                      Presenta en Sede Electrónica AEAT con certificado digital o Cl@ve
                    </p>
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

function VencimientosSection({ vencimientos, loading }: {
  vencimientos: Vencimiento[];
  loading: boolean;
}) {
  if (loading) return <SectionSkeleton rows={5} />;

  const upcoming = vencimientos.filter(v => v.urgencia !== 'pasado').slice(0, 10);
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
          <div key={v.id} className={cn("rounded-xl border p-4 flex items-start gap-3", style.bg, "border-border/50")}>
            <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", style.dot)} />
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
          Presenta el Modelo 130 en <strong className="text-foreground">Sede Electrónica AEAT</strong> (aeat.es)
          con Cl@ve PIN o certificado digital. La cuota de autónomo se domicilia automáticamente.
        </p>
      </div>
    </div>
  );
}

// === SECTION: LIBRO CONTABLE ===

function LibroSection({ libro, ingresosBrutos, gastosDeducibles, loading }: {
  libro: LibroContable[];
  ingresosBrutos: number;
  gastosDeducibles: number;
  loading: boolean;
}) {
  if (loading) return <SectionSkeleton rows={12} />;

  const mesesConDatos = libro.filter(m => m.ingresos > 0 || m.gastos > 0);
  const maxIngr = Math.max(...libro.map(m => m.ingresos), 1);

  return (
    <div className="space-y-3">
      {/* Export hint */}
      <div className="rounded-xl border border-border/50 p-3 flex items-center gap-2 bg-card/50">
        <Download className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground flex-1">
          Para exportar a PDF, usa el menú compartir del navegador → "Imprimir" → "Guardar como PDF"
        </p>
      </div>

      {/* Year summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Total ingresos</p>
          <p className="font-black font-mono text-emerald-400">{fmt(ingresosBrutos)}</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Total deducibles</p>
          <p className="font-black font-mono text-red-400">{fmt(gastosDeducibles)}</p>
        </div>
      </div>

      {/* Monthly table */}
      {mesesConDatos.length > 0 ? (
        <div className="rounded-2xl border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_72px] gap-0 px-4 py-2 bg-muted/30 border-b border-border/30">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Mes</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase text-right">Ingresos</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase text-right">Gastos</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase text-right">Neto</span>
          </div>
          <div className="divide-y divide-border/30">
            {libro.map((mes, idx) => {
              const hasDatos = mes.ingresos > 0 || mes.gastos > 0;
              const barWidth = maxIngr > 0 ? (mes.ingresos / maxIngr) * 100 : 0;
              return (
                <div key={idx} className={cn("px-4 py-2.5", !hasDatos && "opacity-30")}>
                  <div className="grid grid-cols-[1fr_80px_80px_72px] gap-0 items-center">
                    <div>
                      <span className="text-xs font-medium">{mes.mes.split(' ')[0]}</span>
                      {hasDatos && (
                        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden w-full max-w-[80px]">
                          <div
                            className="h-full bg-emerald-400/60 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <span className={cn("font-mono text-xs text-right", hasDatos ? "text-emerald-400" : "text-muted-foreground")}>
                      {hasDatos ? fmt(mes.ingresos) : '—'}
                    </span>
                    <span className={cn("font-mono text-xs text-right", hasDatos ? "text-red-400" : "text-muted-foreground")}>
                      {hasDatos ? fmt(mes.gastos) : '—'}
                    </span>
                    <span className={cn("font-mono text-xs font-bold text-right",
                      mes.beneficio >= 0 ? "text-primary" : "text-red-400",
                      !hasDatos && "text-muted-foreground"
                    )}>
                      {hasDatos ? fmt(mes.beneficio) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Total row */}
          <div className="grid grid-cols-[1fr_80px_80px_72px] gap-0 px-4 py-3 bg-muted/30 border-t border-border/50">
            <span className="text-xs font-bold uppercase text-foreground">TOTAL</span>
            <span className="font-mono text-xs font-bold text-right text-emerald-400">{fmt(ingresosBrutos)}</span>
            <span className="font-mono text-xs font-bold text-right text-red-400">{fmt(gastosDeducibles)}</span>
            <span className={cn("font-mono text-xs font-black text-right",
              (ingresosBrutos - gastosDeducibles) >= 0 ? "text-primary" : "text-red-400"
            )}>
              {fmt(ingresosBrutos - gastosDeducibles)}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin datos registrados</p>
          <p className="text-xs mt-1">Registra carreras y gastos para ver el libro contable</p>
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
  const {
    resumen, quarters, gastosDeduciblesLista, libroContable,
    vencimientos, loading, error, refresh, currentYear,
  } = useGestoria();

  const nextUrgent = vencimientos.find(v => v.urgencia === 'rojo' || v.urgencia === 'amarillo');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 pt-4 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/settings"
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Gestoría Digital</h1>
            <p className="text-xs text-muted-foreground">Año fiscal {currentYear}</p>
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
            <span>{nextUrgent.titulo} · {nextUrgent.daysLeft > 0 ? `${nextUrgent.daysLeft} días` : '¡HOY!'}</span>
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
                <ResumenSection resumen={resumen} loading={loading} />
                <AmortizacionWidget />
              </div>
            )}
            {tab === 'modelo130' && (
              <Modelo130Section quarters={quarters} loading={loading} />
            )}
            {tab === 'deducibles' && (
              <DeduciblesSection gastos={gastosDeduciblesLista} loading={loading} />
            )}
            {tab === 'vencimientos' && (
              <VencimientosSection vencimientos={vencimientos} loading={loading} />
            )}
            {tab === 'libro' && (
              <LibroSection
                libro={libroContable}
                ingresosBrutos={resumen.ingresosBrutos}
                gastosDeducibles={resumen.gastosDeducibles}
                loading={loading}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
