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
//
// ── EL INFORME DEL DASHBOARD (11/10/2026) ──────────────────────────────────────
// Martín: «Agrega el botón de "Compartir" que funcione exactamente igual que lo que ya tenemos en
// "Compartir" en la vista de CONOCIMIENTOS de SuperAdmin, que se pueda crear un link de acceso a esos
// graficos y también invitar por email». `recurso='dashboard'` es la SEGUNDA puerta de esta ruta, y no
// es del super admin: es del admin de cada negocio que tiene la tab Dashboard, sobre SU informe.
//
//   · El workspace es el de la SESIÓN (el de la pestaña, el mismo que lee lib/graficos-tablero.ts) y el
//     `recurso_id` es el `sub` de la sesión. Lo que mande el cliente en `recursoId` NO se usa: un admin
//     que mandara el `sub` de un compañero compartiría el informe del compañero.
//   · Toda acción que recibe un id (copiar, rotar, sumar gente, revocar) pregunta `administraShare`
//     ANTES de tocar la fila (lib/shares.ts): las funciones de abajo filtran sólo por workspace, y en un
//     workspace conviven los informes de varias personas.
//   · El link abre en la hoja que estaba abierta al compartir (`hoja`, que manda el modal en cada pedido):
//     viaja como `?hoja=` en el link, no en la fila. Un link sin `?hoja=` abre la primera.
//   · El mail lo firma MaKo igual que el de Conocimientos (`invitar`, más abajo) y dice qué informe y de
//     qué negocio.
//   · Los recursos de la plataforma siguen como siempre: sólo el super admin, en el workspace de siempre.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { hashGravatar } from '@/lib/gravatar';
import { sendEmail, correoDeMakoListo } from '@/lib/resend';
import { REMITENTE_MAKO, EMAIL_MAKO } from '@/lib/app-url';
import { escapeHtml } from '@/lib/email-html';
import { getCapaActual, getRolWsEfectivo, getWorkspace, getWorkspaceActual, runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { leerTableroVersionado } from '@/lib/graficos-tablero';
import {
  crearShare, listarShares, revocarShare, agregarInvitado, listarInvitados,
  revocarInvitado, marcarEnviado, getShare, parseDestinatarios, regenerarTokenInvitado, regenerarTokenShare,
  leerTokenShare, leerTokenInvitado, shareDeInvitado, administraShare, puedeCompartirInforme,
  RECURSO_INFORME, RECURSOS_PLATAFORMA,
  type Administrador, type Share, type ShareAlcance, type ShareModo, type Destinatario,
} from '@/lib/shares';
import { nombreDeShare } from '@/lib/share-nombre';
import { buscarCurso } from '@/app/conocimientos/catalogo';
import { titulosElegidos } from '@/lib/conocimiento-ajustes-datos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WS = 1;
// 'conocimientos' es la TAB entera (alcance 'todo', sin recurso_id): el que lo
// recibe entra al portal completo y navega a cualquier curso.
const RECURSOS = RECURSOS_PLATAFORMA;
const ALCANCES: ShareAlcance[] = ['todo', 'seccion', 'grupo', 'item'];
const MODOS: ShareModo[] = ['link', 'invitados'];

const base = (req: NextRequest) => process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

// ── Quién administra, en este pedido ────────────────────────────────────────────────────────────

type AdminInforme = Extract<Administrador, { tipo: 'informe' }>;
type Admins = { plataforma: Administrador | null; informe: AdminInforme | null };

/**
 * Las DOS puertas, resueltas una vez por pedido. Vacías las dos = 403, como antes.
 * Todas las lecturas están cacheadas por request (lib/auth.ts, lib/workspace.ts): no son consultas de más.
 */
async function administradores(): Promise<Admins> {
  const [admin, sesion, rolWs, capa, ws] = await Promise.all([
    getSesionAdmin(), getUsuarioActual(), getRolWsEfectivo(), getCapaActual(), getWorkspaceActual(),
  ]);
  const quien = { rolWs, tabDashboard: tabEnCapa('graphics', capa), ws, sub: sesion?.sub };
  return {
    plataforma: admin ? { tipo: 'plataforma', ws: WS } : null,
    informe: puedeCompartirInforme(quien) ? { tipo: 'informe', ws: ws as number, sub: String(sesion!.sub) } : null,
  };
}

const nadie = (a: Admins) => !a.plataforma && !a.informe;
const SOLO_ADMIN = () => NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
const NO_ENCONTRADO = () => NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });

