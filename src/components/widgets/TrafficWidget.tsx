import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Car, ChevronDown, Info, MapPin, TrafficCone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useTrafficIncidents, type TrafficIncident, type TrafficIncidentKind } from "@/hooks/useTrafficIncidents";

const KIND_STYLE: Record<TrafficIncidentKind, { icon: typeof Car; color: string; bg: string; label: string }> = {
  accidente: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", label: "Accidente" },
  corte: { icon: Ban, color: "text-red-400", bg: "bg-red-500/10", label: "Cortado" },
  retencion: { icon: Car, color: "text-amber-400", bg: "bg-amber-500/10", label: "Retención" },
  congestion: { icon: TrafficCone, color: "text-amber-400", bg: "bg-amber-500/10", label: "Congestión" },
  aviso: { icon: Info, color: "text-sky-400", bg: "bg-sky-500/10", label: "Aviso" },
};

const COLLAPSED_COUNT = 3;
const SEEN_KEY = "traffic_seen_alerts";

// Only sudden events deserve a pop-up: accidents and road closures reported
// by the SCT. City closures for roadworks last weeks and stay in the list.
const isAlertWorthy = (i: TrafficIncident) =>
  i.kind === "accidente" || (i.kind === "corte" && i.source === "sct");

const hhmm = (d: Date) => d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

// When the incident started, so drivers can tell a fresh accident from an
// old one: "desde 10:43 · hace 22 min" today, "desde 27 may" if older.
const sinceLabel = (iso: string | null): string | null => {
  if (!iso) return null;
  const start = new Date(iso);
  const minutes = Math.round((Date.now() - start.getTime()) / 60000);
  if (Number.isNaN(minutes) || minutes < 0) return null;
  if (minutes < 60) return `desde ${hhmm(start)} · hace ${minutes} min`;
  if (minutes < 24 * 60) return `desde ${hhmm(start)} · hace ${Math.floor(minutes / 60)} h`;
  return `desde ${start.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
};

// Sync runs every 3 min; past this the data is shown as stale.
const STALE_AFTER_MIN = 15;

const mapsUrl = (i: TrafficIncident) =>
  i.lat != null && i.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${i.lat},${i.lng}`
    : null;

export function TrafficWidget() {
  const { incidents, loading } = useTrafficIncidents();
  const [expanded, setExpanded] = useState(false);

  // Pop up new accidents/closures that appear while the app is open. The
  // first load only records what is already there, so opening the app
  // doesn't flood the screen.
  useEffect(() => {
    if (loading) return;
    const alertWorthy = incidents.filter(isAlertWorthy);

    let seen: string[] | null = null;
    try {
      const raw = sessionStorage.getItem(SEEN_KEY);
      seen = raw ? JSON.parse(raw) : null;
    } catch {
      // storage unavailable
    }

    if (seen) {
      for (const i of alertWorthy.filter((i) => !seen!.includes(i.id))) {
        toast({
          title: `${KIND_STYLE[i.kind].label}: ${i.road ?? "tráfico"}`,
          description: i.title,
          variant: "destructive",
        });
      }
    }

    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(alertWorthy.map((i) => i.id)));
    } catch {
      // storage unavailable
    }
  }, [incidents, loading]);

  if (loading) return null;

  const serious = incidents.filter((i) => i.kind === "accidente" || i.kind === "corte").length;
  const visible = expanded ? incidents : incidents.slice(0, COLLAPSED_COUNT);

  const lastUpdate = incidents.reduce<Date | null>((latest, i) => {
    const d = new Date(i.updated_at);
    return !latest || d > latest ? d : latest;
  }, null);
  const stale = lastUpdate ? (Date.now() - lastUpdate.getTime()) / 60000 > STALE_AFTER_MIN : false;

  return (
    <section className="space-y-2 animate-fade-in-up" style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}>
      <div className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <TrafficCone className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Incidentes</span>
          {serious > 0 && (
            <>
              <span className="font-mono text-lg font-bold text-red-400 tabular-nums">{serious}</span>
              <span className="text-[10px] text-muted-foreground">{serious === 1 ? "corte o accidente" : "cortes o accidentes"}</span>
            </>
          )}
        </div>
        {lastUpdate && (
          <span className={cn("text-[10px] tabular-nums", stale ? "text-amber-400" : "text-muted-foreground")}>
            {stale ? "Sin actualizar desde" : "Actualizado"} {hhmm(lastUpdate)}
          </span>
        )}
      </div>

      {incidents.length === 0 ? (
        <div className="card-glass p-3 text-center">
          <p className="text-sm text-muted-foreground">Sin incidentes de tráfico en Barcelona</p>
        </div>
      ) : (
        <div className="card-glass p-3 space-y-2">
          {visible.map((i) => {
            const style = KIND_STYLE[i.kind];
            const Icon = style.icon;
            const url = mapsUrl(i);
            const since = sinceLabel(i.started_at);
            return (
              <div key={i.id} className="flex items-start gap-2.5">
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", style.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", style.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{i.title}</p>
                  {i.detail && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{i.detail}</p>
                  )}
                  {since && (
                    <p className="text-[10px] text-muted-foreground/80 tabular-nums">{since}</p>
                  )}
                </div>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Ver en el mapa"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })}

          {incidents.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="w-full pt-2 border-t border-border/40 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? "Ver menos" : `Ver todas (${incidents.length})`}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
