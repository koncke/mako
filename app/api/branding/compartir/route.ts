// =============================================================================
// /api/branding/compartir — crear, listar y revocar links de "Branding MaKo"
// =============================================================================
// Solo super-admin (getSesionAdmin): con esWorkspaceDueno un closer o un setter
// del ws1 podría acuñar links públicos.
//
// El token se devuelve UNA sola vez, al crearlo: en base vive solo su sha256.
// Si se pierde, se crea otro y se revoca el viejo.

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

const WS = 1;                                   // el material de marca es de la agencia
const ALCANCES: ShareAlcance[] = ['todo', 'seccion', 'grupo', 'item'];
const MODOS: ShareModo[] = ['link', 'invitados'];

function baseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const shares = await listarShares(WS, 'branding');
    const conInvitados = await Promise.all(shares.map(async (s) => ({
      ...s, invitados: s.modo === 'invitados' ? await listarInvitados(s.id as number) : [],
    })));
    return NextResponse.json({ ok: true, shares: conInvitados });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const alcance = String(body.alcance || 'todo') as ShareAlcance;
    const modo = String(body.modo || 'link') as ShareModo;
    const recursoId: string | null = body.recursoId ? String(body.recursoId) : null;
    const emails: string[] = Array.isArray(body.emails) ? body.emails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean) : [];

    if (!ALCANCES.includes(alcance)) return NextResponse.json({ ok: false, error: 'alcance inválido' }, { status: 400 });
    if (!MODOS.includes(modo)) return NextResponse.json({ ok: false, error: 'modo inválido' }, { status: 400 });
    if (alcance !== 'todo' && !recursoId) return NextResponse.json({ ok: false, error: 'falta qué compartir' }, { status: 400 });
    if (modo === 'invitados' && !emails.length) return NextResponse.json({ ok: false, error: 'agregá al menos un email' }, { status: 400 });
    const malos = emails.filter((e) => !emailValido(e));
    if (malos.length) return NextResponse.json({ ok: false, error: `email inválido: ${malos[0]}` }, { status: 400 });

    const { id, token } = await crearShare({
      ws: WS, recurso: 'branding', alcance, recursoId, modo,
      etiqueta: body.etiqueta ? String(body.etiqueta).slice(0, 120) : null,
      expiraAt: body.expiraAt ? String(body.expiraAt) : null,
    });

    const base = baseUrl(req);
    // Modo link: un solo enlace para todos. Modo invitados: uno por persona.
    const enlace = modo === 'link' ? `${base}/compartido/${token}` : null;

    const invitados: Array<{ email: string; enviado: boolean; error?: string }> = [];
    if (modo === 'invitados') {
      const from = await getEmailFrom().catch(() => '');
      for (const email of emails) {
        try {
          const inv = await agregarInvitado(id, email);
          const url = `${base}/compartido/${inv.token}`;
          let enviado = false, err: string | undefined;
          if (from) {
            const r = await sendEmail({
              to: email, from,
              subject: 'Material de marca de MaKo',
              html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#171A21">
                <p>Te compartieron el material de marca de <b>MaKo</b>.</p>
                <p><a href="${url}" style="display:inline-block;padding:11px 20px;border-radius:9px;background:#2F6FED;color:#fff;text-decoration:none;font-weight:600">Ver el material</a></p>
                <p style="color:#7c869b;font-size:13px">Este enlace es personal: no lo reenvíes.</p>
              </div>`,
            }).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'error' }));
            enviado = !!(r as { ok?: boolean }).ok;
            if (!enviado) err = (r as { error?: string }).error || 'no se pudo enviar';
            if (enviado) await marcarEnviado(inv.id);
          } else {
            err = 'email no configurado';
          }
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
