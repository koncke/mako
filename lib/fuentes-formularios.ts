// =============================================================================
// fuentes-formularios — dónde se guardan las reglas de cada formulario y qué formulario de Meta entra a qué funnel (puro)
// =============================================================================
// «Asignar fuentes» del CRM (20/11/2026, app/crm/FuentesModal.tsx). Dos ajustes del negocio en `app_settings`, sin tabla
// nueva (el molde es `meta.campanas`, lib/campana-funnel.ts + lib/campana-config.ts):
//
//   · `crm.reglas_formulario` — las reglas de calificación (lib/calificacion-formulario.ts) POR FUNNEL y POR FORMULARIO:
//     `{ v: 1, porFunnel: { "<id real del funnel>": { "<clave>": { ...reglas, nombre } } } }`. Por funnel porque las
//     etapas son de cada funnel: «Revisión» existe en uno y en otro no.
//   · `meta.formularios` — a qué funnels entran los leads de un formulario de anuncios de Meta (lead form):
//     `{ v: 1, asignadas: { "<form_id>": { funnels: [<ids reales>], nombre } } }`. El primero es la casa, como las campañas.
//
// LA CLAVE DE UN FORMULARIO dice de dónde es:
//   · `meta:<form_id>` — un formulario de anuncios de Meta;
//   · `form:<id>`      — un formulario, encuesta o quiz de Web Generator (`data-mako-form`, lib/editor-landing/piezas.ts);
//   · `web:<página>`   — cualquier otra página con el Pixel de MaKo: no trae id de formulario, la identidad es la página
//                        (`leads.pagina_registro`, ya normalizada por el opt-in).
// =============================================================================

import { sanearReglas, type ReglasFormulario } from './calificacion-formulario';

export const CLAVE_REGLAS = 'crm.reglas_formulario';
export const CLAVE_FORMULARIOS_META = 'meta.formularios';

/** Las reglas guardadas de un formulario, con el nombre que tenía al guardarlas (para el historial del lead). */
export type ReglasGuardadas = ReglasFormulario & { nombre?: string };
export type MapaReglas = Record<string, Record<string, ReglasGuardadas>>;
export type FormularioMetaAsignado = { funnels: number[]; nombre: string };
export type AsignacionesMeta = Record<string, FormularioMetaAsignado>;

const TOPE_FORMULARIOS = 200;
const TOPE_FUNNELS = 10;

export const claveMeta = (formId: string): string => `meta:${formId}`;
export const claveWeb = (pagina: string): string => `web:${pagina}`;
/** Un id de formulario de Meta: sólo dígitos (como los de las campañas). */
export const esIdFormMeta = (v: unknown): v is string => typeof v === 'string' && /^\d{5,30}$/.test(v.trim());

// La agenda y el pago de una página de Web Generator (`agenda:<doc>:<pág>`, `pago:<doc>:<pág>`) también son fuentes que se
// asignan desde acá —el modal de antes las tenía—, aunque no tengan respuestas que calificar.
const FORMA_CLAVE = /^(meta:\d{5,30}|form:[A-Za-z0-9_-]{1,40}|(agenda|pago):\d{1,12}:[A-Za-z0-9_-]{1,40}|web:\S{3,500})$/;
export const claveFuenteValida = (v: unknown): v is string => typeof v === 'string' && FORMA_CLAVE.test(v);

/** El tipo de fuente de una clave. */
export function tipoDeClave(clave: string): 'meta' | 'wg' | 'web' | null {
  if (clave.startsWith('meta:')) return 'meta';
  if (clave.startsWith('form:') || clave.startsWith('agenda:') || clave.startsWith('pago:')) return 'wg';
  if (clave.startsWith('web:')) return 'web';
  return null;
}

const idFunnel = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// ── Las reglas ─────────────────────────────────────────────────────────────────

