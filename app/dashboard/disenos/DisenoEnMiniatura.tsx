'use client';

// =============================================================================
// DisenoEnMiniatura — la miniatura de «Nueva hoja» de una plantilla con DISEÑO PROPIO: el diseño de verdad, en chico
// =============================================================================
// Martín, 4/11/2026, mirando producción: «en "Closing" la miniatura no es para nada igual». La miniatura dibujaba la GRILLA de
// la plantilla (sus tarjetas en sus lugares), y mirando la hoja se ve su DISEÑO (la copia de Halden). Ahora una plantilla con
// diseño se dibuja con SU componente —el mismo que monta el Dashboard (./HojaClosing.tsx, ./HojaCobranza.tsx, ./HojaFocus.tsx)—, con los datos de ejemplo de cada
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
import { HojaFocus } from './HojaFocus';
import type { VistaFocus } from '@/lib/focus-diseno';

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

/**
 * El día de ejemplo de Focus, con la forma que dibuja la hoja (lib/focus-diseno.ts): los de la maqueta de la adaptación
 * (docs/diseno/mockups-dashboard/focus-pane/focus.html). Focus no lee piezas: lee los datos de General, que la galería no tiene.
 */
function vistaFocusMuestra(hoy: string): VistaFocus {
  const lunes = dia(hoy, -((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7));
  const cuantos = [1, 2, 4, 1, 1, 0, 0];
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((etiqueta, i) => {
    const d = dia(lunes, i);
    return { dia: d, etiqueta, n: cuantos[i], tipo: (d < hoy ? 'pasado' : d === hoy ? 'hoy' : 'futuro') as 'pasado' | 'hoy' | 'futuro' };
  });
  const ev = (id: string, titulo: string, hora: string, llamada = false, fin: string | null = null) =>
    ({ id, titulo, inicio: `${hoy}T${hora}:00Z`, fin: fin ? `${hoy}T${fin}:00Z` : null, diaCompleto: false, detalle: llamada ? 'Llamada de venta' : null, href: llamada ? '/crm' : null, llamada });
  const ventas = { nombre: 'Ventas de noviembre', color: '#2F6FED' }, creativos = { nombre: 'Creativos de Meta', color: '#7C5CFB' };
  return {
    resumen: { tareas: { cerradas: 2, total: 7 }, llamadas: { pasaron: 1, total: 3 }, vencidas: 1 },
    anillos: [{ id: 'tareas', nombre: 'Tareas', v: 2, de: 7 }, { id: 'llamadas', nombre: 'Llamadas', v: 1, de: 3 }, { id: 'kpis', nombre: 'KPIs del día', v: 2, de: 4 }],
    viene: {
      proxima: ev('p', 'R2 con Laura Méndez', '11:30', true, '12:15'),
      despues: [ev('a', 'R1 con Carlos Ibarra', '16:00', true), ev('b', 'Revisión de creativos', '17:30'), ev('c', 'Publicación: reel del método', '19:00')],
    },
    meta: { titulo: 'US$30,000 de facturación', pct: 62, esperado: 58, diasRestantes: 57, atrasado: false },
    tareas: {
      deHoy: true,
      lista: [
        { id: '1', titulo: 'Preparar la R2 de Laura Méndez', proyecto: ventas, cuando: 'Hoy', prio: 'urgente' },
        { id: '2', titulo: 'Grabar tres hooks nuevos', proyecto: creativos, cuando: 'Hoy', prio: 'alta' },
        { id: '3', titulo: 'Revisar el guion de la VSL', proyecto: { nombre: 'Nueva VSL', color: '#1E9E57' }, cuando: 'Hoy', prio: 'alta' },
        { id: '4', titulo: 'Mandar la propuesta a Jorge Salinas', proyecto: ventas, cuando: 'Ayer', prio: 'urgente' },
        { id: '5', titulo: 'Armar el reporte de octubre', proyecto: { nombre: 'Operación', color: '#C8870C' }, cuando: 'Hoy', prio: null },
        { id: '6', titulo: 'Responder las dudas del taller', proyecto: { nombre: 'Taller grupal', color: '#D6489B' }, cuando: 'Hoy', prio: null },
      ],
    },
    semana: { dias, total: cuantos.reduce((a, b) => a + b, 0), vencidas: 1 },
    proyectos: [
      { id: 'p1', nombre: 'Ventas de noviembre', emoji: '🚀', color: '#2F6FED', deadline: dia(hoy, 26), pct: 47, abiertas: 8 },
      { id: 'p2', nombre: 'Creativos de Meta', emoji: '🎬', color: '#7C5CFB', deadline: dia(hoy, 7), pct: 45, abiertas: 5 },
      { id: 'p3', nombre: 'Nueva VSL', emoji: '🧭', color: '#1E9E57', deadline: dia(hoy, 11), pct: 50, abiertas: 3 },
      { id: 'p4', nombre: 'Taller grupal', emoji: '🎓', color: '#D6489B', deadline: dia(hoy, 28), pct: 30, abiertas: 6 },
      { id: 'p5', nombre: 'Campaña de fin de año', emoji: '📣', color: '#C8870C', deadline: dia(hoy, 63), pct: 0, abiertas: 4 },
    ],
    espera: {
      cobros: [
        { leadId: 1, pagoId: 1, nombre: 'Carlos Méndez', linea: 'US$2,475 · venció hace 67 días', urgencia: 'vencida' },
        { leadId: 2, pagoId: 2, nombre: 'Lucía Ramos', linea: 'US$5,181 · venció hace 5 días', urgencia: 'vencida' },
        { leadId: 3, pagoId: 3, nombre: 'Diego Fuentes', linea: 'US$2,007 · vence hoy', urgencia: 'pronto' },
        { leadId: 4, pagoId: 4, nombre: 'Sofía Herrera', linea: 'US$1,200 · vence el viernes', urgencia: null },
        { leadId: 5, pagoId: 5, nombre: 'Pablo Ortiz', linea: 'US$600 · vence el 12/11', urgencia: null },
        { leadId: 6, pagoId: 6, nombre: 'Valeria Castro', linea: 'US$920 · vence el 14/11', urgencia: null },
      ],
      leads: [{ tipo: 'A', n: 3, texto: 'sin asistencia a R1' }],
    },
  };
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
  foco: ({ hoy }) => (
    <HojaFocus vista={vistaFocusMuestra(hoy)} titulo="Buenos días, Ana" sub="Miércoles 4 de noviembre · 3 llamadas y 7 tareas para hoy" hoy={hoy} tz="UTC"
      ahora={null} metaAccion={<span className="fp-btn fp-btn--accent fp-focus__go">Editar la meta</span>} onGrilla={() => {}} quieta />
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
