// =============================================================================
// meta-geo — los LUGARES de una segmentación de Meta, igual que Meta los entiende
// =============================================================================
// Puro (sin server-only): lo usan el selector del wizard, el modal de conjuntos y
// lib/meta-ads-create.ts, y se prueba en node:test.
//
// Todo lo de acá está MEDIDO contra la Graph API v25.0 el 2026-09-11, con
// `execution_options=["validate_only"]` al crear un conjunto (valida sin crear) y
// con `act_<id>/reachestimate`, que rechaza EXACTAMENTE lo mismo:
//
//   ✔ countries, regions, cities, zips ("AR:C1425"), neighborhoods, subcities,
//     medium_geo_areas (partidos), geo_markets (DMA de EE.UU.) y custom_locations
//     con address_string + radio. Todos aceptados.
//   ✖ INCLUIR dos lugares donde uno contiene al otro → subcode 1487756 «Some
//     locations conflict». Medido: país+ciudad, provincia+ciudad, país+pin,
//     ciudad+código postal. EXCLUIR adentro de lo incluido sí vale.
//   ✔ Pero ciudad+barrio y provincia+partido Meta los ACEPTA juntos. No se
//     "corrigen" acá: sacarle al usuario algo que Meta deja sería inventar una regla.
//   ✖ Radio de ciudad menor a 17 km → 1487110. Radio de dirección menor a 1 km →
//     1487940. Dirección que no geocodifica → 1487855.
//
// ⚠️ Y la trampa que casi decide mal todo esto: `act_<id>/delivery_estimate` NO da
// error con nada de lo de arriba. Devuelve `0–0` personas para el choque, para el
// radio de 5 km y para el pin de 0,5 km. Si validás con ese endpoint, un spec que
// Meta va a rechazar parece "un público chico". El que valida es `reachestimate`.
// =============================================================================

import type { GeoLocations } from './campaign-types';

/** Los tipos que devuelve `search?type=adgeolocation`, más la dirección con radio. */
export const TIPOS_BUSCABLES = ['country', 'region', 'city', 'zip', 'neighborhood', 'subcity', 'medium_geo_area', 'geo_market'] as const;
export type TipoLugar = (typeof TIPOS_BUSCABLES)[number] | 'address';

export type LugarMeta = {
  tipo: TipoLugar;
  /** El id que Meta acepta: ISO-2 para país, "AR:C1425" para CP, el texto para una dirección. */
  key: string;
  nombre: string;
  /** country_code (ISO-2). */
  pais?: string | null;
  /** Nombre de la provincia/estado, solo para mostrar contexto. */
  region?: string | null;
  regionId?: string | null;
  /** primary_city(_id) de un código postal: la única jerarquía ciudad→hijo que Meta devuelve. */
  ciudad?: string | null;
  ciudadId?: string | null;
  /** Ciudad: null = solo la ciudad. Dirección: obligatorio (km). */
  radioKm?: number | null;
  excluir?: boolean;
};

export const ETIQUETA_TIPO: Record<TipoLugar, string> = {
  country: 'País',
  region: 'Provincia / estado',
  city: 'Ciudad',
  zip: 'Código postal',
  neighborhood: 'Barrio',
  subcity: 'Localidad',
  medium_geo_area: 'Partido / municipio',
  geo_market: 'Mercado (DMA)',
  address: 'Dirección',
};

// Límites medidos (ver cabecera). 81 km pasó el validate_only, pero Meta documenta
// 80 como techo: no se ofrece lo que puede dejar de valer sin aviso.
export const RADIO_CIUDAD_KM = { min: 17, max: 80 } as const;
export const RADIO_DIRECCION_KM = { min: 1, max: 80 } as const;
export const RADIOS_CIUDAD_KM = [17, 25, 40, 80] as const;
export const RADIOS_DIRECCION_KM = [1, 3, 5, 10, 25, 50, 80] as const;
export const RADIO_DIRECCION_DEFAULT_KM = 5;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const texto = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

