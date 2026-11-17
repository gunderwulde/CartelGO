/** Notificaciones locales (sin servidor push): funcionan mientras la app siga viva en segundo plano. */

export const notificationsSupported = (): boolean => typeof Notification !== 'undefined'

/** Pide permiso una sola vez. Llamar desde una acción del usuario. */
export async function requestNotifyPermission(): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    /* navegador sin soporte completo */
  }
}

export async function notify(title: string, body: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: 'cartelgo' })
    else new Notification(title, { body })
  } catch {
    /* sin permiso efectivo: se ignora */
  }
}
