import { CFG, min } from "../data/config";

/**
 * Empleo de fachada (GDD §4 quinquies): un trabajo legal que paga Dinero Limpio sin hacer nada.
 * Se calcula contra marcas de tiempo (no hay timers), así que sigue corriendo con la app cerrada.
 */
export const SALARY_PAY = CFG.empleo.pagoLimpio;
export const SALARY_PERIOD_MS = min(CFG.empleo.minutosPorPago);
export const SALARY_MAX_PAYS = CFG.empleo.pagosMaximos;

/** Pagos acumulados que se pueden cobrar ahora (máximo SALARY_MAX_PAYS) */
export const salaryPending = (paidAt: number, now: number): number =>
  Math.max(
    0,
    Math.min(SALARY_MAX_PAYS, Math.floor((now - paidAt) / SALARY_PERIOD_MS)),
  );

/** Cobra lo acumulado: devuelve el importe y la nueva marca de tiempo (no se pierde el resto de tiempo si no llegó al tope) */
export function claimSalary(
  paidAt: number,
  now: number,
): { pays: number; cash: number; paidAt: number } {
  const pays = salaryPending(paidAt, now);
  if (pays < 1) return { pays: 0, cash: 0, paidAt };
  return {
    pays,
    cash: pays * SALARY_PAY,
    paidAt: pays >= SALARY_MAX_PAYS ? now : paidAt + pays * SALARY_PERIOD_MS,
  };
}
