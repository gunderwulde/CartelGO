import { useEffect, useRef, useState } from "react";
import { PRODUCTS } from "../data/items";
import { carried } from "../services/tradeEngine";
import type { PoiKind } from "../types/poi";
import { useBaseStore } from "../store/baseStore";
import { useCelebrateStore } from "../store/celebrateStore";
import type { Tab } from "./HqPanel";
import { TUTORIAL_STEPS, useTutorialStore } from "../store/tutorialStore";

/** Adónde lleva el botón «Ir» */
export type GoTarget =
  { type: "hq"; tab: Tab } | { type: "poi"; kinds: PoiKind[] };

interface Step {
  title: string;
  hint: string;
  go: GoTarget;
}

/** Primeros pasos. Cada uno se da por hecho solo cuando se cumple (flags[i+1] de abajo; el 0 es colocar el HQ) */
const STEPS: Step[] = [
  {
    title: "Haz contacto con un proveedor",
    hint: "Acércate a un almacén, farmacia o supermercado, toca su icono y pulsa «Establecer contacto».",
    go: { type: "poi", kinds: ["warehouse", "pharmacy", "supermarket"] },
  },
  {
    title: "Contrata un transportista",
    hint: "En el HQ, pestaña Suministro. Él recogerá en cualquier proveedor y te traerá la mercancía.",
    go: { type: "hq", tab: "suministro" },
  },
  {
    title: "Haz tu primer pedido",
    hint: "En el HQ, Suministro: pide Fertilizante a tu proveedor.",
    go: { type: "hq", tab: "suministro" },
  },
  {
    title: "Cocina Hierba Risona",
    hint: "Cuando llegue la mercancía, en el HQ, Lab: lanza lotes de Hierba.",
    go: { type: "hq", tab: "lab" },
  },
  {
    title: "Vende tu mercancía",
    hint: "Ve a un parque o bar, toca su icono y vende a mano lo que has cocinado. Más adelante puedes contratar un camello para que venda por ti.",
    go: { type: "poi", kinds: ["park", "nightlife"] },
  },
  {
    title: "Monta un negocio tapadera",
    hint: "Ve a una lavandería o autolavado y cómpralo: blanquea tu Dinero Sucio.",
    go: { type: "poi", kinds: ["cover"] },
  },
];
if (STEPS.length !== TUTORIAL_STEPS)
  throw new Error("TUTORIAL_STEPS no coincide con los pasos");

/** Una cifra por hito: HQ colocado, contacto, transportista, pedido, producción, primera venta (a mano o camello), negocio */
function useFlags(): string {
  return useBaseStore((s) =>
    [
      s.hq !== null,
      Object.keys(s.suppliers).length > 0,
      s.carriers.length > 0,
      Object.values(s.suppliers).some((x) => x.order) ||
        carried(s.storage) > 0 ||
        s.job !== null ||
        s.carriers.some((c) => c.trip),
      s.job !== null ||
        PRODUCTS.some((p) => (s.storage[p] ?? 0) > 0) ||
        s.dealers.some((d) => (d.sold ?? 0) > 0),
      s.dealers.length > 0 || s.reputation > 0,
      s.businesses.length > 0,
    ]
      .map(Number)
      .join(""),
  );
}

const ANIM_MS = 350;

/**
 * Guía de primeros pasos. El progreso avanza solo; la tarjeta se muestra al pulsar el botón del tutorial
 * (entra desde la derecha, alineada con él, y sale por la izquierda) y se cierra tocando fuera.
 */
export default function Tutorial({
  onGo,
}: {
  onGo: (target: GoTarget) => void;
}) {
  const { step, done, open, setStep, finish, show, hide } = useTutorialStore();
  const flags = useFlags();
  const first = useRef(true);
  const [finishing, setFinishing] = useState(false);
  // 'in' | 'out' | null: animación de entrada/salida; null = no montada
  const [phase, setPhase] = useState<"in" | "out" | null>(null);

  // Avance automático de pasos
  useEffect(() => {
    if (done || flags[0] !== "1") return; // con el HQ sin colocar, lo explica su propio cartel
    const silent = first.current; // la primera pasada con partida ya avanzada no regala ni celebra
    first.current = false;
    let n = step;
    while (n < STEPS.length && flags[n + 1] === "1") n++;
    if (n === step) return;
    if (silent) {
      if (n >= STEPS.length) finish();
    } else {
      useBaseStore.getState().grantFavors(n - step);
      useCelebrateStore
        .getState()
        .celebrate(
          n >= STEPS.length
            ? "¡Tutorial completado!"
            : "¡Paso completado! +1 favor",
        );
      if (n >= STEPS.length) {
        setFinishing(true);
        show();
      }
    }
    setStep(n);
  }, [flags, step, done, setStep, finish, show]);

  // Entrada / salida animada y ocultación a los 5 s
  useEffect(() => {
    if (open) {
      setPhase("in");
      return;
    }
    setPhase((p) => (p === "in" ? "out" : p));
  }, [open]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = window.setTimeout(() => {
      setPhase(null);
      if (finishing) {
        setFinishing(false);
        finish();
      }
    }, ANIM_MS);
    return () => window.clearTimeout(t);
  }, [phase, finishing, finish]);

  if (done || flags[0] !== "1" || phase === null) return null;
  // Siempre por encima del resto de pantallas (HQ, comercio), por debajo de los avisos
  const base =
    "fixed inset-x-3 top-[4rem] cartoon-card bg-yellow-200! p-3 z-[45] " +
    (phase === "in" ? "tutorial-in" : "tutorial-out");

  const backdrop =
    phase === "in" ? (
      <div className="fixed inset-0 z-[44]" onClick={hide} aria-hidden />
    ) : null;

  if (step >= STEPS.length) {
    return (
      <>
        {backdrop}
        <div className={base}>
          <p className="text-sm font-black leading-tight">
            ¡Ya tienes el negocio montado!
          </p>
          <p className="text-xs font-bold leading-snug">
            Mejora el HQ, sube la reputación y desbloquea Cristal Azul y Polvo
            Estelar. Vigila a tus camellos.
          </p>
        </div>
      </>
    );
  }

  const current = STEPS[step];
  return (
    <>
      {backdrop}
      <div className={base}>
        <p className="text-xs font-black opacity-70">
          Primeros pasos {step + 1}/{STEPS.length} · +1 favor
        </p>
        <p className="text-sm font-black leading-tight">{current.title}</p>
        <p className="text-xs font-bold leading-snug mb-1">{current.hint}</p>
        <div className="flex items-center gap-3">
          <button
            className="cartoon-btn px-3 py-0.5 text-xs"
            onClick={() => {
              hide();
              onGo(current.go);
            }}
          >
            Ir
          </button>
          <button
            className="min-h-11 px-1 text-xs font-black underline"
            onClick={finish}
          >
            Saltar
          </button>
        </div>
      </div>
    </>
  );
}
