import { useState } from "react";
import { Building2, FlaskConical, Package, Truck, Users } from "lucide-react";
import { ITEMS, type ItemId } from "../data/items";
import {
  DEALER_SLOTS,
  HQ_MOVE_COOLDOWN_MS,
  LAB_NAMES,
  MAX_LEVEL,
  RECIPES,
  UPGRADE_INFO,
  businessCost,
  type UpgradeKind,
} from "../data/buildings";
import {
  storageCap,
  useBaseStore,
  type ActionResult,
} from "../store/baseStore";
import { useInventoryStore } from "../store/inventoryStore";
import { usePlayerStore } from "../store/playerStore";
import { batchDurationMs } from "../services/idleEngine";
import { carried } from "../services/tradeEngine";
import { useNow } from "../services/useIdle";
import { type Sfx } from "../services/sound";
import { requestNotifyPermission } from "../services/notify";
import { fmtTime } from "../services/fmt";
import { handleResult } from "../services/feedback";
import { CALM_HEAT_COST, favorCost } from "../services/favors";
import {
  CARRIER_HIRE_COST,
  CARRIER_SLOTS,
  DIRTY_EXCHANGE_STEPS,
  DIRTY_EXCHANGE_YIELD,
} from "../data/supply";
import { CarrierCard, SupplierCard } from "./SupplyCards";
import { EmptyState } from "./EmptyState";
import { Sheet } from "./Sheet";
import { DealerCard } from "./DealerCard";
import type { GoTarget } from "./Tutorial";
import { loadLastOrder } from "../services/lastOrder";

export type Tab = "almacen" | "lab" | "camellos" | "suministro" | "mejoras";
const TABS: { id: Tab; label: string }[] = [
  { id: "almacen", label: "Almacén" },
  { id: "lab", label: "Lab" },
  { id: "camellos", label: "Camellos" },
  { id: "suministro", label: "Suministro" },
  { id: "mejoras", label: "Mejoras" },
];

