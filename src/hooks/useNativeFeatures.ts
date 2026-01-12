import { useState, useEffect, useCallback } from 'react';
import {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    type LocationResult
} from '@/services/native/geolocation';
import {
    registerForPushNotifications,
    setupNotificationListeners,
    checkNotificationPermission,
    type NotificationData
} from '@/services/native/notifications';
import { isNativePlatform } from '@/services/native';

/**
 * Hook for accessing device GPS location
 */
export const useGeolocation = (watch: boolean = false) => {
    const [location, setLocation] = useState<LocationResult | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(false);

    const getLocation = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const position = await getCurrentPosition();
            setLocation(position);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to get location'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!watch) {
            getLocation();
            return;
        }

        let watchId: string | null = null;

        const startWatching = async () => {
            setLoading(true);
            watchId = await watchPosition((pos, err) => {
                setLoading(false);
                if (err) {
                    setError(err);
                } else {
                    setLocation(pos);
                    setError(null);
                }
            });
        };

        startWatching();

        return () => {
            if (watchId) {
                clearWatch(watchId);
            }
        };
    }, [watch, getLocation]);

    return { location, error, loading, refresh: getLocation };
};

/**
 * Hook for managing push notifications
 */
export const usePushNotifications = (
    onNotificationReceived?: (notification: NotificationData) => void,
    onNotificationTapped?: (notification: NotificationData) => void
) => {
    const [token, setToken] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(false);

    const register = useCallback(async () => {
        if (!isNativePlatform()) {
            console.log('Push notifications only available on native platforms');
            return;
        }

        setLoading(true);
        try {
            const fcmToken = await registerForPushNotifications();
            setToken(fcmToken);
            setHasPermission(!!fcmToken);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Check initial permission status
        checkNotificationPermission().then(setHasPermission);
    }, []);

    useEffect(() => {
        if (!hasPermission || !isNativePlatform()) return;

        const cleanup = setupNotificationListeners(
            (notification) => {
                console.log('Notification received:', notification);
                onNotificationReceived?.(notification);
            },
            (notification) => {
                console.log('Notification tapped:', notification);
                onNotificationTapped?.(notification);
            }
        );

        return cleanup;
    }, [hasPermission, onNotificationReceived, onNotificationTapped]);

    return { token, hasPermission, loading, register };
};

/**
 * Hook to detect if running on native platform
 */
export const useIsNative = () => {
    const [isNative, setIsNative] = useState(false);

    useEffect(() => {
        setIsNative(isNativePlatform());
    }, []);

    return isNative;
};
