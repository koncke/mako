// =============================================================================
// /vsl/funnel — Funnels (tu embudo de punta a punta, con la venta real), con la ESTRUCTURA de la portada de Hyros
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y desde el 11/11/2026 también el DISEÑO):
//   https://hyros.com/  (leída el 11/11/2026 con Chromium, de arriba a abajo)
// El diseño copiado (barra, hero con su ventana, pasos, la ventana de cifras, los renglones en cajas, la banda de modelos
// de negocio y el pie) vive en ./disenos/funnel.tsx; los valores medidos a 1440 y 390 px, en
// docs/diseno/landings-competencia/funnel.md.
// Su orden, que se respeta acá: (aviso de Black Friday) → hero «Tracking that grows ads / Custom Made For You.» con su
// demo «Meta vs HYROS» → «Tracking $5B+ in ad spend for:» (logos y la cita de un cliente) → «How it works: Any Feature You
// Want Is Just A Prompt Away» (tres pasos) → «Brands that add Hyros see… optimized on real sales instead of platform
// guesses» → «Guaranteed or you don't pay» → «All / All / None» → «When we say any feature» (las capas de la app y sus
// integraciones, «powered by AI Swarm Tracking») → «Pick your business model» (cuatro) → «What could you build with the
// Hyros MCP?» → la garantía → pie. Por qué ganó: docs/competencia/landings-por-funcion.md → «Funnels / embudo».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su garantía («Guaranteed or you don't pay», «Your ads grow. Or you don't pay») no va: MaKo no tiene una. Tampoco el aviso
//     de Black Friday ni su «Proven to increase ad ROI 15–20%».
//   · Sus cifras («$5B+», «5,000+ brands») y sus logos de clientes son suyos: en ese lugar va la prueba de MaKo, el caso de
//     Mauricio.
//   · «Brands that add Hyros see» trae sus resultados (ROI, CPA, AOV), que MaKo no midió. Se queda su relato —las mismas
//     cuentas, ahora con las ventas reales en vez de lo que adivina la plataforma— y en lugar de sus números va lo que MaKo le
//     avisa a Meta, evento por evento.
//   · «How it works» (pides una función en palabras, aparece en tu app, la mantienen ellos) es, en MaKo, «Editar con MaKo»: le
//     pides el gráfico de tu embudo en palabras y lo arma en tu hoja del Dashboard.
//   · «All / All / None» habla de sus desarrollos a medida, y su MCP no tiene equivalente (MaKo no tiene MCP): no van.
//   · Sus capas («Custom attribution models», reportes, «Ad platform automation») son acá el recorrido de punta a punta, cada
//     lead uno por uno y lo que te costó un cliente; sus integraciones, los logos de lo que MaKo junta.
//   · «Pick your business model» (SaaS, e-commerce, llamadas, info) es, en MaKo, el tipo de funnel que declaras en tu CRM.
// De dónde sale lo que se afirma: los eventos a Meta, de lib/meta-capi-payload.ts (`EVENTOS_CALIFICADO`, `EVENTO_COMPRA`),
// app/api/webhooks/meta-leads/route.ts (Lead), app/api/webhooks/calendly/route.ts (Schedule, y no lo repite si la página ya lo
// manda), lib/leads.ts (la calificación) y lib/cobros-externos-meta.ts (la compra de un link de pago de tu Stripe); el CAC y el
// ROAS cobrado, de lib/graficos-catalogo.ts; cada lead uno por uno, de app/crm/lead-view/ComportamientoCard.tsx; «Editar con
// MaKo», de lib/graficos-ia-edicion.ts; los tipos de funnel, de `TIPOS_FUNNEL` y `ENTRADAS` (lib/pipeline.ts). Los gráficos, de
// la landing anterior de esta ruta: el de WhatsApp (2) no va, muestra avisos del VSL de un lead que MaKo no manda.
//
// LOS TEXTOS DE HYROS, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Tracking that grows ads / Custom Made For You.» → «Un seguimiento que entrena a tus anuncios. Hecho a tu medida.»
//     (que «haga crecer» tus anuncios no está medido; lo que MaKo hace es mandarle a Meta los eventos de tu CRM);
//   · «Hyros catches missed ad sales and uses them to train Meta's Ad AI… Then adds any feature you want in a few prompts.»
//     → «MaKo junta las ventas de tu CRM y las usa para entrenar a la IA de anuncios de Meta… Y el gráfico que te falte, se
//     lo pides en unas palabras» (sin «to get you more sales»; los eventos, de lib/meta-capi-payload.ts);
//   · «How it works» / «Any Feature You Want Is Just A Prompt Away» (→ «Cualquier gráfico»: en MaKo se pide un gráfico, no
//     una función), «Start with the base Hyros app. Add any feature you want in a few plain English prompts.», «You prompt
//     it, in plain English» / «No specs, no tickets, no developer.», «It's built into your app», «We maintain it for you» /
//     «…the tracking underneath — handled»;
//   · «Same ad accounts, now optimized on real sales instead of platform guesses» (sin sus números de ROI, CPA y AOV);
//   · «Integrations», «Pick your business model.» → «Elige tu tipo de funnel.» (lo que se declara en el CRM). Su MCP,
//     su garantía y su Black Friday no van.
// =============================================================================

