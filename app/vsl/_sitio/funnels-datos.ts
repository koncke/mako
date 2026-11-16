// =============================================================================
// ⚠️ NO SE LLAMA funnels.ts: en Windows ./funnels y ./Funnels son el mismo nombre, y la portada cargaba estos datos en vez del componente.
// Las mini landings por funnel: cómo se arma en MaKo cada uno (13/11/2026)
// =============================================================================
// La llamada de Martín con Leila (13/11/2026): «mini landings por funnel: cómo se hace en MaKo un VSL, un WhatsApp, Instagram con
// lead magnet y YouTube». Lo que ES cada funnel, cuándo sirve y su recorrido salen del catálogo de funnels del Marketing CoPilot
// (docs/marketing-copilot/funnels-simples.md §1 y §2: «Los siete funnels» y «Las dos piezas», armado con los cursos). Cada paso
// dice qué parte de MaKo lo hace, con el link a su landing: sólo funciones que existen (las de la portada y sus landings).
// Los nombres siguen la regla de Martín (10/11/2026): el lead magnet es una PIEZA que se enchufa, no un funnel.
// Los tres que faltaban de los siete del catálogo (16/11/2026): anuncios con formulario, venta directa (el «Carrito» que Martín
// renombró ese día) y newsletter, con el mismo molde. Cada paso lleva al menos UNA pieza con grabación (./Funnels.tsx, GRABACION):
// sin ella, su fila queda con la columna del video vacía. Lo que NO se promete: la pestaña Newsletters (sigue en PRONTO,
// app/newsletters/puerta.ts); el newsletter de hoy se arma con Email (la bienvenida y cada envío, desde el dominio del negocio).
//
// LO QUE ES DE MaKo Pro LO DICE EL PASO (16/11/2026; docs/relevo/brief-landings.md: «se dice Con MaKo Pro»): el setter con IA, replicar
// una landing o los carruseles de otro, el equipo de agentes del editor y «MaKo te dice qué mejorar» (Closing). Va entre paréntesis
// PEGADO a esa promesa, porque cada paso mezcla lo de Pro con lo que tienen los dos planes, y SALE DEL PLAN: `soloProEntre`
// (FUNCIONES_SOLO_PRO) y AVISO_PRO_CLOSING_ENTRE (TABS_SOLO_PRO). El avatar NO lo lleva: está cerrado en Essential pero todavía no se
// vende (FUNCIONES_TODAVIA_NO_VENDIDAS, lib/planes-comparacion.ts), y decirlo sería empezar a venderlo. Lo mide
// tests/vsl-landings-dicen-el-plan.test.ts.
// =============================================================================

import { soloProEntre } from '../_competencia/solo-pro';
import { AVISO_PRO_CLOSING_ENTRE } from '../_competencia/closing';

export type PasoFunnel = { paso: string; texto: string; enMako: readonly { nombre: string; href: string }[] };
export type FunnelSitio = {
  id: string;
  nombre: string;
  /** El título de su página: «Un funnel de VSL, armado en MaKo». */
  titulo: string;
  bajada: string;
  /** Lo que dice debajo de su nombre en el menú Industrias: un renglón. */
  corta: string;
  /** El título del cierre de su landing, arriba del botón. */
  cierre: string;
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
  email: { nombre: 'Email', href: '/vsl/email' },
} as const;

