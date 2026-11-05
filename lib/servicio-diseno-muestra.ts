// =============================================================================
// servicio-diseno-muestra — los datos de EJEMPLO de la hoja «Agencia o servicio» (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/servicio-sunrow/), inventados: ninguna persona ni número real. Tienen la
// FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts) y del Calendario, el Plan y el Semáforo
// de General, así la miniatura pasa por el mismo `vistaServicio` que la hoja de verdad. Las cifras cierran entre tarjetas: los
// clientes por etapa suman la cartera, lo que te deben por atraso suma el total, los deudores no pasan de ese total y los que piden
// atención son los de «Quién te necesita» con la señal «Atención».
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { ItemCalendario } from './calendario-modelo';
import type { TareaVista } from '@/app/general/datos-tipos';
import type { Label } from '@/app/plan/board/types';
import type { GeneralDeServicio } from './servicio-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// [etapa, clientes]: suman la cartera (24).
const ETAPAS: Array<[string, number]> = [['Onboarding', 5], ['Estrategia', 6], ['Producción', 7], ['Lanzamiento', 4], ['Seguimiento', 2]];
// [funnel, clientes]
const PRODUCTOS: Array<[string, number]> = [['Mentoría 1 a 1', 11], ['Programa grupal', 9], ['Consultoría', 4]];
// Los que llegaron a una etapa cada semana (las últimas trece).
const POR_SEMANA = [2, 1, 3, 2, 4, 3, 2, 5, 3, 4, 6, 4, 5];
// [tramo de atraso, pendiente, cuotas]
const ATRASO: Array<[string, number, number]> = [['Al día', 9400, 9], ['1-30 días', 3600, 4], ['31-60 días', 1500, 2], ['60+ días', 700, 1]];
// [cliente, pendiente]: no pasan del total (15,200).
const DEUDORES: Array<[string, number]> = [['Ana Ruiz', 2400], ['Diego Paz', 1800], ['Laura Méndez', 1500], ['Carlos Ibarra', 900], ['Marta Solís', 600]];
// [cliente, señal, último contacto, deuda vencida, sesiones]: los que piden atención primero.
const QUIEN: Array<[string, string, string, number, number]> = [
  ['Ana Ruiz', 'Atención', 'Más de 30 días', 1200, 3], ['Diego Paz', 'Atención', '15-30 días', 900, 5], ['Laura Méndez', 'Atención', '15-30 días', 600, 4],
  ['Carlos Ibarra', 'Bien', '8-14 días', 0, 7], ['Marta Solís', 'Bien', '0-7 días', 0, 6], ['Jorge Lima', 'Bien', '0-7 días', 0, 8],
];

export function datosServicioMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, r: Resultado) => { if (k) out[k] = { resultado: r }; };
  const clientes = ETAPAS.reduce((a, e) => a + e[1], 0), atencion = QUIEN.filter((q) => q[1] === 'Atención').length;
  const vencidas = ATRASO.slice(1).reduce((a, t) => a + t[2], 0), vencido = QUIEN.reduce((a, q) => a + q[3], 0);
  const uno = (metrica: string, v: number, antes?: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], ...(antes != null ? { anterior: [antes] } : {}), fuera: 0, clase: null });
  const cat = (metrica: string, fs: Array<[string, number]>, tot: number): Resultado => ({ columnas: col([metrica]), totales: [tot], fuera: 0, clase: 'categoria', filas: fs.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })) });
  poner(p.apertura, { columnas: col(['atencion', 'sesiones', 'cuotas_vencidas']), filas: [], totales: [atencion, QUIEN.reduce((a, q) => a + q[4], 0) + 52, vencidas], fuera: 0, clase: null });
  poner(p.clientes, uno('clientes', clientes));
  poner(p.avanzaron, uno('clientes', 11, 8));
  poner(p.deuda, uno('deuda_vencida_usd', vencido));
  poner(p.cobrado, uno('cobrado', 18400, 15900));
  poner(p.etapas, cat('clientes', ETAPAS, clientes));
  poner(p.producto, cat('clientes', PRODUCTOS, clientes));
  poner(p.ritmo, { columnas: col(['clientes']), totales: [POR_SEMANA.reduce((a, b) => a + b, 0)], fuera: 0, clase: 'tiempo', filas: POR_SEMANA.map((v, i) => { const d = dia(hoy, -7 * (POR_SEMANA.length - 1 - i)); return { clave: d, etiqueta: d, valores: [v] }; }) });
  poner(p.deben, {
    columnas: col(['pendiente', 'pagos']), totales: [ATRASO.reduce((a, t) => a + t[1], 0), ATRASO.reduce((a, t) => a + t[2], 0)], fuera: 0, clase: 'categoria',
    filas: ATRASO.map(([k, m, c]) => ({ clave: k, etiqueta: k, valores: [m, c] })),
  });
  poner(p.deudores, cat('pendiente', DEUDORES, DEUDORES.reduce((a, d) => a + d[1], 0)));
  poner(p.quien, {
    columnas: col(['atencion', 'deuda_vencida_usd', 'sesiones']), totales: [atencion, vencido, 0], fuera: 0, clase: 'categoria',
    filas: QUIEN.map(([nombre, senal, tramo, deuda, sesiones]) => ({ clave: nombre, etiqueta: nombre, valores: [senal === 'Atención' ? 1 : 0, deuda, sesiones], extra: { senal, tramo_contacto: tramo } })),
  });
  return out;
}

