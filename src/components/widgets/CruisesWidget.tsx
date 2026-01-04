import { Ship, Clock, Users, Anchor } from "lucide-react";

interface CruisesWidgetProps {
  cruceros?: number;
  pax?: number;
  esperaMinutos?: number;
  proximoDesembarco?: string;
}

export function CruisesWidget({ 
  cruceros = 3, 
  pax = 8500, 
  esperaMinutos = 15,
  proximoDesembarco = "10:30"
}: CruisesWidgetProps) {
  return (
    <div className="card-dashboard p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
          <Ship className="h-4 w-4 text-cyan-500" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">Puerto Barcelona</h3>
          <p className="text-xs text-muted-foreground">Cruceros Hoy</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-xl border border-border bg-background/50">
          <div className="flex items-center justify-center gap-1">
            <Anchor className="h-3 w-3 text-cyan-400" />
            <span className="text-xl font-display font-bold text-cyan-400">{cruceros}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">cruceros</p>
        </div>
        <div className="text-center p-2 rounded-xl border border-border bg-background/50">
          <div className="flex items-center justify-center gap-1 text-amber-400">
            <Users className="h-3 w-3" />
            <span className="text-xl font-display font-bold">{(pax / 1000).toFixed(1)}k</span>
          </div>
          <p className="text-[10px] text-muted-foreground">pasajeros</p>
        </div>
        <div className="text-center p-2 rounded-xl border border-border bg-background/50">
          <p className="text-xl font-display font-bold text-purple-400">{proximoDesembarco}</p>
          <p className="text-[10px] text-muted-foreground">próximo</p>
        </div>
      </div>

      {/* Espera en Reten */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <span className="text-xs text-muted-foreground">Espera en retén</span>
        </div>
        <span className="font-display font-bold text-cyan-400">~{esperaMinutos} min</span>
      </div>
    </div>
  );
}
