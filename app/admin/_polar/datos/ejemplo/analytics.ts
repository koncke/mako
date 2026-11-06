// =============================================================================
// Datos de EJEMPLO de Admin › Analytics (Metrics, Events y Costs), para capturar las vistas sin la base
// =============================================================================
// Todo ficticio (AGENTS.md: nada de clientes reales): «Estudio Norte», «Panadería Sol», «Ana Gómez»… Se arman con las
// MISMAS funciones puras que usan las páginas (`calcularIngresos`, `propsDeMetricas`, `armarEventos`, `armarCostos`), así
// una captura muestra lo que mostraría la pantalla con esos datos, no un dibujo aparte.

import { calcularIngresos, type ClienteIngreso, type PagoIngreso } from '@/lib/admin-ingresos-reglas'
import type { AccionMako } from '@/lib/actividad'
import type { Reporte } from '@/lib/admin-errores'
import type { SesionAgente } from '@/lib/agente-sesiones'
import type { FilaError } from '@/lib/admin-errores-reglas'
import type { ResumenPeriodo } from '@/lib/costos-ia'
import { propsDeMetricas, type PropsDeMetricas } from '../metricas'
import { armarEventos, type VistaEventos } from '../eventos'
import { armarCostos, type VistaCostos } from '../costos'

export const HOY_EJEMPLO = new Date('2026-11-06T15:00:00.000Z')
const hoy = HOY_EJEMPLO.toISOString().slice(0, 10)

const quien = new Map<string, ClienteIngreso>([
  ['ws:101', { clave: 'ws:101', nombre: 'Estudio Norte', ws: 101, leadId: 1 }],
  ['ws:102', { clave: 'ws:102', nombre: 'Panadería Sol', ws: 102, leadId: 2 }],
  ['ws:103', { clave: 'ws:103', nombre: 'Clínica Arce', ws: 103, leadId: 3 }],
  ['lead:9', { clave: 'lead:9', nombre: 'Ana Gómez', ws: null, leadId: 9 }],
])

let n = 0
const pago = (cliente: string, fecha: string, usd: number | null, recurrente = true): PagoIngreso => ({
  id: `p:${++n}`, cliente, suscripcion: recurrente ? `lead:${cliente}:casa` : null, fecha, usd, medio: 'transferencia', concepto: null,
})

const PAGOS: PagoIngreso[] = [
  ...['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10', '2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10', '2026-11-04']
    .map((f) => pago('ws:101', f, 97)),
  ...['2026-05-20', '2026-06-20', '2026-07-20', '2026-08-20'].map((f) => pago('ws:102', f, 147)),
  ...['2026-09-02', '2026-10-02', '2026-11-02'].map((f) => pago('ws:103', f, f >= '2026-10-01' ? 247 : 197)),
  pago('lead:9', '2026-07-15', 500, false),
  pago('lead:9', '2026-10-28', 250, false),
]

export const INGRESOS_EJEMPLO = calcularIngresos(PAGOS, quien, hoy)

export const METRICAS_EJEMPLO: PropsDeMetricas = propsDeMetricas({ ...INGRESOS_EJEMPLO, avisos: [] })

const ACCIONES: AccionMako[] = [
  { creado: '2026-11-06T14:20:00.000Z', usuario: 501, ws: 101, operacion: 'crear_lead', titulo: 'Crear lead', area: 'crm', canal: 'whatsapp', tipo: 'accion', ok: true },
  { creado: '2026-11-06T13:05:00.000Z', usuario: 502, ws: 102, operacion: 'listar_tareas_plan', titulo: 'Ver tareas del plan', area: 'plan', canal: 'app', tipo: 'lectura', ok: true },
  { creado: '2026-11-05T22:41:00.000Z', usuario: 501, ws: 101, operacion: 'enviar_email', titulo: 'Mandar un email', area: 'email', canal: 'app', tipo: 'accion', ok: false },
]

const ERRORES: FilaError[] = [
  {
    id: 71, titulo: 'No se pudo guardar la tarjeta del tablero', origen: 'navegador', veces: 4,
    primeraVez: '2026-11-03T10:00:00.000Z', ultimaVez: '2026-11-06T11:12:00.000Z', ruta: '/plan', mensaje: 'TypeError: no se pudo leer «progress»',
    stack: 'TypeError: no se pudo leer «progress»\n    at guardar (board.js:12:4)', navegador: 'Chrome 141', negocios: [101, 103], personas: 2,
    ticketId: 880, ticketEstado: 'abierto', ticketResueltoAt: null,
  },
]