function tarea(o: Partial<TareaVista> & { id: string; title: string }): TareaVista {
  const t: TareaVista = {
    num: 1, emoji: '', detalle: '', priority: 'media', score: 60, progress: 0, deadline: '', labels: ['p1'],
    checklist: [], historial: [], origen: 'user', enPrioridad: true, ...o,
  };
  return t;
}

const PROYECTO: Label = { id: 'p1', emoji: '', name: 'Entrega de clientes', color: '#1E9E57', score: 70, detalle: '', historial: [] };

/** El Calendario, el Plan y el Semáforo de ejemplo. Las horas son en UTC, la zona del ejemplo. */
export function generalServicioMuestra(hoy: string): GeneralDeServicio {
  const item = (id: string, capa: ItemCalendario['capa'], titulo: string, detalle: string, d: string, hhmm: string, min: number | null): ItemCalendario => {
    const inicio = `${d}T${hhmm}:00.000Z`;
    return { id, fuente: 'propio', capa, titulo, detalle, inicio, fin: min ? new Date(Date.parse(inicio) + min * 60000).toISOString() : null, diaCompleto: false, href: null };
  };
  const items = [
    item('h1', 'entregas', 'Sesión de estrategia con Ana Ruiz', '60 min', hoy, '09:00', 60),
    item('h2', 'llamadas', 'Llamada de seguimiento con Diego Paz', '30 min', hoy, '12:30', 30),
    item('h3', 'entregas', 'Revisión de entregables', '45 min', hoy, '17:15', 45),
    item('p1', 'entregas', 'Kickoff de un cliente nuevo', '60 min', dia(hoy, 1), '10:00', 60),
    item('p2', 'publicaciones', 'Caso de éxito en Instagram', 'Carrusel', dia(hoy, 2), '11:00', null),
    item('p3', 'llamadas', 'Llamada con Laura Méndez', '30 min', dia(hoy, 3), '16:00', 30),
    item('p4', 'entregas', 'Entrega del plan de contenido', '45 min', dia(hoy, 5), '09:30', 45),
    item('p5', 'cobros', 'Cuota 3 de Carlos Ibarra', 'US$900', dia(hoy, 6), '12:00', null),
  ];
  const prioridades = [
    tarea({ id: 't1', title: 'Mandar el reporte mensual a Ana Ruiz', priority: 'alta', score: 88, deadline: hoy }),
    tarea({ id: 't2', title: 'Preparar la sesión de estrategia', priority: 'alta', score: 82, deadline: hoy }),
    tarea({ id: 't3', title: 'Revisar los anuncios del programa grupal', priority: 'media', score: 64, deadline: dia(hoy, 1) }),
    tarea({ id: 't4', title: 'Escribir el correo de bienvenida', priority: 'baja', score: 40, deadline: dia(hoy, 2) }),
    tarea({ id: 't5', title: 'Ordenar las plantillas de entrega', priority: 'baja', score: 32, deadline: dia(hoy, 5) }),
  ];
  const deadlines = [
    tarea({ id: 'd1', title: 'Entregar el diagnóstico de Diego Paz', deadline: dia(hoy, -1) }),
    tarea({ id: 'd2', title: 'Lanzar la campaña del programa grupal', deadline: dia(hoy, 2) }),
    tarea({ id: 'd3', title: 'Cerrar el onboarding de Jorge Lima', deadline: dia(hoy, 6) }),
    tarea({ id: 'd4', title: 'Renovar la mentoría de Marta Solís', deadline: dia(hoy, 9) }),
    tarea({ id: 'd5', title: 'Presentar resultados del trimestre', deadline: dia(hoy, 14) }),
  ];
  return {
    calendario: { ok: true, d: { items, tz: 'UTC', hoy, falla: false } },
    plan: {
      ok: true,
      d: {
        prioridades, top: prioridades, deadlines: { tareas: deadlines, proyectos: [] }, hoy, deHoy: { cerradas: 0, total: 2 }, vencidas: 1, objetivo: null,
        proyectos: [], etiquetas: [PROYECTO],
        tareasDeProyectos: [], tablero: 'cliente',
      },
    },
    semaforo: {
      ok: true,
      d: {
        alertas: [
          { nivel: 'rojo', titulo: '2 cuotas vencidas hace más de 30 días', href: '/crm', hrefLabel: 'Ver las cuotas' },
          { nivel: 'ambar', titulo: '3 clientes sin hablar hace más de 15 días', href: '/clients', hrefLabel: 'Ver los clientes' },
          { nivel: 'ambar', titulo: 'Una tarea vencida en el Plan', href: '/plan', hrefLabel: 'Abrir el Plan' },
        ],
        fuentes: 'con-datos', lampara: 'rojo', objetivoAtrasado: false,
      },
    },
  };
}
