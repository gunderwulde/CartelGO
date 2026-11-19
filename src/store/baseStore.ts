import { create } from "zustand";
import { money } from "../services/money";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { del, get as idbGet, set as idbSet } from "idb-keyval";
import {
  DEALER_BONUS_COST,
  DEALER_BONUS_HONESTY,
  DEALER_HIRE_COST,
  DEALER_SLOTS,
  REFUND_SHARE,
  HQ_MOVE_COOLDOWN_MS,
  LAUNDER_FREE_MS,
  MAX_LEVEL,
  RECIPES,
  STORAGE_CAPACITY,
  UPGRADE_INFO,
  businessCost,
  type RecipeId,
  type UpgradeKind,
} from "../data/buildings";
import {
  CARRIER_HIRE_COST,
  CARRIER_SLOTS,
  CARRIER_UPGRADE_COSTS,
  SUPPLY_MAX_LEVEL,
} from "../data/supply";
import { ITEMS, type ItemId } from "../data/items";
import type { LatLng } from "../types";
import type { Poi } from "../types/poi";
import {
  syncIdle,
  batchDurationMs,
  honestyOf,
  rollHonesty,
  type Business,
  type Dealer,
  type DealerEvent,
  type IdleState,
  type Job,
} from "../services/idleEngine";
import { carried, planHandSale, type Inventory } from "../services/tradeEngine";
import { claimSalary } from "../services/salary";
import { useMapStore } from "./mapStore";
import { useTutorialStore } from "./tutorialStore";
import { POLICE_INFLUENCE_RADIUS_M } from "../data/poiKinds";
import { IN_PERSON_DISCOUNT } from "../data/supply";
import {
  AD_FAVOR_REWARD,
  AD_RESCUE_REWARD,
  canOfferAd,
  canWatchFavorAd,
} from "../services/adRescue";
import {
  BRIBE_COST,
  CALM_HEAT_COST,
  FAVORS_START,
  favorCost,
} from "../services/favors";
import {
  advanceSupply,
  dayKey,
  dirtyFromClean,
  inPersonLeft,
  type InPersonCount,
  newCarrier,
  supplierCash,
  pending,
  planOrder,
  supplierUpgradeCost,
  type Carrier,
  type Suppliers,
} from "../services/supplyEngine";
import { haversine, INTERACTION_RADIUS_M } from "../services/geoService";
import { HEAT_MAX } from "../data/balance";
import { useInventoryStore } from "./inventoryStore";
import { usePlayerStore } from "./playerStore";

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => idbSet(name, value),
  removeItem: async (name) => del(name),
};

export interface Hq extends LatLng {
  movedAt: number;
}

export type ActionResult =
  | { ok: true; message: string }
  /** `confirm`: la acción pide permiso; si el jugador acepta, `accept()` la repite ya autorizada */
  | {
      ok: false;
      reason: string;
      confirm?: { message: string; accept: () => ActionResult };
    };
const fail = (reason: string): ActionResult => ({ ok: false, reason });
const done = (message: string): ActionResult => ({ ok: true, message });

export type VisitedPoi = Pick<
  Poi,
  "id" | "kind" | "name" | "nameId" | "lat" | "lng"
>;

interface BaseState {
  /** Coordenadas exactas del HQ: SOLO en local. Nunca enviar (AGENTS §3) */
  hq: Hq | null;
  hqLevel: number;
  labLevel: number;
  storageLevel: number;
  storage: Inventory;
  job: Job | null;
  dealers: Dealer[];
  /** Informe de sucesos de los camellos (robos y adulteraciones), el más reciente primero */
  dealerLog: DealerEvent[];
  businesses: Business[];
  visited: Record<string, VisitedPoi>;
  /** Puntos de suministro con contacto establecido (GDD §4 bis) */
  suppliers: Suppliers;
  carriers: Carrier[];
  reputation: number;
  dealersAt: number;
  launderAt: number;
  /** Última vez que se cobró un anuncio de rescate */
  adAt: number;
  /** Última vez que se cobró un anuncio de favor */
  adFavorAt: number;
  /** Favores: moneda para saltar esperas */
  favors: number;
  /** Pedidos hechos en la partida (los cuatro primeros van más rápido) */
  ordersPlaced: number;
  /** Pedidos con descuento «en persona» de hoy */
  inPerson?: InPersonCount;
  /** Último cobro del empleo de fachada */
  salaryAt: number;
  /** Hasta cuándo el blanqueo no cobra comisión (primeras horas de partida) */
  launderFreeUntil?: number;

