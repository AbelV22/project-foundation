import { useState, useEffect } from "react";
import { RefreshCw, Plane, Train, Users, Clock, ChevronRight, MapPin, TrendingUp, XCircle, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEvents } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getOrCreateDeviceId } from "@/lib/deviceId";
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

interface TrenSants {
  hora: string;
  origen: string;
  tren: string;
  via: string;
}

interface DashboardViewProps {
  onTerminalClick?: (terminalId: string) => void;
  onViewAllFlights?: () => void;
  onViewAllEvents?: () => void;
  onViewFullDay?: () => void;
  onViewTrainsFullDay?: () => void;
  onViewLicenses?: () => void;
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
  
  if (terminal.includes("T2C") || terminal.includes("EASYJET")) return "t2c";
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) return "t2c";
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) return "puente";
  if (terminal.includes("T2A") || terminal.includes("T2B")) return "t2";
  if (terminal.includes("T1")) return "t1";
  return "t2";
};

// Tiempos de retén estimados por terminal y hora del día
const getEsperaReten = (terminalId: string, currentHour: number): number => {
  const isPeakHour = (currentHour >= 10 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21);
  const baseWait: Record<string, number> = { t1: 25, t2: 15, t2c: 12, puente: 8 };
  const base = baseWait[terminalId] || 20;
  return isPeakHour ? base + 12 : base;
};

// Extraer tipo de tren limpio
const getTipoTren = (tren: string): string => {
  if (!tren) return "";
  const tipo = tren.split("\n")[0].trim();
  if (tipo.includes("IRYO") || tipo.includes("IL -")) return "IRYO";
  if (tipo.includes("OUIGO")) return "OUIGO";
  if (tipo.includes("TGV")) return "TGV";
  return tipo;
};

// Color por tipo de tren
const getTrenColorClass = (tren: string): string => {
  const tipo = getTipoTren(tren);
  switch (tipo) {
    case "AVE": return "text-red-400";
    case "IRYO": return "text-purple-400";
    case "OUIGO": return "text-pink-400";
    case "TGV": return "text-indigo-400";
    default: return "text-muted-foreground";
  }
};

// Extraer ciudad
const getCiudad = (origen: string): string => {
  if (!origen) return "";
  if (origen.toLowerCase().includes("madrid")) return "Madrid";
  if (origen.toLowerCase().includes("sevilla")) return "Sevilla";
  if (origen.toLowerCase().includes("málaga")) return "Málaga";
  if (origen.toLowerCase().includes("valència") || origen.toLowerCase().includes("valencia")) return "València";
  if (origen.toLowerCase().includes("paris")) return "París";
  return origen.split(" ")[0].split("-")[0];
};

interface LicenciasData {
  metadata: { precio_mercado_referencia: number };
}

