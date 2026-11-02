package com.itaxibcn.app.tracking;

import android.content.Context;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Direct HTTP client for sending location to Supabase.
 * This bypasses the WebView entirely for maximum reliability.
 */
public class LocationApiClient {

    private static final String TAG = "LocationApiClient";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    // === Send pacing ===
    // Every location source (Fused, native GPS/Network, alarm) ends up here, so
    // a burst of fixes from several providers produces a single request. Each
    // check-geofence response carries next_check_s / move_m hints: send again
    // once that time has passed or the device has moved that far.
    private static final long MIN_SEND_GAP_MS = 45 * 1000;
    private static final long DEFAULT_NEXT_CHECK_MS = 2 * 60 * 1000;
    private static final float DEFAULT_MOVE_M = 200f;
    private static final float MAX_ACCURACY_M = 100f; // server ignores worse fixes
    private static long lastSentAt = 0;
    private static double lastSentLat;
    private static double lastSentLng;
    private static long nextCheckMs = DEFAULT_NEXT_CHECK_MS;
    private static float moveM = DEFAULT_MOVE_M;

    // Remote debug logs: only problems, at most once per event type per window.
    private static final long DEBUG_LOG_MIN_GAP_MS = 30 * 60 * 1000;
    private static final java.util.Map<String, Long> lastDebugLogAt = new java.util.HashMap<>();

    private static synchronized boolean shouldSend(double lat, double lng, float accuracy) {
        if (accuracy > MAX_ACCURACY_M) return false;

        long now = System.currentTimeMillis();
        long elapsed = now - lastSentAt;
        if (lastSentAt != 0) {
            if (elapsed < MIN_SEND_GAP_MS) return false;
            float[] moved = new float[1];
            android.location.Location.distanceBetween(lastSentLat, lastSentLng, lat, lng, moved);
            if (elapsed < nextCheckMs && moved[0] < moveM) return false;
        }

        lastSentAt = now;
        lastSentLat = lat;
        lastSentLng = lng;
        return true;
    }

    private static synchronized void applyPacing(String response) {
        long nextCheckS = extractLong(response, "next_check_s", DEFAULT_NEXT_CHECK_MS / 1000);
        long move = extractLong(response, "move_m", (long) DEFAULT_MOVE_M);
        nextCheckMs = Math.max(MIN_SEND_GAP_MS, Math.min(15 * 60, nextCheckS) * 1000);
        moveM = Math.max(50, Math.min(5000, move));
    }

    private static long extractLong(String json, String key, long fallback) {
        java.util.regex.Matcher m = java.util.regex.Pattern
            .compile("\"" + key + "\"\\s*:\\s*(\\d+)")
            .matcher(json);
        return m.find() ? Long.parseLong(m.group(1)) : fallback;
    }

    private static synchronized boolean shouldLogDebug(String eventType) {
        String t = eventType.toLowerCase(java.util.Locale.ROOT);
        boolean problem = t.contains("error") || t.contains("fail") || t.contains("exception")
            || t.contains("no_permission") || t.contains("missing") || t.contains("no_provider")
            || t.contains("warning") || t.startsWith("network_") || t.equals("fallback_activated")
            || t.equals("service_resurrected") || t.equals("system_diagnostics");
        if (!problem) return false;

        long now = System.currentTimeMillis();
        Long last = lastDebugLogAt.get(eventType);
        if (last != null && now - last < DEBUG_LOG_MIN_GAP_MS) return false;
        lastDebugLogAt.put(eventType, now);
        return true;
    }

    /**
     * Initialize offline queue for storing locations when network is unavailable.
     * Currently a placeholder for future offline support.
     */
    public static void initOfflineQueue(Context context) {
        Log.d(TAG, "Offline queue initialized");
    }
    
    public interface OnZonaCallback {
        void onZona(String zona);
    }
    
