import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Train, RefreshCw, Flame, Clock, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrenSants {
  hora: string;
  origen: string;
  tren: string;
  via: string;
}

interface TrainsFullDayViewProps {
  onBack?: () => void;
  onCityClick?: (city: string) => void;
}

// Extraer primera palabra del origen (ciudad)
const getCiudad = (origen: string): string => {
  if (!origen) return "";
  const lower = origen.toLowerCase();
  if (lower.includes("madrid")) return "Madrid";
  if (lower.includes("sevilla")) return "Sevilla";
  if (lower.includes("málaga")) return "Málaga";
  if (lower.includes("valència") || lower.includes("valencia")) return "València";
  if (lower.includes("alacant") || lower.includes("alicante")) return "Alicante";
  if (lower.includes("figueres")) return "Figueres";
  if (lower.includes("paris")) return "París";
  if (lower.includes("marseille")) return "Marsella";
  if (lower.includes("donostia") || lower.includes("san sebastián")) return "Donostia";
  if (lower.includes("zaragoza")) return "Zaragoza";
  if (lower.includes("granada")) return "Granada";
  if (lower.includes("córdoba")) return "Córdoba";
  return origen.split(" ")[0].split("-")[0];
};

// Extraer tipo de tren limpio (primera parte antes del \n)
const getTipoTren = (tren: string): string => {
  if (!tren) return "";
  const tipo = tren.split("\n")[0].trim();
  if (tipo.includes("IRYO") || tipo.includes("IL -")) return "IRYO";
  if (tipo.includes("OUIGO")) return "OUIGO";
  if (tipo.includes("TGV")) return "TGV";
  return tipo;
};

// Extraer número de tren (segunda parte después del \n)
const getNumeroTren = (tren: string): string => {
  if (!tren) return "";
  const parts = tren.split("\n");
  return parts.length > 1 ? parts[1].trim() : "";
};

// Color por tipo de tren
const getTrenColor = (tren: string): string => {
  const tipo = getTipoTren(tren);
  switch (tipo) {
    case "AVE": return "text-red-500";
    case "IRYO": return "text-purple-500";
    case "OUIGO": return "text-pink-500";
    case "EUROMED": return "text-blue-500";
    case "ALVIA": return "text-teal-500";
    case "TGV": return "text-indigo-500";
    case "INTERCITY": return "text-orange-500";
    default: return "text-emerald-500";
  }
};

const getTrenBgColor = (tren: string): string => {
  const tipo = getTipoTren(tren);
  switch (tipo) {
    case "AVE": return "bg-red-500/10";
    case "IRYO": return "bg-purple-500/10";
    case "OUIGO": return "bg-pink-500/10";
    case "EUROMED": return "bg-blue-500/10";
    case "ALVIA": return "bg-teal-500/10";
    case "TGV": return "bg-indigo-500/10";
    case "INTERCITY": return "bg-orange-500/10";
    default: return "bg-emerald-500/10";
  }
};

// Generar array de 24 horas empezando 1 hora antes de la hora actual
const generateHourSlots = (startHour: number): string[] => {
  const slots: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = (startHour + i) % 24;
    const nextHour = (hour + 1) % 24;
    slots.push(`${hour.toString().padStart(2, '0')} - ${nextHour.toString().padStart(2, '0')}`);
  }
  return slots;
};

