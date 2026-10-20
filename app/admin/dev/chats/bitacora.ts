// =============================================================================
// Chats — el registro de construcción de la tab
// =============================================================================
// La tab nace el 14/10/2026: la bandeja unificada de WhatsApp, Instagram y Messenger copiada de respond.io.
// El plano (los contratos entre pantalla, datos y plataforma) es docs/diseno-chats.md; lo que costó, en
// docs/hallazgos-comunicacion.md («Chats: la bandeja unificada»).
//
// ESTO NO ES UN CHANGELOG. Va lo que git no guarda: qué pidió Martín con sus palabras y por qué se resolvió así.
// Las horas de los hitos de implementación son las del trabajo (el commit va al lado cuando existe); la del pedido,
// la del mensaje.
//
// Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La bandeja de respond.io', detalle: 'Bandeja · lista de 3 líneas · ventana del chat · drawer del contacto, con sus tokens', estado: 'sigue' },
  { titulo: 'Un contacto, todos sus canales', detalle: 'WhatsApp de cada línea + Instagram + Messenger en un hilo · el composer elige por dónde', estado: 'sigue' },
  { titulo: 'Estado y no leído en el servidor', detalle: 'Cerrar · reabrir · posponer · leído por persona (mig 0284)', estado: 'sigue' },
  { titulo: 'La tab en el producto', detalle: 'Barra (Operate, antes de WhatsApp) · capas · badge · links profundos · API de MaKo (área chats)', estado: 'hecha' },
  { titulo: 'WhatsApp sale del menú', detalle: 'Cuando Martín valide que Chats lo reemplaza: /whatsapp queda para conectar números', estado: 'cola' },
  { titulo: 'v2', detalle: 'Snippets con «/» · @menciones · bandejas a medida · Chats en el teléfono (/m/chats)', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '14 oct', hora: '—', chat: 'Chats', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Una sola tab para todos los chats',
    pedido: 'Implementar la tab "Chats" algo como "https://respond.io" para tener en UNA sola tab centralizado absolutamente todos los chats, WhatsApp, Instagram, Messenger, etc... Revisa si hay proyectos similares o algun repositorio similar y copialo, sobre todo el diseño que se vea bien',
    puntos: [
      'Una app NOMBRADA se copia tal cual (regla de la casa): el diseño es el de respond.io, medido de su CSS público y de las capturas de su centro de ayuda. Ningún repositorio abierto se le parece; dos de licencia MIT sirven de referencia de código (la lista omnicanal y asignar/cerrar).',
      'El modelo es el de respond.io: una conversación es un CONTACTO, no un canal. En MaKo el contacto es el lead, y su hilo junta su WhatsApp de cada línea con su Instagram y su Messenger.',
    ],
  },
  {
    fecha: '14 oct', hora: '—', chat: 'Chats', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab entra al producto sin sacar a WhatsApp',
    puntos: [
      'En la barra PRIMERO del bloque de conversaciones de Operate, con los roles de WhatsApp (closer y setter). WhatsApp sigue debajo hasta que Martín valide que Chats lo reemplaza: sacarlo antes deja sin QR ni líneas a quien todavía conecta su número ahí.',
      'Capas: va donde va `whatsapp` (no entra en pm ni en superadmin; un test fija la paridad en todas). No había permisos por usuario que listaran `whatsapp`: no hizo falta un alias.',
      'El badge es el MISMO de WhatsApp, y la familia cerrada suma FUENTES y no tabs: con las dos tabs sumando, Operate decía el doble de mensajes. El aviso de mensaje nuevo y los links muertos `/whatsapp?lead=` (abrían el chat de OTRA persona) llevan a /chats.',
      'API de MaKo, área `chats`: leer la bandeja y un hilo, cerrar, reabrir y posponer con «sí». Nada sale por HTTP (conversaciones de personas) y nada manda un mensaje: para eso está el borrador de WhatsApp, y asignar ya es `asignar_closer_setter`.',
    ],
    archivos: [
      'app/_components/nav.ts', 'lib/capas.ts', 'app/_components/Sidebar.tsx', 'app/_components/NotificationsProvider.tsx',
      'lib/chats-links.ts', 'app/crm/[id]/resumen/page.tsx', 'lib/mako-doer-in.ts',
      'lib/api-mako/areas/chats.def.ts', 'lib/api-mako/areas/chats.run.ts', 'lib/mako-intencion.ts', 'tests/chats-registro.test.ts',
    ],
  },
  {
    fecha: '17 oct', hora: '06:20', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'Email y WhatsApp se unifican en Chats',
    pedido: "Quiero también eliminar las tabs de \"Email y WhatsApp\" y unificarlo todo en \"Chats\", y que por favor te asegures de que todo funcione bien...",
    puntos: ['Llegó por el Cerebro con la sidebar nueva: el jefe «Sidebar» lleva la unificación.'],
  },
  {
    fecha: '17 oct', hora: '10:50', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Chats es la única tab de conversaciones, y el email es un canal más',
    puntos: [
      'WhatsApp y Email salen de la barra. Sus páginas siguen (conectar números; dominio, secuencias y envíos) y se entra desde Chats: el «+» de Canales y el pie de la Bandeja.',
      'El email entra a la bandeja: lo que llega (con su cuerpo y sus adjuntos) y lo que se contesta, en el hilo del cliente de correo y con el remitente del negocio. Con lead, en la misma conversación que su WhatsApp e Instagram.',
      'Para que llegue un email hace falta prender «Receiving» en Resend y el MX del dominio del negocio.',
    ],
    archivos: ['lib/chats-email.ts', 'lib/chats-email-reglas.ts', 'app/api/chats/email/route.ts', 'supabase/migrations/0312_email_mensajes.sql', 'app/chats/Composer.tsx', 'tests/chats-email.test.ts'],
    revisar: '/chats',
  },
  {
    fecha: '20 oct', hora: '18:35', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'Leila: «Ese número no tiene WhatsApp» en la ficha del lead',
    pedido: 'Otro error que Leila me envía',
    puntos: [
      'Con una captura: en la ficha del lead #2313 (ws11), «WhatsApp no oficial» → «Ese número no tiene WhatsApp». Llegó por el Cerebro; la regla de Martín de ese día es avisar al grupo del cliente cuando esté arreglado.',
    ],
  },
  {
    fecha: '20 oct', hora: '18:50', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: el teléfono sin código de país se completa en el envío, con el país de la línea (⚠️ REVISAR: toca envíos a clientes)',
    revisar: '/crm/2313/resumen?ws=11',
    puntos: [
      '⚠️ **El diagnóstico obvio (WhatsApp desconectado, o el número mal cargado) era el equivocado:** el número estaba cargado como lo cargó el cliente, en 10 dígitos, y `enviarTexto` sólo sacaba lo que no es dígito. Evolution contesta `exists:false` si no lleva el país (medido el 21/08: 542233550684 existe, 2233550684 no). No es un caso suelto: **53 de los 70 leads del ws11** están así, y **27 de los 32 borradores pendientes** (los recordatorios de la sesión de mañana) habrían fallado igual al aprobarlos.',
      'Los datos del cliente NO se tocan: `numeroParaWhatsApp` (lib/numero-whatsapp.ts, puro) completa el número al ENVIAR con el país de la LÍNEA que manda (el dueño de la instancia, `evolution_instancias.numero`). 10 dígitos en México, Argentina, Colombia, Venezuela y EE.UU./Canadá; 9 en España, Chile y Perú. Lo que ya trae país (52, 521, 54, 1) no se toca, y el «00» del principio se saca.',
      '**Sin línea conocida no se adivina:** la de MaKo no guarda su número, y un número de un país que no está en la tabla tampoco; con 10 dígitos el error dice «A este número le falta el código de país». Si igual no existe, el modal dice «Ese número no tiene WhatsApp. Revisa que tenga el código de país.»',
      'Pasa por los cuatro caminos que le dan un número a Evolution: texto, media, audio (con eso, el camino de los borradores) y la consulta del @lid. **No** toca los envíos de la línea de MaKo a grupos y destinatarios (lib/mako-grupo.ts, lib/mako-tarjeta.ts): esos números salen del selector con país.',
      'Medido con los datos reales del ws11 (sólo lectura, sin imprimir un número): los 70 leads quedan en 52+10 (60), 521+10 (9) y 54 (1); de los 32 borradores, 31 quedan bien y 1 es un borrador de nutrición sin lead con 12 ceros, que no se puede mandar nunca (alguien tiene que descartarlo).',
      '**Sin hacer:** el espejo del saliente guarda el teléfono tal cual lo cargó el cliente (10 dígitos) y el `chat_jid` con el número completo; si la bandeja une el hilo con el lead por el teléfono, hay que mirarlo con un envío real. Brasil (largo 10 u 11) y el resto de los países no están en la tabla: su 10 dígitos da el error.',
    ],
    archivos: [
      'lib/numero-whatsapp.ts — `numeroParaWhatsApp`, `codigoDePaisDeLinea`, `motivoConPista` (puro)',
      'lib/evolution.ts — `lineaDeEnvio` devuelve el número de la línea; enviarTexto, enviarMedia, enviarAudio y fetchLidDeNumero lo usan',
      'tests/numero-whatsapp.test.ts — 8 tests, 16 roturas con su fallo',
      'tests/evolution-motivo.test.ts — acepta el motivo con la pista',
    ],
  },
];
