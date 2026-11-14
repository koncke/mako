// =============================================================================
// /vsl/whatsapp — Chats, la bandeja de WhatsApp, Instagram, Messenger y email, con la ESTRUCTURA de la landing de Leadsales
// =============================================================================
// REFERENCIA COPIADA ENTERA, el orden, el storytelling y el DISEÑO (./disenos/whatsapp.tsx, con los valores medidos en
// docs/diseno/landings-competencia/whatsapp.md):
//   https://leadsales.io/  (leída el 11/11/2026 y medida de nuevo el 14/11/2026 con Chromium, a 1440 y 390)
// Su orden, que se respeta aquí: hero «CRM para WhatsApp, Facebook e Instagram» con su galería por pestañas («Así funciona…»,
// la herramienta por partes) → «Tu equipo necesita un CRM…», su tabla de chats sueltos contra Leadsales (una fila por tema)
// → «Del primer mensaje al cierre de cada venta» (4 piezas) → «Todo lo que incluye» → (sus planes) → «Lo que dicen nuestros
// clientes» → «Lo que necesitas saber» (preguntas) → «Tu próximo paso» (el cierre). Por qué ganó:
// docs/competencia/landings-por-funcion.md → «Chats».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus planes con precio no van: ninguna landing de /vsl escribe un precio a mano (el cierre es empezar con MaKo).
//   · Sus clientes (la pared de logos que corre sola), sus medios y Shark Tank son suyos: la prueba de MaKo es el caso de Mauricio.
//   · Su «Lead Agent» que atiende solo es, en MaKo, Automations: en Chats va el borrador de MaKo (te propone, tú mandas) y el
//     puente a /vsl/seguimiento. Sus envíos por la API oficial con plantillas no se prometen.
//   · Su tabla compara TRES temas (una fila cada uno): aquí son tres bloques «contraste» seguidos, uno por fila. El primero
//     lleva el título de la sección y su `etiqueta` es el tema de su fila; los otros dos llevan el tema como título.
//   · Las pestañas de su galería (14/11/2026): cada una es una PANTALLA GRABADA de MaKo (./disenos/whatsapp.tsx →
//     PANTALLA_DE_PESTANA). El título de cada fila es el rótulo de la pestaña y su texto, el pie de la pantalla (como el
//     suyo: «Consulta el historial antes de responder»). Su título «Así funciona el CRM para WhatsApp de Leadsales» está
//     escondido para la vista, como en la suya.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['chats', 'whatsapp', 'email']).
//
// LOS TEXTOS DE LEADSALES, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · el titular «CRM para WhatsApp, Facebook e Instagram», igual (MaKo es eso: Chats + CRM, con Messenger e Instagram);
//   · «Unifica tu bandeja, ordena a tu equipo y multiplica su rendimiento con IA; para que escales tu operación sin escalar
//     el caos» → «…y deja que MaKo le proponga qué contestar…» (el «multiplica su rendimiento» no está medido);
//   · la tabla «Tu equipo necesita un CRM pensado para vender por WhatsApp.», «Cuando todo vive en chats» / «Con MaKo», y
//     sus filas «Campañas y embudo» (→ «Difusión y embudo»: MaKo manda difusiones, lib/difusion.ts), «Equipo y
//     conversaciones» (las dos frases tal cual) y «Lead Agent» (→ «Setter con IA», las Automations; sin «califica al 100%»);
//   · «Del primer mensaje al cierre de cada venta.» / «Las cuatro funciones que cubren el ciclo completo de tu cliente en
//     WhatsApp.», con sus frases «Envía mensajes masivos a tus contactos.», «Da seguimiento a tus vendedores y ordena tu
//     proceso.», «Programa mensajes y no pierdas leads.» (→ «Pospón…»: Chats pospone, no programa) y «Un agente de IA que
//     atiende tus embudos.» (sin «24/7» ni la asignación automática: no están);
//   · «Todo lo que incluye Leadsales, tu CRM para WhatsApp y redes sociales.» (→ MaKo), con «Bandeja unificada»,
//     «Organiza tus chats» y «Personaliza tu atención»;
//   · las preguntas son las de la portada (el registro las pone), y el cierre «Tu próximo paso: organizar las ventas de tu
//     equipo.» (en ./disenos/whatsapp.tsx, sin su prueba de 14 días).
// =============================================================================

