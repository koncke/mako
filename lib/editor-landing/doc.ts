// =============================================================================
// editor-landing/doc — la FORMA de una landing del editor copiado de Gamma
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño y contratos entre piezas:
// docs/diseno-editor-landing.md.
//
// Este módulo es PURO (sin server-only, sin React, sin DOM): lo importan el editor
// (cliente), el server (validar, publicar, IA) y los tests. Es la ÚNICA fuente de:
//   · los nombres de nodo y de marca del documento (lo que se guarda en jsonb),
//   · las LISTAS CERRADAS de cada atributo (lo que no está en la lista no se lee),
//   · los defaults y los helpers para armar tarjetas y documentos.
// Si cambia una lista acá, cambian solas la validación del server
// (validar.ts), el render público (render.ts) y el editor.
//
// Un documento es una lista de PÁGINAS (Gamma Sites es multipágina: la página de
// gracias, la de la oferta). Cada página es un documento de TipTap/ProseMirror cuyo
// `doc` tiene SOLO tarjetas («secciones» en el español de Gamma 5) como hijos.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// JSON de ProseMirror (lo que guarda la base)
// ─────────────────────────────────────────────────────────────────────────────

export type JsonMarca = { type: string; attrs?: Record<string, unknown> };
export type JsonNodo = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNodo[];
  text?: string;
  marks?: JsonMarca[];
};
export type DocPagina = { type: 'doc'; content: JsonNodo[] };

export type Pagina = {
  id: string;
  titulo: string;
  /** '' = la página de inicio. Si no, un segmento: /l/<slug>/<ruta>. */
  ruta: string;
  doc: DocPagina;
  seoTitulo?: string;
  seoDescripcion?: string;
};

export type LandingContenido = { v: 1; paginas: Pagina[] };

// ─────────────────────────────────────────────────────────────────────────────
// Nombres de nodo y marca (contrato: están escritos en la base)
// ─────────────────────────────────────────────────────────────────────────────

/** Nodos propios del editor. Los de StarterKit/Table conservan su nombre de TipTap. */
export const NODO = {
  tarjeta: 'tarjeta',
  columnas: 'columnas',
  columna: 'columna',
  optimizado: 'optimizado',          // «Diseños optimizados» (smart layouts)
  optimizadoItem: 'optimizadoItem',
  botones: 'botones',
  boton: 'boton',
  recuadro: 'recuadro',              // cuadros de llamada (callouts)
  desplegable: 'desplegable',        // toggle
  desplegableTitulo: 'desplegableTitulo',
  desplegableCuerpo: 'desplegableCuerpo',
  imagen: 'imagen',
  video: 'video',                    // video subido al bucket
  insertado: 'insertado',            // iframe de un proveedor de lib/embeds.ts
  formulario: 'formulario',          // captura → /api/track/optin (por el Pixel)
  grafico: 'grafico',                // gráficos inteligentes (SVG puro)
  espaciador: 'espaciador',
  htmlLibre: 'htmlLibre',            // HTML personalizado, en iframe sandbox
} as const;

/** Nodos de TipTap que se aceptan tal cual (StarterKit + listas de tareas + tablas). */
export const NODOS_TIPTAP = [
  'doc', 'text', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem',
  'taskList', 'taskItem', 'blockquote', 'horizontalRule', 'hardBreak',
  'table', 'tableRow', 'tableHeader', 'tableCell',
] as const;

