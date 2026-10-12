// =============================================================================
// graficos-controles-texto — lo que DICE un control de la vista, y qué conviene ofrecer
// =============================================================================
// Martín, 11/10/2026 (puntos 12-14): «El botón de "Añadir control"… es una forma de añadir filtros
// en la vista… siempre configurado en el mismo lugar, como en una topbar del lienzo», «es importante
// poder agregar un control a cada gráfico… revisa que eso no produzca bugs» y «siempre arriba como en
// una topbar».
//
// Acá vive lo PURO de los controles que dibuja app/dashboard/BarraControles.tsx: el resumen corto que
// va en el botón («Últimos 7 días», «Campaña · 2», «Busca: promo», «Por semana»), qué campos ofrecer
// (primero los que filtran algún gráfico de la página), qué se puede agregar y qué no (uno por cosa),
// con qué arranca un control nuevo, y la lista de valores de una lista desplegable. Sin `server-only` y
// sin React: lo importan la pantalla y los tests.
//
// ⚠️ Quién decide qué filtra de verdad NO es este archivo: es `efectivoDe` (lib/graficos-catalogo.ts).
//    Acá sólo se DICE y se OFRECE. Si un texto de acá y `efectivoDe` se contradicen, el que miente es
//    el texto, así que cada regla que se repite se apoya en una función del catálogo (`conVista`,
//    `controlActivo`, `campoDe`) en vez de reescribirla.

import {
  AGRUPAR, CAMPOS, MAX_CONTROLES, MAX_VALORES, PRESET_AUTOMATICO, TIPOS_CONTROL,
  campoDe, camposDeFuente, controlActivo, conVista, fuenteDe, nombrePreset, nuevoControlVista, rangoDe,
  type Agrupar, type Bloque, type ControlVista, type Fuente, type Grafico, type Hoja, type TipoControl, type ValorControl, type VistaValores,
} from './graficos-catalogo';
import { claveCategoria } from './graficos-agregar';

// ── El campo de una dimensión ───────────────────────────────────────────────────────────────

/**
 * El CAMPO (de CAMPOS) que filtra la dimensión `dimension` de un conjunto: el compartido si la dimensión
 * significa lo mismo en otros («Campaña»), si no el propio del conjunto («Ángulo · Guiones»). `null` = esa
 * dimensión no se puede filtrar (una de tiempo, o una que el conjunto no tiene).
 * La usan la barra de búsqueda de una tabla (el control `texto` sobre la dimensión de SU fila) y la API de
 * MaKo (los filtros de un gráfico que arma un agente). Una sola respuesta para las dos: con dos, la tabla
 * buscaría en un campo y la API filtraría por otro.
 */
export function campoDeDimension(fuente: Fuente | string, dimension: string | null | undefined): string | null {
  const id = typeof fuente === 'string' ? fuente : fuente.id;
  if (!dimension) return null;
  return CAMPOS.find((c) => c.en[id] === dimension)?.id ?? null;
}

// ── Lo que se dibuja ────────────────────────────────────────────────────────────────────────

/**
 * Los controles que se DIBUJAN (en la barra de la hoja, en el «Filtro» de una tarjeta): todos menos los de
 * DEFINICIÓN (`fijo`, v5), que deciden igual pero no se muestran ni se mueven mirando.
 */
export const controlesQueSeVen = (controles: readonly ControlVista[]): ControlVista[] => controles.filter((c) => !c.fijo);

// ── Fechas cortas ───────────────────────────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const partes = (f: string) => {
  const [y, m, d] = f.split('-').map(Number);
  return Number.isFinite(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null;
};

/**
 * Un rango en pocas letras: «5 – 11 oct», «28 sep – 4 oct», «28 dic 2025 – 4 ene 2026». El año sale
 * sólo si no es el de hoy (o si el rango cruza de año): un «2026» al lado de cada fecha de este año
 * es ruido que tapa la parte que cambia.
 */
