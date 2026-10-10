// =============================================================================
// ruta-automations — dónde vive la tab Automations (ex Chatbot), y sus URLs viejas
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, General 1), textual: «Cambia el nombre de la tab
// "Chatbot" por "Automations", el nombre en la sidebar, la ruta, todo.»
//
// La carpeta pasó de app/chatbot a app/automations y la ruta de /chatbot a /automations.
// ⚠️ LO QUE NO CAMBIÓ, Y NO SE CAMBIA, son las CLAVES guardadas en la base: la key `setting`
// del nav (capas, roles, `onboarding.tab.setting`), el área `chatbot` de la API de MaKo y sus
// operaciones, la API interna /api/chat-agent/*, el proyecto «Agente: Chatbot» del plan. Cambiar
// una clave guardada deja a los clientes con el onboarding reabierto o la tab sin permiso, y
// eso no se ve en ningún test: se ve en la cuenta de un cliente.
//
// Sin `server-only` y sin 'use client': lo leen el nav (cliente), los redirects (server) y el
// guard de tests/ruta-automations.test.ts.

/** La ruta de la tab. */
export const RUTA_AUTOMATIONS = '/automations';

/**
 * Las URLs viejas de la tab, que REDIRIGEN acá y que el nav sigue marcando como Automations.
 *
 * ⚠️ SE REDIRIGEN, NO SE BORRAN: hay links afuera del repo que nadie puede editar —avisos de
 * WhatsApp ya mandados (`/chatbot?sec=<id>`, `/chatbot?aviso=<id>`), marcadores, el regreso
 * del OAuth de Zernio de una conexión que arrancó antes del cambio, tareas del plan—. Ésta es
 * la ÚNICA lista donde `/chatbot` puede aparecer como cadena en el producto, además de su
 * propia página de redirect: lo cuida tests/ruta-automations.test.ts.
 *
 * `/setting` e `/instagram` también redirigen acá, pero no van en la lista: el nav nunca los
 * marcó (`/setting` lo nombra lib/titulo-tab.ts y `/instagram` es una tab retirada que cuida
 * tests/sin-instagram.test.ts, que prohíbe la cadena en todo el producto).
 */
export const RUTAS_VIEJAS_AUTOMATIONS = ['/chatbot', '/chat-bot', '/chat-agent'] as const;

/**
 * Un destino con la query ENTERA de la URL vieja: `/chatbot?sec=12&ws=3` → `/automations?sec=12&ws=3`.
 *
 * ⚠️ LA QUERY ES EL DESTINO. Un aviso de WhatsApp lleva `?sec=` (la automatización), `?aviso=`
 * (un Mensaje de MaKo), `?stab=plantillas&tpl=` (una plantilla) y el `?ws=` de la cuenta. Un
 * redirect pelado abre la tab en la primera automatización, sin decir nada —el modo de falla
 * que AGENTS.md documenta para el `?ws=`, sólo que acá el link abre la COSA equivocada—.
 *
 * Los valores repetidos (`?a=1&a=2`) viajan todos, en orden. Sin `?` cuando no hay nada.
 * El `#` no llega al server: el navegador lo conserva solo a través del redirect.
 */
export function destinoConQuery(ruta: string, sp: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.append(k, v);
    else if (Array.isArray(v)) for (const x of v) qs.append(k, x);
  }
  const s = qs.toString();
  return s ? `${ruta}?${s}` : ruta;
}
