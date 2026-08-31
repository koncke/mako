// =============================================================================
// El catálogo de cursos — FUENTE ÚNICA
// =============================================================================
// Lo consumen los DOS lados de /conocimientos:
//   • el portal del admin (`Conocimientos.tsx`), que lista y abre;
//   • el link compartido (`app/compartido/[token]/page.tsx`), que resuelve el
//     slug de un share `recurso='curso'`.
//
// Vive acá porque cada uno tenía su propia lista y se desincronizaron: el
// compartido armaba `[...CURSOS, CURSO_VSL]` y el portal seis fuentes. Los dos
// cursos que faltaban ("Curso de Claude AI - Rodrigo Rojo" y "Construir la
// app") se podían compartir desde la UI y su link daba **404**, sin ningún
// síntoma del lado del admin: el share se creaba bien, la fila estaba viva, y
// el 404 salía del `notFound()` del final de la búsqueda. Cada curso nuevo
// entraba roto por default.
//
// ⚠️ Un curso nuevo se suma ACÁ y en ningún otro lado.

import { CURSOS, type Curso, type Recurso } from './curso';
import { CURSO_VSL } from './curso-vsl';
import { CURSO_PRODUCTO_APP } from './curso-producto-app';
import { CURSO_AVATAR_APP } from './curso-avatar-app';
import { CURSO_CLAUDE_AI_RODRIGO_ROJO } from './curso-claude-ai-rodrigo-rojo';
import { CURSO_AUMENTA_TU_VALOR_Y_ATV_ADVANTAGE } from './curso-aumenta-tu-valor-y-atv-advantage';
import { CURSO_SELL_YOUR_KNOWLEDGE } from './curso-sell-your-knowledge';
import { CURSO_INTELIGENCIA_VIRAL_2026 } from './curso-inteligencia-viral-2026';
import { CURSO_M5_95 } from './curso-m5-95';
import { CURSO_VENDER_POR_FB_E_IG_ADS } from './curso-vender-por-fb-e-ig-ads';
import { CURSO_MANYCHAT_MASTER_INSTAGRAM } from './curso-manychat-master-instagram';
import { CURSO_JAQUE_BLUE_CREACION_DE_CONTENIDO } from './curso-jaque-blue-creacion-de-contenido';
import { CURSO_100M_MONEY_MODELS } from './curso-100m-money-models';
import { CURSO_MATEO_MAFFIA_BYF } from './curso-mateo-maffia-byf';
import { CURSO_MASTER_MARCA_PERSONAL_5_0 } from './curso-master-marca-personal-5-0';
import { CURSO_SOCIAL_FUNNEL } from './curso-social-funnel';
import { CURSO_UGC_SIM_ACADEMY_DE_MINDSHFT } from './curso-ugc-sim-academy-de-mindshft';
import { CURSO_HACKEANDO_LA_EDICION } from './curso-hackeando-la-edicion';
import { CURSO_PROGRAMA_RAIO } from './curso-programa-raio';
import { CURSO_BIGSEO_ACADEMY } from './curso-bigseo-academy';
import { CURSO_BLUEHACKER } from './curso-bluehacker';
import { CURSO_MASTERYHAUS } from './curso-masteryhaus';
import { CURSO_STORIES_MASTER } from './curso-stories-master';
import { CURSO_CLAUDE_ACADEMY_2026 } from './curso-claude-academy-2026';
import { CURSO_CURSOS_HEYGEN } from './curso-cursos-heygen';
import { CURSO_METODO_FUKUDA_PODER_ORGANICO } from './curso-metodo-fukuda-poder-organico';
import { CURSO_IMAN_GADZHI_AGENCY_NAVIGATOR } from './curso-iman-gadzhi-agency-navigator';
import { CURSO_CERTIFICACION_MARKETING_DIGITAL_IA } from './curso-certificacion-marketing-digital-ia';
import { CURSO_NUEVO_ORGANIC_ECOM_3_0_JUNIO_2026 } from './curso-nuevo-organic-ecom-3-0-junio-2026';
import { CURSO_AMORIR } from './curso-amorir';
import { CURSO_INSTITUTO_DE_COMUNICACION } from './curso-instituto-de-comunicacion';
import { CURSO_CREATOR_CLUB } from './curso-creator-club';
import { CURSO_TRILOGIA_DE_BRIAN_TRACY } from './curso-trilogia-de-brian-tracy';
import { CURSO_CREATIVOS_UGC_REALISTAS } from './curso-creativos-ugc-realistas';
import { CURSO_21_TECNICAS_PARA_INVERTIR_EN_BIENES_RAICES } from './curso-21-tecnicas-para-invertir-en-bienes-raices';
import { CURSO_AUTOMATIZACION_Y_MONETIZACION_DE_YOUTOBE } from './curso-automatizacion-y-monetizacion-de-youtobe';
import { CURSO_AUTOMATIZATUBE } from './curso-automatizatube';
import { CURSO_BOOTCAMP_DE_CIERRE_DE_VENTAS_IA } from './curso-bootcamp-de-cierre-de-ventas-ia';
import { CURSO_CODIGO_GENIO } from './curso-codigo-genio';
import { CURSO_DESARROLLA_TU_INFLUENCER_VIRTUAL } from './curso-desarrolla-tu-influencer-virtual';
import { CURSO_IMAN_GADZHI_8_FIGURE_PERSONAL_BRAND } from './curso-iman-gadzhi-8-figure-personal-brand';
import { CURSO_LEGALMENTE_EMPRENDEDOR } from './curso-legalmente-emprendedor';
import { CURSO_MEGADATA_DE_UN_JOVEN_EMPREDEDOR } from './curso-megadata-de-un-joven-emprededor';
import { CURSO_MONETIZATUBE } from './curso-monetizatube';
import { CURSO_SEMINARIOS_ALEJANDRO_CARDONA } from './curso-seminarios-alejandro-cardona';
import { CURSO_THE_REAL_WORLD } from './curso-the-real-world';
import { CURSO_US30_2_0 } from './curso-us30-2-0';
import { CURSO_21_DIAS_DE_GRATITUD } from './curso-21-dias-de-gratitud';
import { CURSO_ACADEMIA_MAV } from './curso-academia-mav';
import { CURSO_AVATAR_MASTERY } from './curso-avatar-mastery';
import { CURSO_CHATGPT_IA_MASTERY } from './curso-chatgpt-ia-mastery';
import { CURSO_COMO_VENDER_COMO_UN_GLADIADOR_ROMANO } from './curso-como-vender-como-un-gladiador-romano';
import { CURSO_CURSOS_PRO_JIMMY_NARAINE } from './curso-cursos-pro-jimmy-naraine';
import { CURSO_DINERO_INTELIGENTE_LA_RUTA_AL_EXITO_FINANCIERO } from './curso-dinero-inteligente-la-ruta-al-exito-financiero';
import { CURSO_EDICION_DE_VIDEO_EN_CAPCUT } from './curso-edicion-de-video-en-capcut';
import { CURSO_ELEVA_TU_VIDA_CON_IA } from './curso-eleva-tu-vida-con-ia';
import { CURSO_FBA_AGENCY } from './curso-fba-agency';
import { CURSO_MENTORIA_D60 } from './curso-mentoria-d60';
import { CURSO_MINDSET_MILLONARIO } from './curso-mindset-millonario';
import { CURSO_N8N_VIRAL_MACHINE } from './curso-n8n-viral-machine';
import { CURSO_NEGOCIA_CON_CONFIANZA } from './curso-negocia-con-confianza';
import { CURSO_TERMUX_HACKING_PARA_PRINCIPIANTES_2026 } from './curso-termux-hacking-para-principiantes-2026';
import { CURSO_THE_REAL_WOLF } from './curso-the-real-wolf';
import { CURSO_TRADING_CLUTIFX } from './curso-trading-clutifx';
import { CURSO_VIVE_VENDIENDO } from './curso-vive-vendiendo';
import { CURSO_TRADING_ARELIS_RODRIGUEZ_2025 } from './curso-trading-arelis-rodriguez-2025';
import { CURSO_ESCUELA_TU_PRIMER_MILLON } from './curso-escuela-tu-primer-millon';
import { CURSO_MENTORIA_4K } from './curso-mentoria-4k';
import { CURSO_EDITA_COMO_UN_PRO } from './curso-edita-como-un-pro';
import { CURSO_EXPERTO_EN_CHATGPT } from './curso-experto-en-chatgpt';
import { CURSO_HACKEANDO_EL_ALGORITMO } from './curso-hackeando-el-algoritmo';
import { CURSO_TU_1_MILLON } from './curso-tu-1-millon';
import { CURSO_COMPLETO_VIDEOS_IA } from './curso-completo-videos-ia';
import { CURSO_360_MARCA_PERSONAL } from './curso-360-marca-personal';
import { CURSO_CODIGO_MILLONARIO } from './curso-codigo-millonario';
import { CURSO_ECOMMERCE_DE_ARZ_URUS } from './curso-ecommerce-de-arz-urus';
import { CURSO_TUMADREANNA_MARKETING_DEFINITIVO } from './curso-tumadreanna-marketing-definitivo';
import { CURSO_ACADEMIA_FIVE_STARS } from './curso-academia-five-stars';
import { CURSO_MONETIZA_CON_JOHAN_IA } from './curso-monetiza-con-johan-ia';
import { CURSO_LA_UNIVERSIDAD_DEL_CLOSER } from './curso-la-universidad-del-closer';
import { CURSO_EMPRENDE_CON_INSTAGRAM } from './curso-emprende-con-instagram';
import { CURSO_MASTER_EN_IA } from './curso-master-en-ia';
import { CURSO_ECOMMERCE_FULL_2_0 } from './curso-ecommerce-full-2-0';
import { CURSO_FOTOGRAFIA_AL_COMPLETO_DE_0_A_PRO_2025 } from './curso-fotografia-al-completo-de-0-a-pro-2025';
import { CURSO_TALLER_CAPCUT_PRO_GG } from './curso-taller-capcut-pro-gg';
import { CURSO_CARRERA_DE_ECOMMERCE } from './curso-carrera-de-ecommerce';
import { CURSO_BLACK_BOX_CANVA } from './curso-black-box-canva';
import { CURSO_GROWING_AMG } from './curso-growing-amg';
import { CURSO_ECOM_TOTAL_2_0 } from './curso-ecom-total-2-0';
import { CURSO_MASTER_MARCA_PERSONAL_4_0 } from './curso-master-marca-personal-4-0';
import { CURSO_AUTOMATIZA_TU_WHATSAPP } from './curso-automatiza-tu-whatsapp';
import { CURSO_IMPERIO_AFILIADO } from './curso-imperio-afiliado';
import { CURSO_ACADEMIA_DEL_SENSEI } from './curso-academia-del-sensei';
import { CURSO_GROWING_SETTERS_3_0 } from './curso-growing-setters-3-0';
import { CURSO_INSTITUTO_DE_MARCA_PERSONAL } from './curso-instituto-de-marca-personal';
import { CURSO_UDIA } from './curso-udia';
import { CURSO_CLUB_DE_NEGOCIOS } from './curso-club-de-negocios';
import { CURSO_ECOMMERCE_0_A_17_MILLONES } from './curso-ecommerce-0-a-17-millones';
import { CURSO_ACADEMIA_DE_LANZAMIENTO } from './curso-academia-de-lanzamiento';
import { CURSO_BELIKETHEALGO } from './curso-belikethealgo';
import { CURSO_GROWTH_PARTNER } from './curso-growth-partner';
import { RECURSOS_UGC } from './curso-ugc-recursos';
import { CURSO_ANALISIS } from './AnalisisNegocio.datos';
import { CURSO_BRANDING } from './BrandingMaKo.datos';

