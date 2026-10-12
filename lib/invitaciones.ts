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
import { sendEmail, renderEmailHtml, displayNameDe, remitenteDelNegocioActual } from './resend';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';
import { getSupabaseServer } from './supabase';
import type { RolWorkspace } from './auth-session';
import { textoInvitacionCurso, textoInvitacionLider, textoLinkAlumno, type ResultadoInvitacion } from './invitacion-aviso';
import { invitacionDeVeredicto, type RemitenteInvitacion } from './curso-invitar-canales';

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

// ── El núcleo: un mail de la PLATAFORMA ───────────────────────────────────────
// Lo comparten los dos mails de acceso de acá abajo (la cuenta de MaKo y el curso de un
// servicio). Antes del 06/10/2026 todo esto vivía adentro de `invitarPorEmail`, y el curso
// iba a necesitar las mismas cuatro cosas: el corte del remitente de prueba, el envío en el
// workspace de la plataforma con su firma, el maquetado, y «se anota sólo si salió». Con dos
// copias, la segunda nace sin el corte del sandbox — que es el que evita el éxito falso.

type MailDePlataforma = { to: string; asunto: string; preheader: string; cuerpo: string; tag: string };

/**
 * Manda un mail de la plataforma. NUNCA tira: devuelve si salió y, si no, por qué.
 *
 * `alSalir` corre SÓLO si el envío contestó bien, y su error NO se propaga: el mail YA salió,
 * y devolver «no salió» porque falló el registro haría que alguien lo reenvíe a mano.
 *
 * ⚠️ `alSalir` CORRE AFUERA DEL WORKSPACE DE LA PLATAFORMA, en el de quien llama. El envío se
 * hace adentro de `runWithWorkspace(wsSuperAdmin)`, y una escritura con `getTenantDb()` ahí
 * adentro caería en el inquilino de la plataforma y no en el del cliente: no da error, escribe
 * en otro lado (o en ningún lado).
 */
