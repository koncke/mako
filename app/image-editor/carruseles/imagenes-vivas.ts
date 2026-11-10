'use client';

// =============================================================================
// Las imágenes de un carrusel que CARGAN (10/11/2026)
// =============================================================================
// Martín, con la grilla de «Encuentra tu siguiente OUTLIER»: carruseles «con la imagen rota, con el ícono y el texto
// alternativo a la vista» (@reynardlowell «Comment NATURE…», @growithalex «I paired eight fonts…»). Eran portadas que la
// biblioteca guardó con la URL del CDN de Instagram, y ese CDN contesta 403 mucho antes de su `oe`
// (docs/hallazgos-carruseles.md, «Portadas rotas y carruseles sin flechas»). Los datos se arreglaron; las que Instagram ya no
// sirve no se pueden bajar, y una pieza nueva puede llegar con una URL que muere mañana.
//
// La regla: una imagen que no carga NO se dibuja. Se saca de la lista (las flechas y el contador cuentan sólo las que se ven)
// y, si no queda ninguna, la pantalla muestra el respaldo que ya tenía para «sin portada». Nunca el ícono roto del navegador.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';

/** Las imágenes que no se rompieron, en su orden. */
export function sinRotas(imagenes: readonly string[], rotas: ReadonlySet<string>): string[] {
  return rotas.size ? imagenes.filter((u) => !rotas.has(u)) : imagenes.slice();
}

/** `vivas`: las que se pueden dibujar. `alFallar(src)` va en el `onError` de cada `<img>`. */
export function useImagenesVivas(imagenes: readonly string[]): { vivas: string[]; alFallar: (src: string) => void } {
  const [rotas, setRotas] = useState<ReadonlySet<string>>(() => new Set());
  const clave = imagenes.join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- la lista llega nueva en cada render (imagenesDe); la clave es su contenido
  const vivas = useMemo(() => sinRotas(imagenes, rotas), [clave, rotas]);
  const alFallar = useCallback((src: string) => setRotas((r) => (r.has(src) ? r : new Set(r).add(src))), []);
  return { vivas, alFallar };
}
