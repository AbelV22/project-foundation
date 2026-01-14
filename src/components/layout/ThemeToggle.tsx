import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Sun className={cn(
            "h-4 w-4 transition-all",
            resolvedTheme === 'dark' ? "scale-0 rotate-90" : "scale-100 rotate-0"
          )} />
          <Moon className={cn(
            "absolute h-4 w-4 transition-all",
            resolvedTheme === 'dark' ? "scale-100 rotate-0" : "scale-0 -rotate-90"
          )} />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={cn(theme === 'light' && "bg-accent")}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={cn(theme === 'dark' && "bg-accent")}
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Oscuro</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("auto")}
          className={cn(theme === 'auto' && "bg-accent")}
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>Automático (BCN)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