/** "AR" → "Argentina", con los nombres del propio navegador/Node. Falla → el código. */
export function nombrePais(code: string): string {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function lugarPais(code: string): LugarMeta {
  const c = code.toUpperCase();
  return { tipo: 'country', key: c, nombre: nombrePais(c), pais: c };
}

export function lugarDireccion(direccion: string, radioKm: number = RADIO_DIRECCION_DEFAULT_KM): LugarMeta {
  const d = direccion.trim();
  return { tipo: 'address', key: d, nombre: d, radioKm: clamp(radioKm, RADIO_DIRECCION_KM.min, RADIO_DIRECCION_KM.max) };
}

/** Una fila de `search?type=adgeolocation` → LugarMeta. Tipos que no manejamos → null. */
export function lugarDesdeBusqueda(o: Record<string, unknown>): LugarMeta | null {
  const tipo = String(o.type ?? '') as TipoLugar;
  if (!(TIPOS_BUSCABLES as readonly string[]).includes(tipo)) return null;
  const key = texto(o.key);
  if (!key) return null;
  return {
    tipo,
    key: tipo === 'country' ? key.toUpperCase() : key,
    nombre: texto(o.name) ?? key,
    pais: texto(o.country_code)?.toUpperCase() ?? null,
    region: tipo === 'region' ? null : texto(o.region),
    regionId: texto(o.region_id),
    ciudad: texto(o.primary_city),
    ciudadId: texto(o.primary_city_id),
  };
}

export const mismoLugar = (a: LugarMeta, b: LugarMeta) => a.tipo === b.tipo && a.key === b.key;

/**
 * ¿`a` contiene a `b` de una forma que Meta RECHAZA si se incluyen los dos?
 *
 * Solo las relaciones que se midieron como choque Y que la búsqueda deja deducir
 * por id. Las que Meta acepta (ciudad+barrio, provincia+partido) devuelven false a
 * propósito. Las que no se pueden deducir (una dirección adentro de un país: la
 * dirección no trae país hasta que Meta la geocodifica) las atrapa reachestimate.
 */
export function contiene(a: LugarMeta, b: LugarMeta): boolean {
  if (mismoLugar(a, b)) return false;
  if (a.tipo === 'country') return b.tipo !== 'country' && !!b.pais && b.pais === a.key;
  if (a.tipo === 'region') return (b.tipo === 'city' || b.tipo === 'zip') && !!b.regionId && b.regionId === a.key;
  if (a.tipo === 'city') return b.tipo === 'zip' && !!b.ciudadId && b.ciudadId === a.key;
  return false;
}

/**
 * Suma un lugar. Si se INCLUYE algo que pisa a otro incluido, se queda el nuevo y
 * se devuelve lo que salió, para que la pantalla lo diga. Es el caso de todos los
 * días: el país de la cuenta viene precargado y el usuario busca su ciudad — con
 * los dos, Meta rechaza la campaña entera al publicar.
 */
export function agregarLugar(lista: LugarMeta[], nuevo: LugarMeta): { lista: LugarMeta[]; quitados: LugarMeta[]; ensancha: boolean } {
  const base = lista.filter((l) => !mismoLugar(l, nuevo));
  if (nuevo.excluir) return { lista: [...base, nuevo], quitados: [], ensancha: false };
  const quitados = base.filter((l) => !l.excluir && (contiene(l, nuevo) || contiene(nuevo, l)));
  const ensancha = quitados.some((l) => contiene(nuevo, l));
  return { lista: [...base.filter((l) => !quitados.includes(l)), nuevo], quitados, ensancha };
}

/** Lista de lugares → `geo_locations` / `excluded_geo_locations` con las claves de Meta. */
export function geoSpecDe(lugares: LugarMeta[]): { geo_locations: GeoLocations; excluded_geo_locations?: GeoLocations } {
  const armar = (ls: LugarMeta[]): GeoLocations => {
    const g: GeoLocations = {};
    const push = (k: keyof GeoLocations, v: unknown) => {
      const bolsa = g as Record<string, unknown[]>;
      (bolsa[k] ??= []).push(v);
    };
    for (const l of ls) {
      switch (l.tipo) {
        case 'country': push('countries', l.key.toUpperCase()); break;
        case 'region': push('regions', { key: l.key }); break;
        // Sin radio = solo la ciudad (validate_only lo acepta). Antes cleanGeo le
        // ponía 17 km a toda ciudad sin preguntar: ensanchaba el público en silencio.
        case 'city': push('cities', l.radioKm ? { key: l.key, radius: clamp(l.radioKm, RADIO_CIUDAD_KM.min, RADIO_CIUDAD_KM.max), distance_unit: 'kilometer' } : { key: l.key }); break;
        case 'zip': push('zips', { key: l.key }); break;
        case 'neighborhood': push('neighborhoods', { key: l.key }); break;
        case 'subcity': push('subcities', { key: l.key }); break;
        case 'medium_geo_area': push('medium_geo_areas', { key: l.key }); break;
        case 'geo_market': push('geo_markets', { key: l.key }); break;
        case 'address': push('custom_locations', { address_string: l.key, radius: clamp(l.radioKm ?? RADIO_DIRECCION_DEFAULT_KM, RADIO_DIRECCION_KM.min, RADIO_DIRECCION_KM.max), distance_unit: 'kilometer' }); break;
      }
    }
    return g;
  };
  const incluidos = lugares.filter((l) => !l.excluir);
  const excluidos = lugares.filter((l) => l.excluir);
  return { geo_locations: armar(incluidos), ...(excluidos.length ? { excluded_geo_locations: armar(excluidos) } : {}) };
}

/** Lo que había en un borrador viejo (`paises: ['AR']`) o nuevo (`lugares`). */
export function lugaresDesdeDraft(raw: unknown): LugarMeta[] {
  if (!Array.isArray(raw)) return [];
  const tipos: readonly string[] = [...TIPOS_BUSCABLES, 'address'];
  return raw.flatMap((x): LugarMeta[] => {
    if (typeof x === 'string') return /^[A-Za-z]{2}$/.test(x) ? [lugarPais(x)] : [];
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.tipo === 'string' && tipos.includes(o.tipo) && typeof o.key === 'string' && o.key) return [o as unknown as LugarMeta];
    }
    return [];
  });
}

