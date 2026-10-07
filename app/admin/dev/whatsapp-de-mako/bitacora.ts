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
  { titulo: 'Soltar las líneas viejas', detalle: 'Las dos líneas con tu número que fueron de MaKo siguen vinculadas y el webhook las ignora · ocupan dispositivos de tu WhatsApp', estado: 'cola' },
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
];
