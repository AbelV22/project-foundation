import { useState, useEffect } from "react";
import { Plane, Clock, Users, ArrowDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

// Tipos para vuelos.json (estructura real del scraper)
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

// Función para parsear hora "HH:MM" a minutos del día
const parseHora = (hora: string): number => {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Determinar tipo de terminal basado en los datos reales del scraper
const getTerminalType = (vuelo: VueloRaw): 't1' | 't2' | 't2c' | 'puente' => {
  const terminal = vuelo.terminal?.toUpperCase() || "";
  const codigosVuelo = vuelo.vuelo?.toUpperCase() || "";
  const origen = vuelo.origen?.toUpperCase() || "";
  
  // T2C: EasyJet (terminal indica "T2C" o códigos EJU/EZY)
  if (terminal.includes("T2C") || terminal.includes("EASYJET")) {
    return "t2c";
  }
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) {
    return "t2c";
  }
  
  // Puente Aéreo: vuelos IBE desde Madrid (código IBE + origen Madrid)
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) {
    return "puente";
  }
  
  // T2A/T2B: Ryanair, Wizz, etc.
  if (terminal.includes("T2A") || terminal.includes("T2B")) {
    return "t2";
  }
  
  // T1: resto de vuelos T1
  if (terminal.includes("T1")) {
    return "t1";
  }
  
  // Default T2 para otros casos
  return "t2";
};

// Tiempos de retén estimados por terminal
const getEsperaReten = (terminalId: string, currentHour: number): number => {
  const isPeakHour = (currentHour >= 10 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21);
  const baseWait: Record<string, number> = {
    t1: 25, t2: 15, t2c: 12, puente: 8
  };
  const base = baseWait[terminalId] || 20;
  return isPeakHour ? base + 12 : base;
};

