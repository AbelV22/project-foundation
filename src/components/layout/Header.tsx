import { Bell, Sun, Cloud, CloudRain, CloudDrizzle, CloudLightning, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/useWeather";
import logoItaxiBcn from "@/assets/logo-itaxibcn.png";
import { useState, useEffect } from "react";

interface HeaderProps {
  title: string;
  onMenuToggle?: () => void;
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

export function Header({ title, onMenuToggle }: HeaderProps) {
  const { weather, isRainAlert } = useWeather();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar hora cada minuto
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const horaActual = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 md:px-6">
      <div className="flex items-center gap-2">
        {/* Mobile menu spacer */}
        <div className="w-8 lg:hidden" />
        
        {/* Logo con glow */}
        <div className="lg:hidden relative ml-2">
          <img 
            src={logoItaxiBcn} 
            alt="iTaxiBcn" 
            className="h-9 w-auto object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
          />
        </div>
        
        {/* Desktop: título y fecha */}
        <div className="hidden lg:block">
          <h1 className="font-display text-lg md:text-2xl font-bold text-foreground">{title}</h1>
        </div>
      </div>

      {/* Hora + Clima dinámico (API Open-Meteo Barcelona) */}
      <div className="flex items-center gap-2">
        {/* Hora actual - prominente */}
        <p className="font-display font-bold text-xl text-foreground">{horaActual}</p>
        
        {/* Clima dinámico con alerta */}
        <button 
          onClick={() => window.open("https://www.eltiempo.es/barcelona.html", "_blank")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-all ${
            isRainAlert 
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

        {/* Notificaciones - solo desktop */}
        <Button variant="ghost" size="icon" className="hidden md:flex relative text-muted-foreground hover:text-foreground h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
