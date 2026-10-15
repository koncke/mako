// =============================================================================
// graficos-gordo — el GROSOR, la LETRA y las ETIQUETAS de todos los gráficos del Dashboard
// =============================================================================
// Martín, 11/10/2026 (punto 13): los gráficos tienen que ser «gordos» — trazos y barras anchas, letra que se
// lea, y los números sin pisarse. Hasta acá cada tipo escribía sus números a mano en app/dashboard/Grafico.tsx
// (16 tamaños de letra por debajo de 13 px, ejes de 11,5 en mono gris tenue, etiquetas de 10,5 sin halo en
// CADA punto) y el tema de la hoja sólo decidía el trazo. Ahora el sistema vive acá y lo mandan todos los
// tipos; las plantillas de estilo (lib/graficos-temas.ts) siguen eligiendo tarjeta, paleta, letra, leyenda y
// cuadrícula, pero NINGUNA puede bajar estos pisos.
//
// Puro y sin `server-only`: lo leen la pantalla (app/dashboard/Grafico.tsx y ./graficos), el tema y los tests.
//
// Lo que no se ve en los números:
//   · El diagnóstico obvio de «las etiquetas quedan detrás de las líneas» era el EQUIVOCADO: recharts 3.8.1
//     ya dibuja LabelList encima (zIndex 2000 contra 400). Lo que fallaba era la DENSIDAD: ~120 etiquetas de
//     10,5 px en Tendencias, sin halo, cruzadas por las otras series. Por eso hay una regla de no pisar
//     (`etiquetasQueEntran`) y un halo del color de la tarjeta, no un zIndex.
//   · Una etiqueta va en TINTA, nunca en el color de su serie: 6 de los 8 colores de la paleta dan menos de
//     4,5:1 como texto sobre blanco, y los 8 sobre la superficie oscura (medido el 11/10/2026).
//   · Dos formatos en un mismo lienzo (USD a la izquierda, conteos a la derecha) hacen que las líneas se
//     crucen sin significado: nunca dos ejes Y. Con dos formatos, o tres métricas, PANELES (`usaPaneles`).
//     Es una regla CALCULADA, sin campo nuevo: así le llega también al informe ya guardado.
//   · En SVG van NÚMEROS: un `var()` en un atributo SVG no está garantizado (docs/hallazgos-graficos.md). Los
//     tokens `--fs-*` son para el HTML (tablas, KPI, tarjetas).

import type { Formato } from './graficos-constructores';

// ── Los pisos ────────────────────────────────────────────────────────────────────────────

/** Ninguna letra que se dibuje en un gráfico baja de esto. */
export const LETRA_MINIMA = 13;
/** Las letras del sistema, en px (los números van al SVG; el HTML usa además los tokens --fs-*). */
export const LETRA = {
  tick: 13,
  leyenda: 14,
  tooltip: 14,
  tooltipRotulo: 13,
  etiqueta: 15,
  categoria: 15,
  kpiRotulo: 13,
  panelNombre: 14,
  panelNumero: 28,
  celda: 14,
  celdaFuerte: 15,
  cabecera: 13,
  cuadrante: 13,
} as const;
/** La etiqueta de un valor: 15 px, 600, en tinta y con un halo del color de la tarjeta. */
export const ETIQUETA = { tam: 15, peso: 600, halo: 4, alto: 21, aire: 8, separacion: 6 } as const;
/** El trazo de una línea: el del tema, acotado. Con extremos y uniones redondeados. */
export const TRAZO = { min: 3.5, max: 5, base: 4 } as const;
export const RADIO_BARRA_MIN = 6;
export const BARRA = { maxVertical: 56, separacion: '22%', horizontal: 26, radioHorizontal: 8 } as const;
export const PUNTOS = { todosHasta: 12, r: 5, borde: 3, ultimo: 6, activo: 8 } as const;
/** Arriba, lugar para una etiqueta; a los costados, lo justo. */
export const MARGEN = { top: 20, right: 12, bottom: 4, left: 4 } as const;
export const EJES = { maxMarcasX: 5, minGapX: 48, marcasY: 3 } as const;
/** Por debajo de este alto útil se esconden los ejes; por debajo del segundo, queda sólo el número grande. */
export const ALTO_SIN_EJES = 120;
export const ALTO_SOLO_NUMERO = 80;
/** Cuántas etiquetas de valor como mucho en un gráfico de series. */
export const TOPE_ETIQUETAS = 6;

