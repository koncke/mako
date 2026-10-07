// =============================================================================
// webhook-fallo-ruteo — qué contesta un webhook cuando no pudo leer DE QUIÉN es el evento
// =============================================================================
// La regla de AGENTS.md: la lectura que decide de quién es un evento entrante va ESTRICTA
// (`wsPorIdentificadorEstricto`, `credWsEstricta`). Con la que traga el error, «no pude leer» y
// «no es de nadie» son el mismo null, y el segundo se contesta 200 y se descarta — o, si el null
// es la key de la firma, 401 con un mensaje que culpa a la firma. Calendly lo tiene desde el
// 06/10/2026 (`responderFalloDeProceso`, rama `ruteo`); esto es lo mismo para los otros cuatro.
//
// QUÉ SE CONTESTA, y depende de qué hace el proveedor con un 5xx (medido el 07/10/2026):
//   · Fathom (Svix) reintenta durante días, y DESHABILITA el endpoint si falla 5 días seguidos.
//     → 503 sólo si reintentar lo arregla (`esErrorTransitorio`); si no, 200. Igual que Calendly.
//   · Meta reintenta ~36 h y después descarta; no apaga nada. Mismo criterio. (Meta, con varios
//     leads por pedido, decide en su route: ver app/api/webhooks/meta-leads.)
//   · Cal.com y Chatwoot NO REINTENTAN NUNCA (`sendPayload` de Cal.com y `Webhooks::Trigger` de
//     Chatwoot, sin retry). El código no cambia nada para ellos: lo que se pierde, se pierde. Por
//     eso se ANOTA siempre, sea transitorio o no: es el único rastro.
//
// El clasificador es el de Calendly (`lib/calendly-error.ts`): no tiene nada de Calendly salvo
// el nombre, y una segunda copia de esas reglas sería la que se queda vieja.

import 'server-only';
import { esErrorTransitorio, mensajeDeError } from './calendly-error';
import { KEY_FALLOS_RUTEO, huellaRuteoPrevia, sumarFalloRuteo, type ServicioRuteo } from './webhook-ruteo-huella';
import { getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';

/**
 * Anota el fallo en el workspace del SUPER ADMIN. Nunca lanza.
 *
 * ⚠️ Fuera de `runWithWorkspace`, `setSetting` resuelve el workspace solo y en un webhook sin
 * sesión cae al ws1 —Mauricio, un cliente—. Y `getSettingEstricto`: con la tolerante, un error
 * de lectura vuelve null, la huella arranca de cero y el upsert PISA lo anotado antes.
 */
export async function anotarFalloDeRuteo(
  servicio: ServicioRuteo, err: unknown, identificador: string | null | undefined,
): Promise<{ transitorio: boolean; mensaje: string }> {
  const mensaje = mensajeDeError(err).slice(0, 500);
  const transitorio = esErrorTransitorio(err);
  try {
    await runWithWorkspace(await wsSuperAdmin(), async () => {
      const previa = huellaRuteoPrevia(await getSettingEstricto(KEY_FALLOS_RUTEO));
      const huella = sumarFalloRuteo(previa, {
        cuando: new Date().toISOString(), servicio, identificador: identificador ?? null, transitorio, mensaje,
      });
      await setSetting(KEY_FALLOS_RUTEO, JSON.stringify(huella));
    });
  } catch (e) {
    // Anotar NUNCA cambia la respuesta: con la base caída —el caso más común— esto también
    // falla, y lo único que queda es esta línea del log.
    console.error(`[webhook:${servicio}] no se pudo anotar el fallo de ruteo: ${mensajeDeError(e)}`);
  }
  return { transitorio, mensaje };
}

/**
 * La respuesta a un fallo leyendo el ruteo (o la key que decide la firma): 503 si reintentar lo
 * arregla, 200 con `ok: false` y el motivo si no. Siempre anota.
 */
export async function responderFalloDeRuteo(
  servicio: ServicioRuteo, err: unknown, identificador: string | null | undefined,
): Promise<Response> {
  const { transitorio, mensaje } = await anotarFalloDeRuteo(servicio, err, identificador);
  if (transitorio) {
    console.error(`[webhook:${servicio}] no pude leer de quién es el evento (TRANSITORIO) → 503: ${mensaje}`);
    return Response.json({ ok: false, error: 'ruteo', reintentar: true, message: mensaje }, { status: 503 });
  }
  console.error(`[webhook:${servicio}] no pude leer de quién es el evento → 200 y anotado, reintentar no lo arregla: ${mensaje}`);
  return Response.json({ ok: false, error: 'ruteo', reintentar: false, message: mensaje, anotado: KEY_FALLOS_RUTEO }, { status: 200 });
}
