// =============================================================================
// exportar — lo que SALE de una hoja del Dashboard: el pedido al server, el CSV y lo que lee MaKo
// =============================================================================
// Pedidos de Martín (11/10/2026): «agrega el botón de "Exportar" para poder exportar los datos como
// csv, o incluso como PDF con los gráficos bien colocados» (punto 21), el chat de MaKo en cada gráfico
// (punto 5) y el «AI Analyst» (punto 23).
//
// Todo lo que una hoja manda afuera de la pantalla pasa por acá, y por eso es PURO y sin `server-only`:
// lo llaman la pantalla (app/dashboard/EditorInforme.tsx), la primera pintada del server
// (app/dashboard/page.tsx) y los tests (tests/dashboard-pantalla.test.ts).
//
//   · `pedidosDeHoja` arma el pedido de datos de cada gráfico con `efectivoDe` (el
//     período, los filtros y el «agrupar por» que resuelve lib/graficos-catalogo.ts). Lo usan las DOS
//     puntas: si page.tsx armara el suyo, la primera pintada y la pantalla pedirían cosas distintas y
//     la firma de lo que ya llegó no coincidiría nunca (se pediría todo dos veces).
//   · `firmaDe` decide si un gráfico tiene que volver a pedir sus datos. Lleva TODO lo que cambia lo
//     que devuelve el server (los filtros y `comparar` incluidos: sin ellos, cambiar un filtro no pedía
//     nada) y un contador `version` que sube después de una acción que cambia los datos (marcar una
//     cuota cobrada).
//   · `csvDeHoja` arma el CSV de la hoja: una sección por gráfico, con lo que el gráfico MUESTRA (su
//     Resultado ya agregado). Los bloques y los elementos no tienen una tabla: se saltean y se cuenta.
//   · `contextoDeGrafico` es lo que lee un modelo de IA (el chat de MaKo de cada gráfico). ⚠️ UN DATO
//     CON NOMBRES DE PERSONAS NO VIAJA A UN MODELO (AGENTS.md): lo que no es público sale como
//     «Cliente 1…N», con la MISMA lista que el AI Analyst (lib/graficos-analisis.ts).
//   · `loQueSeVeDe` es lo que el AI Analyst recibe de la pantalla, y NO va a ningún modelo: el panel
//     sólo saca la firma de cada resultado para decir si la hoja cambió desde el análisis.

import {
  PRESET_AUTOMATICO, campoDe, conVista, efectivoDe, esBloque, esElemento, esGrafico, fuenteDe, nombrePreset, rangoDe, tipoDe, tituloDe,
  type Componente, type ControlVista, type Efectivo, type FiltroDim, type Grafico, type Hoja, type VistaValores,
} from '@/lib/graficos-catalogo';
import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { Alias, dimensionPublica, etiquetaSegura } from '@/lib/graficos-analisis';
import { campoDeDimension } from '@/lib/graficos-controles-texto';
import { idDeParte } from '@/lib/graficos-migrar-v5';
import type { Formato } from '@/lib/graficos-constructores';

// ── El pedido de datos ─────────────────────────────────────────────────────────────────────

/** Lo que va por gráfico a /api/graficos {accion:'datos'} (el server lo vuelve a sanear todo). */
export type PedidoGrafico = { grafico: Grafico; desde: string; hasta: string; filtros: FiltroDim[]; agrupar: Efectivo['agrupar'] };

/**
 * Lo que decide los DATOS de un gráfico. Moverlo, cambiarle el título o el objetivo no pide nada;
 * el período, los filtros, el «agrupar por», `comparar` (que pide el período anterior) y la versión, sí.
 */
export function firmaDe(g: Grafico, ef: Efectivo, version: number): string {
  return [
    g.tipo, g.fuente, g.fecha, g.dimension ?? '', g.desglose ?? '', g.metricas.join(','), g.limite, g.ordenMetrica ?? '', g.ordenAsc,
    g.comparar, ef.desde, ef.hasta, JSON.stringify(ef.filtros), ef.agrupar ?? '', version,
  ].join('|');
}

