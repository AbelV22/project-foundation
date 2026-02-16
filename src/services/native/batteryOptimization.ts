import { Capacitor } from '@capacitor/core';
import {
    requestIgnoreBatteryOptimizations as proRequestIgnore,
    isIgnoringBatteryOptimizations as proIsIgnoring
} from './proTracking';

/**
 * Check if app is excluded from battery optimization
 */
export const isBatteryOptimizationIgnored = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[BatteryOptimization] Not on native platform');
        return true; // On web, we don't need this
    }

    return await proIsIgnoring();
};

/**
 * Request to be excluded from battery optimization
 * This opens a system dialog asking the user
 */
export const requestIgnoreBatteryOptimization = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    return await proRequestIgnore();
};

/**
 * Open battery settings for manual configuration
 */
export const openBatterySettings = async (): Promise<void> => {
    // ProTracking doesn't support opening generic settings yet, 
    // but the requestIgnore request handles the dialog flow.
    // For now we can leave this empty or implement a specific intent in ProTracking if needed later.
    console.warn('[BatteryOptimization] openBatterySettings not implemented in ProTracking yet');
};

/**
 * Acquire a PARTIAL_WAKE_LOCK to keep CPU running
 */
export const acquireWakeLock = async (): Promise<boolean> => {
    // WakeLock is handled internally by LocationTrackingService now
    return true;
};

/**
 * Release the WakeLock
 */
export const releaseWakeLock = async (): Promise<boolean> => {
    // WakeLock is handled internally by LocationTrackingService now
    return true;
};

/**
 * Acquire WiFi lock to keep network connection active
 */
export const acquireWifiLock = async (): Promise<boolean> => {
    // Not critical for now
    return true;
};

/**
 * Release WiFi lock
 */
export const releaseWifiLock = async (): Promise<boolean> => {
    return true;
};


/**
 * Show a dialog explaining why battery optimization exclusion is needed
 * Returns true if user agrees to open settings
 */
export const showBatteryOptimizationDialog = async (): Promise<boolean> => {
    return new Promise((resolve) => {
        const result = window.confirm(
            '⚠️ Optimización de Batería\n\n' +
            'Para que el tracking de ubicación funcione correctamente en segundo plano, ' +
            'necesitas desactivar las restricciones de batería para esta app.\n\n' +
            '¿Quieres ir a la configuración para marcar la app como "Sin restricciones"?'
        );
        resolve(result);
    });
};

/**
 * Check and request battery optimization exclusion with dialog
 */
export const ensureBatteryOptimizationExcluded = async (): Promise<boolean> => {
    const isIgnored = await isBatteryOptimizationIgnored();

    if (isIgnored) {
        console.log('[BatteryOptimization] Already excluded from optimization');
        return true;
    }

    const userAgreed = await showBatteryOptimizationDialog();

    if (userAgreed) {
        return await requestIgnoreBatteryOptimization();
    }

    return false;
};
