// =============================================================================
// Media Buyer — DÓNDE y HASTA: la zona y la fecha de fin del negocio (PURO: lo prueban los tests)
// =============================================================================
// Martín a la agencia de Thiago, 29/10/2026 [29:00-29:20]: el Media Buyer «solo decide si apagar anuncios, prender otros,
// subir el presupuesto», con parámetros: «quiero que sea en tal zona, país o ciudad, solamente hasta tal fecha».
//
// DÓNDE: una lista de lugares de Meta (país, provincia o ciudad, elegidos con la búsqueda de lugares de siempre). Con una
// zona, MaKo NO PRENDE ni SUBE el presupuesto de un conjunto que muestre anuncios fuera de ella. Bajar y pausar no pasan por
// acá: cuidar la plata nunca se frena. Un conjunto está DENTRO si cada lugar que incluye está adentro de un lugar de la zona;
// ⚠️ «no sé» (un punto del mapa, un barrio sin país, un geo que no se pudo leer) cuenta como FUERA: errar para el lado de no
// tocar, la misma regla que el padre que no vino en la lectura (motor.ts → prendido).
//
// HASTA: una fecha (el día del NEGOCIO, AGENTS.md: «Hoy es el día del NEGOCIO») para toda la cuenta y, si hace falta, otra
// por campaña. Pasada la fecha, la corrida y el vigía del día pausan la campaña (táctica `hasta`, se lanza sola: es la regla
// de la persona, no una recomendación). Cerca de la fecha, Surf no sube: Meta tarda días en aprender después de un salto, y
// un presupuesto más alto en los últimos días se gasta antes de rendir.
// =============================================================================

import { mismoLugar, type LugarMeta, type TipoLugar } from '@/lib/meta-geo';

/** Un lugar de la zona: lo que hace falta para saber qué contiene (país, provincia y ciudad, con sus ids). */
export type LugarZona = Pick<LugarMeta, 'tipo' | 'key' | 'nombre'> & { pais?: string | null; region?: string | null; regionId?: string | null };

/** Lo que se puede elegir como zona: lo que contiene a otros por id (meta-geo.ts → contiene). */
export const TIPOS_ZONA: readonly TipoLugar[] = ['country', 'region', 'city'];
export const ZONA_MAX = 25;

/** Faltan menos días que esto para la fecha de fin: Surf no sube el presupuesto (y una persona tampoco, por acá). */
export const HASTA_SIN_SUBIR_DIAS = 3;

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Valida la zona que llega (de la pantalla o de la API). `[]` es «sin zona». */
export function validarZona(x: unknown): { ok: true; valor: LugarZona[] } | { ok: false; error: string } {
  if (x == null) return { ok: true, valor: [] };
  if (!Array.isArray(x)) return { ok: false, error: 'La zona es una lista de lugares.' };
  if (x.length > ZONA_MAX) return { ok: false, error: `La zona va hasta ${ZONA_MAX} lugares.` };
  const out: LugarZona[] = [];
  for (const o of x) {
    const f = (o ?? {}) as Record<string, unknown>;
    const tipo = texto(f.tipo) as TipoLugar | null;
    const key = texto(f.key);
    if (!tipo || !(TIPOS_ZONA as readonly string[]).includes(tipo)) return { ok: false, error: 'La zona es de países, provincias o ciudades (de buscar_lugares_meta).' };
    if (!key || key.length > 40) return { ok: false, error: 'Cada lugar de la zona lleva su id de Meta.' };
    const pais = texto(f.pais)?.toUpperCase() ?? (tipo === 'country' ? key.toUpperCase() : null);
    if (tipo !== 'country' && !pais) return { ok: false, error: `«${texto(f.nombre) ?? key}» no trae su país: búscalo de nuevo.` };
    const l: LugarZona = {
      tipo, key: tipo === 'country' ? key.toUpperCase() : key, nombre: (texto(f.nombre) ?? key).slice(0, 120), pais,
      region: tipo === 'city' ? texto(f.region)?.slice(0, 120) ?? null : null, regionId: tipo === 'city' ? texto(f.regionId) : null,
    };
    if (!out.some((y) => y.tipo === l.tipo && y.key === l.key)) out.push(l);
  }
  return { ok: true, valor: out };
}

