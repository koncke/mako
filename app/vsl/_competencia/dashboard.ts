// =============================================================================
// /vsl/dashboard — el Dashboard de MaKo, con la ESTRUCTURA de la portada de Reportei (11/11/2026; relevo fiel el 14/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO):
//   https://reportei.com/es/  (leída el 11/11/2026 y otra vez el 14/11/2026 con Chromium, a 1440 y a 390 px)
// El diseño (barra, hero, franja, la caja celeste con su video, las tarjetas pastel, las de borde fino, la banda azul, «Conoce la
// herramienta» con sus pestañas, los testimonios) vive en ./disenos/dashboard.tsx; los valores medidos, en
// docs/diseno/landings-competencia/dashboard.md. Su orden, el de acá: hero → «Integración con…» → la caja «Más de 10.000 empresas…»
// (muro de logos que corre + video) → «¡Deja de perder tiempo…!» (siete tarjetas y las dos de borde fino) → «Los indicadores de todos
// tus canales en una sola pantalla» → «Conoce la herramienta» → «Mira los resultados de nuestros clientes».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su «en 3 segundos», sus «+10.000 clientes en 70 países» y su insignia de GetApp no son de MaKo: no se dicen.
//   · Su muro de logos de CLIENTES es suyo: en su lugar corren los tableros listos de MaKo (contados del código: las plantillas que
//     ofrece «Nueva hoja», lib/graficos-plantillas.ts), y su video de YouTube es «Nueva hoja» grabada en MaKo.
//   · Sus tarjetas, una por una: «Informe» y «Dashboard» quedan; «Automatización de informes» (envíos programados por email y
//     WhatsApp) NO existe en MaKo → «Compartir» (el link y el PDF); «Control» → la meta del trimestre de General; «Línea de tiempo»
//     → lo que vence en el Plan (la lista de General); «Overview» → General; «Reportei AI» → «Editar con MaKo»; Studio
//     (presentaciones) → las hojas de análisis; MCP → la API de MaKo.
//   · Sus pestañas de «Conoce la herramienta» son sus funciones: aquí son cuatro tableros (General, Marketing, Comercial, Closing).
//   · Sus premios, sus precios con la promoción, Flux, Sync y el texto de SEO con su dibujo no van (no son de MaKo).
//   · Sus testimonios son suyos: la prueba de MaKo es el caso de Mauricio.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['graphics', 'general', 'experimentos']); FUENTES, TIPOS y las plantillas se
// CUENTAN del catálogo. Los números de las pantallas son de un negocio de ejemplo y cuadran entre sí (el banco,
// C:/dev/bancos-portada/banco-dashboard-landing/ejemplo.ts).
//
// LOS TEXTOS DE REPORTEI, TAL CUAL donde MaKo lo hace (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Crea Informes y Dashboards de Marketing Digital en 3 segundos» → «…de marketing digital y ventas, pidiéndoselos a MaKo»;
//   · «Reúne datos de más de 50 plataformas en una sola pantalla: …» → «Reúne N fuentes de datos…» (N de FUENTES);
//   · «Crea dashboards en tiempo real e informes multicanal. Recibe análisis con IA, … conecta tus datos a asistentes de IA vía MCP…»
//     → sin «en tiempo real», con la API de MaKo y el link para compartir; sin «automatiza los envíos por email y WhatsApp»;
//   · «¡Deja de perder tiempo con informes y dashboards hechos a mano y gana productividad!», «Informes que transforman tus datos en
//     estrategia», «Un panel para seguir tus resultados», «Tus datos en los asistentes de IA», «Los indicadores de todos tus canales
//     en una sola pantalla», «Consulta en una sola pantalla los principales indicadores de: …» y «Conoce la herramienta».
// =============================================================================

import { FUENTES, TIPOS } from '@/lib/graficos-catalogo';
import { PLANTILLAS_OFRECIDAS, PLANTILLAS_GENERAL_OFRECIDAS } from '@/lib/graficos-plantillas';
import type { LandingCompetencia } from './tipos';

