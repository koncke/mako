// =============================================================================
// graficos-portadas — la PORTADA de cada plantilla: UNA pieza a lo ancho, con la forma de su objetivo y su color
// =============================================================================
// Martín, 14/10/2026: «A simple vista se tienen que diferenciar MUY bien de qué es cada template… que se note el objetivo
// del template con un vistazo… evita que al principio tenga muchos textos, muchos números… Luego abajo puede tener más
// cosas», y «Y nuevamente muchos gráficos juntos parece dashboard... el cuadrado que se llega a ver, sea muy épico... el
// bloque de anuncios, podría justamente traer la preview de algunos ads ganadores». Copiado de las portadas de informe de
// la galería de Canva (lib/graficos-identidad.ts cuenta qué se copió y de dónde).
//
// QUÉ ES UNA PORTADA: la primera pieza de la hoja, 12 columnas × `ALTO_PORTADA` filas, pintada con el color de la
// plantilla (`portada`, lib/graficos-identidad.ts). Es lo que se ve en la miniatura de la galería (la miniatura ES la hoja
// en chico: app/dashboard/MiniaturaHoja.tsx) y lo primero que se ve al abrirla. Cada una tiene OTRA FORMA según lo que esa
// hoja viene a contestar —un número, una barra partida, pósters de anuncios, la página con el calor, una curva, un reloj,
// columnas, personas, una matriz, trapecios, un anillo—: el color nunca es lo único que las distingue.
//
// DE DÓNDE SALE: una pieza que la plantilla YA tenía (`sube`: se saca de su lugar, se le cambia lo que diga `cambios` y
// va arriba) o una NUEVA (`nueva`), siempre de un tipo y unos datos del catálogo. No inventa un cálculo.
//
// EL HUECO: lo que la portada deja al irse (`cerrarHueco`): si estaba en una fila de números, sus vecinos se reparten el
// ancho; si estaba sola en sus filas, lo de abajo sube. Después todo baja `ALTO_PORTADA`. Reemplaza al titular 6 × 6 del
// 14/10 (`conTitular`): con la portada arriba, un segundo protagonista abajo le compite.
//
// ⚠️ LOS IDS de lo que ya existía NO cambian (`sube` mueve la MISMA pieza): la hoja del closer se lee en memoria con los ids
//    de la plantilla, y la caja de IA de la cuenta se busca por (hoja, elemento) — ver lib/graficos-plantillas-analysts.ts.
// ⚠️ Puro y sin server-only. SIN DATOS DE NINGÚN CLIENTE: los títulos son frases genéricas.
// =============================================================================

import { COLOR_DASHBOARD } from './graficos-identidad';

type Crudo = Record<string, unknown>;
type Id = (local: string) => string;

/** El alto de la portada (filas de la grilla): casi toda la miniatura de la galería (16:10) y medio escritorio. */
export const ALTO_PORTADA = 11;
const COLS = 12;

/** La portada de una plantilla: una pieza que ya tenía (`sube`, por su id local) o una nueva. */
export type DefinicionPortada =
  | ({ sube: string; cambios?: Crudo } & Composicion)
  | ({ nueva: (id: Id) => Crudo } & Composicion);
/** Lo que acompaña a la pieza: su vecino en la fila del negro y los dos de la fila siguiente, por su id local. Sin decirlo, los elige el orden. */
type Composicion = { vecino?: string; par?: readonly string[] };

/** ¿Este id (con el prefijo que le pone `armar`) es el local `local`? */
const esLocal = (id: unknown, local: string) => typeof id === 'string' && (id === local || id.endsWith(`-${local}`) || id.endsWith(local));
const num = (v: unknown) => Number(v) || 0;
const esNumero = (c: Crudo) => c.clase === 'grafico' && (c.tipo === 'numero' || c.tipo === 'numero_compacto' || c.tipo === 'numero_tendencia');

