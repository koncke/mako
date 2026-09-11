// =============================================================================
// evolution-sonda — el VEREDICTO sobre la sesión de WhatsApp, sin red
// =============================================================================
// La llamada vive en `sondearSocket` (lib/evolution.ts). Acá se decide qué significa lo que
// volvió, en un módulo puro para poder testearlo con las respuestas MEDIDAS de Evolution
// (tests/evolution-sonda.test.ts). Los tests por regex miraban qué endpoint se llamaba y no
// qué se hacía con la respuesta, y así pasó el bug que cuenta `mensajeEvolution`.

export type Sondeo = 'vivo' | 'muerto' | 'sin_respuesta';

/**
 * Un error de Evolution que significa «la sesión de WhatsApp está caída», no «tu dato está
 * mal». Los dos llegan como 500 y hay que poder distinguirlos: de quién es el problema
 * cambia el mensaje entero.
 */
export function esSesionCaida(e: string): boolean {
  return /connection closed|precondition required|\b428\b/i.test(e || '');
}

/**
 * El mensaje de error de una respuesta de Evolution, esté donde esté.
 *
 * ⚠️ EVOLUTION 2.3.7 LO ANIDA: `{"status":500,"error":"Internal Server Error","response":
 * {"message":["Error updating profile name","Error: Connection Closed"]}}`. El lector de
 * `evFetch` buscaba solo `body.message`, así que TODO error de Evolution llegaba como
 * «Evolution 500». Medido el 11/09/2026: la sonda nueva devolvió `sin_respuesta` sobre las
 * TRES instancias muertas, porque «Connection Closed» nunca llegaba a `esSesionCaida`.
 * Desplegado así, la próxima línea zombi no se rotaba («no pude confirmar, no toqué nada»)
 * y el vigilante no avisaba.
 */
export function mensajeEvolution(body: unknown, status: number): string {
  if (typeof body === 'string') return body.slice(0, 200) || `Evolution ${status}`;
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; response?: { message?: unknown } | null };
    const m = 'message' in b ? b.message : b.response?.message;
    if (m !== undefined && m !== null) return JSON.stringify(m);
  }
  return `Evolution ${status}`;
}

/**
 * ¿Qué dice esta respuesta de la sesión?
 *
 *   ok .................................. vivo: WhatsApp contestó.
 *   sin status (0) ...................... sin_respuesta: no llegamos a Evolution, no es un dato.
 *   «Connection Closed» ................. muerto: la sesión caída, dicha por Evolution.
 *   404 «instance does not exist» ....... muerto: no hay instancia.
 *   cualquier otro error ................ sin_respuesta.
 *
 * ⛔ Lo último es a propósito. De «muerto» cuelga un `logout` en `conectarCanalMaKo`, y un
 * error de otra naturaleza sobre una línea VIVA —un límite de WhatsApp, una ruta que cambió
 * de nombre en otra versión de Evolution y contesta 404— no puede terminar en «está muerta,
 * soltala». Por eso el 404 exige además el texto de «no existe la instancia».
 */
export function veredictoSondeo(r: { ok: boolean; status?: number; error?: string }): Sondeo {
  if (r.ok) return 'vivo';
  if (!r.status) return 'sin_respuesta';
  const e = r.error ?? '';
  if (esSesionCaida(e)) return 'muerto';
  if (r.status === 404 && /does not exist/i.test(e)) return 'muerto';
  return 'sin_respuesta';
}
