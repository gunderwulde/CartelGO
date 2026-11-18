import raw from "./balance.json";

/**
 * Valores de balance del juego, cargados de balance.json (el único sitio para tocar números).
 * Los módulos de src/data los exponen con los nombres de siempre.
 */
export const CFG = raw;

/** Segundos → milisegundos */
export const sec = (s: number): number => s * 1000;
/** Minutos → milisegundos */
export const min = (m: number): number => m * 60_000;
