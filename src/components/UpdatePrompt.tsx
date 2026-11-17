import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, X } from 'lucide-react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 h

/** Aviso de nueva versión de la PWA instalada. El usuario decide cuándo recargar. */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = (): void => {
        if (!navigator.onLine) return
        registration.update().catch(() => undefined)
      }
      window.setInterval(check, CHECK_INTERVAL_MS)
      // Al volver a abrir la app instalada (muy habitual en móvil)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  const applyUpdate = (): void => {
    // Respaldo: recarga cuando el nuevo service worker toma el control
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    void updateServiceWorker(true)
  }

  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-3 bottom-24 z-50 cartoon-card p-3 flex items-center gap-3">
      <Download size={28} className="shrink-0" />
      <div className="flex-1">
        <p className="font-black leading-tight">¡Nueva versión!</p>
        <p className="text-xs font-bold">Actualiza para tener lo último. Tu progreso se conserva.</p>
      </div>
      <button className="cartoon-btn px-3 py-2 text-sm" onClick={applyUpdate}>
        Actualizar
      </button>
      <button aria-label="Más tarde" onClick={() => setNeedRefresh(false)}>
        <X size={20} />
      </button>
    </div>
  )
}
