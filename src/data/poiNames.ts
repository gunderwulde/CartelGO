import { hash32, VENUES, type NameId } from "./poiNameCode";

/**
 * Nombres de los lugares del mapa, traducidos en el cliente. El servidor solo guarda un código numérico
 * (ver poiNameCode.ts); aquí se convierte en un nombre inventado en el idioma del jugador juntando piezas
 * de varias listas con una plantilla. Es estable (sale de la semilla) y temático: depende del tipo de
 * local que dice el mapa. Nunca se usan los nombres reales de OpenStreetMap.
 * Para añadir un idioma: crear su Locale (listas + plantillas) y registrarlo en LOCALES.
 */
type NameKind =
  "warehouse" | "pharmacy" | "park" | "nightlife" | "police" | "cover";
type Gender = "m" | "f";
type Word = readonly [string, Gender];
type Adj = readonly [string, string];

interface Theme {
  /** Tipo de local: "Panadería", "Bar"... */
  types: Word[];
  /** Palabras propias del tema para "de(l) ...": "Horno de la Miga" */
  nouns?: Word[];
}

const w = (s: string, g: Gender): Word => [s, g];

/** Temas por tipo de local del mapa (clase/subclase de OpenMapTiles) o, si no hay, por rol del juego (`kind:...`). */
const THEMES: Record<string, Theme> = {
  laundry: {
    types: [
      w("Lavandería", "f"),
      w("Lavadero", "m"),
      w("Lavandería Exprés", "f"),
    ],
    nouns: [
      w("Espuma", "f"),
      w("Calcetín", "m"),
      w("Centrifugado", "m"),
      w("Blanqueo", "m"),
      w("Pinza", "f"),
      w("Colada", "f"),
    ],
  },
  dry_cleaning: {
    types: [w("Tintorería", "f"), w("Limpieza en Seco", "f")],
    nouns: [
      w("Percha", "f"),
      w("Mancha", "f"),
      w("Traje", "m"),
      w("Plancha", "f"),
      w("Corbata", "f"),
    ],
  },
  car_wash: {
    types: [w("Autolavado", "m"), w("Lavadero de Coches", "m")],
    nouns: [
      w("Rodillo", "m"),
      w("Manguera", "f"),
      w("Burbuja", "f"),
      w("Parabrisas", "m"),
      w("Cera", "f"),
    ],
  },
  car_repair: {
    types: [w("Taller", "m"), w("Mecánica", "f"), w("Taller Mecánico", "m")],
    nouns: [
      w("Tuerca", "f"),
      w("Pistón", "m"),
      w("Llave Inglesa", "f"),
      w("Chasis", "m"),
      w("Aceite", "m"),
      w("Cárter", "m"),
    ],
  },
  hairdresser: {
    types: [w("Peluquería", "f"), w("Barbería", "f"), w("Salón", "m")],
    nouns: [
      w("Tijera", "f"),
      w("Navaja", "f"),
      w("Melena", "f"),
      w("Flequillo", "m"),
      w("Permanente", "f"),
      w("Peine", "m"),
    ],
  },
  beauty: {
    types: [w("Estética", "f"), w("Centro de Belleza", "m"), w("Spa", "m")],
    nouns: [
      w("Uña", "f"),
      w("Pestaña", "f"),
      w("Mascarilla", "f"),
      w("Cera", "f"),
      w("Espejo", "m"),
      w("Esmalte", "m"),
    ],
  },
  florist: {
    types: [w("Floristería", "f"), w("Jardinera", "f"), w("Flores", "f")],
    nouns: [
      w("Margarita", "f"),
      w("Pétalo", "m"),
      w("Maceta", "f"),
      w("Ramo", "m"),
      w("Girasol", "m"),
      w("Cactus", "m"),
    ],
  },
  bakery: {
    types: [w("Panadería", "f"), w("Horno", "m"), w("Pastelería", "f")],
    nouns: [
      w("Miga", "f"),
      w("Barra", "f"),
      w("Trigo", "m"),
      w("Hogaza", "f"),
      w("Bollo", "m"),
      w("Harina", "f"),
    ],
  },
  butcher: {
    types: [w("Carnicería", "f"), w("Charcutería", "f")],
    nouns: [
      w("Chuleta", "f"),
      w("Cuchillo", "m"),
      w("Jamón", "m"),
      w("Costilla", "f"),
      w("Chorizo", "m"),
      w("Hacha", "f"),
    ],
  },
  convenience: {
    types: [
      w("Colmado", "m"),
      w("Ultramarinos", "m"),
      w("Tienda 24h", "f"),
      w("Bazar", "m"),
      w("Supermercado", "m"),
    ],
    nouns: [
      w("Cesta", "f"),
      w("Oferta", "f"),
      w("Lata", "f"),
      w("Esquina", "f"),
      w("Chuche", "f"),
      w("Vecino", "m"),
    ],
  },
  kiosk: {
    types: [w("Kiosco", "m"), w("Quiosco", "m")],
    nouns: [
      w("Pipa", "f"),
      w("Chicle", "m"),
      w("Periódico", "m"),
      w("Cromo", "m"),
      w("Gominola", "f"),
    ],
  },
  fast_food: {
    types: [
      w("Hamburguesería", "f"),
      w("Bocatería", "f"),
      w("Kebab", "m"),
      w("Freiduría", "f"),
    ],
    nouns: [
      w("Patata", "f"),
      w("Salsa", "f"),
      w("Bocata", "m"),
      w("Grasa", "f"),
      w("Croqueta", "f"),
      w("Nugget", "m"),
    ],
  },
  cafe: {
    types: [w("Cafetería", "f"), w("Café", "m")],
    nouns: [
      w("Cortado", "m"),
      w("Taza", "f"),
      w("Cucharilla", "f"),
      w("Churro", "m"),
      w("Terraza", "f"),
    ],
  },
  restaurant: {
    types: [
      w("Restaurante", "m"),
      w("Mesón", "m"),
      w("Asador", "m"),
      w("Trattoria", "f"),
    ],
    nouns: [
      w("Cuchara", "f"),
      w("Menú", "m"),
      w("Sartén", "f"),
      w("Mantel", "m"),
      w("Guiso", "m"),
      w("Tenedor", "m"),
    ],
  },
  ice_cream: {
    types: [w("Heladería", "f"), w("Gelatería", "f")],
    nouns: [
      w("Cucurucho", "m"),
      w("Nata", "f"),
      w("Polo", "m"),
      w("Sorbete", "m"),
      w("Fresa", "f"),
      w("Barquillo", "m"),
    ],
  },
  bookstore: {
    types: [w("Librería", "f"), w("Papelería", "f")],
    nouns: [
      w("Página", "f"),
      w("Novela", "f"),
      w("Tinta", "f"),
      w("Estantería", "f"),
      w("Lápiz", "m"),
      w("Capítulo", "m"),
    ],
  },
  clothing_store: {
    types: [
      w("Boutique", "f"),
      w("Modas", "f"),
      w("Mercería", "f"),
      w("Tienda de Ropa", "f"),
    ],
    nouns: [
      w("Botón", "m"),
      w("Aguja", "f"),
      w("Dedal", "m"),
      w("Percha", "f"),
      w("Bufanda", "f"),
      w("Calcetín", "m"),
    ],
  },
  bar: {
    types: [
      w("Bar", "m"),
      w("Taberna", "f"),
      w("Tasca", "f"),
      w("Cervecería", "f"),
      w("Garito", "m"),
    ],
    nouns: [
      w("Caña", "f"),
      w("Barril", "m"),
      w("Tapa", "f"),
      w("Barra", "f"),
      w("Resaca", "f"),
      w("Chupito", "m"),
      w("Taburete", "m"),
    ],
  },
  pub: {
    types: [w("Pub", "m"), w("Taproom", "m"), w("Bar", "m")],
    nouns: [
      w("Pinta", "f"),
      w("Dardo", "m"),
      w("Trébol", "m"),
      w("Espuma", "f"),
      w("Jarra", "f"),
    ],
  },
  nightclub: {
    types: [
      w("Discoteca", "f"),
      w("Club", "m"),
      w("Sala", "f"),
      w("Antro", "m"),
    ],
    nouns: [
      w("Bola de Espejos", "f"),
      w("Madrugada", "f"),
      w("Reservado", "m"),
      w("Cola", "f"),
      w("Estroboscopio", "m"),
      w("Pista", "f"),
    ],
  },
  "kind:nightlife": {
    types: [w("Bar", "m"), w("Pub", "m"), w("Garito", "m"), w("Taberna", "f")],
    nouns: [w("Caña", "f"), w("Madrugada", "f"), w("Barra", "f")],
  },
  "kind:park": {
    types: [
      w("Parque", "m"),
      w("Plaza", "f"),
      w("Jardín", "m"),
      w("Glorieta", "f"),
      w("Alameda", "f"),
      w("Rincón", "m"),
    ],
    nouns: [
      w("Banco", "m"),
      w("Palomo", "m"),
      w("Columpio", "m"),
      w("Fuente", "f"),
      w("Ardilla", "f"),
      w("Sombra", "f"),
      w("Césped", "m"),
      w("Paloma", "f"),
    ],
  },
  "kind:police": {
    types: [
      w("Comisaría", "f"),
      w("Cuartel", "m"),
      w("Retén", "m"),
      w("Puesto", "m"),
      w("Cuartelillo", "m"),
    ],
    nouns: [
      w("Porra", "f"),
      w("Sirena", "f"),
      w("Gorra", "f"),
      w("Multa", "f"),
      w("Placa", "f"),
      w("Esposa", "f"),
      w("Ley", "f"),
    ],
  },
  "kind:pharmacy": {
    types: [
      w("Farmacia", "f"),
      w("Botica", "f"),
      w("Droguería", "f"),
      w("Parafarmacia", "f"),
      w("Herbolario", "m"),
    ],
    nouns: [
      w("Pastilla", "f"),
      w("Jarabe", "m"),
      w("Probeta", "f"),
      w("Receta", "f"),
      w("Aspirina", "f"),
      w("Jeringuilla", "f"),
      w("Tos", "f"),
    ],
  },
  "kind:warehouse": {
    types: [
      w("Almacén", "m"),
      w("Nave", "f"),
      w("Depósito", "m"),
      w("Cobertizo", "m"),
      w("Trastienda", "f"),
      w("Hangar", "m"),
      w("Tinglado", "m"),
    ],
    nouns: [
      w("Palé", "m"),
      w("Carretilla", "f"),
      w("Candado", "m"),
      w("Gotera", "f"),
      w("Contenedor", "m"),
      w("Caja", "f"),
      w("Muelle", "m"),
    ],
  },
  "kind:cover": {
    types: [
      w("Tienda", "f"),
      w("Bazar", "m"),
      w("Negocio", "m"),
      w("Local", "m"),
    ],
  },
};

