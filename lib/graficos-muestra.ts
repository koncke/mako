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

import { dimensionDe, fuenteDe, metricaDe, type Grafico } from './graficos-catalogo';
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
};

function etiquetasDe(dimId: string, valores?: readonly string[]): string[] {
  if (valores?.length) return [...valores];
  return [...(EJEMPLOS[dimId] ?? ['Opción A', 'Opción B', 'Opción C', 'Opción D'])];
}

/** El resultado de ejemplo de `g`. `hoy` (YYYY-MM-DD) ancla el tiempo: «los últimos días» se leen bien cualquier día. */
export function resultadoDeMuestra(g: Grafico, hoy: string): Resultado {
  const fuente = fuenteDe(g.fuente);
  const columnas = g.metricas.map((id) => {
    const m = fuente ? metricaDe(fuente, id) : undefined;
    return { id, nombre: m?.nombre ?? id, formato: (m?.formato ?? 'numero') as Formato };
  });
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
      .map((f, i, xs) => ({ ...f, valores: f.valores.map((v) => (v == null ? v : Math.round(v * (1 - i / (xs.length + 1)) * 100) / 100)) }));
  }

  const esRazon = (formato: Formato) => formato === 'pct' || formato === 'veces' || formato === 'segundos';
  const totales = columnas.map((c, j) => {
    if (!filas.length) return valorDe(c.formato, azar(semilla, 90 + j), c.formato === 'usd' ? 4 : 3);
    const vs = filas.map((f) => f.valores[j] ?? 0);
    const suma = vs.reduce((s, v) => s + v, 0);
    return esRazon(c.formato) ? Math.round((suma / vs.length) * 10) / 10 : Math.round(suma);
  });

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
