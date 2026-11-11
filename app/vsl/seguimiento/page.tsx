// /vsl/seguimiento — Automations, tu setter con IA, con la estructura de la landing de SetSmart (11/11/2026).
// El contenido y la referencia: app/vsl/_competencia/seguimiento.ts. Hasta el 11/11/2026 esta ruta dibujaba FeatureDetail
// con el texto de app/vsl/_detalle/features.ts, que sigue dando el nombre y la frase de su tarjeta en la grilla.
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_SEGUIMIENTO } from '../_competencia/seguimiento';

export const metadata: Metadata = metadataDeLanding(LANDING_SEGUIMIENTO);

export default function Page() {
  return <LandingCompetencia landing={LANDING_SEGUIMIENTO} />;
}