/** Dueños: "Bar Paco", "Farmacia Doña Rosa". Compartidos por todos los temas. */
const OWNERS = [
  "Paco",
  "Manolo",
  "Chema",
  "Pepe",
  "Nacho",
  "Lola",
  "Doña Rosa",
  "Don Remedios",
  "Doña Aspirina",
  "Don Jarabe",
  "El Chivato",
  "El Cojo",
  "El Tuerto",
  "La Viuda",
  "Paco el Largo",
  "Santa Rita",
  "Sor Pastilla",
  "Dr. Lagrimón",
  "Dr. Tos",
  "Los Hermanos Pérez",
  "Los Tres Cerditos",
  "Los Cuatro Remedios",
  "La Hermana Amparo",
  "Don Gato",
  "Doña Pelos",
  "Mari Carmen",
  "Juanito",
  "El Primo de Antonio",
  "La Tía Concha",
  "Nada Raro",
  "Los Sobrinos",
  "Cuñado Fran",
  "Don Dinero",
  "Tomás el Rápido",
  "La Nena",
  "El Gallego",
  "Mister Cheque",
  "Madame Lupa",
  "Rafi",
  "El Compadre",
];

/** Sustantivos generales para "de(l) ...": "Bar del Gato", "Taller de la Luna". */
const NOUNS: Word[] = [
  w("Gato", "m"),
  w("Perro", "m"),
  w("Loro", "m"),
  w("Lobo", "m"),
  w("Burro", "m"),
  w("Pollo", "m"),
  w("Sapo", "m"),
  w("Tío", "m"),
  w("Cura", "m"),
  w("Sol", "m"),
  w("Mono", "m"),
  w("Rey", "m"),
  w("Puente", "m"),
  w("Tigre", "m"),
  w("Pirata", "m"),
  w("Barrio", "m"),
  w("Luna", "f"),
  w("Vaca", "f"),
  w("Rana", "f"),
  w("Esperanza", "f"),
  w("Suerte", "f"),
  w("Cabra", "f"),
  w("Gallina", "f"),
  w("Abuela", "f"),
  w("Estrella", "f"),
  w("Farola", "f"),
  w("Tómbola", "f"),
  w("Pantera", "f"),
  w("Reina", "f"),
  w("Rumba", "f"),
];

