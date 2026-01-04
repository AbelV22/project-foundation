import { Train, Clock, Users } from "lucide-react";

interface TrainsWidgetProps {
  trenes?: number;
  pax?: number;
  esperaMinutos?: number;
}

export function TrainsWidget({ trenes = 12, pax = 2400, esperaMinutos = 8 }: TrainsWidgetProps) {
  return (
    <div className="card-dashboard p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
          <Train className="h-4 w-4 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">Estación Sants</h3>
          <p className="text-xs text-muted-foreground">AVE y Rodalies</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 rounded-xl border border-border bg-background/50">
          <p className="text-2xl font-display font-bold text-emerald-400">{trenes}</p>
          <p className="text-xs text-muted-foreground">trenes/hora</p>
        </div>
        <div className="text-center p-3 rounded-xl border border-border bg-background/50">
          <div className="flex items-center justify-center gap-1 text-amber-400">
            <Users className="h-4 w-4" />
            <span className="text-2xl font-display font-bold">{(pax / 1000).toFixed(1)}k</span>
          </div>
          <p className="text-xs text-muted-foreground">pasajeros</p>
        </div>
      </div>

      {/* Espera en Reten */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-muted-foreground">Espera en retén</span>
        </div>
        <span className="font-display font-bold text-emerald-400">~{esperaMinutos} min</span>
      </div>
    </div>
  );
}
