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
 * Get current position
 * Uses Capacitor on native platforms, falls back to browser geolocation on web
 */
export const getCurrentPosition = async (): Promise<LocationResult | null> => {
    try {
        // For web browser testing, use navigator.geolocation directly
        if (!isNative() && typeof navigator !== 'undefined' && navigator.geolocation) {
            console.log('[Geolocation] Using browser geolocation API');

            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log('[Geolocation] Browser position obtained:', position.coords.latitude, position.coords.longitude);
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp,
                        });
                    },
                    (error) => {
                        console.error('[Geolocation] Browser geolocation error:', error.message);
                        resolve(null);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000, // Cache for 1 minute
                    }
                );
            });
        }

        // Native platform: use Capacitor
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            console.warn('Location permission not granted');
            return null;
        }

        const position: Position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
        });

        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
        };
    } catch (error) {
        console.error('Error getting current position:', error);
        return null;
    }
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
