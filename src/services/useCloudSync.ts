import { useEffect } from 'react'
import { initCloud, pushIfNeeded, syncNow } from './cloudSync'
import { backendEnabled } from './supabaseClient'

const CHECK_EVERY_MS = 60_000
/** Mientras se juega, como máximo una subida cada 3 minutos */
const MIN_GAP_MS = 3 * 60_000
/** Al salir de la app se sube casi de inmediato */
const LEAVE_GAP_MS = 20_000

/** Inicia sesión guardada y mantiene la partida sincronizada. No hace nada sin backend configurado. */
export function useCloudSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !backendEnabled) return
    void initCloud()
    const timer = window.setInterval(() => void pushIfNeeded(MIN_GAP_MS), CHECK_EVERY_MS)
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') void pushIfNeeded(LEAVE_GAP_MS)
    }
    const onOnline = (): void => void syncNow()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled])
}
