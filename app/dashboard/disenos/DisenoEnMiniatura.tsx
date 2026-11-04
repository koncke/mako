'use client';

// =============================================================================
// DisenoEnMiniatura — la miniatura de «Nueva hoja» de una plantilla con DISEÑO PROPIO: el diseño de verdad, en chico
// =============================================================================
// Martín, 4/11/2026, mirando producción: «en "Closing" la miniatura no es para nada igual». La miniatura dibujaba la GRILLA de
// la plantilla (sus tarjetas en sus lugares), y mirando la hoja se ve su DISEÑO (la copia de Halden). Ahora una plantilla con
// diseño se dibuja con SU componente —el mismo que monta el Dashboard (./HojaClosing.tsx)—, con los datos de ejemplo de cada
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

const MINIATURAS: Record<DisenoHoja['id'], (p: { hoja: Hoja; datos: Record<string, DatosPieza>; hoy: string }) => ReactNode> = {
  closing: ({ hoja, datos, hoy }) => (
    // Con sus botones y links, como se ve la hoja (en la miniatura no se tocan: `pointer-events: none`); `quieta` no lee la caja de IA.
    <HojaClosing hoja={hoja} datos={{ ...datos, ...datosClosing(hoja, hoy) }} extras={extrasClosing(hoy)} hoy={hoy} periodo="Este mes" onGrilla={() => {}} quieta />
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
