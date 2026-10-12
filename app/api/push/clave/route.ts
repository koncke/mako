// =============================================================================
// GET /api/push/clave — la clave PÚBLICA VAPID, para que el navegador se suscriba
// =============================================================================
// No es un secreto (viaja en cada suscripción), pero se pide con sesión: sólo una persona
// logueada se suscribe, y así la ruta no entra a PUBLICOS. La pide lib/push-cliente.ts al
// activar los avisos y public/sw.js cuando el navegador rota la suscripción.
//
// La clave sale de `credenciales` del workspace de PLATAFORMA (lib/push.ts), nunca de una
// variable NEXT_PUBLIC_*: así hay UN solo lugar donde vive el par.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { clavePublicaPush } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  const publicKey = await clavePublicaPush();
  // Sin claves el push está APAGADO (lib/push.ts ya lo logueó): 503, no un 500 genérico.
  if (!publicKey) return Response.json({ ok: false, error: 'sin-claves' }, { status: 503 });
  return Response.json({ ok: true, publicKey }, { headers: { 'Cache-Control': 'no-store' } });
}
