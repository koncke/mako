// =============================================================================
// informe-reglas — qué sale de un informe del Dashboard compartido por link
// =============================================================================
// Martín (11/10/2026): «Agrega el botón de "Compartir" … que se pueda crear un link de acceso a esos
// graficos y también invitar por email». Quien abre el link NO tiene sesión: ve el informe de otra
// persona, en sólo lectura. Lo que decide QUÉ ve vive acá, PURO y sin `server-only`, para que tenga test
// (es la regla de la casa: la condición que gobierna algo delicado va donde un test la puede importar).
// Lo aplica ./informe-compartido.ts, y lo llaman la página y el endpoint de datos.
//
// El cuerpo que llega es el contrato de la pantalla (app/dashboard/lectura-compartida.ts): por cada
// componente, su id y lo que la vista resolvió (`desde`, `hasta`, `filtros`, `agrupar`). Las cuatro
// decisiones, y las cuatro en POSITIVO (lo nuevo nace cerrado):
//
//   1. EL SERVER NO CONFÍA EN EL PEDIDO. El componente sale del informe GUARDADO (id de hoja + id de
//      componente): el `grafico` y el `bloque` que viajan en el cuerpo no se leen. Del navegador se acepta
//      el PERÍODO, el «agrupar por» y los filtros sobre los controles que la hoja YA tiene. Un link no
//      sirve para consultar cualquier conjunto del negocio ni para filtrar por lo que el dueño no puso.
//   2. LAS PERSONAS NO SALEN. Las etiquetas de un gráfico pasan por `sinPersonas` (app/dashboard/exportar.ts):
//      la MISMA lista positiva del AI Analyst (`DIMENSIONES_PUBLICAS`, lib/graficos-analisis.ts). Lo que
//      no es público sale como «Closer 1…N». Y `ref` (el id de lo que es una fila) se va: sólo sirve para
//      abrir el detalle, que no se ofrece.
//   3. UN FILTRO SOBRE UN CAMPO QUE NO ES PÚBLICO NO SE MUEVE. Sus valores serían nombres (la lista
//      desplegable los mostraría) y una búsqueda por texto sería un oráculo letra por letra. Lo que el
//      dueño dejó elegido en el informe sigue filtrando TAL CUAL; lo que mande el navegador ahí, no. Si se
//      tirara sin más, el gráfico mostraría MÁS de lo que el dueño eligió mostrar.
//      Y los valores ELEGIDOS de esos controles viajan al navegador como alias (`tableroParaLink`): el
//      informe que se manda al link no dice «Closer: Juan» en el chip.
//   4. UN BLOQUE SALE SÓLO SI ESTÁ EN `BLOQUES_COMPARTIBLES` (decidido el 11/10/2026, la misma vara que la
//      API de MaKo por HTTP): los que muestran personas o tienen una acción de servidor —«A quién cobrarle»
//      con «Marcar cobrada», las llamadas con su ficha, los desgloses de Revenue y del embudo con «Editar
//      lead», las cohortes con sus leads— NO se sirven: la tarjeta dice «No se comparte en un link» y no
//      dibuja botones que sin sesión fallan.

import {
  AGRUPAR, BLOQUES, MAX_COMPONENTES, MAX_VALORES, campoDe, efectivoDe, esBloque, esElemento, esGrafico,
  type Bloque, type ControlVista, type FiltroDim, type Grafico, type Hoja, type Tablero,
} from '@/lib/graficos-catalogo';
import { Alias, dimensionPublica, etiquetaSegura } from '@/lib/graficos-analisis';
import { fuentesDelCampoEnHoja } from '@/lib/graficos-controles-texto';
import { esFechaValida } from '@/lib/date-utils';
import type { Resultado } from '@/lib/graficos-agregar';
import type { DatosFactores, DatosMatriz } from '@/lib/graficos-bloques-extra-catalogo';
import { sinPersonas, type PedidoBloqueHoja, type PedidoGrafico } from '@/app/dashboard/exportar';

/** Lo que contesta el endpoint cuando le piden el detalle de un número. Corto: es texto de pantalla. */
export const DETALLE_NO_SE_COMPARTE = 'El detalle no se comparte';
/** Lo que dice la tarjeta de un bloque que no sale en un informe compartido. */
export const BLOQUE_NO_SE_COMPARTE = 'No se comparte en un link';

/** El id de una hoja o de un componente como lo acuña el catálogo (`idValido` de lib/graficos-catalogo.ts). */
export const idDeInforme = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null);

/** La hoja en que abre el link: la pedida si el informe la tiene; si no, la primera. Nunca agrega una. */
export function hojaDeInforme(t: Tablero, pedida: unknown): Hoja {
  const id = idDeInforme(pedida);
  return (id && t.hojas.find((h) => h.id === id)) || t.hojas[0];
}

