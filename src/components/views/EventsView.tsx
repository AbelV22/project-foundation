
import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Sparkles,
  Search,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useEvents, FormattedEvent } from "@/hooks/useEvents";
import { motion, AnimatePresence } from "framer-motion";

// Premium gradients for categories
const categoryGradients: Record<string, string> = {
  Congress: "from-blue-500/20 to-cyan-500/5 border-blue-500/30 text-blue-500 dark:text-blue-400",
  Music: "from-purple-500/20 to-pink-500/5 border-purple-500/30 text-purple-600 dark:text-purple-400",
  Sports: "from-emerald-500/20 to-teal-500/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  Culture: "from-amber-500/20 to-orange-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400",
  Other: "from-gray-500/20 to-slate-500/5 border-gray-500/30 text-gray-600 dark:text-gray-400",
};

const categoryIcons: Record<string, React.ReactNode> = {
  Congress: <Users className="h-3 w-3" />,
  Music: <Sparkles className="h-3 w-3" />,
  Sports: <Zap className="h-3 w-3" />,
  Culture: <CalendarIcon className="h-3 w-3" />,
  Other: <MapPin className="h-3 w-3" />,
};

export function EventsView() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { events, loading } = useEvents();

  // Highlight next big event (first one)
  const heroEvent = events[0];
  const upcomingEvents = events.slice(1);

  // Filter logic
  const filteredEvents = useMemo(() => {
    let filtered = upcomingEvents;
    if (selectedCategory) {
      filtered = filtered.filter(e => e.type === selectedCategory);
    }
    return filtered.slice(0, 10); // Show max 10 in list
  }, [upcomingEvents, selectedCategory]);

  // Calendar event dates mapping
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
        // Handle overlap year if needed, assuming current year or next for simple parsing
        const dateKey = new Date(year, month, day).toDateString();

        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)?.push(event);
      }
    });
    return map;
  }, [events]);

  const eventDates = useMemo(() => {
    return Array.from(eventDatesMap.keys()).map(dateStr => new Date(dateStr));
  }, [eventDatesMap]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventDatesMap.get(selectedDate.toDateString()) || [];
  }, [selectedDate, eventDatesMap]);

  if (loading) {
    return (
      <div className="space-y-6 p-1 md:p-4">
        <div className="h-64 w-full bg-muted/50 rounded-3xl animate-pulse" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative z-10">

      {/* Header Section */}
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-2xl font-display font-bold text-foreground">
          Agenda Barcelona
        </h2>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-400" />
          {events.length} grandes eventos detectados
        </p>
      </div>

      {/* Hero Event Card */}
      {heroEvent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border group cursor-pointer bg-card text-card-foreground shadow-sm"
          onClick={() => window.open(heroEvent.url_ticket, "_blank")}
        >
          {/* Dynamic background with gradient based on type */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-10 dark:opacity-20 transition-opacity duration-500 group-hover:opacity-20 dark:group-hover:opacity-30",
            categoryGradients[heroEvent.type].split(' ')[0], // Extracts 'from-...'
            categoryGradients[heroEvent.type].split(' ')[1]  // Extracts 'to-...'
          )} />

          {/* Removed heavy backdrop-blur-3xl bg-black/40 to allow theme colors to work */}

          <div className="relative p-5 md:p-8 flex flex-col md:flex-row gap-6 md:items-end justify-between">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn("backdrop-blur-md bg-background/50 border-border", categoryGradients[heroEvent.type].split(' ').pop())}>
                  Next Big Event
                </Badge>
                <span className="text-xs font-mono text-muted-foreground animate-pulse">LIVE UPDATE</span>
              </div>

              <div>
                <h1 className="text-2xl md:text-5xl font-display font-bold text-foreground mb-2 leading-tight">
                  {heroEvent.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span>{heroEvent.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span>{heroEvent.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span>{heroEvent.location}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance & CTA */}
            <div className="flex flex-row md:flex-col items-center md:items-end gap-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Asistentes est.</p>
                <p className="text-2xl font-mono font-bold text-foreground tabular-nums">
                  {heroEvent.attendees.toLocaleString()}
                </p>
              </div>

              <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center group-hover:bg-secondary transition-colors border border-border">
                <ExternalLink className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left Column: List & Filters */}
        <div className="lg:col-span-2 space-y-6">

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mask-fade-right">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                selectedCategory === null
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background/40 text-muted-foreground border-border/50 hover:border-border"
              )}
            >
              Todos
            </button>
            {["Music", "Sports", "Congress", "Culture"].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex items-center gap-1.5",
                  selectedCategory === cat
                    ? "bg-secondary text-secondary-foreground border-border"
                    : "bg-background/40 text-muted-foreground border-border/50 hover:border-border"
                )}
              >
                {categoryIcons[cat]}
                {cat}
              </button>
            ))}
          </div>

          {/* Events List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-muted-foreground">Próximos Eventos</h3>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card hover:bg-accent/50 transition-all duration-300"
                  onClick={() => window.open(event.url_ticket, "_blank")}
                >
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5",
                    categoryGradients[event.type].split(' ').pop()?.replace('text-', 'bg-')
                  )} />

                  <div className="p-4 pl-5 flex items-start gap-4">
                    {/* Date Box */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center p-2 rounded-lg bg-secondary/30 border border-border min-w-[60px]">
                      <span className="text-[10px] text-muted-foreground uppercase">{event.date.split(' ')[0]}</span>
                      <span className="text-xl font-bold text-foreground font-display">{event.date.match(/\d+/)?.[0]}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-semibold text-foreground truncate pr-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h4>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {event.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {event.location}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground/70">
                          <Users className="h-3 w-3" /> {event.attendees.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Calendar & Widgets */}
        <div className="space-y-6">
          {/* Calendar Widget */}
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Calendario
            </h3>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="p-0"
                classNames={{
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                  cell: "h-9 w-9 text-center text-sm p-0 m-0.5 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent rounded-full transition-all text-foreground",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground border border-border",
                }}
                modifiers={{
                  hasEvent: eventDates
                }}
                modifiersStyles={{
                  hasEvent: {
                    fontWeight: 'bold',
                    color: '#fbbf24', // amber-400
                  }
                }}
              />
            </div>
          </div>

          {/* Selected Day Preview */}
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-4 min-h-[150px]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>

            {selectedDayEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDayEvents.map(event => (
                  <div key={event.id} className="flex gap-3 items-start group/mini cursor-pointer" onClick={() => window.open(event.url_ticket, "_blank")}>
                    <div className={cn("w-1 self-stretch rounded-full bg-gradient-to-b", categoryGradients[event.type].split(' ')[0], categoryGradients[event.type].split(' ')[1])} />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover/mini:text-primary transition-colors leading-tight">
                        {event.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {event.time} · {event.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-6 opacity-50">
                <CalendarIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Sin eventos este día</p>
              </div>
            )}
          </div>

          {/* Interactive Map Teaser */}
          <div className="rounded-2xl overflow-hidden relative h-40 group cursor-pointer border border-border">
            <div className="absolute inset-0 bg-[url('https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/13/4207/3091.png')] bg-cover bg-center grayscale opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Radar Activo</span>
              </div>
              <p className="text-sm font-medium text-white">Mapa de calor de eventos</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
