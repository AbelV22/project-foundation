package com.itaxibcn.app.tracking;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

/**
 * Professional-grade Foreground Service for location tracking.
 * Uses FusedLocationProviderClient with PendingIntent for robust background operation.
 * Implements AlarmManager.setExactAndAllowWhileIdle for Doze mode resistance.
 */
public class LocationTrackingService extends Service {
    
    private static final String TAG = "LocationTrackingService";
    public static final String CHANNEL_ID = "location_tracking_channel";
    public static final int NOTIFICATION_ID = 9001;
    public static final int LOCATION_REQUEST_CODE = 9002;
    public static final int ALARM_REQUEST_CODE = 9003;
    
    public static final long INTERVAL_MS = 30 * 1000; // 30 seconds
    public static final long FASTEST_INTERVAL_MS = 15 * 1000;
    
    public static volatile boolean isRunning = false;
    
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private PowerManager.WakeLock wakeLock;
    private AlarmManager alarmManager;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service onCreate");
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        
        // Acquire partial WakeLock
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "iTaxiBcn:LocationWakeLock");
        
        createNotificationChannel();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service onStartCommand");
        
        // Start as foreground with notification
        startForeground(NOTIFICATION_ID, createNotification());
        
        // Acquire WakeLock
        if (!wakeLock.isHeld()) {
            wakeLock.acquire();
            Log.d(TAG, "WakeLock acquired");
        }
        
        // Start location updates
        startLocationUpdates();
        
        // Schedule Doze-resistant alarm
        scheduleExactAlarm();
        
        isRunning = true;
        logDebug("service_started", "Location tracking service started");
        
        return START_STICKY;
    }
    
    /**
     * Start location updates using LocationCallback.
     * We use callback here because it's simpler and the ForegroundService keeps us alive.
     * The AlarmManager is our backup for Doze mode.
     */
    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "No location permission!");
            logDebug("error", "No location permission");
            return;
        }
        
        LocationRequest locationRequest = new LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            INTERVAL_MS
        )
        .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
        .setWaitForAccurateLocation(false)
        .build();
        
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) {
                    Log.w(TAG, "Location result is null");
                    return;
                }
                
                android.location.Location location = locationResult.getLastLocation();
                if (location != null) {
                    Log.d(TAG, "📍 Location: " + location.getLatitude() + ", " + location.getLongitude());
                    processLocation(location);
                }
            }
        };
        
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        );
        
        Log.d(TAG, "✅ Location updates started");
        logDebug("location_updates_started", "FusedLocationProviderClient updates started");
    }
    
    /**
     * Schedule exact alarm that survives Doze mode.
     * This is the "nuclear option" for guaranteed 30-second updates.
     */
    private void scheduleExactAlarm() {
        Intent intent = new Intent(this, AlarmReceiver.class);
        intent.setAction(AlarmReceiver.ACTION_LOCATION_ALARM);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        
        PendingIntent alarmIntent = PendingIntent.getBroadcast(
            this, ALARM_REQUEST_CODE, intent, flags
        );
        
        long triggerTime = System.currentTimeMillis() + INTERVAL_MS;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                alarmIntent
            );
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, alarmIntent);
        }
        
        Log.d(TAG, "✅ Exact alarm scheduled for Doze mode");
    }
    
    /**
     * Process a location update - send to Supabase
     */
    private void processLocation(android.location.Location location) {
        SharedPreferences prefs = getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
        String supabaseUrl = prefs.getString("supabase_url", "");
        String supabaseKey = prefs.getString("supabase_anon_key", "");
        String deviceId = prefs.getString("device_id", "");
        String deviceName = prefs.getString("device_name", null);
        String previousZona = prefs.getString("last_zona", null);
        
        if (supabaseUrl.isEmpty() || deviceId.isEmpty()) {
            Log.w(TAG, "Supabase not configured or device ID missing");
            return;
        }
        
        // Save last position
        prefs.edit()
            .putFloat("last_lat", (float) location.getLatitude())
            .putFloat("last_lng", (float) location.getLongitude())
            .putLong("last_update", System.currentTimeMillis())
            .apply();
        
        // Send to Supabase asynchronously
        LocationApiClient.sendLocation(
            supabaseUrl,
            supabaseKey,
            deviceId,
            deviceName,
            location.getLatitude(),
            location.getLongitude(),
            location.getAccuracy(),
            previousZona,
            (zona) -> {
                // Update last zona
                if (zona != null) {
                    prefs.edit().putString("last_zona", zona).apply();
                }
            }
        );
    }
    
    /**
     * Force location check (called by AlarmReceiver)
     */
    public static void forceLocationCheck(Context context) {
        Log.d(TAG, "⏰ Alarm triggered - forcing location check");
        
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        
        FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(context);
        client.getLastLocation().addOnSuccessListener(location -> {
            if (location != null) {
                Log.d(TAG, "📍 Alarm location: " + location.getLatitude() + ", " + location.getLongitude());
                
                // Send directly using API client
                SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
                LocationApiClient.sendLocation(
                    prefs.getString("supabase_url", ""),
                    prefs.getString("supabase_anon_key", ""),
                    prefs.getString("device_id", ""),
                    prefs.getString("device_name", null),
                    location.getLatitude(),
                    location.getLongitude(),
                    location.getAccuracy(),
                    prefs.getString("last_zona", null),
                    null
                );
            }
        });
        
        // Re-schedule alarm
        if (isRunning) {
            scheduleNextAlarm(context);
        }
    }
    
    private static void scheduleNextAlarm(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction(AlarmReceiver.ACTION_LOCATION_ALARM);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        
        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + INTERVAL_MS,
                pi
            );
        }
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Tracking de Ubicación",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Mantiene el tracking GPS activo");
            channel.setShowBadge(false);
            
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }
    
    private Notification createNotification() {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, flags);
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("iTaxiBcn - Tracking Activo")
            .setContentText("Ubicación en segundo plano")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
    
    private void logDebug(String eventType, String message) {
        SharedPreferences prefs = getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
        LocationApiClient.logDebug(
            prefs.getString("supabase_url", ""),
            prefs.getString("supabase_anon_key", ""),
            prefs.getString("device_id", ""),
            prefs.getString("device_name", null),
            eventType,
            message
        );
    }
    
    @Override
    public void onDestroy() {
        Log.d(TAG, "Service onDestroy");
        
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        
        // Cancel alarms
        Intent intent = new Intent(this, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
            this, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        alarmManager.cancel(pi);
        
        isRunning = false;
        logDebug("service_stopped", "Location tracking service stopped");
        
        super.onDestroy();
    }
    
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
