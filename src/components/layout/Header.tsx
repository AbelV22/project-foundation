import { Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";

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
      <div className="flex items-center gap-4">
        {/* Mobile menu spacer */}
        <div className="w-10 lg:hidden" />
        
        <div>
          <h1 className="font-display text-lg md:text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-xs md:text-sm text-muted-foreground capitalize hidden sm:block">{currentDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:block">
          <WeatherWidget compact />
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            3
          </span>
        </Button>

        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-border">
          <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-primary">
            <User className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground">Juan García</p>
            <p className="text-xs text-muted-foreground">Licencia #4521</p>
          </div>
        </div>
      </div>
    </header>
  );
}
