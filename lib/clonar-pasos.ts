// =============================================================================
// clonar-pasos — los pasos de una secuencia del dueño, listos para OTRO workspace (puro)
// =============================================================================
// Lo usa lib/clonar-config.ts (la copia de la configuración a un workspace de prueba), después de
// traducir las etiquetas (`traducirEtiquetasEnSecuencia`, lib/etiquetas-reglas.ts). PURO y sin
// `server-only` a propósito: clonar-config lo es, y la regla tiene que poder EJECUTARSE en un test
// (tests/clonar-pasos.test.ts), no sólo leerse en el fuente.
//
// Lo que NO viaja, porque en el destino apunta a la nada (o, por casualidad, a OTRA cosa):
//   · `audio_id` y `media_id`: la biblioteca del DUEÑO, que el clon no copia. getAdjunto / getAudio
//     filtran por workspace y el motor reintenta un adjunto que falta: el mensaje no sale nunca.
//   · lo mismo ADENTRO de un mensaje de varias partes (cuarta tanda, punto 15): la parte de audio o de
//     archivo se va entera (sin su archivo no es nada; el pie de un archivo se va con él).
//   · `linea`, el número por mensaje (sexta tanda, WhatsApp 2): una línea del DUEÑO. En el destino
//     `elegirLinea` no la encuentra y ese mensaje NO SALE (una línea pedida que no es del negocio no
//     cae a la de por default, AGENTS.md). Sin la clave, vuelve a la línea de la automatización.
// =============================================================================

export type PasosParaElDestino = {
  /** Los pasos sin lo de arriba (un array NUEVO; el de entrada no se toca). */
  pasos: unknown;
  /** Cuántos audios o archivos quedaron sin adjuntar. */
  adjuntos: number;
  /** Cuántos mensajes volvieron a la línea de la automatización. */
  lineas: number;
};

const esParteConArchivo = (x: unknown): boolean =>
  !!x && typeof x === 'object' && ['audio', 'media'].includes(String((x as { tipo?: unknown }).tipo));

export function pasosParaElDestino(pasos: unknown): PasosParaElDestino {
  let adjuntos = 0;
  let lineas = 0;
  if (!Array.isArray(pasos)) return { pasos, adjuntos, lineas };
  const nuevos = pasos.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const o = { ...(p as Record<string, unknown>) };
    for (const k of ['audio_id', 'media_id']) if (o[k] != null) { o[k] = null; adjuntos++; }
    if (Array.isArray(o.partes)) {
      const quedan = o.partes.filter((x) => !esParteConArchivo(x));
      adjuntos += o.partes.length - quedan.length;
      o.partes = quedan;
    }
    // `delete` y no null: sin la clave, el paso es el de siempre (la línea de la automatización).
    if (typeof o.linea === 'string' && o.linea.trim()) lineas++;
    delete o.linea;
    return o;
  });
  return { pasos: nuevos, adjuntos, lineas };
}