/** Adjetivos (masculino, femenino). */
const ADJECTIVES: Adj[] = [
  ["Dorado", "Dorada"],
  ["Loco", "Loca"],
  ["Feliz", "Feliz"],
  ["Oscuro", "Oscura"],
  ["Cósmico", "Cósmica"],
  ["Sospechoso", "Sospechosa"],
  ["Discreto", "Discreta"],
  ["Veloz", "Veloz"],
  ["Azul", "Azul"],
  ["Bueno", "Buena"],
  ["Honrado", "Honrada"],
  ["Misterioso", "Misteriosa"],
  ["Legal", "Legal"],
  ["Tranquilo", "Tranquila"],
  ["Clandestino", "Clandestina"],
  ["Gordo", "Gorda"],
  ["Elegante", "Elegante"],
  ["Nuevo", "Nueva"],
  ["Viejo", "Vieja"],
  ["Rojo", "Roja"],
  ["Fino", "Fina"],
  ["Salvaje", "Salvaje"],
  ["Simpático", "Simpática"],
  ["Cutre", "Cutre"],
  ["Premium", "Premium"],
  ["Artesanal", "Artesanal"],
  ["Perfecto", "Perfecta"],
  ["Inocente", "Inocente"],
  ["Atómico", "Atómica"],
  ["Fantástico", "Fantástica"],
];

