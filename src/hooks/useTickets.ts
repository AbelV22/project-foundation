import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

/**
 * Compress and resize an image to reduce payload for OCR.
 * With timeout fallback for mobile browsers that may stall.
 */
function compressImage(base64: string, maxDim = 1200, quality = 0.8): Promise<string> {
    return new Promise((resolve) => {
        // Timeout: if compression takes >5s, send original
        const timeout = setTimeout(() => {
            console.warn('[compressImage] Timeout, using original');
            resolve(base64);
        }, 5000);

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        clearTimeout(timeout);
                        resolve(base64);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    const result = canvas.toDataURL('image/jpeg', quality);
                    clearTimeout(timeout);
                    console.log(`[compressImage] ${width}x${height}, ${Math.round(result.length / 1024)}KB`);
                    resolve(result);
                } catch (e) {
                    console.error('[compressImage] Canvas error:', e);
                    clearTimeout(timeout);
                    resolve(base64);
                }
            };
            img.onerror = () => {
                console.warn('[compressImage] Image load error, using original');
                clearTimeout(timeout);
                resolve(base64);
            };
            img.src = base64;
        } catch (e) {
            console.error('[compressImage] Error:', e);
            clearTimeout(timeout);
            resolve(base64);
        }
    });
}

export interface TicketRecord {
    id: string;
    device_id: string;
    fecha: string;
    km_totales: number | null;
    ingresos_totales: number | null;
    num_carreras: number | null;
    foto_url: string | null;
    datos_raw: any;
    created_at: string;
}

interface TicketStats {
    weekKm: number;
    weekIngresos: number;
    weekCarreras: number;
    monthKm: number;
    monthIngresos: number;
    monthCarreras: number;
    avgDailyKm: number;
    avgDailyIngresos: number;
}

interface ScanResult {
    km_totales: number | null;
    ingresos_totales: number | null;
    num_carreras: number | null;
    raw_response?: string;
    error?: string;
}

interface UseTicketsResult {
    tickets: TicketRecord[];
    stats: TicketStats;
    loading: boolean;
    scanning: boolean;
    error: Error | null;
    scanTicket: (imageBase64: string) => Promise<ScanResult | null>;
    saveTicket: (data: {
        fecha: string;
        km_totales: number | null;
        ingresos_totales: number | null;
        num_carreras: number | null;
        foto_url: string | null;
        datos_raw: any;
    }) => Promise<boolean>;
    uploadPhoto: (imageBase64: string) => Promise<string | null>;
    refresh: () => void;
}

const emptyStats: TicketStats = {
    weekKm: 0, weekIngresos: 0, weekCarreras: 0,
    monthKm: 0, monthIngresos: 0, monthCarreras: 0,
    avgDailyKm: 0, avgDailyIngresos: 0,
};

export const useTickets = (): UseTicketsResult => {
    const [tickets, setTickets] = useState<TicketRecord[]>([]);
    const [stats, setStats] = useState<TicketStats>(emptyStats);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchTickets = useCallback(async () => {
        try {
            const deviceId = getOrCreateDeviceId();
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const { data, error: fetchError } = await supabase
                .from('ticket_diario')
                .select('*')
                .eq('device_id', deviceId)
                .gte('created_at', monthAgo)
                .order('fecha', { ascending: false });

            if (fetchError) throw fetchError;

            const records = (data || []) as TicketRecord[];
            setTickets(records);

            // Calculate stats
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekRecords = records.filter(r => new Date(r.fecha) >= weekAgo);
            const daysWithData = new Set(records.map(r => r.fecha)).size;

            setStats({
                weekKm: weekRecords.reduce((acc, r) => acc + Number(r.km_totales || 0), 0),
                weekIngresos: weekRecords.reduce((acc, r) => acc + Number(r.ingresos_totales || 0), 0),
                weekCarreras: weekRecords.reduce((acc, r) => acc + Number(r.num_carreras || 0), 0),
                monthKm: records.reduce((acc, r) => acc + Number(r.km_totales || 0), 0),
                monthIngresos: records.reduce((acc, r) => acc + Number(r.ingresos_totales || 0), 0),
                monthCarreras: records.reduce((acc, r) => acc + Number(r.num_carreras || 0), 0),
                avgDailyKm: daysWithData > 0
                    ? records.reduce((acc, r) => acc + Number(r.km_totales || 0), 0) / daysWithData
                    : 0,
                avgDailyIngresos: daysWithData > 0
                    ? records.reduce((acc, r) => acc + Number(r.ingresos_totales || 0), 0) / daysWithData
                    : 0,
            });

            setError(null);
        } catch (err) {
            console.error('[useTickets] Error:', err);
            setError(err instanceof Error ? err : new Error('Failed to fetch tickets'));
        } finally {
            setLoading(false);
        }
    }, []);

    const uploadPhoto = useCallback(async (imageBase64: string): Promise<string | null> => {
        try {
            const deviceId = getOrCreateDeviceId();
            const timestamp = Date.now();
            const fileName = `${deviceId}/${timestamp}.jpg`;

            // Convert base64 to blob
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const byteCharacters = atob(base64Data);
            const byteArray = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteArray[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            const { error: uploadError } = await supabase.storage
                .from('tickets')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('tickets')
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (err) {
            console.error('[useTickets] Upload error:', err);
            return null;
        }
    }, []);

    const scanTicket = useCallback(async (imageBase64: string): Promise<ScanResult | null> => {
        setScanning(true);
        try {
            // Compress image for faster OCR
            console.log('[useTickets] Compressing image...');
            const compressed = await compressImage(imageBase64);
            console.log('[useTickets] Sending to scan-ticket...');

            const response = await supabase.functions.invoke('scan-ticket', {
                body: { image_base64: compressed },
            });

            console.log('[useTickets] Response:', { error: response.error, hasData: !!response.data });

            // supabase.functions.invoke returns { data, error }
            // error is set for non-2xx OR network failures
            if (response.error) {
                // FunctionsHttpError has context
                const msg = response.error?.message || 'Unknown error';
                console.error('[useTickets] Function error:', msg, response.error);
                // If we got data despite error (e.g. edge function returned 200 with error field)
                if (response.data && typeof response.data === 'object') {
                    return response.data as ScanResult;
                }
                throw new Error(msg);
            }

            const data = response.data as ScanResult;
            console.log('[useTickets] Scan result:', data);
            return data;
        } catch (err) {
            console.error('[useTickets] Scan error:', err);
            setError(err instanceof Error ? err : new Error('Failed to scan ticket'));
            return null;
        } finally {
            setScanning(false);
        }
    }, []);

    const saveTicket = useCallback(async (data: {
        fecha: string;
        km_totales: number | null;
        ingresos_totales: number | null;
        num_carreras: number | null;
        foto_url: string | null;
        datos_raw: any;
    }): Promise<boolean> => {
        try {
            const deviceId = getOrCreateDeviceId();

            const { error: insertError } = await supabase
                .from('ticket_diario')
                .insert({
                    device_id: deviceId,
                    ...data,
                });

            if (insertError) throw insertError;

            await fetchTickets();
            return true;
        } catch (err) {
            console.error('[useTickets] Save error:', err);
            setError(err instanceof Error ? err : new Error('Failed to save ticket'));
            return false;
        }
    }, [fetchTickets]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    return { tickets, stats, loading, scanning, error, scanTicket, saveTicket, uploadPhoto, refresh: fetchTickets };
};
