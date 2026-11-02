import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import { getItem, setItem } from '@/lib/storage'; // Persistence
import type { BackgroundGeolocationPlugin, Location, CallbackError } from '@capacitor-community/background-geolocation';
import { registerPlugin } from '@capacitor/core';
import {
    acquireWakeLock,
    releaseWakeLock,
    acquireWifiLock,
    releaseWifiLock,
    ensureBatteryOptimizationExcluded
} from './batteryOptimization';
import { registerForPushNotifications, checkNotificationPermission } from './notifications';

// Register the plugin
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

// Background geolocation state
let isBackgroundTrackingActive = false;
let watcherId: string | null = null;
let lastZona: string | null = null;
let lastPosition: { lat: number; lng: number; accuracy?: number } | null = null;
let lastUpdateTime = 0;
let deviceName: string | null = null;
let hasWakeLock = false;
let hasWifiLock = false;
let locationCount = 0;

// Adaptive throttle configuration
const MIN_UPDATE_INTERVAL_MS = 60 * 1000;              // Hard minimum between geofence checks
const THROTTLE_STABLE_INSIDE_MS = 4 * 60 * 1000;       // 4 min when inside a zone and not moving
const THROTTLE_OUTSIDE_MS = 2 * 60 * 1000;             // 2 min when outside any zone
const MIN_DISTANCE_METERS = 50;                        // Skip if moved less than this

let lastCheckedPosition: { lat: number; lng: number } | null = null;

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const x = (toRad(b.lng) - toRad(a.lng)) * Math.cos(toRad((a.lat + b.lat) / 2));
    const y = toRad(b.lat) - toRad(a.lat);
    return Math.sqrt(x * x + y * y) * R;
};

/**
 * Log debug event using REST API (bypasses type system for new table)
 */
const logDebugEvent = async (
    eventType: string,
    message: string,
    location?: { lat: number; lng: number; accuracy?: number }
): Promise<void> => {
    const deviceId = getOrCreateDeviceId();
    const isBackground = typeof document !== 'undefined' ? document.hidden : false;

    console.log(`[BackgroundGeo] ${eventType}: ${message}`, location || '');

    try {
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
                event_type: eventType,
                message: message,
                latitude: location?.lat,
                longitude: location?.lng,
                accuracy: location?.accuracy,
                is_background: isBackground,
                app_state: isBackground ? 'background' : 'foreground'
            })
        });
    } catch (e) {
        console.error('[BackgroundGeo] Failed to log:', e);
    }
};

/**
 * Check if running on native platform
 */
export const isNativePlatform = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Request all necessary permissions for background tracking
 */
export const requestBackgroundPermissions = async (): Promise<{
    notifications: boolean;
    batteryOptimization: boolean;
}> => {
    if (!isNativePlatform()) {
        return { notifications: true, batteryOptimization: true };
    }

    console.log('[BackgroundGeo] Requesting background permissions...');

    // 1. Request notification permission (required for foreground service visibility)
    let notificationsGranted = await checkNotificationPermission();
    if (!notificationsGranted) {
        console.log('[BackgroundGeo] Requesting notification permission...');
        const token = await registerForPushNotifications();
        notificationsGranted = token !== null;
    }
    console.log('[BackgroundGeo] Notification permission:', notificationsGranted);

    // 2. Check and request battery optimization exclusion
    const batteryOptimizationIgnored = await ensureBatteryOptimizationExcluded();
    console.log('[BackgroundGeo] Battery optimization excluded:', batteryOptimizationIgnored);

    return {
        notifications: notificationsGranted,
        batteryOptimization: batteryOptimizationIgnored
    };
};

/**
 * Initialize background geolocation service
 */
