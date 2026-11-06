// =============================================================================
// creaciones-reglas — las creaciones que un negocio publica y sus estrellas: lo PURO
// =============================================================================
// Pedido de Martín (13/10/2026, punto 10), textual: «Quiero implementar el sistema de "estrellas" de github en todo
// MaKo... para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles. Yo claro que puedo hacer
// ciertos templates en un inicio, pero luego la comunidad se va a encargar.»
//
// UN mecanismo para todo MaKo (la tabla, mig 0273; el server, lib/creaciones.ts; las piezas de UI, app/creaciones/BotonEstrella,
// PublicarCreacion y GaleriaCreaciones). Lo que cambia por tipo —qué es la definición, cómo se exporta de una cosa del
// negocio y cómo se usa en otro— es el ENCHUFE de cada feature (lib/creaciones-enchufes.ts).
//
// Las reglas, y por qué:
//   · SE PUBLICA LA DEFINICIÓN, NUNCA LOS DATOS DEL NEGOCIO: el mismo criterio que «Copiar flujo» con un token (mig
//     0265). La arma el enchufe del tipo desde la cosa del negocio; nadie publica un JSON que mandó un navegador.
//   · UNA ESTRELLA POR NEGOCIO, no por persona (cinco del mismo equipo no inflan una creación), y un negocio no se
//     da estrellas a sí mismo: el orden por estrellas es lo que la comunidad VALORA, no lo que su autor empuja.
//   · RETIRAR NO BORRA: quien ya la usó tiene su copia, y su contador de usos sigue siendo verdad.
//
// SIN `server-only`: lo importan la API (lib/api-mako/areas/creaciones.def.ts), la pantalla y el test.
// =============================================================================

/** Los tipos de creación. Uno nuevo se agrega acá Y en lib/creaciones-enchufes.ts (si no, no se puede publicar).
 *  `guion` (6/11/2026): una página del Copywriter guardada como plantilla (Leila, 30/10: plantillas propias en todas las tabs). */
export const TIPOS_CREACION = ['automatizacion', 'dashboard', 'formato_video', 'formato_imagen', 'guion'] as const;
export type TipoCreacion = (typeof TIPOS_CREACION)[number];

/** `nav`: la key de app/_components/nav.ts que la CAPA del negocio tiene que tener para USAR una creación de ese tipo
 *  (un negocio sin Automations no recibe automatizaciones). */
export const INFO_TIPO: Record<TipoCreacion, { titulo: string; singular: string; feature: string; ruta: string; nav: string }> = {
  automatizacion: { titulo: 'Automatizaciones', singular: 'automatización', feature: 'Automations', ruta: '/automations', nav: 'setting' },
  dashboard: { titulo: 'Dashboards', singular: 'dashboard', feature: 'Dashboard', ruta: '/dashboard', nav: 'graphics' },
  formato_video: { titulo: 'Formatos de video', singular: 'formato de video', feature: 'Video Generator', ruta: '/video-generator', nav: 'video-generator' },
  // El Image Generator se retiró el 29/10/2026 sin pasar de «pronto»: los formatos de imagen son los DISEÑOS del Image
  // Editor (6/11/2026: su enchufe guarda un diseño como plantilla). El id del tipo no cambia: ya está en filas guardadas.
  formato_imagen: { titulo: 'Diseños', singular: 'diseño', feature: 'Image', ruta: '/image-editor', nav: 'image-editor' },
  guion: { titulo: 'Guiones', singular: 'guion', feature: 'Copywriting', ruta: '/copywriter', nav: 'copywriter' },
};

/**
 * Los tipos que YA tienen su enchufe (lib/creaciones-enchufes.ts: cómo se exporta, se valida y se usa). El compilador
 * exige un enchufe por cada uno. Los demás esperan al chat dueño de su feature (`POR_ENCHUFAR`): se listan en la
 * galería, y publicar uno contesta que todavía no se puede. tests/creaciones.test.ts exige que cada tipo esté en UNA de
 * las dos listas, y que una entrada de `POR_ENCHUFAR` ya enchufada falle (se queda vieja sola).
 */
export const ENCHUFADOS = ['automatizacion', 'guion', 'formato_imagen'] as const satisfies readonly TipoCreacion[];
export type TipoEnchufado = (typeof ENCHUFADOS)[number];
export const POR_ENCHUFAR: Partial<Record<TipoCreacion, string>> = {
  dashboard: 'Graphics',
  // Un proyecto del Video Editor vive en el NAVEGADOR (IndexedDB): el servidor sólo tiene una copia para leer, sin los
  // archivos. Su enchufe necesita que el editor arme la plantilla (docs/relevo/nube-plantillas.md).
  formato_video: 'Video Editor',
};
export const estaEnchufado = (t: TipoCreacion): t is TipoEnchufado => (ENCHUFADOS as readonly string[]).includes(t);

