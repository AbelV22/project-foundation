import { Calendar, MapPin, Users, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEvents, FormattedEvent } from "@/hooks/useEvents";

const typeColors: Record<string, string> = {
  Congress: "bg-info/20 text-info border border-info/30",
  Music: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  Sports: "bg-success/20 text-success border border-success/30",
  Culture: "bg-primary/20 text-primary border border-primary/30",
  Other: "bg-muted text-muted-foreground border border-border",
};

const typeLabels: Record<string, string> = {
  Congress: "Congreso",
  Music: "Música",
  Sports: "Deportes",
  Culture: "Cultura",
  Other: "Otro",
};

interface EventsWidgetProps {
  expanded?: boolean;
  limit?: number;
  onViewAllClick?: () => void;
  compact?: boolean;
}

export function EventsWidget({ expanded = false, limit = 3, onViewAllClick, compact = false }: EventsWidgetProps) {
  const { events, loading } = useEvents();
  
  const displayEvents = expanded ? events : events.slice(0, compact ? 2 : limit);

  if (loading) {
    return (
      <div className="card-dashboard p-4 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

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
              className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => window.open(event.url_ticket, "_blank")}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge className={`${typeColors[event.type]} text-[9px] px-1 py-0`}>
                  {typeLabels[event.type]?.slice(0, 3) || "Otr"}
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
            <p className="text-xs md:text-sm text-muted-foreground">Próximos eventos ({events.length} totales)</p>
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
            className="flex items-start justify-between p-3 md:p-4 rounded-xl border border-border hover:border-primary/30 transition-colors cursor-pointer group"
            onClick={() => window.open(event.url_ticket, "_blank")}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <Badge className={`${typeColors[event.type]} text-xs`}>
                  {typeLabels[event.type] || event.categoria}
                </Badge>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <h4 className="font-medium text-foreground text-sm md:text-base mb-1 md:mb-2 line-clamp-2">{event.title}</h4>
              
              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                  {event.date}
                </span>
                <span className="flex items-center gap-1">
                  🕐 {event.time} - {event.endTime}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                  {event.location}
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
