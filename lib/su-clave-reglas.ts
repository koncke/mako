// =============================================================================
// su-clave-reglas — ¿la clave de API del NEGOCIO (su Claude, su OpenAI) anduvo o falló? (IA3, 22/10/2026)
// =============================================================================
// El relevamiento del 22/10 (docs/plan-ia-y-chats-22-10.md, IA3): en toda la historia hay 0 filas con la marca «⚠ clave
// de Anthropic del negocio», aunque el ws10 y el ws11 la tienen cargada. `conClaveDelNegocio` devolvía `{ error }` sin
// anotarlo y la cascada seguía con Gemini: una clave rota (sin crédito, inválida) se veía igual que «nunca se usó».
//
// Desde acá, cada fallo de la clave del negocio deja una fila en `anthropic_usage` (0 tokens, US$0, el molde de `vetado:`
// y de `rebote429:`) con la marca del negocio PRIMERO y el motivo CORTO. Nunca el texto del proveedor: el 401 de OpenAI
// trae la clave enmascarada («sk-proj-****abcd», medido el 22/10), y esa fila la lee el panel de gasto.
//
// Puro (sin `server-only`): lo usan la tarjeta de «Tus cuentas de IA» y los tests.
// =============================================================================

import { MOTIVO_CLAVE_DEL_NEGOCIO, MOTIVO_CREDITO_SU_CLAVE } from './veto-claude';

export type ProvSuClave = 'anthropic' | 'openai' | 'gemini';
/** IA16 (22/10/2026): su Gemini es su IA, así que su tarjeta también lo muestra. */
export const PROVS_SU_CLAVE: readonly ProvSuClave[] = ['anthropic', 'openai', 'gemini'];

/** La marca de lo que paga (o intentó pagar) la clave del negocio. La de Claude es la del veto: la lee lib/costos-ia.ts. */
export const MARCA_SU_CLAVE: Record<ProvSuClave, string> = {
  anthropic: MOTIVO_CLAVE_DEL_NEGOCIO,
  openai: '⚠ clave de OpenAI del negocio',
  gemini: '⚠ clave de Gemini del negocio',
};

/** El `model` de una fila de fallo: `fallo:<modelo>`. Como `vetado:` y `rebote429:`, no es una llamada que contestó. */
export const PREFIJO_FALLO = 'fallo:';

const NOMBRE: Record<ProvSuClave, string> = { anthropic: 'Claude', openai: 'OpenAI', gemini: 'Gemini' };
export const nombreDeSuClave = (p: ProvSuClave): string => NOMBRE[p];

/** El porqué en dos o tres palabras, para la tarjeta. Se lee del error del proveedor y NUNCA se copia ese texto. */
export type MotivoCorto = 'sin crédito' | 'clave inválida' | 'sin permiso' | 'tope por minuto' | 'no contestó' | 'modelo no disponible' | 'otro error';

/**
 * ⚠️ El orden importa: el «sin crédito» de OpenAI llega como un 429 (`insufficient_quota`, «You exceeded your current
 * quota»), así que se mira ANTES que el tope por minuto. El de Anthropic es un 400 («Your credit balance is too low»).
 */
export function motivoCorto(error: string): MotivoCorto {
  const e = error.toLowerCase();
  if (/credit balance|insufficient_quota|exceeded your current quota|billing|no credits|payment required|\b402\b/.test(e)) return 'sin crédito';
  // Gemini dice «API key not valid» (un 400 INVALID_ARGUMENT, no un 401).
  if (/\b401\b|invalid x-api-key|invalid api key|incorrect api key|invalid_api_key|authentication_error|unauthorized|api key not valid|api_key_invalid/.test(e)) return 'clave inválida';
  if (/\b403\b|permission_error|forbidden|has been disabled|not allowed/.test(e)) return 'sin permiso';
  if (/\b404\b|not_found_error|model_not_found|does not exist|no longer available/.test(e)) return 'modelo no disponible';
  if (/\b429\b|rate.?limit|too many requests/.test(e)) return 'tope por minuto';
  if (/\b5\d\d\b|overloaded|timeout|timed out|abort|fetch failed|econnreset|etimedout|unavailable/.test(e)) return 'no contestó';
  return 'otro error';
}

/** Lo que se escribe en la fila: el modelo marcado y el motivo con la marca PRIMERO (`insertUsage` corta a 200). */
export function filaDeFallo(p: ProvSuClave, modelo: string | null | undefined, motivo: MotivoCorto): { model: string; motivo: string } {
  return { model: `${PREFIJO_FALLO}${(modelo ?? '').trim() || '-'}`, motivo: `${MARCA_SU_CLAVE[p]} · falló: ${motivo}` };
}

