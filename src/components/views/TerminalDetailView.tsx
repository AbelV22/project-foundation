import { useState, useEffect } from "react";
import { Plane, Clock, Users, ArrowDown, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

interface TerminalDetailViewProps {
  terminalId: string;
  onBack: () => void;
}

// Tipos para vuelos.json
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
  t1: { name: "Terminal 1", color: "#3B82F6" },
  t2: { name: "Terminal 2", color: "#10B981" },
  puente: { name: "Puente Aéreo", color: "#8B5CF6" },
  t2c: { name: "T2C EasyJet", color: "#F97316" },
};

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
  
  if (terminal.includes("T2C") || terminal.includes("EASYJET")) {
    return "t2c";
  }
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) {
    return "t2c";
  }
  
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) {
    return "puente";
  }
  
  if (terminal.includes("T2A") || terminal.includes("T2B")) {
    return "t2";
  }
  
  if (terminal.includes("T1")) {
    return "t1";
  }
  
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

export function TerminalDetailView({ terminalId, onBack }: TerminalDetailViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"vuelos" | "pasajeros">("vuelos");

  const fetchData = () => {
    fetch("/vuelos.json?t=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        console.log("📡 TerminalDetail - Vuelos cargados:", data?.length || 0);
        setVuelos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando vuelos.json:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh cada 2 horas
    const interval = setInterval(fetchData, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const terminal = terminalConfig[terminalId];
  const currentHour = new Date().getHours();

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

  // Filtrar vuelos de esta terminal
  const terminalFlights = vuelosSorted.filter(v => getTerminalType(v) === terminalId);

  // Calcular estadísticas
  const paxPerFlight = terminalId === 'puente' ? 150 : terminalId === 't2c' ? 180 : 200;
  const totalPax = terminalFlights.length * paxPerFlight;
  const espera = getEsperaReten(terminalId, currentHour);

  // Crear datos horarios para gráfica - empezar 1 hora antes de la actual
  const startHour = (currentHour - 1 + 24) % 24;
  const hourlyGroups: Record<number, { vuelos: number; pax: number }> = {};
  
  // Crear 24 horas empezando desde startHour
  for (let i = 0; i < 24; i++) {
    const h = (startHour + i) % 24;
    hourlyGroups[h] = { vuelos: 0, pax: 0 };
  }
  
  terminalFlights.forEach(v => {
    const hora = parseInt(v.hora?.split(":")[0] || "0", 10);
    if (hourlyGroups[hora] !== undefined) {
      hourlyGroups[hora].vuelos += 1;
      hourlyGroups[hora].pax += paxPerFlight;
    }
  });

  // Ordenar datos desde startHour
  const hourlyData = [];
  for (let i = 0; i < 24; i++) {
    const h = (startHour + i) % 24;
    hourlyData.push({
      hour: `${String(h).padStart(2, '0')}:00`,
      vuelos: hourlyGroups[h].vuelos,
      pasajeros: hourlyGroups[h].pax
    });
  }

  // Vuelos no finalizados para mostrar
  const flights = terminalFlights.filter(v => {
    const estado = v.estado?.toLowerCase() || "";
    return !estado.includes("finalizado");
  }).slice(0, 15);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div 
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${terminal.color}20` }}
          >
            <Plane className="h-6 w-6" style={{ color: terminal.color }} />
          </div>
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">{terminal.name}</h1>
            <p className="text-sm text-muted-foreground">Llegadas próximas 24h</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-dashboard p-4 md:p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Plane className="h-5 w-5" style={{ color: terminal.color }} />
            <span className="text-muted-foreground text-xs">Vuelos</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-bold" style={{ color: terminal.color }}>
            {terminalFlights.length}
          </p>
        </div>
        <div className="card-dashboard p-4 md:p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-muted-foreground text-xs">Pasajeros</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-bold text-primary">
            {totalPax.toLocaleString()}
          </p>
        </div>
        <div className="card-dashboard p-4 md:p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-muted-foreground text-xs">Retén</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-bold text-amber-500">
            ~{espera}'
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card-dashboard p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Evolución por Hora
          </h3>
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
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id={`gradient-${terminalId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={terminal.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={terminal.color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="hour" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(220, 10%, 55%)' }}
                interval={3}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(220, 10%, 55%)' }}
                tickFormatter={chartType === "pasajeros" ? (value) => `${(value / 1000).toFixed(1)}k` : undefined}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(220, 25%, 10%)',
                  border: '1px solid hsl(220, 15%, 18%)',
                  borderRadius: '8px',
                  color: 'white'
                }}
                formatter={(value: number) => [
                  chartType === "vuelos" ? `${value} vuelos` : `${value.toLocaleString()} pasajeros`,
                  chartType === "vuelos" ? "Vuelos" : "Pasajeros"
                ]}
              />
              <Area 
                type="monotone" 
                dataKey={chartType} 
                stroke={terminal.color} 
                strokeWidth={2}
                fill={`url(#gradient-${terminalId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flights List */}
      <div className="card-dashboard">
        <div className="p-4 md:p-6 border-b border-border">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Próximos Vuelos
          </h3>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {flights.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay vuelos pendientes para esta terminal
            </div>
          ) : (
            flights.map((flight, idx) => {
              const codigoPrincipal = flight.vuelo?.split("/")[0]?.trim() || flight.vuelo;
              const origenCorto = flight.origen?.split("(")[0]?.trim() || flight.origen;
              
              return (
                <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 p-4 md:p-6 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-4 md:gap-6 flex-1">
                    <div 
                      className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${terminal.color}15` }}
                    >
                      <ArrowDown className="h-4 w-4 md:h-5 md:w-5" style={{ color: terminal.color }} />
                    </div>

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
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{origenCorto}</p>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 hidden md:block" />
                      <span className="font-mono text-lg text-foreground">{flight.hora}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 md:gap-6 ml-14 md:ml-0">
                    <div className="flex items-center gap-1 md:gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-primary font-bold">{paxPerFlight}</span>
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
