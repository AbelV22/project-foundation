import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Plane, Clock } from "lucide-react";

interface VueloRaw {
  hora: string;
  vuelo: string;
  aerolinea: string;
  origen: string;
  terminal: string;
  sala: string;
  estado: string;
  dia_relativo: number;
}

interface FullDayViewProps {
  onBack?: () => void;
  onTerminalClick?: (terminalId: string) => void;
}

const LONG_HAUL_ORIGINS = [
  "NEW YORK", "LOS ANGELES", "MIAMI", "CHICAGO", "WASHINGTON", "BOSTON",
  "SAN FRANCISCO", "TORONTO", "MONTREAL", "MEXICO", "BOGOTA", "BUENOS AIRES",
  "SAO PAULO", "LIMA", "SANTIAGO", "DOHA", "DUBAI", "ABU DHABI", "TOKYO",
  "SEOUL", "BEIJING", "SHANGHAI", "SINGAPORE", "HONG KONG", "BANGKOK",
  "DELHI", "MUMBAI", "JOHANNESBURG", "CAPE TOWN", "SYDNEY", "MELBOURNE",
  "TEL AVIV", "CAIRO", "EL CAIRO", "LAX", "JFK", "ORD", "DFW", "DOH", "DXB",
];

const isLongHaul = (origen: string): boolean => {
  const origenUpper = origen?.toUpperCase() || "";
  return LONG_HAUL_ORIGINS.some((lh) => origenUpper.includes(lh));
};

const getTerminalType = (vuelo: VueloRaw): "t1" | "t2" | "t2c" | "puente" => {
  const terminal = vuelo.terminal?.toUpperCase() || "";
  const codigosVuelo = vuelo.vuelo?.toUpperCase() || "";
  const origen = vuelo.origen?.toUpperCase() || "";
  if (terminal.includes("T2C") || terminal.includes("EASYJET")) return "t2c";
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) return "t2c";
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) return "puente";
  if (terminal.includes("T2A") || terminal.includes("T2B")) return "t2";
  if (terminal.includes("T1")) return "t1";
  return "t2";
};

// Intensity levels for heat coloring
type IntensityLevel = "none" | "low" | "medium" | "high";

const getIntensityLevel = (count: number, max: number): IntensityLevel => {
  if (count === 0) return "none";
  const ratio = count / max;
  if (ratio >= 0.7) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
};

// Terminal colors
const terminalColors = {
  t1: { bg: "bg-amber-500", text: "text-amber-500", badge: "bg-amber-500" },
  t2: { bg: "bg-blue-500", text: "text-blue-500", badge: "bg-blue-500" },
  puente: { bg: "bg-purple-500", text: "text-purple-500", badge: "bg-purple-500" },
  t2c: { bg: "bg-orange-500", text: "text-orange-500", badge: "bg-orange-500" },
};