async function enviarDePlataforma(
  m: MailDePlataforma,
  alSalir?: () => Promise<void>,
): Promise<{ enviado: true } | { enviado: false; error: string }> {
  // ⚠️ EL PREFLIGHT DEL SANDBOX NO ES DECORACIÓN. Con el remitente sin configurar, Resend
  // acepta el envío contra `@resend.dev` y responde OK — o sea que el sistema informa
  // «mail enviado» y a la persona no le llega nada. Un éxito falso es peor que un error:
  // nadie lo va a auditar. Se corta antes y se dice por qué.
  //
  // Se mira REMITENTE_MAKO y no `remitenteEsSandbox()`, que resuelve el del workspace
  // actual: acá el remitente no depende de ningún workspace, así que preguntarle a uno
  // sería chequear una cosa distinta de la que se va a usar.
  if (/@resend\.dev$/i.test(EMAIL_MAKO)) {
    return { enviado: false, error: 'el correo de MaKo todavía no está configurado (remitente de prueba)' };
  }

  // El envío corre en el workspace del SUPER-ADMIN, que es la plataforma. No en el del
  // cliente (no tiene key ni dominio verificado) ni en `OWNER_WS`, que a pesar del nombre es
  // un cliente — ver REMITENTE_MAKO arriba. Como ese workspace no tiene credencial propia de
  // Resend, `resendKey()` cae en la key del env, que es la de MaKo: exactamente lo que se
  // quiere.
  const r = await runWithWorkspace(await wsSuperAdmin(), async () => {
    const html = renderEmailHtml({
      subject: m.asunto,
      bodyText: m.cuerpo,
      preheader: m.preheader,
      fromName: 'MaKo',
      // Sin `unsubscribeUrl` a propósito: no es marketing, es un acceso que alguien pidió.
      // Un link de baja acá invita a darse de baja de su propia herramienta.
    });
    return await sendEmail({
      to: m.to,
      // `from` EXPLÍCITO: sin esto, `sendEmail` resuelve el remitente del workspace en
      // curso y el mail de la plataforma volvería a depender de la config de un cliente.
      from: REMITENTE_MAKO,
      // Redundante HOY —responder ya va al `from`— y puesto igual: es lo que hace que el
      // botón «Responder» y el «escríbenos a…» del cuerpo no se puedan separar nunca. El
      // día que el remitente pase a ser un no-reply, esta línea sigue llevando la
      // respuesta a una casilla que alguien lee.
      replyTo: EMAIL_MAKO,
      subject: m.asunto,
      html,
      text: m.cuerpo,
      tags: [{ name: 'tipo', value: m.tag }],
    });
  });

  if (!r.ok) return { enviado: false, error: r.error || 'Resend rechazó el envío' };

  if (alSalir) {
    try { await alSalir(); } catch (e) {
      console.error('[invitaciones] el mail salió pero no se pudo registrar:', e instanceof Error ? e.message : e);
    }
  }
  return { enviado: true };
}

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

  const r = await enviarDePlataforma(
    { to: destino, asunto: 'Tu acceso a MaKo', preheader: 'Tu cuenta ya está lista. Entra con Google.', cuerpo: bodyText, tag: 'invitacion' },
    async () => {
      // ⚠️ SE ESTAMPA SOLO SI SALIÓ (por eso va en `alSalir`). La columna contesta «¿ya se le
      // avisó?», así que marcarla en el intento la convierte en «¿lo intentamos?», que no le
      // sirve a nadie: el botón de reenviar quedaría diciendo que ya se mandó algo que nunca
      // llegó.
      //
      // `.select('id')` no es cosmético: sin él, «se estampó» y «no encontré a quién
      // estampar» devuelven las dos `error: null` y se ven IGUAL. Y el segundo caso deja el
      // chip diciendo «sin avisar» para siempre sobre alguien a quien SÍ le llegó el mail.
      // (Que no pise a otra persona ya está garantizado: `usuarios_email_key` es UNIQUE.)
      // Va por `getSupabaseServer` y no por el inquilino: `usuarios` es de la plataforma.
      const { data, error } = await getSupabaseServer()
        .from('usuarios').update({ invitacion_enviada_at: new Date().toISOString() })
        .eq('email', destino).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) console.error(`[invitaciones] mail enviado a ${destino}, pero no hay fila en usuarios con ese email`);
    },
  );
  return r.enviado ? { enviado: true, enlace } : { enviado: false, error: r.error, enlace };
}

// ── La invitación al CURSO sale con el remitente del NEGOCIO (08/10/2026) ──────────
// Item 21 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 09:30): «¿Y el email de qué
// va a ser? Mi email propio, tengo que conectar mi dominio» — «Sí, vas a tener que conectar, puedes
// conectar tu email…». MEDIDO ANTES DE TOCAR: `invitarAlCursoPorEmail` iba por `enviarDePlataforma`,
// o sea que la invitación al curso de CUALQUIER negocio salía firmada «MaKo <equipo@hola-mako.com>»,
// tuviera o no su dominio verificado. Para el alumno, MaKo es una marca que no conoce.
//
// La regla es la de `sendEmail` (`remitenteDelNegocio`, lib/email-remitente.ts, pura y con test), leída del
// workspace del ALUMNO con `remitenteDelNegocioActual`; `invitacionDeVeredicto` la pasa a la invitación.
//
// ⚠️ ESTO NO CONTRADICE A `REMITENTE_MAKO`: aquello es la identidad de la PLATAFORMA para lo que manda
//    MaKo (el acceso de un cliente a MaKo, las alarmas). La invitación al curso la manda EL NEGOCIO a SUS
//    alumnos, y cuando el negocio no tiene dominio, MaKo la firma en su nombre como siempre.

/**
 * El remitente de la invitación, leído del workspace `ws` (el del ALUMNO, nunca el del contexto).
 *
 * ⚠️ SI NO SE PUEDE LEER, VA EL DE MAKO, que es lo de siempre y siempre sale. No es «una lectura que cae
 *    al default para decidir» en la dirección peligrosa: el default no afirma nada falso ni manda de
 *    más — el mail llega igual, firmado por la plataforma — y queda el aviso en el log.
 */
