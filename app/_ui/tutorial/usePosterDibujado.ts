'use client';
// =============================================================================
// ¿EL PÓSTER DEL VIDEO YA ESTÁ DIBUJADO? (20/11/2026, el Cerebro)
// =============================================================================
// El «dale play» (y cualquier marca sobre un video) oscurece todo menos el video. Con el arranque en frío de un deploy, la tarjeta salía
// sobre un cuadro vacío o negro: el manifiesto o el póster venían en camino, y «a la vista» (useDalePlay) mide el LUGAR, no si hay algo
// dibujado. Las marcas esperan al póster (la regla: entrada.ts → videoDibujado). Lo usan VideoDelMomento (la bienvenida, el WhatsApp,
// los coaches) y, en el reto, el video de cada día y el de muestra.
//   · Un `<video poster>` no avisa cuándo cargó su póster: se pide el mismo archivo con un `Image` (la misma URL, la misma caché del
//     navegador) y cuenta cuando ESE carga.
//   · Un póster ya en la caché puede estar `complete` antes de escuchar el `load`: se mira enseguida.
//   · Uno roto (`naturalWidth` 0) no cuenta: no hay nada dibujado que señalar.
//   · La llegada al reto dibuja su póster en un `<img>` propio y lo anota con su `onLoad` (app/second-brain/LlegadaAlReto.tsx).
// =============================================================================
import { useEffect, useState } from 'react';
import { videoDibujado } from './entrada';

type Imagen = Pick<HTMLImageElement, 'onload' | 'src' | 'complete' | 'naturalWidth'>;

/** Pide el póster y llama a `alCargar` cuando cargó de verdad (o enseguida, si ya estaba en la caché). Devuelve cómo dejar de esperar. */
export function esperarPoster(poster: string, alCargar: () => void, crear: () => Imagen = () => new Image()): () => void {
  const img = crear();
  const cargo = () => { if (img.naturalWidth > 0) alCargar(); };
  img.onload = cargo;
  img.src = poster;
  if (img.complete) cargo();
  // Al irse (el video se desmontó o cambió de póster), deja de escuchar: un `load` que llega después no avisa a nadie.
  return () => { img.onload = null; };
}

export function usePosterDibujado(poster: string | null | undefined): boolean {
  const [posterCargado, setPosterCargado] = useState<string | null>(null);
  useEffect(() => {
    if (!poster || typeof Image === 'undefined') return;
    return esperarPoster(poster, () => setPosterCargado(poster));
  }, [poster]);
  return videoDibujado({ poster, posterCargado });
}
