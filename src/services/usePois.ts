import { useEffect } from 'react'
import { latLngToCell } from 'h3-js'
import { usePlayerStore } from '../store/playerStore'
import { useMapStore } from '../store/mapStore'
import { H3_RES, loadPoisAround } from './osmService'

const RETRY_COOLDOWN_MS = 30_000

/**
 * Carga los POIs cuando el jugador entra en una celda H3 nueva (no en cada lectura GPS).
 * `retryKey` fuerza un nuevo intento tras un error.
 */
export function usePois(enabled: boolean, retryKey: number): void {
  useEffect(() => {
    if (!enabled) return
    let loadedCell: string | null = null
    let busy = false
    let lastFailure = 0

    const check = async (): Promise<void> => {
      const pos = usePlayerStore.getState().position
      if (!pos || busy || Date.now() - lastFailure < RETRY_COOLDOWN_MS) return
      const cell = latLngToCell(pos.lat, pos.lng, H3_RES)
      if (cell === loadedCell) return
      busy = true
      const { addPois, setStatus } = useMapStore.getState()
      setStatus('loading')
      try {
        addPois(await loadPoisAround(pos))
        loadedCell = cell
        setStatus('ready')
      } catch {
        lastFailure = Date.now()
        setStatus('error')
      } finally {
        busy = false
      }
    }

    void check()
    // Si falla, loadedCell sigue null: se reintenta con el siguiente movimiento
    return usePlayerStore.subscribe((s, prev) => {
      if (s.position !== prev.position) void check()
    })
  }, [enabled, retryKey])
}
