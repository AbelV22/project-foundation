import { getCurrentPosition } from '@/services/native/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { Capacitor } from '@capacitor/core';

// Tracking state
let isTracking = false;
let trackingInterval: ReturnType<typeof setInterval> | null = null;
let lastZona: string | null = null;
let lastCheckTime = 0;
let lastPosition: { lat: number; lng: number } | null = null;
let lastError: string | null = null;
let isTestingMode = false;
let deviceName: string | null = null;

// Callback for UI updates
type ZoneCallback = (zona: string | null, error?: string) => void;
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
    lastPosition,
    lastError,
    deviceName,
    lastCheckTime: lastCheckTime > 0 ? new Date(lastCheckTime).toISOString() : null,
});

/**
 * Internal: Check location and register with geofence
 */
const checkLocationAndRegister = async (): Promise<string | null> => {
    try {
        lastCheckTime = Date.now();
        lastError = null;

        console.log('[AutoLocation] Checking location...');

        // Get current position using Capacitor (works on Android + web)
        const position = await getCurrentPosition();

        if (!position) {
            lastError = 'No se pudo obtener la ubicación';
            console.warn('[AutoLocation] ❌ Could not get position');
            onZoneChange?.(null, lastError);
            return null;
        }

        lastPosition = { lat: position.latitude, lng: position.longitude };
        console.log(`[AutoLocation] 📍 Position: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)} (accuracy: ${position.accuracy?.toFixed(0)}m)`);

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
            lastError = `Error de geofence: ${error.message}`;
            console.error('[AutoLocation] ❌ Geofence check error:', error);
            onZoneChange?.(lastZona, lastError);
            return lastZona;
        }

        if (!data?.success) {
            lastError = data?.message || 'Error desconocido';
            console.warn('[AutoLocation] ⚠️ Geofence response:', data?.message);
            onZoneChange?.(lastZona, lastError);
            return lastZona;
        }

        const newZona = data.zona || null;
        console.log(`[AutoLocation] ✅ Zone: ${newZona || 'none'} - ${data.message}`);

        // Detect zone changes
        if (newZona !== lastZona) {
            console.log(`[AutoLocation] 🔄 Zone changed: ${lastZona || 'none'} → ${newZona || 'none'}`);
            lastZona = newZona;
        }

        onZoneChange?.(newZona);
        return newZona;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        lastError = errorMsg;
        console.error('[AutoLocation] ❌ Error:', error);
        onZoneChange?.(null, lastError);
        return null;
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

/**
 * Test connection to Edge Function
 */
export const checkConnection = async (): Promise<{ success: boolean; message: string }> => {
    try {
        console.log('[AutoLocation] Pinging Edge Function...');
        const start = Date.now();

        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: { action: 'ping' }
        });

        const duration = Date.now() - start;

        if (error) {
            console.error('[AutoLocation] Ping error:', error);
            return { success: false, message: `Error conexión: ${error.message}` };
        }

        if (!data?.success) {
            console.warn('[AutoLocation] Ping failed response:', data);
            return { success: false, message: `Error respuesta: ${data?.message || 'Desconocido'}` };
        }

        console.log(`[AutoLocation] Ping success (${duration}ms):`, data);
        return { success: true, message: `✅ Conectado (${duration}ms): ${data.message}` };

    } catch (error) {
        console.error('[AutoLocation] Ping exception:', error);
        return { success: false, message: `Excepción: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
};