/**
 * La fila `id` si alguna de las dos puertas la administra, con la puerta que la abrió. `getShare` filtra
 * por el workspace del administrador y `administraShare` por lo demás (recurso y persona). null = no es de
 * quien pregunta, que para él es lo mismo que no exista.
 */
async function shareAdministrable(a: Admins, id: number): Promise<{ adm: Administrador; share: Share } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  for (const adm of [a.informe, a.plataforma]) {
    if (!adm) continue;
    const share = await getShare(adm.ws, id);
    if (share && administraShare(adm, share)) return { adm, share };
  }
  return null;
}

/** Lo mismo para un INVITADO: se pregunta por el share al que pertenece. */
async function invitadoAdministrable(a: Admins, invitadoId: number): Promise<{ adm: Administrador; share: Share } | null> {
  const sid = await shareDeInvitado(invitadoId);
  return sid ? shareAdministrable(a, sid) : null;
}

// ── El informe: su nombre, su negocio y la hoja en que abre el link ──────────────────────────────

/** El id de una hoja como lo acuña el catálogo (`idValido` de lib/graficos-catalogo.ts), o null. */
const hojaValida = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null);

/** Lo que se le pega al link de un share del informe: la hoja en que abre. Nada para los demás. */
const sufijoDe = (share: Pick<Share, 'recurso'>, hoja: unknown): string => {
  const h = share.recurso === RECURSO_INFORME ? hojaValida(hoja) : null;
  return h ? `?hoja=${encodeURIComponent(h)}` : '';
};

/** El nombre de HOY del informe de esa persona. Es un rótulo: si la lectura falla, null y decide el que llama. */
async function nombreDelInforme(adm: AdminInforme): Promise<string | null> {
  try {
    const t = await runWithWorkspace(adm.ws, () => leerTableroVersionado(adm.sub));
    return t.tablero.nombre?.trim() || null;
  } catch {
    return null;
  }
}

/** Lo que dice el mail: QUÉ informe y de QUÉ negocio, corto. Sin el negocio (la lectura falló), sólo el informe. */
async function fraseDelInforme(adm: AdminInforme, nombre: string): Promise<string> {
  const negocio = (await getWorkspace(adm.ws).catch(() => null))?.nombre?.trim();
  return negocio ? `el informe «${nombre}» de ${negocio}` : `el informe «${nombre}»`;
}

/**
 * El título de HOY de un curso, saltando los slugs reemplazados: el que le puso el super admin
 * (lib/conocimiento-ajustes.ts, mig 0221) o el del catálogo. Es el resolvedor que `nombreDeShare` pide
 * por parámetro, y el único lugar donde este archivo lo arma.
 *
 * ⚠️ Es ASYNC porque el título elegido vive en la base, y se lee UNA vez por pedido: sin esto el modal
 *    de «quién tiene acceso» y el mail nombraban el curso con el título de la ficha, distinto del que
 *    se ve en el portal. Si la lectura falla, el del catálogo: es un rótulo, no decide nada.
 */
async function resolvedorDeTitulos(): Promise<(slug: string) => string | undefined> {
  const elegidos = await titulosElegidos();
  return (slug: string) => {
    const c = buscarCurso(slug);
    return c ? elegidos.get(c.slug) ?? c.titulo : undefined;
  };
}

/**
 * El slug CANÓNICO de un curso: el que le quedó después de los reemplazos del catálogo.
 *
 * ⚠️ Sin esto, un share emitido con el slug viejo de un curso reemplazado NO LO LISTA
 * NINGÚN MODAL, porque ninguna pantalla puede pasar ese id —ya no está en la grilla— y el
 * filtro de abajo comparaba el string crudo. Medido en producción el 06/10/2026: el share
 * id=4 (`recurso_id: 'avatarhype'`, modo invitados, 13 visitas) estaba VIVO, con su link
 * funcionando, y no aparecía en ninguna lista de «quién tiene acceso»: no se podía ver ni
 * revocar desde la app. `avatarhype` se reemplazó por `creativos-ugc-realistas`
 * (REEMPLAZADOS en app/conocimientos/catalogo.ts).
 *
 * Se resuelve por los DOS lados —la fila y lo que pide la pantalla— porque el reemplazo
 * puede ir en cualquier dirección según cuál de los dos slugs tenga guardado cada uno.
 */
const canonico = (recurso: string, id: string | null) =>
  (recurso === 'curso' && id ? buscarCurso(id)?.slug ?? id : id);

