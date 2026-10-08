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
// ⚠️ 'pin' va ACÁ y NUNCA en TIPOS_BUSCABLES: esa constante viaja como `location_types`
// a la búsqueda de Meta (searchLugares en lib/meta-ads-create.ts), y un tipo que Meta no
// conoce rompería la búsqueda de las dos pantallas de creación.
export type TipoLugar = (typeof TIPOS_BUSCABLES)[number] | 'address' | 'pin';

/** El radio TAL CUAL lo tiene Meta en un conjunto que ya corre: número y unidad. */
export type RadioMeta = { radius: number; distance_unit: 'mile' | 'kilometer' };

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
  /** Pin (un punto del mapa): la `key` es `lat,lng` con 6 decimales. */
  lat?: number | null;
  lng?: number | null;
  /** Ciudad: null = solo la ciudad. Dirección y pin: obligatorio (km). */
  radioKm?: number | null;
  /**
   * Sólo en un lugar LEÍDO de un conjunto que ya corre: el radio exacto que tiene en
   * Meta. Se re-emite idéntico —con su unidad y sin el clamp— mientras `radioKm` siga
   * valiendo lo mismo; si alguien cambia el radio, gana `radioKm`.
   *
   * ⚠️ Por qué un campo aparte y no `unidad` al lado de `radioKm` (lo que pedía el plan):
   * los desplegables del selector escriben `radioKm` en km y no saben de unidades. Con
   * `unidad: 'mile'` pegada al lugar, elegir «+25 km» sobre una ciudad que venía en
   * millas viajaba como 25 MILLAS. Acá el cambio se detecta por coherencia
   * (`radioMetaVigente`) y el selector no tiene que acordarse de nada.
   * Y por qué no pasar las millas a km y listo: 10 mi = 16,09 km, debajo del mínimo de
   * ciudad (17 km); geoSpecDe lo llevaba a 17 y el público de una ciudad que nadie tocó
   * cambiaba apenas se editaba cualquier OTRO lugar.
   */
  radioMeta?: RadioMeta | null;
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
  pin: 'Punto en el mapa',
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

/** Un punto del mapa con radio. La key es determinística: el mismo punto es el mismo lugar. */
export function lugarPin(lat: number, lng: number, radioKm: number = RADIO_DIRECCION_DEFAULT_KM): LugarMeta {
  return {
    tipo: 'pin', key: `${lat.toFixed(6)},${lng.toFixed(6)}`, nombre: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    lat, lng, radioKm: clamp(radioKm, RADIO_DIRECCION_KM.min, RADIO_DIRECCION_KM.max),
  };
}

export const KM_POR_MILLA = 1.609344;
export const kmDeRadio = (r: RadioMeta): number => (r.distance_unit === 'mile' ? r.radius * KM_POR_MILLA : r.radius);

/** ¿El radio que Meta tenía sigue siendo el elegido? (nadie lo cambió en el selector) */
export function radioMetaVigente(l: LugarMeta): boolean {
  return !!l.radioMeta && l.radioKm != null && Math.abs(kmDeRadio(l.radioMeta) - l.radioKm) < 1e-6;
}

/** «+10 mi», «+12 km»: con la unidad con que Meta lo tiene si nadie lo cambió. */
export function rotuloRadio(l: LugarMeta): string | null {
  const n = (x: number) => x.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  if (radioMetaVigente(l)) return `+${n(l.radioMeta!.radius)} ${l.radioMeta!.distance_unit === 'mile' ? 'mi' : 'km'}`;
  return l.radioKm ? `+${n(l.radioKm)} km` : null;
}

