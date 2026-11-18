import { describe, expect, it } from 'vitest'
import { latLngToCell } from 'h3-js'
import { classifyPoi, tilePointToLatLng, tilesForCell, TILE_ZOOM } from './tilePois'

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
