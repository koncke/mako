'use client';

// =============================================================================
// DisenoEnMiniatura — la miniatura de «Nueva hoja» de una plantilla con DISEÑO PROPIO: el diseño de verdad, en chico
// =============================================================================
// Martín, 4/11/2026, mirando producción: «en "Closing" la miniatura no es para nada igual». La miniatura dibujaba la GRILLA de
// la plantilla (sus tarjetas en sus lugares), y mirando la hoja se ve su DISEÑO (la copia de Halden). Ahora una plantilla con
// diseño se dibuja con SU componente —el mismo que monta el Dashboard (./HojaClosing.tsx, ./HojaCobranza.tsx)—, con los datos de ejemplo de cada
// pieza (lib/graficos-muestra.ts, los mismos que la miniatura de una grilla) y QUIETO: sin la entrada, sin cifras que cuentan
// y sin leer la caja de IA. Lo escala ./MiniaturaHoja.tsx.
//
// ⚠️ UN DISEÑO NUEVO NO COMPILA HASTA TENER SU MINIATURA: `MINIATURAS` es total sobre `DISENOS_HOJA`.
// ⚠️ LOS NOMBRES DE EJEMPLO SON FICTICIOS (AGENTS.md: un ejemplo de pantalla nunca es de un cliente real).
// =============================================================================

import { useMemo, type ReactNode } from 'react';
import { esGrafico, type DisenoHoja, type Hoja } from '@/lib/graficos-catalogo';
import type { Resultado } from '@/lib/graficos-agregar';
import { resultadoDeMuestra } from '@/lib/graficos-muestra';
import type { DatosPieza } from '@/lib/closing-diseno';
import { HojaClosing, type ExtrasClosing } from './HojaClosing';
import { HojaCobranza } from './HojaCobranza';

const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const resultado = (columnas: string[], totales: Array<number | null>, filas: Resultado['filas'] = [], anterior?: Array<number | null>): DatosPieza => ({
  cargando: false,
  resultado: { columnas: columnas.map((id) => ({ id, nombre: id, formato: 'numero' })), filas, totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}) } as unknown as Resultado,
});
const fila = (clave: string, valores: number[], extra?: Record<string, string>) => ({ clave, etiqueta: clave, valores, ...(extra ? { extra } : {}) });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Los números de ejemplo de cada bloque de Closing, con la forma que lee el diseño (lib/closing-diseno.ts). Los de lib/graficos-muestra.ts
 * son de una tarjeta de la grilla y en este diseño se leían raros (un puntaje de 50, una llamada de 2 horas y media, «Opción C»).
 * Son los mismos de las capturas del componente (docs/diseno/mockups-dashboard/closing/captura/producto-*.png).
 */