// El radio que viaja: el de Meta tal cual si sigue vigente (Meta ya lo aceptó, y un clamp
// en km sobre millas cambiaría el público), y si no, el elegido en km, al rango medido.
function radioParaMeta(l: LugarMeta, rango: { min: number; max: number }, porDefecto?: number): RadioMeta | null {
  if (radioMetaVigente(l)) return { radius: l.radioMeta!.radius, distance_unit: l.radioMeta!.distance_unit };
  const km = l.radioKm ?? porDefecto;
  return km ? { radius: clamp(km, rango.min, rango.max), distance_unit: 'kilometer' } : null;
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
        case 'city': {
          const r = l.radioKm ? radioParaMeta(l, RADIO_CIUDAD_KM) : null;
          push('cities', r ? { key: l.key, ...r } : { key: l.key });
          break;
        }
        case 'zip': push('zips', { key: l.key }); break;
        case 'neighborhood': push('neighborhoods', { key: l.key }); break;
        case 'subcity': push('subcities', { key: l.key }); break;
        case 'medium_geo_area': push('medium_geo_areas', { key: l.key }); break;
        case 'geo_market': push('geo_markets', { key: l.key }); break;
        case 'address': push('custom_locations', { address_string: l.key, ...radioParaMeta(l, RADIO_DIRECCION_KM, RADIO_DIRECCION_DEFAULT_KM) }); break;
        // El pin viaja con lat/long, no con una dirección: es lo que Meta devuelve de un
        // conjunto armado en su Ads Manager (medido el 07/10, ver lugaresDesdeMeta), y
        // re-geocodificar una dirección movería el punto. Sin coordenadas no sale.
        case 'pin':
          if (Number.isFinite(l.lat) && Number.isFinite(l.lng)) push('custom_locations', { latitude: l.lat, longitude: l.lng, ...radioParaMeta(l, RADIO_DIRECCION_KM, RADIO_DIRECCION_DEFAULT_KM) });
          break;
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
  // ⚠️ Es una lista de strings y el compilador NO avisa si le falta un tipo: sin 'pin'
  // acá, un pin elegido en el wizard desaparecía en silencio al recargar el borrador
  // (NuevaCampanaModal restaura con esto). Se arma desde ETIQUETA_TIPO, que SÍ es un
  // Record<TipoLugar> y no compila si le falta uno.
  const tipos: readonly string[] = Object.keys(ETIQUETA_TIPO);
  return raw.flatMap((x): LugarMeta[] => {
    if (typeof x === 'string') return /^[A-Za-z]{2}$/.test(x) ? [lugarPais(x)] : [];
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.tipo === 'string' && tipos.includes(o.tipo) && typeof o.key === 'string' && o.key) return [o as unknown as LugarMeta];
    }
    return [];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Los lugares de un conjunto QUE YA CORRE: el geo crudo de Meta → LugarMeta[]
// ─────────────────────────────────────────────────────────────────────────────
//
// La forma, MEDIDA el 07/10/2026 con GET /{adset}?fields=targeting (Graph v25.0) sobre
// tres conjuntos de tres cuentas conectadas (tests/meta-geo.test.ts las tiene, con las
// coordenadas corridas):
//
//   · countries: ['US', 'MX']                       — ISO-2 pelados
//   · regions: [{ key, name, country }]
//   · custom_locations: [{ latitude, longitude, radius, distance_unit, primary_city_id,
//       region_id, country }] — SIN address_string ni name: los que se arman en el Ads
//       Manager de Meta son PINES, y con radios que nuestra lista no ofrece (12, 8, 16 km)
//   · location_types: ['home', 'recent'] y también ['frequently_in', 'home', 'recent'],
//       adentro de geo_locations Y de excluded_geo_locations
//
// ⚠️ POR QUÉ HAY UNA LISTA BLANCA: el POST /{adset} con `targeting` REEMPLAZA el objeto
// entero. Re-escribir geo_locations con lo que este parser entendió borra en silencio
// toda clave que no entendió (places, country_groups, electoral_districts…): el público
// cambia y el conjunto gasta en otras zonas, sin un error. Así que se nombra en POSITIVO
// lo que se sabe re-escribir, y CUALQUIER otra cosa —una clave, un campo de una fila, una
// unidad— va a `noEntiendo` y deja los lugares en sólo lectura (aplicarLugares no toca
// nada). Equivocarse para ese lado cuesta un «cámbialo en Meta»; para el otro, plata.

/** Claves de lugar que este módulo sabe leer Y volver a escribir, con el tipo que dan. */
const CLAVE_A_TIPO: Record<string, TipoLugar> = {
  regions: 'region', cities: 'city', zips: 'zip', neighborhoods: 'neighborhood',
  subcities: 'subcity', medium_geo_areas: 'medium_geo_area', geo_markets: 'geo_market',
};
/** No son lugares: se copian TAL CUAL al re-escribir (location_types es «vive / estuvo»). */
const CLAVES_CONSERVADAS = ['location_types'] as const;
/** Campos de una fila que Meta devuelve como INFORMACIÓN (no cambian a quién se le muestra). */
const CAMPOS_INFO = ['name', 'country', 'region', 'region_id', 'primary_city', 'primary_city_id'];
const CAMPOS_RADIO = ['radius', 'distance_unit'];

export type LecturaGeo = {
  lugares: LugarMeta[];
  /** Lo que el crudo trae y esto no sabe re-escribir. Con algo acá, los lugares son de SÓLO LECTURA. */
  noEntiendo: string[];
  /** Las claves de `CLAVES_CONSERVADAS` que traía cada lado, para devolverlas iguales. */
  conservar: { geo: Record<string, unknown>; excluidos: Record<string, unknown> };
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

// Un radio que vino de Meta: número positivo y unidad conocida, o no se entiende.
function leerRadio(o: Record<string, unknown>): RadioMeta | 'no' | null {
  if (o.radius == null && o.distance_unit == null) return null;
  const r = numero(o.radius);
  const u = o.distance_unit;
  if (r == null || r <= 0 || (u !== 'mile' && u !== 'kilometer')) return 'no';
  return { radius: r, distance_unit: u };
}

function leerBolsa(g: unknown, excluir: boolean, donde: string, lec: LecturaGeo, conservar: Record<string, unknown>) {
  if (g == null) return;
  if (!esObjeto(g)) { lec.noEntiendo.push(donde); return; }
  for (const [clave, valor] of Object.entries(g)) {
    if ((CLAVES_CONSERVADAS as readonly string[]).includes(clave)) { conservar[clave] = valor; continue; }
    const tipoDeClave = CLAVE_A_TIPO[clave];
    if ((clave !== 'countries' && clave !== 'custom_locations' && !tipoDeClave) || !Array.isArray(valor)) {
      lec.noEntiendo.push(`${donde}.${clave}`);
      continue;
    }
    valor.forEach((fila, i) => {
      const ruta = `${donde}.${clave}[${i}]`;
      if (clave === 'countries') {
        if (typeof fila === 'string' && /^[A-Za-z]{2}$/.test(fila)) lec.lugares.push({ ...lugarPais(fila), excluir });
        else lec.noEntiendo.push(ruta);
        return;
      }
      if (!esObjeto(fila)) { lec.noEntiendo.push(ruta); return; }
      // Lista blanca POR FILA también: un campo que no está acá puede cambiar el público.
      const permitidos = clave === 'custom_locations'
        ? [...CAMPOS_INFO, ...CAMPOS_RADIO, 'latitude', 'longitude', 'address_string']
        : [...CAMPOS_INFO, 'key', ...(clave === 'cities' ? CAMPOS_RADIO : [])];
      const raro = Object.keys(fila).find((k) => !permitidos.includes(k));
      if (raro) { lec.noEntiendo.push(`${ruta}.${raro}`); return; }
      const radio = leerRadio(fila);
      if (radio === 'no') { lec.noEntiendo.push(`${ruta}.radius`); return; }
      const info = { pais: texto(fila.country)?.toUpperCase() ?? null, regionId: texto(fila.region_id), ciudadId: texto(fila.primary_city_id) };
      const conRadio = (l: LugarMeta): LugarMeta => (radio ? { ...l, radioKm: kmDeRadio(radio), radioMeta: radio } : l);
      if (clave === 'custom_locations') {
        // Sin radio, un punto o una dirección no se pueden volver a mandar: Meta lo exige.
        if (!radio) { lec.noEntiendo.push(`${ruta}.radius`); return; }
        const lat = numero(fila.latitude);
        const lng = numero(fila.longitude);
        const dir = texto(fila.address_string);
        if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          // Con coordenadas se re-emite el PUNTO aunque traiga dirección: re-geocodificar
          // el texto podría moverlo. La dirección, si vino, queda como el nombre.
          const p = lugarPin(lat, lng);
          lec.lugares.push(conRadio({ ...p, nombre: dir ?? texto(fila.name) ?? p.nombre, ...info, excluir }));
        } else if (dir && fila.latitude == null && fila.longitude == null) {
          lec.lugares.push(conRadio({ ...lugarDireccion(dir), ...info, excluir }));
        } else {
          lec.noEntiendo.push(ruta);
        }
        return;
      }
      const key = texto(fila.key);
      if (!key) { lec.noEntiendo.push(`${ruta}.key`); return; }
      lec.lugares.push(conRadio({
        tipo: tipoDeClave, key, nombre: texto(fila.name) ?? key, ...info,
        region: tipoDeClave === 'region' ? null : texto(fila.region), ciudad: texto(fila.primary_city), excluir,
      }));
    });
  }
}

/** El geo crudo de un conjunto (getAdsetTargeting) → los lugares, lo que no se entendió y lo que se conserva. */
export function lugaresDesdeMeta(geo: unknown, excluidos: unknown): LecturaGeo {
  const lec: LecturaGeo = { lugares: [], noEntiendo: [], conservar: { geo: {}, excluidos: {} } };
  leerBolsa(geo, false, 'geo_locations', lec, lec.conservar.geo);
  leerBolsa(excluidos, true, 'excluded_geo_locations', lec, lec.conservar.excluidos);
  return lec;
}

/** Lo que viajaría a Meta con estos lugares. Dos listas con la misma firma son el mismo público. */
export const firmaLugares = (lugares: LugarMeta[]): string => JSON.stringify(geoSpecDe(lugares));
export const lugaresCambiaron = (lectura: LecturaGeo, lugares: LugarMeta[]): boolean => firmaLugares(lugares) !== firmaLugares(lectura.lugares);

/**
 * El targeting que se guarda en un conjunto que ya corre. El geo se toca SÓLO si la firma
 * de los lugares cambió: abrir el editor y cambiar la edad devuelve el geo crudo IDÉNTICO
 * (el mismo objeto), con todo lo que esto no sabe leer adentro. Si cambió, se re-escribe
 * desde los lugares y se le devuelven las claves conservadas (location_types).
 * Y si la lectura no entendió algo, re-escribir es borrar lo que no entendió: tira.
 */
export function aplicarLugares(targeting: Record<string, unknown>, lectura: LecturaGeo, lugares: LugarMeta[]): Record<string, unknown> {
  if (!lugaresCambiaron(lectura, lugares)) return targeting;
  if (lectura.noEntiendo.length) throw new Error('Este conjunto tiene lugares que MaKo no sabe editar. Cámbialos en Meta.');
  if (!lugares.some((l) => !l.excluir)) throw new Error('Elige al menos un lugar donde mostrar los anuncios.');
  const spec = geoSpecDe(lugares);
  const out: Record<string, unknown> = { ...targeting, geo_locations: { ...spec.geo_locations, ...lectura.conservar.geo } };
  if (spec.excluded_geo_locations) out.excluded_geo_locations = { ...spec.excluded_geo_locations, ...lectura.conservar.excluidos };
  else delete out.excluded_geo_locations;
  return out;
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
const PRIORIDAD_TIPO: Record<TipoLugar, number> = { country: 0, region: 1, city: 2, medium_geo_area: 3, subcity: 4, neighborhood: 5, zip: 6, geo_market: 7, address: 8, pin: 9 };

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
