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
 * Check if testing mode is enabled (allows mock locations)
 */
const isTestingModeEnabled = (): boolean => {
    return localStorage.getItem('geofence_testing_mode') === 'true';
};

/**
 * Get mock position for testing (Barcelona area by default)
 */
const getMockPosition = (): LocationResult => {
    // Check for custom test coordinates
    const customLat = localStorage.getItem('test_latitude');
    const customLng = localStorage.getItem('test_longitude');
    
    return {
        latitude: customLat ? parseFloat(customLat) : 41.2925, // Near T1 by default
        longitude: customLng ? parseFloat(customLng) : 2.0540,
        accuracy: 10,
        timestamp: Date.now(),
    };
};

/**
 * Set custom test coordinates
 */
export const setTestCoordinates = (lat: number, lng: number): void => {
    localStorage.setItem('test_latitude', lat.toString());
    localStorage.setItem('test_longitude', lng.toString());
    console.log(`[Geolocation] Test coordinates set to: ${lat}, ${lng}`);
};

/**
 * Clear test coordinates
 */
export const clearTestCoordinates = (): void => {
    localStorage.removeItem('test_latitude');
    localStorage.removeItem('test_longitude');
    console.log('[Geolocation] Test coordinates cleared');
};

/**
 * Get current position
 * Uses Capacitor on native platforms, falls back to browser geolocation on web
 * In testing mode, returns mock coordinates if real location fails
 */
export const getCurrentPosition = async (): Promise<LocationResult | null> => {
    try {
        // For web browser testing, use navigator.geolocation directly
        if (!isNative() && typeof navigator !== 'undefined' && navigator.geolocation) {
            console.log('[Geolocation] Using browser geolocation API');

            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log('[Geolocation] ✅ Position obtained:', position.coords.latitude.toFixed(5), position.coords.longitude.toFixed(5));
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp,
                        });
                    },
                    (error) => {
                        console.warn('[Geolocation] Browser error:', error.code, error.message);
                        
                        // In testing mode, use mock coordinates as fallback
                        if (isTestingModeEnabled()) {
                            const mockPos = getMockPosition();
                            console.log('[Geolocation] 🧪 Using mock position for testing:', mockPos.latitude.toFixed(5), mockPos.longitude.toFixed(5));
                            resolve(mockPos);
                        } else {
                            console.error('[Geolocation] ❌ Location failed. Enable testing mode to use mock coordinates.');
                            resolve(null);
                        }
                    },
                    {
                        enableHighAccuracy: false, // Less strict for better compatibility
                        timeout: 15000, // Longer timeout
                        maximumAge: 300000, // Cache for 5 minutes
                    }
                );
            });
        }

        // Native platform: use Capacitor
        console.log('[Geolocation] Using Capacitor geolocation');
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            console.warn('[Geolocation] Permission not granted');
            
            // In testing mode, use mock coordinates as fallback
            if (isTestingModeEnabled()) {
                const mockPos = getMockPosition();
                console.log('[Geolocation] 🧪 Using mock position (no permission):', mockPos.latitude.toFixed(5), mockPos.longitude.toFixed(5));
                return mockPos;
            }
            return null;
        }

        const position: Position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
        });

        console.log('[Geolocation] ✅ Capacitor position:', position.coords.latitude.toFixed(5), position.coords.longitude.toFixed(5));
        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
        };
    } catch (error) {
        console.error('[Geolocation] Error:', error);
        
        // In testing mode, use mock coordinates as fallback
        if (isTestingModeEnabled()) {
            const mockPos = getMockPosition();
            console.log('[Geolocation] 🧪 Using mock position (error fallback):', mockPos.latitude.toFixed(5), mockPos.longitude.toFixed(5));
            return mockPos;
        }
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
