// =============================================================================
// «Mejora el contraste», MEDIDO en el navegador (20/11/2026, la llamada con Leila: «No se lee… y le puse a aumentar contraste»)
// =============================================================================
// Lo que se mide: cada página se dibuja SIN sus textos (lo que el motor exporta, `renderPageToCanvas`, a un cuarto del tamaño) y
// de cada texto se toman los píxeles de su caja: eso es lo que tiene detrás (una foto, un blur, el velo, el fondo). Con eso,
// lib/image-editor/contraste.ts decide (otro color o un velo) y vuelve a medir lo que queda. Sin IA: la de antes miraba un JSON de
// colores, no la foto, y nadie medía después.
//
// Una foto de otro origen sin CORS ensucia el lienzo y no deja leer sus píxeles: esa página no se mide (y no se toca).
// =============================================================================

import type { EditorEngine } from '../../_doory/editor/extensions';
import type { DocPage } from '@/app/image-editor/_doory/types/document';
import { cajaDe, tipoDe } from '@/lib/image-editor/chat/vista';
import type { CambioImagen } from '@/lib/image-editor/chat/aplicar';
import { CONTRASTE_OBJETIVO, arreglarContraste, contrasteDelTexto, fondoDe, luminanciaRgb, resumenDeContraste, type CambioDeContraste, type FondoMedido } from '@/lib/image-editor/contraste';
import { cambiarHilo, conId, leerHilo, type MensajeNuevo } from './hilo';

type Obj = Record<string, unknown>;
type DocMedible = { width: number; height: number; pages: Array<{ id: string; width?: number; height?: number; objects: Obj[] }> };

/** A qué escala se dibuja cada página para medir: 1080 × 1350 queda en 270 × 338, y alcanza para saber qué hay detrás. */
const ESCALA = 0.25;
/** Cuántos píxeles se miran por texto como mucho (se saltean de a pasos parejos). */
const MUESTRAS_MAX = 6_000;

/**
 * Lo que hay detrás de cada texto de las páginas pedidas (todas, sin `paginas`), por id del texto. Un texto girado se mide con su
 * caja sin girar (sobra o falta un poco en las puntas; para decidir si se lee alcanza).
 */
export async function medirFondosDeTextos(editor: EditorEngine, doc: DocMedible, paginas?: ReadonlySet<string>): Promise<Map<string, FondoMedido>> {
  const out = new Map<string, FondoMedido>();
  // Sin navegador (un test en node) no hay qué dibujar. El motor se carga recién acá: trae fabric, que en node no anda.
  if (typeof document === 'undefined') return out;
  const { renderPageToCanvas } = await import('../../_doory/editor/engine/render');
  for (const pagina of doc.pages) {
    if (paginas && !paginas.has(String(pagina.id))) continue;
    const textos = pagina.objects.filter((o) => tipoDe(o) === 'texto' && o.visible !== false);
    if (!textos.length) continue;
    const ancho = typeof pagina.width === 'number' ? pagina.width : doc.width;
    const alto = typeof pagina.height === 'number' ? pagina.height : doc.height;
    try {
      const sinTextos = { ...pagina, objects: pagina.objects.filter((o) => tipoDe(o) !== 'texto') } as unknown as DocPage;
      const lienzo = await renderPageToCanvas(sinTextos, { width: ancho, height: alto }, editor.loadContext, { multiplier: ESCALA });
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const { width: W, height: H } = lienzo;
      const px = ctx.getImageData(0, 0, W, H).data;
      const k = W / ancho;
      for (const t of textos) {
        const c = cajaDe(t);
        const x0 = Math.max(0, Math.floor(c.x * k));
        const y0 = Math.max(0, Math.floor(c.y * k));
        const x1 = Math.min(W, Math.ceil((c.x + c.ancho) * k));
        const y1 = Math.min(H, Math.ceil((c.y + c.alto) * k));
        if (x1 <= x0 || y1 <= y0) continue;
        const paso = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / MUESTRAS_MAX)));
        const lums: number[] = [];
        for (let y = y0; y < y1; y += paso) {
          for (let x = x0; x < x1; x += paso) {
            const i = (y * W + x) * 4;
            // Lo transparente (una página sin fondo) es blanco en la exportación.
            const a = px[i + 3] / 255;
            lums.push(luminanciaRgb(px[i] * a + 255 * (1 - a), px[i + 1] * a + 255 * (1 - a), px[i + 2] * a + 255 * (1 - a)));
          }
        }
        const f = fondoDe(lums);
        if (f) out.set(String(t.id), f);
      }
    } catch (e) {
      // Un lienzo «sucio» (una foto sin CORS) o una que no cargó: esa página no se mide.
      console.warn('[image-editor/contraste] no pude medir la página', pagina.id, e);
    }
  }
  return out;
}

