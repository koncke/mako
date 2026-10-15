// =============================================================================
// puerta — la puerta de las rutas de Ads Analyst: sólo el admin del workspace
// =============================================================================
// La usan las nueve rutas de /api/ads-analyst/* (analyze, angles, angle-override, avatares,
// avatar-override, quadrant, sync, valorar, view). Vive en UN lugar a propósito: el agujero que
// cierra fue justo que ninguna de las nueve lo repetía.
//
// ⚠️ POR QUÉ HACE FALTA (auditoría de seguridad, 14/10/2026): todas las pantallas que llaman a estas
// rutas son sólo admin (/ads-writer, /configuraciones, /onboarding, /marketing y el detalle de un
// anuncio del Dashboard, que al closer y al setter les da 403), pero el proxy sólo pide sesión. Un
// closer o un setter con su cookie leía gasto, impresiones y agendas por anuncio (quadrant, view) y
// ESCRIBÍA la config del analista: la lista de ángulos y avatares, los overrides por anuncio y los
// borradores de guion, y disparaba análisis con IA (analyze, sync, valorar). El flag de la pantalla
// protege la pantalla; la API se cierra aparte (AGENTS.md).
//
// El mismo corte que /api/landing-analyst/view: la agencia (getSesionAdmin) o el admin del
// workspace. SIN tabEnCapa a propósito: estas rutas las llaman pantallas de tabs distintas (el
// onboarding y Configuraciones leen los ángulos aunque la capa no tenga Ads Writer), y pedir una
// tab acá le rompería al admin una pantalla que hoy anda.
// =============================================================================

import 'server-only';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';

/** `null` = entra. Si no, el 403 ya armado, con la forma de las rutas (`{ ok: false, error }`). */
export async function soloAdminAdsAnalyst(): Promise<Response | null> {
  if ((await getSesionAdmin()) != null) return null;
  if ((await getRolWsEfectivo()) === 'admin') return null;
  return Response.json({ ok: false, error: 'Solo el admin de la cuenta' }, { status: 403 });
}
