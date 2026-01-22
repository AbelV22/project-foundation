/**
 * Location Diagnostics Service
 * Tracks location every 30 seconds and provides clear feedback about what's happening
 */

import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';

// State
let isActive = false;
let intervalId: number | null = null;
let watchId: number | null = null;
let lastPosition: GeolocationPosition | null = null;
let lastError: string | null = null;
let checkCount = 0;
let deviceName: string | null = null;
let onStatusUpdate: ((status: DiagnosticStatus) => void) | null = null;

export interface DiagnosticStatus {
    timestamp: Date;
    checkNumber: number;
    hasLocation: boolean;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    error?: string;
    errorCode?: number;
    permissionState?: PermissionState;
    isSecureContext: boolean;
    geolocationSupported: boolean;
    message: string;
}

/**
 * Get a clear message explaining the current location status
 */
const getStatusMessage = (status: Partial<DiagnosticStatus>): string => {
    if (!status.geolocationSupported) {
        return '❌ ERROR: Tu navegador no soporta geolocalización';
    }

    if (!status.isSecureContext) {
        return '❌ ERROR: La página debe cargarse por HTTPS para usar geolocalización';
    }

    if (status.permissionState === 'denied') {
        return '❌ ERROR: Permiso de ubicación DENEGADO. Ve a configuración del navegador y permite la ubicación para esta página';
    }

    if (status.permissionState === 'prompt') {
        return '⚠️ PENDIENTE: Necesitas dar permiso de ubicación. Haz clic en "Permitir" cuando el navegador lo pida';
    }

    if (status.error) {
        const errorMessages: Record<number, string> = {
            1: '❌ ERROR: Permiso denegado. Habilita la ubicación en la configuración del navegador',
            2: '❌ ERROR: No se puede determinar la ubicación. Comprueba que el GPS esté activado',
            3: '⏱️ ERROR: Tiempo de espera agotado. La señal GPS es débil'
        };
        return errorMessages[status.errorCode || 0] || `❌ ERROR: ${status.error}`;
    }

    if (status.hasLocation && status.latitude && status.longitude) {
        const accuracyText = status.accuracy 
            ? ` (precisión: ${Math.round(status.accuracy)}m)` 
            : '';
        return `✅ UBICACIÓN OK: ${status.latitude.toFixed(5)}, ${status.longitude.toFixed(5)}${accuracyText}`;
    }

    return '⏳ Obteniendo ubicación...';
};

/**
 * Log diagnostic event to database
 */
