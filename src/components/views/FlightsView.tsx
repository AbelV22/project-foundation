import { useState, useEffect } from "react";
import { Plane, Clock, Users, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { DashboardData, Vuelo } from "./DashboardView";

export function FlightsView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState("all");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-blue-500 font-bold animate-pulse">Cargando vuelos...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>No hay datos de vuelos disponibles.</p>
      </div>
    );
  }

  // Prepare terminal stats from real data
  const terminalStats = [
    { id: "t1", name: "T1", flights: data.resumen_cards.t1.vuelos, passengers: data.resumen_cards.t1.pax.toLocaleString(), color: "#3B82F6" },
    { id: "t2", name: "T2", flights: data.resumen_cards.t2.vuelos, passengers: data.resumen_cards.t2.pax.toLocaleString(), color: "#10B981" },
    { id: "puente", name: "Puente Aéreo", flights: data.resumen_cards.puente.vuelos, passengers: data.resumen_cards.puente.pax.toLocaleString(), color: "#8B5CF6" },
    { id: "t2c", name: "T2C EasyJet", flights: data.resumen_cards.t2c.vuelos, passengers: data.resumen_cards.t2c.pax.toLocaleString(), color: "#F97316" },
  ];

  // Transform grafica data for the chart
  const hourlyData = data.grafica.map(item => ({
    hour: `${item.name}:00`,
    pasajeros: item.pax,
    vuelos: Math.round(item.pax / 160) // Estimate flights from passengers
  }));

  // Filter flights by terminal
  const filterFlights = (vuelos: Vuelo[]) => {
    if (selectedTerminal === "all") return vuelos;
    
    return vuelos.filter(v => {
      const term = v.terminal.toLowerCase();
      if (selectedTerminal === "t1") return term.includes("t1") || term === "tt1";
      if (selectedTerminal === "t2") return term === "t2" && !v.es_t2c;
      if (selectedTerminal === "puente") return v.es_puente || term.includes("puente");
      if (selectedTerminal === "t2c") return v.es_t2c || term.includes("t2c");
      return false;
    });
  };

  const filteredFlights = filterFlights(data.vuelos).slice(0, 20);

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
            <p className="text-xs md:text-sm text-muted-foreground mb-2">vuelos hoy</p>
            <div className="flex items-center justify-center gap-1 text-primary font-bold">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">{terminal.passengers} pax</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hourly Evolution Chart */}
      <div className="card-dashboard p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-foreground">Evolución por Hora - Hoy</h3>
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
            filteredFlights.map((flight, idx) => (
              <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 p-4 md:p-6 hover:bg-accent/30 transition-colors">
                {/* Mobile: compact row */}
                <div className="flex items-center gap-4 md:gap-6 flex-1">
                  {/* Arrow Icon */}
                  <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-accent flex-shrink-0">
                    <ArrowDown className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  </div>

                  {/* Flight Info */}
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
                      <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                        {flight.terminal}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{flight.aerolinea} • {flight.origen}</p>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 hidden md:block" />
                    <span className="font-mono text-lg text-foreground">{flight.hora}</span>
                  </div>
                </div>

                {/* Right side info */}
                <div className="flex items-center gap-4 md:gap-6 ml-14 md:ml-0">
                  {/* Aircraft - hidden on small mobile */}
                  {flight.avion && flight.avion !== "None" && (
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-muted-foreground">Avión</p>
                      <p className="text-sm font-medium text-primary">{flight.avion}</p>
                    </div>
                  )}

                  {/* Passengers */}
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