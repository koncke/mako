// =============================================================================
// El bloque `grafico` del chat (G16, y G7 como un gráfico de tipo tabla): una PREGUNTA del Dashboard se dibuja en el hilo
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, la pieza 2.7 del chat Dashboard), sobre el canal de
// Ops Center 3 para lo que dibuja una herramienta (`ctx.aDibujar`, 061c1b74d): la lectura devuelve el OBJETO
// `{ content, bloque }`, `ejecutarOperacion` sanea el bloque y lo pasa por `ctx.aDibujar` (que sólo existe en la app), y el
// modelo lee sólo `content`. «¿Cuánto vendí este mes?» deja el número, y «leads por mes» deja la serie, dibujados con la
// MISMA pieza del Dashboard (`CuerpoGrafico`, app/dashboard/Grafico.tsx: app/_chat/bloques/GraficoHilo.tsx).
// (Un primer contrato, del mismo día, leía un `bloque` metido en el JSON de la salida: se sacó, y ese JSON lo leería el modelo.)
//
// Lo que lleva: el gráfico (la configuración, validada contra el catálogo con `sanearComponente`) y su RESULTADO, la foto
// de lo que MaKo leyó en ese momento. No se vuelve a pedir: es lo que se contestó, y al recargar se ve igual.
//
// ⚠️ UNA SOLA FORMA PARA EL GRÁFICO Y LA TABLA: una tabla ES un gráfico de tipo `tabla`, y la misma pieza la dibuja. G7 en
//    el documento es la «lista accionable» (filas con acciones); eso no es esto.
// ⚠️ ACOTADO: hasta 60 filas, 8 columnas, 12 columnas de desglose y 400 puntos de serie. Lo que no entra se cuenta en
//    `fuera` (la pieza dice «N más»). Sin `ref` ni `imagen` por fila (ids de leads y fotos de afuera: el hilo no los usa).
// ⚠️ PURO y sin import circular: lib/chat-bloques.ts le pasa su `sanearAbrir`.
// =============================================================================

import { esGrafico, sanearComponente, type Grafico } from '@/lib/graficos-catalogo';
import type { FilaResultado, Resultado } from '@/lib/graficos-agregar';
import type { Formato } from '@/lib/graficos-constructores';

export type AbrirBloque = { titulo: string; href: string };

/** G16: un gráfico (o una tabla) con la foto de su resultado. */
export type BloqueGrafico = {
  t: 'grafico';
  titulo: string;
  /** Una línea debajo del título: el período y los filtros («1 al 20 de octubre · Funnel: Mentoría»). */
  nota?: string;
  grafico: Grafico;
  resultado: Resultado;
  abrir?: AbrirBloque;
};

