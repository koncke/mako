// =============================================================================
// /vsl/dashboard — el Dashboard de MaKo, con la ESTRUCTURA de la portada de Reportei (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y desde el 11/11/2026 también el DISEÑO):
//   https://reportei.com/es/  (leída el 11/11/2026 con Chromium)
// El diseño copiado (barra, hero, tarjetas de colores, banda azul, testimonios, pie) vive en ./disenos/dashboard.tsx, y los
// valores que se midieron con getComputedStyle a 1440 y 390 px, en docs/diseno/landings-competencia/dashboard.md.
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
//
// LOS TEXTOS DE REPORTEI, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Crea Informes y Dashboards de Marketing Digital en 3 segundos» → «…de marketing digital y ventas, pidiéndoselos a
//     MaKo» (los 3 segundos no están medidos; «y Ventas» sale de su propio pie: «Informes y Dashboards de Marketing
//     Digital y Ventas»);
//   · «Reúne datos de más de 50 plataformas en una sola pantalla: …» → «Reúne N fuentes de datos de tu negocio…», con N
//     CONTADO de lib/graficos-catalogo.ts (FUENTES) y la lista de lo que MaKo lee;
//   · «Crea dashboards en tiempo real e informes multicanal. Recibe análisis con IA, … conecta tus datos a asistentes de
//     IA vía MCP…» → sin «en tiempo real», con la API de MaKo (consultar_datos_dashboard sale por HTTP) y el link para
//     compartir (compartir_dashboard); sin «automatiza los envíos por email y WhatsApp» (no está);
//   · «Integración con…», «¡Deja de perder tiempo con informes y dashboards hechos a mano y gana productividad!», sus
//     piezas «Informe» («Informes que transforman tus datos en estrategia»), «Dashboard» («Un panel para seguir tus
//     resultados», sin «en tiempo real»), «Control» (sus metas y objetivos: Focus), «Reportei AI» (→ «MaKo AI»: las hojas
//     de análisis) y «Tus datos en los asistentes de IA» (su MCP → la API de MaKo); su Studio (presentaciones) no es de
//     MaKo y en su lugar va «Pídeselo a MaKo». Sin «Automatización de informes», «Línea de tiempo» ni «Overview»;
//   · «Los indicadores de todos tus canales en una sola pantalla» y «Consulta en una sola pantalla los principales
//     indicadores de: …» con los canales de MaKo. Los tipos de gráfico (N_TIPOS) también se cuentan del catálogo.
// =============================================================================

import { FUENTES, TIPOS } from '@/lib/graficos-catalogo';
import type { LandingCompetencia } from './tipos';

// Contados del catálogo del Dashboard (lib/graficos-catalogo.ts): los conjuntos de datos que lee y los tipos de gráfico.
const N_FUENTES = FUENTES.length;
const N_TIPOS = TIPOS.length;

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
  metaTitle: 'Dashboard de MaKo: crea informes y dashboards de marketing digital y ventas, pidiéndoselos a MaKo',
  metaDesc: `Reúne ${N_FUENTES} fuentes de datos de tu negocio en una sola pantalla: tus anuncios de Meta, tu landing y tu VSL, tu CRM, tus pagos, tus llamadas y tus automatizaciones.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Informes de tu marketing y tus ventas',
      titulo: 'Crea informes y dashboards de marketing digital y ventas, <em>pidiéndoselos a MaKo</em>',
      bajada: `Reúne <strong>${N_FUENTES} fuentes de datos</strong> de tu negocio en una sola pantalla: tus anuncios de Meta, tu landing y tu VSL, tus leads del CRM, tus pagos, tus llamadas grabadas, tus mensajes de WhatsApp y tus automatizaciones.`,
      puntos: ['Crea dashboards e informes de todos tus canales', 'Recibe análisis con IA, pídele a MaKo el gráfico que te falte, conecta tus datos a tu propia IA por la API de MaKo y compártelos con un link'],
      visual: { tipo: 'detalle', slug: 'dashboard' },
    },
    {
      tipo: 'logos',
      titulo: 'Integración con',
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
      titulo: '¡Deja de perder tiempo con informes y dashboards hechos a mano <em>y gana productividad!</em>',
      items: [
        { icono: I.hoja, titulo: 'Informe', texto: `Informes que transforman tus datos en estrategia, con ${N_TIPOS} tipos de gráfico.` },
        { icono: I.estilo, titulo: 'Dashboard', texto: 'Un panel para seguir tus resultados, que diseñas a tu manera.' },
        { icono: I.foco, titulo: 'Control', texto: 'Sigue el rendimiento de tus metas y objetivos en Focus, tu día.' },
        { icono: I.lupa, titulo: 'MaKo AI', texto: 'Recibe análisis inteligentes en tus hojas con IA: Ads, Closing, VSL, Chat y CS Analyst.' },
        { icono: I.ia, titulo: 'Pídeselo a MaKo', texto: 'Le pides un gráfico o un cambio en palabras, y MaKo lo arma.' },
        { icono: I.reloj, titulo: 'API de MaKo', texto: 'Tus datos en los asistentes de IA, para consultar tus números desde tu propio chat.' },
      ],
    },
    {
      tipo: 'filas',
      titulo: 'Los indicadores de <em>todos tus canales</em> en una sola pantalla',
      bajada: 'Consulta en una sola pantalla los principales indicadores de: Meta Ads, tu landing, tu VSL, tu CRM, tus pagos, tus llamadas grabadas, WhatsApp y tus automatizaciones.',
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
