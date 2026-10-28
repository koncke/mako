// =============================================================================
// cerebro-funciones — «Lo que hace MaKo» como capa del Second Brain, para que los chats la recuperen (28/10/2026)
// =============================================================================
// Martín (28/10/2026): «que el Second Brain de SuperAdmin tenga conocimiento de todas las funcionalidades... y que sea
// eficiente justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». El catálogo (lib/funciones-mako.ts) se
// vuelve un grafo con la forma de siempre (lib/cerebro-modelo.ts), así la recuperación barata (lib/cerebro-recuperar.ts:
// el índice y la vista local) lo lee sin cambiar: una pregunta que nombra «Chats», «la bandeja» o «respond.io» trae ese
// nodo y sus vecinos, no el catálogo entero.
//
// Distinta de la capa Construcción (lib/cerebro-construccion.ts): aquélla dice cómo va la OBRA (estado, partes, hitos) y
// sólo se dibuja; ésta dice qué se VENDE, y es la que lee un chat.
//
// LA FORMA:
//   · la raíz es `n1:funciones` (una carpeta: `esEstructura` la reconoce y no cuenta como dato ni como vecino);
//   · un área por familia de la barra (Today, Sales, Marketing, Create; lo de arriba es «MaKo»);
//   · un nodo `fn:<key>` por función: el detalle es su «que», los datos van con claves hechas de palabras vacías («En vez
//     de», «Cómo está», «Quién la ve») para que no siembren todas las funciones a la vez, y el cuerpo lleva «Hace» y «No
//     hace» enteros (viajan cuando un chat pide el nodo por id con profundidad 0);
//   · las aristas salen de `conecta`.
//
// PURO y sin `server-only`: sin base y sin física. Lo junta con el negocio lib/cerebro-para-chat.ts.
// =============================================================================

import { coincide, paraBuscar } from './buscar-tareas';
import { CAPA_FUNCIONES, type AristaCerebro, type Cerebro, type NodoCerebro, type Taxonomia } from './cerebro-modelo';
import { recuperar } from './cerebro-recuperar';
import { FAMILIA_ARRIBA, FAMILIA_SETTINGS, funcionesMako, type FuncionMako } from './funciones-mako';

