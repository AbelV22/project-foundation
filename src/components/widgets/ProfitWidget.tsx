import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Wallet, ChevronRight } from "lucide-react";
import { useEarnings } from "@/hooks/useEarnings";
import { useExpenses } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";

interface ProfitWidgetProps {
    onViewEarnings?: () => void;
    onViewExpenses?: () => void;
}

export function ProfitWidget({ onViewEarnings, onViewExpenses }: ProfitWidgetProps) {
    const { stats } = useEarnings();
    const { getTotalExpenses, expenses } = useExpenses();
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [todayExpenses, setTodayExpenses] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        // Calculate today's revenue
        const today = new Date().toISOString().split('T')[0];
        const dailyStat = stats.daily.find(d => d.date === today);
        setTodayRevenue(dailyStat?.total || 0);

        // Calculate today's expenses
        const todayExpenseTotal = expenses
            .filter(exp => {
                const expDate = new Date(exp.timestamp).toISOString().split('T')[0];
                return expDate === today;
            })
            .reduce((sum, exp) => sum + exp.amount, 0);
        setTodayExpenses(todayExpenseTotal);

        // Trigger animation on data change
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 600);
        return () => clearTimeout(timer);
    }, [stats, expenses]);

    const todayProfit = todayRevenue - todayExpenses;
    const isProfitable = todayProfit >= 0;
    const weeklyRevenue = stats.weekly.revenue || 0;
    const weeklyExpenses = getTotalExpenses();
    const weeklyProfit = weeklyRevenue - weeklyExpenses;

    const todayCarreras = stats.daily.find(d => d.date === new Date().toISOString().split('T')[0])?.count || 0;
    const todayGastos = expenses.filter(exp => {
        const expDate = new Date(exp.timestamp).toISOString().split('T')[0];
        return expDate === new Date().toISOString().split('T')[0];
    }).length;

    return (
        <div className="card-glass p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                        isProfitable ? "bg-emerald-500/15" : "bg-red-500/15"
                    )}>
                        <Wallet className={cn(
                            "h-4 w-4 transition-colors duration-300",
                            isProfitable ? "text-emerald-400" : "text-red-400"
                        )} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Balance Hoy</h3>
                        <p className="text-[10px] text-muted-foreground">
                            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                    </div>
                </div>

                {/* Main Profit Display */}
                <div className={cn(
                    "text-right transition-all duration-300",
                    isAnimating && "animate-number-pop"
                )}>
                    <div className={cn(
                        "font-mono font-bold text-2xl tabular-nums tracking-tight transition-colors duration-300",
                        isProfitable ? "text-emerald-400" : "text-red-400"
                    )}>
                        {isProfitable ? "+" : ""}{todayProfit.toFixed(0)}€
                    </div>
                    <p className={cn(
                        "text-[10px] font-medium",
                        isProfitable ? "text-emerald-400/70" : "text-red-400/70"
                    )}>
                        {isProfitable ? "Beneficio" : "Pérdida"}
                    </p>
                </div>
            </div>

            {/* Revenue vs Expenses Cards */}
            <div className="grid grid-cols-2 gap-2">
                {/* Ingresos Card */}
                <button
                    onClick={onViewEarnings}
                    className="group relative p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20
                               hover:bg-emerald-500/10 hover:border-emerald-500/30
                               active:scale-[0.98] transition-all duration-200 text-left overflow-hidden"
                >
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />

                    <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-[10px] font-medium text-muted-foreground">Ingresos</span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all duration-200" />
                        </div>
                        <p className="font-mono font-bold text-lg text-emerald-400 tabular-nums">
                            {todayRevenue.toFixed(0)}€
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {todayCarreras} {todayCarreras === 1 ? 'carrera' : 'carreras'}
                        </p>
                    </div>
                </button>

                {/* Gastos Card */}
                <button
                    onClick={onViewExpenses}
                    className="group relative p-2.5 rounded-xl bg-red-500/5 border border-red-500/20
                               hover:bg-red-500/10 hover:border-red-500/30
                               active:scale-[0.98] transition-all duration-200 text-left overflow-hidden"
                >
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />

                    <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                                <span className="text-[10px] font-medium text-muted-foreground">Gastos</span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all duration-200" />
                        </div>
                        <p className="font-mono font-bold text-lg text-red-400 tabular-nums">
                            {todayExpenses.toFixed(0)}€
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {todayGastos} {todayGastos === 1 ? 'gasto' : 'gastos'}
                        </p>
                    </div>
                </button>
            </div>

            {/* Weekly Summary - Compact */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-[11px] text-muted-foreground">Esta semana</span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                        {weeklyRevenue.toFixed(0)}€ - {weeklyExpenses.toFixed(0)}€
                    </span>
                    <span className={cn(
                        "font-mono font-semibold text-xs tabular-nums px-1.5 py-0.5 rounded",
                        weeklyProfit >= 0
                            ? "text-emerald-400 bg-emerald-500/10"
                            : "text-red-400 bg-red-500/10"
                    )}>
                        {weeklyProfit >= 0 ? "+" : ""}{weeklyProfit.toFixed(0)}€
                    </span>
                </div>
            </div>
        </div>
    );
}
