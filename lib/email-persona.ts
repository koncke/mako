// =============================================================================
// email-persona — «Email a la persona»: el mail de un evento de una PERSONA (puro, con test)
// =============================================================================
// La contraseña obligatoria (15/10/2026, decisión de Martín: desde el 21/10, como el 2FA). «Olvidé mi contraseña»
// necesita un mail a ESA persona con un link de UN uso, y todo por Automations: lo emite Seguridad como un evento de
// MaKo (`contrasena_restablecer`, lib/disparadores.ts) y lo manda la automatización de SuperAdmin con la tarjeta
// «Email a la persona» (`pasosDelEvento`, lib/aviso-evento.ts). Diseño: docs/diseno-2fa-obligatorio.md §8.
//
// LAS TRES REGLAS:
//   · A DÓNDE lo decide `destinoDeUsuario` (lib/destino-usuario.ts, de Seguridad) con el PROPÓSITO del evento,
//     nunca un dato: el correo de la cuenta para restablecer, el de respaldo para un código. null = no sale; si TIRA,
//     «no pude leer», que es otra cosa y se dice distinto.
//   · SALE POR EL REMITENTE DE MaKo (equipo@hola-mako.com, la key de la plataforma), nunca por el de un negocio: un
//     aviso de seguridad firmado por el dominio de un cliente es lo contrario de lo que tiene que transmitir.
//   · LO SECRETO NO SALE DE ACÁ: el link va sólo en el cuerpo del mail (Publicar no lo deja en el asunto). Lo que se
//     loguea o va al grupo de la plataforma lleva el asunto y el error, y además pasa por `sinValoresSecretos`: un
//     error de Resend que repitiera el cuerpo no puede llevarse el link.
//
// ⚠️ PURO, A PROPÓSITO: la base, el destino y el envío entran por parámetro (`DepsEmailPersona`), como en
// lib/aviso-evento.ts. Los enchufa lib/flujos.ts.

import { renderEmailHtml } from './email-html';
import { aplicarVariablesHtml } from './email-html-seguro';
import { aplicarVariables } from './template-vars';
import { textoConDatos } from './variables-del-lead';
import { CLAVES_SECRETAS } from './variables-aviso';
import type { Paso } from './flujos-tipos';

export type PasoEmailPersona = Extract<Paso, { tipo: 'email_persona' }>;

export type DepsEmailPersona = {
  /** `destinoDeUsuario(usuarioId, 'email', proposito)`. null = no tiene; TIRA = no se pudo leer. */
  destino: (usuarioId: number, proposito: PasoEmailPersona['proposito']) => Promise<string | null>;
  /** Los valores del «{ }» que nombra el texto, con los `datos` del evento ganando (`valoresDeVariables`). */
  valores: (texto: string, datos: Record<string, string>) => Promise<Record<string, string>>;
  /** `sendEmail({ from: REMITENTE_MAKO, … })`: la key y el remitente de la plataforma. */
  enviar: (m: { to: string; subject: string; html: string; text: string }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  /** Una línea al grupo de MaKo de la plataforma, cuando algo NO salió. */
  alGrupo: (texto: string) => Promise<void>;
  log?: (m: string) => void;
};

export type ResultadoEmailPersona = 'enviado' | 'sin_usuario' | 'sin_destino' | 'ilegible' | 'no_salio';

/**
 * UN TEXTO SIN LOS VALORES SECRETOS de estos datos: cada uno, reemplazado por «[oculto]». Para todo lo que sale de acá
 * que no es el mail (el log, la línea al grupo).
 */
export function sinValoresSecretos(texto: string, datos: Record<string, string> | undefined): string {
  let out = texto;
  for (const [k, v] of Object.entries(datos ?? {})) if (CLAVES_SECRETAS.has(k) && v) out = out.split(v).join('[oculto]');
  return out;
}

/**
 * MANDA EL «EMAIL A LA PERSONA» de un evento. Nunca tira: un mail que no sale se dice en el log y, si fue un error (no
 * una persona sin correo), en el grupo de la plataforma. `ctx.datos` trae `usuario_id` y lo que el evento pasó.
 */
export async function enviarEmailAPersona(
  paso: PasoEmailPersona, ctx: { datos?: Record<string, string> }, deps: DepsEmailPersona,
): Promise<ResultadoEmailPersona> {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const datos = ctx.datos ?? {};
  const limpio = (t: string) => sinValoresSecretos(t, datos);
  const uid = Number(datos.usuario_id);
  if (!Number.isInteger(uid) || uid <= 0) {
    log('[email-persona] el evento no trae usuario_id: el mail no sale');
    return 'sin_usuario';
  }

  let to: string | null;
  try {
    to = await deps.destino(uid, paso.proposito);
  } catch (e) {
    // «No pude leer» no es «no tiene»: es un error, y se dice en el grupo.
    log(limpio(`[email-persona] no pude leer el correo del usuario #${uid}: ${e instanceof Error ? e.message : String(e)}`));
    await deps.alGrupo(limpio(`⚠️ No salió el mail «${paso.asunto}» al usuario #${uid}: no pude leer su correo.`)).catch(() => {});
    return 'ilegible';
  }
  if (!to) {
    // Sin correo para ese propósito (una cuenta suspendida, un código sin correo de respaldo): no es un error.
    log(`[email-persona] el usuario #${uid} no tiene correo para «${paso.proposito}»: el mail no sale`);
    return 'sin_destino';
  }

  try {
    const vars = await deps.valores([paso.asunto, paso.texto, paso.html ?? ''].join('\n'), datos);
    // El cuerpo con el renglón opcional (`textoConDatos`); el asunto es UNA línea (sin el renglón: se iría entero) y
    // el HTML no se recorta, como el email del motor (lib/nutricion.ts).
    const cuerpo = textoConDatos(paso.texto, vars);
    const asunto = aplicarVariables(paso.asunto, vars) || '(sin asunto)';
    const html = renderEmailHtml({
      subject: asunto,
      bodyText: cuerpo,
      ...(paso.html ? { bodyHtml: aplicarVariablesHtml(paso.html, vars) } : {}),
      // Habla MaKo: su firma y su marca. Sin link de baja: es un mail de la cuenta, no un envío de marketing.
      fromName: 'MaKo',
      marca: 'mako',
    });
    const r = await deps.enviar({ to, subject: asunto, html, text: cuerpo });
    if (r.ok) return 'enviado';
    log(limpio(`[email-persona] no salió el mail al usuario #${uid}: ${r.error}`));
    await deps.alGrupo(limpio(`⚠️ No salió el mail «${asunto}» al usuario #${uid}: ${r.error}`)).catch(() => {});
    return 'no_salio';
  } catch (e) {
    log(limpio(`[email-persona] no salió el mail al usuario #${uid}: ${e instanceof Error ? e.message : String(e)}`));
    await deps.alGrupo(limpio(`⚠️ No salió el mail «${paso.asunto}» al usuario #${uid}.`)).catch(() => {});
    return 'no_salio';
  }
}