import { TIPOS_FUNNEL, type TipoFunnel } from '@/lib/pipeline';
import type { LandingCompetencia } from './tipos';

const I = {
  funnel: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  lead: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M16 19h6', 'M19 16v6', 'M6 21v-2a4 4 0 0 1 4 -4h4'],
  agenda: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16'],
  califica: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 12l2 2l4 -4'],
  pago: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1', 'M12 6v2', 'M12 16v2'],
  landing: ['M4 4m0 1a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z', 'M4 8h16', 'M8 4v4'],
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  prospecta: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'],
  carrito: ['M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 17h-11v-14h-2', 'M6 5l14 1l-1 7h-13'],
  formulario: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z', 'M9 12l.01 0', 'M13 12l2 0', 'M9 16l.01 0', 'M13 16l2 0'],
};

/** Cada tipo de funnel del CRM con su nombre de lib/pipeline.ts; el texto dice por dónde llega el lead (su entrada). */
const POR_TIPO: Record<TipoFunnel, { icono: string[]; texto: string }> = {
  anuncios_landing: { icono: I.landing, texto: 'Llenan un formulario en tu landing, tu web o un lead magnet.' },
  anuncios_whatsapp: { icono: I.chat, texto: 'Te escriben por WhatsApp, un DM o un comentario.' },
  prospeccion: { icono: I.prospecta, texto: 'Tú les escribes primero: una lista o una campaña de mensajes, sin anuncios.' },
  anuncios_carrito: { icono: I.carrito, texto: 'Pagan en tu página, sin hablar con nadie.' },
  anuncios_formulario: { icono: I.formulario, texto: 'Dejan sus datos en el formulario de Facebook o Instagram, sin salir de la app.' },
};