/**
 * Los pedidos del cuerpo, cada uno con SU componente GUARDADO de esta hoja (de la clase pedida). Un id
 * que no es de la hoja, repetido o de otra clase se descarta: no hay nada que rearmar. Con tope.
 */
export function pedidosDelCuerpo<C extends Grafico | Bloque>(hoja: Hoja, crudo: unknown, esDeLaClase: (c: Hoja['componentes'][number]) => c is C): Array<{ comp: C; cliente: Record<string, unknown> }> {
  if (!Array.isArray(crudo)) return [];
  const out: Array<{ comp: C; cliente: Record<string, unknown> }> = [];
  const vistos = new Set<string>();
  for (const x of crudo.slice(0, MAX_COMPONENTES)) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const cliente = x as Record<string, unknown>;
    const id = idDeInforme(cliente.id);
    if (!id || vistos.has(id)) continue;
    const comp = hoja.componentes.find((c) => c.id === id);
    if (!comp || !esDeLaClase(comp)) continue;
    vistos.add(id);
    out.push({ comp, cliente });
  }
  return out;
}
export const pedidosDeGraficos = (hoja: Hoja, crudo: unknown) => pedidosDelCuerpo<Grafico>(hoja, crudo, esGrafico);
export const pedidosDeBloques = (hoja: Hoja, crudo: unknown) => pedidosDelCuerpo<Bloque>(hoja, crudo, esBloque);

/** Todos los controles de la hoja, por id: los de la barra y los de cada gráfico o bloque. */
export function controlesDeHoja(hoja: Hoja): Map<string, ControlVista> {
  const out = new Map<string, ControlVista>();
  for (const c of hoja.controles) out.set(c.id, c);
  for (const comp of hoja.componentes) {
    if (esElemento(comp)) continue;
    for (const c of comp.controles) out.set(c.id, c);
  }
  return out;
}

/**
 * Las fuentes donde se miran los valores de `campo` en esta hoja, o null si el campo NO es público en
 * alguna de ellas. Las fuentes son las de los gráficos de la hoja que lo usan (la misma función que la
 * barra de controles); sin ninguno, todas las del campo.
 */
export function campoCompartible(hoja: Hoja, campoId: string): string[] | null {
  const campo = campoDe(campoId);
  if (!campo) return null;
  const fuentes = fuentesDelCampoEnHoja(hoja, campo.id) ?? Object.keys(campo.en);
  if (!fuentes.length) return null;
  return fuentes.every((f) => dimensionPublica(f, campo.en[f] ?? null)) ? fuentes : null;
}

/**
 * Las dimensiones de `g` que la VISTA puede filtrar en un informe compartido, con el tipo de control:
 * las de un control de lista o de búsqueda que la hoja (o el gráfico) YA tiene, sobre un campo público.
 * El del gráfico va después, así que gana sobre el de la hoja en el mismo campo (como `efectivoDe`).
 */
export function filtrosPermitidos(g: Grafico, hoja: Hoja): Map<string, 'lista' | 'texto'> {
  const out = new Map<string, 'lista' | 'texto'>();
  for (const c of [...hoja.controles, ...g.controles]) {
    if ((c.tipo !== 'lista' && c.tipo !== 'texto') || !c.campo) continue;
    const dim = campoDe(c.campo)?.en[g.fuente];
    if (!dim || !campoCompartible(hoja, c.campo)) continue;
    out.set(dim, c.tipo);
  }
  return out;
}

/**
 * Los filtros con que se lee `g`: los del dueño sobre lo que no se mueve (tal cual quedaron guardados) y
 * los de la vista sobre lo permitido (`filtrosPermitidos`). Un filtro del cuerpo sobre cualquier otra
 * dimensión no existe para el server.
 */
export function filtrosCompartidos(g: Grafico, hoja: Hoja, crudo: unknown, hoy: string): FiltroDim[] {
  const permitidos = filtrosPermitidos(g, hoja);
  const delDueno = efectivoDe(g, hoja, {}, hoy).filtros.filter((f) => !permitidos.has(f.dimension));
  const deLaVista: FiltroDim[] = [];
  if (Array.isArray(crudo)) {
    for (const x of crudo.slice(0, 16)) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
      const o = x as Record<string, unknown>;
      const dim = typeof o.dimension === 'string' ? o.dimension : '';
      const tipo = permitidos.get(dim);
      if (!tipo || deLaVista.some((f) => f.dimension === dim)) continue;
      if (tipo === 'lista' && Array.isArray(o.valores)) {
        const valores = [...new Set(o.valores.filter((v): v is string => typeof v === 'string').map((v) => v.trim().slice(0, 120)).filter(Boolean))].slice(0, MAX_VALORES);
        // Una lista vacía es «todos»: no filtra (como `controlActivo` del catálogo).
        if (valores.length) deLaVista.push({ dimension: dim, valores });
      } else if (tipo === 'texto' && typeof o.texto === 'string' && o.texto.trim()) {
        deLaVista.push({ dimension: dim, texto: o.texto.trim().slice(0, 80) });
      }
    }
  }
  return [...delDueno, ...deLaVista];
}

