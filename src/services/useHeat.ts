import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useMapStore } from '../store/mapStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useBaseStore } from '../store/baseStore'
import { RAID_SEIZE_SHARE } from '../data/balance'
import { haversine } from './geoService'
import { isBusted, nextHeat } from './heatEngine'
import { POLICE_INFLUENCE_RADIUS_M } from '../data/poiKinds'

/** Máximo de segundos que cuenta una lectura (evita saltos si la app estuvo en segundo plano). */
const MAX_DT_S = 5

/** Actualiza el Heat según la cercanía a comisarías. Redada al llegar a 100. */
export function useHeat(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let last = Date.now()

    return usePlayerStore.subscribe((s, prev) => {
      if (s.position === prev.position || !s.position) return
      const now = Date.now()
      const dt = Math.min(MAX_DT_S, (now - last) / 1000)
      last = now

      const pos = s.position
      const inZone = Object.values(useMapStore.getState().pois).some(
        (p) => p.kind === 'police' && haversine(pos, p) <= POLICE_INFLUENCE_RADIUS_M,
      )
      const store = useInventoryStore.getState()
      const heat = nextHeat(store.heat, inZone, dt)
      if (isBusted(heat)) {
        const seized = useBaseStore.getState().seizeStock(RAID_SEIZE_SHARE)
        store.raid(
          seized > 0
            ? `¡Redada! La policía se ha llevado ${seized} unidades de tu almacén.`
            : '¡Redada! Por suerte no había nada que llevarse.',
        )
      }
      else if (heat !== store.heat) store.setHeat(heat)
    })
  }, [enabled])
}
