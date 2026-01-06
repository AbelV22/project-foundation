import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plane, RefreshCw, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface VuelosJsonMeta {
  vuelos: VueloRaw[];
  meta?: {
    update_time?: string;
  };
}

interface FullDayViewProps {
  onBack?: () => void;
}

// Determinar tipo de terminal
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

// Generar array de 24 horas empezando 1 hora antes de la hora actual
const generateHourSlots = (startHour: number): string[] => {
  const slots: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = (startHour + i) % 24;
    const nextHour = (hour + 1) % 24;
    slots.push(`${hour.toString().padStart(2, '0')} - ${nextHour.toString().padStart(2, '0')}`);
  }
  return slots;
};
export function FullDayView({
  onBack
}: FullDayViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    fetch("/vuelos.json?t=" + Date.now())
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setVuelos(data);
        } else if (data?.vuelos) {
          setVuelos(data.vuelos);
          if (data.meta?.update_time) {
            setLastUpdate(data.meta.update_time);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  const now = new Date();
  const currentHour = now.getHours();
  const startHour = (currentHour - 1 + 24) % 24; // Una hora antes

  // Generar slots de hora
  const hourSlots = useMemo(() => generateHourSlots(startHour), [startHour]);

  // Filtrar vuelos activos (no cancelados)
  const vuelosActivos = useMemo(() => vuelos.filter(v => !v.estado?.toLowerCase().includes("cancelado")), [vuelos]);

  // Agrupar por terminal
  const vuelosPorTerminal = useMemo(() => {
    const data: Record<string, VueloRaw[]> = {
      t1: [],
      t2: [],
      t2c: [],
      puente: []
    };
    vuelosActivos.forEach(v => {
      const type = getTerminalType(v);
      data[type].push(v);
    });
    return data;
  }, [vuelosActivos]);

  // Contar vuelos por hora y terminal
  const countByHourAndTerminal = useMemo(() => {
    const counts: Record<string, Record<number, number>> = {
      t1: {},
      t2: {},
      t2c: {},
      puente: {}
    };
    Object.entries(vuelosPorTerminal).forEach(([terminal, vuelos]) => {
      vuelos.forEach(v => {
        const hour = parseInt(v.hora?.split(":")[0] || "0", 10);
        counts[terminal][hour] = (counts[terminal][hour] || 0) + 1;
      });
    });
    return counts;
  }, [vuelosPorTerminal]);

  // Obtener vuelos específicos de Puente Aéreo y T2C con hora exacta
  // Empezar desde 30 minutos antes de la hora actual
  const getVuelosHoraExacta = (terminal: 't2c' | 'puente'): VueloRaw[] => {
    const nowMinutes = currentHour * 60 + now.getMinutes();
    const startMinutes = nowMinutes - 30; // 30 minutos antes
    
    return vuelosPorTerminal[terminal]
      .filter(v => {
        if (v.estado?.toLowerCase().includes("finalizado")) return false;
        const [h, m] = (v.hora || "00:00").split(":").map(Number);
        const vueloMinutes = h * 60 + m;
        return vueloMinutes >= startMinutes;
      })
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      });
  };

  // Calcular máximos para resaltar horas calientes
  const maxT1 = Math.max(...Object.values(countByHourAndTerminal.t1), 1);
  const maxT2 = Math.max(...Object.values(countByHourAndTerminal.t2), 1);

  // Totales
  const totalT1 = vuelosPorTerminal.t1.length;
  const totalT2 = vuelosPorTerminal.t2.length;
  const totalPuente = vuelosPorTerminal.puente.length;
  const totalT2C = vuelosPorTerminal.t2c.length;

  // Fecha formateada
  const fechaFormateada = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const diaSemana = now.toLocaleDateString('es-ES', {
    weekday: 'long'
  }).toUpperCase();
  const puenteVuelos = getVuelosHoraExacta('puente');
  const t2cVuelos = getVuelosHoraExacta('t2c');
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando vuelos...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header - Optimizado móvil */}
      <div className="flex items-center gap-3 mb-3">
        <button 
          onClick={onBack} 
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border shadow-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-foreground">Vista Día</h1>
          <p className="text-[11px] text-muted-foreground">Previsión de llegadas</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {lastUpdate && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30">
              <Clock className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-primary font-medium">Datos: {lastUpdate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fecha - Diseño premium */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm">{fechaFormateada}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm capitalize">{diaSemana}</span>
        </div>
      </div>

      {/* Tabla principal - Grid responsive */}
      <div className="grid grid-cols-2 gap-2">
        {/* Columna izquierda: T1 y T2 por hora */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/10">
          {/* Header de la tabla */}
          <div className="grid grid-cols-3 bg-muted border-b border-border">
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Hora</span>
            </div>
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="text-[10px] font-display font-bold text-amber-500 uppercase tracking-wide">T1</span>
            </div>
            <div className="py-2.5 px-1 text-center">
              <span className="text-[10px] font-display font-bold text-blue-500 uppercase tracking-wide">T2</span>
            </div>
          </div>

          {/* Filas de datos - Custom scrollbar */}
          <div className="max-h-[55vh] overflow-y-auto scrollbar-dark">
            {hourSlots.map((slot, idx) => {
              const hour = (startHour + idx) % 24;
              const countT1 = countByHourAndTerminal.t1[hour] || 0;
              const countT2 = countByHourAndTerminal.t2[hour] || 0;

              // Determinar si es hora caliente
              const isHotT1 = countT1 >= maxT1 * 0.7 && countT1 > 0;
              const isHotT2 = countT2 >= maxT2 * 0.7 && countT2 > 0;
              const isCurrentHour = hour === currentHour;
              
              return (
                <div 
                  key={slot} 
                  className={cn(
                    "grid grid-cols-3 border-b border-border/40",
                    isCurrentHour && "bg-primary/15"
                  )}
                >
                  <div className={cn(
                    "py-2 px-1 text-center border-r border-border/40 flex items-center justify-center",
                    isCurrentHour && "bg-primary/10"
                  )}>
                    <span className={cn(
                      "text-[9px] font-mono font-medium",
                      isCurrentHour ? "font-bold text-primary" : "text-muted-foreground"
                    )}>
                      {slot}
                    </span>
                  </div>
                  <div className={cn(
                    "py-2 px-1 text-center border-r border-border/40 flex items-center justify-center gap-0.5",
                    isHotT1 && "bg-amber-500/15"
                  )}>
                    {isHotT1 && <Flame className="h-3 w-3 text-amber-500" />}
                    <span className={cn(
                      "font-display font-bold text-sm",
                      isHotT1 ? "text-amber-500" : "text-foreground",
                      countT1 === 0 && "text-muted-foreground/40"
                    )}>
                      {countT1.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className={cn(
                    "py-2 px-1 text-center flex items-center justify-center gap-0.5",
                    isHotT2 && "bg-blue-500/15"
                  )}>
                    {isHotT2 && <Flame className="h-3 w-3 text-blue-500" />}
                    <span className={cn(
                      "font-display font-bold text-sm",
                      isHotT2 ? "text-blue-500" : "text-foreground",
                      countT2 === 0 && "text-muted-foreground/40"
                    )}>
                      {countT2.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 bg-muted border-t border-border">
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase">Total</span>
            </div>
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="font-display font-bold text-base text-amber-500">{totalT1}</span>
            </div>
            <div className="py-2.5 px-1 text-center">
              <span className="font-display font-bold text-base text-blue-500">{totalT2}</span>
            </div>
          </div>
        </div>

        {/* Columna derecha: Puente Aéreo y T2C juntos verticalmente */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
          {/* Headers lado a lado */}
          <div className="grid grid-cols-2 border-b border-border bg-muted">
            <div className="py-2.5 px-2 text-center border-r border-border">
              <span className="text-[9px] font-display font-bold text-red-500 uppercase leading-tight block">Puente</span>
              <span className="text-[9px] font-display font-bold text-red-500 uppercase leading-tight block">Aéreo</span>
            </div>
            <div className="py-2.5 px-2 text-center">
              <span className="text-[9px] font-display font-bold text-orange-500 uppercase leading-tight block">T2C</span>
              <span className="text-[9px] font-display font-bold text-orange-500 uppercase leading-tight block">EasyJet</span>
            </div>
          </div>
          
          {/* Contenido lado a lado - Custom scrollbar */}
          <div className="grid grid-cols-2 max-h-[48vh] overflow-y-auto scrollbar-dark">
            {/* Puente Aéreo */}
            <div className="border-r border-border">
              {puenteVuelos.length === 0 ? (
                <div className="p-4 text-center text-[10px] text-muted-foreground">Sin vuelos</div>
              ) : (
                puenteVuelos.map((vuelo, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between py-2 px-2.5 border-b border-border/40"
                  >
                    <span className="font-display font-bold text-xs text-red-500">{vuelo.hora}</span>
                    <Plane className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                ))
              )}
            </div>
            
            {/* T2C EasyJet */}
            <div>
              {t2cVuelos.length === 0 ? (
                <div className="p-4 text-center text-[10px] text-muted-foreground">Sin vuelos</div>
              ) : (
                t2cVuelos.map((vuelo, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between py-2 px-2.5 border-b border-border/40"
                  >
                    <span className="font-display font-bold text-xs text-orange-500">{vuelo.hora}</span>
                    <Plane className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Totales */}
          <div className="grid grid-cols-2 bg-muted border-t border-border">
            <div className="py-2.5 px-2 text-center border-r border-border">
              <span className="font-display font-bold text-base text-red-500">{totalPuente}</span>
            </div>
            <div className="py-2.5 px-2 text-center">
              <span className="font-display font-bold text-base text-orange-500">{totalT2C}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 p-3 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="font-medium">= Hora caliente (alta concentración)</span>
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-1.5">
          Datos desde 1h antes para ver tendencia inmediata.
        </p>
      </div>
    </div>
  );
}