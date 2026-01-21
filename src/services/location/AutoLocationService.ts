import { registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { Capacitor } from '@capacitor/core';

// Define the interface for the plugin
export interface BackgroundGeolocationPlugin {
    addWatcher(
        options: {
            backgroundMessage?: string;
            backgroundTitle?: string;
            requestPermissions?: boolean;
            stale?: boolean;
            distanceFilter?: number;
        },
        callback: (position: any, error: any) => void
    ): Promise<string>;
    removeWatcher(options: { id: string }): Promise<void>;
    openSettings(): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

// Tracking state
let isTracking = false;
let watcherId: string | null = null;
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
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes limit for redundant checks
const MIN_DISTANCE_FILTER = 10; // Meters

/**
 * Start automatic location tracking using native background service
 */
export const startAutoTracking = async (callback?: ZoneCallback): Promise<void> => {
    if (isTracking) {
        console.log('[AutoLocation] Already tracking');
        return;
    }

    onZoneChange = callback || null;
    isTracking = true;

    console.log(`[AutoLocation] Starting background tracking (testing=${isTestingMode})`);

    try {
        // Initial check immediately
        await checkLocationAndRegister(null, null);

        // Add native watcher
        watcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: "Rastreando ubicación en segundo plano",
                backgroundTitle: "iTaxi BCN",
                requestPermissions: true,
                stale: false,
                distanceFilter: MIN_DISTANCE_FILTER
            },
            (position, error) => {
                if (error) {
                    if (error.code === 'NOT_AUTHORIZED') {
                        if (window.confirm("Esta app necesita usar tu ubicación todo el tiempo. ¿Quieres ir a configuración?")) {
                            BackgroundGeolocation.openSettings();
                        }
                    }
                    console.error('[AutoLocation] Watcher error:', error);
                    lastError = error.message;
                    onZoneChange?.(lastZona, lastError);
                    return;
                }

                if (position) {
                    // Normalize position object if needed (plugin returns slightly different structure sometimes)
                    checkLocationAndRegister(position, null);
                }
            }
        );

        console.log('[AutoLocation] Watcher added with ID:', watcherId);

    } catch (err) {
        console.error('[AutoLocation] Failed to start watcher:', err);
        lastError = err instanceof Error ? err.message : 'Error starting tracker';
        onZoneChange?.(null, lastError);
        isTracking = false;
    }
};

/**
 * Stop automatic location tracking
 */
export const stopAutoTracking = async (): Promise<void> => {
    if (!isTracking) return;

    console.log('[AutoLocation] Stopping automatic tracking');

    if (watcherId) {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        watcherId = null;
    }

    isTracking = false;
    lastZona = null;
    onZoneChange = null;
};

/**
 * Force an immediate location check (useful for manual refresh)
 */
export const forceLocationCheck = async (): Promise<string | null> => {
    return checkLocationAndRegister(null, null);
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
 * Handles both direct calls and watcher updates
 */
const checkLocationAndRegister = async (positionData: any | null, errorData: any | null): Promise<string | null> => {
    try {
        const now = Date.now();
        // Prevent spamming if we get bursts of updates (throttle to 10s)
        if (now - lastCheckTime < 10000 && positionData) {
            return lastZona;
        }

        lastCheckTime = now;
        lastError = null;

        let lat: number;
        let lng: number;
        let accuracy: number | null = null;

        if (positionData) {
            lat = positionData.latitude;
            lng = positionData.longitude;
            accuracy = positionData.accuracy;
        } else {
            // Manual check fallback
            // We can use the plugin's direct method if available, or just rely on the watcher. 
            // Ideally calling this function independently should fetch position if not provided.
            // But for now let's assume if no positionData, we are forcing it or starting up.
            // We will skip actual position fetch here to rely on watcher unless essential.
            console.log('[AutoLocation] Manual check requested, waiting for watcher update...');
            return lastZona;
        }

        lastPosition = { lat, lng };
        console.log(`[AutoLocation] 📍 Position update: ${lat.toFixed(5)}, ${lng.toFixed(5)} (acc: ${accuracy || '?'}m)`);

        const deviceId = getOrCreateDeviceId();

        // Call check-geofence to detect zone
        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: {
                lat,
                lng,
                action: 'register',
                deviceId,
                previousZona: lastZona,
                accuracy,
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

        // Update local state if zone changed
        if (newZona !== lastZona) {
            console.log(`[AutoLocation] 🔄 Zone changed: ${lastZona || 'none'} → ${newZona || 'none'}`);
            lastZona = newZona;
        }

        onZoneChange?.(newZona);
        return newZona;

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        lastError = errorMsg;
        console.error('[AutoLocation] ❌ Error in checkLocationAndRegister:', error);
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
 * Enable testing mode
 */
export const enableTestingMode = (name?: string): void => {
    console.log(`[AutoLocation] Enabling testing mode${name ? ` for "${name}"` : ''}`);
    isTestingMode = true;
    deviceName = name || null;

    // Save settings
    localStorage.setItem('geofence_testing_mode', 'true');
    if (name) localStorage.setItem('geofence_device_name', name);

    // Restart watcher if needed (watcher options don't dynamically change easily, 
    // but we could remove and re-add with different distance filter if we wanted.
    // For now, the same watcher logs debug info if testing mode is on).
    if (isTracking) {
        stopAutoTracking().then(() => startAutoTracking(onZoneChange || undefined));
    }
};

/**
 * Disable testing mode
 */
export const disableTestingMode = (): void => {
    console.log('[AutoLocation] Disabling testing mode');
    isTestingMode = false;
    deviceName = null;
    localStorage.removeItem('geofence_testing_mode');
    localStorage.removeItem('geofence_device_name');
};

/**
 * Set device name
 */
export const setDeviceName = (name: string): void => {
    deviceName = name;
    localStorage.setItem('geofence_device_name', name);
};

/**
 * Initialize testing mode
 */
export const initTestingMode = (): void => {
    const savedMode = localStorage.getItem('geofence_testing_mode');
    const savedName = localStorage.getItem('geofence_device_name');

    if (savedMode === 'true') {
        isTestingMode = true;
        deviceName = savedName;
    }
};

/**
 * Test connection
 */
export const checkConnection = async (): Promise<{ success: boolean; message: string }> => {
    try {
        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: { action: 'ping' }
        });

        if (error) return { success: false, message: `Error conexión: ${error.message}` };
        if (!data?.success) return { success: false, message: `Error respuesta: ${data?.message}` };

        return { success: true, message: `✅ Conectado: ${data.message}` };
    } catch (error) {
        return { success: false, message: `Excepción: ${error instanceof Error ? error.message : 'Unknown'}` };
    }
};