/** Los arreglos de contraste como filas de «Original | Modificado» (lo que la tarjeta del chat ya muestra). */
export const filasDeContraste = (cambios: readonly CambioDeContraste[]): CambioImagen[] => cambios.map((c) => ({
  tipo: 'cambia', titulo: `Se lee: «${c.texto.replace(/\s+/g, ' ').slice(0, 40)}»`,
  antes: `${c.antes} (contraste ${c.contrasteAntes.toFixed(1)})`, despues: `${c.despues}${c.velo != null ? ' con velo' : ''} (${c.contrasteDespues.toFixed(1)})`,
}));

/** Un id para el velo (como los del motor). */
const idNuevo = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * «Mejora el contraste» (20/11/2026): MEDIDO, sin IA. Antes era un pedido a la IA del chat, que mira un JSON de colores y no la
 * foto, y nadie medía después: Leila lo tocó y su carrusel siguió sin leerse. Ahora cada página se dibuja sin textos, cada texto
 * que no llega a 4,5:1 contra lo que tiene detrás cambia de color o lleva un velo, se aplica en UN paso de deshacer («Restaurar»
 * lo vuelve atrás), y se VUELVE a medir lo aplicado para decir el contraste que quedó.
 */
export async function mejorarContraste(editor: EditorEngine): Promise<void> {
  const disenoId = editor.designId;
  if (!disenoId) return;
  const h0 = leerHilo(disenoId);
  if (h0.corriendo || h0.mensajes.some((m) => m.de === 'mako' && m.estado === 'aplicando')) return;
  cambiarHilo(disenoId, (h) => ({
    corriendo: true,
    mensajes: [
      ...h.mensajes.map((m) => (m.de === 'mako' && m.estado === 'pendiente' ? { ...m, estado: 'descartada' as const, aviso: undefined, t: Date.now() } : m)),
      conId({ de: 'yo', texto: 'Mejora el contraste de los textos con el fondo para que se lean bien.', alcance: null }),
    ],
  }));
  const decir = (m: MensajeNuevo) => cambiarHilo(disenoId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, conId(m)] }));
  try {
    const doc = editor.getDocument() as unknown as DocMedible;
    const total = doc.pages.reduce((n, p) => n + p.objects.filter((o) => tipoDe(o) === 'texto').length, 0);
    const fondos = await medirFondosDeTextos(editor, doc);
    if (total && !fondos.size) { decir({ de: 'mako', texto: 'No pude medir lo que tienen detrás tus textos (una foto que no deja leer sus píxeles). Prueba cambiando el color de los textos a mano.', error: true }); return; }
    if ((editor.getDocument() as unknown) !== doc) { decir({ de: 'mako', texto: 'El diseño cambió mientras medía: tócalo otra vez.' }); return; }
    const { doc: nuevo, cambios } = arreglarContraste(doc, fondos, { objetivo: CONTRASTE_OBJETIVO, nuevoId: idNuevo });
    if (!cambios.length) { decir({ de: 'mako', texto: resumenDeContraste([], total) }); return; }
    editor.stopEditingText();
    editor.applyDocument(nuevo as unknown as Parameters<EditorEngine['applyDocument']>[0], { label: 'Mejorar el contraste' });
    const version = editor.state.docVersion;
    // Medir DESPUÉS, sobre lo aplicado (con los velos dibujados): lo que se dice es lo que quedó, no lo que se calculó.
    const aplicado = editor.getDocument() as unknown as DocMedible;
    const ids = new Set(cambios.map((c) => c.id));
    const paginas = new Set(aplicado.pages.filter((p) => p.objects.some((o) => ids.has(String(o.id)))).map((p) => String(p.id)));
    const despues = await medirFondosDeTextos(editor, aplicado, paginas);
    const medidos = cambios.map((c) => {
      const f = despues.get(c.id);
      const real = f ? contrasteDelTexto(c.despues, f) : null;
      return real == null ? c : { ...c, contrasteDespues: real };
    });
    decir({ de: 'mako', texto: resumenDeContraste(medidos, total), cambios: filasDeContraste(medidos), estado: 'aplicada', aplicada: { version } });
    editor.toast('Contraste mejorado', 'success');
  } catch (e) {
    console.warn('[image-editor/contraste] mejorar el contraste', e);
    decir({ de: 'mako', texto: 'No pude medir el contraste ahora. Vuelve a intentar.', error: true });
  }
}
