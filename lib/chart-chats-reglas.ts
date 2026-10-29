// =============================================================================
// chart-chats-reglas — de quién es un chat de MaKo de ESCRITORIO (/api/chart-insights): lo puro, con test
// =============================================================================
// Auditoría del 16/10/2026 (docs/diseno-mako-ai-native.md, «una fuga activa hoy»; docs/hallazgos-seguridad.md): la ruta
// leía y escribía cualquier sesión del workspace POR ID (ids correlativos: `?sessionId=N`), y `?all=1` listaba todas.
// Un closer leía lo que el dueño habló con MaKo en /mako, con los montos del trimestre adentro.
//
// LA REGLA, LA MISMA DEL DOER (/api/mako-doer, `quienPide`): los chats de un ADMIN son del workspace, como siempre (su
// historia no cambia); los de un closer o un setter son SUYOS, con su persona en la clave (`persona:u<id>:<clave>`, como
// el teléfono: `mako-movil:u<id>`). Un admin abre cualquiera; los demás, sólo los suyos. A quien no le corresponde, la
// sesión NO EXISTE (404, sin distinguir «es de otro»).
//
// La pantalla nunca ve el prefijo: la ruta le devuelve la clave de siempre (`claveVisible`), así sus etiquetas
// («Pregúntale a MaKo», el gráfico) siguen igual y una clave que vuelve no se prefija dos veces (`claveGuardada` es
// idempotente sobre la de la propia persona).
// ⚠️ Lo de antes de un closer (sus chats del workspace, sin prefijo) deja de abrirse para él: era justamente lo que se
//    filtraba. El admin los sigue viendo.
//
// Puro y sin `server-only`: lo leen la ruta y los tests.
// =============================================================================

/** El prefijo de los chats de escritorio de UNA persona. Ninguna clave de antes empezaba así. */
export const PREFIJO_CHAT_PERSONA = 'persona:';

/** Quién pide: si es admin del workspace, y su persona (la de `personaDeSesion`). */
/**
 * Quién pide. `veCopywriter`: pasa la puerta del Copywriter (lib/copywriter/puerta.ts, hoy sólo el super admin). Sin el
 * campo, NO: las charlas de un guion no se ven ni se escriben (falla cerrado; ser admin del negocio no alcanza).
 */
export type QuienChatea = { admin: boolean; persona: string; veCopywriter?: boolean };

/**
 * La persona de una sesión, para la clave. Con fila en `usuarios` (sub numérico) va por su id, que no cambia si cambia
 * el email; si no, por el email o el sub (la misma regla que `chartKeyDePersona`, lib/mako-turno-app-reglas.ts).
 */
export function personaDeSesion(p: { sub?: string | null; email?: string | null }): string | null {
  const sub = String(p.sub ?? '').trim();
  if (/^\d+$/.test(sub)) return `u${sub}`;
  const email = String(p.email ?? '').trim().toLowerCase();
  if (email) return email;
  return sub || null;
}

export const prefijoDePersona = (persona: string): string => `${PREFIJO_CHAT_PERSONA}${persona}:`;

/** La clave sin el prefijo de su persona (la que entiende el resto de MaKo: la fase de la sección, la etiqueta). */
export function claveLogica(claveGuardadaDeLaSesion: string): string {
  if (!claveGuardadaDeLaSesion.startsWith(PREFIJO_CHAT_PERSONA)) return claveGuardadaDeLaSesion;
  const fin = claveGuardadaDeLaSesion.indexOf(':', PREFIJO_CHAT_PERSONA.length);
  return fin < 0 ? claveGuardadaDeLaSesion : claveGuardadaDeLaSesion.slice(fin + 1);
}

/**
 * La clave con que se guarda y se busca lo que pide la pantalla. El admin, la de siempre (del workspace); los demás, la
 * suya (`persona:<persona>:<clave>`). null = no le corresponde: la clave de OTRA persona.
 */
export function claveGuardada(chartKey: string, q: QuienChatea): string | null {
  if (!pasaLaPuertaDeSuTab(chartKey, q)) return null;
  if (chartKey.startsWith(PREFIJO_CHAT_PERSONA)) {
    return q.admin || chartKey.startsWith(prefijoDePersona(q.persona)) ? chartKey : null;
  }
  return q.admin ? chartKey : `${prefijoDePersona(q.persona)}${chartKey}`;
}

/**
 * ¿Es la charla de MaKo de un guion del Copywriter (`copywriter:<guion>`, lib/hilo-de-tab-reglas.ts)? La tab es sólo del
 * super admin: su charla también (verificación del Cerebro del 28/10/2026: el admin del negocio la leía, la escribía y
 * le salía en su Ops Center).
 */
export const esCharlaDelCopywriter = (clave: string): boolean => claveLogica(clave).startsWith('copywriter:');

/** ¿Puede ver esta charla, por su TAB? Hoy sólo cierra la del Copywriter a quien no pasa su puerta. */
export const pasaLaPuertaDeSuTab = (clave: string, q: QuienChatea): boolean => !esCharlaDelCopywriter(clave) || q.veCopywriter === true;

/** ¿Puede leer o escribir esta sesión? El admin, cualquiera; los demás, sólo las suyas. Y la de una tab con puerta,
 *  sólo quien la pasa. */
export function puedeUsarSesion(claveDeLaSesion: string, q: QuienChatea): boolean {
  if (!pasaLaPuertaDeSuTab(claveDeLaSesion, q)) return false;
  return q.admin || claveDeLaSesion.startsWith(prefijoDePersona(q.persona));
}

/** La clave que ve la pantalla: sin el prefijo de la persona que pide (la de otro, si la ve un admin, queda entera). */
export function claveVisible(claveDeLaSesion: string, q: QuienChatea): string {
  const propio = prefijoDePersona(q.persona);
  return claveDeLaSesion.startsWith(propio) ? claveDeLaSesion.slice(propio.length) : claveDeLaSesion;
}