export function DashboardView({ onTerminalClick, onViewAllFlights, onViewAllEvents, onViewFullDay, onViewTrainsFullDay, onViewLicenses }: DashboardViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [trenes, setTrenes] = useState<TrenSants[]>([]);
  const [licencias, setLicencias] = useState<LicenciasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnteringReten, setIsEnteringReten] = useState(false);
  const [isInReten, setIsInReten] = useState(false);
  const [currentZona, setCurrentZona] = useState<string | null>(null);
  const { events } = useEvents();

  const handleEntrarReten = async () => {
    setIsEnteringReten(true);
    
    try {
      // Get GPS position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Get device ID
      const deviceId = getOrCreateDeviceId();

      // Call edge function
      const { data, error } = await supabase.functions.invoke('check-geofence', {
        body: { lat, lng, action: 'register', deviceId }
      });

      if (error) throw error;

      if (data.success) {
        setIsInReten(true);
        setCurrentZona(data.zona);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error registering entry:', error);
      if (error instanceof GeolocationPositionError) {
        toast.error('❌ No se pudo obtener tu ubicación. Activa el GPS.');
      } else {
        toast.error('❌ Error al registrar entrada. Inténtalo de nuevo.');
      }
    } finally {
      setIsEnteringReten(false);
    }
  };

  const handleSalirReten = () => {
    setIsInReten(false);
    setCurrentZona(null);
    toast.success('✅ Has salido del retén');
  };

  const fetchData = () => {
    Promise.all([
      fetch("/vuelos.json?t=" + Date.now()).then(res => res.json()).catch(() => []),
      fetch("/trenes_sants.json?t=" + Date.now()).then(res => res.json()).catch(() => []),
      fetch("/analisis_licencias_taxi.json?t=" + Date.now()).then(res => res.json()).catch(() => null)
    ]).then(([vuelosData, trenesData, licenciasData]) => {
      setVuelos(Array.isArray(vuelosData) ? vuelosData : []);
      const uniqueTrenes = (trenesData as TrenSants[]).filter((tren, index, self) =>
        index === self.findIndex(t => t.hora === tren.hora && t.tren === tren.tren)
      );
      setTrenes(uniqueTrenes);
      setLicencias(licenciasData);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
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

  // Filter and sort flights
  const vuelosActivos = vuelos.filter(v => !v.estado?.toLowerCase().includes("cancelado"));
  const vuelosSorted = [...vuelosActivos].sort((a, b) => {
    if (a.dia_relativo !== b.dia_relativo) return a.dia_relativo - b.dia_relativo;
    return parseHora(a.hora) - parseHora(b.hora);
  });

  // Group by terminal
  const terminalData: Record<string, { vuelos: VueloRaw[] }> = {
    t1: { vuelos: [] }, t2: { vuelos: [] }, t2c: { vuelos: [] }, puente: { vuelos: [] }
  };
  vuelosSorted.forEach(vuelo => {
    const type = getTerminalType(vuelo);
    terminalData[type].vuelos.push(vuelo);
  });

  // Count flights per hour and terminal
  const countByHourAndTerminal: Record<string, Record<number, number>> = {
    t1: {}, t2: {}, t2c: {}, puente: {}
  };
  Object.entries(terminalData).forEach(([terminal, data]) => {
    data.vuelos.forEach(v => {
      const hour = parseInt(v.hora?.split(":")[0] || "0", 10);
      countByHourAndTerminal[terminal][hour] = (countByHourAndTerminal[terminal][hour] || 0) + 1;
    });
  });

  // NUEVA LÓGICA: Ventana deslizante de 60 minutos desde el minuto actual
  const getVuelosProximos60Min = (terminalId: string): number => {
    const nowMinutes = currentHour * 60 + now.getMinutes();
    const endMinutes = nowMinutes + 60;
    
    return terminalData[terminalId].vuelos.filter(v => {
      if (v.estado?.toLowerCase().includes("finalizado")) return false;
      const [h, m] = (v.hora || "00:00").split(":").map(Number);
      const vueloMinutes = h * 60 + m;
      return vueloMinutes >= nowMinutes && vueloMinutes < endMinutes;
    }).length;
  };

  // Terminal config - 2x2 Grid with T2C EasyJet (Ventana 60 min)
  const terminals = [
    { id: "t1", name: "T1", vuelosEstaHora: getVuelosProximos60Min("t1"), espera: getEsperaReten("t1", currentHour), contribuidores: 3 },
    { id: "t2", name: "T2", vuelosEstaHora: getVuelosProximos60Min("t2"), espera: getEsperaReten("t2", currentHour), contribuidores: 2 },
    { id: "puente", name: "Puente", vuelosEstaHora: getVuelosProximos60Min("puente"), espera: getEsperaReten("puente", currentHour), contribuidores: 1 },
    { id: "t2c", name: "T2C Easy", vuelosEstaHora: getVuelosProximos60Min("t2c"), espera: getEsperaReten("t2c", currentHour), contribuidores: 0 },
  ];

  // License price data
  const precioLicencia = licencias?.metadata?.precio_mercado_referencia || 168212;
  const precioK = (precioLicencia / 1000).toFixed(0);

  // Today's top event
  const topEvent = events[0];

  // Próximos trenes
  const proximosTrenes = trenes.filter(tren => {
    const [h, m] = tren.hora.split(":").map(Number);
    const trenMinutes = h * 60 + m;
    return trenMinutes >= currentMinutes - 5 && trenMinutes <= currentMinutes + 120;
  }).slice(0, 4);

  const trenesProximaHora = trenes.filter(tren => {
    const [h, m] = tren.hora.split(":").map(Number);
    const trenMinutes = h * 60 + m;
    return trenMinutes >= currentMinutes && trenMinutes < currentMinutes + 60;
  }).length;

  // Calculate countdown for trains
  const getCountdown = (hora: string): { text: string; isUrgent: boolean; isCritical: boolean } => {
    const [h, m] = hora.split(":").map(Number);
    const trenMinutes = h * 60 + m;
    const diff = trenMinutes - currentMinutes;
    if (diff < 0) return { text: "pasó", isUrgent: false, isCritical: false };
    if (diff === 0) return { text: "¡AHORA!", isUrgent: true, isCritical: true };
    if (diff <= 5) return { text: `en ${diff} min`, isUrgent: true, isCritical: true };
    if (diff <= 10) return { text: `en ${diff} min`, isUrgent: true, isCritical: false };
    return { text: `en ${diff} min`, isUrgent: false, isCritical: false };
  };

  // Get today's date formatted
  const todayFormatted = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizedToday = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <div className="space-y-3 pb-16">

      {/* === QUICK NAV BUTTONS === */}
      <div className="grid grid-cols-2 gap-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <button 
          onClick={onViewFullDay}
          className="card-glass-hover flex items-center justify-center gap-2 h-11 text-foreground/80 hover:text-foreground font-medium text-sm transition-all duration-200"
        >
          <Calendar className="h-4 w-4 text-primary" />
          <Plane className="h-4 w-4" />
          <span>Ver Vuelos</span>
        </button>
        <button 
          onClick={onViewTrainsFullDay}
          className="card-glass-hover flex items-center justify-center gap-2 h-11 text-foreground/80 hover:text-foreground font-medium text-sm transition-all duration-200"
        >
          <Calendar className="h-4 w-4 text-emerald-400" />
          <Train className="h-4 w-4" />
          <span>Ver Trenes</span>
        </button>
      </div>

      {/* === AEROPUERTO SECTION - GLASSMORPHISM === */}
      <section className="space-y-2 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
        {/* Section Header - Clickable */}
        <button 
          onClick={onViewFullDay}
          className="flex items-center justify-between w-full px-1 group"
        >
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">Aeropuerto BCN</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
              En vivo
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        {/* Terminal Cards - 2x2 Grid Glass */}
        <div className="grid grid-cols-2 gap-2">
          {terminals.map(term => {
            const esperaLevel = term.espera <= 10 ? "low" : term.espera <= 25 ? "medium" : "high";
            
            return (
              <button
                key={term.id}
                onClick={() => onTerminalClick?.(term.id)}
                className="card-glass-hover p-2.5 text-left group"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{term.name}</span>
                  <div className={cn(
                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold",
                    esperaLevel === "low" && "bg-success text-success-foreground",
                    esperaLevel === "medium" && "bg-warning text-warning-foreground",
                    esperaLevel === "high" && "bg-destructive text-destructive-foreground"
                  )}>
                    <Clock className="h-2 w-2" />
                    {term.espera}'
                  </div>
                </div>
                
                {/* BIG NUMBER - Monospace Numeric */}
                <div className="flex flex-col">
                  <span className="font-mono font-black text-3xl tabular-nums tracking-tight text-foreground">
                    {term.vuelosEstaHora}
                  </span>
                  <span className="text-[8px] text-primary font-medium">Próximos 60m</span>
                </div>

                {/* Social Proof */}
                {term.contribuidores > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-[8px] text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                    <span>{term.contribuidores} taxistas</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* === TRENES SANTS - GLASSMORPHISM DEPARTURE BOARD === */}
      <section className="space-y-2 animate-fade-in" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
        {/* Section Header - Clickable */}
        <button 
          onClick={onViewTrainsFullDay}
          className="flex items-center justify-between w-full px-1 group"
        >
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">Estación Sants</span>
            <span className="font-mono text-lg font-bold text-foreground tabular-nums">{trenesProximaHora}</span>
            <span className="text-[10px] text-muted-foreground">/hora</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        {/* Departure Board - Glass */}
        <div className="card-glass overflow-hidden divide-y divide-border">
          <div className="divide-y divide-border/50">
            {proximosTrenes.length > 0 ? proximosTrenes.slice(0, 4).map((tren, idx) => {
              const countdown = getCountdown(tren.hora);
              
              return (
                <div 
                  key={idx}
                  className={cn(
                    "grid grid-cols-[50px_1fr_auto_60px] gap-2 px-3 py-2 items-center transition-colors",
                    countdown.isCritical && "bg-red-500/10"
                  )}
                >
                  {/* Time */}
                  <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {tren.hora}
                  </span>
                  
                  {/* Origin */}
                  <span className="text-xs text-foreground/80 truncate">{getCiudad(tren.origen)}</span>
                  
                  {/* Countdown - Colored by Urgency */}
                  <span className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    countdown.isCritical ? "text-red-400" : countdown.isUrgent ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {countdown.text}
                  </span>
                  
                  {/* Operator Badge */}
                  <span className={cn(
                    "font-mono text-[10px] font-semibold text-right",
                    getTrenColorClass(tren.tren)
                  )}>
                    {getTipoTren(tren.tren)}
                  </span>
                </div>
              );
            }) : (
              <div className="px-3 py-3 text-center text-[10px] text-muted-foreground">
                No hay trenes próximos
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === LIVE DATA WIDGETS - GLASS === */}
      <div className="grid grid-cols-2 gap-2 animate-fade-in" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
        {/* Eventos Widget */}
        <button
          onClick={onViewAllEvents}
          className="card-glass-hover flex flex-col p-2.5 text-left group transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] font-medium text-muted-foreground">Eventos</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[9px] text-purple-400 font-medium mb-0.5">{capitalizedToday}</p>
          {topEvent ? (
            <>
              <p className="font-semibold text-sm text-foreground truncate leading-tight">{topEvent.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{topEvent.time} · {topEvent.location.split(' ')[0]}</p>
            </>
          ) : (
            <p className="font-semibold text-sm text-muted-foreground">Sin eventos</p>
          )}
        </button>

        {/* Licencias Widget - Stock Ticker Style */}
        <button
          onClick={onViewLicenses}
          className="card-glass-hover flex flex-col justify-center p-2.5 text-left group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs">🚕</span>
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">Licencia</span>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono font-black text-xl text-primary tabular-nums">{precioK}k€</span>
            <div className="flex items-center gap-0.5 text-emerald-400">
              <TrendingUp className="h-2.5 w-2.5" />
              <span className="text-[9px] font-semibold">+0.1%</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
