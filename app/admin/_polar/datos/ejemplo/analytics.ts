// =============================================================================
// Datos de EJEMPLO de Admin › Analytics (Metrics, Events y Costs), para capturar las vistas sin la base
// =============================================================================
// Todo ficticio (AGENTS.md: nada de clientes reales). LOS MISMOS NEGOCIOS, PAGOS Y PERSONAS que el resto de Admin (revisión del
// 6/11/2026: antes eran otro universo, y para el mismo rango el Overview y Metrics decían otros ingresos y otro MRR):
//   · Metrics: los meses de ingresos del Overview (`ingresosEjemplo`, ./resumen.ts, armados con los pagos de ./negocios.ts), por
//     la MISMA función que usa la página (`propsDeMetricas`), más los cambios de lo que paga por mes cada negocio (MOVIMIENTOS),
//     que cuentan la misma historia que esos meses (lo fija tests/admin-polar-arreglos-3.test.ts);
//   · Events: los pedidos de Sales (./ventas.ts), esos cambios, el alta de cada negocio (./negocios.ts) y lo que hizo MaKo, los
//     errores y los reportes de esos negocios, con sus personas (Ana Gómez es la de Estudio Norte, como en la ficha);
//   · Costs: el gasto de IA de noviembre, que suma lo mismo que Customers › Cost Drivers (./clientes.ts: US$ 4,20, de Clínica Dental
//     Sonríe, Estudio Norte, Óptica Visión Clara y la plataforma), con el margen bruto sobre lo que entró (los pagos del Overview).

import type { ClienteIngreso, Movimiento } from '@/lib/admin-ingresos-reglas'
import type { AccionMako } from '@/lib/actividad'
import type { Reporte } from '@/lib/admin-errores'
import type { SesionAgente } from '@/lib/agente-sesiones'
import type { FilaError } from '@/lib/admin-errores-reglas'
import type { Corte, ResumenPeriodo } from '@/lib/costos-ia'
import { propsDeMetricas, type PropsDeMetricas } from '../metricas'
import { armarEventos, type VistaEventos } from '../eventos'
import { armarCostos, nombresDeFeatures, type VistaCostos } from '../costos'
import { CATALOGO_MODELOS } from '@/lib/model-catalogo'
import { ingresosEjemplo } from './resumen'
import { PEDIDOS_EJEMPLO, PERSONAS_EJEMPLO } from './ventas'
import { ESENCIAL, LEAD_SIN_CUENTA, NEGOCIOS, NOMBRES_EJEMPLO, PRO, WS_PLATAFORMA_EJEMPLO } from './negocios'

export const HOY_EJEMPLO = new Date('2026-11-06T15:00:00.000Z')

const { estudioNorte, panaderia, clinica, optica, gimnasio, taller, floristeria, viajes, agencia } = NEGOCIOS
const E = ESENCIAL.precioUsd
const P = PRO.precioUsd

const mov = (fecha: string, n: { ws: number }, tipo: Movimiento['tipo'], antes: number, despues: number): Movimiento => ({
  fecha, cliente: `ws:${n.ws}`, tipo, delta: despues - antes, antes, despues,
})

/**
 * Lo que cambió lo que paga por mes cada negocio (`movimientosDe` de lib/admin-ingresos-reglas.ts), el más nuevo primero: la
 * historia de los meses del Overview. Panadería La Espiga empieza en junio; Estudio Norte en julio (Esencial) y sube a Pro en
 * septiembre; Clínica Dental Sonríe y Viajes Horizonte en agosto; Óptica Visión Clara, Taller Mecánico Ruta 9 y Gimnasio Fuerza
 * Sur en septiembre; el gimnasio se corta en octubre; Floristería Pétalo empieza en noviembre.
 */
export const MOVIMIENTOS_EJEMPLO: Movimiento[] = [
  mov('2026-11-02', floristeria, 'nuevo', 0, P),
  mov('2026-10-28', gimnasio, 'corte', E, 0),
  mov('2026-09-28', gimnasio, 'nuevo', 0, E),
  mov('2026-09-15', taller, 'nuevo', 0, E),
  mov('2026-09-05', optica, 'nuevo', 0, E),
  mov('2026-09-01', estudioNorte, 'sube', E, P),
  mov('2026-08-02', viajes, 'nuevo', 0, P),
  mov('2026-08-01', clinica, 'nuevo', 0, P),
  mov('2026-07-01', estudioNorte, 'nuevo', 0, E),
  mov('2026-06-02', panaderia, 'nuevo', 0, E),
]

/** Quién es cada cliente de lo cobrado (los negocios de ./negocios.ts y el lead que pagó sin tener cuenta). */
const CLIENTES: ClienteIngreso[] = [
  ...Object.values(NEGOCIOS).map((n): ClienteIngreso => ({ clave: `ws:${n.ws}`, nombre: n.nombre, ws: n.ws, leadId: null })),
  { clave: LEAD_SIN_CUENTA.clave, nombre: LEAD_SIN_CUENTA.nombre, ws: null, leadId: LEAD_SIN_CUENTA.leadId },
]