/**
 * Cierra el hueco de una pieza que se fue. En una FILA (piezas con el mismo `y` y el mismo `h`), los que quedan se reparten
 * las 12 columnas en su orden; si no, se compacta para arriba (lo mismo que hace la grilla del editor: react-grid-layout
 * compacta en vertical).
 */
export function cerrarHueco(comps: readonly Crudo[], ido: Crudo): Crudo[] {
  const y = num(ido.y); const h = num(ido.h);
  const fila = comps.filter((c) => num(c.y) === y && num(c.h) === h);
  const ocupaLaFila = comps.filter((c) => num(c.y) < y + h && num(c.y) + num(c.h) > y);
  let out = comps.map((c) => ({ ...c }));
  if (fila.length && fila.length === ocupaLaFila.length && fila.every((c) => esNumero(c) === esNumero(fila[0]))) {
    // Una fila pareja (los números de arriba, dos gráficos de media hoja): los que quedan llenan el ancho.
    const orden = [...fila].sort((a, b) => num(a.x) - num(b.x));
    const w = Math.floor(COLS / orden.length);
    const extra = COLS - w * orden.length;
    let x = 0;
    const lugar = new Map(orden.map((c, i) => { const ancho = w + (i < extra ? 1 : 0); const l = { x, w: ancho }; x += ancho; return [c.id, l] as const; }));
    out = out.map((c) => (lugar.has(c.id) ? { ...c, ...lugar.get(c.id)! } : c));
  } else {
    // Al lado de la que se fue (dentro de sus filas): los de su derecha se estiran a la izquierda y, si no hay, los de su
    // izquierda a la derecha. Sin esto queda un hueco a lo ancho que la compactación vertical no llena.
    const adentro = (c: Crudo) => num(c.y) >= y && num(c.y) + num(c.h) <= y + h;
    const derecha = out.filter((c) => adentro(c) && num(c.x) === num(ido.x) + num(ido.w));
    const izquierda = out.filter((c) => adentro(c) && num(c.x) + num(c.w) === num(ido.x));
    if (derecha.length) out = out.map((c) => (derecha.includes(c) ? { ...c, x: num(ido.x), w: num(c.w) + num(ido.w) } : c));
    else if (izquierda.length) out = out.map((c) => (izquierda.includes(c) ? { ...c, w: num(c.w) + num(ido.w) } : c));
  }
  return compactar(out);
}

/**
 * Cada pieza sube hasta donde no pisa a otra (en el orden de la hoja): sin huecos verticales.
 * ⚠️ POR POSICIÓN, no por id: una plantilla puede traer dos piezas con el mismo id local antes del saneo (la de «Funnel
 *    de llamadas» tiene la sección «cierre» y el número «cierre»), y un mapa por id les daba el mismo lugar.
 */
export function compactar(comps: readonly Crudo[]): Crudo[] {
  const orden = comps.map((c, i) => ({ c, i })).sort((a, b) => num(a.c.y) - num(b.c.y) || num(a.c.x) - num(b.c.x));
  const puestas: Crudo[] = [];
  const ys = new Array<number>(comps.length);
  const pisa = (a: Crudo, y: number) => puestas.some((b) => num(a.x) < num(b.x) + num(b.w) && num(b.x) < num(a.x) + num(a.w) && y < num(b.y) + num(b.h) && num(b.y) < y + num(a.h));
  for (const { c, i } of orden) {
    let y = num(c.y);
    while (y > 0 && !pisa(c, y - 1)) y--;
    puestas.push({ ...c, y });
    ys[i] = y;
  }
  return comps.map((c, i) => ({ ...c, y: ys[i] }));
}

/**
 * La hoja con su portada arriba. Pura sobre los componentes CRUDOS (antes del saneo), así vale para las plantillas
 * escritas a mano y para las que arma `acomodar`. Sin definición, la hoja tal cual.
 */
