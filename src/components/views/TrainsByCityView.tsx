import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Train, Clock, MapPin, RefreshCw } from "lucide-react";
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

interface TrainsByCityViewProps {
  city: string;
  onBack?: () => void;
}

export function TrainsByCityView({ city, onBack }: TrainsByCityViewProps) {
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
  const currentHour = now.getHours();
  const currentMinutes = currentHour * 60 + now.getMinutes();

  // Filtrar trenes por ciudad
  const trenesFiltered = useMemo(() => {
    return trenes
      .filter(t => getCiudad(t.origen) === city)
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      });
  }, [trenes, city]);

  // Contar por operador
  const countByOperador = useMemo(() => {
    const counts: Record<string, number> = {};
    trenesFiltered.forEach(t => {
      const tipo = getTipoTren(t.tren);
      counts[tipo] = (counts[tipo] || 0) + 1;
    });
    return counts;
  }, [trenesFiltered]);

  // Próximo tren
  const proximoTren = useMemo(() => {
    return trenesFiltered.find(t => {
      const [h, m] = (t.hora || "00:00").split(":").map(Number);
      return h * 60 + m >= currentMinutes;
    });
  }, [trenesFiltered, currentMinutes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando trenes desde {city}...</p>
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
            <MapPin className="h-5 w-5 text-emerald-500" />
            <h1 className="font-display font-bold text-xl text-foreground">{city}</h1>
          </div>
          <p className="text-[11px] text-muted-foreground">Trenes llegando a Sants desde {city}</p>
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
        <div className="bg-card rounded-xl p-3 border border-border text-center">
          <span className="block font-display font-bold text-2xl text-emerald-500">{trenesFiltered.length}</span>
          <span className="text-[10px] text-muted-foreground">Trenes hoy</span>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border text-center">
          <span className="block font-display font-bold text-lg text-foreground">
            {proximoTren ? proximoTren.hora : "--:--"}
          </span>
          <span className="text-[10px] text-muted-foreground">Próximo</span>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border text-center">
          <span className="block font-display font-bold text-lg text-foreground">
            {Object.keys(countByOperador).length}
          </span>
          <span className="text-[10px] text-muted-foreground">Operadores</span>
        </div>
      </div>

      {/* Por operador */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10 mb-4">
        <div className="bg-muted py-2.5 px-3 border-b border-border">
          <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">Por operador</span>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {Object.entries(countByOperador)
            .sort((a, b) => b[1] - a[1])
            .map(([tipo, count]) => (
              <div 
                key={tipo}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg",
                  getTrenBgColor(tipo)
                )}
              >
                <span className={cn(
                  "font-display font-bold text-sm",
                  getTrenColor(tipo)
                )}>
                  {tipo}
                </span>
                <span className="font-display font-bold text-sm text-foreground">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Lista de trenes */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
        <div className="bg-muted py-2.5 px-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">
              Todos los trenes desde {city}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{trenesFiltered.length} trenes</span>
        </div>
        
        <div className="max-h-[55vh] overflow-y-auto scrollbar-dark">
          {trenesFiltered.length === 0 ? (
            <div className="p-6 text-center">
              <Train className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No hay trenes desde {city} hoy</p>
            </div>
          ) : (
            trenesFiltered.map((tren, idx) => {
              const [h, m] = (tren.hora || "00:00").split(":").map(Number);
              const trenMinutes = h * 60 + m;
              const isPast = trenMinutes < currentMinutes - 5;
              const isInminente = trenMinutes >= currentMinutes && trenMinutes <= currentMinutes + 15;
              
              return (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b border-border/40",
                    isPast && "opacity-40",
                    isInminente && "bg-amber-500/10"
                  )}
                >
                  <span className={cn(
                    "font-display font-bold text-lg w-14",
                    isInminente ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {tren.hora}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded",
                        getTrenColor(tren.tren),
                        getTrenBgColor(tren.tren)
                      )}>
                        {getTipoTren(tren.tren)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {getNumeroTren(tren.tren)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {tren.origen}
                    </span>
                  </div>
                  {isInminente && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-1 rounded">
                      PRONTO
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
