import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Train, RefreshCw, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type TrenSants,
  getCiudad,
  getTipoTren,
  getNumeroTren,
  getTrenColor,
  getTrenBgColor,
  normalizeTrenesResponse,
} from "@/lib/trainUtils";

interface TrainsByOperatorViewProps {
  operator: string;
  onBack?: () => void;
}

export function TrainsByOperatorView({ operator, onBack }: TrainsByOperatorViewProps) {
  const [trenes, setTrenes] = useState<TrenSants[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    fetch("/trenes_sants.json?t=" + Date.now())
      .then(res => res.json())
      .then((data: unknown) => {
        const { trenes: uniqueTrenes, updateTime } = normalizeTrenesResponse(data);
        setTrenes(uniqueTrenes);
        setLastUpdate(updateTime || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Filtrar trenes del operador seleccionado y desde 30 min antes
  const trenesOperador = useMemo(() => {
    const startMinutes = currentMinutes - 30;
    
    return trenes
      .filter(t => getTipoTren(t.tren) === operator)
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      })
      .filter(tren => {
        const [h, m] = (tren.hora || "00:00").split(":").map(Number);
        const trenMinutes = h * 60 + m;
        return trenMinutes >= startMinutes;
      });
  }, [trenes, operator, currentMinutes]);

  // Próximo tren
  const proximoTren = trenesOperador.find(t => {
    const [h, m] = t.hora.split(":").map(Number);
    return h * 60 + m >= currentMinutes;
  });

  // Contar por ciudad
  const countByCiudad = useMemo(() => {
    const counts: Record<string, number> = {};
    trenesOperador.forEach(t => {
      const ciudad = getCiudad(t.origen);
      counts[ciudad] = (counts[ciudad] || 0) + 1;
    });
    return counts;
  }, [trenesOperador]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando trenes...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={onBack} 
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border shadow-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-display font-bold text-xl px-3 py-1 rounded-lg",
              getTrenColor(operator),
              getTrenBgColor(operator)
            )}>
              {operator}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Llegadas a Barcelona Sants</p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{lastUpdate}</span>
          </div>
        )}
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card rounded-xl p-3 border border-border shadow-sm text-center">
          <p className={cn("font-display font-bold text-2xl", getTrenColor(operator))}>
            {trenesOperador.length}
          </p>
          <p className="text-[10px] text-muted-foreground">Total hoy</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border shadow-sm text-center">
          <p className="font-display font-bold text-2xl text-amber-400">
            {proximoTren?.hora || "--:--"}
          </p>
          <p className="text-[10px] text-muted-foreground">Próximo</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border shadow-sm text-center">
          <p className="font-display font-bold text-2xl text-foreground">
            {Object.keys(countByCiudad).length}
          </p>
          <p className="text-[10px] text-muted-foreground">Orígenes</p>
        </div>
      </div>

      {/* Por ciudad */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10 mb-4">
        <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por origen</span>
        </div>
        <div className="p-2 grid grid-cols-2 gap-1.5">
          {Object.entries(countByCiudad)
            .sort((a, b) => b[1] - a[1])
            .map(([ciudad, count]) => (
              <div 
                key={ciudad}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/30"
              >
                <span className="text-xs text-foreground">{ciudad}</span>
                <span className={cn("font-display font-bold text-sm", getTrenColor(operator))}>{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Lista de trenes */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
        <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Llegadas</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{trenesOperador.length} trenes</span>
        </div>
        
        <div className="max-h-[45vh] overflow-y-auto scrollbar-dark">
          {trenesOperador.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No hay trenes {operator} programados</p>
            </div>
          ) : (
            trenesOperador.map((tren, idx) => {
              const [h, m] = tren.hora.split(":").map(Number);
              const trenMinutes = h * 60 + m;
              const isPast = trenMinutes < currentMinutes - 5;
              const isInminente = trenMinutes >= currentMinutes && trenMinutes <= currentMinutes + 15;
              
              return (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 border-b border-border/40",
                    isPast && "opacity-40",
                    isInminente && "bg-amber-500/10"
                  )}
                >
                  <span className={cn(
                    "font-display font-bold text-sm w-12",
                    isInminente ? "text-amber-400" : getTrenColor(operator)
                  )}>
                    {tren.hora}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {getNumeroTren(tren.tren)}
                  </span>
                  <div className="flex-1 flex items-center gap-1 justify-end">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground truncate max-w-[100px]">
                      {getCiudad(tren.origen)}
                    </span>
                  </div>
                  {isInminente && (
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse">
                      ¡Inminente!
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
