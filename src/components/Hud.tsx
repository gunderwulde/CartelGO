import {
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudOff,
  Crosshair,
  GraduationCap,
  House,
  RefreshCw,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAccountStore } from "../store/accountStore";
import { useBaseStore } from "../store/baseStore";
import { tutorialPending, useTutorialStore } from "../store/tutorialStore";
import { backendEnabled } from "../services/supabaseClient";
import type { GpsStatus } from "../types";
import type { PoiLoadStatus } from "../store/mapStore";
import { setMuted, useMuted } from "../services/sound";

const STATUS_TEXT: Record<GpsStatus, string> = {
  idle: "GPS apagado",
  requesting: "Buscando señal GPS…",
  active: "GPS activo",
  denied: "Permiso de GPS denegado",
  unavailable: "GPS no disponible",
  error: "Error de GPS",
};

export function DrivingWarning() {
  return (
    <div className="absolute inset-x-3 top-[3.25rem] cartoon-card bg-red-500! text-white p-3 flex items-center gap-3 z-10">
      <TriangleAlert size={32} className="shrink-0" />
      <div>
        <p className="font-black text-lg leading-tight">¡Modo Conducción!</p>
        <p className="text-sm font-bold">
          No juegues al volante. Calle bloqueada hasta que vayas a pie.
        </p>
      </div>
    </div>
  );
}

export function GpsBlocker({
  status,
  onRetry,
}: {
  status: GpsStatus;
  onRetry: () => void;
}) {
  if (status === "active" || status === "requesting" || status === "idle")
    return null;
  return (
    <div className="absolute inset-x-3 top-[3.25rem] cartoon-card p-3 z-10">
      <p className="font-black">{STATUS_TEXT[status]}</p>
      <p className="text-sm font-bold mb-2">
        Activa la ubicación del navegador o usa el modo simulación.
      </p>
      <button className="cartoon-btn px-3 py-1.5" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

/** Oculto de momento: el correo de Supabase aún manda enlace en vez de código (ver PLAN.md, Sprint 6) */
const ACCOUNT_BUTTON_VISIBLE = false;

interface BottomProps {
  follow: boolean;
  onToggleFollow: () => void;
  onHq: () => void;
  onAccount: () => void;
  onClearPois: () => void;
}

export function BottomButtons({
  follow,
  onToggleFollow,
  onHq,
  onAccount,
  onClearPois,
}: BottomProps) {
  const muted = useMuted();
  const pending = useTutorialStore(tutorialPending);
  const tutorialOpen = useTutorialStore((s) => s.open);
  const hasHq = useBaseStore((s) => s.hq !== null);
  const showTutorialBtn = hasHq && pending && !tutorialOpen;
  const auth = useAccountStore((s) => s.auth);
  const sync = useAccountStore((s) => s.sync);
  const CloudIcon =
    auth !== "in"
      ? Cloud
      : sync === "ok"
        ? CloudCheck
        : sync === "error"
          ? CloudAlert
          : sync === "offline"
            ? CloudOff
            : Cloud;
  return (
    <>
      <div className="absolute right-3 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
        {ACCOUNT_BUTTON_VISIBLE && backendEnabled && (
          <button
            className="cartoon-btn w-14 h-14 flex items-center justify-center bg-white!"
            onClick={onAccount}
            aria-label="Partida en la nube"
          >
            <CloudIcon />
          </button>
        )}
        <button
          className="cartoon-btn w-14 h-14 flex items-center justify-center"
          onClick={onHq}
          aria-label="Centrar en el Cuartel General"
        >
          <House />
        </button>
        <button
          className={`cartoon-btn w-14 h-14 flex items-center justify-center ${follow ? "" : "bg-white!"}`}
          onClick={onToggleFollow}
          aria-label="Seguir al jugador"
        >
          <Crosshair />
        </button>
      </div>
      {showTutorialBtn && (
        // En fixed y con z alto: queda por encima de los paneles (HQ, comercio). Se oculta mientras se ve la tarjeta
        <button
          className="cartoon-btn w-11 h-11 flex items-center justify-center tutorial-blink fixed right-3 top-[4rem] z-[46]"
          onClick={() => useTutorialStore.getState().show()}
          aria-label="Ver el siguiente paso del tutorial"
        >
          <GraduationCap />
        </button>
      )}
      <div
        className={`absolute right-3 flex flex-col gap-2 ${hasHq && pending ? "top-[7.5rem]" : "top-[4rem]"}`}
      >
        <button
          className="cartoon-btn w-11 h-11 flex items-center justify-center bg-white!"
          onClick={onClearPois}
          aria-label="Borrar la caché de lugares"
        >
          <RefreshCw />
        </button>
        <button
          className="cartoon-btn w-11 h-11 flex items-center justify-center bg-white!"
          onClick={() => setMuted(!muted)}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>
    </>
  );
}

interface PoiStatusProps {
  status: PoiLoadStatus;
  count: number;
  onRetry: () => void;
}

export function PoiStatus({ status, count, onRetry }: PoiStatusProps) {
  if (status === "idle" || status === "ready") return null;
  return (
    <div className="absolute left-3 top-[3.25rem] cartoon-card px-3 py-1.5 text-xs font-black flex items-center gap-2">
      {status === "loading" ? (
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
  );
}

export function PlaceHqBanner({ onPlace }: { onPlace: () => void }) {
  return (
    <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] mr-20 cartoon-card p-3 z-10">
      <p className="font-black leading-tight">
        Elige dónde montar tu Cuartel General
      </p>
      <p className="text-xs font-bold mb-2">
        Se coloca donde estás ahora. Su posición exacta solo se guarda en tu
        móvil y puedes moverlo gratis cada 7 días.
      </p>
      <button className="cartoon-btn px-3 py-2 text-sm" onClick={onPlace}>
        Colocar HQ aquí
      </button>
    </div>
  );
}
