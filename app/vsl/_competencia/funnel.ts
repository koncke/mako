// =============================================================================
// /vsl/funnel — Funnels (del anuncio al pago, lead por lead), con la ESTRUCTURA de la portada de Hyros
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO):
//   https://hyros.com/  (leída de nuevo el 14/11/2026 con Chromium: la publicaron ese día a las 13:52 UTC y cambió entera)
// El diseño copiado vive en ./disenos/funnel.tsx; los valores medidos a 1440 y 390 px, en docs/diseno/landings-competencia/funnel.md.
// Su orden hoy, que se respeta acá: (aviso de Black Friday) → barra → hero «Same ad spend. 15% more sales.» con su panel de
// escenas que se turnan → «Tracking $5B+ in ad spend for:» → «Brands that add Hyros see» (la ventana de cuatro cifras) → «Hyros
// Custom: Add ANY Feature To Your App In Seconds.» (el cubo de capas) → «All / All / None» → «See how Hyros Works. Pick your
// business model.» → «What Could You Build With Hyros Custom?» (la lámina con la app) → «Made Plug and Play With The Hyros App
// Store» → «What could you build with the Hyros MCP?» → la garantía → pie.
//
// Lo que se cambió de la referencia, y por qué:
//   · Su titular promete «15% more sales»: MaKo no lo midió. Va lo que sí hace: de cada venta ves su anuncio, su campaña, su
//     landing y su VSL (la ficha del lead: «De dónde vino», app/crm/lead-view). La palabra que rota es la de ellos (sales / calls /
//     leads / ROAS), con lo que la ficha muestra de verdad.
//   · Su panel de escenas dibujadas (hyros.com/reports, /sync, /cpa, /mcp) son, acá, cuatro grabaciones de la app real: la ficha
//     del lead (de dónde vino y cuánto vio del VSL) y la hoja Marketing del Dashboard (lo que trae la pauta, el costo por agenda de
//     cada anuncio y el ROAS cobrado), con la misma ventana, el mismo turno y el mismo acercamiento al final de cada escena.
//   · «Tracking $5B+ in ad spend for:» y sus nombres son suyos: va el caso de Mauricio, con la misma línea y las mismas fichas.
//   · «Brands that add Hyros see» trae sus resultados (ROI, CPA, AOV), que MaKo no midió: la ventana de cuatro tarjetas lleva lo que
//     MaKo le avisa a Meta, evento por evento (lib/meta-capi-payload.ts, los webhooks de Meta y Calendly, lib/cobros-externos-meta.ts).
//   · «Hyros Custom» (pides una función en palabras) es, en MaKo, «Editar con MaKo» (app/dashboard/PanelEditarMako.tsx): le pides un
//     gráfico en palabras y entra a tu hoja. Las capas del cubo son lo que mide MaKo; sus fichas, lo que MaKo conecta de verdad.
//   · «All / All / None» habla de su app a medida: acá, «Todo / Todo / Nada» con lo que MaKo junta y lo que te ahorra.
//   · «Pick your business model» son, en MaKo, los cuatro funnels de la portada (app/vsl/_sitio/funnels-datos.ts), cada uno con su
//     mini landing en /vsl/funnels/<id>.
//   · «What Could You Build With Hyros Custom?» lleva la grabación REAL de «Editar con MaKo» y, en la tabla, los gráficos pedidos.
//   · Su App Store (arrastrar complementos a tu tablero), su MCP («npx hyros-mcp connect»), su garantía, su atribución por llamada,
//     su IA que predice el LTV y su Black Friday NO van: MaKo no los tiene. El cierre es el panel de su garantía sin la garantía.
// =============================================================================

import { FUNNELS_SITIO } from '../_sitio/funnels-datos';
import type { LandingCompetencia } from './tipos';

const I = {
  funnel: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
};

/** La palabra del titular que rota cada 2,4 s (en Hyros: sales. / calls. / leads. / ROAS.): lo que la ficha de cada lead dice de
 *  dónde vino (anuncio y campaña), por dónde entró (la landing) y cuánto vio del VSL. */
export const PALABRAS_HERO = ['anuncio.', 'campaña.', 'landing.', 'VSL.'] as const;

