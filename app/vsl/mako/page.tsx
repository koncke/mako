// /vsl/mako — el Ops Center (MaKo, el chat que conoce tu negocio), con la estructura de la portada de Holo (11/11/2026).
// El contenido y la referencia: app/vsl/_competencia/mako.ts. Hasta el 11/11/2026 esta ruta dibujaba FeatureDetail con el
// texto de app/vsl/_detalle/features.ts, que sigue dando el nombre y la frase de su tarjeta en la grilla.
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_MAKO } from '../_competencia/mako';

export const metadata: Metadata = metadataDeLanding(LANDING_MAKO);

export default function Page() {
  return <LandingCompetencia landing={LANDING_MAKO} />;
}
