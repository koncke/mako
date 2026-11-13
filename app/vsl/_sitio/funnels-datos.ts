// =============================================================================
// ⚠️ NO SE LLAMA funnels.ts: en Windows ./funnels y ./Funnels son el mismo nombre, y la portada cargaba estos datos en vez del componente.
// Las mini landings por funnel: cómo se arma en MaKo cada uno (13/11/2026)
// =============================================================================
// La llamada de Martín con Leila (13/11/2026): «mini landings por funnel: cómo se hace en MaKo un VSL, un WhatsApp, Instagram con
// lead magnet y YouTube». Lo que ES cada funnel, cuándo sirve y su recorrido salen del catálogo de funnels del Marketing CoPilot
// (docs/marketing-copilot/funnels-simples.md §1 y §2: «Los siete funnels» y «Las dos piezas», armado con los cursos). Cada paso
// dice qué parte de MaKo lo hace, con el link a su landing: sólo funciones que existen (las de la portada y sus landings).
// Los nombres siguen la regla de Martín (10/11/2026): el lead magnet es una PIEZA que se enchufa, no un funnel.
// =============================================================================

export type PasoFunnel = { paso: string; texto: string; enMako: readonly { nombre: string; href: string }[] };
export type FunnelSitio = {
  id: string;
  nombre: string;
  /** El título de su página: «Un funnel de VSL, armado en MaKo». */
  titulo: string;
  bajada: string;
  queEs: string;
  cuando: string;
  recorrido: readonly string[];
  pasos: readonly PasoFunnel[];
  icono: readonly string[];
};

const F = {
  spy: { nombre: 'Competitor Spy', href: '/vsl/competitor-spy' },
  copy: { nombre: 'Copywriting', href: '/vsl/copywriting' },
  avatar: { nombre: 'AI Avatar', href: '/vsl/ai-avatar' },
  video: { nombre: 'Video Editor', href: '/vsl/video' },
  carruseles: { nombre: 'Carruseles', href: '/vsl/image' },
  web: { nombre: 'Web Generator', href: '/vsl/web-generator' },
  copiloto: { nombre: 'Marketing CoPilot', href: '/vsl/ads' },
  crm: { nombre: 'CRM', href: '/vsl/crm' },
  agenda: { nombre: 'Agenda', href: '/vsl/agenda' },
  setter: { nombre: 'Automations', href: '/vsl/seguimiento' },
  chats: { nombre: 'Chats', href: '/vsl/whatsapp' },
  cobranza: { nombre: 'Cobranza', href: '/vsl/cobranza' },
  closing: { nombre: 'Closing', href: '/vsl/closing' },
} as const;

