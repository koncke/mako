// =============================================================================
// copywriter/tipos — lo que es un guion del Copywriter (un módulo de DATOS, sin server-only)
// =============================================================================
// Pedido de Martín (28/10/2026): «Quiero que implementes mila.gg combinado con notion en "copywriter" y que allí se
// puedan crear los guiones de ads, de reels, de stories, de youtube». Diseño: docs/diseno-copywriter.md.
//
// SIN 'server-only', a propósito: lo leen la pantalla (cliente), el teléfono, el server, la API de MaKo y los tests.
// Un guion es una PÁGINA (en el índice: título, emoji, tipo, lugar en el árbol) y un DOCUMENTO (las propiedades y el
// contenido de ProseMirror). Viven separados (D4): renombrar o mover no reescribe el documento, y guardar el documento
// no compite con el árbol.
// =============================================================================

/**
 * Los tipos de página. Los cuatro primeros los pidió Martín el 28/10 (los guiones); el 29/10, con «Copywriter = Notion»,
 * cada documento es una página y «Nueva» abre templates de anuncios, emails, posts y VSL (docs/diseno-copywriter.md, D12):
 * se suman al FINAL (el orden es el de los selectores, y un índice guardado sólo trae los cuatro de antes).
 */
export const TIPOS_GUION = ['ad', 'reel', 'story', 'youtube', 'vsl', 'email', 'post', 'pagina'] as const;
export type TipoGuion = (typeof TIPOS_GUION)[number];

/** Cómo se ve cada tipo: su nombre (en inglés, como las tabs), el emoji de la página nueva y su duración típica. */
export const INFO_TIPO: Readonly<Record<TipoGuion, { label: string; emoji: string; duracion: number | null; uno: string }>> = {
  ad: { label: 'Ad', emoji: '📣', duracion: 45, uno: 'un anuncio' },
  reel: { label: 'Reel', emoji: '🎬', duracion: 45, uno: 'un reel' },
  story: { label: 'Story', emoji: '📱', duracion: null, uno: 'un día de stories' },
  youtube: { label: 'YouTube', emoji: '▶️', duracion: 600, uno: 'un video de YouTube' },
  vsl: { label: 'VSL', emoji: '🎥', duracion: 900, uno: 'una VSL' },
  email: { label: 'Email', emoji: '✉️', duracion: null, uno: 'un email' },
  post: { label: 'Post', emoji: '📝', duracion: null, uno: 'un post' },
  pagina: { label: 'Página', emoji: '📄', duracion: null, uno: 'una página' },
};

/**
 * Los tipos con MÉTODO (ángulo, estructura y duración, de la biblioteca de guiones): los que se graban o se pautan.
 * Un email, un post o una página en blanco no los tienen: su página no muestra esas propiedades (Notion no muestra
 * propiedades en una página suelta).
 */
export const TIPOS_CON_METODO: readonly TipoGuion[] = ['ad', 'reel', 'story', 'youtube', 'vsl'];
export const tieneMetodo = (t: TipoGuion): boolean => TIPOS_CON_METODO.includes(t);

export const esTipoGuion = (v: unknown): v is TipoGuion => typeof v === 'string' && (TIPOS_GUION as readonly string[]).includes(v);

/** Las propiedades de la página (Notion): debajo del título, arriba del cuerpo. `null` = sin elegir. */
export type PropsGuion = {
  tipo: TipoGuion;
  /** Id de la biblioteca de Ángulos (lib/guion-angulos.ts). */
  angulo: string | null;
  /** Id de la biblioteca de Estructuras (lib/guion-estructuras.ts). */
  estructura: string | null;
  /** En segundos. */
  duracion: number | null;
  /**
   * La plantilla de la que nació la página (lib/copywriter/plantillas.ts, 29/10/2026): con ella la página ofrece «Ver ejemplo» y
   * MaKo pregunta para qué es y a qué oferta adaptarla (./iniciativa.ts). No se muestra en las propiedades.
   */
  plantilla?: string | null;
  /**
   * El outlier que replica la página (lib/copywriter/outliers.ts, `spy:<id>` o `biblioteca:<id>`; 11/11/2026, D18): MaKo lo
   * recibe como referencia en cada pedido y la barra ofrece «Ver el original». No se muestra en las propiedades.
   */
  outlier?: string | null;
  /**
   * El video DESARMADO del que salió la página (ticket 97, `<red>.<id>`, lib/video-desarmar.ts → `claveDeDesarme`): «Hacer uno así»
   * de un video de Competitors Spy lo pone, y la página muestra al lado su edición plano a plano con «Abrir en el editor».
   * No se muestra en las propiedades.
   */
  desarme?: string | null;
};

