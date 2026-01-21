package com.itaxibcn.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.itaxibcn.app.services.LocationTrackingService;

/**
 * Capacitor Plugin to control the professional Location Tracking Service
 */
@CapacitorPlugin(name = "ProLocationTracking")
public class ProLocationTrackingPlugin extends Plugin {
    
    private static final String TAG = "ProLocationTracking";
    
    /**
     * Start the professional location tracking service
     */
    @PluginMethod
    public void startTracking(PluginCall call) {
        Context context = getContext();
        
        // Get Supabase config from call or stored preferences
        String supabaseUrl = call.getString("supabaseUrl", "");
        String supabaseKey = call.getString("supabaseKey", "");
        String deviceId = call.getString("deviceId", "");
        String deviceName = call.getString("deviceName", null);
        
        // Store configuration for the service to use
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        if (!supabaseUrl.isEmpty()) {
            editor.putString("supabase_url", supabaseUrl);
        }
        if (!supabaseKey.isEmpty()) {
            editor.putString("supabase_anon_key", supabaseKey);
        }
        if (!deviceId.isEmpty()) {
            editor.putString("device_id", deviceId);
        }
        if (deviceName != null) {
            editor.putString("device_name", deviceName);
        }
        editor.apply();
        
        // Start the foreground service
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
    
    /**
     * Stop the location tracking service
     */
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
    
    /**
     * Check if tracking is currently running
     */
    @PluginMethod
    public void isTracking(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isRunning", LocationTrackingService.isRunning);
        call.resolve(ret);
    }
    
    /**
     * Get last known position from preferences
     */
    @PluginMethod
    public void getLastPosition(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);
        
        float lat = prefs.getFloat("last_lat", 0);
        float lng = prefs.getFloat("last_lng", 0);
        long lastUpdate = prefs.getLong("last_update", 0);
        
        JSObject ret = new JSObject();
        if (lat != 0 && lng != 0) {
            ret.put("latitude", lat);
            ret.put("longitude", lng);
            ret.put("timestamp", lastUpdate);
            ret.put("hasPosition", true);
        } else {
            ret.put("hasPosition", false);
        }
        call.resolve(ret);
    }
}