export function parsearMapaReglas(crudo: string | null | undefined): MapaReglas {
  if (!crudo?.trim()) return {};
  let o: unknown;
  try { o = JSON.parse(crudo); } catch { return {}; }
  const porFunnel = (o as { porFunnel?: unknown } | null)?.porFunnel;
  if (!porFunnel || typeof porFunnel !== 'object') return {};
  const out: MapaReglas = {};
  for (const [f, formularios] of Object.entries(porFunnel as Record<string, unknown>)) {
    const fid = idFunnel(f);
    if (fid == null || !formularios || typeof formularios !== 'object') continue;
    const dentro: Record<string, ReglasGuardadas> = {};
    for (const [clave, r] of Object.entries(formularios as Record<string, unknown>).slice(0, TOPE_FORMULARIOS)) {
      if (!claveFuenteValida(clave)) continue;
      const s = sanearReglas(r, null);
      if (!s) continue;
      const nombre = typeof (r as { nombre?: unknown }).nombre === 'string' ? String((r as { nombre: string }).nombre).slice(0, 160) : undefined;
      dentro[clave] = { ...s, ...(nombre ? { nombre } : {}) };
    }
    if (Object.keys(dentro).length) out[String(fid)] = dentro;
  }
  return out;
}

export const serializarMapaReglas = (m: MapaReglas): string => JSON.stringify({ v: 1, porFunnel: m });

export function reglasDe(m: MapaReglas, funnelId: number, clave: string): ReglasGuardadas | null {
  return m[String(funnelId)]?.[clave] ?? null;
}

/** El mapa con las reglas de ese formulario en ese funnel cambiadas (`null` las borra). */
export function conReglas(m: MapaReglas, funnelId: number, clave: string, reglas: ReglasGuardadas | null): MapaReglas {
  const k = String(funnelId);
  const dentro = { ...(m[k] ?? {}) };
  if (reglas) dentro[clave] = reglas; else delete dentro[clave];
  const out = { ...m };
  if (Object.keys(dentro).length) out[k] = dentro; else delete out[k];
  return out;
}

/** Los funnels que tienen reglas PRENDIDAS para alguna de estas claves: si no hay ninguno, no hay nada que leer del lead. */
export function hayReglasPara(m: MapaReglas, claves: readonly string[]): boolean {
  return Object.values(m).some((dentro) => claves.some((c) => dentro[c]?.activa));
}

// ── Los formularios de Meta asignados ──────────────────────────────────────────

export function parsearAsignacionesMeta(crudo: string | null | undefined): AsignacionesMeta {
  if (!crudo?.trim()) return {};
  let o: unknown;
  try { o = JSON.parse(crudo); } catch { return {}; }
  const asignadas = (o as { asignadas?: unknown } | null)?.asignadas;
  if (!asignadas || typeof asignadas !== 'object') return {};
  const out: AsignacionesMeta = {};
  for (const [formId, x] of Object.entries(asignadas as Record<string, unknown>).slice(0, TOPE_FORMULARIOS)) {
    if (!esIdFormMeta(formId) || !x || typeof x !== 'object') continue;
    const funnels: number[] = [];
    for (const f of Array.isArray((x as { funnels?: unknown }).funnels) ? (x as { funnels: unknown[] }).funnels : []) {
      const n = idFunnel(f);
      if (n != null && !funnels.includes(n)) funnels.push(n);
    }
    if (!funnels.length) continue;
    const nombre = String((x as { nombre?: unknown }).nombre ?? '').slice(0, 160);
    out[formId] = { funnels: funnels.slice(0, TOPE_FUNNELS), nombre };
  }
  return out;
}

export const serializarAsignacionesMeta = (a: AsignacionesMeta): string => JSON.stringify({ v: 1, asignadas: a });

/**
 * Prende o apaga UN funnel en un formulario de Meta. Prender suma el funnel al final (la casa no cambia); apagar lo saca, y
 * si era el último el formulario queda sin asignar (sus leads vuelven a ir por la campaña).
 */
export function alternarFormularioMeta(a: AsignacionesMeta, formId: string, nombre: string, funnelId: number, prendido: boolean): AsignacionesMeta {
  if (!esIdFormMeta(formId)) return a;
  const antes = a[formId]?.funnels ?? [];
  const funnels = prendido ? (antes.includes(funnelId) ? antes : [...antes, funnelId].slice(0, TOPE_FUNNELS)) : antes.filter((f) => f !== funnelId);
  const out = { ...a };
  if (funnels.length) out[formId] = { funnels, nombre: nombre.slice(0, 160) || a[formId]?.nombre || '' };
  else delete out[formId];
  return out;
}