async function remitenteDelNegocio(ws: number): Promise<RemitenteInvitacion> {
  if (!Number.isInteger(ws) || ws <= 0) return { via: 'mako' };
  try {
    // Undécima tanda: la MISMA puerta que `sendEmail` (`remitenteDelNegocioActual`, lib/resend.ts). Lee las
    // credenciales del CLIENTE (`credDelCliente`, nunca `credWs`) y compara su key con la de la plataforma:
    // la copia del ws4 no es «su cuenta». Una regla propia acá decía «negocio» donde `sendEmail` rechaza.
    return await runWithWorkspace(ws, async () => invitacionDeVeredicto(await remitenteDelNegocioActual()));
  } catch (e) {
    console.warn(`[invitaciones] no pude leer el remitente del ws ${ws}; va el de MaKo:`, e instanceof Error ? e.message : e);
    return { via: 'mako' };
  }
}

/**
 * Manda un mail CON EL REMITENTE DEL NEGOCIO, adentro de SU workspace: la key de Resend que se usa es la
 * suya (Opción B) o la de MaKo, donde verificó su dominio (Opción A, lib/resend.ts). Nunca tira.
 *
 * ⚠️ SIN «SI FALLA, LO MANDA MaKo»: un error de Resend (el dominio dejó de verificar) se dice en la
 *    pantalla y se arregla; reintentar por otra puerta escondería el problema y, con un corte de red a
 *    mitad (que `sendEmail` no distingue de un rechazo), podría mandar el mail dos veces.
 */
async function enviarDelNegocio(
  ws: number,
  rem: Extract<RemitenteInvitacion, { via: 'negocio' }>,
  m: MailDePlataforma,
): Promise<{ enviado: true } | { enviado: false; error: string }> {
  const r = await runWithWorkspace(ws, async () => {
    const html = renderEmailHtml({
      subject: m.asunto,
      bodyText: m.cuerpo,
      preheader: m.preheader,
      // La firma del pie es la del negocio; sin la banda de MaKo (es opt-in, ver lib/email-html.ts).
      fromName: displayNameDe(rem.from) || undefined,
    });
    return await sendEmail({
      to: m.to,
      // `from` y `replyTo` EXPLÍCITOS: `sendEmail` sin `from` resolvería el del contexto por su cuenta.
      from: rem.from,
      replyTo: rem.replyTo,
      subject: m.asunto,
      html,
      text: m.cuerpo,
      tags: [{ name: 'tipo', value: m.tag }],
    });
  });
  return r.ok ? { enviado: true } : { enviado: false, error: r.error || 'Resend rechazó el envío' };
}

/**
 * Invita a un cliente al CURSO del servicio que compró (pedido del 06/10/2026). El acceso es
 * un link firmado, no una cuenta (lib/curso-acceso.ts): este mail le lleva el link de
 * ENTRADA de la versión vigente. El texto vive en `textoInvitacionCurso`
 * (lib/invitacion-aviso.ts), que tiene test.
 *
 * Desde el 08/10/2026 sale con el remitente del NEGOCIO si tiene su dominio conectado, y si no con el
 * de MaKo (`remitenteDelNegocio`, arriba). `remitente` dice cuál fue.
 *
 * NUNCA tira, igual que la de arriba.
 *
 * ⚠️ NO ANOTA NADA. Quien la llama (la action de la ficha) escribe en `curso_accesos` DESPUÉS
 * de que esto vuelva con `enviado: true`, y lo hace AFUERA de acá a propósito: el envío corre
 * adentro de un `runWithWorkspace` propio (el de la plataforma, o el del negocio), y anotarlo acá
 * adentro sería escribir con el inquilino que no es sin un error.
 */
