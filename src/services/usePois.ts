import { useEffect } from 'react'
import { latLngToCell } from 'h3-js'
import { usePlayerStore } from '../store/playerStore'
import { useMapStore } from '../store/mapStore'
import { H3_RES, loadPoisAround } from './osmService'

/** Tras un fallo total no se vuelve a intentar hasta pasado este tiempo */
const RETRY_COOLDOWN_MS = 20_000
/** Celdas del anillo que fallaron: se reintentan con esta calma */
const PARTIAL_RETRY_MS = 60_000

/**
 * Carga los POIs cuando el jugador entra en una celda H3 nueva (no en cada lectura GPS).
 * Los resultados se pintan según llegan: primero la caché, luego la celda actual y después las vecinas.
 * `retryKey` fuerza un nuevo intento tras un error.
 */
export function usePois(enabled: boolean, retryKey: number): void {
  useEffect(() => {
    if (!enabled) return
    let loadedCell: string | null = null
    let busy = false
    let lastAttempt = 0
    let hasFailedCells = false
    let forceNext = retryKey > 0

    const check = async (): Promise<void> => {
      const pos = usePlayerStore.getState().position
      if (!pos || busy) return
      const cell = latLngToCell(pos.lat, pos.lng, H3_RES)
      const sinceLast = Date.now() - lastAttempt
      const sameCell = cell === loadedCell
      if (!forceNext) {
        if (sameCell && !hasFailedCells) return
        if (sameCell && sinceLast < PARTIAL_RETRY_MS) return
        if (!sameCell && loadedCell === null && sinceLast < RETRY_COOLDOWN_MS) return
      }
      forceNext = false
      busy = true
      lastAttempt = Date.now()
      const { addPois, setStatus } = useMapStore.getState()
      setStatus('loading')
      try {
        const result = await loadPoisAround(pos, addPois)
        loadedCell = cell
        hasFailedCells = result.failedCells.length > 0
        setStatus('ready')
      } catch {
        setStatus('error')
      } finally {
        busy = false
      }
    }

    void check()
    return usePlayerStore.subscribe((s, prev) => {
      if (s.position !== prev.position) void check()
    })
  }, [enabled, retryKey])
}