/** Lo cobrado de los ejemplos: los meses, los pagos y el total del Overview, con los cambios de lo que paga cada uno. */
export const INGRESOS_EJEMPLO = { ...ingresosEjemplo, movimientos: MOVIMIENTOS_EJEMPLO, clientes: CLIENTES }

export const METRICAS_EJEMPLO: PropsDeMetricas = propsDeMetricas({ ...INGRESOS_EJEMPLO, avisos: [] })

// ── Lo que hizo MaKo, los errores y los reportes de esos negocios ─────────────────────────────────────────────────────────

/** Las personas (las de ./ventas.ts y la ficha: Ana Gómez es el usuario 101 de Estudio Norte, Darío Ruiz el 104 de la panadería). */
const ID_PERSONA: Record<number, number> = { [estudioNorte.ws]: 101, [panaderia.ws]: 104, [clinica.ws]: 110, [agencia.ws]: 120 }
const personas = Object.entries(ID_PERSONA).map(([ws, id]) => ({ id, nombre: PERSONAS_EJEMPLO[Number(ws)].nombre, email: PERSONAS_EJEMPLO[Number(ws)].email }))

const accion = (creado: string, ws: number, operacion: string, titulo: string, area: string, canal: string, tipo: string, ok = true): AccionMako => ({
  creado, usuario: ID_PERSONA[ws] ?? null, ws, operacion, titulo, area, canal, tipo, ok,
})

const ACCIONES: AccionMako[] = [
  accion('2026-11-06T17:48:00Z', panaderia.ws, 'mover_lead_etapa', 'Mover un lead de etapa', 'crm', 'app', 'accion'),
  accion('2026-11-06T16:10:00Z', clinica.ws, 'listar_leads', 'Ver los leads', 'crm', 'whatsapp', 'lectura'),
  accion('2026-11-06T13:02:00Z', agencia.ws, 'agendar_reunion', 'Agendar una reunión', 'agenda', 'app', 'accion', false),
  accion('2026-11-05T20:30:00Z', estudioNorte.ws, 'crear_tarea_plan', 'Crear una tarea', 'plan', 'app', 'accion'),
  accion('2026-11-05T15:00:00Z', estudioNorte.ws, 'crear_lead', 'Crear un lead', 'crm', 'whatsapp', 'accion'),
  accion('2026-11-03T11:00:00Z', estudioNorte.ws, 'mandar_email', 'Mandar un email', 'email', 'app', 'accion', false),
]

const ERRORES: FilaError[] = [
  {
    id: 9, titulo: 'No cargó el tablero', origen: 'navegador', veces: 3, primeraVez: '2026-11-01T10:00:00Z', ultimaVez: '2026-11-02T10:00:00Z',
    ruta: '/plan', mensaje: null, stack: null, navegador: null, negocios: [estudioNorte.ws], personas: 1, ticketId: null, ticketEstado: null, ticketResueltoAt: null,
  },
  {
    id: 71, titulo: 'No se pudo guardar la tarjeta del tablero', origen: 'navegador', veces: 4,
    primeraVez: '2026-11-03T10:00:00.000Z', ultimaVez: '2026-11-06T11:12:00.000Z', ruta: '/plan', mensaje: 'TypeError: no se pudo leer «progress»',
    stack: 'TypeError: no se pudo leer «progress»\n    at guardar (board.js:12:4)', navegador: 'Chrome 141', negocios: [clinica.ws], personas: 1,
    ticketId: 880, ticketEstado: 'abierto', ticketResueltoAt: null,
  },
]

const REPORTES: Reporte[] = [
  { id: 881, titulo: 'El botón de exportar no baja nada', tipo: 'bug', estado: 'abierto', prioridad: 'media', canal: 'app', creado: '2026-11-04T16:30:00.000Z', quien: PERSONAS_EJEMPLO[panaderia.ws].nombre, negocio: panaderia.nombre, ws: panaderia.ws },
  { id: 55, titulo: 'No me llega el aviso de pago', tipo: 'bug', estado: 'en_curso', prioridad: 'media', canal: 'app', creado: '2026-10-28T16:00:00Z', quien: PERSONAS_EJEMPLO[estudioNorte.ws].nombre, negocio: estudioNorte.nombre, ws: estudioNorte.ws },
]

const SESIONES: SesionAgente[] = [
  {
    id: 31, workspace_id: clinica.ws, sesion_id: 'ses-ejemplo-31', empezo_en: '2026-11-05T18:00:00.000Z', termino_en: '2026-11-05T18:40:00.000Z',
    acta: { titulo: 'Armar la secuencia de bienvenida', resumen: 'Pidió tres mensajes para los pacientes nuevos y ajustó los horarios.', turnos: 5, herramientas: 7 },
    turnos: [{ ts: '2026-11-05T18:01:00.000Z', texto: 'Arma una bienvenida de tres mensajes para los pacientes del formulario.' }],
    redacciones: 0, created_at: '2026-11-05T18:00:00.000Z',
  },
]

