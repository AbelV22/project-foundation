import { useState, useMemo } from "react";
import { ArrowLeft, Fuel, Wrench, FileText, DollarSign, Trash2, TrendingDown, Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useExpenses, ExpenseCategory } from "@/hooks/useExpenses";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExpensesViewProps {
    onBack?: () => void;
}

const CATEGORY_CONFIG = {
    fuel: { label: 'Combustible', icon: Fuel, color: 'bg-orange-500', textColor: 'text-orange-500' },
    maintenance: { label: 'Mantenimiento', icon: Wrench, color: 'bg-blue-500', textColor: 'text-blue-500' },
    operating: { label: 'Operativo', icon: FileText, color: 'bg-purple-500', textColor: 'text-purple-500' },
    other: { label: 'Otros', icon: DollarSign, color: 'bg-gray-500', textColor: 'text-gray-500' },
};

export function ExpensesView({ onBack }: ExpensesViewProps) {
    const { expenses, loading, deleteExpense, getTotalExpenses } = useExpenses();
    const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Calculate totals
    const totalExpenses = getTotalExpenses();
    const fuelTotal = getTotalExpenses('fuel');
    const maintenanceTotal = getTotalExpenses('maintenance');
    const operatingTotal = getTotalExpenses('operating');
    const otherTotal = getTotalExpenses('other');

    // Filter expenses
    const filteredExpenses = useMemo(() => {
        if (filterCategory === 'all') return expenses;
        return expenses.filter(exp => exp.category === filterCategory);
    }, [expenses, filterCategory]);

    // Group by date
    const groupedExpenses = useMemo(() => {
        const groups: Record<string, typeof expenses> = {};
        filteredExpenses.forEach(expense => {
            const date = format(new Date(expense.timestamp), 'yyyy-MM-dd');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(expense);
        });
        return groups;
    }, [filteredExpenses]);

    const handleDelete = async () => {
        if (!deleteId) return;
        await deleteExpense(deleteId);
        setDeleteId(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando gastos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with back button */}
            {onBack && (
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="mb-2"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                </Button>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-muted-foreground">Total Gastos</span>
                        </div>
                        <p className="text-2xl font-bold text-red-500">{totalExpenses.toFixed(2)}€</p>
                    </CardContent>
                </Card>

                <Card
                    className={cn(
                        "cursor-pointer transition-all",
                        filterCategory === 'fuel' ? "ring-2 ring-orange-500" : ""
                    )}
                    onClick={() => setFilterCategory(filterCategory === 'fuel' ? 'all' : 'fuel')}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Fuel className="h-4 w-4 text-orange-500" />
                            <span className="text-xs text-muted-foreground">Combustible</span>
                        </div>
                        <p className="text-xl font-bold">{fuelTotal.toFixed(2)}€</p>
                    </CardContent>
                </Card>

                <Card
                    className={cn(
                        "cursor-pointer transition-all",
                        filterCategory === 'maintenance' ? "ring-2 ring-blue-500" : ""
                    )}
                    onClick={() => setFilterCategory(filterCategory === 'maintenance' ? 'all' : 'maintenance')}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Wrench className="h-4 w-4 text-blue-500" />
                            <span className="text-xs text-muted-foreground">Mantenimiento</span>
                        </div>
                        <p className="text-xl font-bold">{maintenanceTotal.toFixed(2)}€</p>
                    </CardContent>
                </Card>

                <Card
                    className={cn(
                        "cursor-pointer transition-all",
                        filterCategory === 'operating' ? "ring-2 ring-purple-500" : ""
                    )}
                    onClick={() => setFilterCategory(filterCategory === 'operating' ? 'all' : 'operating')}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-purple-500" />
                            <span className="text-xs text-muted-foreground">Operativo</span>
                        </div>
                        <p className="text-xl font-bold">{operatingTotal.toFixed(2)}€</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter indicator */}
            {filterCategory !== 'all' && (
                <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <span className="text-sm">
                            Filtrando: <strong>{CATEGORY_CONFIG[filterCategory].label}</strong>
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilterCategory('all')}
                    >
                        Limpiar filtro
                    </Button>
                </div>
            )}

            {/* Expenses List */}
            <div className="space-y-6">
                {Object.keys(groupedExpenses).length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <p className="text-muted-foreground">No hay gastos registrados</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Usa el botón <span className="text-red-500">-</span> para añadir gastos
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    Object.entries(groupedExpenses)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([date, dayExpenses]) => {
                            const dayTotal = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                            return (
                                <div key={date}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-semibold">
                                                {format(new Date(date), "EEEE, d 'de' MMMM", { locale: es })}
                                            </h3>
                                        </div>
                                        <Badge variant="destructive">
                                            {dayTotal.toFixed(2)}€
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        {dayExpenses.map((expense) => {
                                            const config = CATEGORY_CONFIG[expense.category as ExpenseCategory];
                                            const Icon = config.icon;
                                            return (
                                                <Card key={expense.id}>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-start gap-3 flex-1">
                                                                <div className={cn("p-2 rounded-full", config.color)}>
                                                                    <Icon className="h-4 w-4 text-white" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <h4 className="font-semibold">
                                                                            {expense.subcategory || config.label}
                                                                        </h4>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {format(new Date(expense.timestamp), 'HH:mm')}
                                                                        </span>
                                                                    </div>
                                                                    {expense.notes && (
                                                                        <p className="text-sm text-muted-foreground mt-1">
                                                                            {expense.notes}
                                                                        </p>
                                                                    )}
                                                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                                        {expense.liters && (
                                                                            <span>⛽ {expense.liters}L</span>
                                                                        )}
                                                                        {expense.odometer_reading && (
                                                                            <span>🚗 {expense.odometer_reading}km</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg font-bold text-red-500">
                                                                    {expense.amount.toFixed(2)}€
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => setDeleteId(expense.id)}
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El gasto será eliminado permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
