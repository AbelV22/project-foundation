import { useState, useEffect } from "react";

export interface EventBcn {
  id: string;
  titulo: string;
  recinto: string;
  categoria: string;
  fecha: string;
  hora_inicio: string;
  hora_fin_estimada: string;
  latitud: number;
  longitud: number;
  url_ticket: string;
}

export interface FormattedEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  time: string;
  endTime: string;
  attendees: number;
  type: "Congress" | "Music" | "Sports" | "Culture" | "Other";
  categoria: string;
  url_ticket: string;
}

const categoryMap: Record<string, FormattedEvent["type"]> = {
  "Congress": "Congress",
  "Music": "Music", 
  "Sports": "Sports",
  "Culture": "Culture"
};

const estimateAttendees = (recinto: string, categoria: string): number => {
  const venueCapacity: Record<string, number> = {
    "Camp Nou": 99000,
    "Spotify Camp Nou": 99000,
    "Palau Sant Jordi": 18000,
    "Fira Gran Via": 45000,
    "Fira Montjuïc": 25000,
    "Parc del Fòrum": 50000,
    "CCIB": 15000,
    "Palau de la Música": 2200,
    "Gran Teatre del Liceu": 2300,
    "Sala Apolo": 1500,
    "Razzmatazz": 3000,
    "RCDE Stadium": 40000,
    "Circuit de Barcelona-Catalunya": 60000
  };

  for (const [venue, capacity] of Object.entries(venueCapacity)) {
    if (recinto.toLowerCase().includes(venue.toLowerCase())) {
      return capacity;
    }
  }

  // Default estimates by category
  if (categoria === "Congress") return 15000;
  if (categoria === "Music") return 5000;
  if (categoria === "Sports") return 20000;
  return 3000;
};

const formatDate = (fecha: string): string => {
  const date = new Date(fecha);
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
};

const formatTime = (hora: string): string => {
  return hora.slice(0, 5) + "h";
};

export function useEvents() {
  const [events, setEvents] = useState<FormattedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/eventos_bcn.json");
        if (!response.ok) throw new Error("Error fetching events");
        
        const data: EventBcn[] = await response.json();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const formattedEvents: FormattedEvent[] = data
          .filter(event => new Date(event.fecha) >= today)
          .map(event => ({
            id: event.id,
            title: event.titulo,
            location: event.recinto,
            date: formatDate(event.fecha),
            time: formatTime(event.hora_inicio),
            endTime: formatTime(event.hora_fin_estimada),
            attendees: estimateAttendees(event.recinto, event.categoria),
            type: categoryMap[event.categoria] || "Other",
            categoria: event.categoria,
            url_ticket: event.url_ticket
          }))
          .sort((a, b) => {
            const dateA = new Date(data.find(e => e.id === a.id)?.fecha || "");
            const dateB = new Date(data.find(e => e.id === b.id)?.fecha || "");
            return dateA.getTime() - dateB.getTime();
          });

        setEvents(formattedEvents);
        setError(null);
      } catch (err) {
        setError("Error al cargar eventos");
        console.error("Events fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return { events, loading, error };
}
