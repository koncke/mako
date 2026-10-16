// =============================================================================
// /m/second-brain — mientras se arma el mapa: la FORMA de la pantalla, no un spinner
// =============================================================================
// `construirCerebro()` son 21 lecturas en paralelo y el layout de d3-force en el server: sin esto, tocar
// «Second Brain» en More dejaba More congelado hasta que llegaba todo. El buscador, la caja del mapa y una
// lista; el título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './second-brain.css';

export default function SecondBrainCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando tu Second Brain">
      <div className="mk-skel m-second-brain-skel-buscar" />
      <div className="mk-skel m-second-brain-skel-mapa" />
      <div className="m-second-brain-skel-lista"><SkeletonFilas filas={4} /></div>
    </div>
  );
}
