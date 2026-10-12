// =============================================================================
// /m/landing/[id] — mientras se abre la landing: el marco de la página, no un spinner
// =============================================================================

import '../landing.css';

export default function LandingTrabajoCargando() {
  return (
    <div className="m-landing-sola" aria-busy="true" aria-label="Cargando la landing">
      <div className="m-landing-pagina m-landing-pagina--cargando mk-skel" />
    </div>
  );
}
