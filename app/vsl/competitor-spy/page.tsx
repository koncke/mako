// /vsl/competitor-spy — la landing de Competitor Spy, con la estructura de la portada de Foreplay.
// El contenido y la referencia: app/vsl/_competencia/competitor-spy.ts. Es una ruta FIJA: le gana a /vsl/[slug].
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_COMPETITOR_SPY } from '../_competencia/competitor-spy';

export const metadata: Metadata = metadataDeLanding(LANDING_COMPETITOR_SPY);

export default function Page() {
  return <LandingCompetencia landing={LANDING_COMPETITOR_SPY} />;
}