export const MARCAS = ['bold', 'italic', 'underline', 'strike', 'link', 'textStyle', 'highlight', 'etiqueta'] as const;
export type Marca = (typeof MARCAS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Listas cerradas de atributos
// ─────────────────────────────────────────────────────────────────────────────

/** Imagen de acento de la tarjeta (Gamma: Sin imagen · Arriba · Derecha · Izquierda · Fondo). */
export const DISENOS_TARJETA = ['sin', 'arriba', 'izquierda', 'derecha', 'fondo'] as const;
export type DisenoTarjeta = (typeof DISENOS_TARJETA)[number];

export const ANCHOS_TARJETA = ['angosto', 'normal', 'amplio', 'completo'] as const;
export type AnchoTarjeta = (typeof ANCHOS_TARJETA)[number];

export const ALINEACIONES_TARJETA = ['arriba', 'centro', 'abajo'] as const;
export type AlineacionTarjeta = (typeof ALINEACIONES_TARJETA)[number];

export const ALTOS_TARJETA = ['auto', 'pantalla'] as const;
export type AltoTarjeta = (typeof ALTOS_TARJETA)[number];

/** Superposición sobre la imagen de fondo (Gamma: Esmerilado · Desvanecido · Claro). */
export const SUPERPOSICIONES = ['ninguna', 'oscura', 'clara', 'esmerilada'] as const;
export type Superposicion = (typeof SUPERPOSICIONES)[number];

export const AJUSTES_IMAGEN = ['cubrir', 'contener'] as const;
export type AjusteImagen = (typeof AJUSTES_IMAGEN)[number];

/** Fondo de una tarjeta: el del tema, un color propio o un degradado de la lista. */
export const FONDOS_TARJETA = ['tema', 'color', 'degradado', 'acento'] as const;
export type FondoTarjeta = (typeof FONDOS_TARJETA)[number];

export const DEGRADADOS = {
  aurora: 'linear-gradient(135deg, #3300D9 0%, #9D20C9 60%, #DF7A6C 100%)',
  cielo: 'linear-gradient(180deg, #1862D4 0%, #DAF4FE 70%, #FFFFFF 100%)',
  durazno: 'linear-gradient(135deg, #FFD3A5 0%, #FD6585 100%)',
  menta: 'linear-gradient(135deg, #D4FC79 0%, #96E6A1 100%)',
  noche: 'linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  lavanda: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)',
  fuego: 'linear-gradient(135deg, #F83600 0%, #F9D423 100%)',
  oceano: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)',
  grafito: 'linear-gradient(160deg, #232526 0%, #414345 100%)',
  arena: 'linear-gradient(135deg, #F5E6CA 0%, #E2C391 100%)',
} as const;
export type Degradado = keyof typeof DEGRADADOS;

/** Columnas: de 2 a 6, anchos en una grilla de 12. */
export const MIN_COLUMNAS = 2;
export const MAX_COLUMNAS = 6;

/** Cuadros de llamada (Gamma: información, nota, advertencia, precaución, éxito, pregunta). */
export const TONOS_RECUADRO = ['info', 'nota', 'advertencia', 'precaucion', 'exito', 'pregunta'] as const;
export type TonoRecuadro = (typeof TONOS_RECUADRO)[number];

export const VARIANTES_BOTON = ['primario', 'secundario', 'contorno'] as const;
export type VarianteBoton = (typeof VARIANTES_BOTON)[number];

export const ALINEACIONES = ['izquierda', 'centro', 'derecha'] as const;
export type Alineacion = (typeof ALINEACIONES)[number];

/** Ancho de una imagen de bloque, en % del texto (lista cerrada, como EditorRico). */
export const ANCHOS_IMAGEN = Array.from({ length: 19 }, (_, i) => 10 + i * 5) as readonly number[];
export const FORMAS_IMAGEN = ['normal', 'redondeada', 'circulo'] as const;
export type FormaImagen = (typeof FORMAS_IMAGEN)[number];

export const ALTOS_ESPACIADOR = ['s', 'm', 'l', 'xl'] as const;
export type AltoEspaciador = (typeof ALTOS_ESPACIADOR)[number];

/** Tamaño de letra por selección (Gamma: menú de tamaño). Nunca un px libre. */
export const TAMANOS_TEXTO = ['xs', 's', 'm', 'l', 'xl', '2xl'] as const;
export type TamanoTexto = (typeof TAMANOS_TEXTO)[number];

/** Variantes de párrafo: antetítulo (el texto chico sobre el título), cuerpo grande o chico. */
export const VARIANTES_PARRAFO = ['antetitulo', 'grande', 'pequeno'] as const;
export type VarianteParrafo = (typeof VARIANTES_PARRAFO)[number];

/** heading.variante 'titulo' = el «Título» grande de Gamma (display), sobre un h1. */
export const NIVELES_TITULO = [1, 2, 3, 4] as const;

/** Colores de texto/resaltado: tokens del tema o un hex. */
export const COLORES_TEMA = ['acento', 'texto', 'titulo', 'tenue', 'paleta-1', 'paleta-2', 'paleta-3', 'paleta-4', 'paleta-5', 'paleta-6'] as const;
export type ColorTema = (typeof COLORES_TEMA)[number];

