import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { 
  LayoutDashboard, 
  Plane, 
  Train,
  Calendar, 
  TrendingUp, 
  Bell,
  Settings,
  Search
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
}

const navigationItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard, keywords: ["home", "inicio", "principal"] },
  { id: "vuelos", label: "Vuelos Aeropuerto BCN", icon: Plane, keywords: ["flights", "airport", "aeropuerto", "avion"] },
  { id: "trenes", label: "Trenes Sants", icon: Train, keywords: ["trains", "renfe", "ave", "estacion"] },
  { id: "eventos", label: "Eventos Barcelona", icon: Calendar, keywords: ["events", "conciertos", "futbol", "espectaculos"] },
  { id: "licencias", label: "Precio Licencias Taxi", icon: TrendingUp, keywords: ["license", "precio", "transferencia"] },
  { id: "alertas", label: "Alertas y Notificaciones", icon: Bell, keywords: ["notifications", "avisos"] },
];

const quickActions = [
  { id: "fullDay", label: "Ver vuelos del día completo", icon: Plane, keywords: ["all flights", "todos vuelos"] },
  { id: "trainsFullDay", label: "Ver trenes del día completo", icon: Train, keywords: ["all trains", "todos trenes"] },
];

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = (id: string) => {
    onNavigate(id);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar sección o acción..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        
        <CommandGroup heading="Navegación">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords.join(" ")}`}
              onSelect={() => handleSelect(item.id)}
              className="gap-3 cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Acciones rápidas">
          {quickActions.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords.join(" ")}`}
              onSelect={() => handleSelect(item.id)}
              className="gap-3 cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/50">
                <item.icon className="h-4 w-4 text-accent-foreground" />
              </div>
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
