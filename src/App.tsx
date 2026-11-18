import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Onboarding from "./components/Onboarding";
import { unlockAudio } from "./services/sound";
import { usePlayerStore } from "./store/playerStore";
import { useMapStore } from "./store/mapStore";
import { useInventoryStore } from "./store/inventoryStore";
import { useGps } from "./services/useGps";
import { usePois } from "./services/usePois";
import { clearPoiCache } from "./services/osmService";
import { useIdle } from "./services/useIdle";
import { useBaseStore } from "./store/baseStore";
import HqPanel from "./components/HqPanel";
import AccountPanel, { CloudConflict } from "./components/AccountPanel";
import { useAccountStore } from "./store/accountStore";
import { useCloudSync } from "./services/useCloudSync";
import ConfirmDialog from "./components/ConfirmDialog";
import AdRescue from "./components/AdRescue";
import Tutorial, { type GoTarget } from "./components/Tutorial";
import type { Tab } from "./components/HqPanel";
import DevPanel from "./components/DevPanel";
import Celebration from "./components/Celebration";
import AwayReport from "./components/AwayReport";
import { ActivityChips } from "./components/ActivityChips";
import { resetGame } from "./services/resetGame";
import { DEV_TOOLS } from "./services/devTools";
import { useConfirmStore } from "./store/confirmStore";
import { useHeat } from "./services/useHeat";
import { useSimulation } from "./services/useSimulation";
import { haversine, INTERACTION_RADIUS_M } from "./services/geoService";
import { StatsBar, Toast } from "./components/Stats";
import TradeModal from "./components/TradeModal";
import {
  BottomButtons,
  DrivingWarning,
  GpsBlocker,
  PlaceHqBanner,
  PoiStatus,
  TopBar,
} from "./components/Hud";

// MapLibre pesa ~1 MB: no se descarga hasta que se empieza a jugar
const GameMap = lazy(() => import("./map/GameMap"));

const ONBOARDED_KEY = "cartelgo:onboarded";
const wasOnboarded = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
};

/** Herramienta de desarrollo: abrir con ?sim para mover el avatar sin GPS. */
const DEV_SIM = new URLSearchParams(window.location.search).has("sim");

