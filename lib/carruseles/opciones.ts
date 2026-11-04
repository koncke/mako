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

/** Qué conjunto se mira: todos, lo de esta semana (las tendencias) o lo guardado. */
export const VISTAS_CARRUSEL = [
  { value: 'todos', label: 'Todos' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'guardados', label: 'Guardados' },
] as const;
export type VistaCarrusel = (typeof VISTAS_CARRUSEL)[number]['value'];
