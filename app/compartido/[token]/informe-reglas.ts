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
// gráfico, su id y lo que la vista resolvió (`desde`, `hasta`, `filtros`, `agrupar`). Las cinco
// decisiones, y las cinco en POSITIVO (lo nuevo nace cerrado):
//
//   1. EL SERVER NO CONFÍA EN EL PEDIDO. El gráfico sale del informe GUARDADO (id de hoja + id de
//      gráfico): el `grafico` que viaja en el cuerpo no se lee. Del navegador se acepta el PERÍODO, el
//      «agrupar por» y los filtros sobre los controles que la hoja YA tiene y que quien mira puede mover.
//      Un link no sirve para consultar cualquier conjunto del negocio ni para filtrar por lo que el dueño
//      no puso.
//   2. LAS PERSONAS NO SALEN. Las etiquetas de un gráfico pasan por `sinPersonas` (app/dashboard/exportar.ts):
//      la MISMA lista positiva del AI Analyst (`DIMENSIONES_PUBLICAS`, lib/graficos-analisis.ts). Lo que
//      no es público sale como «Closer 1…N», también en las COLUMNAS EXTRA de una tabla (`extra`: el closer
//      de una llamada) y sin la miniatura de una fila que es una persona (`imagen`). Y `ref` (el id de lo
//      que es una fila) se va: sólo sirve para abrir el detalle, que no se ofrece.
//   3. UN FILTRO QUE QUIEN MIRA NO PUEDE MOVER NO SE MUEVE. Sobre un campo que no es público sus valores
//      serían nombres (la lista desplegable los mostraría) y una búsqueda por texto sería un oráculo letra
//      por letra; y un filtro de DEFINICIÓN (`fijo`, v5: «la KPI de R1 es R1») no lo cambia la vista ni en
//      la pantalla del dueño (`conVista`). Lo que el dueño dejó guardado sigue filtrando TAL CUAL; lo que
//      mande el navegador ahí, no. Si se tirara sin más, el gráfico mostraría MÁS de lo que el dueño eligió.
//      Los valores ELEGIDOS de los controles de personas viajan al navegador como alias (`tableroParaLink`).
//   4. LO QUE NO SE COMPARTE SE DICE, Y NI SE LEE (v5, 12/10/2026). Sale lo que está en las listas de abajo
//      (`seComparte`); lo demás llega al navegador como una tarjeta que dice «No se comparte en un link», y
//      el server tampoco lo lee aunque se lo pidan:
//        · el mapa de calor de página — es la página de un cliente EN VIVO (cada apertura le cuenta una
//          visita a su Pixel) y lee los toques por su cuenta, fuera de este endpoint;
//        · las cajas «Conclusiones de MaKo» — su texto vive en otra tabla y puede nombrar personas;
//        · los pop-ups y las piezas de una ficha — la ficha de una llamada, de un anuncio o de un lead;
//        · las acciones — un botón que escribe (sincronizar, re-analizar) y sin sesión falla;
//        · un video, un enlace o una página insertada que es la GRABACIÓN de una llamada (la vara de la API
//          de MaKo por HTTP, `urlParaCanal`: los links de grabaciones no salen a un tercero).
//      Las acciones de la fila de una tabla («Marcar cobrada») tampoco viajan.
//   5. LA BÚSQUEDA DE UNA TABLA es un control más de su gráfico (`conBusqueda`, app/dashboard/exportar.ts):
//      se puede mover sólo si su campo es público, igual que cualquier otro (la pantalla tampoco dibuja la
//      barra sobre un campo de personas, app/dashboard/BuscarEnHoja.tsx).

import {
  AGRUPAR, MAX_COMPONENTES, MAX_VALORES, TIPOS_ELEMENTO, campoDe, efectivoDe, esElemento, esGrafico, tituloDe,
  type Componente, type ControlVista, type Elemento, type FiltroDim, type Grafico, type Hoja, type Tablero, type TipoElemento,
} from '@/lib/graficos-catalogo';
import { Alias, dimensionPublica, etiquetaSegura } from '@/lib/graficos-analisis';
import { fuentesDelCampoEnHoja } from '@/lib/graficos-controles-texto';
import { esFechaValida } from '@/lib/date-utils';
import type { FilaResultado, Resultado } from '@/lib/graficos-agregar';
import { conBusqueda, sinPersonas, type PedidoGrafico } from '@/app/dashboard/exportar';