export const TIPOS_GRAFICO = ['barras', 'columnas', 'columnasApiladas', 'lineas', 'area', 'circular', 'dona'] as const;
export type TipoGrafico = (typeof TIPOS_GRAFICO)[number];

export const TIPOS_CAMPO = ['nombre', 'email', 'telefono', 'empresa', 'texto', 'textoLargo', 'opciones'] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const ALTOS_HTML_LIBRE = [120, 200, 300, 400, 500, 600, 800] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Diseños optimizados (smart layouts). Los NOMBRES son los de Gamma en español.
// La variante es sólo un atributo: cambiar de diseño no toca el contenido.
// ─────────────────────────────────────────────────────────────────────────────

export type GrupoOptimizado =
  | 'Viñetas' | 'Cajas' | 'Texto con línea' | 'Línea de tiempo' | 'Flechas' | 'Etapas'
  | 'Escalera' | 'Pirámide' | 'Embudo' | 'Ciclos' | 'Estadísticas' | 'Comparación'
  | 'Imágenes' | 'Personas' | 'Íconos' | 'Citas';

export const OPTIMIZADOS = [
  { id: 'vinetas-grandes', nombre: 'Viñetas grandes', grupo: 'Viñetas' },
  { id: 'vinetas-pequenas', nombre: 'Viñetas pequeñas', grupo: 'Viñetas' },
  { id: 'vinetas-iconos', nombre: 'Viñetas con íconos', grupo: 'Viñetas' },
  { id: 'vinetas-flechas', nombre: 'Viñetas con flechas', grupo: 'Viñetas' },
  { id: 'vinetas-numeradas', nombre: 'Viñetas numeradas', grupo: 'Viñetas' },
  { id: 'cajas-solidas', nombre: 'Cajas sólidas', grupo: 'Cajas' },
  { id: 'cajas-delineadas', nombre: 'Cajas delineadas', grupo: 'Cajas' },
  { id: 'cajas-iconos', nombre: 'Cajas con íconos arriba', grupo: 'Cajas' },
  { id: 'cajas-numeros', nombre: 'Cajas con números', grupo: 'Cajas' },
  { id: 'cajas-linea-lateral', nombre: 'Cajas con línea lateral', grupo: 'Cajas' },
  { id: 'cajas-alternadas', nombre: 'Cajas alternadas', grupo: 'Cajas' },
  { id: 'cajas-unidas', nombre: 'Cajas unidas', grupo: 'Cajas' },
  { id: 'linea-superior', nombre: 'Texto con línea superior', grupo: 'Texto con línea' },
  { id: 'linea-lateral', nombre: 'Texto con línea lateral', grupo: 'Texto con línea' },
  { id: 'linea-divisoria', nombre: 'Líneas divisorias', grupo: 'Texto con línea' },
  { id: 'tiempo-horizontal', nombre: 'Línea de tiempo horizontal', grupo: 'Línea de tiempo' },
  { id: 'tiempo-vertical', nombre: 'Línea de tiempo vertical', grupo: 'Línea de tiempo' },
  { id: 'tiempo-dos-lados', nombre: 'Línea de tiempo de dos lados', grupo: 'Línea de tiempo' },
  { id: 'tiempo-minimalista', nombre: 'Línea de tiempo minimalista', grupo: 'Línea de tiempo' },
  { id: 'flechas-horizontales', nombre: 'Flechas horizontales', grupo: 'Flechas' },
  { id: 'flechas-verticales', nombre: 'Flechas verticales', grupo: 'Flechas' },
  { id: 'chevrones', nombre: 'Cadena de chevrones', grupo: 'Flechas' },
  { id: 'etapas-horizontales', nombre: 'Etapas horizontales', grupo: 'Etapas' },
  { id: 'etapas-verticales', nombre: 'Etapas verticales', grupo: 'Etapas' },
  { id: 'etapas-iconos', nombre: 'Etapas del proceso con íconos', grupo: 'Etapas' },
  { id: 'escalera', nombre: 'Escalera', grupo: 'Escalera' },
  { id: 'piramide', nombre: 'Pirámide', grupo: 'Pirámide' },
  { id: 'piramide-escalonada', nombre: 'Pirámide escalonada', grupo: 'Pirámide' },
  { id: 'embudo', nombre: 'Embudo', grupo: 'Embudo' },
  { id: 'embudo-minimalista', nombre: 'Embudo minimalista', grupo: 'Embudo' },
  { id: 'ciclo', nombre: 'Ciclo', grupo: 'Ciclos' },
  { id: 'radial', nombre: 'Radial', grupo: 'Ciclos' },
  { id: 'circulos-concentricos', nombre: 'Círculos concéntricos', grupo: 'Ciclos' },
  { id: 'numeros-grandes', nombre: 'Números grandes', grupo: 'Estadísticas' },
  { id: 'estadisticas-circulares', nombre: 'Estadísticas circulares', grupo: 'Estadísticas' },
  { id: 'estadisticas-barras', nombre: 'Estadísticas de barras', grupo: 'Estadísticas' },
  { id: 'metrica-destacada', nombre: 'Métrica destacada', grupo: 'Estadísticas' },
  { id: 'estrellas', nombre: 'Calificación por estrellas', grupo: 'Estadísticas' },
  { id: 'lado-a-lado', nombre: 'Lado a lado', grupo: 'Comparación' },
  { id: 'versus', nombre: 'Versus', grupo: 'Comparación' },
  { id: 'pros-contras', nombre: 'Pros y contras', grupo: 'Comparación' },
  { id: 'galeria', nombre: 'Galería', grupo: 'Imágenes' },
  { id: 'imagenes-texto', nombre: 'Imágenes con texto', grupo: 'Imágenes' },
  { id: 'imagenes-circulares', nombre: 'Imágenes circulares', grupo: 'Imágenes' },
  { id: 'logos', nombre: 'Galería de logotipos', grupo: 'Imágenes' },
  { id: 'equipo', nombre: 'Fotos del equipo', grupo: 'Personas' },
  { id: 'nombre-rol', nombre: 'Nombre y rol', grupo: 'Personas' },
  { id: 'iconos-texto', nombre: 'Íconos con texto', grupo: 'Íconos' },
  { id: 'iconos-izquierda', nombre: 'Íconos a la izquierda', grupo: 'Íconos' },
  { id: 'iconos-grandes', nombre: 'Íconos principales', grupo: 'Íconos' },
  { id: 'citas', nombre: 'Citas', grupo: 'Citas' },
  { id: 'citas-caras', nombre: 'Citas con caras', grupo: 'Citas' },
] as const satisfies readonly { id: string; nombre: string; grupo: GrupoOptimizado }[];

