// =============================================================================
// Marketing CoPilot — qué enseña cada referente, MEDIDO en su curso (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «en los gurus, no creo que hayas puesto a todos, pusiste a pocos... Y fijate bien, porque por ejemplo Doglio,
// no creo que te enseñe a hacer webinar, o si?... El enseña organico en Instagram, estrategia de stories, etc...».
//
// La tabla sale de leer, por cada referente con retrato y ficha (lib/asesores/catalogo.ts), su ficha (lib/asesores/ficha-*.ts) y los
// títulos de las clases de su curso (lib/asesores/clases-de-referentes.json), y de contar en sus transcripciones (public/cono-tx/)
// cuánto aparece cada canal. El detalle con las cuentas está en docs/marketing-copilot/referentes.md.
//
// ⚠️ UN FUNNEL ENTRA EN `funnels` SÓLO CON LAS DOS COSAS: clases de su curso que lo enseñan (en `evidencia`, textuales) Y un marco de su
//    ficha que lo cubra. El agente sólo tiene la ficha: un funnel que el curso trae y la ficha no, el agente lo inventaría «inspirado
//    en» alguien. Esos se dicen en `nota` y no se ofrecen (Juan Carrizo: el curso trae clases de VSL, su ficha es de oferta y precio).
// ⚠️ `funnels` VACÍO no es «no sirve»: enseña otra parte de la venta (la oferta, la llamada, la voz). Se lo elige igual y el CoPilot lo
//    dice («no es un funnel para conseguir clientes; lo uso para esa parte») y pide el funnel.
// ⚠️ DOGLIO, medido: Martín tenía razón a medias. Su curso («ARCADIA») enseña Instagram con historias (un ciclo de promoción de siete
//    días, «2. Estrategias de Promoción de Ventas»: 26 menciones de historias en esa clase), la prospección por Instagram y los setters
//    que siguen la conversación, Y también webinars (siete clases: «1. Playbook de webinar urgencia y ventas» y las de su módulo 5).
//    Su ficha no tenía nada de historias: se le sumó el marco del ciclo de promoción (lib/asesores/ficha-francisco-doglio.ts).
// Sin `server-only`: lo usan la pantalla (la grilla de referentes) y el contexto del agente. Los tipos vienen de ./copiloto (sólo tipos).
// =============================================================================

import type { IdAsesor } from '@/lib/asesores/catalogo';
import type { IdFunnel } from './copiloto';

export type QueEnsena = {
  /** Las estrategias del CoPilot que enseña, de la más fuerte a la menos. Vacía: enseña otra parte de la venta. */
  funnels: readonly IdFunnel[];
  /** Qué enseña, en una línea corta: lo que dice su tarjeta. */
  tema: string;
  /** Por dónde. */
  canal: string;
  /** Para qué negocio sirve su método. */
  para: string;
  /** Títulos (o el principio del título) de clases de su curso que lo prueban: un test los busca en clases-de-referentes.json. */
  evidencia: readonly string[];
  /** Lo que hay que saber de su método antes de usarlo en un negocio de servicios. */
  nota?: string;
};