export function conPortada(hoja: Crudo, def: DefinicionPortada | undefined, color: string | undefined, id: Id): Crudo {
  const comps = Array.isArray(hoja.componentes) ? (hoja.componentes as Crudo[]) : [];
  if (!def || !color) return hoja;
  let resto = comps;
  let pieza: Crudo;
  if ('sube' in def) {
    const vieja = comps.find((c) => esLocal(c.id, def.sube));
    if (!vieja) return hoja;
    resto = cerrarHueco(comps.filter((c) => c !== vieja), vieja);
    pieza = { ...vieja, subtitulo: '', ...(def.cambios ?? {}) };
  } else {
    pieza = def.nueva(id);
  }
  return {
    ...hoja,
    componentes: [
      { ...pieza, x: 0, y: 0, w: COLS, h: ALTO_PORTADA, portada: color },
      ...resto.map((c) => ({ ...c, y: num(c.y) + ALTO_PORTADA })),
    ],
  };
}

/**
 * Los altos, en filas de la grilla: 168, 352 y 260 px. Corbel a 1440 mide 162, 354 y 258 (docs/diseno/tokens-corbel.json,
 * `composicion_de_pagina`). La fila de abajo sube a 8 con lo que no se lee en 260: un embudo, una tabla con filas, una matriz.
 */
export const ALTO_NUMEROS = 4;
export const ALTO_PROTAGONISTAS = 8;
export const ALTO_PAR = 6;
const ALTO_PAR_LARGO = 8;
const PIDE_ALTO: ReadonlySet<unknown> = new Set(['embudo_vertical', 'embudo_barras', 'embudo_columnas', 'tabla', 'tabla_barras', 'burbujas', 'dispersion', 'mapa']);
/** Lo que entra en un tercio de hoja, como la tarjeta negra de Corbel. Lo demás va a lo ancho, en vidrio y nunca en negro. */
const CABE_EN_UN_TERCIO: ReadonlySet<unknown> = new Set(['numero', 'numero_compacto', 'numero_tendencia', 'indicador', 'anillo', 'embudo_vertical', 'embudo_barras', 'embudo_columnas', 'barra_proporcion', 'barras']);
/** El gráfico que acompaña al negro si la plantilla no lo dice: el de una serie en el tiempo, como las columnas de Corbel. */
const ES_TENDENCIA: ReadonlySet<unknown> = new Set(['serie', 'columnas', 'area', 'lineas', 'combinado', 'combinado_apilado']);
/** Lo que no va en un par: necesita el ancho o mucho alto. */
const NO_VA_EN_PAR: ReadonlySet<unknown> = new Set(['mapa_calor', 'tarjetas', 'seccion', 'accion']);
const esGraficoGrande = (c: Crudo) => c.clase === 'grafico' && !esNumero(c) && c.tipo !== 'tabla';
const altoDelPar = (a: Crudo, b?: Crudo) => {
  // Un bloque de General ya dice lo que mide: estirarlo es el espacio en blanco del que Martín se quejó.
  const propio = [a, b].filter((c): c is Crudo => !!c && c.clase === 'elemento').map((c) => num(c.h));
  if (propio.length) return Math.max(...propio);
  return PIDE_ALTO.has(a.tipo) || (b && PIDE_ALTO.has(b.tipo)) ? ALTO_PAR_LARGO : ALTO_PAR;
};
/** Lo plegado, de arriba abajo y sin pisarse: llena cada fila hasta las 12 columnas. */
function apilar(comps: readonly Crudo[]): Crudo[] {
  let x = 0; let y = 0; let alto = 0;
  return [...comps].sort((a, b) => num(a.y) - num(b.y) || num(a.x) - num(b.x)).map((c) => {
    const w = Math.min(COLS, num(c.w) || COLS);
    if (x + w > COLS) { x = 0; y += alto; alto = 0; }
    const puesta = { ...c, x, y, w };
    x += w; alto = Math.max(alto, num(c.h));
    return puesta;
  });
}