/** ¿El lugar `l` (de un conjunto) es, o cuelga por id de, el lugar `z` de la zona? Sin mirar radios. */
function porId(z: LugarZona, l: LugarMeta): boolean {
  if (mismoLugar({ tipo: z.tipo, key: z.key, nombre: z.nombre }, l)) return true;
  // Un país contiene todo lo que trae su código (también un barrio o un partido con `country`). Una provincia, lo que trae su
  // `region_id` (la ciudad, el código postal); una ciudad, el código postal por `primary_city_id`: las mismas relaciones por
  // id que `contiene` (meta-geo.ts), más las que Meta acepta juntas y acá también cuentan como adentro.
  if (z.tipo === 'country') return !!l.pais && l.pais === z.key;
  if (z.tipo === 'region') return !!l.regionId && l.regionId === z.key;
  if (z.tipo === 'city') return !!l.ciudadId && l.ciudadId === z.key;
  return false;
}

/** Con radio, el público sale de los límites: «Madrid +80 km» llega a Toledo. Sólo un PAÍS de la zona lo contiene (hallazgo 6). */
const conRadio = (l: LugarMeta): boolean => l.radioKm != null || !!l.radioMeta;

/** ¿El lugar `l` está adentro del lugar `z` de la zona? */
function adentroDe(z: LugarZona, l: LugarMeta): boolean {
  return porId(z, l) && (z.tipo === 'country' || !conRadio(l));
}

export type VeredictoZona = 'dentro' | 'fuera' | 'no_se';

/**
 * Los lugares que INCLUYE un conjunto, contra la zona. `noEntiendo` es lo del crudo que meta-geo no supo leer (del lado
 * incluido, eso es «no sé»). Lo excluido no cuenta: sólo achica.
 */
export function veredictoDeLugares(zona: readonly LugarZona[], lugares: readonly LugarMeta[], noEntiendo: readonly string[] = []): { veredicto: VeredictoZona; fuera: LugarMeta[] } {
  if (!zona.length) return { veredicto: 'dentro', fuera: [] };
  const incluidos = lugares.filter((l) => !l.excluir);
  if (!incluidos.length || noEntiendo.some((r) => r.startsWith('geo_locations'))) return { veredicto: 'no_se', fuera: [] };
  const fuera = incluidos.filter((l) => !zona.some((z) => adentroDe(z, l)));
  if (!fuera.length) return { veredicto: 'dentro', fuera: [] };
  // Un lugar sin país ni provincia (un punto del mapa, una dirección) no se puede ubicar, y una ciudad con radio que cuelga de
  // una provincia o ciudad de la zona puede salirse o no: las dos son «no sé».
  const noSe = (l: LugarMeta) => (!l.pais && !l.regionId && l.tipo !== 'country') || (conRadio(l) && zona.some((z) => porId(z, l)));
  return { veredicto: fuera.some((l) => !noSe(l)) ? 'fuera' : 'no_se', fuera };
}

/** Varios conjuntos (una campaña): fuera si alguno está fuera, «no sé» si alguno no se sabe, dentro si todos. */
export function juntarVeredictos(vs: readonly VeredictoZona[]): VeredictoZona {
  if (!vs.length) return 'no_se';
  if (vs.includes('fuera')) return 'fuera';
  if (vs.includes('no_se')) return 'no_se';
  return 'dentro';
}

/** «Madrid, Barcelona +2». */
export function nombreZona(zona: readonly LugarZona[]): string {
  if (!zona.length) return 'toda la cuenta';
  const n = zona.slice(0, 2).map((z) => z.nombre).join(', ');
  return zona.length > 2 ? `${n} +${zona.length - 2}` : n;
}

/** Lo que dice el freno de la zona, para la decisión bloqueada y la API. */
export function motivoZona(v: VeredictoZona, entidad: string, zona: readonly LugarZona[]): string | null {
  if (v === 'dentro') return null;
  return v === 'fuera'
    ? `«${entidad}» muestra anuncios fuera de tu zona (${nombreZona(zona)}): MaKo no lo prende ni le sube el presupuesto.`
    : `No pude confirmar que «${entidad}» muestre anuncios sólo en tu zona (${nombreZona(zona)}): MaKo no lo prende ni le sube el presupuesto.`;
}