/** El período que pidió la vista; si no es un período válido, el que el informe muestra de entrada. */
export function periodoCompartido(comp: Grafico | Bloque, hoja: Hoja, desde: unknown, hasta: unknown, hoy: string): { desde: string; hasta: string } {
  const d = typeof desde === 'string' ? desde : '';
  const h = typeof hasta === 'string' ? hasta : '';
  if (esFechaValida(d) && esFechaValida(h) && d <= h) return { desde: d, hasta: h };
  const e = efectivoDe(comp, hoja, {}, hoy);
  return { desde: e.desde, hasta: e.hasta };
}

/** El pedido de un GRÁFICO, rearmado: el componente guardado, el período y el agrupar de la vista, y los filtros permitidos. */
export function pedidoGraficoCompartido(g: Grafico, hoja: Hoja, cliente: Record<string, unknown>, hoy: string): PedidoGrafico {
  const { desde, hasta } = periodoCompartido(g, hoja, cliente.desde, cliente.hasta, hoy);
  const ag = typeof cliente.agrupar === 'string' && cliente.agrupar !== 'auto' && AGRUPAR.some((a) => a.id === cliente.agrupar)
    ? (cliente.agrupar as 'dia' | 'semana' | 'mes')
    : efectivoDe(g, hoja, {}, hoy).agrupar;
  return { grafico: g, desde, hasta, filtros: filtrosCompartidos(g, hoja, cliente.filtros, hoy), agrupar: ag };
}

/** El pedido de un BLOQUE, rearmado: el bloque guardado (no el del cuerpo) y el período de la vista. */
export function pedidoBloqueCompartido(b: Bloque, hoja: Hoja, cliente: Record<string, unknown>, hoy: string): PedidoBloqueHoja {
  const { desde, hasta } = periodoCompartido(b, hoja, cliente.desde, cliente.hasta, hoy);
  return { id: b.id, bloque: b.bloque, desde, hasta };
}

/**
 * El control de LISTA cuyos valores se piden: el de la barra de la hoja o, con `componenteId`, el de la
 * cabecera de ese gráfico. null si no existe o no es una lista con campo.
 */
export function controlDeLista(hoja: Hoja, controlId: unknown, componenteId: unknown): ControlVista | null {
  const id = idDeInforme(controlId);
  if (!id) return null;
  const compId = idDeInforme(componenteId);
  let lista: readonly ControlVista[] = hoja.controles;
  if (compId) {
    const comp = hoja.componentes.find((c) => c.id === compId);
    if (!comp || esElemento(comp)) return null;
    lista = comp.controles;
  }
  const c = lista.find((x) => x.id === id);
  return c && c.tipo === 'lista' && c.campo ? c : null;
}

/**
 * Un control como viaja al navegador en un link: si su campo NO se puede mover en esta hoja
 * (`campoCompartible`), los valores que el dueño dejó elegidos van como alias («Closer 1») y una búsqueda
 * dice que hay una búsqueda, no qué se buscó. Es la regla de `controlParaHttp` de la API de MaKo
 * (lib/api-mako/areas/dashboard.helpers.ts) medida contra las fuentes de ESTA hoja, que es lo mismo que
 * decide `filtrosPermitidos`: lo que se muestra con su valor es exactamente lo que se puede mover.
 *
 * ⚠️ No se importa de allá: ese archivo era trabajo sin commitear de otra tanda al escribir esto, y un
 *    import de un archivo que no está en git es un build roto (AGENTS.md, «el catálogo importa fichas que
 *    no están en el commit»). Cuando los dos estén en git, uno llama al otro.
 */
export function controlParaLink(c: ControlVista, hoja: Hoja, alias: Alias): ControlVista {
  if ((c.tipo !== 'lista' && c.tipo !== 'texto') || !c.campo) return c;
  if (campoCompartible(hoja, c.campo)) return c;
  const nombre = campoDe(c.campo)?.nombre ?? 'Valor';
  return { ...c, valores: c.valores?.map((v) => alias.de(nombre, v)) ?? null, texto: c.texto ? 'una búsqueda' : '' };
}

/**
 * El informe como se manda al navegador de un link: el mismo, con los controles de personas en alias
 * (`controlParaLink`). Los DATOS se leen siempre del guardado real (el filtro del dueño sigue filtrando
 * por «Juan»); esto es sólo lo que el chip muestra. Un alias por informe: el mismo nombre, el mismo alias.
 */
