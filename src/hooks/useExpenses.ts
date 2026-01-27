import { useState, useEffect } from 'react';
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
 * NOTE: This hook is a placeholder - the 'expenses' table needs to be created
 * in the database before this functionality will work.
 */
export const useExpenses = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dailySummary, setDailySummary] = useState<DailyExpensesSummary[]>([]);

    const deviceId = getOrCreateDeviceId();

    const fetchExpenses = async (_startDate?: Date, _endDate?: Date) => {
        // Table 'expenses' does not exist yet - return empty data
        console.warn('[useExpenses] Table "expenses" not found in database schema. Feature disabled.');
        setExpenses([]);
        setLoading(false);
    };

    const addExpense = async (
        _category: ExpenseCategory,
        _amount: number,
        _subcategory?: string,
        _odometerReading?: number,
        _liters?: number,
        _notes?: string,
        _isRecurring: boolean = false,
        _recurrencePattern?: RecurrencePattern
    ): Promise<boolean> => {
        console.warn('[useExpenses] Table "expenses" not found in database schema. Cannot add expense.');
        setError('La tabla de gastos no está disponible todavía');
        return false;
    };

    const deleteExpense = async (_id: string): Promise<boolean> => {
        console.warn('[useExpenses] Table "expenses" not found in database schema. Cannot delete expense.');
        setError('La tabla de gastos no está disponible todavía');
        return false;
    };

    const fetchDailySummary = async (_startDate?: Date, _endDate?: Date) => {
        setDailySummary([]);
    };

    const getTotalExpenses = (_category?: ExpenseCategory): number => {
        return 0;
    };

    const getMonthlyExpenses = (_year: number, _month: number): number => {
        return 0;
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
