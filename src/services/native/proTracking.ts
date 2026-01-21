import { Capacitor, registerPlugin } from '@capacitor/core';

interface ProTrackingPlugin {
    configure(options: {
        supabaseUrl: string;
        supabaseKey: string;
        deviceId: string;
        deviceName?: string;
    }): Promise<{ success: boolean; message: string }>;

    startTracking(): Promise<{ success: boolean; message: string }>;

    stopTracking(): Promise<{ success: boolean; message: string }>;

    isTracking(): Promise<{ isRunning: boolean }>;

    getLastPosition(): Promise<{
        hasPosition: boolean;
        latitude?: number;
        longitude?: number;
        timestamp?: number;
        zona?: string;
    }>;
}

const ProTracking = registerPlugin<ProTrackingPlugin>('ProTracking');

/**
 * Configure the native tracking service with Supabase credentials
 */
export const configureProTracking = async (
    supabaseUrl: string,
    supabaseKey: string,
    deviceId: string,
    deviceName?: string
): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[ProTracking] Not on native platform');
        return false;
    }

    try {
        const result = await ProTracking.configure({
            supabaseUrl,
            supabaseKey,
            deviceId,
            deviceName
        });
        console.log('[ProTracking] Configuration:', result);
        return result.success;
    } catch (e) {
        console.error('[ProTracking] Config error:', e);
        return false;
    }
};

/**
 * Start the native location tracking service
 */
export const startProTracking = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[ProTracking] Not on native platform');
        return false;
    }

    try {
        const result = await ProTracking.startTracking();
        console.log('[ProTracking] Start:', result);
        return result.success;
    } catch (e) {
        console.error('[ProTracking] Start error:', e);
        return false;
    }
};

/**
 * Stop the native location tracking service
 */
export const stopProTracking = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await ProTracking.stopTracking();
        console.log('[ProTracking] Stop:', result);
        return result.success;
    } catch (e) {
        console.error('[ProTracking] Stop error:', e);
        return false;
    }
};

/**
 * Check if tracking is currently running
 */
export const isProTrackingActive = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return false;
    }

    try {
        const result = await ProTracking.isTracking();
        return result.isRunning;
    } catch (e) {
        console.error('[ProTracking] Status error:', e);
        return false;
    }
};

/**
 * Get last known position from native service
 */
export const getLastProPosition = async () => {
    if (!Capacitor.isNativePlatform()) {
        return null;
    }

    try {
        const result = await ProTracking.getLastPosition();
        if (result.hasPosition) {
            return {
                latitude: result.latitude!,
                longitude: result.longitude!,
                timestamp: result.timestamp || Date.now(),
                zona: result.zona
            };
        }
        return null;
    } catch (e) {
        console.error('[ProTracking] Position error:', e);
        return null;
    }
};
