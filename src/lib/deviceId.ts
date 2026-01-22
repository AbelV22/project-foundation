import { supabase } from '@/integrations/supabase/client';

const DEVICE_UUID_KEY = 'itaxi_device_uuid';
const DEVICE_NUMBER_KEY = 'itaxi_device_number';

/**
 * Get or create the device UUID (internal identifier)
 */
export function getOrCreateDeviceUUID(): string {
  const existingId = localStorage.getItem(DEVICE_UUID_KEY);
  if (existingId && existingId.length >= 36) {
    return existingId;
  }

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
  const deviceUUID = getOrCreateDeviceUUID();

  // Check if we already have a number cached
  const cachedNumber = getDeviceNumber();
  if (cachedNumber !== null) {
    console.log(`[DeviceId] Using cached device number: ${cachedNumber}`);
    return cachedNumber;
  }

  try {
    // Call the database function to get or create device number
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
 * Returns format: "Device #1" or the UUID if not registered yet
 */
export function getOrCreateDeviceId(): string {
  const deviceNumber = getDeviceNumber();
  if (deviceNumber !== null) {
    return `D${deviceNumber}`;
  }
  return getOrCreateDeviceUUID();
}

/**
 * Get display-friendly device identifier
 */
export function getDeviceDisplayName(): string {
  const deviceNumber = getDeviceNumber();
  if (deviceNumber !== null) {
    return `Dispositivo #${deviceNumber}`;
  }
  const uuid = getOrCreateDeviceUUID();
  return `${uuid.substring(0, 8)}...`;
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
