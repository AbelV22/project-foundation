import { useState, useEffect, useMemo } from "react";
import { Plane, Clock, ArrowLeft, RefreshCw, Flame, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from "recharts";

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

const terminalConfig: Record<string, { name: string; color: string; gradient: string }> = {
  t1: { name: "Terminal 1", color: "#FACC15", gradient: "from-yellow-500 to-amber-600" },
  t2: { name: "Terminal 2", color: "#3B82F6", gradient: "from-blue-500 to-indigo-600" },
  puente: { name: "Puente Aéreo", color: "#8B5CF6", gradient: "from-violet-500 to-purple-600" },
  t2c: { name: "T2C EasyJet", color: "#F97316", gradient: "from-orange-500 to-red-600" },
};

// Lista de orígenes de larga distancia (high ticket)
const LONG_HAUL_ORIGINS = [
  "NEW YORK",
  "LOS ANGELES",
  "MIAMI",
  "CHICAGO",
  "WASHINGTON",
  "BOSTON",
  "SAN FRANCISCO",
  "TORONTO",
  "MONTREAL",
  "MEXICO",
  "BOGOTA",
  "BUENOS AIRES",
  "SAO PAULO",
  "LIMA",
  "SANTIAGO",
  "DOHA",
  "DUBAI",
  "ABU DHABI",
  "TOKYO",
  "SEOUL",
  "BEIJING",
  "SHANGHAI",
  "SINGAPORE",
  "HONG KONG",
  "BANGKOK",
  "DELHI",
  "MUMBAI",
  "JOHANNESBURG",
  "CAPE TOWN",
  "SYDNEY",
  "MELBOURNE",
  "TEL AVIV",
  "CAIRO",
  "EL CAIRO",
  "LAX",
  "JFK",
  "ORD",
  "DFW",
  "DOH",
  "DXB",
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

  // Datos para el histograma
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
    let peakHour = startHour;

    for (let i = 0; i < 6; i++) {
      const h = (startHour + i) % 24;
      const flights = hourlyGroups[h];
      if (flights > maxFlights) {
        maxFlights = flights;
        peakHour = h;
      }
      data.push({
        hour: h,
        label: `${h}:00`,
        shortLabel: `${h}h`,
        flights,
        isPeak: false,
        isCurrent: h === currentHour,
      });
    }

    data.forEach((d) => {
      if (d.hour === peakHour && d.flights > 0) d.isPeak = true;
    });

    return { data, maxFlights, peakHour };
  }, [terminalFlights, currentHour]);

  const nextPeakInfo = useMemo(() => {
    const peak = hourlyData.data.find((d) => d.isPeak && d.hour >= currentHour);
    if (peak) {
      const peakTime = `${peak.hour}:00`;
      return { flights: peak.flights, time: peakTime };
    }
    return null;
  }, [hourlyData, currentHour]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando terminal...</p>
      </div>
    );
  }

  if (!terminal) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <p className="text-muted-foreground">Terminal no encontrada</p>
      </div>
    );
  }

  const timeFormatted = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header Gridwise Style */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" style={{ color: terminal.color }} />
          <span className="font-display font-bold text-foreground">{terminal.name}</span>
        </div>

        {/* NUEVO RELOJ / INDICADOR */}
        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <p className="text-sm font-mono font-bold text-foreground tracking-widest">{timeFormatted}</p>
        </div>
      </div>

      {/* Next Peak Banner */}
      {nextPeakInfo && (
        <div className="card-glass p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">Próximo Pico</span>
            <Flame className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-3xl text-foreground">{nextPeakInfo.flights}</span>
            <span className="text-sm text-muted-foreground">vuelos</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            aterrizan a las <span className="text-foreground font-semibold">{nextPeakInfo.time}</span>
          </p>
        </div>
      )}

      {/* Histogram Chart - Vuelos por hora */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">Vuelos por Hora</h4>
          <span className="text-[10px] text-muted-foreground font-mono">Próximas 5h</span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData.data} barCategoryGap="20%" margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`barGradient-${terminalId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={terminal.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={terminal.color} stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="shortLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)", fontFamily: "monospace" }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number) => [`${value} vuelos`, "Llegadas"]}
              />

              {/* BARRAS CON NÚMERO ENCIMA */}
              <Bar dataKey="flights" radius={[6, 6, 0, 0]} animationDuration={1000}>
                <LabelList
                  dataKey="flights"
                  position="top"
                  className="fill-foreground"
                  fontSize={12}
                  fontWeight="bold"
                  formatter={(val: number) => (val > 0 ? val : "")}
                  offset={5}
                />

                {hourlyData.data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPeak ? "#ef4444" : terminal.color}
                    opacity={entry.isCurrent ? 1 : entry.isPeak ? 1 : 0.5}
                    stroke={entry.isCurrent ? "white" : "none"}
                    strokeWidth={2}
                  />
                ))}
              </Bar>

              {/* Marker for peak */}
              {hourlyData.data.map((entry, index) =>
                entry.isPeak && entry.flights > 0 ? (
                  <ReferenceLine key={`peak-${index}`} x={entry.shortLabel} stroke="transparent" />
                ) : null,
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card-glass p-3 text-center">
          <Plane className="h-4 w-4 mx-auto mb-1" style={{ color: terminal.color }} />
          <p className="font-mono font-bold text-2xl text-foreground">{terminalFlights.length}</p>
          <p className="text-[10px] text-muted-foreground">Vuelos hoy</p>
        </div>
        <div className="card-glass p-3 text-center">
          <Plane className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="font-mono font-bold text-2xl text-primary">{upcomingFlights.length}</p>
          <p className="text-[10px] text-muted-foreground">Pendientes</p>
        </div>
        <div className="card-glass p-3 text-center">
          <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
          <p className="font-mono font-bold text-2xl text-amber-500">~{espera}'</p>
          <p className="text-[10px] text-muted-foreground">Retén</p>
        </div>
      </div>

      {/* High Ticket Alert */}
      {longHaulCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
          <Globe className="h-5 w-5 text-yellow-500" />
          <div>
            <p className="text-sm font-semibold text-yellow-500">{longHaulCount} vuelos Larga Distancia</p>
            <p className="text-xs text-muted-foreground">🌎 Carreras de alto valor próximas</p>
          </div>
        </div>
      )}

      {/* Flights List */}
      <div className="card-glass overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground">Próximos Vuelos</h3>
          <span className="text-xs text-muted-foreground">{upcomingFlights.length} pendientes</span>
        </div>
        <div className="divide-y divide-border/50 max-h-[50vh] overflow-y-auto">
          {upcomingFlights.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No hay vuelos pendientes</div>
          ) : (
            upcomingFlights.map((flight, idx) => {
              const codigoPrincipal = flight.vuelo?.split("/")[0]?.trim() || flight.vuelo;
              const origenCorto = flight.origen?.split("(")[0]?.trim() || flight.origen;
              const isHighTicket = isLongHaul(flight.origen);

              return (
                <div
                  key={idx}
                  className={cn("flex items-center gap-3 p-3 transition-colors", isHighTicket && "bg-yellow-500/5")}
                >
                  {/* Time */}
                  <span className="font-mono font-bold text-lg tabular-nums text-foreground w-14">{flight.hora}</span>

                  {/* Flight Info - CAMBIADO EL ORDEN */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      {/* ORIGEN GRANDE */}
                      <span className="font-bold text-base text-foreground truncate tracking-tight">{origenCorto}</span>
                      {isHighTicket && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 text-[10px] font-semibold border border-yellow-500/30">
                          <Globe className="h-3 w-3" />
                          <span className="hidden sm:inline">LARGA DIST.</span>
                        </span>
                      )}
                    </div>
                    {/* CODIGO PEQUEÑO */}
                    <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">{codigoPrincipal}</p>
                  </div>

                  {/* Status */}
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-1 rounded-full",
                        flight.estado?.toLowerCase().includes("aterriz")
                          ? "bg-emerald-500/20 text-emerald-400"
                          : flight.estado?.toLowerCase().includes("retrasado")
                            ? "bg-red-500/20 text-red-400"
                            : "bg-blue-500/20 text-blue-400",
                      )}
                    >
                      {flight.estado || "En hora"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
