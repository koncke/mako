// =============================================================================
// copywriter/catalogos — los ángulos y las estructuras que ve la pantalla del Copywriter (PURO)
// =============================================================================
// La biblioteca es UNA: /admin/guiones (lib/guion-angulos.ts y lib/guion-estructuras.ts, con su override del super
// admin). El Copywriter la LEE y no la copia (docs/diseno-copywriter.md, D6). A la pantalla viaja sólo lo que dibuja
// (id, nombre, emoji, cuándo y las etiquetas): el paquete entero de cada ángulo (hooks, reglas, preguntas) lo arma el
// server para la IA, nunca el navegador.
// =============================================================================

import type { AnguloGuion } from '../guion-angulos';
import type { EstructuraGuion } from '../guion-estructuras';
import { ESTRUCTURAS_VSL_DEFAULT } from '../vsl-estructuras';
import { TIPOS_GUION, esTipoGuion, type TipoGuion } from './tipos';

export type AnguloLite = { id: string; nombre: string; emoji: string; cuando: string };
export type EstructuraLite = { id: string; nombre: string; emoji: string; cuando: string; etiquetas: string[]; tipos: TipoGuion[] };
export type CatalogosCopy = { angulos: AnguloLite[]; estructuras: EstructuraLite[] };

/**
 * Los tipos a los que calza una estructura. Las de la biblioteca nacieron para anuncios: sin el campo, son de «Ad»
 * (docs/diseno-copywriter.md, D6).
 */
export function tiposDe(e: Pick<EstructuraGuion, 'id'> & { tipos?: unknown }): TipoGuion[] {
  const t = Array.isArray(e.tipos) ? e.tipos.filter(esTipoGuion) : [];
  return t.length ? [...new Set(t)] : ['ad'];
}

export function catalogosLite(angulos: readonly AnguloGuion[], estructuras: readonly (EstructuraGuion & { tipos?: unknown })[]): CatalogosCopy {
  return {
    angulos: angulos.filter((a) => a.activo).map((a) => ({ id: a.id, nombre: a.nombre, emoji: a.emoji, cuando: a.cuando })),
    estructuras: estructuras.filter((e) => e.activo).map((e) => ({ id: e.id, nombre: e.nombre, emoji: e.emoji, cuando: e.cuando, etiquetas: [...e.etiquetas], tipos: tiposDe(e) })),
  };
}

/**
 * Las estructuras que se ofrecen para un tipo. Si la biblioteca todavía no tiene ninguna de ese tipo, se ofrecen
 * TODAS (un selector vacío no deja armar el guion), y la pantalla lo dice con `propias: false`.
 */
export function estructurasDelTipo(c: CatalogosCopy, tipo: TipoGuion): { estructuras: EstructuraLite[]; propias: boolean } {
  const propias = c.estructuras.filter((e) => e.tipos.includes(tipo));
  return propias.length ? { estructuras: propias, propias: true } : { estructuras: c.estructuras, propias: false };
}

/** La estructura que arma una página nueva de ese tipo: la primera de las suyas. */
export function estructuraPorDefecto(c: CatalogosCopy, tipo: TipoGuion): EstructuraLite | null {
  const { estructuras, propias } = estructurasDelTipo(c, tipo);
  return propias ? estructuras[0] ?? null : null;
}

/**
 * Las estructuras de VSL de la casa (lib/vsl-estructuras.ts) con la forma de la biblioteca, de tipo «vsl»
 * (docs/diseno-copywriter.md, D12). Viven aparte porque las de la biblioteca son de ANUNCIO CORTO; el Copywriter las
 * suma a lo que lee (la pantalla, la IA) sin escribirlas en el override del super admin.
 */
export const ESTRUCTURAS_VSL_COPY: readonly EstructuraGuion[] = ESTRUCTURAS_VSL_DEFAULT.map((v) => ({
  id: v.id, nombre: v.nombre, emoji: v.emoji, cuando: v.cuando, etiquetas: [...v.etiquetas], guia: v.guia, activo: v.activo, tipos: ['vsl'],
}));

/** La biblioteca más las de VSL (una de la biblioteca con el mismo id gana). */
export function conVsl<T extends EstructuraGuion>(estructuras: readonly T[]): EstructuraGuion[] {
  const ids = new Set(estructuras.map((e) => e.id));
  return [...estructuras, ...ESTRUCTURAS_VSL_COPY.filter((v) => !ids.has(v.id))];
}

export const CATALOGOS_VACIOS: CatalogosCopy = { angulos: [], estructuras: [] };
export { TIPOS_GUION };
