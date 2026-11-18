import { useBaseStore } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useTutorialStore } from '../store/tutorialStore'

/** Empieza una partida nueva en este dispositivo (inventario, base, favores y tutorial). No toca la caché de lugares. */
export function resetGame(): void {
  const now = Date.now()
  useBaseStore.setState({ ...useBaseStore.getInitialState(), dealersAt: now, launderAt: now }, true)
  useInventoryStore.setState(useInventoryStore.getInitialState(), true)
  useTutorialStore.getState().restart()
}
