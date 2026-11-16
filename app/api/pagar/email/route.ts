// =============================================================================
// POST /api/pagar/email — el comprador cambia el email con el que va a entrar a MaKo
// =============================================================================
// Decisión de Martín (11/10/2026): al pagar un plan de MaKo la cuenta se crea SOLA con el email del
// pago, y en la página de retorno (/pagar/<token>/listo) «se le ofrece cambiar la cuenta de Google
// con la que va a entrar». Recibe `{ token, email }`, cambia `usuarios.email` del admin del alta y le
// reenvía el mail de acceso a la dirección nueva.
//
// LAS CUATRO CONDICIONES (pagado o la prueba autorizada, alta hecha, nunca entró, menos de 3 cambios) viven en
// `motivoParaNoCambiar` (app/pagar/cambio-email.ts), pura y con test: acá sólo se leen los datos.
//
// REENVIAR EL CORREO (16/11/2026, la página de gracias rediseñada: «Revisa tu correo», con «Reenviar el correo»): con
// `{ token, reenviar: true }` le vuelve a mandar el acceso al email que YA tiene la cuenta. Las mismas condiciones salvo el tope de
// 3 cambios (`motivoParaNoReenviar`), con su propio tope por link (3 por hora): no cambia nada de la cuenta, y el correo va a quien
// ya es el dueño del email, así que el link no sirve para mandarle nada a otro.
//
// ⚠️ PÚBLICA y de ESCRITURA (PUBLICOS y PUBLICOS_ESCRITURA en lib/rutas-publicas.ts, exacta):
//   · La credencial es el token del cobro, en el CUERPO. NO LEE NINGUNA COOKIE: si leyera la sesión,
//     el early-return del proxy (que saltea el chequeo de Origin) la volvería un CSRF.
//   · Un token que no existe y un cobro que no habilita el cambio contestan LO MISMO.
//   · El contador `alta_email_cambios` se RECLAMA antes de tocar el usuario (compare-and-set sobre el
//     valor leído): dos pedidos simultáneos no pasan los dos el tope de 3.
//
// ⚠️ ESCRIBE `cobros` FUERA DE lib/cobros.ts (sólo `alta_email_cambios` y `alta_motivo`): el contador
// es de esta ruta y de nadie más. Si se mueve, va a lib/cobros.ts como una función propia.

import { after, NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspace, runWithWorkspace } from '@/lib/workspace';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import { avisarCambioDeEmailDeAcceso, invitarPorEmail } from '@/lib/invitaciones';
import { PREFIJO_MAIL_NO_SALIO } from '@/lib/cobros-reglas';
import { logLeadEvent } from '@/lib/leads';
import { getCobroPorToken } from '@/lib/cobros';
import { emailEnmascarado } from '@/lib/cobros-reglas';
import { esTokenCobro, type Cobro } from '@/lib/cobros-tipos';
import { EMAIL_MAKO } from '@/lib/app-url';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import {
  RESPUESTA_GENERICA, RESPUESTA_GENERICA_REENVIO, bandejaDeEntrada, cambiosRestantes, emailNuevoValido, esAltaHecha, motivoParaNoCambiar, motivoParaNoReenviar,
} from '@/app/pagar/cambio-email';
import { usuarioDelAlta } from '@/app/pagar/acceso';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIN_CACHE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
/** Un `{ "token": "…", "email": "…" }` no pesa más que esto. Lo de más no se lee. */
const TOPE_CUERPO = 2_000;

const no = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: SIN_CACHE });
const noPude = () => no(503, `No pudimos cambiar el email. Prueba de nuevo en unos minutos o escríbenos a ${EMAIL_MAKO}.`);

const EMAIL_NO_DISPONIBLE = `No pudimos usar ese email. Prueba con otro, o escríbenos a ${EMAIL_MAKO}.`;

