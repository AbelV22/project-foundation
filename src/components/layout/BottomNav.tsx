import { 
  LayoutDashboard, 
  Plane, 
  Train,
  Calendar, 
  TrendingUp, 
  Bell
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
  { id: "licencias", label: "Licencias", icon: TrendingUp, target: "licencias" },
  { id: "alertas", label: "Alertas", icon: Bell, target: "alertas" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  // Only show main navigation items, not detail views
  const isMainTab = navItems.some(item => item.id === activeTab);
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.target || 
            (item.id === "vuelos" && (activeTab === "terminalDetail" || activeTab === "fullDay" || activeTab === "vuelos")) ||
            (item.id === "trenes" && (activeTab === "trainsFullDay" || activeTab === "trainsByCity" || activeTab === "trainsByOperator" || activeTab === "trenes"));
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.target)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium leading-none",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
