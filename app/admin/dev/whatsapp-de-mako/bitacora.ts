// =============================================================================
// WhatsApp de MaKo — el registro de construcción del área
// =============================================================================
// Alcance: los WhatsApp del super admin en /agencia. La línea de MaKo (la voz: desde ahí
// habla en los grupos y salen los avisos) y, desde el 07/10/2026, TU número, como línea de
// tu propio negocio. No es el /whatsapp de un cliente.
// Vive en: app/agencia/CanalMaKoPanel.tsx, app/api/admin/mako-canal/route.ts,
// lib/mako-canal.ts, lib/mako-chat.ts, lib/participantes-grupo.ts.
//
// NO es un changelog: va el motivo, la trampa y el pedido textual. Lo largo, en
// docs/hallazgos-comunicacion.md → «Cambiar el número de MaKo».

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La línea de MaKo por QR', detalle: 'Se conecta en /agencia y se fija como voz sola · si Evolution la deja trabada, rota a una línea nueva', estado: 'hecha' },
  { titulo: 'Cambiar el número sin dejarla muda', detalle: 'El número nuevo se vincula AL LADO, queda admin en cada grupo (comprobado releyéndolo) y recién ahí MaKo se muda', estado: 'hecha' },
  { titulo: 'Tu número, como línea de tu negocio', detalle: 'Tu WhatsApp personal para atender clientes: se ve en /whatsapp y «Sale por» lo puede elegir', estado: 'hecha' },
  { titulo: 'Pasar MaKo al número nuevo', detalle: 'El número nuevo ya está vinculado · la primera pasada dio 0 de 6 (Evolution le borraba el 9) · falta volver a vincular tu número, o sumarlo desde el teléfono, y reintentar', estado: 'sigue' },
  { titulo: 'MaKo por tu número, con un botón', detalle: 'Con el …2605 baneado (3 nov), la voz pasa a tu línea sin escanear nada, y se apaga desde este panel · sólo habla en los grupos donde ya estás', estado: 'hecha' },
  { titulo: 'Soltar las líneas viejas', detalle: 'Las dos líneas con tu número que fueron de MaKo siguen vinculadas y el webhook las ignora · ocupan dispositivos de tu WhatsApp', estado: 'cola' },
  { titulo: 'Si se cae una línea, avisa la otra', detalle: 'Se miran las líneas cada 3 minutos · un mensaje por caída y otro al volver, por la que sigue viva · si caen todas, o hay una sola, por mail · falta probarlo con una caída real', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Un número nuevo para MaKo, y el personal para los clientes',
    pedido: 'Tengo un nuevo número que va a ser el número de MaKo, quiero:\n1. Ya poder vincular 2 números mediante QR en SuperAdmin, así mantengo mi número personal, donde atenderé a los clientes ya cerrados, y el número de MaKo es para el resto.\n2. Quiero que los grupos de WhatsApp actuales y futuros sean con el nuevo número de MaKo ¿Cómo hacemos el cambio?',
    puntos: [
      '**Medido antes de escribir:** la voz y el canal de MaKo eran el número PERSONAL de Martín, que es admin en los 7 grupos guardados. O sea que hasta ese día todo lo que «decía MaKo» salía de su teléfono.',
      'El negocio del super admin no tenía ninguna línea: «atender a los clientes cerrados» desde la app no tenía por dónde salir.',
    ],
  },
  {
    fecha: '7 oct', hora: '13:13', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Dos números en el super admin, y cambiar el de MaKo sin dejarla muda',
    puntos: [
      '**Vincular al lado, mudarse cuando quedó lista.** El número nuevo se reserva en `mako.canal.pendiente` y se escanea sin tocar la línea que habla; el webhook no la escucha hasta que es la vigente, así que el doer no contesta dos veces. «Pasar MaKo a este número» lo deja admin en cada grupo con la voz actual, lo comprueba releyendo el grupo y recién ahí muda canal y voz. Los grupos FUTUROS salen solos: se crean con la voz.',
      '⚠️ **El diagnóstico obvio del camino viejo era «MaKo muda un rato», y era peor.** Desconectar devolvía la voz a `mako_ws1`, la línea de Mauricio: MaKo pasaba a hablar en todos los grupos con el WhatsApp de un CLIENTE, y la reconexión le pedía a esa línea sumar números a los grupos de los demás. Se sacó «dejar de usar»: sin línea, MaKo queda muda, que el vigilante avisa.',
      '⚠️ **Cuarto lugar con el 200-con-el-fallo-adentro de Evolution.** Sumar a un grupo devolvía `{ ok: r != null }` y el detalle de un grupo decía «Número agregado ✓» sobre un número que no entró. El lector por participante se mudó a `lib/participantes-grupo.ts` (sin `server-only`) y lo comparten las dos puntas.',
      '**Admin, no sólo participante.** La rotación sumaba la línea nueva sin admin: hablaba, pero no podía sumar al dueño de un cliente ni renombrar el grupo.',
      '**Tu número va a TU negocio con `wsSuperAdmin()` explícito**: el panel vive en /agencia y el parche de fetch le pega el `?ws=` de la pestaña — con el de la pestaña, tu número personal podía quedar en el negocio de un cliente.',
    ],
    commits: [
      { sha: '3226b3f7', msg: 'WhatsApp de MaKo: dos números en el super admin, y cambiar el de MaKo sin dejarla muda', lineas: 1049, archivos: 12 },
    ],
    archivos: [
      'lib/mako-canal.ts — la línea pendiente, la mudanza (`pasarMaKoANumeroNuevo`) y tu número',
      'lib/mako-chat.ts — `sumarComoAdmin`: sumar, hacer admin y comprobarlo releyendo el grupo',
      'lib/participantes-grupo.ts — qué contestó WhatsApp por cada participante, y si quedó admin',
      'app/agencia/CanalMaKoPanel.tsx — los dos bloques del panel: MaKo y Tu número',
      'tests/mako-numero-nuevo.test.ts — 8 tests, probados con diez roturas',
    ],
  },
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La primera mudanza dijo «0 de 6»',
    pedido: 'Soluciona esto',
    puntos: [
      'Con una captura del panel: «Quedó admin en 0 de 6 grupos» y «No quedó adentro del grupo» en los seis.',
    ],
  },
  {
    fecha: '7 oct', hora: '18:26', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Evolution le borraba el 9 al número nuevo, y el 403 se leía como éxito',
    puntos: [
      '⚠️ **El diagnóstico obvio era el equivocado.** Parecía que la relectura no veía al número por los `@lid` de WhatsApp; no: el número nunca entró. Evolution 2.3.7 le saca el tercer dígito a todo número de 13 que empiece con 52 o 54 (`549…` → `54…`), WhatsApp contestó 403 sobre ESE otro número, y el lector, que buscaba la forma exacta, lo contó como éxito — así que tampoco corrió el plan B.',
      '**Un número que dio WhatsApp viaja como jid completo** (`jidCanonico`), que Evolution no toca. Mismo arreglo en el alta y la invitación del dueño de un cliente, que pasaban por el mismo filtro. Quedó como regla en AGENTS.md.',
      '**La línea vieja se desvinculó a mitad de camino** (`device_removed` a las 21:15 UTC, lo que WhatsApp manda al quitar el dispositivo desde el teléfono) y la otra con el mismo número está zombi. Con la voz muerta la mudanza ya no corta: comprueba cada grupo con la línea nueva y dice cuáles faltan.',
    ],
    commits: [
      { sha: 'd7f3e253', msg: 'Mudanza de MaKo: Evolution le borraba el 9 al número nuevo, y el 403 se leía como éxito', lineas: 193, archivos: 5 },
    ],
    archivos: [
      'lib/participantes-grupo.ts — `jidCanonico` y el lector que reconoce las dos formas del número',
      'lib/mako-chat.ts — `sumarComoAdmin` con el jid completo, y comprobando con la línea nueva si la vieja no contesta',
    ],
  },
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las notificaciones, al correo de MaKo',
    pedido: 'También tienes que hacer que todas las notificaciones me lleguen al email nuevo de MaKo, porque me llegaron al email de martinkoncke@gmail.com',
    puntos: [
      'Preguntado: el email es equipo@hola-mako.com, y su Gmail deja de recibirlas.',
    ],
  },
  {
    fecha: '7 oct', hora: '20:21', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La alarma de la línea tenía un Gmail escrito a mano',
    puntos: [
      '**Lo que le llegó**, medido en Resend: las dos alarmas de esa noche —«no puede hablar» y «volvió»—, con el destinatario escrito a mano en `EMAILS_ALERTA_VOZ`. Ahora es `EMAIL_MAKO`, la misma constante que firma, y el negocio del super admin tiene ese correo como destino de sus avisos.',
      '⚠️ **Antes de mandar la alarma ahí se comprobó que la casilla recibe**: mandar desde el dominio no prueba recibir, y nunca se le había mandado nada. Un mail de prueba quedó `delivered`.',
    ],
    commits: [
      { sha: 'c78a4551', msg: 'Las notificaciones del super admin van al correo de MaKo, no al Gmail personal de Martín', lineas: 21, archivos: 2 },
    ],
    archivos: [
      'lib/canal-vigilante.ts — `EMAILS_ALERTA_VOZ = [EMAIL_MAKO]`',
    ],
  },
  {
    fecha: '3 nov', hora: '—', chat: 'Línea de MaKo', sesion: 'local_6d962fa2-6fff-4783-b032-d5e0c04560c1', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Se desconectó la línea de MaKo',
    pedido: 'veo que MaKo la linea principal se desconecto, seria bueno evitar que eso pase... Encontrar la forma de evitarlo.. Y si llega a pasar tengo mi linea secundaria para avisarme a mi mismo',
    puntos: [
      'Después, con el teléfono abierto: «Esta cuenta ya no puede usar WhatsApp Business», por spam. Y: «No entiendo porque me banearon, por los grupos? Si justamente son grupos con clientes».',
    ],
  },
  {
    fecha: '3 nov', hora: '17:39', chat: 'Línea de MaKo', sesion: 'local_6d962fa2-6fff-4783-b032-d5e0c04560c1', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'WhatsApp baneó la línea: si se cae una, avisa la otra',
    puntos: [
      '⚠️ **No fue la RAM, ni el volumen, ni el automático de la agencia que se acababa de desplegar.** El último alta fue 9 s antes del 403, y salió de una persona guardando Notificaciones. WhatsApp no dice por qué banea: es lo más cercano, no una causa probada.',
      '**Un 403 no se reconecta ni se evita.** Evolution reintenta solo todo lo demás. Lo que se puede es enterarse en minutos, una vez, con el link: las dos líneas se miran cada 3 minutos, y por mail si caen las dos.',
      '**La vigilancia no mueve la voz:** sólo avisa, un mensaje por caída. Y por pedido de Martín la voz ya está en su número: con una sola línea no se avisa a sí misma, va por mail, y el link lleva a esa línea, no a escanear el número baneado. Falta probarlo con una caída real.',
    ],
    commits: [
      { sha: '406fed299', msg: 'Si se cae una línea de WhatsApp de Martín avisa la otra, un mensaje por caída, y por mail si caen las dos', lineas: 1132, archivos: 11 },
    ],
    archivos: [
      'lib/lineas-de-mako.ts — qué se avisa y por dónde, puro y con test',
      'lib/lineas-de-mako-vigilante.ts · app/api/cron/vigia-lineas-mako — la vigilancia con la red enchufada, cada 3 minutos',
      'docs/hallazgos-comunicacion.md — lo medido del ban y los costos de la API oficial',
    ],
  },
  {
    fecha: '3 nov', hora: '17:30', chat: 'Cerebro', cuenta: 'claude5', sesion: 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8',
    actor: 'martin', tipo: 'prompt',
    titulo: 'WhatsApp baneó el …2605: MaKo pasa a tu número, con un botón para apagarlo',
    pedido: 'por ahora que siga toda la comunicación por mi otro WhatsApp. Es decir, que mi otro WhatsApp pueda crear los grupos, etcétera... de última yo en SuperAdmin con un botoncito o algo deshabilitar',
    puntos: [
      '**Sin QR:** la línea de su negocio ya estaba vinculada. Se le abren los grupos y la voz apunta a ella; el canal no se toca, porque «Desconectar» borra la línea del canal.',
      '⚠️ **Sólo donde ya está:** admin en 6 grupos. En los 8 que creó el …2605, WhatsApp contesta `forbidden` y nadie más puede sumarlo.',
      '⚠️ **El eco:** en la voz, todo `fromMe` era MaKo, así que el dueño hablándole desde su teléfono se tiraba. Con una línea de negocio decide el anillo.',
    ],
    archivos: [
      'lib/mako-canal.ts — `usarNumeroPersonalComoVoz`',
      'lib/doer-para-quien.ts — `vozPropiaDeMaKo`',
    ],
  },
  {
    fecha: '3 nov', hora: '20:20', chat: 'Tickets de clientes', sesion: 'local_d010fa87-9186-469e-83de-d431a71f64d8', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo entiende qué mensaje citas y busca en lo que se habló antes en el grupo',
    puntos: [
      'Si le contestas a un mensaje anterior citándolo, MaKo sabe de cuál hablas, aunque sea de hace días.',
      'Puede buscar en los mensajes anteriores de tu grupo: «¿qué te dije del precio la semana pasada?». Busca sólo en ese grupo.',
      'Guarda lo que le hablaron a MaKo: la charla entre ustedes puede no estar, y te lo dice si no lo encuentra.',
      '**Cómo se prueba:** en tu grupo, cita un mensaje viejo y pregúntale algo sobre él.',
    ],
    archivos: [
      'lib/doer-equipo.ts — `bloqueDeLaCita` y `conElTextoCitado`',
      'lib/mako-doer-conv.ts — `textoPorIdDeWhatsApp` y `buscarEnElGrupo`',
      'lib/api-mako/areas/mako.def.ts · mako.run.ts — buscar_en_el_grupo',
      'tests/cita-y-busqueda-en-el-grupo.test.ts — 8 roturas, cada una cae',
    ],
    tickets: [40],
  },
  {
    fecha: '4 nov', hora: '—', chat: 'WhatsApp sin ban (nube)', sesion: 'cli_9e4287f8-a741-5483-aea2-368f75752652', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que no nos vuelvan a banear',
    pedido: 'Ya nos desbanearon la cuenta de whatsapp, implementa medidas para que no nos baneen, por ejemplo, en el onboarding, en lugar de nosotros enviarle un codigo de seguridad, pedirles que ellos nos envien un mensaje primero y ahí enviarles su codigo... O algo así, revisa todo.',
    puntos: ['Con la línea desbaneada el 4/11. Que el código lo manden ellos, y revisar cada envío de las líneas.'],
  },
  {
    fecha: '4 nov', hora: '04:31', chat: 'WhatsApp sin ban (nube)', sesion: 'cli_9e4287f8-a741-5483-aea2-368f75752652', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo ya no le escribe primero a nadie, y si WhatsApp avisa, la línea frena sola',
    puntos: [
      '**El onboarding:** en vez de mandarte un código, MaKo te da un botón «Abrir WhatsApp» con el mensaje escrito. Lo mandas y la conversación sigue sola.',
      '**Nada a un número que nunca escribió:** ni el código, ni la invitación al grupo por mensaje, ni las tareas de una reunión.',
      '**Si WhatsApp avisa que una línea manda demasiado o la restringe**, esa línea frena sola un rato y llega un mail. Vale también para las líneas de los clientes.',
      '**Topes nuevos:** 10 altas en grupos por día por línea, y el mismo texto a no más de 5 grupos por hora.',
      '**Cómo se prueba:** en el negocio de prueba (ws 3), hacer el onboarding y mandar el mensaje desde el teléfono. Falta probarlo con WhatsApp de verdad.',
    ],
    archivos: [
      'lib/mako-salida-reglas.ts — las reglas de lo que no sale, puras',
      'lib/verificacion-entrante.ts — el código que manda la persona',
      'lib/linea-freno.ts — el freno de todas las líneas',
      'tests/whatsapp-anti-ban.test.ts — 24, probado rompiéndolo',
      'docs/hallazgos-comunicacion.md — la tabla de cada envío y qué dice Meta',
    ],
  },
  {
    fecha: '10 nov', hora: '21:08', chat: 'Ops Center (nube)', sesion: 'cli_b4bb6cd6-f68b-5162-ae59-96d6e5078bd4', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'MaKo en WhatsApp siempre tiene que responder',
    pedido: 'Mako en WhatsApp no responde... SIEMPRE debe responder, haz un relevo de eso para que no ocurra más',
    puntos: [
      'Se lo escribió al Cerebro desde el teléfono, y no salió: la PC estaba dormida desde las 08:56. Me lo pasó con «Solucionalo».',
    ],
  },
  {
    fecha: '10 nov', hora: '21:31', chat: 'Ops Center (nube)', sesion: 'cli_b4bb6cd6-f68b-5162-ae59-96d6e5078bd4', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo contesta en su grupo aunque WhatsApp haya frenado la línea, y la respuesta que no llega abre un ticket',
    puntos: [
      '**Contestar siempre sale:** si WhatsApp rechaza UN mensaje (un grupo del que sacaron a MaKo), la línea se frenaba 6 horas y MaKo no le contestaba a nadie. Ahora la respuesta en el grupo donde alguien acaba de escribir sale igual; los avisos y lo automático siguen frenados.',
      '**El mismo aviso a muchos grupos** no frena una respuesta: durante una caída de la IA, el sexto grupo quedaba sin contestar.',
      '**Lo que WhatsApp no toma deja un ticket** con el motivo, en vez de guardarse como dicho sin que nadie se entere.',
      '**Un diagnóstico de las seis causas** de «no responde», para correr en la PC: la línea caída o sorda, el freno, MaKo apagado, la cola y lo que no se contestó.',
      '**Cómo se prueba:** después del despliegue, escribirle a MaKo en tu grupo. Si no contesta, correr el diagnóstico (docs/relevo/nube-mako-wa-responde.md).',
    ],
    archivos: [
      'lib/respuesta-en-curso.ts — el grupo al que se le está contestando',
      'lib/mako-salida-reglas.ts — `esRespuestaEnCurso`, `respuestaNoEntregada`, `motivoDeNoEntrega`',
      'lib/linea-freno.ts · lib/mako-grupo.ts · lib/mako-doer-in.ts — el cableado',
      'scripts/diagnostico-mako-whatsapp.mts — sólo lee',
      'tests/mako-responde-siempre.test.ts — 12, catorce roturas, cada una cae',
    ],
  },
  {
    fecha: '13 nov', hora: '15:51', chat: 'MaKo en WhatsApp: no callarse cuando le hablan', sesion: 'local_11c0bf11-9013-4748-80fc-b29ff97f77f6', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La voz de MaKo vuelve a recibir, y la alarma de «no recibe» ya no se confunde con tus grupos personales',
    puntos: [
      '**La voz recibe:** desde las 14:12 la voz es el …2605 (la volviste a poner desde /chats). A las 15:23 le escribiste en el grupo de SuperAdmin: el mensaje le entró al instante y MaKo lo leyó en el mismo minuto.',
      '**La alarma de las 15:20 era falsa:** decía que «otra línea vio 6 mensajes que la voz no tiene», y los 6 eran de 3 grupos tuyos donde MaKo no está. Ahora esa regla cuenta sólo los grupos de MaKo. No hace falta volver a vincular el …2605: la marca se cierra sola con el despliegue.',
      '**Cómo se prueba:** escribirle a MaKo en un grupo de MaKo y ver que conteste. Si llega el aviso «La voz de MaKo no recibe mensajes», el motivo ya no puede ser un grupo tuyo.',
    ],
    archivos: [
      'lib/linea-sorda.ts — `ajenosQueLaVozNoVio`: lo que la otra línea vio, sólo en los grupos de MaKo',
      'lib/canal-vigilante.ts — lee los grupos de MaKo; si no puede, esa regla no cuenta',
      'tests/linea-sorda.test.ts — 4 y 6, con lo que pasó a las 15:20; cinco roturas, cada una cae',
    ],
  },
];
