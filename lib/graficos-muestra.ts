// =============================================================================
// graficos-muestra — el resultado de EJEMPLO de un gráfico, para dibujarlo sin pedir datos
// =============================================================================
// Martín, 14/10/2026, sobre «¿Qué vas a crear hoy?»: «los templates tienen que ser fieles a lo que se va a ver, no
// inventes esas imagenes, que se vea tal cual». La miniatura de una plantilla (app/dashboard/MiniaturaHoja.tsx) ya no es
// un boceto: es la hoja dibujada con LOS MISMOS componentes del editor (`CuerpoGrafico`). Lo único que no puede ser real
// es el número: medir cada plantilla al abrir la galería serían ~150 gráficos por apertura (lo que
// /api/graficos/plantilla hace sólo para la que se elige). Así que cada gráfico recibe un `Resultado` con la FORMA del
// suyo —sus métricas con su formato, su dimensión con sus etiquetas, la comparación y la tendencia si las pide— y valores
// de ejemplo.
//
// ⚠️ DETERMINISTA: los valores salen del id del gráfico (no de `Math.random`), así el dibujo no cambia entre renders.
// ⚠️ FICTICIO POR REGLA: ningún nombre de un cliente real en las etiquetas de ejemplo (AGENTS.md).
// ⚠️ Sin `server-only` y sin valores de módulos con él: lo importa el navegador.
// =============================================================================

import { dimensionDe, fuenteDe, metricaDe, tipoDe, type Grafico } from './graficos-catalogo';
import { clavesDelRango, etiquetaTiempo, type FilaResultado, type Resultado } from './graficos-agregar';
import type { Formato } from './graficos-constructores';

