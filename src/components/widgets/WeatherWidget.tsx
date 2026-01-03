import { Cloud, CloudRain, Sun, Droplets, Wind } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeatherWidgetProps {
  compact?: boolean;
}

const weatherData = {
  temp: 18,
  condition: "cloudy",
  rainProbability: 75,
  humidity: 68,
  wind: 15,
  forecast: [
    { hour: "14:00", temp: 18, rain: 30 },
    { hour: "16:00", temp: 17, rain: 65 },
    { hour: "18:00", temp: 16, rain: 80 },
    { hour: "20:00", temp: 15, rain: 45 },
  ]
};

const isRainAlert = weatherData.rainProbability >= 60;

export function WeatherWidget({ compact = false }: WeatherWidgetProps) {
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
        isRainAlert ? "bg-rain/10 text-rain border border-rain/20" : "bg-muted"
      )}>
        {isRainAlert ? (
          <>
            <CloudRain className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">{weatherData.rainProbability}% lluvia</span>
          </>
        ) : (
          <>
            <Sun className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{weatherData.temp}°C</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card-dashboard p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm md:text-base">Tiempo en Barcelona</h3>
        {isRainAlert && (
          <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-rain/10 text-rain text-xs md:text-sm border border-rain/20">
            <CloudRain className="h-3 w-3 md:h-4 md:w-4 animate-pulse" />
            <span>Alerta lluvia</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          {isRainAlert ? (
            <CloudRain className="h-10 w-10 md:h-12 md:w-12 text-rain" />
          ) : (
            <Cloud className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
          )}
          <div>
            <p className="text-3xl md:text-4xl font-bold font-display text-foreground">{weatherData.temp}°C</p>
            <p className="text-xs md:text-sm text-muted-foreground">Nublado</p>
          </div>
        </div>

        <div className="flex gap-4 text-xs md:text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="h-3 w-3 md:h-4 md:w-4 text-rain" />
            <span>{weatherData.humidity}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Wind className="h-3 w-3 md:h-4 md:w-4" />
            <span>{weatherData.wind} km/h</span>
          </div>
        </div>
      </div>

      {/* Rain probability bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs md:text-sm mb-1.5">
          <span className="text-muted-foreground">Probabilidad de lluvia</span>
          <span className={cn("font-semibold", isRainAlert ? "text-rain" : "text-foreground")}>
            {weatherData.rainProbability}%
          </span>
        </div>
        <div className="h-1.5 md:h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isRainAlert ? "bg-rain" : "bg-info"
            )}
            style={{ width: `${weatherData.rainProbability}%` }}
          />
        </div>
      </div>

      {/* Hourly forecast */}
      <div className="grid grid-cols-4 gap-1.5 md:gap-2">
        {weatherData.forecast.map((hour) => (
          <div key={hour.hour} className="text-center p-2 md:p-3 rounded-lg bg-muted border border-border">
            <p className="text-xs text-muted-foreground mb-1">{hour.hour}</p>
            <p className="text-xs md:text-sm font-medium text-foreground">{hour.temp}°</p>
            <div className="flex items-center justify-center gap-0.5 md:gap-1 mt-1">
              <Droplets className="h-2.5 w-2.5 md:h-3 md:w-3 text-rain" />
              <span className="text-xs text-rain">{hour.rain}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
