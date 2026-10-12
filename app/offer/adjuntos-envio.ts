// =============================================================================
// /offer — leer los archivos de la vista previa AL ENVIAR (puro: sin React, sin fetch)
// =============================================================================
// Pedido de Martín (11/10/2026): «Intenté subir un documento y saltó ese error. No se si apenas lo subí
// ya lo quiso analizar, eso estaría mal. Solo cuando le doy a ENVIAR debería...». Hasta ese día Offer
// subía y leía cada archivo con IA en el momento de ELEGIRLO, para pintar un ✓ en un chip. Ahora elegir
// sólo abre la vista previa (app/whatsapp/_shared/VistaAdjuntos.tsx) y esto corre recién en Enviar:
// sube y lee cada archivo EN ORDEN, diciendo en cuál va, y recién con todos leídos sale el turno.
//
// ⚠️ SI UNA LECTURA FALLA, NO SALE EL TURNO: se corta ahí, la vista sigue abierta con el error y el
//    archivo que falló marcado. Los YA leídos quedan en `leidos` (por id del archivo de la vista) y al
//    reintentar no se vuelven a subir ni a leer: cada lectura es un pedido de IA, y repetirlo es pagarlo
//    dos veces.
// ⚠️ SI LA CONVERSACIÓN CAMBIÓ EN EL MEDIO (`vigente`), se corta sin decir nada: lo que el servidor ya
//    leyó quedó guardado en la de antes, y su respuesta no se dibuja acá (la `epoca` de OfferApp).
//
// La ejecuta tests/offer-adjuntos-al-enviar.test.ts con un `leer` falso.

import type { AdjuntoVista } from '@/lib/offer-marco';

export type ResultadoLectura =
  | { ok: true; docs: AdjuntoVista[] }
  | { ok: false; cortado: true }
  | { ok: false; cortado: false; error: string; falloId: string };

const motivo = (e: unknown): string => (e instanceof Error && e.message ? e.message : 'No se pudo leer.');

/**
 * Sube y lee, en orden, los archivos que todavía no se leyeron, y devuelve los docs de TODOS (los de
 * antes y los de ahora) en el orden de la vista: el orden en que se eligieron es el orden en que MaKo
 * los recibe.
 */
export async function leerAdjuntos<T extends { id: string; file: { name: string } }>(
  items: readonly T[],
  leidos: Map<string, AdjuntoVista>,
  deps: {
    /** Sube y lee UNO (subir-url → PUT → 'leer'). */
    leer: (item: T) => Promise<AdjuntoVista>;
    /** Antes de leer cada uno: «Leyendo «precios.pdf»…». No se llama para los ya leídos. */
    alEmpezar?: (item: T, indice: number, total: number) => void;
    /** ¿Sigue siendo la misma conversación? */
    vigente?: () => boolean;
  },
): Promise<ResultadoLectura> {
  const sigue = () => !deps.vigente || deps.vigente();
  const docs: AdjuntoVista[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!sigue()) return { ok: false, cortado: true };
    const it = items[i];
    const ya = leidos.get(it.id);
    if (ya) { docs.push(ya); continue; }
    deps.alEmpezar?.(it, i, items.length);
    let doc: AdjuntoVista;
    try {
      doc = await deps.leer(it);
    } catch (e) {
      if (!sigue()) return { ok: false, cortado: true };
      return { ok: false, cortado: false, error: `«${it.file.name}»: ${motivo(e)}`, falloId: it.id };
    }
    if (!sigue()) return { ok: false, cortado: true };
    leidos.set(it.id, doc);
    docs.push(doc);
  }
  return { ok: true, docs };
}
