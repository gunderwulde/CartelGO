import { useSyncExternalStore } from 'react'

export type Sfx = 'tap' | 'buy' | 'sell' | 'error' | 'raid' | 'level' | 'done'

const MUTE_KEY = 'cartelgo:muted'
let ctx: AudioContext | null = null
const listeners = new Set<() => void>()

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}
let muted = readMuted()

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    /* sin almacenamiento: el silencio dura la sesión */
  }
  listeners.forEach((l) => l())
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => muted,
  )
}

/** Los navegadores solo permiten audio tras un gesto del usuario: llamar desde un clic. */
export function unlockAudio(): void {
  if (ctx) {
    void ctx.resume()
    return
  }
  const Ctor = window.AudioContext
  if (Ctor) ctx = new Ctor()
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.15): void {
  if (!ctx) return
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Efectos de sonido cartoon sintetizados (sin ficheros que descargar). */
export function play(sfx: Sfx): void {
  if (muted || !ctx) return
  switch (sfx) {
    case 'tap':
      tone(660, 0, 0.06, 'square', 0.08)
      break
    case 'buy':
      tone(520, 0, 0.08, 'square')
      tone(780, 0.08, 0.1, 'square')
      break
    case 'sell':
      tone(988, 0, 0.07, 'square')
      tone(1319, 0.07, 0.2, 'square')
      break
    case 'error':
      tone(160, 0, 0.15, 'sawtooth')
      tone(120, 0.12, 0.2, 'sawtooth')
      break
    case 'raid':
      for (let i = 0; i < 6; i++) tone(i % 2 ? 620 : 840, i * 0.18, 0.18, 'triangle', 0.2)
      break
    case 'level':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14, 'square'))
      break
    case 'done':
      tone(1175, 0, 0.35, 'sine', 0.2)
      tone(1568, 0.12, 0.45, 'sine', 0.15)
      break
  }
}
