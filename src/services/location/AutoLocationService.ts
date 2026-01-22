import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { Capacitor } from '@capacitor/core';

// Tracking state
let isTracking = false;
let webWatchId: number | null = null;
let lastZona: string | null = null;
let lastCheckTime = 0;
let lastPosition: { lat: number; lng: number } | null = null;
let lastError: string | null = null;
let isTestingMode = false;
let deviceName: string | null = null;

// Callback for UI updates
type ZoneCallback = (zona: string | null, error?: string) => void;
let onZoneChange: ZoneCallback | null = null;

/**
 * Start automatic location tracking
 * Uses browser geolocation API on web, native plugin only on native platforms
 */
export const startAutoTracking = async (callback?: ZoneCallback): Promise<void> => {
    if (isTracking) {
        console.log('[AutoLocation] Already tracking');
        return;
    }

    onZoneChange = callback || null;
    isTracking = true;

    console.log(`[AutoLocation] Starting tracking (testing=${isTestingMode}, platform=${Capacitor.getPlatform()})`);

    // On web, use browser geolocation API
    if (!Capacitor.isNativePlatform()) {
        startWebTracking();
        return;
    }

    // On native, we'll rely on the backgroundGeolocation service instead
    // This service is just for web fallback
    console.log('[AutoLocation] On native platform, use backgroundGeolocation service instead');
};

/**
 * Start web-based tracking using browser geolocation
 */
const startWebTracking = (): void => {
    if (!('geolocation' in navigator)) {
        lastError = 'Geolocalización no soportada en este navegador';
        console.error('[AutoLocation]', lastError);
        onZoneChange?.(null, lastError);
        return;
    }

    console.log('[AutoLocation] Starting web geolocation tracking');

    // Get initial position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            handlePositionUpdate(position);
        },
        (error) => {
            handlePositionError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000
        }
    );

    // Watch for position changes
    webWatchId = navigator.geolocation.watchPosition(
        (position) => {
            handlePositionUpdate(position);
        },
        (error) => {
            handlePositionError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000
        }
    );

    console.log('[AutoLocation] Web watcher started with ID:', webWatchId);
};

/**
 * Handle position update from browser geolocation
 */
const handlePositionUpdate = async (position: GeolocationPosition): Promise<void> => {
    const now = Date.now();
    
    // Throttle to max one check per 30 seconds
    if (now - lastCheckTime < 30000) {
        return;
    }
    
    lastCheckTime = now;
    lastError = null;
    
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    lastPosition = { lat, lng };
    console.log(`[AutoLocation] Position: ${lat.toFixed(5)}, ${lng.toFixed(5)} (acc: ${accuracy?.toFixed(0)}m)`);
    
    const deviceId = getOrCreateDeviceId();
    
    try {
        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: {
                lat,
                lng,
                action: 'register',
                deviceId,
                previousZona: lastZona,
                accuracy,
                deviceName,
                isBackground: document.hidden
            }
        });
        
        if (error) {
            lastError = `Error de geofence: ${error.message}`;
            console.error('[AutoLocation] Geofence error:', error);
            onZoneChange?.(lastZona, lastError);
            return;
        }
        
        if (!data?.success) {
            lastError = data?.message || 'Error desconocido';
            console.warn('[AutoLocation] Geofence response:', data?.message);
            onZoneChange?.(lastZona, lastError);
            return;
        }
        
        const newZona = data.zona || null;
        
        if (newZona !== lastZona) {
            console.log(`[AutoLocation] Zone changed: ${lastZona || 'none'} → ${newZona || 'none'}`);
            lastZona = newZona;
        }
        
        onZoneChange?.(newZona);
        
    } catch (err) {
        lastError = err instanceof Error ? err.message : 'Error desconocido';
        console.error('[AutoLocation] Error:', err);
        onZoneChange?.(null, lastError);
    }
};

/**
 * Handle position error
 */
const handlePositionError = (error: GeolocationPositionError): void => {
    const errorMessages: Record<number, string> = {
        1: 'Permiso de ubicación denegado',
        2: 'Ubicación no disponible',
        3: 'Tiempo de espera agotado'
    };
    
    lastError = errorMessages[error.code] || error.message;
    console.error('[AutoLocation] Geolocation error:', lastError);
    onZoneChange?.(lastZona, lastError);
};

/**
 * Stop automatic location tracking
 */
export const stopAutoTracking = async (): Promise<void> => {
    if (!isTracking) return;

    console.log('[AutoLocation] Stopping tracking');

    if (webWatchId !== null) {
        navigator.geolocation.clearWatch(webWatchId);
        webWatchId = null;
    }

    isTracking = false;
    lastZona = null;
    onZoneChange = null;
};

/**
 * Force an immediate location check
 */
export const forceLocationCheck = async (): Promise<string | null> => {
    if (!('geolocation' in navigator)) {
        return null;
    }
    
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                await handlePositionUpdate(position);
                resolve(lastZona);
            },
            (error) => {
                handlePositionError(error);
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
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

    localStorage.setItem('geofence_testing_mode', 'true');
    if (name) localStorage.setItem('geofence_device_name', name);

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
 * Initialize testing mode from saved settings
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
 * Test connection to geofence service
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
