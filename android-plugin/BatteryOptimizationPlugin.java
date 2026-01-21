package com.itaxibcn.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {
    
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    
    private static final String TAG = "BatteryOptimization";
    private static final String WAKE_LOCK_TAG = "iTaxiBcn::LocationWakeLock";
    private static final String WIFI_LOCK_TAG = "iTaxiBcn::LocationWifiLock";

    /**
     * Check if the app is excluded from battery optimization
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        
        boolean ignored = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ignored = pm.isIgnoringBatteryOptimizations(context.getPackageName());
        } else {
            // Before Android M, no battery optimization restrictions existed
            ignored = true;
        }
        
        JSObject ret = new JSObject();
        ret.put("ignored", ignored);
        call.resolve(ret);
    }

    /**
     * Request to be excluded from battery optimization
     * Opens a system dialog asking the user
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        } else {
            // Not needed before Android M
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }
    }

    /**
     * Open battery settings for manual configuration
     */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context context = getContext();
        
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent.setAction(Settings.ACTION_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open battery settings: " + e.getMessage());
        }
    }

    /**
     * Acquire a PARTIAL_WAKE_LOCK to keep CPU running
     */
    @PluginMethod
    public void acquireWakeLock(PluginCall call) {
        Context context = getContext();
        
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
            }
            
            if (!wakeLock.isHeld()) {
                wakeLock.acquire();
                android.util.Log.d(TAG, "WakeLock acquired");
            }
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error acquiring WakeLock: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Release the WakeLock
     */
    @PluginMethod
    public void releaseWakeLock(PluginCall call) {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                android.util.Log.d(TAG, "WakeLock released");
            }
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error releasing WakeLock: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Acquire WiFi lock to keep network connection active
     */
    @PluginMethod
    public void acquireWifiLock(PluginCall call) {
        Context context = getContext();
        
        try {
            if (wifiLock == null) {
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, WIFI_LOCK_TAG);
            }
            
            if (!wifiLock.isHeld()) {
                wifiLock.acquire();
                android.util.Log.d(TAG, "WifiLock acquired");
            }
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error acquiring WifiLock: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Release WiFi lock
     */
    @PluginMethod
    public void releaseWifiLock(PluginCall call) {
        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
                android.util.Log.d(TAG, "WifiLock released");
            }
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e(TAG, "Error releasing WifiLock: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
}
