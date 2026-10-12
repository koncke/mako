// =============================================================================
// curso-invitar-canales — por DÓNDE sale la invitación al curso, y con QUÉ remitente
// =============================================================================
// Item 21 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 09:30). El que probaba el curso
// preguntó «¿Y el email de qué va a ser? Mi email propio, tengo que conectar mi dominio» y Martín
// contestó: «puedes conectar tu email, puedes conectar tu WhatsApp y a la persona le puede llegar por
// ambos lados». Dos decisiones, puras y con test (tests/curso-invitar-canales.test.ts):
//
//   · EL REMITENTE (`invitacionDeVeredicto`, desde la undécima sobre `remitenteDelNegocio` de
//     lib/email-remitente.ts, la misma puerta que `sendEmail`). La invitación al curso es del NEGOCIO a SUS alumnos, no
//     de MaKo a un cliente: sale con el remitente del workspace del ALUMNO si ese negocio tiene su
//     dominio conectado; si no, con el de MaKo (`REMITENTE_MAKO`). Hasta el 08/10/2026 salía SIEMPRE con
//     el de MaKo (lib/invitaciones.ts, `enviarDePlataforma`): el alumno de un negocio con su dominio
//     verificado recibía «MaKo <equipo@hola-mako.com>», una marca que no conoce — que es lo que el mail
//     mismo dice que lleva a tratarlo como spam (lib/invitacion-aviso.ts).
//   · LOS CANALES (`canalesDeInvitacion`, `ofreceWhatsapp`). El correo siempre; el WhatsApp, además, si
//     la persona lo pide y el negocio tiene una línea conectada y el envío prendido.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan el server (lib/curso-invitar.ts, lib/invitaciones.ts), la
//    action del modal y los tests. No toca la base ni credenciales: recibe lo que ya se leyó.

import type { VeredictoRemitente } from './email-remitente';

export type CanalInvitacion = 'email' | 'whatsapp';

/**
 * Los canales de UNA invitación, saneados. Lo que llega puede ser cualquier cosa (viene del navegador).
 *
 * ⚠️ EL CORREO VA SIEMPRE, y el WhatsApp es un canal ADICIONAL («También por WhatsApp»). No es estilo:
 *    la invitación tiene UN estado (`invitacion_enviada_at`, el reclamo de la mig 0219, «ya invitado»),
 *    y se lo da el correo. Un WhatsApp solo, sin correo, sería una invitación que salió y no figura en
 *    ningún lado: el próximo «Invitar» la mandaría otra vez. Por eso `['whatsapp']` vuelve como
 *    `['email', 'whatsapp']`, y cualquier otra cosa (nada, un texto, un canal que no existe) como
 *    `['email']`, que es lo de siempre — la invitación automática al ganar (lib/crm-curso-al-ganar.ts) no
 *    pasa canales y sigue igual.
 */
export function canalesDeInvitacion(x: unknown): CanalInvitacion[] {
  const pedidos = Array.isArray(x) ? x : [];
  return pedidos.includes('whatsapp') ? ['email', 'whatsapp'] : ['email'];
}

/**
 * ¿El diálogo de invitar ofrece «También por WhatsApp»? Sólo si el negocio tiene su línea de WhatsApp
 * CONECTADA, el envío de WhatsApp PRENDIDO y el cliente tiene teléfono.
 *
 * ⚠️ EL INTERRUPTOR DEL NEGOCIO CUENTA, no sólo la línea: con `envio_whatsapp_enabled` apagado el envío
 *    contesta «envío de WhatsApp apagado» (el mismo que respetan los mensajes del curso,
 *    lib/curso-mensajes.ts), y ofrecer una casilla que siempre va a fallar es un control que no hace
 *    nada (AGENTS.md: «una guarda bloquea sólo lo que se arregla haciendo lo que ella pide»).
 */
export function ofreceWhatsapp(p: { lineaConectada: boolean; envioPrendido: boolean; conTelefono: boolean }): boolean {
  return p.lineaConectada === true && p.envioPrendido === true && p.conTelefono === true;
}

/**
 * ¿Hay un teléfono? Sólo dígitos, como `normalizarTelefono` (lib/leads.ts), que es lo que usa el envío.
 * UNA regla para las dos puntas que lo preguntan: la action que lee los teléfonos del CRM y el campo
 * «Teléfono» de «Alguien nuevo».
 *
 * ⚠️ `ofreceWhatsapp` recibe el BOOLEANO y no el teléfono, a propósito: el banco del 08/10/2026 encontró
 *    que la lista le pasaba un marcador de texto («si») por cada cliente con teléfono, y como no tiene
 *    dígitos la casilla no aparecía NUNCA en «Clientes sin invitar» (con los tests en verde: probaban con
 *    teléfonos de verdad). Un sí/no se pasa como sí/no.
 */
export const tieneTelefono = (t: string | null | undefined): boolean => !!String(t ?? '').replace(/\D/g, '');

/**
 * Lo que pasó con el WhatsApp, para la fila de quien invitó: corto, y pegado a «Invitación enviada.».
 * El correo puede salir y el WhatsApp no (sin teléfono, línea caída, envío apagado): se dice cuál.
 */
export function fraseWhatsapp(w: { enviado: boolean; motivo?: string }): string {
  return w.enviado ? 'También por WhatsApp.' : `WhatsApp: ${(w.motivo ?? '').trim() || 'no salió'}.`;
}

/** Con qué remitente sale la invitación. `negocio`: el del workspace, con su respuesta a esa dirección. */
export type RemitenteInvitacion =
  | { via: 'negocio'; from: string; replyTo: string }
  | { via: 'mako' };

/** La dirección de un remitente «Nombre <a@b.c>» o «a@b.c», en minúsculas. `null` si no es una dirección. */
export function direccionDe(remitente: string | null | undefined): string | null {
  const s = String(remitente ?? '').trim();
  if (!s) return null;
  const m = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(s);
  const d = (m ? m[1] : s).trim().toLowerCase();
  return /^[^@\s<>",;]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}

/**
 * El remitente de la invitación a partir del veredicto de la ÚNICA puerta del remitente del negocio
 * (`remitenteDelNegocio`, lib/email-remitente.ts; en el server, `remitenteDelNegocioActual` de lib/resend.ts).
 * Undécima tanda: la invitación tenía su propia copia de la regla (miraba sólo `hola-mako.com` exacto y
 * daba por propia cualquier key cargada, también la copia de la plataforma del ws4). Si el negocio no
 * puede mandar, la firma MaKo, como siempre.
 */
export function invitacionDeVeredicto(v: VeredictoRemitente): RemitenteInvitacion {
  if (!v.puede) return { via: 'mako' };
  const dir = direccionDe(v.from);
  return dir ? { via: 'negocio', from: v.from, replyTo: dir } : { via: 'mako' };
}
