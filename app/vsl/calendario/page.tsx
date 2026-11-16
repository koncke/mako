// /vsl/calendario — el Calendario de contenido de MaKo (Calendar y el «Esta semana» del Marketing CoPilot), con la estructura y el diseño de
// la página del planificador de Metricool (16/11/2026). El contenido y la referencia: app/vsl/_competencia/calendario.ts. Es una ruta FIJA:
// le gana a /vsl/[slug] (un documento de Web Generator con el slug «calendario» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_CALENDARIO } from '../_competencia/calendario';

export const metadata: Metadata = metadataDeLanding(LANDING_CALENDARIO);

export default function Page() {
  return <LandingCompetencia landing={LANDING_CALENDARIO} />;
}
