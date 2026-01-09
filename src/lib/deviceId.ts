const DEVICE_ID_KEY = 'itaxi_device_id';

export function getOrCreateDeviceId(): string {
  // Check localStorage first
  const existingId = localStorage.getItem(DEVICE_ID_KEY);
  if (existingId && existingId.length >= 36) {
    return existingId;
  }

  // Generate new UUID v4
  const newId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}
