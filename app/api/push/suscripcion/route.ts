// =============================================================================
// /api/push/suscripcion — registrar o dar de baja ESTE teléfono para los Web Push
// =============================================================================
// POST   { suscripcion: PushSubscriptionJSON } → upsert por `endpoint`, atado a la PERSONA.
// DELETE { endpoint }                          → borra la de ESTE teléfono, sólo si es suya.
//
// ⚠️ LA FILA SE ATA A LA PERSONA QUE ESTÁ FRENTE AL TECLADO (`usuarioPropio`, lib/perfil.ts),
// que IGNORA la impersonación: un super admin mirando a un cliente con `?ws=1` que activa los
// avisos los activa para SÍ, con los avisos de SU workspace. Nunca con `getTenantDb` ni con
// el `?ws=` de la pestaña (que el WsFetch le pega a este pedido igual: acá no se lee).
//
// ⚠️ Upsert por `endpoint` (único, mig 0249): el mismo teléfono que entra con OTRA cuenta
// MUEVE la fila a la cuenta nueva, en vez de quedar recibiendo los avisos de las dos.
//
// Sesión sin fila propia (dev-login, contraseña maestra) → `{ ok: true, guardado: false }`:
// no es un error, pero la pantalla tiene que poder decir que no quedó guardado.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { usuarioPropio } from '@/lib/perfil';
import { getSupabaseServer } from '@/lib/supabase';
import { endpointPermitido, plataformaDeUA } from '@/lib/push-payload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// base64url de las claves de la suscripción: p256dh son 65 bytes (87 caracteres), auth 16 (22).
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

type Cuerpo = { suscripcion?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

// La tabla que falta (no una columna): el código nuevo puede llegar antes que la mig 0249.
const sinTabla = (e: { code?: string } | null) => !!e && (e.code === 'PGRST205' || e.code === '42P01');

export async function POST(req: NextRequest) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  let body: Cuerpo;
  try { body = (await req.json()) as Cuerpo; } catch { return Response.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  // Se acepta `{ suscripcion: sub.toJSON() }` (lib/push-cliente.ts, public/sw.js) o el toJSON pelado.
  const s = body.suscripcion ?? body;
  const endpoint = typeof s.endpoint === 'string' ? s.endpoint.trim() : '';
  const p256dh = typeof s.keys?.p256dh === 'string' ? s.keys.p256dh.trim() : '';
  const auth = typeof s.keys?.auth === 'string' ? s.keys.auth.trim() : '';
  if (!endpoint || endpoint.length > 2000 || !endpointPermitido(endpoint)) {
    return Response.json({ ok: false, error: 'endpoint inválido' }, { status: 400 });
  }
  if (!B64URL.test(p256dh) || p256dh.length < 40 || p256dh.length > 300 || !B64URL.test(auth) || auth.length < 8 || auth.length > 200) {
    return Response.json({ ok: false, error: 'claves inválidas' }, { status: 400 });
  }

  const u = await usuarioPropio();
  if (!u) return Response.json({ ok: true, guardado: false });

  const ua = req.headers.get('user-agent') ?? '';
  const { error } = await getSupabaseServer().from('push_suscripciones').upsert({
    usuario_id: u.id,
    endpoint, p256dh, auth,
    plataforma: plataformaDeUA(ua),
    user_agent: ua.slice(0, 400) || null,
    // Una suscripción (re)registrada arranca limpia: su historial de fallos era de la anterior.
    fallos: 0, ultimo_error: null,
  }, { onConflict: 'endpoint' });
  if (error) {
    if (sinTabla(error)) {
      console.error('[push] ⛔ falta la tabla push_suscripciones (mig 0249): la suscripción no se guardó.');
      return Response.json({ ok: false, error: 'sin_tabla' }, { status: 503 });
    }
    console.error('[push] no pude guardar la suscripción:', error.message);
    return Response.json({ ok: false, error: 'No se pudo guardar.' }, { status: 500 });
  }
  return Response.json({ ok: true, guardado: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  let body: { endpoint?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'json inválido' }, { status: 400 }); }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) return Response.json({ ok: false, error: 'falta endpoint' }, { status: 400 });

  const u = await usuarioPropio();
  if (!u) return Response.json({ ok: true, borradas: 0 });
  // Sólo la del PROPIO usuario: un endpoint ajeno (otro teléfono, otra persona) no se toca.
  const { data, error } = await getSupabaseServer().from('push_suscripciones')
    .delete().eq('endpoint', endpoint).eq('usuario_id', u.id).select('id');
  if (error) {
    if (sinTabla(error)) return Response.json({ ok: true, borradas: 0 });
    console.error('[push] no pude borrar la suscripción:', error.message);
    return Response.json({ ok: false, error: 'No se pudo borrar.' }, { status: 500 });
  }
  return Response.json({ ok: true, borradas: (data ?? []).length });
}