/** Lo que contesta el endpoint cuando le piden el detalle de un número. Corto: es texto de pantalla. */
export const DETALLE_NO_SE_COMPARTE = 'El detalle no se comparte';
/** Lo que dice la tarjeta de lo que no sale en un informe compartido (y lo que contesta el endpoint). */
export const NO_SE_COMPARTE = 'No se comparte en un link';

/** El id de una hoja o de un componente como lo acuña el catálogo (`idValido` de lib/graficos-catalogo.ts). */
export const idDeInforme = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null);

/** La hoja en que abre el link: la pedida si el informe la tiene; si no, la primera. Nunca agrega una. */
export function hojaDeInforme(t: Tablero, pedida: unknown): Hoja {
  const id = idDeInforme(pedida);
  return (id && t.hojas.find((h) => h.id === id)) || t.hojas[0];
}

// ── Qué sale (decisión 4) ───────────────────────────────────────────────────────────────────

/**
 * Los tipos de GRÁFICO que no salen, con su porqué. Un gráfico se lee con `datosDeGraficos` y sus etiquetas
 * pasan por la lista positiva de las personas (decisión 2): un tipo nuevo sale por esa misma regla. Lo que
 * NO pasa por ahí es un tipo con DIBUJO PROPIO (app/dashboard/graficos/registro.ts), que lee por su cuenta:
 * ése va acá, y tests/dashboard-compartir.test.ts falla si uno se registra sin decidirlo.
 */
export const TIPOS_QUE_NO_SALEN: Readonly<Record<string, string>> = {
  mapa_calor: 'es la página de un cliente en vivo, y lee los toques fuera del endpoint del link',
};

/** Los ELEMENTOS que salen, EN POSITIVO: uno nuevo no sale hasta que alguien lo agregue acá. */
export const ELEMENTOS_QUE_SALEN: readonly TipoElemento[] = ['texto', 'enlace', 'imagen', 'video', 'insertado', 'linea', 'flecha', 'seccion'];
/** Los que no, con su porqué (el test exige que cada tipo del catálogo esté en una de las dos listas). */
export const ELEMENTOS_QUE_NO_SALEN: Readonly<Partial<Record<TipoElemento, string>>> = {
  ia: 'su texto vive en otra tabla y puede nombrar personas',
  entidad: 'es la ficha de una llamada, un anuncio o un lead',
  accion: 'es un botón que escribe, y sin sesión falla',
};

/**
 * ¿Esta dirección es la GRABACIÓN de una llamada? (Fathom). La misma vara que la API de MaKo por HTTP
 * (`urlParaCanal`, lib/api-mako/areas/dashboard.helpers.ts, que llama a ésta): un link de una grabación no
 * sale a un tercero. Una dirección que no se entiende no es una grabación.
 */
export function esGrabacionDeLlamada(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'fathom.video' || h.endsWith('.fathom.video');
  } catch {
    return false;
  }
}

/** ¿Este componente sale en un link? Un gráfico, salvo los tipos de arriba; un elemento, sólo los de la lista. */
export function seComparte(c: Componente): boolean {
  if (esGrafico(c)) return !Object.prototype.hasOwnProperty.call(TIPOS_QUE_NO_SALEN, c.tipo);
  if (!esElemento(c)) return false;
  if (!ELEMENTOS_QUE_SALEN.includes(c.tipo)) return false;
  return !esGrabacionDeLlamada(c.url);
}

/**
 * Cómo se llama en su tarjeta lo que no sale: un gráfico, por su título (como cualquier otro gráfico del link);
 * un elemento, por su TIPO y nunca por su texto — el título de un video que no sale es justo «Llamada con Ana».
 */
function nombreEnTarjeta(c: Componente): string {
  if (esElemento(c)) return TIPOS_ELEMENTO.find((x) => x.id === c.tipo)?.nombre ?? 'Elemento';
  return tituloDe(c);
}