/**
 * La sección de lo PROPIO: método, marca y criterios de la casa.
 *
 * Tiene nombre porque se usa en dos lugares —el mapa de abajo y el filtro de lo
 * compartible— y un literal repetido en los dos se desincroniza el día que
 * alguien renombre la sección: el mapa quedaría bien y el filtro dejaría de
 * excluir nada, sin que nada avise.
 */
export const CATEGORIA_PROPIA = 'MaKo';

/**
 * Cómo se agrupan los cursos en el selector, por slug.
 *
 * ⚠️ Vive ACÁ y no en cada curso porque CUATRO de ellos (`avatarhype`, `masteryhaus`,
 * `anuncio-ganador`, `100ads-analisis`) están dentro de `curso.ts`, que no tiene
 * generador propio: se mantiene a mano y no hay script que le vuelva a escribir la
 * categoría. Acá queda además UN solo lugar donde se lee el mapa completo de secciones
 * en vez de nueve archivos.
 *
 * ⚠️ Y NO pongas acá un curso que tenga archivo propio: el override de este mapa GANA
 * sobre lo que el archivo declara, así que una regeneración con otra categoría no se
 * vería. `bluehacker` salió de acá el 22/08/2026 al migrar a `curso-bluehacker.ts`.
 *
 * (El texto anterior decía que `curso.ts` es «auto-generado». Es FALSO: ningún script
 * lo escribe. La razón real de que estos datos vivan acá es que no hay generador que
 * los emita, no que se pierdan. Ver docs/hallazgos-conocimiento.md.)
 *
 * Un curso que no esté en el mapa conserva la categoría que trae — no se le inventa
 * una ni se lo manda a un cajón «Otros».
 */
const CATEGORIA: Record<string, string> = {
  // Cursos de terceros sobre el negocio digital
  'aumenta-tu-valor-y-atv-advantage': 'Negocios digitales',
  'sell-your-knowledge': 'Negocios digitales',
  // IA y generación de piezas
  'claude-ai-rodrigo-rojo': 'Inteligencia Artificial',
  // Publicidad paga
  'anuncio-ganador': 'Anuncios',
  // Alcance sin pauta
  'inteligencia-viral-2026': 'Orgánico',
  // Agency Incubator es armar y vender una agencia de servicios: prospección, ventas y
  // entrega. Va con los otros dos de negocio y no en «Cursos externos», que agrupa por
  // procedencia y no por lo que alguien viene a buscar.
  'iman-gadzhi-agency-navigator': 'Negocios digitales',
  // El de Fukuda es de afiliación en Hotmart, pero lo que ENSEÑA —y lo que le da el
  // nombre— es tráfico orgánico: un módulo entero de introducción, otro de lanzamientos
  // orgánicos y los bonos de Instagram y YouTube. Va con Inteligencia Viral y no en una
  // sección «Afiliados» propia: una sección de un solo curso agrupa por modelo de negocio
  // y no por lo que alguien viene a buscar, que es el criterio de este mapa.
  'metodo-fukuda-poder-organico': 'Orgánico',
  // Posicionamiento en buscadores. Sección propia y no «Orgánico»: las dos son tráfico
  // que no se paga por click, pero el que busca SEO busca SEO — la disciplina, sus
  // herramientas y su vocabulario— y no «lo que no es pauta». Decisión del dueño.
  // El SEO pasa a «Orgánico» por decisión de Martín (29/08): las dos son tráfico que no
  // se paga por click, y con un solo curso la sección propia no se sostenía. Con esto la
  // sección «SEO» deja de existir — era este curso y nada más.
  'bigseo-academy': 'Orgánico',
  // Trabajar sobre uno mismo: voz, comunicación, presencia. Decisión del dueño.
  'instituto-de-comunicacion': 'Desarrollo personal',
  // Edición de video, junto al de Guille Collado.
  'creator-club': 'Edición',
  // Idiomas. Sección propia y no «Cursos externos» (el default que emite el pipeline):
  // un curso de inglés no comparte criterio de búsqueda con ninguna otra sección, y el
  // cajón «externos» agrupa por PROCEDENCIA, que no es lo que nadie viene a buscar.
  'programa-raio': 'Idiomas',
  // Lo propio: método, marca y criterios de la casa
  '100ads-analisis': CATEGORIA_PROPIA,
  'vsl-landing': CATEGORIA_PROPIA,
  'analisis-negocio': CATEGORIA_PROPIA,
  'branding-mako': CATEGORIA_PROPIA,
  'construir-app': CATEGORIA_PROPIA,
  'avatares-que-se-parecen': CATEGORIA_PROPIA,
  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  '100m-money-models': 'Negocios digitales', // decisión de Martín (29/08); la plataforma decía Ventas
  '21-tecnicas-para-invertir-en-bienes-raices': 'Finanzas', // Finanzas / Inversiones
  'amorir': 'Desarrollo personal',         // Desarrollo personal
  'automatizacion-y-monetizacion-de-youtobe': 'Orgánico', // Auto Youtube
  'automatizatube': 'Orgánico',            // Auto Youtube
  'bootcamp-de-cierre-de-ventas-ia': 'Ventas', // Ventas
  'claude-academy-2026': 'Inteligencia Artificial', // IA
  'codigo-genio': 'Desarrollo personal',   // Desarrollo personal
  'cursos-heygen': 'Inteligencia Artificial', // IA
  'desarrolla-tu-influencer-virtual': 'Inteligencia Artificial', // IA
  'hackeando-la-edicion': 'Edición',       // Edición de Video
  // ⚠️ «Lanzamientos» YA NO EXISTE como sección: decisión de Martín (29/08). Sus dos
  //    cursos pasan a «Orgánico», que es donde vive lo de construir audiencia y alcance
  //    sin pauta. Si alguien la vuelve a crear, que sea con más de un curso adentro.
  'iman-gadzhi-8-figure-personal-brand': 'Orgánico', // era Lanzamientos
  'jaque-blue-creacion-de-contenido': 'Orgánico', // Redes Sociales
  'm5-95': 'Anuncios',                     // ADS
  'manychat-master-instagram': 'Orgánico', // Redes Sociales
  'master-marca-personal-5-0': 'Orgánico', // Victor Heras · decisión de Martín (29/08)
  'mateo-maffia-byf': 'Orgánico',          // Redes Sociales
  'monetizatube': 'Orgánico',              // Auto Youtube
  'nuevo-organic-ecom-3-0-junio-2026': 'Ecommerce', // Ecommerce
  'seminarios-alejandro-cardona': 'Finanzas', // auditoría 30/08: bolsa, acciones y ETFs
  'social-funnel': 'Negocios digitales',   // Emilio Puigrredón · decisión de Martín (29/08)
  'stories-master': 'Orgánico',            // decisión de Martín (29/08)
  'the-real-world': 'Negocios digitales',  // Agencias
  'trilogia-de-brian-tracy': 'Desarrollo personal', // decisión de Martín (29/08)
  'ugc-sim-academy-de-mindshft': 'Inteligencia Artificial', // IA
  'vender-por-fb-e-ig-ads': 'Anuncios',    // ADS

  // Los cinco que la plataforma NO resuelve: o no los conoce, o los mandó a «Diferentes»,
  // que es otro cajón por descarte. Con cinco se puede preguntarle al MATERIAL, que es lo
  // que manda sobre la etiqueta que le puso un sistema. El comentario dice de dónde salió
  // cada uno: si mañana alguien discute una, tiene el criterio y no una decisión muda.
  'certificacion-marketing-digital-ia': 'Negocios digitales', // decisión de Martín (29/08)
  'creativos-animados': 'Inteligencia Artificial', // es la 2a academia de AvatarHype, que ya está ahí
  'legalmente-emprendedor': 'Finanzas',    // decisión de Martín (29/08)
  'megadata-de-un-joven-emprededor': 'Desarrollo personal', // hábitos, entorno, «el tiempo es dinero»
  // ⚠️ Este NO se dedujo del nombre. «US30» es el ticker del Dow Jones, pero un ticker en
  //    un título es un parecido; la clase 1 dice «en la parte del Dow Jones», «al ser un
  //    mercado de negociaciones», «por la oferta y la demanda». Eso sí es el material
  //    hablando de sí mismo.
  'us30-2-0': 'Finanzas',
  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  '21-dias-de-gratitud': 'Desarrollo personal', // Desarrollo personal
  'academia-mav': 'Desarrollo personal',   // Desarrollo personal
  'chatgpt-ia-mastery': 'Inteligencia Artificial', // IA
  'cursos-pro-jimmy-naraine': 'Negocios digitales', // auditoría 30/08: cómo crear y lanzar TU curso
  'dinero-inteligente-la-ruta-al-exito-financiero': 'Finanzas', // Finanzas / Inversiones
  'edicion-de-video-en-capcut': 'Edición', // Edición de Video
  'eleva-tu-vida-con-ia': 'Inteligencia Artificial', // IA
  'fba-agency': 'Ecommerce',               // Ecommerce
  // ⚠️ ESTOS DOS LOS CORRIGIÓ EL MATERIAL: la plataforma los tenía en «Ecommerce» y no
  //    tienen UNA sola clase de ecommerce. Es la regla de que lo que un curso dice de sí
  //    mismo le gana a la etiqueta que le puso otro sistema — el `category` de la
  //    plataforma es el DATO por default, no un oráculo. Revisadas las 66 fichas contra
  //    sus títulos de clase, estas dos eran las únicas que se contradecían de plano.
  'mindset-millonario': 'Desarrollo personal', // «QUE ES MINDSET», «Mindset POBRE vs RICO», «Afronta tus MIEDOS»
  // Va con los otros tres de contenido automatizado sin cara (AutomatizaTube,
  // MonetizaTube, Automatización y Monetización de YouTube) y no en «Inteligencia
  // Artificial»: la herramienta es n8n, pero lo que alguien viene a buscar es alcance sin
  // pauta. Discutible; si se mueve, que se mueva con sus tres hermanos.
  'n8n-viral-machine': 'Orgánico',         // «Automatización de Contenido Viral Faceless»
  'negocia-con-confianza': 'Desarrollo personal', // auditoría 30/08: juego interior y conversaciones difíciles
  'termux-hacking-para-principiantes-2026': 'Ciberseguridad', // Ciberseguridad
  'the-real-wolf': 'Ventas', // auditoría 30/08: Belfort: ventas, persuasión y negociación
  'vive-vendiendo': 'Ventas',              // Ventas

  // Tanda del 29/08 que la plataforma NO conoce. Misma regla que los de arriba: los decide
  // el MATERIAL, y al lado va de qué título de clase salió cada uno.
  'avatar-mastery': 'Inteligencia Artificial', // «influencers digitales», «CivitAI»
  'como-vender-como-un-gladiador-romano': 'Ventas', // «¿Qué es la Venta», «Ventas Como Modo De Vida»
  'mentoria-d60': 'Desarrollo personal',   // «claridad mental», «domina tus hábitos», «RutiMax»
  'trading-clutifx': 'Finanzas',           // «BIAS», «entradas», «time»
  'trading-arelis-rodriguez-2025': 'Finanzas', // con sus hermanos: us30 y clutifx

  // Tanda del 29/08 (segunda vuelta). Los dos primeros los decide su material; los dos de
  // abajo son secciones de UN curso que Martín ya había mandado a «Orgánico», y volvieron
  // solas con el curso siguiente porque el mapeo del script no guardaba esa decisión. Ya
  // está arreglado ahí (ver EQUIVALE en curso-categoria-portada.mjs); esto los mueve.
  'completo-videos-ia': 'Inteligencia Artificial', // «Introducción a la IA», modelos de video
  'ecommerce-de-arz-urus': 'Ecommerce',    // lo dice el título
  '360-marca-personal': 'Orgánico',        // era «Marca personal», sección de un solo curso
  'codigo-millonario': 'Orgánico',         // era «Afiliados» — mismo criterio que el método Fukuda
  // La plataforma lo tenia en «Marketing» y quedaba solo ahi, recreando una seccion de un
  // curso. Sus clases son ManyChat, «viral con TUMADRE» y «como conseguir ideas virales»:
  // va con ManyChat Master Instagram, en Organico.
  'tumadreanna-marketing-definitivo': 'Orgánico',
  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'escuela-tu-primer-millon': 'Negocios digitales', // Hustlers

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'mentoria-4k': 'Negocios digitales', // auditoría 30/08: infoproducto y embudos, no hay tienda

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'edita-como-un-pro': 'Edición',          // Edición de Video

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'experto-en-chatgpt': 'Inteligencia Artificial', // IA

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'hackeando-el-algoritmo': 'Orgánico',    // era Lanzamientos (ver arriba)

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'tu-1-millon': 'Negocios digitales', // auditoría 30/08: escalar coaching online, no inversiones


  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'academia-five-stars': 'Ventas',         // Ventas

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'monetiza-con-johan-ia': 'Orgánico', // auditoría 30/08: TikTok Shop y creadores, sin pauta (el origen decía ADS)

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'la-universidad-del-closer': 'Ventas',      // lo pidio Martin: es closing, no ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'emprende-con-instagram': 'Orgánico',    // Redes Sociales

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'master-en-ia': 'Inteligencia Artificial', // IA

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'ecommerce-full-2-0': 'Ecommerce',       // Ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'taller-capcut-pro-gg': 'Edición',       // Edición de Video

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'carrera-de-ecommerce': 'Ecommerce',     // Ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  // Canva y fotografía son producción de piezas: van con edición de video, que es donde
  // alguien busca «cómo hago que esto se vea bien». Decisión de Martín (30/08).
  // La guarda los marcó a los dos —uno como sección de un curso y el otro en el cajón—,
  // pero el aviso queda en el log y lo vio él primero.
  'fotografia-al-completo-de-0-a-pro-2025': 'Edición',
  'black-box-canva': 'Edición',          // Marketing

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'growing-amg': 'Negocios digitales',     // Agencias

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'ecom-total-2-0': 'Ecommerce',           // Ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'master-marca-personal-4-0': 'Orgánico', // Marca Personal

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'automatiza-tu-whatsapp': 'Ventas',      // auditoría 30/08: ManyChat y secuencias que convierten

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'imperio-afiliado': 'Orgánico',          // Afiliados

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'academia-del-sensei': 'Finanzas',       // Trading
  'growing-setters-3-0': 'Ventas',         // appointment setting y ventas high ticket, no ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'instituto-de-marca-personal': 'Orgánico', // Marca Personal

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'udia': 'Inteligencia Artificial',       // IA

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'club-de-negocios': 'Ecommerce',         // Ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'ecommerce-0-a-17-millones': 'Ecommerce', // Ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'academia-de-lanzamiento': 'Orgánico',   // Lanzamientos

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'belikethealgo': 'Finanzas',             // Trading

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'growth-partner': 'Ecommerce',           // Ecommerce

};