export const FUNNELS_SITIO: readonly FunnelSitio[] = [
  {
    id: 'vsl',
    nombre: 'VSL con llamada',
    titulo: 'Un funnel de VSL, armado en MaKo.',
    bajada: 'El anuncio lleva a una página con un video que explica tu servicio; quien se convence agenda y compra en la llamada.',
    queEs: 'El anuncio lleva a una página con un video que explica el servicio. Quien se convence contesta unas preguntas, agenda y compra en la llamada.',
    cuando: 'Precio alto (desde unos US$3.000), alguien que sepa cerrar por llamada y presupuesto para juntar llamadas.',
    recorrido: ['Anuncio', 'Video', 'Agenda', 'Llamada'],
    pasos: [
      { paso: 'El anuncio', texto: 'Escribes el guion con la estructura de uno que ya funcionó, lo grabas con tu avatar y MaKo mira cada día qué subir, qué pausar y qué probar.', enMako: [F.copy, F.avatar, F.copiloto] },
      { paso: 'La página con tu video', texto: 'Replicas una landing que ya vende con tus textos y tu VSL, conectada a tu CRM: de cada lead ves de dónde vino y cuánto del video miró.', enMako: [F.web, F.crm] },
      { paso: 'La agenda', texto: 'Cada reserva cae en su etapa del CRM, y una automatización confirma la llamada y se la recuerda.', enMako: [F.agenda, F.setter] },
      { paso: 'La llamada', texto: 'Después de cada llamada, MaKo te dice qué mejorar; si compra, el cobro y sus cuotas entran solos.', enMako: [F.closing, F.cobranza] },
    ],
    icono: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
  },
  {
    id: 'whatsapp',
    nombre: 'Anuncios a WhatsApp',
    titulo: 'Un funnel de WhatsApp, armado en MaKo.',
    bajada: 'El anuncio abre un chat y se vende o se agenda conversando, con un setter con IA que contesta por ti.',
    queEs: 'El anuncio abre un chat de WhatsApp, Instagram o Messenger, y se vende o se agenda conversando.',
    cuando: 'Precio medio, decenas de dólares por día y alguien que conteste rápido. Es el más directo para servicios locales y para quien ya vende por chat.',
    recorrido: ['Anuncio', 'Te escriben', 'Charla', 'Pago o llamada'],
    pasos: [
      { paso: 'El anuncio', texto: 'Tu video con tu avatar y un guion que ya funcionó; MaKo mira el anuncio cada día contra lo que vendiste.', enMako: [F.avatar, F.copy, F.copiloto] },
      { paso: 'Te escriben', texto: 'Cada chat entra a una sola bandeja, con su ficha del CRM al lado.', enMako: [F.chats, F.crm] },
      { paso: 'La charla', texto: 'El setter con IA contesta, califica con tus criterios y lleva a agendar; MaKo te propone qué contestar cuando escribes tú.', enMako: [F.setter, F.chats] },
      { paso: 'El pago o la llamada', texto: 'Le mandas el link de pago o agenda su llamada, y cae en su etapa del CRM.', enMako: [F.cobranza, F.agenda] },
    ],
    icono: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  },
  {
    id: 'instagram',
    nombre: 'Instagram con lead magnet',
    titulo: 'Instagram con lead magnet, armado en MaKo.',
    bajada: 'Publicas sin pagar; quien comenta una palabra recibe tu regalo por mensaje, y la charla sigue hasta la venta.',
    queEs: 'Publicas reels, carruseles e historias sin pagar. Quien te sigue comenta una palabra o te escribe, y se vende por mensaje o en una llamada. El lead magnet (una guía, una plantilla, una clase corta) es el regalo que abre la charla.',
    cuando: 'Sin presupuesto para anuncios y con tiempo para publicar seguido. El precio decide cuánto hay que conversar antes de vender.',
    recorrido: ['Contenido', 'Te siguen', 'Palabra clave', 'Regalo', 'Venta'],
    pasos: [
      { paso: 'El contenido', texto: 'Ves lo que mejor le funciona a tu competencia, replicas sus carruseles con tu marca y editas tus reels sin saber editar.', enMako: [F.spy, F.carruseles, F.video] },
      { paso: 'La palabra clave', texto: 'Quien comenta o te escribe recibe un mensaje directo al instante, con la automatización de Instagram.', enMako: [F.setter] },
      { paso: 'El regalo', texto: 'El lead magnet va en ese mensaje: una página tuya hecha con Web Generator, y el contacto entra a tu CRM.', enMako: [F.web, F.crm] },
      { paso: 'La venta', texto: 'La charla sigue en tu bandeja, con el setter con IA, hasta el pago o la llamada.', enMako: [F.chats, F.setter, F.agenda] },
    ],
    icono: ['M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z', 'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M16.5 7.5v.01'],
  },
  {
    id: 'youtube',
    nombre: 'YouTube orgánico',
    titulo: 'Un funnel de YouTube, armado en MaKo.',
    bajada: 'Videos que responden lo que tu cliente busca antes de comprar; quien te conoce da el siguiente paso.',
    queEs: 'Videos que responden lo que tu cliente busca antes de comprar. Quien los mira te conoce y da un paso: anotarse, agendar o comprar.',
    cuando: 'Cuando tu cliente busca el tema en YouTube o en Google y puedes grabar todos los meses. Sirve sobre todo para precios altos: llega gente ya educada.',
    recorrido: ['Video', 'Te conoce', 'Siguiente paso', 'Venta'],
    pasos: [
      { paso: 'El video', texto: 'Ves los videos de YouTube de tu competencia ordenados por vistas, escribes tu guion con la estructura de uno que funcionó y lo editas con el equipo de agentes.', enMako: [F.spy, F.copy, F.video] },
      { paso: 'El siguiente paso', texto: 'El link de la descripción lleva a tu página o a tu agenda, y quien llega entra a tu CRM con su origen.', enMako: [F.web, F.agenda, F.crm] },
      { paso: 'La venta', texto: 'Una automatización lo acompaña hasta la llamada, y después MaKo te dice qué mejorar en cada una.', enMako: [F.setter, F.closing] },
    ],
    icono: ['M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8z', 'M10 9l5 3l-5 3z'],
  },
];

export const funnelPorId = (id: string): FunnelSitio | null => FUNNELS_SITIO.find((f) => f.id === id) ?? null;
export const rutaFunnel = (id: string): string => `/vsl/funnels/${id}`;
