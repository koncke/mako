// =============================================================================
// geo-regiones — de un nombre de región (de Meta, de una visita) a su código ISO 3166-2, en cualquier país
// =============================================================================
// Puro y sin `server-only`: lo usan el mapa (app/dashboard/MapaGeo.tsx) y los tests. Es la generalización de
// lo que hacía app/dashboard/MapaMexico.tsx sólo para México, con las MISMAS reglas:
//
//   · IGUALDAD EXACTA sobre el nombre normalizado (sin acentos, minúsculas, sin puntos), nunca un prefijo. Con
//     el `startsWith` de antes, la Ciudad de México y el Estado de México —los dos estados con más impresiones
//     de la cuenta del ws1— salían en CERO (docs/hallazgos-ads.md).
//   · LO QUE NO SE UBICA VA APARTE, NUNCA A CERO: se cuenta en `sinUbicar` y el mapa lo dice. Una región que no
//     vino tampoco es un cero: es «Sin datos».
//   · UN NOMBRE DE DOS REGIONES NO UBICA NINGUNA. Natural Earth le pone «Buenos Aires» a la provincia y a la
//     ciudad; elegir una sería pintar el número en la región equivocada sin que nada lo diga. Va a `sinUbicar`.
//   · Los nombres MEDIDOS de Meta (ALIAS_MEDIDOS) ganan sobre los de la geometría: son la fuente que se midió.
//     Hoy sólo hay de México (11/10/2026, Graph v25.0, cuenta del ws1). ⚠️ Los de otros países NO están
//     medidos: Argentina es el primero que hay que medir, con la cuenta del ws13.
//   · Un CÓDIGO también ubica: «MX-JAL», o «JAL» a secas (así manda la región el header
//     `x-vercel-ip-country-region` de una visita).

export type RegionGeo = { codigo: string; nombre: string; alias?: readonly string[] };
export type ValorRegion = { etiqueta: string; valor: number };

/** Sin acentos, en minúsculas, sin puntos y con un espacio entre palabras: «México D.F.» → «mexico df». */
export function normalizarRegion(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Los 32 estados de México por su código ISO 3166-2, con el nombre que se dibuja. */
export const ESTADOS_MX: Readonly<Record<string, string>> = {
  'MX-AGU': 'Aguascalientes', 'MX-BCN': 'Baja California', 'MX-BCS': 'Baja California Sur', 'MX-CAM': 'Campeche',
  'MX-CHP': 'Chiapas', 'MX-CHH': 'Chihuahua', 'MX-COA': 'Coahuila', 'MX-COL': 'Colima', 'MX-CMX': 'Ciudad de México',
  'MX-DUR': 'Durango', 'MX-GUA': 'Guanajuato', 'MX-GRO': 'Guerrero', 'MX-HID': 'Hidalgo', 'MX-JAL': 'Jalisco',
  'MX-MEX': 'Estado de México', 'MX-MIC': 'Michoacán', 'MX-MOR': 'Morelos', 'MX-NAY': 'Nayarit', 'MX-NLE': 'Nuevo León',
  'MX-OAX': 'Oaxaca', 'MX-PUE': 'Puebla', 'MX-QUE': 'Querétaro', 'MX-ROO': 'Quintana Roo', 'MX-SLP': 'San Luis Potosí',
  'MX-SIN': 'Sinaloa', 'MX-SON': 'Sonora', 'MX-TAB': 'Tabasco', 'MX-TAM': 'Tamaulipas', 'MX-TLA': 'Tlaxcala',
  'MX-VER': 'Veracruz', 'MX-YUC': 'Yucatán', 'MX-ZAC': 'Zacatecas',
};

/**
 * Los otros nombres con que llega cada región, POR PAÍS. Los de México salen de la medición del 11/10/2026
 * (Meta: «Distrito Federal», «State of Mexico», «Coahuila de Zaragoza», «Michoacán de Ocampo», «Querétaro
 * Arteaga», «San Luis Potosi»). «México» a secas es el ESTADO (así lo nombra la geometría), nunca el país.
 */
const ALIAS_MEDIDOS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  MX: {
    'MX-BCN': ['baja california norte'],
    'MX-COA': ['coahuila de zaragoza'],
    'MX-CMX': ['distrito federal', 'mexico city', 'cdmx', 'df', 'mexico df', 'ciudad de mexico df', 'federal district'],
    'MX-MEX': ['mexico', 'state of mexico', 'mexico state', 'edomex'],
    'MX-MIC': ['michoacan de ocampo'],
    'MX-QUE': ['queretaro arteaga', 'queretaro de arteaga'],
    'MX-VER': ['veracruz de ignacio de la llave', 'veracruz llave'],
  },
};

/** Las regiones que este módulo conoce sin bajar nada (México, para que el mapa de hoy no dependa de la red). */
export function regionesConocidas(pais: string): RegionGeo[] | null {
  if (pais.toUpperCase() !== 'MX') return null;
  return Object.entries(ESTADOS_MX).map(([codigo, nombre]) => ({ codigo, nombre }));
}

export type Diccionario = {
  /** nombre normalizado → código (sólo los nombres de UNA región). */
  porNombre: ReadonlyMap<string, string>;
  /** código en mayúsculas → código; y el sufijo («JAL») → código, si es de una sola región. */
  porCodigo: ReadonlyMap<string, string>;
  /** código → el nombre que se dibuja. */
  nombres: ReadonlyMap<string, string>;
};

/**
 * El diccionario de un país: sus regiones (de la geometría, o las conocidas) más los alias medidos. Un nombre
 * que comparten dos regiones se descarta; un alias medido gana sobre la geometría y sobre esa regla.
 */
