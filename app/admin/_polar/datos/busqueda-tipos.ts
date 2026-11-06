// Lo que encuentra la búsqueda ⌘K de Admin (el OmniSearch de Polar): negocios y personas. Puro: lo usa el navegador.
// Lo arma el server (app/admin/_polar/datos/busqueda.ts) y viaja recortado a lo que se muestra.

export type ResultadoNegocio = { tipo: 'negocio'; ws: number; nombre: string; detalle: string }
export type ResultadoPersona = { tipo: 'persona'; id: number; ws: number | null; nombre: string; email: string; negocio: string | null }
export type IndiceBusqueda = { negocios: ResultadoNegocio[]; personas: ResultadoPersona[] }
