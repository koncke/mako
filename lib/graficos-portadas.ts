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
import { accionElementoDe } from './graficos-acciones';

type Crudo = Record<string, unknown>;
type Id = (local: string) => string;

/** El alto de la portada (filas de la grilla): casi toda la miniatura de la galería (16:10) y medio escritorio. */
export const ALTO_PORTADA = 11;
const COLS = 12;

/** La portada de una plantilla: una pieza que ya tenía (`sube`, por su id local) o una nueva. */
export type DefinicionPortada =
  | ({ sube: string; cambios?: Crudo } & Composicion)
  | ({ nueva: (id: Id) => Crudo } & Composicion);
/** Lo que se pide por su id local: el gráfico principal (`vecino`) y los paneles que van primero (`par`). Sin decirlo, los elige el orden. */
type Composicion = { vecino?: string; par?: readonly string[]; molde?: NombreMolde };

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
 * Los altos, en filas de la grilla: 168, 352 y 306 px. Medidos a 1440 en Wharf y Ledge (docs/diseno/densidad-codeandchill.json).
 */
export const ALTO_NUMEROS = 4;
export const ALTO_PROTAGONISTA = 8;
export const ALTO_MEDIANO = 7;
const ALTO_ANCHO = 9;
/** El gráfico principal, si la plantilla no lo dice: el de una serie en el tiempo, como el Revenue de Wharf. */
const ES_TENDENCIA: ReadonlySet<unknown> = new Set(['serie', 'columnas', 'area', 'lineas', 'combinado', 'combinado_apilado']);
/** Lo que necesita el ancho: en un tercio se le cortan las columnas, o no se lee. */
const VA_A_LO_ANCHO: ReadonlySet<unknown> = new Set(['tabla', 'tarjetas', 'mapa', 'mapa_calor']);

/**
 * LAS ESTRUCTURAS QUE COPIAMOS (Martín, 1/11/2026: «Todos los templates son iguales, no uses siempre el mismo... no me gusta que no haya
 * variedad, si copiamos muchos templates»). Cada plantilla toma la de una referencia, elegida por lo que mide: la asignación y su porqué
 * están en docs/diseno/densidad-codeandchill.json. Lo compartido son los tokens, la letra y lo que significan los colores; la forma no.
 * Cada paso es una fila que llena las 12 columnas con lo que haya; lo que no entró sigue abajo, de a tres.
 *   · `p+2x2`  el principal (6) y cuatro números de a dos (3 + 3).
 *   · `p+mm`   el principal (6) y dos paneles chicos (3 + 3).
 *   · `p8+m`   el principal (8) y un panel al lado (4).
 *   · `m+p8`   un panel (4) y el principal (8).
 *   · `p12`    el principal a lo ancho.
 *   · `n`      hasta cuatro números en fila.
 *   · `n2x2`   cuatro números anchos y bajos, de a dos (6 + 6).
 *   · `mmm`, `m84`, `m75`, `m66`  paneles.
 *   · `a`      lo que necesita el ancho.
 * ⚠️ Ninguna abre con el principal a lo ancho, aunque seis de las medidas lo hacen (Merrin, Wynlo, Kerfa, Coffra, Corvane, Kinlo): Martín
 *    rechazó «el bloque gigante primero». Por eso esas no están acá.
 */
type PasoMolde = 'p+2x2' | 'p+mm' | 'p8+m' | 'm+p8' | 'p12' | 'n' | 'n2x2' | 'mmm' | 'm84' | 'm75' | 'm66' | 'a';
export const MOLDES = {
  wharf: ['p+2x2', 'mmm', 'a'],
  ledge: ['p+2x2', 'm84', 'mmm'],
  prism: ['p+mm', 'n', 'mmm', 'mmm', 'm75'],
  tilvo: ['p8+m', 'n2x2', 'a', 'm66', 'm84'],
  moorly: ['n2x2', 'p12', 'm66', 'm66', 'm66'],
  corbel: ['n', 'm+p8', 'm75', 'mmm'],
} as const satisfies Readonly<Record<string, readonly PasoMolde[]>>;
export type NombreMolde = keyof typeof MOLDES;
/** Un número ancho y bajo (`n2x2`): 122 px, los 124 a 133 de Tilvo, Coffra, Ledra y Moorly. */
const ALTO_NUMERO_BAJO = 3;
/** La oración de apertura: dos renglones de frase con su título arriba. */
export const ALTO_FRASE = 3;

