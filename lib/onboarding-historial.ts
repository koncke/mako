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
/** Pasado esto no se anota más (no se descarta lo viejo: lo más valioso es el principio). */
export const TOPE_MENSAJES = 400;
/** El último mensaje del arranque (`cierre` en lib/onboarding-arranque.ts): con él anotado, el historial queda cerrado. */
export const ID_CIERRE = 'arr-listo';

/**
 * El historial guardado. [] = no hay; null = hay algo que no se puede leer (y entonces no se escribe encima). Para DIBUJAR,
 * una entrada que no se entiende se saltea; con `estricto` (para ESCRIBIR) da null: escribir sólo lo entendido borraría en
 * silencio lo que una versión más nueva haya guardado.
 */
export function leerHistorial(raw: string | null | undefined, o: { estricto?: boolean } = {}): MensajeHistorial[] | null {
  if (raw == null || raw === '') return [];
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  const lista = v && typeof v === 'object' && !Array.isArray(v) ? (v as { mensajes?: unknown }).mensajes : undefined;
  if (!Array.isArray(lista)) return null;
  const out: MensajeHistorial[] = [];
  for (const m of lista) {
    if (!m || typeof m !== 'object') continue;
    const { id, de, texto, at, reconstruido } = m as Record<string, unknown>;
    if (typeof id !== 'string' || (de !== 'mako' && de !== 'yo') || typeof texto !== 'string' || typeof at !== 'string') continue;
    if (!Number.isFinite(Date.parse(at))) continue;
    out.push({ id, de, texto, at, ...(reconstruido === true ? { reconstruido: true as const } : {}) });
  }
  return o.estricto && out.length !== lista.length ? null : out;
}

/** Lo que la persona contestó, como lo ve: el texto de la opción que tocó (de la pregunta abierta), o lo que escribió. */
export function loQueContesto(
  vista: { antes: readonly MensajeArranque[]; despues: readonly MensajeArranque[] }, r: { texto?: string; opcion?: number },
): string | null {
  if (r.opcion !== undefined) {
    const abierta = [...vista.antes, ...vista.despues].filter((m) => m.de === 'mako').pop();
    return (Number.isInteger(r.opcion) && abierta?.opciones?.[r.opcion]) || null;
  }
  return r.texto?.trim() ? r.texto.trim() : null;
}

/** La conversación de Offer del onboarding (`sesionId` del setting crudo 'onboarding.arranque'), o null. */
export function sesionDelArranque(raw: unknown): number | null {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  const id = o && typeof o === 'object' && !Array.isArray(o) ? (o as { sesionId?: unknown }).sesionId : null;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
}

const claveDe = (m: { id: string; texto: string }) => `${m.id}\u0000${m.texto}`;

const limpio = (s: string) => (s ?? '').trim().slice(0, TOPE_TEXTO);

/**
 * El historial con lo nuevo. null = no hay nada nuevo.
 * - Lo que dice MaKo se anota la primera vez que se ve, por id Y texto (si vuelve a decir otra cosa con el mismo id, como
 *   el código a otro número, es otro mensaje). La pregunta ABIERTA (el último mensaje de MaKo de la vista) que vuelve
 *   después de una respuesta («Ver otros tipos», «No, lo escribo de nuevo», «Cambiar número») se anota otra vez.
 * - `vivo` (la ruta, mientras pasa): las respuestas NO salen de lo dibujado sino de lo que la persona mandó (`respuesta`), y
 *   van después de las preguntas nuevas. Lo dibujado muestra el dato confirmado («Ana») y no lo que contestó («Sí, me
 *   llamo así»): de ahí se perdía el toque de cada confirmación (revisión adversarial, 21/10). Si no había nada anotado y
 *   la vista ya trae respuestas (quien estaba a mitad del onboarding el día que esto salió, o quien terminó antes), lo
 *   dibujado se anota entero, marcado `reconstruido`.
 * - Sin `vivo` (el script de reconstrucción): preguntas y respuestas, de lo dibujado.
 * - La hora: la de ahora, siempre después de lo ya anotado. Lo de ANTES de la conversación de Offer que se anota cuando la
 *   conversación ya empezó va justo antes de su primer mensaje (`primeroDeOffer`): si no, el nombre y el negocio quedarían
 *   debajo de toda la oferta.
 * - Con el cierre anotado (`ID_CIERRE`) no se anota más: una pestaña vieja o un dato arreglado después (el nombre del
 *   negocio del ws21) no reescriben lo que pasó. Pasado `TOPE_MENSAJES`, tampoco.
 */