import type { LandingCompetencia } from './tipos';

const I = {
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  etapa: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
  enviar: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'],
  email: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'],
  lineas: ['M7 4m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z', 'M11 17h2'],
  estrella: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  clip: ['M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5'],
  nota: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'],
  unir: ['M8 9a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z', 'M16 21a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z', 'M8 9v3a3 3 0 0 0 3 3h2a3 3 0 0 1 3 3'],
};

export const LANDING_WHATSAPP: LandingCompetencia = {
  slug: 'whatsapp',
  nombre: 'Chats',
  icono: I.chat,
  referencia: { nombre: 'Leadsales — CRM para WhatsApp, Facebook e Instagram', url: 'https://leadsales.io/', leida: '2026-11-14' },
  metaTitle: 'MaKo: CRM para WhatsApp, Facebook e Instagram',
  metaDesc: 'Unifica tu bandeja, ordena a tu equipo y deja que MaKo le proponga qué contestar, para que escales tu operación sin escalar el caos. Cada conversación es el lead de tu CRM.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Chats de MaKo',
      titulo: 'CRM para WhatsApp, Facebook e Instagram',
      bajada: 'Unifica tu bandeja, ordena a tu equipo y deja que <strong>MaKo le proponga qué contestar</strong>; para que escales tu operación sin escalar el caos.',
      visual: { tipo: 'detalle', slug: 'whatsapp' },
    },
    {
      // Las pestañas de la galería del hero: el rótulo de cada una y el pie de su pantalla (Leadsales: «Organiza tus leads por
      // etapa y responsable»). La pantalla de cada pestaña es una grabación de la app (PANTALLA_DE_PESTANA del diseño).
      tipo: 'filas',
      titulo: 'Así funciona el CRM de MaKo',
      slug: 'whatsapp',
      items: [
        { titulo: 'Conversaciones', texto: 'De la conversación al cierre, con tu equipo o con MaKo' },
        { titulo: 'Borrador de MaKo', texto: 'MaKo lee la conversación y te propone el mensaje' },
        { titulo: 'Contacto', texto: 'La ficha del CRM, al lado de la conversación' },
        { titulo: 'Embudo', texto: 'Organiza tus leads por etapa y mira lo que hizo cada uno' },
        { titulo: 'Automations', texto: 'Un agente contesta por WhatsApp e Instagram' },
      ],
    },
    {
      tipo: 'contraste',
      etiqueta: 'Difusión y embudo',
      titulo: 'Tu equipo necesita un CRM <em>pensado para vender por WhatsApp.</em>',
      sin: { titulo: 'Cuando todo vive en chats', texto: 'Envías una campaña. Las respuestas se mezclan con el resto de los chats.' },
      con: { titulo: 'Con MaKo', texto: 'Envías una difusión por WhatsApp a una columna de tu CRM y sigues cada respuesta en su conversación, con su etapa.' },
    },
    {
      tipo: 'contraste',
      titulo: 'Equipo y conversaciones',
      sin: { titulo: 'Cuando todo vive en chats', texto: 'Para saber quién atiende cada oportunidad, tienes que preguntarle al equipo.' },
      con: { titulo: 'Con MaKo', texto: 'Asignas cada conversación y consultas su historial, su responsable y su etapa.' },
    },
    {
      tipo: 'contraste',
      titulo: 'Setter con IA',
      sin: { titulo: 'Cuando todo vive en chats', texto: 'Si tu equipo no está, nadie responde. <strong>Y el lead que nadie vio, se enfría.</strong>' },
      con: { titulo: 'Con MaKo', texto: 'Con las <a href="/vsl/seguimiento">Automations</a>, un agente contesta y le da seguimiento a cada lead por los mismos canales.' },
    },
    {
      tipo: 'tarjetas',
      titulo: 'Del primer mensaje <em>al cierre de cada venta.</em>',
      bajada: 'Las cuatro funciones que cubren el ciclo completo de tu cliente en WhatsApp.',
      columnas: 2,
      items: [
        { icono: I.enviar, meta: 'Difusión', titulo: 'Envía mensajes masivos a tus contactos.', texto: 'Mandas una difusión por WhatsApp, email o Instagram a una columna de tu CRM y sigues cada respuesta en tu embudo.' },
        { icono: I.etapa, meta: 'Embudo de ventas', titulo: 'Da seguimiento a tus vendedores y ordena tu proceso.', texto: 'Cada lead tiene etapa y responsable, y le cambias la etapa sin salir del chat.' },
        { icono: I.reloj, meta: 'Seguimiento', titulo: 'Pospón y no pierdas leads.', texto: 'Pospones la conversación que tienes que retomar y cierras lo que ya se resolvió, para que ningún prospecto se quede sin respuesta.' },
        { icono: I.estrella, meta: 'Setter con IA', titulo: 'Un agente de IA que atiende tus embudos.', texto: 'Decides en qué etapas contesta una automatización de MaKo y en cuáles tu equipo. Responde y le da seguimiento a tus prospectos: son las <a href="/vsl/seguimiento">Automations</a>.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Todo lo que incluye MaKo, <em>tu CRM para WhatsApp y redes sociales.</em>',
      items: [
        { icono: I.chat, titulo: 'Bandeja unificada', texto: 'WhatsApp, Messenger, Instagram y email en un solo lugar.' },
        { icono: I.unir, titulo: 'Una conversación por contacto', texto: 'Si te escribió por dos canales, lo ves junto.' },
        { icono: I.persona, titulo: 'Organiza tus chats', texto: 'Asignas, cierras y pospones, y cada uno ve lo que no leyó.' },
        { icono: I.etapa, titulo: 'Personaliza tu atención', texto: 'La ficha del CRM, la etapa y las notas de cada contacto junto al chat.' },
        { icono: I.estrella, titulo: 'El borrador de MaKo', texto: 'Lee la conversación y te propone qué escribir. Tú decides si sale.' },
        { icono: I.nota, titulo: 'Comentarios internos', texto: 'Tu equipo se deja notas dentro de la conversación.' },
        { icono: I.clip, titulo: 'Archivos en el chat', texto: 'Imágenes, videos, audios y documentos.' },
        { icono: I.lineas, titulo: 'Tus números de WhatsApp', texto: 'El oficial y el de empresa, sin salir de Chats.' },
        { icono: I.email, titulo: 'Email con tu dominio', texto: 'Secuencias por etapa y envíos puntuales.' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: 'Lo que necesitas saber <em>para usar MaKo.</em>',
      items: [
        { p: '¿Qué es un CRM para WhatsApp y para quién es MaKo?', r: 'Es una bandeja donde cada conversación de WhatsApp, Instagram, Messenger o email es un lead de tu CRM, con su etapa y su ficha. MaKo es para negocios que venden High Ticket por chat y por llamada.' },
        { p: '¿Sirve si varias personas atienden el mismo WhatsApp?', r: 'Sí. Cada conversación tiene su responsable, tu equipo se deja notas internas y cada uno ve lo que no leyó.' },
        { p: '¿Qué hace MaKo y qué sigue haciendo mi equipo?', r: 'En Chats, MaKo te propone el borrador y lo mandas tú. Para que una conversación avance sola están las <a href="/vsl/seguimiento">Automations</a>, que contestan por los mismos canales.' },
        { p: '¿Necesito WhatsApp Business API?', r: 'No. Conectas tu WhatsApp de empresa o el oficial, cada uno de tus números, y los administras sin salir de Chats.' },
      ],
    },
  ],
};
