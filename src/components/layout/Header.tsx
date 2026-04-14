import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings, Sun, Cloud, CloudRain, CloudDrizzle, CloudLightning, Snowflake, BellOff, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWeather } from "@/hooks/useWeather";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoItaxiBcn from "@/assets/logo-adaptive.png";

interface HeaderProps {
  title: string;
}

// Helper para iconos de clima
const getWeatherIcon = (code: number, className: string) => {
  if (code === 0) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 57) return <CloudDrizzle className={className} />;
  if (code <= 77) return <Snowflake className={className} />;
  if (code <= 86) return <CloudRain className={className} />;
  return <CloudLightning className={className} />;
};

export function Header({ title }: HeaderProps) {
  const { weather, isRainAlert } = useWeather();
  const { alerts, unreadCount, dismissAlert, markAsRead, markAllAsRead } = useSmartAlerts();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  // Format time ago
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };

  const severityColors: Record<string, string> = {
    critical: 'border-l-red-500 bg-red-500/5',
    warning: 'border-l-amber-500 bg-amber-500/5',
    info: 'border-l-blue-500 bg-blue-500/5',
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 md:px-6">
      {/* LEFT SIDE: Notifications, Logo */}
      <div className="flex items-center gap-1.5">
        {/* Configuración */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
          className="relative text-muted-foreground hover:text-primary hover:bg-primary/10 h-9 w-9 rounded-xl transition-all"
        >
          <Settings className="h-4.5 w-4.5" />
        </Button>

        {/* Notificaciones */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-primary hover:bg-primary/10 h-9 w-9 rounded-xl transition-all"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center shadow-[0_0_8px_rgba(250,204,21,0.6)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-80 p-0 rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Alertas {unreadCount > 0 && <span className="text-primary ml-1">({unreadCount})</span>}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar leídas
                </button>
              )}
            </div>
            {alerts.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => { if (!alert.read) markAsRead(alert.id); }}
                    className={`px-4 py-3 flex items-start gap-3 border-l-2 transition-colors cursor-pointer hover:bg-muted/20 ${
                      severityColors[alert.severity] || ''
                    } ${!alert.read ? 'bg-muted/10' : 'opacity-70'}`}
                  >
                    <span className="text-lg mt-0.5 shrink-0">{alert.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!alert.read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                          {alert.title}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }}
                          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground/60">{timeAgo(alert.created_at)}</p>
                        {alert.zone && (
                          <span className="text-[10px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full">
                            {alert.zone}
                          </span>
                        )}
                        {alert.demand_score && alert.demand_score >= 70 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {alert.demand_score}/100
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                  <BellOff className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin alertas</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Te avisaremos de picos de vuelos, lluvia, eventos y demanda inusual.
                </p>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Logo con glow - siempre visible */}
        <div className="relative ml-1">
          <img
            src={logoItaxiBcn}
            alt="iTaxiBcn"
            className="h-9 w-auto object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
          />
        </div>
      </div>

      {/* RIGHT SIDE: Weather, Theme */}
      <div className="flex items-center gap-2">

        {/* Clima dinámico con alerta */}
        <button
          onClick={() => window.open("https://www.eltiempo.es/barcelona.html", "_blank")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-all ${isRainAlert
            ? "bg-rain/20 border-rain/50 animate-pulse"
            : "bg-muted/50 border-border hover:bg-muted"
            }`}
        >
          {weather ? (
            <>
              {getWeatherIcon(weather.weatherCode, `h-4 w-4 ${isRainAlert ? "text-rain" : "text-amber-400"}`)}
              <span className={`font-semibold ${isRainAlert ? "text-rain" : "text-foreground"}`}>
                {weather.temp}°
              </span>
              {weather.rainProbability > 0 && (
                <span className={`text-[10px] ${isRainAlert ? "text-rain" : "text-muted-foreground"}`}>
                  {weather.rainProbability}%
                </span>
              )}
            </>
          ) : (
            <Sun className="h-4 w-4 text-amber-400 animate-pulse" />
          )}
        </button>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
