import { useState } from "react";
import { Plane, Clock, Users, ArrowDown, ArrowLeft, BarChart3 } from "lucide-react";
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

const terminalInfo: Record<string, { name: string; color: string; flights: number; passengers: string }> = {
  t1: { name: "Terminal 1", color: "#3B82F6", flights: 5, passengers: "1,070" },
  t2: { name: "Terminal 2", color: "#10B981", flights: 4, passengers: "796" },
  puente: { name: "Puente Aéreo", color: "#8B5CF6", flights: 6, passengers: "1,175" },
  t2c: { name: "T2C EasyJet", color: "#F97316", flights: 8, passengers: "1,440" },
};

const flightsData: Record<string, Array<{ flight: string; origin: string; status: string; time: string; aircraft: string; passengers: number }>> = {
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

const hourlyDataByTerminal: Record<string, Array<{ hour: string; vuelos: number; pasajeros: number }>> = {
  t1: [
    { hour: "06:00", vuelos: 2, pasajeros: 350 },
    { hour: "07:00", vuelos: 3, pasajeros: 520 },
    { hour: "08:00", vuelos: 5, pasajeros: 890 },
    { hour: "09:00", vuelos: 6, pasajeros: 1070 },
    { hour: "10:00", vuelos: 4, pasajeros: 720 },
    { hour: "11:00", vuelos: 3, pasajeros: 510 },
    { hour: "12:00", vuelos: 4, pasajeros: 680 },
    { hour: "13:00", vuelos: 5, pasajeros: 850 },
    { hour: "14:00", vuelos: 6, pasajeros: 1020 },
    { hour: "15:00", vuelos: 5, pasajeros: 870 },
    { hour: "16:00", vuelos: 3, pasajeros: 540 },
    { hour: "17:00", vuelos: 4, pasajeros: 680 },
    { hour: "18:00", vuelos: 5, pasajeros: 890 },
    { hour: "19:00", vuelos: 6, pasajeros: 1050 },
    { hour: "20:00", vuelos: 4, pasajeros: 720 },
    { hour: "21:00", vuelos: 3, pasajeros: 510 },
    { hour: "22:00", vuelos: 2, pasajeros: 360 },
  ],
  t2: [
    { hour: "06:00", vuelos: 1, pasajeros: 180 },
    { hour: "07:00", vuelos: 2, pasajeros: 360 },
    { hour: "08:00", vuelos: 3, pasajeros: 540 },
    { hour: "09:00", vuelos: 4, pasajeros: 796 },
    { hour: "10:00", vuelos: 2, pasajeros: 380 },
    { hour: "11:00", vuelos: 2, pasajeros: 340 },
    { hour: "12:00", vuelos: 3, pasajeros: 510 },
    { hour: "13:00", vuelos: 3, pasajeros: 540 },
    { hour: "14:00", vuelos: 4, pasajeros: 720 },
    { hour: "15:00", vuelos: 3, pasajeros: 560 },
    { hour: "16:00", vuelos: 2, pasajeros: 380 },
    { hour: "17:00", vuelos: 3, pasajeros: 510 },
    { hour: "18:00", vuelos: 4, pasajeros: 680 },
    { hour: "19:00", vuelos: 4, pasajeros: 720 },
    { hour: "20:00", vuelos: 3, pasajeros: 540 },
    { hour: "21:00", vuelos: 2, pasajeros: 360 },
    { hour: "22:00", vuelos: 1, pasajeros: 180 },
  ],
  puente: [
    { hour: "06:00", vuelos: 2, pasajeros: 360 },
    { hour: "07:00", vuelos: 4, pasajeros: 720 },
    { hour: "08:00", vuelos: 6, pasajeros: 1080 },
    { hour: "09:00", vuelos: 6, pasajeros: 1175 },
    { hour: "10:00", vuelos: 4, pasajeros: 720 },
    { hour: "11:00", vuelos: 3, pasajeros: 540 },
    { hour: "12:00", vuelos: 4, pasajeros: 720 },
    { hour: "13:00", vuelos: 5, pasajeros: 900 },
    { hour: "14:00", vuelos: 6, pasajeros: 1080 },
    { hour: "15:00", vuelos: 5, pasajeros: 900 },
    { hour: "16:00", vuelos: 4, pasajeros: 720 },
    { hour: "17:00", vuelos: 4, pasajeros: 720 },
    { hour: "18:00", vuelos: 5, pasajeros: 900 },
    { hour: "19:00", vuelos: 6, pasajeros: 1080 },
    { hour: "20:00", vuelos: 5, pasajeros: 900 },
    { hour: "21:00", vuelos: 3, pasajeros: 540 },
    { hour: "22:00", vuelos: 2, pasajeros: 360 },
  ],
  t2c: [
    { hour: "06:00", vuelos: 2, pasajeros: 372 },
    { hour: "07:00", vuelos: 4, pasajeros: 744 },
    { hour: "08:00", vuelos: 6, pasajeros: 1116 },
    { hour: "09:00", vuelos: 8, pasajeros: 1440 },
    { hour: "10:00", vuelos: 5, pasajeros: 930 },
    { hour: "11:00", vuelos: 3, pasajeros: 558 },
    { hour: "12:00", vuelos: 4, pasajeros: 744 },
    { hour: "13:00", vuelos: 5, pasajeros: 930 },
    { hour: "14:00", vuelos: 7, pasajeros: 1302 },
    { hour: "15:00", vuelos: 6, pasajeros: 1116 },
    { hour: "16:00", vuelos: 4, pasajeros: 744 },
    { hour: "17:00", vuelos: 5, pasajeros: 930 },
    { hour: "18:00", vuelos: 6, pasajeros: 1116 },
    { hour: "19:00", vuelos: 7, pasajeros: 1302 },
    { hour: "20:00", vuelos: 5, pasajeros: 930 },
    { hour: "21:00", vuelos: 4, pasajeros: 744 },
    { hour: "22:00", vuelos: 2, pasajeros: 372 },
  ],
};

export function TerminalDetailView({ terminalId, onBack }: TerminalDetailViewProps) {
  const [chartType, setChartType] = useState<"vuelos" | "pasajeros">("vuelos");
  const terminal = terminalInfo[terminalId];
  const flights = flightsData[terminalId] || [];
  const hourlyData = hourlyDataByTerminal[terminalId] || [];

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
            <p className="text-sm text-muted-foreground">Llegadas próxima hora</p>
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
            {terminal.flights}
          </p>
        </div>
        <div className="card-dashboard p-4 md:p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-muted-foreground text-sm">Pasajeros</span>
          </div>
          <p className="text-3xl md:text-4xl font-display font-bold text-primary">
            {terminal.passengers}
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
        <div className="divide-y divide-border">
          {flights.map((flight, idx) => (
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

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 hidden md:block" />
                  <span className="font-mono text-lg text-foreground">{flight.time}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 md:gap-6 ml-14 md:ml-0">
                <div className="text-left hidden sm:block">
                  <p className="text-xs text-muted-foreground">Avión</p>
                  <p className="text-sm font-medium text-primary">{flight.aircraft}</p>
                </div>

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
