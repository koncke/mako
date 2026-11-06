// =============================================================================
// /m/ads — el Media Buyer en el teléfono (25/10/2026)
// =============================================================================
// Desde el 25/10 a la noche, la captura 04 de AdAmigo como la computadora: el mismo árbol de cambios, en una columna
// (MediaBuyerM.tsx).
// Reemplaza al Ads Manager del teléfono (período, resumen y campañas), que se borró con el de la computadora.
//
// Quién: la regla del Sidebar para `ads-manager` (el admin del negocio). Quién LANZA: el mismo guard de escritorio
// (`wsDeAdsManager`), y sólo si el negocio con el que escribiría es el que se está mirando.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { credWs } from '@/lib/credenciales';
import { PantallaM, VacioM } from '@/app/m/_ui';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { vistaMediaBuyer } from '@/lib/media-buyer/vista';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { copilotoListo } from '@/lib/media-buyer/copiloto';
import { getUsuarioActual } from '@/lib/auth';
import { PrimeraEntrada } from '@/app/ads-manager/PrimeraEntrada';
import { MediaBuyerM } from './MediaBuyerM';
import '@/app/ads-manager/aa.css';
import './mb-m.css';

export const dynamic = 'force-dynamic';

export default async function MediaBuyerMovil() {
  const ctx = await requireMovil({ navKey: 'ads-manager' });
  if (ctx.ws == null) return <PantallaM><VacioM frase="Elige un negocio para ver su Media Buyer." /></PantallaM>;
  const [op, guardada, dec, cupo, token, perfil, yo] = await Promise.all([
    wsDeAdsManager(), leerConfig(ctx.ws), leerDecisiones(ctx.ws, 30), cupoDe(ctx.ws),
    credWs('META_ACCESS_TOKEN', ctx.ws).catch(() => null),
    leerPerfilCopiloto(ctx.ws), getUsuarioActual().catch(() => null),
  ]);
  // La primera entrada, igual que en la computadora (app/ads-manager/page.tsx): sólo para quien nunca trabajó con el Media Buyer.
  if (!copilotoListo(perfil) && !guardada.encendido && !guardada.ultimaCorrida && dec.decisiones.length === 0) {
    return <PantallaM><PrimeraEntrada nombre={(yo?.nombre ?? '').trim().split(/\s+/)[0] || 'equipo'} inicial={perfil} /></PantallaM>;
  }
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const vista = await vistaMediaBuyer(ctx.ws, config.kpi, config.objetivo).catch(() => null);
  const puedeOperar = typeof op === 'number' && op === ctx.ws;
  // Con token, la cuenta está conectada. SIN token no se concluye nada: puede estar conectada por Zernio, y preguntárselo
  // sería una llamada a Zernio al abrir la pantalla del teléfono. Con `null`, el cartel de Hoy no afirma que falte la cuenta
  // (lo dice la última corrida, si dejó `estado: 'sin_cuenta'`).
  return (
    <PantallaM>
      <MediaBuyerM config={config} decisiones={dec.decisiones} puedeOperar={puedeOperar} productoDe={vista?.productoDe ?? {}}
        conectada={token ? true : null} />
    </PantallaM>
  );
}
