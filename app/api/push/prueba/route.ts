// =============================================================================
// POST /api/push/prueba — una notificación de prueba a la PROPIA persona
// =============================================================================
// El «Probar» de /m/cuenta. Va a todos los teléfonos de quien está frente al teclado
// (`usuarioPropio`, que ignora la impersonación), SIN mirar su preferencia: lo pidió ella.
// El link abre en SU workspace. Contesta el rastro de `enviarPush` para que la pantalla
// distinga «llegó», «no tienes un teléfono activado» y «el servicio no la aceptó».
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { usuarioPropio } from '@/lib/perfil';
import { enviarPushAUsuario } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  const u = await usuarioPropio();
  if (!u) return Response.json({ ok: false, error: 'sin-cuenta', enviados: 0, fallidos: 0, sinSuscripciones: 0 });
  const r = await enviarPushAUsuario(u.id, u.workspaceId, {
    tipo: 'prueba',
    titulo: 'Prueba de avisos',
    cuerpo: 'Así te llegan los avisos de MaKo.',
    ruta: '/m/cuenta',
    tag: 'prueba',
    // Si no llegó en dos minutos, ya no sirve como prueba.
    ttl: 120,
    urgencia: 'high',
  });
  return Response.json({ ok: r.enviados > 0, ...r });
}
