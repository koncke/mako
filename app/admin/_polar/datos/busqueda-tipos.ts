// =============================================================================
// Lo que encuentra la búsqueda ⌘K de Admin (el OmniSearch de Polar): negocios y personas. Puro: lo usan el navegador y los tests
// =============================================================================
// Polar busca recursos de la organización con `GET /v1/search` (productos, clientes, pedidos, suscripciones). En MaKo, Admin
// es la plataforma y lo que se busca son los NEGOCIOS (llevan a Customers › <negocio>) y las PERSONAS (llevan a
// Customers › <negocio> › Members, donde se gestionan). El índice lo arma el server (./busqueda.ts) y viaja recortado a lo
// que se muestra: nombre, email y negocio. Nada más (ni rol, ni estado, ni el último ingreso).
//
// ⚠️ NO ENTRA el negocio de la plataforma: no es un cliente, y Customers no lo lista (lib/clientes-plataforma.ts lo saca).
// ⚠️ SUS PERSONAS SÍ (punto 25 de la revisión del 6/11/2026): los admins de MaKo, su equipo y quien no tiene negocio llevan a
//    Settings › Members, donde se gestionan (`ws: null`). Qué persona va a qué lado lo decide UNA regla, la de las dos pantallas
//    (`tipoDePersona`, ./personas.ts): un admin de MaKo con un negocio puesto NO lleva a la ficha de ese negocio, que no lo lista.
// ⚠️ UN CLIENTE DE UNA AGENCIA SÍ ENTRA, diciendo de qué agencia es («De Agencia Faro · MaKo Pro»). La lista de Customers no lo
//    cuenta (no es un cliente de MaKo: ./clientes.ts `esClienteDeMaKo`), pero su ficha existe y la búsqueda es por donde se
//    llega: encontrar no es contar. Sin el detalle se leería como un cliente más de MaKo.

import { ROTULO_TIPO_PERSONA, RUTA_MIEMBROS_PLATAFORMA, tipoDePersona } from './personas'

export type ResultadoNegocio = { tipo: 'negocio'; ws: number; nombre: string; detalle: string }
export type ResultadoPersona = { tipo: 'persona'; id: number; ws: number | null; nombre: string; email: string; negocio: string | null }
/** Lo que se encuentra: negocios y personas (lo que devuelve `buscar`). */
export type Encontrados = { negocios: ResultadoNegocio[]; personas: ResultadoPersona[] }
/**
 * El índice que viaja al navegador. `error` = no se pudo leer (punto 23 de docs/admin/revision-cerebro-6-11.md): con las
 * listas vacías, ⌘K decía «No hay resultados» y parecía que el negocio no existía. Con `error`, dice «No pude leer los
 * negocios». `null` = se leyó.
 */
export type IndiceBusqueda = Encontrados & { error: string | null }

/** El título del aviso de ⌘K cuando el índice no se pudo leer. */
export const TITULO_SIN_INDICE = 'No pude leer los negocios'

/** El índice de una lectura que falló: vacío Y diciendo por qué (nunca un vacío callado). */
export const indiceSinLeer = (e: unknown): IndiceBusqueda => ({
  negocios: [],
  personas: [],
  error: e instanceof Error && e.message ? e.message : typeof e === 'string' && e ? e : 'Sin detalle.',
})

/** Cuántos de cada clase se muestran (Polar: `limit=5`). */
export const TOPE_POR_CLASE = 5

export const hrefDeNegocio = (ws: number) => `/admin/customers/${ws}`
/** Una persona de un negocio, a su ficha; una de la plataforma (`ws: null`), a Settings › Members. */
export const hrefDePersona = (ws: number | null) => (ws != null ? `/admin/customers/${ws}/members` : RUTA_MIEMBROS_PLATAFORMA)

/** Sin mayúsculas ni acentos, para que «Gómez» se encuentre escribiendo «gomez». */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Lo que se dice de un negocio debajo de su nombre: de qué agencia es (si es cliente de una), su plan y si está pausado
 * («De Agencia Faro · MaKo Esencial · Pausado»). UNA frase para la búsqueda ⌘K y para la segunda línea de la lista de Customers
 * (revisión del Cerebro del 6/11/2026, punto 35): con dos, un negocio pausado diría «Pausado» en un lado y nada en el otro.
 */
