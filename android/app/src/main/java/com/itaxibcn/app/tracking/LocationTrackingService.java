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
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

/**
 * Foreground Service for location tracking with exhaustive debug logging.
 * Every critical step logs to location_debug_logs for remote diagnosis.
 */
public class LocationTrackingService extends Service {

    private static final String TAG = "LocationTrackingService";
    public static final String CHANNEL_ID = "location_tracking_channel";
    public static final int NOTIFICATION_ID = 9001;
    public static final int LOCATION_REQUEST_CODE = 9002;
    public static final int ALARM_REQUEST_CODE = 9003;

    public static final long INTERVAL_MS = 60 * 1000;
    public static final long FASTEST_INTERVAL_MS = 30 * 1000;

    public static volatile boolean isRunning = false;
    private static int locationUpdateCount = 0;

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
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "iTaxiBcn:LocationWakeLock");
        LocationApiClient.initOfflineQueue(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service onStartCommand");

        // Start as foreground
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, createNotification(),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, createNotification());
        }

        acquireWakeLockWithTimeout();

        // === DEBUG: Log full system diagnostics on start ===
        logSystemDiagnostics();

        // Start location updates
        startLocationUpdates();

        // Schedule Doze-resistant alarm
        scheduleExactAlarm();

        isRunning = true;
        locationUpdateCount = 0;
        BootCompletedReceiver.markTrackingEnabled(this);

        return START_STICKY;
    }

    /**
     * Log comprehensive system diagnostics to remote DB.
     * This tells us EXACTLY what's happening on the device.
     */
    private void logSystemDiagnostics() {
        StringBuilder diag = new StringBuilder();

        // 1. Android version
        diag.append("Android ").append(Build.VERSION.RELEASE)
            .append(" (SDK ").append(Build.VERSION.SDK_INT).append(")");
        diag.append(" | ").append(Build.MANUFACTURER).append(" ").append(Build.MODEL);

        // 2. Google Play Services status
        int gpsStatus = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(this);
        String gpsStatusStr;
        switch (gpsStatus) {
            case ConnectionResult.SUCCESS: gpsStatusStr = "OK"; break;
            case ConnectionResult.SERVICE_MISSING: gpsStatusStr = "MISSING"; break;
            case ConnectionResult.SERVICE_UPDATING: gpsStatusStr = "UPDATING"; break;
            case ConnectionResult.SERVICE_VERSION_UPDATE_REQUIRED: gpsStatusStr = "UPDATE_REQUIRED"; break;
            case ConnectionResult.SERVICE_DISABLED: gpsStatusStr = "DISABLED"; break;
            default: gpsStatusStr = "ERROR(" + gpsStatus + ")"; break;
        }
        diag.append(" | GPlayServices: ").append(gpsStatusStr);

        // 3. GPS/Location provider status
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        boolean gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean networkEnabled = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        diag.append(" | GPS:").append(gpsEnabled ? "ON" : "OFF");
        diag.append(" NET:").append(networkEnabled ? "ON" : "OFF");

        // 4. Permission status
        boolean fineLocation = ActivityCompat.checkSelfPermission(this,
            Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseLocation = ActivityCompat.checkSelfPermission(this,
            Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        diag.append(" | FINE:").append(fineLocation ? "YES" : "NO");
        diag.append(" COARSE:").append(coarseLocation ? "YES" : "NO");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean bgLocation = ActivityCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
            diag.append(" BG:").append(bgLocation ? "YES" : "NO");
        }

        // 5. Battery optimization
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            boolean batteryIgnored = pm.isIgnoringBatteryOptimizations(getPackageName());
            diag.append(" | BattOpt:").append(batteryIgnored ? "IGNORED" : "ACTIVE");
        }

        // 6. Supabase config check
        SharedPreferences prefs = getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
        String supabaseUrl = prefs.getString("supabase_url", "");
        String deviceId = prefs.getString("device_id", "");
        diag.append(" | Config:").append(!supabaseUrl.isEmpty() && !deviceId.isEmpty() ? "OK" : "MISSING");
        diag.append(" DeviceID:").append(deviceId);

        // 7. Install source (Play Store vs sideload)
        try {
            String installer = getPackageManager().getInstallerPackageName(getPackageName());
            diag.append(" | Installer:").append(installer != null ? installer : "sideload");
        } catch (Exception e) {
            diag.append(" | Installer:unknown");
        }

        logDebug("system_diagnostics", diag.toString());
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.w(TAG, "Task removed - scheduling resurrection alarm");
        scheduleExactAlarm();
        logDebug("task_removed", "App cerrada de recientes - alarm programada");
        super.onTaskRemoved(rootIntent);
    }

    private void acquireWakeLockWithTimeout() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(2 * 60 * 1000L);
        }
    }

    private void reacquireWakeLockBriefly() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(30 * 1000L);
        }
    }

    private void startLocationUpdates() {
        if (!isTrackingAllowed()) {
            logDebug("tracking_paused", "Tracking en pausa por horario o toggle manual");
            stopSelf();
            return;
        }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            logDebug("error_no_permission", "SIN PERMISO ACCESS_FINE_LOCATION - no se puede trackear");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                logDebug("warning_no_background", "SIN PERMISO ACCESS_BACKGROUND_LOCATION - background limitado");
            }
        }

        LocationRequest locationRequest = new LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
            .setWaitForAccurateLocation(false)
            .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                reacquireWakeLockBriefly();
                locationUpdateCount++;

                if (locationResult == null) {
                    logDebug("location_callback_null",
                        "LocationResult NULL en callback #" + locationUpdateCount + " - GPS desactivado?");
                    return;
                }

                android.location.Location location = locationResult.getLastLocation();
                if (location != null) {
                    // Log first 3 locations, then every 10th
                    if (locationUpdateCount <= 3 || locationUpdateCount % 10 == 0) {
                        logDebug("location_ok", String.format(
                            "#%d | %.6f, %.6f | acc:%.0fm | provider:%s",
                            locationUpdateCount,
                            location.getLatitude(), location.getLongitude(),
                            location.getAccuracy(),
                            location.getProvider() != null ? location.getProvider() : "unknown"
                        ));
                    }
                    processLocation(location);
                } else {
                    logDebug("location_getlast_null",
                        "getLastLocation() NULL en callback #" + locationUpdateCount);
                }
            }
        };

        logDebug("requesting_updates", "Llamando requestLocationUpdates (interval:" +
            INTERVAL_MS + "ms, fastest:" + FASTEST_INTERVAL_MS + "ms, priority:HIGH_ACCURACY)");

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());

        // Also try to get an immediate location to verify the system works
        fusedLocationClient.getLastLocation()
            .addOnSuccessListener(location -> {
                if (location != null) {
                    long ageMs = System.currentTimeMillis() - location.getTime();
                    logDebug("initial_lastlocation", String.format(
                        "getLastLocation OK: %.6f, %.6f | acc:%.0fm | age:%ds",
                        location.getLatitude(), location.getLongitude(),
                        location.getAccuracy(), ageMs / 1000
                    ));
                } else {
                    logDebug("initial_lastlocation_null",
                        "getLastLocation devolvio NULL - no hay cache de ubicacion");
                }
            })
            .addOnFailureListener(e -> {
                logDebug("initial_lastlocation_error",
                    "getLastLocation FALLO: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            });
    }

    private void scheduleExactAlarm() {
        Intent intent = new Intent(this, AlarmReceiver.class);
        intent.setAction(AlarmReceiver.ACTION_LOCATION_ALARM);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent alarmIntent = PendingIntent.getBroadcast(this, ALARM_REQUEST_CODE, intent, flags);
        long triggerTime = System.currentTimeMillis() + INTERVAL_MS;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, alarmIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, alarmIntent);
        }
    }

    private void processLocation(android.location.Location location) {
        SharedPreferences prefs = getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
        String supabaseUrl = prefs.getString("supabase_url", "");
        String supabaseKey = prefs.getString("supabase_anon_key", "");
        String deviceId = prefs.getString("device_id", "");
        String deviceName = prefs.getString("device_name", null);
        String previousZona = prefs.getString("last_zona", null);

        if (supabaseUrl.isEmpty() || deviceId.isEmpty()) {
            logDebug("config_missing", "supabase_url o device_id vacios - no se puede enviar");
            return;
        }

        prefs.edit()
            .putFloat("last_lat", (float) location.getLatitude())
            .putFloat("last_lng", (float) location.getLongitude())
            .putLong("last_update", System.currentTimeMillis())
            .apply();

        LocationApiClient.sendLocation(supabaseUrl, supabaseKey, deviceId, deviceName,
            location.getLatitude(), location.getLongitude(), location.getAccuracy(),
            previousZona, (zona) -> {
                if (zona != null) {
                    prefs.edit().putString("last_zona", zona).apply();
                }
            });
    }

    /**
     * Force location check (called by AlarmReceiver).
     * Also resurrects the service if it was killed.
     */
    public static void forceLocationCheck(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);

        // RESURRECTION
        if (!isRunning && isTrackingAllowed(context)) {
            try {
                Intent serviceIntent = new Intent(context, LocationTrackingService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                logDebugStatic(prefs, "service_resurrected", "Servicio resucitado por AlarmReceiver");
            } catch (Exception e) {
                logDebugStatic(prefs, "resurrect_failed", "Fallo al resucitar: " + e.getMessage());
            }
            return;
        }

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            logDebugStatic(prefs, "alarm_no_permission", "ALARM: Sin permiso FINE_LOCATION");
            return;
        }

        if (!isTrackingAllowed(context)) {
            return;
        }

        FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(context);

        client.getLastLocation()
            .addOnSuccessListener(location -> {
                if (location != null && (System.currentTimeMillis() - location.getTime() < 30 * 1000)) {
                    sendLocationToSupabase(prefs, location);
                } else {
                    com.google.android.gms.tasks.CancellationTokenSource cts =
                        new com.google.android.gms.tasks.CancellationTokenSource();
                    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                        .addOnSuccessListener(fresh -> {
                            if (fresh != null) {
                                sendLocationToSupabase(prefs, fresh);
                            } else {
                                logDebugStatic(prefs, "alarm_null", "ALARM: getLastLocation Y getCurrentLocation ambos NULL");
                            }
                        })
                        .addOnFailureListener(e -> {
                            logDebugStatic(prefs, "alarm_error", "ALARM getCurrentLocation error: " + e.getMessage());
                        });
                }
            })
            .addOnFailureListener(e -> {
                logDebugStatic(prefs, "alarm_getlast_error", "ALARM getLastLocation error: " + e.getMessage());
            });

        scheduleNextAlarm(context);
    }

    private static void sendLocationToSupabase(SharedPreferences prefs, android.location.Location location) {
        LocationApiClient.sendLocation(
            prefs.getString("supabase_url", ""),
            prefs.getString("supabase_anon_key", ""),
            prefs.getString("device_id", ""),
            prefs.getString("device_name", null),
            location.getLatitude(), location.getLongitude(), location.getAccuracy(),
            prefs.getString("last_zona", null), null);
    }

    private static void logDebugStatic(SharedPreferences prefs, String eventType, String message) {
        LocationApiClient.logDebug(
            prefs.getString("supabase_url", ""),
            prefs.getString("supabase_anon_key", ""),
            prefs.getString("device_id", ""),
            prefs.getString("device_name", null),
            eventType, message);
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
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + INTERVAL_MS, pi);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Tracking de Ubicación", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Mantiene el tracking GPS activo");
            channel.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
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
            eventType, message);
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
        Intent intent = new Intent(this, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(this, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarmManager.cancel(pi);
        isRunning = false;
        BootCompletedReceiver.markTrackingDisabled(this);
        logDebug("service_stopped", "Servicio detenido. Updates recibidos: " + locationUpdateCount);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    public static boolean isTrackingAllowed(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("iTaxiBcn", Context.MODE_PRIVATE);
        boolean trackingEnabled = prefs.getBoolean("tracking_enabled", true);
        if (!trackingEnabled) return false;
        boolean scheduleEnabled = prefs.getBoolean("schedule_enabled", false);
        if (scheduleEnabled) {
            int startHour = prefs.getInt("schedule_start", 8);
            int endHour = prefs.getInt("schedule_end", 20);
            java.util.Calendar now = java.util.Calendar.getInstance();
            int currentHour = now.get(java.util.Calendar.HOUR_OF_DAY);
            if (startHour < endHour) {
                if (currentHour < startHour || currentHour >= endHour) return false;
            } else {
                if (currentHour < startHour && currentHour >= endHour) return false;
            }
        }
        return true;
    }

    private boolean isTrackingAllowed() { return isTrackingAllowed(this); }
}
