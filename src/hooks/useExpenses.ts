import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

export type ExpenseCategory = 'fuel' | 'maintenance' | 'operating' | 'other';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Expense {
    id: string;
    device_id: string;
    timestamp: string;
    category: ExpenseCategory;
    subcategory: string | null;
    amount: number;
    odometer_reading: number | null;
    liters: number | null;
    notes: string | null;
    receipt_photo_url: string | null;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    created_at: string;
}

export interface DailyExpensesSummary {
    date: string;
    total_expenses: number;
    fuel_expenses: number;
    maintenance_expenses: number;
    operating_expenses: number;
    other_expenses: number;
}

export interface DailyProfitSummary {
    date: string;
    revenue: number;
    expenses: number;
    net_profit: number;
    num_rides: number;
    cash_revenue: number;
    card_revenue: number;
    fuel_expenses: number;
    maintenance_expenses: number;
    operating_expenses: number;
}

export const EXPENSE_SUBCATEGORIES = {
    fuel: ['Gasolina', 'Diésel', 'GNC', 'Eléctrico'],
    maintenance: [
        'Cambio de aceite',
        'Neumáticos',
        'Frenos',
        'Batería',
        'Filtros',
        'Reparación',
        'Revisión',
        'ITV',
        'Lavado',
    ],
    operating: [
        'Seguro',
        'Licencia',
        'Parking',
        'Peajes',
        'Multas',
        'Tasas municipales',
        'Alquiler plaza',
    ],
    other: ['Otros'],
};

export const useExpenses = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dailySummary, setDailySummary] = useState<DailyExpensesSummary[]>([]);

    const deviceId = getOrCreateDeviceId();

    const fetchExpenses = async (startDate?: Date, endDate?: Date) => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('expenses')
                .select('*')
                .eq('device_id', deviceId)
                .order('timestamp', { ascending: false });

            if (startDate) {
                query = query.gte('timestamp', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('timestamp', endDate.toISOString());
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                console.error('[useExpenses] Error fetching expenses:', fetchError);
                setError(fetchError.message);
                return;
            }

            setExpenses(data || []);
        } catch (err) {
            console.error('[useExpenses] Error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const addExpense = async (
        category: ExpenseCategory,
        amount: number,
        subcategory?: string,
        odometerReading?: number,
        liters?: number,
        notes?: string,
        isRecurring: boolean = false,
        recurrencePattern?: RecurrencePattern
    ): Promise<boolean> => {
        try {
            console.log('[useExpenses] Adding expense:', {
                category,
                amount,
                subcategory,
                odometerReading,
                liters,
                notes,
                isRecurring,
                recurrencePattern,
            });

            const { error: insertError } = await supabase.from('expenses').insert({
                device_id: deviceId,
                category,
                subcategory: subcategory || null,
                amount,
                odometer_reading: odometerReading || null,
                liters: liters || null,
                notes: notes || null,
                is_recurring: isRecurring,
                recurrence_pattern: recurrencePattern || null,
            });

            if (insertError) {
                console.error('[useExpenses] Error adding expense:', insertError);
                setError(insertError.message);
                return false;
            }

            // Refresh expenses list
            await fetchExpenses();
            return true;
        } catch (err) {
            console.error('[useExpenses] Error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
            return false;
        }
    };

    const deleteExpense = async (id: string): Promise<boolean> => {
        try {
            const { error: deleteError } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id)
                .eq('device_id', deviceId);

            if (deleteError) {
                console.error('[useExpenses] Error deleting expense:', deleteError);
                setError(deleteError.message);
                return false;
            }

            await fetchExpenses();
            return true;
        } catch (err) {
            console.error('[useExpenses] Error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
            return false;
        }
    };

    const fetchDailySummary = async (startDate?: Date, endDate?: Date) => {
        try {
            // Calculate daily summary from expenses
            const grouped = expenses.reduce((acc, expense) => {
                const date = new Date(expense.timestamp).toISOString().split('T')[0];

                if (!acc[date]) {
                    acc[date] = {
                        date,
                        total_expenses: 0,
                        fuel_expenses: 0,
                        maintenance_expenses: 0,
                        operating_expenses: 0,
                        other_expenses: 0,
                    };
                }

                acc[date].total_expenses += expense.amount;

                if (expense.category === 'fuel') {
                    acc[date].fuel_expenses += expense.amount;
                } else if (expense.category === 'maintenance') {
                    acc[date].maintenance_expenses += expense.amount;
                } else if (expense.category === 'operating') {
                    acc[date].operating_expenses += expense.amount;
                } else {
                    acc[date].other_expenses += expense.amount;
                }

                return acc;
            }, {} as Record<string, DailyExpensesSummary>);

            setDailySummary(Object.values(grouped));
        } catch (err) {
            console.error('[useExpenses] Error calculating summary:', err);
        }
    };

    const getTotalExpenses = (category?: ExpenseCategory): number => {
        if (!category) {
            return expenses.reduce((sum, exp) => sum + exp.amount, 0);
        }
        return expenses
            .filter((exp) => exp.category === category)
            .reduce((sum, exp) => sum + exp.amount, 0);
    };

    const getMonthlyExpenses = (year: number, month: number): number => {
        return expenses
            .filter((exp) => {
                const date = new Date(exp.timestamp);
                return date.getFullYear() === year && date.getMonth() === month;
            })
            .reduce((sum, exp) => sum + exp.amount, 0);
    };

    useEffect(() => {
        fetchExpenses();
    }, [deviceId]);

    useEffect(() => {
        fetchDailySummary();
    }, [expenses]);

    return {
        expenses,
        loading,
        error,
        dailySummary,
        fetchExpenses,
        addExpense,
        deleteExpense,
        getTotalExpenses,
        getMonthlyExpenses,
    };
};