export const initBackgroundGeolocation = async (): Promise<boolean> => {
    if (!isNativePlatform()) {
        console.log('[BackgroundGeo] Not on native platform, using foreground tracking');
        return false;
    }

    try {
        // Load saved settings
        deviceName = localStorage.getItem('geofence_device_name');
        locationCount = 0;

        await logDebugEvent('service_start', `Starting background tracking. Device: ${deviceName || 'unknown'}`);

        // Request all necessary permissions first
        const permissions = await requestBackgroundPermissions();
        console.log('[BackgroundGeo] Permissions status:', permissions);
        await logDebugEvent('permissions_check', `Notifications: ${permissions.notifications}, Battery: ${permissions.batteryOptimization}`);

        // Acquire WakeLock to prevent CPU sleep
        if (!hasWakeLock) {
            hasWakeLock = await acquireWakeLock();
            console.log('[BackgroundGeo] WakeLock acquired:', hasWakeLock);
        }

        // Acquire WifiLock to maintain network connection
        if (!hasWifiLock) {
            hasWifiLock = await acquireWifiLock();
            console.log('[BackgroundGeo] WifiLock acquired:', hasWifiLock);
        }

        // Restore last known zone from storage to prevent "missing exit" if app restarted inside a zone
        const savedZona = await getItem('background_last_zona');
        if (savedZona) {
            lastZona = savedZona;
            console.log(`[BackgroundGeo] Restored lastZona from storage: ${lastZona}`);
        }

        await logDebugEvent('watcher_adding', 'About to add BackgroundGeolocation watcher...');

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
                    await logDebugEvent('watcher_error', `Error code: ${error.code}, message: ${error.message}`);
                    return;
                }

                if (location) {
                    locationCount++;
                    const timeSinceLastUpdate = Date.now() - lastUpdateTime;

                    console.log(`[BackgroundGeo] Location update: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);

                    // Log every location to debug table
                    await logDebugEvent(
                        'location_received',
                        `Location #${locationCount} (${timeSinceLastUpdate}ms since last geofence check)`,
                        { lat: location.latitude, lng: location.longitude, accuracy: location.accuracy }
                    );

                    lastPosition = {
                        lat: location.latitude,
                        lng: location.longitude,
                        accuracy: location.accuracy
                    };

                    // Adaptive throttle: call edge function less often when state is stable
                    const now = Date.now();
                    const elapsed = now - lastUpdateTime;
                    const current = { lat: location.latitude, lng: location.longitude };
                    const throttleMs = lastZona ? THROTTLE_STABLE_INSIDE_MS : THROTTLE_OUTSIDE_MS;
                    const moved = lastCheckedPosition ? distanceMeters(lastCheckedPosition, current) : Infinity;

                    const shouldCall =
                        elapsed >= MIN_UPDATE_INTERVAL_MS &&
                        (elapsed >= throttleMs || moved >= MIN_DISTANCE_METERS);

                    if (shouldCall) {
                        lastUpdateTime = now;
                        lastCheckedPosition = current;
                        await logDebugEvent('geofence_calling', `Calling check-geofence (moved=${moved.toFixed(0)}m, elapsed=${(elapsed / 1000).toFixed(0)}s)`);
                        await checkGeofenceAndRegister(location.latitude, location.longitude, location.accuracy);
                    }
                }
            }
        );

        isBackgroundTrackingActive = true;
        console.log('[BackgroundGeo] Background tracking initialized, watcherId:', watcherId);
        await logDebugEvent('watcher_added', `Watcher created with ID: ${watcherId}`);

        // Save state
        localStorage.setItem('background_geo_active', 'true');

        return true;
    } catch (error) {
        console.error('[BackgroundGeo] Failed to initialize:', error);
        await logDebugEvent('error', `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
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

        // Release WakeLock
        if (hasWakeLock) {
            await releaseWakeLock();
            hasWakeLock = false;
            console.log('[BackgroundGeo] WakeLock released');
        }

        // Release WifiLock
        if (hasWifiLock) {
            await releaseWifiLock();
            hasWifiLock = false;
            console.log('[BackgroundGeo] WifiLock released');
        }

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

        // Direct RPC instead of the check-geofence Edge Function: same logic,
        // without spending the plan's Edge Function invocation quota.
        // @ts-expect-error - RPC not in generated types yet
        const { data, error } = (await supabase.rpc('fn_geofence_check', {
            p_device_id: deviceId,
            p_lat: lat,
            p_lng: lng,
            p_accuracy: accuracy ?? 0
        })) as {
            data: { success?: boolean; zona?: string; message?: string } | null;
            error: { message: string } | null;
        };

        if (error) {
            console.error('[BackgroundGeo] Geofence error:', error);
            return;
        }

        if (data?.success) {
            const newZona = data.zona || null;

            if (newZona !== lastZona) {
                console.log(`[BackgroundGeo] Zone changed: ${lastZona || 'none'} → ${newZona || 'none'}`);
                lastZona = newZona;
                // Persist new state
                if (newZona) {
                    await setItem('background_last_zona', newZona);
                } else {
                    // We don't necessarily want to remove it immediately if we want to handle glitches? 
                    // No, for client side "state", if server says NULL, we are OUT.
                    // But wait, if we are OUT, we should clear it so we don't think we are IN next boot.
                    await setItem('background_last_zona', '');
                }
            }

            console.log(`[BackgroundGeo] Zone: ${newZona || 'outside'}`);
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
