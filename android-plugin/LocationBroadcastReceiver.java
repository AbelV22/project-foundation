package com.itaxibcn.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.PowerManager;
import android.util.Log;

import com.google.android.gms.location.LocationResult;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * BroadcastReceiver that handles location updates from PendingIntent
 * This is the "professional" way - survives app sleep!
 */
public class LocationBroadcastReceiver extends BroadcastReceiver {
    
    private static final String TAG = "LocationBroadcastRcvr";
    public static final String ACTION_LOCATION_UPDATE = "com.itaxibcn.app.LOCATION_UPDATE";
    
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    
    // Store last zone for change detection
    private static String lastZona = null;
    private static long lastUpdateTime = 0;
    private static final long MIN_UPDATE_INTERVAL_MS = 25 * 1000; // 25 seconds
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        
        // Acquire a brief WakeLock to ensure processing completes
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "iTaxiBcn::LocationReceiver"
        );
        wakeLock.acquire(10000); // 10 second timeout
        
        try {
            double latitude, longitude;
            float accuracy = 0;
            long timestamp = System.currentTimeMillis();
            boolean fromAlarm = intent.getBooleanExtra("fromAlarm", false);
            
            if (fromAlarm) {
                // Location data passed directly from alarm
                latitude = intent.getDoubleExtra("latitude", 0);
                longitude = intent.getDoubleExtra("longitude", 0);
                accuracy = intent.getFloatExtra("accuracy", 0);
                timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis());
                Log.d(TAG, "📍 Location from alarm: " + latitude + ", " + longitude);
            } else {
                // Extract location from FusedLocationProviderClient result
                LocationResult result = LocationResult.extractResult(intent);
                if (result == null) {
                    Log.w(TAG, "No location result in intent");
                    return;
                }
                
                Location location = result.getLastLocation();
                if (location == null) {
                    Log.w(TAG, "Location is null");
                    return;
                }
                
                latitude = location.getLatitude();
                longitude = location.getLongitude();
                accuracy = location.getAccuracy();
                timestamp = location.getTime();
                Log.d(TAG, "📍 Location from FusedProvider: " + latitude + ", " + longitude);
            }
            
            // Throttle updates
            long now = System.currentTimeMillis();
            if (now - lastUpdateTime < MIN_UPDATE_INTERVAL_MS) {
                Log.d(TAG, "Throttled - too soon since last update");
                return;
            }
            lastUpdateTime = now;
            
            // Get stored device info
            SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);
            String deviceId = prefs.getString("device_id", "unknown");
            String deviceName = prefs.getString("device_name", null);
            
            // Send to backend asynchronously
            final double lat = latitude;
            final double lng = longitude;
            final float acc = accuracy;
            
            executor.execute(() -> {
                sendLocationToBackend(context, lat, lng, acc, deviceId, deviceName);
            });
            
            // Save last position
            prefs.edit()
                .putFloat("last_lat", (float) latitude)
                .putFloat("last_lng", (float) longitude)
                .putLong("last_update", timestamp)
                .apply();
                
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
    
    /**
     * Send location to Supabase Edge Function
     */
    private void sendLocationToBackend(Context context, double lat, double lng, 
                                        float accuracy, String deviceId, String deviceName) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);
            String supabaseUrl = prefs.getString("supabase_url", "");
            String supabaseKey = prefs.getString("supabase_anon_key", "");
            
            if (supabaseUrl.isEmpty()) {
                Log.w(TAG, "Supabase URL not configured");
                return;
            }
            
            URL url = new URL(supabaseUrl + "/functions/v1/check-geofence");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            
            // Build JSON payload
            String json = String.format(
                "{\"lat\":%.6f,\"lng\":%.6f,\"action\":\"register\",\"deviceId\":\"%s\"," +
                "\"previousZona\":%s,\"accuracy\":%.1f,\"deviceName\":%s,\"isBackground\":true}",
                lat, lng, deviceId,
                lastZona != null ? "\"" + lastZona + "\"" : "null",
                accuracy,
                deviceName != null ? "\"" + deviceName + "\"" : "null"
            );
            
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = json.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                Log.d(TAG, "✅ Location sent successfully");
            } else {
                Log.w(TAG, "⚠️ Backend returned: " + responseCode);
            }
            
            conn.disconnect();
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error sending location: " + e.getMessage());
        }
    }
}