/** El trazo que se dibuja: el de la plantilla, entre 3,5 y 5. */
export function trazoDe(t: number): number {
  if (!Number.isFinite(t)) return TRAZO.base;
  return Math.min(TRAZO.max, Math.max(TRAZO.min, t));
}
/** El radio de una barra: el de la plantilla, nunca menos de 6. */
export function radioDe(r: number): number {
  return Math.max(RADIO_BARRA_MIN, Number.isFinite(r) ? r : 0);
}

/** Cada cuántas categorías una marca en X, para que entren como mucho cinco. */
export function intervaloX(n: number): number {
  return Math.max(0, Math.ceil(Math.max(0, n) / EJES.maxMarcasX) - 1);
}
/**
 * Cada cuántas etiquetas una marca en X para que ENTREN sin pisarse en `ancho` px (el ancho del eje). `tope`: como mucho
 * tantas marcas (una serie de tiempo: cinco); con `null`, todas las que entren (las categorías: cada barra es una cosa
 * distinta, y saltear su nombre deja barras que no se sabe qué son). Medido en el arnés del 14/10/2026: con
 * `intervaloX` solo, un histograma en el celular encimaba «US$59–US$97US$135–US$174» y una columna de 12 categorías
 * nombraba una de cada tres.
 */
export function intervaloPorAncho(etiquetas: readonly string[], ancho: number, tope: number | null = EJES.maxMarcasX): number {
  const n = etiquetas.length;
  if (n <= 1) return 0;
  const porTope = tope ? Math.ceil(n / tope) - 1 : 0;
  if (!(ancho > 0)) return Math.max(0, porTope);
  const largo = Math.max(0, ...etiquetas.map((e) => anchoTexto(e))) + 14;
  return Math.max(0, porTope, Math.ceil((largo * n) / ancho) - 1);
}
/**
 * La escala ÉPICA (Martín, 14/10/2026: «Quiero el mismo criterio de EPICIDAD en los dashboards… Que se rediseñe todo», sobre
 * el teléfono: «pocas cosas, textos gigantes, bloques grandes»). El número protagonista de una tarjeta se mide contra la
 * TARJETA, no en px fijos: crece con el bloque y en el celular baja solo. Es UNA escala para el Dashboard y para General
 * (acordada con ese chat): se importa, no se copia.
 *   · protagonista: clamp(minimo, cqi × ancho, maximo), y además que entren sus letras y que no pase del alto libre;
 *   · chip de la comparación y métrica secundaria: una fracción del protagonista, con piso y techo;
 *   · rótulo (el título de una KPI): 15 px. Nada por debajo de LETRA_MINIMA.
 */
export const ESCALA_EPICA = {
  minimo: 40, cqi: 0.22, maximo: 128,
  /** Ancho medio de una cifra en la letra de la casa, en em (tabular). */
  letra: 0.58,
  /** Qué parte del alto que le QUEDA al número (lo de la tarjeta menos su título, su chip y su métrica chica) puede ocupar. */
  alto: 0.85,
  chip: 0.2, chipMax: 22,
  secundaria: 0.42, secundariaMin: 15, secundariaMax: 40,
  rotulo: 15,
  /** El peso y el tracking del protagonista: los del teléfono aprobado (v3: 40/800, −0,04em). Con 600 un número grande se lee flojo. */
  peso: 800, tracking: '-0.04em',
  /** Una cifra de 800 es más ancha que una de 600: el tope por letras usa esto en vez de `letra`. */
  letraGruesa: 0.62,
} as const;

