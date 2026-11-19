import { describe, expect, it } from "vitest";
import { offersFor, planHandSale, unitPrice } from "./tradeEngine";
import {
  dayKey,
  inPersonLeft,
  planOrder,
  rampMs,
  supplierCash,
} from "./supplyEngine";
import {
  SALARY_MAX_PAYS,
  SALARY_PAY,
  SALARY_PERIOD_MS,
  claimSalary,
  salaryPending,
} from "./salary";
import { isBusted, nextHeat } from "./heatEngine";
import {
  DEALER_REP_SHARE,
  BUSINESS_BILL_PER_MIN,
  POLICE_ZONE_BONUS,
  LAUNDER_DIRTY_PER_TICK,
  LAUNDER_TICK_MS,
  LAUNDER_YIELD,
} from "../data/buildings";

const day = new Date(2026, 0, 10, 12, 0);
const night = new Date(2026, 0, 10, 22, 0);
const early = new Date(2026, 0, 10, 3, 0);

describe("precios", () => {
  it("discoteca paga x2 de 20:00 a 04:00", () => {
    expect(unitPrice("nightlife", "hierba", day)).toBe(30);
    expect(unitPrice("nightlife", "hierba", night)).toBe(60);
    expect(unitPrice("nightlife", "hierba", early)).toBe(60);
  });
  it("el almacén es más barato que la farmacia", () => {
    expect(unitPrice("warehouse", "quimicos", day)).toBeLessThan(
      unitPrice("pharmacy", "quimicos", day),
    );
  });
});

describe("heat", () => {
  it("sube en zona caliente y baja fuera", () => {
    expect(nextHeat(0, true, 10)).toBe(20);
    expect(nextHeat(20, false, 10)).toBe(15);
  });
  it("se queda entre 0 y 100", () => {
    expect(nextHeat(95, true, 60)).toBe(100);
    expect(nextHeat(1, false, 60)).toBe(0);
    expect(isBusted(100)).toBe(true);
    expect(isBusted(99)).toBe(false);
  });
});

import { honestyOf, rollHonesty, syncIdle, type IdleState } from "./idleEngine";

const T0 = 1_000_000_000_000;
const idle = (over: Partial<IdleState> = {}): IdleState => ({
  storage: {},
  storageCap: 100,
  labLevel: 1,
  job: null,
  dealers: [],
  businesses: [],
  dirtyCash: 0,
  cleanCash: 0,
  dealersAt: T0,
  launderAt: T0,
  ...over,
});

describe("laboratorio (offline)", () => {
  it("produce los lotes que caben en el tiempo transcurrido", () => {
    const s = idle({
      job: { recipe: "hierba", remaining: 5, nextAt: T0 + 20_000 },
    });
    const r = syncIdle(s, T0 + 70_000); // lotes a 20, 40 y 60 s
    expect(r.storage.hierba).toBe(3);
    expect(r.job?.remaining).toBe(2);
  });
  it("termina el trabajo y lo borra", () => {
    const s = idle({
      job: { recipe: "hierba", remaining: 2, nextAt: T0 + 20_000 },
    });
    const r = syncIdle(s, T0 + 3_600_000);
    expect(r.storage.hierba).toBe(2);
    expect(r.job).toBeNull();
  });
  it("el almacén lleno detiene la producción sin perder lotes", () => {
    const s = idle({
      storageCap: 2,
      storage: { hierba: 2 },
      job: { recipe: "hierba", remaining: 3, nextAt: T0 + 1000 },
    });
    const r = syncIdle(s, T0 + 3_600_000);
    expect(r.storage.hierba).toBe(2);
    expect(r.job?.remaining).toBe(3);
  });
  it("un laboratorio mejor es más rápido", () => {
    const s = idle({
      labLevel: 3,
      job: { recipe: "hierba", remaining: 9, nextAt: T0 + 10_000 },
    });
    expect(syncIdle(s, T0 + 30_000).storage.hierba).toBe(3); // 10 s por lote
  });
});

