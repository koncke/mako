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
  { titulo: 'Pasar MaKo al número nuevo', detalle: 'Espera el QR del número nuevo · sumarlo a los grupos lo ve cada cliente', estado: 'cola' },
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
];
