import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Hybrid storage utility that uses Capacitor Preferences on native
 * and localStorage on web for reliable cross-platform storage
 */

const isNative = Capacitor.isNativePlatform();

export async function setItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value;
  } else {
    return localStorage.getItem(key);
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Synchronous getter with fallback - useful during initialization
 * On native, returns cached localStorage value (may be stale)
 * Always call getItem for reliable native storage access
 */
export function getItemSync(key: string): string | null {
  return localStorage.getItem(key);
}

/**
 * Initialize storage by migrating localStorage to Preferences on native
 * Call this on app startup
 */
export async function initializeStorage(keys: string[]): Promise<void> {
  if (!isNative) return;

  for (const key of keys) {
    // Check if value exists in localStorage but not in Preferences
    const localValue = localStorage.getItem(key);
    const { value: prefValue } = await Preferences.get({ key });

    if (localValue && !prefValue) {
      // Migrate from localStorage to Preferences
      await Preferences.set({ key, value: localValue });
      console.log(`[Storage] Migrated ${key} to Preferences`);
    } else if (prefValue && !localValue) {
      // Sync Preferences back to localStorage for sync access
      localStorage.setItem(key, prefValue);
      console.log(`[Storage] Synced ${key} to localStorage`);
    }
  }
}
