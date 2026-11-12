// /vsl/video — la landing de Video, con la estructura de la portada de Cherry Studio.
// El contenido y la referencia: app/vsl/_competencia/video.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un documento de
// Web Generator con el slug «video» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_VIDEO } from '../_competencia/video';

export const metadata: Metadata = metadataDeLanding(LANDING_VIDEO);

export default function Page() {
  return <LandingCompetencia landing={LANDING_VIDEO} />;
}
