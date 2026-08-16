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
import { APP_BASE_URL, EMAIL_MAKO } from './app-url';
import { getSupabaseServer } from './supabase';
import type { RolWorkspace } from './auth-session';
import type { ResultadoInvitacion } from './invitacion-aviso';

// El tipo y el texto que lee la persona viven en `invitacion-aviso` (sin `server-only`,
// para que lo importen las pantallas y los tests). Acá se re-exporta para que quien manda
// el mail no tenga que importar de dos lados.
export type { ResultadoInvitacion };

/**
 * Quién firma este mail. La dirección sale de `EMAIL_MAKO` (lib/app-url.ts), que es LA
 * dirección de MaKo: la misma que firma, la misma a la que vuelve un «Responder», y la
 * misma que el cuerpo le da a la persona para pedir ayuda. Las tres tienen que coincidir
 * o el mail no sirve, y la única forma de que no diverjan es que salgan de un solo lugar.
 *
 * ⚠️ ACÁ HABÍA UNA TRAMPA QUE NO SE VE PORQUE FUNCIONA DE CASUALIDAD. El único
 * remitente configurado en todo el sistema es el setting `resend_from` del workspace 1,
 * y `OWNER_WS` vale 1 — pero **el 1 es Mauricio, un CLIENTE**; el nombre de la constante
 * engaña y ya se llevó puestas otras cosas. Mandar desde ahí significa que el día que un
 * cliente cambie su remitente a «Elevate <ventas@elevate.com.mx>», TODOS los clientes
 * nuevos de MaKo reciben su acceso firmado por el negocio de otro cliente. Y si carga su
 * propia RESEND_API_KEY, los mails de la plataforma salen por SU cuenta de Resend.
 *
 * Nada de eso rompe nada visible: sale un mail, con un remitente válido, y andá a saber
 * cuándo alguien lo mira. Por eso la identidad de la plataforma se resuelve sola, sin
 * preguntarle a ningún workspace.
 *
 * `EMAIL_MAKO` guarda la dirección PELADA y el remitente se arma acá, en vez de guardar
 * «MaKo <…>» entero: así no hay que parsear nada para saber a dónde se le pide ayuda, y
 * un override mal escrito no puede dejar el cuerpo del mail diciendo «escribinos a
 * MaKo <equipo@…>». El display name es «MaKo» fijo: la marca no es configuración.
 */
const REMITENTE_MAKO = `MaKo <${EMAIL_MAKO}>`;

/** Cómo se le dice a cada rol lo que va a encontrar. No es cosmético: a un closer que
 *  recibe «configurá tu negocio» le estás pidiendo algo que no le toca. */
const QUE_VAS_A_HACER: Record<string, string> = {
  admin: 'Vas a poder cargar tu negocio y empezar a trabajar con MaKo.',
  closer: 'Vas a ver tus reuniones y tus leads en el CRM.',
  setter: 'Vas a ver tus leads y tus conversaciones en el CRM.',
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
    const queHace = QUE_VAS_A_HACER[u.rolWs ?? 'admin'] ?? QUE_VAS_A_HACER.admin;
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
    const { error } = await getSupabaseServer()
      .from('usuarios').update({ invitacion_enviada_at: new Date().toISOString() }).eq('email', destino);
    if (error) console.error('[invitaciones] el mail salió pero no se pudo registrar:', error.message);

    return { enviado: true, enlace };
  });
}
