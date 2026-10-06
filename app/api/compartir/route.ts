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
import { hashGravatar } from '@/lib/gravatar';
import { sendEmail, remitenteEsSandbox, resendConfigurado } from '@/lib/resend';
import { REMITENTE_MAKO, EMAIL_MAKO } from '@/lib/app-url';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import {
  crearShare, listarShares, revocarShare, agregarInvitado, listarInvitados,
  revocarInvitado, marcarEnviado, getShare, parseDestinatarios, regenerarTokenInvitado, regenerarTokenShare,
  leerTokenShare, leerTokenInvitado,
  type ShareAlcance, type ShareModo, type Destinatario,
} from '@/lib/shares';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WS = 1;
// 'conocimientos' es la TAB entera (alcance 'todo', sin recurso_id): el que lo
// recibe entra al portal completo y navega a cualquier curso.
const RECURSOS = ['curso', 'branding', 'conocimientos'];
const ALCANCES: ShareAlcance[] = ['todo', 'seccion', 'grupo', 'item'];
const MODOS: ShareModo[] = ['link', 'invitados'];

const base = (req: NextRequest) => process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

// Hash del email para pedirle el avatar a Gravatar desde el navegador (con
// d=404: si la persona no tiene foto, la UI cae a sus iniciales). Se calcula acá
// y no en el cliente porque en el browser crypto.subtle es async y no vale la
// pena; además así el email crudo nunca viaja en una URL a un tercero.
// El HASH pelado y no la URL: el componente que lo dibuja la arma con el tamaño que
// necesita. Vive en lib/gravatar.ts desde el 28/09/2026 — eran dos copias.
const gravatarDe = hashGravatar;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    // ── "Copiame el link otra vez", SIN rotarlo (mig 0131) ──────────────────
    // Va en GET y no en PATCH porque no cambia nada: lee el token cifrado y lo
    // descifra. `enlace: null` con 200 es la respuesta correcta para una fila
    // anterior a la migración —no hay qué copiar, pero la fila existe— y es lo
    // que hace que la UI ofrezca reemitir en vez de decir «error».
    const copiar = req.nextUrl.searchParams.get('copiar');
    const copiarInv = req.nextUrl.searchParams.get('copiarInvitado');
    if (copiar || copiarInv) {
      const token = copiarInv
        ? await leerTokenInvitado(WS, Number(copiarInv))
        : await leerTokenShare(WS, Number(copiar));
      return NextResponse.json({ ok: true, enlace: token ? `${base(req)}/compartido/${token}` : null });
    }

    const recurso = req.nextUrl.searchParams.get('recurso') || 'curso';
    const recursoId = req.nextUrl.searchParams.get('recursoId');
    if (!RECURSOS.includes(recurso)) return NextResponse.json({ ok: false, error: 'recurso inválido' }, { status: 400 });

    const todos = await listarShares(WS, recurso);
    const filtrados = recursoId ? todos.filter((s) => s.recurso_id === recursoId) : todos;
    const conInvitados = await Promise.all(filtrados.map(async (s) => ({
      ...s,
      invitados: s.modo === 'invitados'
        ? (await listarInvitados(s.id as number)).map((i) => ({ ...i, gravatar: gravatarDe(i.email) }))
        : [],
    })));
    // Preflight del correo: que la UI AVISE antes de invitar, en vez de dejar
    // que la persona escriba tres mails y recién ahí ver el error de Resend.
    // ⚠️ EL PREFLIGHT SE MIDE EN EL WORKSPACE QUE VA A FIRMAR, que es la PLATAFORMA y no
    // el cliente que el admin tenga abierto en la pestaña. Antes preguntaba por el actual
    // —`resendConfigurado()` y `remitenteEsSandbox()` resuelven el del contexto— así que
    // contestaba por otra cuenta: es la regla de la casa de que el preflight tiene que
    // mirar LO QUE SE VA A USAR.
    const correo = await runWithWorkspace(await wsSuperAdmin(), async () => {
      const [hayKey, sandbox] = await Promise.all([resendConfigurado(), remitenteEsSandbox()]);
      return { listo: hayKey && !sandbox, remitente: EMAIL_MAKO };
    });
    return NextResponse.json({ ok: true, shares: conInvitados, correo });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// PATCH → emite un token NUEVO y devuelve el link. Dos objetivos:
