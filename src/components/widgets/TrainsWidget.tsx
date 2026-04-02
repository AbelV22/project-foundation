import { useState, useEffect } from "react";
import { Train, Clock, MapPin, Calendar, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type TrenSants,
  getCiudad,
  getTipoTren,
  getTrenColor,
  normalizeTrenesResponse,
} from "@/lib/trainUtils";

interface TrainsWidgetProps {
  onViewFullDay?: () => void;
}

export function TrainsWidget({ onViewFullDay }: TrainsWidgetProps) {
  const [trenes, setTrenes] = useState<TrenSants[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateTime, setUpdateTime] = useState<string>("");
  const [dataUpdateTime, setDataUpdateTime] = useState<string>("");

  useEffect(() => {
    const fetchTrenes = () => {
      fetch("/trenes_sants.json?t=" + Date.now())
        .then(res => res.json())
        .then((data: unknown) => {
          const { trenes: uniqueTrenes, updateTime: dataTime } = normalizeTrenesResponse(data);
          setTrenes(uniqueTrenes);
          if (dataTime) setDataUpdateTime(dataTime);
          setUpdateTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    };

    fetchTrenes();
    // Refrescar cada 30 minutos
    const interval = setInterval(fetchTrenes, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Filtrar trenes próximos (desde hace 5 min hasta +2h)
  const proximosTrenes = trenes.filter(tren => {
    const [h, m] = tren.hora.split(":").map(Number);
    const trenMinutes = h * 60 + m;
    return trenMinutes >= currentMinutes - 5 && trenMinutes <= currentMinutes + 120;
  }).slice(0, 5);

  // Contar trenes próxima hora
  const trenesProximaHora = trenes.filter(tren => {
    const [h, m] = tren.hora.split(":").map(Number);
    const trenMinutes = h * 60 + m;
    return trenMinutes >= currentMinutes && trenMinutes < currentMinutes + 60;
  }).length;

  if (loading) {
    return (
      <div className="card-dashboard p-3 col-span-full flex items-center justify-center">
        <RefreshCw className="h-4 w-4 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="card-dashboard p-3 space-y-2 col-span-full cursor-pointer hover:border-emerald-500/50 transition-colors"
      onClick={onViewFullDay}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Train className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-xs">Estación de Sants</h3>
            <p className="text-[10px] text-muted-foreground">AVE · IRYO · OUIGO</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display font-bold text-xl text-emerald-400">{trenesProximaHora}</p>
          <p className="text-[10px] text-muted-foreground">próx. hora</p>
        </div>
      </div>

      {/* Lista de próximos trenes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {proximosTrenes.length > 0 ? proximosTrenes.map((tren, idx) => {
          const [h, m] = tren.hora.split(":").map(Number);
          const trenMinutes = h * 60 + m;
          const minutosRestantes = trenMinutes - currentMinutes;
          const isInminente = minutosRestantes <= 15 && minutosRestantes >= 0;
          
          return (
            <div 
              key={idx}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg text-xs",
                isInminente 
                  ? "bg-amber-500/10 border border-amber-500/30" 
                  : "bg-muted/30 border border-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-display font-bold",
                  isInminente ? "text-amber-400" : "text-emerald-400"
                )}>
                  {tren.hora}
                </span>
                <span className={cn("font-medium text-[10px]", getTrenColor(tren.tren))}>
                  {getTipoTren(tren.tren)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate max-w-[60px]">{getCiudad(tren.origen)}</span>
              </div>
              {isInminente && (
                <span className="text-[10px] text-amber-400 font-medium">
                  {minutosRestantes > 0 ? `${minutosRestantes}'` : "¡Ya!"}
                </span>
              )}
            </div>
          );
        }) : (
          <div className="col-span-full text-center text-xs text-muted-foreground py-2">
            No hay trenes próximos
          </div>
        )}
      </div>

      {/* Footer con última actualización */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>Datos: {dataUpdateTime || updateTime}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {trenes.length} trenes hoy
        </div>
      </div>
    </div>
  );
}