/** "Ciudad de Córdoba, Rosario +2 (excluye 1)". */
export function resumenLugares(lugares: LugarMeta[]): string {
  const inc = lugares.filter((l) => !l.excluir).map((l) => l.nombre);
  const exc = lugares.filter((l) => l.excluir).length;
  const base = inc.length <= 2 ? inc.join(', ') : `${inc.slice(0, 2).join(', ')} +${inc.length - 2}`;
  return exc ? `${base} (excluye ${exc})` : base;
}

// Cuando el nombre empata: de lo más grande a lo más chico, que es como busca
// alguien que escribe «Córdoba» (la provincia o la ciudad, antes que un barrio).
const PRIORIDAD_TIPO: Record<TipoLugar, number> = { country: 0, region: 1, city: 2, medium_geo_area: 3, subcity: 4, neighborhood: 5, zip: 6, geo_market: 7, address: 8 };

const normalizar = (t: string) => ` ${t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

/**
 * Junta la búsqueda LOCAL (country_code = país de la cuenta) con la MUNDIAL, sin
 * duplicados, y las ordena: primero lo local, después cuánto se parece el nombre a
 * lo escrito, después el tamaño del lugar, y al final el orden de Meta.
 *
 * ⚠️ Por qué dos búsquedas y no una, medido el 2026-09-11: la mundial con todos los
 * tipos y límite 15 NO devuelve «Provincia de Córdoba» ni «Partido de Morón», y
 * «Ciudad de Córdoba» sale 12ª detrás de Colombia y España. Filtrada por AR, la
 * ciudad sale 1ª y el partido 2º. Subir el límite de la mundial no lo arregla: el
 * orden de Meta CAMBIA con el límite (la ciudad es 2ª con 50 y 5ª con 100).
 */
export function ordenarLugares(q: string, locales: LugarMeta[], mundo: LugarMeta[], max = 20): LugarMeta[] {
  const nq = normalizar(q);
  const parecido = (nombre: string) => {
    const n = normalizar(nombre);
    if (n === nq) return 0; // «Buenos Aires» = Buenos Aires
    if (n.startsWith(nq)) return 1; // «Morón» → Morón (Buenos Aires)
    if (n.includes(nq)) return 2; // «Córdoba» → Provincia de Córdoba (palabra entera: normalizar pone espacios a los lados)
    return 3;
  };
  const vistos = new Set<string>();
  const filas: Array<{ l: LugarMeta; local: boolean; orden: number }> = [];
  [...locales.map((l) => ({ l, local: true })), ...mundo.map((l) => ({ l, local: false }))].forEach(({ l, local }, orden) => {
    const id = `${l.tipo}:${l.key}`;
    if (vistos.has(id)) return;
    vistos.add(id);
    filas.push({ l, local, orden });
  });
  return filas
    .sort((a, b) => Number(b.local) - Number(a.local) || parecido(a.l.nombre) - parecido(b.l.nombre) || PRIORIDAD_TIPO[a.l.tipo] - PRIORIDAD_TIPO[b.l.tipo] || a.orden - b.orden)
    .slice(0, max)
    .map((f) => f.l);
}

// Los rechazos de segmentación que Meta devuelve por subcode. El `message` viene en
// inglés y genérico («Invalid parameter») — el que sirve es el subcode.
const ERRORES_GEO: Record<number, string> = {
  1487756: 'Hay lugares que se pisan: uno está adentro de otro, y Meta no deja incluir los dos. Quita uno (o pasa el más chico a «Excluir»).',
  1487110: 'El radio alrededor de una ciudad tiene que ir de 17 a 80 km.',
  1487940: 'El radio alrededor de una dirección tiene que ser de al menos 1 km.',
  1487855: 'Meta no encontró esa dirección. Escríbela más completa: calle, número, ciudad y país.',
};

/** Texto en español para un rechazo de segmentación de Meta, o null si no es uno. */
export function explicarErrorGeo(subcode: number | null | undefined): string | null {
  return subcode != null && ERRORES_GEO[subcode] ? ERRORES_GEO[subcode] : null;
}