/**
 * El tamaño del número protagonista en una tarjeta de `ancho` px (el ancho de su contenido), con `letras` caracteres y
 * `altoLibre` px para él (0 = sin tope de alto). Nunca más ancho que la tarjeta: el tope por letras gana sobre el mínimo.
 */
export function tamProtagonista(ancho: number, letras: number, altoLibre = 0): number {
  if (!(ancho > 0)) return ESCALA_EPICA.minimo;
  const e = ESCALA_EPICA;
  let t = Math.min(e.maximo, Math.max(e.minimo, e.cqi * ancho));
  t = Math.min(t, ancho / (Math.max(2, letras) * e.letraGruesa));
  if (altoLibre > 0) t = Math.min(t, altoLibre * e.alto);
  return Math.max(LETRA_MINIMA, Math.floor(t));
}
/** El chip de la comparación y la métrica chica, en proporción al protagonista. */
export const tamChip = (protagonista: number) => Math.max(LETRA_MINIMA, Math.min(ESCALA_EPICA.chipMax, Math.round(protagonista * ESCALA_EPICA.chip)));
export const tamSecundaria = (protagonista: number) => Math.max(ESCALA_EPICA.secundariaMin, Math.min(ESCALA_EPICA.secundariaMax, Math.round(protagonista * ESCALA_EPICA.secundaria)));
/** El ancho aproximado de un texto en la letra del sistema (sin medir el DOM: alcanza para decidir). */
export function anchoTexto(texto: string, tam: number = LETRA.tick): number {
  return 0.6 * tam * [...texto].length;
}
/** El ancho del eje Y por su texto más largo, en vez de 72 px fijos. */
export function anchoEjeY(textos: readonly string[]): number {
  const largo = Math.max(1, ...textos.map((t) => [...t].length));
  return Math.min(96, Math.max(28, Math.ceil(0.6 * LETRA.tick * largo + 10)));
}
export type ModoAlto = 'completo' | 'sinEjes' | 'soloNumero';
export function modoPorAlto(alto: number): ModoAlto {
  if (alto < ALTO_SOLO_NUMERO) return 'soloNumero';
  if (alto < ALTO_SIN_EJES) return 'sinEjes';
  return 'completo';
}
/** Con pocos puntos, todos; con muchos, sólo el último. */
export function puntosVisibles(n: number): 'todos' | 'ultimo' {
  return n <= PUNTOS.todosHasta ? 'todos' : 'ultimo';
}

// ── Paneles ──────────────────────────────────────────────────────────────────────────────

const LINEAS = new Set(['serie', 'serie_suave', 'lineas', 'lineas_suaves', 'area']);
const BARRAS_SUELTAS = new Set(['columnas', 'barras']);

/**
 * ¿Este gráfico se dibuja en PANELES (uno chico por métrica, como la Tendencias vieja que Martín aprobó)?
 * Las líneas y el área sola: con dos formatos o con tres métricas. Columnas y barras sueltas: con dos
 * formatos (las del mismo formato se leen bien agrupadas). Nunca con un desglose: ahí las series son
 * categorías de UNA métrica y se comparan superpuestas. Lo apilado tampoco: partirlo rompe la pila.
 */
export function usaPaneles(tipo: string, formatos: readonly Formato[], conDesglose: boolean): boolean {
  if (conDesglose || formatos.length < 2) return false;
  const distintos = new Set(formatos).size;
  if (LINEAS.has(tipo)) return distintos >= 2 || formatos.length >= 3;
  if (BARRAS_SUELTAS.has(tipo)) return distintos >= 2;
  return false;
}

// ── Las etiquetas que entran ─────────────────────────────────────────────────────────────

export type Area = { x: number; y: number; width: number; height: number };
export type Caja = { x: number; y: number; w: number; h: number };
/**
 * Un candidato a etiqueta: el punto (en px del gráfico) al que se refiere, su texto y su prioridad (1 es
 * la más importante). `lado`: arriba del punto (series, columnas), a la derecha (barras horizontales) o
 * centrada (adentro de un segmento).
 */
