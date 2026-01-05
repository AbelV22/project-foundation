import { Train, Clock, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface AVETren {
  hora: string;
  origen: string;
  paxEstimado: number;
}

interface TrainsWidgetProps {
  aveProximaHora?: number;
  proximosAVE?: AVETren[];
  esperaMinutos?: number;
}

// Datos de ejemplo de AVEs (en producción vendrían de una API)
const defaultAVEs: AVETren[] = [
  { hora: "14:35", origen: "Madrid", paxEstimado: 350 },
  { hora: "15:10", origen: "Sevilla", paxEstimado: 280 },
  { hora: "15:45", origen: "Madrid", paxEstimado: 320 },
];

export function TrainsWidget({ 
  aveProximaHora = 3, 
  proximosAVE = defaultAVEs,
  esperaMinutos = 12 
}: TrainsWidgetProps) {
  const esperaLevel = esperaMinutos <= 10 ? "low" : esperaMinutos <= 20 ? "medium" : "high";
  
  return (
    <div className="card-dashboard p-3 space-y-2">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Train className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-xs">Sants AVE</h3>
            <p className="text-[10px] text-muted-foreground">Próxima hora</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display font-bold text-xl text-emerald-400">{aveProximaHora}</p>
          <p className="text-[10px] text-muted-foreground">trenes</p>
        </div>
      </div>

      {/* Lista de próximos AVE */}
      <div className="space-y-1">
        {proximosAVE.slice(0, 3).map((tren, idx) => (
          <div 
            key={idx}
            className="flex items-center justify-between p-1.5 rounded-lg bg-muted/30 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-emerald-400">{tren.hora}</span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                <span>{tren.origen}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-400">
              <Users className="h-3 w-3" />
              <span className="font-medium">~{tren.paxEstimado}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tiempo de retén */}
      <div className={cn(
        "flex items-center justify-between p-2 rounded-lg text-xs",
        esperaLevel === "low" && "bg-success/10 border border-success/20",
        esperaLevel === "medium" && "bg-amber-500/10 border border-amber-500/20",
        esperaLevel === "high" && "bg-destructive/10 border border-destructive/20"
      )}>
        <div className="flex items-center gap-1.5">
          <Clock className={cn(
            "h-3 w-3",
            esperaLevel === "low" && "text-success",
            esperaLevel === "medium" && "text-amber-400",
            esperaLevel === "high" && "text-destructive"
          )} />
          <span className="text-muted-foreground">Retén Sants</span>
        </div>
        <span className={cn(
          "font-display font-bold",
          esperaLevel === "low" && "text-success",
          esperaLevel === "medium" && "text-amber-400",
          esperaLevel === "high" && "text-destructive"
        )}>
          ~{esperaMinutos} min
        </span>
      </div>
    </div>
  );
}
