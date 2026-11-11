// =============================================================================
// knowledge-modulos — Knowledge: el conocimiento de los cursos, por MÓDULO (31/10/2026)
// =============================================================================
// Martín (21/07/2026, el análisis que estaba pausado): «todo esto lo utilizaremos como el CONOCIMIENTO o el RAG de
// MaKo... Claro que no directamente, exacto como está la info cargada: debemos pasar por un proceso de razonamiento».
// Y sus tres decisiones de ese día: (a) el destilado vive donde ya vive el conocimiento, renombrado para que no se
// confunda con los cursos, **general de todo MaKo y clasificado por tema**; (b) sirve de RAG consultable Y de playbook;
// (c) la curación se hace afuera de la app (consume créditos de IA) y queda a la vista para corregirla.
//
// ESTE ARCHIVO ES EL PUNTO (a): la clasificación por tema, en código. Un MÓDULO es un tema del material de formación:
//   · de qué SECCIONES del portal de cursos sale (app/conocimientos/catalogo.ts, el mapa CATEGORIA);
//   · en qué `area` de `mako_knowledge` aterriza su destilado, que es por dónde se enchufa al prompt;
//   · qué TABS lo consumen (las keys del nav), para que no haya que cablear un área en cada writer.
//
// ⚠️ NO LISTA CURSOS. El catálogo de cursos ya es fuente única y tenerlo escrito dos veces es el bug #10 de
// docs/hallazgos-conocimiento.md (un curso nuevo nacía con el link compartido roto porque había dos listas). Acá se
// nombran SECCIONES, que son pocas y estables, y `tests/knowledge-modulos.test.ts` frena la sección que ya no existe:
// un módulo que apunta a una sección renombrada se queda sin cursos y nada lo avisaría.
//
// ⚠️ NI ESTADO. Cuánto método tiene cargado cada módulo es un dato de la base, no una constante: lo mide
// `estadoDeLosModulos()` (lib/knowledge.ts). Una constante que diga «destilado» miente el día que alguien borra las filas.
//
// PURO y sin `server-only`: lo importan el prompt (lib/mako-context.ts), la capa del grafo (lib/cerebro-knowledge.ts),
// el lector (lib/knowledge.ts), la pantalla y el test. Sin la base y sin el catálogo de cursos (5,8 MB de clases y
// transcripciones: importarlo acá lo metería en todos los bundles que leen un módulo).
// =============================================================================

import { LEAD_MAGNET_EN_PRODUCCION } from './lead-magnets/archivado';

/** Un tema del material de formación, y por dónde entra a MaKo. */
export type ModuloKnowledge = {
  /** El id del módulo. Es el prefijo de su nodo en el grafo (`kn:<key>`) y lo que pide la API. */
  key: string;
  /** Cómo se llama en pantalla. Corto: es una etiqueta. */
  nombre: string;
  /** Qué enseña, en una línea. Es lo que ve el modelo para decidir si le sirve. */
  que: string;
  /**
   * El `area` de `mako_knowledge` donde vive su destilado. Es LA PUERTA: `metodoDeTab` y `searchKnowledge({ area })`
   * filtran por esto. Dos módulos pueden compartir área (un área es un cajón del RAG, un módulo es un tema).
   */
  area: string;
  /** Las secciones del portal de cursos que lo alimentan (el mapa CATEGORIA de app/conocimientos/catalogo.ts). */
  secciones: readonly string[];
  /** Las tabs que lo consumen, por su key del nav. Vacío = sólo la plataforma. */
  tabs: readonly string[];
};

/**
 * LOS MÓDULOS. El orden es el de la pantalla y el del prompt: primero lo que le factura a un negocio.
 *
 * Las áreas `mensajes`, `ads` y `general` ya existen (lib/mako-knowledge.ts); `organico`, `oferta`, `paginas` y
 * `piezas` son nuevas y arrancan VACÍAS. No hace falta migración —`area` es texto libre— y mientras estén vacías
 * `metodoDeTab` cae al RAG general, así que ninguna tab queda peor que antes de existir Knowledge.
 */