export type Candidato = { id: string; x: number; y: number; texto: string; prioridad: number; valor: number; serie?: string; lado?: 'arriba' | 'derecha' | 'centro' };
export type EtiquetaPuesta = Candidato & { caja: Caja };

export const cajaVacia = (c: Caja) => c.w <= 0 || c.h <= 0;
/** ¿Se tocan dos cajas? (con un píxel de aire: dos etiquetas pegadas se leen como una). */
export function seCruzan(a: Caja, b: Caja): boolean {
  return a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1;
}
const adentro = (c: Caja, a: Area) => c.x >= a.x - 0.5 && c.y >= a.y - 0.5 && c.x + c.w <= a.x + a.width + 0.5 && c.y + c.h <= a.y + a.height + 0.5;

/** Dónde iría la caja de un candidato: arriba del punto (o abajo si no entra), corrida para no salirse a los costados. */
export function cajaDe(c: Candidato, area: Area): Caja {
  const w = anchoTexto(c.texto, ETIQUETA.tam) + ETIQUETA.aire;
  const h = ETIQUETA.alto;
  const izq = area.x, der = area.x + area.width;
  const meter = (x: number) => Math.min(Math.max(x, izq), der - w);
  if (c.lado === 'derecha') {
    const afuera = c.x + ETIQUETA.separacion;
    // Si no entra después de la barra, va adentro del final de la barra (con el halo se lee igual).
    const x = afuera + w <= der ? afuera : c.x - ETIQUETA.separacion - w;
    return { x: Math.max(izq, x), y: c.y - h / 2, w, h };
  }
  if (c.lado === 'centro') return { x: meter(c.x - w / 2), y: c.y - h / 2, w, h };
  const arriba = c.y - ETIQUETA.separacion - h;
  const y = arriba >= area.y ? arriba : c.y + ETIQUETA.separacion;
  return { x: meter(c.x - w / 2), y, w, h };
}

/**
 * LA REGLA DE NO PISAR. Voraz por prioridad (y, en la misma prioridad, por valor): una etiqueta entra si cabe
 * en el área y no se cruza con ninguna de las que ya entraron. `tope`: cuántas como mucho; `porSerie`: cuántas
 * de cada serie. El resultado nunca tiene dos cajas que se toquen.
 */
export function etiquetasQueEntran(candidatos: readonly Candidato[], area: Area, opciones: { tope?: number; porSerie?: number } = {}): EtiquetaPuesta[] {
  const tope = opciones.tope ?? TOPE_ETIQUETAS;
  const porSerie = opciones.porSerie ?? Infinity;
  const orden = [...candidatos]
    .filter((c) => Number.isFinite(c.x) && Number.isFinite(c.y) && c.texto)
    .sort((a, b) => a.prioridad - b.prioridad || Math.abs(b.valor) - Math.abs(a.valor) || a.id.localeCompare(b.id));
  const puestas: EtiquetaPuesta[] = [];
  const cuenta = new Map<string, number>();
  for (const c of orden) {
    if (puestas.length >= tope) break;
    const s = c.serie ?? '';
    if ((cuenta.get(s) ?? 0) >= porSerie) continue;
    const caja = cajaDe(c, area);
    if (cajaVacia(caja) || !adentro(caja, area)) continue;
    if (puestas.some((p) => seCruzan(p.caja, caja))) continue;
    puestas.push({ ...c, caja });
    cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
  }
  return puestas;
}

export type PuntoSerie = { x: number; y: number; valor: number; texto: string } | null;

/**
 * Los candidatos de unas series: el ÚLTIMO punto con valor de cada una (prioridad 1) y su MÁXIMO si queda a
 * tres puntos o más del último (prioridad 2). Con esto el tope es «uno por serie más uno».
 */