// Hash del email para pedirle el avatar a Gravatar desde el navegador (con
// d=404: si la persona no tiene foto, la UI cae a sus iniciales). Se calcula acá
// y no en el cliente porque en el browser crypto.subtle es async y no vale la
// pena; además así el email crudo nunca viaja en una URL a un tercero.
// El HASH pelado y no la URL: el componente que lo dibuja la arma con el tamaño que
// necesita. Vive en lib/gravatar.ts desde el 28/09/2026 — eran dos copias.
const gravatarDe = hashGravatar;

/** Los invitados de una fila, con su avatar: lo que dibuja «quién tiene acceso». */
const invitadosDe = async (s: { id: unknown; modo: unknown }) => (s.modo === 'invitados'
  ? (await listarInvitados(s.id as number)).map((i) => ({ ...i, gravatar: gravatarDe(i.email) }))
  : []);

export async function GET(req: NextRequest) {
  const admins = await administradores();
  if (nadie(admins)) return SOLO_ADMIN();
  try {
    // ── "Copiame el link otra vez", SIN rotarlo (mig 0131) ──────────────────
    // Va en GET y no en PATCH porque no cambia nada: lee el token cifrado y lo
    // descifra. `enlace: null` con 200 es la respuesta correcta para una fila
    // anterior a la migración —no hay qué copiar, pero la fila existe— y es lo
    // que hace que la UI ofrezca reemitir en vez de decir «error».
    const copiar = req.nextUrl.searchParams.get('copiar');
    const copiarInv = req.nextUrl.searchParams.get('copiarInvitado');
    if (copiar || copiarInv) {
      // Primero DE QUIÉN es la fila: las dos lecturas de abajo filtran sólo por workspace.
      const hallado = copiarInv
        ? await invitadoAdministrable(admins, Number(copiarInv))
        : await shareAdministrable(admins, Number(copiar));
      if (!hallado) return NO_ENCONTRADO();
      const token = copiarInv
        ? await leerTokenInvitado(hallado.adm.ws, Number(copiarInv))
        : await leerTokenShare(hallado.adm.ws, Number(copiar));
      const sufijo = sufijoDe(hallado.share, req.nextUrl.searchParams.get('hoja'));
      return NextResponse.json({ ok: true, enlace: token ? `${base(req)}/compartido/${token}${sufijo}` : null });
    }

    const recurso = req.nextUrl.searchParams.get('recurso') || 'curso';
    const recursoId = req.nextUrl.searchParams.get('recursoId');

    if (recurso === RECURSO_INFORME) {
      // ── El informe: SÓLO las filas de esta persona en este workspace ─────────
      // `recursoId` del pedido no se mira: lo que se lista es el informe de la SESIÓN.
      const adm = admins.informe;
      if (!adm) return SOLO_ADMIN();
      const filas = (await listarShares(adm.ws, RECURSO_INFORME, adm.sub))
        .filter((s) => administraShare(adm, s as unknown as Share));
      const informe = await nombreDelInforme(adm);
      const sinCursos = () => undefined;
      return responderLista(await Promise.all(filas.map(async (s) => ({
        ...s,
        titulo: nombreDeShare(s as unknown as Share, sinCursos, informe),
        invitados: await invitadosDe(s),
      }))));
    }

    if (!admins.plataforma) return SOLO_ADMIN();
    if (!RECURSOS.includes(recurso)) return NextResponse.json({ ok: false, error: 'recurso inválido' }, { status: 400 });

    const todos = await listarShares(WS, recurso);
    const tituloDeCurso = await resolvedorDeTitulos();
    const pedido = canonico(recurso, recursoId);
    const filtrados = recursoId ? todos.filter((s) => canonico(recurso, s.recurso_id) === pedido) : todos;
    const conInvitados = await Promise.all(filtrados.map(async (s) => ({
      ...s,
      // QUÉ comparte esta fila, con el nombre de hoy. Va del lado del server a propósito:
      // resolverlo en el navegador obligaría a mandarle el catálogo de cursos (~5 MB) a
      // quien abra el modal, y además el mail de más abajo necesita el MISMO nombre —
      // con dos resolvedores, el modal y el mail dicen cosas distintas de la misma fila.
      titulo: nombreDeShare(s, tituloDeCurso),
      invitados: await invitadosDe(s),
    })));
    return responderLista(conInvitados);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

/** La lista de «quién tiene acceso» con el estado del correo. La usan las dos puertas. */
async function responderLista(conInvitados: Array<Record<string, unknown>>) {
  // Preflight del correo: que la UI AVISE antes de invitar, en vez de dejar
  // que la persona escriba tres mails y recién ahí ver el error de Resend.
  // ⚠️ EL PREFLIGHT MIDE LO QUE SE VA A USAR: el mail lo firma MaKo (`from: REMITENTE_MAKO`), que sale por
  // la key de la PLATAFORMA (lib/resend.ts). Preguntar `remitenteEsSandbox()` mide el remitente de un NEGOCIO
  // —el de la plataforma no tiene— y le decía al admin que el mail no llegaba mientras sí salía (undécima
  // tanda). `correoDeMakoListo` mira la key de la plataforma y `EMAIL_MAKO`. (Vale igual para el informe.)
  const correo = { listo: await correoDeMakoListo(), remitente: EMAIL_MAKO };
  return NextResponse.json({ ok: true, shares: conInvitados, correo });
}

// PATCH → emite un token NUEVO y devuelve el link. Dos objetivos:
//   ?invitado=<id> → el link personal de esa persona
//   ?id=<id>       → el link público de un share de modo 'link'
//
// Es "copiame el link otra vez": el viejo NO se puede leer (en base solo hay su
// sha256), así que se rota. La UI avisa que el anterior deja de servir.
export async function PATCH(req: NextRequest) {
  const admins = await administradores();
  if (nadie(admins)) return SOLO_ADMIN();
  try {
    const invitadoId = Number(req.nextUrl.searchParams.get('invitado') || 0);
    const shareId = Number(req.nextUrl.searchParams.get('id') || 0);
    if (!invitadoId && !shareId) return NextResponse.json({ ok: false, error: 'falta a quién' }, { status: 400 });
    const hallado = invitadoId ? await invitadoAdministrable(admins, invitadoId) : await shareAdministrable(admins, shareId);
    if (!hallado) return NO_ENCONTRADO();
    const token = invitadoId
      ? await regenerarTokenInvitado(hallado.adm.ws, invitadoId)
      : await regenerarTokenShare(hallado.adm.ws, shareId);
    if (!token) return NO_ENCONTRADO();
    return NextResponse.json({ ok: true, enlace: `${base(req)}/compartido/${token}${sufijoDe(hallado.share, req.nextUrl.searchParams.get('hoja'))}` });
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
 *
 * `sufijo` es lo que se le pega al link personal (`?hoja=` del informe del Dashboard).
 */
async function invitar(shareId: number, dests: Destinatario[], raiz: string, etiqueta: string | null, sufijo = ''): Promise<ResultadoInvitado[]> {
  return runWithWorkspace(await wsSuperAdmin(), () => invitarComoMaKo(shareId, dests, raiz, etiqueta, sufijo));
}

async function invitarComoMaKo(shareId: number, dests: Destinatario[], raiz: string, etiqueta: string | null, sufijo: string): Promise<ResultadoInvitado[]> {
  const from = REMITENTE_MAKO;
  const out: ResultadoInvitado[] = [];
  // ⚠️ El nombre de un informe, de un negocio o de la persona lo escribió ALGUIEN: al HTML va escapado.
  // El asunto es texto plano y no lo necesita.
  const que = escapeHtml(etiqueta || 'material de MaKo');
  for (const { email, nombre } of dests) {
    try {
      const inv = await agregarInvitado(shareId, email, nombre);
      const url = `${raiz}/compartido/${inv.token}${sufijo}`;
      let enviado = false, err: string | undefined;
      if (from) {
        const r = await sendEmail({
          to: email, from,
          subject: etiqueta ? `Te compartieron: ${etiqueta}` : 'Te compartieron material de MaKo',
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#171A21">
            <p>${nombre ? `Hola ${escapeHtml(nombre)}: t` : 'T'}e compartieron <b>${que}</b>.</p>
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
  const admins = await administradores();
  if (nadie(admins)) return SOLO_ADMIN();
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
      // De QUIÉN es la fila, antes que nada: `getShare` filtra sólo por workspace.
      const hallado = await shareAdministrable(admins, Number(body.shareId));
      if (!hallado) return NextResponse.json({ ok: false, error: 'enlace inexistente' }, { status: 404 });
      const share = hallado.share;
      if (share.modo !== 'invitados') return NextResponse.json({ ok: false, error: 'este enlace no es de invitados' }, { status: 400 });
      if (share.revocado_at) return NextResponse.json({ ok: false, error: 'enlace revocado' }, { status: 400 });
      if (malos.length) return NextResponse.json({ ok: false, error: `email inválido: ${malos[0]}` }, { status: 400 });
      if (!dests.length) return NextResponse.json({ ok: false, error: 'agrega al menos un email' }, { status: 400 });
      if (hallado.adm.tipo === 'plataforma') {
        const tituloDeCurso = await resolvedorDeTitulos();
        // ⚠️ EL NOMBRE DERIVADO, NO `share.etiqueta`. La etiqueta guardada es la foto del
        // día en que se emitió el link, y acá sale POR MAIL a un tercero: sumar a alguien al
        // share id=4 mandaba «Te compartieron: Curso AVATARHYPE», un curso que hoy se llama
        // AvatarHype. Es el mismo nombre que ve el modal, por la misma función.
        const invitados = await invitar(share.id, dests, raiz, nombreDeShare(share, tituloDeCurso));
        return NextResponse.json({ ok: true, id: share.id, enlace: null, invitados });
      }
      // El informe: el mismo nombre de HOY que ve el modal, con su negocio, y el link en la hoja abierta.
      const nombre = nombreDeShare(share, () => undefined, await nombreDelInforme(hallado.adm));
      const enviados = await invitar(share.id, dests, raiz, await fraseDelInforme(hallado.adm, nombre), sufijoDe(share, body.hoja));
      return NextResponse.json({ ok: true, id: share.id, enlace: null, invitados: enviados });
    }

    const recurso = String(body.recurso || 'curso');
    const modo = String(body.modo || 'link') as ShareModo;

    // ── Compartir el informe del Dashboard ──────────────────────────────────
    // El workspace y la persona salen de la SESIÓN; `recursoId` y `alcance` del body no se leen.
    if (recurso === RECURSO_INFORME) {
      const adm = admins.informe;
      if (!adm) return SOLO_ADMIN();
      if (!MODOS.includes(modo)) return NextResponse.json({ ok: false, error: 'modo inválido' }, { status: 400 });
      if (modo === 'invitados' && malos.length) return NextResponse.json({ ok: false, error: `email inválido: ${malos[0]}` }, { status: 400 });
      if (modo === 'invitados' && !dests.length) return NextResponse.json({ ok: false, error: 'agrega al menos un email' }, { status: 400 });
      // La etiqueta es el nombre del informe del día que se emite (de respaldo: `nombreDeShare` usa el de hoy).
      const nombre = (await nombreDelInforme(adm)) ?? (body.etiqueta ? String(body.etiqueta).slice(0, 140) : null);
      const { id, token } = await crearShare({
        ws: adm.ws, recurso: RECURSO_INFORME, alcance: 'item', recursoId: adm.sub, modo,
        etiqueta: nombre, expiraAt: body.expiraAt ? String(body.expiraAt) : null, creadoPor: adm.sub,
      });
      const sufijo = sufijoDe({ recurso: RECURSO_INFORME }, body.hoja);
      const enlace = modo === 'link' ? `${raiz}/compartido/${token}${sufijo}` : null;
      const titulo = nombreDeShare({ recurso: RECURSO_INFORME, recurso_id: adm.sub, etiqueta: nombre }, () => undefined);
      const enviados = modo === 'invitados' ? await invitar(id, dests, raiz, await fraseDelInforme(adm, titulo), sufijo) : [];
      return NextResponse.json({ ok: true, id, enlace, invitados: enviados });
    }

    if (!admins.plataforma) return SOLO_ADMIN();
    const recursoId = body.recursoId ? String(body.recursoId) : null;
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
  const admins = await administradores();
  if (nadie(admins)) return SOLO_ADMIN();
  try {
    const id = Number(req.nextUrl.searchParams.get('id') || 0);
    const invitadoId = Number(req.nextUrl.searchParams.get('invitado') || 0);
    if (invitadoId) {
      const hallado = await invitadoAdministrable(admins, invitadoId);
      if (!hallado) return NO_ENCONTRADO();
      const hecho = await revocarInvitado(hallado.adm.ws, invitadoId);
      return hecho ? NextResponse.json({ ok: true }) : NO_ENCONTRADO();
    }
    if (!id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
    const hallado = await shareAdministrable(admins, id);
    if (!hallado) return NO_ENCONTRADO();
    await revocarShare(hallado.adm.ws, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
