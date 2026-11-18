import { useEffect, useState } from 'react'
import { useBaseStore } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useAwayStore, hasNews, type AwayReport } from '../store/awayStore'
import { useCelebrateStore } from '../store/celebrateStore'
import { notify } from './notify'
import { play } from './sound'

const SYNC_EVERY_MS = 5000
/** Mínimo de ausencia para mostrar el resumen "mientras no estabas" */
const AWAY_SUMMARY_MS = 60_000
const LAST_SEEN_KEY = 'cartelgo:lastSeen'

const readLastSeen = (): number | null => {
  try {
    const v = Number(localStorage.getItem(LAST_SEEN_KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}
const writeLastSeen = (): void => {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()))
  } catch {
    /* sin almacenamiento: no habrá resumen al reabrir */
  }
}

/** Espera a que las partidas guardadas (IndexedDB) estén cargadas */
function whenHydrated(): Promise<void> {
  const wait = (p: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void }): Promise<void> =>
    p.hasHydrated() ? Promise.resolve() : new Promise((res) => void p.onFinishHydration(() => res()))
  return Promise.all([wait(useBaseStore.persist), wait(useInventoryStore.persist)]).then(() => undefined)
}

interface Snap {
  jobRecipe: string | null
  jobLeft: number
  trips: Record<string, number>
  sold: number
}

function snap(): Snap {
  const b = useBaseStore.getState()
  const trips: Record<string, number> = {}
  for (const c of b.carriers) if (c.trip) trips[c.id] = c.trip.arriveAt
  return {
    jobRecipe: b.job?.recipe ?? null,
    jobLeft: b.job?.remaining ?? 0,
    trips,
    sold: b.dealers.reduce((a, d) => a + (d.sold ?? 0), 0),
  }
}

interface Acc {
  batches: number
  deliveries: number
  sales: number
}
const emptyAcc = (): Acc => ({ batches: 0, deliveries: 0, sales: 0 })

/**
 * Pone al día laboratorio, camellos y blanqueo al abrir la app, al volver a ella y cada pocos segundos.
 * El cálculo se hace siempre contra Date.now(), así que un timer dormido no pierde progreso (AGENTS §5).
 * Además cuenta lo ocurrido para el resumen «mientras no estabas» y para las celebraciones.
 */
export function useIdle(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null
    let startDirty = useInventoryStore.getState().dirtyCash
    let startClean = useInventoryStore.getState().cleanCash
    let acc = emptyAcc()
    let jobFinishedAway = false

    /** Avanza el idle y devuelve lo que ha pasado en esta puesta al día */
    const runSync = (): Acc => {
      const before = snap()
      useBaseStore.getState().sync()
      const after = snap()
      const step = emptyAcc()
      if (before.jobRecipe && (!after.jobRecipe || after.jobRecipe === before.jobRecipe)) {
        step.batches = Math.max(0, before.jobLeft - after.jobLeft)
      }
      for (const [id, arriveAt] of Object.entries(before.trips)) if (after.trips[id] !== arriveAt) step.deliveries++
      step.sales = Math.max(0, after.sold - before.sold)
      acc = { batches: acc.batches + step.batches, deliveries: acc.deliveries + step.deliveries, sales: acc.sales + step.sales }
      return step
    }

    const buildReport = (since: number, dirty0: number, clean0: number): AwayReport => {
      const inv = useInventoryStore.getState()
      const log = useBaseStore.getState().dealerLog.filter((e) => e.at >= since)
      return {
        awayMs: Date.now() - since,
        dirty: Math.max(0, inv.dirtyCash - dirty0),
        clean: Math.max(0, inv.cleanCash - clean0),
        batches: acc.batches,
        deliveries: acc.deliveries,
        sales: acc.sales,
        stolen: log.reduce((a, e) => a + e.amount, 0),
        incidents: log.length,
      }
    }

    const sync = (): void => {
      const step = runSync()
      writeLastSeen()
      const finished = step.batches > 0 && useBaseStore.getState().job === null
      if (document.visibilityState === 'hidden') {
        if (finished) {
          jobFinishedAway = true
          void notify('Cartel GO', '¡Lote terminado en el laboratorio!')
        }
        return
      }
      if (finished) {
        play('done')
        useCelebrateStore.getState().celebrate('¡Lote terminado!')
      } else if (step.deliveries > 0) {
        play('done')
        useCelebrateStore.getState().celebrate('¡Pedido entregado en el almacén!')
      }
    }

    const onVisibility = (): void => {
      const inv = useInventoryStore.getState()
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        startDirty = inv.dirtyCash
        startClean = inv.cleanCash
        acc = emptyAcc()
        jobFinishedAway = false
        writeLastSeen()
        return
      }
      runSync()
      writeLastSeen()
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_SUMMARY_MS) {
        const r = buildReport(hiddenAt, startDirty, startClean)
        if (jobFinishedAway && r.batches === 0) r.batches = 1
        if (hasNews(r)) useAwayStore.getState().show(r)
      }
      hiddenAt = null
      acc = emptyAcc()
    }

    // Arranque en frío: tras cargar la partida, resumen de lo ocurrido desde la última vez
    const lastSeen = readLastSeen()
    void whenHydrated().then(() => {
      if (cancelled) return
      const d0 = useInventoryStore.getState().dirtyCash
      const c0 = useInventoryStore.getState().cleanCash
      acc = emptyAcc()
      runSync()
      writeLastSeen()
      if (lastSeen !== null && Date.now() - lastSeen >= AWAY_SUMMARY_MS) {
        const r = buildReport(lastSeen, d0, c0)
        if (hasNews(r)) useAwayStore.getState().show(r)
      }
      acc = emptyAcc()
      startDirty = useInventoryStore.getState().dirtyCash
      startClean = useInventoryStore.getState().cleanCash
    })

    const id = window.setInterval(sync, SYNC_EVERY_MS)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', writeLastSeen)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', writeLastSeen)
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
