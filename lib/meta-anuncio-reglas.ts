// =============================================================================
// meta-anuncio-reglas — cuándo un lead de Meta que YA estaba se anuncia igual (F117, 18/11/2026)
// =============================================================================
// «Lo inmediato» de un lead de formulario (el aviso, los flujos, las automatizaciones: `alNacerLeadDeMeta`) sale sólo con
// el INSERT, a propósito: Meta y Zernio reentregan, el poll repasa el día cada 10 minutos, y una reentrega no es un lead
// nuevo. El hueco: si la puerta que lo creó se cae DESPUÉS del insert (supabase-js devuelve error con la fila grabada, la
// conversión a Meta tira, la función se corta), el reintento lo encuentra (`created: false`) y nadie lo anuncia nunca.
//
// La cura es una MARCA en el historial del lead (`LINEA_LEAD_ANUNCIADO`, campo «Meta»), que `alNacerLeadDeMeta` escribe
// ANTES de anunciar (reclamar va antes de mandar: un aviso de más es peor que uno que falta). Un reintento anuncia sólo si
// falta la marca y lo demás de acá dice que es el mismo lead nuevo que se cayó. Sin `server-only`: se prueba ejecutándolo
// (tests/meta-anuncio-reintento.test.ts).
// =============================================================================

import { esNuevoParaElNegocio } from './meta-leads-poll-reglas';

/** El campo y la línea del historial que dicen «este lead ya se anunció». En la ficha se lee como un hecho más. */
export const CAMPO_ANUNCIO = 'Meta';
export const LINEA_LEAD_ANUNCIADO = 'MaKo avisó de este lead nuevo';

/**
 * Desde cuándo este negocio marca lo que anuncia: lo anota el PRIMER reclamo de cada negocio (una fila de `app_settings`,
 * sin migración). Un lead nacido antes no tiene marca porque la marca no existía, no porque no se anunció: sin esto, el
 * primer poll después del despliegue volvía a anunciar todos los leads del día.
 */
export const CLAVE_MARCA_DESDE = 'meta.lead_anunciado.desde';

/**
 * Margen sobre esa fecha: el despliegue no es instantáneo (un pedido que ya corría en la versión de antes anuncia sin
 * marca), y quince minutos cubren de sobra a una función de 300 s.
 */
export const MARGEN_DESPLIEGUE_MS = 15 * 60_000;

/**
 * Tolerancia entre la hora del formulario (Meta) y la del alta (la base): dos relojes distintos. El lead que NACIÓ de ese
 * formulario se dio de alta después de llenarlo; uno que ya estaba (la persona vino antes por WhatsApp y después llenó el
 * formulario, `upsertLeadFromMeta` la une por teléfono o email) se dio de alta antes, y ése no se anuncia: es a propósito.
 */
export const TOLERANCIA_RELOJ_MS = 5 * 60_000;

export type CandidatoReintento = {
  id: number;
  /** El alta del lead en la base (`leads.created_at`). */
  creadoAt?: string | null;
  /** La hora del formulario en Meta (`created_time`). Sin ella no se sabe si es el mismo lead: no se anuncia. */
  formCreadoEn?: string | null;
};

/**
 * ¿Puede ser el lead nuevo cuyo anuncio se cayó? Lo que se sabe SIN leer la base: el formulario es de las últimas 24 h (la
 * misma regla que el poll, `esNuevoParaElNegocio`) y el lead nació de él. Lo que no pasa por acá no gasta una lectura.
 */
export function podriaSerReintento(c: CandidatoReintento, ahoraMs: number): boolean {
  if (!c.formCreadoEn || !esNuevoParaElNegocio(c.formCreadoEn, ahoraMs)) return false;
  const lead = Date.parse(c.creadoAt ?? '');
  const form = Date.parse(c.formCreadoEn);
  if (!Number.isFinite(lead) || !Number.isFinite(form)) return false;
  return lead >= form - TOLERANCIA_RELOJ_MS;
}

/**
 * ¿Este reintento lo anuncia? Sí, sólo si el lead pasa `podriaSerReintento`, NO tiene la marca, y el negocio ya marcaba
 * cuando nació (con su margen). «No sé desde cuándo marca» (`marcaDesde` null o ilegible) es que no.
 */
export function anunciarEnElReintento(x: {
  candidato: CandidatoReintento;
  marcado: boolean;
  marcaDesde: string | null | undefined;
  ahoraMs: number;
}): boolean {
  if (x.marcado || !podriaSerReintento(x.candidato, x.ahoraMs)) return false;
  const desde = Date.parse(x.marcaDesde ?? '');
  const lead = Date.parse(x.candidato.creadoAt ?? '');
  if (!Number.isFinite(desde) || !Number.isFinite(lead)) return false;
  return lead > desde + MARGEN_DESPLIEGUE_MS;
}

/**
 * ¿Ganó el reclamo? Cada puerta que va a anunciar escribe su marca y relee las del lead: anuncia sólo la de id más chico.
 * Así dos puertas a la vez (el webhook de Meta y un reintento de Zernio) anuncian una vez. `null` = no se ve la propia
 * entre las leídas: no se sabe.
 */
export function ganaElReclamo(propia: number, ids: ReadonlyArray<number>): boolean | null {
  const validos = ids.filter((n) => Number.isFinite(n));
  if (!validos.includes(propia)) return null;
  return Math.min(...validos) === propia;
}
