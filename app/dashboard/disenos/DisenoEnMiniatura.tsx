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
import { HojaMiDia } from './HojaMiDia';
import { mesDe, type VistaMiDia } from '@/lib/mi-dia-diseno';
import { HojaGeneral } from './HojaGeneral';
import { fraseGeneral, type VistaGeneral } from '@/lib/general-diseno';
import { HojaOperacion } from './HojaOperacion';
import type { VistaOperacion } from '@/lib/operacion-diseno';
import { HojaComercial } from './HojaComercial';
import { fraseComercial, type VistaComercial } from '@/lib/comercial-diseno';
import { HojaMarketing } from './HojaMarketing';
import { vistaMarketing } from '@/lib/marketing-diseno';
import { datosMarketingMuestra } from '@/lib/marketing-diseno-muestra';
import { HojaLanding } from './HojaLanding';
import { vistaLanding } from '@/lib/landing-diseno';
import { datosLandingMuestra } from '@/lib/landing-diseno-muestra';
import { HojaChat } from './HojaChat';
import { vistaChat } from '@/lib/chat-diseno';
import { datosChatMuestra } from '@/lib/chat-diseno-muestra';
import { HojaAutomatizaciones } from './HojaAutomatizaciones';
import { vistaAutomatizaciones } from '@/lib/automatizaciones-diseno';
import { datosAutomatizacionesMuestra } from '@/lib/automatizaciones-diseno-muestra';

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

