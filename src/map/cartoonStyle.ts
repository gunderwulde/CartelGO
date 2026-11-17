import type { Map as MlMap } from 'maplibre-gl'

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

const PALETTE = {
  water: '#38bdf8',
  waterLine: '#0284c7',
  park: '#86efac',
  wood: '#4ade80',
  land: '#fef3c7',
  building: '#fcd9a8',
  road: '#ffffff',
  roadCasing: '#111111',
  label: '#111111',
  labelHalo: '#fde047',
}

/** Recolorea el estilo base a una paleta cartoon saturada con trazos negros. */
export function applyCartoonStyle(map: MlMap): void {
  const layers = map.getStyle().layers ?? []
  const trySet = (fn: () => void): void => {
    try {
      fn()
    } catch {
      /* la capa no admite esa propiedad: se ignora */
    }
  }
  for (const l of layers) {
    const id = l.id.toLowerCase()
    if (l.type === 'background') {
      trySet(() => map.setPaintProperty(l.id, 'background-color', PALETTE.land))
    } else if (l.type === 'fill') {
      if (id.includes('water')) {
        trySet(() => map.setPaintProperty(l.id, 'fill-color', PALETTE.water))
      } else if (id.includes('wood')) {
        trySet(() => map.setPaintProperty(l.id, 'fill-color', PALETTE.wood))
      } else if (id.includes('park') || id.includes('grass') || id.includes('landcover')) {
        trySet(() => map.setPaintProperty(l.id, 'fill-color', PALETTE.park))
      } else if (id.includes('building')) {
        trySet(() => {
          map.setPaintProperty(l.id, 'fill-color', PALETTE.building)
          map.setPaintProperty(l.id, 'fill-outline-color', '#111111')
        })
      }
    } else if (l.type === 'line') {
      if (id.includes('water')) {
        trySet(() => map.setPaintProperty(l.id, 'line-color', PALETTE.waterLine))
      } else if (id.includes('casing')) {
        trySet(() => map.setPaintProperty(l.id, 'line-color', PALETTE.roadCasing))
      } else if (id.includes('road') || id.includes('highway') || id.includes('bridge') || id.includes('tunnel') || id.includes('path')) {
        trySet(() => map.setPaintProperty(l.id, 'line-color', PALETTE.road))
      }
    } else if (l.type === 'symbol' && id.startsWith('poi')) {
      trySet(() => map.setLayoutProperty(l.id, 'visibility', 'none'))
    } else if (l.type === 'symbol') {
      trySet(() => {
        map.setPaintProperty(l.id, 'text-color', PALETTE.label)
        map.setPaintProperty(l.id, 'text-halo-color', PALETTE.labelHalo)
        map.setPaintProperty(l.id, 'text-halo-width', 2)
      })
    }
  }
}
