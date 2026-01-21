package com.itaxibcn.app.services;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

/**
 * Professional-grade Location Tracking Service
 * Uses PendingIntent + BroadcastReceiver instead of Callbacks
 * Implements AlarmManager.setExactAndAllowWhileIdle for Doze resistance
 */
public class LocationTrackingService extends Service {
    
    private static final String TAG = "LocationTrackingService";
    private static final String CHANNEL_ID = "location_tracking_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final int LOCATION_REQUEST_CODE = 1002;
    private static final int ALARM_REQUEST_CODE = 1003;
    
    // Tracking interval in milliseconds
    public static final long TRACKING_INTERVAL_MS = 30 * 1000; // 30 seconds
    
    private FusedLocationProviderClient fusedLocationClient;
    private PendingIntent locationPendingIntent;
    private PowerManager.WakeLock wakeLock;
    private AlarmManager alarmManager;
    
    public static boolean isRunning = false;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        
        // Acquire WakeLock
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "iTaxiBcn::LocationWakeLock");
        
        createNotificationChannel();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service started");
        
        // Start as foreground service with notification
        startForeground(NOTIFICATION_ID, createNotification());
        
        // Acquire WakeLock
        if (!wakeLock.isHeld()) {
            wakeLock.acquire();
            Log.d(TAG, "WakeLock acquired");
        }
        
        // Start location updates using PendingIntent (NOT Callback!)
        startLocationUpdates();
        
        // Schedule exact alarm for Doze mode resistance
        scheduleExactAlarm();
        
        isRunning = true;
        
        // If killed, restart automatically
        return START_STICKY;
    }
    
    /**
     * Start location updates using PendingIntent
     * This is the KEY difference from amateur implementations
     * PendingIntent survives app sleep - Callbacks don't!
     */
    private void startLocationUpdates() {
        try {
            // Create the PendingIntent that will trigger our BroadcastReceiver
            Intent intent = new Intent(this, LocationBroadcastReceiver.class);
            intent.setAction(LocationBroadcastReceiver.ACTION_LOCATION_UPDATE);
            
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            
            locationPendingIntent = PendingIntent.getBroadcast(
                this, 
                LOCATION_REQUEST_CODE, 
                intent, 
                flags
            );
            
            // Configure location request
            LocationRequest locationRequest = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY,
                TRACKING_INTERVAL_MS
            )
            .setMinUpdateIntervalMillis(TRACKING_INTERVAL_MS / 2)
            .setMaxUpdateDelayMillis(TRACKING_INTERVAL_MS * 2)
            .build();
            
            // Request location updates with PendingIntent (not callback!)
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationPendingIntent
            );
            
            Log.d(TAG, "✅ Location updates started with PendingIntent");
            
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted: " + e.getMessage());
        }
    }
    
    /**
     * Schedule exact alarm that survives Doze mode
     * This is the "nuclear option" - setExactAndAllowWhileIdle
     */
    private void scheduleExactAlarm() {
        Intent intent = new Intent(this, LocationAlarmReceiver.class);
        intent.setAction(LocationAlarmReceiver.ACTION_LOCATION_ALARM);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent alarmIntent = PendingIntent.getBroadcast(
            this,
            ALARM_REQUEST_CODE,
            intent,
            flags
        );
        
        long triggerTime = System.currentTimeMillis() + TRACKING_INTERVAL_MS;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // This is the key - setExactAndAllowWhileIdle survives Doze!
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                alarmIntent
            );
            Log.d(TAG, "✅ Exact alarm scheduled for Doze mode (30s)");
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                alarmIntent
            );
        }
    }
    
    /**
     * Force an immediate location check - called by AlarmReceiver
     */
    public static void forceLocationCheck(Context context) {
        try {
            FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(context);
            client.getLastLocation().addOnSuccessListener(location -> {
                if (location != null) {
                    Log.d(TAG, "📍 Alarm-triggered location: " + 
                        location.getLatitude() + ", " + location.getLongitude());
                    
                    // Send to receiver for processing
                    Intent intent = new Intent(context, LocationBroadcastReceiver.class);
                    intent.setAction(LocationBroadcastReceiver.ACTION_LOCATION_UPDATE);
                    intent.putExtra("latitude", location.getLatitude());
                    intent.putExtra("longitude", location.getLongitude());
                    intent.putExtra("accuracy", location.getAccuracy());
                    intent.putExtra("timestamp", location.getTime());
                    intent.putExtra("fromAlarm", true);
                    context.sendBroadcast(intent);
                }
            });
        } catch (SecurityException e) {
            Log.e(TAG, "Permission error in forceLocationCheck: " + e.getMessage());
        }
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Tracking de Ubicación",
                NotificationManager.IMPORTANCE_LOW // Low to avoid sound
            );
            channel.setDescription("Mantiene la app activa para tracking GPS");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
    
    private Notification createNotification() {
        Intent notificationIntent = getPackageManager()
            .getLaunchIntentForPackage(getPackageName());
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, flags
        );
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("iTaxiBcn - Tracking Activo")
            .setContentText("Ubicación activa en segundo plano")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
    
    @Override
    public void onDestroy() {
        Log.d(TAG, "Service destroyed");
        
        // Stop location updates
        if (locationPendingIntent != null) {
            fusedLocationClient.removeLocationUpdates(locationPendingIntent);
        }
        
        // Release WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "WakeLock released");
        }
        
        // Cancel alarms
        Intent intent = new Intent(this, LocationAlarmReceiver.class);
        PendingIntent alarmIntent = PendingIntent.getBroadcast(
            this, ALARM_REQUEST_CODE, intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        alarmManager.cancel(alarmIntent);
        
        isRunning = false;
        
        super.onDestroy();
    }
    
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