const logDiagnostic = async (status: DiagnosticStatus): Promise<void> => {
    const deviceId = getOrCreateDeviceId();
    
    console.log(`[LocationDiag #${status.checkNumber}] ${status.message}`);
    
    try {
        // Use direct REST API call to avoid type issues with the new table
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        await fetch(`${supabaseUrl}/rest/v1/location_debug_logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                device_id: deviceId,
                device_name: deviceName,
                event_type: status.hasLocation ? 'location_success' : 'location_error',
                message: status.message,
                latitude: status.latitude,
                longitude: status.longitude,
                accuracy: status.accuracy,
                is_background: document.hidden,
                app_state: document.hidden ? 'background' : 'foreground'
            })
        });
    } catch (e) {
        console.error('[LocationDiag] Failed to log:', e);
    }
};

/**
 * Check current permission state
 */
const checkPermissionState = async (): Promise<PermissionState | undefined> => {
    try {
        if ('permissions' in navigator) {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state;
        }
    } catch (e) {
        console.warn('[LocationDiag] Cannot check permission state:', e);
    }
    return undefined;
};

/**
 * Perform a single location check
 */
const performCheck = async (): Promise<DiagnosticStatus> => {
    checkCount++;
    
    const baseStatus: Partial<DiagnosticStatus> = {
        timestamp: new Date(),
        checkNumber: checkCount,
        isSecureContext: window.isSecureContext,
        geolocationSupported: 'geolocation' in navigator
    };
    
    // Check permission state
    baseStatus.permissionState = await checkPermissionState();
    
    // Check basic requirements
    if (!baseStatus.geolocationSupported) {
        const status: DiagnosticStatus = {
            ...baseStatus as DiagnosticStatus,
            hasLocation: false,
            message: ''
        };
        status.message = getStatusMessage(status);
        await logDiagnostic(status);
        return status;
    }
    
    if (!baseStatus.isSecureContext) {
        const status: DiagnosticStatus = {
            ...baseStatus as DiagnosticStatus,
            hasLocation: false,
            message: ''
        };
        status.message = getStatusMessage(status);
        await logDiagnostic(status);
        return status;
    }
    
    // Try to get location
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                lastPosition = position;
                lastError = null;
                
                const status: DiagnosticStatus = {
                    ...baseStatus as DiagnosticStatus,
                    hasLocation: true,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    message: ''
                };
                status.message = getStatusMessage(status);
                
                logDiagnostic(status);
                
                // Also send to geofence if we have a position
                sendToGeofence(position);
                
                resolve(status);
            },
            (error) => {
                lastError = error.message;
                
                const status: DiagnosticStatus = {
                    ...baseStatus as DiagnosticStatus,
                    hasLocation: false,
                    error: error.message,
                    errorCode: error.code,
                    message: ''
                };
                status.message = getStatusMessage(status);
                
                logDiagnostic(status);
                resolve(status);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    });
};

/**
 * Send location to geofence check
 */
const sendToGeofence = async (position: GeolocationPosition): Promise<void> => {
    const deviceId = getOrCreateDeviceId();
    
    try {
        await supabase.functions.invoke('check-geofence', {
            body: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                action: 'register',
                deviceId,
                accuracy: position.coords.accuracy,
                deviceName,
                isBackground: document.hidden
            }
        });
    } catch (e) {
        console.error('[LocationDiag] Geofence error:', e);
    }
};

/**
 * Start location diagnostics - checks every 30 seconds
 */
export const startLocationDiagnostics = (
    name?: string,
    statusCallback?: (status: DiagnosticStatus) => void
): void => {
    if (isActive) {
        console.log('[LocationDiag] Already active');
        return;
    }
    
    deviceName = name || localStorage.getItem('geofence_device_name') || 'Unknown';
    if (name) {
        localStorage.setItem('geofence_device_name', name);
    }
    
    onStatusUpdate = statusCallback || null;
    isActive = true;
    checkCount = 0;
    
    console.log('[LocationDiag] Starting diagnostics every 30 seconds...');
    
    // Perform first check immediately
    performCheck().then((status) => {
        onStatusUpdate?.(status);
    });
    
    // Then check every 30 seconds
    intervalId = window.setInterval(async () => {
        const status = await performCheck();
        onStatusUpdate?.(status);
    }, 30000);
    
    // Also watch for position changes (more frequent updates when moving)
    if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                lastPosition = position;
                lastError = null;
            },
            (error) => {
                lastError = error.message;
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000
            }
        );
    }
    
    // Save state
    localStorage.setItem('location_diagnostics_active', 'true');
};

/**
 * Stop location diagnostics
 */
export const stopLocationDiagnostics = (): void => {
    if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
    }
    
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    isActive = false;
    onStatusUpdate = null;
    localStorage.removeItem('location_diagnostics_active');
    
    console.log('[LocationDiag] Stopped');
};

/**
 * Force an immediate check
 */
export const forceLocationCheck = async (): Promise<DiagnosticStatus> => {
    const status = await performCheck();
    onStatusUpdate?.(status);
    return status;
};

/**
 * Get current status
 */
export const getDiagnosticsStatus = () => ({
    isActive,
    checkCount,
    lastPosition: lastPosition ? {
        lat: lastPosition.coords.latitude,
        lng: lastPosition.coords.longitude,
        accuracy: lastPosition.coords.accuracy
    } : null,
    lastError,
    deviceName
});

/**
 * Check if diagnostics should auto-start
 */
export const shouldAutoStart = (): boolean => {
    return localStorage.getItem('location_diagnostics_active') === 'true';
};

/**
 * Request location permission explicitly
 */
export const requestLocationPermission = async (): Promise<{ granted: boolean; error?: string }> => {
    if (!('geolocation' in navigator)) {
        return { granted: false, error: 'Geolocalización no soportada' };
    }
    
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            () => resolve({ granted: true }),
            (error) => resolve({ granted: false, error: error.message }),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
};