/**
 * Arma la hoja con su molde. Los títulos de sección no van: en la referencia el título vive en la tarjeta. Los ids no cambian: el closer y
 * la caja de IA buscan las piezas por id. Las hojas GUARDADAS no pasan por acá.
 * ⚠️ Lo que antes se plegaba en «Más detalle» (31/10) va a la vista: Martín autorizó rehacer el catálogo y los referentes tienen de 9 a 12.
 */
export function comoDenso(hoja: Crudo, def: DefinicionPortada | undefined, id: Id): Crudo {
  const comps = (Array.isArray(hoja.componentes) ? (hoja.componentes as Crudo[]) : []).filter((c) => c.tipo !== 'seccion');
  // ⚠️ POR `id(local)` Y NO SÓLO POR EL NOMBRE: una hoja creada desde la galería (`instanciarPlantilla`) lleva ids nuevos, que no
  // terminan en el local. Sin esto, la miniatura mostraba una composición y la hoja creada salía con otra, sin error.
  const esEse = (c: Crudo, nombre: string) => c.id === id(nombre) || esLocal(c.id, nombre);
  const porLugar = (a: Crudo, b: Crudo) => num(a.y) - num(b.y) || num(a.x) - num(b.x);
  const vieja = def && 'sube' in def ? comps.find((c) => esEse(c, def.sube)) : undefined;
  const pieza: Crudo | undefined = def && 'sube' in def ? (vieja && { ...vieja, ...(def.cambios ?? {}) }) : def?.nueva(id);
  const todas = [...(pieza ? [pieza] : []), ...comps.filter((c) => c !== vieja).sort(porLugar)];
  // LA ACCIÓN QUE ES LA HOJA (`arriba`, lib/graficos-acciones.ts: «Grabar llamada» en Cold Calling) va PRIMERA, como una tarjeta más de
  // la fila de números (nunca a lo ancho: Martín rechazó «el bloque gigante primero»). Los demás botones sueltos (Sincronizar llamadas)
  // siguen al pie.
  const esArriba = (c: Crudo) => c.tipo === 'accion' && !!accionElementoDe((c.accion as { id?: string } | undefined)?.id)?.arriba;
  const deArriba = todas.filter(esArriba);
  const sueltos = todas.filter((c) => c.tipo === 'accion' && !esArriba(c));
  // LA ORACIÓN DE APERTURA (tipo `frase`, lib/graficos-frase.ts) abre la hoja, a lo ancho y antes del molde: así abren las
  // referencias (Orvel, Pane, Noria: la frase primero, el primer panel después). No compite por ser el principal.
  const frases = todas.filter((c) => c.tipo === 'frase');
  const lista = todas.filter((c) => c.tipo !== 'accion' && c.tipo !== 'frase');

  // Los números: la que la plantilla dio vuelta abre, que es donde va el negro.
  const numeros = [...deArriba, ...lista.filter(esNumero).sort((a, b) => Number(!!b.invertida) - Number(!!a.invertida))];
  const otros = lista.filter((c) => !esNumero(c));
  const nombrado = def?.vecino ? otros.find((c) => esEse(c, def.vecino!)) : undefined;
  const elegibles = otros.filter((c) => !VA_A_LO_ANCHO.has(c.tipo));
  const principal = nombrado ?? elegibles.find((c) => ES_TENDENCIA.has(c.tipo)) ?? elegibles[0] ?? otros[0];
  const sinPrincipal = otros.filter((c) => c !== principal);
  const nombrados = (def?.par ?? []).map((n) => sinPrincipal.find((c) => esEse(c, n))).filter((c): c is Crudo => !!c);
  const medianos = [...nombrados, ...sinPrincipal.filter((c) => !nombrados.includes(c))].filter((c) => !VA_A_LO_ANCHO.has(c.tipo));
  const anchos = sinPrincipal.filter((c) => VA_A_LO_ANCHO.has(c.tipo));

  const puestas: Crudo[] = [];
  // El subtítulo de la plantilla se queda en los paneles (4/11/2026, docs/templates-dashboard-propuesta.md §1.3: «cada bloque
  // tiene título Y un subtítulo en castellano llano»). En un número no: le comería el alto, y su definición va en el título.
  const poner = (c: Crudo, x: number, y: number, w: number, h: number) =>
    puestas.push({ ...c, x, y, w, h, subtitulo: esNumero(c) || typeof c.subtitulo !== 'string' ? '' : c.subtitulo });
  let y = 0;
  for (const f of frases) { poner(f, 0, y, COLS, ALTO_FRASE); y += ALTO_FRASE; }
  let conPrincipal: Crudo | undefined = principal;
  const tomarPrincipal = () => { const c = conPrincipal; conPrincipal = undefined; return c; };
  /** Una fila de paneles: toma hasta `anchos` y reparte las 12 columnas entre los que haya. */
  const filaDe = (columnas: readonly number[], h: number) => {
    const lote = medianos.splice(0, columnas.length);
    if (!lote.length) return;
    let x = 0;
    lote.forEach((c, i) => {
      const w = lote.length === columnas.length ? columnas[i] : Math.round(COLS / lote.length);
      poner(c, x, y, w, h);
      x += w;
    });
    y += h;
  };
  const filaDeNumeros = (cuantos: number) => {
    const lote = numeros.splice(0, cuantos);
    lote.forEach((c, i) => {
      const x = Math.round((i * COLS) / lote.length);
      poner(c, x, y, Math.round(((i + 1) * COLS) / lote.length) - x, ALTO_NUMEROS);
    });
    if (lote.length) y += ALTO_NUMEROS;
  };
  /** El principal de 6 con dos pisos al lado, cada uno de 3 + 3. */
  const conPisos = (al: readonly Crudo[]) => {
    const p = tomarPrincipal();
    const desde = p ? 6 : 0;
    const ancho = (COLS - desde) / 2;
    if (p) poner(p, 0, y, al.length ? 6 : COLS, ALTO_PROTAGONISTA);
    if (al.length === 1) poner(al[0], desde, y, COLS - desde, ALTO_PROTAGONISTA);
    else if (al.length === 2) al.forEach((c, i) => poner(c, desde + i * ancho, y, ancho, ALTO_PROTAGONISTA));
    else if (al.length === 3) {
      poner(al[0], desde, y, ancho, ALTO_NUMEROS);
      poner(al[1], desde + ancho, y, ancho, ALTO_NUMEROS);
      poner(al[2], desde, y + ALTO_NUMEROS, ancho * 2, ALTO_NUMEROS);
    } else al.forEach((c, i) => poner(c, desde + (i % 2) * ancho, y + Math.floor(i / 2) * ALTO_NUMEROS, ancho, ALTO_NUMEROS));
    if (p || al.length) y += ALTO_PROTAGONISTA;
  };
  const pasos: Readonly<Record<PasoMolde, () => void>> = {
    'p+2x2': () => conPisos(numeros.splice(0, 4)),
    'p+mm': () => conPisos(medianos.splice(0, 2)),
    'p8+m': () => {
      const p = tomarPrincipal();
      const [m] = medianos.splice(0, 1);
      if (p) poner(p, 0, y, m ? 8 : COLS, ALTO_PROTAGONISTA);
      if (m) poner(m, p ? 8 : 0, y, p ? 4 : COLS, ALTO_PROTAGONISTA);
      if (p || m) y += ALTO_PROTAGONISTA;
    },
    'm+p8': () => {
      const p = tomarPrincipal();
      const [m] = medianos.splice(0, 1);
      if (m) poner(m, 0, y, p ? 4 : COLS, ALTO_PROTAGONISTA);
      if (p) poner(p, m ? 4 : 0, y, m ? 8 : COLS, ALTO_PROTAGONISTA);
      if (p || m) y += ALTO_PROTAGONISTA;
    },
    p12: () => {
      const p = tomarPrincipal();
      if (p) { poner(p, 0, y, COLS, ALTO_ANCHO); y += ALTO_ANCHO; }
    },
    n: () => filaDeNumeros(4),
    n2x2: () => {
      const lote = numeros.splice(0, 4);
      lote.forEach((c, i) => {
        const solo = lote.length % 2 === 1 && i === lote.length - 1;
        poner(c, (i % 2) * 6, y + Math.floor(i / 2) * ALTO_NUMERO_BAJO, solo ? COLS : 6, ALTO_NUMERO_BAJO);
      });
      y += Math.ceil(lote.length / 2) * ALTO_NUMERO_BAJO;
    },
    mmm: () => filaDe([4, 4, 4], ALTO_MEDIANO),
    m84: () => {
      // Una tabla se lee en las 8.
      const i = anchos.findIndex((c) => c.tipo !== 'mapa_calor');
      if (i < 0 || !medianos.length) { filaDe([8, 4], ALTO_PROTAGONISTA); return; }
      const [c] = anchos.splice(i, 1);
      const h = Math.max(ALTO_PROTAGONISTA, altoDeAncho(c));
      poner(c, 0, y, 8, h);
      poner(medianos.shift()!, 8, y, 4, h);
      y += h;
    },
    m75: () => filaDe([7, 5], ALTO_MEDIANO),
    m66: () => filaDe([6, 6], ALTO_MEDIANO),
    a: () => {
      // El mapa de calor mide 24 filas: va al final, no entre los paneles.
      const i = anchos.findIndex((x) => x.tipo !== 'mapa_calor');
      if (i < 0) return;
      const [c] = anchos.splice(i, 1);
      const h = altoDeAncho(c);
      poner(c, 0, y, COLS, h);
      y += h;
    },
  };
  for (const paso of MOLDES[def?.molde ?? 'wharf']) pasos[paso]();

  // Lo que no entró en el molde: el principal si nadie lo pidió, y el resto de a tres.
  if (conPrincipal) pasos.p12();
  while (numeros.length) filaDeNumeros(4);
  while (medianos.length >= 3) pasos.mmm();
  if (medianos.length === 2) pasos.m84();
  if (medianos.length === 1 && anchos.length) {
    // Uno suelto va al lado de la primera tabla.
    const c = anchos.shift()!;
    const h = Math.max(ALTO_PROTAGONISTA, altoDeAncho(c));
    poner(c, 0, y, 8, h);
    poner(medianos.shift()!, 8, y, 4, h);
    y += h;
  } else if (medianos.length === 1) filaDe([COLS], ALTO_MEDIANO);
  while (anchos.some((c) => c.tipo !== 'mapa_calor')) pasos.a();
  for (const c of anchos.splice(0)) { poner(c, 0, y, COLS, altoDeAncho(c)); y += altoDeAncho(c); }
  sueltos.forEach((c, i) => poner(c, i * 3, y, 3, num(c.h) || 2));
  return { ...hoja, componentes: puestas };
}

