import { useState, useEffect, useCallback } from 'react';
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

/**
 * Hook for managing expenses
 */
export const useExpenses = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dailySummary, setDailySummary] = useState<DailyExpensesSummary[]>([]);

    const fetchExpenses = useCallback(async (startDate?: Date, endDate?: Date) => {
        try {
            setLoading(true);
            setError(null);
            const deviceId = getOrCreateDeviceId();

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
                console.error('[useExpenses] Fetch error:', fetchError);
                throw fetchError;
            }

            setExpenses((data || []) as Expense[]);
        } catch (err) {
            console.error('[useExpenses] Error fetching expenses:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    }, []);

    const addExpense = useCallback(async (
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
            setError(null);
            const deviceId = getOrCreateDeviceId();
            console.log('[useExpenses] Adding expense:', { category, amount, subcategory, deviceId });

            const { data, error: insertError } = await supabase
                .from('expenses')
                .insert({
                    device_id: deviceId,
                    category,
                    amount,
                    subcategory: subcategory || null,
                    odometer_reading: odometerReading || null,
                    liters: liters || null,
                    notes: notes || null,
                    is_recurring: isRecurring,
                    recurrence_pattern: recurrencePattern || null,
                })
                .select()
                .single();

            if (insertError) {
                console.error('[useExpenses] Supabase insert error:', insertError);
                throw insertError;
            }

            console.log('[useExpenses] Expense added successfully:', data);

            // Refresh data after insert
            await fetchExpenses();
            return true;
        } catch (err) {
            console.error('[useExpenses] Add error:', err);
            setError(err instanceof Error ? err.message : 'Error al agregar gasto');
            return false;
        }
    }, [fetchExpenses]);

    const deleteExpense = useCallback(async (id: string): Promise<boolean> => {
        try {
            setError(null);
            const deviceId = getOrCreateDeviceId();

            const { error: deleteError } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id)
                .eq('device_id', deviceId);

            if (deleteError) {
                console.error('[useExpenses] Delete error:', deleteError);
                throw deleteError;
            }

            console.log('[useExpenses] Expense deleted successfully:', id);

            // Refresh data after delete
            await fetchExpenses();
            return true;
        } catch (err) {
            console.error('[useExpenses] Delete error:', err);
            setError(err instanceof Error ? err.message : 'Error al eliminar gasto');
            return false;
        }
    }, [fetchExpenses]);

    const fetchDailySummary = useCallback(async (startDate?: Date, endDate?: Date) => {
        try {
            const deviceId = getOrCreateDeviceId();

            // Calculate summary from expenses
            const filteredExpenses = expenses.filter(exp => {
                const expDate = new Date(exp.timestamp);
                if (startDate && expDate < startDate) return false;
                if (endDate && expDate > endDate) return false;
                return true;
            });

            // Group by date
            const summaryMap = new Map<string, DailyExpensesSummary>();
            filteredExpenses.forEach(exp => {
                const date = new Date(exp.timestamp).toISOString().split('T')[0];
                const existing = summaryMap.get(date) || {
                    date,
                    total_expenses: 0,
                    fuel_expenses: 0,
                    maintenance_expenses: 0,
                    operating_expenses: 0,
                    other_expenses: 0,
                };

                existing.total_expenses += Number(exp.amount);
                if (exp.category === 'fuel') existing.fuel_expenses += Number(exp.amount);
                if (exp.category === 'maintenance') existing.maintenance_expenses += Number(exp.amount);
                if (exp.category === 'operating') existing.operating_expenses += Number(exp.amount);
                if (exp.category === 'other') existing.other_expenses += Number(exp.amount);

                summaryMap.set(date, existing);
            });

            setDailySummary(Array.from(summaryMap.values()).sort((a, b) => b.date.localeCompare(a.date)));
        } catch (err) {
            console.error('[useExpenses] Error calculating daily summary:', err);
        }
    }, [expenses]);

    const getTotalExpenses = useCallback((category?: ExpenseCategory): number => {
        return expenses
            .filter(exp => !category || exp.category === category)
            .reduce((acc, exp) => acc + Number(exp.amount), 0);
    }, [expenses]);

    const getMonthlyExpenses = useCallback((year: number, month: number): number => {
        return expenses
            .filter(exp => {
                const expDate = new Date(exp.timestamp);
                return expDate.getFullYear() === year && expDate.getMonth() === month;
            })
            .reduce((acc, exp) => acc + Number(exp.amount), 0);
    }, [expenses]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    useEffect(() => {
        fetchDailySummary();
    }, [expenses, fetchDailySummary]);

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
