import { useState, useEffect } from "react";
import { RefreshCw, Plane, LogOut, Train, Users, Clock, ChevronRight, MapPin, TrendingUp, TrendingDown, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEvents } from "@/hooks/useEvents";

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
  const { events } = useEvents();

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

  const getVuelosPorHora = (terminalId: string, horaOffset: number) => {
    const targetHour = (currentHour + horaOffset) % 24;
    return countByHourAndTerminal[terminalId][targetHour] || 0;
  };

  // Terminal config - 2x2 Grid with T2C EasyJet
  const terminals = [
    { id: "t1", name: "T1", vuelosEstaHora: getVuelosPorHora("t1", 0), espera: getEsperaReten("t1", currentHour), contribuidores: 3 },
    { id: "t2", name: "T2", vuelosEstaHora: getVuelosPorHora("t2", 0), espera: getEsperaReten("t2", currentHour), contribuidores: 2 },
    { id: "puente", name: "Puente", vuelosEstaHora: getVuelosPorHora("puente", 0), espera: getEsperaReten("puente", currentHour), contribuidores: 1 },
    { id: "t2c", name: "T2C Easy", vuelosEstaHora: getVuelosPorHora("t2c", 0), espera: getEsperaReten("t2c", currentHour), contribuidores: 0 },
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

  return (
    <div className="space-y-3 animate-fade-in pb-16">

      {/* === ACTION BUTTONS - COMPACT h-14 === */}
      <div className="grid grid-cols-2 gap-2">
        <button className="relative flex items-center justify-center gap-2 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition-all text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
          <MapPin className="h-5 w-5" />
          <span className="text-sm">Entro al retén</span>
        </button>
        <button className="flex items-center justify-center gap-2 h-14 rounded-xl bg-amber-500 hover:bg-amber-400 transition-all text-black font-semibold">
          <XCircle className="h-5 w-5" />
          <span className="text-sm">Salgo del retén</span>
        </button>
      </div>

      {/* === AEROPUERTO SECTION === */}
      <section className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aeropuerto BCN</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          </div>
          <button onClick={onViewFullDay} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Ver día <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Terminal Cards - 2x2 Grid, Compact */}
        <div className="grid grid-cols-2 gap-2">
          {terminals.map(term => {
            const esperaLevel = term.espera <= 10 ? "low" : term.espera <= 25 ? "medium" : "high";
            
            return (
              <button
                key={term.id}
                onClick={() => onTerminalClick?.(term.id)}
                className="relative p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all group text-left"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">{term.name}</span>
                  <div className={cn(
                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold",
                    esperaLevel === "low" && "bg-emerald-500 text-white",
                    esperaLevel === "medium" && "bg-amber-400 text-black",
                    esperaLevel === "high" && "bg-red-500 text-white"
                  )}>
                    <Clock className="h-2 w-2" />
                    {term.espera}'
                  </div>
                </div>
                
                {/* BIG NUMBER - Always White for Glanceability */}
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-black text-3xl tabular-nums tracking-tight text-white">
                    {term.vuelosEstaHora}
                  </span>
                  <span className="text-[9px] text-muted-foreground">vuelos/h</span>
                </div>

                {/* Social Proof - Compact */}
                {term.contribuidores > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-[8px] text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{term.contribuidores} taxistas</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* === TRENES SANTS - DEPARTURE BOARD STYLE === */}
      <section className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estación Sants</span>
            <span className="font-mono text-lg font-bold text-white tabular-nums">{trenesProximaHora}</span>
            <span className="text-[10px] text-muted-foreground">/hora</span>
          </div>
          <button onClick={onViewTrainsFullDay} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Ver día <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Departure Board Table - Compact */}
        <div className="rounded-xl bg-black/40 border border-white/5 overflow-hidden">
          {/* Train Rows - Tighter Padding */}
          <div className="divide-y divide-white/5">
            {proximosTrenes.length > 0 ? proximosTrenes.slice(0, 3).map((tren, idx) => {
              const [h, m] = tren.hora.split(":").map(Number);
              const trenMinutes = h * 60 + m;
              const minutosRestantes = trenMinutes - currentMinutes;
              const isInminente = minutosRestantes <= 15 && minutosRestantes >= 0;
              
              return (
                <div 
                  key={idx}
                  className={cn(
                    "grid grid-cols-[50px_1fr_60px] gap-2 px-2.5 py-1.5 items-center transition-colors",
                    isInminente && "bg-amber-500/10"
                  )}
                >
                  {/* Time */}
                  <span className={cn(
                    "font-mono text-xs font-bold tabular-nums",
                    isInminente ? "text-amber-400" : "text-white"
                  )}>
                    {tren.hora}
                  </span>
                  
                  {/* Origin */}
                  <span className="text-xs text-white/90 truncate">{getCiudad(tren.origen)}</span>
                  
                  {/* Operator */}
                  <span className={cn(
                    "font-mono text-[10px] font-semibold text-right",
                    getTrenColorClass(tren.tren)
                  )}>
                    {getTipoTren(tren.tren)}
                  </span>
                </div>
              );
            }) : (
              <div className="px-2.5 py-2 text-center text-[10px] text-muted-foreground">
                No hay trenes próximos
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === LIVE DATA WIDGETS === */}
      <div className="grid grid-cols-2 gap-2">
        {/* Eventos Widget - Shows Top Event */}
        <button
          onClick={onViewAllEvents}
          className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all group text-left"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] font-medium text-muted-foreground">Eventos</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-primary" />
          </div>
          {topEvent ? (
            <>
              <p className="font-semibold text-sm text-white truncate leading-tight">{topEvent.title}</p>
              <p className="text-[10px] text-purple-400 mt-0.5">{topEvent.time} · {topEvent.location.split(' ')[0]}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-sm text-muted-foreground">Sin eventos</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Hoy en BCN</p>
            </>
          )}
        </button>

        {/* Licencias Widget - Shows Real Price */}
        <button
          onClick={onViewLicenses}
          className="flex flex-col p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all group text-left"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">🚕</span>
            <span className="text-[10px] font-medium text-muted-foreground">Licencias</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto group-hover:text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-black text-2xl text-primary tabular-nums">{precioK}k€</span>
            <div className="flex items-center gap-0.5 text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[10px] font-medium">+0.1%</span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">Precio mercado</p>
        </button>
      </div>
    </div>
  );
}