/** Un nodo de ProseMirror como JSON (lo que guarda TipTap con `getJSON()`). */
export type JsonNodo = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNodo[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** Una fila del índice: la página en el árbol. */
export type PaginaCopy = {
  id: string;
  titulo: string;
  emoji: string | null;
  tipo: TipoGuion;
  /** La página de la que cuelga; null = en la raíz. */
  padre: string | null;
  /** El lugar entre sus hermanas (0, 1, 2…). */
  orden: number;
  /** ISO de la última vez que se tocó (el documento o la página). */
  actualizado: string;
  /** ISO de cuando fue a la Papelera; ausente = viva. */
  papelera?: string | null;
};

/** El documento de un guion, como se guarda. */
export type DocCopy = {
  /** La concurrencia optimista: guardar exige la que se abrió (D4). */
  version: number;
  props: PropsGuion;
  contenido: JsonNodo;
  /** Quién guardó la última vez (D9): la marca que ve el dueño cuando alguien editó con un link compartido. */
  editado?: EditadoPor | null;
};

/**
 * La marca de quién editó (D9). `afuera`: lo guardó alguien con un link compartido, no el equipo. `por` es lo que se
 * muestra: el nombre del usuario, el del invitado (o su email) o el que escribió quien entró con el link, que NO está
 * verificado (por eso la pantalla dice «con el link»).
 */
export type EditadoPor = { por: string; afuera: boolean; at: string };

/** Lo que abre la pantalla: la página y su documento. */
export type GuionAbierto = { pagina: PaginaCopy; doc: DocCopy };

/** Dónde vive cada cosa en `app_settings` del negocio (D4). */
export const CLAVE_INDICE = 'mako.copywriter.indice';
export const PREFIJO_DOC = 'mako.copywriter.doc.';
export const claveDoc = (id: string): string => `${PREFIJO_DOC}${id}`;

/** Un id de página: «g» + 10 letras o números. Lo arma el server; el formato se valida en cada entrada. */
export const ID_PAGINA_RE = /^g[a-z0-9]{6,16}$/;
export const esIdPagina = (v: unknown): v is string => typeof v === 'string' && ID_PAGINA_RE.test(v);

/**
 * Los topes. Los que se miden en bytes son más bajos que el techo de un setting a propósito: la pantalla dice
 * «demasiado largo» antes que la base. `bytesGuardado` es lo que entra en un `keepalive` (64 KB, el tope del
 * navegador) con aire: un guardado más grande al cerrar la pestaña va sin keepalive.
 */
export const TOPES = {
  paginas: 500,
  titulo: 200,
  bytesContenido: 400_000,
  bloques: 1_200,
  profundidad: 12,
  texto: 20_000,
  profundidadArbol: 8,
  bytesGuardado: 60_000,
} as const;

/** El título de una página sin título: el de Notion. */
export const SIN_TITULO = 'Sin título';

/** Las propiedades de una página nueva de ese tipo. */
export function propsNuevas(tipo: TipoGuion, estructura: string | null = null, extra: { plantilla?: string | null; duracion?: number | null } = {}): PropsGuion {
  return { tipo, angulo: null, estructura, duracion: extra.duracion ?? INFO_TIPO[tipo].duracion, plantilla: extra.plantilla ?? null };
}

/** Lee las propiedades a la defensiva (lo que vino de la base o de un pedido). */
export function sanearProps(v: unknown, tipoPorDefecto: TipoGuion = 'ad'): PropsGuion {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const tipo = esTipoGuion(o.tipo) ? o.tipo : tipoPorDefecto;
  const id = (x: unknown) => (typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x) ? x : null);
  const d = typeof o.duracion === 'number' && Number.isFinite(o.duracion) ? Math.round(o.duracion) : null;
  // El outlier sólo con su forma (`<fuente>:<id>`, lib/copywriter/outliers.ts): una página sin él no lo guarda (ni `null`).
  const outlier = typeof o.outlier === 'string' && /^(spy|biblioteca):-?\d{1,12}$/.test(o.outlier) ? o.outlier : null;
  // El video desarmado (ticket 97): sólo con la forma de `claveDeDesarme` (lib/video-desarmar.ts). Sin él, no se guarda.
  const desarme = typeof o.desarme === 'string' && /^(instagram|youtube|tiktok|meta-ads|subido)\.[A-Za-z0-9_-]{3,64}$/.test(o.desarme) ? o.desarme : null;
  return { tipo, angulo: id(o.angulo), estructura: id(o.estructura), duracion: d != null && d > 0 && d <= 7_200 ? d : null, plantilla: id(o.plantilla), ...(outlier ? { outlier } : {}), ...(desarme ? { desarme } : {}) };
}