describe("camellos (offline)", () => {
  const dealer = {
    id: "d1",
    poiId: "way/1",
    kind: "park" as const,
    name: null,
    honesty: 100,
  };
  it("venden lo más caro primero y cobran su parte", () => {
    const s = idle({ dealers: [dealer], storage: { hierba: 5, cristal: 1 } });
    const r = syncIdle(s, T0 + 60_000); // 2 ticks
    expect(r.storage).toEqual({ hierba: 4, cristal: 0 });
    expect(r.dirtyCash).toBe(Math.round(90 * 0.8) + Math.round(30 * 0.8));
  });
  it("no venden si no hay existencias", () => {
    const r = syncIdle(idle({ dealers: [dealer] }), T0 + 600_000);
    expect(r.dirtyCash).toBe(0);
  });
  it("el progreso offline se limita a 8 h", () => {
    const s = idle({ dealers: [dealer], storage: { hierba: 100000 } });
    const r = syncIdle(s, T0 + 100 * 3_600_000);
    expect(r.dirtyCash).toBe(960 * Math.round(30 * 0.8));
  });
});

describe("camellos: robo y adulteración", () => {
  const shady = (honesty: number) => ({
    id: "d2",
    poiId: "way/2",
    kind: "park" as const,
    name: "Parque Sol",
    honesty,
  });
  const run = (honesty: number) =>
    syncIdle(
      idle({ dealers: [shady(honesty)], storage: { hierba: 100000 } }),
      T0 + 8 * 3_600_000,
    );

  it("un camello 100 % fiable nunca roba ni adultera", () => {
    const r = run(100);
    expect(r.events).toHaveLength(0);
    expect(r.dealers[0].stolen ?? 0).toBe(0);
    expect(r.heatDelta).toBe(0);
  });

  it("uno poco fiable roba y adultera, y queda en el libro de cuentas", () => {
    const r = run(0);
    const d = r.dealers[0];
    expect(d.sold).toBe(960);
    expect(r.events.some((e) => e.kind === "theft")).toBe(true);
    expect(r.events.some((e) => e.kind === "cut")).toBe(true);
    expect(d.cutUnits ?? 0).toBeGreaterThan(0);
    expect(d.stolen ?? 0).toBeGreaterThan(0);
    // lo que cobras + lo que te quitó = lo que habrías cobrado
    expect((d.earned ?? 0) + (d.stolen ?? 0)).toBe(960 * Math.round(30 * 0.8));
    expect(r.dirtyCash).toBe(d.earned);
  });

  it("las adulteraciones suben el Heat y bajan la reputación", () => {
    const r = run(0);
    const cuts = r.events.filter((e) => e.kind === "cut").length;
    expect(cuts).toBeGreaterThan(0);
    expect(r.heatDelta).toBeGreaterThan(0);
  });

  it("cuanto más fiable, menos se queda", () => {
    expect(run(20).dealers[0].stolen ?? 0).toBeGreaterThan(
      run(80).dealers[0].stolen ?? 0,
    );
  });

  it("es determinista: el mismo tramo de tiempo da siempre lo mismo", () => {
    expect(run(30).dealers[0].stolen).toBe(run(30).dealers[0].stolen);
    expect(run(30).events).toEqual(run(30).events);
  });

  it("poner al día de golpe o a trozos da el mismo resultado", () => {
    const s = idle({ dealers: [shady(30)], storage: { hierba: 100000 } });
    const whole = syncIdle(s, T0 + 2 * 3_600_000);
    let step = s;
    for (let t = T0 + 600_000; t <= T0 + 2 * 3_600_000; t += 600_000)
      step = syncIdle(step, t);
    expect(step.dirtyCash).toBe(whole.dirtyCash);
    expect(step.dealers[0].stolen).toBe(whole.dealers[0].stolen);
  });

  it("los camellos dan la reputación completa por unidad", () => {
    const r = syncIdle(
      idle({ dealers: [{ ...shady(100) }], storage: { hierba: 10 } }),
      T0 + 60_000,
    ); // 2 ventas de hierba
    expect(r.repDelta).toBeCloseTo(2 * 1 * DEALER_REP_SHARE);
  });

  it("un camello antiguo sin fiabilidad guardada recibe una determinista", () => {
    expect(honestyOf({ id: "x", poiId: "p", kind: "park", name: null })).toBe(
      honestyOf({ id: "x", poiId: "p", kind: "park", name: null }),
    );
    const h = rollHonesty("cualquiera");
    expect(h).toBeGreaterThanOrEqual(30);
    expect(h).toBeLessThanOrEqual(90);
  });
});