/** Un Record TOTAL: un `IdAsesor` nuevo no compila hasta que alguien mida qué enseña. */
export const QUE_ENSENA: Readonly<Record<IdAsesor, QueEnsena>> = {
  'francisco-doglio': {
    funnels: ['organico', 'webinar'], tema: 'historias de Instagram que venden, setters y webinars', canal: 'Instagram (historias y mensajes) y webinars',
    para: 'Ticket alto con un equipo que agenda llamadas',
    evidencia: ['2. Estrategias de Promoción de Ventas', 'Rutina diaria - Setter', '1. Playbook de webinar urgencia y ventas', '2. Estructuras de Webinar B2B y B2C'],
    nota: 'Lo fuerte de su curso son las historias de Instagram (un ciclo de promoción de siete días) y los setters que llevan la conversación a la llamada; los webinars son una parte.',
  },
  'julian-otalora': {
    funnels: ['organico'], tema: 'contenido orgánico: ganchos, guiones de reel y pilares', canal: 'Instagram (reels)', para: 'Productos, servicios y marca personal',
    evidencia: ['1. Creación de contenido Orgánico', '13. Tipos de ganchos', '14. Pilares de contenido'],
  },
  'guille-collado': {
    funnels: ['organico'], tema: 'contenido viral: el algoritmo, las 4 P y la estructura de un video', canal: 'Instagram y TikTok', para: 'Marca personal y creadores',
    evidencia: ['Actualización Algoritmo Instagram', 'Mi proceso de guionizar un vídeo viral'],
  },
  'emilio-puigrredon': {
    funnels: ['mensajes', 'organico'], tema: 'el perfil como embudo: anuncios de tráfico al perfil y cierre por mensaje', canal: 'Instagram y Meta Ads', para: 'Servicios que se venden conversando',
    evidencia: ['7 Anuncios de Tráfico Con Meta Ads', '8 Anzuelos', '9 Social Landing Pages'],
  },
  'andy-landa': {
    funnels: ['organico', 'lead-magnet'], tema: 'automatizaciones de Instagram: comentar una palabra y recibir algo por mensaje', canal: 'Instagram con ManyChat', para: 'Quien ya publica y quiere convertir esa audiencia',
    evidencia: ['3. Mis reels de Conversión', '4. FLOW 3 - Story de Conversión', '6. FLOW 5 - Crece tu Base de Datos'],
  },
  'victor-heras': {
    funnels: ['organico'], tema: 'marca personal: contenido viral, historias y la llamada', canal: 'Instagram', para: 'Expertos con marca personal',
    evidencia: ['9. Tres Claves para hacer contenido viral', '9. Estructura ViralCopy', '10. Ganchos virales'],
  },
  'david-turu': {
    funnels: ['organico', 'webinar'], tema: 'lanzamientos por Instagram: historias de calentamiento, reto gratuito y webinar', canal: 'Instagram (historias) y WhatsApp', para: 'Cursos y programas que se lanzan',
    evidencia: ['2-Análisis stories', '4-PREINSCRIPCIÓN FORMULARIO', '8-10 Pasos para duplicar tus lanzamientos'],
  },
  'ximena-fukuda': {
    funnels: ['organico'], tema: 'ventas orgánicas: carnadas, lives y el cierre por mensaje', canal: 'Instagram, TikTok y grupos de Facebook', para: 'Low ticket y high ticket',
    evidencia: ['3.CARNADAS PARA FACEBOOK E INSTAGRAM', '7.Cómo hacer tu estrategia de LIVES por instagram', 'Estructura de un cierre de venta'],
  },
  'gonzalo-sere': {
    funnels: ['organico'], tema: 'estrategia de contenido: pilares, guiones, grabación y edición', canal: 'Instagram y YouTube', para: 'Marcas y equipos de contenido',
    evidencia: ['5. Como escribir guiones virales', '7. 3 tipos de contenido de valor', '32. Lanzamiento en historias'],
  },
  'mateo-maffia': {
    funnels: ['organico'], tema: 'vender con video corto: ganchos, nicho y publicar seguido', canal: 'TikTok y Reels', para: 'Marca personal y negocios físicos',
    evidencia: ['1 Anatomía de un gancho VIRAL', '7 CONTENIDO VIRAL VS CONTENIDO DE NICHO', '8 CÓMO CREAR REELS VIRALES'],
  },
  'julian-alborna': {
    funnels: ['organico'], tema: 'contenido que se comparte: la idea, la atención y la edición', canal: 'Video corto', para: 'Creadores y marcas',
    evidencia: ['Leccion 2 Contar Tu Historia', 'Leccion 4 Storyboard Planea Tu Video'],
  },
  'sergio-begueria': {
    funnels: ['youtube', 'organico'], tema: 'marca personal con video: YouTube sobre todo, e Instagram', canal: 'YouTube e Instagram', para: 'Expertos que quieren que los conozcan',
    evidencia: ['1 Cómo entender Youtube Analytics.', '3 Ingredientes de un video viral en Youtube.', '8 Cómo llevarte tráfico de Youtube', '7 Cómo utilizar Instagram Stories'],
  },
  'derek-chamizo': {
    funnels: ['youtube'], tema: 'canales de YouTube automatizados', canal: 'YouTube', para: 'Canales de contenido que viven de la publicidad',
    evidencia: ['1. Presentación Universidad de YouTube', '1. Claves Algoritmo de YouTube', '2. ¿Cómo Funciona Google Adsense_'],
    nota: 'Su método es para canales que viven de la publicidad de YouTube (nichos por CPM, canales sin cara): a un servicio le sirve lo de títulos, miniaturas y constancia.',
  },
  'sofia-contreras': {
    funnels: ['lead-magnet'], tema: 'marketing perpetuo: nicho, oferta y un embudo siempre activo', canal: 'Contenido, correo y anuncios', para: 'Coaches y consultores de alto valor',
    evidencia: ['Estrategia Farming de Leads', 'Email Marketing: Captación de leads', 'Funnel Cálido Individual a Llamada'],
    nota: 'Su curso trae «Formulario de Aplicación a Llamada», pero su ficha en MaKo no tiene ese marco: el formulario no se ofrece con ella.',
  },
  'alvaro-luque': {
    funnels: ['lead-magnet', 'webinar', 'carrito'], tema: 'lanzamientos por etapas: lead magnet, clases y carrito abierto', canal: 'Meta Ads, WhatsApp y correo', para: 'Cursos y programas que se lanzan',
    evidencia: ['Copia de 07 - Selecciona tu Lead Magnet', 'Copia de 14 - Anuncios para Lead Magnet', '06 - CONFIGURA TU CHECKOUT', '08 - SECUENCIA DE APERTURA DE CARRITO'],
  },
  'vilma-nunez': {
    funnels: ['lead-magnet'], tema: 'marketing digital: regalar contenido a cambio del contacto y anuncios por fases', canal: 'Contenido, correo y anuncios', para: 'Empresas y negocios que venden entre empresas',
    evidencia: ['5. Content Lead Generation', '12. Generación de leads gratis'],
  },
  'marcos-razzetti': {
    funnels: ['formulario', 'vsl-llamada', 'lead-magnet'], tema: 'captar clientes para una agencia: carnada, filtro y sesión estratégica', canal: 'Meta Ads e Instagram', para: 'Agencias de marketing',
    evidencia: ['05 Cómo crear funnels que conviertan desconocido', '06 Cómo crear y lanzar campañas de anuncios', '10. COMO PERSUADIR POR HISTORIAS'],
  },
  'ramiro-cubria': {
    funnels: ['organico'], tema: 'vender conocimiento: contenido de nicho, DM en frío y la llamada', canal: 'Instagram y mensajes en frío', para: 'Coaches, consultores y agencias',
    evidencia: ['2 Contenido de Nicho vs Contenido Viral', '3 Creación de Carruseles', '2 Sistema de DM en frío'],
    nota: 'Su curso también enseña el embudo a un VSL («3 Embudo a VSL»), pero su ficha en MaKo es de contenido, DM en frío y la llamada: el VSL no se ofrece con él.',
  },
  'jaime-higuera': {
    funnels: [], tema: 'socio de crecimiento: una oferta con nombre, el setting y una llamada corta antes de vender', canal: 'Mensajes y llamadas', para: 'Agencias y servicios entre empresas',
    evidencia: ['Setting & Generar Reuniones', 'Dominando la Llamada de Demo'],
    nota: 'Su curso trae clases de mini-VSL y de anuncios, pero su ficha en MaKo es de oferta, setting y la llamada: no se ofrece como funnel.',
  },
  'juan-ads': {
    funnels: ['mensajes', 'carrito'], tema: 'campañas en Meta: fases, públicos, microexperimentación y escala', canal: 'Meta Ads', para: 'Servicios y productos que venden con anuncios',
    evidencia: ['Objetivos 3 - Interacción-Mensajes', 'Objetivos 6 - Ventas', 'Microexperimentación Horizontal'],
    nota: 'Enseña a armar y escalar las campañas, no la página ni la llamada. Su curso trae el objetivo de clientes potenciales (formularios), pero su ficha no: el formulario no se ofrece con él.',
  },
  'felipe-vergara': {
    funnels: ['mensajes', 'carrito'], tema: 'anuncios que venden: el presupuesto desde la meta, el semáforo y escalar', canal: 'Meta Ads y WhatsApp', para: 'Negocios que venden por WhatsApp o tienda',
    evidencia: ['10. Campañas de Mensajes en la Unión Europea', '2. Cómo optimizar tus ventas en WhatsApp', '10. Mejores tiendas de Shopify'],
  },
  // ── Otra parte de la venta: no arman un funnel para conseguir clientes ──
  'hormozi': {
    funnels: [], tema: 'la oferta: atracción, upsell, downsell y continuidad', canal: 'La oferta', para: 'Negocios que ya venden y quieren que cada cliente deje más',
    evidencia: ['1. Continuity Offers', '1. Upsell Offers', '1. Downsell Offers'],
  },
  'juan-carrizo': {
    funnels: [], tema: 'la oferta y el valor: método único, precio y escalera', canal: 'La oferta', para: 'Expertos que venden conocimiento',
    evidencia: ['9. Como crear tu oferta', '12. Validacion de oferta'],
    nota: 'Su curso también trae clases de VSL y de lanzamientos, pero su ficha en MaKo es de oferta y precio: por eso no se ofrece como funnel.',
  },
  'agustin-nievas': {
    funnels: [], tema: 'el cierre en la llamada: descubrimiento, oferta y objeciones', canal: 'Llamadas de venta', para: 'Ventas de ticket alto por llamada',
    evidencia: ['3. La transición perfecta para presentar una Ofe', '1. Descubriendo como si fuese tu llamada'],
  },
  'samuel-albaa': {
    funnels: [], tema: 'la práctica del closer: la primera impresión y adaptarse a la persona', canal: 'Llamadas de venta', para: 'Quien toma las llamadas',
    evidencia: ['7. Cómo tomar notas en llamada', '3. Analisis de llamada B2C'],
  },
  'augusto-bianchi': {
    funnels: [], tema: 'la llamada de ticket alto: sus etapas, el dolor y las objeciones', canal: 'Llamadas de venta', para: 'Ventas de ticket alto por llamada',
    evidencia: ['Procesos y Bases Fundamentales de la Llamada', 'Clase 6 - Guion de Ventas High Ticket'],
  },
  'tino-mossu': {
    funnels: [], tema: 'objeciones y seguimiento del closer', canal: 'Llamadas y WhatsApp', para: 'Quien toma las llamadas',
    evidencia: ['4 Principios de las Objeciones', 'Embudo de Objeciones', 'Venta VS Cierre'],
  },
  'adria-sola': {
    funnels: [], tema: 'comunicación: la voz, las historias y hablar con autoridad', canal: 'Cámara y llamadas', para: 'Quien da la cara por su negocio',
    evidencia: ['5. Voz con Autoridad', '3. La Estructura Perfecta Cómo Crear Historias'],
  },
  'iman-gadzhi': {
    funnels: [], tema: 'agencias: prospección en frío, vender la reunión y cobrar', canal: 'Llamadas y correos en frío', para: 'Agencias',
    evidencia: ['(2) Finding Leads & Qualifying', '(4) Cold Calling'],
  },
  'romuald-fons': {
    funnels: [], tema: 'SEO: aparecer en Google por lo que la gente busca', canal: 'Google', para: 'Negocios con una web',
    evidencia: ['01Introducción al SEO', 'Funnel de Ventas'],
  },
  'jordi-segues': {
    funnels: [], tema: 'TikTok: el algoritmo, la retención y los formatos', canal: 'TikTok', para: 'Marca personal en TikTok',
    evidencia: ['3.1 – Entender el algoritmo de TikTok', '1.3 - ¿Qué contenido reina en TikTok'],
    nota: 'Su curso es de TikTok; el orgánico del CoPilot es Instagram.',
  },
  'marc-verdu': {
    funnels: [], tema: 'tiendas online con video orgánico', canal: 'TikTok, Reels y Shorts', para: 'Ecommerce de producto físico',
    evidencia: ['1. Cómo creamos las cuentas de tiktok', 'Dónde pongo el enlace a mi tienda'],
    nota: 'Su método es para vender productos físicos en una tienda, no un servicio.',
  },
};

