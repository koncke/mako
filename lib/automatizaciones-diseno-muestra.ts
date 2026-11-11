// =============================================================================
// automatizaciones-diseno-muestra — los datos de EJEMPLO de la hoja Automatizaciones (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/automatizaciones-noria/mako.html), inventados: ningún cliente ni número
// real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura
// pasa por el mismo `vistaAutomatizaciones` que la hoja de verdad. Las cifras cierran entre tarjetas: lo que falló por día suma lo
// que falló por automatización, y los envíos de los 14 días salen de los mismos días que el pulso.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[], formato: 'numero' | 'pct' = 'numero') => ids.map((id) => ({ id, nombre: id, formato }));
const diaAntes = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// [nombre, envíos por día (base), cada cuántos días falla una, respuestas por cada 100]
const AUTOS: Array<[string, number, number, number]> = [
  ['Bienvenida', 22, 9, 31], ['Recordatorio de la llamada', 16, 6, 18], ['Seguimiento sin respuesta', 12, 3, 9],
  ['Cobranza de cuotas', 8, 11, 22], ['Reactivación', 6, 4, 6], ['Aviso al equipo', 4, 0, 0], ['Encuesta de satisfacción', 3, 5, 27],
];
const DIAS = 30;

function porDiaYAuto(hoy: string) {
  return Array.from({ length: DIAS }, (_, k) => {
    const i = DIAS - 1 - k, finde = new Date(`${diaAntes(hoy, i)}T12:00:00Z`).getUTCDay() % 6 === 0, ola = 1 + Math.sin(k / 2.6) * 0.18;
    const hoyMitad = i === 0 ? 0.45 : 1;
    const autos = AUTOS.map(([, base, cada], j) => {
      const envios = Math.max(0, Math.round(base * ola * (finde ? 0.5 : 1) * hoyMitad + ((k + j) % 3) - 1));
      const fallos = cada && (k + j * 2) % cada === 0 ? Math.min(envios, 1 + ((k + j) % 2)) : 0;
      return { envios, fallos };
    });
    return { clave: diaAntes(hoy, i), autos };
  });
}

export function datosAutomatizacionesMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const ds = porDiaYAuto(hoy);
  const envAuto = AUTOS.map((_, j) => ds.reduce((a, d) => a + d.autos[j].envios, 0));
  const falAuto = AUTOS.map((_, j) => ds.reduce((a, d) => a + d.autos[j].fallos, 0));
  const envios = envAuto.reduce((a, b) => a + b, 0), fallaron = falAuto.reduce((a, b) => a + b, 0), enviados = envios - fallaron;
  const respAuto = AUTOS.map(([, , , r], j) => Math.round((envAuto[j] * r) / 100));
  const respuestas = respAuto.reduce((a, b) => a + b, 0);
  const tasaResp = Math.round((respuestas / envios) * 1000) / 10;
  const porTiempo = (metricas: string[], valores: (d: (typeof ds)[number]) => number[]): Resultado => ({
    columnas: col(metricas), fuera: 0, clase: 'tiempo', totales: metricas.map((_, m) => ds.reduce((a, d) => a + valores(d)[m], 0)),
    filas: ds.map((d) => ({ clave: d.clave, etiqueta: d.clave, valores: valores(d) })),
  });
  const cruce = (que: 'envios' | 'fallos', orden: number[]): Resultado => {
    const idx = AUTOS.map((_, j) => j).filter((j) => orden[j] > 0).sort((a, b) => orden[b] - orden[a]);
    return {
      ...porTiempo([que === 'envios' ? 'envios' : 'fallaron'], (d) => [d.autos.reduce((a, x) => a + x[que], 0)]),
      cruce: { claves: idx.map((j) => AUTOS[j][0]), celdas: ds.map((d) => idx.map((j) => d.autos[j][que])) },
    };
  };
  const orden = AUTOS.map((_, j) => j).sort((a, b) => envAuto[b] - envAuto[a]);
  const tabla: Resultado = {
    columnas: [...col(['envios', 'fallaron', 'respuestas']), { id: 'tasa_respuesta', nombre: 'tasa_respuesta', formato: 'pct' }, ...col(['leads', 'escritos'])],
    totales: [envios, fallaron, respuestas, tasaResp, 412, 412], fuera: 0, clase: 'categoria',
    filas: orden.map((j) => ({ clave: AUTOS[j][0], etiqueta: AUTOS[j][0], valores: [envAuto[j], falAuto[j], respAuto[j], Math.round((respAuto[j] / envAuto[j]) * 1000) / 10, Math.round(envAuto[j] / 3.1), Math.round(envAuto[j] / 3.1)] })),
  };
  const fallos: Resultado = {
    columnas: col(['fallaron']), totales: [fallaron], fuera: 0, clase: 'categoria',
    filas: AUTOS.map((_, j) => j).filter((j) => falAuto[j] > 0).sort((a, b) => falAuto[b] - falAuto[a]).map((j) => ({ clave: AUTOS[j][0], etiqueta: AUTOS[j][0], valores: [falAuto[j]] })),
  };
  const recorrido: Resultado = {
    columnas: col(['personas', 'respondieron', 'en_curso']), totales: [436, 97, 151], fuera: 0, clase: 'categoria',
    filas: [['Terminó la secuencia', 168, 0, 0], ['Sigue en el flujo', 151, 0, 151], ['Respondió', 71, 71, 0], ['Pasó a una persona', 26, 26, 0], ['Se dio de baja', 20, 0, 0]]
      .map(([n, a, b, c]) => ({ clave: String(n), etiqueta: String(n), valores: [Number(a), Number(b), Number(c)] })),
  };
  const horas: Resultado = {
    columnas: col(['horas_respuesta', 'respondieron']), totales: [5.8, 97], fuera: 0, clase: 'categoria',
    filas: [['Seguimiento sin respuesta', 19.5, 11], ['Reactivación', 12.4, 5], ['Recordatorio de la llamada', 6.2, 22], ['Cobranza de cuotas', 3.9, 14], ['Bienvenida', 1.6, 38], ['Encuesta de satisfacción', 0.6, 7]]
      .map(([n, h, r]) => ({ clave: String(n), etiqueta: String(n), valores: [Number(h), Number(r)] })),
  };
  const un = (ids: string[], totales: number[], anterior?: number[], formato: 'numero' | 'pct' = 'numero'): DatosPieza => ({
    resultado: { columnas: col(ids, formato), filas: [], totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}) },
  });
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, d: DatosPieza) => { if (k) out[k] = d; };
  poner(p.apertura, un(['enviados', 'fallaron', 'respuestas'], [enviados, fallaron, respuestas], [Math.round(enviados / 1.12), fallaron + 9, Math.round(respuestas / 1.2)]));
  poner(p.respuesta, un(['tasa_respuesta'], [tasaResp], [tasaResp - 1.6], 'pct'));
  poner(p.entraron, un(['personas'], [436], [391]));
  poner(p.dias, { resultado: porTiempo(['enviados', 'fallaron'], (d) => { const f = d.autos.reduce((a, x) => a + x.fallos, 0); return [d.autos.reduce((a, x) => a + x.envios, 0) - f, f]; }) });
  poner(p.tabla, { resultado: tabla });
  poner(p.recorrido, { resultado: recorrido });
  poner(p.fallos, { resultado: fallos });
  poner(p.horas, { resultado: horas });
  poner(p.vol, { resultado: cruce('envios', envAuto) });
  poner(p.fal, { resultado: cruce('fallos', falAuto) });
  return out;
}
