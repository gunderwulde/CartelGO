import { useConfirmStore } from '../store/confirmStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useCelebrateStore } from '../store/celebrateStore'
import type { ActionResult } from '../store/baseStore'
import { play, type Sfx } from './sound'

/** Muestra el resultado de una acción; si pide confirmación, abre el aviso del juego y la repite si aceptas. */
export function handleResult(r: ActionResult, sfx: Sfx = 'tap'): void {
  if (!r.ok && r.confirm) {
    const { message, accept } = r.confirm
    play('tap')
    useConfirmStore.getState().ask(message, () => handleResult(accept(), sfx))
    return
  }
  play(r.ok ? sfx : 'error')
  useInventoryStore.getState().setNotice(r.ok ? r.message : r.reason)
  if (r.ok && sfx === 'level') useCelebrateStore.getState().celebrate(r.message)
}
