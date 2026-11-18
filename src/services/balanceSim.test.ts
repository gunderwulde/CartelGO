import { describe, expect, it } from "vitest";
import {
  DEALER_HIRE_COST,
  DEALER_SLOTS,
  LAB_COSTS,
  HQ_COSTS,
  STORAGE_COSTS,
  STORAGE_CAPACITY,
  RECIPES,
  businessCost,
  type RecipeId,
} from "../data/buildings";
import {
  CARRIER_HIRE_COST,
  CARRIER_SLOTS,
  CARRIER_UPGRADE_COSTS,
  SUPPLIER_UPGRADE_COSTS,
  SUPPLY_MAX_LEVEL,
} from "../data/supply";
import { CFG } from "../data/config";
import type { ItemId } from "../data/items";
import { batchDurationMs, syncIdle, type IdleState } from "./idleEngine";
import {
  advanceSupply,
  newCarrier,
  pending,
  planOrder,
  supplierCash,
  type Carrier,
  type Suppliers,
} from "./supplyEngine";
import { carried } from "./tradeEngine";
import { AD_RESCUE_REWARD, canOfferAd } from "./adRescue";

/**
 * Simulación de balance: un jugador "atento" (bot) sigue siempre el mismo plan de compras y se imprime la línea de tiempo.
 * Usa los motores reales (laboratorio, camellos, blanqueo, cadena de suministro) con los números de balance.json.
 * Sirve para tocar balance.json y ver al instante cómo cambia el ritmo. Ejecutar: npx vitest run balanceSim
 */

const PLAN = [
  "C",
  "D",
  "B",
  "D",
  "Cu",
  "Su",
  "B",
  "HQ",
  "C",
  "D",
  "D",
  "LAB",
  "Cu",
  "Su",
  "Cu",
  "Su",
  "STO",
  "B",
  "HQ",
  "C",
  "D",
  "D",
  "LAB",
  "Cu",
  "Su",
  "Cu",
  "Su",
  "STO",
  "B",
  "B",
] as const;
type Step = (typeof PLAN)[number];

interface Sim extends IdleState {
  suppliers: Suppliers;
  carriers: Carrier[];
  rep: number;
  hqLevel: number;
  storageLevel: number;
  planIdx: number;
}

const poi = (i: number) => ({
  id: `p${i}`,
  kind: "warehouse" as const,
  name: `Almacén ${i}`,
  lat: 0,
  lng: 0,
});