/** Un número estable de 0 a 1 por (semilla, i). */
function azar(semilla: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let k = 0; k < semilla.length; k++) { h ^= semilla.charCodeAt(k); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

/** Un valor plausible para el formato de la métrica. */
function valorDe(formato: Formato, r: number, escala = 1): number {
  switch (formato) {
    case 'usd': return Math.round((400 + r * 3600) * escala);
    case 'pct': return Math.round((12 + r * 48) * 10) / 10;
    case 'veces': return Math.round((1.2 + r * 3) * 100) / 100;
    case 'segundos': return Math.round(30 + r * 600);
    default: return Math.max(1, Math.round((6 + r * 54) * escala));
  }
}

/** Las etiquetas de ejemplo de una dimensión de categorías, por su id (ficticias). */
const EJEMPLOS: Record<string, readonly string[]> = {
  etapa: ['Nuevo', 'Agendó', 'Asistió', 'Propuesta', 'Cerró'],
  producto: ['Programa principal', 'Mentoría', 'Curso'],
  origen: ['Anuncios', 'Orgánico', 'Referidos', 'WhatsApp'],
  campana: ['Campaña de leads', 'Remarketing', 'Webinar', 'Prueba de anuncios'],
  conjunto: ['Público frío', 'Interesados', 'Similares'],
  anuncio: ['Video testimonio', 'Carrusel', 'Imagen oferta', 'Reel'],
  closer: ['Ana', 'Bruno', 'Carla', 'Diego'],
  setter: ['Ana', 'Bruno', 'Carla'],
  cliente: ['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D'],
  motivo: ['Precio', 'No es el momento', 'No respondió', 'Eligió otro'],
  estado: ['Al día', 'Pendiente', 'Vencida'],
  pagina: ['/inicio', '/oferta', '/gracias'],
  linea: ['Línea principal', 'Ventas', 'Soporte'],
  edad: ['18-24', '25-34', '35-44', '45-54', '55+'],
  genero: ['Mujeres', 'Hombres', 'Sin dato'],
  plataforma: ['Instagram', 'Facebook', 'Messenger', 'Audience Network'],
  proyecto: ['Lanzamiento de octubre', 'Nueva landing', 'Webinar mensual', 'Automatizaciones'],
  guion: ['3 errores al vender', 'Lo que nadie te dice del precio', 'Antes y después', 'El caso de un alumno'],
  region: ['Jalisco', 'Nuevo León', 'Ciudad de México', 'Baja California', 'Puebla'],
  pais: ['México', 'Colombia', 'Argentina', 'España'],
  ciudad: ['Guadalajara', 'Monterrey', 'Ciudad de México', 'Tijuana', 'Puebla'],
};
/** Dónde queda cada ciudad de ejemplo: el mapa por ciudad dibuja burbujas con la `geo` de cada fila. */
const GEO_CIUDAD: Record<string, { lat: number; lon: number }> = {
  Guadalajara: { lat: 20.67, lon: -103.35 }, Monterrey: { lat: 25.69, lon: -100.32 }, 'Ciudad de México': { lat: 19.43, lon: -99.13 },
  Tijuana: { lat: 32.51, lon: -117.04 }, Puebla: { lat: 19.04, lon: -98.21 },
};

function etiquetasDe(dimId: string, valores?: readonly string[]): string[] {
  if (valores?.length) return [...valores];
  return [...(EJEMPLOS[dimId] ?? ['Opción A', 'Opción B', 'Opción C', 'Opción D'])];
}

/** El resultado de ejemplo de `g`. `hoy` (YYYY-MM-DD) ancla el tiempo: «los últimos días» se leen bien cualquier día. */
export function resultadoDeMuestra(g: Grafico, hoy: string): Resultado {
  const fuente = fuenteDe(g.fuente);
  const metricas = g.metricas.map((id) => (fuente ? metricaDe(fuente, id) : undefined));
  const columnas = g.metricas.map((id, j) => ({ id, nombre: metricas[j]?.nombre ?? id, formato: (metricas[j]?.formato ?? 'numero') as Formato }));
  /** Una razón (un costo por lead, una tasa) no se suma: su total es el promedio. Un conteo es entero. */
  const esRazonDe = (j: number) => !!metricas[j]?.razon || ['pct', 'veces', 'segundos'].includes(columnas[j].formato);
  const redondeo = (v: number, j: number) => (columnas[j].formato === 'numero' && !esRazonDe(j) ? Math.round(v) : Math.round(v * 100) / 100);
  const dim = fuente ? dimensionDe(fuente, g.dimension) : undefined;
  const semilla = g.id;
  const fila = (clave: string, etiqueta: string, i: number, sube = 0): FilaResultado => ({
    clave, etiqueta,
    valores: columnas.map((c, j) => valorDe(c.formato, Math.min(1, azar(semilla, i * 7 + j) * 0.7 + sube * 0.3), c.formato === 'usd' ? 0.25 : 0.4)),
  });

  let filas: FilaResultado[] = [];
  let clase: Resultado['clase'] = null;
  if (dim?.clase === 'tiempo') {
    clase = 'tiempo';
    const n = dim.id === 'mes' ? 6 : dim.id === 'semana' ? 8 : 14;
    const paso = dim.id === 'mes' ? 31 : dim.id === 'semana' ? 7 : 1;
    const desde = new Date(Date.parse(`${hoy}T12:00:00Z`) - (n - 1) * paso * 86_400_000).toISOString().slice(0, 10);
    const claves = clavesDelRango(dim.id, desde, hoy).slice(-n);
    filas = claves.map((k, i) => fila(k, etiquetaTiempo(dim.id, k), i, i / Math.max(1, claves.length - 1)));
  } else if (dim) {
    clase = 'categoria';
    // De mayor a menor, como sale un ranking real.
    filas = etiquetasDe(dim.id, dim.valores).map((e, i) => fila(e, e, i))
      .map((f, i, xs) => ({
        ...f,
        valores: f.valores.map((v, j) => (v == null ? v : redondeo(v * (1 - i / (xs.length + 1)), j))),
        ...(dim.id === 'ciudad' && GEO_CIUDAD[f.etiqueta] ? { geo: GEO_CIUDAD[f.etiqueta] } : {}),
      }));
  }

  // Una dispersión con ejes fijos (la matriz de Productividad, 0-100): los puntos de ejemplo se reparten adentro de esos
  // ejes. Con los valores de un conteo (de 1 a 15) quedaban todos amontonados en la esquina del origen.
  if (g.ejes && filas.length) {
    const rango = (j: 0 | 1): [number, number] | null => {
      const [a, b] = j === 0 ? [g.ejes!.xMin, g.ejes!.xMax] : [g.ejes!.yMin, g.ejes!.yMax];
      return a != null && b != null && b > a ? [a, b] : null;
    };
    filas = filas.map((f, i) => ({
      ...f,
      valores: f.valores.map((v, j) => {
        const r = j < 2 ? rango(j as 0 | 1) : null;
        return r ? Math.round(r[0] + (0.08 + 0.84 * azar(semilla, 500 + i * 3 + j)) * (r[1] - r[0])) : v;
      }),
    }));
  }

  const totales = columnas.map((c, j) => {
    if (!filas.length) return valorDe(c.formato, azar(semilla, 90 + j), c.formato === 'usd' ? 4 : 3);
    const vs = filas.map((f) => f.valores[j] ?? 0);
    const suma = vs.reduce((s, v) => s + v, 0);
    return esRazonDe(j) ? Math.round((suma / vs.length) * 10) / 10 : Math.round(suma);
  });
  // Un embudo de ejemplo BAJA de escalón en escalón (con números al azar salían «92 de 58 pasaron», un embudo al revés).
  if (tipoDe(g.tipo)?.grupo === 'Embudo de conversión' && !filas.length) {
    let previo = Math.max(1, totales[0] ?? 1) * 6;
    totales.forEach((_, j) => {
      if (columnas[j].formato !== 'numero') return;
      previo = j === 0 ? previo : Math.max(1, Math.round(previo * (0.35 + azar(semilla, 400 + j) * 0.4)));
      totales[j] = previo;
    });
  }

  const out: Resultado = { columnas, filas, totales, fuera: 0, clase };
  if (g.comparar) out.anterior = totales.map((t, j) => (t == null ? null : Math.round(t * (0.72 + azar(semilla, 50 + j) * 0.2) * 10) / 10));
  // La tendencia de un cuadro de resultados: los últimos 14 días, subiendo con ruido.
  if (!dim) {
    const desde = new Date(Date.parse(`${hoy}T12:00:00Z`) - 13 * 86_400_000).toISOString().slice(0, 10);
    out.serie = clavesDelRango('dia', desde, hoy).map((k, i) => ({
      clave: k, etiqueta: etiquetaTiempo('dia', k),
      valor: valorDe(columnas[0]?.formato ?? 'numero', Math.min(1, 0.25 + (i / 13) * 0.45 + azar(semilla, 200 + i) * 0.3), 0.2),
    }));
  }
  // El cruce con el desglose (barras apiladas, una tabla dinámica): sobre la primera métrica.
  if (g.desglose && fuente) {
    const d2 = dimensionDe(fuente, g.desglose);
    if (d2) {
      const claves = d2.clase === 'tiempo' ? ['Sem 1', 'Sem 2', 'Sem 3'] : etiquetasDe(d2.id, d2.valores).slice(0, 4);
      out.cruce = { claves, celdas: filas.map((_, i) => claves.map((__, j) => valorDe(columnas[0]?.formato ?? 'numero', azar(semilla, 300 + i * 11 + j), 0.3))) };
      // El total de cada fila es la suma de sus celdas (una tabla dinámica que no suma se lee como un error).
      if (!esRazonDe(0)) {
        out.filas = filas.map((f, i) => ({ ...f, valores: [out.cruce!.celdas[i].reduce<number>((s, v) => s + (v ?? 0), 0), ...f.valores.slice(1)] }));
        out.totales = [out.filas.reduce((s, f) => s + (f.valores[0] ?? 0), 0), ...totales.slice(1)];
      }
    }
  }
  return out;
}

// ── El lugar de cada componente en la miniatura ─────────────────────────────────────────────────────────────────────

/** La página de la miniatura: su ancho (px), la grilla del editor (FILA 30, MARGEN 16, 12 columnas) y el aire de la página. */
export const PAGINA_MINIATURA = { ancho: 1180, fila: 30, margen: 16, lado: 24, cabeza: 66, cols: 12 } as const;

/**
 * Dónde va un componente en la página de la miniatura, en px: la MISMA cuenta que hace react-grid-layout en el editor
 * (columna = (ancho − márgenes) / 12; alto = h·FILA + (h−1)·MARGEN). Si esto se aparta del editor, la miniatura deja de
 * ser «tal cual».
 */
export function lugarEnMiniatura(c: { x: number; y: number; w: number; h: number }): { left: number; top: number; width: number; height: number } {
  const { ancho, fila, margen, lado, cabeza, cols } = PAGINA_MINIATURA;
  const col = (ancho - 2 * lado - (cols - 1) * margen) / cols;
  return {
    left: lado + c.x * (col + margen),
    top: cabeza + c.y * (fila + margen),
    width: c.w * col + (c.w - 1) * margen,
    height: c.h * fila + (c.h - 1) * margen,
  };
}
