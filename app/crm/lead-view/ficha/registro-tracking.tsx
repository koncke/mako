'use client';

// =============================================================================
// ficha/registro-tracking — los COMPONENTES de los bloques de la tab Tracking
// =============================================================================
// Las reglas están en ./reglas-tracking.ts. Los dos archivos son del frente de Tracking (ver ./tipos.ts).
// HOY (14/10/2026) `visitas` es ComportamientoCard ENTERA (visitas, video, actividad registrada y la
// grabación), en un solo bloque. «Actividad registrada» va adentro de la tarjeta, no suelta debajo
// (tests/crm-tracking-ficha.test.ts). El origen pasó al Resumen con la plantilla de respaldo.
// =============================================================================

import { ComportamientoCard, type PartesComportamiento } from '../ComportamientoCard';
import { REGLAS_TRACKING, partesDeVisitas } from './reglas-tracking';
import type { EntradaRegistro, PropsBloque } from './tipos';

/** Una parte de la tarjeta de siempre, con el título del bloque (los datos son los mismos). */
function parte(partes: (p: PropsBloque) => PartesComportamiento) {
  return function Parte(p: PropsBloque) {
    const { lead, data } = p.ctx;
    const { visitas, vslEng } = data;
    return (
      <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct}
        tieneVisitor={!!lead.visitor_id} porVideo={vslEng.porVideo} videos={data.videos} eventos={data.tracking} pixelPuesto={data.pixelPuesto} sinTracking={data.sinTracking} replay={data.replay}
        partes={partes(p)} rotulo={p.def.id === 'visitas' ? 'Comportamiento' : p.titulo} />
    );
  };
}

export const REGISTRO_TRACKING: { [K in keyof typeof REGLAS_TRACKING]: EntradaRegistro } = {
  // Las visitas, más lo que la hoja no puso aparte (`partesDeVisitas`).
  visitas: { Componente: parte((p) => partesDeVisitas(p.hermanos)), ...REGLAS_TRACKING.visitas },
  'video-visto': { Componente: parte(() => ({ video: true })), ...REGLAS_TRACKING['video-visto'] },
  'actividad-en-pagina': { Componente: parte(() => ({ actividad: true })), ...REGLAS_TRACKING['actividad-en-pagina'] },
  'grabacion-de-visita': { Componente: parte(() => ({ grabacion: true })), ...REGLAS_TRACKING['grabacion-de-visita'] },
};
