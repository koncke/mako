// /vsl/web-generator — la landing del Web Generator, con la estructura de la página de HighLevel AI Studio.
// El contenido y la referencia: app/vsl/_competencia/web-generator.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un
// documento de Web Generator con el slug «web-generator» no se vería aquí).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_WEB_GENERATOR } from '../_competencia/web-generator';

export const metadata: Metadata = metadataDeLanding(LANDING_WEB_GENERATOR);

export default function Page() {
  return <LandingCompetencia landing={LANDING_WEB_GENERATOR} />;
}
