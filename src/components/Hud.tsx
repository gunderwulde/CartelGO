import { Crosshair, Gamepad2, Navigation, TriangleAlert } from 'lucide-react'
import type { GpsStatus } from '../types'
import type { Dir, SimControls } from '../services/useSimulation'

const STATUS_TEXT: Record<GpsStatus, string> = {
  idle: 'GPS apagado',
  requesting: 'Buscando señal GPS…',
  active: 'GPS activo',
  denied: 'Permiso de GPS denegado',
  unavailable: 'GPS no disponible',
  error: 'Error de GPS',
}

interface TopProps {
  status: GpsStatus
  speed: number
  simulation: boolean
}

export function TopBar({ status, speed, simulation }: TopProps) {
  return (
    <div className="absolute top-0 inset-x-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex justify-between items-start pointer-events-none">
      <div className="cartoon-card px-3 py-1.5 font-black text-sm flex items-center gap-2">
        <Navigation size={16} />
        {simulation ? 'Modo simulación' : STATUS_TEXT[status]}
      </div>
      <div className="cartoon-card px-3 py-1.5 font-black text-sm">{Math.round(speed)} km/h</div>
    </div>
  )
}

export function DrivingWarning() {
  return (
    <div className="absolute inset-x-3 top-16 cartoon-card bg-red-500! text-white p-3 flex items-center gap-3 z-10">
      <TriangleAlert size={32} className="shrink-0" />
      <div>
        <p className="font-black text-lg leading-tight">¡Modo Conducción!</p>
        <p className="text-sm font-bold">No juegues al volante. Calle bloqueada hasta que vayas a pie.</p>
      </div>
    </div>
  )
}

export function GpsBlocker({ status, onRetry }: { status: GpsStatus; onRetry: () => void }) {
  if (status === 'active' || status === 'requesting' || status === 'idle') return null
  return (
    <div className="absolute inset-x-3 top-16 cartoon-card p-3 z-10">
      <p className="font-black">{STATUS_TEXT[status]}</p>
      <p className="text-sm font-bold mb-2">Activa la ubicación del navegador o usa el modo simulación.</p>
      <button className="cartoon-btn px-3 py-1.5" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

interface PadProps {
  sim: SimControls
  turbo: boolean
  onTurbo: () => void
}

function PadBtn({ dir, sim, label }: { dir: Dir; sim: SimControls; label: string }) {
  return (
    <button
      className="cartoon-btn w-14 h-14 text-xl"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        sim.press(dir)
      }}
      onPointerUp={() => sim.release(dir)}
      onPointerCancel={() => sim.release(dir)}
      aria-label={dir}
    >
      {label}
    </button>
  )
}

export function DebugPad({ sim, turbo, onTurbo }: PadProps) {
  return (
    <div className="absolute left-3 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-1">
      <PadBtn dir="up" sim={sim} label="▲" />
      <div className="flex gap-1">
        <PadBtn dir="left" sim={sim} label="◀" />
        <PadBtn dir="down" sim={sim} label="▼" />
        <PadBtn dir="right" sim={sim} label="▶" />
      </div>
      <button
        className={`cartoon-btn px-3 py-1 text-xs mt-1 ${turbo ? 'bg-red-400!' : ''}`}
        onClick={onTurbo}
      >
        Turbo {turbo ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

interface BottomProps {
  simulation: boolean
  follow: boolean
  onToggleSim: () => void
  onToggleFollow: () => void
}

export function BottomButtons({ simulation, follow, onToggleSim, onToggleFollow }: BottomProps) {
  return (
    <div className="absolute right-3 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
      <button
        className={`cartoon-btn w-14 h-14 flex items-center justify-center ${follow ? '' : 'bg-white!'}`}
        onClick={onToggleFollow}
        aria-label="Seguir al jugador"
      >
        <Crosshair />
      </button>
      <button
        className={`cartoon-btn w-14 h-14 flex items-center justify-center ${simulation ? 'bg-green-400!' : 'bg-white!'}`}
        onClick={onToggleSim}
        aria-label="Modo simulación"
      >
        <Gamepad2 />
      </button>
    </div>
  )
}