export async function invitarAlCursoPorEmail(p: {
  /** El workspace del ALUMNO: decide el remitente. */
  ws: number;
  email: string;
  nombre?: string | null;
  programa: string;
  negocio?: string | null;
  /** El link de entrada (lo arma quien llama, con `linkApp`). */
  enlace: string;
  /** El login de MaKo, para quien prefiera entrar con Google (con `linkApp('/login')`). */
  entrarConGoogle: string;
}): Promise<ResultadoInvitacion & { remitente?: RemitenteInvitacion['via'] }> {
  // ⚠️ EL REMITENTE SE RESUELVE PRIMERO, con el `ws` del parámetro (AGENTS.md: en una función que acepta
  //    `ws`, resolverlo es la primera línea; cualquier lectura antes pregunta por el inquilino del contexto).
  const rem = await remitenteDelNegocio(p.ws);
  const destino = (p.email ?? '').trim().toLowerCase();
  if (!destino) return { enviado: false, error: 'no hay email al que escribirle', enlace: p.enlace };
  const t = textoInvitacionCurso(p);
  const mail: MailDePlataforma = { to: destino, asunto: t.asunto, preheader: t.preheader, cuerpo: t.cuerpo, tag: 'invitacion-curso' };
  const r = rem.via === 'negocio' ? await enviarDelNegocio(p.ws, rem, mail) : await enviarDePlataforma(mail);
  return r.enviado ? { enviado: true, enlace: p.enlace, remitente: rem.via } : { enviado: false, error: r.error, enlace: p.enlace, remitente: rem.via };
}

/**
 * Invita al LÍDER de un área a sus tareas del curso (#665). El texto vive en `textoInvitacionLider`
 * (lib/invitacion-aviso.ts, con test); el link es el `c2.` de su acceso, que arma quien llama.
 *
 * NUNCA tira, y NO ANOTA NADA, por la misma razón que la de arriba: el envío corre en el workspace
 * de la plataforma y el acceso del líder vive en el del cliente. Quien llama anota DESPUÉS.
 */
export async function invitarLiderPorEmail(p: {
  email: string;
  area: string;
  programa: string;
  negocio?: string | null;
  enlace: string;
}): Promise<ResultadoInvitacion> {
  const destino = (p.email ?? '').trim().toLowerCase();
  if (!destino) return { enviado: false, error: 'no hay email al que escribirle', enlace: p.enlace };
  const t = textoInvitacionLider(p);
  const r = await enviarDePlataforma({ to: destino, asunto: t.asunto, preheader: t.preheader, cuerpo: t.cuerpo, tag: 'invitacion-curso-lider' });
  return r.enviado ? { enviado: true, enlace: p.enlace } : { enviado: false, error: r.error, enlace: p.enlace };
}

/**
 * El link para ENTRAR con el email (07/10/2026): «Soy alumno: entrar con mi email» en /login. El
 * texto vive en `textoLinkAlumno` (lib/invitacion-aviso.ts, con test); el link lo arma quien llama
 * (`urlDeLinkAlumno`, lib/alumno-sesion.ts).
 *
 * NUNCA tira, y NO ANOTA NADA, por la misma razón que las de arriba: el envío corre en el workspace
 * de la plataforma. El nonce del link ya lo dejó escrito quien llama ANTES (`emitirLinkMagico`): un
 * mail que no sale deja un link que nadie tiene, que es inofensivo.
 */
export async function mandarLinkAlumnoPorEmail(p: { email: string; enlace: string; minutos: number; negocio?: string | null }): Promise<ResultadoInvitacion> {
  const destino = (p.email ?? '').trim().toLowerCase();
  if (!destino) return { enviado: false, error: 'no hay email al que escribirle', enlace: p.enlace };
  const t = textoLinkAlumno(p);
  const r = await enviarDePlataforma({ to: destino, asunto: t.asunto, preheader: t.preheader, cuerpo: t.cuerpo, tag: 'link-alumno' });
  return r.enviado ? { enviado: true, enlace: p.enlace } : { enviado: false, error: r.error, enlace: p.enlace };
}
