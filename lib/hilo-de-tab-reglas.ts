// =============================================================================
// hilo-de-tab-reglas — la charla de un chat de EDICIÓN de una tab queda en la base (22/10/2026; puro, con test)
// =============================================================================
// Martín, 22/10/2026: «¿Todos esos chats regresan y se quedan registrados en Ops Center?». Medido ese día: «Editar con
// MaKo» (Dashboard y General) guardaba en el NAVEGADOR (localStorage) y el Web Generator en la memoria de la pestaña. Se
// perdían al recargar y nunca llegaban a la base ni al Ops Center. Ahora van a `chart_sessions`/`chart_chats`, el almacén
// de docs/diseno-chats-de-mako.md («Un almacén»), con la clave `<tab>:<entidad>`:
//   · `dashboard:<hoja>` — «Editar con MaKo» de esa hoja (los chats de cada gráfico son `dashboard:<hoja>:<gráfico>`).
//   · `landing:<id>` — el agente del Web Generator de esa landing.
// El Ops Center las lista solas como «de antes» (`chatsDeAntes`, lib/chat-mako-indice.ts): una clave sin prefijo de
// persona es del workspace y la ve el admin; la de un closer o un setter va con su persona (lib/chart-chats-reglas.ts).
//
// ⚠️ SÓLO ESTOS PREFIJOS. La ruta (/api/hilo-de-tab) escribe con lo que manda el navegador: sin esta lista, cualquiera
//    podría meter mensajes en `mako-movil:<persona>` (el chat del Ops Center de OTRA persona) o en `persona:…`.
// ⚠️ UNA CHARLA POR ENTIDAD: no hay «chat nuevo» en estos paneles, así que se sigue la más reciente sin archivar. Si se
//    archiva desde el Ops Center, el próximo mensaje abre otra.
// =============================================================================

/** Los prefijos de las claves que se guardan por esta vía (una tab de edición cada uno). */
export const PREFIJOS_HILO_DE_TAB = ['dashboard', 'landing'] as const;
export type PrefijoHiloDeTab = (typeof PREFIJOS_HILO_DE_TAB)[number];

/** Un mensaje como se guarda: quién y qué dijo (lo que el Ops Center sabe dibujar). */
export type FilaHilo = { role: 'user' | 'assistant'; content: string };

/**
 * Lo largo de un mensaje y de un título, y cuántos mensajes por pedido: un turno es «yo» + lo que contestó MaKo, pero la
 * subida única de lo que quedó en el navegador trae hasta 30 de una hoja (`TOPE_MENSAJES`, app/dashboard/hilo-guardado.ts).
 */
export const TOPE_CONTENIDO = 4000;
export const TOPE_TITULO = 70;
export const TOPE_FILAS_POR_PEDIDO = 30;
/** Cuántos mensajes vuelven al abrir el panel (los últimos). */
export const TOPE_FILAS_LEIDAS = 60;

/** Lo que dijo MaKo cuando el pedido falló: el panel lo vuelve a pintar como error. */
export const MARCA_ERROR = '⚠️ ';

const ENTIDAD = /^[A-Za-z0-9_.-]{1,80}$/;

/** La clave de «Editar con MaKo» de una hoja (Dashboard y General: las hojas tienen ids únicos). */
export const claveDeHoja = (hojaId: string): string => `dashboard:${hojaId}`;
/** La clave del agente del Web Generator de una landing. */
export const claveDeLanding = (id: number | string): string => `landing:${id}`;

/** La clave si es una de las de esta vía, o null (otra tab, otra persona, un formato raro). */
export function claveDeTab(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const i = raw.indexOf(':');
  if (i < 0) return null;
  const prefijo = raw.slice(0, i);
  const entidad = raw.slice(i + 1);
  return (PREFIJOS_HILO_DE_TAB as readonly string[]).includes(prefijo) && ENTIDAD.test(entidad) ? raw : null;
}

/** Los mensajes de un pedido, saneados. null = no sirve ninguno (o vino otra cosa). */
export function filasValidas(raw: unknown): FilaHilo[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.slice(0, TOPE_FILAS_POR_PEDIDO).flatMap((x): FilaHilo[] => {
    if (!x || typeof x !== 'object') return [];
    const { role, content } = x as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return [];
    const c = typeof content === 'string' ? content.trim().slice(0, TOPE_CONTENIDO) : '';
    return c ? [{ role, content: c }] : [];
  });
  return out.length ? out : null;
}

/** El título de una charla nueva (lo que se ve en la lista del Ops Center). */
export function tituloValido(raw: unknown, porDefecto: string): string {
  const t = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  return (t || porDefecto).slice(0, TOPE_TITULO);
}

/** Lo que dijo MaKo cuando falló, como se guarda. */
export const filaDeError = (texto: string): FilaHilo => ({ role: 'assistant', content: `${MARCA_ERROR}${texto}` });

/** ¿Es un error guardado? Devuelve el texto sin la marca, o null. */
export function textoDeError(content: string): string | null {
  return content.startsWith(MARCA_ERROR) ? content.slice(MARCA_ERROR.length) : null;
}
