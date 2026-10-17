// =============================================================================
// muestras — los datos de EJEMPLO de cada bloque de General
// =============================================================================
// Dos usos, el mismo dato: el placeholder de un bloque vacío (./comun.tsx, el bloque apagado con la acción encima) y la
// vista previa del menú «Bloques de General» (Martín, 14/10/2026: «que sean una preview de lo que va a ser el gráfico,
// no solo texto»). Así lo que se ve en el menú es lo que después aparece en la hoja.
//
// ⚠️ FICTICIOS POR REGLA (AGENTS.md, «Lo que alguien LEE de la pantalla compartida no es su testimonio»): ningún nombre
//    de un cliente real; los nombres son de ejemplo y los montos redondos.
// ⚠️ Las fechas salen de HOY (`hoyMuestra`), para que «Hoy», «Mañana» y los deadlines se lean bien cualquier día.
// =============================================================================

import type { BoardTask, Label } from '@/app/plan/board/types';
import type { ItemCalendario } from '@/lib/calendario-modelo';
import type { ConteoFunnel } from '@/lib/general-alcance';
import type { CobroM } from '@/app/m/dashboard/modelo';
import type { ResumenComparativo } from '@/lib/queries';
import type { OkrVista, AlertaVista } from '../datos-tipos';
import type { ObjectiveConAvance } from '@/lib/objectives';
import type { Foco } from '@/lib/focus';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoyMuestra = (): string => ymd(new Date());
export const masDias = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
/** Un instante de hoy (o de dentro de `dias`) a la hora `h:m`, en ISO. */
const a = (dias: number, h: number, m = 0): string => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return d.toISOString(); };

export const OKRS_MUESTRA: OkrVista[] = [
  { id: 'm1', titulo: 'Facturar $30,000 en el trimestre', metrica: 'cash_usd', metricaLabel: 'Cobrado', unidad: 'usd', metaValor: 30000, quarter: 4, avanceManual: null, funnelIds: [], actual: 18600, pct: 62, atrasado: false, fraccion: 0.55, principal: true },
  { id: 'm2', titulo: 'Cerrar 40 clientes nuevos', metrica: 'cierres', metricaLabel: 'Cierres', unidad: 'cantidad', metaValor: 40, quarter: 4, avanceManual: null, funnelIds: [], actual: 17, pct: 43, atrasado: true, fraccion: 0.55, principal: false },
  { id: 'm3', titulo: '120 reuniones agendadas', metrica: 'agendas', metricaLabel: 'Reuniones agendadas', unidad: 'cantidad', metaValor: 120, quarter: 4, avanceManual: null, funnelIds: [], actual: 74, pct: 62, atrasado: false, fraccion: 0.55, principal: false },
];

const proyecto = (id: string, name: string, emoji: string, color: string, score: number, deadline: string): Label =>
  ({ id, name, emoji, color, score, deadline, detalle: '', historial: [] }) as Label;
export const proyectosMuestra = (): Label[] => [
  proyecto('pm1', 'Lanzar la oferta nueva', '🚀', '#2E6FF2', 92, masDias(9)),
  proyecto('pm2', 'Ordenar el funnel de ventas', '🎯', '#E3A008', 81, masDias(16)),
  proyecto('pm3', 'Campaña de fin de año', '📣', '#8e24aa', 70, masDias(30)),
  proyecto('pm4', 'Contratar un closer', '🤝', '#2F9E5B', 58, masDias(21)),
  proyecto('pm5', 'Automatizar el seguimiento', '⚙️', '#039be5', 46, masDias(40)),
  proyecto('pm6', 'Grabar los testimonios', '🎬', '#f4511e', 35, masDias(45)),
];
const tarea = (id: string, num: number, title: string, labels: string[], score: number, deadline: string, progress = 0): BoardTask =>
  ({ id, num, emoji: '📌', title, detalle: '', priority: 'alta', score, progress, deadline, labels, checklist: [], historial: [], origen: 'user', enPrioridad: true }) as unknown as BoardTask;
export const tareasMuestra = (): BoardTask[] => [
  tarea('tm1', 12, 'Escribir la página de la oferta nueva', ['pm1'], 94, masDias(2)),
  tarea('tm2', 15, 'Grabar el video de ventas', ['pm1'], 88, masDias(4)),
  tarea('tm3', 21, 'Definir el guion de la llamada de cierre', ['pm2'], 79, masDias(6)),
  tarea('tm4', 7, 'Armar el calendario de anuncios de diciembre', ['pm3'], 66, masDias(9)),
  tarea('tm5', 30, 'Publicar la búsqueda del closer', ['pm4'], 60, masDias(12)),
  // Las de los proyectos (para el avance de cada tarjeta).
  tarea('tm6', 3, 'Precio y bonos', ['pm1'], 50, '', 100),
  tarea('tm7', 4, 'Etapas del CRM', ['pm2'], 50, '', 100),
  tarea('tm8', 5, 'Mapa del funnel', ['pm2'], 50, '', 100),
  tarea('tm9', 6, 'Piezas de la campaña', ['pm3'], 50, '', 100),
  tarea('tm10', 8, 'Perfil del closer', ['pm4'], 50, '', 100),
];

