import { Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import logoItaxiBcn from "@/assets/logo-itaxibcn.png";

interface HeaderProps {
  title: string;
  onMenuToggle?: () => void;
}

export function Header({ title, onMenuToggle }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu spacer */}
        <div className="w-10 lg:hidden" />
        
        {/* Logo - Visible solo en móvil y tablet con efecto glow */}
        <div className="lg:hidden relative">
          <img 
            src={logoItaxiBcn} 
            alt="iTaxiBcn" 
            className="h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
          />
        </div>
        
        <div className="hidden sm:block">
          <h1 className="font-display text-lg md:text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-xs md:text-sm text-muted-foreground capitalize hidden md:block">{currentDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:block">
          <WeatherWidget compact />
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