export function candidatosDeSeries(series: ReadonlyArray<{ id: string; puntos: readonly PuntoSerie[] }>): Candidato[] {
  const out: Candidato[] = [];
  for (const s of series) {
    let ultimo = -1, maximo = -1;
    s.puntos.forEach((p, i) => {
      if (!p || !Number.isFinite(p.valor)) return;
      ultimo = i;
      if (maximo < 0 || p.valor > s.puntos[maximo]!.valor) maximo = i;
    });
    if (ultimo < 0) continue;
    const u = s.puntos[ultimo]!;
    out.push({ id: `${s.id}:${ultimo}`, x: u.x, y: u.y, texto: u.texto, prioridad: 1, valor: u.valor, serie: s.id, lado: 'arriba' });
    if (maximo >= 0 && ultimo - maximo >= 3) {
      const m = s.puntos[maximo]!;
      out.push({ id: `${s.id}:${maximo}`, x: m.x, y: m.y, texto: m.texto, prioridad: 2, valor: m.valor, serie: s.id, lado: 'arriba' });
    }
  }
  return out;
}
/** El tope de etiquetas de un gráfico de series: una por serie más una, y como mucho seis. */
export const topeDeSeries = (n: number) => Math.min(TOPE_ETIQUETAS, Math.max(1, n) + 1);

/**
 * Los candidatos de unas columnas: cada una si son 12 o menos y el texto entra en su ancho; si no, sólo la
 * más alta y la última. Las barras horizontales llevan SIEMPRE su valor al final (la regla de las piezas de
 * /admin/dev/pricing: «toda barra tiene su valor en texto al lado»).
 */
export function candidatosDeColumnas(barras: ReadonlyArray<{ id: string; x: number; y: number; ancho: number; valor: number; texto: string }>): Candidato[] {
  const validas = barras.filter((b) => Number.isFinite(b.valor));
  if (!validas.length) return [];
  const todas = validas.length <= 12 && validas.every((b) => b.ancho >= anchoTexto(b.texto, ETIQUETA.tam) + 8);
  const elegidas = todas ? validas : (() => {
    const max = validas.reduce((a, b) => (b.valor > a.valor ? b : a));
    const ult = validas[validas.length - 1];
    return max === ult ? [max] : [max, ult];
  })();
  return elegidas.map((b) => ({ id: b.id, x: b.x, y: b.y, texto: b.texto, prioridad: 1, valor: b.valor, lado: 'arriba' as const }));
}

// ── Tablas ───────────────────────────────────────────────────────────────────────────────

/**
 * La ÚNICA columna con barra de una tabla con barras: la elegida (`barra`), si no la que ordena, si no la
 * primera. NUNCA una métrica donde menos es mejor (CPA, CPL, costos): ahí una barra larga es lo MALO y se
 * leería como lo bueno. Si la elegida es de ésas, pasa a la primera métrica de «más es mejor»; si no hay
 * ninguna, la tabla va sin barra.
 */
export function columnaConBarra(g: { barra?: string | null; ordenMetrica?: string | null; metricas: readonly string[] }, menosEsMejor: (id: string) => boolean): string | null {
  const elegida = [g.barra, g.ordenMetrica, g.metricas[0]].find((x): x is string => !!x && g.metricas.includes(x));
  if (elegida && !menosEsMejor(elegida)) return elegida;
  return g.metricas.find((m) => !menosEsMejor(m)) ?? null;
}

/**
 * Cuántas columnas de número entran en el ancho, escondiendo de DERECHA a IZQUIERDA (sin scroll de costado).
 * La del nombre y la de la barra se quedan siempre.
 */
export function columnasQueEntran(ancho: number, cuantas: number, medidas: { nombre: number; barra: number; numero: number }): number {
  const libre = ancho - medidas.nombre - medidas.barra;
  if (libre <= 0) return 0;
  return Math.max(0, Math.min(cuantas, Math.floor(libre / medidas.numero)));
}

// ── Lo demás que deciden los dibujos ─────────────────────────────────────────────────────

/** ¿La tarjeta se esconde? Sólo si lo pide (`ocultarSiCero`) y su número es cero o no se pudo calcular. */
export function ocultoPorCero(g: { ocultarSiCero?: boolean }, total: number | null | undefined): boolean {
  return !!g.ocultarSiCero && (total == null || !Number.isFinite(total) || total === 0);
}

