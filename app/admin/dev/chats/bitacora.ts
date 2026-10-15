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
];