export function rangoCorto(desde: string, hasta: string, hoy?: string): string {
  const a = partes(desde);
  const b = partes(hasta);
  if (!a || !b) return `${desde} – ${hasta}`;
  const anioHoy = (hoy && partes(hoy)?.y) || b.y;
  const dm = (p: { d: number; m: number }) => `${p.d} ${MESES[p.m - 1]}`;
  if (a.y !== b.y) return `${dm(a)} ${a.y} – ${dm(b)} ${b.y}`;
  const anio = b.y !== anioHoy ? ` ${b.y}` : '';
  if (desde === hasta) return `${dm(b)}${anio}`;
  if (a.m === b.m) return `${a.d} – ${dm(b)}${anio}`;
  return `${dm(a)} – ${dm(b)}${anio}`;
}

/** El rango que mira un control de período (lo que tenga puesto: de entrada o lo elegido mirando). */
export const rangoDelControl = (c: ControlVista, hoy: string) => rangoDe(c.preset, hoy, c.desde, c.hasta);

// ── El resumen del botón ────────────────────────────────────────────────────────────────────

/** Se recorta por caracteres (un emoji compuesto no se parte) y con «…»: el botón tiene ancho tope. */
const corto = (t: string, max = 22) => {
  const letras = Array.from(t);
  return letras.length > max ? `${letras.slice(0, max - 1).join('').trimEnd()}…` : t;
};
const conMinuscula = (s: string) => (s ? s.charAt(0).toLocaleLowerCase('es') + s.slice(1) : s);

/** El nombre de un campo como lo lee la persona («Campaña», «Estado · Pagos»). */
export const nombreCampo = (id: string | null | undefined): string => campoDe(id)?.nombre ?? 'Campo';

/** El título del panel de un control. */
export function tituloControl(c: ControlVista): string {
  if (c.tipo === 'periodo') return 'Período';
  if (c.tipo === 'agrupar') return 'Agrupar por';
  return nombreCampo(c.campo);
}

/**
 * Lo que dice el botón: corto, porque la barra entera es una fila. Se le pasa el control YA con la
 * vista encima (`conVista`) cuando lo que se muestra es lo que se está mirando.
 *
 * ⚠️ Una lista en «todos» dice sólo el nombre del campo, sin «Todos/Todas»: el género del campo no se
 *    sabe («Campaña: Todos» se lee mal) y el botón sin relleno ya dice que no filtra.
 */
export function resumenControl(c: ControlVista, hoy: string): string {
  switch (c.tipo) {
    case 'periodo': {
      if (c.preset !== 'personalizado') return nombrePreset(c.preset);
      const r = rangoDelControl(c, hoy);
      return rangoCorto(r.desde, r.hasta, hoy);
    }
    case 'lista': {
      const n = nombreCampo(c.campo);
      const v = c.valores ?? [];
      if (!v.length) return n;
      if (v.length === 1) return `${n}: ${corto(v[0])}`;
      return `${n} · ${v.length}`;
    }
    case 'texto': {
      const t = c.texto.trim();
      return t ? `Busca: ${corto(t)}` : `Buscar ${conMinuscula(nombreCampo(c.campo))}`;
    }
    case 'agrupar': {
      if (c.agrupar === 'auto') return 'Agrupar: automático';
      return `Por ${(AGRUPAR.find((a) => a.id === c.agrupar)?.nombre ?? c.agrupar).toLowerCase()}`;
    }
  }
}

