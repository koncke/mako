'use client';

// =============================================================================
// La miniatura DIBUJADA de una plantilla de anuncio en «Nuevo video» (F160, 18/11/2026)
// =============================================================================
// La ranura `miniatura` de PantallaCrear estaba reservada para Video desde el 29/10 (app/_crear/PantallaCrear.tsx) y
// nadie la llenaba: las tarjetas de anuncio de «Nuevo video» se veían como el marco vacío con su rótulo, mientras la
// Biblioteca del editor ya las dibujaba con `MiniaturaPlantilla`. Esto es esa misma miniatura, la de la Biblioteca: quieta
// en su portada y en bucle con el mouse encima. Para lo que no es una plantilla de anuncio (los lienzos, las guiadas,
// «Generar con IA»), null: la tarjeta sigue con lo suyo.
//
// ⚠️ IMPORT ESTÁTICO, A PROPÓSITO, Y SIN EL MOTOR. `MiniaturaPlantilla` vive en `_opencut/` pero su grafo es liviano (el
// dibujo en canvas 2D, la escena, las animaciones y la muestra de fuentes: ~21 módulos, ninguno del núcleo, del .wasm ni de
// mediabunny), y se dibuja en cuanto se abre la portada. Cargarlo a pedido tenía dos caminos y los dos eran peores:
//   · por la puerta del motor (./editor-cargado.ts) → bajar el motor entero (1,1 MB) para dibujar tarjetas;
//   · por un `import()` propio → otro grupo con SU copia de esos módulos, que el editor también trae: la duplicación que
//     cerró tests/video-editor-fluidez.test.ts (F1).
// Lo que SÍ no puede pasar es que el grafo de esta pieza llegue al motor: lo fija tests/video-editor-miniatura-nuevo.test.ts.
// =============================================================================

import type { ReactNode } from 'react';
import type { PlantillaCrear } from '@/app/_crear/reglas';
import { cajaDeMiniatura } from '@/app/_crear/reglas';
import { MiniaturaPlantilla } from './_opencut/plantillas/components/miniatura-plantilla';
import { plantillaDeTarjeta } from './plantillas-crear';

/**
 * La miniatura de una tarjeta de «Nuevo video» (la ranura `miniatura` de PantallaCrear). Una función de módulo, no un
 * cierre: la grilla la recibe por props y una identidad nueva en cada render la redibujaría entera.
 */
export function miniaturaDeNuevoVideo(p: PlantillaCrear, activa: boolean): ReactNode {
  const plantilla = plantillaDeTarjeta(p.id);
  if (!plantilla) return null;
  // A SU proporción dentro del 4:3 de la tarjeta, como una imagen (`cajaDeMiniatura`): un canvas a lo ancho de la caja
  // estiraría el 9:16. El borde y la sombra, los de la imagen de una tarjeta (app/_crear/crear.css, `img[data-caja]`), y el
  // fondo negro, el de la tarjeta de la Biblioteca.
  return (
    <span
      data-miniatura-plantilla={plantilla.id}
      style={{
        ...(cajaDeMiniatura(p.formato) ?? {}),
        display: 'block',
        overflow: 'hidden',
        borderRadius: 4,
        background: '#000',
        boxShadow: '0 1px 2px rgba(0,0,0,.08), 0 6px 14px -6px rgba(0,0,0,.28)',
      }}
    >
      <MiniaturaPlantilla plantilla={plantilla} animar={activa} />
    </span>
  );
}
