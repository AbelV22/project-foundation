import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, DollarSign, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    }, [stats, expenses]);

    const todayProfit = todayRevenue - todayExpenses;
    const isProfitable = todayProfit >= 0;
    const weeklyRevenue = stats.weekly.revenue || 0;
    const weeklyExpenses = getTotalExpenses(); // You might want to filter by week
    const weeklyProfit = weeklyRevenue - weeklyExpenses;

    return (
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Balance Hoy
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Today's Profit/Loss */}
                <div className="text-center space-y-2">
                    <div className={cn(
                        "text-4xl font-bold transition-colors",
                        isProfitable ? "text-green-500" : "text-red-500"
                    )}>
                        {isProfitable && "+"}
                        {todayProfit.toFixed(2)}€
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {isProfitable ? "Beneficio neto" : "Pérdida neta"}
                    </p>
                </div>

                {/* Revenue vs Expenses Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onViewEarnings}
                        className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all text-left"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-muted-foreground">Ingresos</span>
                        </div>
                        <p className="text-xl font-bold text-green-500">
                            {todayRevenue.toFixed(2)}€
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.daily.find(d => d.date === new Date().toISOString().split('T')[0])?.count || 0} carreras
                        </p>
                    </button>

                    <button
                        onClick={onViewExpenses}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-left"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-muted-foreground">Gastos</span>
                        </div>
                        <p className="text-xl font-bold text-red-500">
                            {todayExpenses.toFixed(2)}€
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {expenses.filter(exp => {
                                const expDate = new Date(exp.timestamp).toISOString().split('T')[0];
                                return expDate === new Date().toISOString().split('T')[0];
                            }).length} gastos
                        </p>
                    </button>
                </div>

                {/* Weekly Summary */}
                <div className="pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Esta semana</span>
                        <span className={cn(
                            "font-semibold",
                            weeklyProfit >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {weeklyProfit >= 0 && "+"}
                            {weeklyProfit.toFixed(2)}€
                        </span>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={onViewEarnings}
                    >
                        Ver Ingresos
                        <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={onViewExpenses}
                    >
                        Ver Gastos
                        <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
