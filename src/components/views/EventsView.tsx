import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  Music,
  Trophy,
  Building2,
  Palette,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { useEvents } from "@/hooks/useEvents";
import { motion, AnimatePresence } from "framer-motion";

// Clean category system - Spotify/Uber inspired minimal colors
const categories = {
  Congress: { icon: Building2, color: "#3B82F6", label: "Congresos" },
  Music: { icon: Music, color: "#8B5CF6", label: "Música" },
  Sports: { icon: Trophy, color: "#10B981", label: "Deportes" },
  Culture: { icon: Palette, color: "#F59E0B", label: "Cultura" },
  Other: { icon: Ticket, color: "#6B7280", label: "Otros" },
};

export function EventsView() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { events, loading } = useEvents();

  const filteredEvents = useMemo(() => {
    if (!selectedCategory) return events;
    return events.filter(e => e.type === selectedCategory);
  }, [events, selectedCategory]);

  const eventDatesMap = useMemo(() => {
    const map = new Map<string, typeof events>();
    events.forEach(event => {
      const dateMatch = event.date.match(/(\d+) de (\w+)/);
      if (dateMatch) {
        const monthNames: Record<string, number> = {
          enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
          julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
        };
        const day = parseInt(dateMatch[1]);
        const month = monthNames[dateMatch[2].toLowerCase()];
        const year = new Date().getFullYear();
        const dateKey = new Date(year, month, day).toDateString();
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)?.push(event);
      }
    });
    return map;
  }, [events]);

  const eventDates = useMemo(() =>
    Array.from(eventDatesMap.keys()).map(dateStr => new Date(dateStr)),
    [eventDatesMap]
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventDatesMap.get(selectedDate.toDateString()) || [];
  }, [selectedDate, eventDatesMap]);

  if (loading) {
    return (
      <div className="p-5 space-y-6">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-9 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - Uber style minimal */}
      <div className="px-5 pt-4 pb-2">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          Eventos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {events.length} eventos en Barcelona
        </p>
      </div>

      {/* Filter chips - Spotify style horizontal scroll */}
      <div className="px-5 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
              selectedCategory === null
                ? "bg-foreground text-background"
                : "bg-muted/60 text-foreground hover:bg-muted"
            )}
          >
            Todos
          </button>
          {Object.entries(categories).filter(([k]) => k !== "Other").map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2",
                selectedCategory === key
                  ? "text-white"
                  : "bg-muted/60 text-foreground hover:bg-muted"
              )}
              style={selectedCategory === key ? { backgroundColor: cat.color } : {}}
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar toggle - minimal */}
      <div className="px-5 pb-3">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors",
            showCalendar ? "text-primary" : "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {showCalendar ? "Ocultar calendario" : "Ver calendario"}
        </button>
      </div>

      {/* Collapsible Calendar - clean */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-y border-border/50"
          >
            <div className="p-5 bg-muted/20">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="mx-auto"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-3",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-semibold",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex justify-between",
                  head_cell: "text-muted-foreground w-9 font-medium text-xs",
                  row: "flex w-full justify-between mt-1",
                  cell: "h-9 w-9 text-center text-sm p-0 relative",
                  day: "h-9 w-9 p-0 font-normal rounded-full hover:bg-muted transition-colors",
                  day_selected: "bg-foreground text-background hover:bg-foreground",
                  day_today: "bg-primary/10 text-primary font-semibold",
                }}
                modifiers={{ hasEvent: eventDates }}
                modifiersStyles={{
                  hasEvent: { fontWeight: '700', textDecoration: 'underline', textUnderlineOffset: '3px' }
                }}
              />

              {/* Selected day events */}
              {selectedDayEvents.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {selectedDayEvents.slice(0, 3).map(event => {
                    const cat = categories[event.type as keyof typeof categories] || categories.Other;
                    return (
                      <button
                        key={event.id}
                        onClick={() => window.open(event.url_ticket, "_blank")}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-background hover:bg-muted/50 transition-colors text-left"
                      >
                        <div
                          className="w-1 h-10 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.time}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events list - Gridwise/Uber clean cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-3 pb-28">
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event, idx) => {
              const cat = categories[event.type as keyof typeof categories] || categories.Other;
              const Icon = cat.icon;
              const dayNum = event.date.match(/\d+/)?.[0] || "";
              const monthShort = event.date.split(' ')[2]?.slice(0, 3).toUpperCase() || "";

              return (
                <motion.button
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  onClick={() => window.open(event.url_ticket, "_blank")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 hover:border-border hover:shadow-sm active:scale-[0.98] transition-all duration-200 text-left"
                >
                  {/* Date block */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="text-2xl font-bold text-foreground leading-none">{dayNum}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mt-1">{monthShort}</p>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-12 bg-border/60" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Category tag */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3" style={{ color: cat.color }} />
                      <span className="text-[11px] font-semibold" style={{ color: cat.color }}>
                        {cat.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1">
                      {event.title}
                    </h3>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
                        {event.attendees >= 1000
                          ? `${(event.attendees / 1000).toFixed(0)}k`
                          : event.attendees}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                        <Users className="h-2.5 w-2.5" />
                        est.
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {filteredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <CalendarIcon className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-base font-semibold text-foreground">Sin eventos</p>
              <p className="text-sm text-muted-foreground mt-1">No hay eventos en esta categoría</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
