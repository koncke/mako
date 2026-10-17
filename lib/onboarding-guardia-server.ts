// =============================================================================
// onboarding-guardia-server — la guardia del onboarding, contra la base (las reglas: lib/onboarding-guardia.ts)
// =============================================================================
// La llaman las dos rutas del onboarding que la gente puede martillar: /api/offer (la conversación de lo que vende,
// que paga IA) y /api/onboarding/arranque (las respuestas del chat). Mientras el onboarding está pendiente ninguna otra
// tab se abre, así que todo pedido a /api/offer en ese momento ES el onboarding.
// =============================================================================

import 'server-only';
import { getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin, OWNER_WS, getWorkspace } from './workspace';
import { clientIp, rateLimit } from './rate-limit';
import { sendEmail } from './resend';
import { EMAIL_MAKO, REMITENTE_MAKO, linkApp } from './app-url';
import {
  CLAVE_GUARDIA, MENSAJE_BLOQUEADO, MENSAJE_FALTA, MENSAJE_RAPIDO, TOPES, conFalta, contar, decidir, desbloquear, falta, parseGuardia,
  type EstadoGuardia, type TipoPedido,
} from './onboarding-guardia';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lo guardado, leído ESTRICTO: con la base caída no se decide sobre `{}` (dejaría pasar a un bloqueado). */
export async function leerGuardia(): Promise<EstadoGuardia> {
  return parseGuardia(await getSettingEstricto(CLAVE_GUARDIA));
}

async function guardar(e: EstadoGuardia): Promise<void> {
  await setSetting(CLAVE_GUARDIA, JSON.stringify(e));
}

export type Freno = { status: number; error: string; bloqueado?: true };

/**
 * Antes de un pedido de IA del onboarding: la ráfaga (por usuario y por IP), el bloqueo, el tope del onboarding y el
 * troleo del texto. `null` = pasa (y ya quedó contado); si no, el freno con su status y el texto que lee la persona.
 * Una falta NO llega a la IA: no se paga.
 */
export async function frenoDeIa(p: { req: Request; ws: number; usuario: string | null; tipo: TipoPedido; texto?: string }): Promise<Freno | null> {
  const ip = clientIp(p.req);
  if (!rateLimit(`onb-ia:u:${p.ws}:${p.usuario ?? '-'}`, TOPES.iaPorMinutoUsuario, 60_000)
    || !rateLimit(`onb-ia:ip:${ip}`, TOPES.iaPorMinutoIp, 60_000)) {
    return { status: 429, error: MENSAJE_RAPIDO };
  }
  let e: EstadoGuardia;
  try { e = await leerGuardia(); } catch (err) {
    console.error(`[onboarding:guardia] ws=${p.ws} no pude leer la guardia: ${msg(err)}`);
    return { status: 503, error: 'No pude guardar tu mensaje (falló la base de MaKo, no es nada tuyo). Prueba de nuevo en un momento.' };
  }
  const d = decidir(e, p.tipo);
  if (!d.ok) return { status: d.razon === 'bloqueado' ? 423 : 429, error: d.mensaje, ...(d.razon === 'bloqueado' ? { bloqueado: true as const } : {}) };
  const f = p.texto ? falta(p.texto) : null;
  if (f) return registrarFalta(e, p.ws, p.usuario, p.texto ?? '', f);
  await guardar(contar(e, p.tipo)).catch((err) => console.error(`[onboarding:guardia] ws=${p.ws} no pude contar: ${msg(err)}`));
  return null;
}

/** Las respuestas del arranque (no pagan IA): la ráfaga, el bloqueo y el troleo. */
export async function frenoDeArranque(p: { req: Request; ws: number; usuario: string | null; texto?: string }): Promise<Freno | null> {
  if (!rateLimit(`onb-arr:u:${p.ws}:${p.usuario ?? '-'}`, TOPES.arranquePorMinutoUsuario, 60_000)) return { status: 429, error: MENSAJE_RAPIDO };
  let e: EstadoGuardia;
  try { e = await leerGuardia(); } catch (err) {
    console.error(`[onboarding:guardia] ws=${p.ws} no pude leer la guardia: ${msg(err)}`);
    return { status: 503, error: 'No pude guardar tu respuesta (falló la base de MaKo, no es nada tuyo). Prueba de nuevo en un momento.' };
  }
  if (e.bloqueo) return { status: 423, error: MENSAJE_BLOQUEADO, bloqueado: true };
  const f = p.texto ? falta(p.texto) : null;
  return f ? registrarFalta(e, p.ws, p.usuario, p.texto ?? '', f) : null;
}

async function registrarFalta(e: EstadoGuardia, ws: number, usuario: string | null, texto: string, motivo: string): Promise<Freno> {
  const { estado, bloquea } = conFalta(e, texto, motivo, usuario, new Date().toISOString());
  await guardar(estado).catch((err) => console.error(`[onboarding:guardia] ws=${ws} no pude anotar la falta: ${msg(err)}`));
  console.warn(`[onboarding:guardia] ws=${ws} falta ${estado.faltas}/${TOPES.faltasParaBloquear} (${motivo})${bloquea ? ' → BLOQUEADO' : ''}`);
  if (bloquea) {
    await avisarBloqueo(ws, estado).catch((err) => console.error(`[onboarding:guardia] ws=${ws} el aviso del bloqueo NO salió: ${msg(err)}`));
    return { status: 423, error: MENSAJE_BLOQUEADO, bloqueado: true };
  }
  return { status: 422, error: MENSAJE_FALTA };
}

/** El aviso al EQUIPO de MaKo (no al cliente): el mismo correo de la plataforma que usan los avisos de la voz. */
async function avisarBloqueo(ws: number, e: EstadoGuardia): Promise<void> {
  const plataforma = await wsSuperAdmin().catch(() => OWNER_WS);
  const negocio = (await getWorkspace(ws).catch(() => null))?.nombre ?? `Workspace ${ws}`;
  const { getDestinatariosDe } = await import('./notif-destinatarios');
  const dest = await getDestinatariosDe(plataforma).catch(() => null);
  const para = [...new Set([EMAIL_MAKO, ...(dest?.emails ?? [])].map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const cuerpo = [
    `Bloqueé el onboarding de «${negocio}» (ws ${ws}): ${e.bloqueo?.motivo ?? 'faltas'}${e.bloqueo?.usuario ? `, usuario ${e.bloqueo.usuario}` : ''}.`,
    '',
    'Lo último que escribió:',
    ...(e.ultimasFaltas ?? []).map((x) => `· ${x}`),
    '',
    'Mientras esté bloqueado no puede seguir el onboarding ni gastar IA. Para desbloquearlo, entra a su vista y toca «Desbloquear»:',
    linkApp('/onboarding', ws),
  ].join('\n');
  const r = await runWithWorkspace(plataforma, () => sendEmail({
    from: REMITENTE_MAKO, replyTo: EMAIL_MAKO, to: para,
    subject: `⚠️ Bloqueé el onboarding de ${negocio}`,
    text: cuerpo,
    html: `<pre style="font:14px/1.6 system-ui,sans-serif;white-space:pre-wrap">${cuerpo.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
  }));
  if (!r.ok) throw new Error(r.error ?? 'el envío falló');
}

/** El super admin desbloquea (mirando al cliente). */
export async function desbloquearOnboarding(): Promise<EstadoGuardia> {
  const e = desbloquear(await leerGuardia());
  await guardar(e);
  return e;
}
