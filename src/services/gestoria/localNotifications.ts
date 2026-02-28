/**
 * localNotifications.ts — Alertas locales para vencimientos fiscales
 *
 * Programa notificaciones locales 15 y 3 días antes de cada vencimiento.
 * Funciona sin servidor, todo en el dispositivo.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Vencimiento } from '@/hooks/useGestoria';
import { getItem, setItem } from '@/lib/storage';

const NOTIFICATIONS_SCHEDULED_KEY = 'gestoria_notifications_hash';

/**
 * Check if local notifications are available (native only)
 */
function isAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isAvailable()) return false;

  try {
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === 'granted';
  } catch (e) {
    console.warn('[LocalNotif] Permission request failed:', e);
    return false;
  }
}

/**
 * Check if notifications are enabled
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (!isAvailable()) return false;

  try {
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule notifications for upcoming fiscal deadlines.
 * Schedules alerts at 15 days and 3 days before each deadline.
 * Only schedules for future vencimientos.
 */
export async function scheduleVencimientoAlerts(vencimientos: Vencimiento[]): Promise<number> {
  if (!isAvailable()) return 0;

  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) return 0;

  // Build a hash of current vencimientos to avoid re-scheduling
  const hash = vencimientos
    .filter(v => v.daysLeft > 3)
    .map(v => `${v.id}:${v.fecha}`)
    .join('|');

  const prevHash = await getItem(NOTIFICATIONS_SCHEDULED_KEY);
  if (prevHash === hash) {
    console.log('[LocalNotif] Notifications already up to date');
    return 0;
  }

  try {
    // Cancel all previous gestoria notifications
    const pending = await LocalNotifications.getPending();
    const gestoriaIds = pending.notifications
      .filter(n => n.id >= 100000 && n.id < 200000)
      .map(n => ({ id: n.id }));

    if (gestoriaIds.length > 0) {
      await LocalNotifications.cancel({ notifications: gestoriaIds });
    }

    // Schedule new notifications
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
      sound: string;
      smallIcon: string;
      channelId: string;
    }> = [];

    let idCounter = 100000;

    vencimientos.forEach(v => {
      if (v.daysLeft <= 0) return; // Skip past deadlines

      const deadlineDate = new Date(v.fecha);

      // 15 days before
      if (v.daysLeft > 15) {
        const d15 = new Date(deadlineDate);
        d15.setDate(d15.getDate() - 15);
        d15.setHours(9, 0, 0, 0); // 9:00 AM

        notifications.push({
          id: idCounter++,
          title: `📅 Faltan 15 días: ${v.titulo}`,
          body: `Recuerda: ${v.descripcion}. Fecha límite: ${new Date(v.fecha).toLocaleDateString('es-ES')}.`,
          schedule: { at: d15, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
          channelId: 'gestoria_alerts',
        });
      }

      // 3 days before
      if (v.daysLeft > 3) {
        const d3 = new Date(deadlineDate);
        d3.setDate(d3.getDate() - 3);
        d3.setHours(9, 0, 0, 0);

        notifications.push({
          id: idCounter++,
          title: `⚠️ ¡3 días! ${v.titulo}`,
          body: `Urgente: ${v.descripcion}. Presenta antes del ${new Date(v.fecha).toLocaleDateString('es-ES')}.`,
          schedule: { at: d3, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
          channelId: 'gestoria_alerts',
        });
      }

      // Day before
      if (v.daysLeft > 1 && v.daysLeft <= 15) {
        const d1 = new Date(deadlineDate);
        d1.setDate(d1.getDate() - 1);
        d1.setHours(9, 0, 0, 0);

        notifications.push({
          id: idCounter++,
          title: `🔴 ¡MAÑANA vence! ${v.titulo}`,
          body: `Presenta HOY: ${v.descripcion}.`,
          schedule: { at: d1, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
          channelId: 'gestoria_alerts',
        });
      }
    });

    if (notifications.length > 0) {
      // Create notification channel (Android)
      try {
        await LocalNotifications.createChannel({
          id: 'gestoria_alerts',
          name: 'Alertas Gestoría',
          description: 'Vencimientos fiscales y recordatorios tributarios',
          importance: 4, // HIGH
          sound: 'default',
          vibration: true,
        });
      } catch {
        // Channel might already exist or not supported on iOS
      }

      await LocalNotifications.schedule({ notifications });
      console.log(`[LocalNotif] Scheduled ${notifications.length} notifications`);
    }

    // Save hash
    await setItem(NOTIFICATIONS_SCHEDULED_KEY, hash);
    return notifications.length;
  } catch (e) {
    console.error('[LocalNotif] Error scheduling:', e);
    return 0;
  }
}

/**
 * Cancel all gestoria notifications
 */
export async function cancelAllGestoriaAlerts(): Promise<void> {
  if (!isAvailable()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const gestoriaIds = pending.notifications
      .filter(n => n.id >= 100000 && n.id < 200000)
      .map(n => ({ id: n.id }));

    if (gestoriaIds.length > 0) {
      await LocalNotifications.cancel({ notifications: gestoriaIds });
    }

    await setItem(NOTIFICATIONS_SCHEDULED_KEY, '');
    console.log('[LocalNotif] All gestoria alerts cancelled');
  } catch (e) {
    console.error('[LocalNotif] Error cancelling:', e);
  }
}

/**
 * Get count of pending notifications
 */
export async function getPendingAlertCount(): Promise<number> {
  if (!isAvailable()) return 0;

  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.filter(n => n.id >= 100000 && n.id < 200000).length;
  } catch {
    return 0;
  }
}
