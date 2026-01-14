import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoItaxiBcn from "@/assets/logo-itaxibcn.png";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface MobileHeaderProps {
  title: string;
  onOpenCommandPalette: () => void;
}

export function MobileHeader({ title, onOpenCommandPalette }: MobileHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img 
            src={logoItaxiBcn} 
            alt="iTaxiBcn" 
            className="h-8 w-auto object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
          />
        </div>

        {/* Title */}
        <h1 className="text-sm font-semibold text-foreground truncate max-w-[140px]">
          {title}
        </h1>

        {/* Right side controls */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenCommandPalette}
            className="h-9 w-9"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
}