/** Las escenas del panel del hero, en su orden: una grabación de la app real por escena (public/vsl-assets/funnel/<video>.webm),
 *  la dirección de la ventana y su pie (la segunda frase se resalta al final de la escena, como en Hyros). */
export const ESCENAS_HERO = [
  { url: 'hola-mako.com/crm', video: 'ficha', pie: 'De qué anuncio vino cada lead. <b>Y todo lo que hizo en tu página.</b>' },
  { url: 'hola-mako.com/dashboard', video: 'pauta', pie: 'De la impresión al clic y a tu página. <b>Ves dónde se cae la gente.</b>' },
  { url: 'hola-mako.com/dashboard', video: 'anuncios', pie: 'Lo que te costó cada agenda, <b>anuncio por anuncio.</b>' },
  { url: 'hola-mako.com/dashboard', video: 'kpis', pie: 'Lo que cobraste por cada dólar en anuncios. <b>Lo cobrado, no lo prometido.</b>' },
] as const;

/** El cubo de «Editar con MaKo» (el de «Hyros Custom»): la base, las capas que se turnan (las tres de abajo y las dos que esperan
 *  su turno), la de arriba y las fichas de lo que MaKo conecta (logos de public/vsl-assets/logos/integraciones). Cada capa es algo
 *  que MaKo muestra: la ficha del lead, los eventos a Meta, el CAC y el ROAS cobrado (lib/graficos-catalogo.ts) y la retención del
 *  VSL («Dónde se van», en la hoja VSL y YouTube). */
export const CUBO_FUNNEL = {
  base: 'TU DASHBOARD DE MAKO',
  capas: ['El recorrido de cada lead', 'Lo que le avisa a Meta', 'Cuánto te costó un cliente', 'Lo que cobraste por dólar', 'Dónde se van de tu VSL'],
  arriba: 'Cualquier gráfico.',
  integraciones: 'INTEGRACIONES',
  // Lo que se conecta de verdad: Meta (anuncios y formularios), Calendly y Cal.com (sus webhooks), Stripe y Mercado Pago (los
  // cobros), YouTube (los videos que mide el Pixel), WhatsApp e Instagram (Chats), Fathom y Zoom (los grabadores de reuniones).
  fichas: [
    { n: 'Meta', logo: 'meta.svg' }, { n: 'Calendly', logo: 'calendly.png' }, { n: 'Stripe', logo: 'stripe.png' }, { n: 'YouTube', logo: 'youtube.png' },
    { n: 'WhatsApp', logo: 'whatsapp.svg' }, { n: 'Instagram', logo: 'instagram.png' }, { n: 'Fathom', logo: 'fathom.png' }, { n: 'Cal.com', logo: 'calcom.png' },
    { n: 'Mercado Pago', logo: 'mercadopago.svg' }, { n: 'Zoom', logo: 'zoom.svg' },
  ],
  // La tarjeta de arriba («All powered by Hyros AI Swarm Tracking»): lo que mide cada visita es el Pixel de MaKo (lib/landing-token.ts).
  tarjeta: ['Todo medido por', 'El Pixel de MaKo', 'En tu landing y tu VSL, visita por visita'],
  costado: '5 CAPAS · ENTRAN Y SALEN',
  siguen: 'LO QUE SIGUE · ENTRA',
} as const;

/** La tabla de la lámina («No. / Feature / Status»): lo que se le pide a «Editar con MaKo» en la grabación (las dos primeras
 *  sugerencias de la app, SUGERENCIAS_DASHBOARD) y un gráfico del catálogo (el CAC, «Gasto en anuncios ÷ cierres»). */
export const PEDIDOS_EDITAR = [
  { grafico: 'Leads por semana', pedido: 'Agrega los leads por semana' },
  { grafico: 'Cobrado del mes', pedido: 'Pon arriba lo cobrado del mes' },
  { grafico: 'CAC', pedido: 'Agrega cuánto me costó cada cliente' },
] as const;

/** El recorrido de cada funnel de la portada en una línea (sale de sus pasos en app/vsl/_sitio/funnels-datos.ts). */
const RECORRIDO: Readonly<Record<string, string>> = {
  vsl: 'Anuncio, página con tu video, llamada y pago',
  whatsapp: 'Anuncio, chat con tu setter con IA y pago',
  instagram: 'Contenido, palabra clave, regalo y venta',
  youtube: 'Video, tu página o tu agenda, y la venta',
};

