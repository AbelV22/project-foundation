import { Bell, Sun, Cloud, CloudRain, CloudDrizzle, CloudLightning, Snowflake, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/useWeather";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoItaxiBcn from "@/assets/logo-new.png";

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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 md:px-6">
      {/* LEFT SIDE: Settings, Notifications, Logo */}
      <div className="flex items-center gap-1.5">
        {/* Configuración - Glass button */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-primary hover:bg-primary/10 h-9 w-9 rounded-xl transition-all"
        >
          <Settings className="h-4.5 w-4.5" />
        </Button>

        {/* Notificaciones - Glass button with badge */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-primary hover:bg-primary/10 h-9 w-9 rounded-xl transition-all"
        >
          <Bell className="h-4.5 w-4.5" />
          {/* Notification badge */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
        </Button>

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
