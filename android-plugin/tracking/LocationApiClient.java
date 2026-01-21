package com.itaxibcn.app.tracking;

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
    
    public interface OnZonaCallback {
        void onZona(String zona);
    }
    
    /**
     * Send location to Supabase check-geofence function
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
            return;
        }
        
        executor.execute(() -> {
            try {
                URL url = new URL(supabaseUrl + "/functions/v1/check-geofence");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                
                // Build JSON
                String json = String.format(
                    "{\"lat\":%.6f,\"lng\":%.6f,\"action\":\"register\",\"deviceId\":\"%s\"," +
                    "\"previousZona\":%s,\"accuracy\":%.1f,\"deviceName\":%s,\"isBackground\":true,\"fromNative\":true}",
                    lat, lng, deviceId,
                    previousZona != null ? "\"" + previousZona + "\"" : "null",
                    accuracy,
                    deviceName != null ? "\"" + deviceName + "\"" : "null"
                );
                
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }
                
                int code = conn.getResponseCode();
                Log.d(TAG, "Geofence response: " + code);
                
                if (code == 200 && callback != null) {
                    // Parse response to get zona (simplified)
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
                    
                    // Extract zona from JSON response (simple parsing)
                    String responseStr = response.toString();
                    if (responseStr.contains("\"zona\":\"")) {
                        int start = responseStr.indexOf("\"zona\":\"") + 8;
                        int end = responseStr.indexOf("\"", start);
                        if (end > start) {
                            String zona = responseStr.substring(start, end);
                            callback.onZona(zona);
                        }
                    } else {
                        callback.onZona(null);
                    }
                }
                
                conn.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "Error sending location: " + e.getMessage());
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
