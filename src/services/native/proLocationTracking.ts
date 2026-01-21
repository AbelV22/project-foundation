import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Pro Location Tracking Plugin Interface
 * This uses FusedLocationProviderClient with PendingIntent (not Callbacks!)
 * and AlarmManager.setExactAndAllowWhileIdle for Doze resistance
 */
interface ProLocationTrackingPlugin {
    startTracking(options: {
        supabaseUrl?: string;
        supabaseKey?: string;
        deviceId?: string;
        deviceName?: string;
    }): Promise<{ success: boolean; message: string }>;

    stopTracking(): Promise<{ success: boolean; message: string }>;

    isTracking(): Promise<{ isRunning: boolean }>;

    getLastPosition(): Promise<{
        hasPosition: boolean;
        latitude?: number;
        longitude?: number;
        timestamp?: number;
    }>;
}

// Register native plugin
const ProLocationTracking = registerPlugin<ProLocationTrackingPlugin>('ProLocationTracking');

/**
 * Start professional-grade location tracking
 * Uses:
 * - FusedLocationProviderClient with PendingIntent (survives app sleep)
 * - AlarmManager.setExactAndAllowWhileIdle (survives Doze mode)
 * - Foreground Service with type="location"
 */
export const startProTracking = async (options?: {
    supabaseUrl?: string;
    supabaseKey?: string;
    deviceId?: string;
    deviceName?: string;
}): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[ProLocationTracking] Not on native platform');
        return false;
    }

    try {
        const result = await ProLocationTracking.startTracking(options || {});
        console.log('[ProLocationTracking] Start result:', result);
        return result.success;
    } catch (error) {
        console.error('[ProLocationTracking] Error starting:', error);
        return false;
    }
};

/**
 * Stop professional location tracking
 */
export const stopProTracking = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await ProLocationTracking.stopTracking();
        console.log('[ProLocationTracking] Stop result:', result);
        return result.success;
    } catch (error) {
        console.error('[ProLocationTracking] Error stopping:', error);
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
        const result = await ProLocationTracking.isTracking();
        return result.isRunning;
    } catch (error) {
        console.error('[ProLocationTracking] Error checking status:', error);
        return false;
    }
};

/**
 * Get the last known position from native storage
 */
export const getLastProPosition = async (): Promise<{
    latitude: number;
    longitude: number;
    timestamp: number;
} | null> => {
    if (!Capacitor.isNativePlatform()) {
        return null;
    }

    try {
        const result = await ProLocationTracking.getLastPosition();
        if (result.hasPosition && result.latitude && result.longitude) {
            return {
                latitude: result.latitude,
                longitude: result.longitude,
                timestamp: result.timestamp || Date.now()
            };
        }
        return null;
    } catch (error) {
        console.error('[ProLocationTracking] Error getting last position:', error);
        return null;
    }
};