export const MAX_FILAS_GRAFICO = 60;
const MAX_COLUMNAS = 8;
const MAX_CRUCE = 12;
const MAX_SERIE = 400;
const FORMATOS: readonly Formato[] = ['numero', 'usd', 'pct', 'veces', 'segundos'];

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const valor = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Una lista de valores del largo justo: si no, null (no se dibuja). */
const valores = (v: unknown, largo: number): Array<number | null> | null => {
  if (!Array.isArray(v) || v.length !== largo) return null;
  return v.map(valor);
};
const fecha = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** El resultado de un gráfico, acotado y con la forma justa. null = no se dibuja. */
export function sanearResultado(crudo: unknown): Resultado | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as Record<string, unknown>;
  const columnas = (Array.isArray(o.columnas) ? o.columnas : []).slice(0, MAX_COLUMNAS).flatMap((c) => {
    if (!c || typeof c !== 'object') return [];
    const r = c as Record<string, unknown>;
    const id = texto(r.id, 60);
    const formato = FORMATOS.includes(r.formato as Formato) ? (r.formato as Formato) : null;
    return id && formato ? [{ id, nombre: texto(r.nombre, 80) || id, formato }] : [];
  });
  if (!columnas.length) return null;
  const n = columnas.length;
  const crudas = Array.isArray(o.filas) ? o.filas : [];
  const filas: FilaResultado[] = [];
  for (const f of crudas.slice(0, MAX_FILAS_GRAFICO)) {
    if (!f || typeof f !== 'object') continue;
    const r = f as Record<string, unknown>;
    const vs = valores(r.valores, n);
    if (!vs) return null;
    const desde = fecha(r.desde), hasta = fecha(r.hasta);
    filas.push({ clave: texto(r.clave, 80), etiqueta: texto(r.etiqueta, 120), valores: vs, ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) });
  }
  const totales = valores(o.totales, n);
  if (!totales) return null;
  const clase = o.clase === 'tiempo' || o.clase === 'categoria' ? o.clase : null;
  const fueraCrudo = typeof o.fuera === 'number' && Number.isInteger(o.fuera) && o.fuera > 0 ? o.fuera : 0;
  const out: Resultado = { columnas, filas, totales, fuera: fueraCrudo + Math.max(0, crudas.length - MAX_FILAS_GRAFICO), clase };
  const anterior = o.anterior === undefined ? undefined : valores(o.anterior, n);
  if (anterior) out.anterior = anterior;
  if (o.cruce && typeof o.cruce === 'object') {
    const c = o.cruce as Record<string, unknown>;
    const claves = (Array.isArray(c.claves) ? c.claves : []).slice(0, MAX_CRUCE).map((k) => texto(k, 80));
    const celdas = Array.isArray(c.celdas) ? c.celdas.slice(0, filas.length).map((fila) => valores(Array.isArray(fila) ? fila.slice(0, claves.length) : null, claves.length)) : [];
    if (claves.length && celdas.length === filas.length && celdas.every(Boolean)) out.cruce = { claves, celdas: celdas as Array<Array<number | null>> };
  }
  if (Array.isArray(o.serie)) {
    out.serie = o.serie.slice(-MAX_SERIE).flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const r = p as Record<string, unknown>;
      return [{ clave: texto(r.clave, 40), etiqueta: texto(r.etiqueta, 60), valor: valor(r.valor) }];
    });
  }
  if (o.secundaria && typeof o.secundaria === 'object') {
    const s = o.secundaria as Record<string, unknown>;
    const id = texto(s.id, 60);
    const formato = FORMATOS.includes(s.formato as Formato) ? (s.formato as Formato) : null;
    if (id && formato) out.secundaria = { id, nombre: texto(s.nombre, 80) || id, formato, valor: valor(s.valor) };
  }
  return out;
}

/** El bloque `grafico` de lo que devolvió una lectura (o de lo guardado). null = no se dibuja. Nunca tira. */
export function sanearBloqueGrafico(o: Record<string, unknown>, sanearAbrir: (v: unknown) => AbrirBloque | null): BloqueGrafico | null {
  const titulo = texto(o.titulo, 120);
  if (!titulo) return null;
  let grafico: ReturnType<typeof sanearComponente> = null;
  try { grafico = sanearComponente(o.grafico); } catch { grafico = null; }
  if (!grafico || !esGrafico(grafico)) return null;
  const resultado = sanearResultado(o.resultado);
  if (!resultado) return null;
  // Una columna por métrica, como lo arma `datosDeGraficos`: si no, la pieza dibujaría otra cosa.
  if (resultado.columnas.length !== grafico.metricas.length) return null;
  const nota = texto(o.nota, 160);
  const abrir = o.abrir === undefined ? null : sanearAbrir(o.abrir);
  if (o.abrir !== undefined && !abrir) return null;
  return { t: 'grafico', titulo, ...(nota ? { nota } : {}), grafico, resultado, ...(abrir ? { abrir } : {}) };
}

/**
 * El gráfico con que el chat dibuja una consulta al vuelo (la tabla que arma `consultar_datos_dashboard` para el
 * modelo): un número queda número; con el tiempo, una serie; por categoría, barras si son pocas y tabla si son muchas;
 * con desglose, columnas. Lo que no calza, tal cual.
 */
export function graficoParaElChat(g: Grafico, r: Resultado): Grafico {
  if (!g.dimension) return g;
  if (g.desglose) return { ...g, tipo: 'columnas' };
  if (g.metricas.length > 1) return { ...g, tipo: 'tabla' };
  if (r.clase === 'tiempo') return { ...g, tipo: 'serie' };
  return { ...g, tipo: r.filas.length <= 12 ? 'barras' : 'tabla' };
}
