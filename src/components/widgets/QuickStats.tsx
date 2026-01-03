import { Plane, Calendar, TrendingUp, CloudRain } from "lucide-react";

interface StatCard {
  label: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  iconColor: string;
  valueColor?: string;
}

const stats: StatCard[] = [
  {
    label: "Vuelos Hoy",
    value: "119",
    subtext: "llegadas pendientes",
    icon: Plane,
    iconColor: "text-info",
    valueColor: "text-info",
  },
  {
    label: "Eventos",
    value: "4",
    subtext: "esta semana",
    icon: Calendar,
    iconColor: "text-purple-400",
    valueColor: "text-purple-400",
  },
  {
    label: "Licencia",
    value: "152k€",
    subtext: "mediana actual",
    icon: TrendingUp,
    iconColor: "text-primary",
    valueColor: "text-primary",
  },
  {
    label: "Lluvia",
    value: "75%",
    subtext: "probabilidad hoy",
    icon: CloudRain,
    iconColor: "text-cyan-400",
    valueColor: "text-cyan-400",
  },
];

export function QuickStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat) => (
        <div 
          key={stat.label}
          className="card-dashboard p-4 md:p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
            <stat.icon className={`h-5 w-5 md:h-6 md:w-6 ${stat.iconColor}`} />
          </div>
          <p className={`text-2xl md:text-4xl font-bold tracking-tight ${stat.valueColor || 'text-foreground'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {stat.value}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">{stat.subtext}</p>
        </div>
      ))}
    </div>
  );
}