const NOMBRES: Record<number, string> = NOMBRES_EJEMPLO

export const EVENTOS_EJEMPLO: VistaEventos = armarEventos({
  pedidos: PEDIDOS_EJEMPLO,
  ingresos: { movimientos: MOVIMIENTOS_EJEMPLO, clientes: CLIENTES },
  altas: Object.values(NEGOCIOS).map((n) => ({ ws: n.ws, nombre: n.nombre, creado: n.alta })),
  actividad: { acciones: ACCIONES, nombres: NOMBRES, medido: true, personas },
  errores: { errores: ERRORES, hayMas: false, reportes: REPORTES, nombres: NOMBRES },
  agente: { sesiones: SESIONES, nombres: NOMBRES },
  avisos: [],
  ahora: HOY_EJEMPLO,
  topes: { acciones: 100, reportes: 40, sesiones: 200, accionesDeUnNegocio: 300, reportesDeUnNegocio: 100 },
})

// ── El gasto de IA (Costs) ─────────────────────────────────────────────────────────────────────────────────────────────────

const corte = (clave: string, llamadas: number, costUsd: number): Corte => ({ clave, llamadas, tokens: llamadas * 1200, costUsd })

/**
 * Noviembre: US$ 4,20 en 890 llamadas, lo mismo que reparte Customers › Cost Drivers (./clientes.ts) por negocio; las de Estudio
 * Norte del 4 y el 5 (US$ 0,75 y 0,51) son las de su ficha (./cliente.ts). Octubre, US$ 3,50 (para las comparaciones).
 */
export const GASTO_NOVIEMBRE: ResumenPeriodo = {
  periodo: '2026-11', desde: null, hasta: null, filas: 890, llamadas: 890, tokens: 890 * 1200, costUsd: 4.2,
  porFeature: [corte('mako-doer-in', 420, 1.9), corte('plan-fathom', 160, 1.2), corte('closing', 60, 0.7), corte('lead_insights', 250, 0.4)],
  porProveedor: [corte('anthropic', 640, 3.8), corte('openai', 120, 0.4), corte('gemini', 130, 0)],
  porModelo: [corte('claude-haiku-4-5', 520, 2.4), corte('claude-sonnet-4-5', 120, 1.4), corte('gpt-4o-mini', 120, 0.4), corte('gemini-2.5-flash', 130, 0)],
  porDia: [corte('2026-11-02', 150, 0.62), corte('2026-11-03', 230, 1.05), corte('2026-11-04', 300, 1.38), corte('2026-11-05', 210, 1.15)],
  porWorkspace: [
    { ...corte(String(clinica.ws), 412, 2.1), atribuible: true },
    { ...corte(String(estudioNorte.ws), 268, 1.26), atribuible: true },
    { ...corte(String(optica.ws), 90, 0.42), atribuible: true },
    { ...corte(String(WS_PLATAFORMA_EJEMPLO), 120, 0.42), atribuible: true },
  ],
  mesesDisponibles: ['2026-11', '2026-10', '2026-09'],
  delNegocio: { llamadas: 0, costUsd: 0 },
  delCredito: { llamadas: 0, costUsd: 0 },
}

export const GASTO_OCTUBRE: ResumenPeriodo = {
  ...GASTO_NOVIEMBRE,
  periodo: '2026-10', filas: 700, llamadas: 700, tokens: 700 * 1200, costUsd: 3.5,
  porFeature: [corte('mako-doer-in', 330, 1.6), corte('plan-fathom', 140, 1.1), corte('closing', 50, 0.6), corte('lead_insights', 180, 0.2)],
  porProveedor: [corte('anthropic', 520, 3.3), corte('openai', 80, 0.2), corte('gemini', 100, 0)],
  porModelo: [corte('claude-haiku-4-5', 420, 2.0), corte('claude-sonnet-4-5', 100, 1.3), corte('gpt-4o-mini', 80, 0.2), corte('gemini-2.5-flash', 100, 0)],
  porDia: [corte('2026-10-02', 160, 0.8), corte('2026-10-08', 210, 0.98), corte('2026-10-15', 180, 0.92), corte('2026-10-27', 150, 0.8)],
  porWorkspace: [],
}

export const COSTOS_EJEMPLO: VistaCostos = armarCostos({
  periodo: '2026-11',
  actual: GASTO_NOVIEMBRE,
  previo: GASTO_OCTUBRE,
  hoy: HOY_EJEMPLO,
  avisos: [],
  nombreDeFeature: nombresDeFeatures(CATALOGO_MODELOS),
  entradas: ingresosEjemplo.entradas,
})