/** El panel del cierre (el de su garantía, sin la garantía). */
export const CIERRE_FUNNEL = { kick: 'Funnels de MaKo', titulo: 'Del anuncio al pago. <b>En una sola pantalla.</b>', bajada: 'Tu anuncio, tu landing, tu VSL, tu agenda y tu CRM, en un solo recorrido.' } as const;

export const LANDING_FUNNEL: LandingCompetencia = {
  slug: 'funnel',
  nombre: 'Funnels',
  icono: I.funnel,
  referencia: { nombre: 'Hyros — tracking y atribución de anuncios', url: 'https://hyros.com/', leida: '2026-11-14' },
  metaTitle: 'Funnels de MaKo: de cada venta, su anuncio, su landing y su VSL',
  metaDesc: 'Del anuncio al pago en un solo recorrido, lead por lead. MaKo le avisa a Meta quién agendó, quién calificó y quién pagó, y te dice cuánto te costó un cliente de verdad.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Mira cómo funciona',
      titulo: 'Cada venta,<br>con su <em>anuncio.</em>',
      bajada: 'Del anuncio al pago, lead por lead.<br>Y Meta aprende de tus ventas reales.',
      visual: { tipo: 'detalle', slug: 'funnel' },
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      etiqueta: 'Meta · API de conversiones · desde tu CRM',
      titulo: 'Lo que MaKo <b>le avisa a Meta</b>',
      bajada: 'Las mismas cuentas de anuncios, ahora optimizadas con tus ventas reales en vez de lo que adivina la plataforma.',
      items: [
        { titulo: 'Entró', texto: 'Deja sus datos en tu formulario de Meta.', meta: 'Lead' },
        { titulo: 'Agendó', texto: 'Reserva en tu Calendly, sin contarla dos veces.', meta: 'Schedule' },
        { titulo: 'Calificó', texto: 'Lo marcas como calificado en tu CRM.', meta: 'QualifiedLead' },
        { titulo: 'Pagó', texto: 'Paga con un link de tu Stripe, con su monto.', meta: 'Purchase' },
      ],
    },
    {
      tipo: 'filas',
      etiqueta: 'Editar con MaKo',
      titulo: '<span>Agrega cualquier</span> <span>gráfico a tu hoja</span> <b>En palabras.</b>',
      bajada: 'Le pides a MaKo <b>CUALQUIER</b> gráfico de tu embudo y entra a tu hoja del Dashboard, <b>con tus datos</b>.',
      slug: 'funnel',
      items: [],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Funnels de MaKo',
      titulo: 'Todo, todo y nada',
      items: [
        { titulo: 'Todo', texto: 'lo que pasa en tu embudo, del anuncio al pago, en una sola pantalla.', meta: 'Una pantalla' },
        { titulo: 'Todo', texto: 'lo que vende tu CRM, para que Meta aprenda de tus ventas.', meta: 'Tus ventas reales' },
        { titulo: 'Nada', texto: 'de exportar, pegar ni rehacer planillas. Nada de un programador.', meta: 'Cero planillas' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Tu tipo de funnel',
      titulo: 'Mira cómo funciona MaKo.<br><b>Elige tu <span>tipo de funnel.</span></b>',
      // El primero es «Editar con MaKo» (su «Hyros Custom» blanco, que baja a la lámina); los otros, los funnels de la portada con
      // su mini landing. `meta` es a dónde lleva cada fila.
      items: [
        { titulo: 'Editar con MaKo', texto: 'Gráficos <b>A TU MEDIDA</b>, en palabras', meta: '#editar' },
        ...FUNNELS_SITIO.map((f) => ({ titulo: f.nombre, texto: RECORRIDO[f.id] ?? f.bajada, meta: `/vsl/funnels/${f.id}` })),
      ],
    },
    {
      tipo: 'filas',
      etiqueta: 'Editar con MaKo · Fig. 01',
      titulo: '<span>¿Qué le pedirías</span> <span>a <b>Editar con MaKo?</b></span>',
      bajada: 'Le pides <b>CUALQUIER</b> gráfico en palabras y entra a tu hoja, <b>con tus números</b>.',
      slug: 'funnel',
      items: PEDIDOS_EDITAR.map((p) => ({ titulo: p.grafico, texto: p.pedido })),
    },
  ],
};
