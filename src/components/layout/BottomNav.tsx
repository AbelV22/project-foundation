import {
  LayoutDashboard,
  Plane,
  Train,
  Calendar,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard, target: "dashboard" },
  { id: "vuelos", label: "Vuelos", icon: Plane, target: "fullDay" },
  { id: "trenes", label: "Trenes", icon: Train, target: "trainsFullDay" },
  { id: "eventos", label: "Eventos", icon: Calendar, target: "eventos" },
  { id: "gastos", label: "Gastos", icon: TrendingDown, target: "gastos" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  // Determine if current tab is a main tab or a sub-view
  const getActiveItem = () => {
    for (const item of navItems) {
      if (activeTab === item.target) return item.id;
      if (item.id === "vuelos" && (activeTab === "terminalDetail" || activeTab === "fullDay" || activeTab === "vuelos")) return "vuelos";
      if (item.id === "trenes" && (activeTab === "trainsFullDay" || activeTab === "trainsByCity" || activeTab === "trainsByOperator" || activeTab === "trenes")) return "trenes";
    }
    return "dashboard";
  };

  const activeItemId = getActiveItem();

  return (
    <nav className="bottom-nav-glass">
      {/* Glow effect behind active item */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="relative w-full h-full flex items-center justify-around px-2">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "w-14 h-10 rounded-xl transition-all duration-500",
                activeItemId === item.id && "nav-glow-pulse"
              )}
            />
          ))}
        </div>
      </div>

      {/* Navigation Items */}
      <div className="relative flex items-center justify-around h-full px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeItemId === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.target)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-300 min-w-[56px]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isActive
                  ? "nav-item-active"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              {/* Active Background Pill */}
              {isActive && (
                <div className="absolute inset-0 nav-pill-active rounded-xl" />
              )}

              {/* Icon */}
              <Icon
                className={cn(
                  "relative z-10 transition-all duration-300",
                  isActive
                    ? "h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                    : "h-5 w-5"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />

              {/* Label - Only show for active item on mobile, all on desktop */}
              <span
                className={cn(
                  "relative z-10 text-[10px] font-semibold leading-none transition-all duration-300",
                  isActive
                    ? "text-primary opacity-100 translate-y-0"
                    : "text-muted-foreground opacity-0 -translate-y-1 sm:opacity-100 sm:translate-y-0"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Subtle top highlight line */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
    </nav>
  );
}
