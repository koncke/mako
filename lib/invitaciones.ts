// =============================================================================
// invitaciones — el mail que le avisa a una persona que ya tiene cuenta en MaKo
// =============================================================================
// POR QUÉ EXISTE. Dar de alta a un cliente creaba su workspace y su fila en `usuarios`, y
// ahí terminaba: **nadie le avisaba**. La pantalla de /admin lo decía sin querer —
// «cuando su admin entre con Google usando ese email, la cuenta se activa sola»— dando por
// hecho que el cliente iba a entrar por su cuenta a una URL que nadie le pasó.
//
// ⚠️ ACÁ NO HAY TOKEN NI CONTRASEÑA, Y NO ES UN ATAJO. En MaKo se entra SOLO con Google, y
// **la fila en `usuarios` YA ES la invitación**: el callback la busca por email, y si
// existe y no está suspendida, deja pasar y la pasa de `invitado` a `activo` sola. No hay
// dónde guardar una contraseña —la tabla no tiene columna— y el login por contraseña se
// eliminó a propósito: abría una sesión de admin salteando la tabla `usuarios`, y la
// cookie que dejaba era el mismo secreto que firma las sesiones. Mandar una contraseña por
// mail sería reabrir una vulnerabilidad ya cerrada.
//
// Lo que sí hace el mail es la parte que faltaba: decir que la cuenta existe, con qué
// dirección exacta hay que entrar, y por dónde.
//
// LA REGLA DE LA CASA QUE GOBIERNA ESTE ARCHIVO: una cosa, un lugar. Hay TRES puntos que
// dan de alta a una persona —el cliente nuevo, el usuario suelto de /admin, y el closer o
// setter que suma el propio cliente desde /equipo— y los tres llaman acá. Con el mail
// escrito adentro de uno solo, los otros dos nacen mudos y nadie se entera hasta que un
// cliente pregunta por qué su vendedor no puede entrar.
// =============================================================================

import 'server-only';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { sendEmail, renderEmailHtml } from './resend';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';
import { getSupabaseServer } from './supabase';
import type { RolWorkspace } from './auth-session';
import type { ResultadoInvitacion } from './invitacion-aviso';

// El tipo y el texto que lee la persona viven en `invitacion-aviso` (sin `server-only`,
// para que lo importen las pantallas y los tests). Acá se re-exporta para que quien manda
// el mail no tenga que importar de dos lados.
export type { ResultadoInvitacion };

// Quién firma este mail: `REMITENTE_MAKO`, la identidad de la PLATAFORMA. Vive en
// lib/app-url.ts desde el 11/09/2026, cuando la alarma de la voz caída
// (lib/canal-vigilante.ts) necesitó la misma firma. El porqué —y la trampa de que
// `OWNER_WS` sea un cliente— está escrito ahí.

/**
 * Cómo se le dice a cada rol lo que va a encontrar. No es cosmético: a un closer que
 * recibe «configurá tu negocio» le estás pidiendo algo que no le toca.
 *
 * ⚠️ EL `null` ES UN CASO PROPIO, NO UN SINÓNIMO DE 'admin'. `rol_ws: null` significa
 * «no tiene rol DENTRO de un negocio», y eso es un admin de la AGENCIA — que gestiona
 * todos los clientes y no tiene negocio propio que cargar. Escribirlo como
 * `QUE_VAS_A_HACER[rolWs ?? 'admin']` mete dos hechos distintos en un `??` y le manda al
 * super-admin la línea del dueño de un negocio: «vas a poder cargar tu negocio».
 *
 * Es la regla de la casa de «cada pregunta, su campo»: «¿qué rol tiene adentro del
 * negocio?» y «¿tiene negocio?» son dos preguntas, y cuando se colapsan en un `??` la
 * respuesta de una se lleva puesta a la otra.
 */
const AGENCIA = 'agencia';
const QUE_VAS_A_HACER: Record<string, string> = {
  admin: 'Vas a poder cargar tu negocio y empezar a trabajar con MaKo.',
  closer: 'Vas a ver tus reuniones y tus leads en el CRM.',
  setter: 'Vas a ver tus leads y tus conversaciones en el CRM.',
  [AGENCIA]: 'Vas a poder gestionar los clientes de la agencia desde MaKo.',
};

/**
 * Le avisa por mail a una persona que su cuenta ya existe.
 *
 * NUNCA tira: devuelve `{enviado:false, error}` y el enlace. Que el mail falle no puede
 * deshacer un alta que ya está firme en la base — y quien la dio de alta necesita
 * enterarse EN LA PANTALLA para poder pasar el link a mano, no en un log que nadie lee.
 */