/**
 * Las filas en el ORDEN FIJO de la dimensión (`Dimension.valores`: «Alta, Media, Baja, A futuro»), con las
 * categorías que no trajeron filas en cero: un tramo vacío es un dato, no un hueco. Lo que no está en la lista
 * va después, en el orden en que vino.
 */
export function ordenarPorValores<F extends { clave: string; etiqueta: string; valores: Array<number | null> }>(filas: readonly F[], valores: readonly string[] | undefined, columnas: number): Array<F | { clave: string; etiqueta: string; valores: Array<number | null> }> {
  if (!valores?.length) return [...filas];
  const porClave = new Map(filas.map((f) => [f.clave, f]));
  const fijas = valores.map((v) => porClave.get(v) ?? { clave: v, etiqueta: v, valores: Array.from({ length: columnas }, () => 0) });
  const resto = filas.filter((f) => !valores.includes(f.clave));
  return [...fijas, ...resto];
}

/** El color de una categoría: el que declara su dimensión (un token), o el de la paleta por su orden. */
export function colorDeCategoria(valor: string, colores: Readonly<Record<string, string>> | undefined, i: number, paleta: readonly string[]): string {
  return colores?.[valor] ?? paleta[i % paleta.length];
}

/** El índice del tramo más largo (el que se resalta en una línea de tiempo), o -1 si no hay ninguno con valor. */
export function tramoMasLargo(valores: ReadonlyArray<number | null>): number {
  let k = -1;
  valores.forEach((v, i) => { if (v != null && Number.isFinite(v) && v > 0 && (k < 0 || v > (valores[k] as number))) k = i; });
  return k;
}

/**
 * Las partes de una barra de proporción, en %. Con todo en cero (o negativo, o sin dato) NO hay partes: la
 * barra vieja de Revenue pintaba 100 % rojo con 0 cobrado y 0 pendiente.
 */
export function partesDeProporcion(valores: ReadonlyArray<number | null>): number[] {
  const vs = valores.map((v) => (v != null && Number.isFinite(v) && v > 0 ? v : 0));
  const total = vs.reduce((a, b) => a + b, 0);
  if (!total) return vs.map(() => 0);
  return vs.map((v) => (v / total) * 100);
}

/**
 * El texto de un valor que puede venir con MUESTRA CHICA (`muestraChica` del agregador: una razón con menos
 * casos que su `minimo` no da número, da null). Un porcentaje se dice «2 de 3» —eso es lo que pasó—; una
 * razón de otra cosa (los días de un tramo) no tiene un «X de Y» que se lea, y va «—».
 */
export function textoConMuestra(v: number | null, muestra: { num: number; den: number } | null | undefined, formato: Formato, fmt: (v: number | null) => string): string {
  if (v == null && muestra && formato === 'pct') {
    const n = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    return `${n(muestra.num)} de ${n(muestra.den)}`;
  }
  return fmt(v);
}

/** El radio de una burbuja de ciudad: proporcional a la RAÍZ del valor (el área, no el radio, es lo que se lee). */
export function radioBurbuja(valor: number, max: number, rMin = 4, rMax = 22): number {
  if (!(valor > 0) || !(max > 0)) return 0;
  return rMin + (rMax - rMin) * Math.sqrt(Math.min(1, valor / max));
}

/**
 * Los 4 rótulos de cuadrante de una dispersión (`Grafico.referencias.rotulos`) van en ORDEN DE LECTURA:
 * arriba a la izquierda, arriba a la derecha, abajo a la izquierda, abajo a la derecha. Es el orden de los
 * bloques que reemplazan (Impacto × Esfuerzo: Quick wins, Apuestas, Relleno, Trampas; el cuadrante de
 * retención: Mejorar gancho, Escalar, Repensar, Reescribir cuerpo).
 */
export const ORDEN_ROTULOS = ['arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha'] as const;