function datosClosing(hoja: Hoja, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const lunes = (() => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const hechos = [5, 7, 4, 6, 3, 2, 1].map((n, i) => ({ d: dia(lunes, i), n })).filter((x) => x.d <= hoy);
  const out: Record<string, DatosPieza> = {
    tasa: resultado(['tasa_cierre'], [38], [], [32]),
    embudo: resultado(['r1', 'r2', 'ganadas_r2'], [12, 18, 7]),
    analizadas: resultado(['llamadas'], [29]), puntaje: resultado(['puntaje'], [7.4]), duracion: resultado(['duracion'], [42.2]),
    semana: resultado(['llamadas'], [hechos.reduce((s, x) => s + x.n, 0)], hechos.map((x) => fila(x.d, [x.n]))),
    ultimas: resultado(['puntaje', 'duracion'], [null, null], [
      fila('Laura Méndez', [8.6, 48], { dia: ddmm(hoy), reunion: 'R2', closer: 'Ana Ruiz' }), fila('Carlos Ibarra', [5.2, 31], { dia: ddmm(dia(hoy, -1)), reunion: 'R1', closer: 'Diego Paz' }),
      fila('Paola Núñez', [7.1, 44], { dia: ddmm(dia(hoy, -1)), reunion: 'R1', closer: 'Sofía Lara' }), fila('Jorge Salinas', [8.1, 39], { dia: ddmm(dia(hoy, -2)), reunion: 'R1', closer: 'Ana Ruiz' }),
      fila('Marta Ríos', [6.8, 52], { dia: ddmm(dia(hoy, -3)), reunion: 'R2', closer: 'Lucía Gómez' }),
    ]),
    closers: resultado(['llamadas', 'puntaje', 'ganadas', 'tasa_cierre', 'ganadas_r2', 'perdidas'], [29, 7.4, 11, 38, 7, 10], [
      fila('Ana Ruiz', [11, 8, 5, 45, 3, 4]), fila('Diego Paz', [8, 7, 3, 38, 2, 3]), fila('Sofía Lara', [6, 7, 2, 33, 1, 2]), fila('Lucía Gómez', [4, 6, 1, 25, 1, 1]),
    ]),
  };
  // Cada bloque va al id de SU pieza; «Cómo terminaron» lee la tabla de los closers (la misma pieza en la plantilla).
  return Object.fromEntries(Object.entries(p).flatMap(([k, id]) => (out[k] ? [[id, out[k]]] : k === 'desenlace' ? [[id, out.closers]] : [])));
}

/** La agenda de ejemplo de Closing: las agendadas de los días que vienen y la próxima llamada. */
function extrasClosing(hoy: string): ExtrasClosing {
  return {
    agenda: {
      tz: 'UTC',
      porDia: { [dia(hoy, 1)]: 3, [dia(hoy, 2)]: 4, [dia(hoy, 3)]: 2 },
      proxima: { nombre: 'Raúl Ortega', cual: 'R2', inicio: `${dia(hoy, 1)}T15:00:00.000Z`, diaCompleto: false, closer: 'Ana Ruiz', leadId: 0 },
    },
    quien: null,
  };
}

/**
 * Los números de ejemplo de cada bloque de Cobranza: los de la maqueta (docs/diseno/mockups-dashboard/cobranza/cobranza.html),
 * con la forma que lee el diseño (lib/cobranza-diseno.ts).
 */
function datosCobranza(hoja: Hoja, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const mes = (n: number) => { const d = new Date(`${hoy.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };
  const entra = [12300, 40400, 27400, 31000, 31000, 29200, 51200, 19800, 33900, 26300, 18385, 4570];
  const sale = [0, 0, 0, 0, 0, 0, 0, 800, 1200, 2475, 3015, 2250];
  const out: Record<string, DatosPieza> = {
    atraso: resultado(['pendiente', 'pagos', 'clientes'], [41179, 18, 9], [
      fila('Al día', [31516, 15, 7]), fila('1-30 días', [7189, 2, 2]), fila('31-60 días', [0, 0, 0]), fila('60+ días', [2475, 1, 1]),
    ]),
    cobrado: resultado(['cobrado'], [4570], [], [18385]),
    vence: resultado(['monto'], [6820], [], [21400]),
    falta: resultado(['pendiente'], [2250], [], [3015]),
    demora: resultado(['atraso_pago'], [6], [], [4]),
    meses: resultado(['cobrado', 'pendiente'], [null, null], entra.map((e, i) => fila(mes(11 - i), [e, sale[i]]))),
    perseguir: resultado(['pendiente', 'proxima_monto', 'dias'], [null, null, null], [
      fila('Carlos Méndez', [2475, 2475, -67], { proxima: 'Cuota 3' }), fila('Lucía Ramos', [5181, 5181, -5], { proxima: 'Cuota 2' }),
      fila('Diego Fuentes', [2007.5, 2007.5, -2], { proxima: 'Cuota 4' }),
    ]),
    ultimos: resultado(['cobrado'], [null], [
      fila('Sofía Herrera · Cuota 2', [1200], { dia: ddmm(hoy) }), fila('Martina Rojas · Cuota 1', [850], { dia: ddmm(hoy) }),
      fila('Pablo Ortiz · Cuota 5', [600], { dia: ddmm(dia(hoy, -1)) }), fila('Valeria Castro · Cuota 3', [920], { dia: ddmm(dia(hoy, -1)) }),
      fila('Andrés Molina · Cuota 1', [1000], { dia: ddmm(dia(hoy, -2)) }), fila('Camila Vega · Cuota 2', [450], { dia: ddmm(dia(hoy, -3)) }),
      fila('Tomás Ibarra · Cuota 4', [500], { dia: ddmm(dia(hoy, -4)) }),
    ]),
    pagaron: resultado(['cobrado'], [null], [
      fila('Sofía Herrera', [12400]), fila('Pablo Ortiz', [9850]), fila('Valeria Castro', [7200]), fila('Andrés Molina', [5600]), fila('Camila Vega', [4900]),
    ]),
    funnel: resultado(['pendiente'], [null], [
      fila('Programa principal', [22400]), fila('Mentoría', [9800]), fila('Renovación', [5200]), fila('Taller', [2879]), fila('Comunidad', [900]),
    ]),
  };
  return Object.fromEntries(Object.entries(p).flatMap(([k, id]) => (out[k] ? [[id, out[k]]] : [])));
}

const MINIATURAS: Record<DisenoHoja['id'], (p: { hoja: Hoja; datos: Record<string, DatosPieza>; hoy: string }) => ReactNode> = {
  closing: ({ hoja, datos, hoy }) => (
    // Con sus botones y links, como se ve la hoja (en la miniatura no se tocan: `pointer-events: none`); `quieta` no lee la caja de IA.
    <HojaClosing hoja={hoja} datos={{ ...datos, ...datosClosing(hoja, hoy) }} extras={extrasClosing(hoy)} hoy={hoy} periodo="Este mes" onGrilla={() => {}} quieta />
  ),
  cobranza: ({ hoja, datos, hoy }) => (
    <HojaCobranza hoja={hoja} datos={{ ...datos, ...datosCobranza(hoja, hoy) }} extras={{ quien: { saludo: 'Buenos días', nombre: 'Ana', fecha: '' } }}
      hoy={hoy} periodo="Este mes" onGrilla={() => {}} onFila={() => {}} quieta />
  ),
};

export function DisenoEnMiniatura({ hoja, hoy }: { hoja: Hoja; hoy: string }) {
  const datos = useMemo(
    () => Object.fromEntries(hoja.componentes.filter(esGrafico).map((c) => [c.id, { cargando: false, resultado: resultadoDeMuestra(c, hoy) }])),
    [hoja, hoy],
  );
  const dibujar = hoja.diseno ? MINIATURAS[hoja.diseno.id] : undefined;
  return dibujar ? <>{dibujar({ hoja, datos, hoy })}</> : null;
}