export type FilaUsoClave = { created_at: string; provider: string | null; model: string | null; motivo: string | null };

export type EstadoSuClave = {
  proveedor: ProvSuClave;
  /** La última vez que contestó (ISO), o null. */
  anduvo: string | null;
  /** El último fallo (ISO y su motivo corto), o null. */
  fallo: { at: string; motivo: string } | null;
};

/** Las filas que no son una llamada que contestó: los bloqueos del veto, los rebotes por cuota y los fallos. */
const MARCAS_NO_CONTESTO = ['vetado:', 'rebote429:', PREFIJO_FALLO];
const esLlamadaQueContesto = (f: FilaUsoClave): boolean => !MARCAS_NO_CONTESTO.some((m) => (f.model ?? '').startsWith(m));

/**
 * ¿Esta fila es de la clave del negocio de ese proveedor?
 * · Claude: lleva la marca del negocio al principio (la puerta 2 del veto la pone siempre; sin ella es el Claude de MaKo).
 * · OpenAI y Gemini: en el workspace de un cliente, la key es la suya (`provsDe` saca las copias de la plataforma, y desde
 *   IA16 la red de la plataforma no corre para un negocio); se descarta igual lo que diga «red de plataforma», por las dudas.
 */
function esDeSuClave(p: ProvSuClave, f: FilaUsoClave): boolean {
  if ((f.provider ?? 'anthropic') !== p) return false;
  const motivo = (f.motivo ?? '').trimStart();
  // También la del crédito: la clave del negocio que es el crédito de Max de la plataforma (el ws10) anota su gasto como del
  // crédito, y sin esto la tarjeta dejaba de ver que anduvo.
  if (p === 'anthropic') return motivo.startsWith(MARCA_SU_CLAVE.anthropic) || motivo.startsWith(MOTIVO_CREDITO_SU_CLAVE);
  return !/red de plataforma/i.test(motivo);
}

/** El último «anduvo» y el último «falló» de la clave de ese proveedor, de filas en cualquier orden. */
export function estadoDeSuClave(p: ProvSuClave, filas: FilaUsoClave[]): EstadoSuClave {
  let anduvo: string | null = null;
  let fallo: EstadoSuClave['fallo'] = null;
  const ms = (s: string | null) => (s ? Date.parse(s) : Number.NEGATIVE_INFINITY);
  for (const f of filas) {
    if (!esDeSuClave(p, f)) continue;
    if ((f.model ?? '').startsWith(PREFIJO_FALLO)) {
      if (ms(f.created_at) > ms(fallo?.at ?? null)) {
        const m = /falló: (.+)$/.exec(f.motivo ?? '');
        fallo = { at: f.created_at, motivo: m ? m[1].trim() : 'otro error' };
      }
    } else if (esLlamadaQueContesto(f) && ms(f.created_at) > ms(anduvo)) {
      anduvo = f.created_at;
    }
  }
  return { proveedor: p, anduvo, fallo };
}

/**
 * La línea de la tarjeta: «Tu clave de Claude falló hace 2 h: sin crédito», «Anduvo hace 5 min» o «Todavía no se usó».
 * Manda lo más reciente: una clave que falló y después anduvo, anda.
 */
export function textoDeSuClave(e: EstadoSuClave, ahora: number, hace: (t: number | null, ahora: number) => string): { texto: string; tono: 'bien' | 'mal' | 'nada' } {
  const tAnduvo = e.anduvo ? Date.parse(e.anduvo) : null;
  const tFallo = e.fallo ? Date.parse(e.fallo.at) : null;
  if (tFallo != null && (tAnduvo == null || tFallo > tAnduvo)) {
    return { texto: `Tu clave de ${nombreDeSuClave(e.proveedor)} falló ${hace(tFallo, ahora)}: ${e.fallo!.motivo}`, tono: 'mal' };
  }
  if (tAnduvo != null) return { texto: `Anduvo ${hace(tAnduvo, ahora)}`, tono: 'bien' };
  return { texto: 'Todavía no se usó', tono: 'nada' };
}

/** Qué hacer con cada motivo, en una línea. Sin dato, nada. */
export function queHacer(motivo: string): string | null {
  if (motivo === 'sin crédito') return 'Cárgale crédito en la consola de tu cuenta.';
  if (motivo === 'clave inválida') return 'Pégala de nuevo: puede que la hayas borrado o rotado.';
  if (motivo === 'sin permiso') return 'Tu cuenta no la deja usar: revisa sus permisos.';
  return null;
}