export const MODULOS_KNOWLEDGE: readonly ModuloKnowledge[] = [
  {
    key: 'anuncios', nombre: 'Anuncios', area: 'ads',
    que: 'Cómo se escribe y se prueba un anuncio pago: ganchos, ángulos, creativos y qué mirar para cortarlo o escalarlo.',
    secciones: ['Anuncios'],
    tabs: ['ads-writer', 'ads-manager', 'market-an'],
  },
  {
    key: 'venta', nombre: 'Venta y seguimiento', area: 'mensajes',
    que: 'Cómo se conversa para vender: apertura, objeciones, seguimiento y el cierre de una llamada.',
    secciones: ['Ventas'],
    tabs: ['chats', 'closing-script', 'automatizaciones', 'sales-roleplay', 'sales-email', 'whatsapp'],
  },
  {
    key: 'organico', nombre: 'Contenido orgánico', area: 'organico',
    que: 'Cómo se construye alcance sin pauta: ganchos, formatos, guiones y ritmo de publicación.',
    secciones: ['Orgánico'],
    // Lead Magnet, ARCHIVADO el 11/11/2026 por pedido de Martín (lib/lead-magnets/archivado.ts): sin su tab, no se nombra.
    tabs: ['copywriter', 'stories', 'newsletters', ...(LEAD_MAGNET_EN_PRODUCCION ? ['lead-magnet-generator'] : []), 'youtube-writer'],
  },
  {
    key: 'oferta', nombre: 'Oferta y modelo de negocio', area: 'oferta',
    que: 'Cómo se arma lo que se vende: promesa, precio, garantía, escalera de productos y números del negocio.',
    secciones: ['Negocios digitales', 'Ecommerce', 'Finanzas'],
    tabs: ['offer', 'general', 'crm'],
  },
  {
    key: 'paginas', nombre: 'Páginas de venta', area: 'paginas',
    que: 'Cómo se estructura una VSL y una landing que convierte: secciones, orden y prueba.',
    // «MaKo» es la sección de lo PROPIO del portal, y ahí vive el curso `vsl-landing`. Una misma sección puede
    // alimentar varios módulos: «MaKo» también alimenta a `app`.
    secciones: ['MaKo'],
    tabs: ['landing-writer', 'vsl-writer'],
  },
  {
    key: 'piezas', nombre: 'Video, imagen y avatares', area: 'piezas',
    que: 'Cómo se produce la pieza: edición, ritmo, subtítulos, imágenes y avatares generados con IA.',
    secciones: ['Edición', 'Inteligencia Artificial'],
    tabs: ['video-generator', 'video-editor', 'image-editor', 'ai-avatar'],
  },
  {
    key: 'app', nombre: 'Cómo se construye MaKo', area: 'producto',
    que: 'El método de la casa para construir esta app: decisiones de diseño, reglas de producto y criterios.',
    secciones: ['MaKo'],
    // Sin tabs: `producto` es un área RESERVADA (lib/mako-knowledge.ts, AREAS_RESERVADAS) y no entra al RAG de un
    // negocio. Es del super admin trabajando SOBRE el dashboard, no del marketing de un cliente.
    tabs: [],
  },
];

/**
 * Las secciones del portal que A PROPÓSITO no tienen módulo: no son el oficio que MaKo hace por un negocio. Están
 * escritas para que nadie las lea como un olvido —y para que el día que una pase a tener módulo, se sepa que fue una
 * decisión y no un descuido.
 *
 *   «Desarrollo personal», «Idiomas», «Ciberseguridad» — formación del equipo, no método de marketing.
 *
 * Con las de los módulos tienen que sumar TODAS las secciones del portal: el test lo exige. Una sección nueva en
 * app/conocimientos/catalogo.ts frena hasta que alguien decida a qué módulo va su material o que no va a ninguno. Sin
 * eso, un curso nuevo entra al portal y su conocimiento no llega a ninguna parte, sin ningún síntoma.
 *
 * ⚠️ «Cursos externos» NO está acá porque NO EXISTE como sección efectiva: es el default que emite el pipeline en cada
 * `curso-*.ts` (103 archivos lo declaran) y el mapa CATEGORIA de `catalogo.ts` lo PISA en todos. Medido el 31/10/2026:
 * las secciones de verdad son 12. Contar las de los archivos en vez de las del catálogo da una lista que no existe.
 */
