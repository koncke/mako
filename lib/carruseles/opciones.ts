// =============================================================================
// carruseles/opciones — las opciones del explorador de carruseles (orden, outlier, período, largo, vista)
// =============================================================================
// Datos puros SIN dependencias: los importan el explorador (./explorar.ts, que los re-exporta) y la API de MaKo
// (lib/api-mako/areas/imagen.def.ts, que no puede arrastrar más que tipos y datos: AGENTS.md, «Una .def.ts no importa VALORES
// de módulos con server-only»). Una lista, un lugar: la pantalla y la API ofrecen las mismas.
// =============================================================================

export const ORDENES_CARRUSEL = [
  { value: 'outlier', label: 'Mayor outlier' },
  { value: 'nuevos', label: 'Más nuevos' },
  { value: 'viejos', label: 'Más viejos' },
  { value: 'interaccion', label: 'Más interacción' },
  { value: 'traidos', label: 'Traídos hace poco' },
  // Los anuncios (6/11/2026) no tienen outlier: lo que dice que funcionan es cuántos días llevan al aire.
  { value: 'aire', label: 'Más días al aire' },
] as const;
export type OrdenCarrusel = (typeof ORDENES_CARRUSEL)[number]['value'];

/** El piso del outlier: «1×+» = rindió al menos lo que una pieza típica de su cuenta. */
export const OUTLIER_MINIMOS = [0, 1, 2, 3, 5, 10] as const;

export const PERIODOS_CARRUSEL = [
  { value: 'todo', label: 'Cuando sea' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
] as const;
export type PeriodoCarrusel = (typeof PERIODOS_CARRUSEL)[number]['value'];

export const LARGOS_CARRUSEL = [
  { value: 'todos', label: 'Cualquier largo' },
  { value: 'cortos', label: '2 a 4 láminas' },
  { value: 'medios', label: '5 a 7 láminas' },
  { value: 'largos', label: '8 o más láminas' },
] as const;
export type LargoCarrusel = (typeof LARGOS_CARRUSEL)[number]['value'];

/**
 * Qué conjunto se mira: todos o lo guardado. «semana» queda por la API y los links viejos: desde el 6/11/2026 la pantalla no
 * tiene esa pestaña (Martín: «Sacá las pestañas "Esta semana" y "Cuentas"… Lo que hacían pasa a filtros») y la URL la lee
 * como «Publicado: últimos 7 días» (./explorar.ts, `filtrosDeQuery`).
 */
export const VISTAS_CARRUSEL = [
  { value: 'todos', label: 'Todos' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'guardados', label: 'Guardados' },
] as const;
export type VistaCarrusel = (typeof VISTAS_CARRUSEL)[number]['value'];

/**
 * De dónde sale cada carrusel: las cuentas que el negocio sigue en Spy, o la biblioteca de ejemplos de la plataforma
 * (lib/carruseles/biblioteca.ts, 4/11/2026). «Todos» junta los dos.
 */
export const ORIGENES_CARRUSEL = [
  { value: 'todos', label: 'De todos lados' },
  { value: 'cuentas', label: 'Cuentas que sigues' },
  { value: 'biblioteca', label: 'Biblioteca de ejemplos' },
] as const;
export type OrigenFiltro = (typeof ORIGENES_CARRUSEL)[number]['value'];

/**
 * Qué se mira (6/11/2026): los carruseles (de las cuentas que sigue el negocio y de la biblioteca), los anuncios que Competitors
 * Spy trajo de ESAS cuentas con la clave del negocio (lib/carruseles/anuncios.ts), o las miniaturas de YouTube que mejor rinden
 * en los rubros de dueños de negocio (lib/thumbnails/explorar.ts; Martín, 6/11/2026: «una tab que sea "Thumbnails"»). Es un
 * filtro, no una pestaña.
 */
export const QUE_VER_CARRUSEL = [
  { value: 'carruseles', label: 'Carruseles' },
  { value: 'anuncios', label: 'Anuncios' },
  { value: 'thumbnails', label: 'Thumbnails' },
] as const;
export type QueVer = (typeof QUE_VER_CARRUSEL)[number]['value'];

/** Los tipos de carrusel de MaKo (lib/carruseles/tipos.ts, que tiene la estructura de cada uno): los ofrece la API. */
export const IDS_TIPO_CARRUSEL = ['lista', 'tutorial', 'historia', 'antes-despues', 'mito', 'opinion', 'caso', 'preguntas'] as const;
export type IdTipoCarrusel = (typeof IDS_TIPO_CARRUSEL)[number];
export const esTipoCarrusel = (v: unknown): v is IdTipoCarrusel => typeof v === 'string' && (IDS_TIPO_CARRUSEL as readonly string[]).includes(v);

// ─────────────────────────────────────────────────────────────────────────────
// Las miniaturas de YouTube (Thumbnails, 6/11/2026: lib/thumbnails/explorar.ts). Acá, sin dependencias, para la API de MaKo.
// ─────────────────────────────────────────────────────────────────────────────

/** Los rubros de dueños de negocio (el pedido): cada canal de la biblioteca es de uno. */
export const NICHOS_THUMBNAIL = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'emprendimiento', label: 'Emprendimiento' },
  { value: 'servicios', label: 'Servicios' },
] as const;
export type NichoThumbnail = (typeof NICHOS_THUMBNAIL)[number]['value'];

export const IDIOMAS_THUMBNAIL = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
] as const;
export type IdiomaThumbnail = (typeof IDIOMAS_THUMBNAIL)[number]['value'];

export const PERIODOS_THUMBNAIL = [
  { value: 'todo', label: 'Cuando sea' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '365', label: 'Último año' },
] as const;
export type PeriodoThumbnail = (typeof PERIODOS_THUMBNAIL)[number]['value'];

/** El orden: el múltiplo SÓLO con la enmienda III.L de YouTube (lib/thumbnails/explorar.ts); sin ella no se ofrece. */
export const ORDENES_THUMBNAIL = [
  { value: 'outlier', label: 'Mayor múltiplo' },
  { value: 'vistas', label: 'Más vistas' },
  { value: 'nuevos', label: 'Más nuevos' },
  { value: 'viejos', label: 'Más viejos' },
] as const;
export type OrdenThumbnail = (typeof ORDENES_THUMBNAIL)[number]['value'];