export type VarianteOptimizado = (typeof OPTIMIZADOS)[number]['id'];
export const VARIANTES_OPTIMIZADO = OPTIMIZADOS.map((o) => o.id) as readonly VarianteOptimizado[];
export const MIN_ITEMS_OPTIMIZADO = 1;
export const MAX_ITEMS_OPTIMIZADO = 12;
/** Ítems por fila: 'auto' decide el CSS según la variante y la cantidad. */
export const COLUMNAS_OPTIMIZADO = ['auto', '1', '2', '3', '4', '5', '6'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Atributos por nodo (la forma; los valores se validan contra las listas)
// ─────────────────────────────────────────────────────────────────────────────

export type AttrsTarjeta = {
  id: string;
  diseno: DisenoTarjeta;
  imagenSrc: string | null;     // URL pública del bucket landing-imagenes
  imagenFocoX: number;          // 0..100 (%)
  imagenFocoY: number;          // 0..100 (%)
  imagenAjuste: AjusteImagen;
  superposicion: Superposicion;
  fondo: FondoTarjeta;
  fondoColor: string | null;    // #rrggbb cuando fondo = 'color'
  fondoDegradado: Degradado | null;
  ancho: AnchoTarjeta;
  alineacion: AlineacionTarjeta;
  alto: AltoTarjeta;
  oculta: boolean;              // no se presenta ni se publica
  notas: string;                // notas del orador (privadas)
  bloqueadaIA: boolean;         // «Bloquear» para la IA (sugerencia, como en Gamma)
};

export const ATTRS_TARJETA_DEFAULT: Omit<AttrsTarjeta, 'id'> = {
  diseno: 'sin',
  imagenSrc: null,
  imagenFocoX: 50,
  imagenFocoY: 50,
  imagenAjuste: 'cubrir',
  superposicion: 'ninguna',
  fondo: 'tema',
  fondoColor: null,
  fondoDegradado: null,
  ancho: 'normal',
  alineacion: 'centro',
  alto: 'auto',
  oculta: false,
  notas: '',
  bloqueadaIA: false,
};

export type AttrsColumnas = { anchos: number[]; divisores: boolean };
export type AttrsOptimizado = { variante: VarianteOptimizado; columnas: (typeof COLUMNAS_OPTIMIZADO)[number]; mostrarIconos: boolean };
export type AttrsOptimizadoItem = { icono: string | null; imagenSrc: string | null; valor: string; destacado: boolean };
export type AttrsBotones = { alinea: Alineacion };
export type AttrsBoton = { href: string; variante: VarianteBoton; nuevaPestana: boolean };
export type AttrsRecuadro = { tono: TonoRecuadro };
export type AttrsImagen = { src: string; alt: string; ancho: number; alinea: Alineacion; href: string | null; forma: FormaImagen };
export type AttrsVideo = { src: string; ancho: number; autoplay: boolean; bucle: boolean; poster: string | null };
/** Lo mismo que el nodo `insertado` de EditorRico: lo arma lib/embeds.ts. */
export type AttrsInsertado = { src: string; proveedor: string; alto: number | null };
export type CampoFormulario = { id: string; tipo: TipoCampo; etiqueta: string; requerido: boolean; opciones: string[] };
export type AttrsFormulario = { campos: CampoFormulario[]; boton: string; exito: string; redirigir: string | null };
export type SerieGrafico = { nombre: string; valores: number[] };
export type AttrsGrafico = {
  tipo: TipoGrafico; titulo: string; categorias: string[]; series: SerieGrafico[];
  mostrarValores: boolean; leyenda: boolean; sufijo: string; prefijo: string;
};
export type AttrsEspaciador = { alto: AltoEspaciador };
/**
 * `id` = el id ESTABLE del bloque (tanda 2, T6): la página publicada lo sirve desde su propia URL,
 * `/l/html/<docId>/<id>` (lib/editor-landing/html-libre.ts). null hasta que el saneo le pone uno
 * (validar.ts). `alto` es el alto de PARTIDA: el iframe se ajusta solo con lo que mide adentro.
 */
export type AttrsHtmlLibre = { id: string | null; html: string; alto: (typeof ALTOS_HTML_LIBRE)[number] };

/** Topes que el server aplica al guardar (y la IA respeta al generar). */
export const TOPES = {
  paginas: 12,
  tarjetasPorPagina: 60,
  bytesContenido: 1_500_000,
  caracteresTexto: 20_000,      // por nodo de texto
  // ~400 KB (tanda 2, T6): «Copia fiel» de una landing de afuera trae su <head> con los estilos.
  // Sigue bajo `bytesContenido`, que es el tope de la landing entera.
  htmlLibre: 400_000,
  camposFormulario: 10,
  categoriasGrafico: 24,
  seriesGrafico: 8,
  notas: 5_000,
  titulo: 200,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros
// ─────────────────────────────────────────────────────────────────────────────

/** Id corto y estable para tarjetas, páginas y campos. No es criptográfico. */
export function nuevoId(prefijo = 't'): string {
  const azar = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  return `${prefijo}${azar}`;
}

export function parrafo(texto = '', attrs?: Record<string, unknown>): JsonNodo {
  return texto ? { type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: texto }] } : { type: 'paragraph', ...(attrs ? { attrs } : {}) };
}

