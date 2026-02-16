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
 * Uses FusedLocationProviderClient for high-accuracy updates.
 * Implements AlarmManager.setExactAndAllowWhileIdle for Doze mode resistance.
 * Self-resurrects via onTaskRemoved and AlarmReceiver.
 */
public class LocationTrackingService extends Service {

    private static final String TAG = "LocationTrackingService";
    public static final String CHANNEL_ID = "location_tracking_channel";
    public static final int NOTIFICATION_ID = 9001;
    public static final int LOCATION_REQUEST_CODE = 9002;
    public static final int ALARM_REQUEST_CODE = 9003;

    public static final long INTERVAL_MS = 60 * 1000; // 60 seconds
    public static final long FASTEST_INTERVAL_MS = 30 * 1000;

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

        // Initialize offline queue for network failures
        LocationApiClient.initOfflineQueue(this);

        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service onStartCommand");

        // Start as foreground with notification
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                createNotification(),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            );
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        // Acquire WakeLock with timeout to prevent battery drain
        acquireWakeLockWithTimeout();

        // Start location updates
        startLocationUpdates();

        // Schedule Doze-resistant alarm (also serves as resurrection mechanism)
        scheduleExactAlarm();

        isRunning = true;

        // Mark tracking as enabled for boot recovery
        BootCompletedReceiver.markTrackingEnabled(this);

        logDebug("service_started", "Location tracking service started");

        return START_STICKY;
    }

    /**
     * Called when user swipes app from recents.
     * Re-schedule alarm to resurrect the service.
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.w(TAG, "Task removed (app swiped from recents) - scheduling resurrection alarm");

        // Re-schedule alarm so AlarmReceiver can restart us
        scheduleExactAlarm();

        // Log the event
        logDebug("task_removed", "App cerrada de recientes - alarm programada para resurrección");

        super.onTaskRemoved(rootIntent);
    }

    /**
     * Acquire WakeLock with timeout to prevent excessive battery drain.
     */
    private void acquireWakeLockWithTimeout() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(2 * 60 * 1000L); // 2-minute timeout
            Log.d(TAG, "WakeLock acquired with 2-minute timeout");
        }
    }

    /**
     * Reacquire WakeLock briefly during location processing.
     */
    private void reacquireWakeLockBriefly() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(30 * 1000L); // 30 seconds
            Log.d(TAG, "WakeLock reacquired briefly");
        }
    }

    /**
     * Start location updates using LocationCallback.
     * We use callback here because it's simpler and the ForegroundService keeps us alive.
     * The AlarmManager is our backup for Doze mode.
     */
    private void startLocationUpdates() {
        if (!isTrackingAllowed()) {
            Log.d(TAG, "Tracking paused (Schedule or Manual Stop)");
            logDebug("tracking_paused", "Tracking en pausa por horario o interruptor manual");
            stopSelf();
            return;
        }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "No location permission!");
            logDebug("error_no_permission", "ERROR: No tiene permiso ACCESS_FINE_LOCATION");
            return;
        }

        // Check background location permission for Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "No background location permission!");
                logDebug("warning_no_background", "AVISO: No tiene permiso ACCESS_BACKGROUND_LOCATION (Android 10+)");
            }
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
                // Reacquire WakeLock briefly during processing
                reacquireWakeLockBriefly();

                if (locationResult == null) {
                    Log.w(TAG, "Location result is null");
                    logDebug("location_null", "ERROR: LocationResult es null - GPS puede estar desactivado");
                    return;
                }

                android.location.Location location = locationResult.getLastLocation();
                if (location != null) {
                    Log.d(TAG, String.format(
                        "Location OK: %.6f, %.6f (accuracy: %.0fm)",
                        location.getLatitude(),
                        location.getLongitude(),
                        location.getAccuracy()
                    ));
                    processLocation(location);
                }
            }
        };

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        );

        Log.d(TAG, "Location updates started");
        logDebug("location_updates_started", "Servicio iniciado - esperando primera ubicación...");
    }

    /**
     * Schedule exact alarm that survives Doze mode.
     * Also serves as resurrection mechanism if service is killed.
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

        Log.d(TAG, "Exact alarm scheduled for Doze mode");
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
     * Force location check (called by AlarmReceiver).
     * Also resurrects the service if it was killed by the system.
     */
    public static void forceLocationCheck(Context context) {
        Log.d(TAG, "Alarm triggered - forcing location check");

        // RESURRECTION: If service is not running but tracking is allowed, restart it
        if (!isRunning && isTrackingAllowed(context)) {
            Log.w(TAG, "Service was killed! Resurrecting via AlarmReceiver...");
            try {
                Intent serviceIntent = new Intent(context, LocationTrackingService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
                logDebugStatic(prefs, "service_resurrected", "Servicio resucitado por AlarmReceiver");
            } catch (Exception e) {
                Log.e(TAG, "Failed to resurrect service: " + e.getMessage());
            }
            return; // Service onStartCommand will handle location updates
        }

        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", MODE_PRIVATE);

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            logDebugStatic(prefs, "alarm_no_permission", "ALARM ERROR: Sin permiso de ubicación");
            return;
        }

        if (!isTrackingAllowed(context)) {
             Log.d(TAG, "Alarm: Tracking paused by schedule");
             return;
        }

        FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(context);

        client.getLastLocation()
            .addOnSuccessListener(location -> {
                if (location != null && (System.currentTimeMillis() - location.getTime() < 30 * 1000)) {
                    // Location is fresh (less than 30 seconds old)
                    Log.d(TAG, String.format(
                        "ALARM location (cached): %.6f, %.6f (accuracy: %.0fm, age: %ds)",
                        location.getLatitude(),
                        location.getLongitude(),
                        location.getAccuracy(),
                        (System.currentTimeMillis() - location.getTime()) / 1000
                    ));
                    sendLocationToSupabase(prefs, location);
                } else {
                    // Location is null or stale - Force fresh update
                    Log.w(TAG, "getLastLocation is null or stale. Requesting fresh location...");
                    logDebugStatic(prefs, "alarm_forcing_update", "Cache vacía o antigua. Forzando getCurrentLocation...");

                    com.google.android.gms.tasks.CancellationTokenSource cts = new com.google.android.gms.tasks.CancellationTokenSource();

                    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                        .addOnSuccessListener(freshLocation -> {
                            if (freshLocation != null) {
                                Log.d(TAG, String.format(
                                    "ALARM location (fresh): %.6f, %.6f (accuracy: %.0fm)",
                                    freshLocation.getLatitude(),
                                    freshLocation.getLongitude(),
                                    freshLocation.getAccuracy()
                                ));
                                sendLocationToSupabase(prefs, freshLocation);
                            } else {
                                logDebugStatic(prefs, "alarm_location_fresh_null", "ERROR CRITICO: getCurrentLocation() también devolvió null");
                            }
                        })
                        .addOnFailureListener(e -> {
                            Log.e(TAG, "ALARM ERROR (Fresh): " + e.getMessage());
                            logDebugStatic(prefs, "alarm_fresh_error", "ALARM ERROR (Fresh): " + e.getMessage());
                        });
                }
            })
            .addOnFailureListener(e -> {
                Log.e(TAG, "getLastLocation failed: " + e.getMessage());
                // Try fresh location anyway on failure
                com.google.android.gms.tasks.CancellationTokenSource cts = new com.google.android.gms.tasks.CancellationTokenSource();
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                     .addOnSuccessListener(freshLocation -> {
                         if (freshLocation != null) sendLocationToSupabase(prefs, freshLocation);
                     });
            });

        // Always re-schedule alarm (regardless of isRunning state)
        scheduleNextAlarm(context);
    }

    /**
     * Helper to send location to Supabase from static context
     */
    private static void sendLocationToSupabase(SharedPreferences prefs, android.location.Location location) {
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

    /**
     * Static helper to log debug messages (used from static methods)
     */
    private static void logDebugStatic(SharedPreferences prefs, String eventType, String message) {
        LocationApiClient.logDebug(
            prefs.getString("supabase_url", ""),
            prefs.getString("supabase_anon_key", ""),
            prefs.getString("device_id", ""),
            prefs.getString("device_name", null),
            eventType,
            message
        );
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

        // Mark tracking as disabled for boot recovery
        BootCompletedReceiver.markTrackingDisabled(this);

        logDebug("service_stopped", "Location tracking service stopped");

        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /**
     * Check if tracking is allowed based on user settings (Manual Toggle + Schedule)
     */
    public static boolean isTrackingAllowed(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);

        // 1. Global manual toggle
        boolean trackingEnabled = prefs.getBoolean("tracking_enabled", true);
        if (!trackingEnabled) return false;

        // 2. Schedule
        boolean scheduleEnabled = prefs.getBoolean("schedule_enabled", false);
        if (scheduleEnabled) {
            int startHour = prefs.getInt("schedule_start", 8);
            int endHour = prefs.getInt("schedule_end", 20);

            java.util.Calendar now = java.util.Calendar.getInstance();
            int currentHour = now.get(java.util.Calendar.HOUR_OF_DAY);

            if (startHour < endHour) {
                if (currentHour < startHour || currentHour >= endHour) return false;
            } else {
                // Night shift (e.g. 22:00 to 06:00)
                if (currentHour < startHour && currentHour >= endHour) return false;
            }
        }

        return true;
    }

    private boolean isTrackingAllowed() {
        return isTrackingAllowed(this);
    }
}
