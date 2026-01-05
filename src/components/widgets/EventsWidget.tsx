import { Calendar, MapPin, Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Event {
  id: string;
  title: string;
  location: string;
  date: string;
  time: string;
  attendees: number;
  type: "Deportes" | "Música" | "Tecnología" | "Cultura";
}

const upcomingEvents: Event[] = [
  {
    id: "3",
    title: "Mobile World Congress",
    location: "Fira Gran Via",
    date: "lunes, 26 de febrero",
    time: "09:00h",
    attendees: 100000,
    type: "Tecnología",
  },
  {
    id: "1",
    title: "FC Barcelona vs Real Madrid",
    location: "Camp Nou",
    date: "viernes, 15 de marzo",
    time: "21:00h",
    attendees: 98000,
    type: "Deportes",
  },
  {
    id: "2",
    title: "Primavera Sound 2024",
    location: "Parc del Fòrum",
    date: "sábado, 1 de junio",
    time: "16:00h",
    attendees: 65000,
    type: "Música",
  },
];

const typeColors: Record<string, string> = {
  Deportes: "bg-success/20 text-success border border-success/30",
  Música: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  Tecnología: "bg-info/20 text-info border border-info/30",
  Cultura: "bg-primary/20 text-primary border border-primary/30",
};

interface EventsWidgetProps {
  expanded?: boolean;
  limit?: number;
  onViewAllClick?: () => void;
  compact?: boolean;
}

export function EventsWidget({ expanded = false, limit = 3, onViewAllClick, compact = false }: EventsWidgetProps) {
  const displayEvents = expanded ? upcomingEvents : upcomingEvents.slice(0, compact ? 2 : limit);

  // Modo compacto para el dashboard
  if (compact) {
    return (
      <div className="card-dashboard p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
              <Calendar className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground text-xs">Eventos BCN</h3>
              <p className="text-[10px] text-muted-foreground">Próximos</p>
            </div>
          </div>
          <button 
            onClick={onViewAllClick}
            className="text-[10px] text-primary hover:underline"
          >
            Ver →
          </button>
        </div>
        <div className="space-y-1">
          {displayEvents.map((event) => (
            <div 
              key={event.id}
              className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30 text-xs"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge className={`${typeColors[event.type]} text-[9px] px-1 py-0`}>
                  {event.type.slice(0, 3)}
                </Badge>
                <span className="truncate text-foreground text-[10px]">{event.title}</span>
              </div>
              <div className="flex items-center gap-1 text-purple-400 ml-1">
                <Users className="h-3 w-3" />
                <span className="font-medium text-[10px]">{(event.attendees / 1000).toFixed(0)}k</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-dashboard p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div 
          className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onViewAllClick}
        >
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <Calendar className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm md:text-base">Eventos Barcelona</h3>
            <p className="text-xs md:text-sm text-muted-foreground">Próximos eventos</p>
          </div>
        </div>
        {!expanded && (
          <button 
            onClick={onViewAllClick}
            className="flex items-center gap-1 text-xs md:text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Ver todos
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 md:space-y-3">
        {displayEvents.map((event) => (
          <div 
            key={event.id}
            className="flex items-start justify-between p-3 md:p-4 rounded-xl border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <Badge className={`${typeColors[event.type]} text-xs`}>
                  {event.type}
                </Badge>
              </div>
              
              <h4 className="font-medium text-foreground text-sm md:text-base mb-1 md:mb-2 truncate">{event.title}</h4>
              
              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                  {event.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                  {event.date}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-primary ml-2">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="font-medium text-xs md:text-sm">{event.attendees.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
