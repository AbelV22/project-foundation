import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Battery Optimization Plugin Interface
 * Native plugin to check and request battery optimization exclusion
 */
interface BatteryOptimizationPlugin {
    isIgnoringBatteryOptimizations(): Promise<{ ignored: boolean }>;
    requestIgnoreBatteryOptimizations(): Promise<{ success: boolean }>;
    openBatterySettings(): Promise<void>;
    acquireWakeLock(): Promise<{ success: boolean }>;
    releaseWakeLock(): Promise<{ success: boolean }>;
    acquireWifiLock(): Promise<{ success: boolean }>;
    releaseWifiLock(): Promise<{ success: boolean }>;
}

// Register native plugin (will be implemented in Android)
const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

/**
 * Check if app is excluded from battery optimization
 */
export const isBatteryOptimizationIgnored = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[BatteryOptimization] Not on native platform');
        return true; // On web, we don't need this
    }

    try {
        const result = await BatteryOptimization.isIgnoringBatteryOptimizations();
        console.log('[BatteryOptimization] Is ignored:', result.ignored);
        return result.ignored;
    } catch (error) {
        console.error('[BatteryOptimization] Error checking status:', error);
        return false;
    }
};

/**
 * Request to be excluded from battery optimization
 * This opens a system dialog asking the user
 */
export const requestIgnoreBatteryOptimization = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await BatteryOptimization.requestIgnoreBatteryOptimizations();
        console.log('[BatteryOptimization] Request result:', result.success);
        return result.success;
    } catch (error) {
        console.error('[BatteryOptimization] Error requesting:', error);
        return false;
    }
};

/**
 * Open battery settings for manual configuration
 */
export const openBatterySettings = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    try {
        await BatteryOptimization.openBatterySettings();
    } catch (error) {
        console.error('[BatteryOptimization] Error opening settings:', error);
    }
};

/**
 * Acquire a PARTIAL_WAKE_LOCK to keep CPU running
 */
export const acquireWakeLock = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await BatteryOptimization.acquireWakeLock();
        console.log('[BatteryOptimization] WakeLock acquired:', result.success);
        return result.success;
    } catch (error) {
        console.error('[BatteryOptimization] Error acquiring WakeLock:', error);
        return false;
    }
};

/**
 * Release the WakeLock
 */
export const releaseWakeLock = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await BatteryOptimization.releaseWakeLock();
        console.log('[BatteryOptimization] WakeLock released:', result.success);
        return result.success;
    } catch (error) {
        console.error('[BatteryOptimization] Error releasing WakeLock:', error);
        return false;
    }
};

/**
 * Acquire WiFi lock to keep network connection active
 */
export const acquireWifiLock = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await BatteryOptimization.acquireWifiLock();
        console.log('[BatteryOptimization] WifiLock acquired:', result.success);
        return result.success;
    } catch (error) {
        console.error('[BatteryOptimization] Error acquiring WifiLock:', error);
        return false;
    }
};

/**
 * Release WiFi lock
 */
export const releaseWifiLock = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }

    try {
        const result = await BatteryOptimization.releaseWifiLock();
        console.log('[BatteryOptimization] WifiLock released:', result.success);
        return result.success;
    } catch (error) {
        console.error('[BatteryOptimization] Error releasing WifiLock:', error);
        return false;
    }
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