export const ORDENES_CREACIONES = ['estrellas', 'usos', 'recientes'] as const;

/** Los estados de una creación (mig 0407 suma 'privada': una plantilla propia que sólo ve su negocio). */
export const ESTADOS_CREACION = ['privada', 'publicada', 'retirada'] as const;
export type EstadoCreacion = (typeof ESTADOS_CREACION)[number];
export const estadoDe = (x: unknown): EstadoCreacion => (x === 'privada' || x === 'retirada' ? x : 'publicada');
export type OrdenCreaciones = (typeof ORDENES_CREACIONES)[number];

export const TOPE_TITULO_CREACION = 80;
export const TOPE_DESCRIPCION_CREACION = 500;
export const TOPE_AUTOR_CREACION = 80;
/** Lo que pesa como mucho una definición (una automatización de 60 tarjetas pesa ~60 KB). */
export const TOPE_DEFINICION_BYTES = 400_000;
export const POR_PAGINA_CREACIONES = 24;
export const TOPE_BUSQUEDA_CREACIONES = 80;

export const esTipoCreacion = (x: unknown): x is TipoCreacion => typeof x === 'string' && (TIPOS_CREACION as readonly string[]).includes(x);
export const esOrdenCreaciones = (x: unknown): x is OrdenCreaciones => typeof x === 'string' && (ORDENES_CREACIONES as readonly string[]).includes(x);

/** Lo que alguien quiere publicar, ya leído del pedido (la definición la pone el enchufe, no el pedido). */
export type DatosPublicacion = { titulo: string; descripcion: string; autorNombre: string };

/** Valida y limpia lo que escribe una persona al publicar. Devuelve el motivo si algo no va. */
export function sanearPublicacion(x: { titulo?: unknown; descripcion?: unknown; autorNombre?: unknown }): DatosPublicacion | { error: string } {
  const limpio = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  const titulo = limpio(x.titulo);
  if (!titulo) return { error: 'Ponle un título.' };
  if (titulo.length > TOPE_TITULO_CREACION) return { error: `El título va hasta ${TOPE_TITULO_CREACION} letras.` };
  const descripcion = typeof x.descripcion === 'string' ? x.descripcion.trim() : '';
  if (descripcion.length > TOPE_DESCRIPCION_CREACION) return { error: `La descripción va hasta ${TOPE_DESCRIPCION_CREACION} letras.` };
  const autorNombre = limpio(x.autorNombre);
  if (autorNombre.length > TOPE_AUTOR_CREACION) return { error: `El nombre del autor va hasta ${TOPE_AUTOR_CREACION} letras.` };
  return { titulo, descripcion, autorNombre };
}

/**
 * El id de la cosa en el negocio que la publica, como TEXTO: una automatización tiene un número y un anuncio del Video
 * Generator un UUID (Content Machine, 14/10/2026). null si no sirve. Lo que decide si existe es el enchufe de su tipo.
 */
export function sanearOrigenId(x: unknown): string | null {
  const s = typeof x === 'number' && Number.isFinite(x) ? String(Math.trunc(x)) : typeof x === 'string' ? x.trim() : '';
  return /^[A-Za-z0-9_-]{1,80}$/.test(s) ? s : null;
}

/** ¿Cabe la definición? Se mide en bytes del JSON, que es lo que se guarda. */
export function definicionCabe(def: unknown, tope = TOPE_DEFINICION_BYTES): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(def)).length <= tope;
  } catch {
    return false;
  }
}

/** Por qué este negocio NO puede darle una estrella a esta creación, o null si puede. */
export function porQueNoEstrella(c: { workspaceOrigen: number; estado: string }, ws: number): string | null {
  if (c.estado === 'privada') return 'Es una plantilla sólo de su negocio: las estrellas son para las compartidas.';
  if (c.estado !== 'publicada') return 'Esa creación ya no está publicada.';
  if (c.workspaceOrigen === ws) return 'Es tuya: las estrellas las dan los demás.';
  return null;
}

/** ¿Este negocio puede retirar esta creación? Su autor, o la plataforma (moderación). */
export function puedeRetirar(c: { workspaceOrigen: number }, ws: number, esPlataforma: boolean): boolean {
  return esPlataforma || c.workspaceOrigen === ws;
}

