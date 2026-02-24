import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Clock,
  Music,
  Trophy,
  Building2,
  Palette,
  Ticket,
  Navigation,
  TrendingUp,
  AlertCircle,
  MapIcon,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { useEvents } from "@/hooks/useEvents";
import { motion, AnimatePresence } from "framer-motion";

const categories = {
  Congress: { icon: Building2, color: "#3B82F6", label: "Congresos" },
  Music: { icon: Music, color: "#8B5CF6", label: "Música" },
  Sports: { icon: Trophy, color: "#10B981", label: "Deportes" },
  Culture: { icon: Palette, color: "#F59E0B", label: "Cultura" },
  Other: { icon: Ticket, color: "#6B7280", label: "Otros" },
};

const monthNamesShort = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const getWazeUrl = (lat: number, lon: number) => {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes&z=10`;
};

const demandLevelLabels = {
  "very-high": { label: "Muy Alta", color: "#EF4444" },
  "high": { label: "Alta", color: "#F59E0B" },
  "medium": { label: "Media", color: "#3B82F6" },
  "low": { label: "Baja", color: "#6B7280" },
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
      const dateKey = new Date(event.rawDate).toDateString();
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)?.push(event);
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
      <div className="flex flex-col h-full bg-background px-4 pt-4 space-y-4">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-9 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-[28px] font-bold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {events.length} eventos en Barcelona
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex-shrink-0 pb-3">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-[0.97]",
              selectedCategory === null
                ? "bg-foreground text-background"
                : "bg-muted/60 text-foreground"
            )}
          >
            Todos
          </button>
          {Object.entries(categories).filter(([k]) => k !== "Other").map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-[0.97]",
                selectedCategory === key
                  ? "text-white"
                  : "bg-muted/60 text-foreground"
              )}
              style={selectedCategory === key ? { backgroundColor: cat.color } : {}}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar toggle */}
      <div className="flex-shrink-0 px-4 pb-3">
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

      {/* Collapsible Calendar */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-y border-border/50 flex-shrink-0"
          >
            <div className="p-4 bg-muted/20">
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

              {selectedDayEvents.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {selectedDayEvents.slice(0, 3).map(event => {
                    const cat = categories[event.type as keyof typeof categories] || categories.Other;
                    return (
                      <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl bg-background">
                        <div className="w-1 h-10 rounded-full" style={{ backgroundColor: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.time}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(getWazeUrl(event.lat, event.lon), "_blank");
                          }}
                          className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center active:scale-[0.95]"
                        >
                          <Navigation className="h-4 w-4 text-blue-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-1 pb-8 space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event, idx) => {
              const cat = categories[event.type as keyof typeof categories] || categories.Other;
              const Icon = cat.icon;
              const eventDate = new Date(event.rawDate);
              const dayNum = eventDate.getDate();
              const monthShort = monthNamesShort[eventDate.getMonth()];
              const demandInfo = event.demandLevel ? demandLevelLabels[event.demandLevel] : null;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, delay: idx * 0.025 }}
                  className="rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm"
                >
                  <div className="p-4">

                    {/* Row 1: Category label + Status badge */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: cat.color }} />
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cat.color }}>
                          {cat.label}
                        </span>
                      </div>
                      {event.status === "ongoing" && (
                        <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          En curso
                        </span>
                      )}
                      {event.status === "ending-soon" && (
                        <span className="text-[10px] font-semibold text-orange-500 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10">
                          <AlertCircle className="h-3 w-3" />
                          Terminando
                        </span>
                      )}
                      {event.status === "starting-soon" && (
                        <span className="text-[10px] font-semibold text-blue-500 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10">
                          Comienza pronto
                        </span>
                      )}
                    </div>

                    {/* Row 2: Date block + Title + Time/Location */}
                    <div className="flex gap-3 items-start">
                      {/* Date block */}
                      <div className="flex-shrink-0 w-11 h-12 rounded-xl bg-muted/60 flex flex-col items-center justify-center">
                        <span className="text-[20px] font-black leading-none tabular-nums">{dayNum}</span>
                        <span className="text-[8px] font-bold text-muted-foreground tracking-widest uppercase mt-0.5">{monthShort}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2">
                          {event.title}
                        </h3>
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="h-3 w-3" />
                            {event.time}–{event.endTime}
                          </span>
                          <span className="flex items-center gap-1 min-w-0">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Attendance + Navigate */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-bold text-foreground tabular-nums text-[13px]">
                          {event.attendees >= 1000
                            ? `${(event.attendees / 1000).toFixed(0)}k`
                            : event.attendees}
                        </span>
                        <span>personas est.</span>
                      </div>
                      <button
                        onClick={() => window.open(getWazeUrl(event.lat, event.lon), "_blank")}
                        className="h-8 px-3.5 rounded-full bg-blue-500 flex items-center gap-1.5 active:scale-[0.95] transition-transform"
                      >
                        <Navigation className="h-3.5 w-3.5 text-white" />
                        <span className="text-[12px] font-semibold text-white">Navegar</span>
                      </button>
                    </div>
                  </div>

                  {/* Demand info footer */}
                  {(event.postEventDemand && demandInfo) || (event.nearbyEvents && event.nearbyEvents.length > 0) ? (
                    <div className="border-t border-border/30 bg-muted/20 px-4 py-2.5 space-y-2">
                      {event.postEventDemand && demandInfo && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: demandInfo.color }} />
                            <span className="text-muted-foreground">Pico salida</span>
                            <span className="font-bold tabular-nums" style={{ color: demandInfo.color }}>
                              {event.postEventDemand.peakTime}h
                            </span>
                            <span className="text-muted-foreground/70 truncate">
                              ({event.postEventDemand.start}–{event.postEventDemand.end}h)
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md flex-shrink-0 ml-2"
                            style={{ backgroundColor: `${demandInfo.color}18` }}
                          >
                            <Flame className="h-3 w-3" style={{ color: demandInfo.color }} />
                            <span className="text-[10px] font-bold" style={{ color: demandInfo.color }}>
                              {demandInfo.label}
                            </span>
                          </div>
                        </div>
                      )}

                      {event.nearbyEvents && event.nearbyEvents.length > 0 && (
                        <div className="flex items-start gap-2 text-xs bg-blue-500/8 rounded-lg p-2">
                          <MapIcon className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              +{event.nearbyEvents.length} evento{event.nearbyEvents.length !== 1 ? "s" : ""} cercano{event.nearbyEvents.length !== 1 ? "s" : ""}
                            </span>
                            {event.nearbyEvents.slice(0, 2).map(nearby => (
                              <div key={nearby.id} className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {nearby.title} · {nearby.distance}km
                              </div>
                            ))}
                            {event.nearbyEvents.length > 2 && (
                              <div className="text-[11px] text-blue-500 font-medium mt-0.5">
                                +{event.nearbyEvents.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <CalendarIcon className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-base font-semibold">Sin eventos</p>
              <p className="text-sm text-muted-foreground mt-1">No hay eventos en esta categoría</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
