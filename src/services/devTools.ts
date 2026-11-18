import { useBaseStore } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useTutorialStore } from '../store/tutorialStore'

/** Herramientas de prueba (solo con ?dev en la URL). Nada de esto llega a los jugadores. */
export const DEV_TOOLS = new URLSearchParams(window.location.search).has('dev')

export const devGive = (dirty: number, clean: number): void => {
  const inv = useInventoryStore.getState()
  useInventoryStore.setState({ dirtyCash: inv.dirtyCash + dirty, cleanCash: inv.cleanCash + clean })
}

export const devFavors = (n: number): void => {
  useBaseStore.getState().grantFavors(n)
}

export const devReputation = (n: number): void => {
  useBaseStore.setState((s) => ({ reputation: s.reputation + n }))
}

export const devHeat = (): void => {
  useInventoryStore.setState({ heat: 0 })
}

export const devTutorial = (skip: boolean): void => {
  if (skip) useTutorialStore.getState().finish()
  else useTutorialStore.getState().restart()
}

/** "Adelanta el reloj": retrasa todas las marcas de tiempo guardadas y pone el juego al día. */
export function devAdvance(ms: number): void {
  useBaseStore.setState((s) => ({
    dealersAt: s.dealersAt - ms,
    launderAt: s.launderAt - ms,
    adAt: s.adAt > 0 ? s.adAt - ms : 0,
    hq: s.hq ? { ...s.hq, movedAt: s.hq.movedAt - ms } : s.hq,
    job: s.job ? { ...s.job, nextAt: s.job.nextAt - ms } : s.job,
    suppliers: Object.fromEntries(
      Object.entries(s.suppliers).map(([id, sp]) => [id, sp.order ? { ...sp, order: { ...sp.order, readyAt: sp.order.readyAt - ms } } : sp]),
    ),
    carriers: s.carriers.map((c) => ({
      ...c,
      freeAt: c.freeAt - ms,
      trip: c.trip ? { ...c.trip, arriveAt: c.trip.arriveAt - ms } : c.trip,
    })),
  }))
  useBaseStore.getState().sync()
}