describe("blanqueo", () => {
  const bill = (from: number, to: number, n = 1) =>
    Math.floor((to * BUSINESS_BILL_PER_MIN * n) / 60_000) -
    Math.floor((from * BUSINESS_BILL_PER_MIN * n) / 60_000);
  it("convierte sucio en limpio con comisión del 20 %", () => {
    const s = idle({
      dirtyCash: 1000,
      businesses: [{ poiId: "n/1", name: null }],
    });
    const r = syncIdle(s, T0 + 10 * LAUNDER_TICK_MS); // 10 ticks
    const washed = 10 * LAUNDER_DIRTY_PER_TICK;
    expect(r.dirtyCash).toBe(1000 - washed);
    expect(r.cleanCash).toBe(
      Math.floor(washed * LAUNDER_YIELD) + bill(T0, T0 + 10 * LAUNDER_TICK_MS),
    );
  });
  it("no blanquea más de lo que tienes", () => {
    const s = idle({
      dirtyCash: 10,
      businesses: [{ poiId: "n/1", name: null }],
    });
    const r = syncIdle(s, T0 + 3_600_000);
    expect(r.dirtyCash).toBe(0);
    expect(r.cleanCash).toBe(
      Math.floor(10 * LAUNDER_YIELD) + bill(T0, T0 + 3_600_000),
    );
  });
  it("las primeras horas no cobra comisión", () => {
    const s = idle({
      dirtyCash: 1000,
      launderFreeUntil: T0 + 10 * LAUNDER_TICK_MS,
      businesses: [{ poiId: "n/1", name: null }],
    });
    const r = syncIdle(s, T0 + 10 * LAUNDER_TICK_MS);
    const washed = 10 * LAUNDER_DIRTY_PER_TICK;
    expect(r.cleanCash).toBe(washed + bill(T0, T0 + 10 * LAUNDER_TICK_MS));
  });
  it("un negocio en zona policial blanquea un 50 % más", () => {
    const base = syncIdle(
      idle({
        dirtyCash: 5000,
        businesses: [{ poiId: "n/1", name: null }],
      }),
      T0 + 10 * LAUNDER_TICK_MS,
    );
    const boosted = syncIdle(
      idle({
        dirtyCash: 5000,
        businesses: [{ poiId: "n/1", name: null, boost: true }],
      }),
      T0 + 10 * LAUNDER_TICK_MS,
    );
    expect(5000 - boosted.dirtyCash).toBe(
      Math.floor((5000 - base.dirtyCash) * POLICE_ZONE_BONUS),
    );
  });
  it("la facturación no se pierde al sincronizar a menudo", () => {
    const biz = [{ poiId: "n/1", name: null }];
    let st = idle({ dirtyCash: 0, businesses: biz });
    const end = T0 + 600_000; // 10 min
    for (let t = T0 + 1000; t <= end; t += 1000) {
      const r = syncIdle(st, t);
      st = { ...st, ...r };
    }
    expect(st.cleanCash).toBe(
      bill(T0, T0 + Math.floor(600_000 / LAUNDER_TICK_MS) * LAUNDER_TICK_MS),
    );
    expect(st.cleanCash).toBeGreaterThanOrEqual(
      Math.floor(BUSINESS_BILL_PER_MIN * 10) - 1,
    );
  });
});

