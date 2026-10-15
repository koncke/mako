// =============================================================================
// POST /api/auth/restablecer — «Olvidé mi contraseña» (15/10/2026)
// =============================================================================
// Circuito 3 de docs/diseno-login-contrasena.md, con tres acciones:
//   · `pedir` {email}: crea un link de un solo uso (30 min) y lo manda por la automatización de SuperAdmin
//     «Restablecer contraseña» (`avisarPedidoDeRestablecer`, del chat de Automations). Contesta SIEMPRE
//     lo mismo y tarda lo mismo, exista o no el correo: no cuenta qué correos tienen cuenta.
//   · `abrir` {token}: si el link sigue vivo, qué pide (si la cuenta tiene segundo factor, también ése).
//   · `cambiar` {token, contrasena, metodo?, codigo?}: la contraseña nueva, y ADEMÁS el segundo factor si
//     la cuenta lo tiene (decisión 2, opción A, construida así mientras Martín no conteste: con el link
//     solo, quien roba el correo cambia la contraseña con un clic).
//
// Vive bajo /api/auth (público en el proxy: se autentica sola), así que el Origin lo chequea ELLA.
// El token llega en el CUERPO (la página lo lee del fragmento del link): nunca en la URL.
// =============================================================================

import { after, NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import { correoNormalizado, problemaDeContrasena } from '@/lib/contrasena-reglas';
import { guardarContrasena } from '@/lib/contrasena';
import { crearLinkDeRestablecer, leerLinkDeRestablecer, sumarIntentoAlLink, gastarLink } from '@/lib/contrasena-restablecer';
import { estadoMfa, cantidadFactores, intentar, intentoOk, verificarTotpLogin, usarCodigoRecuperacion, registrarEvento, MENSAJE_FRENADO } from '@/lib/mfa';
import { avisarPedidoDeRestablecer } from '@/lib/restablecer-aviso';

export const dynamic = 'force-dynamic';

const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const LINK_MUERTO = 'El link venció o ya se usó. Pide otro.';
/** La respuesta de `pedir`, la misma para todos. (Sin `export`: un route.ts sólo exporta sus handlers.) */
const RESPUESTA_PEDIDO = 'Si es tu cuenta, te llega un mail en unos minutos.';
/** Lo que tarda `pedir` como mínimo, exista o no la cuenta (crear el link y la consulta tardan algo). */
const DEMORA_PEDIDO_MS = 700;

function origenValido(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

async function correoDe(usuarioId: number): Promise<string | null> {
  const { data } = await getSupabaseServer().from('usuarios').select('email, estado').eq('id', usuarioId).maybeSingle();
  const u = data as { email: string | null; estado: string | null } | null;
  return u?.email && u.estado !== 'suspendido' ? u.email : null;
}

export async function POST(req: NextRequest) {
  if (!origenValido(req)) return no('origen no permitido', 403);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = String(body.accion ?? '');

  // ── Pedir el link ──────────────────────────────────────────────────────────
  if (accion === 'pedir') {
    const t0 = Date.now();
    const email = correoNormalizado(body.email);
    try {
      const u = email ? await buscarUsuarioPorEmail(email) : null;
      if (u && u.id > 0 && u.estado !== 'suspendido') {
        const r = await crearLinkDeRestablecer(u.id);
        if (r && 'link' in r) {
          const uid = u.id;
          const link = r.link;
          // Fuera del camino de la respuesta: el mail no puede frenar ni delatar nada. El resultado va al
          // registro con su motivo ('corrio' | 'apagado' | 'ilegible') y SIN el link.
          after(async () => {
            const res = await avisarPedidoDeRestablecer(uid, link).catch(() => 'ilegible' as const);
            await registrarEvento(uid, 'restablecer-pedido', res === 'corrio', res);
          });
        } else {
          await registrarEvento(u.id, 'restablecer-pedido', false, r ? 'frenado' : 'no se pudo crear el link');
        }
      }
    } catch { /* lo mismo que siempre: no se cuenta nada */ }
    const falta = DEMORA_PEDIDO_MS - (Date.now() - t0);
    if (falta > 0) await new Promise((ok) => setTimeout(ok, falta));
    return NextResponse.json({ ok: true, mensaje: RESPUESTA_PEDIDO });
  }

  // ── Abrir el link: ¿sigue vivo, y qué pide? ────────────────────────────────
  if (accion === 'abrir') {
    const l = await leerLinkDeRestablecer(body.token);
    if (!l) return no(LINK_MUERTO, 410);
    const cuenta = await correoDe(l.usuarioId);
    if (!cuenta) return no(LINK_MUERTO, 410);
    const e = await estadoMfa(l.usuarioId);
    return NextResponse.json({
      ok: true, cuenta,
      pideFactor: cantidadFactores(e) > 0,
      metodos: { totp: e.totp, recuperacion: e.codigosRestantes > 0 },
    });
  }

  // ── Cambiar la contraseña ──────────────────────────────────────────────────
  if (accion === 'cambiar') {
    const l = await leerLinkDeRestablecer(body.token);
    if (!l) return no(LINK_MUERTO, 410);
    const cuenta = await correoDe(l.usuarioId);
    if (!cuenta) return no(LINK_MUERTO, 410);
    // Lo barato primero y sin gastar nada: una contraseña que no sirve se corrige en el acto.
    const problema = problemaDeContrasena(body.contrasena, cuenta);
    if (problema) return no(problema);

    const e = await estadoMfa(l.usuarioId);
    if (cantidadFactores(e) > 0) {
      const metodo = body.metodo === 'recuperacion' ? 'recuperacion' : 'totp';
      const codigo = String(body.codigo ?? '');
      const intento = await intentar(l.usuarioId, `restablecer-${metodo}`);
      if (!intento) return no(MENSAJE_FRENADO, 429);
      const vale = metodo === 'recuperacion' ? await usarCodigoRecuperacion(l.usuarioId, codigo) : await verificarTotpLogin(l.usuarioId, codigo);
      if (!vale) {
        await sumarIntentoAlLink(l);
        return no('El código no coincide.');
      }
      await intentoOk(intento);
    }

    // GASTAR antes de guardar: dos pestañas con el mismo link no cambian la contraseña dos veces.
    if (!(await gastarLink(l))) return no(LINK_MUERTO, 410);
    const g = await guardarContrasena(l.usuarioId, body.contrasena, cuenta);
    if (!g.ok) return no(g.nuestro ? 'No se pudo guardar. Pide otro link.' : g.error);
    await registrarEvento(l.usuarioId, 'contrasena-restablecer', true);
    return NextResponse.json({ ok: true });
  }

  return no('acción inválida');
}
