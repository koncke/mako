// /vsl/offer — la landing de Offer, con la estructura de la página de Atlas AI de Done For You.
// El contenido y la referencia: app/vsl/_competencia/offer.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un documento de
// Web Generator con el slug «offer» no se vería aquí).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_OFFER } from '../_competencia/offer';

export const metadata: Metadata = metadataDeLanding(LANDING_OFFER);

export default function Page() {
  return <LandingCompetencia landing={LANDING_OFFER} />;
}
