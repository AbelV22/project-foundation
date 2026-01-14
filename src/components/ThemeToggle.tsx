import { Sun, Moon, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Theme toggle button that cycles through: Auto -> Light -> Dark
 * Auto mode switches based on Barcelona daytime/nighttime
 */
export function ThemeToggle() {
    const { themeSetting, toggleTheme, effectiveTheme } = useTheme();

    const getIcon = () => {
        switch (themeSetting) {
            case 'auto':
                return <SunMoon className="h-4 w-4" />;
            case 'light':
                return <Sun className="h-4 w-4" />;
            case 'dark':
                return <Moon className="h-4 w-4" />;
            default:
                return <SunMoon className="h-4 w-4" />;
        }
    };

    const getLabel = () => {
        switch (themeSetting) {
            case 'auto':
                return `Auto (${effectiveTheme === 'light' ? 'día' : 'noche'})`;
            case 'light':
                return 'Modo claro';
            case 'dark':
                return 'Modo oscuro';
            default:
                return 'Auto';
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="relative text-muted-foreground hover:text-foreground h-8 w-8"
                >
                    {getIcon()}
                    {themeSetting === 'auto' && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{getLabel()}</p>
            </TooltipContent>
        </Tooltip>
    );
}