const item = (id: string, capa: ItemCalendario['capa'], fuente: ItemCalendario['fuente'], titulo: string, inicio: string, extra: Partial<ItemCalendario> = {}): ItemCalendario =>
  ({ id, capa, fuente, titulo, inicio, fin: null, diaCompleto: false, href: null, ...extra });
export const calendarioMuestra = (): ItemCalendario[] => [
  item('c1', 'bloques', 'propio', 'Bloque de trabajo: la oferta', a(0, 9, 0), { fin: a(0, 11, 0) }),
  item('c2', 'llamadas', 'crm', 'Ana Gómez', a(0, 11, 30), { detalle: 'Closer: Luis' }),
  item('c3', 'publicaciones', 'propio', 'Reel: el antes y el después', a(0, 13, 0), { formato: 'reel' }),
  item('c4', 'llamadas', 'crm', 'Carlos Ruiz', a(0, 16, 0), { detalle: 'Closer: Sofía' }),
  item('c5', 'llamadas', 'crm', 'Marta Díaz', a(1, 10, 0), { detalle: 'Closer: Luis' }),
  item('c6', 'publicaciones', 'propio', 'Story: pregunta del día', a(1, 18, 0), { formato: 'story' }),
  item('c7', 'llamadas', 'crm', 'Jorge Peña', a(2, 12, 30), { detalle: 'Closer: Sofía' }),
  item('c8', 'publicaciones', 'propio', 'Post: tres errores al vender', a(3, 9, 0), { formato: 'post' }),
  item('c9', 'llamadas', 'crm', 'Laura Vega', a(3, 17, 0), { detalle: 'Closer: Luis' }),
  item('c10', 'publicaciones', 'propio', 'Anuncio: la oferta nueva', a(5, 8, 0), { formato: 'ad' }),
];

export const FUNNEL_MUESTRA: ConteoFunnel = {
  funnelId: 0, nombre: 'Tu funnel', total: 214, sinEtapa: 0,
  etapas: [
    { key: 'nuevo', label: 'Nuevo', dot: '#2E6FF2', n: 96 },
    { key: 'contactado', label: 'Contactado', dot: '#039be5', n: 58 },
    { key: 'agendado', label: 'Agendó', dot: '#8e24aa', n: 31 },
    { key: 'asistio', label: 'Asistió', dot: '#E3A008', n: 19 },
    { key: 'ganado', label: 'Ganado', dot: '#2F9E5B', n: 10 },
  ],
};

export const COBROS_MUESTRA: CobroM[] = [
  { leadId: -1, pagoId: -1, nombre: 'Ana Gómez', linea: '$500 · venció hace 3 días', urgencia: 'vencida' },
  { leadId: -2, pagoId: -2, nombre: 'Carlos Ruiz', linea: '$750 · vence mañana', urgencia: 'pronto' },
  { leadId: -3, pagoId: -3, nombre: 'Marta Díaz', linea: '$300 · vence el vie', urgencia: null },
  { leadId: -4, pagoId: -4, nombre: 'Jorge Peña', linea: '$1,000 · vence en 9 días', urgencia: null },
];

export const MES_MUESTRA: ResumenComparativo = {
  inversion_usd: { actual: 1840, anterior: 1650, proyeccion: 0 },
  agendas: { actual: 42, anterior: 35, proyeccion: 0 },
  cierres: { actual: 9, anterior: 11, proyeccion: 0 },
  cash_usd: { actual: 12400, anterior: 9800, proyeccion: 0 },
  etiqueta_anterior: 'mismo período del mes anterior',
};

export const ALERTAS_MUESTRA: AlertaVista[] = [
  { nivel: 'rojo', titulo: '3 cuotas vencidas', href: '/crm', hrefLabel: 'Ver' },
  { nivel: 'ambar', titulo: '5 leads sin contactar hace 2 días', href: '/crm', hrefLabel: 'Ver' },
  { nivel: 'verde', titulo: 'Los anuncios entregan bien', href: '/marketing', hrefLabel: 'Ver' },
];

/** La Meta objetivo de ejemplo (lo que se pisa sobre los datos de verdad del bloque: el período y la capacidad son reales). */
export const META_MUESTRA = {
  objetivo: {
    id: 'mo', anio: 2026, quarter: 4, titulo: 'Facturar $30,000 en el trimestre', metrica: 'cash_usd', metaValor: 30000, unidad: 'usd',
    avanceManual: null, orden: 0, estado: 'activo', origen: 'muestra', actual: 18600, pct: 62, desde: '2026-10-01', hasta: '2026-12-31',
    ritmo: { esperado: 16500, desvio: 2100, desvioPct: 13, llegadaEstimada: null, alDia: true },
  } as ObjectiveConAvance,
  desglose: null,
  complemento: { label: 'Vendido', valor: '$24,000', pie: '', desglose: null },
  fraccion: 0.55,
};

/** La Acción del día de ejemplo. */
export const FOCO_MUESTRA: Foco = {
  accion: 'Llama a los 4 leads que agendaron y no asistieron', razon: 'Son las agendas más baratas que vas a conseguir esta semana.',
  resultadoEsperado: 'Agendas de la semana', responsable: 'Tú', progreso: null, siguienteRevision: 'Mañana', origen: 'kpi',
  alertaIdx: null, href: '/crm', hrefLabel: 'Abrir el CRM', nivel: 'ambar', pideConfigurar: null,
};