export default function App() {
  const [started, setStarted] = useState(DEV_SIM);
  const [onboarded, setOnboarded] = useState(wasOnboarded);
  const [follow, setFollow] = useState(true);
  const [retry, setRetry] = useState(0);
  const [poiRetry, setPoiRetry] = useState(0);
  const [hqOpen, setHqOpen] = useState(false);
  const [hqTab, setHqTab] = useState<{ tab: Tab; n: number }>({
    tab: "almacen",
    n: 0,
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const conflict = useAccountStore((s) => s.conflict);
  const hq = useBaseStore((s) => s.hq);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const status = usePlayerStore((s) => s.gpsStatus);
  const speed = usePlayerStore((s) => s.speed);
  const driving = usePlayerStore((s) => s.driving);
  const simulation = usePlayerStore((s) => s.simulation);
  const position = usePlayerStore((s) => s.position);
  const pois = useMapStore((s) => s.pois);
  const poiStatus = useMapStore((s) => s.status);

  useEffect(() => {
    if (DEV_SIM) usePlayerStore.getState().setSimulation(true);
  }, []);

  useGps(started, retry);
  usePois(started, poiRetry);

  /** Abre el panel del HQ (al tocar su icono en el mapa) */
  const openHq = (): void => {
    setSelectedId(null);
    setHqOpen(true);
  };

  /** Botón del HQ: solo centra la vista sobre él con una animación suave (el panel se abre tocando su icono en el mapa) */
  const centerOnHq = (): void => {
    const hq = useBaseStore.getState().hq;
    if (!hq) return;
    setFollow(false);
    useMapStore.getState().focusOn(hq.lat, hq.lng);
  };

  /** Botón «Ir» del tutorial: abre la pestaña del HQ o centra el mapa en el lugar más cercano del tipo pedido */
  const goTo = (target: GoTarget): void => {
    if (target.type === "hq") {
      setSelectedId(null);
      setHqTab((h) => ({ tab: target.tab, n: h.n + 1 }));
      setHqOpen(true);
      return;
    }
    const here = usePlayerStore.getState().position;
    const candidates = Object.values(useMapStore.getState().pois).filter((p) =>
      target.kinds.includes(p.kind),
    );
    if (candidates.length === 0) {
      useInventoryStore
        .getState()
        .setNotice(
          "No hay ninguno cargado cerca. Muévete un poco o pulsa recargar lugares.",
        );
      return;
    }
    const nearest = here
      ? candidates.reduce((a, b) =>
          haversine(here, b) < haversine(here, a) ? b : a,
        )
      : candidates[0];
    setHqOpen(false);
    setSelectedId(null);
    setFollow(false);
    useMapStore.getState().focusOn(nearest.lat, nearest.lng);
    useInventoryStore
      .getState()
      .setNotice(
        `Está a ${Math.round(here ? haversine(here, nearest) : 0)} m. Acércate y toca su icono.`,
      );
  };

  const clearCache = (): void => {
    useConfirmStore
      .getState()
      .ask(
        "¿Borrar los lugares guardados en este dispositivo? Se volverán a descargar. Tu partida no se toca.",
        () => {
          void (async () => {
            await clearPoiCache();
            useMapStore.getState().clearPois();
            setSelectedId(null);
            setPoiRetry((n) => n + 1);
            // Para probar el tutorial: ofrece también empezar de cero
            useConfirmStore
              .getState()
              .ask(
                "¿Quieres además empezar una partida nueva? Perderás el progreso de este dispositivo y volverá el tutorial.",
                () => resetGame(),
                { yes: "Partida nueva", no: "Mantener mi partida" },
              );
          })();
        },
      );
  };
  useHeat(started);
  useIdle(started);
  useCloudSync(started);
  useSimulation(started && simulation);

  const nearby = useMemo(() => {
    if (!position) return [];
    return Object.values(pois)
      .map((p) => ({ p, d: haversine(position, p) }))
      .filter((x) => x.d <= INTERACTION_RADIUS_M)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.p);
  }, [position, pois]);

  // Los lugares a menos de 50 m quedan "descubiertos" (se podrá asignarles camellos)
  useEffect(() => {
    if (nearby.length > 0) useBaseStore.getState().markVisited(nearby);
  }, [nearby]);

  const selected = nearby.find((p) => p.id === selectedId) ?? null;

  /** Toque sobre un icono del mapa: abre sus acciones si estás a tiro */
  const onPoiClick = (id: string): void => {
    if (!pois[id]) return;
    if (nearby.some((p) => p.id === id)) {
      setHqOpen(false);
      setSelectedId(id);
    } else
      useInventoryStore
        .getState()
        .setNotice(
          `Acércate a ese sitio (a menos de ${INTERACTION_RADIUS_M} m).`,
        );
  };

  if (!started) {
    return (
      <main className="relative h-full flex flex-col items-center justify-center gap-6 bg-yellow-400 p-6 text-center">
        <h1 className="text-5xl font-black border-4 border-black bg-white px-6 py-4 shadow-[6px_6px_0_#000] -rotate-2">
          Cartel GO
        </h1>
        {onboarded ? (
          <>
            <p className="font-bold max-w-xs">
              Juego ficticio y satírico. Mira por dónde andas y nunca juegues al
              volante.
            </p>
            <button
              className="cartoon-btn px-8 py-4 text-2xl"
              onClick={() => {
                unlockAudio();
                setStarted(true);
              }}
            >
              ¡A la calle!
            </button>
          </>
        ) : (
          <Onboarding
            onDone={() => {
              try {
                localStorage.setItem(ONBOARDED_KEY, "1");
              } catch {
                /* sin almacenamiento: se mostrará de nuevo */
              }
              unlockAudio();
              setOnboarded(true);
              setStarted(true);
            }}
          />
        )}
        <p className="text-xs font-bold opacity-70">
          v{__APP_VERSION__} · {__BUILD_DATE__}
        </p>
      </main>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Suspense fallback={null}>
        <GameMap
          follow={follow}
          onPoiClick={onPoiClick}
          onUserMove={() => setFollow(false)}
          onHqClick={openHq}
          onMapClick={() => {
            setSelectedId(null);
            setHqOpen(false);
          }}
        />
      </Suspense>
      <TopBar status={status} speed={speed} simulation={simulation} />
      <PoiStatus
        status={poiStatus}
        count={Object.keys(pois).length}
        onRetry={() => setPoiRetry((n) => n + 1)}
      />
      {driving && <DrivingWarning />}
      {!simulation && (
        <GpsBlocker status={status} onRetry={() => setRetry((n) => n + 1)} />
      )}
      <StatsBar />
      <ActivityChips onOpen={(tab) => goTo({ type: "hq", tab })} />
      {!hq && position && !selected && (
        <PlaceHqBanner
          onPlace={() => {
            const r = useBaseStore.getState().placeHq(position);
            useInventoryStore.getState().setNotice(r.ok ? r.message : r.reason);
          }}
        />
      )}
      {selected && (
        <TradeModal
          poi={selected}
          blocked={driving}
          onClose={() => setSelectedId(null)}
        />
      )}
      <Toast />
      <BottomButtons
        follow={follow}
        onToggleFollow={() => {
          // Centra la vista sobre el jugador con una animación suave y vuelve a seguirlo
          if (position)
            useMapStore.getState().focusOn(position.lat, position.lng);
          setFollow(true);
        }}
        onHq={centerOnHq}
        onAccount={() => setAccountOpen((o) => !o)}
        onClearPois={clearCache}
      />
      {hqOpen && (
        <HqPanel
          key={hqTab.n}
          initialTab={hqTab.tab}
          onGo={goTo}
          onClose={() => setHqOpen(false)}
        />
      )}
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
      {conflict && <CloudConflict conflict={conflict} />}
      <Tutorial onGo={goTo} />
      {started && <AdRescue />}
      {started && DEV_TOOLS && <DevPanel />}
      <Celebration />
      <AwayReport />
      <ConfirmDialog />
    </div>
  );
}
