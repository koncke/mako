// =============================================================================
// aviso-plan — el mail que avisa que le cambiaron el plan a un cliente
// =============================================================================
// «Siempre que se cambia el permiso, se le debe enviar un email al usuario»
// (29/09/2026). Hasta hoy el cambio de capa era mudo: el cliente entraba al día
// siguiente y su panel tenía otras tabs, sin que nada se lo hubiera dicho.
//
// ⚠️ NO SE REUSA `invitarPorEmail`: ése dice «tu cuenta ya está lista, entra con
// Google», que es otra cosa. Mandarlo acá haría que a alguien que YA entra hace meses
// le llegue un mail de bienvenida cada vez que le mueven el plan.
//
// ⚠️ NUNCA TIRA. El plan ya está escrito cuando esto corre, y revertirlo porque se cayó
// Resend sería deshacer una decisión que tomó una persona. Devuelve el resultado y quien
// llama lo pinta (ver `lib/plan-aviso.ts`).
//
// ⚠️ Y CORRE EN EL WORKSPACE DE LA PLATAFORMA, no en el del cliente: el cliente no tiene
// key ni dominio verificado, y `OWNER_WS` —a pesar del nombre— es un cliente más. Sin
// credencial propia, `resendKey()` cae en la del env, que es la de MaKo: justo lo que se
// quiere. Es la misma línea que `invitarPorEmail`.

import 'server-only';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { sendEmail, renderEmailHtml } from './resend';
import { linkApp, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';
import { emailDuenoWorkspace } from './usuarios';
import { capaDef, type CapaId } from './capas';
import type { ResultadoAvisoPlan } from './plan-aviso';

/**
 * Qué tabs ve cada capa, sólo para saber si el plan SE ACHICÓ. No se enumeran las tabs
 * en el mail —serían quince renglones por algo que la persona ve sola al entrar— pero sí
 * se dice la única consecuencia que no es obvia: que algo deja de aparecer.
 *
 * `navKeys === null` significa «todas», así que es el techo.
 */
function alcance(c: CapaId): number {
  const keys = capaDef(c).navKeys;
  return keys === null ? Number.POSITIVE_INFINITY : keys.length;
}

export async function avisarCambioDePlan(args: {
  ws: number;
  nombreWs: string;
  capaAntes: CapaId;
  capaAhora: CapaId;
}): Promise<ResultadoAvisoPlan> {
  const destino = (await emailDuenoWorkspace(args.ws)).trim().toLowerCase();
  // Sin nadie adentro no hay a quién escribirle. Es un ESTADO de esa cuenta y no una
  // falla del envío: quien llama lo dice distinto (ver `avisoCambioPlan`).
  if (!destino) return { enviado: false, a: '' };

  // ⚠️ EL PREFLIGHT DEL SANDBOX NO ES DECORACIÓN. Con el remitente sin configurar, Resend
  // acepta el envío contra `@resend.dev` y responde OK — o sea que el sistema informa
  // «mail enviado» y a la persona no le llega nada. Un éxito falso es peor que un error.
  if (/@resend\.dev$/i.test(EMAIL_MAKO)) {
    return { enviado: false, a: destino, error: 'el correo de MaKo todavía no está configurado (remitente de prueba)' };
  }

  const def = capaDef(args.capaAhora);
  const asunto = 'Tu plan de MaKo cambió';

  return runWithWorkspace(await wsSuperAdmin(), async () => {
    const bodyText = [
      'Hola,',
      '',
      `Tu cuenta de MaKo para ${args.nombreWs} pasó al plan ${def.nombre}. ${def.queRecibe}`,
      '',
      // La única consecuencia que no se ve sola, y sólo cuando aplica: que algo dejó de
      // estar. Al revés —cuando el plan crece— no hace falta avisar de nada que perder.
      ...(alcance(args.capaAhora) < alcance(args.capaAntes)
        ? ['Lo que no entra en este plan deja de aparecer en tu panel. Nada de lo que cargaste se borra.', '']
        : []),
      'Entra desde aquí:',
      linkApp('/inicio', args.ws),
      '',
      // El contacto de ayuda es el de MaKo y nunca el de quien hizo el cambio: es la
      // misma corrección que ya está escrita en `invitaciones.ts`.
      `Si algo no te cuadra, escríbenos a ${EMAIL_MAKO}.`,
    ].join('\n');

    const r = await sendEmail({
      to: destino,
      from: REMITENTE_MAKO,
      replyTo: EMAIL_MAKO,
      subject: asunto,
      html: renderEmailHtml({
        subject: asunto,
        bodyText,
        preheader: `Ahora tienes ${def.nombre}.`,
        fromName: 'MaKo',
        // Sin `unsubscribeUrl`: no es marketing, es el estado de su cuenta.
      }),
      text: bodyText,
      tags: [{ name: 'tipo', value: 'plan' }],
    });

    return r.ok
      ? { enviado: true, a: destino }
      : { enviado: false, a: destino, error: r.error || 'Resend rechazó el envío' };
  });
}
