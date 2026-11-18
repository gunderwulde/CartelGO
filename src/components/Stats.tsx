import { useEffect } from "react";
import { Banknote, Handshake, Siren } from "lucide-react";
import { useBaseStore } from "../store/baseStore";
import { useInventoryStore } from "../store/inventoryStore";
import { HEAT_MAX } from "../data/balance";

export function StatsBar() {
  const dirtyCash = useInventoryStore((s) => s.dirtyCash);
  const heat = useInventoryStore((s) => s.heat);
  const favors = useBaseStore((s) => s.favors);
  const pct = Math.round((heat / HEAT_MAX) * 100);
  const color = pct > 66 ? "#ef4444" : pct > 33 ? "#f97316" : "#22c55e";

  return (
    <div className="absolute left-3 right-3 top-[3.75rem] cartoon-card px-3 py-1.5 flex items-center gap-3 text-sm font-black pointer-events-none">
      <span
        className="num flex items-center gap-1 text-lg leading-none"
        aria-label={`Dinero sucio ${dirtyCash}`}
      >
        <Banknote size={18} />${dirtyCash}
      </span>
      <span
        className="num flex items-center gap-1"
        aria-label={`Favores ${favors}`}
      >
        <Handshake size={16} />
        {favors}
      </span>
      <span className="flex items-center gap-1 flex-1">
        <Siren size={16} className="shrink-0" />
        <span className="flex-1 h-3 border-2 border-black bg-white">
          <span
            className="block h-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </span>
      </span>
    </div>
  );
}

/** Mensaje efímero (redadas, errores de compra…). */
export function Toast() {
  const notice = useInventoryStore((s) => s.notice);
  const setNotice = useInventoryStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice, setNotice]);

  if (!notice) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[9rem] z-40 mx-auto max-w-sm cartoon-card bg-yellow-300! p-3 font-black text-center"
    >
      {notice}
    </div>
  );
}
