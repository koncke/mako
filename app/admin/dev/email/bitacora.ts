// =============================================================================
// Email — el registro de construcción del área (la campaña de email por la API, 4/11/2026)
// =============================================================================
// Alcance: el canal de email del negocio: su dominio en Resend, el remitente, las secuencias del motor, los broadcasts, el
// webhook de aperturas, clics, rebotes y quejas, y lo que se puede hacer de todo eso por la API de MaKo.
// Lo que costó, en docs/hallazgos-comunicacion.md → «Email (Resend)»; lo que falta en producción, en
// docs/relevo/nube-email.md. Fecha, hora y sha, de `git log`.
// =============================================================================

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El dominio y el remitente por la API', detalle: 'conectar_dominio_email devuelve los DNS · el seguimiento de aperturas y clics se prende al crear y al verificar · fijar_remitente_email con reply_to', estado: 'hecha' },
  { titulo: 'El CRM de la campaña', detalle: 'agregar_en_bloque_a_crm suma sin sacar de su CRM · la secuencia de email atada a un CRM inscribe a los agregados', estado: 'hecha' },
  { titulo: 'La tarjeta sigue al email', detalle: 'columnasEmail por automatización: enviado, abrió, clic · nunca hacia atrás ni desde Ganado · quien compra no recibe el siguiente', estado: 'hecha' },
  { titulo: 'El ritmo y la reputación', detalle: 'rampa del dominio 50 → 100 · freno por rebotes (5 %) y quejas (0,3 %) · topes por la API · el aviso al activar dice la campaña entera', estado: 'hecha' },
  { titulo: 'Probado con un envío real', detalle: 'Nada de esto salió todavía a un buzón de verdad: ver docs/relevo/nube-email.md', estado: 'sigue' },
];

const SESION = 'cli_fe44de53-c921-5546-aa4a-0d433bbd0829';