/** «Mi día» de EJEMPLO (los de la maqueta, focus-lumora/mako.html: ficticios), para la miniatura de «Nueva hoja». */
function vistaMiDiaMuestra(hoy: string): VistaMiDia {
  const h = (hhmm: string) => Date.parse(`${hoy}T${hhmm}:00Z`);
  const ev = (id: string, titulo: string, detalle: string, ini: string, fin: string | null, tono: 'sky' | 'pine' | 'clay' | 'lemon', estado: 'paso' | 'ahora' | 'viene') =>
    ({ tipo: 'evento' as const, id, titulo, detalle, hora: ini, inicio: h(ini), fin: h(fin ?? ini) + (fin ? 0 : 30 * 60_000), tono, estado, href: null, hasta: fin });
  const eventos = [
    ev('e1', 'Revisión de creativos', 'Reunión', '09:00', '09:45', 'sky', 'paso'),
    ev('e2', 'R1 con Carlos Ibarra', 'Llamada', '11:00', '11:30', 'pine', 'ahora'),
    ev('e3', 'R2 con Laura Méndez', 'Llamada', '12:30', '13:15', 'pine', 'viene'),
    ev('e4', 'Reel del método', 'Publicación', '17:00', null, 'clay', 'viene'),
    ev('e5', 'R1 con Jorge Salinas', 'Llamada', '18:00', '18:30', 'pine', 'viene'),
  ];
  const [e1, e2, e3, e4, e5] = eventos;
  const puntos = [1, 5, 6, 8, 9].map((n) => ({ id: `p${n}`, fuente: 'crm' as const, capa: 'llamadas' as const, titulo: '', inicio: `${dia(hoy, n)}T15:00:00Z`, fin: null, diaCompleto: false, href: null }));
  return {
    semana: 'Semana 6 del Q4',
    resumen: { llamadas: 3, tareas: 5, vencidas: 2 },
    cinta: [e1, { tipo: 'pausa', id: 'pa', inicio: e1.fin, fin: e2.inicio }, e2, { tipo: 'pausa', id: 'pb', inicio: e2.fin, fin: e3.inicio }, e3,
      { tipo: 'libre', id: 'li', desde: '13:15', dura: '3 h 45 min', inicio: e3.fin, fin: e4.inicio }, e4, e5],
    proxima: { titulo: 'R2 con Laura Méndez', hora: '12:30', href: null },
    numeros: [
      { id: 'llamadas', titulo: 'Llamadas hoy', valor: 3, meter: 0.33, pie: 'Próxima:', destacado: '12:30 · R2 con Laura Méndez' },
      { id: 'tareas', titulo: 'Tareas de hoy', valor: 5, meter: 0.4, pie: '2 hechas', destacado: '1 vencida' },
      { id: 'cobros', titulo: 'Cuotas por cobrar', valor: 8, meter: 0.25, pie: 'De 6 clientes', destacado: '2 vencidas' },
      { id: 'kpis', titulo: 'KPIs del día', valor: 2, meter: 0.5, pie: 'En verde, de 4', destacado: null },
    ],
    vence: [
      { id: 'v1', titulo: 'Mandar la propuesta a Jorge Salinas', detalle: 'Ventas de noviembre · Ayer · Vencida', mes: 'Nov', dia: Number(dia(hoy, -1).slice(8)), tono: 'coral', href: '/plan' },
      { id: 'v2', titulo: 'Preparar la R2 de Laura Méndez', detalle: 'Ventas de noviembre · Hoy', mes: 'Nov', dia: Number(hoy.slice(8)), tono: 'marigold', href: '/plan' },
      { id: 'v3', titulo: 'Grabar tres hooks nuevos', detalle: 'Creativos de Meta · Hoy', mes: 'Nov', dia: Number(hoy.slice(8)), tono: 'marigold', href: '/plan' },
      { id: 'v4', titulo: 'Revisar el guion de la VSL', detalle: 'Nueva VSL · Viernes', mes: 'Nov', dia: Number(dia(hoy, 2).slice(8)), tono: 'pine', href: '/plan' },
      { id: 'v5', titulo: 'Creativos de Meta', detalle: 'Proyecto · 11/11', mes: 'Nov', dia: Number(dia(hoy, 7).slice(8)), tono: 'clay', href: '/plan' },
    ],
    funnel: { id: 1, nombre: 'Programa principal', principal: true, total: 74, etapas: [{ nombre: 'Nuevo', n: 38 }, { nombre: 'Agendó', n: 21 }, { nombre: 'Asistió', n: 9 }, { nombre: 'Propuesta', n: 6 }] },
    okrs: [{ titulo: 'Facturación', avance: 62, esperado: 58 }, { titulo: 'Ventas', avance: 71, esperado: 58 }, { titulo: 'Leads', avance: 48, esperado: 58 }, { titulo: 'Retención', avance: 80, esperado: 58 }],
    deben: [
      { leadId: 1, pagoId: 1, nombre: 'Carlos Méndez', linea: 'US$2,475 · venció hace 67 días', urgencia: 'vencida' },
      { leadId: 2, pagoId: 2, nombre: 'Lucía Ramos', linea: 'US$5,181 · venció hace 5 días', urgencia: 'vencida' },
      { leadId: 3, pagoId: 3, nombre: 'Diego Fuentes', linea: 'US$2,007 · vence hoy', urgencia: 'pronto' },
    ],
    semaforo: [
      { titulo: '2 cuotas vencidas sin cobrar', link: 'Ver las cuotas', href: '/crm', nivel: 'rojo' },
      { titulo: '3 leads sin marcar la asistencia a la R1', link: 'Marcar en el CRM', href: '/crm', nivel: 'ambar' },
      { titulo: 'La meta del trimestre va a tiempo', link: 'Ver la meta', href: '/plan', nivel: 'verde' },
    ],
    mes: mesDe([...puntos, { id: 'hoy', fuente: 'crm', capa: 'llamadas', titulo: '', inicio: `${hoy}T15:00:00Z`, fin: null, diaCompleto: false, href: null }], hoy, 'UTC'),
    dia: [e1, e2, e3, e4],
    recordatorios: [
      { id: 'proxima', titulo: 'R2 con Laura Méndez', detalle: 'Empieza en 1 h 20 min', tono: 'sky', href: '/calendario' },
      { id: 'vencidas', titulo: '1 tarea vencida', detalle: 'La más vieja, del 3/11', tono: 'marigold', href: '/plan' },
      { id: 'hueco', titulo: 'Próximo hueco libre', detalle: 'Hoy 13:15–17:00', tono: 'pine', href: '/calendario' },
    ],
    aTildar: [
      { id: 't1', titulo: 'Preparar la R2 de Laura Méndez', cuando: 'Hoy', prio: null, proyecto: { nombre: 'Ventas de noviembre', color: '#1d9a85' } },
      { id: 't2', titulo: 'Grabar tres hooks nuevos', cuando: 'Hoy', prio: null, proyecto: { nombre: 'Creativos de Meta', color: '#3f84d8' } },
    ],
  };
}

