import { Ship, Clock, Anchor, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCruises, Crucero } from "@/hooks/useCruises";

interface CruisesWidgetProps {
  onClick?: () => void;
  compact?: boolean;
}

export function CruisesWidget({ onClick, compact = false }: CruisesWidgetProps) {
  const { resumen, llegadas, getNextArrival, getTimeUntilNextArrival, loading } = useCruises();

  const nextArrival = getNextArrival();
  const minutesUntilNext = getTimeUntilNextArrival();

  // Format passenger count
  const formatPax = (pax: number): string => {
    if (pax >= 1000) {
      return `${(pax / 1000).toFixed(1)}k`;
    }
    return pax.toString();
  };

  // Determine urgency level based on next arrival
  const getUrgencyLevel = (minutes: number | null): "low" | "medium" | "high" => {
    if (minutes === null) return "low";
    if (minutes <= 30) return "high";
    if (minutes <= 60) return "medium";
    return "low";
  };

  const urgencyLevel = getUrgencyLevel(minutesUntilNext);

  if (loading) {
    return (
      <div className="card-dashboard p-3 animate-pulse">
        <div className="h-20 bg-muted/30 rounded-lg" />
      </div>
    );
  }

  // No cruises today
  if (resumen.total_cruceros === 0) {
    return (
      <button
        onClick={onClick}
        className="card-glass-hover p-3 text-left w-full group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
              <Ship className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground text-xs">Puerto BCN</h3>
              <p className="text-[10px] text-muted-foreground">Sin cruceros hoy</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </button>
    );
  }

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="card-glass-hover flex flex-col p-2.5 text-left group transition-all duration-200 w-full"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Ship className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] font-medium text-muted-foreground">Cruceros</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-primary transition-colors" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono font-black text-xl text-cyan-400 tabular-nums">
            {resumen.total_cruceros}
          </span>
          <span className="text-[10px] text-muted-foreground">barcos</span>
        </div>
        {nextArrival && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {nextArrival.hora} · {nextArrival.nombre.split(' ')[0]}
          </p>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="card-glass-hover p-3 space-y-2 text-left w-full group"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
            <Ship className="h-3.5 w-3.5 text-cyan-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-xs">Puerto BCN</h3>
            <p className="text-[10px] text-muted-foreground">Cruceros hoy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Anchor className="h-3 w-3 text-cyan-400" />
              <span className="font-display font-bold text-xl text-cyan-400">{resumen.total_cruceros}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Pax: </span>
          <span className="font-display font-bold text-amber-400">
            {formatPax(resumen.pax_estimados_hoy)}
          </span>
        </div>
        {nextArrival && (
          <div>
            <span className="text-muted-foreground">Próximo: </span>
            <span className="font-display font-bold text-purple-400">{nextArrival.hora}</span>
          </div>
        )}
      </div>

      {/* Next Arrival Card */}
      {nextArrival && minutesUntilNext !== null && (
        <div className={cn(
          "flex items-center justify-between p-2 rounded-lg text-xs",
          urgencyLevel === "low" && "bg-emerald-500/10 border border-emerald-500/20",
          urgencyLevel === "medium" && "bg-amber-500/10 border border-amber-500/20",
          urgencyLevel === "high" && "bg-cyan-500/10 border border-cyan-500/20"
        )}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Clock className={cn(
              "h-3 w-3 shrink-0",
              urgencyLevel === "low" && "text-emerald-400",
              urgencyLevel === "medium" && "text-amber-400",
              urgencyLevel === "high" && "text-cyan-400"
            )} />
            <span className="text-muted-foreground truncate">{nextArrival.nombre}</span>
          </div>
          <span className={cn(
            "font-display font-bold shrink-0 ml-2",
            urgencyLevel === "low" && "text-emerald-400",
            urgencyLevel === "medium" && "text-amber-400",
            urgencyLevel === "high" && "text-cyan-400"
          )}>
            {minutesUntilNext <= 0 ? "Llegando" : `en ${minutesUntilNext} min`}
          </span>
        </div>
      )}
    </button>
  );
}
