/**
 * notifications.ts
 * Browser Desktop Notifications helper for Sovereign Workbench.
 */

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.')
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch (err) {
    console.warn('Error requesting notification permission:', err)
    return Notification.permission
  }
}

export function getDesktopNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

export function sendDesktopNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    return notification
  } catch (err) {
    console.warn('Failed to dispatch desktop notification:', err)
    return null
  }
}
