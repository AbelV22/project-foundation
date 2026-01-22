import { Calendar, MapPin, Users, ChevronRight, Clock, Music, Trophy, Building2, Palette, Ticket } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";

// Consistent with EventsView - clean category system
const categories = {
  Congress: { icon: Building2, color: "#3B82F6", label: "Congresos" },
  Music: { icon: Music, color: "#8B5CF6", label: "Música" },
  Sports: { icon: Trophy, color: "#10B981", label: "Deportes" },
  Culture: { icon: Palette, color: "#F59E0B", label: "Cultura" },
  Other: { icon: Ticket, color: "#6B7280", label: "Otros" },
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
      <div className="p-4 space-y-3">
        <div className="h-5 w-28 bg-muted rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Compact mode for dashboard - clean minimal cards
  if (compact) {
    return (
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Eventos</span>
            <span className="text-xs text-muted-foreground">({events.length})</span>
          </div>
          <button
            onClick={onViewAllClick}
            className="text-xs font-medium text-primary flex items-center gap-0.5"
          >
            Ver todos
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Compact event cards */}
        <div className="space-y-2">
          {displayEvents.map((event) => {
            const cat = categories[event.type as keyof typeof categories] || categories.Other;
            const Icon = cat.icon;
            const dayNum = event.date.match(/\d+/)?.[0] || "";

            return (
              <button
                key={event.id}
                onClick={() => window.open(event.url_ticket, "_blank")}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
              >
                {/* Date */}
                <div className="flex-shrink-0 w-10 text-center">
                  <p className="text-lg font-bold text-foreground leading-none">{dayNum}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                    {event.date.split(' ')[2]?.slice(0, 3)}
                  </p>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Icon className="h-2.5 w-2.5" style={{ color: cat.color }} />
                    <span className="text-[10px] font-medium" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {event.time}
                    <span className="mx-1">·</span>
                    <MapPin className="h-2.5 w-2.5" />
                    <span className="truncate">{event.location}</span>
                  </p>
                </div>

                {/* Attendance */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-[10px] font-bold text-foreground tabular-nums">
                    {event.attendees >= 1000 ? `${(event.attendees / 1000).toFixed(0)}k` : event.attendees}
                  </p>
                  <p className="text-[9px] text-muted-foreground">est.</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard/expanded mode - clean cards
  return (
    <div className="p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onViewAllClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold text-foreground text-left">Eventos</h3>
            <p className="text-xs text-muted-foreground">{events.length} en Barcelona</p>
          </div>
        </button>
        {!expanded && (
          <button
            onClick={onViewAllClick}
            className="flex items-center gap-1 text-sm font-medium text-primary"
          >
            Ver todos
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Event cards */}
      <div className="space-y-2">
        {displayEvents.map((event) => {
          const cat = categories[event.type as keyof typeof categories] || categories.Other;
          const Icon = cat.icon;
          const dayNum = event.date.match(/\d+/)?.[0] || "";
          const monthShort = event.date.split(' ')[2]?.slice(0, 3).toUpperCase() || "";

          return (
            <button
              key={event.id}
              onClick={() => window.open(event.url_ticket, "_blank")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/50 hover:border-border hover:bg-muted/30 active:scale-[0.98] transition-all text-left"
            >
              {/* Date block */}
              <div className="flex-shrink-0 w-12 text-center">
                <p className="text-xl font-bold text-foreground leading-none">{dayNum}</p>
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mt-0.5">{monthShort}</p>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-border/60" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3 w-3" style={{ color: cat.color }} />
                  <span className="text-[11px] font-semibold" style={{ color: cat.color }}>
                    {cat.label}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-foreground truncate">{event.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{event.location}</span>
                  </span>
                </div>
              </div>

              {/* Attendance + Arrow */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-bold text-foreground tabular-nums">
                    {event.attendees >= 1000 ? `${(event.attendees / 1000).toFixed(0)}k` : event.attendees}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                    <Users className="h-2.5 w-2.5" />
                    est.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
