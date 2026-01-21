import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from '@/lib/deviceId';
import type { BackgroundGeolocationPlugin, Location, CallbackError } from '@capacitor-community/background-geolocation';
import { registerPlugin } from '@capacitor/core';

// Register the plugin
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

// State
let watcherId: string | null = null;
let isTracking = false;
let debugDeviceName: string | null = null;
let locationCount = 0;
let lastLogTime = 0;

/**
 * Log a debug event to Supabase
 * This persists logs so we can see what happens in background
 */
export const logDebugEvent = async (
    eventType: string,
    message: string,
    location?: { lat: number; lng: number; accuracy?: number },
    isBackground: boolean = false
): Promise<void> => {
    const deviceId = getOrCreateDeviceId();
    const deviceName = debugDeviceName || localStorage.getItem('geofence_device_name');

    // Console log with timestamp
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}] ${eventType}: ${message}`, location || '');

    try {
        // Insert into Supabase (fire and forget for performance)
        supabase
            .from('location_debug_logs')
            .insert({
                device_id: deviceId,
                device_name: deviceName,
                event_type: eventType,
                message: message,
                latitude: location?.lat,
                longitude: location?.lng,
                accuracy: location?.accuracy,
                is_background: isBackground,
                app_state: document.hidden ? 'background' : 'foreground'
            })
            .then(({ error }) => {
                if (error) console.error('[DEBUG] Failed to log:', error.message);
            });
    } catch (e) {
        console.error('[DEBUG] Error logging:', e);
    }
};

/**
 * Initialize background tracking with MAXIMUM debugging
 */
export const startDebugTracking = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[DEBUG] Not on native platform');
        return false;
    }

    if (isTracking && watcherId) {
        await logDebugEvent('warning', 'Already tracking, skipping init');
        return true;
    }

    debugDeviceName = localStorage.getItem('geofence_device_name');
    locationCount = 0;

    await logDebugEvent('service_start', 'Starting background tracking service');

    try {
        await logDebugEvent('watcher_adding', 'About to add watcher...');

        // Use the SIMPLEST configuration possible
        watcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: 'DEBUG: Tracking location',
                backgroundTitle: 'iTaxiBcn Debug',
                requestPermissions: true,
                stale: false,
                distanceFilter: 10, // Very sensitive for debugging
            },
            async (location?: Location, error?: CallbackError) => {
                const now = Date.now();
                const timeSinceLastLog = now - lastLogTime;
                lastLogTime = now;

                if (error) {
                    await logDebugEvent('error', `Watcher error: ${error.code} - ${error.message}`, undefined, true);

                    if (error.code === 'NOT_AUTHORIZED') {
                        await logDebugEvent('permission_denied', 'Location permission denied', undefined, true);
                    }
                    return;
                }

                if (location) {
                    locationCount++;
                    const isBackground = document.hidden;

                    await logDebugEvent(
                        'location_received',
                        `Location #${locationCount} (${timeSinceLastLog}ms since last)`,
                        {
                            lat: location.latitude,
                            lng: location.longitude,
                            accuracy: location.accuracy
                        },
                        isBackground
                    );

                    // Send to geofence check
                    await sendToGeofence(location);
                }
            }
        );

        isTracking = true;
        await logDebugEvent('watcher_added', `Watcher created with ID: ${watcherId}`);

        // Set up visibility change listener to log when app goes to background
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return true;

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await logDebugEvent('error', `Failed to add watcher: ${errorMsg}`);
        return false;
    }
};

/**
 * Handle visibility changes (foreground/background)
 */
const handleVisibilityChange = async () => {
    const state = document.hidden ? 'background' : 'foreground';
    await logDebugEvent('app_state_change', `App went to ${state}`);
};

/**
 * Send location to geofence Edge Function
 */
const sendToGeofence = async (location: Location): Promise<void> => {
    const deviceId = getOrCreateDeviceId();
    const deviceName = debugDeviceName || localStorage.getItem('geofence_device_name');
    const isBackground = document.hidden;

    try {
        await logDebugEvent('geofence_calling', 'Calling check-geofence...', {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy
        }, isBackground);

        const { data, error } = await supabase.functions.invoke('check-geofence', {
            body: {
                lat: location.latitude,
                lng: location.longitude,
                action: 'register',
                deviceId,
                accuracy: location.accuracy,
                deviceName,
                isBackground,
                debug: true
            }
        });

        if (error) {
            await logDebugEvent('geofence_error', `Error: ${error.message}`, undefined, isBackground);
            return;
        }

        await logDebugEvent(
            'geofence_success',
            `Zone: ${data?.zona || 'outside'}, Message: ${data?.message || 'ok'}`,
            { lat: location.latitude, lng: location.longitude },
            isBackground
        );

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        await logDebugEvent('geofence_exception', errorMsg, undefined, isBackground);
    }
};

/**
 * Stop tracking
 */
export const stopDebugTracking = async (): Promise<void> => {
    await logDebugEvent('service_stop', `Stopping tracking. Total locations received: ${locationCount}`);

    if (watcherId) {
        try {
            await BackgroundGeolocation.removeWatcher({ id: watcherId });
            await logDebugEvent('watcher_removed', `Removed watcher ${watcherId}`);
        } catch (e) {
            await logDebugEvent('error', `Error removing watcher: ${e}`);
        }
        watcherId = null;
    }

    isTracking = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
};

/**
 * Get debug status
 */
export const getDebugStatus = () => ({
    isTracking,
    watcherId,
    locationCount,
    deviceName: debugDeviceName
});

/**
 * Set device name for identification
 */
export const setDebugDeviceName = (name: string): void => {
    debugDeviceName = name;
    localStorage.setItem('geofence_device_name', name);
    logDebugEvent('config', `Device name set to: ${name}`);
};

/**
 * Fetch recent debug logs from Supabase
 */
export const fetchDebugLogs = async (limit: number = 50): Promise<any[]> => {
    const deviceId = getOrCreateDeviceId();

    const { data, error } = await supabase
        .from('location_debug_logs')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[DEBUG] Error fetching logs:', error);
        return [];
    }

    return data || [];
};
