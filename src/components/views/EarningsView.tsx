import { useEarnings } from "@/hooks/useEarnings";
import { ArrowLeft, Calendar, CreditCard, Euro, Banknote, MapPin, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EarningsViewProps {
    onBack: () => void;
}

export function EarningsView({ onBack }: EarningsViewProps) {
    const { carreras, stats, loading } = useEarnings();

    // Group carreras by day
    const groupedCarreras = carreras.reduce((groups, carrera) => {
        const date = new Date(carrera.created_at).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(carrera);
        return groups;
    }, {} as Record<string, typeof carreras>);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground text-sm">Cargando registros...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-white" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-white">Registro de Ingresos</h2>
                    <p className="text-xs text-muted-foreground">Historial detallado de carreras</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="card-glass p-4 space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-12 w-12" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Hoy</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white tracking-tight">{stats.today.toFixed(0)}</span>
                        <span className="text-sm font-bold text-primary">€</span>
                    </div>
                    <p className="text-[10px] text-emerald-400 font-medium bg-emerald-400/10 inline-block px-1.5 py-0.5 rounded-full">
                        {stats.todayCount} carreras
                    </p>
                </div>

                <div className="card-glass p-4 space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Calendar className="h-12 w-12" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Esta Semana</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white tracking-tight">{stats.week.toFixed(0)}</span>
                        <span className="text-sm font-bold text-primary">€</span>
                    </div>
                    <p className="text-[10px] text-blue-400 font-medium bg-blue-400/10 inline-block px-1.5 py-0.5 rounded-full">
                        {stats.weekCount} carreras
                    </p>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Historial Reciente</h3>

                {Object.entries(groupedCarreras).length === 0 ? (
                    <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-white/5 mx-auto max-w-sm">
                        <div className="bg-slate-800/50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <Euro className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-muted-foreground font-medium">No hay registros aún</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] mx-auto">
                            Añade tu primera carrera usando el botón +
                        </p>
                    </div>
                ) : (
                    Object.entries(groupedCarreras).map(([date, dayCarreras]) => (
                        <div key={date} className="space-y-2">
                            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 px-1 border-b border-border/50">
                                <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(date), "EEEE, d 'de' MMMM", { locale: es }).toUpperCase()}
                                </h4>
                            </div>

                            <div className="space-y-2">
                                {dayCarreras.map((carrera) => (
                                    <div
                                        key={carrera.id}
                                        className="card-glass p-3 flex items-center justify-between group hover:border-primary/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center border",
                                                carrera.metodo_pago === 'tarjeta'
                                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                            )}>
                                                {carrera.metodo_pago === 'tarjeta' ? (
                                                    <CreditCard className="h-5 w-5" />
                                                ) : (
                                                    <Banknote className="h-5 w-5" />
                                                )}
                                            </div>

                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-lg">
                                                        {carrera.importe}€
                                                    </span>
                                                    {carrera.propina > 0 && (
                                                        <span className="text-[10px] font-medium bg-amber-500/10 text-amber-500 px-1.5 rounded-sm">
                                                            +{carrera.propina}€
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(carrera.created_at), "HH:mm")}
                                                    </span>
                                                    {carrera.zona && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="flex items-center gap-0.5 text-slate-400">
                                                                <MapPin className="h-3 w-3" />
                                                                {carrera.zona}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
