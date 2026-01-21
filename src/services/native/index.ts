// Native platform services
// These provide GPS, Push Notification, and Background Tracking capabilities for the Android app

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

export {
    initBackgroundGeolocation,
    stopBackgroundGeolocation,
    getBackgroundStatus,
    setBackgroundDeviceName,
    shouldRestoreBackgroundTracking,
    openLocationSettings,
    requestBackgroundPermissions,
    isNativePlatform,
} from './backgroundGeolocation';

export {
    isBatteryOptimizationIgnored,
    requestIgnoreBatteryOptimization,
    openBatterySettings,
    acquireWakeLock,
    releaseWakeLock,
    acquireWifiLock,
    releaseWifiLock,
    showBatteryOptimizationDialog,
    ensureBatteryOptimizationExcluded,
} from './batteryOptimization';

// Debug tracking for diagnosing background issues
export {
    startDebugTracking,
    stopDebugTracking,
    getDebugStatus,
    setDebugDeviceName,
    logDebugEvent,
    fetchDebugLogs,
} from './debugTracking';

import { Capacitor } from '@capacitor/core';

/**
 * Get the current platform
 */
export const getPlatform = (): 'android' | 'ios' | 'web' => {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
};
