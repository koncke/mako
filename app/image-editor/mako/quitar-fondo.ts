'use client';

// =============================================================================
// «Quitar fondo» en el Image Editor, con MODNet desde Hugging Face (12/11/2026)
// =============================================================================
// El Cerebro, al ver la réplica de una miniatura (Dan Martell): «Tiene que seguir la composición del original: persona recortada,
// sin fondo y grande». El servidor no puede recortar (onnxruntime-node está excluido del deploy: next.config.ts, llenaba el disco),
// y el editor ya traía un «Quitar fondo» que corre en el navegador (onnxruntime-web, ../_doory/editor/engine/bgRemoval/), APAGADO
// porque nadie le daba un modelo. El sí del Cerebro, con condiciones:
//   · sin alojarlo nosotros (subir a Storage de producción necesita la frase de Martín): el navegador lo baja de Hugging Face,
//     `Xenova/modnet` (Apache-2.0), con la URL FIJADA a un commit y el sha256 verificado antes de usarlo (el motor lo verifica:
//     modelStore.ts → `verified`; y model.ts sólo acepta de afuera una URL de Hugging Face fijada a un commit);
//   · primero el cuantizado (6,6 MB); el grande sólo si sale mal. Salió mal con la foto de Martín (le comía el cuerpo): va el grande
//     (./modelo-modnet.ts dice por qué, con la captura);
//   · si no carga, la miniatura sale igual: la persona grande, con su fondo, sin trabar nada.
// Los datos salen de la API pública del repo (commit fa2fa546…, `lfs.oid` de cada archivo) y de su preprocessor_config.json
// (lado 512, divisible por 32, normalizado con media y desvío 0,5; entrada `input`, salida `output`, como su README).
// =============================================================================

import { useEffect, useRef } from 'react';
import { removeBackground } from '../_doory/editor/engine/bgRemoval';
import { configureBackgroundRemoval } from '../_doory/editor/engine/bgRemoval/install';
import { useEditor, useEditorState, type EditorEngine } from '../_doory/editor/extensions';
import { FOTO_RECORTADA, MODNET, encuadreDeLaPersona, fotosARecortar } from './modelo-modnet';

/** Prende «Quitar fondo» en el editor (registra el motor; el modelo se baja recién la primera vez que se usa). */
export function prenderQuitarFondo(): void {
  configureBackgroundRemoval({ features: { background_removal: true }, assets: { background_removal_model: MODNET } });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** La persona sin fondo, encuadrada para su cuadro (`encuadreDeLaPersona`): lo que no es transparente, desde la cabeza. */
async function encuadrar(png: Blob, cuadro: { ancho: number; alto: number }): Promise<Blob> {
  const bmp = await createImageBitmap(png);
  const lienzo = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = lienzo.getContext('2d');
  if (!ctx) return png;
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  let x0 = bmp.width, y0 = bmp.height, x1 = -1, y1 = -1;
  for (let y = 0; y < bmp.height; y += 2) {
    for (let x = 0; x < bmp.width; x += 2) {
      if (data[(y * bmp.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return png;
  const r = encuadreDeLaPersona({ x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 }, { ancho: bmp.width, alto: bmp.height }, cuadro);
  const salida = new OffscreenCanvas(r.ancho, r.alto);
  salida.getContext('2d')?.drawImage(bmp, r.x, r.y, r.ancho, r.alto, 0, 0, r.ancho, r.alto);
  return salida.convertToBlob({ type: 'image/png' });
}

/**
 * Al abrir un diseño con una foto marcada, le quita el fondo UNA vez: la elige, le quita el fondo (el mismo motor del botón),
 * ENCUADRA a la persona para su cuadro (si no, el editor la centra entera y queda chica), la sube a sus «Subidos», reemplaza la foto
 * y le cambia el nombre. Si el modelo no carga o la página no aparece, la foto queda como estaba (con su fondo, grande por la réplica)
 * y también pierde la marca: no se reintenta en cada apertura ni traba nada.
 */
export function useRecortarAlAbrir(editor: EditorEngine, docVersion: number): void {
  const corriendo = useRef(false);
  useEffect(() => {
    if (corriendo.current) return;
    const pendientes = fotosARecortar(editor.getDocument() as never);
    if (!pendientes.length) return;
    corriendo.current = true;
    void (async () => {
      for (const f of pendientes) {
        try {
          // La página tiene que tener su lienzo: se espera hasta 10 s a que la foto quede elegida.
          for (let i = 0; i < 20 && !editor.state.selection.ids.includes(f.id); i++) {
            editor.select([f.id], f.pagina);
            if (!editor.state.selection.ids.includes(f.id)) await esperar(500);
          }
          const capa = (editor.getDocument() as unknown as { pages: Array<{ objects: Array<Record<string, unknown>> }> }).pages
            .flatMap((p) => p.objects).find((o) => o.id === f.id);
          if (editor.state.selection.ids.includes(f.id) && capa && typeof capa.src === 'string') {
            const cuadro = { ancho: Number(capa.width) * Number(capa.scaleX ?? 1), alto: Number(capa.height) * Number(capa.scaleY ?? 1) };
            const original = await (await fetch(capa.src)).blob();
            const sinFondo = await encuadrar(await removeBackground(original), cuadro);
            const ref = await editor.assets.upload(sinFondo, 'tu-foto-sin-fondo.png');
            if (editor.state.selection.ids.includes(f.id)) await editor.insert.replaceSelectedImage(ref);
          }
        } catch (e) {
          console.warn('[image-editor] no pude quitarle el fondo a la foto:', e instanceof Error ? e.message : e);
        }
        // `replaceSelectedImage` puede dejar otro id: se renombra lo marcado que quede, sea el que sea.
        for (const resto of fotosARecortar(editor.getDocument() as never)) editor.arrange.rename(resto.id, FOTO_RECORTADA);
      }
      editor.clearSelection();
      corriendo.current = false;
    })();
  }, [editor, docVersion]);
}

/** Lo de arriba como pieza del editor: va SIEMPRE dentro (el chat se monta sólo con su ranura). No dibuja nada. */
export function RecortarAlAbrir(): null {
  const editor = useEditor();
  const docVersion = useEditorState((s) => s.docVersion);
  useRecortarAlAbrir(editor, docVersion);
  return null;
}
