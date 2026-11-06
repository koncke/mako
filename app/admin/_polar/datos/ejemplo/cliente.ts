// =============================================================================
// Datos de EJEMPLO de la ficha de un negocio (Admin › Customers › <negocio>: Overview, Usage, Events y Members), para capturas
// y pruebas de las vistas de app/admin/_polar/web/Customer/CustomerPage y app/admin/(polar)/customers/[id].
// =============================================================================
// FICTICIOS: ningún negocio, persona, email ni monto es de un cliente real. Lo que se arma (los eventos, el contacto, las
// personas) sale de las mismas funciones puras que usa el server (app/admin/_polar/datos/cliente.ts, y para el Timeline las de
// Analytics › Events, app/admin/_polar/datos/eventos.ts: los eventos del negocio son ésos).

import type { ClienteVenta, Pedido, SuscripcionVenta } from '../ventas'
import {
  contactoDe,
  estadoDeLaCabecera,
  miembrosDe,
  ultimoIngresoDe,
  type AltaNegocio,
  type ComputadoraNegocio,
  type ConexionNegocio,
  type IaDelDia,
  type MiembroNegocio,
  type NegocioCabecera,
  type UsuarioParaMiembro,
} from '../cliente'
import { armarEventos, timelineDelNegocio, type EventoDeTimeline } from '../eventos'
import type { CustomerOverviewProps } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerOverview'
import type { CustomerUsageViewProps } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView'

export const WS_EJEMPLO = 42
export const HOY_EJEMPLO = '2026-11-06'

const cliente: ClienteVenta = { clave: `ws:${WS_EJEMPLO}`, nombre: 'Estudio Norte', ws: WS_EJEMPLO, leadId: 7, email: null }

export const USUARIOS_EJEMPLO: UsuarioParaMiembro[] = [
  {
    id: 101, email: 'ana@ejemplo.com', nombre: 'Ana Gómez', rol: 'usuario', estado: 'activo', ultimo_login: '2026-11-05T14:20:00Z',
    created_at: '2026-07-01T12:00:00Z', workspace_id: WS_EJEMPLO, rol_ws: 'admin', invitacion_enviada_at: '2026-07-01T12:01:00Z', mfa_activo: true,
  },
  {
    id: 102, email: 'bruno@ejemplo.com', nombre: 'Bruno Díaz', rol: 'usuario', estado: 'activo', ultimo_login: '2026-10-20T09:00:00Z',
    created_at: '2026-08-10T12:00:00Z', workspace_id: WS_EJEMPLO, rol_ws: 'closer', invitacion_enviada_at: '2026-08-10T12:01:00Z', mfa_activo: false,
  },
  {
    id: 103, email: 'carla@ejemplo.com', nombre: '', rol: 'usuario', estado: 'invitado', ultimo_login: null,
    created_at: '2026-11-01T12:00:00Z', workspace_id: WS_EJEMPLO, rol_ws: 'setter', invitacion_enviada_at: null, mfa_activo: false,
  },
  // De otro negocio y del equipo de MaKo: no son de este (no entran en Members).
  {
    id: 104, email: 'dario@otro-ejemplo.com', nombre: 'Darío Ruiz', rol: 'usuario', estado: 'activo', ultimo_login: null,
    created_at: '2026-09-01T12:00:00Z', workspace_id: 43, rol_ws: 'admin', invitacion_enviada_at: null,
  },
  {
    id: 105, email: 'equipo@ejemplo.com', nombre: 'Equipo', rol: 'admin', estado: 'activo', ultimo_login: null,
    created_at: '2026-01-01T12:00:00Z', workspace_id: WS_EJEMPLO, rol_ws: null, invitacion_enviada_at: null,
  },
]

export const MIEMBROS_EJEMPLO: MiembroNegocio[] = miembrosDe(USUARIOS_EJEMPLO, WS_EJEMPLO)

