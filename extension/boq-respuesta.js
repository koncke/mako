// =============================================================================
// GENERADO por scripts/sync-boq-respuesta.mjs desde lib/flow-boq-respuesta.ts — NO EDITAR A MANO
// =============================================================================
// El pre-push falla si quedó viejo. Este módulo decide si se le dice a alguien que
// su video está en camino: dos versiones distintas es la diferencia entre «pasó» y
// «te dije que pasó».
// =============================================================================

// ⚠️ ESTE MÓDULO EXISTE PORQUE YA MENTÍ CON ESTO. El popup dijo «Listo, lo verás en
// tu Flow» sobre un pedido que NO creó nada. La causa: se miró `res.ok`.
//
// `res.ok` es HTTP 200, y BOQ contesta 200 con el fallo ADENTRO del cuerpo. Es
// exactamente la regla que este repo ya tenía escrita —«los proveedores mandan el
// fallo adentro del 200», medida antes con Meta y con Evolution— aplicada a un
// tercer proveedor.
//
// Y acá el daño es peor que un error tragado: un ÉXITO FALSO no deja nada que
// investigar, y encima envenena lo que viene después — la persona va a buscar un
// video que nunca se pidió, y concluye que el producto miente.
//
// LA FORMA DE UNA RESPUESTA DE BOQ:
//
//     )]}'
//
//     <largo>
//     [["wrb.fr","<rpcid>","<payload JSON como string>",null,null,null,"generic"],...]
//
// Un fallo llega como un frame `"er"` o como un `wrb.fr` sin payload. Los dos
// vienen con 200.
//
// SIN `server-only`: decide si se le dice a alguien que su video está en camino.


/** El prefijo anti-JSONP con el que BOQ abre toda respuesta. */
const PREFIJO = ")]}'";

/**
 * Qué contestó Google.
 *
 * ⚠️ EL ÉXITO SE AFIRMA, NO SE ASUME. Sólo devuelve `ok` si hay un frame `wrb.fr`
 * con payload: cualquier otra cosa —una respuesta vacía, un frame de error, un
 * `wrb.fr` sin contenido— es un fallo, y se nombra cuál.
 *
 * Se puede pasar el `rpcid` esperado. Si se pasa y el frame es de otro, tampoco es
 * un éxito: significa que se repitió el pedido equivocado.
 */
export function leerRespuestaBoq(texto, rpcidEsperado) {
  const t = String(texto || '').trim();
  if (!t) return { ok: false, motivo: 'VACIA', detalle: 'Google no devolvió nada.' };

  // ⚠️ Un frame de error se busca ANTES que el de éxito. BOQ puede mandar los dos en
  // la misma respuesta —el error de una parte y el ok de otra— y quedarse con el
  // primero que matchea es cómo se afirma un éxito que no pasó.
  const err = /\[\s*"er"\s*,\s*(?:null|"[^"]*")\s*,\s*(?:null|"((?:[^"\\]|\\.)*)")/.exec(t);
  if (err) {
    return {
      ok: false,
      motivo: 'ERROR_DE_GOOGLE',
      detalle: (err[1] || '').slice(0, 300) || 'Google devolvió un error sin texto.',
    };
  }

  // El frame de datos. El payload es un string JSON escapado adentro del array.
  const frames = [...t.matchAll(/\["wrb\.fr","([^"]+)","((?:[^"\\]|\\.)*)"/g)];
  if (!frames.length) {
    return {
      ok: false,
      motivo: 'SIN_FRAME',
      detalle: t.startsWith(PREFIJO)
        ? 'La respuesta tiene la forma de BOQ pero no trae ningún resultado.'
        : 'La respuesta no tiene la forma de BOQ. Puede ser una pantalla de bloqueo o un login.',
    };
  }

  const elegido = rpcidEsperado
    ? frames.find((f) => f[1] === rpcidEsperado)
    : frames[0];
  if (!elegido) {
    return {
      ok: false,
      motivo: 'SIN_FRAME',
      detalle: `Contestó sobre ${frames.map((f) => f[1]).join(', ')} y no sobre ${rpcidEsperado}.`,
    };
  }

  // ⚠️ Un frame con payload VACÍO no es un éxito. Es la forma en que BOQ dice «te
  // escuché y no hice nada», y es indistinguible de un ok si sólo se mira que el
  // frame exista.
  let payload = '';
  try { payload = JSON.parse(`"${elegido[2]}"`); } catch { payload = elegido[2]; }
  if (!payload || payload === 'null' || payload === '[]') {
    return {
      ok: false,
      motivo: 'SIN_PAYLOAD',
      detalle: 'Google respondió sin contenido: el pedido llegó y no produjo nada.',
    };
  }

  return { ok: true, rpcid: elegido[1], payload: payload.slice(0, 20000) };
}