export type PedidosHoja = {
  graficos: Array<{ g: Grafico; ef: Efectivo; firma: string; pedido: PedidoGrafico }>;
};

/**
 * La barra de búsqueda de una tabla (`g.tabla.buscar`, tanda v5, interfaz I2): lo que se escribe ahí es un
 * control `texto` sobre el campo de la dimensión de la tabla, con este id FIJO, y vive en la VISTA (no se
 * guarda). No se guarda ningún control: la tabla lo lleva «de fábrica» mientras tenga la barra, así una tabla
 * migrada (la de «Las llamadas», lib/graficos-migrar-v5.ts) busca sin que nadie le agregue nada. Si la tabla ya
 * tiene un control propio sobre ese campo, la barra usa ÉSE (uno por campo: `sanearControles`).
 */
export const idBusquedaDe = (g: Pick<Grafico, 'id' | 'fuente' | 'dimension' | 'controles'>): string | null => {
  const campo = campoDeDimension(g.fuente, g.dimension);
  if (!campo) return null;
  const propio = g.controles.find((k) => (k.tipo === 'texto' || k.tipo === 'lista') && k.campo === campo);
  if (propio) return propio.tipo === 'texto' && !propio.fijo ? propio.id : null;
  return idDeParte(g.id, 'buscar');
};

/** El gráfico con el control de su barra de búsqueda (si la tiene y hace falta): lo que mira `efectivoDe`. */
export function conBusqueda<T extends Grafico>(g: T): T {
  if (!g.tabla?.buscar) return g;
  const campo = campoDeDimension(g.fuente, g.dimension);
  const id = idBusquedaDe(g);
  if (!campo || !id || g.controles.some((k) => k.id === id)) return g;
  const control: ControlVista = { id, tipo: 'texto', campo, preset: PRESET_AUTOMATICO, desde: null, hasta: null, valores: null, texto: '', agrupar: 'auto' };
  return { ...g, controles: [...g.controles, control] };
}

/**
 * Los pedidos de TODA la hoja con lo que la vista tiene elegido (vacía = lo que se guardó). `ocultos`: lo que
 * NO se pide (los miembros de una sección plegada, lib/graficos-secciones.ts; tanda v5, punto 24: «lo plegado
 * no pide datos hasta abrirse»). Sin `ocultos`, se pide TODO: así lo leen la API de MaKo y el CSV, que no
 * dibujan nada y tienen que ver también lo plegado.
 */
export function pedidosDeHoja(hoja: Hoja, vista: VistaValores, hoy: string, version: number, ocultos?: ReadonlySet<string>): PedidosHoja {
  const out: PedidosHoja = { graficos: [] };
  for (const c of hoja.componentes) {
    if (ocultos?.has(c.id)) continue;
    // Sólo los gráficos piden datos: un elemento no lee nada, y un bloque ya no llega (v5: el saneo los
    // convierte en gráficos, lib/graficos-migrar-v5.ts).
    if (esGrafico(c)) {
      // El efectivo con la barra de búsqueda; el gráfico que viaja, el GUARDADO (el server sanea igual).
      const ef = efectivoDe(conBusqueda(c), hoja, vista, hoy);
      out.graficos.push({ g: c, ef, firma: firmaDe(c, ef, version), pedido: { grafico: c, desde: ef.desde, hasta: ef.hasta, filtros: ef.filtros, agrupar: ef.agrupar } });
    }
  }
  return out;
}

// ── Cómo se escriben las fechas y los períodos ─────────────────────────────────────────────