export function TrainsFullDayView({ onBack, onCityClick }: TrainsFullDayViewProps) {
  const [trenes, setTrenes] = useState<TrenSants[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    fetch("/trenes_sants.json?t=" + Date.now())
      .then(res => res.json())
      .then((data: TrenSants[]) => {
        // Eliminar duplicados (mismo hora + tren)
        const uniqueTrenes = data.filter((tren, index, self) =>
          index === self.findIndex(t => t.hora === tren.hora && t.tren === tren.tren)
        );
        setTrenes(uniqueTrenes);
        setLastUpdate(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentHour = now.getHours();
  const startHour = (currentHour - 1 + 24) % 24;

  const hourSlots = useMemo(() => generateHourSlots(startHour), [startHour]);

  // Contar trenes por hora
  const countByHour = useMemo(() => {
    const counts: Record<number, number> = {};
    trenes.forEach(t => {
      const hour = parseInt(t.hora?.split(":")[0] || "0", 10);
      counts[hour] = (counts[hour] || 0) + 1;
    });
    return counts;
  }, [trenes]);

  // Contar por operador
  const countByOperador = useMemo(() => {
    const counts: Record<string, number> = {};
    trenes.forEach(t => {
      const tipo = getTipoTren(t.tren);
      counts[tipo] = (counts[tipo] || 0) + 1;
    });
    return counts;
  }, [trenes]);

  // Contar por ciudad origen
  const countByCiudad = useMemo(() => {
    const counts: Record<string, number> = {};
    trenes.forEach(t => {
      const ciudad = getCiudad(t.origen);
      counts[ciudad] = (counts[ciudad] || 0) + 1;
    });
    return counts;
  }, [trenes]);

  // Ordenar trenes por hora
  const trenesSorted = useMemo(() => {
    return [...trenes].sort((a, b) => {
      const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
      const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
      return ha * 60 + ma - (hb * 60 + mb);
    });
  }, [trenes]);

  // Max para detectar horas calientes
  const maxPerHour = Math.max(...Object.values(countByHour), 1);

  // Fecha formateada
  const fechaFormateada = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const diaSemana = now.toLocaleDateString('es-ES', {
    weekday: 'long'
  }).toUpperCase();

  // Top ciudades
  const topCiudades = Object.entries(countByCiudad)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando trenes...</p>
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
          <h1 className="font-display font-bold text-xl text-foreground">Trenes Sants</h1>
          <p className="text-[11px] text-muted-foreground">Llegadas de alta velocidad</p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{lastUpdate}</span>
          </div>
        )}
      </div>

      {/* Fecha */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm">{fechaFormateada}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm capitalize">{diaSemana}</span>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Tabla por hora */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/10">
          <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center gap-2">
            <Train className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por hora</span>
          </div>

          <div className="max-h-[50vh] overflow-y-auto scrollbar-dark">
            {hourSlots.map((slot, idx) => {
              const hour = (startHour + idx) % 24;
              const count = countByHour[hour] || 0;
              const isHot = count >= maxPerHour * 0.7 && count > 0;
              const isCurrentHour = hour === currentHour;
              
              return (
                <div 
                  key={slot} 
                  className={cn(
                    "grid grid-cols-2 border-b border-border/40",
                    isCurrentHour && "bg-emerald-500/15"
                  )}
                >
                  <div className={cn(
                    "py-2 px-2 text-center border-r border-border/40",
                    isCurrentHour && "bg-emerald-500/10"
                  )}>
                    <span className={cn(
                      "text-[9px] font-mono font-medium",
                      isCurrentHour ? "font-bold text-emerald-500" : "text-muted-foreground"
                    )}>
                      {slot}
                    </span>
                  </div>
                  <div className={cn(
                    "py-2 px-2 text-center flex items-center justify-center gap-1",
                    isHot && "bg-amber-500/15"
                  )}>
                    {isHot && <Flame className="h-3 w-3 text-amber-500" />}
                    <span className={cn(
                      "font-display font-bold text-sm",
                      isHot ? "text-amber-500" : "text-foreground",
                      count === 0 && "text-muted-foreground/40"
                    )}>
                      {count.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-muted py-2.5 px-3 border-t border-border text-center">
            <span className="font-display font-bold text-base text-emerald-500">{trenes.length}</span>
            <span className="text-[10px] text-muted-foreground ml-1">total</span>
          </div>
        </div>

        {/* Resumen por operador y ciudades */}
        <div className="space-y-2">
          {/* Por operador */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
            <div className="bg-muted py-2 px-3 border-b border-border">
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por operador</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-[22vh] overflow-y-auto scrollbar-dark">
              {Object.entries(countByOperador)
                .sort((a, b) => b[1] - a[1])
                .map(([tipo, count]) => (
                  <div 
                    key={tipo}
                    className={cn(
                      "flex items-center justify-between px-2 py-1.5 rounded-lg",
                      getTrenBgColor(tipo.includes("IRYO") ? "IL - IRYO" : tipo)
                    )}
                  >
                    <span className={cn(
                      "font-display font-bold text-xs",
                      getTrenColor(tipo.includes("IRYO") ? "IL - IRYO" : tipo)
                    )}>
                      {tipo}
                    </span>
                    <span className="font-display font-bold text-sm text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top ciudades - Clicables */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
            <div className="bg-muted py-2 px-3 border-b border-border flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Top orígenes</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-[22vh] overflow-y-auto scrollbar-dark">
              {topCiudades.map(([ciudad, count], idx) => (
                <button 
                  key={ciudad}
                  onClick={() => onCityClick?.(ciudad)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      idx === 0 ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
                    )}>
                      {idx + 1}
                    </span>
                    <span className="font-medium text-xs text-foreground">{ciudad}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-display font-bold text-sm text-emerald-500">{count}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lista detallada de próximos trenes */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
        <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Próximas llegadas</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{trenesSorted.length} trenes</span>
        </div>
        
        <div className="max-h-[40vh] overflow-y-auto scrollbar-dark">
          {trenesSorted.map((tren, idx) => {
            const [h, m] = tren.hora.split(":").map(Number);
            const trenMinutes = h * 60 + m;
            const currentMinutes = currentHour * 60 + now.getMinutes();
            const isPast = trenMinutes < currentMinutes - 5;
            const isInminente = trenMinutes >= currentMinutes && trenMinutes <= currentMinutes + 15;
            
            return (
              <div 
                key={idx}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 border-b border-border/40",
                  isPast && "opacity-40",
                  isInminente && "bg-amber-500/10"
                )}
              >
                <span className={cn(
                  "font-display font-bold text-sm w-12",
                  isInminente ? "text-amber-400" : "text-emerald-400"
                )}>
                  {tren.hora}
                </span>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded",
                  getTrenColor(tren.tren),
                  getTrenBgColor(tren.tren)
                )}>
                  {getTipoTren(tren.tren)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {getNumeroTren(tren.tren)}
                </span>
                <div className="flex-1 flex items-center gap-1 justify-end">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-foreground truncate max-w-[80px]">
                    {getCiudad(tren.origen)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 p-3 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="font-medium">= Hora caliente (alta concentración)</span>
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-1.5">
          Datos desde 1h antes para ver tendencia inmediata.
        </p>
      </div>
    </div>
  );
}
