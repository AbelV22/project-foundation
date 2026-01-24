import { useMemo } from "react";
import { ArrowLeft, Ship, RefreshCw, Clock, Anchor, Users, MapPin, ArrowDown, ArrowUp, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCruises, Crucero } from "@/hooks/useCruises";

interface CruisesViewProps {
  onBack?: () => void;
}

// Terminal info
const TERMINAL_INFO: Record<string, { name: string; color: string; bgColor: string }> = {
  "A": { name: "Terminal A (WTC)", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  "B": { name: "Terminal B", color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
  "C": { name: "Terminal C", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  "D": { name: "Terminal D", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  "E": { name: "Terminal E", color: "text-teal-400", bgColor: "bg-teal-500/10" },
  "F": { name: "Terminal F", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  "N": { name: "Terminal Nord", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  "S": { name: "Terminal Sud", color: "text-orange-400", bgColor: "bg-orange-500/10" },
};

const getTerminalStyle = (code: string) => {
  return TERMINAL_INFO[code] || { name: code, color: "text-muted-foreground", bgColor: "bg-muted/30" };
};

// Format passenger count
const formatPax = (pax: number): string => {
  if (pax >= 1000) {
    return `${(pax / 1000).toFixed(1)}k`;
  }
  return pax.toString();
};

// Generate hour slots for the day
const generateHourSlots = (startHour: number): { label: string; hour: number }[] => {
  const slots: { label: string; hour: number }[] = [];
  for (let i = 0; i < 23; i++) {
    const hour = (startHour + i) % 24;
    slots.push({ label: `${hour.toString().padStart(2, '0')}h`, hour });
  }
  return slots;
};

export function CruisesView({ onBack }: CruisesViewProps) {
  const { llegadas, salidas, resumen, metadata, loading, refetch } = useCruises();

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = currentHour * 60 + now.getMinutes();
  const startHour = (currentHour - 1 + 24) % 24;

  const hourSlots = useMemo(() => generateHourSlots(startHour), [startHour]);

  // Count arrivals by hour
  const countByHour = useMemo(() => {
    const counts: Record<number, { llegadas: number; salidas: number }> = {};
    llegadas.forEach(c => {
      const hour = parseInt(c.hora?.split(":")[0] || "0", 10);
      if (!counts[hour]) counts[hour] = { llegadas: 0, salidas: 0 };
      counts[hour].llegadas++;
    });
    salidas.forEach(c => {
      const hour = parseInt(c.hora?.split(":")[0] || "0", 10);
      if (!counts[hour]) counts[hour] = { llegadas: 0, salidas: 0 };
      counts[hour].salidas++;
    });
    return counts;
  }, [llegadas, salidas]);

  // Group by terminal
  const byTerminal = useMemo(() => {
    const grouped: Record<string, { llegadas: Crucero[]; salidas: Crucero[] }> = {};
    llegadas.forEach(c => {
      const term = c.terminal_codigo || "N/A";
      if (!grouped[term]) grouped[term] = { llegadas: [], salidas: [] };
      grouped[term].llegadas.push(c);
    });
    salidas.forEach(c => {
      const term = c.terminal_codigo || "N/A";
      if (!grouped[term]) grouped[term] = { llegadas: [], salidas: [] };
      grouped[term].salidas.push(c);
    });
    return grouped;
  }, [llegadas, salidas]);

  // Group by naviera (shipping company)
  const byNaviera = useMemo(() => {
    const counts: Record<string, number> = {};
    [...llegadas, ...salidas].forEach(c => {
      const naviera = c.naviera || "Desconocida";
      counts[naviera] = (counts[naviera] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [llegadas, salidas]);

  // Combine and sort all movements
  const allMovements = useMemo(() => {
    return [...llegadas, ...salidas]
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      })
      .filter(c => {
        const [h, m] = (c.hora || "00:00").split(":").map(Number);
        const cruiseMinutes = h * 60 + m;
        return cruiseMinutes >= currentMinutes - 60; // Show from 1 hour ago
      });
  }, [llegadas, salidas, currentMinutes]);

  // Date formatting
  const fechaFormateada = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const diaSemana = now.toLocaleDateString('es-ES', {
    weekday: 'long'
  }).toUpperCase();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-cyan-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando cruceros...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border shadow-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-foreground">Puerto Barcelona</h1>
          <p className="text-[11px] text-muted-foreground">Cruceros y ferries</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
        >
          <RefreshCw className="h-3 w-3 text-cyan-500" />
          <span className="text-[10px] text-cyan-500 font-medium">Actualizar</span>
        </button>
      </div>

      {/* Date and Summary */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm">{fechaFormateada}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm capitalize">{diaSemana}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-card rounded-xl p-2.5 border border-border shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Anchor className="h-3 w-3 text-cyan-400" />
          </div>
          <span className="font-display font-bold text-lg text-cyan-400">{resumen.total_cruceros}</span>
          <p className="text-[9px] text-muted-foreground">Barcos</p>
        </div>
        <div className="bg-card rounded-xl p-2.5 border border-border shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowDown className="h-3 w-3 text-emerald-400" />
          </div>
          <span className="font-display font-bold text-lg text-emerald-400">{resumen.total_llegadas}</span>
          <p className="text-[9px] text-muted-foreground">Llegadas</p>
        </div>
        <div className="bg-card rounded-xl p-2.5 border border-border shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowUp className="h-3 w-3 text-amber-400" />
          </div>
          <span className="font-display font-bold text-lg text-amber-400">{resumen.total_salidas}</span>
          <p className="text-[9px] text-muted-foreground">Salidas</p>
        </div>
        <div className="bg-card rounded-xl p-2.5 border border-border shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="h-3 w-3 text-purple-400" />
          </div>
          <span className="font-display font-bold text-lg text-purple-400">{formatPax(resumen.pax_estimados_hoy)}</span>
          <p className="text-[9px] text-muted-foreground">Pasajeros</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* By Hour */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/10">
          <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-500" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por hora</span>
          </div>

          <div className="max-h-[45vh] overflow-y-auto scrollbar-dark">
            {hourSlots.map((slot) => {
              const hour = slot.hour;
              const data = countByHour[hour] || { llegadas: 0, salidas: 0 };
              const total = data.llegadas + data.salidas;
              const isCurrentHour = hour === currentHour;

              return (
                <div
                  key={slot.label}
                  className={cn(
                    "grid grid-cols-3 border-b border-border/40",
                    isCurrentHour && "bg-cyan-500/15"
                  )}
                >
                  <div className={cn(
                    "py-1.5 px-2 text-center border-r border-border/40",
                    isCurrentHour && "bg-cyan-500/10"
                  )}>
                    <span className={cn(
                      "text-[10px] font-mono font-medium",
                      isCurrentHour ? "font-bold text-cyan-500" : "text-muted-foreground"
                    )}>
                      {slot.label}
                    </span>
                  </div>
                  <div className="py-1.5 px-2 text-center border-r border-border/40">
                    <span className={cn(
                      "text-[10px] font-display font-bold",
                      data.llegadas > 0 ? "text-emerald-400" : "text-muted-foreground/40"
                    )}>
                      {data.llegadas > 0 ? `↓${data.llegadas}` : "-"}
                    </span>
                  </div>
                  <div className="py-1.5 px-2 text-center">
                    <span className={cn(
                      "text-[10px] font-display font-bold",
                      data.salidas > 0 ? "text-amber-400" : "text-muted-foreground/40"
                    )}>
                      {data.salidas > 0 ? `↑${data.salidas}` : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-muted py-2.5 px-3 border-t border-border text-center">
            <span className="font-display font-bold text-base text-cyan-500">{llegadas.length + salidas.length}</span>
            <span className="text-[10px] text-muted-foreground ml-1">movimientos</span>
          </div>
        </div>

        {/* By Terminal and Naviera */}
        <div className="space-y-2">
          {/* By Terminal */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
            <div className="bg-muted py-2 px-3 border-b border-border flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por terminal</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-[20vh] overflow-y-auto scrollbar-dark">
              {Object.entries(byTerminal).map(([code, data]) => {
                const style = getTerminalStyle(code);
                return (
                  <div
                    key={code}
                    className={cn("flex items-center justify-between px-2 py-1.5 rounded-lg", style.bgColor)}
                  >
                    <span className={cn("font-display font-bold text-xs", style.color)}>
                      {code}
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      {data.llegadas.length > 0 && (
                        <span className="text-emerald-400">↓{data.llegadas.length}</span>
                      )}
                      {data.salidas.length > 0 && (
                        <span className="text-amber-400">↑{data.salidas.length}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Naviera */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
            <div className="bg-muted py-2 px-3 border-b border-border flex items-center gap-1.5">
              <Flag className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por naviera</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-[20vh] overflow-y-auto scrollbar-dark">
              {byNaviera.slice(0, 5).map(([naviera, count], idx) => (
                <div
                  key={naviera}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      idx === 0 ? "bg-cyan-500/20 text-cyan-400" : "bg-muted text-muted-foreground"
                    )}>
                      {idx + 1}
                    </span>
                    <span className="font-medium text-xs text-foreground truncate max-w-[80px]">{naviera}</span>
                  </div>
                  <span className="font-display font-bold text-sm text-cyan-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
        <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-cyan-500" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Movimientos del día</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{allMovements.length} barcos</span>
        </div>

        <div className="max-h-[40vh] overflow-y-auto scrollbar-dark">
          {allMovements.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay cruceros programados para hoy
            </div>
          ) : (
            allMovements.map((crucero, idx) => {
              const [h, m] = crucero.hora.split(":").map(Number);
              const cruiseMinutes = h * 60 + m;
              const isPast = cruiseMinutes < currentMinutes - 5;
              const isInminente = cruiseMinutes >= currentMinutes && cruiseMinutes <= currentMinutes + 30;
              const isArrival = crucero.tipo === "llegada";
              const terminalStyle = getTerminalStyle(crucero.terminal_codigo);

              return (
                <div
                  key={`${crucero.nombre}-${crucero.hora}-${idx}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 border-b border-border/40",
                    isPast && "opacity-40",
                    isInminente && (isArrival ? "bg-emerald-500/10" : "bg-amber-500/10")
                  )}
                >
                  {/* Time */}
                  <span className={cn(
                    "font-display font-bold text-sm w-12",
                    isInminente
                      ? (isArrival ? "text-emerald-400" : "text-amber-400")
                      : "text-cyan-400"
                  )}>
                    {crucero.hora}
                  </span>

                  {/* Direction */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    isArrival ? "bg-emerald-500/20" : "bg-amber-500/20"
                  )}>
                    {isArrival ? (
                      <ArrowDown className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ArrowUp className="h-3 w-3 text-amber-400" />
                    )}
                  </div>

                  {/* Ship name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-foreground truncate">{crucero.nombre}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {isArrival ? `desde ${crucero.puerto}` : `hacia ${crucero.puerto}`}
                    </p>
                  </div>

                  {/* Terminal */}
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded",
                    terminalStyle.color,
                    terminalStyle.bgColor
                  )}>
                    {crucero.terminal_codigo || "N/A"}
                  </span>

                  {/* Passengers */}
                  <div className="text-right">
                    <span className="text-[10px] text-purple-400 font-medium">
                      ~{formatPax(crucero.pax_estimados)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 p-3 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <ArrowDown className="h-3 w-3 text-emerald-400" />
            <span>Llegada</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3 text-amber-400" />
            <span>Salida</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-1.5">
          Datos de {metadata.fuente}. Actualización {metadata.frecuencia}.
        </p>
      </div>
    </div>
  );
}
