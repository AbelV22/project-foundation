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
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
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

import java.security.MessageDigest;

/**
 * Foreground Service for location tracking.
 * v1.0.7 - DUAL ENGINE: FusedLocation + LocationManager fallback.
 *
 * Strategy:
 * 1. Try FusedLocationProviderClient (Google Play Services) - preferred
 * 2. If Fused returns null after 15 seconds, activate LocationManager as fallback
 * 3. AlarmReceiver also uses dual strategy
 * 4. Comprehensive diagnostics including certificate SHA-1
 */
public class LocationTrackingService extends Service {

    private static final String TAG = "LocationTrackingService";
    public static final String CHANNEL_ID = "location_tracking_channel";
    public static final int NOTIFICATION_ID = 9001;
    public static final int LOCATION_REQUEST_CODE = 9002;
    public static final int ALARM_REQUEST_CODE = 9003;

    public static final long INTERVAL_MS = 60 * 1000;
    public static final long FASTEST_INTERVAL_MS = 30 * 1000;
    private static final long FUSED_FALLBACK_TIMEOUT_MS = 15 * 1000;

    public static volatile boolean isRunning = false;
    private static int locationUpdateCount = 0;
    private static int fusedNullCount = 0;
    private static boolean usingFallback = false;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback fusedLocationCallback;
    private LocationManager locationManager;
    private LocationListener nativeLocationListener;
    private PowerManager.WakeLock wakeLock;
    private AlarmManager alarmManager;
    private android.os.Handler fallbackHandler;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service onCreate");
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "iTaxiBcn:LocationWakeLock");
        fallbackHandler = new android.os.Handler(Looper.getMainLooper());
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

        // Start DUAL location strategy
        startDualLocationUpdates();

        // Schedule Doze-resistant alarm
        scheduleExactAlarm();

        isRunning = true;
        locationUpdateCount = 0;
        fusedNullCount = 0;
        usingFallback = false;
        BootCompletedReceiver.markTrackingEnabled(this);

        return START_STICKY;
    }

    /**
     * Log comprehensive system diagnostics INCLUDING certificate SHA-1.
     */
    private void logSystemDiagnostics() {
        StringBuilder diag = new StringBuilder();

        diag.append("v1.0.8-DUAL");

        // 1. Android version
        diag.append(" | Android ").append(Build.VERSION.RELEASE)
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
        diag.append(" | GPlay:").append(gpsStatusStr);

        // 3. GPS/Location provider status
        boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean networkEnabled = false;
        try {
            networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            // Some devices don't have network provider
        }
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
        diag.append(" | Cfg:").append(!supabaseUrl.isEmpty() && !deviceId.isEmpty() ? "OK" : "MISSING");
        diag.append(" Dev:").append(deviceId);

        // 7. Install source (Play Store vs sideload)
        try {
            String installer;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.content.pm.InstallSourceInfo sourceInfo =
                    getPackageManager().getInstallSourceInfo(getPackageName());
                installer = sourceInfo.getInstallingPackageName();
            } else {
                installer = getPackageManager().getInstallerPackageName(getPackageName());
            }
            diag.append(" | Inst:").append(installer != null ? installer : "sideload");
        } catch (Exception e) {
            diag.append(" | Inst:unknown");
        }

        // 8. CRITICAL: Certificate SHA-1 fingerprint
        // This tells us if the signing key matches what Firebase expects
        try {
            PackageInfo packageInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo = getPackageManager().getPackageInfo(
                    getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                android.content.pm.SigningInfo signingInfo = packageInfo.signingInfo;
                if (signingInfo != null) {
                    Signature[] sigs = signingInfo.getApkContentsSigners();
                    if (sigs != null && sigs.length > 0) {
                        diag.append(" | SHA1:").append(sha1Hex(sigs[0].toByteArray()));
                    }
                }
            } else {
                packageInfo = getPackageManager().getPackageInfo(
                    getPackageName(), PackageManager.GET_SIGNATURES);
                if (packageInfo.signatures != null && packageInfo.signatures.length > 0) {
                    diag.append(" | SHA1:").append(sha1Hex(packageInfo.signatures[0].toByteArray()));
                }
            }
        } catch (Exception e) {
            diag.append(" | SHA1:ERROR(" + e.getMessage() + ")");
        }

        logDebug("system_diagnostics", diag.toString());
    }

    /**
     * Compute SHA-1 hex string from certificate bytes.
     */
    private static String sha1Hex(byte[] certBytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(certBytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02X:", b));
            }
            if (sb.length() > 0) sb.setLength(sb.length() - 1);
            return sb.toString();
        } catch (Exception e) {
            return "HASH_ERROR";
        }
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

    // ==========================================
    // DUAL LOCATION STRATEGY
    // ==========================================

    /**
     * Start BOTH FusedLocation and schedule a fallback to native LocationManager.
     * If FusedLocation delivers within 15s, cancel the fallback.
     * If not, activate LocationManager as the primary source.
     */
    private void startDualLocationUpdates() {
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
                logDebug("warning_no_background", "SIN PERMISO ACCESS_BACKGROUND_LOCATION");
            }
        }

        // === ENGINE 1: FusedLocationProviderClient ===
        startFusedLocationUpdates();

        // === ENGINE 2: Schedule fallback check ===
        // If Fused hasn't delivered anything in 15s, start native LocationManager
        fallbackHandler.postDelayed(this::checkAndActivateFallback, FUSED_FALLBACK_TIMEOUT_MS);

        // === Also start native LocationManager immediately as backup ===
        // It runs in parallel - if Fused works, native updates are just redundant
        startNativeLocationUpdates();
    }

    /**
     * Engine 1: FusedLocationProviderClient (Google Play Services)
     */
    private void startFusedLocationUpdates() {
        LocationRequest locationRequest = new LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
            .setWaitForAccurateLocation(false)
            .build();

        fusedLocationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                reacquireWakeLockBriefly();
                locationUpdateCount++;

                if (locationResult == null) {
                    fusedNullCount++;
                    logDebug("fused_null",
                        "Fused NULL #" + fusedNullCount + " (total callbacks: " + locationUpdateCount + ")");
                    return;
                }

                Location location = locationResult.getLastLocation();
                if (location != null) {
                    // Log first 5 locations, then every 10th
                    if (locationUpdateCount <= 5 || locationUpdateCount % 10 == 0) {
                        logDebug("fused_ok", String.format(
                            "#%d | %.6f, %.6f | acc:%.0fm | prov:%s | fallback:%s",
                            locationUpdateCount,
                            location.getLatitude(), location.getLongitude(),
                            location.getAccuracy(),
                            location.getProvider() != null ? location.getProvider() : "?",
                            usingFallback ? "active" : "standby"
                        ));
                    }
                    processLocation(location);
                } else {
                    fusedNullCount++;
                    logDebug("fused_getlast_null",
                        "Fused getLastLocation NULL #" + fusedNullCount);
                }
            }
        };

        logDebug("fused_start", "Iniciando FusedLocationProvider (interval:" +
            INTERVAL_MS + "ms, priority:HIGH_ACCURACY)");

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest, fusedLocationCallback, Looper.getMainLooper());
        } catch (Exception e) {
            logDebug("fused_start_error", "ERROR al iniciar Fused: " + e.getMessage());
        }

        // Test immediate getLastLocation
        try {
            fusedLocationClient.getLastLocation()
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        long ageMs = System.currentTimeMillis() - location.getTime();
                        logDebug("fused_cached", String.format(
                            "Cache OK: %.6f, %.6f | acc:%.0fm | age:%ds",
                            location.getLatitude(), location.getLongitude(),
                            location.getAccuracy(), ageMs / 1000
                        ));
                        processLocation(location);
                    } else {
                        logDebug("fused_cached_null", "getLastLocation NULL - sin cache");
                    }
                })
                .addOnFailureListener(e -> {
                    logDebug("fused_cached_error",
                        "getLastLocation ERROR: " + e.getClass().getSimpleName() + " - " + e.getMessage());
                });
        } catch (Exception e) {
            logDebug("fused_cached_exception", "Exception en getLastLocation: " + e.getMessage());
        }
    }

    /**
     * Engine 2: Native LocationManager (Android built-in, NO Google Play Services dependency)
     * This is the FALLBACK that works regardless of Google Play Services authentication.
     */
    private void startNativeLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        nativeLocationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                reacquireWakeLockBriefly();

                if (usingFallback) {
                    locationUpdateCount++;
                    if (locationUpdateCount <= 5 || locationUpdateCount % 10 == 0) {
                        logDebug("native_ok", String.format(
                            "#%d | %.6f, %.6f | acc:%.0fm | prov:%s",
                            locationUpdateCount,
                            location.getLatitude(), location.getLongitude(),
                            location.getAccuracy(),
                            location.getProvider() != null ? location.getProvider() : "?"
                        ));
                    }
                }

                // Always process - even if Fused is also delivering, this is fine
                processLocation(location);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(String provider) {
                logDebug("native_provider_on", "Provider habilitado: " + provider);
            }

            @Override
            public void onProviderDisabled(String provider) {
                logDebug("native_provider_off", "Provider deshabilitado: " + provider);
            }
        };

        // Request from GPS provider
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    INTERVAL_MS,
                    10f, // minimum 10 meters
                    nativeLocationListener,
                    Looper.getMainLooper()
                );
                logDebug("native_start_gps", "LocationManager GPS iniciado");
            }
        } catch (Exception e) {
            logDebug("native_gps_error", "Error GPS: " + e.getMessage());
        }

        // Also request from Network provider
        try {
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    INTERVAL_MS,
                    50f, // minimum 50 meters for network
                    nativeLocationListener,
                    Looper.getMainLooper()
                );
                logDebug("native_start_net", "LocationManager Network iniciado");
            }
        } catch (Exception e) {
            logDebug("native_net_error", "Error Network: " + e.getMessage());
        }

        // Try to get last known location from native manager
        try {
            Location lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);

            Location best = null;
            if (lastGps != null && lastNet != null) {
                best = (lastGps.getTime() > lastNet.getTime()) ? lastGps : lastNet;
            } else if (lastGps != null) {
                best = lastGps;
            } else if (lastNet != null) {
                best = lastNet;
            }

            if (best != null) {
                long ageMs = System.currentTimeMillis() - best.getTime();
                logDebug("native_cached", String.format(
                    "Native cache: %.6f, %.6f | acc:%.0fm | age:%ds | prov:%s",
                    best.getLatitude(), best.getLongitude(),
                    best.getAccuracy(), ageMs / 1000,
                    best.getProvider() != null ? best.getProvider() : "?"
                ));
                // Only use if recent (< 2 minutes)
                if (ageMs < 120000) {
                    processLocation(best);
                }
            } else {
                logDebug("native_cached_null", "Native: sin cache de ningún provider");
            }
        } catch (Exception e) {
            logDebug("native_cache_error", "Error leyendo cache nativo: " + e.getMessage());
        }
    }

    /**
     * Check if FusedLocation has delivered anything. If not, mark fallback as active.
     */
    private void checkAndActivateFallback() {
        if (locationUpdateCount == 0 || fusedNullCount >= locationUpdateCount) {
            usingFallback = true;
            logDebug("fallback_activated",
                "Fused no ha entregado ubicacion en " + (FUSED_FALLBACK_TIMEOUT_MS / 1000) +
                "s. Callbacks:" + locationUpdateCount + " nulls:" + fusedNullCount +
                " - LocationManager es ahora el motor principal");
        } else {
            logDebug("fallback_not_needed",
                "Fused funciona OK. Callbacks:" + locationUpdateCount + " nulls:" + fusedNullCount);
        }
    }

    // ==========================================
    // ALARM & SCHEDULING
    // ==========================================

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

    // ==========================================
    // PROCESS LOCATION
    // ==========================================

    private void processLocation(Location location) {
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

    // ==========================================
    // STATIC FORCE CHECK (from AlarmReceiver)
    // ==========================================

    /**
     * Force location check with DUAL strategy (called by AlarmReceiver).
     * Tries Fused first, then native LocationManager as fallback.
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

        // Try Fused first
        FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(context);

        client.getLastLocation()
            .addOnSuccessListener(location -> {
                if (location != null && (System.currentTimeMillis() - location.getTime() < 60 * 1000)) {
                    logDebugStatic(prefs, "alarm_fused_ok", String.format(
                        "Fused OK: %.6f, %.6f | acc:%.0fm",
                        location.getLatitude(), location.getLongitude(), location.getAccuracy()));
                    sendLocationToSupabase(prefs, location);
                } else {
                    // Fused failed - try getCurrentLocation
                    com.google.android.gms.tasks.CancellationTokenSource cts =
                        new com.google.android.gms.tasks.CancellationTokenSource();
                    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                        .addOnSuccessListener(fresh -> {
                            if (fresh != null) {
                                logDebugStatic(prefs, "alarm_fused_current_ok", String.format(
                                    "Fused getCurrentLocation OK: %.6f, %.6f | acc:%.0fm",
                                    fresh.getLatitude(), fresh.getLongitude(), fresh.getAccuracy()));
                                sendLocationToSupabase(prefs, fresh);
                            } else {
                                // FUSED COMPLETELY FAILED - use native fallback
                                logDebugStatic(prefs, "alarm_fused_null",
                                    "Fused getLastLocation Y getCurrentLocation NULL - usando fallback nativo");
                                forceLocationNativeFallback(context, prefs);
                            }
                        })
                        .addOnFailureListener(e -> {
                            logDebugStatic(prefs, "alarm_fused_error",
                                "Fused getCurrentLocation ERROR: " + e.getMessage() + " - usando fallback nativo");
                            forceLocationNativeFallback(context, prefs);
                        });
                }
            })
            .addOnFailureListener(e -> {
                logDebugStatic(prefs, "alarm_fused_getlast_error",
                    "Fused getLastLocation ERROR: " + e.getMessage() + " - usando fallback nativo");
                forceLocationNativeFallback(context, prefs);
            });

        scheduleNextAlarm(context);
    }

    /**
     * Native LocationManager fallback for AlarmReceiver.
     * Does NOT depend on Google Play Services.
     */
    private static void forceLocationNativeFallback(Context context, SharedPreferences prefs) {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);

        // Try cached locations from native providers
        Location lastGps = null;
        Location lastNet = null;
        try {
            lastGps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        } catch (Exception e) { /* ignore */ }
        try {
            lastNet = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) { /* ignore */ }

        Location best = null;
        if (lastGps != null && lastNet != null) {
            best = (lastGps.getTime() > lastNet.getTime()) ? lastGps : lastNet;
        } else if (lastGps != null) {
            best = lastGps;
        } else if (lastNet != null) {
            best = lastNet;
        }

        if (best != null) {
            long ageSec = (System.currentTimeMillis() - best.getTime()) / 1000;
            logDebugStatic(prefs, "alarm_native_ok", String.format(
                "Native cache: %.6f, %.6f | acc:%.0fm | age:%ds | prov:%s",
                best.getLatitude(), best.getLongitude(),
                best.getAccuracy(), ageSec,
                best.getProvider() != null ? best.getProvider() : "?"));
            // Accept locations up to 5 minutes old
            if (ageSec < 300) {
                sendLocationToSupabase(prefs, best);
                return;
            }
        }

        // No cached location available - request a single update
        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestSingleUpdate(LocationManager.GPS_PROVIDER, new LocationListener() {
                    @Override
                    public void onLocationChanged(Location location) {
                        logDebugStatic(prefs, "alarm_native_single_ok", String.format(
                            "Native single GPS: %.6f, %.6f | acc:%.0fm",
                            location.getLatitude(), location.getLongitude(), location.getAccuracy()));
                        sendLocationToSupabase(prefs, location);
                    }
                    @Override
                    public void onStatusChanged(String p, int s, Bundle e) {}
                    @Override
                    public void onProviderEnabled(String p) {}
                    @Override
                    public void onProviderDisabled(String p) {}
                }, Looper.getMainLooper());
            } else if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, new LocationListener() {
                    @Override
                    public void onLocationChanged(Location location) {
                        logDebugStatic(prefs, "alarm_native_single_ok", String.format(
                            "Native single NET: %.6f, %.6f | acc:%.0fm",
                            location.getLatitude(), location.getLongitude(), location.getAccuracy()));
                        sendLocationToSupabase(prefs, location);
                    }
                    @Override
                    public void onStatusChanged(String p, int s, Bundle e) {}
                    @Override
                    public void onProviderEnabled(String p) {}
                    @Override
                    public void onProviderDisabled(String p) {}
                }, Looper.getMainLooper());
            } else {
                logDebugStatic(prefs, "alarm_native_no_provider",
                    "Ningun provider disponible (GPS:OFF, NET:OFF)");
            }
        } catch (Exception e) {
            logDebugStatic(prefs, "alarm_native_error",
                "Error solicitando single update: " + e.getMessage());
        }
    }

    private static void sendLocationToSupabase(SharedPreferences prefs, Location location) {
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

    // ==========================================
    // UI & NOTIFICATION
    // ==========================================

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
        Log.d(TAG, eventType + ": " + message);
        SharedPreferences prefs = getSharedPreferences("iTaxiBcn", MODE_PRIVATE);
        LocationApiClient.logDebug(
            prefs.getString("supabase_url", ""),
            prefs.getString("supabase_anon_key", ""),
            prefs.getString("device_id", ""),
            prefs.getString("device_name", null),
            eventType, message);
    }

    // ==========================================
    // LIFECYCLE
    // ==========================================

    @Override
    public void onDestroy() {
        Log.d(TAG, "Service onDestroy");
        if (fusedLocationCallback != null) {
            fusedLocationClient.removeLocationUpdates(fusedLocationCallback);
        }
        if (nativeLocationListener != null) {
            locationManager.removeUpdates(nativeLocationListener);
        }
        if (fallbackHandler != null) {
            fallbackHandler.removeCallbacksAndMessages(null);
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
        logDebug("service_stopped", "Servicio detenido. Total updates:" + locationUpdateCount +
            " fusedNulls:" + fusedNullCount + " fallbackActive:" + usingFallback);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ==========================================
    // TRACKING ALLOWED
    // ==========================================

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
