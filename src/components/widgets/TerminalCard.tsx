import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalCardProps {
  id: string;
  name: string;
  vuelosProximaHora: number;
  vuelosSiguienteHora: number;
  esperaMinutos: number;
  contribuidores?: number;
  onClick?: () => void;
}

export function TerminalCard({ 
  id, 
  name, 
  vuelosProximaHora, 
  vuelosSiguienteHora, 
  esperaMinutos, 
  contribuidores = 0,
  onClick 
}: TerminalCardProps) {
  const esperaLevel = esperaMinutos <= 10 ? "low" : esperaMinutos <= 25 ? "medium" : "high";
  const isHighDemand = vuelosProximaHora >= 8;
  
  return (
    <button 
      onClick={onClick}
      className="w-full p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all group text-left"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{name}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </div>
      
      {/* Big Number */}
      <div className="mb-2">
        <span className={cn(
          "font-mono font-black text-4xl tabular-nums tracking-tight",
          isHighDemand ? "text-foreground" : "text-muted-foreground/60"
        )}>
          {vuelosProximaHora}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">vuelos/h</span>
      </div>

      {/* Next hour */}
      {vuelosSiguienteHora > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          +{vuelosSiguienteHora} próx. hora
        </div>
      )}

      {/* Retén Badge - High Contrast */}
      <div className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold",
        esperaLevel === "low" && "bg-success text-success-foreground",
        esperaLevel === "medium" && "bg-warning text-warning-foreground",
        esperaLevel === "high" && "bg-destructive text-destructive-foreground"
      )}>
        <Clock className="h-2.5 w-2.5" />
        ~{esperaMinutos} min
      </div>
      
      {/* Social Proof */}
      {contribuidores > 0 && (
        <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{contribuidores} taxista{contribuidores > 1 ? 's' : ''} informaron</span>
        </div>
      )}
    </button>
  );
}
