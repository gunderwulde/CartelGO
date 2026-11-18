import { useEffect, useRef } from "react";
import { money } from "../services/money";
import { Clapperboard } from "lucide-react";
import {
  AD_DURATION_MS,
  AD_FAVOR_REWARD,
  AD_RESCUE_REWARD,
  canOfferAd,
} from "../services/adRescue";
import { handleResult } from "../services/feedback";
import { useNow } from "../services/useIdle";
import { useAdStore, type AdKind } from "../store/adStore";
import { useBaseStore } from "../store/baseStore";
import { useConfirmStore } from "../store/confirmStore";
import { useInventoryStore } from "../store/inventoryStore";

/**
 * Rescate por anuncio: botón (y propuesta automática) cuando te quedas sin dinero.
 * El anuncio es un hueco de prueba que bloquea la pantalla ~20 s; después paga.
 */
export default function AdRescue() {
  const dirty = useInventoryStore((s) => s.dirtyCash);
  const clean = useInventoryStore((s) => s.cleanCash);
  const adAt = useBaseStore((s) => s.adAt);
  const now = useNow(1000);
  const current = useAdStore((s) => s.current);
  const offered = canOfferAd(dirty, clean, adAt, now);

  const start = (): void => useAdStore.getState().start("rescue");

  const propose = (): void =>
    useConfirmStore
      .getState()
      .ask(
        `Estás sin blanca. ¿Quieres ver un anuncio de nuestro patrocinador y llevarte ${money(AD_RESCUE_REWARD, "dirty")}?`,
        start,
        {
          yes: "Ver anuncio",
          no: "No, gracias",
        },
      );

  // Propuesta automática una vez cada vez que se entra en situación de rescate
  const wasOffered = useRef(false);
  useEffect(() => {
    if (offered && !wasOffered.current && current === null) propose();
    wasOffered.current = offered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offered]);

  if (current !== null)
    return (
      <AdScreen
        kind={current.kind}
        startedAt={current.startedAt}
        onDone={() => useAdStore.getState().end()}
      />
    );
  if (!offered) return null;
  return (
    <button
      className="cartoon-btn absolute left-3 bottom-[max(1rem,env(safe-area-inset-bottom))] px-3 h-14 flex items-center gap-2 text-sm"
      onClick={propose}
    >
      <Clapperboard size={20} />
      <span>¿Sin blanca? +{money(AD_RESCUE_REWARD, "dirty")}</span>
    </button>
  );
}

function AdScreen({
  kind,
  startedAt,
  onDone,
}: {
  kind: AdKind;
  startedAt: number;
  onDone: () => void;
}) {
  const now = useNow(250);
  const left = Math.max(0, AD_DURATION_MS - (now - startedAt));
  const finished = left === 0;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="cartoon-card bg-white! w-full max-w-sm p-4 flex flex-col gap-4 items-center text-center">
        <p className="text-xs font-black uppercase tracking-widest opacity-60">
          Publicidad
        </p>
        <div className="w-full aspect-video border-4 border-black bg-gray-200 flex items-center justify-center text-4xl font-black">
          AD HERE
        </div>
        <div className="w-full h-4 border-4 border-black bg-white">
          <div
            className="h-full bg-green-400"
            style={{
              width: `${((AD_DURATION_MS - left) / AD_DURATION_MS) * 100}%`,
            }}
          />
        </div>
        {finished ? (
          <button
            className="cartoon-btn w-full py-3 text-lg"
            onClick={() => {
              const base = useBaseStore.getState();
              handleResult(
                kind === "favor" ? base.claimFavorAd() : base.claimAdReward(),
                "done",
              );
              onDone();
            }}
          >
            {kind === "favor"
              ? `Cobrar ${AD_FAVOR_REWARD} favor`
              : `Cobrar ${money(AD_RESCUE_REWARD, "dirty")}`}
          </button>
        ) : (
          <p className="font-black">
            Tu recompensa llega en {Math.ceil(left / 1000)} s…
          </p>
        )}
      </div>
    </div>
  );
}
