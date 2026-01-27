import { supabase } from '@/integrations/supabase/client';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

const DEVICE_UUID_KEY = 'itaxi_device_uuid';
const DEVICE_NUMBER_KEY = 'itaxi_device_number';

/**
 * Get or create the device UUID (internal identifier)
 * Uses hardware ID on native platforms for stability
 */
export async function getStableDeviceUUID(): Promise<string> {
  // Check memory/local cache first
  const existingId = localStorage.getItem(DEVICE_UUID_KEY);
  if (existingId && existingId.length >= 36) {
    return existingId;
  }

  // On native, try to get hardware ID
  if (Capacitor.isNativePlatform()) {
    try {
      const id = await Device.getId();
      if (id && id.identifier) {
        console.log('[DeviceId] Using hardware UUID:', id.identifier);
        localStorage.setItem(DEVICE_UUID_KEY, id.identifier);
        return id.identifier;
      }
    } catch (e) {
      console.warn('[DeviceId] Failed to get hardware ID:', e);
    }
  }

  // Fallback: Generate random UUID
  const newId = crypto.randomUUID();
  localStorage.setItem(DEVICE_UUID_KEY, newId);
  return newId;
}

/**
 * Get the simple device number (1, 2, 3, etc.)
 * Returns cached number if available
 */
export function getDeviceNumber(): number | null {
  const cached = localStorage.getItem(DEVICE_NUMBER_KEY);
  return cached ? parseInt(cached, 10) : null;
}

/**
 * Register device and get a simple numeric ID (1, 2, 3, ...)
 * This should be called on app startup
 */
export async function registerDevice(deviceName?: string): Promise<number> {

  // Always ensure we have the stable UUID first
  const deviceUUID = await getStableDeviceUUID();

  // Check if we already have a number cached
  const cachedNumber = getDeviceNumber();
  if (cachedNumber !== null) {
    console.log(`[DeviceId] Using cached device number: ${cachedNumber}`);
    return cachedNumber;
  }

  try {
    // Call the database function to get or create device number
    // @ts-ignore
    const { data, error } = await supabase.rpc('get_or_create_device_number', {
      p_device_uuid: deviceUUID,
      p_device_name: deviceName || null
    });

    if (error) {
      console.error('[DeviceId] Error registering device:', error);
      // Fallback: use a hash of UUID as temporary number
      const fallbackNumber = Math.abs(hashCode(deviceUUID)) % 1000;
      return fallbackNumber;
    }

    const deviceNumber = data as number;
    localStorage.setItem(DEVICE_NUMBER_KEY, deviceNumber.toString());
    console.log(`[DeviceId] Registered as device #${deviceNumber}`);
    return deviceNumber;
  } catch (err) {
    console.error('[DeviceId] Registration failed:', err);
    const fallbackNumber = Math.abs(hashCode(deviceUUID)) % 1000;
    return fallbackNumber;
  }
}

/**
 * Get device ID for display and tracking
 * Returns format: "D1" or UUID if not ready
 * Note: This is synchronous, so it relies on registerDevice being called previously
 */
export function getOrCreateDeviceId(): string {
  const deviceNumber = getDeviceNumber();
  if (deviceNumber !== null) {
    return `D${deviceNumber}`;
  }
  // If called before async registration, return cached UUID or temp
  return localStorage.getItem(DEVICE_UUID_KEY) || 'pending_uuid';
}

/**
 * Get display-friendly device identifier
 */
export function getDeviceDisplayName(): string {
  const deviceNumber = getDeviceNumber();
  if (deviceNumber !== null) {
    return `Dispositivo #${deviceNumber}`;
  }
  return "Iniciando...";
}

// Simple hash function for fallback
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
