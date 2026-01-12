import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';

export interface NotificationData {
    id: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

/**
 * Check if we're running on a native platform
 */
export const isNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Request notification permissions and register for push notifications
 * @returns FCM token if successful, null otherwise
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
    if (!isNative()) {
        console.log('Push notifications only available on native platforms');
        return null;
    }

    try {
        // Request permission
        const permission = await PushNotifications.requestPermissions();

        if (permission.receive !== 'granted') {
            console.warn('Push notification permission not granted');
            return null;
        }

        // Register with FCM
        await PushNotifications.register();

        // Return token via promise wrapper
        return new Promise((resolve) => {
            PushNotifications.addListener('registration', (token: Token) => {
                console.log('Push registration success, token:', token.value);
                resolve(token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push registration error:', error);
                resolve(null);
            });
        });
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        return null;
    }
};

/**
 * Check if push notifications are supported and enabled
 */
export const checkNotificationPermission = async (): Promise<boolean> => {
    if (!isNative()) {
        return false;
    }

    try {
        const permission = await PushNotifications.checkPermissions();
        return permission.receive === 'granted';
    } catch (error) {
        console.error('Error checking notification permission:', error);
        return false;
    }
};

/**
 * Set up listeners for incoming push notifications
 */
export const setupNotificationListeners = (
    onNotificationReceived: (notification: NotificationData) => void,
    onNotificationTapped: (notification: NotificationData) => void
): (() => void) => {
    if (!isNative()) {
        return () => { };
    }

    // Notification received while app is in foreground
    const receivedListener = PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
            console.log('Push notification received:', notification);
            onNotificationReceived({
                id: notification.id,
                title: notification.title || '',
                body: notification.body || '',
                data: notification.data,
            });
        }
    );

    // User tapped on a notification
    const actionListener = PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
            console.log('Push notification action performed:', action);
            onNotificationTapped({
                id: action.notification.id,
                title: action.notification.title || '',
                body: action.notification.body || '',
                data: action.notification.data,
            });
        }
    );

    // Return cleanup function
    return () => {
        receivedListener.then(l => l.remove());
        actionListener.then(l => l.remove());
    };
};

/**
 * Remove all delivered notifications from the notification center
 */
export const clearAllNotifications = async (): Promise<void> => {
    if (!isNative()) {
        return;
    }

    try {
        await PushNotifications.removeAllDeliveredNotifications();
    } catch (error) {
        console.error('Error clearing notifications:', error);
    }
};