/** `2026-10-11` → `11/10/2026`. */
export const fechaCorta = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s);
export const rangoTexto = (desde: string, hasta: string) => (desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} – ${fechaCorta(hasta)}`);

/**
 * El período de la HOJA en una línea, para el PDF (la barra de controles no se imprime): el control de
 * período de la hoja con lo que la vista eligió, o los 30 días de siempre. Y los filtros activos.
 */
export function periodoDeHoja(hoja: Hoja, vista: VistaValores, hoy: string): string {
  const controles = hoja.controles.map((c) => conVista(c, vista));
  const p = controles.find((c) => c.tipo === 'periodo');
  const preset = p?.preset ?? PRESET_AUTOMATICO;
  const rg = rangoDe(preset, hoy, p?.desde, p?.hasta);
  const partes = [`${preset === 'personalizado' ? 'Período' : nombrePreset(preset)}: ${rangoTexto(rg.desde, rg.hasta)}`];
  for (const c of controles) {
    const t = filtroTexto(c);
    if (t) partes.push(t);
  }
  return partes.join(' · ');
}

function filtroTexto(c: ControlVista): string | null {
  const campo = campoDe(c.campo)?.nombre;
  if (!campo) return null;
  if (c.tipo === 'lista' && c.valores?.length) return `${campo}: ${c.valores.slice(0, 5).join(', ')}${c.valores.length > 5 ? ` y ${c.valores.length - 5} más` : ''}`;
  if (c.tipo === 'texto' && c.texto.trim()) return `${campo} contiene «${c.texto.trim()}»`;
  return null;
}

// ── Las personas: lo que no viaja a un modelo ─────────────────────────────────────────────

// ⚠️ LA LISTA ES LA DEL AI ANALYST (`DIMENSIONES_PUBLICAS` y `etiquetaSegura`, lib/graficos-analisis.ts),
//    no una propia. Es POSITIVA: sólo lo revisado viaja con su etiqueta, y todo lo demás —incluido un
//    conjunto que se sume mañana— sale como «<Dimensión> N». La primera versión de este archivo tenía su
//    lista NEGATIVA (las que se ocultan), y dejaba pasar el nombre del lead (`leads.lead`), el cliente de
//    una entrega, el título de una llamada o de una tarea y el «Motivo de pérdida» escrito a mano: las
//    dimensiones que se sumaron después de escribirla.

const nombreDim = (g: Grafico, dim: string | null) => fuenteDe(g.fuente)?.dimensiones.find((d) => d.id === dim)?.nombre ?? 'Valor';

/**
 * El Resultado con lo que no es público reemplazado por «Cliente 1…N» (las filas y las columnas del
 * desglose). Un mismo nombre recibe el mismo alias en todo el gráfico (`alias` se comparte con los
 * filtros). Sin nada que ocultar, devuelve el MISMO objeto.
 */
export function sinPersonas(g: Grafico, r: Resultado, alias: Alias = new Alias()): Resultado {
  let cambio = false;
  const filas = r.clase === 'categoria'
    ? r.filas.map((f) => {
      const e = etiquetaSegura(g.fuente, g.dimension, f.etiqueta, alias);
      if (e === f.etiqueta) return f;
      cambio = true;
      return { ...f, clave: e, etiqueta: e };
    })
    : r.filas;
  let cruce = r.cruce;
  if (r.cruce) {
    const claves = r.cruce.claves.map((k) => etiquetaSegura(g.fuente, g.desglose, k, alias));
    if (claves.some((k, i) => k !== r.cruce!.claves[i])) { cambio = true; cruce = { ...r.cruce, claves }; }
  }
  return cambio ? { ...r, filas, ...(cruce ? { cruce } : {}) } : r;
}

/** Los filtros del gráfico, en palabras; los valores pasan por el mismo alias que las filas. */
function filtrosEnTexto(g: Grafico, filtros: FiltroDim[], alias: Alias): string[] {
  const f = fuenteDe(g.fuente);
  return filtros.map((x) => {
    const nombre = f?.dimensiones.find((d) => d.id === x.dimension)?.nombre ?? x.dimension;
    if (x.valores) return `${nombre}: ${x.valores.map((v) => etiquetaSegura(g.fuente, x.dimension, v, alias)).join(', ')}`;
    // Lo que se tipeó en una búsqueda puede ser un nombre: sólo viaja si la dimensión es pública.
    return dimensionPublica(g.fuente, x.dimension) ? `${nombre} contiene «${x.texto ?? ''}»` : `${nombre}: una búsqueda`;
  });
}

const TOPE_FILAS_IA = 40;

/**
 * El `contexto` del chat de MaKo de un gráfico (MakoButton, app/_components/ChartIA.tsx): qué gráfico
 * es, de qué período, con qué filtros, y lo que muestra con su unidad (`fmtValor`: «US$1.234», «12,5%»).
 * Sin personas.
 */
export function contextoDeGrafico(g: Grafico, r: Resultado, ef: Pick<Efectivo, 'desde' | 'hasta' | 'filtros'>): string {
  const alias = new Alias();
  const limpio = sinPersonas(g, r, alias);
  const f = fuenteDe(g.fuente);
  const lineas: string[] = [];
  lineas.push(`Gráfico: ${tituloDe(g)} (${tipoDe(g.tipo)?.nombre ?? g.tipo}), con los datos de «${f?.nombre ?? g.fuente}».`);
  const sinRango = !!f?.fechas.find((x) => x.id === g.fecha)?.sinRango;
  lineas.push(sinRango ? 'Período: la foto de hoy.' : `Período: ${rangoTexto(ef.desde, ef.hasta)}.`);
  const filtros = filtrosEnTexto(g, ef.filtros, alias);
  if (filtros.length) lineas.push(`Filtros: ${filtros.join(' · ')}.`);
  const fmt = (v: number | null, fo: Formato) => fmtValor(v, fo);
  const cols = limpio.columnas;
  if (limpio.cruce && cols[0]) {
    lineas.push(`${cols[0].nombre}, cruzado por ${nombreDim(g, g.desglose).toLowerCase()} (${limpio.cruce.claves.join(', ')}):`);
    limpio.filas.slice(0, TOPE_FILAS_IA).forEach((fl, i) => {
      lineas.push(`- ${fl.etiqueta}: ${limpio.cruce!.celdas[i].map((v, j) => `${limpio.cruce!.claves[j]} ${fmt(v, cols[0].formato)}`).join(' · ')}`);
    });
  } else if (limpio.filas.length) {
    lineas.push(`Columnas: ${cols.map((c) => c.nombre).join(', ')}.`);
    limpio.filas.slice(0, TOPE_FILAS_IA).forEach((fl) => {
      lineas.push(`- ${fl.etiqueta}: ${fl.valores.map((v, i) => `${cols[i]?.nombre ?? ''} ${fmt(v, cols[i]?.formato ?? 'numero')}`).join(' · ')}`);
    });
  }
  if (limpio.filas.length > TOPE_FILAS_IA) lineas.push(`(y ${limpio.filas.length - TOPE_FILAS_IA} filas más)`);
  if (limpio.fuera > 0) lineas.push(`Hay ${limpio.fuera} grupos más que no entran en el gráfico.`);
  if (cols.length) lineas.push(`Total: ${cols.map((c, i) => `${c.nombre} ${fmt(limpio.totales[i] ?? null, c.formato)}`).join(' · ')}.`);
  if (limpio.anterior?.length) lineas.push(`Período anterior del mismo largo: ${cols.map((c, i) => `${c.nombre} ${fmt(limpio.anterior![i] ?? null, c.formato)}`).join(' · ')}.`);
  return lineas.join('\n');
}

/**
 * Lo que el AI Analyst recibe de la pantalla (app/dashboard/PanelAnalista.tsx): lo que muestra cada
 * gráfico. ⚠️ CON EL RESULTADO TAL CUAL, sin alias: no va a ningún modelo (el server arma lo suyo,
 * lib/graficos-analisis-server.ts) y el panel compara su FIRMA (`firmaResultado`) con la que el server
 * sacó del resultado real. Con los nombres reemplazados, un gráfico de clientes diría «cambió desde el
 * análisis» para siempre.
 */
export type LoQueSeVeGrafico = { id: string; titulo: string; desde: string; hasta: string; resultado: Resultado };

/** Los gráficos en el orden en que se leen (de arriba abajo, de izquierda a derecha). */
export const enOrden = <T extends Pick<Componente, 'x' | 'y'>>(cs: readonly T[]): T[] => [...cs].sort((a, b) => a.y - b.y || a.x - b.x);

export function loQueSeVeDe(hoja: Hoja, resultados: Record<string, Resultado | undefined>, efectivos: Record<string, Pick<Efectivo, 'desde' | 'hasta'>>): LoQueSeVeGrafico[] {
  const out: LoQueSeVeGrafico[] = [];
  for (const c of enOrden(hoja.componentes)) {
    if (!esGrafico(c)) continue;
    const r = resultados[c.id];
    const ef = efectivos[c.id];
    if (!r || !ef) continue;
    out.push({ id: c.id, titulo: tituloDe(c), desde: ef.desde, hasta: ef.hasta, resultado: r });
  }
  return out;
}

// ── El CSV ─────────────────────────────────────────────────────────────────────────────────
//
// Decisiones (11/10/2026):
//   · SEPARADOR COMA y números con PUNTO decimal, sin separador de miles ni símbolo: es lo que el Excel
//     de México (la mayoría de los clientes) y Google Sheets abren como números. La unidad va en el
//     ENCABEZADO de la columna («Gasto (US$)»), no pegada al valor, para que la celda siga siendo un
//     número que se puede sumar.
//   · BOM UTF-8 al principio: sin él, Excel abre «Campaña» como «CampaÃ±a».
//   · Saltos de línea CRLF (RFC 4180), y comillas cuando el campo trae el separador, una comilla, un
//     salto de línea o espacios en los bordes (la comilla de adentro se duplica).
//   · ⚠️ INYECCIÓN DE FÓRMULAS: un TEXTO que empieza con = + - @ (el nombre de una campaña de Meta lo
//     escribe cualquiera) se abre en Excel como una fórmula. Se le antepone un apóstrofo. A un NÚMERO
//     negativo no: es un número.

export const SEPARADOR_CSV = ',';
// Con su código y no como el carácter: es invisible, y un editor que lo «limpia» lo borra sin que el
// diff muestre nada (AGENTS.md: un carácter de control no se escribe crudo).
const BOM = String.fromCharCode(0xfeff);
const FIN = '\r\n';

const UNIDAD: Record<Formato, string> = { numero: '', usd: ' (US$)', pct: ' (%)', veces: ' (x)', segundos: ' (s)' };

/** Un número para el CSV: con punto, hasta 4 decimales, sin ceros de más. */
export function numeroCsv(n: number): string {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(n * 10_000) / 10_000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Una celda: los números tal cual; los textos con comillas cuando hacen falta y sin fórmulas. */
export function celdaCsv(v: string | number | null | undefined, sep = SEPARADOR_CSV): string {
  if (v == null) return '';
  if (typeof v === 'number') return numeroCsv(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  const comillas = s.includes(sep) || /["\r\n]/.test(s) || /^\s|\s$/.test(s);
  return comillas ? `"${s.replace(/"/g, '""')}"` : s;
}