export const SECCIONES_SIN_MODULO: readonly string[] = ['Desarrollo personal', 'Idiomas', 'Ciberseguridad'];

export const modulosKnowledge = (): readonly ModuloKnowledge[] => MODULOS_KNOWLEDGE;

/**
 * Un módulo con cuánto método tiene cargado HOY. Lo mide `estadoDeLosModulos()` (lib/knowledge.ts), que es
 * `server-only`; el tipo vive acá para que la pantalla lo pueda recibir como prop sin importar nada del servidor.
 */
export type CargaDeModulo = {
  key: string; nombre: string; area: string; tabs: readonly string[]; secciones: readonly string[];
  /** Fichas activas que este workspace puede leer. */
  fichas: number;
  /**
   * De esas, cuántas se le PRESTAN a los demás negocios (`fuente: 'mako'`, lib/rag-prestamo.ts).
   *
   * ⚠️ ESTÁ ACÁ PORQUE ES LA TRAMPA DE ESTA FEATURE. Martín decidió el 21/07/2026 que Knowledge es «general de todo
   * MaKo», y el camino por el que se cargan las fichas desde la pantalla escribe `fuente: 'manual'`
   * (app/api/mako/knowledge/route.ts, `create` y `seed_curso`), que NO se presta: quedan sólo para el workspace que las
   * cargó. Un módulo con 40 fichas y 0 prestables se ve cargado y no le llega a ningún negocio.
   */
  prestables: number;
};

/** Las áreas de `mako_knowledge` que Knowledge declara, sin repetir. */
export const AREAS_KNOWLEDGE: readonly string[] = [...new Set(MODULOS_KNOWLEDGE.map((m) => m.area))];

export const moduloDeKey = (key: string): ModuloKnowledge | null => MODULOS_KNOWLEDGE.find((m) => m.key === key) ?? null;

/** Los módulos que una tab consume. Sin tab, los que le sirven a un negocio (los que declaran alguna). */
export function modulosDeTab(tab?: string | null): readonly ModuloKnowledge[] {
  const t = (tab ?? '').trim();
  if (!t) return MODULOS_KNOWLEDGE.filter((m) => m.tabs.length > 0);
  return MODULOS_KNOWLEDGE.filter((m) => m.tabs.includes(t));
}

/** Las áreas de `mako_knowledge` que le sirven a una tab, en el orden de los módulos. */
export const areasDeTab = (tab?: string | null): readonly string[] => [...new Set(modulosDeTab(tab).map((m) => m.area))];

/** El módulo que vive en un área (el primero que la declara: un área es un cajón, un módulo es un tema). */
export const moduloDeArea = (area: string): ModuloKnowledge | null => MODULOS_KNOWLEDGE.find((m) => m.area === area) ?? null;

export const ROTULO_MODULOS = 'LO QUE MAKO APRENDIÓ DE LOS CURSOS (Knowledge, por módulo)';

/**
 * El bloque del system prompt: una línea por módulo con qué enseña y dónde se usa, y nada del contenido.
 *
 * Es PURO: ni una consulta por turno. Está por el mismo motivo que `catalogoCorto` de lib/cerebro-funciones.ts —que el
 * modelo no niegue algo que existe— y porque sin el índice MaKo no sabe que puede PEDIR el método: el contenido entra
 * con `leer_modulo_knowledge` (la API) o con el lector de la tab, nunca acá.
 */
export function bloqueDeModulos(ms: readonly ModuloKnowledge[] = MODULOS_KNOWLEDGE.filter((m) => m.tabs.length > 0)): string {
  if (!ms.length) return '';
  const lineas = ms.map((m) => `- ${m.key} · ${m.nombre}: ${m.que} Se usa en: ${m.tabs.join(', ')}.`);
  return `${ROTULO_MODULOS}. Es el ÍNDICE, no el contenido: si una respuesta se apoya en el método, pide el del módulo que corresponda y cita de dónde sale. Si un módulo todavía no tiene método cargado, no lo inventes.\n${lineas.join('\n')}`;
}
