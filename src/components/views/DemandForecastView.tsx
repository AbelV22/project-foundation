import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plane,
  Train,
  Ship,
  CloudRain,
  Sun,
  Users,
  Clock,
  RefreshCw,
  ChevronRight,
  Zap,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useDemandForecast, ZoneForecast, HourlySlot } from "@/hooks/useDemandForecast";

interface DemandForecastViewProps {
  onBack?: () => void;
}

// --- DEMAND LEVEL STYLES ---

const demandStyles = {
  'muy-alto': {
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300',
    bar: 'bg-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    label: 'Muy Alta',
  },
  'alto': {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
    bar: 'bg-amber-500',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    label: 'Alta',
  },
  'medio': {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300',
    bar: 'bg-blue-500',
    glow: '',
    label: 'Media',
  },
  'bajo': {
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    badge: 'bg-slate-500/20 text-slate-300',
    bar: 'bg-slate-500',
    glow: '',
    label: 'Baja',
  },
  'muy-bajo': {
    bg: 'bg-slate-600/15',
    border: 'border-slate-600/30',
    text: 'text-slate-500',
    badge: 'bg-slate-600/20 text-slate-400',
    bar: 'bg-slate-600',
    glow: '',
    label: 'Muy Baja',
  },
};

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'subiendo') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (trend === 'bajando') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
};

// --- ZONE CARD ---