/** La frase entera, para el `title` del botón (ahí sí entra: no ocupa lugar). */
export function detalleControl(c: ControlVista, hoy: string): string {
  switch (c.tipo) {
    case 'periodo': { const r = rangoDelControl(c, hoy); return `${nombrePreset(c.preset)}: ${rangoCorto(r.desde, r.hasta, hoy)}`; }
    case 'lista': return c.valores?.length ? `${nombreCampo(c.campo)}: ${c.valores.join(', ')}` : `${nombreCampo(c.campo)}: todos los valores`;
    case 'texto': return c.texto.trim() ? `${nombreCampo(c.campo)} que contenga «${c.texto.trim()}»` : `Buscar en ${nombreCampo(c.campo)}`;
    case 'agrupar': return `Agrupar por ${(AGRUPAR.find((a) => a.id === c.agrupar)?.nombre ?? c.agrupar).toLowerCase()}`;
  }
}

// ── Uno por cosa ────────────────────────────────────────────────────────────────────────────

/**
 * La clave con la que `sanearControles` decide «uno por cosa». ⚠️ Una lista y una búsqueda sobre el
 * MISMO campo comparten clave: el saneo tira la segunda, así que ofrecerla sería ofrecer un control que
 * desaparece al guardar.
 */
export const claveControl = (tipo: TipoControl, campo: string | null) => (tipo === 'periodo' || tipo === 'agrupar' ? tipo : `campo:${campo}`);
export const yaExiste = (controles: readonly ControlVista[], tipo: TipoControl, campo: string | null = null) =>
  controles.some((c) => claveControl(c.tipo, c.campo) === claveControl(tipo, campo));

// ── Qué campos ofrecer ──────────────────────────────────────────────────────────────────────

export type CampoOfrecido = { id: string; nombre: string; /** Cuántos gráficos de la página filtra. */ graficos: number; /** Ya hay un control sobre este campo. */ usado: boolean };

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');
const usadoEn = (controles: readonly ControlVista[], campo: string) => controles.some((c) => (c.tipo === 'lista' || c.tipo === 'texto') && c.campo === campo);

/**
 * Los campos para un filtro de la PÁGINA. Primero los que filtran algún gráfico de la hoja (de más a
 * menos gráficos), después el resto por nombre. Un campo que no filtra ningún gráfico de la página se
 * ofrece igual —la persona puede estar por agregar el gráfico—, pero abajo: es el que menos sirve.
 */
export function camposParaHoja(hoja: Hoja): CampoOfrecido[] {
  const fuentes = hoja.componentes.filter((c): c is Grafico => c.clase === 'grafico').map((g) => g.fuente);
  const lista = CAMPOS.map((c) => ({
    id: c.id, nombre: c.nombre,
    graficos: fuentes.filter((f) => !!c.en[f]).length,
    usado: usadoEn(hoja.controles, c.id),
  }));
  const filtran = lista.filter((c) => c.graficos > 0).sort((a, b) => b.graficos - a.graficos || porNombre(a, b));
  const resto = lista.filter((c) => c.graficos === 0).sort(porNombre);
  return [...filtran, ...resto];
}

/**
 * Los campos para un control de UN gráfico: sólo los que su conjunto puede filtrar. Un control sobre un
 * campo que el gráfico no tiene no haría nada (`efectivoDe` lo mandaría a «no filtra por…»). Un bloque
 * no tiene campos: sólo período.
 */
export function camposParaComp(comp: Grafico | Bloque): CampoOfrecido[] {
  if (comp.clase !== 'grafico') return [];
  return camposDeFuente(comp.fuente).map((c) => ({ id: c.id, nombre: c.nombre, graficos: 1, usado: usadoEn(comp.controles, c.id) })).sort(porNombre);
}

/** Las fuentes de la página que un campo filtra: para pedir los valores de ESA página y no de todo MaKo. */
export function fuentesDelCampoEnHoja(hoja: Hoja, campo: string): string[] | undefined {
  const en = campoDe(campo)?.en ?? {};
  const fuentes = [...new Set(hoja.componentes.filter((c): c is Grafico => c.clase === 'grafico' && !!en[c.fuente]).map((g) => g.fuente))];
  return fuentes.length ? fuentes.sort() : undefined;
}

