// =============================================================================
// /m/ads — el Media Buyer en el teléfono (25/10/2026)
// =============================================================================
// Desde el 25/10 ~18:50, con la estructura de AdAmigo, como la computadora (Martín: «Me gusta el de "AdAmigo"
// implementalo de punta en punta»): las mismas piezas, en una columna (MediaBuyerM.tsx).
// Reemplaza al Ads Manager del teléfono (período, resumen y campañas), que se borró con el de la computadora.
//
// Quién: la regla del Sidebar para `ads-manager` (el admin del negocio). Quién LANZA: el mismo guard de escritorio
// (`wsDeAdsManager`), y sólo si el negocio con el que escribiría es el que se está mirando.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { PantallaM, VacioM } from '@/app/m/_ui';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { metasDelMes } from '@/lib/media-buyer/datos';
import { vistaMediaBuyer } from '@/lib/media-buyer/vista';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { MediaBuyerM } from './MediaBuyerM';
import '@/app/ads-manager/aa.css';
import './mb-m.css';

export const dynamic = 'force-dynamic';

export default async function MediaBuyerMovil() {
  const ctx = await requireMovil({ navKey: 'ads-manager' });
  if (ctx.ws == null) return <PantallaM><VacioM frase="Elige un negocio para ver su Media Buyer." /></PantallaM>;
  const [op, guardada, dec, cupo, metas] = await Promise.all([wsDeAdsManager(), leerConfig(ctx.ws), leerDecisiones(ctx.ws, 30), cupoDe(ctx.ws), metasDelMes(ctx.ws).catch(() => null)]);
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const vista = await vistaMediaBuyer(ctx.ws, config.kpi, config.objetivo).catch(() => null);
  const puedeOperar = typeof op === 'number' && op === ctx.ws;
  return (
    <PantallaM>
      <MediaBuyerM config={config} decisiones={dec.decisiones} puedeOperar={puedeOperar} metas={metas} productoDe={vista?.productoDe ?? {}} />
    </PantallaM>
  );
}
