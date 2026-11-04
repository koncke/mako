// =============================================================================
// chat-diseno-muestra — los datos de EJEMPLO de la hoja Chat Analyst (la miniatura de «Nueva hoja» y el arnés de la copia)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/chat-parley/mako.html), inventados: ningún cliente, setter ni número
// real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura
// pasa por el mismo `vistaChat` que la hoja de verdad y no tiene una segunda forma de armarse. Las últimas ocho columnas de los
// recibidos son las de Parley (212 … 386 … 318) y los enviados tienen la forma de su «Messages sent».
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './chat-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const un = (ids: string[], totales: number[], anterior?: number[]): DatosPieza => ({
  resultado: { columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}) } as Resultado,
});
const diaAntes = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// Treinta días, del más viejo a hoy (sin azar: la miniatura no cambia entre cargas).
const RECIBIDOS_ULTIMOS = [212, 268, 242, 345, 298, 386, 351, 318];
const ENVIADOS_FORMA = [44, 48, 41, 51, 58, 56, 49, 46, 52, 60, 64, 62, 58, 52, 54, 60, 68, 68, 64, 60, 59, 64, 70, 74, 72, 64, 64, 72, 78, 80];
const TURNOS_ULTIMOS = [42, 40, 51, 46, 58, 48, 66, 64, 70, 78, 61, 30];

function dias(hoy: string) {
  return Array.from({ length: 30 }, (_, k) => {
    const i = 29 - k, ola = Math.sin(k / 2.4) * 0.16;
    const recibidos = k >= 22 ? RECIBIDOS_ULTIMOS[k - 22] : Math.round(104 * (1 + k * 0.012 + ola));
    const enviados = ENVIADOS_FORMA[k] * 41 - (i === 0 ? 1900 : 0);
    const turnos = k >= 18 ? TURNOS_ULTIMOS[k - 18] : Math.round(46 * (1 + k * 0.01 + ola));
    const respondidos = Math.round(turnos * (k === 29 ? 0.7 : 0.82 + Math.sin(k) * 0.05));
    return { clave: diaAntes(hoy, i), recibidos, enviados, turnos, respondidos };
  });
}

// Lo recibido por tipo es el 52/31/17 de Parley (SMS, WhatsApp, Email); lo enviado, casi todo texto.
const TIPOS: Array<[string, number, number]> = [['Texto', 0.52, 0.9], ['Audio', 0.31, 0.07], ['Imagen', 0.17, 0.03]];
// La parte de cada setter es la de los «Top contacts» de Parley (486, 352, 297, 214, 168 de 1,517).
const SETTERS: Array<[string, number, number]> = [['Ana Ruiz', 486, 61], ['Luis Pérez', 352, 48], ['Inés Díaz', 297, 52], ['Kenji Mora', 214, 39], ['Rita Abad', 168, 44]];

export function datosChatMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const ds = dias(hoy);
  const suma = (k: 'recibidos' | 'enviados' | 'turnos' | 'respondidos') => ds.reduce((a, d) => a + d[k], 0);
  const turnos = suma('turnos'), respondidos = suma('respondidos');
  const pctResp = Math.round((respondidos / turnos) * 1000) / 10;
  const porDia: Resultado = {
    columnas: col(['recibidos', 'enviados']), totales: [suma('recibidos'), suma('enviados')], fuera: 0, clase: 'tiempo',
    filas: ds.map((d) => ({ clave: d.clave, etiqueta: d.clave, valores: [d.recibidos, d.enviados] })),
  };
  const respDia: Resultado = {
    columnas: col(['turnos', 'respondidos']), totales: [turnos, respondidos], fuera: 0, clase: 'tiempo',
    filas: ds.map((d) => ({ clave: d.clave, etiqueta: d.clave, valores: [d.turnos, d.respondidos] })),
  };
  // Las partes suman lo mismo que los recibidos y los enviados de las otras tarjetas.
  const rec = suma('recibidos'), env = suma('enviados');
  const reparto = (tot: number, i: 1 | 2) => { const v = TIPOS.map((t) => Math.round(tot * t[i])); v[0] += tot - v.reduce((a, b) => a + b, 0); return v; };
  const recT = reparto(rec, 1), envT = reparto(env, 2);
  const tipos: Resultado = {
    columnas: col(['mensajes']), totales: [rec + env], fuera: 0, clase: 'categoria',
    filas: TIPOS.map(([n], i) => ({ clave: n, etiqueta: n, valores: [recT[i] + envT[i]] })),
    cruce: { claves: ['Enviado', 'Recibido'], celdas: TIPOS.map((_, i) => [envT[i], recT[i]]) },
  };
  // Los setters suman las veces del período: se reparte cada parte de Parley sobre ellas.
  const base = SETTERS.reduce((a, s) => a + s[1], 0);
  const porSetter = SETTERS.map((s) => Math.round((s[1] / base) * turnos));
  porSetter[0] += turnos - porSetter.reduce((a, b) => a + b, 0);
  const setters: Resultado = {
    columnas: col(['turnos', 'pct_rapidos']), totales: [turnos, 45], fuera: 0, clase: 'categoria',
    filas: SETTERS.map(([n, , r], i) => ({ clave: n, etiqueta: n, valores: [porSetter[i], r] })),
  };
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, d: DatosPieza) => { if (k) out[k] = d; };
  poner(p.apertura, un(['turnos', 'pct_respondidos'], [turnos, pctResp], [turnos - 120, pctResp - 1.4]));
  poner(p.recibidos, un(['recibidos'], [suma('recibidos')], [Math.round(suma('recibidos') / 1.09)]));
  poner(p.chats, un(['chats'], [318]));
  poner(p.esperando, un(['sin_responder'], [12]));
  poner(p.rapidos, un(['pct_rapidos'], [45], [42.2]));
  poner(p.mediana, un(['mediana_respuesta'], [6]));
  poner(p.lento, un(['p90_respuesta'], [312]));
  poner(p.dias, { resultado: porDia });
  poner(p.respondidos, { resultado: respDia });
  poner(p.tipos, { resultado: tipos });
  poner(p.setters, { resultado: setters });
  return out;
}
