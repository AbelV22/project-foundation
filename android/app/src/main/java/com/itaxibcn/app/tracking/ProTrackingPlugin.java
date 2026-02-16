package com.itaxibcn.app.tracking;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

/**
 * Capacitor Plugin to control the native Location Tracking Service.
 * Handles foreground + background location permissions explicitly.
 */
@CapacitorPlugin(
    name = "ProTracking",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
        ),
        @Permission(
            alias = "backgroundLocation",
            strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }
        )
    }
)
public class ProTrackingPlugin extends Plugin {

    private static final String TAG = "ProTrackingPlugin";

    @PluginMethod
    public void configure(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);

        String supabaseUrl = call.getString("supabaseUrl", "");
        String supabaseKey = call.getString("supabaseKey", "");
        String deviceId = call.getString("deviceId", "");
        String deviceName = call.getString("deviceName", null);

        SharedPreferences.Editor editor = prefs.edit();
        if (!supabaseUrl.isEmpty()) editor.putString("supabase_url", supabaseUrl);
        if (!supabaseKey.isEmpty()) editor.putString("supabase_anon_key", supabaseKey);
        if (!deviceId.isEmpty()) editor.putString("device_id", deviceId);
        if (deviceName != null) editor.putString("device_name", deviceName);
        editor.apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Configuration saved");
        call.resolve(ret);
    }

    @PluginMethod
    public void setSchedule(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);

        int startHour = call.getInt("startHour", 8);
        int endHour = call.getInt("endHour", 20);
        boolean enabled = call.getBoolean("enabled", false);
        boolean trackingEnabled = call.getBoolean("trackingEnabled", true);

        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt("schedule_start", startHour);
        editor.putInt("schedule_end", endHour);
        editor.putBoolean("schedule_enabled", enabled);
        editor.putBoolean("tracking_enabled", trackingEnabled);
        editor.apply();

        if (!trackingEnabled) {
            Intent serviceIntent = new Intent(context, LocationTrackingService.class);
            context.stopService(serviceIntent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    /**
     * Request foreground location permission (ACCESS_FINE_LOCATION).
     * Must be granted BEFORE requesting background location.
     */
    @PluginMethod
    public void requestLocationPermission(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            Log.d(TAG, "Foreground location already granted");
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("location", call, "locationPermissionCallback");
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("location") == PermissionState.GRANTED;
        Log.d(TAG, "Foreground location permission result: " + granted);

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Request background location permission (ACCESS_BACKGROUND_LOCATION).
     * IMPORTANT: Android requires foreground location to be granted FIRST.
     * On Android 10+ this shows "Allow all the time" option.
     */
    @PluginMethod
    public void requestBackgroundPermission(PluginCall call) {
        // Pre-Android 10: background location is included with foreground
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Log.d(TAG, "Pre-Android 10: background permission not needed separately");
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        // Check if foreground location is granted first
        if (getPermissionState("location") != PermissionState.GRANTED) {
            Log.w(TAG, "Cannot request background location without foreground location!");
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("error", "Foreground location must be granted first");
            call.resolve(ret);
            return;
        }

        // Check if already granted
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Background location already granted");
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        Log.d(TAG, "Requesting ACCESS_BACKGROUND_LOCATION...");
        requestPermissionForAlias("backgroundLocation", call, "backgroundPermissionCallback");
    }

    @PermissionCallback
    private void backgroundPermissionCallback(PluginCall call) {
        boolean granted = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        Log.d(TAG, "Background location permission result: " + granted);

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Check current permission status for both foreground and background location.
     */
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        boolean foreground = getPermissionState("location") == PermissionState.GRANTED;
        boolean background;

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            background = foreground; // Pre-Android 10
        } else {
            background = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }

        JSObject ret = new JSObject();
        ret.put("foreground", foreground);
        ret.put("background", background);
        call.resolve(ret);
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        Context context = getContext();

        Intent serviceIntent = new Intent(context, LocationTrackingService.class);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Tracking service started");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Context context = getContext();

        Intent serviceIntent = new Intent(context, LocationTrackingService.class);
        context.stopService(serviceIntent);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Tracking service stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void isTracking(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isRunning", LocationTrackingService.isRunning);
        call.resolve(ret);
    }

    @PluginMethod
    public void getLastPosition(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);

        float lat = prefs.getFloat("last_lat", 0);
        float lng = prefs.getFloat("last_lng", 0);
        long lastUpdate = prefs.getLong("last_update", 0);
        String lastZona = prefs.getString("last_zona", null);

        JSObject ret = new JSObject();
        if (lat != 0 && lng != 0) {
            ret.put("hasPosition", true);
            ret.put("latitude", lat);
            ret.put("longitude", lng);
            ret.put("timestamp", lastUpdate);
            ret.put("zona", lastZona);
        } else {
            ret.put("hasPosition", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent();
            String packageName = getContext().getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                intent.setAction(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(android.net.Uri.parse("package:" + packageName));
                getContext().startActivity(intent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Request sent");
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Already ignored");
                call.resolve(ret);
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Not needed");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean isIgnoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String packageName = getContext().getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            isIgnoring = pm.isIgnoringBatteryOptimizations(packageName);
        }

        JSObject ret = new JSObject();
        ret.put("ignored", isIgnoring);
        call.resolve(ret);
    }
}
