// =============================================================================
// /api/perfil/notif-inapp — pop-up y sonido de la persona logueada
// =============================================================================
// Ruta propia y no un campo más de /api/perfil porque quien la consume es el
// NotificationsProvider, que está montado en el layout y corre en cada pantalla
// de la app. /api/perfil hace cuatro lecturas (perfil, prefs del workspace,
// número del dueño, grupo de WhatsApp) y de todo eso al provider le sirve una:
// pagar las otras tres en cada carga de página no tiene sentido.

import type { NextRequest } from 'next/server';
import { getNotifInApp, setNotifInApp } from '@/lib/perfil';
import type { NotifInApp } from '@/lib/notif-catalogo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return Response.json({ ok: true, inApp: await getNotifInApp() });
}

export async function POST(req: NextRequest) {
  let body: { inApp?: NotifInApp };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'json inválido' }, { status: 400 });
  }
  if (!body.inApp) return Response.json({ ok: false, error: 'falta inApp' }, { status: 400 });
  try {
    // `guardado:false` = sesión sin cuenta propia (contraseña maestra, acceso de
    // desarrollo). No es un error, pero la pantalla tiene que poder decirlo en vez
    // de mostrar un tilde verde sobre algo que se pierde al recargar.
    const { inApp, guardado } = await setNotifInApp(body.inApp);
    return Response.json({ ok: true, inApp, guardado });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