// ── HASTA ───────────────────────────────────────────────────────────────────

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Una fecha YYYY-MM-DD que existe (sin «2026-02-31»), o null. */
export function fechaValida(x: unknown): string | null {
  const s = texto(x);
  if (!s || !RE_FECHA.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  // El año, razonable: un campo de fecha a medio escribir manda «0002-11-05», que existe y pausaría todo (hallazgo 4).
  const anio = Number(s.slice(0, 4));
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s && anio >= 2020 && anio <= 2100 ? s : null;
}

/** Las fechas por campaña que llegan: `{ id de campaña: YYYY-MM-DD }`. */
export function validarHastaCampanas(x: unknown): { ok: true; valor: Record<string, string> } | { ok: false; error: string } {
  if (x == null) return { ok: true, valor: {} };
  if (typeof x !== 'object' || Array.isArray(x)) return { ok: false, error: 'Las fechas por campaña van como { campaña: fecha }.' };
  const out: Record<string, string> = {};
  const entradas = Object.entries(x as Record<string, unknown>);
  if (entradas.length > 300) return { ok: false, error: 'Hasta 300 campañas con fecha.' };
  for (const [id, f] of entradas) {
    if (!/^\d{1,30}$/.test(id)) return { ok: false, error: 'Cada campaña va por su id numérico de Meta.' };
    const v = fechaValida(f);
    if (!v) return { ok: false, error: `La fecha de la campaña ${id} va como AAAA-MM-DD.` };
    out[id] = v;
  }
  return { ok: true, valor: out };
}

/**
 * Lo GUARDADO, leído entrada por entrada (hallazgo 8): una fecha rota no puede llevarse las otras 299, y una zona ilegible no
 * puede leerse como «sin zona» (eso sería subir en todos lados). Si había zona y no se entiende ninguna entrada, queda una zona
 * que no contiene nada: MaKo no prende ni sube hasta que alguien la arregle en Ajustes.
 */
export const ZONA_ILEGIBLE: LugarZona = { tipo: 'country', key: 'ZZ', nombre: 'Zona ilegible: elígela de nuevo', pais: 'ZZ' };
export function leerZonaGuardada(x: unknown): LugarZona[] {
  if (!Array.isArray(x) || !x.length) return [];
  const ok = x.flatMap((o) => { const v = validarZona([o]); return v.ok ? v.valor : []; }).slice(0, ZONA_MAX);
  return ok.length ? ok : [ZONA_ILEGIBLE];
}
export function leerHastaGuardadas(x: unknown): Record<string, string> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: Record<string, string> = {};
  for (const [id, f] of Object.entries(x as Record<string, unknown>)) { const v = fechaValida(f); if (/^\d{1,30}$/.test(id) && v) out[id] = v; }
  return out;
}

/** La fecha de fin que vale para una campaña: la suya, y si no tiene, la de toda la cuenta. */
export function finDeCampana(c: { hasta: string | null; hastaCampanas: Readonly<Record<string, string>> }, campanaId: string | null): string | null {
  // `?.`: una config armada a mano (un test, una fila vieja) puede no traer el mapa.
  return (campanaId ? c.hastaCampanas?.[campanaId] : null) ?? c.hasta ?? null;
}