export function FlightsView() {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState("all");
  const [chartType, setChartType] = useState<"vuelos" | "pasajeros">("pasajeros");

  useEffect(() => {
    fetch("/vuelos.json?t=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        console.log("📡 FlightsView - Vuelos cargados:", data?.length || 0);
        setVuelos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando vuelos.json:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando vuelos...</p>
      </div>
    );
  }

  if (vuelos.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No hay datos de vuelos disponibles.</p>
      </div>
    );
  }

  const currentHour = new Date().getHours();

  // Filtrar vuelos activos (no cancelados)
  const vuelosActivos = vuelos.filter(v => {
    const estado = v.estado?.toLowerCase() || "";
    return !estado.includes("cancelado");
  });

  // Ordenar por hora
  const vuelosSorted = [...vuelosActivos].sort((a, b) => {
    if (a.dia_relativo !== b.dia_relativo) {
      return a.dia_relativo - b.dia_relativo;
    }
    return parseHora(a.hora) - parseHora(b.hora);
  });

  // Agrupar por terminal
  const terminalData: Record<string, { vuelos: VueloRaw[]; pax: number }> = {
    t1: { vuelos: [], pax: 0 },
    t2: { vuelos: [], pax: 0 },
    t2c: { vuelos: [], pax: 0 },
    puente: { vuelos: [], pax: 0 }
  };

  vuelosSorted.forEach(vuelo => {
    const type = getTerminalType(vuelo);
    terminalData[type].vuelos.push(vuelo);
    const paxEstimado = type === 'puente' ? 150 : type === 't2c' ? 180 : 200;
    terminalData[type].pax += paxEstimado;
  });

  // Prepare terminal stats
  const terminalStats = [
    { id: "t1", name: "T1", flights: terminalData.t1.vuelos.length, passengers: terminalData.t1.pax, color: "#3B82F6", espera: getEsperaReten("t1", currentHour) },
    { id: "t2", name: "T2", flights: terminalData.t2.vuelos.length, passengers: terminalData.t2.pax, color: "#10B981", espera: getEsperaReten("t2", currentHour) },
    { id: "puente", name: "Puente Aéreo", flights: terminalData.puente.vuelos.length, passengers: terminalData.puente.pax, color: "#8B5CF6", espera: getEsperaReten("puente", currentHour) },
    { id: "t2c", name: "T2C EasyJet", flights: terminalData.t2c.vuelos.length, passengers: terminalData.t2c.pax, color: "#F97316", espera: getEsperaReten("t2c", currentHour) },
  ];

  // Crear datos horarios para gráfica
  const hourlyGroups: Record<number, { vuelos: number; pax: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyGroups[h] = { vuelos: 0, pax: 0 };
  }
  
  vuelosSorted.forEach(v => {
    const hora = parseInt(v.hora?.split(":")[0] || "0", 10);
    const type = getTerminalType(v);
    const paxEstimado = type === 'puente' ? 150 : type === 't2c' ? 180 : 200;
    if (hourlyGroups[hora]) {
      hourlyGroups[hora].vuelos += 1;
      hourlyGroups[hora].pax += paxEstimado;
    }
  });

  const hourlyData = Object.entries(hourlyGroups).map(([h, data]) => ({
    hour: `${h.padStart(2, '0')}:00`,
    vuelos: data.vuelos,
    pasajeros: data.pax
  }));

  // Filter flights by terminal
  const filterFlights = (allVuelos: VueloRaw[]) => {
    if (selectedTerminal === "all") return allVuelos;
    
    return allVuelos.filter(v => {
      const type = getTerminalType(v);
      return type === selectedTerminal;
    });
  };

  const filteredFlights = filterFlights(vuelosSorted).slice(0, 20);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Terminal Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {terminalStats.map((terminal) => (
          <div
            key={terminal.id}
            className="card-dashboard p-4 md:p-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2 md:mb-3">
              <Plane className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              <span className="text-sm md:text-lg font-medium text-foreground">{terminal.name}</span>
            </div>
            <p className="text-2xl md:text-4xl font-display font-bold mb-1" style={{ color: terminal.color }}>{terminal.flights}</p>
            <p className="text-xs md:text-sm text-muted-foreground mb-2">vuelos 24h</p>
            <div className="flex items-center justify-center gap-1 text-primary font-bold mb-1">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">{terminal.passengers.toLocaleString()} pax</span>
            </div>
            <p className="text-[10px] text-muted-foreground">⏱ Retén ~{terminal.espera} min</p>
          </div>
        ))}
      </div>

      {/* Hourly Evolution Chart */}
      <div className="card-dashboard p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-foreground">Evolución por Hora - 24h</h3>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={chartType === "vuelos" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartType("vuelos")}
              className="text-xs h-7 px-3"
            >
              Vuelos
            </Button>
            <Button
              variant={chartType === "pasajeros" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartType("pasajeros")}
              className="text-xs h-7 px-3"
            >
              Pasajeros
            </Button>
          </div>
        </div>
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartType === "vuelos" ? "#F97316" : "#3B82F6"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartType === "vuelos" ? "#F97316" : "#3B82F6"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="hour" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(220, 10%, 55%)' }}
                interval={2}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(220, 10%, 55%)' }}
                tickFormatter={chartType === "pasajeros" ? (value) => `${(value / 1000).toFixed(0)}k` : undefined}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))'
                }}
                formatter={(value: number) => [
                  chartType === "vuelos" ? `${value} vuelos` : `${value.toLocaleString()} pasajeros`,
                  chartType === "vuelos" ? "Vuelos" : "Pasajeros"
                ]}
              />
              <Area 
                type="monotone" 
                dataKey={chartType} 
                name={chartType === "vuelos" ? "Vuelos" : "Pasajeros"}
                stroke={chartType === "vuelos" ? "#F97316" : "#3B82F6"} 
                strokeWidth={2}
                fill="url(#chartGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flights Table */}
      <div className="card-dashboard overflow-hidden">
        <div className="grid grid-cols-5 border-b border-border">
          {[
            { id: "all", label: "Todos", color: "border-primary" },
            { id: "t1", label: "T1", color: "border-blue-500" },
            { id: "t2", label: "T2", color: "border-emerald-500" },
            { id: "puente", label: "P. Aéreo", color: "border-purple-500" },
            { id: "t2c", label: "T2C", color: "border-orange-500" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTerminal(tab.id)}
              className={cn(
                "py-3 md:py-4 text-xs md:text-sm font-medium transition-colors border-b-2",
                selectedTerminal === tab.id 
                  ? `${tab.color} text-foreground bg-accent/30` 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/20"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {filteredFlights.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay vuelos para esta terminal
            </div>
          ) : (
            filteredFlights.map((flight, idx) => {
              const termType = getTerminalType(flight);
              const termColor = terminalStats.find(t => t.id === termType)?.color || "#666";
              const codigoPrincipal = flight.vuelo?.split("/")[0]?.trim() || flight.vuelo;
              const origenCorto = flight.origen?.split("(")[0]?.trim() || flight.origen;
              const paxEstimado = termType === 'puente' ? 150 : termType === 't2c' ? 180 : 200;
              
              return (
                <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 p-4 md:p-6 hover:bg-accent/30 transition-colors">
                  {/* Mobile: compact row */}
                  <div className="flex items-center gap-4 md:gap-6 flex-1">
                    {/* Arrow Icon */}
                    <div 
                      className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${termColor}15` }}
                    >
                      <ArrowDown className="h-4 w-4 md:h-5 md:w-5" style={{ color: termColor }} />
                    </div>

                    {/* Flight Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 md:gap-3 mb-1">
                        <span className="font-semibold text-foreground">{codigoPrincipal}</span>
                        <Badge 
                          className={cn(
                            "text-xs",
                            flight.estado?.toLowerCase().includes("aterriz") 
                              ? "status-landing" 
                              : "status-ontime"
                          )}
                        >
                          {flight.estado || "Programado"}
                        </Badge>
                        <span 
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{ 
                            backgroundColor: `${termColor}15`, 
                            color: termColor,
                          }}
                        >
                          {termType === 'puente' ? 'P.Aéreo' : termType.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{flight.aerolinea} • {origenCorto}</p>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 hidden md:block" />
                      <span className="font-mono text-lg text-foreground">{flight.hora}</span>
                    </div>
                  </div>

                  {/* Right side info */}
                  <div className="flex items-center gap-4 md:gap-6 ml-14 md:ml-0">
                    {/* Passengers */}
                    <div className="flex items-center gap-1 md:gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-primary font-bold">{paxEstimado}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">pax</span>
                    </div>
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
