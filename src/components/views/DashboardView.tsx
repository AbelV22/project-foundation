import { useState, useEffect } from "react";
import { RefreshCw, Plane, LogIn, LogOut, Sun, CloudRain, Calendar } from "lucide-react";
import { TerminalCard } from "@/components/widgets/TerminalCard";
import { TrainsWidget } from "@/components/widgets/TrainsWidget";
import { CruisesWidget } from "@/components/widgets/CruisesWidget";
import { EventsWidget } from "@/components/widgets/EventsWidget";
import { LicensePriceWidget } from "@/components/widgets/LicensePriceWidget";

// Tipos para vuelos.json (estructura real del scraper)
interface VueloRaw {
  hora: string;
  vuelo: string;
  aerolinea: string;
  origen: string;
  terminal: string;
  sala: string;
  estado: string;
  dia_relativo: number;
}

// Tipos para data.json (extras)
interface ExtrasData {
  licencia: number;
  licencia_tendencia: string;
  clima_prob: number;
  clima_estado: string;
}

interface DashboardViewProps {
  onTerminalClick?: (terminalId: string) => void;
  onViewAllFlights?: () => void;
  onViewAllEvents?: () => void;
  onViewFullDay?: () => void;
}

// Función para parsear hora "HH:MM" a minutos del día
const parseHora = (hora: string): number => {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Determinar tipo de terminal basado en los datos reales del scraper
const getTerminalType = (vuelo: VueloRaw): 't1' | 't2' | 't2c' | 'puente' => {
  const terminal = vuelo.terminal?.toUpperCase() || "";
  const codigosVuelo = vuelo.vuelo?.toUpperCase() || "";
  const origen = vuelo.origen?.toUpperCase() || "";
  
  // T2C: EasyJet (terminal indica "T2C" o códigos EJU/EZY)
  if (terminal.includes("T2C") || terminal.includes("EASYJET")) {
    return "t2c";
  }
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) {
    return "t2c";
  }
  
  // Puente Aéreo: vuelos IBE desde Madrid (código IBE + origen Madrid)
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) {
    // Los vuelos IBE desde Madrid son Puente Aéreo
    return "puente";
  }
  
  // T2A/T2B: Ryanair, Wizz, etc.
  if (terminal.includes("T2A") || terminal.includes("T2B")) {
    return "t2";
  }
  
  // T1: resto de vuelos T1
  if (terminal.includes("T1")) {
    return "t1";
  }
  
  // Default T2 para otros casos
  return "t2";
};

// Tiempos de retén estimados por terminal y hora del día
const getEsperaReten = (terminalId: string, currentHour: number): number => {
  // Hora punta: 10-14h y 18-21h
  const isPeakHour = (currentHour >= 10 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21);
  
  // Tiempos base por terminal (minutos)
  const baseWait: Record<string, number> = {
    t1: 25,      // T1 es la más grande, más espera
    t2: 15,      // T2 menos tráfico
    t2c: 12,     // T2C EasyJet, vuelos low cost
    puente: 8    // Puente Aéreo, vuelos frecuentes Madrid
  };
  
  const base = baseWait[terminalId] || 20;
  return isPeakHour ? base + 12 : base;
};

