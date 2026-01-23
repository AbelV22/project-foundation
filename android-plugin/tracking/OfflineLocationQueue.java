package com.itaxibcn.app.tracking;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Offline queue for storing location data when network is unavailable.
 * Uses SharedPreferences for persistence (simple but effective for small queues).
 * For production, consider using Room database for better performance.
 */
public class OfflineLocationQueue {

    private static final String TAG = "OfflineLocationQueue";
    private static final String PREFS_NAME = "iTaxiBcn_OfflineQueue";
    private static final String KEY_QUEUE = "location_queue";
    private static final int MAX_QUEUE_SIZE = 100;
    private static final int MAX_RETRY_COUNT = 5;

    private final Context context;
    private final SharedPreferences prefs;

    public OfflineLocationQueue(Context context) {
        this.context = context;
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * Check if network is available
     */
    public boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;

        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    /**
     * Add a location to the queue
     */
    public synchronized void queueLocation(
            double lat,
            double lng,
            float accuracy,
            String deviceId,
            String deviceName,
            String previousZona
    ) {
        try {
            JSONArray queue = getQueue();

            // Trim queue if too large
            while (queue.length() >= MAX_QUEUE_SIZE) {
                queue.remove(0);
                Log.d(TAG, "Queue full, removing oldest entry");
            }

            // Create new entry
            JSONObject entry = new JSONObject();
            entry.put("id", System.currentTimeMillis() + "-" + Math.random());
            entry.put("lat", lat);
            entry.put("lng", lng);
            entry.put("accuracy", accuracy);
            entry.put("deviceId", deviceId);
            entry.put("deviceName", deviceName);
            entry.put("previousZona", previousZona);
            entry.put("timestamp", System.currentTimeMillis());
            entry.put("retryCount", 0);

            queue.put(entry);
            saveQueue(queue);

            Log.d(TAG, "Location queued. Queue size: " + queue.length());

        } catch (JSONException e) {
            Log.e(TAG, "Error queuing location", e);
        }
    }

    /**
     * Get all queued locations
     */
    public synchronized List<QueuedLocation> getQueuedLocations() {
        List<QueuedLocation> locations = new ArrayList<>();

        try {
            JSONArray queue = getQueue();

            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.getJSONObject(i);
                QueuedLocation loc = new QueuedLocation();
                loc.id = entry.getString("id");
                loc.lat = entry.getDouble("lat");
                loc.lng = entry.getDouble("lng");
                loc.accuracy = (float) entry.getDouble("accuracy");
                loc.deviceId = entry.getString("deviceId");
                loc.deviceName = entry.optString("deviceName", null);
                loc.previousZona = entry.optString("previousZona", null);
                loc.timestamp = entry.getLong("timestamp");
                loc.retryCount = entry.getInt("retryCount");

                locations.add(loc);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error reading queue", e);
        }

        return locations;
    }

    /**
     * Remove a location from the queue
     */
    public synchronized void removeFromQueue(String id) {
        try {
            JSONArray queue = getQueue();
            JSONArray newQueue = new JSONArray();

            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.getJSONObject(i);
                if (!entry.getString("id").equals(id)) {
                    newQueue.put(entry);
                }
            }

            saveQueue(newQueue);
            Log.d(TAG, "Removed from queue: " + id);

        } catch (JSONException e) {
            Log.e(TAG, "Error removing from queue", e);
        }
    }

    /**
     * Increment retry count for a queued location
     */
    public synchronized void incrementRetryCount(String id) {
        try {
            JSONArray queue = getQueue();

            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.getJSONObject(i);
                if (entry.getString("id").equals(id)) {
                    int retryCount = entry.getInt("retryCount") + 1;

                    if (retryCount >= MAX_RETRY_COUNT) {
                        // Too many retries, remove from queue
                        queue.remove(i);
                        Log.w(TAG, "Max retries reached, discarding: " + id);
                    } else {
                        entry.put("retryCount", retryCount);
                    }
                    break;
                }
            }

            saveQueue(queue);

        } catch (JSONException e) {
            Log.e(TAG, "Error incrementing retry count", e);
        }
    }

    /**
     * Get queue size
     */
    public synchronized int getQueueSize() {
        return getQueue().length();
    }

    /**
     * Clear the queue
     */
    public synchronized void clearQueue() {
        saveQueue(new JSONArray());
        Log.d(TAG, "Queue cleared");
    }

    /**
     * Sync queued locations with server
     */
    public synchronized void syncQueue(
            String supabaseUrl,
            String supabaseKey,
            SyncCallback callback
    ) {
        if (!isNetworkAvailable()) {
            Log.d(TAG, "Network unavailable, skipping sync");
            if (callback != null) {
                callback.onComplete(0, 0);
            }
            return;
        }

        List<QueuedLocation> locations = getQueuedLocations();
        Log.d(TAG, "Syncing " + locations.size() + " queued locations...");

        int[] synced = {0};
        int[] failed = {0};
        int[] remaining = {locations.size()};

        for (QueuedLocation loc : locations) {
            LocationApiClient.sendLocation(
                supabaseUrl,
                supabaseKey,
                loc.deviceId,
                loc.deviceName,
                loc.lat,
                loc.lng,
                loc.accuracy,
                loc.previousZona,
                (zona) -> {
                    // Success - remove from queue
                    removeFromQueue(loc.id);
                    synced[0]++;
                    remaining[0]--;

                    if (remaining[0] == 0 && callback != null) {
                        callback.onComplete(synced[0], failed[0]);
                    }
                }
            );
        }

        // If no locations to sync, call callback immediately
        if (locations.isEmpty() && callback != null) {
            callback.onComplete(0, 0);
        }
    }

    // Helper methods

    private JSONArray getQueue() {
        String json = prefs.getString(KEY_QUEUE, "[]");
        try {
            return new JSONArray(json);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private void saveQueue(JSONArray queue) {
        prefs.edit().putString(KEY_QUEUE, queue.toString()).apply();
    }

    // Data classes

    public static class QueuedLocation {
        public String id;
        public double lat;
        public double lng;
        public float accuracy;
        public String deviceId;
        public String deviceName;
        public String previousZona;
        public long timestamp;
        public int retryCount;
    }

    public interface SyncCallback {
        void onComplete(int synced, int failed);
    }
}
