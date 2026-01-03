import { Plane, Clock, Users } from "lucide-react";

interface Terminal {
  id: string;
  name: string;
  arrivals: number;
  passengers: string;
  color: string;
}

const terminals: Terminal[] = [
  { id: "t1", name: "T1", arrivals: 5, passengers: "1,070", color: "#3B82F6" },
  { id: "t2", name: "T2", arrivals: 4, passengers: "796", color: "#10B981" },
  { id: "puente", name: "P. Aéreo", arrivals: 6, passengers: "1,175", color: "#8B5CF6" },
  { id: "t2c", name: "T2C", arrivals: 8, passengers: "1,440", color: "#F97316" },
];

interface FlightsWidgetProps {
  expanded?: boolean;
}

export function FlightsWidget({ expanded = false }: FlightsWidgetProps) {
  return (
    <div className="card-dashboard p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-info/10">
            <Plane className="h-4 w-4 md:h-5 md:w-5 text-info" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm md:text-base">Llegadas Aeropuerto BCN</h3>
            <p className="text-xs md:text-sm text-muted-foreground">Próxima hora</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {terminals.map((terminal) => (
          <div 
            key={terminal.id}
            className="text-center p-3 md:p-4 rounded-xl border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-3">
              <Plane className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
              <span className="font-medium text-foreground text-xs md:text-sm">{terminal.name}</span>
            </div>
            
            <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: terminal.color, fontFamily: 'Space Grotesk' }}>{terminal.arrivals}</p>
            <p className="text-xs md:text-sm text-muted-foreground mb-2">vuelos</p>
            
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">{terminal.passengers}</span>
            </div>
          </div>
        ))}
      </div>

      {!expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs md:text-sm">
            <span className="text-muted-foreground">Hora punta estimada</span>
            <span className="font-semibold text-primary flex items-center gap-1">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              14:30 - 16:00
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
