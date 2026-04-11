import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings, Sun, Cloud, CloudRain, CloudDrizzle, CloudLightning, Snowflake, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWeather } from "@/hooks/useWeather";
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
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  // TODO: reemplazar con notificaciones reales cuando se implementen
  const notifications: { id: string; text: string; time: string; emoji: string }[] = [];

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
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-80 p-0 rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-border/30">
              <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
            </div>
            {notifications.length > 0 ? (
              <div className="max-h-72 overflow-y-auto divide-y divide-border/20">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                    <span className="text-lg mt-0.5 shrink-0">{n.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{n.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                  <BellOff className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin notificaciones</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Cuando haya alertas de vuelos, eventos o lluvia aparecerán aquí.
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
