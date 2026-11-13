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
  { titulo: 'Cada negocio con su cuenta de Resend', detalle: 'su clave, su dominio y su webhook en su cuenta · la API guía el camino entero (estado_email) · la clave de MaKo sale de la plataforma, no del ws1', estado: 'hecha' },
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
  {
    fecha: '4 nov', hora: '11:25', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La clave que da de alta dominios, aparte de la que manda',
    puntos: [
      'El Cerebro midió que la clave con que MaKo manda es de **sólo envío**: con ella Mauricio no podía conectar su dominio. **No se le subió el permiso**: dar de alta, leer y verificar un dominio usa una clave aparte, de administración, que vive en una variable de Vercel y sólo lee lib/resend-dominios.ts.',
      '**Sin esa clave no se crea nada**: conectar y verificar el dominio dicen que es un problema de MaKo, y `estado_email` lo muestra.',
      '**El tope de dominios del plan se dice como tal**, sin culpar al dominio. ⚠️ La forma de ese error no se midió.',
      'Un negocio con su propia clave de Resend sigue administrando su dominio con la suya.',
    ],
    commits: [{ sha: '6b8aae96b', msg: 'Email: la clave de Resend que administra dominios, aparte de la que manda', lineas: 702, archivos: 9 }],
    revisar: '/email',
  },
  {
    fecha: '4 nov', hora: '12:01', chat: 'Email por la API', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cada negocio trae su cuenta de Resend, y la API lo guía',
    pedido: 'Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako. — todo esto es súper importante que lo pueda hacer por API, es decir, que la API tiene que tener información y, por ejemplo, si detecta que no tiene [Resend] conectado, que le vaya guiando. Eso todo tiene que solucionarse por API siempre para que cualquier usuario lo pueda manejar desde su [Claude]',
    puntos: [
      'Llegó por el Cerebro, en dos mensajes, después del relevo de las 12:01 (la hora es la de ese commit: los mensajes no traen la suya). Gana sobre lo de la mañana: MaKo no aloja dominios de clientes en su cuenta, Mauricio incluido.',
    ],
  },
  {
    fecha: '4 nov', hora: '14:37', chat: 'Email por la API', sesion: SESION, cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cada negocio manda con su cuenta de Resend, y la API guía el camino entero',
    puntos: [
      '**El email de un negocio sale sólo con SU clave de Resend.** Sin ella no sale y dice por qué; nunca cae a la de MaKo. Lo que firma MaKo sale con la de MaKo, desde cualquier negocio.',
      '**Su dominio y su webhook viven en su cuenta**: al conectar el dominio, MaKo crea en su cuenta el aviso que trae las aperturas, los clics y los rebotes, y guarda su secreto. Esos eventos sólo tocan las filas de ese negocio.',
      '**`estado_email` guía**: en qué paso está, qué hacer ahora, qué operación sigue y el link al lugar de MaKo donde se pega la clave (la API no recibe claves). Probado el camino entero sólo con la API, de «sin cuenta» a «listo».',
      '**La clave de correo de MaKo deja de salir de la fila del ws1** (Mauricio podrá pegar la suya). Hasta correr la mudanza, el arranque la sigue tomando del ws1, así los avisos no se cortan.',
    ],
    commits: [{ sha: 'f0589d4db', msg: 'Email: cada negocio manda con SU cuenta de Resend, y la API guía el camino entero', lineas: 1726, archivos: 32 }],
    revisar: '/api-mako?tab=docs&art=campana-email',
  },
  {
    fecha: '10 nov', hora: '19:35', chat: 'Tickets', sesion: 'local_dd6bb6fb-b110-49de-8105-e2755bc74490', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El envío de correos ya no se apaga por una cuenta partida: el freno mira tus últimos 100 correos enviados, desde que prendiste el envío',
    puntos: [
      '**El diagnóstico obvio era el equivocado.** El 10/11 a las 9:01 (Tijuana) el freno apagó el email del ws1 con «3 de 52 (5,8 %)», pero ningún envío estaba mal: Piloto A, 3 de 100 (3 %); Piloto B, 2 de 78 (2,6 %). La ventana de 24 h tenía la COLA del envío de ayer (con 2 de sus 3 rebotes) y los primeros 7 de hoy.',
      '**Ahora cuenta los últimos 100 emails enviados** (de las secuencias y los broadcasts juntos), de 7 días como mucho. Los umbrales no cambian: 50 o más, rebotes de 5 % o quejas de 0,3 %.',
      '**Y arranca cuando una persona prende el envío**: los rebotes que ya lo apagaron no lo vuelven a apagar con el próximo.',
      'Los 22 de Piloto B que quedaron sin salir por el apagado: se le contestó a Mauricio en su grupo con las tres opciones del calendario (el tope de 100 en 24 h no da para los 22 hoy y los 97 de Piloto A mañana a las 9:00). Ticket #78, abierto.',
    ],
    archivos: [
      'lib/email-freno.ts — `conteoDeLosUltimos` y `desdeDelFreno`, puros',
      'lib/email-reputacion.ts — `conteoEmailDelFreno` (antes `conteoEmailUltimas24h`)',
      'lib/api-mako/areas/chatbot.run.ts — `ver_limites_envio` dice la regla nueva y `freno.ultimos_envios`',
      'tests/email-campana-topes.test.ts — 13/13, con los envíos reales del 9 y el 10/11; probado rompiéndolo (2 mutaciones, las 2 rojas)',
    ],
    revisar: '/email',
    tickets: [76],
  },
  {
    fecha: '13 nov', hora: '15:40', chat: 'Tickets Sellers', sesion: 'local_6215cd34-1e87-41f1-83cd-3a8627b1f683', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El freno del email avisa antes y sólo apaga con números peligrosos; los rebotados van a su columna',
    puntos: [
      'Mauricio (#93): el freno le apagó el email de sus dos CRMs con 5 rebotes de los últimos 100. En los últimos 300 había 11 (3,7 %) y en toda la campaña 2,7 %: con 100 de muestra, el 5 % sale por azar.',
      'Ahora mira los últimos 300 (desde 100 enviados). Desde 5 % de rebotes te avisa y el envío sigue; lo apaga recién con 10 % de rebotes o 0,3 % de quejas.',
      'Un correo que rebota lleva al lead a la columna «Rebotado» de su CRM (alcanza con crear una columna con ese nombre) y lo saca de la secuencia sin apagarla.',
      'La clasificación por apertura y clic seguía andando: en «Sprint Ejecución» las columnas se eligieron después de los primeros 33 correos, y el 12/11 a las 21:44 (Tijuana) una conexión por la API devolvió 54 leads a «Nuevo lead».',
    ],
    archivos: [
      'lib/email-freno.ts · lib/email-reputacion.ts — la muestra de 300, el aviso del 5 % y el corte del 10 %',
      'lib/email-eventos-crm-reglas.ts · lib/email-eventos-crm.ts · app/api/webhooks/resend/route.ts — el rebote a «Rebotado»',
      'lib/config-automatizacion.ts · lib/api-mako/areas/chatbot.* — `rebote=<columna>` en columnasEmail',
      'tests/email-freno-93.test.ts · tests/email-campana-topes.test.ts · tests/email-campana-columnas.test.ts',
      'docs/hallazgos-comunicacion.md — las tres causas, medidas',
    ],
    revisar: '/email',
    tickets: [93],
  },
  {
    fecha: '13 nov', hora: '18:30', chat: 'Tickets Sellers', sesion: 'local_6215cd34-1e87-41f1-83cd-3a8627b1f683', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Los leads nuevos tienen lugar en el tope de email, y elegir columnas acomoda lo que ya salió',
    puntos: [
      'El 12/11 la lista fría de Mauricio se gastó 398 de sus 500 emails del día a las 7, y 34 de sus 67 leads nuevos se quedaron sin el suyo.',
      'Ahora una lista fría usa como mucho el 80 % del tope del día: el resto queda para los leads que entraron por un formulario, una landing o una agenda en los últimos 7 días.',
      'Al elegir las columnas del email de una automatización, los leads que ya recibieron emails pasan a la columna de lo que hicieron: les llegó, lo abrieron, hicieron clic o rebotó.',
    ],
    archivos: [
      'lib/nutricion-prioridad.ts · lib/nutricion.ts — la reserva del email para los leads nuevos',
      'lib/email-eventos-crm.ts · lib/email-eventos-crm-reglas.ts · lib/api-mako/areas/chatbot.run.ts — acomodar lo que ya salió',
      'tests/email-prioridad-acomodo-93.test.ts — el motor y el runner de verdad, con los dos escenarios',
      'docs/hallazgos-comunicacion.md',
    ],
    revisar: '/automations',
  },
  {
    fecha: '13 nov', hora: '20:10', chat: 'Tickets Sellers', sesion: 'local_6215cd34-1e87-41f1-83cd-3a8627b1f683', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Con tu propia cuenta de Resend y tu dominio, el email por día llega a 2.000',
    puntos: [
      'Un negocio que manda con su propia cuenta de Resend y su dominio puede subir «Email por día» hasta 2.000. Con la cuenta de la plataforma sigue en 500.',
      'El primer día y cuánto sube por día siguen de 1 a 500 para todos.',
      'Si un día no se puede leer con qué cuenta manda, el tope baja a 500, nunca a lo de fábrica.',
    ],
    archivos: [
      'lib/limites-envio.ts — `rangoDeLimite` y el rango de cada cuenta',
      'lib/limites-envio-cuenta.ts — con qué cuenta manda el negocio',
      'tests/limites-email-cuenta-propia-93.test.ts · tests/email-campana-topes.test.ts — los dos casos, también por la API',
    ],
    revisar: '/automations',
  },
];
