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

/** Los tipos de creación. Uno nuevo se agrega acá Y en lib/creaciones-enchufes.ts (si no, no se puede publicar). */
export const TIPOS_CREACION = ['automatizacion', 'dashboard', 'formato_video', 'formato_imagen'] as const;
export type TipoCreacion = (typeof TIPOS_CREACION)[number];

/** `nav`: la key de app/_components/nav.ts que la CAPA del negocio tiene que tener para USAR una creación de ese tipo
 *  (un negocio sin Automations no recibe automatizaciones). */
export const INFO_TIPO: Record<TipoCreacion, { titulo: string; singular: string; feature: string; ruta: string; nav: string }> = {
  automatizacion: { titulo: 'Automatizaciones', singular: 'automatización', feature: 'Automations', ruta: '/automations', nav: 'setting' },
  dashboard: { titulo: 'Dashboards', singular: 'dashboard', feature: 'Dashboard', ruta: '/dashboard', nav: 'graphics' },
  formato_video: { titulo: 'Formatos de video', singular: 'formato de video', feature: 'Video Generator', ruta: '/video-generator', nav: 'video-generator' },
  formato_imagen: { titulo: 'Formatos de imagen', singular: 'formato de imagen', feature: 'Image Generator', ruta: '/image-generator', nav: 'image-generator' },
};

/**
 * Los tipos que YA tienen su enchufe (lib/creaciones-enchufes.ts: cómo se exporta, se valida y se usa). El compilador
 * exige un enchufe por cada uno. Los demás esperan al chat dueño de su feature (`POR_ENCHUFAR`): se listan en la
 * galería, y publicar uno contesta que todavía no se puede. tests/creaciones.test.ts exige que cada tipo esté en UNA de
 * las dos listas, y que una entrada de `POR_ENCHUFAR` ya enchufada falle (se queda vieja sola).
 */
export const ENCHUFADOS = ['automatizacion'] as const satisfies readonly TipoCreacion[];
export type TipoEnchufado = (typeof ENCHUFADOS)[number];
export const POR_ENCHUFAR: Partial<Record<TipoCreacion, string>> = {
  dashboard: 'Graphics',
  formato_video: 'Content Machine',
  formato_imagen: 'Content Machine',
};
export const estaEnchufado = (t: TipoCreacion): t is TipoEnchufado => (ENCHUFADOS as readonly string[]).includes(t);

export const ORDENES_CREACIONES = ['estrellas', 'usos', 'recientes'] as const;
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

/** ¿Cabe la definición? Se mide en bytes del JSON, que es lo que se guarda. */
export function definicionCabe(def: unknown): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(def)).length <= TOPE_DEFINICION_BYTES;
  } catch {
    return false;
  }
}

/** Por qué este negocio NO puede darle una estrella a esta creación, o null si puede. */
export function porQueNoEstrella(c: { workspaceOrigen: number; estado: string }, ws: number): string | null {
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