/**
 * Miniatura de los cursos que NO la declaran en su propio archivo.
 *
 * Misma razón que `CATEGORIA`: estos cursos viven en `curso.ts`, que es auto-generado,
 * así que el dato se pierde si se escribe ahí. Los cursos del pipeline sí la declaran
 * solos (`curso-a-portal.mjs` la emite cuando el archivo existe).
 *
 * Las tres son las tapas REALES, que las pasó el dueño. Antes de eso hubo dos
 * intentos peores y conviene que quede escrito: la del catálogo de la plataforma
 * traía el logo del sitio en vez de la tapa, y para las que no existían en ningún
 * lado se generó una tipográfica con la marca de la casa — mejor que buscar en un
 * buscador una imagen que no se puede verificar, pero peor que la de verdad.
 *
 * ⚠️ La extensión importa y no es libre: sale de los BYTES del archivo, no del
 * nombre. `Bluehackers.webp` era webp de verdad, pero `AvatarHype.jpg` podría no
 * haberlo sido — un `.jpg` que en realidad es webp no lo pinta bien ningún navegador.
 *
 * Los cursos de la sección MaKo van a propósito SIN miniatura.
 */
const PORTADA: Record<string, string> = {
  'anuncio-ganador': '/cono-portadas/anuncio-ganador.jpg',
  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  '21-tecnicas-para-invertir-en-bienes-raices': '/cono-portadas/21-tecnicas-para-invertir-en-bienes-raices.jpg',
  'automatizacion-y-monetizacion-de-youtobe': '/cono-portadas/automatizacion-y-monetizacion-de-youtobe.png',
  'automatizatube': '/cono-portadas/automatizatube.png',
  'bootcamp-de-cierre-de-ventas-ia': '/cono-portadas/bootcamp-de-cierre-de-ventas-ia.jpg',
  'codigo-genio': '/cono-portadas/codigo-genio.jpg',
  'desarrolla-tu-influencer-virtual': '/cono-portadas/desarrolla-tu-influencer-virtual.jpg',
  'iman-gadzhi-8-figure-personal-brand': '/cono-portadas/iman-gadzhi-8-figure-personal-brand.png',
  'legalmente-emprendedor': '/cono-portadas/legalmente-emprendedor.png',
  'megadata-de-un-joven-emprededor': '/cono-portadas/megadata-de-un-joven-emprededor.png',
  'monetizatube': '/cono-portadas/monetizatube.png',
  'the-real-world': '/cono-portadas/the-real-world.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  '21-dias-de-gratitud': '/cono-portadas/21-dias-de-gratitud.jpg',
  'academia-mav': '/cono-portadas/academia-mav.jpg',
  'chatgpt-ia-mastery': '/cono-portadas/chatgpt-ia-mastery.jpg',
  'como-vender-como-un-gladiador-romano': '/cono-portadas/como-vender-como-un-gladiador-romano.png',
  'cursos-pro-jimmy-naraine': '/cono-portadas/cursos-pro-jimmy-naraine.jpg',
  'dinero-inteligente-la-ruta-al-exito-financiero': '/cono-portadas/dinero-inteligente-la-ruta-al-exito-financiero.jpg',
  'edicion-de-video-en-capcut': '/cono-portadas/edicion-de-video-en-capcut.jpg',
  'eleva-tu-vida-con-ia': '/cono-portadas/eleva-tu-vida-con-ia.jpg',
  'fba-agency': '/cono-portadas/fba-agency.jpg',
  'mentoria-d60': '/cono-portadas/mentoria-d60.jpg',
  'mindset-millonario': '/cono-portadas/mindset-millonario.jpg',
  'n8n-viral-machine': '/cono-portadas/n8n-viral-machine.jpg',
  'negocia-con-confianza': '/cono-portadas/negocia-con-confianza.jpg',
  'termux-hacking-para-principiantes-2026': '/cono-portadas/termux-hacking-para-principiantes-2026.jpg',
  'the-real-wolf': '/cono-portadas/the-real-wolf.png',
  'vive-vendiendo': '/cono-portadas/vive-vendiendo.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'escuela-tu-primer-millon': '/cono-portadas/escuela-tu-primer-millon.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'mentoria-4k': '/cono-portadas/mentoria-4k.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'edita-como-un-pro': '/cono-portadas/edita-como-un-pro.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'experto-en-chatgpt': '/cono-portadas/experto-en-chatgpt.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'hackeando-el-algoritmo': '/cono-portadas/hackeando-el-algoritmo.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'tu-1-millon': '/cono-portadas/tu-1-millon.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  '360-marca-personal': '/cono-portadas/360-marca-personal.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'codigo-millonario': '/cono-portadas/codigo-millonario.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'tumadreanna-marketing-definitivo': '/cono-portadas/tumadreanna-marketing-definitivo.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'academia-five-stars': '/cono-portadas/academia-five-stars.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'monetiza-con-johan-ia': '/cono-portadas/monetiza-con-johan-ia.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'la-universidad-del-closer': '/cono-portadas/la-universidad-del-closer.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'emprende-con-instagram': '/cono-portadas/emprende-con-instagram.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'master-en-ia': '/cono-portadas/master-en-ia.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'ecommerce-full-2-0': '/cono-portadas/ecommerce-full-2-0.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'taller-capcut-pro-gg': '/cono-portadas/taller-capcut-pro-gg.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'carrera-de-ecommerce': '/cono-portadas/carrera-de-ecommerce.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'black-box-canva': '/cono-portadas/black-box-canva.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'growing-amg': '/cono-portadas/growing-amg.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'ecom-total-2-0': '/cono-portadas/ecom-total-2-0.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'master-marca-personal-4-0': '/cono-portadas/master-marca-personal-4-0.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'automatiza-tu-whatsapp': '/cono-portadas/automatiza-tu-whatsapp.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'avatar-mastery': '/cono-portadas/avatar-mastery.jpg',
  'completo-videos-ia': '/cono-portadas/completo-videos-ia.jpg',
  'ecommerce-de-arz-urus': '/cono-portadas/ecommerce-de-arz-urus.jpg',
  'fotografia-al-completo-de-0-a-pro-2025': '/cono-portadas/fotografia-al-completo-de-0-a-pro-2025.jpg',
  'trading-arelis-rodriguez-2025': '/cono-portadas/trading-arelis-rodriguez-2025.jpg',
  'trading-clutifx': '/cono-portadas/trading-clutifx.jpg',
  'us30-2-0': '/cono-portadas/us30-2-0.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'imperio-afiliado': '/cono-portadas/imperio-afiliado.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'academia-del-sensei': '/cono-portadas/academia-del-sensei.png',
  'growing-setters-3-0': '/cono-portadas/growing-setters-3-0.jpg',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'instituto-de-marca-personal': '/cono-portadas/instituto-de-marca-personal.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'udia': '/cono-portadas/udia.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'club-de-negocios': '/cono-portadas/club-de-negocios.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'ecommerce-0-a-17-millones': '/cono-portadas/ecommerce-0-a-17-millones.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'academia-de-lanzamiento': '/cono-portadas/academia-de-lanzamiento.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'belikethealgo': '/cono-portadas/belikethealgo.png',

  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco
  // pero la ficha se había emitido antes de que existiera.
  'growth-partner': '/cono-portadas/growth-partner.png',

};

