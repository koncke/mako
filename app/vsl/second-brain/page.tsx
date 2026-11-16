// /vsl/second-brain — Second Brain, el mapa de lo que MaKo sabe de tu negocio, con la estructura y el diseño de la portada de
// Obsidian (16/11/2026). El contenido y la referencia: app/vsl/_competencia/second-brain.ts. Es una ruta FIJA: le gana a /vsl/[slug].
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_SECOND_BRAIN } from '../_competencia/second-brain';

export const metadata: Metadata = metadataDeLanding(LANDING_SECOND_BRAIN);

export default function Page() {
  return <LandingCompetencia landing={LANDING_SECOND_BRAIN} />;
}
