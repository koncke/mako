// =============================================================================
// integracion-en-tab — conectar una integración SIN salir de la tab
// =============================================================================
// Martín, 14/10/2026, textual: «si una persona entra allí y no tiene el google calendar conectado, que salte el modal
// que tenemos en integraciones allí mismo para que lo pueda conectar. Esto significa también el botón de "Conectar"
// si no lo tiene conectado debería saltar el pop-up ahí. Esto como regla siempre, en todas las tabs, para una
// integración jamás se debe salir de la tab.»
//
// La pieza que se monta es UNA: `ServicioSuelto` (app/integraciones/ServicioSuelto.tsx), que dibuja el `ServicioModal`
// de /integraciones tal cual. La abre `app/_components/ConectarIntegracion.tsx` (el botón, el link y el hook). Acá vive
// lo PURO de esa pieza, sin `server-only` y sin React, para que lo usen el navegador, el server y el test:
//
//   · `servicioDeLink`: de un link a /integraciones (`?abrir=meta`, `?servicio=elevenlabs`, absoluto o no) saca QUÉ
//     integración abrir. Los links que arma lib/ (el fallo de la IA, el de ElevenLabs) siguen siendo links —los manda
//     también un WhatsApp, donde no hay modal—, y la PANTALLA que los dibuja los convierte en el modal.
//   · `volverDeLaPestana`: a dónde vuelve un OAuth (Google, Meta) que sale de la pestaña y regresa. Es el path de la
//     tab, sin el `?ws=` (lo pone el callback con el workspace que autorizó el paso 1) y sin el resultado anterior.
//
// ⚠️ DOS INTEGRACIONES NO SE ABREN SUELTAS: la landing (el código del Pixel, sus páginas y la prueba) y el agente de
//    Claude (el token y la skill). Su modal necesita datos que sólo arma el server de /integraciones (`page.tsx`), y
//    abierto suelto dibujaría un código vacío. Esos links siguen yendo a /integraciones, a propósito.
// =============================================================================

/** Las integraciones cuyo modal no se puede abrir fuera de /integraciones (necesitan datos de su `page.tsx`). */
export const SIN_MODAL_SUELTO: readonly string[] = ['landing', 'agente'];

const CLAVE = /^[a-z0-9_-]{1,40}$/;

/**
 * Qué integración abre un link a /integraciones: la de `?abrir=` o la de `?servicio=`. `null` si el link no va a
 * /integraciones, si no nombra una integración (la grilla entera), o si es una de las que no se abren sueltas.
 */
export function servicioDeLink(href: string | null | undefined): string | null {
  const v = (href ?? '').trim();
  if (!v) return null;
  let u: URL;
  try { u = new URL(v, 'https://x.invalid'); } catch { return null; }
  if (u.pathname.replace(/\/+$/, '') !== '/integraciones') return null;
  const key = (u.searchParams.get('abrir') ?? u.searchParams.get('servicio') ?? '').trim().toLowerCase();
  if (!CLAVE.test(key) || SIN_MODAL_SUELTO.includes(key)) return null;
  return key;
}

/** Los parámetros que no viajan en el «volver»: el workspace (lo pone el callback) y el resultado del intento anterior. */
const NO_VUELVEN = ['ws', 'gcal', 'meta'];

/** A dónde vuelve un OAuth que sale de esta pestaña: el path con su query, sin el `?ws=` ni el resultado anterior. */
export function volverDeLaPestana(pathname: string, search: string): string {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const k of NO_VUELVEN) q.delete(k);
  const s = q.toString();
  return `${pathname || '/'}${s ? `?${s}` : ''}`;
}