const dePart = ([word, g]: Word): string =>
  g === "m" ? `del ${word}` : `de la ${word}`;

/** Plantillas del castellano; la elegida sale de la semilla. */
const ES_TEMPLATES: ((p: Parts) => string)[] = [
  (p) => `${p.type} ${p.owner}`,
  (p) => `${p.type} ${p.adj(p.typeGender)}`,
  (p) => `${p.type} ${dePart(p.noun)}`,
  (p) => `${p.type} ${dePart(p.noun)} ${p.adj(p.noun[1])}`,
];

interface Parts {
  type: string;
  typeGender: Gender;
  owner: string;
  noun: Word;
  /** Adjetivo concordado con el género dado */
  adj: (g: Gender) => string;
}

interface Locale {
  themes: Record<string, Theme>;
  owners: string[];
  nouns: Word[];
  adjectives: Adj[];
  templates: ((p: Parts) => string)[];
}

export type Lang = "es";
const LOCALES: Record<Lang, Locale> = {
  es: {
    themes: THEMES,
    owners: OWNERS,
    nouns: NOUNS,
    adjectives: ADJECTIVES,
    templates: ES_TEMPLATES,
  },
};

let currentLang: Lang = "es";
export const setLang = (lang: Lang): void => {
  currentLang = lang;
};

/** Número estable entre 0 y 1 a partir de una semilla y una sal. */
const unit = (seed: number, salt: string): number =>
  hash32(`${salt}:${seed}`) / 4294967296;
const pick = <T>(list: readonly T[], seed: number, salt: string): T =>
  list[Math.floor(unit(seed, salt) * list.length)];

/** Nombre de un lugar a partir de su código, en el idioma pedido (por defecto, el actual). */
export function localizeName(
  code: NameId,
  kind: NameKind,
  lang: Lang = currentLang,
): string {
  const loc = LOCALES[lang];
  const [venueIdx, seed] = code;
  const venue = venueIdx > 0 ? (VENUES[venueIdx - 1] ?? "") : "";
  const theme = loc.themes[venue] ?? loc.themes[`kind:${kind}`];
  const [type, typeGender] = pick(theme.types, seed, "t");
  // Casi siempre una palabra del tema ("Panadería de la Miga"); a veces una general
  const themed = theme.nouns && unit(seed, "q") < 0.7;
  const noun = pick(themed && theme.nouns ? theme.nouns : loc.nouns, seed, "n");
  const parts: Parts = {
    type,
    typeGender,
    owner: pick(loc.owners, seed, "o"),
    noun,
    adj: (g) => pick(loc.adjectives, seed, "a")[g === "m" ? 0 : 1],
  };
  return pick(loc.templates, seed, "p")(parts);
}

/** Nombre a mostrar: el código del servidor traducido; si el lugar no lo trae, uno de respaldo estable por su id. */
export function displayName(p: {
  id: string;
  kind: NameKind;
  name?: string | null;
  nameId?: NameId | null;
}): string {
  if (p.nameId) return localizeName(p.nameId, p.kind);
  return p.name ?? localizeName([0, hash32(p.id)], p.kind);
}