// Contados del catálogo del Dashboard (lib/graficos-catalogo.ts): los conjuntos de datos que lee y los tipos de gráfico.
const N_FUENTES = FUENTES.length;
const N_TIPOS = TIPOS.length;
/** Los tableros listos: las plantillas que ofrece «Nueva hoja» (las de General y las del Dashboard), con su emoji. */
export const TABLEROS_LISTOS = [...PLANTILLAS_GENERAL_OFRECIDAS, ...PLANTILLAS_OFRECIDAS].map((p) => ({ nombre: p.nombre, emoji: p.emoji ?? '' }));

const I = {
  dashboard: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
  hoja: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 17v-5', 'M12 17v-3', 'M15 17v-1'],
  panel: ['M12 13m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M13.45 11.55l2.05 -2.05', 'M6.4 20a9 9 0 1 1 11.2 0z'],
  compartir: ['M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.7 10.7l6.6 -3.4', 'M8.7 13.3l6.6 3.4'],
  control: ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
  vence: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16', 'M11 15h1', 'M12 15v3'],
  general: ['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'],
  ia: ['M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z'],
  analisis: ['M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z', 'M7 20h10', 'M9 16v4', 'M15 16v4', 'M9 12v-4', 'M12 12v-1', 'M15 12v-2'],
  api: ['M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M12 3v7', 'M12 14v7', 'M3 12h7', 'M14 12h7'],
};