export function titulo(texto: string, nivel: 1 | 2 | 3 | 4 = 2, variante: 'titulo' | null = null): JsonNodo {
  return { type: 'heading', attrs: { level: nivel, variante }, content: texto ? [{ type: 'text', text: texto }] : undefined };
}

export function tarjeta(contenido: JsonNodo[], attrs: Partial<AttrsTarjeta> = {}): JsonNodo {
  return {
    type: NODO.tarjeta,
    attrs: { ...ATTRS_TARJETA_DEFAULT, ...attrs, id: attrs.id ?? nuevoId('t') },
    content: contenido.length ? contenido : [parrafo()],
  };
}

export function tarjetaVacia(): JsonNodo {
  return tarjeta([titulo('', 1), parrafo()]);
}

export function docPagina(tarjetas: JsonNodo[]): DocPagina {
  return { type: 'doc', content: tarjetas.length ? tarjetas : [tarjetaVacia()] };
}

export function contenidoVacio(): LandingContenido {
  return { v: 1, paginas: [{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: docPagina([tarjetaVacia()]) }] };
}

/** Texto plano de un subárbol (para SEO, IA, búsqueda y miniaturas). */
export function textoDe(n: JsonNodo | undefined | null, sep = '\n'): string {
  if (!n) return '';
  if (n.type === 'text') return n.text ?? '';
  if (!n.content?.length) return '';
  const bloque = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'tableRow', NODO.tarjeta, NODO.optimizadoItem, NODO.desplegableTitulo, NODO.desplegableCuerpo]);
  return n.content.map((c) => textoDe(c, sep)).join(bloque.has(n.type) ? sep : '').replace(/\n{3,}/g, '\n\n');
}

