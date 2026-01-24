import { useState, useEffect, useCallback } from "react";

export interface Crucero {
  hora: string;
  nombre: string;
  naviera: string;
  terminal: string;
  terminal_codigo: string;
  eslora: number;
  pax_estimados: number;
  puerto: string;
  tipo: "llegada" | "salida";
  estado: string;
  bandera: string;
  imo: string;
  mmsi: string;
  fecha: string;
}

export interface CrucerosResumen {
  total_cruceros: number;
  total_llegadas: number;
  total_salidas: number;
  pax_estimados_hoy: number;
  proximo_desembarco: string | null;
  proximo_barco: string | null;
}

export interface CrucerosData {
  llegadas: Crucero[];
  salidas: Crucero[];
  resumen: CrucerosResumen;
  terminales_activas: string[];
  metadata: {
    fuente: string;
    actualizado: string;
    frecuencia: string;
  };
}

const EMPTY_DATA: CrucerosData = {
  llegadas: [],
  salidas: [],
  resumen: {
    total_cruceros: 0,
    total_llegadas: 0,
    total_salidas: 0,
    pax_estimados_hoy: 0,
    proximo_desembarco: null,
    proximo_barco: null,
  },
  terminales_activas: [],
  metadata: {
    fuente: "Open Data Port de Barcelona",
    actualizado: new Date().toISOString(),
    frecuencia: "horaria",
  },
};

export function useCruises() {
  const [data, setData] = useState<CrucerosData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCruises = useCallback(async () => {
    try {
      const response = await fetch("/cruceros.json?t=" + Date.now());
      if (!response.ok) {
        throw new Error("Error fetching cruises data");
      }

      const cruisesData: CrucerosData = await response.json();
      setData(cruisesData);
      setError(null);
    } catch (err) {
      console.error("Cruises fetch error:", err);
      setError("Error al cargar datos de cruceros");
      // Keep empty data structure on error
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCruises();

    // Refresh every 30 minutes (data updates hourly on source)
    const interval = setInterval(fetchCruises, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCruises]);

  // Helper: Get upcoming arrivals (next N hours)
  const getUpcomingArrivals = useCallback((hoursAhead: number = 3): Crucero[] => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = nowMinutes + hoursAhead * 60;

    return data.llegadas.filter((crucero) => {
      const [h, m] = crucero.hora.split(":").map(Number);
      const cruiseMinutes = h * 60 + m;
      return cruiseMinutes >= nowMinutes && cruiseMinutes <= endMinutes;
    });
  }, [data.llegadas]);

  // Helper: Get next arrival
  const getNextArrival = useCallback((): Crucero | null => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const crucero of data.llegadas) {
      const [h, m] = crucero.hora.split(":").map(Number);
      const cruiseMinutes = h * 60 + m;
      if (cruiseMinutes >= nowMinutes) {
        return crucero;
      }
    }
    return null;
  }, [data.llegadas]);

  // Helper: Calculate time until next arrival
  const getTimeUntilNextArrival = useCallback((): number | null => {
    const next = getNextArrival();
    if (!next) return null;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = next.hora.split(":").map(Number);
    const cruiseMinutes = h * 60 + m;

    return cruiseMinutes - nowMinutes;
  }, [getNextArrival]);

  // Helper: Group by terminal
  const getCruisesByTerminal = useCallback((): Record<string, Crucero[]> => {
    const grouped: Record<string, Crucero[]> = {};

    [...data.llegadas, ...data.salidas].forEach((crucero) => {
      const terminal = crucero.terminal_codigo || "N/A";
      if (!grouped[terminal]) {
        grouped[terminal] = [];
      }
      grouped[terminal].push(crucero);
    });

    return grouped;
  }, [data.llegadas, data.salidas]);

  return {
    // Raw data
    llegadas: data.llegadas,
    salidas: data.salidas,
    resumen: data.resumen,
    terminalesActivas: data.terminales_activas,
    metadata: data.metadata,

    // State
    loading,
    error,

    // Helpers
    getUpcomingArrivals,
    getNextArrival,
    getTimeUntilNextArrival,
    getCruisesByTerminal,

    // Refetch
    refetch: fetchCruises,
  };
}
