import { useState, useEffect } from "react";
import { MapPin, Plane, Train, Clock, Users, ChevronRight, Navigation, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
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
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const { recommendations, bestOption, loading, dataStatus, refresh } = useWhereNext(
        currentPos?.lat,
        currentPos?.lng
    );

    // Get current position and refresh recommendations when drawer opens
    useEffect(() => {
        if (open) {
            setLocationLoading(true);
            setLocationError(null);

            getCurrentPosition()
                .then(pos => {
                    if (pos) {
                        console.log('[WhereNextSheet] Got position:', pos.latitude, pos.longitude);
                        setCurrentPos({ lat: pos.latitude, lng: pos.longitude });
                    } else {
                        console.log('[WhereNextSheet] No position returned, using default');
                        // Use Barcelona center as fallback
                        setCurrentPos({ lat: 41.3851, lng: 2.1734 });
                    }
                })
                .catch(err => {
                    console.error('[WhereNextSheet] Location error:', err);
                    setLocationError('No se pudo obtener ubicación');
                    // Use Barcelona center as fallback
                    setCurrentPos({ lat: 41.3851, lng: 2.1734 });
                })
                .finally(() => {
                    setLocationLoading(false);
                });
        }
    }, [open]);

    // Trigger refresh when position changes
    useEffect(() => {
        if (currentPos && open) {
            refresh();
        }
    }, [currentPos, open]);

    const handleRefresh = async () => {
        // Re-fetch location first
        setLocationLoading(true);
        try {
            const pos = await getCurrentPosition();
            if (pos) {
                setCurrentPos({ lat: pos.latitude, lng: pos.longitude });
            }
        } catch (e) {
            console.error('[WhereNextSheet] Refresh location error:', e);
        }
        setLocationLoading(false);
        await refresh();
    };

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

    const isLoading = loading || locationLoading;

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
                        Recomendación basada en vuelos, trenes y esperas reales
                    </p>

                    {/* Data Status Bar */}
                    {dataStatus.lastUpdate && (
                        <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-white/40">
                            <span>✈️ {dataStatus.flightsLoaded} vuelos</span>
                            <span>🚂 {dataStatus.trainsLoaded} trenes</span>
                            <span>⏱️ {dataStatus.lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}

                    {/* Error Display */}
                    {(locationError || dataStatus.errors.length > 0) && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-amber-400">
                            <AlertCircle className="h-3 w-3" />
                            <span>{locationError || dataStatus.errors[0]}</span>
                        </div>
                    )}
                </DrawerHeader>

                <div className="px-4 pb-2 space-y-3 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                            <span className="text-xs text-muted-foreground">
                                {locationLoading ? 'Obteniendo ubicación...' : 'Calculando recomendaciones...'}
                            </span>
                        </div>
                    ) : recommendations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                            <AlertCircle className="h-8 w-8 text-amber-400" />
                            <span className="text-sm text-white/70">No hay datos para mostrar</span>
                            <span className="text-xs text-muted-foreground">Prueba a actualizar</span>
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
                                                <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", getScoreBg(bestOption.score), getScoreColor(bestOption.score))}>
                                                    {bestOption.score}
                                                </span>
                                            </div>
                                            <p className="text-emerald-400 text-sm font-medium mt-0.5">
                                                🏆 Mejor opción ahora
                                            </p>

                                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-white/70">
                                                <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                                    <Navigation className="h-3 w-3" />
                                                    {bestOption.distance} min
                                                </span>
                                                {bestOption.waitingTime !== null ? (
                                                    <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                                        <Clock className="h-3 w-3" />
                                                        ~{bestOption.waitingTime}' espera
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-white/40">
                                                        <Clock className="h-3 w-3" />
                                                        Sin datos
                                                    </span>
                                                )}
                                                {bestOption.upcomingFlights > 0 && (
                                                    <span className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-0.5 rounded">
                                                        <Plane className="h-3 w-3" />
                                                        {bestOption.upcomingFlights} vuelos
                                                    </span>
                                                )}
                                                {bestOption.upcomingTrains > 0 && (
                                                    <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                                        <Train className="h-3 w-3" />
                                                        {bestOption.upcomingTrains} trenes
                                                    </span>
                                                )}
                                                {bestOption.taxistas > 0 && (
                                                    <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                                        <Users className="h-3 w-3" />
                                                        {bestOption.taxistas} taxis
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs text-white/50 mt-2">
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
                                                    <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5", getScoreColor(rec.score))}>
                                                        {rec.score}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50 flex-wrap">
                                                    <span>{rec.distance} min</span>
                                                    {rec.waitingTime !== null ? (
                                                        <span>~{rec.waitingTime}' espera</span>
                                                    ) : (
                                                        <span className="text-white/30">Sin datos</span>
                                                    )}
                                                    {(rec.upcomingFlights > 0 || rec.upcomingTrains > 0) && (
                                                        <span className="text-primary">
                                                            {rec.upcomingFlights > 0 ? `${rec.upcomingFlights} vuelos` : ''}
                                                            {rec.upcomingFlights > 0 && rec.upcomingTrains > 0 ? ' · ' : ''}
                                                            {rec.upcomingTrains > 0 ? `${rec.upcomingTrains} trenes` : ''}
                                                        </span>
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
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="h-11 bg-primary hover:bg-primary/90"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                        {isLoading ? 'Actualizando...' : 'Actualizar'}
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