/** El alto de lo que va a lo ancho: el mapa de calor pide el suyo, y lo demás entre 8 y 12. */
const altoDeAncho = (c: Crudo) => (c.tipo === 'mapa_calor' ? num(c.h) || ALTO_ANCHO : Math.max(ALTO_PROTAGONISTA, Math.min(num(c.h) || ALTO_ANCHO, 12)));

/**
 * Las portadas del Dashboard, por plantilla. Lo que contesta cada una:
 *   · Marketing — ¿cuánto me cuesta un cliente? El CAC solo, gigante.
 *   · Comercial — ¿convierte, y a qué costo? La tendencia con los cuatro números de la conversión al lado.
 *   · Ads Analyst — ¿qué anuncio funciona? Los ganadores como pósters, con su miniatura de Meta.
 *   · Landing — ¿qué miran y qué tocan? El mapa de calor: la página con el calor encima.
 *   · VSL Analyst — ¿dónde se van del video? La curva de retención.
 *   · Chat Analyst — ¿respondo rápido? El % respondido en 15 minutos, como un reloj.
 *   · Closing — ¿cuántas llamadas se ganan? R1 → R2 → ganadas, en columnas.
 *   · CS Analyst — ¿a quién atiendo? Las personas que piden atención.
 *   · Productividad — ¿cómo van mis proyectos? El avance de cada proyecto activo (la matriz, abajo: pide proyectos evaluados).
 *   · Cobranza — ¿qué plata está prometida y no entró? Lo que entra por semana, con los cuatro números al lado.
 *   · Automatizaciones — ¿me contestan? Enviados → abiertos → respondieron.
 *   · Contenido e IA — ¿en qué se va la IA? El anillo con el costo en el centro.
 *   · Cold Calling — ¿cuántas contestan y cuántas agendan? El botón de grabar arriba y el anillo de cómo terminan.
 */