export function textoDeContenido(c: LandingContenido): string {
  return c.paginas.map((p) => textoDe(p.doc as JsonNodo)).join('\n\n').trim();
}

/** El primer título de una tarjeta (para la tira de miniaturas y el esquema). */
export function tituloDeTarjeta(t: JsonNodo): string {
  const h = (t.content ?? []).find((n) => n.type === 'heading');
  return (h ? textoDe(h) : textoDe(t)).split('\n')[0].slice(0, 120);
}

/** Las tarjetas de una página (los hijos del doc). */
export function tarjetasDe(p: Pagina): JsonNodo[] {
  return (p.doc.content ?? []).filter((n) => n.type === NODO.tarjeta);
}

export function esHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function enLista<T extends string | number>(lista: readonly T[], v: unknown, def: T): T {
  return (lista as readonly unknown[]).includes(v) ? (v as T) : def;
}

/** Slug público: minúsculas, números y guiones, 3 a 60. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;
// `vista` es una carpeta FIJA de app/l (el link privado del borrador): una landing con ese slug
// tendría sus páginas tapadas por la ruta fija (server-reglas.ts, RUTAS_DE_L, lo frena también).
// `html` también (tanda 2): app/l/html/[docId]/[bloque] sirve el «HTML personalizado» publicado.
// `cono-tx` y `cono-doc` (tanda 4): en hola-mako.site el slug es el PRIMER segmento, y el matcher de
// proxy.ts no corre en `/cono-tx/…` ni `/cono-doc/…` (assets públicos de /conocimientos): las páginas
// internas de una landing con ese slug no llegarían al proxy que las reescribe
// (tests/editor-landing-origen.test.ts lo cruza con el matcher).
export const SLUGS_RESERVADOS = new Set(['api', 'admin', 'login', 'app', 'mako', 'vsl', 'www', 'static', 'assets', 'nuevo', 'editar', 'vista', 'html', 'cono-tx', 'cono-doc']);

export function slugDe(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/g, '') || 'landing';
}

export function slugValido(s: string): boolean {
  return SLUG_RE.test(s) && !SLUGS_RESERVADOS.has(s);
}

/** Ruta de una página dentro del sitio: '' o un segmento como el slug. */
export function rutaValida(r: string): boolean {
  return r === '' || SLUG_RE.test(r);
}

export const PREFIJO_PUBLICO = '/l';
/**
 * La ruta INTERNA de una landing en el host de la APP (`<base>/l/<slug>[/<ruta>]`: app/l/[slug]).
 * ⚠️ NO es la dirección que se muestra, se copia o se manda: desde la tanda 4 (14/10/2026) las landings
 * viven en hola-mako.site y esa sale de `urlPublicaLanding` (lib/app-url.ts) o, en el navegador, de
 * `urlLandingEn` con la base que da el server (lib/editor-landing/origen-landings.ts). Sólo la usa
 * pagina-publica.ts para el 308 a minúsculas en la misma ruta interna (tests/editor-landing-origen.test.ts
 * lo fija).
 * ⚠️ Hasta la revisión de la tanda 4 se llamaba `urlPublica(base, slug, ruta)` y armaba la dirección
 *    que se mostraba. Se renombró para que una rama armada antes de la mudanza (la API de MaKo:
 *    `urlPublica(APP_BASE_URL, slug)`) NO COMPILE al integrarse, en vez de seguir mandando
 *    `hola-mako.com/l/<slug>` en silencio. Lo que se muestra, se copia o se manda: `urlPublicaLanding`.
 */
export function rutaInternaL(slug: string, ruta = ''): string {
  return `${PREFIJO_PUBLICO}/${slug}${ruta ? `/${ruta}` : ''}`;
}