    /**
     * Send location to the fn_geofence_check RPC. It goes through PostgREST
     * rather than the check-geofence Edge Function: same logic, but it doesn't
     * consume the plan's Edge Function invocation quota.
     */
    public static void sendLocation(
            String supabaseUrl,
            String supabaseKey,
            String deviceId,
            String deviceName,
            double lat,
            double lng,
            float accuracy,
            String previousZona,
            OnZonaCallback callback
    ) {
        if (supabaseUrl == null || supabaseUrl.isEmpty()) {
            Log.w(TAG, "Supabase URL not configured");
            logDebug(supabaseUrl, supabaseKey, deviceId, deviceName, "config_error", 
                "❌ ERROR CONFIG: supabase_url no configurado");
            return;
        }
        
        if (deviceId == null || deviceId.isEmpty()) {
            Log.w(TAG, "Device ID not configured");
            return;
        }

        if (!shouldSend(lat, lng, accuracy)) {
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(supabaseUrl + "/rest/v1/rpc/fn_geofence_check");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                
                // Build JSON
                String json = String.format(java.util.Locale.ROOT,
                    "{\"p_device_id\":\"%s\",\"p_lat\":%.6f,\"p_lng\":%.6f,\"p_accuracy\":%.1f}",
                    deviceId.replace("\"", ""), lat, lng, accuracy
                );
                
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }
                
                int code = conn.getResponseCode();
                Log.d(TAG, "Geofence response: " + code);
                
                if (code == 200) {
                    // Parse response to get zona
                    java.io.InputStream is = conn.getInputStream();
                    java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(is)
                    );
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();
                    
                    // Extract zona from JSON response
                    String responseStr = response.toString();
                    applyPacing(responseStr);
                    String zona = null;
                    java.util.regex.Matcher zonaMatcher = java.util.regex.Pattern
                        .compile("\"zona\"\\s*:\\s*\"([^\"]*)\"")
                        .matcher(responseStr);
                    if (zonaMatcher.find()) {
                        zona = zonaMatcher.group(1);
                    }
                    
                    if (callback != null) {
                        callback.onZona(zona);
                    }
                    
                    Log.d(TAG, "✅ Geofence enviado OK. Zona: " + (zona != null ? zona : "ninguna"));
                } else {
                    // Error response
                    String errorMsg = String.format("❌ ERROR GEOFENCE: HTTP %d", code);
                    Log.e(TAG, errorMsg);
                    logDebug(supabaseUrl, supabaseKey, deviceId, deviceName, "geofence_http_error", errorMsg);
                }
                
            } catch (java.net.SocketTimeoutException e) {
                String errorMsg = "❌ ERROR RED: Timeout conectando con servidor";
                Log.e(TAG, errorMsg);
                logDebug(supabaseUrl, supabaseKey, deviceId, deviceName, "network_timeout", errorMsg);
            } catch (java.net.UnknownHostException e) {
                String errorMsg = "❌ ERROR RED: Sin conexión a internet";
                Log.e(TAG, errorMsg);
                logDebug(supabaseUrl, supabaseKey, deviceId, deviceName, "network_no_internet", errorMsg);
            } catch (Exception e) {
                String errorMsg = "❌ ERROR: " + e.getClass().getSimpleName() + " - " + e.getMessage();
                Log.e(TAG, "Error sending location: " + errorMsg);
                logDebug(supabaseUrl, supabaseKey, deviceId, deviceName, "geofence_exception", errorMsg);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }
    
    /**
     * Send debug log to Supabase
     */
    public static void logDebug(
            String supabaseUrl,
            String supabaseKey,
            String deviceId,
            String deviceName,
            String eventType,
            String message
    ) {
        if (supabaseUrl == null || supabaseUrl.isEmpty()) {
            return;
        }

        if (!shouldLogDebug(eventType)) {
            return;
        }

        executor.execute(() -> {
            try {
                URL url = new URL(supabaseUrl + "/rest/v1/location_debug_logs");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setRequestProperty("Prefer", "return=minimal");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                
                String json = String.format(
                    "{\"device_id\":\"%s\",\"device_name\":%s,\"event_type\":\"%s\"," +
                    "\"message\":\"%s\",\"is_background\":true,\"app_state\":\"native_service\"}",
                    deviceId,
                    deviceName != null ? "\"" + deviceName + "\"" : "null",
                    eventType,
                    message.replace("\"", "'")
                );
                
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }
                
                int code = conn.getResponseCode();
                Log.d(TAG, "Debug log response: " + code);
                
                conn.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "Error logging debug: " + e.getMessage());
            }
        });
    }
}
