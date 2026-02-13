package com.itaxibcn.app.tracking;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor Plugin to control the native Location Tracking Service.
 */
@CapacitorPlugin(name = "ProTracking")
public class ProTrackingPlugin extends Plugin {
    
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
        
        // If tracking is disabled globally, stop service
        if (!trackingEnabled) {
            Intent serviceIntent = new Intent(context, LocationTrackingService.class);
            context.stopService(serviceIntent);
        } else if (LocationTrackingService.isRunning) {
            // If running, we might need to stop if outside hours, but Service handles that on next tick
            // Ideally we could trigger a check
        }
        
        JSObject ret = new JSObject();
        ret.put("success", true);
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
}