/**
 * LA COMPOSICIÓN DE CORBEL (Martín, 31/10/2026: «No es necesario tener esa barra negra gigante como encabezado… Y lo mismo con
 * las cajas de abajo. Quiero todo nuevo… Guiate en lo que copiamos»). Medida a 1440: cinco bloques en tres filas.
 *   1 · cuatro números en fila;
 *   2 · la tarjeta negra en un tercio (4) y su gráfico (8). El negro NUNCA es un encabezado ni va a lo ancho: lo que no entra en un
 *       tercio va en vidrio;
 *   3 · dos piezas de 7 + 5.
 * Lo demás de la plantilla va en «Más detalle», plegado: nada se borra, y queda a la vista qué quedó afuera. Lo plegado sale de la
 * grilla (lib/graficos-secciones.ts). Los ids no cambian: el closer y la caja de IA buscan las piezas por id.
 * ⚠️ Corbel también tiene 5 + 7 a 1320 y todo a 12 a 1100. Acá no: el editor es UN `ReactGridLayout` de 12 columnas y por debajo
 *    de 640 la pila del celular. Entre 640 y 1320 se ve el acomodo de escritorio, más angosto.
 */
export function comoCorbel(hoja: Crudo, def: DefinicionPortada | undefined, color: string | undefined, id: Id): Crudo {
  const comps = Array.isArray(hoja.componentes) ? (hoja.componentes as Crudo[]) : [];
  if (!def || !color) return hoja;
  let resto = comps;
  let pieza: Crudo;
  // ⚠️ POR `id(local)` Y NO SÓLO POR EL NOMBRE: una hoja creada desde la galería (`instanciarPlantilla`) lleva ids nuevos, que no
  // terminan en el local. Sin esto, la miniatura mostraba una composición y la hoja creada salía con otra, sin error.
  const esEse = (c: Crudo, nombre: string) => c.id === id(nombre) || esLocal(c.id, nombre);
  if ('sube' in def) {
    const vieja = comps.find((c) => esEse(c, def.sube));
    if (!vieja) return hoja;
    resto = cerrarHueco(comps.filter((c) => c !== vieja), vieja);
    pieza = { ...vieja, subtitulo: '', ...(def.cambios ?? {}) };
  } else {
    pieza = def.nueva(id);
  }
  const porLugar = (a: Crudo, b: Crudo) => num(a.y) - num(b.y) || num(a.x) - num(b.x);
  // `cerrarHueco` devuelve copias: lo que se saca se busca en el `resto` de ese momento.
  const sacar = (c: Crudo) => {
    const actual = resto.find((x) => x.id === c.id && x.tipo === c.tipo);
    if (actual) resto = cerrarHueco(resto.filter((x) => x !== actual), actual);
  };
  const local = (nombre: string | undefined) => (nombre ? resto.find((c) => esEse(c, nombre)) : undefined);

  // 1 · Los números: la fila de arriba si tiene tres o más (la plantilla ya eligió), y si no, los primeros cuatro. La invertida abre
  // la fila, que es donde Corbel pone el negro.
  const todos = resto.filter(esNumero).sort(porLugar);
  const deArriba = todos.filter((c) => num(c.y) === num(todos[0]?.y));
  const numeros = (deArriba.length >= 3 ? deArriba : todos).slice(0, 4).sort((a, b) => Number(!!b.invertida) - Number(!!a.invertida));
  const n = numeros.length;
  const fila = numeros.map((c, i) => {
    sacar(c);
    return { ...c, x: Math.round((i * COLS) / n), y: 0, w: Math.round(((i + 1) * COLS) / n) - Math.round((i * COLS) / n), h: ALTO_NUMEROS, subtitulo: '' };
  });
  let y = fila.length ? ALTO_NUMEROS : 0;

  // 2 · El negro en un tercio, con su gráfico. Si no entra, a lo ancho y en vidrio: sin `portada`.
  const candidatos = resto.filter(esGraficoGrande).sort(porLugar);
  const vecino = CABE_EN_UN_TERCIO.has(pieza.tipo) ? local(def.vecino) ?? candidatos.find((c) => ES_TENDENCIA.has(c.tipo)) ?? candidatos[0] : undefined;
  if (vecino) sacar(vecino);
  const segunda: Crudo[] = vecino
    ? [{ ...pieza, x: 0, y, w: 4, h: ALTO_PROTAGONISTAS, portada: color }, { ...vecino, x: 4, y, w: 8, h: ALTO_PROTAGONISTAS }]
    : [{ ...pieza, x: 0, y, w: COLS, h: pieza.clase === 'elemento' ? num(pieza.h) || ALTO_PROTAGONISTAS : ALTO_PROTAGONISTAS }];
  y += num(segunda[0].h);

  // 3 · Dos de 7 + 5. La tabla va en las 7: en 5 se le corta el nombre.
  const elegibles = [...resto].sort(porLugar).filter((c) => !esNumero(c) && !NO_VA_EN_PAR.has(c.tipo));
  const pedidos = (def.par ?? []).map((nombre) => local(nombre)).filter((c): c is Crudo => !!c);
  // Dos bloques de General van de a par sólo si piden el mismo alto: estirar uno es el espacio en blanco del que Martín se quejó.
  const mismoAlto = (a: Crudo, b: Crudo) => a.clase !== 'elemento' && b.clase !== 'elemento' ? true : num(a.h) === num(b.h);
  let par = pedidos.length ? pedidos.slice(0, 2) : elegibles.slice(0, 1).concat(elegibles.slice(1).filter((c) => mismoAlto(elegibles[0], c)).slice(0, 1));
  if (par.length === 2 && par[1].tipo === 'tabla' && par[0].tipo !== 'tabla') par = [par[1], par[0]];
  par.forEach(sacar);
  const alto = par.length ? altoDelPar(par[0], par[1]) : 0;
  const tercera: Crudo[] = par.length === 2
    ? [{ ...par[0], x: 0, y, w: 7, h: alto, subtitulo: '' }, { ...par[1], x: 7, y, w: 5, h: alto, subtitulo: '' }]
    : par.map((c) => ({ ...c, x: 0, y, w: COLS, h: alto, subtitulo: '' }));
  y += alto;

  // Lo que no entró: plegado. Una sección plegable que ya traía la plantilla cierra su grupo sola; ésta abre el de abajo.
  const plegado = apilar(resto);
  const mas: Crudo[] = plegado.length
    ? [{ id: id(`${'sube' in def ? def.sube : String(pieza.id)}-mas-detalle`), clase: 'elemento', tipo: 'seccion', texto: 'Más detalle', seccion: { fondo: null, plegable: true, abierto: false }, x: 0, y, w: COLS, h: 1 }]
    : [];
  return { ...hoja, componentes: [...fila, ...segunda, ...tercera, ...mas, ...plegado.map((c) => ({ ...c, y: num(c.y) + y + 1 }))] };
}