export const BITACORA: Hito[] = [
  {
    fecha: '4 nov', hora: '07:40', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La campaña de email de Mauricio, entera por la API',
    pedido: 'Revisa mi ultima llamada con Mauricio, porque el va a comenzar a hacer campaña de email a sus leads, le di instrucciones de como configurarlo con la API de MaKo desde su claude, pero estoy seguro que hay cosas que aun no funcionan, implementalo...',
    puntos: [
      'Lo que se le dijo en la llamada del 3/11: 14 emails, uno cada 24 h, a todos sus leads menos los ganados, desde su Claude con la API; un CRM «Email Marketing» con una columna para el que abrió, otra para el que hizo clic y una para el que compró.',
      'Medido en el ws1: 1.173 leads, 1.169 con email, 1.128 abiertos sin ganar; sin dominio ni remitente propios (el envío se corta en sendEmail) y el seguimiento de aperturas apagado.',
      'Lo que no se hace desde acá: mandar emails, tocar datos, prender el envío real, ni que Mauricio pegue su key de Resend (la fila del ws1 es el entorno de la plataforma).',
    ],
  },
  {
    fecha: '4 nov', hora: '08:06', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El dominio, el remitente y el seguimiento, por la API',
    puntos: [
      '**`conectar_dominio_email`** devuelve los registros DNS para cargar; **`fijar_remitente_email`** fija nombre, dirección y a dónde llegan las respuestas (`reply_to`), que ahora viajan en el motor y en los broadcasts.',
      '**El seguimiento de aperturas y clics se prende solo**: al crear el dominio y al verificarlo (PATCH /domains de Resend). Sin eso, «Abrió» y «Hizo clic» no tenían de dónde salir.',
      'La lógica salió de la ruta de la pantalla a lib/email-dominio.ts: la pantalla y la API son la misma puerta.',
    ],
    commits: [{ sha: '7dcae09be', msg: 'Email por la API: conectar el dominio, el remitente con reply_to, y el seguimiento de aperturas y clics', lineas: 1035, archivos: 16 }],
    revisar: '/email',
  },
  {
    fecha: '4 nov', hora: '08:25', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los leads a otro CRM en bloque, y la secuencia atada a ese CRM',
    puntos: [
      '**`agregar_en_bloque_a_crm`** suma hasta 5.000 leads a otro CRM sin sacarlos del suyo, sin los estados que se excluyan (los ganados) y con tope de tiempo: lo que no entra vuelve en «pendientes».',
      '⚠️ **Sin el CRM, una secuencia por etapa mira sólo la CASA de cada lead**: los sumados a «Email Marketing» no entraban nunca, con la secuencia activa y sin un error. `crear_secuencia_email` y `editar_meta_secuencia_email` aceptan `funnelId`.',
      'La configuración de una automatización, sus CRON y la prueba salen por HTTP.',
    ],
    commits: [
      { sha: 'ec1bdb72b', msg: 'CRM por la API: sumar leads en bloque a otro CRM sin sacarlos del suyo', lineas: 316, archivos: 9 },
      { sha: '0f3f3e096', msg: 'Email por la API: la secuencia atada a un CRM, y la configuración, los CRON y la prueba por HTTP', lineas: 444, archivos: 10 },
    ],
    revisar: '/crm',
  },
  {
    fecha: '4 nov', hora: '08:43', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tarjeta sigue al email, y quien compró no recibe el siguiente',
    puntos: [
      '**`columnasEmail`** por automatización (`configurar_automatizacion`): la tarjeta pasa a «Enviado» al salir, a «Abrió» y a «Hizo clic» con el webhook. Nunca hacia atrás ni desde una terminal; sin columnas, nada cambia.',
      '**El corte**: con columnas, a quien ya no está abierto o llegó a Ganado en ese CRM no le sale el email siguiente; la inscripción se cancela con su rastro.',
      '⚠️ Cuatro parámetros nuevos sacaban a `cambiar_crons_secuencia` del presupuesto del turno: quedó UNO (`columnasEmail`), margen 318.',
    ],
    commits: [{ sha: '6d539b05b', msg: 'Email: la tarjeta del CRM sigue al email (enviado, abrió, clic) y quien compró no recibe el siguiente', lineas: 611, archivos: 11 }],
    revisar: '/automations',
  },
  {
    fecha: '4 nov', hora: '09:01', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La rampa del dominio, el freno y los topes por la API',
    puntos: [
      '**La rampa**: el email de la línea arranca con 50 por día y sube 50 cada día que llega, hasta 100.',
      '**El freno**: en 24 h, con 50 enviados o más, rebotes de 5 % o quejas de 0,3 % apagan el envío y avisan (migración 0380, sólo agrega).',
      '**Al activar**, la respuesta dice la campaña entera: 1.128 × 14 son 15.792 emails, y el siguiente de cada persona llega unos 11 días después del anterior, no a las 24 h.',
      '`ver_limites_envio` y `cambiar_limites_envio` por HTTP.',
    ],
    commits: [{ sha: 'a904ce6e2', msg: 'Email: la rampa del dominio, el freno por rebotes y quejas, y los topes de envío por la API', lineas: 778, archivos: 23 }],
    revisar: '/email',
  },
  {
    fecha: '4 nov', hora: '09:12', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La receta para el Claude del cliente',
    puntos: [
      '**La guía «Una campaña de email con Claude»** en /api-mako › Documentación: el mensaje para pegarle a Claude, con cada paso por su ruta REST, y la sección 5 de la skill del cliente.',
      '⚠️ **Con un token detallado, la respuesta de activar decía sólo «activada»**: se aplica en el acto y vuelve el resumen de ejecutar, no el de la propuesta. Ahora trae el ritmo.',
      'Lo que falta en producción y lo que le toca a Mauricio, en docs/relevo/nube-email.md.',
    ],
    commits: [{ sha: 'e5ff29d89', msg: 'Email: la receta para el Claude del cliente, la respuesta de activar con el ritmo, y el relevo', lineas: 419, archivos: 15 }],
    revisar: '/api-mako?tab=docs&art=campana-email',
  },
];