/** La hoja General de EJEMPLO (la de la maqueta, general-orvel/mako.html: ficticios), para la miniatura de «Nueva hoja». */
function vistaGeneralMuestra(hoy: string): VistaGeneral {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mesHoy = Number(hoy.slice(5, 7)) - 1;
  const cobrado = [32, 41, 28, 46, 52, 39, 61, 44, 58, 49, 66, 40], gasto = [9, 11, 10, 12, 14, 12, 15, 13, 14, 13, 16, 8];
  // El día y el mes de «hoy + n», y su «5/11».
  const fd = (n: number) => ({ dia: Number(dia(hoy, n).slice(8)), mes: MESES[Number(dia(hoy, n).slice(5, 7)) - 1] });
  const dm = (n: number) => `${Number(dia(hoy, n).slice(8))}/${Number(dia(hoy, n).slice(5, 7))}`;
  return {
    frase: fraseGeneral(12480, 2, 5),
    mes: {
      cobrado: 12480, delta: 3020, etiquetaAnterior: 'mismo período de octubre', proyeccion: 18500,
      renglones: [
        { id: 'cobrado', nombre: 'Cobrado', detalle: 'proyección US$18,500', valor: 'US$12,480', cambio: '+32%' },
        { id: 'inversion', nombre: 'Inversión en anuncios', detalle: 'proyección US$3,200', valor: 'US$2,140', cambio: '+8%' },
        { id: 'agendas', nombre: 'Agendas', detalle: 'proyección 42', valor: '27', cambio: '+12%' },
        { id: 'cierres', nombre: 'Cierres', detalle: 'proyección 9', valor: '6', cambio: '−14%' },
      ],
    },
    meta: { titulo: 'US$30,000 de facturación', pct: 62, esperado: 58, diasRestantes: 57, atrasado: false },
    flujo: { cobrado: 12480, inversion: 2140, cambioCobrado: '+32%', cambioInversion: '+8%', etiquetaAnterior: 'mismo período de octubre' },
    meses: cobrado.map((c, i) => ({ clave: `m${i}`, corto: MESES[(mesHoy + 1 + i) % 12], cobrado: c * 500, gasto: gasto[i] * 500 })),
    necesita: [
      { id: 'cuotas', titulo: 'Cuotas vencidas', detalle: 'De 2 clientes', n: 2, href: '/crm' },
      { id: 'leads', titulo: 'Leads por marcar', detalle: '3 sin asistencia a R1', n: 5, href: '/crm' },
      { id: 'tareas', titulo: 'Tareas vencidas', detalle: 'La más vieja, del 28/10', n: 3, href: '/plan' },
      { id: 'alertas', titulo: 'Alertas en rojo', detalle: 'Tu tasa de asistencia bajó', n: 1, href: '/general' },
    ],
    vence: {
      total: 9, vencidas: 2,
      lista: [
        { id: 'v1', titulo: 'Mandar la propuesta a Jorge Salinas', detalle: 'Ventas de noviembre', ...fd(-7), que: 'Tarea', cuando: 'Vencida', vencida: true, href: '/plan' },
        { id: 'v2', titulo: 'Grabar tres hooks nuevos', detalle: 'Creativos de Meta', ...fd(-1), que: 'Tarea', cuando: 'Vencida', vencida: true, href: '/plan' },
        { id: 'v3', titulo: 'Preparar la R2 de Laura Méndez', detalle: 'Ventas de noviembre', ...fd(0), que: 'Tarea', cuando: 'Hoy', vencida: false, href: '/plan' },
        { id: 'v4', titulo: 'Revisar el guion de la VSL', detalle: 'Nueva VSL', ...fd(2), que: 'Tarea', cuando: dm(2), vencida: false, href: '/plan' },
        { id: 'v5', titulo: 'Creativos de Meta', detalle: 'Proyecto del Plan', ...fd(7), que: 'Proyecto', cuando: dm(7), vencida: false, href: '/plan' },
        { id: 'v6', titulo: 'Armar el reporte de octubre', detalle: 'Operación', ...fd(14), que: 'Tarea', cuando: dm(14), vencida: false, href: '/plan' },
      ],
    },
    deben: {
      total: 41179,
      tramos: [
        { nombre: 'Al día', monto: 31512, cuotas: 13, color: '' }, { nombre: '1-30 días', monto: 5181, cuotas: 3, color: '' },
        { nombre: '31-60 días', monto: 2011, cuotas: 1, color: '' }, { nombre: '60+ días', monto: 2475, cuotas: 1, color: '' },
      ],
      cuotas: [
        { leadId: 1, pagoId: 1, nombre: 'Carlos Méndez', linea: 'US$2,475 · venció hace 67 días', urgencia: 'vencida' },
        { leadId: 2, pagoId: 2, nombre: 'Lucía Ramos', linea: 'US$5,181 · venció hace 5 días', urgencia: 'vencida' },
        { leadId: 3, pagoId: 3, nombre: 'Diego Fuentes', linea: 'US$2,007 · vence hoy', urgencia: 'pronto' },
      ],
    },
    funnel: {
      id: 1, nombre: 'Programa principal', principal: true, total: 82,
      etapas: [{ nombre: 'Nuevo', n: 38, color: null }, { nombre: 'Agendó', n: 21, color: null }, { nombre: 'Asistió', n: 9, color: null },
        { nombre: 'Propuesta', n: 6, color: null }, { nombre: 'Ganado', n: 5, color: null }, { nombre: 'Perdido', n: 3, color: null }],
    },
    llamadas: [
      { id: 'l1', nombre: 'Laura Méndez', detalle: 'Hoy 12:30 · R2 · closer Ana', cuando: 'en 1 h', href: null },
      { id: 'l2', nombre: 'Jorge Salinas', detalle: 'Hoy 18:00 · R1 · closer Diego', cuando: 'en 7 h', href: null },
      { id: 'l3', nombre: 'Paola Núñez', detalle: 'Mañana 10:00 · R1 · closer Ana', cuando: dm(1), href: null },
      { id: 'l4', nombre: 'Raúl Ortega', detalle: 'Mañana 16:30 · R2 · closer Sofía', cuando: dm(1), href: null },
    ],
    salud: [
      { titulo: '2 cuotas vencidas sin cobrar', link: 'Ver las cuotas', href: '/crm', nivel: 'rojo' },
      { titulo: '3 leads sin marcar la asistencia a la R1', link: 'Marcar en el CRM', href: '/crm', nivel: 'ambar' },
      { titulo: 'La meta del trimestre va a tiempo', link: 'Ver la meta', href: '/plan', nivel: 'verde' },
      { titulo: 'Meta Ads conectado y leyendo', link: 'Ver la cuenta de anuncios', href: '/ads-manager', nivel: 'verde' },
    ],
  };
}