export const LANDING_DASHBOARD: LandingCompetencia = {
  slug: 'dashboard',
  nombre: 'Dashboard',
  icono: I.dashboard,
  referencia: { nombre: 'Reportei — informes y dashboards de marketing', url: 'https://reportei.com/es/', leida: '2026-11-14' },
  metaTitle: 'Dashboard de MaKo: crea informes y dashboards de marketing digital y ventas, pidiéndoselos a MaKo',
  metaDesc: `Reúne ${N_FUENTES} fuentes de datos de tu negocio en una sola pantalla: tus anuncios de Meta, tu landing y tu VSL, tu CRM, tus pagos, tus llamadas y tus automatizaciones.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Informes de tu marketing y tus ventas',
      titulo: 'Crea <em>informes</em> y <em>dashboards</em> de marketing digital y ventas, pidiéndoselos a MaKo',
      bajada: `Reúne <strong>${N_FUENTES} fuentes de datos</strong> de tu negocio en una sola pantalla: tus anuncios de Meta, tu landing y tu VSL, tus leads del CRM, tus pagos, tus llamadas grabadas, tus mensajes de WhatsApp y tus automatizaciones.`,
      // Los dos primeros, el segundo párrafo; el tercero, la línea en negrita de debajo de la píldora (su «¡Forma parte…!»).
      puntos: [
        'Crea dashboards e informes de todos tus canales.',
        'Recibe análisis con IA, pídele a MaKo el gráfico que te falte, conecta tus datos a tu propia IA por la API de MaKo y compártelos con un link.',
        `¡Empieza con uno de los ${TABLEROS_LISTOS.length} tableros listos!`,
      ],
      visual: { tipo: 'detalle', slug: 'dashboard' },
    },
    {
      tipo: 'logos',
      titulo: 'Integración con',
      items: [
        { logo: 'integraciones/meta.svg', nombre: 'Meta Ads' },
        { logo: 'integraciones/instagram.png', nombre: 'Instagram' },
        { logo: 'integraciones/facebook.png', nombre: 'Facebook' },
        { logo: 'landing.svg', nombre: 'Tu landing' },
        { logo: 'panda.png', nombre: 'Tu VSL' },
        { logo: 'integraciones/calendly.png', nombre: 'Calendly' },
        { logo: 'integraciones/calcom.png', nombre: 'Cal.com' },
        { logo: 'integraciones/zoom.svg', nombre: 'Zoom' },
        { logo: 'integraciones/fathom.png', nombre: 'Fathom' },
        { logo: 'integraciones/whatsapp.svg', nombre: 'WhatsApp' },
      ],
    },
    {
      // La caja celeste (su «Más de 10.000 empresas… usan Reportei»): los tableros corren donde iban sus logos y el video es
      // «Nueva hoja» grabada en MaKo. El `texto` de cada uno es su emoji.
      tipo: 'tarjetas',
      cta: true,
      titulo: `<em>${TABLEROS_LISTOS.length} tableros listos</em> para tus ventas, tus anuncios, tus llamadas y tus cobros: <em>eliges uno y entra con tus números</em>`,
      items: TABLEROS_LISTOS.map((t) => ({ titulo: t.nombre, texto: t.emoji })),
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: '<em>¡Deja de perder tiempo</em> con informes y dashboards hechos a mano y <em>gana productividad!</em>',
      // Las siete pastel en su orden (ancha, ancha, tres altas, ancha, ancha) y las dos de borde fino. En las finas, `titulo` es la
      // marca, `texto` el título y `meta` el párrafo.
      items: [
        { icono: I.hoja, titulo: 'Informe', texto: `Informes que transforman tus datos en estrategia, con ${N_TIPOS} tipos de gráfico` },
        { icono: I.panel, titulo: 'Dashboard', texto: 'Un panel para seguir tus resultados, que diseñas a tu manera' },
        { icono: I.compartir, titulo: 'Compartir', texto: 'Comparte tu informe con un link o descárgalo en PDF' },
        { icono: I.control, titulo: 'Control', texto: 'Sigue tu meta del trimestre y lo que está en rojo' },
        { icono: I.vence, titulo: 'Lo que vence', texto: 'Las tareas y los proyectos de tu Plan, con su fecha' },
        { icono: I.general, titulo: 'General', texto: 'Los principales indicadores de todo tu negocio en una sola pantalla' },
        { icono: I.ia, titulo: 'MaKo AI', texto: 'Le pides un gráfico o un cambio en palabras, y MaKo lo arma' },
        { icono: I.analisis, titulo: 'Hojas de análisis', texto: 'Tus áreas, analizadas con IA', meta: 'Ads, Closing (tus llamadas de Fathom con el método SPIN), VSL, Chat y CS Analyst, cada una en su hoja.' },
        { icono: I.api, titulo: 'API de MaKo', texto: 'Tus datos en los asistentes de IA', meta: 'Consulta tus números desde tu propio chat de IA, con la API de MaKo.' },
      ],
    },
    {
      // La banda azul: el título, el texto y la grilla de íconos de lo que lee (los de la franja de arriba).
      tipo: 'filas',
      titulo: 'Los indicadores de <em>todos tus canales</em> en una sola pantalla',
      bajada: 'Consulta en una sola pantalla los principales indicadores de: Meta Ads, Instagram, Facebook, tu landing, tu VSL, tus leads del CRM, tus pagos, tus agendas de Calendly y Cal.com, tus llamadas de Zoom y Fathom, WhatsApp y tus automatizaciones.',
      slug: 'dashboard',
      items: [],
    },
    {
      // «Conoce la herramienta»: una pestaña por tablero, con su grabación en la ventana del navegador y su párrafo.
      tipo: 'pasos',
      titulo: 'Conoce la herramienta',
      pasos: [
        { titulo: 'General', texto: 'El mes de todo tu negocio en una pantalla: lo cobrado, lo invertido en anuncios, las agendas y los cierres, tu meta del trimestre y lo que te está esperando hoy.' },
        { titulo: 'Marketing', texto: 'Tus anuncios de Meta, de la impresión a la agenda: cuánto invertiste, cuánto te costó cada lead y cada agenda, y qué anuncio trajo más.' },
        { titulo: 'Comercial', texto: 'Tus ventas del CRM: de cuántas agendas salieron tus cierres, cuánto vendiste, tu tasa de cierre y por qué no cerró el resto.' },
        { titulo: 'Closing', texto: 'Tus llamadas de venta, analizadas: cómo terminaron, cuánto cierra cada closer y cuál es tu próxima llamada.' },
      ],
    },
    { tipo: 'caso' },
  ],
};
