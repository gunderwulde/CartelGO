import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'

type Dir = 'up' | 'down' | 'left' | 'right'

const WALK_MS = 1.6 // m/s ≈ 5.8 km/h
const DRIVE_MS = 12 // m/s ≈ 43 km/h (prueba del anti-cheat)
const TICK_MS = 250
const START = { lat: 40.4168, lng: -3.7038 } // Madrid

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

/** Herramienta de desarrollo (?sim): mueve al avatar con flechas/WASD. Mantén Shift para ir en coche. */
export function useSimulation(active: boolean): void {
  const held = useRef(new Set<Dir>())
  const fast = useRef(false)

  useEffect(() => {
    if (!active) {
      held.current.clear()
      return
    }
    const store = usePlayerStore.getState()
    if (!store.position) {
      store.pushFix({ ...START, accuracy: 5, timestamp: Date.now() })
    }

    // Emite una lectura en cada tick, se mueva o no, como haría un GPS real
    const timer = window.setInterval(() => {
      const cur = usePlayerStore.getState().position ?? { ...START, accuracy: 5, timestamp: Date.now() }
      let dx = 0
      let dy = 0
      if (held.current.has('up')) dy += 1
      if (held.current.has('down')) dy -= 1
      if (held.current.has('left')) dx -= 1
      if (held.current.has('right')) dx += 1
      const norm = Math.hypot(dx, dy) || 1
      const dist = (fast.current ? DRIVE_MS : WALK_MS) * (TICK_MS / 1000)
      const mx = (dx / norm) * dist
      const my = (dy / norm) * dist
      usePlayerStore.getState().pushFix({
        lat: cur.lat + my / 111_320,
        lng: cur.lng + mx / (111_320 * Math.cos((cur.lat * Math.PI) / 180)),
        accuracy: 5,
        timestamp: Date.now(),
      })
    }, TICK_MS)

    const down = (e: KeyboardEvent): void => {
      fast.current = e.shiftKey
      const d = KEY_TO_DIR[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (d) {
        held.current.add(d)
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent): void => {
      fast.current = e.shiftKey
      const d = KEY_TO_DIR[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (d) held.current.delete(d)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [active])
}
