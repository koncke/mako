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
import { RECURSOS_UGC } from './curso-ugc-recursos';
import { CURSO_ANALISIS } from './AnalisisNegocio';
import { CURSO_BRANDING } from './BrandingMaKo';

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
  'iman-gadzhi-8-figure-personal-brand': 'Lanzamientos', // Lanzamientos
  'jaque-blue-creacion-de-contenido': 'Orgánico', // Redes Sociales
  'm5-95': 'Anuncios',                     // ADS
  'manychat-master-instagram': 'Orgánico', // Redes Sociales
  'master-marca-personal-5-0': 'Orgánico', // Victor Heras · decisión de Martín (29/08)
  'mateo-maffia-byf': 'Orgánico',          // Redes Sociales
  'monetizatube': 'Orgánico',              // Auto Youtube
  'nuevo-organic-ecom-3-0-junio-2026': 'Ecommerce', // Ecommerce
  'seminarios-alejandro-cardona': 'Negocios digitales', // Hustlers
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
  'cursos-pro-jimmy-naraine': 'Ventas',    // Ventas
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
  'negocia-con-confianza': 'Negocios digitales', // Hustlers
  'termux-hacking-para-principiantes-2026': 'Ciberseguridad', // Ciberseguridad
  'the-real-wolf': 'Negocios digitales',   // Hustlers
  'vive-vendiendo': 'Ventas',              // Ventas

  // Tanda del 29/08 que la plataforma NO conoce. Misma regla que los de arriba: los decide
  // el MATERIAL, y al lado va de qué título de clase salió cada uno.
  'avatar-mastery': 'Inteligencia Artificial', // «influencers digitales», «CivitAI»
  'como-vender-como-un-gladiador-romano': 'Ventas', // «¿Qué es la Venta», «Ventas Como Modo De Vida»
  'mentoria-d60': 'Desarrollo personal',   // «claridad mental», «domina tus hábitos», «RutiMax»
  'trading-clutifx': 'Finanzas',           // «BIAS», «entradas», «time»
  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'escuela-tu-primer-millon': 'Negocios digitales', // Hustlers

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'mentoria-4k': 'Ecommerce',              // Ecommerce

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'edita-como-un-pro': 'Edición',          // Edición de Video

  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la
  // plataforma. El comentario al lado es la categoría de origen.
  'experto-en-chatgpt': 'Inteligencia Artificial', // IA

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

// Sin acentos y en minúsculas, para que «Sofia» no se sume a un título que ya dice
// «Sofía». Comparar en crudo daría un «X - Autor» duplicado y nadie lo miraría dos veces.
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
].map((c) => ({
  ...c,
  categoria: CATEGORIA[c.slug] ?? c.categoria,
  portada: c.portada ?? PORTADA[c.slug],
  titulo: TITULO[c.slug] ?? conAutor(c.titulo, AUTOR[c.slug]),
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
