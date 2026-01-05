import { Plane, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalCardProps {
  id: string;
  name: string;
  vuelosProximaHora: number;
  vuelosSiguienteHora: number;
  esperaMinutos: number;
  nextFlight?: { hora: string; origen: string };
  onClick?: () => void;
}

export function TerminalCard({ 
  id, 
  name, 
  vuelosProximaHora, 
  vuelosSiguienteHora, 
  esperaMinutos, 
  nextFlight,
  onClick 
}: TerminalCardProps) {
  // Determinar si la espera es alta (>25min) o baja (<10min)
  const esperaLevel = esperaMinutos <= 10 ? "low" : esperaMinutos <= 25 ? "medium" : "high";
  
  return (
    <button 
      onClick={onClick}
      className="w-full card-dashboard p-3 hover:border-primary/30 transition-all group text-left"
    >
      {/* Header con nombre y flecha - altura fija para alineación */}
      <div className="flex items-center justify-between mb-2 min-h-[24px]">
        <span className="font-display font-semibold text-sm text-foreground leading-tight">{name}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
      
      {/* Stats - vuelos próxima hora en grande, amarillo */}
      <div className="mb-2">
        <div className="flex items-baseline gap-1.5">
          <Plane className="h-4 w-4 text-amber-400" />
          <span className="font-display font-bold text-2xl text-amber-400">{vuelosProximaHora}</span>
          <span className="text-[10px] text-muted-foreground">próx. hora</span>
        </div>
        <div className="flex items-center gap-1 mt-1 ml-5">
          <span className="font-display font-semibold text-sm text-muted-foreground">+{vuelosSiguienteHora}</span>
          <span className="text-[10px] text-muted-foreground">sig. hora</span>
        </div>
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
          <span className="text-muted-foreground">Retén</span>
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
      
      {/* Próximo vuelo */}
      {nextFlight && (
        <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
          <span>Próximo:</span>
          <span className="font-medium text-foreground">{nextFlight.hora}</span>
          <span>desde</span>
          <span className="font-medium text-foreground truncate max-w-[60px]">{nextFlight.origen}</span>
        </div>
      )}
    </button>
  );
}
