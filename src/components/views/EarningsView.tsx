import { useMemo } from "react";
import { useEarnings } from "@/hooks/useEarnings";
import { ArrowLeft, Calendar, CreditCard, Euro, Banknote, MapPin, TrendingUp, Clock } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

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

    // Build chart data for last 7 days
    const chartData = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const dateStr = startOfDay(date).toDateString();
            const dayCarreras = carreras.filter(
                c => new Date(c.created_at).toDateString() === dateStr
            );
            const total = dayCarreras.reduce((sum, c) => sum + c.importe + c.propina, 0);
            days.push({
                day: format(date, "EEE", { locale: es }),
                total: Math.round(total),
                count: dayCarreras.length,
                isToday: i === 0,
            });
        }
        return days;
    }, [carreras]);

    const maxTotal = Math.max(...chartData.map(d => d.total), 1);

    // Avg per ride
    const avgPerRide = stats.weekCount > 0
        ? (stats.week / stats.weekCount).toFixed(1)
        : "0";

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
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-foreground">Registro de Ingresos</h2>
                    <p className="text-xs text-muted-foreground">Historial detallado de carreras</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
                <div className="card-glass p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Hoy</p>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-foreground tracking-tight">{stats.today.toFixed(0)}</span>
                        <span className="text-xs font-bold text-primary">€</span>
                    </div>
                    <p className="text-[10px] text-emerald-400 font-medium">
                        {stats.todayCount} carreras
                    </p>
                </div>

                <div className="card-glass p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Semana</p>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-foreground tracking-tight">{stats.week.toFixed(0)}</span>
                        <span className="text-xs font-bold text-primary">€</span>
                    </div>
                    <p className="text-[10px] text-blue-400 font-medium">
                        {stats.weekCount} carreras
                    </p>
                </div>

                <div className="card-glass p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">€/carrera</p>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-foreground tracking-tight">{avgPerRide}</span>
                        <span className="text-xs font-bold text-primary">€</span>
                    </div>
                    <p className="text-[10px] text-amber-400 font-medium">
                        media
                    </p>
                </div>
            </div>

            {/* Weekly Chart */}
            {chartData.some(d => d.total > 0) && (
                <div className="card-glass p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Últimos 7 días</h3>
                        <span className="text-[10px] text-muted-foreground">
                            Total: {chartData.reduce((s, d) => s + d.total, 0)}€
                        </span>
                    </div>
                    <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barSize={28}>
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <YAxis hide domain={[0, maxTotal * 1.1]} />
                                <Tooltip
                                    cursor={false}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        color: 'hsl(var(--foreground))',
                                    }}
                                    formatter={(value: number, _name: string) => [`${value}€`, 'Ingresos']}
                                    labelFormatter={(label: string) => label.charAt(0).toUpperCase() + label.slice(1)}
                                />
                                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.isToday ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.3)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Historial Reciente</h3>

                {Object.entries(groupedCarreras).length === 0 ? (
                    <div className="text-center py-10 card-glass mx-auto max-w-sm">
                        <div className="bg-muted/30 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
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
                                                    <span className="font-bold text-foreground text-lg">
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
                                                            <span className="flex items-center gap-0.5">
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