const filaCsv = (celdas: Array<string | number | null | undefined>, sep: string) => celdas.map((c) => celdaCsv(c, sep)).join(sep);

/** El nombre de la columna de la dimensión: el del «agrupar por» si lo cambió, si no el del gráfico. */
function encabezadoDimension(g: Grafico, r: Resultado, ef: Pick<Efectivo, 'agrupar'>): string {
  const dim = r.clase === 'tiempo' ? (ef.agrupar ?? g.dimension) : g.dimension;
  return fuenteDe(g.fuente)?.dimensiones.find((d) => d.id === dim)?.nombre ?? '';
}

/** La sección de UN gráfico: título, período, encabezado, filas, total (y el período anterior si compara). */
export function seccionCsv(g: Grafico, r: Resultado, ef: Pick<Efectivo, 'desde' | 'hasta' | 'agrupar'>, sep = SEPARADOR_CSV): string[] {
  const out: string[] = [];
  const f = fuenteDe(g.fuente);
  const sinRango = !!f?.fechas.find((x) => x.id === g.fecha)?.sinRango;
  out.push(filaCsv(['Gráfico', tituloDe(g)], sep));
  out.push(filaCsv(['Período', sinRango ? 'Hoy' : rangoTexto(ef.desde, ef.hasta)], sep));
  const dim = encabezadoDimension(g, r, ef);
  // El tiempo va con su clave ISO (2026-10-11): una fecha que Excel y Sheets entienden en cualquier país.
  const etiqueta = (fl: Resultado['filas'][number]) => (r.clase === 'tiempo' ? fl.clave : fl.etiqueta);
  if (r.cruce && r.columnas[0]) {
    const c0 = r.columnas[0];
    out.push(filaCsv([dim, ...r.cruce.claves.map((k) => `${k}${UNIDAD[c0.formato]}`), `Total${UNIDAD[c0.formato]}`], sep));
    r.filas.forEach((fl, i) => out.push(filaCsv([etiqueta(fl), ...r.cruce!.celdas[i], fl.valores[0]], sep)));
  } else {
    out.push(filaCsv([dim, ...r.columnas.map((c) => `${c.nombre}${UNIDAD[c.formato]}`)], sep));
    for (const fl of r.filas) out.push(filaCsv([etiqueta(fl), ...fl.valores], sep));
  }
  if (r.totales.some((v) => v != null)) out.push(filaCsv(['Total', ...(r.cruce ? [...r.cruce.claves.map(() => null), r.totales[0]] : r.totales)], sep));
  if (r.anterior?.some((v) => v != null) && !r.cruce) out.push(filaCsv(['Período anterior', ...r.anterior], sep));
  if (r.fuera > 0) out.push(filaCsv(['Sin mostrar', `${r.fuera} grupos más`], sep));
  return out;
}

