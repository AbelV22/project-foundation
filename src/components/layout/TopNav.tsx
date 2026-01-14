import { 
  LayoutDashboard, 
  Plane, 
  Train,
  Calendar, 
  TrendingUp, 
  Bell,
  Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoItaxiBcn from "@/assets/logo-itaxibcn.png";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface TopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCommandPalette: () => void;
}

const navItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard, target: "dashboard" },
  { id: "vuelos", label: "Vuelos", icon: Plane, target: "fullDay" },
  { id: "trenes", label: "Trenes", icon: Train, target: "trainsFullDay" },
  { id: "eventos", label: "Eventos", icon: Calendar, target: "eventos" },
  { id: "licencias", label: "Licencias", icon: TrendingUp, target: "licencias" },
  { id: "alertas", label: "Alertas", icon: Bell, target: "alertas" },
];

export function TopNav({ activeTab, onTabChange, onOpenCommandPalette }: TopNavProps) {
  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 h-16 bg-card/95 backdrop-blur-xl border-b border-border items-center justify-between px-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <img 
          src={logoItaxiBcn} 
          alt="iTaxiBcn" 
          className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]"
        />
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
        {navItems.map((item) => {
          const isActive = activeTab === item.target || 
            (item.id === "vuelos" && (activeTab === "terminalDetail" || activeTab === "fullDay" || activeTab === "vuelos")) ||
            (item.id === "trenes" && (activeTab === "trainsFullDay" || activeTab === "trainsByCity" || activeTab === "trainsByOperator" || activeTab === "trenes"));
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.target)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          className="gap-2 text-muted-foreground"
        >
          <Command className="h-4 w-4" />
          <span className="text-xs">Buscar</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>
    </header>
  );
}