export const FUNNELS_SITIO: readonly FunnelSitio[] = [
  {
    id: 'vsl',
    nombre: 'VSL con llamada',
    titulo: 'Tu funnel de VSL con llamada, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de VSL con llamada.',
    bajada: 'El anuncio lleva a una página con un video que explica tu servicio; quien se convence agenda y compra en la llamada.',
    corta: 'Anuncio, video, agenda y llamada de venta.',
    queEs: 'El anuncio lleva a una página con un video que explica el servicio. Quien se convence contesta unas preguntas, agenda y compra en la llamada.',
    cuando: 'Precio alto (desde unos US$3.000), alguien que sepa cerrar por llamada y presupuesto para conseguir llamadas.',
    recorrido: ['Anuncio', 'Video', 'Agenda', 'Llamada'],
    pasos: [
      { paso: 'El anuncio', texto: 'Escribes el guion con la estructura de uno que ya funcionó, lo grabas con tu avatar y MaKo mira cada día qué subir, qué pausar y qué probar.', enMako: [F.copy, F.avatar, F.copiloto] },
      { paso: 'La página con tu video', texto: `Replicas una landing que ya vende con tus textos y tu VSL${soloProEntre('replicar-landing')}, conectada a tu CRM: de cada lead ves de dónde vino y cuánto del video miró.`, enMako: [F.web, F.crm] },
      { paso: 'La agenda', texto: 'Cada reserva cae en su etapa del CRM, y una automatización confirma la llamada y se la recuerda.', enMako: [F.agenda, F.setter] },
      { paso: 'La llamada', texto: `Después de cada llamada, MaKo te dice qué mejorar${AVISO_PRO_CLOSING_ENTRE}; si compra, el cobro y sus cuotas entran solos.`, enMako: [F.closing, F.cobranza] },
    ],
    icono: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
  },
  {
    id: 'whatsapp',
    nombre: 'Anuncios a WhatsApp',
    titulo: 'Tu funnel de anuncios a WhatsApp, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de WhatsApp.',
    bajada: `El anuncio abre un chat y se vende o se agenda conversando, con un setter con IA${soloProEntre('setter-ia')} que contesta por ti.`,
    corta: 'El anuncio abre un chat y se vende conversando.',
    queEs: 'El anuncio abre un chat de WhatsApp, Instagram o Messenger, y se vende o se agenda conversando.',
    cuando: 'Precio medio, decenas de dólares por día y alguien que conteste rápido. Es el más directo para servicios locales y para quien ya vende por chat.',
    recorrido: ['Anuncio', 'Te escriben', 'Charla', 'Pago o llamada'],
    pasos: [
      { paso: 'El anuncio', texto: 'Tu video con tu avatar y un guion que ya funcionó; MaKo mira el anuncio cada día contra lo que vendiste.', enMako: [F.avatar, F.copy, F.copiloto] },
      { paso: 'Te escriben', texto: 'Cada chat entra a una sola bandeja, con su ficha del CRM al lado.', enMako: [F.chats, F.crm] },
      { paso: 'La charla', texto: `El setter con IA${soloProEntre('setter-ia')} contesta, califica con tus criterios y lleva a agendar; MaKo te propone qué contestar cuando escribes tú.`, enMako: [F.setter, F.chats] },
      { paso: 'El pago o la llamada', texto: 'Le mandas el link de pago o agenda su llamada, y cae en su etapa del CRM.', enMako: [F.cobranza, F.agenda] },
    ],
    icono: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  },
  {
    id: 'formulario',
    nombre: 'Anuncios con formulario',
    titulo: 'Tu funnel de anuncios con formulario, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de formulario.',
    bajada: 'El anuncio pide los datos; cada contacto cae en tu CRM y una automatización le escribe antes de que se enfríe.',
    corta: 'Deja sus datos y lo contactas al instante.',
    queEs: 'La persona deja sus datos en un formulario de Meta o en tu página, y la contactas para venderle en una llamada o una visita.',
    cuando: 'Cuando alguien de tu negocio llama o escribe a cada contacto, y la venta se cierra en una llamada o una visita. Inmobiliarias, servicios profesionales y equipos de venta.',
    recorrido: ['Anuncio', 'Formulario', 'Contacto', 'Venta'],
    pasos: [
      { paso: 'El anuncio', texto: 'Ves los anuncios que más le duran a tu competencia, escribes el tuyo con la estructura de uno que ya funcionó y MaKo mira cada día qué pausar y qué probar.', enMako: [F.spy, F.copy, F.copiloto] },
      { paso: 'El formulario', texto: 'El de Meta o el de tu página hecha con Web Generator: cada contacto cae en tu CRM con el anuncio del que vino.', enMako: [F.crm, F.web] },
      { paso: 'El contacto', texto: `Apenas deja sus datos, una automatización le escribe por WhatsApp y el setter con IA${soloProEntre('setter-ia')} lo califica y lo lleva a agendar.`, enMako: [F.setter, F.chats] },
      { paso: 'La venta', texto: `Vendes en la llamada; después, MaKo te dice qué mejorar${AVISO_PRO_CLOSING_ENTRE}, y el cobro y sus cuotas entran solos.`, enMako: [F.agenda, F.closing, F.cobranza] },
    ],
    icono: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z', 'M9 12h6', 'M9 16h6'],
  },
  {
    id: 'venta-directa',
    nombre: 'Venta directa',
    titulo: 'Tu funnel de venta directa, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de venta directa.',
    bajada: 'El anuncio lleva a la página de tu producto y se paga ahí, sin llamada. A quien compra le llega la oferta que sigue.',
    corta: 'El anuncio lleva a pagar, sin llamada.',
    queEs: 'El anuncio lleva a la página de tu producto y se paga ahí, sin hablar con nadie. Después de la compra, le ofreces lo que sigue.',
    cuando: 'Precios bajos (hasta unos US$50 a 100 para quien no te conoce) y un margen que aguante lo que cuesta el anuncio. Tiendas y productos digitales.',
    recorrido: ['Anuncio', 'Página', 'Pago', 'Otra compra'],
    pasos: [
      { paso: 'El anuncio', texto: 'Tu carrusel o tu video con tu avatar, con un guion que ya funcionó; MaKo mira cada día qué anuncio vende y cuál pausar.', enMako: [F.carruseles, F.avatar, F.copiloto] },
      { paso: 'La página', texto: `Replicas una página de venta que ya funciona${soloProEntre('replicar-landing')}, con tus textos y el botón de pago de tu producto.`, enMako: [F.web, F.cobranza] },
      { paso: 'El pago', texto: 'Paga con tu Stripe o tu Mercado Pago, y el cobro entra solo a su ficha del CRM.', enMako: [F.cobranza, F.crm] },
      { paso: 'La otra compra', texto: 'Una automatización le escribe a quien compró con la oferta que sigue, por WhatsApp o por email.', enMako: [F.setter, F.email] },
    ],
    icono: ['M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 17h-11v-14h-2', 'M6 5l14 1l-1 7h-13'],
  },
  {
    id: 'instagram',
    nombre: 'Instagram con lead magnet',
    titulo: 'Tu Instagram con lead magnet, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de Instagram.',
    bajada: 'Publicas sin pagar; quien comenta una palabra recibe tu regalo por mensaje, y la charla sigue hasta la venta.',
    corta: 'Quien comenta recibe tu regalo y la charla sigue.',
    queEs: 'Publicas reels, carruseles e historias sin pagar. Quien te sigue comenta una palabra o te escribe, y se vende por mensaje o en una llamada. El lead magnet (una guía, una plantilla, una clase corta) es el regalo que abre la charla.',
    cuando: 'Sin presupuesto para anuncios y con tiempo para publicar seguido. El precio decide cuánto hay que conversar antes de vender.',
    recorrido: ['Contenido', 'Te siguen', 'Palabra clave', 'Regalo', 'Venta'],
    pasos: [
      { paso: 'El contenido', texto: `Ves lo que mejor le funciona a tu competencia, replicas sus carruseles con tu marca${soloProEntre('ia-editores')} y editas tus reels sin saber editar.`, enMako: [F.spy, F.carruseles, F.video] },
      { paso: 'La palabra clave', texto: 'Quien comenta o te escribe recibe un mensaje directo al instante, con la automatización de Instagram.', enMako: [F.setter] },
      { paso: 'El regalo', texto: 'El lead magnet va en ese mensaje: una página tuya hecha con Web Generator, y el contacto entra a tu CRM.', enMako: [F.web, F.crm] },
      { paso: 'La venta', texto: `La charla sigue en tu bandeja, con el setter con IA${soloProEntre('setter-ia')}, hasta el pago o la llamada.`, enMako: [F.chats, F.setter, F.agenda] },
    ],
    icono: ['M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z', 'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M16.5 7.5v.01'],
  },
  {
    id: 'youtube',
    nombre: 'YouTube orgánico',
    titulo: 'Tu funnel de YouTube, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de YouTube.',
    bajada: 'Videos que responden lo que tu cliente busca antes de comprar; quien te conoce da el siguiente paso.',
    corta: 'Videos que educan y llevan a agendar.',
    queEs: 'Videos que responden lo que tu cliente busca antes de comprar. Quien los mira te conoce y da un paso: anotarse, agendar o comprar.',
    cuando: 'Cuando tu cliente busca el tema en YouTube o en Google y puedes grabar todos los meses. Sirve sobre todo para precios altos: llega gente ya educada.',
    recorrido: ['Video', 'Te conoce', 'Siguiente paso', 'Venta'],
    pasos: [
      { paso: 'El video', texto: `Ves los videos de YouTube de tu competencia ordenados por vistas, escribes tu guion con la estructura de uno que funcionó y lo editas con el equipo de agentes${soloProEntre('ia-editores')}.`, enMako: [F.spy, F.copy, F.video] },
      { paso: 'El siguiente paso', texto: 'El link de la descripción lleva a tu página o a tu agenda, y quien llega entra a tu CRM con su origen.', enMako: [F.web, F.agenda, F.crm] },
      { paso: 'La venta', texto: `Una automatización lo acompaña hasta la llamada, y después MaKo te dice qué mejorar en cada una${AVISO_PRO_CLOSING_ENTRE}.`, enMako: [F.setter, F.closing] },
    ],
    icono: ['M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8z', 'M10 9l5 3l-5 3z'],
  },
  {
    id: 'newsletter',
    nombre: 'Newsletter',
    titulo: 'Tu funnel de newsletter, completo en MaKo.',
    cierre: 'Arma hoy tu funnel de newsletter.',
    bajada: 'Quien se anota recibe tu bienvenida y, cada semana, un correo útil que lo acerca a comprarte.',
    corta: 'Tu lista de correo, que te compra de a poco.',
    queEs: 'Una lista de correo tuya a la que le escribes seguido con algo útil, y de a poco le vendes. Es tuya aunque cambie un algoritmo.',
    cuando: 'Cuando ya tienes o puedes juntar una audiencia, casi siempre desde tu Instagram o tu YouTube.',
    recorrido: ['Se anota', 'Bienvenida', 'Newsletter cada semana', 'Venta'],
    pasos: [
      { paso: 'Se anota', texto: 'En tu página para anotarse, hecha con Web Generator, o con tu lead magnet por la palabra clave de Instagram: cada persona entra a tu CRM con su origen.', enMako: [F.web, F.setter, F.crm] },
      { paso: 'La bienvenida', texto: 'Tus correos de bienvenida, escritos con una plantilla de Copywriting, le llegan solos desde tu dominio apenas se anota.', enMako: [F.copy, F.email] },
      { paso: 'El newsletter de cada semana', texto: 'Le mandas a tu lista, o a una parte, un correo escrito con MaKo, desde tu propio dominio.', enMako: [F.email, F.setter] },
      { paso: 'La venta', texto: 'Cada correo lleva a tu página de venta o a tu agenda, y quien compra o agenda cae en su etapa del CRM.', enMako: [F.crm, F.agenda, F.cobranza] },
    ],
    icono: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'],
  },
];

export const funnelPorId = (id: string): FunnelSitio | null => FUNNELS_SITIO.find((f) => f.id === id) ?? null;
export const rutaFunnel = (id: string): string => `/vsl/funnels/${id}`;
