// =============================================================================
// closing-ia-caida-reglas — cuando el Claude DEL NEGOCIO no puede analizar sus llamadas (PURO: con test)
// =============================================================================
// Pedido del Cerebro (26/10/2026, docs/hallazgos-closing.md): en el ws11 había 168 análisis de llamadas en error —165
// hasta el 08/10 y 3 más hasta el 19/10— porque su clave de Claude se quedó sin crédito, y nadie se enteró en tres
// semanas. Cada negocio paga SU IA: lo que falla en su cuenta se le dice a él, con el paso para arreglarlo, UNA vez por
// incidente y no una por llamada; y mientras su cuenta no ande, no se apilan filas en error.
//
// Qué es «de su cuenta»: sin crédito, la clave no sirve (borrada, rotada) o su cuenta no la deja usar — lo mismo que la
// tarjeta de «Tus cuentas de IA» (`motivoCorto`, lib/su-clave-reglas.ts). Un 429, un 5xx o un timeout NO: eso se
// reintenta solo y no es algo que el negocio tenga que arreglar.
// =============================================================================

import { motivoCorto } from './su-clave-reglas';

export type FalloDeSuCuenta = 'sin crédito' | 'clave inválida' | 'sin permiso';

/** ¿El error es de la CUENTA de IA del negocio? Devuelve cuál, o null (transitorio, de MaKo o desconocido). */
export function falloDeSuCuenta(error: string | null | undefined): FalloDeSuCuenta | null {
  if (!error) return null;
  const m = motivoCorto(error);
  return m === 'sin crédito' || m === 'clave inválida' || m === 'sin permiso' ? m : null;
}

/** Lo que queda anotado del incidente (app_settings del negocio, `KEY_IA_CAIDA`). */
export type IaCaida = { motivo: FalloDeSuCuenta; desde: string; avisadoAt: string | null };

export const KEY_IA_CAIDA = 'mako.closing.ia_caida';

/** Lee la marca guardada. Basura o vacío = no hay incidente. */
export function leerIaCaida(raw: string | null | undefined): IaCaida | null {
  if (!raw || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<IaCaida>;
    const motivo = o.motivo === 'sin crédito' || o.motivo === 'clave inválida' || o.motivo === 'sin permiso' ? o.motivo : null;
    if (!motivo || typeof o.desde !== 'string' || !Number.isFinite(Date.parse(o.desde))) return null;
    return { motivo, desde: o.desde, avisadoAt: typeof o.avisadoAt === 'string' ? o.avisadoAt : null };
  } catch { return null; }
}

/**
 * La marca después de un fallo de su cuenta. El incidente NO se reinicia con cada llamada que falla: conserva su
 * `desde` y su aviso (UNA vez por incidente). Sólo el motivo se actualiza (pasó de «sin crédito» a «clave inválida»).
 */
export function conFallo(previa: IaCaida | null, motivo: FalloDeSuCuenta, ahoraIso: string): IaCaida {
  return previa ? { ...previa, motivo } : { motivo, desde: ahoraIso, avisadoAt: null };
}

/** ¿Hay que avisarle al dueño? Sólo si este incidente todavía no se avisó. */
export const tocaAvisar = (m: IaCaida): boolean => !m.avisadoAt;

/**
 * Lo que dijo la prueba de si volvió (`probarSiVolvio`, un pedido de un token con SU clave): contestó → volvió; un error
 * de SU cuenta → sigue caída; cualquier otra cosa (sin su clave, la pausa, un 5xx, el crédito que paga MaKo) → no se sabe,
 * y el incidente queda como está.
 */
export function resultadoDeLaPrueba(r: { texto: string } | { error: string; esCredito?: true; noPudeLeer?: true } | null): 'volvio' | 'sigue' | 'no-se' {
  if (!r) return 'no-se';
  if ('texto' in r || r.error === 'Claude contestó vacío') return 'volvio';
  if (r.esCredito || r.noPudeLeer) return 'no-se';
  return falloDeSuCuenta(r.error) ? 'sigue' : 'no-se';
}

/** Qué hacer, en una línea, por motivo (lo que lee la API y la pantalla; el aviso tiene su texto literal en su fila). */
export function queHacerConSuIa(motivo: FalloDeSuCuenta): string {
  if (motivo === 'sin crédito') return 'Cárgale crédito a tu cuenta de Claude (console.anthropic.com → Billing).';
  if (motivo === 'clave inválida') return 'Pega una clave nueva de Claude en Integraciones → Tus cuentas de IA.';
  return 'Tu cuenta de Claude no deja usar esa clave: revisa sus permisos o pega otra en Tus cuentas de IA.';
}

/**
 * LOS DATOS DEL EVENTO `closing_ia_caida` (lib/variables-aviso.ts, alcance `iacaida`): sólo hechos. El motivo lo PREGUNTA
 * la CONDITION de su automatización de SuperAdmin (un texto literal por motivo); la fecha va como el día de la zona del
 * negocio, y las que esperan, con su palabra.
 */
export function datosIaCaida(p: { motivo: FalloDeSuCuenta; desdeDia: string; pendientes: number; link: string }): Record<string, string> {
  const n = Math.max(0, Math.floor(p.pendientes));
  return {
    ia_caida_motivo: p.motivo,
    ia_caida_desde: p.desdeDia,
    ia_caida_pendientes: n === 1 ? '1 llamada' : `${n} llamadas`,
    ia_caida_link: p.link,
  };
}
