import { getCurrentPosition, type LocationResult } from '@/services/native/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { Capacitor } from '@capacitor/core';

// Tracking state
let isTracking = false;
let trackingInterval: ReturnType<typeof setInterval> | null = null;
let lastZona: string | null = null;
let lastCheckTime = 0;
let isTestingMode = false;
let deviceName: string | null = null;

// Callback for UI updates
type ZoneCallback = (zona: string | null) => void;
let onZoneChange: ZoneCallback | null = null;

// Configuration
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (normal mode)
const TESTING_INTERVAL_MS = 30 * 1000; // 30 seconds (testing mode)
const MIN_CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds minimum between checks

/**
 * Start automatic location tracking
 * Checks every 5 minutes (normal) or 30 seconds (testing mode)
 */
export const startAutoTracking = (callback?: ZoneCallback): void => {
    if (isTracking) {
        console.log('[AutoLocation] Already tracking');
        return;
    }

    onZoneChange = callback || null;
    isTracking = true;

    const interval = isTestingMode ? TESTING_INTERVAL_MS : CHECK_INTERVAL_MS;
    console.log(`[AutoLocation] Starting tracking (testing=${isTestingMode}, interval=${interval / 1000}s)`);

    // Initial check
    checkLocationAndRegister();

    // Set up interval
    trackingInterval = setInterval(() => {
        checkLocationAndRegister();
    }, interval);
};

/**
 * Stop automatic location tracking
 */
export const stopAutoTracking = (): void => {
    if (!isTracking) return;

    console.log('[AutoLocation] Stopping automatic tracking');

    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }

    isTracking = false;
    lastZona = null;
    onZoneChange = null;
};

/**
 * Force an immediate location check
 */
export const forceLocationCheck = async (): Promise<string | null> => {
    const now = Date.now();
    if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
        console.log('[AutoLocation] Rate limited, skipping check');
        return lastZona;
    }

    return checkLocationAndRegister();
};

/**
 * Get current tracking status
 */
export const getTrackingStatus = () => ({
    isTracking,
    isTestingMode,
    lastZona,
    deviceName,
    lastCheckTime: lastCheckTime > 0 ? new Date(lastCheckTime).toISOString() : null,
});

/**
 * Internal: Check location and register with geofence
 */
const checkLocationAndRegister = async (): Promise<string | null> => {
    try {
        lastCheckTime = Date.now();

        console.log('[AutoLocation] Checking location...');

        // Get current position using Capacitor (works on Android + web)
        const position = await getCurrentPosition();

        if (!position) {
            console.warn('[AutoLocation] Could not get position');
            return null;
        }

        console.log(`[AutoLocation] Position: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`);

        const deviceId = getOrCreateDeviceId();

        // Call check-geofence to detect zone
        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: {
                lat: position.latitude,
                lng: position.longitude,
                action: 'register',
                deviceId,
                previousZona: lastZona,
                accuracy: position.accuracy,
                deviceName: deviceName
            }
        });

        if (error) {
            console.error('[AutoLocation] Geofence check error:', error);
            return lastZona;
        }

        const newZona = data?.success ? data.zona : null;

        // Detect zone changes
        if (newZona !== lastZona) {
            console.log(`[AutoLocation] Zone changed: ${lastZona || 'none'} → ${newZona || 'none'}`);

            // If we left a zone, register exit
            if (lastZona && !newZona) {
                await registerExit(deviceId, lastZona);
            }

            lastZona = newZona;
            onZoneChange?.(newZona);
        }

        return newZona;
    } catch (error) {
        console.error('[AutoLocation] Error:', error);
        return null;
    }
};

/**
 * Register exit from a zone
 */
const registerExit = async (deviceId: string, zona: string): Promise<void> => {
    try {
        console.log(`[AutoLocation] Registering exit from ${zona}`);

        // Update the most recent entry for this device in this zone
        const { error } = await supabase
            .from('registros_reten')
            .update({ exited_at: new Date().toISOString() } as any)
            .eq('device_id', deviceId)
            .eq('zona', zona)
            .is('exited_at', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[AutoLocation] Exit registration error:', error);
        }
    } catch (error) {
        console.error('[AutoLocation] Exit error:', error);
    }
};

/**
 * Check if running on a native platform
 */
export const isNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Enable testing mode - tracking every 30 seconds
 * @param name Optional device name for identification (e.g., "Papa's Taxi")
 */
export const enableTestingMode = (name?: string): void => {
    console.log(`[AutoLocation] Enabling testing mode${name ? ` for "${name}"` : ''}`);
    isTestingMode = true;
    deviceName = name || null;

    // Save to localStorage for persistence
    localStorage.setItem('geofence_testing_mode', 'true');
    if (name) localStorage.setItem('geofence_device_name', name);

    // If already tracking, restart with new interval
    if (isTracking) {
        const callback = onZoneChange;
        stopAutoTracking();
        startAutoTracking(callback || undefined);
    } else {
        // If NOT tracking yet, start it now!
        console.log('[AutoLocation] Starting tracking from enableTestingMode...');
        startAutoTracking();
    }
};

/**
 * Disable testing mode - back to 5-minute intervals
 */
export const disableTestingMode = (): void => {
    console.log('[AutoLocation] Disabling testing mode');
    isTestingMode = false;
    deviceName = null;

    // If already tracking, restart with new interval
    if (isTracking) {
        const callback = onZoneChange;
        stopAutoTracking();
        startAutoTracking(callback || undefined);
    }

    localStorage.removeItem('geofence_testing_mode');
    localStorage.removeItem('geofence_device_name');
};

/**
 * Set device name for logging identification
 */
export const setDeviceName = (name: string): void => {
    deviceName = name;
    localStorage.setItem('geofence_device_name', name);
};

/**
 * Initialize testing mode from localStorage (call on app start)
 */
export const initTestingMode = (): void => {
    const savedMode = localStorage.getItem('geofence_testing_mode');
    const savedName = localStorage.getItem('geofence_device_name');

    if (savedMode === 'true') {
        isTestingMode = true;
        deviceName = savedName;
        console.log(`[AutoLocation] Restored testing mode${savedName ? ` for "${savedName}"` : ''}`);
    }
};
