// /vsl/ai-avatar — la landing de AI Avatar, con la estructura de la página de HeyGen para anuncios UGC.
// El contenido y la referencia: app/vsl/_competencia/ai-avatar.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un documento
// de Web Generator con el slug «ai-avatar» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_AI_AVATAR } from '../_competencia/ai-avatar';

export const metadata: Metadata = metadataDeLanding(LANDING_AI_AVATAR);

export default function Page() {
  return <LandingCompetencia landing={LANDING_AI_AVATAR} />;
}
