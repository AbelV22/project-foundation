import { useTickets } from "@/hooks/useTickets";
import { ArrowLeft, Calendar, Receipt, Route, Euro, Car, TrendingUp, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TicketsViewProps {
    onBack: () => void;
}

export function TicketsView({ onBack }: TicketsViewProps) {
    const { tickets, stats, loading } = useTickets();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                <p className="text-muted-foreground text-sm">Cargando tickets...</p>
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
                    <h2 className="text-xl font-bold text-white">Tickets Taxitronic</h2>
                    <p className="text-xs text-muted-foreground">Historial de tickets de fin de día</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
                <div className="card-glass p-3 space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Route className="h-8 w-8" />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium">Km semana</p>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-white tracking-tight">
                            {stats.weekKm > 0 ? stats.weekKm.toFixed(0) : '—'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400">km</span>
                    </div>
                </div>

                <div className="card-glass p-3 space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Euro className="h-8 w-8" />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium">Ingresos semana</p>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-white tracking-tight">
                            {stats.weekIngresos > 0 ? stats.weekIngresos.toFixed(0) : '—'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400">€</span>
                    </div>
                </div>

                <div className="card-glass p-3 space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Car className="h-8 w-8" />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium">Carreras semana</p>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-white tracking-tight">
                            {stats.weekCarreras > 0 ? stats.weekCarreras : '—'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Monthly summary */}
            <div className="card-glass p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <BarChart3 className="h-4 w-4 text-amber-400" />
                    Resumen mensual
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="text-[10px] text-muted-foreground">Media diaria</p>
                        <p className="text-sm font-bold text-white">
                            {stats.avgDailyIngresos > 0 ? stats.avgDailyIngresos.toFixed(0) + '€' : '—'}
                            {stats.avgDailyKm > 0 && (
                                <span className="text-muted-foreground font-normal"> · {stats.avgDailyKm.toFixed(0)} km</span>
                            )}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground">Total mes</p>
                        <p className="text-sm font-bold text-white">
                            {stats.monthIngresos > 0 ? stats.monthIngresos.toFixed(0) + '€' : '—'}
                            {stats.monthKm > 0 && (
                                <span className="text-muted-foreground font-normal"> · {stats.monthKm.toFixed(0)} km</span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Ticket List */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Historial de Tickets</h3>

                {tickets.length === 0 ? (
                    <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-white/5 mx-auto max-w-sm">
                        <div className="bg-slate-800/50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <Receipt className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-muted-foreground font-medium">No hay tickets aún</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] mx-auto">
                            Sube tu primer ticket de fin de día usando el botón de la izquierda
                        </p>
                    </div>
                ) : (
                    tickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            className="card-glass p-4 space-y-2 hover:border-amber-500/30 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                        <Receipt className="h-4 w-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            {format(new Date(ticket.fecha + 'T12:00:00'), "EEEE d MMM", { locale: es })}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {format(new Date(ticket.created_at), "HH:mm", { locale: es })}
                                        </p>
                                    </div>
                                </div>
                                {ticket.ingresos_totales && (
                                    <span className="text-lg font-black text-white">
                                        {Number(ticket.ingresos_totales).toFixed(0)}€
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {ticket.km_totales && (
                                    <span className="flex items-center gap-1">
                                        <Route className="h-3 w-3 text-amber-400" />
                                        {Number(ticket.km_totales).toFixed(0)} km
                                    </span>
                                )}
                                {ticket.num_carreras && (
                                    <span className="flex items-center gap-1">
                                        <Car className="h-3 w-3 text-amber-400" />
                                        {ticket.num_carreras} carreras
                                    </span>
                                )}
                                {ticket.ingresos_totales && ticket.num_carreras && ticket.num_carreras > 0 && (
                                    <span className="flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                                        {(Number(ticket.ingresos_totales) / ticket.num_carreras).toFixed(1)}€/carrera
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
