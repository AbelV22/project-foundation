package com.itaxibcn.app.tracking;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

/**
 * BroadcastReceiver for AlarmManager - survives Doze mode.
 * Guarantees location updates and service resurrection every 60 seconds.
 *
 * WakeLock strategy: We use goAsync() to extend BroadcastReceiver lifetime
 * and hold WakeLock for the full duration of async location operations.
 */
public class AlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "AlarmReceiver";
    public static final String ACTION_LOCATION_ALARM = "com.itaxibcn.app.LOCATION_ALARM";

    // Static WakeLock so async callbacks can release it when done
    private static PowerManager.WakeLock sWakeLock;
    private static final Object sWakeLockSync = new Object();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_LOCATION_ALARM.equals(intent.getAction())) {
            return;
        }

        Log.d(TAG, "Alarm received - waking up device");

        // Acquire WakeLock that will be held until async operations complete
        acquireStaticWakeLock(context);

        // Use goAsync() to extend receiver lifetime beyond 10 seconds
        final PendingResult pendingResult = goAsync();

        try {
            if (LocationTrackingService.isRunning || LocationTrackingService.isTrackingAllowed(context)) {
                LocationTrackingService.forceLocationCheck(context);
            } else {
                Log.w(TAG, "Service not running and tracking not allowed, alarm ignored");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in alarm receiver: " + e.getMessage());
        } finally {
            // Release WakeLock after a delay to allow async getCurrentLocation to complete
            // The WakeLock has a 60-second safety timeout anyway
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                releaseStaticWakeLock();
                try {
                    pendingResult.finish();
                } catch (Exception e) {
                    // Already finished
                }
            }, 15000); // 15 seconds should be enough for getCurrentLocation
        }
    }

    /**
     * Acquire a static WakeLock shared across alarm invocations.
     * Uses 60-second safety timeout to prevent battery drain.
     */
    private static void acquireStaticWakeLock(Context context) {
        synchronized (sWakeLockSync) {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                return; // Already held
            }
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            sWakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "iTaxiBcn:AlarmWakeLock"
            );
            sWakeLock.acquire(60 * 1000L); // 60-second safety timeout
            Log.d(TAG, "Static WakeLock acquired (60s timeout)");
        }
    }

    /**
     * Release the static WakeLock.
     */
    private static void releaseStaticWakeLock() {
        synchronized (sWakeLockSync) {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                sWakeLock.release();
                Log.d(TAG, "Static WakeLock released");
            }
            sWakeLock = null;
        }
    }
}