// ── Qué se puede agregar ────────────────────────────────────────────────────────────────────

/** Dónde se agrega: a la barra de la página, o a la cabecera de un gráfico o un bloque. */
export type Nivel = { nivel: 'hoja'; hoja: Hoja } | { nivel: 'componente'; comp: Grafico | Bloque; hoja: Hoja };
export type OpcionAgregar = { id: TipoControl; nombre: string; linea: string; /** null = se puede; si no, por qué no (corto). */ motivo: string | null };

const esTiempo = (d: string | null) => d === 'dia' || d === 'semana' || d === 'mes';
const controlesDe = (n: Nivel) => (n.nivel === 'hoja' ? n.hoja.controles : n.comp.controles);

/**
 * Los tipos que el menú ofrece y, si no se puede, por qué. Nada se esconde: un tipo apagado con su
 * motivo dice que existe y por qué acá no; uno escondido manda a buscarlo.
 *   · Uno por cosa (un período, un «agrupar por», un control por campo), como `sanearControles`.
 *   · Un bloque sólo tiene período (`sanearBloque` tira el resto).
 *   · En un gráfico, un período sobre un conjunto que mira «hoy» y un «agrupar por» sobre un gráfico
 *     que no va por fecha no harían nada: se apagan con su motivo.
 */
export function opcionesAgregar(n: Nivel): OpcionAgregar[] {
  const controles = controlesDe(n);
  const lleno = controles.length >= MAX_CONTROLES;
  const g = n.nivel === 'componente' && n.comp.clase === 'grafico' ? n.comp : null;
  const tipos = n.nivel === 'componente' && n.comp.clase === 'bloque' ? TIPOS_CONTROL.filter((t) => t.id === 'periodo') : TIPOS_CONTROL;
  const campos = n.nivel === 'hoja' ? camposParaHoja(n.hoja) : camposParaComp(n.comp);
  return tipos.map((t) => {
    let motivo: string | null = null;
    if (lleno) motivo = `Hasta ${MAX_CONTROLES}`;
    else if (t.id === 'periodo' || t.id === 'agrupar') {
      if (yaExiste(controles, t.id)) motivo = 'Ya hay uno';
      else if (g && t.id === 'periodo' && fuenteDe(g.fuente)?.fechas.find((f) => f.id === g.fecha)?.sinRango) motivo = 'No usa fechas';
      else if (g && t.id === 'agrupar' && !esTiempo(g.dimension)) motivo = 'No va por fecha';
    } else if (!campos.some((c) => !c.usado)) motivo = campos.length ? 'Ya están todos' : 'Sin campos';
    return { id: t.id, nombre: t.nombre, linea: t.linea, motivo };
  });
}

/**
 * El control que se agrega, con lo que muestra DE ENTRADA. En la página arranca como el control nuevo
 * del catálogo (30 días, «todos», «automático»). En un gráfico arranca mostrando LO MISMO que el
 * gráfico ya mostraba —agregar un control no puede cambiar el número que se está mirando—:
 *   · período: el período propio del gráfico, si tiene; si no, el del control de la página.
 *   · agrupar: el de la página, si hay; si no, la dimensión de tiempo del gráfico.
 *   · lista o búsqueda: lo que tenga el control de la página sobre ese campo (el del gráfico lo
 *     REEMPLAZA, así que arrancar en «todos» le sacaría el filtro de la página sin que nadie lo pida).
 * `null` si no se puede (una lista sin campo).
 */