export function detalleDeNegocio(n: { plan: string; pausado: boolean; deAgencia?: boolean; agencia?: string | null }): string {
  return [n.deAgencia ? `De ${n.agencia ?? 'una agencia'}` : null, n.plan, n.pausado ? 'Pausado' : null].filter(Boolean).join(' · ')
}

/** Arma el índice con lo que leyó el server. `plan` dice el nombre del plan de una capa. */
export function armarIndice(p: {
  workspaces: ReadonlyArray<{ id: number; nombre: string; capa: string; estado: string }>
  usuarios: ReadonlyArray<{ id: number; nombre: string; email: string; workspace_id: number | null; rol?: string | null }>
  plataforma: number | null
  plan: (capa: string) => string
  /** De qué agencia es cada cliente de una agencia (el ws del cliente → el de su agencia). */
  deAgencia?: ReadonlyMap<number, number>
}): IndiceBusqueda {
  const clientes = p.workspaces.filter((w) => w.id !== p.plataforma)
  const nombre = new Map(clientes.map((w) => [w.id, w.nombre]))
  const clientesSet = new Set(nombre.keys())
  const detalle = (w: (typeof clientes)[number]) => {
    const ag = p.deAgencia?.get(w.id)
    return detalleDeNegocio({
      plan: p.plan(w.capa),
      pausado: w.estado === 'pausado',
      deAgencia: ag != null,
      agencia: ag != null ? (nombre.get(ag) ?? null) : null,
    })
  }
  return {
    error: null,
    negocios: clientes.map((w) => ({
      tipo: 'negocio',
      ws: w.id,
      nombre: w.nombre,
      detalle: detalle(w),
    })),
    personas: p.usuarios.map((u): ResultadoPersona => {
      const lado = tipoDePersona(u, p.plataforma, clientesSet)
      return lado
        ? { tipo: 'persona', id: u.id, ws: null, nombre: u.nombre, email: u.email, negocio: ROTULO_TIPO_PERSONA[lado] }
        : { tipo: 'persona', id: u.id, ws: u.workspace_id, nombre: u.nombre, email: u.email, negocio: nombre.get(u.workspace_id as number) ?? null }
    }),
  }
}

/** Lo que coincide con lo escrito: hasta `TOPE_POR_CLASE` de cada clase, primero los que EMPIEZAN con lo escrito. */
export function buscar(indice: Encontrados, consulta: string): Encontrados {
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

/**
 * Lo que lee el server para armar el índice, como funciones: así la regla de qué hacer cuando una falla se prueba sin base
 * (tests/admin-polar-armazon.test.ts) y ./busqueda.ts sólo pasa las lecturas de verdad.
 */
export type LecturasDelIndice = {
  workspaces: () => Promise<ReadonlyArray<{ id: number; nombre: string; capa: string; estado: string }>>
  usuarios: () => Promise<ReadonlyArray<{ id: number; nombre: string; email: string; workspace_id: number | null }>>
  /** El negocio de la plataforma, que NO entra al índice. */
  plataforma: () => Promise<number>
  /** De qué agencia es cada cliente de una agencia. Si no se puede leer, un mapa vacío: es sólo el «De <agencia>». */
  deAgencia: () => Promise<ReadonlyMap<number, number>>
}

/**
 * Arma el índice con las lecturas. Si falla una de las que deciden QUIÉN entra (los negocios, las personas o cuál es la
 * plataforma), el índice viaja vacío y con su `error`. ⚠️ La plataforma no se adivina: con su lectura caída, antes entraba al
 * índice como un cliente más y su resultado llevaba a una ficha que da 404 (el revisor del punto 23).
 */
export async function leerIndice(leer: LecturasDelIndice, plan: (capa: string) => string): Promise<IndiceBusqueda> {
  try {
    const [workspaces, usuarios, plataforma, deAgencia] = await Promise.all([
      leer.workspaces(), leer.usuarios(), leer.plataforma(), leer.deAgencia().catch(() => new Map<number, number>()),
    ])
    return armarIndice({ workspaces, usuarios, plataforma, plan, deAgencia })
  } catch (e) {
    return indiceSinLeer(e)
  }
}
