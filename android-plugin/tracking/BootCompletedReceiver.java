package com.itaxibcn.app.tracking;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * BroadcastReceiver that starts the LocationTrackingService after device boot.
 * This ensures continuous tracking even after device restarts.
 *
 * Requires RECEIVE_BOOT_COMPLETED permission in AndroidManifest.xml
 */
public class BootCompletedReceiver extends BroadcastReceiver {

    private static final String TAG = "BootCompletedReceiver";
    private static final String PREFS_NAME = "iTaxiBcn";
    private static final String KEY_TRACKING_ENABLED = "tracking_enabled";
    private static final String KEY_AUTO_START = "auto_start_on_boot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.d(TAG, "Boot completed received: " + action);

            // Check if tracking was enabled before reboot
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean trackingEnabled = prefs.getBoolean(KEY_TRACKING_ENABLED, false);
            boolean autoStartEnabled = prefs.getBoolean(KEY_AUTO_START, true); // Default to true

            if (trackingEnabled && autoStartEnabled) {
                Log.d(TAG, "Tracking was enabled, restarting service...");

                // Check if service credentials are configured
                String supabaseUrl = prefs.getString("supabase_url", "");
                String deviceId = prefs.getString("device_id", "");

                if (supabaseUrl.isEmpty() || deviceId.isEmpty()) {
                    Log.w(TAG, "Service not configured (missing URL or device ID), skipping auto-start");
                    return;
                }

                // Start the tracking service
                try {
                    Intent serviceIntent = new Intent(context, LocationTrackingService.class);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        // Use startForegroundService for Android 8.0+
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }

                    Log.d(TAG, "LocationTrackingService started successfully");

                    // Log the auto-start event
                    LocationApiClient.initOfflineQueue(context);
                    LocationApiClient.logDebug(
                        supabaseUrl,
                        prefs.getString("supabase_anon_key", ""),
                        deviceId,
                        prefs.getString("device_name", null),
                        "boot_auto_start",
                        "Service auto-started after device boot"
                    );

                } catch (Exception e) {
                    Log.e(TAG, "Failed to start service after boot", e);
                }
            } else {
                Log.d(TAG, "Tracking not enabled or auto-start disabled, skipping");
            }
        }
    }

    /**
     * Enable auto-start on boot
     */
    public static void enableAutoStart(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean(KEY_AUTO_START, true)
            .putBoolean(KEY_TRACKING_ENABLED, true)
            .apply();
        Log.d(TAG, "Auto-start on boot enabled");
    }

    /**
     * Disable auto-start on boot
     */
    public static void disableAutoStart(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean(KEY_AUTO_START, false)
            .apply();
        Log.d(TAG, "Auto-start on boot disabled");
    }

    /**
     * Check if auto-start is enabled
     */
    public static boolean isAutoStartEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_AUTO_START, true);
    }

    /**
     * Mark tracking as enabled (call when service starts)
     */
    public static void markTrackingEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, true).apply();
    }

    /**
     * Mark tracking as disabled (call when service stops)
     */
    public static void markTrackingDisabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, false).apply();
    }
}
