import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { LucideIcon } from 'lucide-react'
import type { Map as MlMap } from 'maplibre-gl'
import { POI_KINDS } from '../data/poiKinds'
import type { PoiKind } from '../types/poi'

/** Tamaño de la insignia en píxeles reales (se muestra a la mitad: pixelRatio 2). */
const SIZE = 76
const PIXEL_RATIO = 2

export const iconName = (kind: PoiKind): string => `poi-${kind}`

/** Renderiza un icono de lucide a texto SVG, sin tocar el DOM visible. */
function iconSvg(Icon: LucideIcon, size: number, color: string, strokeWidth: number): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(createElement(Icon, { size, color, strokeWidth })))
  const html = host.innerHTML
  root.unmount()
  return html
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo dibujar el icono'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** Insignia estilo cómic: sombra dura, borde negro grueso, relleno de color e icono blanco con contorno. */
async function drawBadge(kind: PoiKind): Promise<ImageData> {
  const { color, Icon } = POI_KINDS[kind]
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')

  const c = SIZE / 2 - 2
  const r = SIZE / 2 - 8
  const disc = (dx: number, dy: number, radius: number, fill: string): void => {
    ctx.beginPath()
    ctx.arc(c + dx, c + dy, radius, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
  }
  disc(4, 4, r, 'rgba(17,17,17,0.9)') // sombra dura
  disc(0, 0, r, '#111111') // borde
  disc(0, 0, r - 5, color) // relleno
  disc(-r * 0.35, -r * 0.4, r * 0.14, 'rgba(255,255,255,0.45)') // brillo

  const iconSize = Math.round(r * 1.15)
  const [outline, fill] = await Promise.all([
    loadSvg(iconSvg(Icon, iconSize, '#111111', 5)),
    loadSvg(iconSvg(Icon, iconSize, '#ffffff', 2.5)),
  ])
  const x = c - iconSize / 2
  const y = c - iconSize / 2
  ctx.drawImage(outline, x, y, iconSize, iconSize)
  ctx.drawImage(fill, x, y, iconSize, iconSize)
  return ctx.getImageData(0, 0, SIZE, SIZE)
}

/** Registra en el mapa una insignia por cada tipo de lugar. */
export async function registerPoiIcons(map: MlMap): Promise<void> {
  const kinds = Object.keys(POI_KINDS) as PoiKind[]
  await Promise.all(
    kinds.map(async (kind) => {
      const name = iconName(kind)
      if (map.hasImage(name)) return
      const data = await drawBadge(kind)
      if (!map.hasImage(name)) map.addImage(name, data, { pixelRatio: PIXEL_RATIO })
    }),
  )
}