/**
 * Las portadas del Dashboard, por plantilla. Lo que contesta cada una:
 *   · Marketing — ¿cuánto me cuesta un cliente? El CAC solo, gigante.
 *   · Comercial — ¿cuánto entró y cuánto falta? La barra cobrado / pendiente.
 *   · Ads Analyst — ¿qué anuncio funciona? Los ganadores como pósters, con su miniatura de Meta.
 *   · Landing — ¿qué miran y qué tocan? El mapa de calor: la página con el calor encima.
 *   · VSL Analyst — ¿dónde se van del video? La curva de retención.
 *   · Chat Analyst — ¿respondo rápido? El % respondido en 15 minutos, como un reloj.
 *   · Closing — ¿cuántas llamadas se ganan? R1 → R2 → ganadas, en columnas.
 *   · CS Analyst — ¿a quién atiendo? Las personas que piden atención.
 *   · Productividad — ¿cómo van mis proyectos? El avance de cada proyecto activo (la matriz, abajo: pide proyectos evaluados).
 *   · CRM — ¿dónde se me caen los leads? El embudo del lead al cierre.
 *   · Cobranza — ¿a quién le cobro? La lista con «Marcar cobrada».
 *   · Automatizaciones — ¿me contestan? Enviados → abiertos → respondieron.
 *   · Contenido e IA — ¿en qué se va la IA? El anillo con el costo en el centro.
 */
