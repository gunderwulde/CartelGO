import {
  DEALER_BONUS_COST,
  DEALER_HIRE_COST,
  DEALER_REVEAL_SALES,
  REFUND_SHARE,
} from "../data/buildings";
import { money } from "../services/money";
import { displayName } from "../data/poiNames";
import { POI_KINDS } from "../data/poiKinds";
import { fmtTime } from "../services/fmt";
import { handleResult } from "../services/feedback";
import { honestyOf, type Dealer } from "../services/idleEngine";
import { useNow } from "../services/useIdle";
import { useBaseStore } from "../store/baseStore";

const btn = "cartoon-btn px-3 py-1.5 text-sm disabled:opacity-40";

/** Ficha de un camello: fiabilidad, libro de cuentas y acciones (prima, despedir). `log`: sus últimos sucesos. `bare`: sin caja ni nombre (dentro del panel de su local). */
export function DealerCard({
  dealer: d,
  log = false,
  bare = false,
}: {
  dealer: Dealer;
  log?: boolean;
  bare?: boolean;
}) {
  const now = useNow(1000);
  const bonusDealer = useBaseStore((s) => s.bonusDealer);
  const fireDealer = useBaseStore((s) => s.fireDealer);
  const dealerLog = useBaseStore((s) => s.dealerLog);
  const known = (d.sold ?? 0) >= DEALER_REVEAL_SALES;
  const h = honestyOf(d);
  const events = log
    ? dealerLog.filter((e) => e.dealerId === d.id).slice(0, 5)
    : [];

  return (
    <div
      className={
        bare
          ? "flex flex-col gap-1"
          : "border-4 border-black p-2 flex flex-col gap-1 bg-white"
      }
    >
      <div className="flex items-center gap-2">
        {bare ? (
          <span className="flex-1" />
        ) : (
          <span className="flex-1 font-black truncate">
            {d.name || d.nameId
              ? displayName({ ...d, id: d.poiId })
              : POI_KINDS[d.kind].label}
          </span>
        )}
        <span
          className={`text-xs font-black px-1.5 border-2 border-black ${!known ? "bg-gray-200" : h >= 70 ? "bg-green-300" : h >= 45 ? "bg-yellow-200" : "bg-red-300"}`}
        >
          {known
            ? `Fiabilidad ${h}`
            : `Fiabilidad ? (${d.sold ?? 0}/${DEALER_REVEAL_SALES} ventas)`}
        </span>
      </div>
      <p className="num text-xs font-bold">
        Ventas {d.sold ?? 0} · cobrado {money(d.earned ?? 0, "dirty")} ·
        robado/adulterado {money(d.stolen ?? 0, "dirty")} · adulteró{" "}
        {d.cutUnits ?? 0} veces
      </p>
      <p className="num text-xs font-black">
        Neto {money((d.earned ?? 0) - (d.stolen ?? 0), "dirty")}
      </p>
      <div className="flex gap-2">
        <button
          className={btn}
          disabled={h >= 100}
          onClick={() => handleResult(bonusDealer(d.id), "level")}
        >
          Prima {money(DEALER_BONUS_COST, "dirty")}
        </button>
        <button
          className={`${btn} bg-white!`}
          onClick={() => handleResult(fireDealer(d.id), "tap")}
        >
          Despedir (+
          {money(Math.floor(DEALER_HIRE_COST * REFUND_SHARE), "clean")})
        </button>
      </div>
      {log && (
        <div className="mt-1">
          <p className="text-xs font-black">Últimos sucesos</p>
          {events.length === 0 && (
            <p className="text-xs font-bold opacity-70">
              Sin incidentes. De momento.
            </p>
          )}
          {events.map((e, i) => (
            <p key={i} className="text-xs font-bold">
              • hace {fmtTime(now - e.at)}:{" "}
              {e.kind === "theft"
                ? `te ha birlado ${money(e.amount, "dirty")}`
                : `adulteró el producto (te cuesta ${money(e.amount, "dirty")} y sube el Heat)`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
