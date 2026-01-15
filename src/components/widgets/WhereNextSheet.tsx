import { useState, useEffect } from "react";
import { MapPin, Plane, Train, Clock, Users, ChevronRight, Navigation, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useWhereNext } from "@/hooks/useWhereNext";
import { getCurrentPosition } from "@/services/native/geolocation";

export function WhereNextSheet() {
    const [open, setOpen] = useState(false);
    const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);

    const { recommendations, bestOption, loading, refresh } = useWhereNext(
        currentPos?.lat,
        currentPos?.lng
    );

    // Get current position when drawer opens
    useEffect(() => {
        if (open) {
            getCurrentPosition().then(pos => {
                if (pos) {
                    setCurrentPos({ lat: pos.latitude, lng: pos.longitude });
                }
            });
        }
    }, [open]);

    const getTypeIcon = (type: 'airport' | 'train' | 'port' | 'city') => {
        switch (type) {
            case 'airport': return <Plane className="h-4 w-4" />;
            case 'train': return <Train className="h-4 w-4" />;
            default: return <MapPin className="h-4 w-4" />;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-500/20 border-emerald-500/30';
        if (score >= 50) return 'bg-amber-500/20 border-amber-500/30';
        return 'bg-red-500/20 border-red-500/30';
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <button
                    className="fixed bottom-20 left-4 z-40 h-14 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 flex items-center gap-2 text-white font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-95"
                    aria-label="¿A Dónde Voy?"
                >
                    <Navigation className="h-5 w-5" />
                    <span className="text-sm">¿A Dónde?</span>
                </button>
            </DrawerTrigger>

            <DrawerContent className="bg-slate-900 border-slate-700 max-h-[85vh]">
                <DrawerHeader className="text-center pb-2">
                    <DrawerTitle className="text-white text-xl flex items-center justify-center gap-2">
                        <Sparkles className="h-5 w-5 text-emerald-400" />
                        ¿A Dónde Voy?
                    </DrawerTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Recomendación inteligente basada en vuelos y esperas
                    </p>
                </DrawerHeader>

                <div className="px-4 pb-2 space-y-3 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Best Option - Highlighted */}
                            {bestOption && (
                                <div className={cn(
                                    "p-4 rounded-xl border-2 transition-all",
                                    getScoreBg(bestOption.score)
                                )}>
                                    <div className="flex items-start gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                                            {getTypeIcon(bestOption.type)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white text-lg">{bestOption.zoneName}</span>
                                                <span className={cn("text-xs font-bold", getScoreColor(bestOption.score))}>
                                                    ★ {bestOption.score}
                                                </span>
                                            </div>
                                            <p className="text-emerald-400 text-sm font-medium mt-0.5">
                                                🏆 Mejor opción ahora
                                            </p>

                                            <div className="flex items-center gap-3 mt-2 text-xs text-white/70">
                                                {bestOption.distance && (
                                                    <span className="flex items-center gap-1">
                                                        <Navigation className="h-3 w-3" />
                                                        {bestOption.distance} min
                                                    </span>
                                                )}
                                                {bestOption.waitingTime !== null && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        ~{bestOption.waitingTime}'
                                                    </span>
                                                )}
                                                {bestOption.upcomingEvents > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Plane className="h-3 w-3" />
                                                        {bestOption.upcomingEvents} llegadas
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs text-white/50 mt-2 italic">
                                                {bestOption.reason}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="flex items-center gap-2 px-1">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Alternativas</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Other Options */}
                            <div className="space-y-2">
                                {recommendations.slice(1).map((rec) => (
                                    <div
                                        key={rec.zone}
                                        className="p-3 rounded-xl bg-slate-800/50 border border-white/5 hover:border-white/10 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                                                {getTypeIcon(rec.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-white text-sm">{rec.zoneName}</span>
                                                    <span className={cn("text-xs font-semibold", getScoreColor(rec.score))}>
                                                        {rec.score}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[10px] text-white/50">
                                                    {rec.distance && (
                                                        <span>{rec.distance} min</span>
                                                    )}
                                                    {rec.waitingTime !== null ? (
                                                        <span>Espera ~{rec.waitingTime}'</span>
                                                    ) : (
                                                        <span className="text-white/30">Sin datos</span>
                                                    )}
                                                    {rec.upcomingEvents > 0 && (
                                                        <span>{rec.upcomingEvents} lleg.</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-white/20" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <DrawerFooter className="pt-2">
                    <Button
                        onClick={() => {
                            refresh();
                        }}
                        variant="outline"
                        className="h-11 border-white/10 text-white/70 hover:text-white"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                    <DrawerClose asChild>
                        <Button variant="ghost" className="text-muted-foreground">
                            Cerrar
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