  placeHq: (pos: LatLng) => ActionResult;
  startJob: (recipe: RecipeId, batches: number) => ActionResult;
  hireDealer: (poi: VisitedPoi) => ActionResult;
  /** Vende a mano en un parque o bar con producto del almacén del HQ (hay que estar allí) */
  sellByHand: (poi: VisitedPoi, item: ItemId, qty: number) => ActionResult;
  fireDealer: (id: string) => ActionResult;
  bonusDealer: (id: string) => ActionResult;
  buyBusiness: (poi: VisitedPoi) => ActionResult;
  upgrade: (kind: UpgradeKind) => ActionResult;
  establishContact: (poi: Poi) => ActionResult;
  orderSupply: (poiId: string, item: ItemId, qty: number) => ActionResult;
  /** Cambia Dinero Limpio por Dinero Sucio (con comisión) */
  makeDirty: (cleanAmount: number) => ActionResult;
  /** Cobra la recompensa del anuncio de rescate */
  claimAdReward: () => ActionResult;
  claimFavorAd: () => ActionResult;
  grantFavors: (n: number) => void;
  /** Saltar esperas con Favores */
  skipOrder: (poiId: string) => ActionResult;
  skipTrip: (carrierId: string) => ActionResult;
  skipBatch: () => ActionResult;
  calmHeat: () => ActionResult;
  /** Soborna a la policía con Dinero Sucio: pone el Heat a 0 */
  bribePolice: () => ActionResult;
  /** Cobra el empleo de fachada */
  claimSalary: () => ActionResult;
  upgradeSupplier: (poiId: string) => ActionResult;
  hireCarrier: () => ActionResult;
  upgradeCarrier: (id: string) => ActionResult;
  markVisited: (pois: Poi[]) => void;
  /** Redada: la policía se lleva una parte del almacén. Devuelve las unidades confiscadas */
  seizeStock: (share: number) => number;
  /** Avanza el idle hasta ahora (producción, camellos y blanqueo) */
  sync: () => void;
}

const levelOf = (s: BaseState, kind: UpgradeKind): number =>
  ({ hq: s.hqLevel, lab: s.labLevel, storage: s.storageLevel })[kind];

const DEALER_LOG_MAX = 40;

const newDealer = (poi: VisitedPoi): Dealer => {
  const id = `d${Date.now()}`;
  return {
    id,
    poiId: poi.id,
    kind: poi.kind as "park" | "nightlife",
    name: poi.name,
    nameId: poi.nameId,
    honesty: rollHonesty(id),
    sold: 0,
    earned: 0,
    stolen: 0,
    cutUnits: 0,
  };
};

/** Avisa en pantalla de lo que han hecho los camellos mientras tanto */
function reportDealers(events: DealerEvent[]): void {
  if (events.length === 0) return;
  const stolen = events.reduce((a, e) => a + e.amount, 0);
  const cuts = events.filter((e) => e.kind === "cut").length;
  useInventoryStore
    .getState()
    .setNotice(
      `Tus camellos te han quitado ${money(stolen, "dirty")}${cuts > 0 ? ` y han adulterado el producto ${cuts} vez/veces (¡más Heat!)` : ""}. Mira el informe en el HQ.`,
    );
}

export const storageCap = (level: number): number =>
  STORAGE_CAPACITY[level - 1];
export const isNearHq = (hq: Hq | null, pos: LatLng | null): boolean =>
  !!hq && !!pos && haversine(hq, pos) <= INTERACTION_RADIUS_M;

