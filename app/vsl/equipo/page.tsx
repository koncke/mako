// /vsl/equipo — Equipo, los roles y permisos de tu equipo de ventas (setter, closer y admin), con la estructura y el diseño de la página
// «Equipos» de Pipedrive (16/11/2026). El contenido y la referencia: app/vsl/_competencia/equipo.ts. Hasta el 16/11/2026 esta ruta dibujaba
// FeatureDetail con el texto de app/vsl/_detalle/features.ts, que sigue dando el nombre y la frase de su tarjeta en la grilla.
import type { Metadata } from 'next';
import LandingCompetencia, { metadataDeLanding } from '../_competencia/LandingCompetencia';
import { LANDING_EQUIPO } from '../_competencia/equipo';

export const metadata: Metadata = metadataDeLanding(LANDING_EQUIPO);

export default function Page() {
  return <LandingCompetencia landing={LANDING_EQUIPO} />;
}