export const queEnsena = (id: unknown): QueEnsena | null => (typeof id === 'string' && id in QUE_ENSENA ? QUE_ENSENA[id as IdAsesor] : null);

/** ¿Ese referente enseña ese funnel (medido)? */
export const ensenaElFunnel = (id: IdAsesor | null | undefined, f: IdFunnel | null | undefined): boolean => !!id && !!f && !!queEnsena(id)?.funnels.includes(f);

/** Quiénes enseñan un funnel, los que lo tienen primero en su lista antes. */
export function quienesEnsenan(f: IdFunnel, sin: IdAsesor | null = null): IdAsesor[] {
  return (Object.keys(QUE_ENSENA) as IdAsesor[])
    .filter((id) => id !== sin && QUE_ENSENA[id].funnels.includes(f))
    .sort((a, b) => QUE_ENSENA[a].funnels.indexOf(f) - QUE_ENSENA[b].funnels.indexOf(f));
}

/**
 * La ficha que viaja con cada funnel cuando no hay un referente que lo enseñe: la de quien mejor lo cubre para un negocio de
 * servicios. Con YouTube, Sergio Begueria (marca personal) y no Derek Chamizo (canales que viven de la publicidad); con el VSL y el
 * formulario, Marcos Razzetti (su «máquina de selección natural»: registro, video, agenda y formulario de aplicación) y no Juan ADS,
 * que enseña la campaña y no el embudo.
 */
export const FICHA_POR_FUNNEL: Readonly<Record<IdFunnel, IdAsesor>> = {
  'vsl-llamada': 'marcos-razzetti', mensajes: 'felipe-vergara', formulario: 'marcos-razzetti', carrito: 'juan-ads',
  webinar: 'francisco-doglio', 'lead-magnet': 'sofia-contreras', youtube: 'sergio-begueria', organico: 'julian-otalora',
};
