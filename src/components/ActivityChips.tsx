import { FlaskConical, Package, Truck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { batchDurationMs } from "../services/idleEngine";
import { fmtTime } from "../services/fmt";
import { useNow } from "../services/useIdle";
import { useBaseStore } from "../store/baseStore";
import type { Tab } from "./HqPanel";

interface Chip {
  key: string;
  tab: Tab;
  icon: ReactNode;
  label: string;
  value: string;
}

/** Qué está pasando ahora mismo, a la vista y sin abrir nada: lote en curso, pedido preparándose, viaje en marcha, camellos. */
function useChips(): Chip[] {
  const now = useNow(1000);
  const job = useBaseStore((s) => s.job);
  const labLevel = useBaseStore((s) => s.labLevel);
  const suppliers = useBaseStore((s) => s.suppliers);
  const carriers = useBaseStore((s) => s.carriers);
  const dealers = useBaseStore((s) => s.dealers);
  const chips: Chip[] = [];

  if (job) {
    const left =
      job.nextAt -
      now +
      (job.remaining - 1) * batchDurationMs(job.recipe, labLevel);
    chips.push({
      key: "lab",
      tab: "lab",
      icon: <FlaskConical size={16} />,
      label: `Lab · ${job.remaining} lote(s)`,
      value: fmtTime(left),
    });
  }
  const orders = Object.values(suppliers).filter((s) => s.order);
  if (orders.length > 0) {
    const soonest = Math.min(...orders.map((s) => s.order!.readyAt));
    chips.push({
      key: "orders",
      tab: "suministro",
      icon: <Package size={16} />,
      label: soonest > now ? `Pedido (${orders.length})` : "Pedido listo",
      value: soonest > now ? fmtTime(soonest - now) : "esperando",
    });
  }
  const trips = carriers.filter((c) => c.trip);
  if (trips.length > 0) {
    const soonest = Math.min(...trips.map((c) => c.trip!.arriveAt));
    chips.push({
      key: "trips",
      tab: "suministro",
      icon: <Truck size={16} />,
      label: `En camino (${trips.length})`,
      value: fmtTime(soonest - now),
    });
  }
  if (dealers.length > 0) {
    chips.push({
      key: "dealers",
      tab: "camellos",
      icon: <Users size={16} />,
      label: `Camellos`,
      value: String(dealers.length),
    });
  }
  return chips;
}

/** Columna de chips sobre el mapa. Tocar uno abre la pestaña del HQ que le corresponde */
export function ActivityChips({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const chips = useChips();
  const hasHq = useBaseStore((s) => s.hq !== null);
  if (!hasHq || chips.length === 0) return null;
  return (
    <div className="absolute left-3 top-[8.5rem] flex flex-col gap-2 z-[5]">
      {chips.map((c) => (
        <button
          key={c.key}
          className="cartoon-btn bg-white! flex items-center gap-2 px-2 py-1 text-left"
          onClick={() => onOpen(c.tab)}
          aria-label={`${c.label}: ${c.value}. Abrir en el HQ`}
        >
          {c.icon}
          <span className="leading-tight">
            <span className="block text-xs font-bold opacity-70">
              {c.label}
            </span>
            <span className="num block text-sm font-black">{c.value}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Versión en fila para la cabecera del HQ: visible en todas las pestañas */
export function ActivityStrip({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const chips = useChips();
  if (chips.length === 0) return null;
  return (
    <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
      {chips.map((c) => (
        <button
          key={c.key}
          className="cartoon-btn bg-white! shrink-0 flex items-center gap-1.5 px-2 py-1 text-xs"
          onClick={() => onOpen(c.tab)}
        >
          {c.icon}
          <span className="font-bold">{c.label}</span>
          <span className="num font-black">{c.value}</span>
        </button>
      ))}
    </div>
  );
}
