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
  if (esInstanciaInexistente(r)) return 'muerto';
  return 'sin_respuesta';
}

/**
 * ¿Evolution dijo que la instancia NO EXISTE? Es uno de los dos «muerto» de arriba, y no
 * significa lo mismo que el otro.
 *
 * ⚠️ «Connection Closed» es una sesión que existe y se cayó: la zombi del 403, el corte que
 * puede volver solo. «No existe» es que no hay ninguna sesión que caerse. Para soltar o
 * recrear una línea da igual —las dos están muertas—, pero para AVISARLE a un cliente «se
 * cayó tu WhatsApp» no: `desconectar()` (lib/evolution.ts) borra la instancia en Evolution
 * y, si era la línea de por default, conserva su fila en «desconectado» con
 * `ultima_conexion_at` intacto. Sin esta distinción, el negocio que desvincula su número a
 * propósito recibe «se cortó tu WhatsApp» cada 24 h para siempre (revisión del 06/10/2026,
 * lib/linea-vigilancia.ts).
 *
 * Vive acá y la usa `veredictoSondeo` para que «no existe» se reconozca en UN lugar.
 */
export function esInstanciaInexistente(r: { status?: number; error?: string | null }): boolean {
  return r.status === 404 && /does not exist/i.test(r.error ?? '');
}

/**
 * ¿Hay que RECREAR la instancia en vez de pedirle otro QR?
 *
 * ⚠️ Una sesión que WhatsApp desvinculó (403) queda ZOMBI: existe en Evolution, contesta
 * `connecting` para siempre y `/instance/connect` devuelve `base64: null`. O sea que el
 * único camino que la app ofrecía —«tocá para reconectar»— muestra un recuadro vacío, y el
 * dueño no tiene forma de saber que lo que hace falta es borrarla y crearla de nuevo. Medido
 * el 25/09/2026: la línea de un cliente llevaba 22 días así.
 *
 * Dos cortes la hacen segura, y los dos son para NO borrar:
 *  · `abierta` — si la sesión está conectada, pedir un QR tampoco devuelve uno (no hace
 *    falta), y rotar ahí le borraría el WhatsApp a un cliente que está trabajando.
 *  · `desvinculada` — el 403/401 es lo ÚNICO que distingue una zombi de una instancia que
 *    está esperando que alguien escanee. Las dos dicen `connecting` y las dos pueden no
 *    devolver QR por un instante. Sin este corte, abrir la tab dos veces durante el pairing
 *    borraba el QR que el dueño tenía en la mano — que es justo el momento en que más mira
 *    la pantalla.
 *
 * Pura: decide si se borra la línea de WhatsApp de un cliente, así que no puede quedarse
 * sin test.
 */
export function hayQueRecrear(p: { abierta: boolean; desvinculada: boolean; qrBase64: string | null | undefined; conectarOk: boolean }): boolean {
  if (p.abierta) return false;                 // anda: no se toca
  if (!p.desvinculada) return false;           // pairing en curso o corte pasajero: tampoco
  if (!p.conectarOk) return true;              // Evolution rechazó el connect sobre una sesión muerta
  return !p.qrBase64;                          // contestó, pero sin QR: zombi
}