export function diccionario(pais: string, regiones?: readonly RegionGeo[] | null): Diccionario {
  const P = pais.toUpperCase();
  const base = regiones && regiones.length ? regiones : regionesConocidas(P) ?? [];
  const conocidas = regionesConocidas(P);
  const candidatos = new Map<string, Set<string>>();
  const anotar = (nombre: string, codigo: string) => {
    const k = normalizarRegion(nombre);
    if (!k) return;
    (candidatos.get(k) ?? candidatos.set(k, new Set()).get(k)!).add(codigo);
  };
  const nombres = new Map<string, string>();
  const porCodigo = new Map<string, string>();
  const sufijos = new Map<string, Set<string>>();
  for (const r of base) {
    nombres.set(r.codigo, r.nombre);
    anotar(r.nombre, r.codigo);
    for (const a of r.alias ?? []) anotar(a, r.codigo);
    porCodigo.set(r.codigo.toUpperCase(), r.codigo);
    const suf = r.codigo.includes('-') ? r.codigo.slice(r.codigo.indexOf('-') + 1).toUpperCase() : '';
    if (suf) (sufijos.get(suf) ?? sufijos.set(suf, new Set()).get(suf)!).add(r.codigo);
  }
  // Los nombres que este módulo sabe (México) se dibujan como acá, aunque la geometría diga otra cosa.
  for (const r of conocidas ?? []) { if (nombres.has(r.codigo)) nombres.set(r.codigo, r.nombre); anotar(r.nombre, r.codigo); }
  for (const [suf, set] of sufijos) if (set.size === 1) porCodigo.set(suf, [...set][0]);
  const porNombre = new Map<string, string>();
  for (const [k, set] of candidatos) if (set.size === 1) porNombre.set(k, [...set][0]);
  for (const [codigo, otros] of Object.entries(ALIAS_MEDIDOS[P] ?? {})) {
    if (!nombres.has(codigo)) continue;
    for (const a of otros) porNombre.set(normalizarRegion(a), codigo);
  }
  return { porNombre, porCodigo, nombres };
}

/** El código de una región de ese país, o null si no se ubica (o si su nombre es de dos regiones). */
export function codigoEn(dic: Diccionario, etiqueta: string): string | null {
  const t = etiqueta.trim();
  if (!t) return null;
  // Un código: «MX-JAL», o el sufijo a secas si viene como código (mayúsculas o dígitos, hasta 3).
  const cod = dic.porCodigo.get(t.toUpperCase());
  if (cod && (t.includes('-') || /^[A-Z0-9]{1,3}$/.test(t))) return cod;
  return dic.porNombre.get(normalizarRegion(t)) ?? null;
}

/** Atajo de un solo uso: el código de `nombre` en `pais`. Para muchas regiones, armar el diccionario una vez. */
export function codigoDeRegion(pais: string, nombre: string, regiones?: readonly RegionGeo[] | null): string | null {
  return codigoEn(diccionario(pais, regiones), nombre);
}

/**
 * Las regiones repartidas en el país. Dos nombres de la misma región se suman (el mapa sólo acepta métricas
 * que se suman). Lo que no se ubica y trae algo va a `sinUbicar`: nunca se dibuja en cero.
 */
export function ubicarEn(dic: Diccionario, valores: readonly ValorRegion[]): { porCodigo: Map<string, number>; sinUbicar: ValorRegion[] } {
  const porCodigo = new Map<string, number>();
  const sinUbicar: ValorRegion[] = [];
  for (const r of valores) {
    const valor = Number.isFinite(r.valor) ? r.valor : 0;
    const cod = codigoEn(dic, r.etiqueta);
    if (cod) porCodigo.set(cod, (porCodigo.get(cod) ?? 0) + valor);
    else if (valor !== 0) sinUbicar.push(r);
  }
  return { porCodigo, sinUbicar };
}

export function ubicarRegiones(pais: string, valores: readonly ValorRegion[], regiones?: readonly RegionGeo[] | null) {
  return ubicarEn(diccionario(pais, regiones), valores);
}

/** Lo que no es una región: el «(sin dato)» del agregador y el «Unknown» de Meta. No votan al adivinar el país. */
const NO_ES_REGION = new Set(['sin dato', 'unknown', 'desconocido', 'otros']);

/**
 * ¿De qué país son estas regiones? Se usa cuando el gráfico dice `pais: 'auto'` y el server no mandó el país
 * de la cuenta. Gana el país con más etiquetas que son nombre de una de SUS regiones, si es uno solo y cubre al
 * menos la mitad de las etiquetas (y dos, o la única que hay). Si no, null: el mapa pide elegir, no adivina.
 */
export function adivinarPais(etiquetas: readonly string[], indice: Readonly<Record<string, readonly string[]>>): string | null {
  const validas = [...new Set(etiquetas.map(normalizarRegion).filter((k) => k && !NO_ES_REGION.has(k)))];
  if (!validas.length) return null;
  let mejor: string | null = null, max = 0, empate = false;
  for (const [pais, nombres] of Object.entries(indice)) {
    const set = new Set(nombres.map(normalizarRegion));
    const n = validas.filter((k) => set.has(k)).length;
    if (n > max) { mejor = pais; max = n; empate = false; } else if (n === max && n > 0) empate = true;
  }
  if (!mejor || empate) return null;
  if (max < Math.min(2, validas.length) || max * 2 < validas.length) return null;
  return mejor;
}

/** El índice de lo que este módulo conoce sin bajar nada: alcanza para reconocer México sin la red. */
export function indiceConocido(): Record<string, string[]> {
  return { MX: [...Object.values(ESTADOS_MX), ...Object.values(ALIAS_MEDIDOS.MX).flat()] };
}
