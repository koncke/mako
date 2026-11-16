// /vsl/classroom — Classroom, el curso y la comunidad de tus alumnos, con la estructura y el diseño de la portada de Circle
// (16/11/2026). El contenido y la referencia: app/vsl/_competencia/classroom.ts. Es una ruta FIJA: le gana a /vsl/[slug] (un
// documento de Web Generator con el slug «classroom» no se vería acá).
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_CLASSROOM } from '../_competencia/classroom';

export const metadata: Metadata = metadataDeLanding(LANDING_CLASSROOM);

export default function Page() {
  return <LandingCompetencia landing={LANDING_CLASSROOM} />;
}
