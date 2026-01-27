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

export interface DemandWindow {
  start: string; // HH:MM format
  end: string;
  intensity: "low" | "medium" | "high" | "very-high";
  peakTime: string; // When the absolute peak occurs
}

export interface NearbyEvent {
  id: string;
  title: string;
  distance: number; // kilometers
  timeDiff: number; // minutes difference in end time
}

export interface FormattedEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  rawDate: string; // ISO date for reliable parsing
  time: string;
  endTime: string;
  attendees: number;
  type: "Congress" | "Music" | "Sports" | "Culture" | "Other";
  categoria: string;
  url_ticket: string;
  lat: number;
  lon: number;
  // New fields for better taxi driver insights
  postEventDemand?: DemandWindow; // When taxi demand peaks after event
  nearbyEvents?: NearbyEvent[]; // Other events happening nearby at similar time
  isActive?: boolean; // Is the event currently happening?
  status?: "upcoming" | "starting-soon" | "ongoing" | "ending-soon" | "ended";
  demandLevel?: "low" | "medium" | "high" | "very-high"; // Overall demand potential
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

// Calculate post-event demand window based on event type and size
const calculatePostEventDemand = (
  endTime: string,
  type: FormattedEvent["type"],
  attendees: number
): DemandWindow => {
  const [hours, minutes] = endTime.split(":").map(Number);
  const endDate = new Date();
  endDate.setHours(hours, minutes, 0);

  let demandStartOffset = 0; // Minutes before end when people start leaving
  let demandDuration = 30; // How long the demand window lasts
  let peakOffset = 10; // When peak occurs after event end
  let intensity: DemandWindow["intensity"] = "medium";

  // Different event types have different exit patterns
  switch (type) {
    case "Music":
      // Concerts: everyone leaves within 15-20 minutes after end
      demandStartOffset = -5; // Some leave slightly early
      demandDuration = 25;
      peakOffset = 5;
      intensity = attendees > 10000 ? "very-high" : attendees > 5000 ? "high" : "medium";
      break;

    case "Sports":
      // Sports: more gradual exit, some leave early if losing
      demandStartOffset = -10;
      demandDuration = 40;
      peakOffset = 15;
      intensity = attendees > 20000 ? "very-high" : attendees > 10000 ? "high" : "medium";
      break;

    case "Congress":
      // Conferences: very staggered exit throughout the day
      demandStartOffset = -30;
      demandDuration = 60;
      peakOffset = 0;
      intensity = attendees > 30000 ? "high" : "medium";
      break;

    case "Culture":
      // Theater/shows: polite, orderly exit over 20-30 min
      demandStartOffset = 0;
      demandDuration = 30;
      peakOffset = 10;
      intensity = attendees > 5000 ? "high" : "medium";
      break;

    default:
      demandStartOffset = 0;
      demandDuration = 30;
      peakOffset = 10;
      intensity = "medium";
  }

  const demandStart = new Date(endDate.getTime() + demandStartOffset * 60000);
  const demandEnd = new Date(demandStart.getTime() + demandDuration * 60000);
  const peakTime = new Date(endDate.getTime() + peakOffset * 60000);

  return {
    start: `${String(demandStart.getHours()).padStart(2, '0')}:${String(demandStart.getMinutes()).padStart(2, '0')}`,
    end: `${String(demandEnd.getHours()).padStart(2, '0')}:${String(demandEnd.getMinutes()).padStart(2, '0')}`,
    intensity,
    peakTime: `${String(peakTime.getHours()).padStart(2, '0')}:${String(peakTime.getMinutes()).padStart(2, '0')}`
  };
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Find nearby events happening at similar times (within 2km and ending within 60 min)
const findNearbyEvents = (
  currentEvent: EventBcn,
  allEvents: EventBcn[]
): NearbyEvent[] => {
  const nearbyEvents: NearbyEvent[] = [];
  const currentEndTime = new Date(`${currentEvent.fecha}T${currentEvent.hora_fin_estimada}`);

  for (const event of allEvents) {
    if (event.id === currentEvent.id) continue;
    if (event.fecha !== currentEvent.fecha) continue; // Only same day

    const distance = calculateDistance(
      currentEvent.latitud,
      currentEvent.longitud,
      event.latitud,
      event.longitud
    );

    // Only consider events within 2km
    if (distance <= 2) {
      const eventEndTime = new Date(`${event.fecha}T${event.hora_fin_estimada}`);
      const timeDiff = Math.abs((eventEndTime.getTime() - currentEndTime.getTime()) / 60000); // minutes

      // Only if they end within 60 minutes of each other
      if (timeDiff <= 60) {
        nearbyEvents.push({
          id: event.id,
          title: event.titulo,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          timeDiff: Math.round(timeDiff)
        });
      }
    }
  }

  return nearbyEvents.sort((a, b) => a.distance - b.distance);
};

// Calculate overall demand level for the event
const calculateDemandLevel = (
  attendees: number,
  type: FormattedEvent["type"],
  nearbyEventsCount: number
): FormattedEvent["demandLevel"] => {
  let score = 0;

  // Base score on attendees
  if (attendees > 40000) score += 4;
  else if (attendees > 20000) score += 3;
  else if (attendees > 10000) score += 2;
  else if (attendees > 5000) score += 1;

  // Event type multiplier (some events = more taxi usage)
  if (type === "Music" || type === "Sports") score += 1;

  // Nearby events boost
  if (nearbyEventsCount >= 3) score += 2;
  else if (nearbyEventsCount >= 2) score += 1;

  if (score >= 6) return "very-high";
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
};

// Get event status based on current time
const getEventStatus = (
  rawDate: string,
  startTime: string,
  endTime: string
): FormattedEvent["status"] => {
  const now = new Date();
  const eventDate = new Date(rawDate);
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const eventStart = new Date(eventDate);
  eventStart.setHours(startHours, startMinutes, 0);

  const eventEnd = new Date(eventDate);
  eventEnd.setHours(endHours, endMinutes, 0);

  const minutesUntilStart = (eventStart.getTime() - now.getTime()) / 60000;
  const minutesUntilEnd = (eventEnd.getTime() - now.getTime()) / 60000;

  if (minutesUntilEnd < 0) return "ended";
  if (minutesUntilEnd <= 30) return "ending-soon";
  if (minutesUntilStart < 0) return "ongoing";
  if (minutesUntilStart <= 60) return "starting-soon";
  return "upcoming";
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

        // Filter future events
        const futureEvents = data.filter(event => new Date(event.fecha) >= today);

        const formattedEvents: FormattedEvent[] = futureEvents
          .map(event => {
            const attendees = estimateAttendees(event.recinto, event.categoria);
            const type = categoryMap[event.categoria] || "Other";
            const nearbyEvents = findNearbyEvents(event, futureEvents);
            const postEventDemand = calculatePostEventDemand(
              event.hora_fin_estimada,
              type,
              attendees
            );

            return {
              id: event.id,
              title: event.titulo,
              location: event.recinto,
              date: formatDate(event.fecha),
              rawDate: event.fecha,
              time: formatTime(event.hora_inicio),
              endTime: formatTime(event.hora_fin_estimada),
              attendees,
              type,
              categoria: event.categoria,
              url_ticket: event.url_ticket,
              lat: event.latitud,
              lon: event.longitud,
              postEventDemand,
              nearbyEvents: nearbyEvents.length > 0 ? nearbyEvents : undefined,
              status: getEventStatus(event.fecha, event.hora_inicio, event.hora_fin_estimada),
              demandLevel: calculateDemandLevel(attendees, type, nearbyEvents.length)
            };
          })
          .sort((a, b) => {
            return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
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