/**
 * Quién dicta cada curso, para los que NO lo declaran en su título.
 *
 * Vive acá por la misma razón que los dos mapas de arriba: estos cursos están en
 * `curso.ts`, que es auto-generado, y lo que se escriba ahí se pierde en la próxima
 * regeneración.
 *
 * ⚠️ La forma «Curso - Autor» NO se inventa acá: es la misma que produce el pipeline
 * en `curso-a-portal.mjs` (`tituloConAutor`), y por eso también repite su regla de no
 * duplicar cuando el título YA nombra al autor. Si las dos formas divergieran, la
 * grilla mostraría dos convenciones distintas según de dónde vino cada curso — que es
 * exactamente lo que este archivo existe para evitar.
 *
 * Los de la sección propia van sin autor: son de la casa.
 */
/**
 * El TÍTULO que se muestra, cuando el del pipeline no es el que corresponde.
 *
 * ⚠️ Va acá y no en la ficha por la misma razón que `CATEGORIA` y `AUTOR`:
 * `curso-a-portal.mjs` REESCRIBE `curso-<slug>.ts` en cada corrida, y arma el título
 * como «<curso del plan> - <autor>». Puesto allá, dura hasta la próxima publicación.
 *
 * Y el `curso` del plan NO se puede tocar para arreglarlo: es lo que nombra la carpeta
 * de Drive (`<Curso> - <Autor>`), así que cambiarlo manda el pipeline a una carpeta que
 * no existe y re-sube los 35 videos.
 *
 * AvatarHype es UN curso, no dos. Sus dos academias —«Creativos UGC Realistas» y
 * «Creativos Animados»— se publicaban como dos tarjetas separadas, y son el mismo
 * proveedor y el mismo material: ahora la segunda entra como un módulo más del curso
 * (ver la fusión en el plan) y la grilla muestra una sola tarjeta con su nombre real.
 */
const TITULO: Record<string, string> = {
  'creativos-ugc-realistas': 'AvatarHype',
  /**
   * ⚠️ EL CURSO NO ES EL QUE DICE SU NOMBRE, y el portal tiene que decir lo que el
   * material ES.
   *
   * La plataforma de origen lo publica como «Agency Navigator» y bajo ese slug se bajó.
   * Pero en los videos el propio Iman Gadzhi dice **«Agency Incubator»** —34 veces, en 22
   * de las 26 clases— y «Agency Navigator» no aparece NI UNA VEZ. Son dos productos
   * distintos de la misma persona: Incubator es el anterior y más barato.
   *
   * Y eso explica de paso los «14 huecos»: la numeración del autor llega a ~40 y hay 26,
   * lo que se lee como un Navigator incompleto. No lo es — es otro curso, completo o no,
   * pero otro. El diagnóstico obvio (curso mutilado) era el equivocado.
   *
   * El slug se deja como está: es el de la plataforma y cambiarlo rompería el link de
   * cualquiera que ya lo tenga. Lo que se corrige es lo que se LEE.
   */
  'iman-gadzhi-agency-navigator': 'Iman Gadzhi - Agency Incubator',
  /**
   * El plan de origen trae como autor «Convierte Más», que es la ESCUELA y no una persona,
   * así que la tarjeta salía sin nadie que la firme. Martín lo pidió el 29/08: «no le
   * pusiste nombre de la autora».
   *
   * El nombre no se dedujo de la marca ni se buscó afuera: lo dice el propio material, en
   * la clase de bienvenida — «Mi nombre es Vilma Núñez y es para mí un honor también ser
   * UNA DE LAS profesoras de este programa».
   *
   * Por eso queda la escuela entre paréntesis y no en su lugar: ella misma aclara que es
   * una de varias, y atribuirle 153 clases enteras sería afirmar de más.
   */
  'certificacion-marketing-digital-ia': 'Certificación en Marketing Digital potenciada por IA - Vilma Núñez (Convierte Más)',
};

const AUTOR: Record<string, string> = {
  masteryhaus: 'Sofía Contreras',
  bluehacker: 'Marcos Razzetti',
  'anuncio-ganador': 'Jan Schroeder',
};

/**
 * El título SIN el autor, para la portada del curso.
 *
 * La grilla y la barra de arriba muestran «Curso - Autor», que es lo correcto ahí: en una
 * lista de 91, saber de quién es distingue. Adentro del curso ya sabés dónde estás, y ese
 * mismo título rompe el banner: «Eleva tu vida con IA - Vishen, Vykintas Glodenis, Manon
 * Dave» son 60 caracteres donde entran 20. Lo pidió Martín con ese ejemplo.
 *
 * La convención es «Curso - Autor» y la escribe `tituloConAutor` en `curso-a-portal.mjs`,
 * así que se corta en el ÚLTIMO « - »: hay títulos que ya traen uno adentro («Método
 * Fukuda - Poder Orgánico - Ximena Fukuda», «ManyChat Master - Instagram - Andy Landa»).
 *
 * ⚠️ Probado contra los 91: acierta en 75 de los 79 que cortan. Los cuatro que fallan
 *    tienen el AUTOR ADELANTE, que ninguna regla posicional puede distinguir de un
 *    subtítulo — «Iman Gadzhi - Agency Incubator» es el autor y su curso, y
 *    «Jaque Blue - Creacion de Contenido» es el curso y su tema. Van a mano abajo.
 */
const TITULO_CORTO: Record<string, string> = {
  // El autor va PRIMERO: cortar por la derecha deja el nombre de la persona y tira el
  // del curso, que es exactamente lo contrario de lo que se busca.
  // ⚠️ La clave es el SLUG, y acá no coincide con lo que se ve: el curso se llamaba
  //    «Agency Navigator» en la plataforma y el propio autor lo llama «Agency Incubator»
  //    34 veces en los videos (ver `TITULO` arriba). El slug quedó con el nombre viejo.
  'iman-gadzhi-agency-navigator': 'Agency Incubator',
  'mateo-maffia-byf': 'BYF',
  // Acá lo de la derecha no es un autor sino el tema, y sin él el título no dice nada.
  // Se copia TAL CUAL, sin corregirle el acento: la grilla muestra el título largo y dos
  // ortografías del mismo nombre en dos pantallas se leen como dos cursos.
  'jaque-blue-creacion-de-contenido': 'Jaque Blue - Creacion de Contenido',
  // «GG» son las iniciales del autor y ya está en el nombre del taller.
  'taller-capcut-pro-gg': 'Taller Capcut PRO',
};

const sinAutor = (titulo: string | undefined, slug: string): string | undefined => {
  const propio = TITULO_CORTO[slug];
  if (propio) return propio;
  /**
   * ⚠️ TOLERA UN TÍTULO AUSENTE, Y NO ES DEFENSIVISMO: LA VERSIÓN ESTRICTA TIRÓ EL BUILD.
   *
   * Esta función corre para las 94 fichas al evaluar el módulo. La causa de que faltara un
   * título ya está arreglada —eran `CURSO_ANALISIS` y `CURSO_BRANDING`, importados como
   * VALOR desde dos `.tsx` con `'use client'`, ver `AnalisisNegocio.datos.ts`—, pero la
   * guarda se queda: un `.lastIndexOf` acá no dibuja mal un curso, mata la evaluación del
   * módulo entero, y Vercel muere con «Failed to collect configuration for
   * /compartido/[token]» sin nombrar ni el archivo ni el curso.
   *
   * Lo que expuso aquel bug latente es que ésta fue la PRIMERA función que toca TODOS los
   * títulos: las anteriores (`conAutor`, el mapa `TITULO`) sólo tocan los de los cursos que
   * declaran autor, que son tres. Una fragilidad vieja se vuelve visible el día que alguien
   * la recorre entera — y el que la recorre se lleva la culpa.
   */
  if (!titulo) return undefined;
  const i = titulo.lastIndexOf(' - ');
  if (i < 0) return titulo;
  const cabeza = titulo.slice(0, i).trim();
  const cola = titulo.slice(i + 3).trim();
  // Dos guardas contra cortar de más: que quede algo con lo que nombrar al curso, y que
  // lo de la derecha tenga largo de nombre propio y no de frase.
  if (cabeza.length < 6 || cola.length > 46) return titulo;
  return cabeza;
};

