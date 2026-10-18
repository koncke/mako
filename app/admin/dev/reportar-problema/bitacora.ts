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
];