//   ?invitado=<id> → el link personal de esa persona
//   ?id=<id>       → el link público de un share de modo 'link'
//
// Es "copiame el link otra vez": el viejo NO se puede leer (en base solo hay su
// sha256), así que se rota. La UI avisa que el anterior deja de servir.
export async function PATCH(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const invitadoId = Number(req.nextUrl.searchParams.get('invitado') || 0);
    const shareId = Number(req.nextUrl.searchParams.get('id') || 0);
    if (!invitadoId && !shareId) return NextResponse.json({ ok: false, error: 'falta a quién' }, { status: 400 });
    const token = invitadoId
      ? await regenerarTokenInvitado(WS, invitadoId)
      : await regenerarTokenShare(WS, shareId);
    if (!token) return NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, enlace: `${base(req)}/compartido/${token}` });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// ── Invitar: crea el invitado, le manda SU link y devuelve qué pasó ──────────
// Clave: si el mail NO sale (dominio sin verificar en Resend, rebote, lo que
// sea) devolvemos el link personal igual. Antes se generaba, se perdía en el
// aire y el invitado quedaba en la lista sin forma de llegarle nunca.
type ResultadoInvitado = { email: string; nombre: string | null; enviado: boolean; error?: string; enlace?: string };

// Resend contesta en inglés y explicando SU producto ("verify a domain at
// resend.com/domains"). Adentro de la app eso no le dice a nadie qué hacer con
// la invitación que acaba de crear.
function errorLegible(crudo: string): string {
  if (/only send testing emails|Invalid `?to`? field|testing email address/i.test(crudo))
    return 'el correo todavía no está verificado — el mail solo sale a tu propia casilla';
  if (/RESEND_API_KEY no configurada|email no configurado/i.test(crudo))
    return 'el correo no está conectado';
  if (/restricted/i.test(crudo)) return 'la API key de Resend no tiene permiso para enviar';
  return crudo;
}

/**
 * ⚠️ ESTE MAIL LO FIRMA MaKo, Y CORRE EN EL WORKSPACE DE LA PLATAFORMA.
 *
 * Antes resolvía el remitente con `getEmailFrom()`, que lee el `resend_from` del workspace
 * EN CURSO — y acá el workspace en curso es el cliente que el super admin tiene abierto en
 * la pestaña. Medido contra producción el 06/10/2026: el ws11 tiene cargadas su
 * `RESEND_API_KEY` **y** su `RESEND_FROM`, así que un mail de la plataforma podía salir
 * firmado por ese negocio y por SU cuenta de Resend. Sale un mail válido las dos veces, que
 * es exactamente por qué nadie lo ve.
 *
 * Es la regla de `OWNER_WS` NO es la plataforma, y el molde ya estaba escrito en
 * `lib/invitaciones.ts`: `runWithWorkspace(await wsSuperAdmin(), …)` + `from` EXPLÍCITO.
 * Ese workspace no tiene credencial propia de Resend, así que la key cae en la del env, que
 * es la de MaKo — justamente lo que se quiere.
 */
async function invitar(shareId: number, dests: Destinatario[], raiz: string, etiqueta: string | null): Promise<ResultadoInvitado[]> {
  return runWithWorkspace(await wsSuperAdmin(), () => invitarComoMaKo(shareId, dests, raiz, etiqueta));
}