/**
 * Lo que se busca, listo para el filtro `or` de PostgREST: sin `,`, `(`, `)` ni comillas (parten la sintaxis del
 * filtro), espacios colapsados y recortado. Los acentos se QUEDAN: el título guardado los tiene, e `ilike` ignora
 * mayúsculas pero no acentos — sacarlos de la búsqueda haría que buscar «automatización» no encuentre ese título.
 */
export function normalizarBusqueda(q: unknown): string {
  if (typeof q !== 'string') return '';
  return q.normalize('NFC').replace(/[,()"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPE_BUSQUEDA_CREACIONES);
}

/** El patrón de `ilike` de una búsqueda, con `%`, `_` y `\` escapados (AGENTS.md: un patrón trae candidatos). */
export function patronBusqueda(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** «1,2 mil» como GitHub muestra «1.2k»: el número corto de una estrella o un uso. */
export function numeroCorto(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.trunc(n || 0)));
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10} mil`.replace('.', ',');
}

// ── Quién ve y quién usa (mig 0407) ──────────────────────────────────────────

/** Una publicada la ve cualquiera; una privada o retirada, sólo su negocio. */
export function puedeVer(c: { workspaceOrigen: number; estado: string }, ws: number): boolean {
  return c.estado === 'publicada' || c.workspaceOrigen === ws;
}

/** Una publicada la usa cualquiera; una privada, sólo su negocio; una retirada, nadie (quien ya la usó tiene su copia). */
export function puedeUsar(c: { workspaceOrigen: number; estado: string }, ws: number): boolean {
  if (c.estado === 'publicada') return true;
  return c.estado === 'privada' && c.workspaceOrigen === ws;
}

// ── El ranking (6/11/2026) ───────────────────────────────────────────────────
// La galería ordena por estrellas de siempre; el ranking contesta otra pregunta: «¿qué está gustando AHORA?». En la
// semana y el mes manda cuántas estrellas recibió EN ese período (`creacion_estrellas.created_at`); a igual cantidad, las
// estrellas de siempre y después los usos. Lo que no recibió ninguna en el período no entra: un ranking de la semana con
// ceros es la galería con otro nombre. ⚠️ Sacar una estrella borra su fila: el período cuenta las que SIGUEN puestas.

export const PERIODOS_RANKING = ['semana', 'mes', 'siempre'] as const;
export type PeriodoRanking = (typeof PERIODOS_RANKING)[number];
export const esPeriodoRanking = (x: unknown): x is PeriodoRanking => typeof x === 'string' && (PERIODOS_RANKING as readonly string[]).includes(x);
export const DIAS_DEL_PERIODO: Readonly<Record<Exclude<PeriodoRanking, 'siempre'>, number>> = { semana: 7, mes: 30 };
export const TOPE_RANKING = 20;

/** Desde cuándo cuenta un período (null = siempre). */
export function desdeDelPeriodo(p: PeriodoRanking, ahora: Date): Date | null {
  if (p === 'siempre') return null;
  return new Date(ahora.getTime() - DIAS_DEL_PERIODO[p] * 24 * 3600 * 1000);
}

export type Rankeada<T> = T & { puesto: number; delPeriodo: number };

/**
 * El ranking: `filas` son las creaciones publicadas; `delPeriodo`, cuántas estrellas recibió cada una en el período (null
 * = siempre). Los empates comparten el puesto (1, 2, 2, 4), como en cualquier tabla de posiciones: dos con lo mismo no
 * tienen un orden que mostrar.
 */
export function rankear<T extends { id: number; estrellas: number; usos: number }>(
  filas: readonly T[], delPeriodo: ReadonlyMap<number, number> | null, tope = TOPE_RANKING,
): Rankeada<T>[] {
  const con = filas
    .map((f) => ({ ...f, delPeriodo: delPeriodo ? delPeriodo.get(f.id) ?? 0 : f.estrellas }))
    .filter((f) => (delPeriodo ? f.delPeriodo > 0 : f.estrellas > 0 || f.usos > 0));
  con.sort((a, b) => b.delPeriodo - a.delPeriodo || b.estrellas - a.estrellas || b.usos - a.usos || a.id - b.id);
  const out: Rankeada<T>[] = [];
  con.slice(0, Math.max(0, tope)).forEach((f, i) => {
    const prev = out[i - 1];
    const empata = prev && prev.delPeriodo === f.delPeriodo && prev.estrellas === f.estrellas && prev.usos === f.usos;
    out.push({ ...f, puesto: empata ? prev.puesto : i + 1 });
  });
  return out;
}
