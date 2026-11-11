// =============================================================================
// /vsl/whatsapp — Chats, la bandeja de WhatsApp, Instagram y Messenger, con la ESTRUCTURA de la landing de Leadsales
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones y el storytelling; la cara es la de /vsl):
//   https://leadsales.io/  (leída el 11/11/2026 con Chromium)
// Su orden, que se respeta acá: hero «CRM para WhatsApp, Facebook e Instagram» → «Así funciona…», la herramienta por
// partes → «Ventas en chats sueltos» contra «con Leadsales» → «Del primer mensaje al cierre de cada venta» (4 piezas) →
// «Todo lo que incluye» → (sus planes) → «Lo que dicen nuestros clientes» → «Lo que necesitas saber» (preguntas) →
// «Tu próximo paso» (el cierre). Por qué ganó: docs/competencia/landings-por-funcion.md → «Chats».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus planes con precio no van: ninguna landing de /vsl escribe un precio a mano (el cierre es la llamada).
//   · Sus clientes, sus medios y Shark Tank son suyos: la prueba de MaKo es el caso de Mauricio.
//   · Su «Lead Agent» que atiende solo es, en MaKo, Automations: acá va el borrador de MaKo (te propone, tú mandas) y el
//     puente a /vsl/seguimiento. Sus envíos masivos por la API oficial no se prometen.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['chats', 'whatsapp', 'email']); los gráficos, de la landing anterior.
// =============================================================================

import type { LandingCompetencia } from './tipos';

const I = {
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  etapa: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
  campana: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
  email: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'],
  lineas: ['M7 4m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z', 'M11 17h2'],
  estrella: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
};

export const LANDING_WHATSAPP: LandingCompetencia = {
  slug: 'whatsapp',
  nombre: 'Chats',
  icono: I.chat,
  referencia: { nombre: 'Leadsales — CRM para WhatsApp, Facebook e Instagram', url: 'https://leadsales.io/', leida: '2026-11-11' },
  metaTitle: 'Chats de MaKo: WhatsApp, Instagram y Messenger en una bandeja, con tu CRM',
  metaDesc: 'Una conversación por contacto con todos sus canales y su ficha del CRM al lado. Asignas, cambias la etapa, dejas notas internas y MaKo te propone qué contestar.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Chats para vender por WhatsApp, Instagram y Messenger',
      titulo: 'Todos tus chats de venta en una bandeja. Cada uno, con su lead.',
      bajada: 'Tu WhatsApp, Instagram, Messenger y email en <strong>una conversación por contacto</strong>, con su ficha del CRM al lado. Ordenas a tu equipo y MaKo te propone qué contestar, sin salir del chat.',
      puntos: ['Cada contacto es el lead de tu CRM, con todos sus canales', 'Cada uno de tus números de WhatsApp, en la misma bandeja'],
      visual: { tipo: 'detalle', slug: 'whatsapp' },
    },
    {
      tipo: 'filas',
      titulo: 'Así funciona Chats',
      slug: 'whatsapp',
      items: [
        { grafico: 0, titulo: 'Una bandeja con todos tus canales', texto: 'WhatsApp, Instagram, Messenger y email en una sola tab, con <strong>una conversación por contacto</strong>. Si te escribió por dos lados, lo ves junto y eliges por cuál contestar.' },
        { grafico: 2, titulo: 'MaKo te propone qué contestar', texto: 'El borrador de MaKo lee la conversación y te propone el mensaje. Lo cambias si quieres y lo mandas tú.' },
        { grafico: 4, titulo: 'El chat y el embudo, juntos', texto: 'El contacto es el lead de tu CRM: le cambias la etapa, lo asignas o lo cierras desde la misma conversación.' },
      ],
    },
    {
      tipo: 'contraste',
      etiqueta: 'Tu equipo necesita vender por chat con orden',
      titulo: 'Vender por chats sueltos sale caro',
      sin: {
        titulo: 'Ventas en chats sueltos',
        texto: 'Cada vendedor contesta desde su teléfono, Instagram queda por un lado y WhatsApp por otro. Nadie sabe quién le contestó a quién, en qué etapa está el lead ni qué se le prometió. <strong>Y el lead que nadie vio, se enfría.</strong>',
      },
      con: {
        titulo: 'Con Chats de MaKo',
        texto: 'Una bandeja con todos los canales, donde cada conversación es el lead de tu CRM: con su etapa, su responsable y las notas internas de tu equipo. Ves lo que no se leyó y a quién le toca.',
      },
      cta: true,
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Del primer mensaje al cierre de cada venta',
      columnas: 2,
      items: [
        { icono: I.persona, titulo: 'Asigna y deja notas internas', texto: 'Cada conversación tiene su responsable, y tu equipo se deja comentarios que el lead no ve.' },
        { icono: I.etapa, titulo: 'Cambia la etapa sin salir del chat', texto: 'Lo que pasa en la conversación lo pasas al embudo en un toque.' },
        { icono: I.reloj, titulo: 'Cierra o pospone', texto: 'Cierras lo que ya se resolvió y pospones lo que tienes que retomar después.' },
        { icono: I.campana, titulo: 'Lo no leído, por persona', texto: 'Cada uno ve lo que le falta leer a él, guardado en el servidor: no depende de en qué teléfono lo abrió.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Todo lo que incluye Chats',
      items: [
        { icono: I.lineas, titulo: 'Tus números de WhatsApp', texto: 'Los conectas y los administras sin salir de Chats, y cada número aparece en la misma bandeja.' },
        { icono: I.chat, titulo: 'Instagram y Messenger', texto: 'Los mensajes directos llegan a la misma conversación del contacto.' },
        { icono: I.email, titulo: 'Email con tu dominio', texto: 'Secuencias por etapa y envíos puntuales, desde tu propio dominio.' },
        { icono: I.estrella, titulo: 'El borrador de MaKo', texto: 'Lee la conversación y te propone qué escribir. Tú decides si sale.' },
        { icono: I.persona, titulo: 'Tu equipo, ordenado', texto: 'Responsables, comentarios internos y lo no leído de cada uno.' },
        { icono: I.etapa, titulo: 'Conectado a tu CRM', texto: 'El contacto es el lead: la etapa, la ficha y su historia, en el mismo lugar.' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: 'Lo que necesitas saber para usar Chats',
      items: [
        { p: '¿Qué canales junta?', r: 'WhatsApp (cada uno de tus números), Instagram, Messenger y email, en una conversación por contacto.' },
        { p: '¿Cómo conecto mi WhatsApp?', r: 'Lo conectas y lo administras desde Chats, sin salir de la pantalla.' },
        { p: '¿MaKo contesta solo?', r: 'En Chats, MaKo te propone el borrador y lo mandas tú. Para que una conversación avance sola están las <a href="/vsl/seguimiento">Automations</a>, que contestan por los mismos canales.' },
        { p: '¿Tiene respuestas rápidas y menciones?', r: 'Todavía no: las bandejas a medida, las respuestas rápidas con «/» y las @menciones no están.' },
        { p: '¿Hace llamadas de voz?', r: 'No. Chats es para mensajes: WhatsApp, Instagram, Messenger y email.' },
      ],
    },
  ],
};
