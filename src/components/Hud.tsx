import { Crosshair, Navigation, TriangleAlert } from 'lucide-react'
import type { GpsStatus } from '../types'
import type { Poi } from '../types/poi'
import type { PoiLoadStatus } from '../store/mapStore'
import { POI_KINDS } from '../data/poiKinds'

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
    <div className="absolute inset-x-3 top-[6.25rem] cartoon-card bg-red-500! text-white p-3 flex items-center gap-3 z-10">
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
    <div className="absolute inset-x-3 top-[6.25rem] cartoon-card p-3 z-10">
      <p className="font-black">{STATUS_TEXT[status]}</p>
      <p className="text-sm font-bold mb-2">Activa la ubicación del navegador o usa el modo simulación.</p>
      <button className="cartoon-btn px-3 py-1.5" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

interface BottomProps {
  follow: boolean
  onToggleFollow: () => void
}

export function BottomButtons({ follow, onToggleFollow }: BottomProps) {
  return (
    <div className="absolute right-3 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
      <button
        className={`cartoon-btn w-14 h-14 flex items-center justify-center ${follow ? '' : 'bg-white!'}`}
        onClick={onToggleFollow}
        aria-label="Seguir al jugador"
      >
        <Crosshair />
      </button>
    </div>
  )
}

interface PoiStatusProps {
  status: PoiLoadStatus
  count: number
  onRetry: () => void
}

export function PoiStatus({ status, count, onRetry }: PoiStatusProps) {
  if (status === 'idle' || status === 'ready') return null
  return (
    <div className="absolute left-3 top-[6.25rem] cartoon-card px-3 py-1.5 text-xs font-black flex items-center gap-2">
      {status === 'loading' ? (
        <>Explorando el barrio… ({count})</>
      ) : (
        <>
          Sin conexión con el mapa de la calle
          <button className="cartoon-btn px-2 py-0.5" onClick={onRetry}>
            Reintentar
          </button>
        </>
      )}
    </div>
  )
}

export function NearbyPois({ pois, onSelect }: { pois: Poi[]; onSelect: (p: Poi) => void }) {
  if (pois.length === 0) return null
  return (
    <div className="absolute inset-x-3 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] mx-auto max-w-sm cartoon-card p-2 flex flex-col gap-1">
      {pois.slice(0, 3).map((p) => (
        <button key={p.id} className="flex items-center gap-2 text-sm font-black text-left" onClick={() => onSelect(p)}>
          <span className="w-4 h-4 rounded-full border-2 border-black shrink-0" style={{ background: POI_KINDS[p.kind].color }} />
          <span className="truncate">{p.name ?? POI_KINDS[p.kind].label}</span>
          <span className="ml-auto text-xs font-bold opacity-70 shrink-0">{POI_KINDS[p.kind].label}</span>
        </button>
      ))}
    </div>
  )
}