export { CAPA_FUNCIONES };
/** La carpeta madre de la capa: lo que cuelga de la raíz del negocio en el grafo de los chats. */
export const ID_RAIZ_FUNCIONES = 'n1:funciones';
export const CARPETA_FUNCIONES = 'funciones';
export const PUENTE_FUNCIONES = 'Lo que hace MaKo, el producto con el que trabaja este negocio';
export const idFuncion = (key: string): string => `fn:${key}`;
const idArea = (familia: string): string => `fn-${familia.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/** El orden de las familias en la barra, y un color de los del lienzo para cada una. */
const FAMILIAS: ReadonlyArray<readonly [string, string, string]> = [
  [FAMILIA_ARRIBA, 'var(--grafo-norte)', 'El chat con MaKo y el Second Brain.'],
  ['Today', 'var(--grafo-panorama)', 'Lo de todos los días: el plan, los chats y los números.'],
  ['Sales', 'var(--grafo-oferta)', 'Lo que vende: los leads, la agenda, las automatizaciones y los clientes.'],
  ['Marketing', 'var(--grafo-cliente)', 'La oferta, las landings y los anuncios.'],
  ['Create', 'var(--grafo-razones)', 'Lo que crea contenido: video, imagen y guiones.'],
  [FAMILIA_SETTINGS, 'var(--grafo-documentos)', 'La configuración, las conexiones, la API y el soporte.'],
];

export function taxonomiaFunciones(fs: readonly FuncionMako[] = funcionesMako()): Taxonomia {
  const usadas = new Set(fs.map((f) => f.familia));
  const extra = [...usadas].filter((f) => !FAMILIAS.some(([n]) => n === f)).map((f) => [f, 'var(--grafo-documentos)', `Las funciones de ${f}.`] as const);
  return {
    carpetas: [{ id: CARPETA_FUNCIONES, nombre: 'Lo que hace MaKo', que: 'Cada función de MaKo: qué hace, qué no hace y qué reemplaza.' }],
    areas: [...FAMILIAS, ...extra].filter(([n]) => usadas.has(n)).map(([nombre, color, que]) => ({ id: idArea(nombre), padre: CARPETA_FUNCIONES, nombre, color, que })),
    capas: [{ id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', carpetas: [CARPETA_FUNCIONES] }],
  };
}

const lista = (titulo: string, xs: readonly string[] | undefined) => (xs?.length ? `${titulo}:\n${xs.map((x) => `- ${x}`).join('\n')}` : '');

/** El nodo de una función. */
export function nodoDeFuncion(f: FuncionMako): NodoCerebro<string> {
  return {
    id: idFuncion(f.key), area: idArea(f.familia), tipo: 'Función', etiqueta: f.nombre,
    detalle: f.que,
    datos: [
      { k: 'En vez de', v: f.reemplaza ?? '' },
      { k: 'Cómo está', v: f.estado === 'lista' ? 'Completa' : 'Una parte en construcción' },
      { k: 'Quién la ve', v: f.soloSuperAdmin ? 'Sólo el super admin' : 'Todos los negocios' },
      { k: 'No hace', v: (f.noHace ?? []).join(' · ') },
      { k: 'Alias', v: f.alias.join(', ') },
    ],
    cuerpo: [lista('Hace', f.hace), lista('No hace', f.noHace)].filter(Boolean).join('\n\n'),
    fuente: f.fuentes.join(' · '), autoria: 'mako', href: f.ruta || undefined, abrirEn: f.ruta ? f.nombre : undefined,
  };
}

/** El grafo de «Lo que hace MaKo», sin física (los chats no usan posiciones). */
export function armarFunciones(fs: readonly FuncionMako[] = funcionesMako()): Cerebro<string> {
  const nodos: NodoCerebro<string>[] = [{
    id: ID_RAIZ_FUNCIONES, area: idArea(FAMILIA_ARRIBA), tipo: 'Carpeta', etiqueta: 'Lo que hace MaKo',
    detalle: `Las ${fs.length} funciones de MaKo: qué hace cada una, qué no hace y qué reemplaza.`, fuente: 'lib/funciones-mako.ts', autoria: 'mako',
  }, ...fs.map(nodoDeFuncion)];
  const aristas: AristaCerebro[] = fs.map((f) => ({ de: ID_RAIZ_FUNCIONES, a: idFuncion(f.key), motivo: `Una función de ${f.familia}` }));
  const vistas = new Set<string>();
  for (const f of fs) {
    for (const c of f.conecta ?? []) {
      const otra = fs.find((x) => x.keys.includes(c.a));
      if (!otra || otra.key === f.key) continue;
      const par = [f.key, otra.key].sort().join('|');
      if (vistas.has(par)) continue;
      vistas.add(par);
      aristas.push({ de: idFuncion(f.key), a: idFuncion(otra.key), motivo: c.motivo });
    }
  }
  return {
    negocio: 'MaKo', nodos, aristas,
    cuenta: { total: fs.length, mako: fs.length, usuario: 0, pendientes: 0 }, vacias: [],
    posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
    taxonomia: taxonomiaFunciones(fs),
  };
}

let cache: Cerebro<string> | null = null;
/** El grafo de las funciones, una vez por proceso (el catálogo es código: cambia con un deploy). */
export function funcionesDeMako(): Cerebro<string> {
  cache ??= armarFunciones();
  return cache;
}

// ── La función que vende una landing (el Web Generator de la plataforma, 28/10/2026) ──────────────────────────────────
// El caso de Martín: «hacé de esta copia la landing de los Chats». El brief del editor traía el perfil del negocio (MaKo en
// general) y nada de Chats. Con esto, el pedido que la nombra trae la función entera, y el que no («cambia el hero») la
// toma de la página si ella nombra CLARAMENTE una sola.

/** Las palabras que nombran lo que se está editando, no lo que se vende: «la landing de los Chats» no habla del Web Generator. */
const DE_LA_PAGINA = new Set(['landing', 'landings', 'pagina', 'web', 'sitio', 'presentacion']);

/** Cuánto nombra un texto a una función: su nombre vale 2 y cada alias 1, como palabras enteras (con plurales). */
export function menciones(f: Pick<FuncionMako, 'nombre' | 'alias'>, texto: string): number {
  const nombre = paraBuscar(f.nombre);
  let n = coincide(texto, `${nombre} `) ? 2 : 0;
  for (const a of new Set(f.alias.map(paraBuscar))) if (a !== nombre && !DE_LA_PAGINA.has(a) && coincide(texto, `${a} `)) n += 1;
  return n;
}

/** Lo que se vende: ni lo que sólo ve el super admin ni el menú de la foto (la configuración no es una landing). */
const lasQueSeVenden = (): FuncionMako[] => funcionesMako().filter((f) => !f.soloSuperAdmin && f.familia !== FAMILIA_SETTINGS);

/**
 * La función que vende una landing: la que más nombra el PEDIDO (sin empate); si el pedido no nombra ninguna, la que la
 * PÁGINA nombra al menos dos veces y el doble que la siguiente. Si no, ninguna: una landing de MaKo en general no se ata a
 * una función por una palabra suelta.
 */
export function funcionQueVende(p: { pedido: string; pagina?: string }, fs: readonly FuncionMako[] = lasQueSeVenden()): FuncionMako | null {
  const ranking = (texto: string) => fs.map((f) => ({ f, n: menciones(f, texto) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const delPedido = ranking(p.pedido);
  if (delPedido.length) return delPedido.length === 1 || delPedido[0].n > delPedido[1].n ? delPedido[0].f : null;
  const dePagina = ranking((p.pagina ?? '').slice(0, 4_000));
  const [a, b] = dePagina;
  return a && a.n >= 2 && a.n >= 2 * (b?.n ?? 0) ? a.f : null;
}

/** Una línea con todas las funciones que se venden y lo que reemplazan: que un chat no niegue una que existe. */
export function catalogoCorto(fs: readonly FuncionMako[] = lasQueSeVenden()): string {
  return fs.map((f) => `${f.nombre}${f.reemplaza ? ` (en vez de ${f.reemplaza})` : ''}`).join(' · ');
}

/** La función entera (qué hace, qué no y qué reemplaza), del grafo que se le pase: el de los chats o el de las funciones. */
export function funcionEntera(grafo: Pick<Cerebro<string>, 'negocio' | 'nodos' | 'aristas' | 'taxonomia'>, f: Pick<FuncionMako, 'key'>, presupuesto = 900): string {
  const id = idFuncion(f.key);
  const nodo = grafo.nodos.find((n) => n.id === id || n.id === `${CAPA_FUNCIONES}:${id}`);
  return nodo ? recuperar(grafo, { ids: [nodo.id], profundidad: 0, presupuesto }).texto : '';
}
