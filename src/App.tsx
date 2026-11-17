import { useState } from 'react'
import GameMap from './map/GameMap'
import { usePlayerStore } from './store/playerStore'
import { useGps } from './services/useGps'
import { useSimulation } from './services/useSimulation'
import { BottomButtons, DebugPad, DrivingWarning, GpsBlocker, TopBar } from './components/Hud'

export default function App() {
  const [started, setStarted] = useState(false)
  const [follow, setFollow] = useState(true)
  const [turbo, setTurbo] = useState(false)
  const [retry, setRetry] = useState(0)

  const status = usePlayerStore((s) => s.gpsStatus)
  const speed = usePlayerStore((s) => s.speed)
  const driving = usePlayerStore((s) => s.driving)
  const simulation = usePlayerStore((s) => s.simulation)
  const setSimulation = usePlayerStore((s) => s.setSimulation)

  useGps(started, retry)
  const sim = useSimulation(started && simulation, turbo)

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
        <button
          className="cartoon-btn px-4 py-2 text-sm bg-white!"
          onClick={() => {
            setSimulation(true)
            setStarted(true)
          }}
        >
          Probar sin GPS (simulación)
        </button>
        <p className="text-xs font-bold opacity-70">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
      </main>
    )
  }

  return (
    <div className="relative h-full w-full">
      <GameMap follow={follow} />
      <TopBar status={status} speed={speed} simulation={simulation} />
      {driving && <DrivingWarning />}
      {!simulation && <GpsBlocker status={status} onRetry={() => setRetry((n) => n + 1)} />}
      {simulation && <DebugPad sim={sim} turbo={turbo} onTurbo={() => setTurbo((t) => !t)} />}
      <BottomButtons
        simulation={simulation}
        follow={follow}
        onToggleSim={() => {
          setTurbo(false)
          setSimulation(!simulation)
        }}
        onToggleFollow={() => setFollow((f) => !f)}
      />
    </div>
  )
}