async function invitarComoMaKo(shareId: number, dests: Destinatario[], raiz: string, etiqueta: string | null): Promise<ResultadoInvitado[]> {
  const from = REMITENTE_MAKO;
  const out: ResultadoInvitado[] = [];
  for (const { email, nombre } of dests) {
    try {
      const inv = await agregarInvitado(shareId, email, nombre);
      const url = `${raiz}/compartido/${inv.token}`;
      let enviado = false, err: string | undefined;
      if (from) {
        const r = await sendEmail({
          to: email, from,
          subject: etiqueta ? `Te compartieron: ${etiqueta}` : 'Te compartieron material de MaKo',
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#171A21">
            <p>${nombre ? `Hola ${nombre}: t` : 'T'}e compartieron <b>${etiqueta || 'material de MaKo'}</b>.</p>
            <p><a href="${url}" style="display:inline-block;padding:11px 20px;border-radius:9px;background:#2F6FED;color:#fff;text-decoration:none;font-weight:600">Abrir</a></p>
            <p style="color:#7c869b;font-size:13px">Este enlace es personal: no lo reenvíes.</p>
          </div>`,
        }).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'error' }));
        enviado = !!(r as { ok?: boolean }).ok;
        if (!enviado) err = errorLegible((r as { error?: string }).error || 'no se pudo enviar');
        else await marcarEnviado(inv.id);
      } else err = 'el correo no está conectado';
      // El link solo se expone cuando hace falta pasarlo a mano: si el mail
      // salió, ya lo tiene la persona y no hay razón de mostrarlo acá.
      out.push({ email, nombre, enviado, error: err, ...(enviado ? {} : { enlace: url }) });
    } catch (e) {
      out.push({ email, nombre, enviado: false, error: e instanceof Error ? e.message : 'error' });
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const raiz = base(req);

    // Los destinatarios pueden venir crudos ("Martín <m@x.com>, otro@y.com") o
    // como array ya partido. Se parsean acá, en un solo lugar, para los dos
    // caminos: crear un share nuevo y sumar gente a uno que ya existe.
    const crudo = typeof body.destinatarios === 'string'
      ? body.destinatarios
      : (Array.isArray(body.emails) ? body.emails.join('\n') : '');
    const { ok: dests, malos } = parseDestinatarios(crudo);

    // ── Sumar personas a un enlace que ya existe ────────────────────────────
    if (body.shareId) {
      const share = await getShare(WS, Number(body.shareId));
      if (!share) return NextResponse.json({ ok: false, error: 'enlace inexistente' }, { status: 404 });
      if (share.modo !== 'invitados') return NextResponse.json({ ok: false, error: 'este enlace no es de invitados' }, { status: 400 });
      if (share.revocado_at) return NextResponse.json({ ok: false, error: 'enlace revocado' }, { status: 400 });
      if (malos.length) return NextResponse.json({ ok: false, error: `email inválido: ${malos[0]}` }, { status: 400 });
      if (!dests.length) return NextResponse.json({ ok: false, error: 'agrega al menos un email' }, { status: 400 });
      const invitados = await invitar(share.id, dests, raiz, share.etiqueta);
      return NextResponse.json({ ok: true, id: share.id, enlace: null, invitados });
    }

    const recurso = String(body.recurso || 'curso');
    const recursoId = body.recursoId ? String(body.recursoId) : null;
    const modo = String(body.modo || 'link') as ShareModo;
    // Compartir un curso es siempre "esta cosa entera" ('item' = ese slug); la
    // tab entera no apunta a nada ('todo'); el material de marca admite además
    // sección y grupo.
    const alcanceDefault: ShareAlcance =
      recurso === 'conocimientos' ? 'todo' : recurso === 'curso' ? 'item' : 'grupo';
    const alcance = (body.alcance ? String(body.alcance) : alcanceDefault) as ShareAlcance;

    if (!RECURSOS.includes(recurso)) return NextResponse.json({ ok: false, error: 'recurso inválido' }, { status: 400 });
    if (!ALCANCES.includes(alcance)) return NextResponse.json({ ok: false, error: 'alcance inválido' }, { status: 400 });
    if (!MODOS.includes(modo)) return NextResponse.json({ ok: false, error: 'modo inválido' }, { status: 400 });
    if (alcance !== 'todo' && !recursoId) return NextResponse.json({ ok: false, error: 'falta qué compartir' }, { status: 400 });
    if (modo === 'invitados' && malos.length) return NextResponse.json({ ok: false, error: `email inválido: ${malos[0]}` }, { status: 400 });
    if (modo === 'invitados' && !dests.length) return NextResponse.json({ ok: false, error: 'agrega al menos un email' }, { status: 400 });

    const etiqueta = body.etiqueta ? String(body.etiqueta).slice(0, 140) : null;
    const { id, token } = await crearShare({
      ws: WS, recurso, alcance, recursoId, modo, etiqueta,
      expiraAt: body.expiraAt ? String(body.expiraAt) : null,
    });

    const enlace = modo === 'link' ? `${raiz}/compartido/${token}` : null;
    const invitados = modo === 'invitados' ? await invitar(id, dests, raiz, etiqueta) : [];

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
    if (invitadoId) {
      const hecho = await revocarInvitado(WS, invitadoId);
      return hecho ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
    }
    if (!id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
    await revocarShare(WS, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