export function tableroParaLink(t: Tablero): Tablero {
  const alias = new Alias();
  return {
    ...t,
    hojas: t.hojas.map((h) => ({
      ...h,
      controles: h.controles.map((c) => controlParaLink(c, h, alias)),
      componentes: h.componentes.map((comp) => (esElemento(comp) ? comp : { ...comp, controles: comp.controles.map((c) => controlParaLink(c, h, alias)) })),
    })),
  };
}

/**
 * El resultado de un gráfico como sale en un informe compartido: sin personas (`sinPersonas`, la misma
 * regla que `resultadoPara(g, r, true, alias)` de la API por HTTP) y sin los ids de cada fila. `alias` se
 * comparte entre los gráficos de un mismo pedido: el mismo nombre, el mismo «Closer N».
 */
export function resultadoCompartible(g: Grafico, r: Resultado, alias: Alias = new Alias()): Resultado {
  const limpio = sinPersonas(g, r, alias);
  return {
    ...limpio,
    filas: limpio.filas.map((f) => {
      const sinId = { ...f };
      delete sinId.ref;
      return sinId;
    }),
  };
}

/** Aplica `f` sólo si los datos son un objeto: un payload raro pasa tal cual (lo descarta la pantalla). */
const siObjeto = <T,>(f: (d: T) => unknown) => (d: unknown): unknown => (d && typeof d === 'object' ? f(d as T) : d);

/**
 * Los bloques que SÍ salen en un informe compartido, cada uno con lo que se le saca. EN POSITIVO: un
 * bloque que se sume mañana NO sale hasta que alguien lo agregue acá y decida que no muestra personas ni
 * tiene una acción de servidor.
 *
 * Afuera, a propósito (decisión del 11/10/2026, la vara de la API de MaKo por HTTP):
 *   · `cobranza` («A quién cobrarle»): cada cliente con lo que debe, y «Marcar cobrada».
 *   · `revenue`, `funnel_maduro`, `scl`, `cohortes_mes`, `cohortes_semana`: sus desgloses son leads con
 *     nombre y «Editar lead». Vaciados, el número diría 5 y el desglose «Sin cierres»: miente.
 *   · `llamadas_cierre`, `closers_cierre`, `tareas_atencion`, `mapa_calor`: BLOQUES_CON_PERSONAS de
 *     lib/graficos-bloques-extra-catalogo.ts (nombres, emails, títulos libres, la foto de una visita).
 */
export const BLOQUES_COMPARTIBLES: Readonly<Record<string, (datos: unknown) => unknown>> = {
  // Closing: el embudo es una cuenta; los factores salen SIN los ejemplos (cada uno abre la ficha de una
  // llamada, que sin sesión falla). Sin ejemplos, la tarjeta no dibuja esos botones (`Ejemplos` vacío).
  embudo_cierre: (d) => d,
  factores_cierre: siObjeto<DatosFactores>((d) => ({
    ...d,
    dimensiones: Array.isArray(d.dimensiones) ? d.dimensiones.map((x) => ({ ...x, brillo: [], falto: [] })) : [],
  })),
  // Ads y Landing: anuncios y videos, que son dimensiones públicas.
  patrones_guiones: (d) => d,
  cuadrante_retencion: (d) => d,
  curva_vsl: (d) => d,
  // Productividad: un proyecto «Cliente: …» nombra a un cliente, y sale como en el AI Analyst.
  matriz_proyectos: siObjeto<DatosMatriz>((d) => {
    const alias = new Alias();
    return { ...d, proyectos: Array.isArray(d.proyectos) ? d.proyectos.map((p) => ({ ...p, nombre: etiquetaSegura('tareas', 'proyecto', String(p.nombre ?? ''), alias) })) : [] };
  }),
  piramide_prioridad: (d) => d,
};

/** ¿Este bloque sale en un informe compartido? */
export const bloqueCompartible = (bloque: string): boolean => Object.prototype.hasOwnProperty.call(BLOQUES_COMPARTIBLES, bloque);

/**
 * Parte los pedidos de bloques en los que se LEEN y los que contestan «No se comparte en un link». Lo que
 * decide es el TIPO de bloque guardado (`b.bloque`), nunca su id ni lo que diga el cuerpo: un bloque que
 * no sale ni siquiera se lee.
 */
export function repartirBloques<T extends { b: Pick<Bloque, 'id' | 'bloque'> }>(pedidos: readonly T[]): { salen: T[]; noSalen: T[] } {
  const salen: T[] = [];
  const noSalen: T[] = [];
  for (const x of pedidos) (bloqueCompartible(x.b.bloque) ? salen : noSalen).push(x);
  return { salen, noSalen };
}

/** Los ids de todos los bloques del catálogo (para el test que cruza la lista con el catálogo). */
export const IDS_BLOQUES = BLOQUES.map((b) => b.id);