function ZoneCard({ zone, rank }: { zone: ZoneForecast; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const style = demandStyles[zone.demandLevel];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06 }}
      className={cn(
        "rounded-2xl border p-4 transition-all",
        style.border,
        style.glow,
        rank === 0 && zone.demandScore >= 60 ? 'ring-1 ring-primary/20' : '',
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {rank === 0 && zone.demandScore >= 60 && (
              <span className="text-primary text-xs font-bold">TOP</span>
            )}
            <h3 className="font-semibold text-sm truncate">{zone.zoneName}</h3>
            <TrendIcon trend={zone.trend} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {zone.recommendation}
          </p>
        </div>

        {/* Score Circle */}
        <div className="flex-shrink-0 relative">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center border-2",
            style.border,
            style.bg,
          )}>
            <span className={cn("text-lg font-bold", style.text)}>
              {zone.demandScore}
            </span>
          </div>
        </div>
      </div>

      {/* Demand Bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", style.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${zone.demandScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <span className={cn("text-[10px] font-medium", style.text)}>
          {style.label}
        </span>
      </div>

      {/* Quick Stats Row */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {zone.flightCount > 0 && (
          <span className="flex items-center gap-1">
            <Plane className="h-3 w-3" />
            {zone.flightCount}
          </span>
        )}
        {zone.trainCount > 0 && (
          <span className="flex items-center gap-1">
            <Train className="h-3 w-3" />
            {zone.trainCount}
          </span>
        )}
        {zone.totalPax > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            ~{zone.taxiPax} taxi
          </span>
        )}
        {zone.taxistasActivos > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-primary">🚕</span>
            {zone.taxistasActivos}
          </span>
        )}
        {zone.hasRealWaitData && zone.waitingTime !== null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {zone.waitingTime}m
          </span>
        )}
      </div>

      {/* Expanded: Factors Breakdown */}
      <AnimatePresence>
        {expanded && zone.factors.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Factores
              </span>
              {zone.factors.map((factor, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{factor.icon}</span>
                    <span className="text-muted-foreground">{factor.label}</span>
                  </span>
                  <span className={cn(
                    "font-medium",
                    factor.impact > 0 ? 'text-emerald-400' : factor.impact < 0 ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {factor.impact > 0 ? '+' : ''}{factor.impact}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- HOURLY TIMELINE ---

function HourlyTimeline({
  slots,
  selectedSlot,
  onSelectSlot,
}: {
  slots: HourlySlot[];
  selectedSlot: number;
  onSelectSlot: (idx: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      {slots.map((slot, idx) => {
        const isSelected = idx === selectedSlot;
        const peakZone = slot.zones[0];
        const peakStyle = peakZone ? demandStyles[peakZone.demandLevel] : demandStyles['muy-bajo'];

        return (
          <button
            key={slot.hour}
            onClick={() => onSelectSlot(idx)}
            className={cn(
              "flex-shrink-0 px-4 py-2.5 rounded-xl border transition-all text-center min-w-[80px]",
              isSelected
                ? cn("border-primary/40 bg-primary/10", peakStyle.glow)
                : "border-border/50 bg-card/50 hover:bg-card"
            )}
          >
            <div className={cn(
              "text-sm font-bold",
              isSelected ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {idx === 0 ? 'Ahora' : slot.hour}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <div className={cn("w-2 h-2 rounded-full", peakStyle.bar)} />
              <span className={cn("text-[10px] font-medium", peakStyle.text)}>
                {peakZone?.demandScore || 0}
              </span>
            </div>
            {slot.totalPaxAllZones > 0 && (
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {slot.totalPaxAllZones} pax
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// --- GLOBAL SIGNALS BAR ---

function GlobalSignals({
  weatherMultiplier,
  isRainBoost,
  activeEventsCount,
  cruisesCount,
}: {
  weatherMultiplier: number;
  isRainBoost: boolean;
  activeEventsCount: number;
  cruisesCount: number;
}) {
  const signals = [];

  if (isRainBoost) {
    signals.push({
      icon: <CloudRain className="h-3.5 w-3.5 text-blue-400" />,
      label: `Lluvia +${Math.round((weatherMultiplier - 1) * 100)}%`,
      color: 'text-blue-400',
    });
  } else {
    signals.push({
      icon: <Sun className="h-3.5 w-3.5 text-amber-400" />,
      label: 'Buen tiempo',
      color: 'text-amber-400',
    });
  }

  if (activeEventsCount > 0) {
    signals.push({
      icon: <Zap className="h-3.5 w-3.5 text-purple-400" />,
      label: `${activeEventsCount} evento${activeEventsCount > 1 ? 's' : ''} hoy`,
      color: 'text-purple-400',
    });
  }

  if (cruisesCount > 0) {
    signals.push({
      icon: <Ship className="h-3.5 w-3.5 text-cyan-400" />,
      label: `${cruisesCount} crucero${cruisesCount > 1 ? 's' : ''}`,
      color: 'text-cyan-400',
    });
  }

  if (signals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal, idx) => (
        <div
          key={idx}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/80 border border-border/50 text-xs"
        >
          {signal.icon}
          <span className={cn("font-medium", signal.color)}>{signal.label}</span>
        </div>
      ))}
    </div>
  );
}

// --- DATA QUALITY INDICATOR ---

function DataQuality({ quality }: { quality: Record<string, boolean> }) {
  const total = Object.values(quality).filter(Boolean).length;
  const max = Object.keys(quality).length;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Eye className="h-3 w-3" />
      <span>{total}/{max} fuentes</span>
      <div className="flex gap-0.5">
        {Object.entries(quality).map(([key, ok]) => (
          <div
            key={key}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              ok ? 'bg-emerald-400' : 'bg-slate-600'
            )}
            title={key}
          />
        ))}
      </div>
    </div>
  );
}

// --- MAIN VIEW ---

export function DemandForecastView({ onBack }: DemandForecastViewProps) {
  const [selectedSlot, setSelectedSlot] = useState(0);
  const {
    hourlyForecast,
    bestZone,
    weatherMultiplier,
    isRainBoost,
    activeEvents,
    upcomingCruises,
    loading,
    lastUpdate,
    dataQuality,
    refresh,
  } = useDemandForecast();

  const currentSlot = hourlyForecast[selectedSlot] || null;

  if (loading && hourlyForecast.length === 0) {
    return (
      <div className="flex flex-col h-full bg-background px-4 pt-4 space-y-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 w-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-[28px] font-bold tracking-tight leading-none">
                Predicción
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Demanda por zona · Próximas 3h
              </p>
            </div>
          </div>
          <button
            onClick={() => refresh()}
            className="p-2 rounded-xl bg-card/80 border border-border/50 hover:bg-card transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Last update + data quality */}
        <div className="flex items-center justify-between mt-2">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              Actualizado {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <DataQuality quality={dataQuality} />
        </div>
      </div>

      {/* Global Signals */}
      <div className="px-4 pb-3">
        <GlobalSignals
          weatherMultiplier={weatherMultiplier}
          isRainBoost={isRainBoost}
          activeEventsCount={activeEvents.length}
          cruisesCount={upcomingCruises.length}
        />
      </div>

      {/* Hourly Timeline */}
      <div className="px-4 pb-3">
        <HourlyTimeline
          slots={hourlyForecast}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
        />
      </div>

      {/* Best Zone Highlight (only for current hour) */}
      {selectedSlot === 0 && bestZone && bestZone.demandScore >= 50 && (
        <div className="mx-4 mb-3 p-3 rounded-2xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Mejor opción ahora</span>
          </div>
          <p className="text-sm mt-1">
            <span className="font-medium">{bestZone.zoneName}</span>
            <span className="text-muted-foreground"> — </span>
            <span className="text-muted-foreground">{bestZone.recommendation}</span>
          </p>
          {bestZone.taxiPax > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              ~{bestZone.taxiPax} pasajeros buscarán taxi · {bestZone.flightCount + bestZone.trainCount} llegadas
            </p>
          )}
        </div>
      )}

      {/* Zone Cards */}
      <div className="flex-1 px-4 pb-6 space-y-3">
        {currentSlot?.zones.map((zone, idx) => (
          <ZoneCard key={zone.zone} zone={zone} rank={idx} />
        ))}

        {(!currentSlot || currentSlot.zones.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Sin datos de predicción disponibles</p>
          </div>
        )}
      </div>
    </div>
  );
}