export const LANDING_FUNNEL: LandingCompetencia = {
  slug: 'funnel',
  nombre: 'Funnels',
  icono: I.funnel,
  referencia: { nombre: 'Hyros — tracking y atribución de anuncios', url: 'https://hyros.com/', leida: '2026-11-11' },
  metaTitle: 'Funnels de MaKo: un seguimiento que entrena a tus anuncios, hecho a tu medida',
  metaDesc: 'Del anuncio al pago en un solo recorrido, lead por lead. MaKo le avisa a Meta quién agendó, quién calificó y quién pagó, y te dice cuánto te costó un cliente de verdad.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'El embudo con tu venta real',
      titulo: 'Un seguimiento que entrena a tus anuncios. <em>Hecho a tu medida.</em>',
      bajada: 'MaKo junta las ventas de tu CRM y las usa para entrenar a la IA de anuncios de Meta: le avisa quién agendó, quién calificó y quién pagó. Tu anuncio, tu landing, tu VSL, tu agenda y tu CRM, en <strong>un solo recorrido</strong>. Y el gráfico que te falte, se lo pides en unas palabras.',
      puntos: ['Del anuncio al pago, lead por lead', 'Cuánto te costó un cliente de verdad, no un lead'],
      visual: { tipo: 'detalle', slug: 'funnel' },
    },
    { tipo: 'caso' },
    {
      tipo: 'pasos',
      etiqueta: 'Cómo funciona',
      titulo: 'Cualquier gráfico que quieras, <em>a un pedido de distancia</em>',
      bajada: 'Arrancas con tus hojas de Marketing y Comercial. Agregas el gráfico que quieras en unas palabras.',
      pasos: [
        { titulo: 'Lo pides en palabras', texto: '«Muéstrame mis agendas y cierres por día». Sin fórmulas, sin filtros, sin un desarrollador.' },
        { titulo: 'Aparece en tu hoja', texto: 'Con «Editar con MaKo», el gráfico se arma en tu Dashboard, con tus datos de Meta, tu agenda y tu CRM.' },
        { titulo: 'Se mantiene al día', texto: 'Lee de tus apps conectadas y el seguimiento de abajo lo cuida MaKo: no exportas ni pegas nada.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Lo que le llega a Meta',
      titulo: 'Las mismas cuentas de anuncios, ahora optimizadas con tus ventas reales',
      bajada: 'En vez de lo que adivina la plataforma. Esto es lo que MaKo le avisa a Meta:',
      columnas: 2,
      items: [
        { icono: I.lead, titulo: 'Entró', texto: 'Cuando alguien deja sus datos en tu formulario de Meta.', meta: 'Lead' },
        { icono: I.agenda, titulo: 'Agendó', texto: 'Cuando reserva en tu Calendly. Si tu página ya se lo avisa, no la cuenta dos veces.', meta: 'Schedule' },
        { icono: I.califica, titulo: 'Calificó', texto: 'Cuando lo marcas como calificado en tu CRM.', meta: 'SubmitApplication y QualifiedLead' },
        { icono: I.pago, titulo: 'Pagó', texto: 'Cuando paga con un link de pago de tu Stripe, con su monto.', meta: 'Purchase' },
      ],
    },
    {
      tipo: 'filas',
      etiqueta: 'Todo tu embudo',
      titulo: '<span>Del anuncio</span> <span>al pago,</span> <strong>en una sola</strong> <em>pantalla</em>',
      bajada: 'Lo mide el Pixel de MaKo en tu página y lo cierra tu CRM.',
      slug: 'funnel',
      items: [
        {
          grafico: 1,
          titulo: 'El recorrido de tus leads',
          texto: 'Vieron tu anuncio, entraron a tu landing, miraron tu VSL, agendaron y pagaron: ves <strong>en qué paso se te cae</strong> la gente.',
          puntos: [
            'De cada lead: cuántas veces entró a tu landing, hasta dónde vio tu VSL y la grabación de su visita',
            'Cuánto te costó un cliente: tu gasto en anuncios entre tus cierres',
            'Cuánto cobraste por cada dólar que pusiste en anuncios',
          ],
        },
        {
          grafico: 0,
          titulo: 'Conectas tus apps una sola vez',
          texto: 'Meta, tu landing, tu VSL, tu agenda y tu CRM quedan <strong>hablando entre sí</strong>. No exportas, no pegas y no rehaces nada.',
        },
      ],
    },
    {
      tipo: 'logos',
      titulo: 'Integraciones',
      items: [
        { logo: 'meta.png', nombre: 'Meta Ads' },
        { logo: 'landing.svg', nombre: 'Tu landing' },
        { logo: 'panda.png', nombre: 'Tu VSL' },
        { logo: 'calendly.png', nombre: 'Tu agenda' },
        { logo: 'whatsapp.png', nombre: 'Tus chats' },
        { logo: 'llamada.svg', nombre: 'Tus llamadas' },
        { logo: 'pago.svg', nombre: 'Tus cobros' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Tu tipo de funnel',
      titulo: 'Elige tu <em>tipo de funnel.</em>',
      items: TIPOS_FUNNEL.map((t) => ({ icono: POR_TIPO[t.id].icono, titulo: t.label, texto: POR_TIPO[t.id].texto })),
    },
  ],
};
