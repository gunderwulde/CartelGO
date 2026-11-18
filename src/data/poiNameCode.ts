/**
 * Código numérico del nombre de un lugar. El servidor (función de borde poi-cell) guarda en la caché
 * compartida SOLO este código, no texto: cada cliente lo traduce a su idioma (ver poiNames.ts), así que
 * todos ven el mismo lugar con el mismo nombre en su idioma y se pueden añadir idiomas sin tocar el servidor.
 * Sin imports a propósito: la función de borde tiene una copia literal de este fichero. Mantener sincronizadas.
 *
 * [tipo de local, semilla]: el tipo es el índice+1 en VENUES (0 = sin tipo conocido) y la semilla sale del id.
 */
export type NameId = [venue: number, seed: number];

/** Tipos de local del mapa con tema propio. Solo se puede AÑADIR al final: el orden forma parte de la caché. */
export const VENUES = [
  "laundry",
  "dry_cleaning",
  "car_wash",
  "car_repair",
  "hairdresser",
  "beauty",
  "florist",
  "bakery",
  "butcher",
  "convenience",
  "kiosk",
  "fast_food",
  "cafe",
  "restaurant",
  "ice_cream",
  "bookstore",
  "clothing_store",
  "bar",
  "pub",
  "nightclub",
];

/** Tipo de local que usamos como tema: la clase del mapa o, si no la conocemos, la subclase. */
export function venueOf(cls: string, subclass: string): string {
  return VENUES.includes(cls) ? cls : VENUES.includes(subclass) ? subclass : "";
}

/** Número entero estable (0..2^32-1) a partir de un texto (FNV-1a). */
export function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Código del nombre de un lugar a partir de su id y de su tipo de local ("" si no tiene). */
export function nameCode(id: string, venue: string): NameId {
  return [venue ? VENUES.indexOf(venue) + 1 : 0, hash32(id)];
}
