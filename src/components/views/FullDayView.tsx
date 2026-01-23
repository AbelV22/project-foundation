import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plane, Globe, Clock, Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

const terminals = {
  t1: { name: "T1", fullName: "Terminal 1", color: "#FACC15" },
  t2: { name: "T2", fullName: "Terminal 2", color: "#3B82F6" },
  puente: { name: "Puente", fullName: "Puente Aéreo", color: "#8B5CF6" },
  t2c: { name: "T2C", fullName: "T2C EasyJet", color: "#F97316" },
};

const waitTimeBase: Record<string, number> = { t1: 25, t2: 15, t2c: 12, puente: 8 };

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

export function FullDayView({ onBack, onTerminalClick }: FullDayViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);

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
  const currentMinutes = currentHour * 60 + now.getMinutes();
  const timeFormatted = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const vuelosActivos = useMemo(() =>
    vuelos.filter((v) => !v.estado?.toLowerCase().includes("cancelado")),
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

  // Group flights by hour for each terminal
  const hourlyData = useMemo(() => {
    const startHour = (currentHour - 1 + 24) % 24;
    const hours: { hour: number; t1: number; t2: number; t2c: number; puente: number; total: number }[] = [];

    for (let i = 0; i < 8; i++) {
      const h = (startHour + i) % 24;
      const counts = { hour: h, t1: 0, t2: 0, t2c: 0, puente: 0, total: 0 };

      Object.entries(vuelosPorTerminal).forEach(([terminal, flights]) => {
        const count = flights.filter(v => {
          const flightHour = parseInt(v.hora?.split(":")[0] || "0", 10);
          return flightHour === h;
        }).length;
        counts[terminal as keyof typeof counts] = count;
        counts.total += count;
      });

      hours.push(counts);
    }

    return hours;
  }, [vuelosPorTerminal, currentHour]);

  // Find peak hour
  const peakHour = useMemo(() => {
    const upcoming = hourlyData.filter(h => h.hour >= currentHour);
    if (upcoming.length === 0) return null;
    return upcoming.reduce((max, h) => h.total > max.total ? h : max, upcoming[0]);
  }, [hourlyData, currentHour]);

  // Current hour data
  const currentHourData = useMemo(() => {
    return hourlyData.find(h => h.hour === currentHour) || { t1: 0, t2: 0, t2c: 0, puente: 0, total: 0 };
  }, [hourlyData, currentHour]);

  // Long-haul flights coming in next 2 hours
  const upcomingLongHaul = useMemo(() => {
    const twoHoursFromNow = currentMinutes + 120;
    return vuelosActivos.filter(v => {
      if (!isLongHaul(v.origen)) return false;
      const estado = v.estado?.toLowerCase() || "";
      if (estado.includes("finalizado")) return false;
      const [h, m] = (v.hora || "00:00").split(":").map(Number);
      const flightMin = h * 60 + m;
      return flightMin >= currentMinutes - 30 && flightMin <= twoHoursFromNow;
    }).sort((a, b) => {
      const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
      const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
      return (ha * 60 + ma) - (hb * 60 + mb);
    });
  }, [vuelosActivos, currentMinutes]);

  // Filtered flights by selected terminal
  const filteredHourlyData = useMemo(() => {
    if (!selectedTerminal) return hourlyData;
    return hourlyData.map(h => ({
      ...h,
      total: h[selectedTerminal as keyof typeof h] as number
    }));
  }, [hourlyData, selectedTerminal]);

  const maxHourlyTotal = Math.max(...filteredHourlyData.map(h => h.total), 1);

  const isPeakHour = (currentHour >= 10 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
            <div className="h-6 w-32 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex-1 px-5 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted active:scale-[0.98] transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h1 className="text-lg font-bold">Vista del Día</h1>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-mono font-bold">{timeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pb-28 space-y-4">
          {/* Terminal Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
            <button
              onClick={() => setSelectedTerminal(null)}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98]",
                selectedTerminal === null
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-foreground"
              )}
            >
              Todos
            </button>
            {Object.entries(terminals).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setSelectedTerminal(key)}
                className={cn(
                  "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98]",
                  selectedTerminal === key
                    ? "text-white"
                    : "bg-muted/60 text-foreground"
                )}
                style={selectedTerminal === key ? { backgroundColor: t.color } : {}}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Quick Stats - Current Hour */}
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Ahora mismo</span>
              </div>
              {isPeakHour && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10">
                  <Flame className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-semibold text-red-500">Hora pico</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Object.entries(terminals).map(([key, t]) => {
                const count = currentHourData[key as keyof typeof currentHourData];
                const waitTime = waitTimeBase[key] + (isPeakHour ? 12 : 0);
                const isSelected = selectedTerminal === key || selectedTerminal === null;

                return (
                  <button
                    key={key}
                    onClick={() => onTerminalClick?.(key)}
                    className={cn(
                      "p-3 rounded-xl border transition-all active:scale-[0.98]",
                      isSelected
                        ? "bg-card border-border/50"
                        : "bg-muted/20 border-transparent opacity-50"
                    )}
                  >
                    <p className="text-2xl font-bold" style={{ color: t.color }}>{count}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground/70">~{waitTime}' espera</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Peak Hour Alert */}
          {peakHour && peakHour.total > 0 && peakHour.hour !== currentHour && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-red-500/30"
            >
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Flame className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Próximo pico: {peakHour.hour}:00h</p>
                <p className="text-xs text-muted-foreground">
                  {peakHour.total} vuelos aterrizando
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-500">{peakHour.total}</p>
              </div>
            </motion.div>
          )}

          {/* Long-haul Flights Alert */}
          {upcomingLongHaul.length > 0 && (
            <div className="p-4 rounded-2xl bg-card border border-amber-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-500">
                  {upcomingLongHaul.length} vuelos larga distancia
                </span>
              </div>
              <div className="space-y-2">
                {upcomingLongHaul.slice(0, 3).map((flight, idx) => {
                  const terminalType = getTerminalType(flight);
                  const terminal = terminals[terminalType];
                  const origen = flight.origen?.split("(")[0]?.trim() || flight.origen;

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 rounded-xl bg-amber-500/5"
                    >
                      <span className="font-mono font-bold text-lg">{flight.hora}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{origen}</p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ backgroundColor: `${terminal.color}20`, color: terminal.color }}
                      >
                        {terminal.name}
                      </span>
                    </div>
                  );
                })}
                {upcomingLongHaul.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{upcomingLongHaul.length - 3} más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Hourly Breakdown */}
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Próximas horas</h2>
              <span className="text-xs text-muted-foreground">Llegadas por hora</span>
            </div>

            <div className="space-y-2">
              {filteredHourlyData.map((hourData, idx) => {
                const isCurrent = hourData.hour === currentHour;
                const isPeak = peakHour && hourData.hour === peakHour.hour;
                const barWidth = maxHourlyTotal > 0 ? (hourData.total / maxHourlyTotal) * 100 : 0;

                return (
                  <motion.div
                    key={hourData.hour}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-xl transition-colors",
                      isCurrent && "bg-primary/5 border border-primary/20"
                    )}
                  >
                    <div className="w-12 flex items-center gap-1">
                      {isPeak && <Flame className="h-3 w-3 text-red-500" />}
                      <span className={cn(
                        "text-sm font-mono",
                        isCurrent ? "font-bold text-primary" : "text-muted-foreground"
                      )}>
                        {hourData.hour.toString().padStart(2, "0")}:00
                      </span>
                    </div>

                    <div className="flex-1 h-7 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.05 }}
                        className={cn(
                          "h-full rounded-full flex items-center justify-end pr-2",
                          isPeak ? "bg-red-500" : isCurrent ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      >
                        {barWidth > 20 && (
                          <span className="text-xs font-bold text-white">{hourData.total}</span>
                        )}
                      </motion.div>
                    </div>

                    {barWidth <= 20 && (
                      <span className={cn(
                        "w-8 text-sm font-bold text-right tabular-nums",
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      )}>
                        {hourData.total}
                      </span>
                    )}

                    {/* Mini terminal breakdown */}
                    {!selectedTerminal && hourData.total > 0 && (
                      <div className="flex gap-1">
                        {Object.entries(terminals).map(([key, t]) => {
                          const count = hourData[key as keyof typeof hourData];
                          if (count === 0) return null;
                          return (
                            <span
                              key={key}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${t.color}20`, color: t.color }}
                            >
                              {count}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Terminal Cards - Tap to see details */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold px-1">Por terminal</h2>
            {Object.entries(terminals).map(([key, t]) => {
              const flights = vuelosPorTerminal[key];
              const longHaulCount = flights.filter(f => isLongHaul(f.origen)).length;
              const waitTime = waitTimeBase[key] + (isPeakHour ? 12 : 0);

              if (selectedTerminal && selectedTerminal !== key) return null;

              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onTerminalClick?.(key)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 hover:border-border active:scale-[0.98] transition-all text-left"
                >
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${t.color}15` }}
                  >
                    <Plane className="h-6 w-6" style={{ color: t.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold">{t.fullName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{flights.length} vuelos hoy</span>
                      {longHaulCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Globe className="h-3 w-3" />
                          {longHaulCount} larga dist.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: t.color }}>{flights.length}</p>
                    <p className="text-[10px] text-muted-foreground">~{waitTime}' espera</p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