/**
 * De qué va cada curso, en una o dos frases. Lo pinta la tarjeta arriba del «Abrir».
 *
 * Es la `short_description` del catálogo de la plataforma de origen, o sea un DATO y no
 * algo que escribimos nosotros: el pipeline no la traía y la tarjeta terminaba diciendo
 * sólo cuánto material hay («33 clases en 2 módulos»), que es la respuesta a la otra
 * pregunta. Quien mira una grilla de 90 cursos necesita las dos.
 *
 * Vive acá y no en la ficha por la misma razón que `CATEGORIA`, `PORTADA` y `AUTOR`:
 * `curso-a-portal.mjs` REESCRIBE `curso-<slug>.ts` en cada corrida.
 *
 * ⚠️ NO SE INVENTA NINGUNA, PERO SÍ SE ESCRIBEN. No es lo mismo: una frase puesta a ojo
 *    sobre un curso que nadie miró se lee con la misma autoridad que las que son el dato,
 *    y eso es lo prohibido. Escribirla LEYENDO los módulos, los títulos de clase y las
 *    transcripciones no lo es — es la única fuente que queda cuando el curso no viene de
 *    la plataforma (MasteryHaus es Circle, AvatarHype y BlueHacker son sus propios sitios).
 *    Esas cuatro están abajo, en su propio bloque rotulado, porque la procedencia cambia
 *    qué hacer con ellas: las de la plataforma se re-copian solas si el origen las corrige.
 *
 * ⚠️ Y LA DESCRIPCIÓN DE ELLOS DESCRIBE **SU** PRODUCTO, NO NUESTRA COPIA. Dos venían
 *    prometiendo material que acá no está —«un módulo de macroeconomía con el economista
 *    Juan Odar», «clases en vivo, comunidad y acompañamiento»— y se recortaron, con el
 *    porqué escrito al lado de cada una. Que el texto sea un dato de ellos no lo hace
 *    cierto sobre lo que nosotros publicamos, y una promesa hueca no se descubre como un
 *    bug: se descubre como que el portal miente.
 *
 * Las de la plataforma las escribe `scripts/curso-categoria-portada.mjs`, que además es
 * quien CRUZA cada curso con su entrada de origen. Ese cruce ya erró nueve de golpe: ver
 * su cabecera antes de tocarlo.
 */
