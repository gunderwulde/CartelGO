import { useEffect, useState } from 'react'
import { useBaseStore } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { notify } from './notify'
import { play } from './sound'

const SYNC_EVERY_MS = 5000
/** Mínimo de ausencia para mostrar el resumen "mientras no estabas" */
const AWAY_SUMMARY_MS = 60_000

/**
 * Pone al día laboratorio, camellos y blanqueo al abrir la app, al volver a ella y cada pocos segundos.
 * El cálculo se hace siempre contra Date.now(), así que un timer dormido no pierde progreso (AGENTS §5).
 */
export function useIdle(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null
    let startDirty = useInventoryStore.getState().dirtyCash
    let startClean = useInventoryStore.getState().cleanCash
    let jobFinishedAway = false

    const sync = (): void => {
      const hadJob = useBaseStore.getState().job !== null
      useBaseStore.getState().sync()
      const finished = hadJob && useBaseStore.getState().job === null
      if (!finished) return
      if (document.visibilityState === 'hidden') {
        jobFinishedAway = true
        void notify('Cartel GO', '¡Lote terminado en el laboratorio!')
      } else {
        play('done')
        useInventoryStore.getState().setNotice('Laboratorio: lote terminado.')
      }
    }

    const onVisibility = (): void => {
      const inv = useInventoryStore.getState()
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        startDirty = inv.dirtyCash
        startClean = inv.cleanCash
        jobFinishedAway = false
        return
      }
      sync()
      const after = useInventoryStore.getState()
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_SUMMARY_MS) {
        const parts: string[] = []
        const dDirty = after.dirtyCash - startDirty
        const dClean = after.cleanCash - startClean
        if (dDirty > 0) parts.push(`+$${dDirty} sucios`)
        if (dClean > 0) parts.push(`+$${dClean} limpios`)
        if (jobFinishedAway) parts.push('lote terminado')
        if (parts.length > 0) after.setNotice(`Mientras no estabas: ${parts.join(', ')}.`)
      }
      hiddenAt = null
    }

    sync()
    const id = window.setInterval(sync, SYNC_EVERY_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
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