export function portadasDashboard(): Readonly<Record<string, DefinicionPortada>> {
  return {
    // Con su línea abajo: la tarjeta negra de Corbel nunca es un número solo en un rectángulo vacío.
    // Con su línea abajo: la tarjeta negra de Corbel nunca es un número solo en un rectángulo vacío.
    marketing: { molde: 'prism', sube: 'mk-tendencias', vecino: 'mk-tendencias', par: ['mk-funnel', 'mk-plataforma'] },
    comercial: { molde: 'ledge', sube: 'co-tendencia', vecino: 'co-tendencia', par: ['co-funnel-embudo', 'co-motivos', 'co-por-oferta', 'co-origen'] },
    'ads-analyst': { molde: 'prism', sube: 'ad-cuadrante-dispersion', vecino: 'ad-cuadrante-dispersion', par: ['ad-veredicto', 'ad-confianza'] },
    'hooks-retencion': { molde: 'tilvo', sube: 'hk-video', vecino: 'hk-video', par: ['hk-gancho', 'hk-formato-cta', 'hk-avatar', 'hk-semana', 'hk-ia'] },
    landing: { molde: 'tilvo', sube: 'la-scroll', cambios: { titulo: 'Hasta dónde bajan' }, vecino: 'la-visitas-dia', par: ['la-clics', 'la-origen'] },
    'vsl-analyst': {
      molde: 'corbel', nueva: (id) => ({ id: id('vs-mitad'), clase: 'grafico', tipo: 'indicador', fuente: 'retencion_vsl', metricas: ['tasa_50'], maximo: 100, titulo: 'Ven la mitad del video' }),
      vecino: 'vs-curva', par: ['vs-mitad', 'vs-tramos', 'vs-videos'],
    },
    'chat-analyst': { molde: 'corbel', sube: 'ch-rapidos', cambios: { tipo: 'indicador', maximo: 100, titulo: 'Respondes en 15 minutos' }, vecino: 'ch-por-dia', par: ['ch-rapidos', 'ch-setters', 'ch-lineas'] },
    closing: { molde: 'wharf', sube: 'cl-embudo-embudo', cambios: { tipo: 'embudo_columnas', titulo: 'Cuántas llamadas se ganan' }, vecino: 'cl-factores-barras', par: ['cl-factores-ia', 'cl-embudo-embudo', 'cl-resultado'] },
    'cs-analyst': { molde: 'moorly', sube: 'cs-etapas', cambios: { titulo: 'Dónde está cada cliente' }, vecino: 'cs-tabla', par: ['cs-motivos', 'cs-senal', 'cs-contacto', 'cs-etapas', 'cs-semanas', 'cs-ia'] },
    productividad: { molde: 'moorly', sube: 'pr-piramide-barras', cambios: { titulo: 'Pirámide de prioridad' }, vecino: 'pr-avance-proyecto', par: ['pr-huele-mal', 'pr-matriz-burbujas'] },
    cobranza: { molde: 'wharf', sube: 'semanas', vecino: 'semanas', par: ['urgencia', 'barra', 'por-funnel'] },
    automatizaciones: {
      molde: 'ledge', nueva: (id) => ({
        id: id('automatizaciones-portada'), clase: 'grafico', tipo: 'embudo_barras', fuente: 'envios', metricas: ['envios', 'abiertos', 'respuestas'],
        titulo: '¿Te contestan?',
      }),
      vecino: 'por-dia', par: ['por-automatizacion', 'automatizaciones-portada', 'desenlace', 'donde-fallo', 'horas'],
    },
    inmobiliaria: { molde: 'wharf', sube: 'por-semana', vecino: 'por-semana', par: ['por-proyecto', 'origen', 'etapa', 'motivos'] },
    'ia-contenido': {
      molde: 'corbel', nueva: (id) => ({
        id: id('ia-contenido-portada'), clase: 'grafico', tipo: 'anillo', fuente: 'ia', dimension: 'funcion', metricas: ['costo'],
        ordenMetrica: 'costo', limite: 6, titulo: 'En qué se va la IA',
      }),
      vecino: 'por-dia', par: ['ia-contenido-portada', 'funciones', 'modelos', 'quien'],
    },
    // Cold Calling (04/11/2026): ¿cuántas contestan? «Grabar llamada» y los tres números de a dos (Moorly), las llamadas por día a lo
    // ancho, y cómo terminan al lado de quién llamó. El botón entra como la primera tarjeta (`arriba` en lib/graficos-acciones.ts).
    'cold-calling': { molde: 'moorly', sube: 'como-terminan', vecino: 'por-dia', par: ['como-terminan', 'quien'] },
  };
}

/** El color de la portada de una plantilla del Dashboard. */
export const colorDashboard = (plantilla: string): string | undefined => COLOR_DASHBOARD[plantilla];
