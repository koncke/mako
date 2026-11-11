// /vsl/image — la landing de Image (el editor de diseño de MaKo), con la estructura de la portada de PostNitro.
// El contenido y la referencia: app/vsl/_competencia/image.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un documento
// de Web Generator con el slug «image» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_IMAGE } from '../_competencia/image';

export const metadata: Metadata = metadataDeLanding(LANDING_IMAGE);

export default function Page() {
  return <LandingCompetencia landing={LANDING_IMAGE} />;
}
