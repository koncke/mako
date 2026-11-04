// =============================================================================
// contenido-diseno-muestra — los datos de EJEMPLO de la hoja Contenido e IA (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/contenido-orrery/), inventados: ninguna persona ni número real. Tienen la
// FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura pasa por el mismo
// `vistaContenido` que la hoja de verdad. Las cifras cierran entre tarjetas: el costo de cada día suma el costo del período, las
// funciones suman las llamadas, los pedidos a Flow de cada día suman los del período y cuadran con lo que salió bien.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const redondo = (v: number) => Math.round(v * 100) / 100;

// Lo gastado cada día de los últimos 30 (en dólares) y las llamadas de cada día.
const COSTO = [1.2, 1.4, 1.1, 0.9, 1.6, 2.1, 1.8, 1.3, 1.2, 1.5, 2.4, 2.2, 1.9, 1.4, 1.1, 1.3, 1.7, 2.6, 2.3, 1.8, 1.5, 1.4, 1.6, 2.0, 2.8, 2.5, 1.9, 1.6, 1.7, 2.2];
const LLAMADAS = [210, 240, 190, 160, 270, 340, 300, 220, 205, 250, 380, 360, 310, 230, 190, 220, 280, 410, 370, 300, 250, 235, 265, 330, 440, 400, 310, 270, 285, 350];
// [función, llamadas]: suman las de cada día.
const FUNCIONES: Array<[string, number]> = [['Chat de MaKo', 3120], ['Guiones de anuncios', 1840], ['Lector de reuniones', 1310], ['Respuestas de WhatsApp', 1080], ['Resumen del día', 610], ['Clasificar leads', 380], ['Leer documentos', 230]];
// [modelo, costo]: suman el costo del período.
const MODELOS: Array<[string, number]> = [['Gemini Flash', 26.4], ['Claude Haiku', 14.6], ['GPT mini', 7.2], ['Llama 70B', 3.8]];
// [persona, mensajes].
const QUIEN: Array<[string, number]> = [['Ana Ruiz', 184], ['Diego Paz', 122], ['Laura Méndez', 96], ['Carlos Ibarra', 41], ['Marta Solís', 17]];
// [tipo, pedidos, listos, fallidos].
const FLOW: Array<[string, number, number, number]> = [['Video', 46, 43, 3], ['Imagen', 88, 87, 1]];
// Los pedidos a Flow de cada día: suman los del período (134).
const PEDIDOS_DIA = [4, 5, 4, 3, 6, 5, 5, 4, 5, 4, 3, 6, 5, 5, 4, 5, 4, 3, 6, 5, 5, 4, 5, 4, 3, 6, 5, 5, 3, 3];

export function datosContenidoMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, r: Resultado) => { if (k) out[k] = { resultado: r }; };
  const dias = COSTO.map((_, i) => dia(hoy, i - (COSTO.length - 1)));
  const serie = (vs: number[]) => vs.map((v, i) => ({ clave: dias[i], etiqueta: dias[i], valor: v }));
  const llamadas = LLAMADAS.reduce((a, b) => a + b, 0), costo = redondo(COSTO.reduce((a, b) => a + b, 0));
  const pedidos = FLOW.reduce((a, f) => a + f[1], 0), listos = FLOW.reduce((a, f) => a + f[2], 0), fallidos = FLOW.reduce((a, f) => a + f[3], 0);
  poner(p.apertura, { columnas: col(['llamadas']), filas: [], totales: [llamadas], anterior: [Math.round(llamadas / 1.12)], fuera: 0, clase: null });
  poner(p.costo, { columnas: col(['costo']), filas: [], totales: [costo], anterior: [redondo(costo / 1.08)], serie: serie(COSTO), fuera: 0, clase: null });
  poner(p.prom, { columnas: col(['costo_prom']), filas: [], totales: [costo / llamadas], anterior: [(costo / 1.08) / (llamadas / 1.12)], serie: serie(COSTO.map((c, i) => c / LLAMADAS[i])), fuera: 0, clase: null });
  poner(p.pedidos, { columnas: col(['trabajos']), filas: [], totales: [pedidos], serie: serie(PEDIDOS_DIA), fuera: 0, clase: null });
  poner(p.listos, { columnas: col(['tasa_exito']), filas: [], totales: [(listos / pedidos) * 100], serie: serie(PEDIDOS_DIA.map(() => 97)), fuera: 0, clase: null });
  poner(p.dias, { columnas: col(['costo']), totales: [costo], fuera: 0, clase: 'tiempo', filas: COSTO.map((v, i) => ({ clave: dias[i], etiqueta: dias[i], valores: [v] })) });
  const cat = (metrica: string, fs: Array<[string, number]>, tot: number): Resultado => ({ columnas: col([metrica]), totales: [tot], fuera: 0, clase: 'categoria', filas: fs.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })) });
  poner(p.funciones, cat('llamadas', FUNCIONES, llamadas));
  poner(p.modelos, cat('costo', MODELOS, costo));
  poner(p.quien, cat('mensajes', QUIEN, QUIEN.reduce((a, q) => a + q[1], 0)));
  poner(p.flow, {
    columnas: col(['trabajos', 'listos', 'fallidos', 'tasa_exito']), fuera: 0, clase: 'categoria', totales: [pedidos, listos, fallidos, (listos / pedidos) * 100],
    filas: FLOW.map(([k, n, l, f]) => ({ clave: k, etiqueta: k, valores: [n, l, f, (l / n) * 100] })),
  });
  return out;
}
