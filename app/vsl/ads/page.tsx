// /vsl/ads — la landing del Marketing CoPilot, con la estructura de la portada de Master Ads (11/11/2026).
// Antes dibujaba FeatureDetail slug="ads" (el media buyer con IA); el contenido nuevo y su referencia viven en
// app/vsl/_competencia/ads.ts. Los textos viejos de app/vsl/_detalle/features.ts siguen ahí para la grilla de funciones.
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_ADS } from '../_competencia/ads';

export const metadata: Metadata = metadataDeLanding(LANDING_ADS);

export default function Page() {
  return <LandingCompetencia landing={LANDING_ADS} />;
}