const RESUMEN: Record<string, string> = {
  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  '100m-money-models': 'Programa sobre cómo estructurar ofertas, upsells, downsells y modelos de continuidad para hacer que un negocio genere más dinero por cliente y escale de forma predecible.',
  '21-dias-de-gratitud': 'Experiencia de 21 días con meditaciones guiadas, diario de experiencias y comunidad, para transformar la forma en que ves las cosas, soltar lo que pesa y disfrutar más el presente.',
  '21-tecnicas-para-invertir-en-bienes-raices': 'Formación online centrada en estrategias y técnicas de inversión inmobiliaria para identificar oportunidades, analizar propiedades y construir ingresos o patrimonio en bienes raíces.',
  '360-marca-personal': 'Aprende a construir tu marca personal desde cero con la estrategia exacta que llevó al éxito a DollarDorado: desarrollar contenido con intención y monetizar tu presencia en redes.',
  'academia-five-stars': 'Mentoría con acompañamiento personalizado para aprender ventas high ticket, gestionar llamadas, mejorar la comunicación y el cierre, y desarrollar una carrera como closer.',
  'academia-mav': 'Programa intensivo de 60 días (“Modo MAV”) para ayudar a mujeres a convertirse en Mujeres de Alto Valor, trabajando mente, cuerpo, dinero, relaciones y propósito, con mentorías en vivo.',
  'amorir': 'Membresía digital que ofrece sesiones en vivo, meditaciones guiadas, rutinas de ejercicio y yoga para crecer en las 7 áreas de la vida, con acompañamiento y comunidad.',
  'automatiza-tu-whatsapp': 'Formación paso a paso para conectar WhatsApp, diseñar flujos de conversación y crear secuencias de mensajes que conviertan, con módulos de ManyChat y Respond.io.',
  'automatizacion-y-monetizacion-de-youtobe': 'Aprende a crear canales de YouTube automatizados sin mostrar tu cara: elección de nicho, configuración del canal, el algoritmo, videos con IA, optimización, analítica y monetización.',
  'automatizatube': 'Aprende a crear y monetizar canales de YouTube automatizados sin mostrar tu cara ni poner tu voz, eligiendo nichos rentables, creando guiones con IA y externalizando tareas.',
  'bigseo-academy': 'Formación orientada a aprender SEO práctico para posicionar webs, entender la optimización on-page y aplicar estrategias que mejoren la visibilidad orgánica de un sitio.',
  'black-box-canva': 'Entrenamiento con más de 70 clases grabadas para dominar Canva (versión gratuita), crear imágenes con el método TIFOPI y producir videos tipo “Nuggets” que vendan en Instagram.',
  'bootcamp-de-cierre-de-ventas-ia': 'Bootcamp práctico para dominar llamadas de venta, manejo de objeciones y cierre de ofertas high ticket, utilizando inteligencia artificial para preparar conversaciones y crear guiones.',
  'carrera-de-ecommerce': 'Programa práctico para aprender a vender en Amazon con FBA, desde la elección de productos y proveedores hasta logística, lanzamientos, publicidad y escalado.',
  'chatgpt-ia-mastery': 'Curso práctico para aprender a utilizar ChatGPT y herramientas de IA en tareas de creación de contenido, automatización y marketing, con foco en convertir el uso de IA en ingresos.',
  'claude-academy-2026': 'Aprende a usar Claude en sus cuatro frentes —Chat, Code, Cowork y Agents—: contexto, proyectos con memoria permanente, búsqueda web, documentos y cuándo usar Opus, Sonnet o Haiku.',
  'codigo-genio': 'Programa que enseña técnicas avanzadas para mejorar memoria, concentración y creatividad, basadas en la psicología de la genialidad y patrones de genios históricos.',
  'codigo-millonario': 'Formación guiada para generar ingresos en internet con IA: crear productos digitales en poco tiempo, atraer tráfico y cerrar ventas, con métodos paso a paso, comunidad y clases en vivo.',
  'como-vender-como-un-gladiador-romano': 'Aprende técnicas de ventas de alto valor basadas en la mentalidad de un gladiador romano. Lathos Academy enseña estructuras y blueprints listos para usar y mentorías con roleplays.',
  'creator-club': 'Programa para aprender edición viral, dominar herramientas como CapCut, Premiere Pro, After Effects y DaVinci Resolve, y usar IA para generar guiones virales más rápido.',
  'cursos-heygen': 'Enseña a usar HeyGen para convertir guiones en videos con avatares hiperrealistas, clonar voces, crear personajes virtuales desde una foto y producir contenido a escala.',
  'cursos-pro-jimmy-naraine': 'Programa para transformar tu conocimiento en un curso online rentable, aprendiendo a estructurar, producir y lanzar programas educativos con una metodología guiada paso a paso.',
  'desarrolla-tu-influencer-virtual': 'Formación para crear y monetizar un influencer virtual con IA: generación del rostro base, Google Colab, intercambio de rostro y el tutorial de código.',
  'dinero-inteligente-la-ruta-al-exito-financiero': 'Programa de 14 días que enseña a gestionar dinero, tomar decisiones de inversión y aplicar las “3 claves de la aptitud financiera”: gastar menos, ganar más e invertir como un loco.',
  'ecom-total-2-0': 'Sistema para crear, lanzar y escalar una marca de productos físicos desde cero: elegir productos con evidencia de mercado, importar y vender en Amazon, MercadoLibre y web propia.',
  'ecommerce-full-2-0': 'Curso para crear un ecommerce de alta conversión en Shopify, elegir productos, configurar la tienda, crear campañas de Meta Ads y Google Ads, analizar métricas y escalar ventas.',
  'edicion-de-video-en-capcut': 'Curso online de 15 módulos para aprender a editar videos cortos desde el ordenador con CapCut PC, cubriendo creación de proyectos, croma key, transiciones, texto y exportación.',
  'edita-como-un-pro': 'Taller práctico para editar videos que atraigan, emocionen, retengan y conviertan; enseña fundamentos de edición, CapCut, efectos y transiciones para contenido orgánico y anuncios.',
  'eleva-tu-vida-con-ia': 'Programa para aprender a usar IA de forma práctica en creatividad, productividad, automatización y desarrollo personal, con enfoque en crear herramientas y pensar como un “AI native”.',
  'emprende-con-instagram': 'Curso con más de 50 lecciones en video, plantillas y ejercicios para atraer seguidores, crear contenido de impacto y estructurar una estrategia de Instagram que genere ventas.',
  'escuela-tu-primer-millon': 'Aprende a crear tu negocio de coaching online y generar ingresos de seis cifras. El curso enseña cómo elegir el nicho correcto, crecer en redes sociales y conseguir tu primer cliente.',
  'experto-en-chatgpt': 'Curso online de 25 módulos para transformar la manera de trabajar con ChatGPT, aprendiendo prompting, creación de asistentes/GPTs y casos de uso aplicados a marketing y negocio.',
  'fba-agency': 'Programa práctico para montar una agencia de Amazon FBA: captar clientes y cerrar llamadas, registrar marca, buscar productos con Helium 10 y ordenar contrato y fiscalidad.',
  'growing-amg': 'Aprende a montar tu propia agencia de infoproductos desde cero y escálala hasta $10,000+ mensuales, en tres fases: construir la agencia, captar clientes y generar ingresos consistentes.',
  'hackeando-el-algoritmo': 'Sistema de 3 fases que te lleva de invisible a referente en tu sector. Enseña a hackear los algoritmos de Instagram y TikTok para crear contenido viral y crecer de manera orgánica.',
  'hackeando-la-edicion': 'Programa para aprender edición con intención, dominar ritmo, estructura y narrativa visual, y crear videos más dinámicos y virales en CapCut.',
  'iman-gadzhi-8-figure-personal-brand': 'Formación de Iman Gadzhi para construir una marca personal de ocho cifras: crear contenido en YouTube, armar ofertas y montar el embudo de VSL que vende productos digitales.',
  'iman-gadzhi-agency-navigator': 'Aprende a construir y escalar tu propia agencia de marketing digital desde cero. Este curso cubre sistemas de negocio, generación de leads, cierre de ventas y entrega de servicios.',
  'instituto-de-comunicacion': 'Curso para aprender a reconstruir tu voz, dominar el lenguaje no verbal, despertar tu carisma, hablar en público, liderar y negociar, y vivir de tu marca personal.',
  'inteligencia-viral-2026': 'Programa centrado en el arte de explicar, conectar y vender con contenido viral, usando la estructura y ciencia detrás de guiones y videos hiper virales.',
  'jaque-blue-creacion-de-contenido': 'Curso para aprender a crear contenido para redes: herramientas, identidad y moodboard, generación de ideas y producción de videos para destacar con una estrategia propia.',
  'la-universidad-del-closer': 'Aprende a cerrar ventas como closer digital. El curso enseña psicología del comprador, comunicación persuasiva, manejo de objeciones y cualificación de prospectos.',
  'legalmente-emprendedor': 'Curso básico de fundamentos legales y fiscales para formalizar tu negocio en México: constitución de empresa, registro fiscal (RFC), contratos y propiedad intelectual.',
  'm5-95': 'Formación de Meta Ads con inteligencia artificial para crear y escalar campañas rentables: segmentación, creativos con IA, copywriting persuasivo y la metodología 5% humano, 95% IA.',
  'manychat-master-instagram': 'Formación para usar ManyChat en Instagram, automatizar respuestas, convertir comentarios en ventas y escalar un negocio sin responder mensajes uno por uno.',
  'master-en-ia': 'Programa en español para aprender a crear imágenes y videos con IA, usar prompts y llevar ideas a proyectos reales con herramientas como Midjourney, Kling, Veo 3 y Runway.',
  'master-marca-personal-4-0': 'Construye y posiciona tu marca personal: posicionamiento único, contenido viral, historias de Instagram, embudos de venta orgánicos, ventas, fiscalidad y tu agencia de contenido.',
  'master-marca-personal-5-0': 'Programa para construir una marca personal sólida, crear contenido con intención, crecer en redes y monetizar con servicios, productos digitales o gestión de marcas de terceros.',
  'mateo-maffia-byf': 'Plataforma y formación para detectar contenido viral, convertir ideas en videos, usar storytelling y estrategias orgánicas para vender y crecer con TikTok y short form video.',
  'megadata-de-un-joven-emprededor': 'Aprende los principios de mentalidad del joven emprendedor digital —la «megadata»—: victorias compuestas, reprogramar tu entorno, el tiempo como dinero y networking con millonarios.',
  'mentoria-4k': 'Programa paso a paso para crear tu primer negocio digital que genere mínimo 4.000€ mensuales, desde la creación de marca personal hasta técnicas de conversión probadas.',
  'mentoria-d60': 'Programa de 30 días para vencer la procrastinación y aumentar la productividad con consistencia, mediante hábitos, sistemas y mentalidad de alta ejecución.',
  'metodo-fukuda-poder-organico': 'Evento de 2 días con conferencias de expertos para enseñar a crear y vender infoproductos y escalar con estrategias orgánicas; las ediciones recientes añaden IA, funnels y lanzamientos.',
  'mindset-millonario': 'Curso que enseña cómo transformar la mentalidad y los hábitos para crear negocios millonarios, con enfoque en espiritualidad (Dios/Jesús), disciplina, enfoque y abundancia.',
  'monetiza-con-johan-ia': 'Contenido y comunidad enfocados en enseñar a monetizar en TikTok y Facebook (cuentas en EE. UU., Creator Growth Challenge y bonificaciones), con ejemplos de cuentas monetizadas.',
  'monetizatube': 'Aprende a crear y monetizar canales de YouTube completamente automatizados sin aparecer en cámara, con selección de nichos rentables, creación de contenido con IA y SEO de YouTube.',
  'n8n-viral-machine': 'Sistema para automatizar presencia digital, generar contenido viral, distribuirlo en varias plataformas y vender más sin grabarte, editar ni publicar manualmente.',
  'negocia-con-confianza': 'Programa de 13 días que enseña a reconectar la identidad como negociador, gestionar emociones, hacer preguntas poderosas y sostener tu posición sin dañar la relación.',
  'nuevo-organic-ecom-3-0-junio-2026': 'Formación para aprender dropshipping orgánico, crear contenido en TikTok e Instagram Reels, montar una tienda Shopify y escalar sin necesidad de gastar en anuncios.',
  'programa-raio': 'Método para aprender inglés de forma acelerada con lecciones basadas en historias interactivas, pensado para lograr comunicación fluida en alrededor de 3 meses.',
  'sell-your-knowledge': 'Aprende a transformar tu conocimiento, experiencia y habilidades en un negocio rentable de 6 y 7 cifras, con validación de oferta, prospección orgánica y sistema de ventas consultivo.',
  'seminarios-alejandro-cardona': 'Seminarios intensivos para aprender a invertir en la bolsa, identificar acciones rentables, reconocer momentos de compra y venta, entender ETFs y fortalecer la disciplina mental.',
  'social-funnel': 'Sistema para crear un “embudo social” que combina contenido orgánico y anuncios de tráfico al perfil para captar leads, agendar llamadas y cerrar ventas de coaching/consultoría.',
  'stories-master': 'Entrenamiento paso a paso para estructurar historias que vendan, con guiones, técnicas de persuasión y automatización, enfocado en generar ventas 24/7 sin estar 100% presente.',
  'taller-capcut-pro-gg': 'Taller práctico para aprender a crear Reels y videos cortos más dinámicos con CapCut, dominando transiciones, animaciones y efectos para Instagram, TikTok y YouTube Shorts.',
  'termux-hacking-para-principiantes-2026': 'Curso introductorio de hacking ético enfocado en usar Termux en Android para ejecutar herramientas de seguridad, comandos Bash y técnicas básicas de pentesting, sin necesidad de root.',
  'the-real-wolf': 'Curso para aprender a vender y persuadir con Jordan Belfort en 10 lecciones: el sistema SLP, calificar al cliente, los 3 elementos de la presentación y el lenguaje del cierre.',
  'the-real-world': 'Aprende a generar ingresos en línea a través de múltiples métodos de monetización. El programa enseña e-commerce, dropshipping, copywriting, freelancing y criptomonedas.',
  'trilogia-de-brian-tracy': 'Aprende los pilares del éxito en ventas y desarrollo personal con los seminarios de Brian Tracy: negociación y cierre, relaciones con el cliente, poder personal y el Seminario Fénix.',
  'tu-1-millon': 'Membresía/campus para escalar tu negocio o coaching online a +10K/mes, crear una marca personal de +$1M y desarrollar el mindset y hábitos de millonario, con mentorías en vivo.',
  'tumadreanna-marketing-definitivo': 'Programa práctico para crear contenido viral en Instagram y TikTok: encontrar ideas, escribir hooks y automatizar con ManyChat, con masterclasses de análisis de reels y perfiles.',
  'ugc-sim-academy-de-mindshft': 'Formación/evento para aprender cómo las marcas pagan entre 1.000€ y 5.000€ por vídeos creados con IA para anuncios y redes sociales, y cómo crear esas piezas desde cero.',
  'vender-por-fb-e-ig-ads': 'Curso para aprender a crear, optimizar y escalar campañas publicitarias en Facebook e Instagram para vender más, con enfoque en segmentación, creativos, copywriting, pixel y métricas.',
  'vive-vendiendo': 'Formación enfocada en desarrollar habilidades de venta y persuasión para aprender a comunicar valor, conectar con clientes, manejar objeciones y cerrar ventas de forma más consistente.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'avatar-mastery': 'Formación práctica para crear un avatar/influencer digital con IA —rostro, cuerpo, outfits y expresiones consistentes— y convertirlo en un proyecto monetizable mediante redes sociales.',
  'certificacion-marketing-digital-ia': 'Certificación para aprender marketing digital con IA y el método Convierte Más©: growth marketing, contenidos, social media, SEO, email marketing, funnels de conversión, ads y CRO.',
  'claude-ai-rodrigo-rojo': 'Curso práctico para aprender a configurar Claude, diseñar prompts efectivos, crear artefactos y prototipos web, y automatizar tareas con MCP, Skills y Claude Cowork.',
  'completo-videos-ia': 'Curso orientado a crear videos con inteligencia artificial, desde la generación de ideas y prompts hasta la producción, edición y publicación de contenido para redes sociales.',
  'ecommerce-de-arz-urus': 'Formación para crear una tienda online, elegir producto, montar Shopify, aprender anuncios y escalar un negocio de ecommerce/dropshipping desde cero.',
  'fotografia-al-completo-de-0-a-pro-2025': 'Curso completo de fotografía que lleva al alumno desde cero hasta nivel profesional, cubriendo fundamentos de cámara, iluminación en estudio y exterior, composición y edición.',
  // ⚠️ Recortado: el original prometía «clases en vivo, comunidad y acompañamiento». En las
  //    15 transcripciones (370k caracteres) «comunidad» y «acompañamiento» aparecen CERO
  //    veces, y las 15 de «en vivo» son operaciones que la autora hizo en vivo, no clases.
  //    Lo que tenemos son 16 clases grabadas de un intensivo, casi todo sobre oro.
  'trading-arelis-rodriguez-2025': 'Formación estructurada para operar mercados financieros, cubriendo fundamentos, análisis técnico, gestión de riesgo y mentalidad, con operaciones reales analizadas paso a paso.',
  'trading-clutifx': 'Entrenamiento para aplicar una metodología de trading basada en contexto de mercado, gestión del tiempo, BIAS o sesgo direccional y técnicas Smart Money (SMT).',
  // ⚠️ Recortado: el original cerraba con «y un módulo de macroeconomía con el economista
  //    Juan Odar». En nuestras 6 transcripciones (630k caracteres) Odar aparece UNA vez, y
  //    es la recomendación de un curso AJENO suyo. La macroeconomía sí se toca, el módulo no
  //    existe — el curso no tiene módulos. Ver docs/hallazgos-conocimiento.md.
  'us30-2-0': 'Programa para dominar la operativa del US30: análisis técnico y chartismo, gestión de riesgo, lectura de tendencias y patrones, e impacto de noticias y macroeconomía en el mercado.',

  // ── Escritas DESDE EL MATERIAL, no copiadas de la plataforma ──────────────
  // Estos cursos no vienen del catálogo de la plataforma (MasteryHaus es Circle,
  // AvatarHype y BlueHacker son sus propios sitios), así que no hay `short_description`
  // que copiar. Se escribieron leyendo los módulos, los títulos de clase y las
  // transcripciones reales, y cada afirmación se verificó contra ese material.
  //
  // ⚠️ Van rotuladas aparte porque la PROCEDENCIA cambia qué hacer con ellas: las de
  //    la plataforma se re-copian solas si el origen las corrige, y éstas no las
  //    corrige nadie. Si el curso se regenera con material distinto, hay que releerlas.
  'aumenta-tu-valor-y-atv-advantage': 'Programa práctico para expertos en infoproductos y creadores de contenido: prospectar y cerrar creadores, definir oferta, montar funnels low y high ticket y hacer setting y closing.',
  'bluehacker': 'Formación para vender ofertas high ticket, con foco en nicho y cliente ideal, oferta y precio, booking funnel, proceso de setters, cierre de llamadas y tráfico pago con Meta Ads.',
  'creativos-ugc-realistas': 'Curso para aprender a producir creativos UGC publicitarios con avatares de IA: crear la imagen, animarla con modelos de video, editar en CapCut y clonar la voz.',
  'masteryhaus': 'Estructura y escala un negocio digital de servicios ya en marcha, con nicho, oferta y validación, script de ventas y objeciones, entrega del servicio y marketing perpetuo.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'imperio-afiliado': 'Aprende a crear tu negocio de marketing de afiliados desde cero. El curso enseña cómo seleccionar productos rentables para promocionar, crear funnels perpetuos.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'academia-del-sensei': 'Formación de trading desde cero: análisis técnico e institucional, manual de BIAS, psicología del trader, gestión monetaria y preparación para pruebas de fondeo.',
  'growing-setters-3-0': 'Programa para trabajar como appointment setter: manejo de conversaciones, objeciones y prospectos, ventas high ticket, marca personal y cómo armar tu agencia de infoproductos.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'instituto-de-marca-personal': 'Aprende a construir y monetizar tu marca personal. El curso enseña definición de marca personal identificando valores y puntos fuertes, creación de estrategias de contenido efectivas.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'udia': 'Aprende a crear y escalar negocios usando inteligencia artificial. El curso enseña automatización de procesos con IA, creación de aplicaciones funcionales desde ideas.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'club-de-negocios': 'Aprende a crear y escalar tu negocio online dentro de una comunidad de emprendedores. El club enseña desarrollo de estrategias de negocio, creación de tiendas online rentables.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'ecommerce-0-a-17-millones': 'Aprende a crear un negocio de e-commerce desde cero hasta generar 17 millones en ventas. El curso enseña cómo seleccionar producto rentable, crear tienda online.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'academia-de-lanzamiento': 'prende a lanzar y vender infoproductos de forma rentable. El curso enseña cómo crecer en redes sociales, construir conexiones auténticas con tu audiencia, crear webinars que venden.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'belikethealgo': 'Aprende a tradear en Forex con la estrategia probada de Benjamín Carmona. El curso enseña análisis técnico, identificación de patrones de precio, entrada y salida de operaciones.',

  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`
  // del catálogo de la plataforma.
  'growth-partner': 'Aprende a convertirte en un Growth Partner de marcas e-commerce. El curso enseña embudos de venta, publicidad en Meta Ads y Google Ads, estrategia de contenido y UGC.',

};

// Sin acentos y en minúsculas, para que «Sofia» no se sume a un título que ya dice
// «Sofía». Comparar en crudo daría un «X - Autor» duplicado y nadie lo miraría dos veces.
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/**
 * La tapa de último recurso: el primer frame del propio curso.
 *
 * ⚠️ ES UN FALLBACK, NO LA FORMA DE PONER UNA PORTADA. Una tapa de verdad —la de la
 * plataforma o la que pasa el dueño— siempre gana, porque está compuesta para vender el
 * curso; un frame es lo que había en el segundo cero de la clase 1.
 *
 * Pero un rectángulo negro no dice nada de nada, y eso era lo que se veía. Martín lo
 * reportó el 29/08/2026 («AVATAR MASTERY no tiene portada… hay muchos que no tienen»):
 * eran 4 cursos que la plataforma de origen no conoce, así que no hay `cover_image` que
 * bajar y no la va a haber nunca.
 *
 * Se elige ESTO y no una imagen buscada afuera ni una tipográfica generada por dos
 * razones: sale del propio material (no se inventa nada ni se atribuye una imagen ajena
 * al curso), y **se arregla solo para todo curso futuro** — que era el pedido real, «hay
 * muchos, revisalo». Bajar cuatro archivos deja el problema abierto para el quinto.
 */
const primerFrame = (c: Curso): string | undefined => {
  const id = c.clases?.find((k) => k.videoId)?.videoId;
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : undefined;
};

const conAutor = (titulo: string, autor?: string) =>
  autor && !sinAcentos(titulo).includes(sinAcentos(autor)) ? `${titulo} - ${autor}` : titulo;

// curso.ts es AUTO-GENERADO desde transcripciones: los cursos escritos a mano
// viven en su propio archivo y se suman acá.
/**
 * El curso de Avatar Hype se REHIZO desde la academia el 2026-08-17 y pasó de 6
 * clases a 30, así que el viejo (`avatarhype`, dentro del auto-generado `curso.ts`)
 * sale de la grilla: son el mismo curso con dos cortes distintos, y dejar los dos
 * hace que alguien abra el desactualizado creyendo que es el bueno.
 *
 * ⚠️ Se excluye ACÁ y no borrándolo de `curso.ts`, que es auto-generado: un borrado
 * allá vuelve en la próxima regeneración, en silencio y sin que nadie lo note.
 *
 * Sus 13 recursos NO se perdieron: viven en `curso-ugc-recursos.ts` y se cuelgan del
 * curso nuevo unas líneas más abajo. Si se saca esta exclusión, vuelven a aparecer
 * DUPLICADOS —una vez en cada curso—, que es la razón de que estas dos decisiones
 * estén pegadas y no en dos lugares distintos.
 * ⚠️ ES UN MAPA, NO UN CONJUNTO, Y ESO ES EL ARREGLO DE UN 404 QUE ESTUVO VIVO.
 * Un `Set` contesta «este slug ya no va», y con eso alcanza para sacarlo de la grilla
 * — pero NO contesta la otra pregunta, que es la que importa: «¿y el que YA está
 * apuntando ahí?». Un curso no vive solo en la grilla: vive también en cada link
 * compartido, cada favorito y cada `?curso=` que alguien mandó por WhatsApp.
 *
 * Medido el 2026-08-22 contra la base de producción: el share id=4 (ws 1, modo
 * invitados, SIN revocar, 13 visitas) apunta a `avatarhype` y desde el deploy del
 * 17/08 17:11Z devuelve 404. La persona que tenía el link vio una página de error
 * durante cinco días.
 *
 * Y el contador de visitas NUNCA lo iba a delatar: `registrarVisita()` corre DESPUÉS
 * del `notFound()` en `app/compartido/[token]/page.tsx`, así que un golpe al 404 no
 * suma. Las 13 visitas son todas anteriores al quiebre. Un link roto y un link que
 * nadie abrió se ven EXACTAMENTE IGUAL desde la métrica.
 *
 * Con el Map, `buscarCurso` resuelve el nombre viejo al nuevo: la grilla sigue
 * mostrando uno solo (el filtro de abajo no cambió) y el link viejo aterriza donde
 * corresponde. Reemplazar es REDIRIGIR, no borrar.
 */
const REEMPLAZADOS = new Map<string, string>([
  ['avatarhype', 'creativos-ugc-realistas'],
  /**
   * «Creativos Animados» es la SEGUNDA academia de AvatarHype, no un curso aparte, y su
   * material ya vive adentro del grande: el `videoId` de su única clase
   * (`1eeOFpwumZ869pa5wjMy1owhfEwSIqLVT`) está publicado en `curso-creativos-ugc-realistas`,
   * que además tiene un módulo llamado «Creativos Animados». Verificado antes de sacarlo.
   *
   * ⚠️ YA SE HABIA SACADO UNA VEZ Y VOLVIO SOLO. El commit `c4c33ee4` lo fusionó a
   * propósito borrando su import, y `e16d296a` («14 cursos que el portal no mostraba») lo
   * re-importó en silencio — porque `curso-al-catalogo.mjs` detecta por PATH del import y
   * la ficha seguía en disco. Borrar el import no es un candado: el candado es esto, más
   * la lista de fusionados de ese script. Martín lo reportó el 29/08 como «lo pusiste como
   * curso aparte, cuando ya está el curso de avatarhype».
   */
  ['creativos-animados', 'creativos-ugc-realistas'],
]);

/**
 * Cuelga una lista de recursos de un curso generado, en las DOS puntas.
 *
 * ⚠️ SON DOS COSAS Y OLVIDARSE DE LA SEGUNDA NO ROMPE NADA VISIBLE. El portal dibuja
 * los recursos en dos lugares distintos:
 *   · la sección «Recursos» del curso, que sale de `curso.recursos` (CursoPortal:409);
 *   · el bloque de cada clase, que sale de `clase.recursoSlugs` (CursoPortal:678).
 * Inyectar solo `recursos` deja la sección del curso llena y TODAS las clases sin su
 * material. No hay error, no hay hueco: hay un curso donde el PDF del módulo 3 existe
 * y no aparece en ninguna de las 32 clases de ese módulo.
 *
 * El dato para reconstruir el segundo ya viaja en el primero: cada recurso trae
 * `clases: [n, …]`. Acá se da vuelta ese índice.
 *
 * Pasó el 22/08/2026: regenerar BlueHacker de 233 a 404 clases borró sus 8 recursos Y
 * los `recursoSlugs` de 56 clases. Lo vio el dueño en la pantalla; ningún chequeo lo
 * miraba. Ver docs/hallazgos-conocimiento.md.
 */
const conRecursos = (curso: Curso, recursos: Recurso[]): Curso => {
  const porClase = new Map<number, string[]>();
  for (const r of recursos) {
    for (const n of (r as { clases?: number[] }).clases ?? []) {
      porClase.set(n, [...(porClase.get(n) ?? []), r.slug]);
    }
  }
  return {
    ...curso,
    recursos,
    // Se RESPETA lo que la ficha ya traiga: si el generador pudo colgar el recurso
    // solo (porque el archivo estaba en la carpeta local), ese dato manda.
    clases: curso.clases.map((c) => (c.recursoSlugs?.length || !porClase.has(c.n)
      ? c
      : { ...c, recursoSlugs: porClase.get(c.n) as string[] })),
  };
};

export const CURSOS_TODOS: Curso[] = [
  ...CURSOS.filter((c) => !REEMPLAZADOS.has(c.slug)),
  CURSO_VSL, CURSO_ANALISIS, CURSO_BRANDING, CURSO_PRODUCTO_APP, CURSO_AVATAR_APP,
  CURSO_CLAUDE_AI_RODRIGO_ROJO, CURSO_AUMENTA_TU_VALOR_Y_ATV_ADVANTAGE,
  CURSO_SELL_YOUR_KNOWLEDGE, CURSO_INTELIGENCIA_VIRAL_2026, CURSO_M5_95,
  CURSO_VENDER_POR_FB_E_IG_ADS, CURSO_MANYCHAT_MASTER_INSTAGRAM,
  CURSO_JAQUE_BLUE_CREACION_DE_CONTENIDO, CURSO_100M_MONEY_MODELS,
  CURSO_MATEO_MAFFIA_BYF, CURSO_MASTER_MARCA_PERSONAL_5_0, CURSO_SOCIAL_FUNNEL,
  CURSO_UGC_SIM_ACADEMY_DE_MINDSHFT, CURSO_HACKEANDO_LA_EDICION,
  CURSO_PROGRAMA_RAIO, CURSO_BIGSEO_ACADEMY, CURSO_INSTITUTO_DE_COMUNICACION,
  // ⚠️ Este curso YA NO se inyecta, y el porqué vale para el próximo: la inyección era
  // un parche sobre un diagnóstico incompleto. Se creyó que el problema era «la
  // regeneración borró los 8 recursos publicados»; el problema real era que el curso
  // tiene **92** en su plataforma y el portal publicaba 8. Restaurar los 8 dejaba el
  // agujero de 84 tapado y con cara de arreglado.
  //
  // Ahora los 91 bajados salen del pipeline (plan.pdfs → curso-a-drive → curso-a-portal),
  // que es donde tienen que estar: se regeneran solos y no hay una segunda lista que
  // mantener. La lección: antes de restaurar lo que había, preguntá cuánto DEBERÍA haber.
  CURSO_BLUEHACKER,
  CURSO_MASTERYHAUS,
  CURSO_STORIES_MASTER,
  CURSO_CLAUDE_ACADEMY_2026,
  CURSO_CURSOS_HEYGEN,
  CURSO_METODO_FUKUDA_PODER_ORGANICO,
  CURSO_IMAN_GADZHI_AGENCY_NAVIGATOR,
  CURSO_CERTIFICACION_MARKETING_DIGITAL_IA,
  CURSO_NUEVO_ORGANIC_ECOM_3_0_JUNIO_2026,
  CURSO_AMORIR,
  CURSO_CREATOR_CLUB, CURSO_TRILOGIA_DE_BRIAN_TRACY,
  // Los recursos y las portadas de módulo se inyectan acá porque el archivo del curso lo
  // REESCRIBE `curso-a-portal.mjs` en cada corrida: puestos allá, duran hasta la
  // próxima. `portadasModulo` es el prefijo de las tapas por MÓDULO (`m1.webp`,
  // `m2.webp`…): solo este curso las tiene bajadas, y sin el prefijo la réplica pide
  // portadas que no existen. Ver CursoReplica.tsx.
  { ...conRecursos(CURSO_CREATIVOS_UGC_REALISTAS, RECURSOS_UGC), portadasModulo: '/cono-ugc/m' },

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_21_TECNICAS_PARA_INVERTIR_EN_BIENES_RAICES,
  CURSO_AUTOMATIZACION_Y_MONETIZACION_DE_YOUTOBE,
  CURSO_AUTOMATIZATUBE,
  CURSO_BOOTCAMP_DE_CIERRE_DE_VENTAS_IA,
  CURSO_CODIGO_GENIO,
  CURSO_DESARROLLA_TU_INFLUENCER_VIRTUAL,
  CURSO_IMAN_GADZHI_8_FIGURE_PERSONAL_BRAND,
  CURSO_LEGALMENTE_EMPRENDEDOR,
  CURSO_MEGADATA_DE_UN_JOVEN_EMPREDEDOR,
  CURSO_MONETIZATUBE,
  CURSO_SEMINARIOS_ALEJANDRO_CARDONA,
  CURSO_THE_REAL_WORLD,
  CURSO_US30_2_0,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_21_DIAS_DE_GRATITUD,
  CURSO_ACADEMIA_MAV,
  CURSO_AVATAR_MASTERY,
  CURSO_CHATGPT_IA_MASTERY,
  CURSO_COMO_VENDER_COMO_UN_GLADIADOR_ROMANO,
  CURSO_CURSOS_PRO_JIMMY_NARAINE,
  CURSO_DINERO_INTELIGENTE_LA_RUTA_AL_EXITO_FINANCIERO,
  CURSO_EDICION_DE_VIDEO_EN_CAPCUT,
  CURSO_ELEVA_TU_VIDA_CON_IA,
  CURSO_FBA_AGENCY,
  CURSO_MENTORIA_D60,
  CURSO_MINDSET_MILLONARIO,
  CURSO_N8N_VIRAL_MACHINE,
  CURSO_NEGOCIA_CON_CONFIANZA,
  CURSO_TERMUX_HACKING_PARA_PRINCIPIANTES_2026,
  CURSO_THE_REAL_WOLF,
  CURSO_TRADING_CLUTIFX,
  CURSO_VIVE_VENDIENDO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_TRADING_ARELIS_RODRIGUEZ_2025,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ESCUELA_TU_PRIMER_MILLON,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_MENTORIA_4K,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_EDITA_COMO_UN_PRO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_EXPERTO_EN_CHATGPT,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_HACKEANDO_EL_ALGORITMO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_TU_1_MILLON,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_COMPLETO_VIDEOS_IA,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_360_MARCA_PERSONAL,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_CODIGO_MILLONARIO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ECOMMERCE_DE_ARZ_URUS,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_TUMADREANNA_MARKETING_DEFINITIVO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ACADEMIA_FIVE_STARS,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_MONETIZA_CON_JOHAN_IA,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_LA_UNIVERSIDAD_DEL_CLOSER,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_EMPRENDE_CON_INSTAGRAM,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_MASTER_EN_IA,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ECOMMERCE_FULL_2_0,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_FOTOGRAFIA_AL_COMPLETO_DE_0_A_PRO_2025,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_TALLER_CAPCUT_PRO_GG,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_CARRERA_DE_ECOMMERCE,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_BLACK_BOX_CANVA,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_GROWING_AMG,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ECOM_TOTAL_2_0,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_MASTER_MARCA_PERSONAL_4_0,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_AUTOMATIZA_TU_WHATSAPP,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_IMPERIO_AFILIADO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ACADEMIA_DEL_SENSEI,
  CURSO_GROWING_SETTERS_3_0,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_INSTITUTO_DE_MARCA_PERSONAL,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_UDIA,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_CLUB_DE_NEGOCIOS,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ECOMMERCE_0_A_17_MILLONES,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_ACADEMIA_DE_LANZAMIENTO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_BELIKETHEALGO,

  // Sumados por scripts/curso-al-catalogo.mjs (ver el porqué en ese archivo).
  CURSO_GROWTH_PARTNER,
].map((c) => ({
  ...c,
  categoria: CATEGORIA[c.slug] ?? c.categoria,
  portada: c.portada ?? PORTADA[c.slug] ?? primerFrame(c),
  titulo: TITULO[c.slug] ?? conAutor(c.titulo, AUTOR[c.slug]),
  // El título sin el autor, para la portada de adentro del curso. Se calcula del título
  // YA resuelto —no del crudo de la ficha— porque el autor se lo puede haber pegado
  // `conAutor` dos líneas arriba: cortar antes sería cortar sobre otro string.
  tituloCorto: sinAutor(TITULO[c.slug] ?? conAutor(c.titulo, AUTOR[c.slug]), c.slug),
  // Lo que declara la ficha gana: si algún día un curso trae el suyo propio, ese es más
  // específico que el de la plataforma de origen.
  resumen: c.resumen ?? RESUMEN[c.slug],
  // La réplica es la vista de TODOS los cursos, no un modo de uno. Se pone acá y no
  // curso por curso porque un flag que hay que acordarse de poner deja al próximo curso
  // naciendo con la vista vieja — y nadie se entera hasta que lo abre alguien.
  replica: true,
}));

export const buscarCurso = (slug: string | null | undefined): Curso | undefined => {
  if (!slug) return undefined;
  // El salto por REEMPLAZADOS va ACÁ y no en cada pantalla: es el único punto por el
  // que pasan la grilla, el link compartido y el `?curso=` de la URL. Puesto en el
  // llamador, la próxima pantalla que resuelva un curso nace sin él.
  return CURSOS_TODOS.find((c) => c.slug === (REEMPLAZADOS.get(slug) ?? slug));
};

/**
 * Los dos cursos que NO se dibujan con `CursoPortal`: tienen vista propia.
 * Los slugs se nombran acá —y no sueltos en cada `if`— para que el portal y el
 * link compartido decidan por el MISMO dato.
 *
 *  • `analisis`: es un formulario interactivo con las 5 fases, no clases de
 *    video. Compartido, lo dibuja `AnalisisCompartido`.
 *  • `branding`: es una galería de archivos que viven en Storage. NO se
 *    comparte como curso: tiene su propio recurso de share (`recurso='branding'`,
 *    que resuelve por `Galeria`), porque el alcance puede ser una sección o una
 *    pieza suelta y no el curso entero.
 */
export const VISTA_PROPIA = {
  analisis: CURSO_ANALISIS.slug,
  branding: CURSO_BRANDING.slug,
} as const;

/**
 * Los cursos que puede ver alguien SIN LOGIN cuando se comparte la TAB ENTERA.
 *
 * Se queda afuera **toda la sección `CATEGORIA_PROPIA`** — el método, la marca y
 * los criterios de la casa. Es lo que pidió el dueño el 13/8/2026: un link
 * repartido a un tercero muestra la formación, no lo nuestro. Eso ya cubre a
 * Branding, que además no se podría servir aunque quisiéramos: su material son
 * bytes en un bucket privado que se piden a `/api/branding`, admin-only, así que
 * un invitado vería la galería vacía sin entender por qué. Branding tiene su
 * propio share (`recurso='branding'`), más fino: por sección o por pieza.
 *
 * ⚠️ Esto NO gobierna el share de UN curso suelto. Compartir un curso de esta
 * sección a propósito sigue funcionando —es un acto explícito, y su link ya está
 * repartido— y se corta revocándolo desde el modal. Lo que se filtra acá es qué
 * entra en el «compartí la tab», que es lo que nadie eligió curso por curso.
 *
 * Se calcula sobre `CURSOS_TODOS`, así que un curso nuevo entra solo: la
 * exclusión se declara por sección, nunca la inclusión por lista (una lista de
 * incluidos deja afuera en silencio a todo lo que nadie se acordó de sumar).
 */
export const CURSOS_COMPARTIBLES: Curso[] = CURSOS_TODOS.filter(
  // Dos condiciones y no una, porque son dos razones distintas: la sección es
  // una decisión de producto (puede cambiar), y Branding es una imposibilidad
  // técnica (no cambia). Si alguien saca Branding del mapa de secciones, la
  // primera deja de cubrirlo y la segunda lo sigue tapando.
  (c) => c.categoria !== CATEGORIA_PROPIA && c.slug !== VISTA_PROPIA.branding,
);