describe("arranque suave de pedidos", () => {
  it("el 1.º es corto, del 2.º al 4.º una fracción y del 5.º el normal", () => {
    const normal = 360_000;
    expect(rampMs(1, normal, 15_000)).toBe(15_000);
    expect(rampMs(2, normal, 15_000)).toBe(Math.round(normal * 0.25));
    expect(rampMs(3, normal, 15_000)).toBe(Math.round(normal * 0.5));
    expect(rampMs(4, normal, 15_000)).toBe(Math.round(normal * 0.75));
    expect(rampMs(5, normal, 15_000)).toBe(normal);
    expect(rampMs(undefined, normal, 15_000)).toBe(normal);
  });
  it("planOrder usa el número de pedido y el precio con descuento", () => {
    const sp = {
      poi: { id: "p1", kind: "pharmacy" as const, name: null, lat: 0, lng: 0 },
      level: 1,
      order: null,
    };
    const first = planOrder(sp, "fertilizante", 10, 100, 1000, T0, { seq: 1 });
    expect(first.ok && first.order.readyAt - T0).toBeLessThan(60_000);
    const normal = planOrder(sp, "fertilizante", 10, 100, 1000, T0, { seq: 9 });
    expect(normal.ok && normal.order.readyAt - T0).toBeGreaterThan(60_000);
    const full = planOrder(sp, "fertilizante", 10, 100, 1000, T0);
    const disc = planOrder(sp, "fertilizante", 10, 100, 1000, T0, {
      priceFactor: 0.75,
    });
    expect(full.ok && disc.ok && disc.cost).toBeLessThan(
      full.ok ? full.cost : 0,
    );
  });
  it("el supermercado solo vende lo doméstico y cobra en limpio", () => {
    expect(offersFor("supermarket").buy).toEqual(["fertilizante", "baterias"]);
    expect(supplierCash("supermarket")).toBe("clean");
    expect(supplierCash("pharmacy")).toBe("clean");
    expect(supplierCash("warehouse")).toBe("dirty");
  });
  it("los pedidos en persona del día se reinician cada día", () => {
    const hoy = { day: dayKey(T0), n: 3 };
    expect(inPersonLeft(hoy, T0)).toBe(0);
    expect(inPersonLeft(hoy, T0 + 86_400_000 * 2)).toBeGreaterThan(0);
    expect(inPersonLeft(undefined, T0)).toBeGreaterThan(0);
  });
});

describe("empleo de fachada", () => {
  it("acumula pagos hasta el tope y se cobran de golpe", () => {
    expect(salaryPending(T0, T0 + SALARY_PERIOD_MS - 1)).toBe(0);
    expect(salaryPending(T0, T0 + SALARY_PERIOD_MS * 2)).toBe(2);
    expect(salaryPending(T0, T0 + SALARY_PERIOD_MS * 99)).toBe(SALARY_MAX_PAYS);
    const r = claimSalary(T0, T0 + SALARY_PERIOD_MS * 2 + 5000);
    expect(r.cash).toBe(2 * SALARY_PAY);
    // el tiempo sobrante no se pierde si no se llegó al tope
    expect(r.paidAt).toBe(T0 + SALARY_PERIOD_MS * 2);
    expect(claimSalary(T0, T0 + 1000).pays).toBe(0);
  });
});

describe("venta a mano", () => {
  it("cobra el precio completo, da reputación y sube el Heat", () => {
    const r = planHandSale({ hierba: 25 }, "hierba", 10, "park", day);
    expect(r).toMatchObject({ ok: true, qty: 10, cash: 300 });
    if (r.ok) {
      expect(r.heat).toBeGreaterThan(0);
      expect(r.rep).toBe(10);
    }
  });
  it("solo vende lo que hay y solo en parques y bares", () => {
    const r = planHandSale({ hierba: 4 }, "hierba", 999, "nightlife", night);
    expect(r).toMatchObject({ ok: true, qty: 4, cash: 240 });
    expect(planHandSale({ hierba: 4 }, "hierba", 1, "pharmacy", day).ok).toBe(
      false,
    );
    expect(planHandSale({}, "hierba", 1, "park", day).ok).toBe(false);
    expect(
      planHandSale({ fertilizante: 9 }, "fertilizante", 1, "park", day).ok,
    ).toBe(false);
  });
  it("paga más que un camello (que se queda una parte)", () => {
    const hand = planHandSale({ hierba: 1 }, "hierba", 1, "park", day);
    expect(hand.ok && hand.cash).toBeGreaterThanOrEqual(Math.round(30 * 0.8));
  });
});
