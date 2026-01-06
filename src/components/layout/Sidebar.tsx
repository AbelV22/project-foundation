import { 
  LayoutDashboard, 
  Plane, 
  Calendar, 
  TrendingUp, 
  Bell, 
  Settings,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logoItaxiBcn from "@/assets/logo-itaxibcn.png";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "vuelos", label: "Vuelos BCN", icon: Plane },
  { id: "eventos", label: "Eventos", icon: Calendar },
  { id: "licencias", label: "Licencias", icon: TrendingUp },
  { id: "alertas", label: "Alertas", icon: Bell },
];

export function Sidebar({ activeTab, onTabChange, isOpen, onToggle }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card border border-border"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen w-56 bg-sidebar border-r border-sidebar-border transition-transform duration-300",
        !isOpen && "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-center px-4 py-5 border-b border-sidebar-border">
            <img 
              src={logoItaxiBcn} 
              alt="iTaxiBcn" 
              className="h-12 w-auto object-contain drop-shadow-lg"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={cn(
                  "nav-link w-full",
                  activeTab === item.id && "nav-link-active"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-sidebar-border p-3">
            <button className="nav-link w-full">
              <Settings className="h-5 w-5" />
              <span className="font-medium">Configuración</span>
            </button>
            <button className="nav-link w-full text-destructive hover:text-destructive">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
