package com.itaxibcn.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import android.app.AlarmManager;
import android.app.PendingIntent;

/**
 * BroadcastReceiver for exact alarms - survives Doze mode!
 * This is the "nuclear option" that wakes up the device every 30 seconds
 */
public class LocationAlarmReceiver extends BroadcastReceiver {
    
    private static final String TAG = "LocationAlarmReceiver";
    public static final String ACTION_LOCATION_ALARM = "com.itaxibcn.app.LOCATION_ALARM";
    private static final int ALARM_REQUEST_CODE = 1003;
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_LOCATION_ALARM.equals(intent.getAction())) {
            return;
        }
        
        Log.d(TAG, "⏰ Alarm triggered - forcing location check");
        
        // Acquire WakeLock briefly
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "iTaxiBcn::AlarmReceiver"
        );
        wakeLock.acquire(5000); // 5 second timeout
        
        try {
            // Force an immediate location check
            if (LocationTrackingService.isRunning) {
                LocationTrackingService.forceLocationCheck(context);
            }
            
            // CRITICAL: Re-schedule the alarm for the next 30 seconds
            // This creates the infinite loop of exact alarms
            scheduleNextAlarm(context);
            
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
    
    /**
     * Schedule the next alarm - must be called every time the alarm fires
     * to maintain the 30-second loop
     */
    private void scheduleNextAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        
        Intent intent = new Intent(context, LocationAlarmReceiver.class);
        intent.setAction(ACTION_LOCATION_ALARM);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent alarmIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            flags
        );
        
        long triggerTime = System.currentTimeMillis() + LocationTrackingService.TRACKING_INTERVAL_MS;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // setExactAndAllowWhileIdle is the ONLY way to guarantee alarms in Doze
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                alarmIntent
            );
            Log.d(TAG, "✅ Next alarm scheduled in 30 seconds");
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                alarmIntent
            );
        }
    }
}
