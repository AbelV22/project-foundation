import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

export type ImetEventType = 'itv' | 'taximeter' | 'insurance' | 'metro_review' | 'license_review' | 'other';

export interface ImetEvent {
    id: string;
    device_id: string;
    event_type: ImetEventType;
    title: string;
    due_date: string;
    completed_at: string | null;
    notes: string | null;
    remind_days_before: number;
    created_at: string;
}

export const IMET_EVENT_CONFIG: Record<ImetEventType, { label: string; emoji: string; defaultRemind: number; recurrence: string }> = {
    itv: { label: 'ITV', emoji: '🔧', defaultRemind: 30, recurrence: 'Anual' },
    taximeter: { label: 'Revisión taxímetro', emoji: '🔢', defaultRemind: 30, recurrence: 'Cada 2 años' },
    insurance: { label: 'Seguro', emoji: '🛡️', defaultRemind: 45, recurrence: 'Anual' },
    metro_review: { label: 'Revisión metropolitana', emoji: '📋', defaultRemind: 30, recurrence: 'Anual' },
    license_review: { label: 'Revisión licencia', emoji: '🪪', defaultRemind: 60, recurrence: 'Variable' },
    other: { label: 'Otro', emoji: '📌', defaultRemind: 15, recurrence: '' },
};

export const useImetCalendar = () => {
    const [events, setEvents] = useState<ImetEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        try {
            const deviceId = getOrCreateDeviceId();
            const { data, error: fetchError } = await supabase
                .from('imet_calendar')
                .select('*')
                .eq('device_id', deviceId)
                .order('due_date', { ascending: true });

            if (fetchError) throw fetchError;
            setEvents((data || []) as ImetEvent[]);
            setError(null);
        } catch (err) {
            console.error('[useImetCalendar] Fetch error:', err);
            setError('Error al cargar el calendario');
        } finally {
            setLoading(false);
        }
    }, []);

    const addEvent = useCallback(async (
        eventType: ImetEventType,
        title: string,
        dueDate: string,
        notes?: string,
        remindDaysBefore?: number
    ): Promise<boolean> => {
        try {
            const deviceId = getOrCreateDeviceId();
            const { error: insertError } = await supabase
                .from('imet_calendar')
                .insert({
                    device_id: deviceId,
                    event_type: eventType,
                    title,
                    due_date: dueDate,
                    notes: notes || null,
                    remind_days_before: remindDaysBefore || IMET_EVENT_CONFIG[eventType].defaultRemind,
                });

            if (insertError) throw insertError;
            await fetchEvents();
            return true;
        } catch (err) {
            console.error('[useImetCalendar] Add error:', err);
            return false;
        }
    }, [fetchEvents]);

    const completeEvent = useCallback(async (eventId: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('imet_calendar')
                .update({ completed_at: new Date().toISOString() })
                .eq('id', eventId);

            if (updateError) throw updateError;
            await fetchEvents();
            return true;
        } catch (err) {
            console.error('[useImetCalendar] Complete error:', err);
            return false;
        }
    }, [fetchEvents]);

    const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
        try {
            const { error: deleteError } = await supabase
                .from('imet_calendar')
                .delete()
                .eq('id', eventId);

            if (deleteError) throw deleteError;
            await fetchEvents();
            return true;
        } catch (err) {
            console.error('[useImetCalendar] Delete error:', err);
            return false;
        }
    }, [fetchEvents]);

    // Compute urgency
    const getUpcoming = useCallback(() => {
        const now = new Date();
        return events
            .filter(e => !e.completed_at)
            .map(e => {
                const due = new Date(e.due_date);
                const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return { ...e, daysLeft };
            })
            .sort((a, b) => a.daysLeft - b.daysLeft);
    }, [events]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    return {
        events,
        loading,
        error,
        addEvent,
        completeEvent,
        deleteEvent,
        getUpcoming,
        refresh: fetchEvents,
    };
};
