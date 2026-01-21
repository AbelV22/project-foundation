import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import type { BackgroundGeolocationPlugin, Location, CallbackError } from '@capacitor-community/background-geolocation';
import { registerPlugin } from '@capacitor/core';

// Register the plugin
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

// Background geolocation state
let isBackgroundTrackingActive = false;
let watcherId: string | null = null;
let lastZona: string | null = null;
let lastPosition: { lat: number; lng: number; accuracy?: number } | null = null;
let lastUpdateTime = 0;
let deviceName: string | null = null;

// Configuration
const MIN_UPDATE_INTERVAL_MS = 30 * 1000; // Minimum 30 seconds between geofence checks

/**
 * Check if running on native platform
 */
export const isNativePlatform = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Initialize background geolocation service
 * This sets up continuous tracking that works even when app is in background
 */
export const initBackgroundGeolocation = async (): Promise<boolean> => {
    if (!isNativePlatform()) {
        console.log('[BackgroundGeo] Not on native platform, using foreground tracking');
        return false;
    }

    try {
        // Load saved settings
        deviceName = localStorage.getItem('geofence_device_name');

        // Add watcher for background location updates
        watcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: 'iTaxiBcn está rastreando tu ubicación',
                backgroundTitle: 'Tracking activo',
                requestPermissions: true,
                stale: false,
                distanceFilter: 50, // Minimum distance (meters) to trigger update
            },
            async (location?: Location, error?: CallbackError) => {
                if (error) {
                    console.error('[BackgroundGeo] Error:', error);
                    return;
                }

                if (location) {
                    console.log(`[BackgroundGeo] 📍 Location update: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);
                    
                    lastPosition = {
                        lat: location.latitude,
                        lng: location.longitude,
                        accuracy: location.accuracy
                    };

                    // Throttle geofence checks
                    const now = Date.now();
                    if (now - lastUpdateTime >= MIN_UPDATE_INTERVAL_MS) {
                        lastUpdateTime = now;
                        await checkGeofenceAndRegister(location.latitude, location.longitude, location.accuracy);
                    }
                }
            }
        );

        isBackgroundTrackingActive = true;
        console.log('[BackgroundGeo] ✅ Background tracking initialized, watcherId:', watcherId);
        
        // Save state
        localStorage.setItem('background_geo_active', 'true');
        
        return true;
    } catch (error) {
        console.error('[BackgroundGeo] ❌ Failed to initialize:', error);
        return false;
    }
};

/**
 * Stop background geolocation tracking
 */
export const stopBackgroundGeolocation = async (): Promise<void> => {
    if (!watcherId) {
        console.log('[BackgroundGeo] No active watcher to stop');
        return;
    }

    try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        
        watcherId = null;
        isBackgroundTrackingActive = false;
        localStorage.removeItem('background_geo_active');
        
        console.log('[BackgroundGeo] Tracking stopped');
    } catch (error) {
        console.error('[BackgroundGeo] Error stopping:', error);
    }
};

/**
 * Check geofence and register position with backend
 */
const checkGeofenceAndRegister = async (lat: number, lng: number, accuracy?: number): Promise<void> => {
    try {
        const deviceId = getOrCreateDeviceId();

        console.log(`[BackgroundGeo] Checking geofence for ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: {
                lat,
                lng,
                action: 'register',
                deviceId,
                previousZona: lastZona,
                accuracy,
                deviceName,
                isBackground: true
            }
        });

        if (error) {
            console.error('[BackgroundGeo] Geofence error:', error);
            return;
        }

        if (data?.success) {
            const newZona = data.zona || null;
            
            if (newZona !== lastZona) {
                console.log(`[BackgroundGeo] 🔄 Zone changed: ${lastZona || 'none'} → ${newZona || 'none'}`);
                lastZona = newZona;
            }
            
            console.log(`[BackgroundGeo] ✅ Zone: ${newZona || 'outside'}`);
        } else {
            console.warn('[BackgroundGeo] Geofence check failed:', data?.message);
        }
    } catch (error) {
        console.error('[BackgroundGeo] Error in geofence check:', error);
    }
};

/**
 * Get current background tracking status
 */
export const getBackgroundStatus = () => ({
    isActive: isBackgroundTrackingActive,
    watcherId,
    lastZona,
    lastPosition,
    lastUpdateTime: lastUpdateTime > 0 ? new Date(lastUpdateTime).toISOString() : null,
    deviceName
});

/**
 * Set device name for identification
 */
export const setBackgroundDeviceName = (name: string): void => {
    deviceName = name;
    localStorage.setItem('geofence_device_name', name);
};

/**
 * Check if background tracking should be restored on app start
 */
export const shouldRestoreBackgroundTracking = (): boolean => {
    return localStorage.getItem('background_geo_active') === 'true';
};

/**
 * Open app settings for location permissions
 */
export const openLocationSettings = async (): Promise<void> => {
    if (!isNativePlatform()) return;
    
    try {
        await BackgroundGeolocation.openSettings();
    } catch (error) {
        console.error('[BackgroundGeo] Could not open settings:', error);
    }
};