export async function POST(req: NextRequest) {
  // Topes: por IP (quien prueba tokens) y, más abajo, por token (quien prueba emails con uno bueno).
  if (!rateLimit(`pagar-email:ip:${clientIp(req)}`, 10, 10 * 60_000)) {
    return no(429, 'Demasiados intentos. Prueba de nuevo en unos minutos.');
  }

  let cuerpo: { token?: unknown; email?: unknown; reenviar?: unknown } = {};
  try {
    const crudo = await req.text();
    if (crudo.length <= TOPE_CUERPO) cuerpo = (JSON.parse(crudo) as typeof cuerpo | null) ?? {};
  } catch { /* un cuerpo que no es JSON es un pedido sin token: contesta lo genérico */ }

  const token = cuerpo.token;
  const reenviar = cuerpo.reenviar === true;
  const generica = reenviar ? RESPUESTA_GENERICA_REENVIO : RESPUESTA_GENERICA;
  if (!esTokenCobro(token)) return no(generica.status, generica.error);
  if (!rateLimit(`pagar-email:token:${token}`, 6, 60 * 60_000)) {
    return no(429, 'Demasiados intentos con este link. Prueba de nuevo en una hora.');
  }

  let c: Cobro | null;
  let u: Awaited<ReturnType<typeof usuarioDelAlta>> = null;
  try {
    c = await getCobroPorToken(token);
    // El usuario sólo se lee si el cobro es de un alta hecha (las condiciones 1 y 2 no lo necesitan).
    if (c && esAltaHecha(c)) u = await usuarioDelAlta(c);
  } catch (e) {
    console.error('[pagar-email] no pude leer el cobro o su cuenta:', e instanceof Error ? e.message : e);
    return noPude();
  }

  // REENVIAR: al email que ya tiene la cuenta, sin tocar la cuenta. Su tope, aparte del de los cambios.
  if (reenviar) {
    const porQue = motivoParaNoReenviar(c, u);
    if (porQue) return no(porQue.status, porQue.error);
    if (!rateLimit(`pagar-email:reenvio:${token}`, 3, 60 * 60_000)) {
      return no(429, `Ya te lo mandamos varias veces. Revisa la carpeta de spam, o escríbenos a ${EMAIL_MAKO}.`);
    }
    const ws = await getWorkspace(c!.alta_ws!).catch(() => null);
    const inv = await invitarPorEmail({ email: u!.email, workspace: ws?.nombre, rolWs: 'admin' });
    const { error: eR } = await getSupabaseServer().from('cobros')
      .update({ alta_motivo: inv.enviado ? null : `${PREFIJO_MAIL_NO_SALIO}: ${inv.error ?? 'sin detalle'}`.slice(0, 300) })
      .eq('id', c!.id);
    if (eR) console.error(`[pagar-email] no pude anotar el reenvío en el cobro ${c!.id}: ${eR.message}`);
    const enm = emailEnmascarado(u!.email);
    return NextResponse.json({
      ok: true, email: enm, enviado: inv.enviado, abrir: bandejaDeEntrada(u!.email),
      mensaje: inv.enviado ? `Te lo mandamos de nuevo a ${enm}. Si no lo ves, revisa la carpeta de spam.` : `No pudimos mandarlo. Prueba en unos minutos, o escríbenos a ${EMAIL_MAKO}.`,
    }, { headers: SIN_CACHE });
  }

  // Las cuatro condiciones: pagado (o la prueba autorizada), alta hecha, el usuario nunca entró, menos de 3 cambios.
  const motivo = motivoParaNoCambiar(c, u);
  if (motivo) return no(motivo.status, motivo.error);
  const cobro = c!;
  const usuario = u!;

  const nuevo = emailNuevoValido(cuerpo.email, usuario.email);
  if (!nuevo.ok) return no(nuevo.status, nuevo.error);

  const db = getSupabaseServer();
  const antes = cobro.alta_email_cambios;

  // 1. El RECLAMO del cambio: compare-and-set sobre el contador leído, y sobre el estado que lo
  //    habilita (pagado, o la prueba autorizada: pendiente con la suscripción activa). Si otro pedido ganó mientras tanto, o la
  //    prueba se canceló en el medio, éste no hace nada.
  const reclamar = db.from('cobros')
    .update({ alta_email_cambios: antes + 1, updated_at: new Date().toISOString() })
    .eq('id', cobro.id).eq('alta_email_cambios', antes).eq('alta_estado', 'hecha');
  const { data: reclamo, error: e1 } = await (cobro.estado === 'pagado'
    ? reclamar.eq('estado', 'pagado')
    : reclamar.eq('estado', 'pendiente').eq('suscripcion_estado', 'activa'))
    .select('id').maybeSingle();
  if (e1) {
    console.error(`[pagar-email] no pude reclamar el cambio del cobro ${cobro.id}: ${e1.message}`);
    return noPude();
  }
  if (!reclamo) return no(409, 'Algo cambió mientras tanto. Recarga la página y prueba de nuevo.');

  // `usuarios.email` es único: si ya es de otra persona, no se puede. ⚠️ Se pregunta DESPUÉS del reclamo y el
  // intento NO se devuelve (revisión del 11/10/2026): antes, el «ese email ya tiene cuenta» salía sin gastar
  // ninguno de los 3 cambios, y un token servía para preguntar sin límite qué emails son usuarios de MaKo (los
  // topes por IP y por token viven en memoria, por instancia). Ahora son, como mucho, tres preguntas por link.
  try {
    const otro = await buscarUsuarioPorEmail(nuevo.email);
    if (otro && otro.id !== usuario.id) return no(409, EMAIL_NO_DISPONIBLE);
  } catch (e) {
    console.error('[pagar-email] no pude buscar el email nuevo:', e instanceof Error ? e.message : e);
    const { error: e0 } = await db.from('cobros').update({ alta_email_cambios: antes }).eq('id', cobro.id).eq('alta_email_cambios', antes + 1);
    if (e0) console.error(`[pagar-email] no pude devolver el reclamo del cobro ${cobro.id}: ${e0.message}`);
    return noPude();
  }

  // 2. El email, también condicionado: sigue siendo el que se leyó y la persona sigue sin haber entrado.
  const { data: cambiado, error: e2 } = await db.from('usuarios')
    .update({ email: nuevo.email, invitacion_enviada_at: null, updated_at: new Date().toISOString() })
    .eq('id', usuario.id).eq('email', usuario.email).is('ultimo_login', null)
    .select('id').maybeSingle();
  if (e2 || !cambiado) {
    // Un email que se volvió de otro en el medio gasta el intento, igual que arriba.
    if (e2?.code === '23505') return no(409, EMAIL_NO_DISPONIBLE);
    // El cambio no se hizo por otra cosa: se devuelve el reclamo (si falla, se pierde uno de los 3, que es lo menos malo).
    const { error: e3 } = await db.from('cobros').update({ alta_email_cambios: antes }).eq('id', cobro.id).eq('alta_email_cambios', antes + 1);
    if (e3) console.error(`[pagar-email] no pude devolver el reclamo del cobro ${cobro.id}: ${e3.message}`);
    if (e2) {
      console.error(`[pagar-email] no pude cambiar el email del usuario ${usuario.id}: ${e2.message}`);
      return noPude();
    }
    return no(409, 'Algo cambió mientras tanto. Recarga la página y prueba de nuevo.');
  }

  // 3. El mail de acceso a la dirección nueva. Nunca tira; si no salió, el cambio igual quedó hecho
  //    (la fila YA lo autoriza a entrar) y se dice.
  const ws = await getWorkspace(cobro.alta_ws!).catch(() => null);
  const invitacion = await invitarPorEmail({ email: nuevo.email, workspace: ws?.nombre, rolWs: 'admin' });
  const { error: e4 } = await db.from('cobros')
    .update({ alta_motivo: invitacion.enviado ? null : `${PREFIJO_MAIL_NO_SALIO}: ${invitacion.error ?? 'sin detalle'}`.slice(0, 300) })
    .eq('id', cobro.id);
  if (e4) console.error(`[pagar-email] no pude anotar el envío en el cobro ${cobro.id}: ${e4.message}`);

  // 3b. ⚠️ EL AVISO AL EMAIL ANTERIOR (15/10/2026), después de contestar: quien tenga el link de la compra puede cambiar
  //     el acceso, y el dueño de la dirección anterior se entera y puede pedir que se revierta (lib/invitaciones.ts).
  const avisarAnterior = () => avisarCambioDeEmailDeAcceso({ anterior: usuario.email, nuevoEnmascarado: emailEnmascarado(nuevo.email) ?? 'otra dirección' })
    .then((r) => { if (!r.enviado) console.error(`[pagar-email] no salió el aviso al email anterior del cobro ${cobro.id}: ${r.error ?? 'sin detalle'}`); })
    .catch((e: unknown) => console.error(`[pagar-email] el aviso al email anterior del cobro ${cobro.id} falló:`, e instanceof Error ? e.message : e));
  try { after(avisarAnterior); } catch { void avisarAnterior(); }

  // 4. El rastro en el CRM de quien vendió (el lead del comprador), después de contestar.
  if (cobro.lead_id) {
    const leadId = cobro.lead_id;
    const texto = `El comprador cambió el email de acceso: ${usuario.email} → ${nuevo.email}${invitacion.enviado ? '' : ' (el mail no salió)'}`;
    const anotar = () => runWithWorkspace(cobro.workspace_id, () => logLeadEvent(leadId, 'Cuenta de MaKo', texto, 'Comprador'))
      .catch((e: unknown) => console.error(`[pagar-email] no pude anotar el cambio en el lead ${leadId}:`, e instanceof Error ? e.message : e));
    try { after(anotar); } catch { void anotar(); }
  }

  const enmascarado = emailEnmascarado(nuevo.email);
  return NextResponse.json({
    ok: true,
    email: enmascarado,
    enviado: invitacion.enviado,
    abrir: bandejaDeEntrada(nuevo.email),
    restantes: cambiosRestantes({ alta_email_cambios: antes + 1 }),
    mensaje: invitacion.enviado
      ? `Listo: te mandamos el acceso a ${enmascarado}.`
      : `Listo: tu acceso ahora es ${enmascarado}, pero el mail no salió. Entra con Google con ese email, o escríbenos a ${EMAIL_MAKO}.`,
  }, { headers: SIN_CACHE });
}