export const CABECERA_EJEMPLO: NegocioCabecera = {
  ws: WS_EJEMPLO, nombre: 'Estudio Norte', plan: 'MaKo Pro', capa: 'agencia', estado: 'activo',
  contacto: contactoDe(MIEMBROS_EJEMPLO), planAMano: null,
  ...estadoDeLaCabecera('MaKo Pro', 'activo', undefined),
}

export const ALTA_EJEMPLO: AltaNegocio = {
  creado: '2026-07-01T12:00:00Z', plan: 'MaKo Pro', estado: 'activo', onboardingHecho: true, prueba: false, planAMano: null,
  segmentos: ['Cliente'], agencia: null,
  llegada: { origen: 'Instagram', interes: 'Conseguir más clientes', pdfNota: null }, primerMesUsd: 'no',
  actividad: { ultimoIngreso: ultimoIngresoDe(MIEMBROS_EJEMPLO), leads: { total: 48, diasDelUltimo: 2 }, sesionesAgente: 6 },
}

const pedido = (id: string, fecha: string, usd: number | null, concepto: string, recurrente: boolean, estado: Pedido['estado'] = 'paid'): Pedido => ({
  id, fecha, cliente, concepto, medio: 'transferencia', recurrente, usd, estado, recibo: null, cobroId: null, origen: 'crm',
})

export const PEDIDOS_EJEMPLO: Pedido[] = [
  pedido('p-31', '2026-11-04', 238, 'Mensualidad de noviembre', true),
  pedido('p-24', '2026-10-04', 238, 'Mensualidad de octubre', true),
  pedido('p-19', '2026-09-04', 200, 'Mensualidad de septiembre', true),
  pedido('p-12', '2026-07-02', 500, 'Puesta en marcha', false),
  pedido('p-9', '2026-07-01', null, 'Seña en pesos', false),
]

export const SUSCRIPCIONES_EJEMPLO: SuscripcionVenta[] = [
  {
    id: 'l-7', fuente: 'manual', cliente, estado: 'active', empezo: '2026-09-04', renovacion: '2026-12-04', terminaEl: null, termino: null,
    producto: 'MaKo Pro', mensualidadUsd: 238, mensualidadEstimada: false, diaDeCobro: 4, meses: null, deudaUsd: 0, mesesSinPagar: 0,
    mesesParciales: 0, pagadoUsd: 676, proximo: { mes: '2026-12', vence: '2026-12-04', faltaUsd: 238, vencido: false }, historia: [],
    renovacionFallida: null, cobroParaCortar: null,
  },
]

export const CONEXIONES_EJEMPLO: ConexionNegocio[] = [
  { key: 'meta', nombre: 'Meta', conectada: true },
  { key: 'gemini', nombre: 'Gemini', conectada: true },
  { key: 'calendly', nombre: 'Calendly', conectada: false },
]

export const COMPUTADORAS_EJEMPLO: ComputadoraNegocio[] = [
  { id: 1, nombre: 'Laptop de Ana', persona: 'Ana Gómez', sistema: 'Mac', enLinea: true, conectadaAt: '2026-10-01T12:00:00Z' },
]