export const useBaseStore = create<BaseState>()(
  persist(
    (set, get) => ({
      hq: null,
      hqLevel: 1,
      labLevel: 1,
      storageLevel: 1,
      storage: {},
      job: null,
      dealers: [],
      dealerLog: [],
      businesses: [],
      visited: {},
      suppliers: {},
      carriers: [],
      reputation: 0,
      dealersAt: Date.now(),
      launderAt: Date.now(),
      adAt: 0,
      adFavorAt: 0,
      favors: FAVORS_START,
      ordersPlaced: 0,
      inPerson: undefined,
      salaryAt: Date.now(),
      launderFreeUntil: undefined,

      placeHq: (pos) => {
        const { hq } = get();
        const now = Date.now();
        if (hq && now - hq.movedAt < HQ_MOVE_COOLDOWN_MS) {
          const days = Math.ceil(
            (HQ_MOVE_COOLDOWN_MS - (now - hq.movedAt)) / 86_400_000,
          );
          return fail(`Podrás mover el HQ gratis en ${days} día(s).`);
        }
        set({
          hq: { lat: pos.lat, lng: pos.lng, movedAt: now },
          // La partida empieza al colocar el HQ por primera vez
          ...(hq
            ? {}
            : { launderFreeUntil: now + LAUNDER_FREE_MS, salaryAt: now }),
        });
        return done("Cuartel General colocado.");
      },

      startJob: (recipeId, batches) => {
        get().sync();
        const s = get();
        const r = RECIPES[recipeId];
        if (s.labLevel < r.minLab)
          return fail("Tu laboratorio es demasiado básico para esto.");
        if (s.reputation < r.minRep)
          return fail(`Necesitas ${r.minRep} de reputación.`);
        if (s.job && s.job.recipe !== recipeId)
          return fail("El laboratorio ya está cocinando otra cosa.");
        const entries = Object.entries(r.inputs) as [ItemId, number][];
        const max = Math.min(
          ...entries.map(([item, n]) => Math.floor((s.storage[item] ?? 0) / n)),
        );
        const n = Math.min(batches, max);
        if (n < 1) return fail("Faltan precursores en el almacén.");
        const storage = { ...s.storage };
        for (const [item, per] of entries)
          storage[item] = (storage[item] ?? 0) - per * n;
        const job: Job = s.job
          ? { ...s.job, remaining: s.job.remaining + n }
          : {
              recipe: recipeId,
              remaining: n,
              nextAt: Date.now() + batchDurationMs(recipeId, s.labLevel),
            };
        set({ storage, job });
        return done(`Cocinando ${n} lote(s).`);
      },

      hireDealer: (poi) => {
        const s = get();
        const inv = useInventoryStore.getState();
        if (poi.kind !== "park" && poi.kind !== "nightlife")
          return fail("Los camellos solo trabajan parques y bares.");
        if (s.dealers.some((d) => d.poiId === poi.id))
          return fail("Ya hay un camello ahí.");
        const here = usePlayerStore.getState().position;
        if (!here || haversine(here, poi) > INTERACTION_RADIUS_M)
          return fail("Tienes que estar allí en persona para contratarlo.");
        if (s.dealers.length >= DEALER_SLOTS[s.hqLevel - 1])
          return fail("No tienes más huecos. Mejora el HQ.");
        if (inv.cleanCash < DEALER_HIRE_COST)
          return fail(`Contratar cuesta ${money(DEALER_HIRE_COST, "clean")}.`);
        useInventoryStore.setState({
          cleanCash: inv.cleanCash - DEALER_HIRE_COST,
        });
        set({
          dealers: [...s.dealers, newDealer(poi)],
          dealersAt: s.dealers.length === 0 ? Date.now() : s.dealersAt,
        });
        return done("Camello contratado.");
      },
      sellByHand: (poi, item, qty) => {
        const s = get();
        const here = usePlayerStore.getState().position;
        if (!here || haversine(here, poi) > INTERACTION_RADIUS_M)
          return fail("Tienes que estar allí en persona para vender.");
        const plan = planHandSale(s.storage, item, qty, poi.kind, new Date());
        if (!plan.ok) return fail(plan.reason);
        const inv = useInventoryStore.getState();
        set({
          storage: { ...s.storage, [item]: (s.storage[item] ?? 0) - plan.qty },
          reputation: s.reputation + plan.rep,
        });
        useInventoryStore.setState({
          dirtyCash: inv.dirtyCash + plan.cash,
          heat: Math.min(HEAT_MAX, inv.heat + plan.heat),
        });
        return done(
          `Vendidas ${plan.qty} × ${ITEMS[item].label} por ${money(plan.cash, "dirty")}.`,
        );
      },
      fireDealer: (id) => {
        const s = get();
        if (!s.dealers.some((d) => d.id === id))
          return fail("No existe ese camello.");
        const refund = Math.floor(DEALER_HIRE_COST * REFUND_SHARE);
        const inv = useInventoryStore.getState();
        useInventoryStore.setState({ cleanCash: inv.cleanCash + refund });
        set({ dealers: s.dealers.filter((d) => d.id !== id) });
        return done(
          `Camello despedido. Te devuelve ${money(refund, "clean")}.`,
        );
      },

      bonusDealer: (id) => {
        const s = get();
        const inv = useInventoryStore.getState();
        const d = s.dealers.find((x) => x.id === id);
        if (!d) return fail("No existe ese camello.");
        if (honestyOf(d) >= 100) return fail("Ya es de total confianza.");
        if (inv.dirtyCash < DEALER_BONUS_COST)
          return fail(`La prima cuesta ${money(DEALER_BONUS_COST, "dirty")}.`);
        useInventoryStore.setState({
          dirtyCash: inv.dirtyCash - DEALER_BONUS_COST,
        });
        set({
          dealers: s.dealers.map((x) =>
            x.id === id
              ? {
                  ...x,
                  honesty: Math.min(100, honestyOf(x) + DEALER_BONUS_HONESTY),
                }
              : x,
          ),
        });
        return done(
          "Prima pagada: ahora te lo piensa dos veces antes de rascar.",
        );
      },

      buyBusiness: (poi) => {
        const s = get();
        const inv = useInventoryStore.getState();
        if (poi.kind !== "cover") return fail("Eso no es un negocio tapadera.");
        if (s.businesses.some((b) => b.poiId === poi.id))
          return fail("Ya es tuyo.");
        const cost = businessCost(s.businesses.length);
        if (inv.dirtyCash < cost)
          return fail(`Cuesta ${money(cost, "dirty")}.`);
        useInventoryStore.setState({ dirtyCash: inv.dirtyCash - cost });
        // Dentro del radio de una comisaría blanquea más (y para llegar hay que jugársela)
        const boost = Object.values(useMapStore.getState().pois).some(
          (p) =>
            p.kind === "police" &&
            haversine(p, poi) <= POLICE_INFLUENCE_RADIUS_M,
        );
        set({
          businesses: [
            ...s.businesses,
            { poiId: poi.id, name: poi.name, nameId: poi.nameId, boost },
          ],
          launderAt: s.businesses.length === 0 ? Date.now() : s.launderAt,
        });
        return done(
          boost
            ? "Negocio comprado en zona policial: blanquea un 50 % más. Empieza solo."
            : "Negocio comprado. Empieza a blanquear solo.",
        );
      },

      upgrade: (kind) => {
        const s = get();
        const inv = useInventoryStore.getState();
        const level = levelOf(s, kind);
        if (level >= MAX_LEVEL) return fail("Ya está al máximo.");
        if (kind !== "hq" && level >= s.hqLevel)
          return fail("Mejora antes el Cuartel General.");
        const cost = UPGRADE_INFO[kind].costs[level];
        if (inv.cleanCash < cost)
          return fail(`Cuesta ${money(cost, "clean")}.`);
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost });
        set(
          kind === "hq"
            ? { hqLevel: level + 1 }
            : kind === "lab"
              ? { labLevel: level + 1 }
              : { storageLevel: level + 1 },
        );
        return done(`${UPGRADE_INFO[kind].label} al nivel ${level + 1}.`);
      },

      establishContact: (poi) => {
        const s = get();
        if (
          poi.kind !== "warehouse" &&
          poi.kind !== "pharmacy" &&
          poi.kind !== "supermarket"
        )
          return fail("Ahí no hay nadie que te suministre.");
        if (s.suppliers[poi.id]) return fail("Ya es tu proveedor.");
        const pos = usePlayerStore.getState().position;
        if (!pos || haversine(pos, poi) > INTERACTION_RADIUS_M)
          return fail("Tienes que estar allí en persona.");
        const { id, kind, name, lat, lng } = poi;
        set({
          suppliers: {
            ...s.suppliers,
            [id]: { poi: { id, kind, name, lat, lng }, level: 1, order: null },
          },
        });
        return done(
          "Contacto establecido. Ya puedes pedirle mercancía desde el HQ.",
        );
      },

      grantFavors: (n) => set((s) => ({ favors: s.favors + n })),

      skipOrder: (poiId) => {
        get().sync();
        const s = get();
        const now = Date.now();
        const sup = s.suppliers[poiId];
        if (!sup?.order || sup.order.readyAt <= now)
          return fail("No hay nada que adelantar.");
        const cost = favorCost(sup.order.readyAt - now);
        if (s.favors < cost) return fail(`Necesitas ${cost} favores.`);
        set({
          favors: s.favors - cost,
          suppliers: {
            ...s.suppliers,
            [poiId]: { ...sup, order: { ...sup.order, readyAt: now } },
          },
        });
        get().sync();
        return done(`Pedido listo al instante (-${cost} favores).`);
      },

      skipTrip: (carrierId) => {
        get().sync();
        const s = get();
        const now = Date.now();
        const c = s.carriers.find((x) => x.id === carrierId);
        if (!c?.trip || c.trip.arriveAt <= now)
          return fail("No hay ningún viaje que acelerar.");
        const cost = favorCost(c.trip.arriveAt - now);
        if (s.favors < cost) return fail(`Necesitas ${cost} favores.`);
        set({
          favors: s.favors - cost,
          carriers: s.carriers.map((x) =>
            x.id === carrierId && x.trip
              ? { ...x, trip: { ...x.trip, arriveAt: now } }
              : x,
          ),
        });
        get().sync();
        return done(`Transportista llegado al instante (-${cost} favores).`);
      },

      skipBatch: () => {
        get().sync();
        const s = get();
        const now = Date.now();
        if (!s.job || s.job.nextAt <= now)
          return fail("No hay ningún lote en marcha.");
        const cost = favorCost(s.job.nextAt - now);
        if (s.favors < cost) return fail(`Necesitas ${cost} favores.`);
        set({ favors: s.favors - cost, job: { ...s.job, nextAt: now } });
        get().sync();
        return done(`Lote terminado al instante (-${cost} favores).`);
      },

      calmHeat: () => {
        const s = get();
        const inv = useInventoryStore.getState();
        if (inv.heat <= 0) return fail("La policía no te busca.");
        if (s.favors < CALM_HEAT_COST)
          return fail(`Necesitas ${CALM_HEAT_COST} favores.`);
        useInventoryStore.setState({ heat: 0 });
        set({ favors: s.favors - CALM_HEAT_COST });
        return done(
          `Un amigo en comisaría despista a la poli (-${CALM_HEAT_COST} favores).`,
        );
      },

      bribePolice: () => {
        const inv = useInventoryStore.getState();
        if (inv.heat <= 0) return fail("La policía no te busca.");
        if (inv.dirtyCash < BRIBE_COST)
          return fail(`El soborno cuesta ${money(BRIBE_COST, "dirty")}.`);
        useInventoryStore.setState({
          heat: 0,
          dirtyCash: inv.dirtyCash - BRIBE_COST,
        });
        return done(
          `Un sobre bien repartido y la poli mira a otro lado (-${money(BRIBE_COST, "dirty")}).`,
        );
      },

      claimSalary: () => {
        const s = get();
        const r = claimSalary(s.salaryAt, Date.now());
        if (r.pays < 1) return fail("Todavía no toca cobrar.");
        const inv = useInventoryStore.getState();
        useInventoryStore.setState({ cleanCash: inv.cleanCash + r.cash });
        set({ salaryAt: r.paidAt });
        return done(`Cobras tu empleo de fachada: +${money(r.cash, "clean")}.`);
      },

      claimAdReward: () => {
        const inv = useInventoryStore.getState();
        const now = Date.now();
        if (!canOfferAd(inv.dirtyCash, inv.cleanCash, get().adAt, now))
          return fail("Ahora no hay recompensa disponible.");
        useInventoryStore.setState({
          dirtyCash: inv.dirtyCash + AD_RESCUE_REWARD,
        });
        set({ adAt: now });
        return done(
          `Patrocinador generoso: +${money(AD_RESCUE_REWARD, "dirty")}.`,
        );
      },

      claimFavorAd: () => {
        const now = Date.now();
        if (!canWatchFavorAd(get().adFavorAt, now))
          return fail("Espera un poco para ver otro anuncio.");
        set({ favors: get().favors + AD_FAVOR_REWARD, adFavorAt: now });
        return done(`Patrocinador agradecido: +${AD_FAVOR_REWARD} favor.`);
      },

      makeDirty: (cleanAmount) => {
        const inv = useInventoryStore.getState();
        if (cleanAmount < 1) return fail("Indica una cantidad.");
        if (inv.cleanCash < cleanAmount)
          return fail(`No tienes ${money(cleanAmount, "clean")}.`);
        const dirty = dirtyFromClean(cleanAmount);
        useInventoryStore.setState({
          cleanCash: inv.cleanCash - cleanAmount,
          dirtyCash: inv.dirtyCash + dirty,
        });
        return done(
          `Ensuciados ${money(cleanAmount, "clean")}: te dan ${money(dirty, "dirty")}.`,
        );
      },

      orderSupply: (poiId, item, qty) => {
        get().sync();
        const s = get();
        const inv = useInventoryStore.getState();
        const supplier = s.suppliers[poiId];
        if (!supplier)
          return fail("Primero hay que ir en persona a establecer contacto.");
        if (!s.hq)
          return fail(
            "Coloca antes tu Cuartel General: allí llega la mercancía.",
          );
        if (s.carriers.length === 0)
          return fail(
            "Sin transportista no llega nada: contrátalo en el HQ (pestaña Suministro).",
          );
        const free =
          storageCap(s.storageLevel) -
          carried(s.storage) -
          pending(s.suppliers, s.carriers);
        const now = Date.now();
        const cash = supplierCash(supplier.poi.kind);
        // En el tutorial, hasta el primer pedido, solo se pide lo que pide el paso
        const tut = useTutorialStore.getState();
        if (!tut.done && tut.step < 3 && item !== "fertilizante")
          return fail(
            "Para empezar, pide Fertilizante: es lo que cocina la Hierba.",
          );
        // En persona (junto a una farmacia o supermercado) sale más barato, con tope diario
        const here = usePlayerStore.getState().position;
        const inPerson =
          cash === "clean" &&
          !!here &&
          haversine(here, supplier.poi) <= INTERACTION_RADIUS_M &&
          inPersonLeft(s.inPerson, now) > 0;
        const wallet = cash === "clean" ? inv.cleanCash : inv.dirtyCash;
        const plan = planOrder(supplier, item, qty, free, wallet, now, {
          seq: s.ordersPlaced + 1,
          priceFactor: inPerson ? 1 - IN_PERSON_DISCOUNT : 1,
        });
        if (!plan.ok) return fail(plan.reason);
        useInventoryStore.setState(
          cash === "clean"
            ? { cleanCash: inv.cleanCash - plan.cost }
            : { dirtyCash: inv.dirtyCash - plan.cost },
        );
        set({
          suppliers: {
            ...s.suppliers,
            [poiId]: { ...supplier, order: plan.order },
          },
          ordersPlaced: s.ordersPlaced + 1,
          inPerson: inPerson
            ? {
                day: dayKey(now),
                n: (s.inPerson?.day === dayKey(now) ? s.inPerson.n : 0) + 1,
              }
            : s.inPerson,
        });
        return done(
          `Pedido: ${plan.qty} × ${ITEMS[item].label} por ${money(plan.cost, cash)}${inPerson ? " (descuento en persona)" : ""}. Lo preparan y un transportista lo recoge.`,
        );
      },

      upgradeSupplier: (poiId) => {
        const s = get();
        const inv = useInventoryStore.getState();
        const supplier = s.suppliers[poiId];
        if (!supplier) return fail("No es tu proveedor.");
        const pos = usePlayerStore.getState().position;
        const remote =
          !pos || haversine(pos, supplier.poi) > INTERACTION_RADIUS_M;
        const cost = supplierUpgradeCost(supplier.level, remote);
        if (cost === null) return fail("Ya está al máximo.");
        if (inv.cleanCash < cost)
          return fail(
            `Cuesta ${money(cost, "clean")}${remote ? " por teléfono" : ""}.`,
          );
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost });
        set({
          suppliers: {
            ...s.suppliers,
            [poiId]: { ...supplier, level: supplier.level + 1 },
          },
        });
        return done(
          `Proveedor al nivel ${supplier.level + 1}${remote ? " (negociado por teléfono)" : ""}.`,
        );
      },

      hireCarrier: () => {
        const s = get();
        const inv = useInventoryStore.getState();
        if (s.carriers.length >= CARRIER_SLOTS[s.hqLevel - 1])
          return fail("No tienes más huecos. Mejora el HQ.");
        if (inv.cleanCash < CARRIER_HIRE_COST)
          return fail(`Contratar cuesta ${money(CARRIER_HIRE_COST, "clean")}.`);
        useInventoryStore.setState({
          cleanCash: inv.cleanCash - CARRIER_HIRE_COST,
        });
        set({
          carriers: [...s.carriers, newCarrier(`t${Date.now()}`, Date.now())],
        });
        return done("Transportista contratado.");
      },

      upgradeCarrier: (id) => {
        const s = get();
        const inv = useInventoryStore.getState();
        const c = s.carriers.find((x) => x.id === id);
        if (!c) return fail("No existe ese transportista.");
        if (c.level >= SUPPLY_MAX_LEVEL) return fail("Ya está al máximo.");
        const cost = CARRIER_UPGRADE_COSTS[c.level];
        if (inv.cleanCash < cost)
          return fail(`Cuesta ${money(cost, "clean")}.`);
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost });
        set({
          carriers: s.carriers.map((x) =>
            x.id === id ? { ...x, level: x.level + 1 } : x,
          ),
        });
        return done(`Transportista al nivel ${c.level + 1}.`);
      },

      markVisited: (pois) => {
        const { visited } = get();
        const fresh = pois.filter((p) => !visited[p.id]);
        if (fresh.length === 0) return;
        const next = { ...visited };
        for (const p of fresh)
          next[p.id] = {
            id: p.id,
            kind: p.kind,
            name: p.name,
            nameId: p.nameId,
            lat: p.lat,
            lng: p.lng,
          };
        set({ visited: next });
      },

      seizeStock: (share) => {
        const s = get();
        const next: Inventory = {};
        let seized = 0;
        for (const [item, n] of Object.entries(s.storage) as [
          ItemId,
          number,
        ][]) {
          const take = Math.floor((n ?? 0) * share);
          seized += take;
          next[item] = (n ?? 0) - take;
        }
        if (seized > 0) set({ storage: next });
        return seized;
      },

      sync: () => {
        const s = get();
        const inv = useInventoryStore.getState();
        const before: IdleState = {
          storage: s.storage,
          storageCap: storageCap(s.storageLevel),
          labLevel: s.labLevel,
          job: s.job,
          dealers: s.dealers,
          businesses: s.businesses,
          dirtyCash: inv.dirtyCash,
          cleanCash: inv.cleanCash,
          dealersAt: s.dealersAt,
          launderAt: s.launderAt,
          launderFreeUntil: s.launderFreeUntil,
        };
        const after = syncIdle(before, Date.now());
        reportDealers(after.events);
        const supply = advanceSupply(
          {
            suppliers: s.suppliers,
            carriers: s.carriers,
            storage: after.storage,
            storageCap: storageCap(s.storageLevel),
          },
          Date.now(),
        );
        set({
          storage: supply.storage,
          suppliers: supply.suppliers,
          carriers: supply.carriers,
          job: after.job,
          dealers: after.dealers,
          dealerLog:
            after.events.length > 0
              ? [...after.events.slice().reverse(), ...s.dealerLog].slice(
                  0,
                  DEALER_LOG_MAX,
                )
              : s.dealerLog,
          reputation: Math.max(0, s.reputation + after.repDelta),
          dealersAt: after.dealersAt,
          launderAt: after.launderAt,
        });
        if (supply.delivered > 0)
          useInventoryStore
            .getState()
            .setNotice(`Llegó un envío al HQ: ${supply.delivered} unidades.`);
        if (after.heatDelta > 0)
          useInventoryStore.setState({
            heat: Math.min(HEAT_MAX, inv.heat + after.heatDelta),
          });
        if (
          after.dirtyCash !== inv.dirtyCash ||
          after.cleanCash !== inv.cleanCash
        )
          useInventoryStore.setState({
            dirtyCash: after.dirtyCash,
            cleanCash: after.cleanCash,
          });
      },
    }),
    {
      name: "cartelgo:base",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
