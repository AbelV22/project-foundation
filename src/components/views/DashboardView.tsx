import { useState, useEffect } from "react";
import { HeroSection } from "@/components/widgets/HeroSection";
import { QuickStats } from "@/components/widgets/QuickStats";
import { FlightsWidget } from "@/components/widgets/FlightsWidget";
import { EventsWidget } from "@/components/widgets/EventsWidget";
import { LicensePriceWidget } from "@/components/widgets/LicensePriceWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { TrainsWidget } from "@/components/widgets/TrainsWidget";
import { CruisesWidget } from "@/components/widgets/CruisesWidget";

// --- 1. DEFINICIÓN DE TIPOS (El mapa de tu data.json) ---
export interface Vuelo {
  id: string;
  aerolinea: string;
  origen: string;
  hora: string;
  terminal: string;
  es_puente: boolean;
  es_t2c: boolean;
  avion: string;
  pax: number;
  estado: string;
  estado_color: string;
}

export interface DashboardData {
  meta: { update_time: string; total_vuelos: number };
  resumen_cards: {
    t1: { vuelos: number; pax: number };
    t2: { vuelos: number; pax: number };
    puente: { vuelos: number; pax: number };
    t2c: { vuelos: number; pax: number };
  };
  grafica: { name: string; pax: number }[];
  vuelos: Vuelo[];
  extras: {
    licencia: number;
    licencia_tendencia: string;
    clima_prob: number;
    clima_estado: string;
  };
}

interface DashboardViewProps {
  onTerminalClick?: (terminalId: string) => void;
  onViewAllFlights?: () => void;
  onViewAllEvents?: () => void;
}

export function DashboardView({ onTerminalClick, onViewAllFlights, onViewAllEvents }: DashboardViewProps) {
  // --- 2. ESTADO Y CARGA DE DATOS ---
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Truco: ?t=Date.now() evita que el navegador guarde datos viejos
    fetch("/data.json?t=" + Date.now())
      .then((res) => res.json())
      .then((jsonData) => {
        console.log("📡 Datos cargados en Dashboard:", jsonData);
        setData(jsonData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Error cargando data.json:", err);
        setLoading(false);
      });
  }, []);

  // --- 3. PANTALLA DE CARGA ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-pulse">
        <div className="text-blue-500 font-bold text-lg">Conectando con Torre de Control...</div>
      </div>
    );
  }

  // --- 4. FALLBACK SI NO HAY DATOS ---
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>No hay datos de radar disponibles.</p>
        <p className="text-xs mt-2">Verifica que el script de Python se ha ejecutado en GitHub.</p>
      </div>
    );
  }

  // --- 5. RENDERIZADO CON DATOS REALES ---
  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Hero Section - Le pasamos la hora de actualización y clima */}
      <HeroSection 
        updateTime={data.meta.update_time} 
        weather={data.extras}
      />

      {/* Quick Stats - Le pasamos los KPIs generales */}
      <QuickStats 
        totalVuelos={data.meta.total_vuelos}
        licencia={data.extras.licencia}
        onViewAllFlights={onViewAllFlights} 
        onViewAllEvents={onViewAllEvents} 
      />

      {/* Flights widget - Le pasamos los datos del radar (tarjetas y gráfica) */}
      <FlightsWidget 
        kpis={data.resumen_cards}
        grafica={data.grafica}
        vuelos={data.vuelos}
        onTerminalClick={onTerminalClick}
        onViewAllClick={onViewAllFlights}
      />

      {/* Transporte Grid - Trenes y Cruceros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrainsWidget />
        <CruisesWidget />
      </div>

      {/* Secondary widgets grid */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <EventsWidget onViewAllClick={onViewAllEvents} />
        
        <LicensePriceWidget 
            precio={data.extras.licencia} 
            tendencia={data.extras.licencia_tendencia} 
        />
      </div>

      {/* Weather - Widget inferior */}
      <WeatherWidget data={data.extras} />
    </div>
  );
}