/**
 * La tarjeta de lo que no sale: un TEXTO en el mismo lugar (mismo id, misma caja), con el nombre y «No se
 * comparte en un link». Es un elemento que el navegador ya sabe dibujar y que no lee nada: así el link no
 * monta el mapa de calor (que cargaría la página en vivo), ni la caja de IA, ni el botón.
 */
export function tarjetaNoSeComparte(c: Componente): Elemento {
  return {
    id: c.id, clase: 'elemento', tipo: 'texto',
    texto: `${nombreEnTarjeta(c)}\n${NO_SE_COMPARTE}`,
    tamano: 's', alinear: 'centro', color: null, relleno: false, url: '', ajuste: 'cubrir', direccion: 'derecha', grosor: 2,
    x: c.x, y: c.y, w: c.w, h: c.h,
  };
}

// ── Lo que pide el cuerpo ───────────────────────────────────────────────────────────────────

/**
 * Los pedidos del cuerpo, cada uno con SU gráfico GUARDADO de esta hoja. Un id que no es de la hoja
 * (también el de un componente de un pop-up: viven adentro de su gráfico, no en la hoja), repetido o que
 * no es un gráfico se descarta: no hay nada que rearmar. Con tope.
 */
export function pedidosDeGraficos(hoja: Hoja, crudo: unknown): Array<{ comp: Grafico; cliente: Record<string, unknown> }> {
  if (!Array.isArray(crudo)) return [];
  const out: Array<{ comp: Grafico; cliente: Record<string, unknown> }> = [];
  const vistos = new Set<string>();
  for (const x of crudo.slice(0, MAX_COMPONENTES)) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const cliente = x as Record<string, unknown>;
    const id = idDeInforme(cliente.id);
    if (!id || vistos.has(id)) continue;
    const comp = hoja.componentes.find((c) => c.id === id);
    if (!comp || !esGrafico(comp)) continue;
    vistos.add(id);
    out.push({ comp, cliente });
  }
  return out;
}

/**
 * Parte los pedidos de gráficos en los que se LEEN y los que contestan «No se comparte en un link». Decide el
 * TIPO del gráfico GUARDADO (`seComparte`), nunca su id ni lo que diga el cuerpo: lo que no sale ni se lee.
 */
