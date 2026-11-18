import { money } from "../services/money";
import { displayName } from "../data/poiNames";
import { Users } from "lucide-react";
import { handleResult } from "../services/feedback";
import type { Poi } from "../types/poi";
import { POI_KINDS } from "../data/poiKinds";
import { PoiBadge } from "./PoiBadge";
import { useInventoryStore } from "../store/inventoryStore";
import { useBaseStore } from "../store/baseStore";
import {
  DEALER_HIRE_COST,
  DEALER_SLOTS,
  businessCost,
} from "../data/buildings";
import { play } from "../services/sound";
import { SupplierCard } from "./SupplyCards";
import { DealerCard } from "./DealerCard";
import { EmptyState } from "./EmptyState";
import { Sheet } from "./Sheet";

interface Props {
  poi: Poi;
  blocked: boolean;
  onClose: () => void;
}

export default function TradeModal({ poi, blocked, onClose }: Props) {
  const setNotice = useInventoryStore((s) => s.setNotice);
  const businesses = useBaseStore((s) => s.businesses);
  const supplier = useBaseStore((s) => s.suppliers[poi.id]);
  const dealers = useBaseStore((s) => s.dealers);
  const hqLevel = useBaseStore((s) => s.hqLevel);
  const dealer = dealers.find((d) => d.poiId === poi.id);

  const info = POI_KINDS[poi.kind];
  const isSupplyPoint = poi.kind === "warehouse" || poi.kind === "pharmacy";
  const isDealerSpot = poi.kind === "park" || poi.kind === "nightlife";

  const header = (
    <div className="flex items-start gap-2">
      <PoiBadge kind={poi.kind} size={36} />
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg leading-tight truncate">
          {displayName(poi) ?? info.label}
        </p>
        <p className="text-xs font-bold opacity-70">
          {info.label} · {info.role}
        </p>
      </div>
    </div>
  );

  const local = (
    <div className="flex flex-col gap-3">
      {blocked && (
        <p className="text-sm font-black text-red-600">
          Vas demasiado rápido. Nada de negocios al volante.
        </p>
      )}
      {isSupplyPoint &&
        (supplier ? (
          <SupplierCard supplier={supplier} blocked={blocked} bare />
        ) : (
          <div>
            <p className="text-sm font-bold mb-2">
              Establece contacto una vez, en persona. Desde entonces le pides
              mercancía desde el HQ y un transportista te la trae.
            </p>
            <button
              className="cartoon-btn px-3 py-2 text-sm"
              disabled={blocked}
              onClick={() => {
                const r = useBaseStore.getState().establishContact(poi);
                play(r.ok ? "level" : "error");
                setNotice(r.ok ? r.message : r.reason);
              }}
            >
              Establecer contacto
            </button>
          </div>
        ))}
      {poi.kind === "cover" &&
        (businesses.some((b) => b.poiId === poi.id) ? (
          <p className="text-sm font-black">
            Es tuyo: blanquea dinero automáticamente.
          </p>
        ) : (
          <div>
            <p className="text-sm font-bold mb-2">
              Se compra con Dinero Sucio y después blanquea solo (te quedas el
              80 %).
            </p>
            <button
              className="cartoon-btn px-3 py-2 text-sm"
              disabled={blocked}
              onClick={() => {
                const r = useBaseStore.getState().buyBusiness(poi);
                play(r.ok ? "level" : "error");
                setNotice(r.ok ? r.message : r.reason);
              }}
            >
              Comprar {money(businessCost(businesses.length), "dirty")}
            </button>
          </div>
        ))}
      {!isSupplyPoint && poi.kind !== "cover" && !isDealerSpot && (
        <p className="text-sm font-bold">
          Aquí no se hacen negocios. Aléjate, que te estás calentando.
        </p>
      )}
    </div>
  );

  const personal = (
    <div className="flex flex-col gap-3">
      {isDealerSpot &&
        (dealer ? (
          <DealerCard dealer={dealer} log bare />
        ) : (
          <EmptyState
            icon={<Users size={32} />}
            title="Nadie trabaja aquí"
            hint={`Un camello vende solo y queda asignado a este sitio. Camellos ${dealers.length}/${DEALER_SLOTS[hqLevel - 1]}. Ojo: no todos son de fiar.`}
            action={`Contratar camello ${money(DEALER_HIRE_COST, "clean")}`}
            onAction={() => {
              if (blocked) return;
              handleResult(
                useBaseStore.getState().hireDealer({
                  id: poi.id,
                  kind: poi.kind,
                  name: poi.name,
                  nameId: poi.nameId,
                  lat: poi.lat,
                  lng: poi.lng,
                }),
                "level",
              );
            }}
          />
        ))}
    </div>
  );

  return (
    <Sheet
      header={header}
      tabs={[]}
      tab="local"
      onTab={() => {}}
      onClose={onClose}
      label={displayName(poi) ?? info.label}
    >
      {isDealerSpot ? personal : local}
    </Sheet>
  );
}