/** Días de `hoy` a `fin` (0 = es el último día; negativo = ya pasó). */
export function diasHasta(hoy: string, fin: string): number {
  return Math.round((Date.parse(`${fin}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400_000);
}

const fmtFecha = (f: string): string => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/**
 * ¿La fecha de fin frena esto? Prender o subir algo cuya campaña ya pasó su fecha: sí. Subir con menos de
 * `HASTA_SIN_SUBIR_DIAS` por delante: sí. `hoy` null = no se pudo leer la zona horaria del negocio: con una fecha puesta,
 * «no sé» frena lo que sube el gasto. Bajar y pausar nunca.
 */
export function frenoPorFecha(tipo: 'activar' | 'subir_presupuesto' | string, fin: string | null, hoy: string | null): string | null {
  if (!fin || (tipo !== 'activar' && tipo !== 'subir_presupuesto')) return null;
  if (!hoy) return `Tiene fecha de fin (${fmtFecha(fin)}) y no pude leer el día de hoy en tu zona horaria: MaKo no sube el gasto.`;
  const d = diasHasta(hoy, fin);
  if (d < 0) return `Llegó a su fecha de fin (${fmtFecha(fin)}): MaKo no la vuelve a prender ni le sube el presupuesto.`;
  if (tipo === 'subir_presupuesto' && d < HASTA_SIN_SUBIR_DIAS) {
    return d === 0 ? `Hoy es su último día (${fmtFecha(fin)}): subir el presupuesto ahora no rinde.`
      : `Le ${d === 1 ? 'queda 1 día' : `quedan ${d} días`} (hasta el ${fmtFecha(fin)}): subir el presupuesto ahora no rinde.`;
  }
  return null;
}

/** Lo mínimo del árbol que necesita la regla de la fecha (motor.ts → NodoMB). */
type NodoFecha = { id: string; nombre: string; nivel: 'campaign' | 'adset' | 'ad'; configurado: string | null };

/** Una pausa por fecha de fin: la campaña entera (pausarla frena todo lo de adentro). */
export type PausaPorFecha = { campana: NodoFecha; fin: string };

/**
 * Las campañas PRENDIDAS cuya fecha de fin ya pasó. La clave de la decisión lleva la fecha (no el día): se pausa UNA vez; si
 * después una persona la vuelve a prender, MaKo no la pisa (la misma regla que con lo que pausó una persona). Sin `hoy`, nada.
 */
export function pausasPorFecha(arbol: readonly NodoFecha[], c: { hasta: string | null; hastaCampanas: Readonly<Record<string, string>> }, hoy: string | null): PausaPorFecha[] {
  if (!hoy) return [];
  const out: PausaPorFecha[] = [];
  for (const n of arbol) {
    if (n.nivel !== 'campaign' || n.configurado !== 'ACTIVE') continue;
    const fin = finDeCampana(c, n.id);
    if (fin && diasHasta(hoy, fin) < 0) out.push({ campana: n, fin });
  }
  return out;
}

export const claveHasta = (campanaId: string, fin: string): string => `hasta:campaign:${campanaId}:${fin}`;

/**
 * Las pausas por fecha YA GUARDADAS que todavía no salieron (abierta, fallida o frenada), de las campañas que hoy siguen pasadas
 * de fecha y prendidas. ⚠️ La clave no lleva el día (una vez por fecha), así que una pausa que no salió la primera vez (Zernio
 * caído, la corrida cortada a mitad, un «mirá la cuenta» por chat que sólo propone) no vuelve a guardarse: hay que relanzar la
 * guardada, o la campaña gasta pasada su fecha para siempre (revisión adversarial del 29/10, hallazgo 1). Lo `aplicada` no se
 * relanza: si después una persona la prendió, gana la persona.
 */
export function pausasPendientes<T extends { clave: string; tactica: string; estado: string }>(pausas: readonly PausaPorFecha[], decisiones: readonly T[]): T[] {
  const claves = new Set(pausas.map((p) => claveHasta(p.campana.id, p.fin)));
  return decisiones.filter((d) => d.tactica === 'hasta' && claves.has(d.clave) && (d.estado === 'abierta' || d.estado === 'fallida' || d.estado === 'bloqueada'));
}

/** La decisión de una pausa por fecha, lista para guardar (la Propuesta del motor, sin importar sus tipos acá). */
export function propuestaHasta(p: PausaPorFecha) {
  return {
    clave: claveHasta(p.campana.id, p.fin), tipo: 'pausar' as const, tactica: 'hasta' as const, nivel: 'campaign' as const,
    entidadId: p.campana.id, entidadNombre: p.campana.nombre, campanaNombre: null,
    titulo: `Pausar la campaña «${p.campana.nombre}»: llegó a su fecha de fin`,
    titular: `Tu fecha de fin era el ${fmtFecha(p.fin)}`,
    porque: [
      `Le pusiste fecha de fin: el ${fmtFecha(p.fin)}.`,
      'Pasada la fecha, MaKo la pausa sola: es tu regla, no una recomendación.',
      'Si la quieres seguir, cambia la fecha en Ajustes o en Campañas y préndela.',
    ],
    numeros: [{ condicion: 'Fecha de fin', valor: fmtFecha(p.fin), porQue: 'La pusiste tú' }],
    antes: { estado: 'ACTIVE' as const }, despues: { estado: 'PAUSED' as const },
  };
}
