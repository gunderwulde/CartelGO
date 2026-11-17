import { useEffect, useState } from 'react'
import { useBaseStore } from '../store/baseStore'

const SYNC_EVERY_MS = 5000

/**
 * Pone al día laboratorio, camellos y blanqueo al abrir la app, al volver a ella y cada pocos segundos.
 * El cálculo se hace siempre contra Date.now(), así que un timer dormido no pierde progreso (AGENTS §5).
 */
export function useIdle(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const sync = (): void => useBaseStore.getState().sync()
    sync()
    const id = window.setInterval(sync, SYNC_EVERY_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])
}

/** Reloj para refrescar cuentas atrás en pantalla. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
