// =============================================================================
// Lo que encuentra la búsqueda ⌘K de Admin (el OmniSearch de Polar): negocios y personas. Puro: lo usan el navegador y los tests
// =============================================================================
// Polar busca recursos de la organización con `GET /v1/search` (productos, clientes, pedidos, suscripciones). En MaKo, Admin
// es la plataforma y lo que se busca son los NEGOCIOS (llevan a Customers › <negocio>) y las PERSONAS (llevan a
// Customers › <negocio> › Members, donde se gestionan). El índice lo arma el server (./busqueda.ts) y viaja recortado a lo
// que se muestra: nombre, email y negocio. Nada más (ni rol, ni estado, ni el último ingreso).
//
// ⚠️ NO ENTRAN el negocio de la plataforma ni sus personas (ni quien no tiene negocio): no son clientes, y Customers no los
//    lista (lib/clientes-plataforma.ts los saca), así que no tienen a dónde llevar.
// ⚠️ UN CLIENTE DE UNA AGENCIA SÍ ENTRA, diciendo de qué agencia es («De Agencia Faro · MaKo Pro»). La lista de Customers no lo
//    cuenta (no es un cliente de MaKo: ./clientes.ts `esClienteDeMaKo`), pero su ficha existe y la búsqueda es por donde se
//    llega: encontrar no es contar. Sin el detalle se leería como un cliente más de MaKo.

export type ResultadoNegocio = { tipo: 'negocio'; ws: number; nombre: string; detalle: string }
export type ResultadoPersona = { tipo: 'persona'; id: number; ws: number | null; nombre: string; email: string; negocio: string | null }
export type IndiceBusqueda = { negocios: ResultadoNegocio[]; personas: ResultadoPersona[] }

/** Cuántos de cada clase se muestran (Polar: `limit=5`). */
export const TOPE_POR_CLASE = 5

export const hrefDeNegocio = (ws: number) => `/admin/customers/${ws}`
export const hrefDePersona = (ws: number) => `/admin/customers/${ws}/members`

/** Sin mayúsculas ni acentos, para que «Gómez» se encuentre escribiendo «gomez». */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Arma el índice con lo que leyó el server. `plan` dice el nombre del plan de una capa. */
export function armarIndice(p: {
  workspaces: ReadonlyArray<{ id: number; nombre: string; capa: string; estado: string }>
  usuarios: ReadonlyArray<{ id: number; nombre: string; email: string; workspace_id: number | null }>
  plataforma: number | null
  plan: (capa: string) => string
  /** De qué agencia es cada cliente de una agencia (el ws del cliente → el de su agencia). */
  deAgencia?: ReadonlyMap<number, number>
}): IndiceBusqueda {
  const clientes = p.workspaces.filter((w) => w.id !== p.plataforma)
  const nombre = new Map(clientes.map((w) => [w.id, w.nombre]))
  const detalle = (w: (typeof clientes)[number]) => {
    const ag = p.deAgencia?.get(w.id)
    const partes = [
      ag != null ? `De ${nombre.get(ag) ?? 'una agencia'}` : null,
      p.plan(w.capa),
      w.estado === 'pausado' ? 'Pausado' : null,
    ]
    return partes.filter(Boolean).join(' · ')
  }
  return {
    negocios: clientes.map((w) => ({
      tipo: 'negocio',
      ws: w.id,
      nombre: w.nombre,
      detalle: detalle(w),
    })),
    personas: p.usuarios
      .filter((u) => u.workspace_id != null && nombre.has(u.workspace_id))
      .map((u) => ({ tipo: 'persona', id: u.id, ws: u.workspace_id, nombre: u.nombre, email: u.email, negocio: nombre.get(u.workspace_id as number) ?? null })),
  }
}

/** Lo que coincide con lo escrito: hasta `TOPE_POR_CLASE` de cada clase, primero los que EMPIEZAN con lo escrito. */
export function buscar(indice: IndiceBusqueda, consulta: string): IndiceBusqueda {
  const q = normalizar(consulta)
  if (!q) return { negocios: [], personas: [] }
  const puntaje = (campos: string[]) => {
    const n = campos.map(normalizar)
    if (n.some((c) => c.startsWith(q))) return 2
    if (n.some((c) => c.includes(q))) return 1
    return 0
  }
  const ordenar = <T,>(lista: readonly T[], campos: (x: T) => string[]) =>
    lista
      .map((x) => ({ x, p: puntaje(campos(x)) }))
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, TOPE_POR_CLASE)
      .map((r) => r.x)
  return {
    negocios: ordenar(indice.negocios, (n) => [n.nombre]),
    personas: ordenar(indice.personas, (u) => [u.nombre, u.email, u.negocio ?? '']),
  }
}
