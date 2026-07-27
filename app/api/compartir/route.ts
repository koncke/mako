// =============================================================================
// /api/compartir — crear, listar y revocar links públicos de CUALQUIER curso
// =============================================================================
// Generaliza lo que nació para "Branding MaKo": el mismo mecanismo comparte un
// curso entero, una sección del material o una pieza suelta.
//   recurso='curso'    → recursoId = slug del curso
//   recurso='branding'  → recursoId = sección o grupo del material
//
// Solo super-admin: con esWorkspaceDueno un closer o un setter del ws1 podría
// acuñar links públicos.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { sendEmail, getEmailFrom } from '@/lib/resend';
import {
  crearShare, listarShares, revocarShare, agregarInvitado, listarInvitados,
  revocarInvitado, marcarEnviado, emailValido,
  type ShareAlcance, type ShareModo,
} from '@/lib/shares';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WS = 1;
const RECURSOS = ['curso', 'branding'];
const ALCANCES: ShareAlcance[] = ['todo', 'seccion', 'grupo', 'item'];
const MODOS: ShareModo[] = ['link', 'invitados'];

const base = (req: NextRequest) => process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const recurso = req.nextUrl.searchParams.get('recurso') || 'curso';
    const recursoId = req.nextUrl.searchParams.get('recursoId');
    if (!RECURSOS.includes(recurso)) return NextResponse.json({ ok: false, error: 'recurso inválido' }, { status: 400 });

    const todos = await listarShares(WS, recurso);
    const filtrados = recursoId ? todos.filter((s) => s.recurso_id === recursoId) : todos;
    const conInvitados = await Promise.all(filtrados.map(async (s) => ({
      ...s, invitados: s.modo === 'invitados' ? await listarInvitados(s.id as number) : [],
    })));
    return NextResponse.json({ ok: true, shares: conInvitados });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const recurso = String(body.recurso || 'curso');
    const recursoId = body.recursoId ? String(body.recursoId) : null;
    const modo = String(body.modo || 'link') as ShareModo;
    // Compartir un curso es siempre "esta cosa entera"; el material de marca
    // admite además sección y grupo.
    const alcance = (body.alcance ? String(body.alcance) : (recurso === 'curso' ? 'item' : 'grupo')) as ShareAlcance;
    const emails: string[] = Array.isArray(body.emails) ? body.emails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean) : [];

    if (!RECURSOS.includes(recurso)) return NextResponse.json({ ok: false, error: 'recurso inválido' }, { status: 400 });
    if (!ALCANCES.includes(alcance)) return NextResponse.json({ ok: false, error: 'alcance inválido' }, { status: 400 });
    if (!MODOS.includes(modo)) return NextResponse.json({ ok: false, error: 'modo inválido' }, { status: 400 });
    if (alcance !== 'todo' && !recursoId) return NextResponse.json({ ok: false, error: 'falta qué compartir' }, { status: 400 });
    if (modo === 'invitados' && !emails.length) return NextResponse.json({ ok: false, error: 'agregá al menos un email' }, { status: 400 });
    const malos = emails.filter((e) => !emailValido(e));
    if (malos.length) return NextResponse.json({ ok: false, error: `email inválido: ${malos[0]}` }, { status: 400 });

    const { id, token } = await crearShare({
      ws: WS, recurso, alcance, recursoId, modo,
      etiqueta: body.etiqueta ? String(body.etiqueta).slice(0, 140) : null,
      expiraAt: body.expiraAt ? String(body.expiraAt) : null,
    });

    const raiz = base(req);
    const enlace = modo === 'link' ? `${raiz}/compartido/${token}` : null;

    const invitados: Array<{ email: string; enviado: boolean; error?: string }> = [];
    if (modo === 'invitados') {
      const from = await getEmailFrom().catch(() => '');
      for (const email of emails) {
        try {
          const inv = await agregarInvitado(id, email);
          const url = `${raiz}/compartido/${inv.token}`;
          let enviado = false, err: string | undefined;
          if (from) {
            const r = await sendEmail({
              to: email, from,
              subject: body.etiqueta ? `Te compartieron: ${String(body.etiqueta)}` : 'Te compartieron material de MaKo',
              html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#171A21">
                <p>Te compartieron <b>${body.etiqueta ? String(body.etiqueta) : 'material de MaKo'}</b>.</p>
                <p><a href="${url}" style="display:inline-block;padding:11px 20px;border-radius:9px;background:#2F6FED;color:#fff;text-decoration:none;font-weight:600">Abrir</a></p>
                <p style="color:#7c869b;font-size:13px">Este enlace es personal: no lo reenvíes.</p>
              </div>`,
            }).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'error' }));
            enviado = !!(r as { ok?: boolean }).ok;
            if (!enviado) err = (r as { error?: string }).error || 'no se pudo enviar';
            else await marcarEnviado(inv.id);
          } else err = 'email no configurado';
          invitados.push({ email, enviado, error: err });
        } catch (e) {
          invitados.push({ email, enviado: false, error: e instanceof Error ? e.message : 'error' });
        }
      }
    }

    return NextResponse.json({ ok: true, id, enlace, invitados });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const id = Number(req.nextUrl.searchParams.get('id') || 0);
    const invitadoId = Number(req.nextUrl.searchParams.get('invitado') || 0);
    if (invitadoId) { await revocarInvitado(invitadoId); return NextResponse.json({ ok: true }); }
    if (!id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
    await revocarShare(WS, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
