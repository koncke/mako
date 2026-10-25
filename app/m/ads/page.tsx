// =============================================================================
// /m/ads — el Media Buyer en el teléfono (25/10/2026)
// =============================================================================
// El teléfono de Madgicx · AI Marketer (docs/media-buyer/referencias/madgicx/academy-11.png y academy-12.png): la tarjeta del
// saludo con la mascota y el número de decisiones, las decisiones en una lista, y al tocar una, lo que cambia, los
// números y el porqué, con «Descartar» y el botón de lanzar abajo («Swipe to Launch» → deslizar la fila a la derecha).
// Reemplaza al Ads Manager del teléfono (período, resumen y campañas), que se borró con el de la computadora.
//
// Quién: la regla del Sidebar para `ads-manager` (el admin del negocio). Quién LANZA: el mismo guard de escritorio
// (`wsDeAdsManager`), y sólo si el negocio con el que escribiría es el que se está mirando.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { PantallaM, VacioM } from '@/app/m/_ui';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { MediaBuyerM } from './MediaBuyerM';
import '@/app/ads-manager/mb-paleta.css';
import './mb-m.css';

export const dynamic = 'force-dynamic';

export default async function MediaBuyerMovil() {
  const ctx = await requireMovil({ navKey: 'ads-manager' });
  if (ctx.ws == null) return <PantallaM><VacioM frase="Elige un negocio para ver su Media Buyer." /></PantallaM>;
  const [op, guardada, dec, cupo] = await Promise.all([wsDeAdsManager(), leerConfig(ctx.ws), leerDecisiones(ctx.ws, 30), cupoDe(ctx.ws)]);
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const puedeOperar = typeof op === 'number' && op === ctx.ws;
  const nombre = (ctx.sesion.nombre ?? '').trim().split(/\s+/)[0] || 'equipo';
  return (
    <PantallaM>
      <MediaBuyerM nombre={nombre} config={config} decisiones={dec.decisiones} puedeOperar={puedeOperar} />
    </PantallaM>
  );
}
