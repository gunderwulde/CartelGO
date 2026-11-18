/**
 * Convención de moneda: Dinero Limpio con «$» y Dinero Sucio con «₡». Todos los importes que ve el jugador
 * pasan por aquí (o por el componente Money) para que nunca haya dudas de cuál se gasta o se cobra.
 */
export type Cash = "clean" | "dirty";

export const CASH_SYMBOL: Record<Cash, string> = { clean: "$", dirty: "₡" };

/** Importe con su símbolo: money(800, "clean") → "$800"; money(800, "dirty") → "₡800". */
export const money = (amount: number, kind: Cash): string =>
  `${CASH_SYMBOL[kind]}${amount}`;