export function portadasDashboard(): Readonly<Record<string, DefinicionPortada>> {
  return {
    // Con su línea abajo: la tarjeta negra de Corbel nunca es un número solo en un rectángulo vacío.
    // Con su línea abajo: la tarjeta negra de Corbel nunca es un número solo en un rectángulo vacío.
    marketing: { sube: 'mk-cac', cambios: { titulo: 'Cada cliente te cuesta', comparar: true, tipo: 'numero_tendencia' }, vecino: 'mk-tendencias', par: ['mk-funnel', 'mk-edad'] },
    comercial: { sube: 'co-revenue-barra', cambios: { titulo: 'Lo que entró y lo que falta cobrar' }, vecino: 'co-tendencia', par: ['co-cobranza-tabla', 'co-funnel-embudo'] },
    'ads-analyst': { sube: 'ad-video', cambios: { titulo: 'Cuánto ven el video' }, vecino: 'ad-cuadrante-dispersion', par: ['ad-eficiencia', 'ad-gancho'] },
    landing: { sube: 'la-scroll', cambios: { titulo: 'Hasta dónde bajan' }, vecino: 'la-visitas-dia', par: ['la-clics', 'la-origen'] },
    'vsl-analyst': {
      nueva: (id) => ({ id: id('vs-mitad'), clase: 'grafico', tipo: 'indicador', fuente: 'retencion_vsl', metricas: ['tasa_50'], maximo: 100, titulo: 'Ven la mitad del video' }),
      vecino: 'vs-curva', par: ['vs-tramos', 'vs-videos'],
    },
    'chat-analyst': { sube: 'ch-rapidos', cambios: { tipo: 'indicador', maximo: 100, titulo: 'Respondes en 15 minutos' }, vecino: 'ch-por-dia', par: ['ch-setters', 'ch-lineas'] },
    closing: { sube: 'cl-embudo-embudo', cambios: { tipo: 'embudo_columnas', titulo: 'Cuántas llamadas se ganan' }, vecino: 'cl-factores-barras', par: ['cl-closers-tabla', 'cl-factores-ia'] },
    'cs-analyst': { sube: 'cs-etapas', cambios: { titulo: 'Dónde está cada cliente' }, vecino: 'cs-semanas', par: ['cs-tabla', 'cs-contacto'] },
    productividad: { sube: 'pr-piramide-barras', cambios: { titulo: 'Pirámide de prioridad' }, vecino: 'pr-avance-proyecto', par: ['pr-huele-mal', 'pr-matriz-burbujas'] },
    crm: { sube: 'embudo', cambios: { titulo: 'Dónde se caen tus leads' }, vecino: 'por-dia', par: ['etapas', 'perdidas'] },
    cobranza: { sube: 'por-funnel', cambios: { titulo: 'Pendiente por funnel' }, vecino: 'semanas', par: ['a-quien'] },
    automatizaciones: {
      nueva: (id) => ({
        id: id('automatizaciones-portada'), clase: 'grafico', tipo: 'embudo_barras', fuente: 'envios', metricas: ['envios', 'abiertos', 'respuestas'],
        titulo: '¿Te contestan?',
      }),
      vecino: 'por-dia', par: ['por-automatizacion', 'desenlace'],
    },
    'ia-contenido': {
      nueva: (id) => ({
        id: id('ia-contenido-portada'), clase: 'grafico', tipo: 'anillo', fuente: 'ia', dimension: 'funcion', metricas: ['costo'],
        ordenMetrica: 'costo', limite: 6, titulo: 'En qué se va la IA',
      }),
      vecino: 'por-dia', par: ['funciones', 'quien'],
    },
  };
}

/** El color de la portada de una plantilla del Dashboard. */
export const colorDashboard = (plantilla: string): string | undefined => COLOR_DASHBOARD[plantilla];
