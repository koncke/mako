// =============================================================================
// cold-calling-diseno-muestra — los datos de EJEMPLO de la hoja «Cold Calling» (la miniatura de «Nueva hoja» y el arnés de la captura)
// =============================================================================
// Inventados: ningún lead, persona ni número real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`,
// lib/graficos-agregar.ts), así la miniatura pasa por el mismo `vistaColdCalling` que la hoja de verdad. Las cifras cierran entre
// tarjetas: las llamadas de los días, de «Cómo terminan» y de «Quién llamó» suman las de la cabecera; lo que contestó (agendó, habló o
// no le interesa) suma lo de los días.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { ROTULO_RESULTADO, SIN_MARCAR } from './grabar-llamada-reglas';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// [llamadas, contestaron, agendaron] de los siete días, del más viejo a hoy.
const DIAS: Array<[number, number, number]> = [[14, 6, 1], [19, 9, 2], [22, 10, 3], [17, 8, 2], [21, 10, 3], [15, 7, 1], [18, 8, 2]];
const LLAMADAS = DIAS.reduce((a, d) => a + d[0], 0), CONTESTARON = DIAS.reduce((a, d) => a + d[1], 0), AGENDARON = DIAS.reduce((a, d) => a + d[2], 0);
// Cómo terminaron: agendó + habló + no le interesa = las que contestaron; el resto no contestó o quedó sin marcar.
const TERMINAN: Array<[string, number]> = [
  [ROTULO_RESULTADO.agendo, AGENDARON], [ROTULO_RESULTADO.hablo, 31], [ROTULO_RESULTADO.no_interesa, CONTESTARON - AGENDARON - 31],
  [ROTULO_RESULTADO.no_contesto, 61], [SIN_MARCAR, LLAMADAS - CONTESTARON - 61],
];
// [quién, llamadas, contestaron, agendaron]
const QUIEN: Array<[string, number, number, number]> = [['Daniela Ortiz', 48, 22, 6], ['Marcos Rivas', 39, 17, 4], ['Luisa Méndez', 27, 13, 3], ['Andrés Salas', 12, 6, 1]];
const NOMBRES = ['Camila Rojas', 'Javier Núñez', 'Sara Delgado', 'Tomás Herrera', 'Valeria Campos', 'Diego Fuentes', 'Paula Romero', 'Iván Molina', 'Lucía Vargas', 'Hernán Bravo', 'Clara Ibáñez', 'Rubén Aguilar', 'Elisa Paredes', 'Gonzalo Ríos', 'Natalia Cruz', 'Óscar Medina'];
const RESULTADOS = [ROTULO_RESULTADO.agendo, ROTULO_RESULTADO.hablo, SIN_MARCAR, ROTULO_RESULTADO.no_contesto, ROTULO_RESULTADO.hablo, ROTULO_RESULTADO.no_interesa, ROTULO_RESULTADO.no_contesto];
// 63 leads con dos llamadas cada uno (126); la tabla trae 50 y deja afuera 13.
const LEADS = 63, LIMITE = 50;

export function datosColdCallingMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, x: Resultado) => { if (k) out[k] = { resultado: x }; };
  const kpi = (metrica: string, v: number, antes?: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], ...(antes != null ? { anterior: [antes] } : {}), fuera: 0, clase: null });

  poner(p.llamadas, kpi('llamadas', LLAMADAS, 104));
  poner(p.contacto, kpi('tasa_contacto', Math.round((CONTESTARON / LLAMADAS) * 1000) / 10));
  poner(p.agendaron, kpi('agendaron', AGENDARON));
  poner(p.dias, {
    columnas: col(['llamadas', 'contestaron', 'agendaron']), fuera: 0, clase: 'tiempo', totales: [LLAMADAS, CONTESTARON, AGENDARON],
    filas: DIAS.map(([l, c, a], k) => { const d = dia(hoy, k - (DIAS.length - 1)); return { clave: d, etiqueta: d, valores: [l, c, a] }; }),
  });
  poner(p.terminan, { columnas: col(['llamadas']), fuera: 0, clase: 'categoria', totales: [LLAMADAS], filas: TERMINAN.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })) });
  poner(p.quien, {
    columnas: col(['llamadas', 'contestaron', 'agendaron', 'tasa_contacto']), fuera: 0, clase: 'categoria', totales: [LLAMADAS, CONTESTARON, AGENDARON, Math.round((CONTESTARON / LLAMADAS) * 1000) / 10],
    filas: QUIEN.map(([k, l, c, a]) => ({ clave: k, etiqueta: k, valores: [l, c, a, Math.round((c / l) * 1000) / 10] })),
  });
  const minutos = Array.from({ length: LEADS }, (_, i) => 2 + ((i * 7) % 11));
  poner(p.leads, {
    columnas: col(['llamadas', 'minutos']), fuera: LEADS - LIMITE, clase: 'categoria', totales: [LLAMADAS, minutos.reduce((a, m) => a + m, 0)],
    columnasExtra: [{ id: 'resultado', nombre: 'Cómo terminó' }],
    filas: Array.from({ length: LIMITE }, (_, i) => {
      const n = `${NOMBRES[i % NOMBRES.length]}${i >= NOMBRES.length ? ` ${Math.floor(i / NOMBRES.length) + 1}` : ''}`;
      return { clave: `lead-${i + 1}`, etiqueta: n, valores: [2, minutos[i]], extra: { resultado: RESULTADOS[i % RESULTADOS.length] } };
    }),
  });
  return out;
}
