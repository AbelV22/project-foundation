package com.itaxibcn.app.tracking;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

/**
 * BroadcastReceiver for AlarmManager - survives Doze mode.
 * This is the "nuclear option" that guarantees location updates every 30 seconds.
 */
public class AlarmReceiver extends BroadcastReceiver {
    
    private static final String TAG = "AlarmReceiver";
    public static final String ACTION_LOCATION_ALARM = "com.itaxibcn.app.LOCATION_ALARM";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_LOCATION_ALARM.equals(intent.getAction())) {
            return;
        }
        
        Log.d(TAG, "⏰ Alarm received - waking up device");
        
        // Acquire brief WakeLock
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "iTaxiBcn:AlarmWakeLock"
        );
        wl.acquire(10000); // 10 second timeout for location request
        
        try {
            if (LocationTrackingService.isRunning) {
                LocationTrackingService.forceLocationCheck(context);
            } else {
                Log.w(TAG, "⚠️ Service not running, alarm ignored");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in alarm receiver: " + e.getMessage());
        } finally {
            if (wl.isHeld()) {
                wl.release();
            }
        }
    }
}
