import { Bell, Trash2, CheckCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { useSmartAlerts, SmartAlert } from "@/hooks/useSmartAlerts";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface AlertsViewProps {
  onBack?: () => void;
}

const severityConfig: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  critical: {
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    label: 'Crítica',
  },
  warning: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    label: 'Importante',
  },
  info: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    label: 'Info',
  },
};

const alertTypeLabels: Record<string, string> = {
  flight_peak: 'Pico de vuelos',
  rain_demand: 'Lluvia',
  event_surge: 'Evento',
  high_demand: 'Alta demanda',
  cruise_arrival: 'Crucero',
  low_supply: 'Pocos taxis',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

function AlertCard({ alert, onDismiss }: { alert: SmartAlert; onDismiss: (id: string) => void }) {
  const config = severityConfig[alert.severity] || severityConfig.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`rounded-2xl border ${config.border} ${config.bg} p-4 transition-all ${
        !alert.read ? 'ring-1 ring-primary/20' : 'opacity-75'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 shrink-0">{alert.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm ${!alert.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
              {alert.title}
            </h3>
            <button
              onClick={() => onDismiss(alert.id)}
              className="shrink-0 p-1 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {alert.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
              {alertTypeLabels[alert.alert_type] || alert.alert_type}
            </span>
            {alert.zone && (
              <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
                📍 {alert.zone}
              </span>
            )}
            {alert.demand_score && alert.demand_score >= 60 && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                Score: {alert.demand_score}/100
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/50 ml-auto">
              {timeAgo(alert.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AlertsView({ onBack }: AlertsViewProps) {
  const { alerts, unreadCount, loading, dismissAlert, markAllAsRead, refresh } = useSmartAlerts();

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  return (
    <div className="space-y-4">
      {/* Header actions */}
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-foreground">{alerts.length}</span>
              <span className="text-muted-foreground ml-1">alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
              {unreadCount} sin leer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8 gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar leídas
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={refresh} className="h-8 w-8" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alert categories */}
      {alerts.length > 0 ? (
        <div className="space-y-4">
          {criticalAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Críticas
              </h4>
              <AnimatePresence>
                {criticalAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {warningAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Importantes
              </h4>
              <AnimatePresence>
                {warningAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {infoAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Informativas
              </h4>
              <AnimatePresence>
                {infoAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-8 text-center gap-5">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Todo tranquilo</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              No hay alertas activas ahora mismo. Te avisaremos cuando detectemos condiciones inusuales.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2 mt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold mb-2">
              Tipos de alertas
            </p>
            {[
              { emoji: "✈️", text: "Picos de llegadas al aeropuerto", desc: "Cuando hay más vuelos de lo normal" },
              { emoji: "🌧️", text: "Lluvia y alta demanda", desc: "Aumento de demanda por meteorología" },
              { emoji: "🎭", text: "Eventos masivos", desc: "Conciertos, partidos, congresos" },
              { emoji: "🚢", text: "Llegada de cruceros", desc: "Desembarque de pasajeros" },
              { emoji: "🔥", text: "Demanda inusualmente alta", desc: "Score por encima de lo normal" },
              { emoji: "🚕", text: "Pocos taxis disponibles", desc: "Ratio pasajeros/taxi muy alto" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3 border border-border/50 text-left"
              >
                <span className="text-lg shrink-0">{item.emoji}</span>
                <div>
                  <p className="text-sm text-foreground font-medium">{item.text}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
