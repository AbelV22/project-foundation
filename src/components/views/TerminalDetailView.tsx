import { useState, useEffect } from "react";
import { Plane, Clock, Users, ArrowDown, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { DashboardData, Vuelo } from "./DashboardView";

interface TerminalDetailViewProps {
  terminalId: string;
  onBack: () => void;
}

const terminalConfig: Record<string, { name: string; color: string }> = {
  t1: { name: "Terminal 1", color: "#3B82F6" },
  t2: { name: "Terminal 2", color: "#10B981" },
  puente: { name: "Puente Aéreo", color: "#8B5CF6" },
  t2c: { name: "T2C EasyJet", color: "#F97316" },
};

export function TerminalDetailView({ terminalId, onBack }: TerminalDetailViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"vuelos" | "pasajeros">("pasajeros");

  useEffect(() => {
    fetch("/data.json?t=" + Date.now())
      .then((res) => res.json())
      .then((jsonData) => {
        setData(jsonData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando data.json:", err);
        setLoading(false);
      });
  }, []);

  const terminal = terminalConfig[terminalId];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-blue-500 font-bold animate-pulse">Cargando terminal...</div>
      </div>
    );
  }

  if (!terminal || !data) {
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

  // Get terminal stats
  const terminalKey = terminalId as keyof typeof data.resumen_cards;
  const stats = data.resumen_cards[terminalKey] || { vuelos: 0, pax: 0 };

  // Filter flights by terminal
  const filterFlights = (vuelos: Vuelo[]) => {
    return vuelos.filter(v => {
      const term = v.terminal.toLowerCase();
      if (terminalId === "t1") return term.includes("t1") || term === "tt1";
      if (terminalId === "t2") return term === "t2" && !v.es_t2c;
      if (terminalId === "puente") return v.es_puente || term.includes("puente");
      if (terminalId === "t2c") return v.es_t2c || term.includes("t2c");
      return false;
    });
  };

  const flights = filterFlights(data.vuelos).slice(0, 15);

  // Create hourly data for this terminal
  const hourlyData = data.grafica.map(item => {
    // Estimate terminal's portion based on its share of total flights
    const totalFlights = data.meta.total_vuelos || 1;
    const terminalShare = stats.vuelos / totalFlights;
    const pax = Math.round(item.pax * terminalShare);
    return {
      hour: `${item.name}:00`,
      pasajeros: pax,
      vuelos: Math.max(1, Math.round(pax / 160))
    };
  });

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
            <p className="text-sm text-muted-foreground">Llegadas de hoy</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-dashboard p-4 md:p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Plane className="h-5 w-5" style={{ color: terminal.color }} />
            <span className="text-muted-foreground text-sm">Vuelos</span>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold" style={{ color: terminal.color }}>
            {stats.vuelos}
          </p>
        </div>
        <div className="card-dashboard p-4 md:p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-muted-foreground text-sm">Pasajeros</span>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold text-primary">
            {stats.pax.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card-dashboard p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Evolución por Hora - Hoy
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
              No hay vuelos para esta terminal
            </div>
          ) : (
            flights.map((flight, idx) => (
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
                      <span className="font-semibold text-foreground">{flight.id}</span>
                      <Badge 
                        className={cn(
                          "text-xs",
                          flight.estado === "Aterrizando" 
                            ? "status-landing" 
                            : "status-ontime"
                        )}
                      >
                        {flight.estado}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{flight.aerolinea} • {flight.origen}</p>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 hidden md:block" />
                    <span className="font-mono text-lg text-foreground">{flight.hora}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6 ml-14 md:ml-0">
                  {flight.avion && flight.avion !== "None" && (
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-muted-foreground">Avión</p>
                      <p className="text-sm font-medium text-primary">{flight.avion}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1 md:gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-primary font-bold">{flight.pax}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">pax</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}