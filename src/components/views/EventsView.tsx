import { useState } from "react";
import { Calendar as CalendarIcon, MapPin, Users, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";

interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  dateObj: Date;
  time: string;
  attendees: number;
  type: "Deportes" | "Música" | "Tecnología" | "Cultura";
}

const events: CalendarEvent[] = [
  {
    id: "1",
    title: "FC Barcelona vs Real Madrid",
    location: "Camp Nou",
    date: "viernes, 15 de marzo",
    dateObj: new Date(2026, 2, 15),
    time: "21:00h",
    attendees: 98000,
    type: "Deportes",
  },
  {
    id: "2",
    title: "Primavera Sound 2024",
    location: "Parc del Fòrum",
    date: "sábado, 1 de junio",
    dateObj: new Date(2026, 5, 1),
    time: "16:00h",
    attendees: 65000,
    type: "Música",
  },
  {
    id: "3",
    title: "Mobile World Congress",
    location: "Fira Gran Via",
    date: "lunes, 26 de febrero",
    dateObj: new Date(2026, 1, 26),
    time: "09:00h",
    attendees: 100000,
    type: "Tecnología",
  },
  {
    id: "4",
    title: "Concierto Coldplay",
    location: "Estadi Olímpic",
    date: "lunes, 20 de mayo",
    dateObj: new Date(2026, 4, 20),
    time: "20:30h",
    attendees: 55000,
    type: "Música",
  },
  {
    id: "5",
    title: "Feria de Abril",
    location: "Fòrum",
    date: "jueves, 18 de abril",
    dateObj: new Date(2026, 3, 18),
    time: "12:00h",
    attendees: 30000,
    type: "Cultura",
  },
  {
    id: "6",
    title: "Zurich Marató Barcelona",
    location: "Centro Ciudad",
    date: "domingo, 10 de marzo",
    dateObj: new Date(2026, 2, 10),
    time: "08:30h",
    attendees: 20000,
    type: "Deportes",
  },
];

const typeColors: Record<string, string> = {
  Deportes: "bg-success/20 text-success border border-success/30",
  Música: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  Tecnología: "bg-info/20 text-info border border-info/30",
  Cultura: "bg-primary/20 text-primary border border-primary/30",
};

export function EventsView() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Get event dates for calendar highlighting
  const eventDates = events.map(e => e.dateObj);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Featured Events Grid */}
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Próximos Eventos Destacados</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {events.slice(0, 6).map((event) => (
            <div key={event.id} className="card-dashboard-hover p-4 md:p-5">
              <div className="flex items-start justify-between mb-3">
                <Badge className={typeColors[event.type]}>
                  {event.type}
                </Badge>
                <div className="flex items-center gap-1 text-primary">
                  <Users className="h-4 w-4" />
                  <span className="font-medium text-sm">{event.attendees.toLocaleString()}</span>
                </div>
              </div>
              
              <h3 className="font-semibold text-foreground mb-3 text-sm md:text-base">{event.title}</h3>
              
              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span>{event.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-dashboard p-4 md:p-6">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">Calendario de Eventos</h3>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md"
              modifiers={{
                event: eventDates
              }}
              modifiersStyles={{
                event: {
                  backgroundColor: 'hsl(42, 100%, 50%)',
                  color: 'hsl(220, 25%, 6%)',
                  fontWeight: 'bold',
                  borderRadius: '50%'
                }
              }}
            />
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="card-dashboard p-4 md:p-6">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">
            {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          
          {events.filter(e => 
            e.dateObj.toDateString() === selectedDate?.toDateString()
          ).length > 0 ? (
            <div className="space-y-3">
              {events.filter(e => 
                e.dateObj.toDateString() === selectedDate?.toDateString()
              ).map(event => (
                <div key={event.id} className="p-3 rounded-lg bg-accent/30 border border-border">
                  <Badge className={cn(typeColors[event.type], "mb-2")}>
                    {event.type}
                  </Badge>
                  <h4 className="font-medium text-foreground text-sm">{event.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{event.location} - {event.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No hay eventos programados para este día.</p>
          )}
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="card-dashboard p-4 md:p-6 min-h-[250px] md:min-h-[300px] relative overflow-hidden">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">Mapa de Eventos</h3>
        <div className="absolute inset-0 top-14 flex items-center justify-center">
          {/* Decorative dots for map effect */}
          <div className="absolute top-16 left-1/4 w-2 h-2 bg-primary rounded-full animate-pulse" />
          <div className="absolute top-24 left-1/3 w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.5s" }} />
          <div className="absolute top-32 right-1/3 w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-24 left-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "1.5s" }} />
          <div className="absolute bottom-32 right-1/4 w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "2s" }} />
          
          {/* Center marker */}
          <div className="relative">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center border-2 border-primary">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center mt-4">
              <p className="text-foreground font-medium">Mapa interactivo de Barcelona</p>
              <p className="text-sm text-muted-foreground">Próximamente con ubicación en tiempo real</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
