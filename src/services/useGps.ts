import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { haversine, watchPlayer } from './geoService'
import type { GeoFix } from '../types'

/** Lecturas a menos de esta distancia y recientes no se procesan */
const MIN_MOVE_M = 1.5
const MIN_INTERVAL_MS = 1000
const HEARTBEAT_MS = 5000

/** Arranca el GPS real mientras la simulación esté apagada y `enabled` sea true. */
export function useGps(enabled: boolean, retryKey: number): void {
  const simulation = usePlayerStore((s) => s.simulation)

  useEffect(() => {
    if (!enabled || simulation) return
    const { setStatus, pushFix } = usePlayerStore.getState()
    setStatus('requesting')
    let last: GeoFix | null = null
    const handle = watchPlayer(
      (fix) => {
        const dt = last ? fix.timestamp - last.timestamp : Infinity
        const moved = last ? haversine(last, fix) : Infinity
        // Parado: solo un latido cada pocos segundos para mantener el cálculo de velocidad
        if (dt < MIN_INTERVAL_MS || (moved < MIN_MOVE_M && dt < HEARTBEAT_MS)) return
        last = fix
        pushFix(fix)
      },
      (kind) => setStatus(kind),
    )
    return () => handle.stop()
  }, [enabled, simulation, retryKey])
}
