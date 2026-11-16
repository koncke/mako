// /vsl/closing — Closing, el análisis de tus llamadas de venta, con la estructura y el diseño de la página de AI Call Scoring de
// Hyperbound (16/11/2026). El contenido y la referencia: app/vsl/_competencia/closing.ts. Hasta el 16/11/2026 esta ruta dibujaba
// FeatureDetail con el texto de app/vsl/_detalle/features.ts (sólo Fathom, las dos reuniones y voseo en el titular), que sigue dando
// el nombre y la frase de su tarjeta en la grilla.
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_CLOSING } from '../_competencia/closing';

export const metadata: Metadata = metadataDeLanding(LANDING_CLOSING);

export default function Page() {
  return <LandingCompetencia landing={LANDING_CLOSING} />;
}