/** «Operación diaria» de EJEMPLO (la de la maqueta, operacion-moorly/mako.html: ficticios), para la miniatura de «Nueva hoja». */
function vistaOperacionMuestra(hoy: string): VistaOperacion {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mesHoy = Number(hoy.slice(5, 7)) - 1;
  const cob = [9.6, 12.3, 8.4, 13.8, 15.6, 11.7, 18.3, 13.2, 17.4, 14.7, 19.8, 12.5];
  const dm = (n: number) => `${Number(dia(hoy, n).slice(8))}/${Number(dia(hoy, n).slice(5, 7))}`;
  return {
    frase: [{ tipo: 'texto', s: '3 llamadas hoy, 2 cuotas vencidas y 4 tareas que vencen esta semana. ' }, { tipo: 'fuerte', s: 'Laura Méndez' }, { tipo: 'texto', s: ' es tu próxima llamada, a las 12:30.' }],
    numeros: [
      { id: 'agendas', titulo: 'Agendas', valor: '27', serie: [0, 1, 2, 1, 0, 2, 3, 1, 2, 0, 1, 3, 2, 1, 4], pie: '3 llamadas hoy', cambio: null },
      { id: 'pendiente', titulo: 'Por cobrar', valor: 'US$41,179', serie: [38, 39, 40, 40, 42, 41, 43, 42, 41, 40, 41, 42, 41, 41, 41], pie: '2 cuotas vencidas', cambio: null },
      { id: 'cierres', titulo: 'Cierres', valor: '6', serie: [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0], pie: 'De 27 agendas', cambio: null },
      { id: 'cobrado', titulo: 'Cobrado', valor: 'US$12,480', serie: [1, 3, 2, 4, 2, 3, 5, 3, 4, 2, 6, 3, 5, 4, 7], pie: 'contra el período anterior', cambio: '+32%' },
    ],
    meses: cob.map((c, i) => {
      const m = (mesHoy + 1 + i) % 12;
      return { clave: `m${i}`, corto: MESES[m], largo: MESES[m], cobrado: c * 1000, agendas: 20 + ((i * 7) % 11), cierres: 3 + (i % 4) };
    }),
    espera: {
      total: 11,
      lista: [
        { id: 'c1', tipo: 'cobro', titulo: 'Carlos Méndez', detalle: 'US$2,475 · venció hace 67 días', cuando: 'vencida', tono: 'bad', href: '/crm' },
        { id: 'c2', tipo: 'cobro', titulo: 'Lucía Ramos', detalle: 'US$5,181 · venció hace 5 días', cuando: 'vencida', tono: 'bad', href: '/crm' },
        { id: 't1', tipo: 'tarea', titulo: 'Mandar la propuesta a Jorge Salinas', detalle: 'Ventas del mes', cuando: '7 días tarde', tono: 'bad', href: '/plan' },
        { id: 'l', tipo: 'leads', titulo: '5 leads por marcar', detalle: 'En el CRM', cuando: 'marcar', tono: 'info', href: '/crm' },
        { id: 't2', tipo: 'tarea', titulo: 'Revisar el guion de la VSL', detalle: 'Nueva VSL', cuando: 'en 2 días', tono: 'warn', href: '/plan' },
        { id: 't3', tipo: 'tarea', titulo: 'Grabar tres hooks nuevos', detalle: 'Creativos de Meta', cuando: 'en 4 días', tono: 'warn', href: '/plan' },
      ],
    },
    funnel: {
      id: 1, nombre: 'Programa principal', principal: true, total: 82,
      etapas: [{ nombre: 'Nuevo', n: 38, color: null }, { nombre: 'Agendó', n: 21, color: null }, { nombre: 'Asistió', n: 9, color: null },
        { nombre: 'Propuesta', n: 6, color: null }, { nombre: 'Ganado', n: 5, color: null }],
    },
    llamadas: {
      porDia: [3, 2, 1, 0, 0, 2, 1, 2, 3, 1, 0, 0, 1, 2].map((n, k) => ({ dia: dia(hoy, k), rotulo: k === 0 ? 'Hoy' : dm(k), n })),
      proximas: [
        { id: 'l1', dia: Number(hoy.slice(8)), mes: MESES[mesHoy].toLowerCase(), nombre: 'Laura Méndez', detalle: 'R2 · closer Ana', cuando: 'Hoy 12:30', hoy: true, href: null },
        { id: 'l2', dia: Number(hoy.slice(8)), mes: MESES[mesHoy].toLowerCase(), nombre: 'Jorge Salinas', detalle: 'R1 · closer Diego', cuando: 'Hoy 18:00', hoy: true, href: null },
        { id: 'l3', dia: Number(dia(hoy, 1).slice(8)), mes: MESES[Number(dia(hoy, 1).slice(5, 7)) - 1].toLowerCase(), nombre: 'Paola Núñez', detalle: 'R1 · closer Ana', cuando: 'Mañana 10:00', hoy: false, href: null },
      ],
    },
    deben: { total: 41179, cuotas: 18, tramos: [{ nombre: 'Al día', monto: 31512, pct: 77 }, { nombre: 'De 1 a 30 días', monto: 5181, pct: 13 }, { nombre: 'De 31 a 60 días', monto: 2011, pct: 5 }, { nombre: 'Más de 60 días', monto: 2475, pct: 6 }] },
    tildar: [
      { id: 'a', titulo: 'Mandar la propuesta a Jorge Salinas', cuando: 'vencida' },
      { id: 'b', titulo: 'Preparar la R2 de Laura Méndez', cuando: 'hoy' },
      { id: 'c', titulo: 'Grabar tres hooks nuevos', cuando: 'hoy' },
    ],
    salud: [
      { titulo: '2 cuotas vencidas sin cobrar', link: 'Ver las cuotas', href: '/crm', nivel: 'rojo' },
      { titulo: '3 leads sin marcar la asistencia a la R1', link: 'Marcar en el CRM', href: '/crm', nivel: 'ambar' },
      { titulo: 'La meta del trimestre va a tiempo', link: 'Ver la meta', href: '/plan', nivel: 'verde' },
    ],
    meta: { titulo: 'US$30,000 de facturación', pct: 62, esperado: 58, diasRestantes: 57, atrasado: false },
  };
}