export function nuevoControlPara(tipo: TipoControl, campo: string | null, n: Nivel): ControlVista | null {
  const base = nuevoControlVista(tipo, campo);
  if (!base || n.nivel === 'hoja') return base;
  const pagina = n.hoja.controles;
  if (tipo === 'periodo') {
    // Lo que el gráfico YA mira: su control de período (también el fijo: desde v5 el período propio de antes
    // es un control fijo, migrado en el saneo), su período propio en el campo de antes, o el de la página.
    const propio = n.comp.controles.find((c) => c.tipo === 'periodo');
    if (propio) return { ...base, preset: propio.preset, desde: propio.desde, hasta: propio.hasta };
    if (n.comp.periodo !== 'auto') return { ...base, preset: n.comp.periodo, desde: n.comp.desde, hasta: n.comp.hasta };
    const p = pagina.find((c) => c.tipo === 'periodo');
    return p ? { ...base, preset: p.preset, desde: p.desde, hasta: p.hasta } : base;
  }
  if (tipo === 'agrupar') {
    const a = pagina.find((c) => c.tipo === 'agrupar');
    if (a) return { ...base, agrupar: a.agrupar };
    const dim = n.comp.clase === 'grafico' ? n.comp.dimension : null;
    return { ...base, agrupar: esTiempo(dim) ? (dim as Agrupar) : 'auto' };
  }
  const igual = pagina.find((c) => c.tipo === tipo && c.campo === campo);
  if (!igual) return base;
  return tipo === 'lista' ? { ...base, valores: igual.valores ? [...igual.valores] : null } : { ...base, texto: igual.texto };
}

// ── Lo elegido ──────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se elige en un panel, convertido en el parche del control GUARDADO («Lo que muestra de
 * entrada»). Sólo los campos de su tipo: una lista no toca el período aunque el valor traiga uno.
 */
export function parcheDeEntrada(tipo: TipoControl, v: ValorControl): Partial<ControlVista> {
  switch (tipo) {
    case 'periodo': return v.preset ? { preset: v.preset, desde: v.desde ?? null, hasta: v.hasta ?? null } : {};
    case 'lista': return v.valores !== undefined ? { valores: v.valores && v.valores.length ? [...v.valores] : null } : {};
    case 'texto': return v.texto !== undefined ? { texto: v.texto } : {};
    case 'agrupar': return v.agrupar ? { agrupar: v.agrupar } : {};
  }
}

const firmaValores = (v: string[] | null) => (v && v.length ? [...v].map((x) => claveCategoria(x)).sort().join('\u0000') : '');

/**
 * ¿Lo que se está mirando en este control es distinto de lo que muestra de entrada? Un filtro de DEFINICIÓN
 * (`fijo`) nunca, y no hace falta preguntarlo acá: `conVista` no lo mueve (un solo lugar decide), así que lo
 * mirado es lo de entrada y no hay nada que «Restablecer».
 */
export function distintoDeEntrada(c: ControlVista, vista: VistaValores): boolean {
  if (!vista[c.id]) return false;
  const v = conVista(c, vista);
  switch (c.tipo) {
    case 'periodo': return v.preset !== c.preset || (v.preset === 'personalizado' && (v.desde !== c.desde || v.hasta !== c.hasta));
    case 'lista': return firmaValores(v.valores) !== firmaValores(c.valores);
    case 'texto': return v.texto.trim() !== c.texto.trim();
    case 'agrupar': return v.agrupar !== c.agrupar;
  }
}

/**
 * ¿Hay algo elegido mirando en esta página (la barra o la cabecera de algún gráfico)? Decide «Restablecer».
 * Los filtros de definición (`fijo`) no cuentan: `distintoDeEntrada` los deja afuera (un solo lugar).
 */
export function hayVistaElegida(hoja: Hoja, vista: VistaValores): boolean {
  const todos = [...hoja.controles, ...hoja.componentes.flatMap((c) => (c.clase === 'elemento' ? [] : c.controles))];
  return todos.some((c) => distintoDeEntrada(c, vista));
}

/** El período de la PÁGINA (el control de la barra con lo elegido encima; sin control, 30 días). */
export function periodoDePagina(hoja: Hoja, vista: VistaValores, hoy: string): { desde: string; hasta: string } {
  const p = hoja.controles.find((c) => c.tipo === 'periodo');
  return p ? rangoDelControl(conVista(p, vista), hoy) : rangoDe(PRESET_AUTOMATICO, hoy);
}

