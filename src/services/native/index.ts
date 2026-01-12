// Native platform services
// These provide GPS and Push Notification capabilities for the Android app

export {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    requestLocationPermission,
    checkLocationPermission,
    type LocationResult,
} from './geolocation';

export {
    registerForPushNotifications,
    checkNotificationPermission,
    setupNotificationListeners,
    clearAllNotifications,
    type NotificationData,
} from './notifications';

import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running on a native platform (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'android' | 'ios' | 'web' => {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
};
