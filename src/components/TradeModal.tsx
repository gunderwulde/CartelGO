import { useState } from "react";
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
import { CARRIER_HIRE_COST } from "../data/supply";
import { play } from "../services/sound";
import { CarrierCard, SupplierCard } from "./SupplyCards";
import { DealerCard } from "./DealerCard";
import { EmptyState } from "./EmptyState";
import { Sheet, type SheetTab } from "./Sheet";

interface Props {
  poi: Poi;
  blocked: boolean;
  onClose: () => void;
}

type PoiTab = "local" | "personal";

export default function TradeModal({ poi, blocked, onClose }: Props) {
  // En un parque o bar lo único que hay es el camello: se abre directamente en su pestaña
  const [tab, setTab] = useState<PoiTab>(
    poi.kind === "park" || poi.kind === "nightlife" ? "personal" : "local",
  );
  const dirtyCash = useInventoryStore((s) => s.dirtyCash);
  const setNotice = useInventoryStore((s) => s.setNotice);
  const businesses = useBaseStore((s) => s.businesses);
  const supplier = useBaseStore((s) => s.suppliers[poi.id]);
  const carriers = useBaseStore((s) => s.carriers);
  const dealers = useBaseStore((s) => s.dealers);
  const hqLevel = useBaseStore((s) => s.hqLevel);
  const dealer = dealers.find((d) => d.poiId === poi.id);
  const cleanCash = useInventoryStore((s) => s.cleanCash);

  const info = POI_KINDS[poi.kind];
  const isSupplyPoint = poi.kind === "warehouse" || poi.kind === "pharmacy";
  const isDealerSpot = poi.kind === "park" || poi.kind === "nightlife";

  // Personal asociado al sitio: el camello del parque/bar, o los transportistas del punto de suministro
  const tabs: SheetTab<PoiTab>[] = [{ id: "local", label: "Local" }];
  if (isDealerSpot)
    tabs.push({ id: "personal", label: dealer ? "Camello" : "Personal" });
  if (isSupplyPoint && supplier)
    tabs.push({ id: "personal", label: "Transportistas" });
  const activeTab: PoiTab = tabs.some((t) => t.id === tab) ? tab : "local";

  const header = (
    <div className="flex items-start gap-2">
      <PoiBadge kind={poi.kind} size={36} />
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg leading-tight truncate">
          {poi.name ?? info.label}
        </p>
        <p className="text-xs font-bold opacity-70">
          {info.label} · {info.role}
        </p>
        <p className="num text-xs font-black">
          ${dirtyCash} sucios · ${cleanCash} limpios
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
          <SupplierCard supplier={supplier} blocked={blocked} />
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
              Cómpralo para blanquear Dinero Sucio solo (te quedas el 80 %).
              Tienes ${cleanCash} limpios.
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
              Comprar ${businessCost(businesses.length)}
            </button>
          </div>
        ))}
      {isDealerSpot && (
        <p className="text-sm font-bold">
          Aquí no se vende a mano: tu negocio es el camello. Mira la pestaña{" "}
          {dealer ? "Camello" : "Personal"}.
        </p>
      )}
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
            action={`Contratar camello $${DEALER_HIRE_COST}`}
            onAction={() => {
              if (blocked) return;
              handleResult(
                useBaseStore.getState().hireDealer({
                  id: poi.id,
                  kind: poi.kind,
                  name: poi.name,
                  lat: poi.lat,
                  lng: poi.lng,
                }),
                "level",
              );
            }}
          />
        ))}
      {isSupplyPoint && (
        <>
          <p className="text-xs font-bold">
            Los transportistas recogen tu pedido aquí y lo llevan al HQ. Se
            contratan en el HQ (${CARRIER_HIRE_COST}).
          </p>
          {carriers.length === 0 && (
            <p className="text-sm font-black">Aún no tienes transportistas.</p>
          )}
          {carriers.map((c, i) => (
            <CarrierCard key={c.id} carrier={c} index={i} />
          ))}
        </>
      )}
    </div>
  );

  return (
    <Sheet
      header={header}
      tabs={tabs}
      tab={activeTab}
      onTab={setTab}
      onClose={onClose}
      label={poi.name ?? info.label}
      fixedHeight
    >
      {activeTab === "local" ? local : personal}
    </Sheet>
  );
}
