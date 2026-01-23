import { useState, useEffect, useMemo } from "react";
import { Plane, ArrowLeft, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TerminalDetailViewProps {
  terminalId: string;
  onBack: () => void;
}

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

const terminalConfig: Record<string, { name: string; color: string }> = {
  t1: { name: "Terminal 1", color: "#FACC15" },
  t2: { name: "Terminal 2", color: "#3B82F6" },
  puente: { name: "Puente Aéreo", color: "#8B5CF6" },
  t2c: { name: "T2C EasyJet", color: "#F97316" },
};

// Lista de orígenes de larga distancia (high ticket)
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

const parseHora = (hora: string): number => {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
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

const getEsperaReten = (terminalId: string, currentHour: number): number => {
  const isPeakHour = (currentHour >= 10 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21);
  const baseWait: Record<string, number> = { t1: 25, t2: 15, t2c: 12, puente: 8 };
  const base = baseWait[terminalId] || 20;
  return isPeakHour ? base + 12 : base;
};

export function TerminalDetailView({ terminalId, onBack }: TerminalDetailViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/vuelos.json?t=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        setVuelos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const terminal = terminalConfig[terminalId];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = currentHour * 60 + now.getMinutes();

  // Filtrar vuelos activos de esta terminal
  const terminalFlights = useMemo(() => {
    return vuelos
      .filter((v) => !v.estado?.toLowerCase().includes("cancelado"))
      .filter((v) => getTerminalType(v) === terminalId)
      .sort((a, b) => {
        if (a.dia_relativo !== b.dia_relativo) return a.dia_relativo - b.dia_relativo;
        return parseHora(a.hora) - parseHora(b.hora);
      });
  }, [vuelos, terminalId]);

  // Datos para el histograma - simple horizontal bars
  const hourlyData = useMemo(() => {
    const startHour = (currentHour - 1 + 24) % 24;
    const hourlyGroups: Record<number, number> = {};

    for (let i = 0; i < 6; i++) {
      const h = (startHour + i) % 24;
      hourlyGroups[h] = 0;
    }

    terminalFlights.forEach((v) => {
      const hora = parseInt(v.hora?.split(":")[0] || "0", 10);
      if (hourlyGroups[hora] !== undefined) {
        hourlyGroups[hora] += 1;
      }
    });

    const data = [];
    let maxFlights = 0;

    for (let i = 0; i < 6; i++) {
      const h = (startHour + i) % 24;
      const flights = hourlyGroups[h];
      if (flights > maxFlights) {
        maxFlights = flights;
      }
      data.push({
        hour: h,
        label: `${h}:00`,
        flights,
        isCurrent: h === currentHour,
      });
    }

    return { data, maxFlights };
  }, [terminalFlights, currentHour]);

  const upcomingFlights = useMemo(() => {
    return terminalFlights
      .filter((v) => {
        const estado = v.estado?.toLowerCase() || "";
        if (estado.includes("finalizado")) return false;
        const vueloMin = parseHora(v.hora);
        return vueloMin >= currentMinutes - 30;
      })
      .slice(0, 20);
  }, [terminalFlights, currentMinutes]);

  const espera = getEsperaReten(terminalId, currentHour);
  const longHaulCount = upcomingFlights.filter((f) => isLongHaul(f.origen)).length;
  const timeFormatted = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

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
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-muted rounded-2xl animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!terminal) {
    return (
      <div className="flex flex-col h-full bg-background p-5">
        <button
          onClick={onBack}
          className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-muted-foreground">Terminal no encontrada</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          {/* Back button */}
          <button
            onClick={onBack}
            className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted active:scale-[0.98] transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Terminal name */}
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5" style={{ color: terminal.color }} />
            <h1 className="text-lg font-bold">{terminal.name}</h1>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-mono font-bold">{timeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pb-28 space-y-4">
          {/* Stats Row */}
          <div className="flex gap-3">
            <div className="flex-1 p-4 rounded-2xl bg-card border border-border/50">
              <p className="text-2xl font-bold" style={{ color: terminal.color }}>{terminalFlights.length}</p>
              <p className="text-xs text-muted-foreground">Vuelos hoy</p>
            </div>
            <div className="flex-1 p-4 rounded-2xl bg-card border border-border/50">
              <p className="text-2xl font-bold text-primary">{upcomingFlights.length}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
            <div className="flex-1 p-4 rounded-2xl bg-card border border-border/50">
              <p className="text-2xl font-bold text-amber-500">~{espera}'</p>
              <p className="text-xs text-muted-foreground">Espera retén</p>
            </div>
          </div>

          {/* Hourly Distribution - Simple Bars */}
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Vuelos por hora</h2>
              <span className="text-xs text-muted-foreground">Próximas 5h</span>
            </div>
            <div className="space-y-2.5">
              {hourlyData.data.map((item) => (
                <div key={item.hour} className="flex items-center gap-3">
                  <span className={cn(
                    "w-12 text-xs font-mono",
                    item.isCurrent ? "text-foreground font-bold" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                  <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: hourlyData.maxFlights > 0 ? `${(item.flights / hourlyData.maxFlights) * 100}%` : "0%" }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className={cn(
                        "h-full rounded-full transition-all",
                        item.isCurrent && "ring-2 ring-white/50"
                      )}
                      style={{ backgroundColor: terminal.color, opacity: item.isCurrent ? 1 : 0.6 }}
                    />
                  </div>
                  <span className={cn(
                    "w-8 text-sm text-right tabular-nums",
                    item.isCurrent ? "font-bold" : "text-muted-foreground"
                  )}>
                    {item.flights}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Long-haul Alert */}
          {longHaulCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-amber-500/30"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-500">{longHaulCount} vuelos Larga Distancia</p>
                <p className="text-xs text-muted-foreground">Carreras de alto valor próximas</p>
              </div>
            </motion.div>
          )}

          {/* Flights List Header */}
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-base font-semibold">Próximos vuelos</h2>
            <span className="text-xs text-muted-foreground">{upcomingFlights.length} pendientes</span>
          </div>

          {/* Flights List */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {upcomingFlights.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Plane className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold">Sin vuelos pendientes</p>
                  <p className="text-xs text-muted-foreground mt-1">No hay llegadas próximas</p>
                </motion.div>
              ) : (
                upcomingFlights.map((flight, idx) => {
                  const codigoPrincipal = flight.vuelo?.split("/")[0]?.trim() || flight.vuelo;
                  const origenCorto = flight.origen?.split("(")[0]?.trim() || flight.origen;
                  const isHighTicket = isLongHaul(flight.origen);
                  const [hour, minutes] = (flight.hora || "00:00").split(":");

                  const getStatusStyle = () => {
                    const estado = flight.estado?.toLowerCase() || "";
                    if (estado.includes("aterriz")) {
                      return { bg: "bg-emerald-500/10", text: "text-emerald-500" };
                    }
                    if (estado.includes("retrasado")) {
                      return { bg: "bg-red-500/10", text: "text-red-500" };
                    }
                    return { bg: "bg-blue-500/10", text: "text-blue-500" };
                  };

                  const statusStyle = getStatusStyle();

                  return (
                    <motion.div
                      key={`${flight.vuelo}-${idx}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50",
                        "hover:border-border active:scale-[0.98] transition-all duration-200",
                        isHighTicket && "border-amber-500/30"
                      )}
                    >
                      {/* Time block */}
                      <div className="flex-shrink-0 w-16 text-center">
                        <p className="text-2xl font-bold leading-none">{hour}</p>
                        <p className="text-base font-semibold text-muted-foreground">{minutes}</p>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-12 bg-border/60" />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{origenCorto}</p>
                          {isHighTicket && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-semibold">
                              <Globe className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{codigoPrincipal}</p>
                      </div>

                      {/* Status + Arrow */}
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-1 rounded-full",
                          statusStyle.bg,
                          statusStyle.text
                        )}>
                          {flight.estado || "En hora"}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