/** ¿El botón de este control se pinta «filtrando»? Una lista o una búsqueda con algo elegido. */
export const pintaActivo = (c: ControlVista) => (c.tipo === 'lista' || c.tipo === 'texto') && controlActivo(c);

// ── La lista desplegable ────────────────────────────────────────────────────────────────────

export type ValorLista = { valor: string; filas: number };
export type OpcionLista = ValorLista & { elegido: boolean };
/** Cuántos valores se dibujan antes de pedir que se busque: 300 casillas no se leen, se scrollean. */
export const TOPE_LISTA = 50;
/**
 * Cuántos valores manda la ruta como mucho (el `slice(0, 300)` de `valoresDeCampo`, lib/graficos-datos.ts,
 * que es server-only y no se puede importar acá). ⚠️ La búsqueda de la lista es sobre lo que LLEGÓ: con
 * 300 justos, el 301 no se encuentra buscando, y la pantalla lo dice en vez de prometer que está.
 */
export const TOPE_VALORES_RUTA = 300;

/** Sin acentos y en minúsculas: la MISMA comparación que la búsqueda de `filtrarFilas`. */
const plano = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Las casillas de una lista: lo elegido arriba de todo (si quedara abajo del tope, no habría cómo
 * destildarlo) y el resto en el orden en que llegó (de más filas a menos). Un valor elegido que en este
 * período no tiene filas ENTRA igual, con 0: que ya no se pueda elegir no es lo mismo que esconder lo
 * que ya está elegido (AGENTS.md, el `<select>` cuyo valor no está entre sus opciones).
 */
export function opcionesDeLista(valores: readonly ValorLista[], elegidos: readonly string[] | null, q: string, tope = TOPE_LISTA): { opciones: OpcionLista[]; ocultos: number } {
  const sel = new Set((elegidos ?? []).map((v) => claveCategoria(v)));
  const vistos = new Set<string>();
  const todos: OpcionLista[] = [];
  for (const v of valores) {
    const k = claveCategoria(v.valor);
    if (vistos.has(k)) continue;
    vistos.add(k);
    todos.push({ valor: k, filas: v.filas, elegido: sel.has(k) });
  }
  const sinFilas: OpcionLista[] = [...sel].filter((k) => !vistos.has(k)).map((k) => ({ valor: k, filas: 0, elegido: true }));
  const busca = plano(q.trim());
  const pasan = [...sinFilas, ...todos].filter((o) => !busca || plano(o.valor).includes(busca));
  const elegidas = pasan.filter((o) => o.elegido);
  const resto = pasan.filter((o) => !o.elegido);
  const muestra = resto.slice(0, Math.max(0, tope));
  return { opciones: [...elegidas, ...muestra], ocultos: resto.length - muestra.length };
}

/**
 * Tildar o destildar un valor. `null` es «todos» (nunca `[]`, que significaría dos cosas): desde
 * «todos», tildar uno deja SÓLO ése —no «todos menos ése», que con 300 valores pasaría el tope de
 * `MAX_VALORES` y filtraría otra cosa—; destildar el último vuelve a «todos». Con el tope lleno no se
 * suma nada y se avisa.
 */
export function alternarValor(elegidos: readonly string[] | null, valor: string): { valores: string[] | null; topeado: boolean } {
  const k = claveCategoria(valor);
  const actual = (elegidos ?? []).map((v) => claveCategoria(v));
  if (actual.includes(k)) {
    const quedan = actual.filter((v) => v !== k);
    return { valores: quedan.length ? quedan : null, topeado: false };
  }
  if (actual.length >= MAX_VALORES) return { valores: actual.length ? actual : null, topeado: true };
  return { valores: [...actual, k], topeado: false };
}
