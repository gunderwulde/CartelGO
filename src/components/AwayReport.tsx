import {
  Banknote,
  FlaskConical,
  Package,
  ShoppingBag,
  Siren,
} from "lucide-react";
import type { ReactNode } from "react";
import { fmtTime } from "../services/fmt";
import { play } from "../services/sound";
import { useAwayStore } from "../store/awayStore";

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-bold">{children}</span>
    </li>
  );
}

/** Resumen de «mientras no estabas»: cierra la sesión con un balance y una razón para volver */
export default function AwayReport() {
  const r = useAwayStore((s) => s.report);
  const close = useAwayStore((s) => s.close);
  if (!r) return null;
  return (
    <div
      className="fixed inset-0 z-[48] bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mientras no estabas"
    >
      <div className="cartoon-card bg-yellow-300! w-full max-w-sm p-4 flex flex-col gap-4">
        <div>
          <p className="text-2xl font-black leading-tight">¡Has vuelto!</p>
          <p className="text-xs font-bold opacity-70">
            Has estado fuera {fmtTime(r.awayMs)}. Tu imperio no ha parado.
          </p>
        </div>
        <ul className="flex flex-col gap-2 bg-white border-4 border-black p-3">
          {r.dirty > 0 && (
            <Line icon={<Banknote size={20} />}>
              <span className="num font-black">+${r.dirty}</span> sucios
            </Line>
          )}
          {r.clean > 0 && (
            <Line icon={<Banknote size={20} />}>
              <span className="num font-black">+${r.clean}</span> limpios
            </Line>
          )}
          {r.sales > 0 && (
            <Line icon={<ShoppingBag size={20} />}>
              Tus camellos vendieron{" "}
              <span className="num font-black">{r.sales}</span> uds
            </Line>
          )}
          {r.batches > 0 && (
            <Line icon={<FlaskConical size={20} />}>
              <span className="num font-black">{r.batches}</span> lote(s)
              cocinado(s)
            </Line>
          )}
          {r.deliveries > 0 && (
            <Line icon={<Package size={20} />}>
              <span className="num font-black">{r.deliveries}</span> entrega(s)
              en el almacén
            </Line>
          )}
          {r.incidents > 0 && (
            <Line icon={<Siren size={20} className="text-red-600" />}>
              <span className="text-red-700 font-black">
                {r.incidents} incidente(s)
              </span>
              {r.stolen > 0 ? `: te han quitado $${r.stolen}` : ""}. Mira el
              informe del HQ.
            </Line>
          )}
        </ul>
        <button
          className="cartoon-btn py-2 text-lg"
          onClick={() => {
            play("level");
            close();
          }}
        >
          ¡A la calle!
        </button>
      </div>
    </div>
  );
}