export function conLoNuevo(
  previo: readonly MensajeHistorial[],
  vista: { antes: readonly MensajeArranque[]; despues: readonly MensajeArranque[] },
  o: { ahora: number; primeroDeOffer?: number | null; reconstruido?: boolean; vivo?: boolean; respuesta?: string | null },
): MensajeHistorial[] | null {
  if (previo.some((m) => m.id === ID_CIERRE) || previo.length >= TOPE_MENSAJES) return null;
  const todo = [...vista.antes, ...vista.despues];
  const completo = !o.vivo || (previo.length === 0 && todo.some((m) => m.de === 'yo' && limpio(m.texto)));
  const reconstruido = !!o.reconstruido || (!!o.vivo && completo);
  const claves = previo.map(claveDe);
  const vistos = new Set(claves);
  // La pregunta ABIERTA es el último mensaje de la vista, si es de MaKo. En el cierre lo último ya tiene su respuesta
  // dibujada («Listo, ya lo cargué.», «Ahora no»): ahí no hay pregunta abierta (segunda revisión, 22/10: se duplicaba).
  const ultimoDeLaVista = todo[todo.length - 1];
  const abierta = ultimoDeLaVista?.de === 'mako' ? ultimoDeLaVista : undefined;
  const respuesta = o.respuesta ? limpio(o.respuesta) : '';
  // El mismo toque dos veces (dos POST a la vez): lo último anotado ya es esa pregunta con esa respuesta.
  const [penultimo, ultimoAnotado] = previo.slice(-2);
  if (respuesta && abierta && ultimoAnotado?.de === 'yo' && ultimoAnotado.texto === respuesta && penultimo
    && claveDe(penultimo) === claveDe({ id: abierta.id, texto: limpio(abierta.texto) })) return null;
  if (abierta) {
    const k = claveDe({ id: abierta.id, texto: limpio(abierta.texto) });
    if (claves.lastIndexOf(k) >= 0 && claves.lastIndexOf(k) < previo.map((m) => m.de).lastIndexOf('yo')) vistos.delete(k);
  }
  const nuevos = (lista: readonly MensajeArranque[]) => {
    const out: MensajeArranque[] = [];
    for (const m of lista) {
      if (!completo && m.de === 'yo') continue;
      const texto = limpio(m.texto);
      const k = claveDe({ id: m.id, texto });
      if (!texto || vistos.has(k)) continue;
      vistos.add(k);
      out.push({ ...m, texto });
    }
    return out;
  };
  const antes = nuevos(vista.antes);
  const despues = nuevos(vista.despues);
  if (!antes.length && !despues.length && !respuesta) return null;
  // Pasado el tope no se anota más, y una tanda que no entra entera no se anota (no quedaría la pregunta sin su respuesta).
  if (previo.length + antes.length + despues.length + (respuesta ? 1 : 0) > TOPE_MENSAJES) return null;
  const ultimo = previo.reduce((t, m) => Math.max(t, Date.parse(m.at) || 0), 0);
  let t = Math.max(o.ahora, ultimo + 1);
  const marca = reconstruido ? { reconstruido: true as const } : {};
  const aHistorial = (m: MensajeArranque, at: number): MensajeHistorial => ({ id: m.id, de: m.de, texto: m.texto, at: new Date(at).toISOString(), ...marca });
  const p = o.primeroDeOffer;
  const antesDeOffer = p != null && Number.isFinite(p) && p <= t;
  const out = [
    ...previo,
    ...antes.map((m, i) => aHistorial(m, antesDeOffer ? p - antes.length + i : t++)),
    ...despues.map((m) => aHistorial(m, t++)),
  ];
  // Lo que mandó, tal cual y en vivo (nunca reconstruido): su id no se deduplica, un «Sí» puede contestar dos preguntas.
  if (respuesta) out.push({ id: `yo-${out.length}`, de: 'yo', texto: respuesta, at: new Date(t++).toISOString() });
  return out;
}

/**
 * Anotar con compare-and-set sobre el setting (lo que hace `anotarHistorial` en el server, acá para probarlo sin base):
 * se lee, se calcula y se escribe sólo si nadie escribió en el medio; si alguien escribió, se vuelve a leer. Lo que no se
 * puede leer (o trae algo que no se entiende) no se pisa: tira. Devuelve cuántos anotó.
 */
export async function anotarCon(
  io: { leer: () => Promise<string | null>; cambiar: (esperado: string | null, nuevo: string) => Promise<boolean> },
  calcular: (previo: MensajeHistorial[]) => MensajeHistorial[] | null,
  intentos = 3,
): Promise<number> {
  for (let i = 0; i < intentos; i++) {
    const raw = await io.leer();
    const previo = leerHistorial(raw, { estricto: true });
    if (!previo) throw new Error(`El setting ${CLAVE_HISTORIAL} no se puede leer entero: no lo piso.`);
    const nuevo = calcular(previo);
    if (!nuevo) return 0;
    if (await io.cambiar(raw, JSON.stringify({ mensajes: nuevo }))) return nuevo.length - previo.length;
  }
  throw new Error(`El setting ${CLAVE_HISTORIAL} cambió ${intentos} veces mientras lo anotaba.`);
}

/** Un mensaje de la conversación de Offer, lo que hace falta para mostrarlo. */
type DeOffer = { de: 'mako' | 'yo'; texto: string; at?: string; adjuntos?: ReadonlyArray<{ nombre: string }> };
/** Un mensaje del arranque, ya junto con la conversación. */
export type MensajeUnido = DeOffer & { reconstruido?: true };

/**
 * La conversación del onboarding entera: el historial del arranque y la de Offer, juntos por hora. Cada lista conserva su
 * orden (un mensaje de Offer sin hora queda donde estaba, pegado al anterior); a la misma hora, primero el del arranque.
 * Los de Offer salen TAL CUAL (con su id y su audio, si los traen).
 */
export function unirConOffer<T extends DeOffer>(historial: readonly MensajeHistorial[], offer: readonly T[]): Array<T | MensajeUnido> {
  const h = historial.map((m, i) => ({ m, i, t: Date.parse(m.at) })).sort((a, b) => a.t - b.t || a.i - b.i);
  const out: Array<T | MensajeUnido> = [];
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
