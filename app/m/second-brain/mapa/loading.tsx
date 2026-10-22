// =============================================================================
// /m/second-brain/mapa — mientras se arma el grafo: su lienzo oscuro, no la portada de antes
// =============================================================================
// Desde el 22/10/2026 la pantalla ES el grafo (SecondBrainM.tsx): sin esto heredaba el esqueleto de /m/second-brain (un
// buscador, la caja del mapa y una lista), que era la forma de la portada que ya no existe. `construirCerebro()` son 21
// lecturas y el layout de d3-force en el server: el lienzo oscuro aparece al toque, con una mancha donde va el grafo.

import '../second-brain.css';

export default function MapaCargando() {
  return (
    <div className="m-second-brain-grafo" data-tema="oscuro" aria-busy="true" aria-label="Cargando tu Second Brain">
      <div className="mk-skel m-second-brain-skel-grafo" />
    </div>
  );
}
