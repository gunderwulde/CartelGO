import { describe, expect, it } from 'vitest'
import { latLngToCell } from 'h3-js'
import {
  classifyPoi,
  MAX_PER_KIND,
  MIN_SEPARATION_M,
  selectPois,
  tilePointToLatLng,
  tilesForCell,
  TILE_ZOOM,
  type Candidate,
} from './tilePois'
import { haversine } from './geoService'
import type { PoiKind } from '../types/poi'

// `i` va en unidades de ~85 m (0,001° de longitud a esta latitud)
const cand = (id: string, kind: PoiKind, i: number, name: string | null = 'x', rank = 1): Candidate => ({
  poi: { id, kind, name, lat: 40.42, lng: -3.7 + i * 0.001, cell: 'c' },
  rank,
})

describe('selectPois (límite por celda)', () => {
  it('respeta el máximo por tipo', () => {
    const many = Array.from({ length: 80 }, (_, i) => cand(`b${i}`, 'nightlife', i))
    expect(selectPois(many)).toHaveLength(MAX_PER_KIND.nightlife)
  })

  it('descarta los que quedan demasiado juntos del mismo tipo', () => {
    const pile = Array.from({ length: 10 }, (_, i) => cand(`b${i}`, 'nightlife', i * 0.05)) // ~4 m entre sí, 38 m en total
    expect(selectPois(pile)).toHaveLength(1)
  })

  it('los elegidos del mismo tipo respetan la separación mínima', () => {
    const many = Array.from({ length: 40 }, (_, i) => cand(`b${i}`, 'nightlife', i * 0.4))
    const out = selectPois(many)
    for (const a of out) for (const b of out) if (a !== b) expect(haversine(a, b)).toBeGreaterThanOrEqual(MIN_SEPARATION_M)
  })

  it('prefiere los que tienen nombre y los más importantes', () => {
    const out = selectPois([cand('sin', 'pharmacy', 0, null, 1), cand('con', 'pharmacy', 0.1, 'Farmacia Sol', 5)])
    expect(out.map((p) => p.id)).toEqual(['con'])
  })

  it('no depende del orden de entrada (servidor y móvil coinciden)', () => {
    const list = Array.from({ length: 30 }, (_, i) => cand(`b${i}`, 'nightlife', i * 0.5, i % 2 ? 'x' : null, i % 5))
    const a = selectPois(list).map((p) => p.id).sort()
    const b = selectPois([...list].reverse()).map((p) => p.id).sort()
    expect(a).toEqual(b)
  })

  it('cada tipo tiene su propio cupo', () => {
    const mix = [
      ...Array.from({ length: 30 }, (_, i) => cand(`b${i}`, 'nightlife', i)),
      ...Array.from({ length: 30 }, (_, i) => cand(`f${i}`, 'pharmacy', i + 0.5)),
    ]
    const out = selectPois(mix)
    expect(out.filter((p) => p.kind === 'nightlife')).toHaveLength(MAX_PER_KIND.nightlife)
    expect(out.filter((p) => p.kind === 'pharmacy')).toHaveLength(MAX_PER_KIND.pharmacy)
  })
})

describe('classifyPoi', () => {
  it('mapea las clases de OpenMapTiles a roles del juego', () => {
    expect(classifyPoi('police', 'police')).toBe('police')
    expect(classifyPoi('pharmacy', 'pharmacy')).toBe('pharmacy')
    expect(classifyPoi('bar', 'bar')).toBe('nightlife')
    expect(classifyPoi('bar', 'nightclub')).toBe('nightlife')
    expect(classifyPoi('beer', 'pub')).toBe('nightlife')
    expect(classifyPoi('park', 'park')).toBe('park')
    expect(classifyPoi('laundry', 'dry_cleaning')).toBe('cover')
    expect(classifyPoi('shop', 'jewelry')).toBeNull()
  })
})

describe('geometría de teselas', () => {
  it('el centro de la tesela cae en su propio lat/lng', () => {
    const { lat, lng } = tilePointToLatLng(TILE_ZOOM, 8023, 6177, 2048, 2048, 4096)
    expect(lat).toBeCloseTo(40.42, 1)
    expect(lng).toBeCloseTo(-3.70, 1)
  })

  it('las teselas de una celda cubren el centro de la celda', () => {
    const cell = latLngToCell(40.4168, -3.7038, 8)
    const tiles = tilesForCell(cell)
    expect(tiles.length).toBeGreaterThanOrEqual(1)
    expect(tiles.length).toBeLessThanOrEqual(4)
    expect(tiles.some((t) => t.x === 8023 && t.y === 6177)).toBe(true)
  })
})