export type CsvHoja = {
  csv: string;
  /** Cuántos gráficos entraron. */
  graficos: number;
  /** Lo que no tiene una tabla que exportar: los bloques, los elementos y los gráficos sin datos todavía. */
  salteados: { bloques: number; elementos: number; sinDatos: number };
};

/**
 * El CSV de la hoja: un encabezado, y una sección por gráfico en el orden en que se leen, separadas por
 * una línea vacía. Al final, lo que no se exportó y por qué.
 */
export function csvDeHoja({ hoja, resultados, efectivos, hoy, sep = SEPARADOR_CSV }: {
  hoja: Hoja;
  resultados: Record<string, Resultado | undefined>;
  efectivos: Record<string, Pick<Efectivo, 'desde' | 'hasta' | 'agrupar'>>;
  hoy: string;
  sep?: string;
}): CsvHoja {
  const lineas: string[] = [filaCsv(['Hoja', hoja.nombre], sep), filaCsv(['Exportado', fechaCorta(hoy)], sep)];
  const salteados = { bloques: 0, elementos: 0, sinDatos: 0 };
  let graficos = 0;
  for (const c of enOrden(hoja.componentes)) {
    if (esElemento(c)) { salteados.elementos++; continue; }
    if (esBloque(c)) { salteados.bloques++; continue; }
    const r = resultados[c.id];
    const ef = efectivos[c.id];
    if (!r || !ef) { salteados.sinDatos++; continue; }
    lineas.push('', ...seccionCsv(c, r, ef, sep));
    graficos++;
  }
  const notas: string[] = [];
  if (salteados.bloques) notas.push(`${salteados.bloques} bloque${salteados.bloques === 1 ? '' : 's'}`);
  if (salteados.elementos) notas.push(`${salteados.elementos} elemento${salteados.elementos === 1 ? '' : 's'}`);
  if (salteados.sinDatos) notas.push(`${salteados.sinDatos} gráfico${salteados.sinDatos === 1 ? '' : 's'} sin datos`);
  if (notas.length) lineas.push('', filaCsv(['Sin exportar', notas.join(', ')], sep));
  return { csv: BOM + lineas.join(FIN) + FIN, graficos, salteados };
}

/** `dashboard-marketing-2026-10-11.csv`: sin acentos ni espacios, que viaje bien por mail. */
export function nombreArchivo(nombreHoja: string, hoy: string, ext: 'csv' | 'pdf'): string {
  const slug = nombreHoja.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'hoja';
  return `dashboard-${slug}-${hoy}.${ext}`;
}
