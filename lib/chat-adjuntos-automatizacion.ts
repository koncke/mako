// =============================================================================
// chat-adjuntos-automatizacion — lo que el dueño adjunta en el chat de MaKo de Automations, como TEXTO (23/10/2026)
// =============================================================================
// Martín, por el Cerebro (AU4): «Falta el "+" para adjuntar archivos e imágenes». El chat de Automations le habla a la
// cascada de IA con TEXTO (lib/flujo-ia-crear.ts, `generar`): una imagen o un PDF no viajan como bloque. Cada archivo se lee
// a texto al adjuntarlo (POST /api/chat-agent/secuencias/ia/adjunto, `archivoATexto`: la capa de texto del PDF, docx,
// visión para una imagen o un escaneo) y viaja con el pedido. Al modelo le llega como un bloque aparte del pedido, así el
// control de lo pedido (los textos entre comillas que tienen que quedar en el lienzo) sigue mirando sólo lo que escribió.
// Puro: lo usan la ruta, la pantalla y los tests.
// =============================================================================

/** Hasta cuántos archivos por mensaje (los de la caja única: lib/mako-adjuntos.ts). */
export const TOPE_ADJUNTOS_AUTOMATIZACION = 4;
/** Cuánto de cada uno llega al modelo, y cuánto entre todos: un PDF de 40 páginas no se come la ventana. */
export const TOPE_TEXTO_ADJUNTO = 8_000;
export const TOPE_TEXTO_ADJUNTOS = 16_000;
/** Lo que se manda si el mensaje trae sólo archivos (la ruta pide un pedido escrito). */
export const PEDIDO_SOLO_ADJUNTOS = 'Mira lo que te adjunto.';

export type AdjuntoLeido = { nombre: string; texto: string };

/** Lo que llega en el body, saneado: hasta 4, con nombre y texto, cortados a su tope (lo malformado se descarta). */
export function sanearAdjuntos(raw: unknown): AdjuntoLeido[] {
  if (!Array.isArray(raw)) return [];
  const out: AdjuntoLeido[] = [];
  let total = 0;
  for (const x of raw.slice(0, 20)) {
    if (out.length >= TOPE_ADJUNTOS_AUTOMATIZACION) break;
    if (!x || typeof x !== 'object') continue;
    const nombre = String((x as { nombre?: unknown }).nombre ?? '').trim().slice(0, 120) || 'archivo';
    const crudo = String((x as { texto?: unknown }).texto ?? '').trim();
    if (!crudo) continue;
    const texto = crudo.slice(0, Math.min(TOPE_TEXTO_ADJUNTO, TOPE_TEXTO_ADJUNTOS - total));
    if (!texto) break;
    total += texto.length;
    out.push({ nombre, texto: texto.length < crudo.length ? `${texto}\n[…sigue: lo corté acá]` : texto });
  }
  return out;
}

/** El bloque para el modelo: cada archivo con su nombre, como parte del pedido. */
export function bloqueDeAdjuntos(adjuntos: readonly AdjuntoLeido[]): string {
  if (!adjuntos.length) return '';
  return ['LO QUE ADJUNTÓ EL DUEÑO (es parte de su pedido: léelo y úsalo):', ...adjuntos.map((a) => `«${a.nombre}»:\n${a.texto}`)].join('\n\n');
}