/** Lo que pasó en el negocio, armado como lo arma Analytics › Events (con un negocio de otro al lado, que no entra). */
export const EVENTOS_EJEMPLO: EventoDeTimeline[] = timelineDelNegocio(armarEventos({
  pedidos: [...PEDIDOS_EJEMPLO, { ...pedido('p-40', '2026-10-10', 90, 'Mensualidad', true), cliente: { ...cliente, clave: 'ws:43', nombre: 'Taller Sur', ws: 43 } }],
  ingresos: {
    movimientos: [
      { fecha: '2026-10-04', cliente: `ws:${WS_EJEMPLO}`, tipo: 'sube', antes: 200, despues: 238 },
      { fecha: '2026-09-04', cliente: `ws:${WS_EJEMPLO}`, tipo: 'nuevo', antes: 0, despues: 200 },
    ],
    clientes: [{ clave: `ws:${WS_EJEMPLO}`, ws: WS_EJEMPLO, nombre: 'Estudio Norte' }, { clave: 'ws:43', ws: 43, nombre: 'Taller Sur' }],
  },
  altas: [{ ws: WS_EJEMPLO, nombre: 'Estudio Norte', creado: ALTA_EJEMPLO.creado }, { ws: 43, nombre: 'Taller Sur', creado: '2026-09-01T12:00:00Z' }],
  actividad: {
    acciones: [
      { creado: '2026-11-05T15:00:00Z', usuario: 101, ws: WS_EJEMPLO, operacion: 'crear_lead', titulo: 'Crear un lead', area: 'crm', canal: 'whatsapp', tipo: 'accion', ok: true },
      { creado: '2026-11-03T11:00:00Z', usuario: 101, ws: WS_EJEMPLO, operacion: 'mandar_email', titulo: 'Mandar un email', area: 'email', canal: 'app', tipo: 'accion', ok: false },
    ],
    nombres: { [WS_EJEMPLO]: 'Estudio Norte', 43: 'Taller Sur' },
    personas: [{ id: 101, nombre: 'Ana Gómez', email: 'ana@ejemplo.com' }],
    medido: true,
  },
  errores: {
    errores: [{
      id: 9, titulo: 'No cargó el tablero', origen: 'navegador', veces: 3, primeraVez: '2026-11-01T10:00:00Z', ultimaVez: '2026-11-02T10:00:00Z',
      ruta: '/plan', mensaje: null, stack: null, navegador: null, negocios: [WS_EJEMPLO], personas: 1, ticketId: null, ticketEstado: null, ticketResueltoAt: null,
    }],
    hayMas: false,
    reportes: [{ id: 55, titulo: 'No me llega el aviso de pago', tipo: 'bug', estado: 'en_curso', prioridad: 'media', canal: 'app', creado: '2026-10-28T16:00:00Z', quien: 'Ana Gómez', negocio: 'Estudio Norte', ws: WS_EJEMPLO }],
    nombres: { [WS_EJEMPLO]: 'Estudio Norte' },
  },
  agente: null,
  avisos: [],
  ahora: new Date(`${HOY_EJEMPLO}T15:00:00Z`),
  topes: { acciones: 100, reportes: 40, sesiones: 200, accionesDeUnNegocio: 300, reportesDeUnNegocio: 100 },
}).eventos, WS_EJEMPLO)

export const OVERVIEW_EJEMPLO: CustomerOverviewProps = {
  negocio: CABECERA_EJEMPLO,
  alta: ALTA_EJEMPLO,
  inicio: '2026-07-01',
  hoy: HOY_EJEMPLO,
  pedidos: PEDIDOS_EJEMPLO,
  mrrUsd: 238,
  suscripciones: SUSCRIPCIONES_EJEMPLO,
  conexiones: CONEXIONES_EJEMPLO,
  computadoras: COMPUTADORAS_EJEMPLO,
  eventos: EVENTOS_EJEMPLO,
}

const IA_EJEMPLO: IaDelDia[] = [
  { dia: '2026-11-04', llamadas: 40, costoUsd: 0.12 },
  { dia: '2026-11-05', llamadas: 25, costoUsd: 0.08 },
]

export const USO_EJEMPLO: CustomerUsageViewProps = {
  medido: true,
  desdeMedido: '2026-10-01',
  filas: [
    { dia: '2026-11-04', usuario: 101, tab: 'crm', pantallas: 12, acciones: 5 },
    { dia: '2026-11-05', usuario: 101, tab: 'crm', pantallas: 8, acciones: 2 },
    { dia: '2026-11-05', usuario: 102, tab: 'crm', pantallas: 4, acciones: 1 },
    { dia: '2026-11-05', usuario: 101, tab: 'plan', pantallas: 3, acciones: 0 },
  ],
  tabs: [
    { key: 'crm', label: 'CRM', keys: ['crm'] },
    { key: 'plan', label: 'Plan', keys: ['plan'] },
    { key: 'automations', label: 'Automations', keys: ['automations'] },
  ],
  ia: IA_EJEMPLO,
  inicio: '2026-07-01',
}
