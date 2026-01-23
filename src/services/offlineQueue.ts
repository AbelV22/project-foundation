/**
 * Offline Queue Service
 * Stores location data locally when offline and syncs when connectivity is restored.
 * Uses IndexedDB for persistent storage on web.
 */

interface QueuedLocation {
    id: string;
    lat: number;
    lng: number;
    accuracy: number | null;
    deviceId: string;
    deviceName: string | null;
    previousZona: string | null;
    timestamp: number;
    retryCount: number;
}

const DB_NAME = 'iTaxiBcn_OfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'locations';
const MAX_RETRY_COUNT = 5;
const MAX_QUEUE_SIZE = 100; // Prevent unbounded growth

let db: IDBDatabase | null = null;
let isOnline = navigator.onLine;
let isSyncing = false;

/**
 * Initialize the IndexedDB database
 */
const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[OfflineQueue] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[OfflineQueue] Database initialized');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

/**
 * Add a location to the offline queue
 */
export const queueLocation = async (location: Omit<QueuedLocation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
    try {
        const database = await initDB();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Check queue size and remove oldest if necessary
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result >= MAX_QUEUE_SIZE) {
                // Remove oldest entries
                const index = store.index('timestamp');
                const cursorRequest = index.openCursor();
                let deletedCount = 0;
                const toDelete = countRequest.result - MAX_QUEUE_SIZE + 10; // Remove 10 extra

                cursorRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor && deletedCount < toDelete) {
                        store.delete(cursor.primaryKey);
                        deletedCount++;
                        cursor.continue();
                    }
                };
            }
        };

        const queuedLocation: QueuedLocation = {
            ...location,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retryCount: 0,
        };

        const addRequest = store.add(queuedLocation);

        return new Promise((resolve, reject) => {
            addRequest.onsuccess = () => {
                console.log('[OfflineQueue] Location queued:', queuedLocation.id);
                resolve();
            };
            addRequest.onerror = () => {
                console.error('[OfflineQueue] Failed to queue location:', addRequest.error);
                reject(addRequest.error);
            };
        });
    } catch (error) {
        console.error('[OfflineQueue] Error queuing location:', error);
    }
};

/**
 * Get all queued locations
 */
export const getQueuedLocations = async (): Promise<QueuedLocation[]> => {
    try {
        const database = await initDB();
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const request = index.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[OfflineQueue] Error getting queued locations:', error);
        return [];
    }
};

/**
 * Remove a location from the queue
 */
export const removeFromQueue = async (id: string): Promise<void> => {
    try {
        const database = await initDB();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);

        return new Promise((resolve) => {
            transaction.oncomplete = () => {
                console.log('[OfflineQueue] Removed from queue:', id);
                resolve();
            };
        });
    } catch (error) {
        console.error('[OfflineQueue] Error removing from queue:', error);
    }
};

/**
 * Increment retry count for a queued location
 */
export const incrementRetryCount = async (id: string): Promise<void> => {
    try {
        const database = await initDB();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        return new Promise((resolve) => {
            getRequest.onsuccess = () => {
                const location = getRequest.result;
                if (location) {
                    location.retryCount += 1;
                    if (location.retryCount >= MAX_RETRY_COUNT) {
                        // Too many retries, remove from queue
                        store.delete(id);
                        console.warn('[OfflineQueue] Max retries reached, discarding:', id);
                    } else {
                        store.put(location);
                    }
                }
                resolve();
            };
        });
    } catch (error) {
        console.error('[OfflineQueue] Error incrementing retry count:', error);
    }
};

/**
 * Get queue size
 */
export const getQueueSize = async (): Promise<number> => {
    try {
        const database = await initDB();
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return 0;
    }
};

/**
 * Sync queued locations with the server
 */
export const syncQueuedLocations = async (
    sendFunction: (location: Omit<QueuedLocation, 'id' | 'timestamp' | 'retryCount'>) => Promise<boolean>
): Promise<{ synced: number; failed: number }> => {
    if (isSyncing) {
        console.log('[OfflineQueue] Sync already in progress');
        return { synced: 0, failed: 0 };
    }

    if (!navigator.onLine) {
        console.log('[OfflineQueue] Offline, skipping sync');
        return { synced: 0, failed: 0 };
    }

    isSyncing = true;
    let synced = 0;
    let failed = 0;

    try {
        const locations = await getQueuedLocations();
        console.log(`[OfflineQueue] Syncing ${locations.length} queued locations...`);

        for (const location of locations) {
            try {
                const success = await sendFunction({
                    lat: location.lat,
                    lng: location.lng,
                    accuracy: location.accuracy,
                    deviceId: location.deviceId,
                    deviceName: location.deviceName,
                    previousZona: location.previousZona,
                });

                if (success) {
                    await removeFromQueue(location.id);
                    synced++;
                } else {
                    await incrementRetryCount(location.id);
                    failed++;
                }
            } catch (error) {
                console.error('[OfflineQueue] Error syncing location:', error);
                await incrementRetryCount(location.id);
                failed++;
            }
        }

        console.log(`[OfflineQueue] Sync complete: ${synced} synced, ${failed} failed`);
    } catch (error) {
        console.error('[OfflineQueue] Sync error:', error);
    } finally {
        isSyncing = false;
    }

    return { synced, failed };
};

/**
 * Check if currently online
 */
export const isNetworkOnline = (): boolean => isOnline;

/**
 * Initialize network monitoring
 */
export const initNetworkMonitoring = (onOnline?: () => void, onOffline?: () => void): () => void => {
    const handleOnline = () => {
        console.log('[OfflineQueue] Network online');
        isOnline = true;
        onOnline?.();
    };

    const handleOffline = () => {
        console.log('[OfflineQueue] Network offline');
        isOnline = false;
        onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    isOnline = navigator.onLine;

    // Return cleanup function
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
};

/**
 * Clear all queued locations (for testing/debugging)
 */
export const clearQueue = async (): Promise<void> => {
    try {
        const database = await initDB();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();

        return new Promise((resolve) => {
            transaction.oncomplete = () => {
                console.log('[OfflineQueue] Queue cleared');
                resolve();
            };
        });
    } catch (error) {
        console.error('[OfflineQueue] Error clearing queue:', error);
    }
};
