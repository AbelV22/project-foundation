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

    setSchedule(options: {
        startHour: number;
        endHour: number;
        enabled: boolean;
        trackingEnabled: boolean;
    }): Promise<{ success: boolean }>;

    requestLocationPermission(): Promise<{ granted: boolean }>;

    requestBackgroundPermission(): Promise<{ granted: boolean; error?: string }>;

    checkPermissions(): Promise<{ foreground: boolean; background: boolean }>;

    requestIgnoreBatteryOptimizations(): Promise<{ success: boolean; message: string }>;

    isIgnoringBatteryOptimizations(): Promise<{ ignored: boolean }>;
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
 * Request foreground location permission via native plugin.
 * Returns true if ACCESS_FINE_LOCATION is granted.
 */
export const requestForegroundPermission = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return true;

    try {
        const result = await ProTracking.requestLocationPermission();
        console.log('[ProTracking] Foreground permission:', result.granted);
        return result.granted;
    } catch (e) {
        console.error('[ProTracking] Foreground permission error:', e);
        return false;
    }
};

/**
 * Request background location permission via native plugin.
 * MUST be called AFTER foreground permission is granted.
 * On Android 10+ this shows the "Allow all the time" dialog.
 */
export const requestBackgroundPermission = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return true;

    try {
        const result = await ProTracking.requestBackgroundPermission();
        console.log('[ProTracking] Background permission:', result.granted);
        return result.granted;
    } catch (e) {
        console.error('[ProTracking] Background permission error:', e);
        return false;
    }
};

/**
 * Check current permission status for both foreground and background.
 */
export const checkProPermissions = async (): Promise<{ foreground: boolean; background: boolean }> => {
    if (!Capacitor.isNativePlatform()) return { foreground: true, background: true };

    try {
        return await ProTracking.checkPermissions();
    } catch (e) {
        console.error('[ProTracking] Check permissions error:', e);
        return { foreground: false, background: false };
    }
};

/**
 * Request ALL location permissions in the correct order:
 * 1. Foreground (ACCESS_FINE_LOCATION) - "While using the app"
 * 2. Background (ACCESS_BACKGROUND_LOCATION) - "Allow all the time"
 */
export const requestAllLocationPermissions = async (): Promise<{ foreground: boolean; background: boolean }> => {
    // Step 1: Request foreground permission
    const foreground = await requestForegroundPermission();
    if (!foreground) {
        console.warn('[ProTracking] Foreground permission denied, cannot request background');
        return { foreground: false, background: false };
    }

    // Step 2: Request background permission (requires foreground first)
    const background = await requestBackgroundPermission();

    console.log(`[ProTracking] Permissions: foreground=${foreground}, background=${background}`);
    return { foreground, background };
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

/**
 * Configure tracking schedule and global toggle
 */
export const setProSchedule = async (
    startHour: number,
    endHour: number,
    enabled: boolean,
    trackingEnabled: boolean
): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await ProTracking.setSchedule({
            startHour,
            endHour,
            enabled,
            trackingEnabled
        });
        return result.success;
    } catch (e) {
        console.error('[ProTracking] Schedule error:', e);
        return false;
    }
};

/**
 * Request to ignore battery optimizations
 */
export const requestIgnoreBatteryOptimizations = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await ProTracking.requestIgnoreBatteryOptimizations();
        console.log('[ProTracking] Request Battery Opt:', result);
        return result.success;
    } catch (e) {
        console.error('[ProTracking] Request Battery Opt error:', e);
        return false;
    }
};

/**
 * Check if battery optimizations are ignored
 */
export const isIgnoringBatteryOptimizations = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await ProTracking.isIgnoringBatteryOptimizations();
        console.log('[ProTracking] Is Ignoring Battery Opt:', result.ignored);
        return result.ignored;
    } catch (e) {
        console.error('[ProTracking] Check Battery Opt error:', e);
        return false;
    }
};
