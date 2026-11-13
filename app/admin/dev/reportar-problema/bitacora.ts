// =============================================================================
// Ticketera — el registro de construcción del área (los tickets que levantan los usuarios)
// =============================================================================
// Alcance: el cliente levanta un ticket al equipo de MaKo (desde el chat de MaKo o en «Reportar problema»), el triage
// decide si es un bug evidente que se arregla solo o algo que decide Martín, la decisión va firmada al Cerebro, y el
// ticket se cierra solo cuando el arreglo está en producción. El diseño: docs/diseno-ticketera-usuarios.md; lo que
// costó: docs/hallazgos-ticketera.md.
//
// NO es un changelog: va el pedido textual, la trampa y lo que quedó sin hacer.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Ticketera';
const SESION = 'local_03731046-a5b3-418b-a947-6b4c6b294ce9';

export const PARTES: Parte[] = [
  { titulo: 'El ticket y su historial', detalle: 'Mig 0311: quién lo levantó (foto de su rol y su plan), el contexto que junta el sistema, el triage con su porqué; RLS y revoke', estado: 'hecha' },
  { titulo: 'Levantarlo desde el chat de MaKo', detalle: 'MaKo propone la tarjeta cuando algo falló (lo detecta el código) o cuando piden algo que la app no tiene (el modelo); la persona toca un botón', estado: 'hecha' },
  { titulo: '«Reportar problema» del cliente', detalle: 'Un campo, tres opciones y «Tus tickets» con la conversación (Intercom + el «Mis solicitudes» de Zendesk)', estado: 'hecha' },
  { titulo: 'La bandeja de Martín', detalle: 'Linear Triage adentro de Ops Center: de quién, el reporte, el porqué del triage y Aprobar · Rechazar · Duplicado · Preguntar · Responder', estado: 'hecha' },
  { titulo: 'El bug automático llega solo al Cerebro', detalle: 'El Runner (cartero 1.15.0) le escribe un texto fijo con el número; falta que el Cerebro lo reinstale en la PC', estado: 'hecha' },
  { titulo: 'Los errores de la app llegan solos', detalle: 'Navegador, servidor y chats de MaKo, agrupados por huella (mig 0313): cada error nuevo es un bug que va solo al Cerebro', estado: 'hecha' },
  { titulo: 'El aviso de arreglado al grupo del negocio', detalle: 'Con `avisarArregloAlGrupo` de «MaKo en WhatsApp», firmado «Desarrollador», y sólo con la prueba del deploy que trae el arreglo', estado: 'hecha' },
  { titulo: 'Un negocio sin IA no es un bug', detalle: 'No abre ticket: MaKo le pide que conecte la suya con el modal ahí mismo, y /integraciones dice cuál es suya de verdad', estado: 'hecha' },
  { titulo: 'La bandeja en el teléfono', detalle: 'Hoy la Ticketera del teléfono sigue siendo el mazo de las preguntas de los chats', estado: 'cola' },
  { titulo: 'Levantarlo por WhatsApp', detalle: 'La operación ya está en el registro; enchufarla al doer de WhatsApp es del chat «MaKo en WhatsApp»', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '17 oct', hora: '03:46', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'La Ticketera pasa a ser la de los tickets de los usuarios, end-to-end',
    pedido: 'La ticketera desde ahora será exclusiva para los tickets levantados por los usuarios. Implementa end-to-end la ticketera para los usuarios, copia el diseño y la funcionalidad de alguna muy conocida... Y obvio el ticket me tiene que llegar con el reporte de a quién pertenece... con cada decisión que yo tome debería mandarse al cerebro y que decida si abre un nuevo chat o se lo envía a algún jefe... un bug evidente que debería funcionar bien debe solucionarse automáticamente, pero si alguien pide implementar algo nuevo, eso sí depende de mi decisión... Para el usuario debe ser fácil levantar un ticket... Tal vez en los mismos chats de MaKo... Y que MaKo le proponga levantarlo si detecta que intentó algo y falló, o si pidió algo que todavía no está en la app.',
    puntos: [
      'Lo repartió el Cerebro a un jefe nuevo, «Ticketera», con la migración 0311 y la regla de no pushear: la punta va al Cerebro con `antes-de-subir` en VERDE.',
    ],
  },
  {
    fecha: '17 oct', hora: '05:45', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los clientes levantan tickets desde el chat de MaKo, y te llegan con el reporte de quién es',
    revisar: '/admin/operaciones?ticketera=tickets',
    puntos: [
      '**Se copió de quién lo resolvió**: el lado del cliente, de Intercom (el ticket nace de la conversación; cinco estados en sus palabras); la bandeja, de Linear Triage; el arreglo automático, del método de Sentry Seer y de la lista de lo que GitHub no le da a su agente. Sentry, Sweep y AutoCodeRover tienen licencias que no dejan copiar: no entró ni una línea, sólo el método.',
      '**El triage no paga ningún modelo, y es una decisión**: el error lo registró el código al fallar, el tipo lo propuso MaKo con la IA que ya leía esa conversación, y las palabras se leen con reglas. El juicio caro («¿es de verdad un bug?») lo hace el Cerebro antes de tocar código, y si no lo es lo devuelve (`scripts/tickets.ts reclasificar`).',
      '**Se arregla solo** sólo lo que el sistema VIO fallar o «antes andaba y dejó de andar», sin señales de pedido y fuera de cobros, accesos, borrados y envíos. Lo demás espera a Martín con el porqué escrito, que se corrige en un clic. Hay interruptor y un tope de 8 por día.',
      '**El cierre lo dice el deploy, no un commit**: quien arregla anota `tickets: [n]` en el hito de su bitácora, y cuando el build lo trae el cron cierra el ticket y le avisa al cliente por donde lo levantó (su chat, un push, o el grupo de WhatsApp).',
      '⚠️ **Lo que falta**: enchufar la entrega del bug automático en el cartero (Ops Center), la bandeja en el teléfono y el canal de WhatsApp (chat «MaKo en WhatsApp»).',
    ],
    archivos: [
      'lib/tickets-reglas.ts: el triage, el contexto, lo que ve el cliente y el pedido al Cerebro',
      'lib/tickets-db.ts: la base, con el corte por inquilino adentro',
      'lib/api-mako/areas/tickets.def.ts: levantar_ticket y mis_tickets',
      'app/tickets/bandeja/BandejaTickets.tsx: la bandeja de Martín',
      'lib/tickets-cierre.ts y app/api/cron/tickets: el cierre y el aviso',
      'scripts/tickets.ts: lo que usa el Cerebro',
    ],
  },
  {
    fecha: '17 oct', hora: '08:40', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Un bug evidente le llega solo al Cerebro, sin esperar a Martín',
    revisar: '/admin/operaciones?ticketera=tickets',
    puntos: [
      'El Runner (cartero **1.15.0**) le escribe al chat «Cerebro» un texto FIJO con el número del ticket: ni una palabra del cliente viaja sin firma. El Cerebro lo lee con `scripts/tickets.ts ver`.',
      '⚠️ **`hayParaElCartero` cuenta los tickets sólo para un Runner que los entiende**: el Runner pregunta cada pocos segundos si hay algo, y contar lo que nunca le va a llegar lo hacía salir en cada vuelta.',
      'Por WhatsApp, quien levanta el ticket es su teléfono: se le atribuye a la persona del negocio con ese número en su perfil. El enchufe en el doer es del chat «MaKo en WhatsApp».',
    ],
  },
  {
    fecha: '17 oct', hora: '09:36', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'Detectar errores en toda la app y arreglarlos solos',
    pedido: 'lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app: MaKo en los chats de la app, errores al navegar o lo que sea. Y todo lo solucionas automáticamente',
    puntos: ['Lo pasó el Cerebro a la Ticketera: es el ciclo del bug, extendido a toda la app, con la migración 0313.'],
  },
  {
    fecha: '17 oct', hora: '10:30', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los errores de la app llegan solos y se arreglan sin esperar a Martín',
    revisar: '/admin/operaciones?ticketera=tickets',
    puntos: [
      'Llegan de cuatro lados: una pantalla que se rompe (el boundary), un error suelto de la ventana, el servidor (`onRequestError`) y lo que falla de MaKo en un chat. Antes la pantalla rota no le avisaba a nadie.',
      '**Un error es una HUELLA, no una fila por vez** (como Sentry): mil personas con el mismo error son un ticket. La huella no lleva el stack, que cambia en cada deploy.',
      'Cada huella nueva es un bug del sistema que el triage manda solo al Cerebro; si vuelve a pasar después de arreglado, es una regresión y abre otro.',
      'Sin datos de clientes: se borran emails, teléfonos y lo citado. Y lo que no es de MaKo (el proveedor de IA caído, la red, una extensión) no abre nada.',
      '⚠️ El aviso al grupo del negocio cuando está arreglado espera a `avisar_arreglo_al_grupo` de «MaKo en WhatsApp».',
    ],
  },
  {
    fecha: '17 oct', hora: '11:30', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Al cliente le llega en su grupo que el error ya está arreglado',
    revisar: '/admin/operaciones?ticketera=tickets',
    puntos: [
      'Con `avisarArregloAlGrupo` de «MaKo en WhatsApp» (firmado «Desarrollador de MaKo», uno por arreglo y por negocio). Es una función y no una operación del registro: nadie más puede firmar como el equipo.',
      '**Sólo con prueba**: el build que corre trae el hito con el número del ticket (su commit y su url). Un ticket del sistema que Martín sólo contestó no avisa nada.',
      'Los títulos de los errores, en palabras del cliente: «La pantalla «CRM» se rompió», «MaKo no pudo «Mover un lead de etapa»», en vez de la ruta.',
    ],
  },
  {
    fecha: '18 oct', hora: '01:45', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Un negocio sin IA conectada ya no abre un ticket: MaKo le pide que conecte la suya',
    revisar: '/integraciones',
    puntos: [
      'Por los tickets #5 y #6 de Mauricio: MaKo no le contestaba en el chat de la app porque su negocio no tiene una IA propia. No era un bug, y la Ticketera lo había mandado a arreglar.',
      'Ahora no abre ticket, y en el chat MaKo dice «Para contestarte necesito una IA conectada» con un botón «Conectar tu IA» que abre el modal ahí mismo, sin salir de la pantalla.',
      '/integraciones dice «Conectada» sólo si MaKo la puede usar como del negocio. En el ws1 decía «Conectada» en las siete IA y no le servía ninguna; una copia de la de MaKo ahora lo dice.',
      '⚠️ **En el ws1 conectar su IA no alcanza**: lo que guarde en su fila pasa a ser la key con la que corre la plataforma. Por eso ahí MaKo dice «Ya lo está resolviendo el equipo de MaKo», sin botón, y sus IA en /integraciones dicen «La configura el equipo de MaKo», sin formulario. Separarlo es una decisión que el Cerebro lleva a Martín (docs/hallazgos-integraciones.md).',
    ],
  },
  {
    fecha: '18 oct', hora: '09:30', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Mauricio ya puede conectar su propia IA: las de la plataforma salen de la plataforma',
    revisar: '/integraciones',
    puntos: [
      'Lo decidió Martín: «separá el ws1 de las claves de la plataforma… para que Mauricio pueda conectar su propia IA». Hasta hoy la fila del ws1 era la que la plataforma usaba como propia, así que lo que él pegara pasaba a ser de MaKo.',
      'Ahora las keys de IA de la plataforma salen del workspace de la plataforma. El ws1 es un negocio más: ve el botón «Conectar tu IA» y lo que pegue es suyo. Las copias de MaKo que quedan en su fila siguen diciendo «Esa key es la de MaKo».',
      'Antes del deploy se copiaron a la plataforma las keys de IA que estaban sólo en la fila del ws1, para que la plataforma no pierda ninguna. No se borró nada del ws1.',
      '⚠️ Lo que no es IA (Meta, Calendly, Fathom…) y las configuraciones de la plataforma siguen en el ws1: es otra decisión, y está en el relevo del área.',
    ],
  },
  {
    fecha: '20 oct', hora: '18:30', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Un negocio con sólo su Claude ya tiene MaKo en el chat, y no le piden Gemini',
    revisar: '/second-brain',
    puntos: [
      'Lo encontró la investigación del Ops Center: un negocio que conectó sólo su Claude no tenía respuesta en el chat, y «Conectar tu IA» le abría Gemini.',
      'Ahora, si ninguna IA gratis le contesta, el chat usa su Claude (el modelo barato, lo paga su cuenta). Probado en vivo con la clave propia de un negocio: pidió la herramienta y contestó.',
      '«Conectar tu IA» abre la IA que el negocio ya tiene cargada (su Claude primero); sólo sin ninguna ofrece Gemini.',
    ],
  },
  {
    fecha: '20 oct', hora: '23:30', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'El Ops Center pasa a ser lo principal de MaKo',
    pedido: 'comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo... quiero que en Ops Center se pueda hacer todo',
    puntos: ['Lo repartió el Cerebro por áreas (docs/ops-center-principal.md). A la Ticketera le tocaron la 1.6 (nunca una key en el chat) y la 1.17 (la IA del cliente).'],
  },
  {
    fecha: '21 oct', hora: '02:00', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Una clave pegada en el chat ya no queda guardada ni le llega a la IA',
    revisar: '/second-brain',
    puntos: [
      'Si alguien pega una clave (de Claude, de OpenAI, de Google, de Stripe…) en el chat, MaKo la tapa antes de guardarla y antes de pensar: en la conversación queda «[clave tapada]».',
      'Le contesta «Tapé tu clave» con el botón para pegarla donde va, en la conexión de ese servicio, sin salir de la pantalla.',
      'Un email, un teléfono o un monto no se tapan: en el chat del negocio son su trabajo.',
    ],
  },
  {
    fecha: '21 oct', hora: '01:28', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'Las cuentas de Claude y GPT de los clientes, al 100%',
    pedido: 'Ya le respondí a Debate todo sobre la implementación de las cuentas de Claude y GPT para los clientes. Quiero que este al 100% eso, que puedan conectarlo, que haya un tutorial, que este 100% funcional',
    puntos: ['Y a las 01:30: «No hagas más preguntas e implementalo al 100%». El mapa: docs/ia-del-cliente.md.'],
  },
  {
    fecha: '21 oct', hora: '02:10', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'El Ops Center de un cliente ya puede contestar con SU Claude, desde su computadora',
    puntos: [
      'El cliente conecta su computadora con un código de 6 letras, y deja corriendo «MaKo en tu computadora». Su Ops Center contesta con su Claude, con su cuenta: MaKo nunca toma su login.',
      'La computadora sólo piensa: Claude corre sin terminal ni archivos, y las herramientas de MaKo corren en MaKo, con las mismas tarjetas para confirmar.',
      'Probado de punta a punta en esta computadora con el cliente de prueba: contestó con las herramientas de MaKo, y «agrega un lead» quedó en la ficha para confirmar.',
      'Si su computadora está apagada, el chat le pide que la prenda. Con su Claude o su GPT, su chat ya no usa las IA gratis.',
      '⚠️ Falta la ola 2: «Tus cuentas de IA», el tutorial y el instalador para Windows y Mac. Hoy se corre con un comando.',
    ],
  },
  {
    fecha: '21 oct', hora: '03:00', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Conectar tu Claude ya tiene su tutorial: cuatro pasos y una línea para pegar',
    revisar: '/integraciones',
    puntos: [
      'En Integraciones, arriba, «Tus cuentas de IA»: cada computadora conectada, si está en línea, y cada cuenta de Claude con su plan y cuánto usó de las 5 horas y de la semana.',
      '«Conectar mi computadora» abre el tutorial, un paso por pantalla, para Windows y Mac: instalar Claude, iniciar sesión y pegar UNA línea que instala MaKo, lo conecta y lo deja arrancando solo.',
      'Se pueden sumar varias cuentas de Claude en la misma computadora, y usa la que tenga más cupo. El modelo (Sonnet, Opus o Haiku) lo elige el admin.',
      'Probado de punta a punta en Windows: se instaló, se conectó y contestó. La Mac no se probó.',
    ],
  },
  {
    fecha: '21 oct', hora: '07:00', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Tu Claude en tu computadora: arranca solo de verdad, no se apaga por un bache y no le manda nada a Gemini',
    revisar: '/perfil/ia',
    puntos: [
      'Windows ya no muestra una alerta de virus al instalar MaKo: arranca solo al prender la computadora, sin ventanas.',
      'Antes de conectarse, MaKo te dice a qué negocio y como quién, y te pregunta si es el tuyo.',
      'Si tu Claude no tiene la sesión iniciada, el tutorial no dice «¡Listo!»: te lleva a iniciarla. Y si llegaste al tope de 5 horas, el chat te dice a qué hora se repone, y vuelve a andar solo.',
      'Si tu computadora se apaga a mitad de una respuesta, el chat te avisa en menos de un minuto y medio, no a los 4 minutos (y prueba con tu clave de Claude, si la tienes).',
      'Con tu propio Claude, nada de tu negocio va a Gemini ni a una IA gratis: tampoco El Archivero, las fotos ni las notas de voz.',
      '«Tus cuentas de IA» está ahora en Tu cuenta, para todo el equipo, y también en el teléfono.',
      '⚠️ La Mac sigue sin probarse en una Mac.',
    ],
  },
  {
    fecha: '21 oct', hora: '17:30', chat: CH, sesion: SESION, cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: tu Claude en tu computadora, con todo lo que pidieron las tres revisiones, en producción',
    revisar: '/perfil/ia',
    puntos: [
      'Al instalar, MaKo pregunta si es tu negocio ANTES de tocar lo que ya andaba: si dices que no, tu computadora sigue como estaba. Y si cierras la ventana mientras inicias sesión en Claude, MaKo igual queda prendido.',
      'Reinstalar sobre una computadora que anda ya no deja ni un segundo a tu negocio sin su propio Claude.',
      'Con tu propio Claude, ni las tarjetas que confirmas, ni «Buscar con MaKo», ni El Archivero, ni el AI Analyst programado mandan algo a Gemini o a una IA gratis.',
      'Una clave de MaKo copiada en tu negocio ya no cuenta como «tu IA»: Buscar y El Archivero te siguen andando.',
      'El tutorial te dice si el código se usó sin conectar y te da otro; si falta Claude Code, te lleva al paso 2.',
      '⚠️ Falta que Martín suba los programas 0.3.2: hasta entonces, una instalación nueva dice «No pude preparar la descarga». La Mac sigue sin probarse en una Mac.',
    ],
  },
  {
    fecha: '2 nov', hora: '17:14', chat: 'Ticketera', cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Que quien levanta un ticket vea cómo avanza, y le llegue por email',
    pedido: 'que cuando él levante un ticket… le diga, mira el progreso de tu ticket aquí, y que él pueda ir viendo: tu ticket fue levantado, el equipo lo revisó, ya lo están desarrollando. Y también… que se le envíe por email los avances. Y solamente cuando ya esté 100 % finalizado, ahí sí el mensaje de WhatsApp que ya tenemos',
    puntos: ['Joan lo había preguntado por WhatsApp: «¿cómo van esos tickets?». La hora es la del commit que anotó la regla (dbc64bdd7): el pedido llegó por otro chat.'],
  },
  {
    fecha: '4 nov', hora: '04:05', chat: 'Tickets en la nube', sesion: 'cli_c395d4ca-9c38-5214-ae30-582fa23cf9c4', cuenta: 'nube', actor: 'martin', tipo: 'prompt',
    titulo: 'Un chat que resuelva todos los tickets, y los emails de los tickets',
    pedido: 'Manda a un chat a solucionar todos los tickets siempre. … los emails de los tickets',
    puntos: ['Llegó por el Cerebro: este chat de la nube recibe cada ticket nuevo y lo arregla con su hito.'],
  },
  {
    fecha: '4 nov', hora: '04:05', chat: 'Tickets en la nube', sesion: 'cli_c395d4ca-9c38-5214-ae30-582fa23cf9c4', cuenta: 'nube', actor: 'claude', tipo: 'implementacion',
    titulo: 'Ya está: quien levanta un ticket recibe un correo en cada avance',
    revisar: '/tickets',
    puntos: [
      'Un correo cuando lo recibimos, otro cuando el equipo lo está desarrollando, otro si necesitamos un dato suyo y otro cuando está resuelto. Cada uno con el link a su ticket.',
      'Nunca dos por el mismo paso: si el ticket va y vuelve, no repite. El cierre sigue avisándose por WhatsApp y el chat, como antes.',
      'Cada correo trae «darme de baja». Abrir el link no apaga nada: hay que tocar el botón, y desde ahí se vuelven a prender.',
      'No les llega a los tickets que abre MaKo solo, a los de la plataforma, a una persona de otro negocio ni a una cuenta suspendida.',
      '⚠️ No medido en producción: que Resend entregue (la nube no ve la base). La primera vuelta del cron lo dice en su registro: «correos de avance N».',
    ],
    archivos: [
      'lib/tickets-avance.ts: a quién, cuándo y la vuelta (puro, con test)',
      'lib/tickets-avance-email.ts: la base y Resend',
      'app/api/email/unsubscribe/tickets/route.ts: la baja',
      'app/api/cron/tickets/route.ts: el paso 4',
    ],
  },
  {
    fecha: '5 nov', hora: '15:34', chat: 'Código Inmobiliario (nube)', sesion: 'cli_aa3bfb4c-b5ce-5e9f-81a3-d1391ea8aa8a', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los tickets de quien administra una agencia suben de prioridad, detrás de un cliente con algo roto',
    puntos: [
      '**Sube un escalón:** baja a media, media a alta. Nunca a urgente, que sigue saliendo de «no puedo trabajar».',
      '**No le quita el lugar a un cliente con algo roto:** en el mazo va detrás de los de su prioridad que llegaron ahí solos.',
      'Lo de un tercero o lo que abrió MaKo solo no sube. Vale para los tickets nuevos; la prioridad se sigue cambiando a mano.',
    ],
    archivos: [
      'lib/tickets-reglas.ts — subirPorAgencia y el triage',
      'lib/tickets-db.ts — quién administra una agencia',
      'app/tickets/bandeja/mazo-reglas.ts — el orden del mazo',
      'tests/tickets-agencia.test.ts',
    ],
    revisar: '/tickets',
  },
  {
    fecha: '12 nov', hora: '22:55', chat: 'Tickets Sellers', sesion: 'local_6215cd34-1e87-41f1-83cd-3a8627b1f683', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La ficha de cada ticket dice el plan que paga el negocio (Esencial o Pro), no la capa',
    puntos: [
      'El #89 llegó con «plan Completo» y se leyó como un plan completo con tope de 1 usuario. Completo es la capa, y esa capa es MaKo Esencial.',
      'Ahora dice «Esencial» o «Pro» cuando el negocio paga su plan (por la pasarela o por su agencia), y «sin cobro de MaKo, sin topes» cuando no paga ninguno, como el ws1.',
      'Vale para los tickets nuevos: el plan se guarda al levantarlo.',
    ],
    archivos: [
      'lib/tickets-reglas.ts — `planDeLaFicha`',
      'lib/tickets-db.ts — `planDelNegocio`, en la app y por WhatsApp',
      'tests/ficha-ticket-plan.test.ts',
      'docs/hallazgos-ticketera.md',
    ],
    revisar: '/tickets/bandeja',
  },
  {
    fecha: '13 nov', hora: '16:45', chat: 'Tickets Sellers', sesion: 'local_6215cd34-1e87-41f1-83cd-3a8627b1f683', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un ticket al que le falta un paso en producción ya no se cierra con el deploy ni le dice «Ya anda» al cliente',
    puntos: [
      '**El #93 de Mauricio (13/11):** el hito «Hecho» con `tickets: [93]` cerró el ticket al desplegar (18:45 UTC) y a las 18:46 le dijo «Arreglamos… Ya anda». Faltaba prender su email, el tope y las columnas en producción, con el sí de Martín: le llegó «ya anda» con el email apagado.',
      '**Ahora el hito puede decir qué falta** (`faltaEnProduccion`). Con eso el deploy no cierra ni avisa: deja una vez en el historial qué falta, y `scripts/tickets.ts pendientes` lo lista. Quien hace el paso lo marca con `paso-hecho <n> --nota "…"` después de verlo andar, y el cron siguiente cierra y avisa.',
      '**Sin poder leer el historial, no cierra:** un «ya anda» falso no se deshace; esperar 15 minutos más, sí.',
    ],
    archivos: [
      'app/admin/dev/_registro/tipos.ts — `faltaEnProduccion` en el hito',
      'lib/tickets-reglas.ts — `ticketsDeHitos` lleva `falta` · `loCierraElDeploy` · los dos renglones del historial',
      'lib/tickets-cierre.ts — `cerrarLosDesplegados` y `pasosEnProduccion`',
      'scripts/tickets.ts — `paso-hecho` y la lista en `pendientes`',
      'tests/tickets-falta-en-produccion.test.ts — el cierre real (tests/_tickets-falta-en-produccion-hijo.ts); probado rompiéndolo',
      'AGENTS.md — la regla · docs/hallazgos-ticketera.md',
    ],
    revisar: '/tickets/bandeja',
  },
];
