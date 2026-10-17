'use client';

// =============================================================================
// VisorStoriesM — la secuencia del día como la ve quien la mira: el visor de historias de Instagram
// =============================================================================
// Copiado de la estructura del visor de Instagram (no de su marca): un frame por pantalla en 9:16, los SEGMENTOS
// arriba (uno por frame, llenos hasta el que se mira), el formato del frame donde Instagram pone la cuenta, el texto
// grande al centro, lo interactivo como un sticker, y abajo la indicación de producción. Tocar el tercio izquierdo
// vuelve; el resto, avanza (los dos lados de Instagram). Sin avance automático: es para leer y grabar, no para
// mirar pasar, y un frame que se va solo a los 5 s se lleva el texto a mitad de lectura.
//
// Los colores son de la casa: el fondo es el de la sidebar (oscuro en los dos temas) y lo de encima va en blanco
// literal, como en el reproductor de Video (app/m/video/video.css). El que lo monta le pone `key` por secuencia:
// una secuencia nueva arranca en el frame 1.
// =============================================================================

import { useState } from 'react';
import type { PiezaStory } from '@/lib/ig-writer';

export function VisorStoriesM({ pieza }: { pieza: PiezaStory }) {
  const n = pieza.frames.length;
  const [i, setI] = useState(0);
  const f = pieza.frames[Math.min(i, n - 1)];
  if (!f) return null;
  const ir = (d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d)));
  return (
    <figure
      className="m-stories-visor"
      aria-roledescription="historia"
      aria-label={`Frame ${i + 1} de ${n}`}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1); }}
    >
      <div className="m-stories-visor__segs" aria-hidden>
        {pieza.frames.map((_, k) => <i key={k} data-lleno={k <= i ? '' : undefined} />)}
      </div>
      <div className="m-stories-visor__cabeza" aria-hidden>
        <span className="m-stories-visor__tipo">{f.tipo}</span>
        <span className="m-stories-visor__n">{i + 1}/{n}</span>
      </div>

      <div className="m-stories-visor__centro">
        {f.texto && <p className="m-stories-visor__texto">{f.texto}</p>}
        {f.interactivoManual && <span className="m-stories-visor__sticker">Sticker · a mano</span>}
      </div>

      {f.indicacion && <figcaption className="m-stories-visor__prod">{f.indicacion}</figcaption>}

      <button type="button" className="m-stories-visor__toque m-stories-visor__toque--atras" aria-label="Frame anterior"
        disabled={i === 0} onClick={() => ir(-1)} />
      <button type="button" className="m-stories-visor__toque m-stories-visor__toque--sigue" aria-label="Frame siguiente"
        disabled={i >= n - 1} onClick={() => ir(1)} />
    </figure>
  );
}
