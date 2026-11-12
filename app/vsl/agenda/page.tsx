// /vsl/agenda — la Agenda de MaKo (tu Calendly o Cal.com conectado al CRM, y Calendar), con la estructura de la portada de
// iClosed. El contenido y la referencia: app/vsl/_competencia/agenda.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un
// documento de Web Generator con el slug «agenda» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_AGENDA } from '../_competencia/agenda';

export const metadata: Metadata = metadataDeLanding(LANDING_AGENDA);

export default function Page() {
  return <LandingCompetencia landing={LANDING_AGENDA} />;
}
