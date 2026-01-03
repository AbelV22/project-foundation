import { useState } from "react";
import { Plane, Clock, Users, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const terminalStats = [
  { id: "t1", name: "T1", flights: 5, passengers: "1,070", color: "#3B82F6" },
  { id: "t2", name: "T2", flights: 4, passengers: "796", color: "#10B981" },
  { id: "puente", name: "Puente Aéreo", flights: 6, passengers: "1,175", color: "#8B5CF6" },
  { id: "t2c", name: "T2C EasyJet", flights: 8, passengers: "1,440", color: "#F97316" },
];

const flightsData = {
  t1: [
    { flight: "IB2341", origin: "Madrid", status: "Aterrizando", time: "08:15", aircraft: "Airbus A321", passengers: 220 },
    { flight: "VY1234", origin: "París CDG", status: "En hora", time: "08:45", aircraft: "Airbus A320", passengers: 180 },
    { flight: "BA478", origin: "Londres LHR", status: "En hora", time: "09:00", aircraft: "Boeing 777", passengers: 350 },
    { flight: "LH1138", origin: "Frankfurt", status: "En hora", time: "09:30", aircraft: "Airbus A319", passengers: 140 },
  ],
  t2: [
    { flight: "FR8921", origin: "Milán BGY", status: "En hora", time: "08:30", aircraft: "Boeing 737", passengers: 189 },
    { flight: "W64521", origin: "Budapest", status: "En hora", time: "09:15", aircraft: "Airbus A321", passengers: 220 },
  ],
  puente: [
    { flight: "IB3124", origin: "Madrid", status: "Aterrizando", time: "08:00", aircraft: "Airbus A320", passengers: 180 },
    { flight: "VY1001", origin: "Madrid", status: "En hora", time: "08:30", aircraft: "Airbus A320", passengers: 180 },
    { flight: "IB3126", origin: "Madrid", status: "En hora", time: "09:00", aircraft: "Airbus A321", passengers: 220 },
  ],
  t2c: [
    { flight: "U28921", origin: "Londres LGW", status: "En hora", time: "08:20", aircraft: "Airbus A320", passengers: 186 },
    { flight: "U21234", origin: "Berlín", status: "Aterrizando", time: "08:35", aircraft: "Airbus A320", passengers: 180 },
    { flight: "U28756", origin: "Ámsterdam", status: "En hora", time: "09:10", aircraft: "Airbus A320", passengers: 186 },
    { flight: "U22345", origin: "París ORY", status: "En hora", time: "09:45", aircraft: "Airbus A321neo", passengers: 235 },
  ],
};

// Hourly evolution data
const hourlyData = [
  { hour: "06:00", vuelos: 8, pasajeros: 1200 },
  { hour: "07:00", vuelos: 12, pasajeros: 2100 },
  { hour: "08:00", vuelos: 18, pasajeros: 3200 },
  { hour: "09:00", vuelos: 22, pasajeros: 3800 },
  { hour: "10:00", vuelos: 15, pasajeros: 2600 },
  { hour: "11:00", vuelos: 10, pasajeros: 1800 },
  { hour: "12:00", vuelos: 14, pasajeros: 2400 },
  { hour: "13:00", vuelos: 16, pasajeros: 2800 },
  { hour: "14:00", vuelos: 20, pasajeros: 3500 },
  { hour: "15:00", vuelos: 18, pasajeros: 3100 },
  { hour: "16:00", vuelos: 12, pasajeros: 2100 },
  { hour: "17:00", vuelos: 14, pasajeros: 2400 },
  { hour: "18:00", vuelos: 19, pasajeros: 3300 },
  { hour: "19:00", vuelos: 21, pasajeros: 3600 },
  { hour: "20:00", vuelos: 16, pasajeros: 2800 },
  { hour: "21:00", vuelos: 11, pasajeros: 1900 },
  { hour: "22:00", vuelos: 8, pasajeros: 1400 },
  { hour: "23:00", vuelos: 5, pasajeros: 900 },
];

export function FlightsView() {
  const [selectedTerminal, setSelectedTerminal] = useState("t1");
  const [chartType, setChartType] = useState<"vuelos" | "pasajeros">("vuelos");

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
            <p className="text-xs md:text-sm text-muted-foreground mb-2">vuelos próxima hora</p>
            <div className="flex items-center justify-center gap-1 text-primary font-bold">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">{terminal.passengers} pasajeros</span>
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
                interval="preserveStartEnd"
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
        <div className="grid grid-cols-4 border-b border-border">
          {[
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

        <div className="divide-y divide-border">
          {(flightsData[selectedTerminal] || []).map((flight, idx) => (
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
                    <span className="font-semibold text-foreground">{flight.flight}</span>
                    <Badge 
                      className={cn(
                        "text-xs",
                        flight.status === "Aterrizando" 
                          ? "status-landing" 
                          : "status-ontime"
                      )}
                    >
                      {flight.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{flight.origin}</p>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 hidden md:block" />
                  <span className="font-mono text-lg text-foreground">{flight.time}</span>
                </div>
              </div>

              {/* Right side info */}
              <div className="flex items-center gap-4 md:gap-6 ml-14 md:ml-0">
                {/* Aircraft - hidden on small mobile */}
                <div className="text-left hidden sm:block">
                  <p className="text-xs text-muted-foreground">Avión</p>
                  <p className="text-sm font-medium text-primary">{flight.aircraft}</p>
                </div>

                {/* Passengers */}
                <div className="flex items-center gap-1 md:gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-primary font-bold">{flight.passengers}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">pasajeros</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