export function DashboardView({ onTerminalClick, onViewAllFlights, onViewAllEvents, onViewFullDay }: DashboardViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [extras, setExtras] = useState<ExtrasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateTime, setUpdateTime] = useState<string>("");

  const fetchData = () => {
    Promise.all([
      fetch("/vuelos.json?t=" + Date.now()).then(res => res.json()).catch(() => []),
      fetch("/data.json?t=" + Date.now()).then(res => res.json()).catch(() => null)
    ]).then(([vuelosData, dataJson]) => {
      console.log("📡 Vuelos cargados:", vuelosData?.length || 0);
      setVuelos(Array.isArray(vuelosData) ? vuelosData : []);
      if (dataJson?.extras) setExtras(dataJson.extras);
      if (dataJson?.meta?.update_time) setUpdateTime(dataJson.meta.update_time);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh cada 2 horas
    const interval = setInterval(fetchData, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Conectando radar...</p>
      </div>
    );
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = currentHour * 60 + now.getMinutes();

  // Filtrar vuelos no cancelados y futuros (próximas 24h)
  const vuelosActivos = vuelos.filter(v => {
    const estado = v.estado?.toLowerCase() || "";
    // Excluir cancelados
    if (estado.includes("cancelado")) return false;
    return true;
  });

  // Ordenar por hora
  const vuelosSorted = [...vuelosActivos].sort((a, b) => {
    // Primero por día relativo, luego por hora
    if (a.dia_relativo !== b.dia_relativo) {
      return a.dia_relativo - b.dia_relativo;
    }
    return parseHora(a.hora) - parseHora(b.hora);
  });

  // Agrupar por terminal
  const terminalData: Record<string, { vuelos: VueloRaw[] }> = {
    t1: { vuelos: [] },
    t2: { vuelos: [] },
    t2c: { vuelos: [] },
    puente: { vuelos: [] }
  };

  vuelosSorted.forEach(vuelo => {
    const type = getTerminalType(vuelo);
    terminalData[type].vuelos.push(vuelo);
  });

  // Config visual de terminales
  const terminals = [
    { id: "t1", name: "Terminal 1", color: "#F59E0B" },
    { id: "t2", name: "Terminal 2", color: "#F59E0B" },
    { id: "puente", name: "Puente Aéreo", color: "#F59E0B" },
    { id: "t2c", name: "T2C EasyJet", color: "#F59E0B" },
  ];

  const totalVuelos = vuelosSorted.length;

  // Calcular vuelos por hora para cada terminal
  const getVuelosPorHora = (vuelosTerminal: VueloRaw[], horaOffset: number) => {
    const targetHour = (currentHour + horaOffset) % 24;
    return vuelosTerminal.filter(v => {
      const estado = v.estado?.toLowerCase() || "";
      if (estado.includes("finalizado") || estado.includes("cancelado")) return false;
      const horaVuelo = parseInt(v.hora?.split(":")[0] || "0", 10);
      // Si es día siguiente y la hora es menor, contar también
      if (v.dia_relativo === 1 && horaOffset > 0) {
        return horaVuelo === targetHour;
      }
      if (v.dia_relativo === 0) {
        return horaVuelo === targetHour;
      }
      return false;
    }).length;
  };

  // Obtener próximos vuelos (no finalizados)
  const proximosVuelos = vuelosSorted.filter(v => {
    const estado = v.estado?.toLowerCase() || "";
    return !estado.includes("finalizado");
  }).slice(0, 6);

  // Hora actual formateada
  const horaActual = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-3 animate-fade-in pb-20">
      {/* Header con hora, clima y botón día completo */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Plane className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-sm">Aeropuerto BCN</h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>Radar activo</span>
            </div>
          </div>
        </div>
        {/* Botón día completo + hora + clima */}
        <div className="flex items-center gap-2">
          <button
            onClick={onViewFullDay}
            className="px-2 py-1 rounded-lg text-[10px] bg-muted/50 border border-border hover:bg-muted transition-colors"
          >
            <Calendar className="h-3 w-3 inline mr-1" />
            <span>Día</span>
          </button>
          <div className="text-right">
            <p className="font-display font-bold text-lg text-foreground">{horaActual}</p>
          </div>
          <button className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] bg-muted/50 border border-border">
            {extras?.clima_prob && extras.clima_prob >= 50 ? (
              <>
                <CloudRain className="h-3 w-3 text-rain" />
                <span className="text-rain">{extras.clima_prob}%</span>
              </>
            ) : (
              <>
                <Sun className="h-3 w-3 text-amber-400" />
                <span>{extras?.clima_prob || 0}%</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Botones de Retén */}
      <div className="grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 hover:bg-success/20 transition-colors">
          <LogIn className="h-5 w-5 text-success" />
          <span className="font-display font-semibold text-success text-sm">Entro al retén</span>
        </button>
        <button className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors">
          <LogOut className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold text-primary text-sm">Salgo del retén</span>
        </button>
      </div>

      {/* Terminal Cards Grid - Optimizado móvil */}
      <div className="grid grid-cols-2 gap-2">
        {terminals.map(term => {
          const data = terminalData[term.id];
          const vuelosProximaHora = getVuelosPorHora(data.vuelos, 0);
          const vuelosSiguienteHora = getVuelosPorHora(data.vuelos, 1);
          // Simulamos contribuidores (más adelante vendrán de la BD)
          const contribuidores = Math.floor(Math.random() * 5);
          
          return (
            <TerminalCard
              key={term.id}
              id={term.id}
              name={term.name}
              vuelosProximaHora={vuelosProximaHora}
              vuelosSiguienteHora={vuelosSiguienteHora}
              esperaMinutos={getEsperaReten(term.id, currentHour)}
              contribuidores={contribuidores}
              onClick={() => onTerminalClick?.(term.id)}
            />
          );
        })}
      </div>

      {/* Transporte Grid - Trenes y Eventos */}
      <div className="grid grid-cols-2 gap-2">
        <TrainsWidget />
        <EventsWidget onViewAllClick={onViewAllEvents} compact />
      </div>

      {/* Cruceros y Licencia */}
      <div className="grid grid-cols-2 gap-2">
        <CruisesWidget />
        <LicensePriceWidget 
          precio={extras?.licencia || 0} 
          tendencia={extras?.licencia_tendencia || "estable"} 
        />
      </div>
    </div>
  );
}
