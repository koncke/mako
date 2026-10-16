// =============================================================================
// /m/experimentos — mientras se lee: la FORMA de la pantalla (las tabs y dos tarjetas), no un spinner
// =============================================================================
// La lectura mide EN VIVO cada experimento que corre contra Meta (`getExperimentosView`) y trae todas las
// retros con su reporte: sin esto, tocar «Experiments» en More dejaba la pantalla anterior congelada.
// El título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './experimentos.css';

export default function ExperimentosCargando() {
  return (
    <div className="m-experimentos" aria-busy="true" aria-label="Cargando Experiments">
      <span className="mk-skel m-experimentos-skel-seg" />
      <span className="mk-skel m-experimentos-skel-tarjeta" />
      <span className="mk-skel m-experimentos-skel-tarjeta" />
      <SkeletonFilas filas={2} />
    </div>
  );
}