export function FullDayView({ onBack, onTerminalClick }: FullDayViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll24Hours, setShowAll24Hours] = useState(false);

  useEffect(() => {
    fetch("/vuelos.json?t=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVuelos(data);
        } else if (data?.vuelos) {
          setVuelos(data.vuelos);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentHour = now.getHours();

  const vuelosActivos = useMemo(
    () => vuelos.filter((v) => !v.estado?.toLowerCase().includes("cancelado")),
    [vuelos]
  );

  const vuelosPorTerminal = useMemo(() => {
    const data: Record<string, VueloRaw[]> = { t1: [], t2: [], t2c: [], puente: [] };
    vuelosActivos.forEach((v) => {
      const type = getTerminalType(v);
      data[type].push(v);
    });
    return data;
  }, [vuelosActivos]);

  // Count flights per hour and terminal
  const countByHourAndTerminal = useMemo(() => {
    const counts: Record<string, Record<number, number>> = { t1: {}, t2: {}, t2c: {}, puente: {} };
    Object.entries(vuelosPorTerminal).forEach(([terminal, flights]) => {
      flights.forEach((v) => {
        const hour = parseInt(v.hora?.split(":")[0] || "0", 10);
        counts[terminal][hour] = (counts[terminal][hour] || 0) + 1;
      });
    });
    return counts;
  }, [vuelosPorTerminal]);

  // Find max per terminal for intensity calculation
  const maxByTerminal = useMemo(() => {
    return {
      t1: Math.max(...Object.values(countByHourAndTerminal.t1), 1),
      t2: Math.max(...Object.values(countByHourAndTerminal.t2), 1),
      puente: Math.max(...Object.values(countByHourAndTerminal.puente), 1),
      t2c: Math.max(...Object.values(countByHourAndTerminal.t2c), 1),
    };
  }, [countByHourAndTerminal]);

  // Get next arrivals for T2C and Puente Aereo
  const getNextArrivals = (terminal: "t2c" | "puente", count: number = 3) => {
    const currentMinutes = currentHour * 60 + now.getMinutes();
    return vuelosPorTerminal[terminal]
      .filter((v) => {
        const [h, m] = (v.hora || "00:00").split(":").map(Number);
        const flightMin = h * 60 + m;
        return flightMin >= currentMinutes - 15; // Include flights from 15 min ago
      })
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      })
      .slice(0, count);
  };

  const nextT2CArrivals = useMemo(() => getNextArrivals("t2c", 4), [vuelosPorTerminal, currentHour, now]);
  const nextPuenteArrivals = useMemo(() => getNextArrivals("puente", 4), [vuelosPorTerminal, currentHour, now]);

  // Calculate upcoming long-haul flights for the alert section
  const upcomingLongHaul = useMemo(() => {
    const currentMinutes = currentHour * 60 + now.getMinutes();
    const twoHoursFromNow = currentMinutes + 120;

    return vuelosActivos
      .filter((v) => {
        if (!isLongHaul(v.origen)) return false;
        const estado = v.estado?.toLowerCase() || "";
        if (estado.includes("finalizado")) return false;
        const [h, m] = (v.hora || "00:00").split(":").map(Number);
        const flightMin = h * 60 + m;
        return flightMin >= currentMinutes - 30 && flightMin <= twoHoursFromNow;
      })
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      });
  }, [vuelosActivos, currentHour, now]);

  // Generate hour rows - starting from 1 hour before current
  const hourRows = useMemo(() => {
    const startHour = (currentHour - 1 + 24) % 24;
    const hoursToShow = showAll24Hours ? 24 : 12;
    const rows = [];

    for (let i = 0; i < hoursToShow; i++) {
      const hour = (startHour + i) % 24;
      const t1Count = countByHourAndTerminal.t1[hour] || 0;
      const t2Count = countByHourAndTerminal.t2[hour] || 0;
      const puenteCount = countByHourAndTerminal.puente[hour] || 0;
      const t2cCount = countByHourAndTerminal.t2c[hour] || 0;

      rows.push({
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
        t1: t1Count,
        t2: t2Count,
        puente: puenteCount,
        t2c: t2cCount,
        isCurrent: hour === currentHour,
        t1Intensity: getIntensityLevel(t1Count, maxByTerminal.t1),
        t2Intensity: getIntensityLevel(t2Count, maxByTerminal.t2),
        puenteIntensity: getIntensityLevel(puenteCount, maxByTerminal.puente),
        t2cIntensity: getIntensityLevel(t2cCount, maxByTerminal.t2c),
      });
    }

    return rows;
  }, [countByHourAndTerminal, currentHour, maxByTerminal, showAll24Hours]);

  // Totals
  const totals = useMemo(() => ({
    t1: vuelosPorTerminal.t1.length,
    t2: vuelosPorTerminal.t2.length,
    puente: vuelosPorTerminal.puente.length,
    t2c: vuelosPorTerminal.t2c.length,
    total: vuelosActivos.length,
  }), [vuelosPorTerminal, vuelosActivos]);

  // Get badge style based on intensity
  const getBadgeStyle = (intensity: IntensityLevel, terminal: keyof typeof terminalColors) => {
    const colors = terminalColors[terminal];
    switch (intensity) {
      case "high":
        return `${colors.badge} text-white font-bold`;
      case "medium":
        return `${colors.badge}/80 text-white font-semibold`;
      case "low":
        return `${colors.badge}/20 ${colors.text} font-bold`; // Dark text on light bg
      default:
        return "bg-transparent text-muted-foreground/30";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground mt-2">Cargando vuelos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto pb-20">
      {/* Header Row - Minimal */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Llegadas por hora</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-green-500/40" /> Bajo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-amber-500/70" /> Medio
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-500" /> Alto
            </span>
          </div>
        </div>
      </div>

      {/* Table Header - 4 columns without total */}
      <div className="flex-shrink-0 grid grid-cols-[50px_1fr_1fr_1fr_1fr] gap-1 px-3 py-2 bg-muted/30 border-b border-border/50">
        <div className="text-[10px] font-semibold text-muted-foreground text-center">Hora</div>
        <div className="text-[10px] font-bold text-amber-500 text-center">T1</div>
        <div className="text-[10px] font-bold text-blue-500 text-center">T2</div>
        <div className="text-[10px] font-bold text-purple-500 text-center">PA</div>
        <div className="text-[10px] font-bold text-orange-500 text-center">T2C</div>
      </div>

      {/* Table Body */}
      <div className="flex-shrink-0">
        {hourRows.map((row) => (
          <div
            key={row.hour}
            className={cn(
              "grid grid-cols-[50px_1fr_1fr_1fr_1fr] gap-1 px-3 py-1.5 border-b border-border/30",
              row.isCurrent && "bg-primary/10 border-l-2 border-l-primary"
            )}
          >
            {/* Hour */}
            <div className={cn(
              "text-xs font-mono text-center",
              row.isCurrent ? "font-bold text-primary" : "text-muted-foreground"
            )}>
              {row.label}
            </div>

            {/* T1 */}
            <div className="flex justify-center">
              <span className={cn(
                "min-w-[28px] h-6 flex items-center justify-center rounded text-xs",
                getBadgeStyle(row.t1Intensity, "t1")
              )}>
                {row.t1 > 0 ? row.t1 : ""}
              </span>
            </div>

            {/* T2 */}
            <div className="flex justify-center">
              <span className={cn(
                "min-w-[28px] h-6 flex items-center justify-center rounded text-xs",
                getBadgeStyle(row.t2Intensity, "t2")
              )}>
                {row.t2 > 0 ? row.t2 : ""}
              </span>
            </div>

            {/* Puente Aereo */}
            <div className="flex justify-center">
              <span className={cn(
                "min-w-[28px] h-6 flex items-center justify-center rounded text-xs",
                getBadgeStyle(row.puenteIntensity, "puente")
              )}>
                {row.puente > 0 ? row.puente : ""}
              </span>
            </div>

            {/* T2C */}
            <div className="flex justify-center">
              <span className={cn(
                "min-w-[28px] h-6 flex items-center justify-center rounded text-xs",
                getBadgeStyle(row.t2cIntensity, "t2c")
              )}>
                {row.t2c > 0 ? row.t2c : ""}
              </span>
            </div>
          </div>
        ))}

        {/* Show More / Less Button */}
        <button
          onClick={() => setShowAll24Hours(!showAll24Hours)}
          className="w-full py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors border-b border-border/30"
        >
          {showAll24Hours ? "- Mostrar menos horas" : "+ Mostrar 24 horas completas"}
        </button>
      </div>

      {/* Footer Totals - 4 columns */}
      <div className="flex-shrink-0 grid grid-cols-[50px_1fr_1fr_1fr_1fr] gap-1 px-3 py-2 bg-muted/50 border-t border-border">
        <div className="text-[10px] font-bold text-muted-foreground text-center">Total</div>
        <div className="text-center">
          <span className="text-sm font-bold text-amber-500">{totals.t1}</span>
        </div>
        <div className="text-center">
          <span className="text-sm font-bold text-blue-500">{totals.t2}</span>
        </div>
        <div className="text-center">
          <span className="text-sm font-bold text-purple-500">{totals.puente}</span>
        </div>
        <div className="text-center">
          <span className="text-sm font-bold text-orange-500">{totals.t2c}</span>
        </div>
      </div>

      {/* Next Arrivals for T2C and Puente Aereo */}
      <div className="flex-shrink-0 px-3 py-3 space-y-3">
        {/* T2C Next Arrivals */}
        {nextT2CArrivals.length > 0 && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                <Plane className="h-3 w-3 text-white" />
              </div>
              <span className="text-xs font-bold text-orange-500">Proximos T2C (EasyJet)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nextT2CArrivals.map((flight, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-background/50 rounded-lg px-2 py-1.5">
                  <Clock className="h-3 w-3 text-orange-500" />
                  <span className="text-sm font-mono font-bold text-foreground">{flight.hora}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{flight.origen?.split("(")[0]?.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Puente Aereo Next Arrivals */}
        {nextPuenteArrivals.length > 0 && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                <Plane className="h-3 w-3 text-white" />
              </div>
              <span className="text-xs font-bold text-purple-500">Proximos Puente Aereo (Madrid)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nextPuenteArrivals.map((flight, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-background/50 rounded-lg px-2 py-1.5">
                  <Clock className="h-3 w-3 text-purple-500" />
                  <span className="text-sm font-mono font-bold text-foreground">{flight.hora}</span>
                  <span className="text-[10px] text-foreground/70 font-medium">{flight.vuelo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Long-haul High-Ticket Flights Section */}
      {upcomingLongHaul.length > 0 && (
        <div className="flex-shrink-0 px-3 py-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🌍</span>
              <span className="text-xs font-bold text-amber-500">
                Vuelos larga distancia (proximas 2h) - High Ticket
              </span>
              <span className="ml-auto text-xs font-bold text-amber-500 bg-amber-500/20 px-2 py-0.5 rounded-full">
                {upcomingLongHaul.length}
              </span>
            </div>
            <div className="space-y-2">
              {upcomingLongHaul.slice(0, 6).map((flight, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-background/50 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-mono font-bold text-amber-400 w-12">{flight.hora}</span>
                  <span className="text-xs font-medium text-foreground flex-1 truncate">
                    {flight.origen?.split("(")[0]?.trim()}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded",
                    getTerminalType(flight) === "t1" ? "bg-amber-500/20 text-amber-500" : "bg-blue-500/20 text-blue-500"
                  )}>
                    {getTerminalType(flight) === "t1" ? "T1" : "T2"}
                  </span>
                  <span className="text-[10px] text-foreground/70 font-mono">{flight.vuelo}</span>
                </div>
              ))}
              {upcomingLongHaul.length > 6 && (
                <p className="text-[10px] text-amber-500/70 text-center pt-1">
                  +{upcomingLongHaul.length - 6} vuelos mas
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex-shrink-0 px-3 py-3">
        <div className="rounded-xl bg-muted/30 p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="w-4 h-4 rounded bg-amber-500 mx-auto mb-1" />
              <span className="text-[9px] text-muted-foreground">T1</span>
            </div>
            <div>
              <div className="w-4 h-4 rounded bg-blue-500 mx-auto mb-1" />
              <span className="text-[9px] text-muted-foreground">T2</span>
            </div>
            <div>
              <div className="w-4 h-4 rounded bg-purple-500 mx-auto mb-1" />
              <span className="text-[9px] text-muted-foreground">P. Aereo</span>
            </div>
            <div>
              <div className="w-4 h-4 rounded bg-orange-500 mx-auto mb-1" />
              <span className="text-[9px] text-muted-foreground">T2C</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
