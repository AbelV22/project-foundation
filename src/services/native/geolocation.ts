import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';

export interface LocationResult {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

/**
 * Check if we're running on a native platform
 */
export const isNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Request location permissions
 * @returns true if permission was granted
 */
export const requestLocationPermission = async (): Promise<boolean> => {
    try {
        if (!isNative()) {
            // On web, the browser will handle permissions
            return true;
        }

        const permission = await Geolocation.requestPermissions();
        return permission.location === 'granted';
    } catch (error) {
        console.error('Error requesting location permission:', error);
        return false;
    }
};

/**
 * Check current location permission status
 */
export const checkLocationPermission = async (): Promise<boolean> => {
    try {
        if (!isNative()) {
            return true;
        }

        const permission = await Geolocation.checkPermissions();
        return permission.location === 'granted';
    } catch (error) {
        console.error('Error checking location permission:', error);
        return false;
    }
};

/**
 * Get human-readable error message for geolocation errors
 */
const getGeolocationErrorMessage = (error: GeolocationPositionError): string => {
    switch (error.code) {
        case 1: // PERMISSION_DENIED
            return 'Permiso denegado. Habilita la ubicación en tu navegador.';
        case 2: // POSITION_UNAVAILABLE
            return 'Ubicación no disponible. El navegador no puede acceder a GPS/WiFi.';
        case 3: // TIMEOUT
            return 'Tiempo agotado. Intenta de nuevo.';
        default:
            return error.message || 'Error desconocido';
    }
};

/**
 * Request browser location permission explicitly
 */
export const requestBrowserPermission = async (): Promise<{ granted: boolean; error?: string }> => {
    try {
        // Check if we can use the Permissions API
        if ('permissions' in navigator) {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            console.log('[Geolocation] Permission status:', permission.state);

            if (permission.state === 'denied') {
                return {
                    granted: false,
                    error: 'Ubicación bloqueada. Ve a configuración del navegador para habilitarla.'
                };
            }
        }

        // Try to get position to trigger permission prompt
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => {
                    console.log('[Geolocation] ✅ Permission granted');
                    resolve({ granted: true });
                },
                (error) => {
                    console.warn('[Geolocation] Permission request failed:', error.code, error.message);
                    resolve({
                        granted: false,
                        error: getGeolocationErrorMessage(error)
                    });
                },
                { timeout: 10000 }
            );
        });
    } catch (error) {
        console.error('[Geolocation] Permission request error:', error);
        return { granted: false, error: 'Error al solicitar permisos' };
    }
};

/**
 * Get current position - ONLY REAL GPS, no mock locations
 * Uses Capacitor on native platforms, falls back to browser geolocation on web
 */
export const getCurrentPosition = async (): Promise<LocationResult | null> => {
    try {
        // For web browser, use navigator.geolocation directly
        if (!isNative() && typeof navigator !== 'undefined' && navigator.geolocation) {
            console.log('[Geolocation] Using browser geolocation API');

            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log('[Geolocation] ✅ Real position obtained:', position.coords.latitude.toFixed(5), position.coords.longitude.toFixed(5));
                        localStorage.setItem('geolocation_last_success', Date.now().toString());
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp,
                        });
                    },
                    (error) => {
                        const errorMsg = getGeolocationErrorMessage(error);
                        console.warn('[Geolocation] ❌ Browser error:', error.code, '-', errorMsg);
                        localStorage.setItem('geolocation_last_error', errorMsg);
                        resolve(null);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 60000, // Cache for 1 minute
                    }
                );
            });
        }

        // Native platform: use Capacitor
        console.log('[Geolocation] Using Capacitor geolocation');
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            console.warn('[Geolocation] Permission not granted');
            localStorage.setItem('geolocation_last_error', 'Permiso de ubicación no concedido');
            return null;
        }

        const position: Position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
        });

        console.log('[Geolocation] ✅ Capacitor position:', position.coords.latitude.toFixed(5), position.coords.longitude.toFixed(5));
        localStorage.setItem('geolocation_last_success', Date.now().toString());
        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
        };
    } catch (error) {
        console.error('[Geolocation] Error:', error);
        localStorage.setItem('geolocation_last_error', error instanceof Error ? error.message : 'Error desconocido');
        return null;
    }
};

/**
 * Get last geolocation error message (for UI display)
 */
export const getLastGeolocationError = (): string | null => {
    return localStorage.getItem('geolocation_last_error');
};

/**
 * Check if geolocation has worked recently
 */
export const hasRecentGeolocationSuccess = (): boolean => {
    const lastSuccess = localStorage.getItem('geolocation_last_success');
    if (!lastSuccess) return false;
    const elapsed = Date.now() - parseInt(lastSuccess, 10);
    return elapsed < 5 * 60 * 1000; // Within last 5 minutes
};

/**
 * Watch position changes
 * @param callback Function to call when position changes
 * @returns Watch ID to use for clearing the watch
 */
export const watchPosition = async (
    callback: (position: LocationResult | null, error?: Error) => void
): Promise<string | null> => {
    try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            callback(null, new Error('Location permission not granted'));
            return null;
        }

        const watchId = await Geolocation.watchPosition(
            {
                enableHighAccuracy: true,
                timeout: 10000,
            },
            (position, err) => {
                if (err) {
                    callback(null, new Error(err.message));
                    return;
                }

                if (position) {
                    callback({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                    });
                }
            }
        );

        return watchId;
    } catch (error) {
        console.error('Error watching position:', error);
        return null;
    }
};

/**
 * Stop watching position
 */
export const clearWatch = async (watchId: string): Promise<void> => {
    try {
        await Geolocation.clearWatch({ id: watchId });
    } catch (error) {
        console.error('Error clearing watch:', error);
    }
};
