// =============================================================================
// instagram-diseno-muestra — los datos de EJEMPLO de la hoja «Instagram y redes» (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/instagram-murmura/), inventados: ninguna persona, anuncio ni número real.
// Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts) y del Calendario de General,
// así la miniatura pasa por el mismo `vistaInstagram` que la hoja de verdad. Las cifras cierran entre tarjetas: la frase de arriba es
// la fila de Instagram de «Cada red», el CTR sale de sus clics y sus vistas, y lo invertido con su costo por mil también.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { FormatoPublicacion, ItemCalendario } from './calendario-modelo';
import type { GeneralDeInstagram } from './instagram-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// [red, vistas, clics, agendas, alcance]: Instagram es la de la frase de arriba.
const REDES: Array<[string, number, number, number, number]> = [
  ['Instagram', 48200, 1230, 31, 21400], ['Facebook', 36900, 640, 18, 17800], ['Messenger', 5400, 90, 2, 3100], ['Audience Network', 3800, 40, 0, 2900],
];
const GASTO_IG = 412;
// [edad, vistas de Instagram]
const EDADES: Array<[string, number]> = [['18-24', 7600], ['25-34', 17900], ['35-44', 13400], ['45-54', 6200], ['55-64', 2300], ['65+', 800]];
const GENERO: Array<[string, number]> = [['Mujeres', 27300], ['Hombres', 19100], ['(sin dato)', 1800]];
const REGIONES: Array<[string, number]> = [['Jalisco', 12100], ['Nuevo León', 9300], ['Ciudad de México', 8800], ['Puebla', 4100]];
const ORIGEN: Array<[string, number]> = [['Formulario de Meta', 96], ['Landing', 58], ['WhatsApp', 34], ['Instagram (DM)', 21], ['Referido', 12], ['Manual', 7]];
// [anuncio, cierres, agendas, leads]: en el orden de la pieza (por los cierres).
const ANUNCIOS: Array<[string, number, number, number]> = [
  ['Reel: tres errores al vender por WhatsApp', 6, 14, 52], ['Carrusel: el método en cinco pasos', 4, 9, 38], ['Video: un día con una clienta', 3, 8, 31],
  ['Historia: la clase gratis del jueves', 2, 6, 24], ['Imagen: antes y después del programa', 1, 4, 19],
];
// Los leads de tus anuncios cada día (los últimos 30) y sus agendas.
const LEADS = [5, 8, 6, 4, 7, 9, 6, 5, 10, 7, 6, 8, 12, 9, 7, 6, 8, 11, 7, 6, 9, 8, 13, 9, 7, 10, 8, 6, 9, 7];
const AGENDAS = [1, 2, 1, 0, 1, 2, 1, 1, 3, 1, 1, 2, 3, 2, 1, 1, 2, 3, 1, 1, 2, 2, 3, 2, 1, 2, 2, 1, 2, 1];

export function datosInstagramMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, r: Resultado) => { if (k) out[k] = { resultado: r }; };
  const [, vIg, cIg, aIg] = REDES[0];
  const uno = (metrica: string, v: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], fuera: 0, clase: null });
  const cat = (metrica: string, fs: Array<[string, number]>): Resultado => ({
    columnas: col([metrica]), totales: [fs.reduce((a, f) => a + f[1], 0)], fuera: 0, clase: 'categoria', filas: fs.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })),
  });
  poner(p.apertura, { columnas: col(['impresiones', 'clics', 'agendas']), filas: [], totales: [vIg, cIg, aIg], fuera: 0, clase: null });
  poner(p.ctr, uno('ctr', (cIg / vIg) * 100));
  poner(p.cpm, uno('cpm', (GASTO_IG / vIg) * 1000));
  poner(p.gasto, uno('gasto', GASTO_IG));
  poner(p.plataformas, {
    columnas: col(['impresiones', 'clics', 'agendas', 'alcance']), fuera: 0, clase: 'categoria',
    totales: [REDES.reduce((a, r) => a + r[1], 0), REDES.reduce((a, r) => a + r[2], 0), REDES.reduce((a, r) => a + r[3], 0), null],
    filas: REDES.map(([k, v, c, a, al]) => ({ clave: k, etiqueta: k, valores: [v, c, a, al] })),
  });
  poner(p.edad, cat('impresiones', EDADES));
  poner(p.genero, cat('impresiones', GENERO));
  poner(p.region, cat('impresiones', REGIONES));
  poner(p.origen, cat('leads', ORIGEN));
  poner(p.anuncios, {
    columnas: col(['cierres', 'agendas', 'leads']), fuera: 0, clase: 'categoria',
    totales: [ANUNCIOS.reduce((a, x) => a + x[1], 0), ANUNCIOS.reduce((a, x) => a + x[2], 0), ANUNCIOS.reduce((a, x) => a + x[3], 0)],
    filas: ANUNCIOS.map(([k, ci, ag, le], i) => ({ clave: `ad-${i + 1}`, etiqueta: k, valores: [ci, ag, le] })),
  });
  poner(p.leads, {
    columnas: col(['leads', 'agendas']), fuera: 0, clase: 'tiempo',
    totales: [LEADS.reduce((a, b) => a + b, 0), AGENDAS.reduce((a, b) => a + b, 0)],
    filas: LEADS.map((v, i) => { const d = dia(hoy, -(LEADS.length - 1 - i)); return { clave: d, etiqueta: d, valores: [v, AGENDAS[i]] }; }),
  });
  return out;
}

// [días desde hoy, hora UTC, formato, título, notas]
const PUBLICACIONES: Array<[number, string, FormatoPublicacion, string, string]> = [
  [0, '16:30', 'story', 'Encuesta: ¿qué te frena para vender?', ''],
  [1, '09:00', 'reel', 'Tres errores al vender por WhatsApp', 'El gancho en los primeros dos segundos y la oferta de la clase gratis al final.'],
  [1, '13:00', 'post', 'Carrusel: el método en cinco pasos', ''],
  [1, '18:30', 'story', 'Detrás de cámaras de la clase', ''],
  [1, '20:00', 'story', 'Recordatorio de la clase gratis', ''],
  [2, '10:00', 'reel', 'Un día con una clienta del programa', ''],
  [2, '19:00', 'ad', 'Anuncio: la clase gratis del jueves', ''],
  [3, '09:30', 'post', 'Preguntas frecuentes del programa', ''],
  [3, '12:00', 'story', 'Cuenta regresiva de la clase', ''],
  [3, '17:00', 'reel', 'Lo que aprendí con cien clientas', ''],
  [4, '11:00', 'video', 'La clase gratis, completa', ''],
  [5, '10:00', 'post', 'Antes y después del programa', ''],
  [6, '09:00', 'reel', 'Tu primera venta en siete días', ''],
  [6, '18:00', 'story', 'Pregúntame lo que quieras', ''],
];

export function generalInstagramMuestra(hoy: string): GeneralDeInstagram {
  const items: ItemCalendario[] = PUBLICACIONES.map(([d, h, formato, titulo, notas], i) => ({
    id: `pub-${i + 1}`, fuente: 'propio', capa: 'publicaciones', titulo, inicio: `${dia(hoy, d)}T${h}:00.000Z`, fin: null, diaCompleto: false,
    href: '/calendario', detalle: null, tipo: 'publicacion', formato, notas, hecho: false,
  }));
  return { calendario: { ok: true, d: { items, tz: 'UTC', hoy, falla: false } } };
}