export async function invitarPorEmail(u: {
  email: string;
  nombre?: string;
  /** Nombre del workspace al que entra, para que sepa de qué cuenta le hablan. */
  workspace?: string;
  rolWs?: RolWorkspace | null;
}): Promise<ResultadoInvitacion> {
  const enlace = `${APP_BASE_URL}/inicio`;
  const destino = (u.email ?? '').trim().toLowerCase();
  if (!destino) return { enviado: false, error: 'no hay email al que escribirle', enlace };

  // ⚠️ EL PREFLIGHT DEL SANDBOX NO ES DECORACIÓN. Con el remitente sin configurar, Resend
  // acepta el envío contra `@resend.dev` y responde OK — o sea que el sistema informa
  // «mail enviado» y a la persona no le llega nada. Un éxito falso es peor que un error:
  // nadie lo va a auditar. Se corta antes y se dice por qué.
  //
  // Se mira REMITENTE_MAKO y no `remitenteEsSandbox()`, que resuelve el del workspace
  // actual: acá el remitente no depende de ningún workspace, así que preguntarle a uno
  // sería chequear una cosa distinta de la que se va a usar.
  if (/@resend\.dev$/i.test(EMAIL_MAKO)) {
    return { enviado: false, error: 'el correo de MaKo todavía no está configurado (remitente de prueba)', enlace };
  }

  // El envío corre en el workspace del SUPER-ADMIN, que es la plataforma. No en el del
  // cliente recién creado (no tiene key ni dominio verificado) ni en `OWNER_WS`, que a
  // pesar del nombre es un cliente — ver REMITENTE_MAKO arriba. Como ese workspace no
  // tiene credencial propia de Resend, `resendKey()` cae en la key del env, que es la de
  // MaKo: exactamente lo que se quiere.
  return runWithWorkspace(await wsSuperAdmin(), async () => {
    const nombre = (u.nombre ?? '').trim().split(' ')[0];
    const hola = nombre ? `Hola ${nombre},` : 'Hola,';
    // `rolWs === null` es el admin de agencia, no el dueño de un negocio: ver el ⚠️ de
    // QUE_VAS_A_HACER. El `??` final es solo por si mañana aparece un rol sin línea propia.
    const queHace = QUE_VAS_A_HACER[u.rolWs ?? AGENCIA] ?? QUE_VAS_A_HACER[AGENCIA];
    const deQuien = u.workspace ? ` para ${u.workspace}` : '';

    // El cuerpo va en texto plano y `renderEmailHtml` lo maqueta y convierte las URLs en
    // links. Corto a propósito: un mail de acceso que explica el producto entierra lo
    // único que tiene que pasar ahí, que es entrar.
    const bodyText = [
      hola,
      '',
      `Tu cuenta de MaKo${deQuien} ya está lista. ${queHace}`,
      '',
      'Entra desde aquí:',
      enlace,
      '',
      // ⚠️ ESTA LÍNEA EVITA EL MODO DE FALLA MÁS PROBABLE, y por lejos. Quien da de alta
      // tipea el email a mano; si la persona entra con OTRA cuenta de Google, el callback
      // no encuentra su fila y le dice «esa cuenta no está autorizada» — un mensaje que no
      // se puede accionar si no sabe cuál era la buena.
      `Importante: entra con Google usando exactamente esta dirección: ${destino}`,
      '',
      // ⚠️ ACÁ DECÍA EL EMAIL DE QUIEN LO DIO DE ALTA, Y ESO MANDABA EL PROBLEMA AL LUGAR
      // EQUIVOCADO. Lo que falla en este mail es entrar —una cuenta de Google que no
      // matchea, un link que no abre, un dominio que rebota— y eso lo arregla MaKo, no el
      // admin del cliente que sumó a su closer. Peor: si el que dio el alta fue un cliente,
      // le estábamos poniendo a él la mesa de ayuda de nuestro producto.
      `Si algo no funciona, escríbenos a ${EMAIL_MAKO}.`,
    ].join('\n');

    const html = renderEmailHtml({
      subject: 'Tu acceso a MaKo',
      bodyText,
      preheader: 'Tu cuenta ya está lista. Entra con Google.',
      fromName: 'MaKo',
      // Sin `unsubscribeUrl` a propósito: no es marketing, es el acceso a una cuenta que
      // alguien pidió. Un link de baja acá invita a darse de baja de su propia herramienta.
    });

    const r = await sendEmail({
      to: destino,
      // `from` EXPLÍCITO: sin esto, `sendEmail` resuelve el remitente del workspace en
      // curso y el mail de la plataforma volvería a depender de la config de un cliente.
      from: REMITENTE_MAKO,
      // Redundante HOY —responder ya va al `from`— y puesto igual: es lo que hace que el
      // botón «Responder» y el «escríbenos a…» del cuerpo no se puedan separar nunca. El
      // día que el remitente pase a ser un no-reply, esta línea sigue llevando la
      // respuesta a una casilla que alguien lee.
      replyTo: EMAIL_MAKO,
      subject: 'Tu acceso a MaKo',
      html,
      text: bodyText,
      tags: [{ name: 'tipo', value: 'invitacion' }],
    });

    if (!r.ok) return { enviado: false, error: r.error || 'Resend rechazó el envío', enlace };

    // ⚠️ SE ESTAMPA SOLO SI SALIÓ. La columna contesta «¿ya se le avisó?», así que
    // marcarla en el intento la convierte en «¿lo intentamos?», que no le sirve a nadie:
    // el botón de reenviar quedaría diciendo que ya se mandó algo que nunca llegó.
    //
    // Y el error de guardar NO se propaga: el mail YA salió. Devolver `enviado:false`
    // porque falló el registro haría que quien mira la pantalla escriba a mano un aviso
    // que la persona ya tiene, y reenviar duplicaría el mensaje.
    // `.select('id')` no es cosmético: sin él, «se estampó» y «no encontré a quién
    // estampar» devuelven las dos `error: null` y se ven IGUAL. Y el segundo caso deja el
    // chip diciendo «sin avisar» para siempre sobre alguien a quien SÍ le llegó el mail.
    // (Que no pise a otra persona ya está garantizado: `usuarios_email_key` es UNIQUE.)
    const { data, error } = await getSupabaseServer()
      .from('usuarios').update({ invitacion_enviada_at: new Date().toISOString() })
      .eq('email', destino).select('id');
    if (error) console.error('[invitaciones] el mail salió pero no se pudo registrar:', error.message);
    else if (!data?.length) console.error(`[invitaciones] mail enviado a ${destino}, pero no hay fila en usuarios con ese email`);

    return { enviado: true, enlace };
  });
}