/** La muestra de Comercial: la misma que la adaptación (comercial-selvar/mako.html), con nombres de EJEMPLO. */
function vistaComercialMuestra(hoy: string): VistaComercial {
  const semanas = Array.from({ length: 13 }, (_, i) => dia(hoy, -7 * (12 - i)));
  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (11 - i), 1); return d.toISOString().slice(0, 10); });
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const sem = [8, 16, 0, 24, 16, 8, 16, 32, 16, 8, 16, 24, 8].map((k) => k * 1000), semB = [0, 0, 4, 0, 0, 4, 0, 0, 4, 0, 0, 4, 0].map((k) => k * 1000);
  const mes = [40, 56, 32, 64, 72, 48, 88, 64, 72, 64, 88, 16].map((k) => k * 1000), mesB = [4, 0, 8, 4, 0, 8, 4, 0, 8, 4, 4, 0].map((k) => k * 1000);
  const serie = (x: string[], rot: (c: string) => string, a: number[], b: number[]) => {
    const t = [...a, ...b].reduce((s, v) => s + v, 0);
    return { x: x.map((c) => ({ clave: c, rotulo: rot(c) })), series: [{ nombre: 'Programa principal', valores: a }, { nombre: 'Mentoría', valores: b }], total: t, promedio: t / x.length };
  };
  const seg = (id: 'cerraron' | 'vinieron' | 'no-vino' | 'sin-marcar', nombre: string, n: number) => ({ id, nombre, n, pct: (n / 27) * 100 });
  return {
    frase: fraseComercial(27, 6, 96000, 410),
    vendido: { valor: 96000, anterior: 85700, cambio: '+12%', sube: true },
    inversion: { gasto: 2460, cpa: 91, roas: 39 },
    desenlace: { agendas: 27, vinieron: 21, segmentos: [seg('cerraron', 'Cerraron', 6), seg('vinieron', 'Vinieron y no cerraron', 15), seg('no-vino', 'No vinieron', 4), seg('sin-marcar', 'Sin marcar', 2)] },
    tasa: 28.6,
    numeros: [
      { id: 'tasa', titulo: 'Tasa de cierre', valor: '28.6%', cambio: '+13%', bueno: true, baja: false, pie: '6 cerraron de 21', serie: [2, 3, 2.6, 3.4, 3, 4, 4.6, 5.2, 6] },
      { id: 'ticket', titulo: 'Ticket promedio', valor: 'US$16,000', cambio: '+8%', bueno: true, baja: false, pie: 'De los cierres del período', serie: [3, 4.2, 3.6, 5.1, 4.8, 5.4, 6.1, 6.6] },
      { id: 'ciclo', titulo: 'Días hasta el cierre', valor: '9 días', cambio: '−6%', bueno: true, baja: true, pie: 'De la primera reunión al cierre', serie: [7, 6.2, 6.4, 5.6, 5.2, 4.8, 4.1] },
      { id: 'costo', titulo: 'Costo por cierre', valor: 'US$410', cambio: '−11%', bueno: true, baja: true, pie: 'Lo invertido en anuncios ÷ los cierres', serie: [6.6, 5.8, 6.1, 4.9, 4.6, 4, 3.4] },
    ],
    motivos: { total: 18, filas: [{ clave: 'a', nombre: 'No le alcanzó el presupuesto', n: 7, pct: 39 }, { clave: 'b', nombre: 'Lo va a pensar', n: 6, pct: 33 }, { clave: 'c', nombre: 'Eligió otra opción', n: 3, pct: 17 }] },
    ventas: {
      semanas: serie(semanas, (c) => `${Number(c.slice(8, 10))} ${MES[Number(c.slice(5, 7)) - 1].toLowerCase()}`, sem, semB),
      meses: serie(meses, (c) => MES[Number(c.slice(5, 7)) - 1], mes, mesB),
    },
    embudo: [{ nombre: 'Agendaron', n: 120, pasa: '78% vino a la reunión' }, { nombre: 'Vinieron', n: 94, pasa: '76% quedó calificado' }, { nombre: 'Calificados', n: 71, pasa: '35% cerró' }, { nombre: 'Cerraron', n: 25, pasa: null }],
    hoy: {
      ahora: 1, hora: '11:10',
      llamadas: [
        { id: 'l1', leadId: 1, hora: '9:00', cual: 'R1', nombre: 'Paola Núñez', closer: 'Ana', estado: 'paso', detalle: 'Con Ana · vino' },
        { id: 'l2', leadId: 2, hora: '12:30', cual: 'R2', nombre: 'Laura Méndez', closer: 'Diego', estado: 'viene', detalle: 'Con Diego' },
        { id: 'l3', leadId: 3, hora: '15:00', cual: 'R1', nombre: 'Tomás Ibarra', closer: 'Sofía', estado: 'viene', detalle: 'Con Sofía' },
        { id: 'l4', leadId: 4, hora: '18:00', cual: 'R1', nombre: 'Jorge Salinas', closer: 'Diego', estado: 'viene', detalle: 'Con Diego' },
      ],
    },
    origenes: [
      { clave: 'meta', nombre: 'Anuncios de Meta', agendas: 14, cierres: 3, tasa: 33, vendido: 48000, bueno: true },
      { clave: 'ref', nombre: 'Referidos', agendas: 5, cierres: 2, tasa: 50, vendido: 32000, bueno: true },
      { clave: 'ig', nombre: 'Instagram', agendas: 6, cierres: 1, tasa: 20, vendido: 16000, bueno: false },
      { clave: 'org', nombre: 'Orgánico', agendas: 2, cierres: 0, tasa: 0, vendido: 0, bueno: false },
    ],
    closers: [
      { clave: 'so', nombre: 'Sofía', tasa: 43, cierres: 3, bueno: true },
      { clave: 'di', nombre: 'Diego', tasa: 30, cierres: 2, bueno: true },
      { clave: 'an', nombre: 'Ana', tasa: 17, cierres: 1, bueno: false },
    ],
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
  'mi-dia': ({ hoy }) => (
    <HojaMiDia vista={vistaMiDiaMuestra(hoy)} titulo="Buenos días, Ana" fecha="miércoles 4 de noviembre" tz="UTC" ahora={null} onGrilla={() => {}} quieta />
  ),
  general: ({ hoy }) => (
    <HojaGeneral vista={vistaGeneralMuestra(hoy)} titulo="Buenos días, Ana" fecha="miércoles 4 de noviembre" onGrilla={() => {}} quieta />
  ),
  operacion: ({ hoy }) => (
    <HojaOperacion vista={vistaOperacionMuestra(hoy)} titulo="Buenos días, Ana" fecha="miércoles 4 de noviembre" onGrilla={() => {}} quieta />
  ),
  comercial: ({ hoja, hoy }) => (
    <HojaComercial hoja={hoja} vista={vistaComercialMuestra(hoy)} titulo="Buenos días, Ana" fecha="miércoles 4 de noviembre" periodo="Últimos 30 días" onGrilla={() => {}} quieta />
  ),
  // La de Marketing pasa por el MISMO vistaMarketing que la hoja de verdad, con los datos de la adaptación (marketing-kestrel/mako.html).
  marketing: ({ hoja, hoy }) => (
    <HojaMarketing hoja={hoja} vista={vistaMarketing(hoja, datosMarketingMuestra(hoja, hoy), hoy)} titulo="Buenos días, Ana" fecha="miércoles 4 de noviembre" periodo="Últimos 30 días" onGrilla={() => {}} quieta />
  ),
  // La de Landing, igual: el MISMO vistaLanding que la hoja de verdad, con los datos de la adaptación (landing-corbel/mako.html).
  landing: ({ hoja, hoy }) => (
    <HojaLanding hoja={hoja} vista={vistaLanding(hoja, datosLandingMuestra(hoja, hoy), hoy)} titulo="Buenos días, Ana" periodo="Últimos 30 días" onGrilla={() => {}} quieta />
  ),
  // La de Chat Analyst, igual: el MISMO vistaChat que la hoja de verdad, con los datos de la adaptación (chat-parley/mako.html).
  chat: ({ hoja, hoy }) => (
    <HojaChat hoja={hoja} vista={vistaChat(hoja, datosChatMuestra(hoja, hoy), hoy)} titulo="Buenos días, Ana" periodo="Últimos 30 días" onGrilla={() => {}} quieta />
  ),
  // La de Automatizaciones, igual: el MISMO vistaAutomatizaciones que la hoja de verdad, con los datos de la adaptación
  // (automatizaciones-noria/mako.html).
  automatizaciones: ({ hoja, hoy }) => (
    <HojaAutomatizaciones hoja={hoja} vista={vistaAutomatizaciones(hoja, datosAutomatizacionesMuestra(hoja, hoy), hoy)} titulo="Buenos días, Ana" periodo="Últimos 30 días" hoy={hoy} onGrilla={() => {}} quieta />
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