export function repartirGraficos<T extends { g: Grafico }>(pedidos: readonly T[]): { salen: T[]; noSalen: T[] } {
  const salen: T[] = [];
  const noSalen: T[] = [];
  for (const x of pedidos) (seComparte(x.g) ? salen : noSalen).push(x);
  return { salen, noSalen };
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
 * Las dimensiones de `g` que la VISTA puede filtrar en un informe compartido, con el tipo de control: las de
 * un control de lista o de búsqueda que la hoja (o el gráfico, con la barra de su tabla) YA tiene, sobre un
 * campo público, y que NO es de definición. El del gráfico va después y gana sobre el de la hoja en el mismo
 * campo (como `efectivoDe`): por eso un filtro FIJO del gráfico SACA ese campo de lo permitido aunque la hoja
 * tenga un control para mirarlo — en la pantalla del dueño también manda el fijo.
 */
export function filtrosPermitidos(g: Grafico, hoja: Hoja): Map<string, 'lista' | 'texto'> {
  const out = new Map<string, 'lista' | 'texto'>();
  const conBarra = conBusqueda(g);
  for (const c of [...hoja.controles, ...conBarra.controles]) {
    if ((c.tipo !== 'lista' && c.tipo !== 'texto') || !c.campo) continue;
    const dim = campoDe(c.campo)?.en[g.fuente];
    if (!dim) continue;
    if (c.fijo || !campoCompartible(hoja, c.campo)) { out.delete(dim); continue; }
    out.set(dim, c.tipo);
  }
  return out;
}

/**
 * Los filtros con que se lee `g`: los del dueño sobre lo que no se mueve (tal cual quedaron guardados, los de
 * definición incluidos) y los de la vista sobre lo permitido (`filtrosPermitidos`). Un filtro del cuerpo sobre
 * cualquier otra dimensión no existe para el server.
 */
export function filtrosCompartidos(g: Grafico, hoja: Hoja, crudo: unknown, hoy: string): FiltroDim[] {
  const permitidos = filtrosPermitidos(g, hoja);
  const delDueno = efectivoDe(conBusqueda(g), hoja, {}, hoy).filtros.filter((f) => !permitidos.has(f.dimension));
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

/** ¿El período de `g` es de DEFINICIÓN? Un control de período `fijo`, o el período propio de antes (sin control). */
function periodoDeDefinicion(g: Grafico): boolean {
  const p = g.controles.find((c) => c.tipo === 'periodo');
  return p ? !!p.fijo : g.periodo !== 'auto';
}

/**
 * El período que pidió la vista; si no es un período válido —o si el período del gráfico es de definición
 * (las cohortes miran «todo», el «A quién cobrarle» mira hacia adelante)—, el que el informe muestra de entrada.
 */
export function periodoCompartido(g: Grafico, hoja: Hoja, desde: unknown, hasta: unknown, hoy: string): { desde: string; hasta: string } {
  const d = typeof desde === 'string' ? desde : '';
  const h = typeof hasta === 'string' ? hasta : '';
  if (!periodoDeDefinicion(g) && esFechaValida(d) && esFechaValida(h) && d <= h) return { desde: d, hasta: h };
  const e = efectivoDe(g, hoja, {}, hoy);
  return { desde: e.desde, hasta: e.hasta };
}

/** El pedido de un GRÁFICO, rearmado: el gráfico guardado, el período y el agrupar de la vista, y los filtros permitidos. */
export function pedidoGraficoCompartido(g: Grafico, hoja: Hoja, cliente: Record<string, unknown>, hoy: string): PedidoGrafico {
  const { desde, hasta } = periodoCompartido(g, hoja, cliente.desde, cliente.hasta, hoy);
  const ag = typeof cliente.agrupar === 'string' && cliente.agrupar !== 'auto' && AGRUPAR.some((a) => a.id === cliente.agrupar)
    ? (cliente.agrupar as 'dia' | 'semana' | 'mes')
    : efectivoDe(g, hoja, {}, hoy).agrupar;
  return { grafico: g, desde, hasta, filtros: filtrosCompartidos(g, hoja, cliente.filtros, hoy), agrupar: ag };
}

/**
 * El control de LISTA cuyos valores se piden: el de la barra de la hoja o, con `componenteId`, el de la
 * cabecera de ese gráfico (que tiene que salir en el link). null si no existe, no es una lista con campo, o
 * es de definición (no se dibuja: nadie tiene por qué pedir sus valores).
 */
export function controlDeLista(hoja: Hoja, controlId: unknown, componenteId: unknown): ControlVista | null {
  const id = idDeInforme(controlId);
  if (!id) return null;
  const compId = idDeInforme(componenteId);
  let lista: readonly ControlVista[] = hoja.controles;
  if (compId) {
    const comp = hoja.componentes.find((c) => c.id === compId);
    if (!comp || !esGrafico(comp) || !seComparte(comp)) return null;
    lista = comp.controles;
  }
  const c = lista.find((x) => x.id === id);
  return c && c.tipo === 'lista' && c.campo && !c.fijo ? c : null;
}

// ── Lo que viaja al navegador ───────────────────────────────────────────────────────────────

/**
 * Un control como viaja al navegador en un link: si su campo NO se puede mover en esta hoja
 * (`campoCompartible`), los valores que el dueño dejó elegidos van como alias («Closer 1») y una búsqueda
 * dice que hay una búsqueda, no qué se buscó. Es la regla de `controlParaHttp` de la API de MaKo
 * (lib/api-mako/areas/dashboard.helpers.ts) medida contra las fuentes de ESTA hoja, que es lo mismo que
 * decide `filtrosPermitidos`: lo que se muestra con su valor es exactamente lo que se puede mover.
 */
export function controlParaLink(c: ControlVista, hoja: Hoja, alias: Alias): ControlVista {
  if ((c.tipo !== 'lista' && c.tipo !== 'texto') || !c.campo) return c;
  if (campoCompartible(hoja, c.campo)) return c;
  const nombre = campoDe(c.campo)?.nombre ?? 'Valor';
  return { ...c, valores: c.valores?.map((v) => alias.de(nombre, v)) ?? null, texto: c.texto ? 'una búsqueda' : '' };
}

/**
 * Un gráfico como viaja al navegador: sin su pop-up (ni la orden de abrirlo), sin las acciones de la fila y
 * con los controles de personas en alias. Lo demás de v5 (la barra, la métrica chica, los ejes…) es cómo se
 * dibuja: viaja.
 */
function graficoParaLink(g: Grafico, hoja: Hoja, alias: Alias): Grafico {
  const limpio: Grafico = { ...g, controles: g.controles.map((c) => controlParaLink(c, hoja, alias)) };
  delete limpio.popup;
  delete limpio.alClic;
  if (limpio.tabla?.acciones) {
    const tabla = { ...limpio.tabla };
    delete tabla.acciones;
    if (Object.keys(tabla).length) limpio.tabla = tabla; else delete limpio.tabla;
  }
  return limpio;
}

/**
 * El informe como se manda al navegador de un link: lo que sale, limpio (`graficoParaLink`), y lo que no, como
 * la tarjeta que lo dice (`tarjetaNoSeComparte`). Los DATOS se leen siempre del guardado real (el filtro del
 * dueño sigue filtrando por «Juan»); esto es lo que se dibuja. Un alias por informe: el mismo nombre, el
 * mismo alias. Los conectores pasan: unen ids que siguen estando (la tarjeta conserva el id).
 */
export function tableroParaLink(t: Tablero): Tablero {
  const alias = new Alias();
  return {
    ...t,
    hojas: t.hojas.map((h) => ({
      ...h,
      controles: h.controles.map((c) => controlParaLink(c, h, alias)),
      componentes: h.componentes.map((comp) => {
        if (!seComparte(comp)) return tarjetaNoSeComparte(comp);
        return esGrafico(comp) ? graficoParaLink(comp, h, alias) : comp;
      }),
    })),
  };
}

// ── Lo que sale de un resultado ─────────────────────────────────────────────────────────────

/**
 * El resultado de un gráfico como sale AFUERA de la pantalla del dueño (el link y la API de MaKo por HTTP,
 * que llama a ésta desde `resultadoPara`): `sinPersonas` (las filas y el desglose) y además lo que esa función
 * no mira — las COLUMNAS EXTRA de una tabla (`extra`, «el closer» de una llamada; también el `colorPor`) y la
 * MINIATURA y el lugar de una fila cuya dimensión es una persona. Con el mismo `alias`, el mismo «Closer N».
 */
export function resultadoSinPersonas(g: Grafico, r: Resultado, alias: Alias = new Alias()): Resultado {
  const limpio = sinPersonas(g, r, alias);
  const filaPublica = dimensionPublica(g.fuente, g.dimension);
  let cambio = false;
  const filas: FilaResultado[] = limpio.filas.map((f) => {
    let fila = f;
    if (f.extra) {
      const extra: Record<string, string | null> = {};
      for (const [dim, v] of Object.entries(f.extra)) extra[dim] = v == null ? v : etiquetaSegura(g.fuente, dim, v, alias);
      if (Object.entries(extra).some(([k, v]) => v !== f.extra![k])) fila = { ...fila, extra };
    }
    if (!filaPublica && (f.imagen || f.geo)) {
      fila = { ...fila };
      delete fila.imagen;
      delete fila.geo;
    }
    if (fila !== f) cambio = true;
    return fila;
  });
  return cambio ? { ...limpio, filas } : limpio;
}

/**
 * El resultado de un gráfico como sale en un informe compartido: sin personas (`resultadoSinPersonas`) y sin
 * los ids de cada fila. `alias` se comparte entre los gráficos de un mismo pedido: el mismo nombre, el mismo
 * «Closer N».
 */
export function resultadoCompartible(g: Grafico, r: Resultado, alias: Alias = new Alias()): Resultado {
  const limpio = resultadoSinPersonas(g, r, alias);
  return {
    ...limpio,
    filas: limpio.filas.map((f) => {
      const sinId = { ...f };
      delete sinId.ref;
      return sinId;
    }),
  };
}
