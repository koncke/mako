// =============================================================================
// Los filtros del CRM sobreviven a un F5 y a irse de la tab
// =============================================================================
// Pedido de Martín (10/10/2026): «Si refresco o me voy de pestaña y vuelvo, se deben
// mantener siempre los filtros».
//
// Se guardan en el navegador (localStorage): son una PREFERENCIA de quien mira, no un dato
// del negocio, y ninguna URL ni prop los trae, así que no pisan ninguna decisión. La clave
// lleva el CLIENTE y el EMBUDO: las etapas son de cada embudo (las de uno no existen en
// otro), y el super admin mira varios clientes desde el mismo navegador.
//
// Puro y sin 'use client' para que el test lo EJECUTE (tests/crm-filtro-ads.test.ts). Lo
// que llega del navegador se lee como texto ajeno: cualquier cosa que no tenga la forma
// esperada se descarta, y una etapa que ya no existe en el embudo no vuelve (con ella
// elegida el tablero quedaría vacío sin ninguna casilla para destildarla).
// =============================================================================

export type OrdenGuardado = 'manual' | 'llegada';

/**
 * Las tres bandas del Kanban (Activo · Nutrición · Descartado), en el orden en que se dibujan.
 * Es `KANBAN_BANDS` de app/crm/CrmBoard.tsx: vive acá porque el saneo tiene que saber cuáles
 * existen, y el tablero las importa de acá para que no haya dos listas.
 */
export const BANDAS_KANBAN = ['pipeline', 'nutricion', 'salidas'] as const;
export type BandaKanban = (typeof BANDAS_KANBAN)[number];

export type FiltrosGuardados = {
  etapas: string[];
  origenes: string[];
  campanas: string[];
  anuncios: string[];
  /** El «Ordenar» que la persona eligió; null = el de base del embudo. */
  orden: OrdenGuardado | null;
  /**
   * Las bandas del Kanban que la persona APAGÓ desde «Filtrar › Mostrar». Vacío = las tres a la
   * vista, que es el default.
   *
   * ⚠️ SE GUARDAN LAS APAGADAS, NO LAS PRENDIDAS: un valor guardado antes de que existiera este
   * campo (o uno roto) no trae nada, y «nada» tiene que leerse como «todo a la vista». Guardando
   * las prendidas, la ausencia sería «ninguna», y nunca puede quedar ninguna.
   *
   * ⚠️ Y SE GUARDAN, AUNQUE EL 27/09/2026 MARTÍN PIDIÓ LO CONTRARIO para los tres botones («que
   * al entrar al CRM […] estén siempre activos»). Desde el 12/10/2026 (punto 25) ya no son tres
   * botones sueltos: son una categoría más de «Filtrar», y el 10/10 pidió que los filtros se
   * mantengan «siempre». Lo que aquel pedido protegía —entrar y no ver un lead sin saber por qué—
   * lo cubre ahora el número sobre «Filtrar», que cuenta esta categoría como un filtro más, y
   * «Limpiar filtros» las vuelve a prender.
   */
  ocultas: BandaKanban[];
};

export const SIN_FILTROS: FiltrosGuardados = { etapas: [], origenes: [], campanas: [], anuncios: [], orden: null, ocultas: [] };

/** Las bandas apagadas, saneadas: sólo las que existen, sin repetir, y nunca las tres (el tablero
 *  quedaría sin una columna y nada en pantalla diría por qué: con las tres, se prenden todas). */
export function bandasOcultas(v: unknown): BandaKanban[] {
  const ok = textos(v).filter((b): b is BandaKanban => (BANDAS_KANBAN as readonly string[]).includes(b));
  return ok.length >= BANDAS_KANBAN.length ? [] : ok;
}

/** Una clave por cliente (`ws` de la pestaña; null = el propio) y por embudo (null = el del negocio). */
export function claveFiltros(ws: number | null, funnel: number | null): string {
  return `mako.crm.filtros.${ws ?? 'propio'}.${funnel ?? 'negocio'}`;
}

const textos = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 300))] : [];

/** Lo guardado, saneado. Sin nada guardado, o roto, devuelve SIN_FILTROS. */
export function leerFiltros(texto: string | null, etapasValidas: Set<string>): FiltrosGuardados {
  if (!texto) return SIN_FILTROS;
  let crudo: unknown;
  try { crudo = JSON.parse(texto); } catch { return SIN_FILTROS; }
  if (!crudo || typeof crudo !== 'object') return SIN_FILTROS;
  const o = crudo as Record<string, unknown>;
  return {
    etapas: textos(o.etapas).filter((k) => etapasValidas.has(k)),
    origenes: textos(o.origenes),
    campanas: textos(o.campanas),
    anuncios: textos(o.anuncios),
    orden: o.orden === 'manual' || o.orden === 'llegada' ? o.orden : null,
    ocultas: bandasOcultas(o.ocultas),
  };
}

export function escribirFiltros(f: FiltrosGuardados): string {
  return JSON.stringify(f);
}