const REPORTES: Reporte[] = [
  { id: 881, titulo: 'El botón de exportar no baja nada', tipo: 'bug', estado: 'abierto', prioridad: 'media', canal: 'app', creado: '2026-11-04T16:30:00.000Z', quien: 'Ana Gómez', negocio: 'Panadería Sol', ws: 102 },
]

const SESIONES: SesionAgente[] = [
  {
    id: 31, workspace_id: 103, sesion_id: 'ses-ejemplo-31', empezo_en: '2026-11-05T18:00:00.000Z', termino_en: '2026-11-05T18:40:00.000Z',
    acta: { titulo: 'Armar la secuencia de bienvenida', resumen: 'Pidió tres mensajes para los leads nuevos y ajustó los horarios.', turnos: 5, herramientas: 7 },
    turnos: [{ ts: '2026-11-05T18:01:00.000Z', texto: 'Arma una bienvenida de tres mensajes para los leads del formulario.' }],
    redacciones: 0, created_at: '2026-11-05T18:00:00.000Z',
  },
]

const NOMBRES: Record<number, string> = { 101: 'Estudio Norte', 102: 'Panadería Sol', 103: 'Clínica Arce' }

export const EVENTOS_EJEMPLO: VistaEventos = armarEventos({
  ingresos: { entradas: INGRESOS_EJEMPLO.entradas, clientes: INGRESOS_EJEMPLO.clientes },
  actividad: {
    acciones: ACCIONES, nombres: NOMBRES, medido: true,
    personas: [
      { id: 501, nombre: 'Laura Pérez', email: 'laura@ejemplo.com', ws: 101, negocio: 'Estudio Norte', creado: '2026-01-02', ultimoLogin: null, rol: 'admin', estado: 'activo' },
      { id: 502, nombre: 'Mateo Ruiz', email: 'mateo@ejemplo.com', ws: 102, negocio: 'Panadería Sol', creado: '2026-05-02', ultimoLogin: null, rol: 'admin', estado: 'activo' },
    ],
  },
  errores: { errores: ERRORES, hayMas: false, reportes: REPORTES, nombres: NOMBRES },
  agente: { sesiones: SESIONES, nombres: NOMBRES },
  avisos: [],
  ahora: HOY_EJEMPLO,
  topes: { acciones: 100, reportes: 40, sesiones: 200 },
})

const corte = (clave: string, llamadas: number, costUsd: number) => ({ clave, llamadas, tokens: llamadas * 1200, costUsd })
const resumen = (periodo: string, escala: number, atribuible: boolean): ResumenPeriodo => ({
  periodo, desde: null, hasta: null, filas: 300, llamadas: 300, tokens: 360_000, costUsd: 9.4 * escala,
  porFeature: [corte('mako-doer-in', 140, 4.1 * escala), corte('plan-fathom', 60, 3.2 * escala), corte('closing', 20, 1.7 * escala), corte('lead_insights', 80, 0.4 * escala)],
  porProveedor: [corte('anthropic', 200, 9.0 * escala), corte('openai', 40, 0.4 * escala), corte('gemini', 60, 0)],
  porModelo: [corte('claude-haiku-4-5', 160, 5.2 * escala), corte('claude-sonnet-4-5', 40, 3.8 * escala), corte('gpt-4o-mini', 40, 0.4 * escala)],
  porDia: [corte(`${periodo}-02`, 40, 1.1 * escala), corte(`${periodo}-03`, 90, 2.9 * escala), corte(`${periodo}-05`, 170, 5.4 * escala)],
  porWorkspace: [{ ...corte('101', 120, 5 * escala), atribuible }, { ...corte('103', 80, 4.4 * escala), atribuible }],
  mesesDisponibles: ['2026-11', '2026-10', '2026-09'],
  delNegocio: { llamadas: 0, costUsd: 0 },
  delCredito: { llamadas: 0, costUsd: 0 },
})

export const COSTOS_EJEMPLO: VistaCostos = armarCostos({
  periodo: '2026-11',
  actual: resumen('2026-11', 1, false),
  previo: resumen('2026-10', 0.8, false),
  nombres: NOMBRES,
  hoy: HOY_EJEMPLO,
  avisos: [],
})
