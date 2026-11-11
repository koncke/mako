// =============================================================================
// /vsl/dashboard — el Dashboard de MaKo, con la ESTRUCTURA de la portada de Reportei (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones y el storytelling; la cara es la de /vsl):
//   https://reportei.com/es/  (leída el 11/11/2026 con Chromium)
// Su orden, que se respeta acá: hero «Crea Informes y Dashboards de Marketing Digital en 3 segundos» → logos de lo que
// conecta → «¡Deja de perder tiempo con informes y dashboards hechos a mano y gana productividad!» (la grilla de piezas)
// → «Los indicadores de todos tus canales en una sola pantalla» → (sus otros productos) → «Mira los resultados de
// nuestros clientes». Por qué ganó: docs/competencia/landings-por-funcion.md → «Dashboard y reportes».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su «en 3 segundos» y sus «+10.000 empresas» no son de MaKo: no se dicen. Lo que MaKo trae lo dice el catálogo.
//   · Sus pestañas «Conoce la herramienta», Flux (redes) y Sync (Google Sheets) son productos que MaKo no tiene en esta
//     tab: no van. Tampoco su texto largo de SEO.
//   · Sus testimonios son suyos: la prueba de MaKo es el caso de Mauricio.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['graphics', 'general', 'experimentos']); los gráficos, de la landing
// anterior de esta ruta. El de «¿Apago este anuncio o lo escalo?» no va: muestra a MaKo subiendo un presupuesto, que es del
// Media Buyer y no del Dashboard; la audiencia por edad sí (la fuente «Audiencia» de lib/graficos-catalogo.ts).
// =============================================================================

import type { LandingCompetencia } from './tipos';

const I = {
  dashboard: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
  hoja: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 17v-5', 'M12 17v-3', 'M15 17v-1'],
  lupa: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
  foco: ['M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
  ia: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  estilo: ['M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25', 'M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
};

export const LANDING_DASHBOARD: LandingCompetencia = {
  slug: 'dashboard',
  nombre: 'Dashboard',
  icono: I.dashboard,
  referencia: { nombre: 'Reportei — informes y dashboards de marketing', url: 'https://reportei.com/es/', leida: '2026-11-11' },
  metaTitle: 'Dashboard de MaKo: tu marketing y tus ventas en hojas que arma MaKo',
  metaDesc: 'Hojas de Marketing y Comercial con tus anuncios, tu embudo y tus llamadas, las hojas de análisis de cada área y Focus, tu día. Le pides un gráfico a MaKo y lo arma.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Informes de tu marketing y tus ventas',
      titulo: 'Tu marketing y tus ventas en una hoja. Le pides un gráfico a MaKo y lo arma.',
      bajada: 'Hojas de <strong>Marketing y Comercial</strong> con tus anuncios, tu embudo y tus llamadas, las hojas de análisis de cada área y Focus, tu día. Sin armar un informe a mano.',
      puntos: ['Copiado de Looker Studio: lo editas como quieras', '«Editar con MaKo»: pides el gráfico o el cambio en palabras'],
      visual: { tipo: 'detalle', slug: 'dashboard' },
    },
    {
      tipo: 'logos',
      titulo: 'Tus hojas leen de',
      items: [
        { logo: 'meta.png', nombre: 'Meta Ads' },
        { logo: 'calendly.png', nombre: 'Tu agenda' },
        { logo: 'llamada.svg', nombre: 'Tus llamadas' },
        { logo: 'panda.png', nombre: 'Tu VSL' },
        { logo: 'whatsapp.png', nombre: 'Tus chats' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Deja de armar informes a mano',
      bajada: 'Todo lo que trae el Dashboard, listo para mirar o para cambiar.',
      items: [
        { icono: I.hoja, titulo: 'Hojas de Marketing y Comercial', texto: 'Gráficos de tus anuncios y de tus ventas, con su estilo y el período que elijas.' },
        { icono: I.lupa, titulo: 'Las hojas de análisis', texto: 'Ads Analyst, Closing (tus llamadas de venta), VSL Analyst, Chat Analyst y CS Analyst.' },
        { icono: I.reloj, titulo: 'El primer contacto', texto: 'Cuánto tarda una persona de tu equipo en escribirle o llamar a cada lead nuevo, sin contar los mensajes automáticos.' },
        { icono: I.foco, titulo: 'Focus, tu día', texto: 'El objetivo y la acción del día, tus KPIs, el semáforo del negocio y el mes.' },
        { icono: I.ia, titulo: 'Editar con MaKo', texto: 'Le pides un gráfico o un cambio en palabras, o pruebas un experimento y lo mides contra el dato real.' },
        { icono: I.estilo, titulo: 'Tuyo de verdad', texto: 'Como en Looker Studio: mueves, cambias y diseñas cada hoja a tu manera.' },
      ],
    },
    {
      tipo: 'filas',
      titulo: 'Los números de todos tus canales en una sola pantalla',
      slug: 'dashboard',
      items: [
        { grafico: 1, titulo: 'Tu embudo, de punta a punta', texto: 'Del anuncio a la llamada en una sola hoja, para ver <strong>en qué paso se cae</strong> la gente.' },
        { grafico: 2, titulo: 'Lo que vendiste de verdad', texto: 'La hoja Comercial muestra tus ventas y tus llamadas, al lado de lo que pasa en tu marketing.' },
        { grafico: 4, titulo: 'A quién le llegan tus anuncios', texto: 'Edad, género, plataforma y región de quienes ven tus anuncios, <strong>en vivo de Meta</strong>.' },
      ],
    },
    { tipo: 'caso' },
  ],
};
