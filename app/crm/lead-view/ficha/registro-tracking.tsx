'use client';

// =============================================================================
// ficha/registro-tracking — los COMPONENTES de los bloques de la tab Tracking
// =============================================================================
// Las reglas están en ./reglas-tracking.ts. Los dos archivos son del frente de Tracking (ver ./tipos.ts).
// HOY (14/10/2026) `visitas` es ComportamientoCard ENTERA (visitas, video, actividad registrada y la
// grabación), en un solo bloque. «Actividad registrada» va adentro de la tarjeta, no suelta debajo
// (tests/crm-tracking-ficha.test.ts). El origen pasó al Resumen con la plantilla de respaldo.
// =============================================================================

import { ComportamientoCard } from '../ComportamientoCard';
import { REGLAS_TRACKING } from './reglas-tracking';
import type { EntradaRegistro, PropsBloque } from './tipos';

function Comportamiento({ ctx }: PropsBloque) {
  const { lead, data } = ctx;
  const { visitas, vslEng } = data;
  return (
    <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct}
      tieneVisitor={!!lead.visitor_id} porVideo={vslEng.porVideo} videos={data.videos} eventos={data.tracking} pixelPuesto={data.pixelPuesto} replay={data.replay} />
  );
}

export const REGISTRO_TRACKING: { [K in keyof typeof REGLAS_TRACKING]: EntradaRegistro } = {
  visitas: { Componente: Comportamiento, ...REGLAS_TRACKING.visitas },
};
