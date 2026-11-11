// /vsl/copywriting — la landing de Copywriting (las páginas de MaKo, copiadas de Notion), con la estructura de The Copy
// Machine. El contenido y la referencia: app/vsl/_competencia/copywriting.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un
// documento de Web Generator con el slug «copywriting» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_COPYWRITING } from '../_competencia/copywriting';

export const metadata: Metadata = metadataDeLanding(LANDING_COPYWRITING);

export default function Page() {
  return <LandingCompetencia landing={LANDING_COPYWRITING} />;
}