export function simulate(
  hours: number,
  startMs = new Date(2026, 0, 5, 10, 0).getTime(),
) {
  let now = startMs;
  const s: Sim = {
    storage: {},
    storageCap: STORAGE_CAPACITY[0],
    labLevel: 1,
    job: null,
    dealers: [],
    businesses: [],
    dirtyCash: CFG.inicio.dineroSucio,
    cleanCash: CFG.inicio.dineroLimpio,
    dealersAt: now,
    launderAt: now,
    suppliers: {},
    carriers: [],
    rep: 0,
    hqLevel: 1,
    storageLevel: 1,
    planIdx: 0,
  };
  const log: { t: number; what: string }[] = [];
  const mark = (what: string) =>
    log.push({ t: (now - startMs) / 3_600_000, what });
  const rows: string[] = [];
  const marks: Record<string, number> = {};
  const note = (k: string) => {
    if (!(k in marks)) marks[k] = (now - startMs) / 3_600_000;
  };

  const tryStep = (step: Step): boolean => {
    switch (step) {
      case "C": {
        if (s.carriers.length >= CARRIER_SLOTS[s.hqLevel - 1]) return false;
        if (s.cleanCash < CARRIER_HIRE_COST) return false;
        const i = s.carriers.length;
        s.cleanCash -= CARRIER_HIRE_COST;
        s.suppliers[`p${i}`] = { poi: poi(i), level: 1, order: null };
        s.carriers.push(newCarrier(`t${i}`, now));
        return true;
      }
      case "D": {
        if (s.dealers.length >= DEALER_SLOTS[s.hqLevel - 1]) return false;
        if (s.cleanCash < DEALER_HIRE_COST) return false;
        s.cleanCash -= DEALER_HIRE_COST;
        const i = s.dealers.length;
        s.dealers.push({
          id: `d${i}`,
          poiId: `b${i}`,
          kind: i % 2 === 0 ? "park" : "nightlife",
          name: null,
        });
        if (i === 0) s.dealersAt = now;
        return true;
      }
      case "B": {
        const cost = businessCost(s.businesses.length);
        if (s.dirtyCash < cost) return false;
        s.dirtyCash -= cost;
        if (s.businesses.length === 0) s.launderAt = now;
        s.businesses.push({ poiId: `n${s.businesses.length}`, name: null });
        return true;
      }
      case "Cu": {
        const c = [...s.carriers].sort((a, b) => a.level - b.level)[0];
        if (!c || c.level >= SUPPLY_MAX_LEVEL) return false;
        const cost = CARRIER_UPGRADE_COSTS[c.level];
        if (s.cleanCash < cost) return false;
        s.cleanCash -= cost;
        c.level++;
        return true;
      }
      case "Su": {
        const p = Object.values(s.suppliers).sort(
          (a, b) => a.level - b.level,
        )[0];
        if (!p || p.level >= SUPPLY_MAX_LEVEL) return false;
        const cost = SUPPLIER_UPGRADE_COSTS[p.level];
        if (s.cleanCash < cost) return false;
        s.cleanCash -= cost;
        p.level++;
        return true;
      }
      case "HQ": {
        if (s.hqLevel >= 3 || s.cleanCash < HQ_COSTS[s.hqLevel]) return false;
        s.cleanCash -= HQ_COSTS[s.hqLevel];
        s.hqLevel++;
        return true;
      }
      case "LAB": {
        if (
          s.labLevel >= s.hqLevel ||
          s.labLevel >= 3 ||
          s.cleanCash < LAB_COSTS[s.labLevel]
        )
          return false;
        s.cleanCash -= LAB_COSTS[s.labLevel];
        s.labLevel++;
        return true;
      }
      case "STO": {
        if (
          s.storageLevel >= s.hqLevel ||
          s.storageLevel >= 3 ||
          s.cleanCash < STORAGE_COSTS[s.storageLevel]
        )
          return false;
        s.cleanCash -= STORAGE_COSTS[s.storageLevel];
        s.storageLevel++;
        s.storageCap = STORAGE_CAPACITY[s.storageLevel - 1];
        return true;
      }
    }
  };

  const bestRecipe = (): RecipeId => {
    const nSup = Object.keys(s.suppliers).length;
    if (s.labLevel >= 3 && s.rep >= RECIPES.polvo.minRep && nSup >= 2)
      return "polvo";
    if (s.labLevel >= 2 && s.rep >= RECIPES.cristal.minRep && nSup >= 2)
      return "cristal";
    return "hierba";
  };

  let emergencies = 0;
  let ads = 0;
  let lastAd = 0;
  const steps = hours * 60;
  for (let m = 0; m < steps; m++) {
    now += 60_000;
    const sup = advanceSupply(
      {
        suppliers: s.suppliers,
        carriers: s.carriers,
        storage: s.storage,
        storageCap: s.storageCap,
      },
      now,
    );
    s.suppliers = sup.suppliers;
    s.carriers = sup.carriers;
    s.storage = sup.storage;
    const idle = syncIdle(s, now);
    Object.assign(s, {
      storage: idle.storage,
      job: idle.job,
      dealers: idle.dealers,
      dirtyCash: idle.dirtyCash,
      cleanCash: idle.cleanCash,
      dealersAt: idle.dealersAt,
      launderAt: idle.launderAt,
    });
    s.rep = Math.max(0, s.rep + idle.repDelta);
    if (s.rep >= 100) note("rep100 (Cristal)");
    if (s.rep >= 500) note("rep500 (Polvo)");

    // Compras del plan (varias por minuto si llega el dinero)
    while (s.planIdx < PLAN.length && tryStep(PLAN[s.planIdx])) {
      mark(PLAN[s.planIdx]);
      s.planIdx++;
    }
    if (s.planIdx >= PLAN.length) note("plan completo");
    if (s.carriers.length > 0) note("1er transportista");
    if (s.businesses.length > 0) note("1er negocio");

    // Anuncio de rescate, si se ofrece
    if (canOfferAd(s.dirtyCash, s.cleanCash, lastAd, now)) {
      s.dirtyCash += AD_RESCUE_REWARD;
      lastAd = now;
      ads++;
    }
    // Salida de emergencia: sin sucio ni nada en camino, ensucia limpio en el HQ (el cambista se queda con parte)
    const stocked =
      (["hierba", "cristal", "polvo"] as ItemId[]).reduce(
        (x, i) => x + (s.storage[i] ?? 0),
        0,
      ) + (s.job?.remaining ?? 0);
    if (
      s.dirtyCash < 40 &&
      stocked < 10 &&
      pending(s.suppliers, s.carriers) === 0 &&
      s.cleanCash >= 100
    ) {
      s.cleanCash -= 100;
      s.dirtyCash += Math.floor(100 * CFG.suministro.rendimientoEnsuciar);
      emergencies++;
    }

    // Pedidos: cada proveedor pide lo que más falta para la receta elegida
    const recipe = RECIPES[bestRecipe()];
    const nextIsBusiness = PLAN[s.planIdx] === "B";
    for (const sp of Object.values(s.suppliers)) {
      if (sp.order || s.carriers.length === 0) continue;
      const inputs = Object.entries(recipe.inputs) as [ItemId, number][];
      const pend = (item: ItemId) =>
        Object.values(s.suppliers).reduce(
          (a, x) => a + (x.order?.item === item ? x.order.qty : 0),
          0,
        ) +
        s.carriers.reduce(
          (a, c) => a + (c.trip?.item === item ? c.trip.qty : 0),
          0,
        );
      const [item] = inputs.sort(
        (a, b) =>
          ((s.storage[a[0]] ?? 0) + pend(a[0])) / a[1] -
          ((s.storage[b[0]] ?? 0) + pend(b[0])) / b[1],
      )[0];
      const reserve = nextIsBusiness ? businessCost(s.businesses.length) : 0;
      const wallet =
        supplierCash(sp.poi.kind) === "clean" ? s.cleanCash : s.dirtyCash;
      const cash = wallet >= reserve ? Math.max(0, wallet - reserve) : wallet;
      const free =
        s.storageCap - carried(s.storage) - pending(s.suppliers, s.carriers);
      const plan = planOrder(sp, item, 9999, free, cash, now);
      if (plan.ok) {
        if (supplierCash(sp.poi.kind) === "clean") s.cleanCash -= plan.cost;
        else s.dirtyCash -= plan.cost;
        sp.order = plan.order;
      }
    }

    // Laboratorio: tantos lotes como ingredientes haya. Antes de cambiar de receta se gasta lo que sobra de la anterior
    const cook =
      (s.storage.fertilizante ?? 0) >= 2 &&
      (!s.job || s.job.recipe === "hierba")
        ? RECIPES.hierba
        : recipe;
    if (!s.job || s.job.recipe === cook.id) {
      const entries = Object.entries(cook.inputs) as [ItemId, number][];
      const n = Math.min(
        ...entries.map(([i, per]) => Math.floor((s.storage[i] ?? 0) / per)),
      );
      if (n >= 1 && s.labLevel >= cook.minLab && s.rep >= cook.minRep) {
        for (const [i, per] of entries)
          s.storage[i] = (s.storage[i] ?? 0) - per * n;
        s.job = s.job
          ? { ...s.job, remaining: s.job.remaining + n }
          : {
              recipe: cook.id,
              remaining: n,
              nextAt: now + batchDurationMs(cook.id, s.labLevel),
            };
      }
    }

    if ((m + 1) % 120 === 0) {
      const h = Math.round(((m + 1) / 60) * 10) / 10;
      rows.push(
        `${String(h).padStart(5)}h  limpio ${String(Math.round(s.cleanCash)).padStart(7)}  sucio ${String(Math.round(s.dirtyCash)).padStart(6)}  rep ${String(Math.round(s.rep)).padStart(5)}  HQ${s.hqLevel} Lab${s.labLevel} Alm${s.storageLevel}  camellos ${s.dealers.length} transp ${s.carriers.length} negocios ${s.businesses.length}  plan ${s.planIdx}/${PLAN.length}  alm ${JSON.stringify(s.storage)} lote ${s.job ? s.job.recipe + "x" + s.job.remaining : "-"} pedidos ${pending(s.suppliers, s.carriers)}`,
      );
    }
  }
  marks.ensuciadasDeEmergencia = emergencies;
  marks.anunciosDeRescate = ads;
  return { rows, log, marks, final: s };
}

describe("simulación de balance", () => {
  it("el jugador atento progresa a un ritmo razonable", () => {
    const r = simulate(72);
    const timeline = r.log
      .map((l) => `${l.t.toFixed(1)}h ${l.what}`)
      .join(" | ");
    console.log(
      "\n" +
        r.rows.join("\n") +
        "\n\nHitos: " +
        JSON.stringify(r.marks) +
        "\n\nCompras: " +
        timeline,
    );
    // Guardas de ritmo: se juega desde el minuto 0, el Cristal llega en el primer día y todo se mejora en 1-3 días
    expect(r.marks["1er negocio"]).toBeLessThan(1);
    expect(r.marks["rep100 (Cristal)"]).toBeLessThan(24);
    expect(r.marks["plan completo"]).toBeGreaterThan(24);
    expect(r.marks["plan completo"]).toBeLessThan(72);
    expect(r.final.cleanCash + r.final.dirtyCash).toBeGreaterThan(0);
  });
});