export default function HqPanel({
  onClose,
  initialTab = "almacen",
  onGo,
}: {
  onClose: () => void;
  initialTab?: Tab;
  /** Lleva al jugador a un tipo de lugar (cierra el HQ y centra el mapa) */
  onGo: (target: GoTarget) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const base = useBaseStore();
  const inv = useInventoryStore();
  const position = usePlayerStore((s) => s.position);
  const now = useNow(1000);

  const report = (r: ActionResult, sfx: Sfx = "tap"): void =>
    handleResult(r, sfx);

  const btn = "cartoon-btn px-3 py-1.5 text-sm disabled:opacity-40";

  const used = carried(base.storage);
  const cap = storageCap(base.storageLevel);
  const storage = (
    <div className="flex flex-col gap-2">
      <div>
        <p className="num text-sm font-black">
          Almacén {used}/{cap}
        </p>
        <div className="h-3 border-2 border-black bg-white">
          <div
            className="h-full bg-green-400"
            style={{ width: `${Math.min(100, (used / cap) * 100)}%` }}
          />
        </div>
      </div>
      {used === 0 && (
        <EmptyState
          icon={<Package size={32} />}
          title="El almacén está vacío"
          hint="Pide mercancía a un proveedor y un transportista te la traerá. Sin ella el laboratorio no cocina."
          action="Pedir suministro"
          onAction={() => setTab("suministro")}
        />
      )}
      {(Object.keys(ITEMS) as ItemId[]).map((id) => (
        <div key={id} className="flex items-center gap-2">
          <p className="flex-1 min-w-0 font-black leading-tight truncate">
            {ITEMS[id].label}
          </p>
          <p className="num text-lg font-black">{base.storage[id] ?? 0}</p>
        </div>
      ))}
    </div>
  );

  const job = base.job;
  const lab = (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black">
        {LAB_NAMES[base.labLevel - 1]} (nivel {base.labLevel})
      </p>
      {job ? (
        <div className="border-4 border-black p-2 bg-green-100">
          <p className="font-black">
            Cocinando {ITEMS[RECIPES[job.recipe].output].label}: quedan{" "}
            {job.remaining}
          </p>
          <p className="text-xs font-bold">
            Siguiente lote en {fmtTime(job.nextAt - now)} · todo listo en{" "}
            {fmtTime(
              job.nextAt -
                now +
                (job.remaining - 1) *
                  batchDurationMs(job.recipe, base.labLevel),
            )}
          </p>
          {job.nextAt > now && (
            <button
              className={`${btn} bg-white! mt-1`}
              onClick={() => report(base.skipBatch(), "level")}
            >
              Terminar este lote ({favorCost(job.nextAt - now)} favores)
            </button>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<FlaskConical size={32} />}
          title="El laboratorio está parado"
          hint="Los precursores salen del almacén. Lanza un lote abajo o pide ingredientes."
          action={carried(base.storage) === 0 ? "Pedir suministro" : undefined}
          onAction={() => setTab("suministro")}
        />
      )}
      {Object.values(RECIPES).map((r) => {
        const locked = base.labLevel < r.minLab || base.reputation < r.minRep;
        return (
          <div
            key={r.id}
            className={`border-4 border-black p-2 ${locked ? "opacity-60" : ""}`}
          >
            <p className="font-black">{ITEMS[r.output].label}</p>
            <p className="text-xs font-bold">
              {(Object.entries(r.inputs) as [ItemId, number][])
                .map(([i, n]) => `${n}× ${ITEMS[i].label}`)
                .join(" + ")}{" "}
              · {fmtTime(batchDurationMs(r.id, base.labLevel))} por lote
            </p>
            {locked ? (
              <p className="text-xs font-black text-red-600">
                Requiere {LAB_NAMES[r.minLab - 1]}
                {r.minRep > 0 ? ` y ${r.minRep} de reputación` : ""}
              </p>
            ) : (
              <div className="flex gap-2 mt-1">
                <button
                  className={btn}
                  onClick={() => {
                    void requestNotifyPermission();
                    report(base.startJob(r.id, 1));
                  }}
                >
                  Cocinar 1
                </button>
                <button
                  className={`${btn} bg-white!`}
                  onClick={() => {
                    void requestNotifyPermission();
                    report(base.startJob(r.id, 999));
                  }}
                >
                  Cocinar máx
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const dealers = (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-black">
        Camellos {base.dealers.length}/{DEALER_SLOTS[base.hqLevel - 1]} · venden
        1 unidad cada 30 s del almacén (cobran su parte)
      </p>
      <p className="text-xs font-bold">
        Se contratan en persona, desde el parque o bar donde van a trabajar.
        Algunos roban o adulteran el producto: vigílalos aquí.
      </p>
      {base.dealers.length === 0 && (
        <EmptyState
          icon={<Users size={32} />}
          title="Aún no tienes camellos"
          hint="Se contratan en persona en un parque o un bar. Venden solos mientras tú no estás."
          action="Ir al parque o bar más cercano"
          onAction={() => onGo({ type: "poi", kinds: ["park", "nightlife"] })}
        />
      )}
      {base.dealers.length > 1 && (
        <p className="num text-xs font-bold bg-yellow-100 border-2 border-black p-2">
          Total: {base.dealers.reduce((a, d) => a + (d.sold ?? 0), 0)} ventas ·
          cobrado ${base.dealers.reduce((a, d) => a + (d.earned ?? 0), 0)} ·
          perdido ${base.dealers.reduce((a, d) => a + (d.stolen ?? 0), 0)}
        </p>
      )}
      {base.dealers.map((d) => (
        <DealerCard key={d.id} dealer={d} />
      ))}

      <p className="text-sm font-black mt-4">Informe de sucesos</p>
      {base.dealerLog.length === 0 && (
        <p className="text-xs font-bold">Sin incidentes. De momento.</p>
      )}
      {base.dealerLog.slice(0, 15).map((e, i) => (
        <p key={i} className="text-xs font-bold">
          • hace {fmtTime(now - e.at)}: {e.poiName ?? "Un camello"}{" "}
          {e.kind === "theft"
            ? `te ha birlado $${e.amount}`
            : `ha adulterado el producto (te cuesta $${e.amount} y sube el Heat)`}
        </p>
      ))}
    </div>
  );

  const supplierList = Object.values(base.suppliers);
  const supply = (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black">
        Transportistas {base.carriers.length}/{CARRIER_SLOTS[base.hqLevel - 1]}
      </p>
      <p className="text-xs font-bold">
        Los puntos de suministro preparan tu pedido y un transportista libre lo
        recoge y lo trae al almacén. Sin transportistas no llega nada.
      </p>
      {base.carriers.length === 0 && (
        <EmptyState
          icon={<Truck size={32} />}
          title="Sin transportistas"
          hint="Sin ellos no llega nada: son los que recogen tu pedido y lo traen al almacén."
        />
      )}
      {base.carriers.map((c, i) => (
        <CarrierCard key={c.id} carrier={c} index={i} />
      ))}
      <button
        className={btn}
        onClick={() => report(base.hireCarrier(), "level")}
      >
        Contratar transportista ${CARRIER_HIRE_COST}
      </button>

      {(() => {
        const last = loadLastOrder();
        const sp = last ? base.suppliers[last.poiId] : undefined;
        if (!last || !sp) return null;
        return (
          <button
            className={`${btn} bg-white!`}
            disabled={!!sp.order}
            onClick={() =>
              report(base.orderSupply(last.poiId, last.item, last.qty))
            }
          >
            Repetir: {last.qty >= 999 ? "máx." : last.qty} ×{" "}
            {ITEMS[last.item].label} en {sp.poi.name ?? "proveedor"}
          </button>
        );
      })()}
      <p className="text-sm font-black mt-4">
        Puntos de suministro ({supplierList.length})
      </p>
      {supplierList.length === 0 && (
        <EmptyState
          icon={<Package size={32} />}
          title="Aún no tienes proveedores"
          hint="Ve en persona a un almacén o una farmacia y pulsa «Establecer contacto». Solo hace falta la primera vez."
          action="Ir al almacén o farmacia más cercano"
          onAction={() =>
            onGo({ type: "poi", kinds: ["warehouse", "pharmacy"] })
          }
        />
      )}
      {supplierList.map((sp) => (
        <SupplierCard key={sp.poi.id} supplier={sp} />
      ))}
    </div>
  );

  const upgrades = (
    <div className="flex flex-col gap-3">
      {(Object.keys(UPGRADE_INFO) as UpgradeKind[]).map((k) => {
        const level = {
          hq: base.hqLevel,
          lab: base.labLevel,
          storage: base.storageLevel,
        }[k];
        const max = level >= MAX_LEVEL;
        return (
          <div key={k} className="flex items-center gap-2">
            <div className="flex-1">
              <p className="font-black leading-tight">
                {UPGRADE_INFO[k].label}
              </p>
              <p className="text-xs font-bold opacity-70">
                Nivel {level}/{MAX_LEVEL}
              </p>
            </div>
            <button
              className={btn}
              disabled={max}
              onClick={() => report(base.upgrade(k), "level")}
            >
              {max ? "Máx" : `$${UPGRADE_INFO[k].costs[level]}`}
            </button>
          </div>
        );
      })}
      <p className="text-xs font-bold">
        Los edificios no pueden superar el nivel del Cuartel General.
      </p>

      <p className="text-sm font-black mt-4">Favores ({base.favors})</p>
      <p className="text-xs font-bold">
        Sirven para saltarte esperas: pedidos, viajes y lotes (1 favor cada 5
        min). Los consigues avanzando en el tutorial.
      </p>
      <button
        className={btn}
        disabled={inv.heat <= 0}
        onClick={() => report(base.calmHeat(), "level")}
      >
        Despistar a la poli: Heat a 0 ({CALM_HEAT_COST} favores)
      </button>

      <p className="text-sm font-black mt-4">Ensuciar dinero</p>
      <p className="text-xs font-bold">
        Un cambista te da Dinero Sucio a cambio de limpio, pero se queda con la
        mitad (recibes ${Math.round(DIRTY_EXCHANGE_YIELD * 100)} de cada $100).
        Es la salida si te quedas sin sucio para pedir ingredientes.
      </p>
      <div className="flex gap-2">
        {DIRTY_EXCHANGE_STEPS.map((n) => (
          <button
            key={n}
            className={`${btn} flex-1`}
            disabled={inv.cleanCash < n}
            onClick={() => report(base.makeDirty(n), "tap")}
          >
            ${n} limpios → ${Math.floor(n * DIRTY_EXCHANGE_YIELD)} sucios
          </button>
        ))}
      </div>

      <p className="text-sm font-black mt-4">
        Negocios tapadera ({base.businesses.length})
      </p>
      {base.businesses.length === 0 && (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Sin negocio tapadera"
          hint={`Cómpralo en una lavandería o autolavado (${businessCost(0)} limpios) para blanquear dinero solo.`}
          action="Ir a la lavandería más cercana"
          onAction={() => onGo({ type: "poi", kinds: ["cover"] })}
        />
      )}
      {base.businesses.map((b) => (
        <p key={b.poiId} className="text-sm font-bold">
          • {b.name ?? "Negocio sin nombre"}
        </p>
      ))}

      <button
        className={`${btn} mt-4`}
        disabled={!position}
        onClick={() => {
          if (!position) return;
          report(base.placeHq(position));
        }}
      >
        Mover el HQ aquí
      </button>
      {base.hq && Date.now() - base.hq.movedAt < HQ_MOVE_COOLDOWN_MS && (
        <p className="text-xs font-bold">
          Gratis de nuevo en{" "}
          {fmtTime(HQ_MOVE_COOLDOWN_MS - (Date.now() - base.hq.movedAt))}.
        </p>
      )}
    </div>
  );

  const header = (
    <>
      <p className="text-lg font-black leading-tight">Cuartel General</p>
      <p className="num flex flex-wrap items-baseline gap-x-3">
        <span className="text-lg font-black">
          ${inv.dirtyCash}
          <span className="text-xs font-bold opacity-70"> sucio</span>
        </span>
        <span className="text-lg font-black">
          ${inv.cleanCash}
          <span className="text-xs font-bold opacity-70"> limpio</span>
        </span>
        <span className="text-sm font-black">
          {base.reputation}
          <span className="text-xs font-bold opacity-70"> rep</span>
        </span>
        <span className="text-sm font-black">
          {base.favors}
          <span className="text-xs font-bold opacity-70"> favores</span>
        </span>
      </p>
    </>
  );

  return (
    <Sheet
      header={header}
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      label="Cuartel General"
      fixedHeight
      tone="yellow"
    >
      <div className="cartoon-card p-3">
        {tab === "almacen" && storage}
        {tab === "lab" && lab}
        {tab === "camellos" && dealers}
        {tab === "suministro" && supply}
        {tab === "mejoras" && upgrades}
      </div>
    </Sheet>
  );
}
