import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { watchPlayer } from './geoService'

/** Arranca el GPS real mientras la simulación esté apagada y `enabled` sea true. */
export function useGps(enabled: boolean, retryKey: number): void {
  const simulation = usePlayerStore((s) => s.simulation)

  useEffect(() => {
    if (!enabled || simulation) return
    const { setStatus, pushFix } = usePlayerStore.getState()
    setStatus('requesting')
    const handle = watchPlayer(pushFix, (kind) => setStatus(kind))
    return () => handle.stop()
  }, [enabled, simulation, retryKey])
}
