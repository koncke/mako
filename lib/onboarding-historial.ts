// =============================================================================
// onboarding-historial — las preguntas del arranque, GUARDADAS con su respuesta (21/10/2026)
// =============================================================================
// Florencia (ws21, cliente roto): en el Ops Center que Martín mira como super admin, su onboarding empezaba en
// «¿Tienes un documento de tu oferta…?». Lo de antes y después de la conversación de Offer (el nombre, el negocio, el PDF,
// el cobro, la fase, el CRM, cómo llegó, qué resolver primero, el teléfono) no estaba guardado en ningún lado:
// `mensajesDeArranque` lo arma al vuelo desde `onboarding.arranque`, con los textos de HOY y los datos de HOY (el script
// que arregla el nombre de su negocio iba a cambiar lo que ella «contestó»).
//
// Ahora cada mensaje que la pantalla dibuja queda anotado la primera vez que se ve (`conLoNuevo`), en un setting propio
// del negocio (`CLAVE_HISTORIAL`). ⚠️ NO EN LOS `mensajes` DE OFFER: ésos manejan su diagnóstico (el primer turno, qué
// fase ya contestó, el último mensaje, lo que lee el modelo) y la conversación se reescribe entera en cada turno; una
// pregunta del arranque ahí adentro Offer la tomaría como suya. Están atados a la conversación por `sesionId`, y la
// proyección de Offer del Ops Center y el chat «Onboarding» los juntan por hora con ella (`unirConOffer`).
// Sin server: lo usan las rutas, el script de reconstrucción y los tests.
// =============================================================================

import type { MensajeArranque } from './onboarding-arranque';

/** app_settings del negocio: `{ mensajes: MensajeHistorial[] }`. */
export const CLAVE_HISTORIAL = 'onboarding.historial';

/** Un mensaje del arranque como se dibujó, con la hora en que se vio por primera vez. */
export type MensajeHistorial = {
  /** El id del mensaje en `mensajesDeArranque` ('arr-nombre', 'arr-nombre-r'…). */
  id: string;
  de: 'mako' | 'yo';
  texto: string;
  at: string;
  /** Se armó DESPUÉS, desde el estado (quien pasó el onboarding antes de que se guardara): los textos son los de ese día. */
  reconstruido?: true;
};

const TOPE_TEXTO = 4_000;
const TOPE_MENSAJES = 400;

/** El historial guardado. [] = no hay; null = hay algo que no se puede leer (y entonces no se escribe encima). */
export function leerHistorial(raw: string | null | undefined): MensajeHistorial[] | null {
  if (raw == null || raw === '') return [];
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  const lista = o && typeof o === 'object' && !Array.isArray(o) ? (o as { mensajes?: unknown }).mensajes : undefined;
  if (!Array.isArray(lista)) return null;
  const out: MensajeHistorial[] = [];
  for (const m of lista) {
    if (!m || typeof m !== 'object') continue;
    const { id, de, texto, at, reconstruido } = m as Record<string, unknown>;
    if (typeof id !== 'string' || (de !== 'mako' && de !== 'yo') || typeof texto !== 'string' || typeof at !== 'string') continue;
    if (!Number.isFinite(Date.parse(at))) continue;
    out.push({ id, de, texto, at, ...(reconstruido === true ? { reconstruido: true as const } : {}) });
  }
  return out;
}

/** La conversación de Offer del onboarding (`sesionId` del setting crudo 'onboarding.arranque'), o null. */
export function sesionDelArranque(raw: unknown): number | null {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  const id = o && typeof o === 'object' && !Array.isArray(o) ? (o as { sesionId?: unknown }).sesionId : null;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
}

const claveDe = (m: { id: string; texto: string }) => `${m.id}\u0000${m.texto}`;

/**
 * El historial con lo que la pantalla dibuja ahora y todavía no estaba (por id Y texto: si MaKo vuelve a decir otra cosa
 * con el mismo id, como el código a otro número, es otro mensaje). null = no hay nada nuevo.
 * La hora: la de ahora, siempre después de lo ya anotado. Lo de ANTES de la conversación de Offer que se anota cuando la
 * conversación ya empezó (quien estaba a mitad del onboarding el día que esto salió, o una reconstrucción) va justo antes
 * de su primer mensaje (`primeroDeOffer`): si no, el nombre y el negocio quedarían debajo de toda la oferta.
 */
export function conLoNuevo(
  previo: readonly MensajeHistorial[],
  vista: { antes: readonly MensajeArranque[]; despues: readonly MensajeArranque[] },
  o: { ahora: number; primeroDeOffer?: number | null; reconstruido?: boolean },
): MensajeHistorial[] | null {
  const vistos = new Set(previo.map(claveDe));
  const nuevos = (lista: readonly MensajeArranque[]) => {
    const out: MensajeArranque[] = [];
    for (const m of lista) {
      const texto = (m.texto ?? '').trim().slice(0, TOPE_TEXTO);
      const k = claveDe({ id: m.id, texto });
      if (!texto || vistos.has(k)) continue;
      vistos.add(k);
      out.push({ ...m, texto });
    }
    return out;
  };
  const antes = nuevos(vista.antes);
  const despues = nuevos(vista.despues);
  if (!antes.length && !despues.length) return null;
  const ultimo = previo.reduce((t, m) => Math.max(t, Date.parse(m.at) || 0), 0);
  let t = Math.max(o.ahora, ultimo + 1);
  const marca = o.reconstruido ? { reconstruido: true as const } : {};
  const aHistorial = (m: MensajeArranque, at: number): MensajeHistorial => ({ id: m.id, de: m.de, texto: m.texto, at: new Date(at).toISOString(), ...marca });
  const p = o.primeroDeOffer;
  const antesDeOffer = p != null && Number.isFinite(p) && p <= t;
  const out = [
    ...previo,
    ...antes.map((m, i) => aHistorial(m, antesDeOffer ? p - antes.length + i : t++)),
    ...despues.map((m) => aHistorial(m, t++)),
  ];
  return out.slice(-TOPE_MENSAJES);
}

/** Un mensaje de la conversación de Offer, lo que hace falta para mostrarlo. */
type DeOffer = { de: 'mako' | 'yo'; texto: string; at?: string; adjuntos?: ReadonlyArray<{ nombre: string }> };
export type MensajeUnido = DeOffer & { reconstruido?: true };

/**
 * La conversación del onboarding entera: el historial del arranque y la de Offer, juntos por hora. Cada lista conserva su
 * orden (un mensaje de Offer sin hora queda donde estaba, pegado al anterior); a la misma hora, primero el del arranque.
 */
export function unirConOffer(historial: readonly MensajeHistorial[], offer: readonly DeOffer[]): MensajeUnido[] {
  const h = historial.map((m, i) => ({ m, i, t: Date.parse(m.at) })).sort((a, b) => a.t - b.t || a.i - b.i);
  const out: MensajeUnido[] = [];
  let i = 0;
  let previa = -Infinity;
  for (const m of offer) {
    const t = Date.parse(m.at ?? '');
    const tOffer = Number.isFinite(t) ? t : previa;
    previa = tOffer;
    while (i < h.length && h[i].t <= tOffer) out.push(deHistorial(h[i++].m));
    out.push(m);
  }
  while (i < h.length) out.push(deHistorial(h[i++].m));
  return out;
}

const deHistorial = (m: MensajeHistorial): MensajeUnido => ({ de: m.de, texto: m.texto, at: m.at, ...(m.reconstruido ? { reconstruido: true as const } : {}) });
