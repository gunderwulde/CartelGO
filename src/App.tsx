import { useEffect, useMemo, useState } from 'react'
import GameMap from './map/GameMap'
import { usePlayerStore } from './store/playerStore'
import { useMapStore } from './store/mapStore'
import { useGps } from './services/useGps'
import { usePois } from './services/usePois'
import { useHeat } from './services/useHeat'
import { useSimulation } from './services/useSimulation'
import { haversine, INTERACTION_RADIUS_M } from './services/geoService'
import { StatsBar, Toast } from './components/Stats'
import TradeModal from './components/TradeModal'
import { BottomButtons, DrivingWarning, GpsBlocker, NearbyPois, PoiStatus, TopBar } from './components/Hud'

/** Herramienta de desarrollo: abrir con ?sim para mover el avatar sin GPS. */
const DEV_SIM = new URLSearchParams(window.location.search).has('sim')

export default function App() {
  const [started, setStarted] = useState(DEV_SIM)
  const [follow, setFollow] = useState(true)
  const [retry, setRetry] = useState(0)
  const [poiRetry, setPoiRetry] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const status = usePlayerStore((s) => s.gpsStatus)
  const speed = usePlayerStore((s) => s.speed)
  const driving = usePlayerStore((s) => s.driving)
  const simulation = usePlayerStore((s) => s.simulation)
  const position = usePlayerStore((s) => s.position)
  const pois = useMapStore((s) => s.pois)
  const poiStatus = useMapStore((s) => s.status)

  useEffect(() => {
    if (DEV_SIM) usePlayerStore.getState().setSimulation(true)
  }, [])

  useGps(started, retry)
  usePois(started, poiRetry)
  useHeat(started)
  useSimulation(started && simulation)

  const nearby = useMemo(() => {
    if (!position) return []
    return Object.values(pois)
      .map((p) => ({ p, d: haversine(position, p) }))
      .filter((x) => x.d <= INTERACTION_RADIUS_M)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.p)
  }, [position, pois])

  const selected = nearby.find((p) => p.id === selectedId) ?? null

  if (!started) {
    return (
      <main className="relative h-full flex flex-col items-center justify-center gap-6 bg-yellow-400 p-6 text-center">
        <h1 className="text-5xl font-black border-4 border-black bg-white px-6 py-4 shadow-[6px_6px_0_#000] -rotate-2">
          Cartel GO
        </h1>
        <p className="font-bold max-w-xs">
          Juego ficticio y satírico. Necesita tu ubicación. Mira por dónde andas y nunca juegues al volante.
        </p>
        <button className="cartoon-btn px-8 py-4 text-2xl" onClick={() => setStarted(true)}>
          ¡A la calle!
        </button>
        <p className="text-xs font-bold opacity-70">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
      </main>
    )
  }

  return (
    <div className="relative h-full w-full">
      <GameMap follow={follow} />
      <TopBar status={status} speed={speed} simulation={simulation} />
      <PoiStatus status={poiStatus} count={Object.keys(pois).length} onRetry={() => setPoiRetry((n) => n + 1)} />
      {driving && <DrivingWarning />}
      {!simulation && <GpsBlocker status={status} onRetry={() => setRetry((n) => n + 1)} />}
      <StatsBar />
      {!selected && <NearbyPois pois={nearby} onSelect={(p) => setSelectedId(p.id)} />}
      {selected && <TradeModal poi={selected} blocked={driving} onClose={() => setSelectedId(null)} />}
      <Toast />
      <BottomButtons follow={follow} onToggleFollow={() => setFollow((f) => !f)} />
    </div>
  )
}
