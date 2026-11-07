// =============================================================================
// Datos de EJEMPLO de la ficha de un negocio (Admin › Customers › <negocio>: Overview, Usage, Events y Members), para capturas
// y pruebas de las vistas de app/admin/_polar/web/Customer/CustomerPage y app/admin/(polar)/customers/[id].
// =============================================================================
// FICTICIOS: ningún negocio, persona, email ni monto es de un cliente real. El negocio, su número (42), su plan y sus pagos
// son los de ./negocios.ts (los mismos que el Overview y la lista de Customers). Lo que se arma (los eventos, el contacto, las
// personas) sale de las mismas funciones puras que usa el server (app/admin/_polar/datos/cliente.ts, y para el Timeline las de
// Analytics › Events, app/admin/_polar/datos/eventos.ts: los eventos del negocio son ésos).

import type { ClienteVenta, Pedido, SuscripcionVenta } from '../ventas'
import {
  contactoDe,
  miembrosDe,
  type AltaNegocio,
  type ComputadoraNegocio,
  type ConexionNegocio,
  type IaDelDia,
  type MiembroNegocio,
  type NegocioCabecera,
  type UsuarioParaMiembro,
} from '../cliente'
import { armarEventos, timelineDelNegocio, type EventoDeTimeline } from '../eventos'
import { ESENCIAL, HOY_NEGOCIOS, NEGOCIOS, PAGOS_EJEMPLO, PRO, pagadoPor } from './negocios'
import { costoDelNegocio } from '../clientes'
import { LECTURA_COSTOS_EJEMPLO } from './clientes'
import type { CustomerOverviewProps } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerOverview'
import type { CustomerUsageViewProps } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView'

const { estudioNorte, panaderia } = NEGOCIOS

/** Estudio Norte, el 42 en todos los ejemplos (./negocios.ts). */
export const WS_EJEMPLO = estudioNorte.ws
export const HOY_EJEMPLO = HOY_NEGOCIOS
/** El negocio de al lado (sus eventos y sus personas no son de éste). */
const OTRO = panaderia

const cliente: ClienteVenta = { clave: `ws:${WS_EJEMPLO}`, nombre: estudioNorte.nombre, ws: WS_EJEMPLO, leadId: 7, email: null }

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
    created_at: '2026-09-01T12:00:00Z', workspace_id: OTRO.ws, rol_ws: 'admin', invitacion_enviada_at: null,
  },
  {
    id: 105, email: 'equipo@ejemplo.com', nombre: 'Equipo', rol: 'admin', estado: 'activo', ultimo_login: null,
    created_at: '2026-01-01T12:00:00Z', workspace_id: WS_EJEMPLO, rol_ws: null, invitacion_enviada_at: null,
  },
]

export const MIEMBROS_EJEMPLO: MiembroNegocio[] = miembrosDe(USUARIOS_EJEMPLO, WS_EJEMPLO)

export const CABECERA_EJEMPLO: NegocioCabecera = {
  ws: WS_EJEMPLO, nombre: estudioNorte.nombre, plan: PRO.nombre, capa: PRO.capa, estado: 'activo',
  contacto: contactoDe(MIEMBROS_EJEMPLO), planAMano: null,
}

export const ALTA_EJEMPLO: AltaNegocio = {
  creado: estudioNorte.alta, plan: PRO.nombre, estado: 'activo', onboardingHecho: true, prueba: false, planAMano: null,
  segmentos: ['Cliente'], agencia: null,
}

/** Sus pedidos: los pagos de Estudio Norte de ./negocios.ts (Esencial en julio y agosto, Pro desde septiembre), el más nuevo primero. */
export const PEDIDOS_EJEMPLO: Pedido[] = PAGOS_EJEMPLO.filter((p) => p.ws === WS_EJEMPLO)
  .map((p): Pedido => ({
    id: p.id, fecha: p.fecha, cliente, concepto: p.concepto, medio: p.medio, recurrente: p.recurrente, usd: p.usd, estado: 'paid',
    recibo: null, cobroId: null, origen: 'crm',
  }))
  .reverse()

const pagado = pagadoPor(`ws:${WS_EJEMPLO}`)

export const SUSCRIPCIONES_EJEMPLO: SuscripcionVenta[] = [
  {
    id: 'l-7', fuente: 'manual', cliente, estado: 'active', empezo: '2026-07-01', renovacion: '2026-12-01', terminaEl: null, termino: null,
    producto: PRO.nombre, mensualidadUsd: PRO.precioUsd, mensualidadEstimada: false, diaDeCobro: 1, meses: null, deudaUsd: 0, mesesSinPagar: 0,
    mesesParciales: 0, pagadoUsd: pagado.total, proximo: { mes: '2026-12', vence: '2026-12-01', faltaUsd: PRO.precioUsd, vencido: false }, historia: [],
    renovacionFallida: null, cobroParaCortar: null,
  },
]

export const CONEXIONES_EJEMPLO: ConexionNegocio[] = [
  { key: 'meta', nombre: 'Meta', conectada: true },
  { key: 'gemini', nombre: 'Gemini', conectada: true },
  { key: 'calendly', nombre: 'Calendly', conectada: false },
]

export const COMPUTADORAS_EJEMPLO: ComputadoraNegocio[] = [
  { id: 1, nombre: 'Laptop de Ana', sistema: 'Mac', enLinea: true, conectadaAt: '2026-10-01T12:00:00Z' },
]

/** Lo que pasó en el negocio, armado como lo arma Analytics › Events (con un negocio de otro al lado, que no entra). */
export const EVENTOS_EJEMPLO: EventoDeTimeline[] = timelineDelNegocio(armarEventos({
  pedidos: [
    ...PEDIDOS_EJEMPLO,
    {
      ...PEDIDOS_EJEMPLO[0], id: 'p-40', fecha: '2026-10-02', usd: ESENCIAL.precioUsd, concepto: 'Mensualidad de octubre',
      cliente: { ...cliente, clave: `ws:${OTRO.ws}`, nombre: OTRO.nombre, ws: OTRO.ws },
    },
  ],
  ingresos: {
    movimientos: [
      { fecha: '2026-09-01', cliente: `ws:${WS_EJEMPLO}`, tipo: 'sube', antes: ESENCIAL.precioUsd, despues: PRO.precioUsd },
      { fecha: '2026-07-01', cliente: `ws:${WS_EJEMPLO}`, tipo: 'nuevo', antes: 0, despues: ESENCIAL.precioUsd },
    ],
    clientes: [{ clave: `ws:${WS_EJEMPLO}`, ws: WS_EJEMPLO, nombre: estudioNorte.nombre }, { clave: `ws:${OTRO.ws}`, ws: OTRO.ws, nombre: OTRO.nombre }],
  },
  altas: [{ ws: WS_EJEMPLO, nombre: estudioNorte.nombre, creado: ALTA_EJEMPLO.creado }, { ws: OTRO.ws, nombre: OTRO.nombre, creado: OTRO.alta }],
  actividad: {
    acciones: [
      { creado: '2026-11-05T15:00:00Z', usuario: 101, ws: WS_EJEMPLO, operacion: 'crear_lead', titulo: 'Crear un lead', area: 'crm', canal: 'whatsapp', tipo: 'accion', ok: true },
      { creado: '2026-11-03T11:00:00Z', usuario: 101, ws: WS_EJEMPLO, operacion: 'mandar_email', titulo: 'Mandar un email', area: 'email', canal: 'app', tipo: 'accion', ok: false },
    ],
    nombres: { [WS_EJEMPLO]: estudioNorte.nombre, [OTRO.ws]: OTRO.nombre },
    personas: [{ id: 101, nombre: 'Ana Gómez', email: 'ana@ejemplo.com' }],
    medido: true,
  },
  errores: {
    errores: [{
      id: 9, titulo: 'No cargó el tablero', origen: 'navegador', veces: 3, primeraVez: '2026-11-01T10:00:00Z', ultimaVez: '2026-11-02T10:00:00Z',
      ruta: '/plan', mensaje: null, stack: null, navegador: null, negocios: [WS_EJEMPLO], personas: 1, ticketId: null, ticketEstado: null, ticketResueltoAt: null,
    }],
    hayMas: false,
    reportes: [{ id: 55, titulo: 'No me llega el aviso de pago', tipo: 'bug', estado: 'en_curso', prioridad: 'media', canal: 'app', creado: '2026-10-28T16:00:00Z', quien: 'Ana Gómez', negocio: estudioNorte.nombre, ws: WS_EJEMPLO }],
    nombres: { [WS_EJEMPLO]: estudioNorte.nombre },
  },
  agente: null,
  avisos: [],
  ahora: new Date(`${HOY_EJEMPLO}T15:00:00Z`),
  topes: { acciones: 100, reportes: 40, sesiones: 200, accionesDeUnNegocio: 300, reportesDeUnNegocio: 100 },
}).eventos, WS_EJEMPLO)

export const OVERVIEW_EJEMPLO: CustomerOverviewProps = {
  negocio: CABECERA_EJEMPLO,
  alta: ALTA_EJEMPLO,
  inicio: estudioNorte.alta.slice(0, 10),
  pedidos: PEDIDOS_EJEMPLO,
  // Su gasto de IA de noviembre, con la regla de Cost Drivers y la MISMA lectura (./clientes.ts): 268 llamadas, US$ 1,26.
  costo: LECTURA_COSTOS_EJEMPLO.ok ? costoDelNegocio(LECTURA_COSTOS_EJEMPLO.datos, WS_EJEMPLO) : null,
  suscripciones: SUSCRIPCIONES_EJEMPLO,
  conexiones: CONEXIONES_EJEMPLO,
  computadoras: COMPUTADORAS_EJEMPLO,
  eventos: EVENTOS_EJEMPLO,
}

/** Las llamadas de IA del negocio: las de noviembre son las que cuenta Customers › Cost Drivers (268: ./clientes.ts). Sin plata. */
const IA_EJEMPLO: IaDelDia[] = [
  { dia: '2026-08-20', llamadas: 64 },
  { dia: '2026-09-15', llamadas: 152 },
  { dia: '2026-10-08', llamadas: 210 },
  { dia: '2026-11-04', llamadas: 160 },
  { dia: '2026-11-05', llamadas: 108 },
]

/** Una fila de uso medido: un día, una persona, una tab. */
const uso = (dia: string, usuario: number, tab: string, pantallas: number, acciones: number) => ({ dia, usuario, tab, pantallas, acciones })

export const USO_EJEMPLO: CustomerUsageViewProps = {
  medido: true,
  // Se mide desde el 1 de agosto (la medición del uso por pantalla, mig 0398): julio no es un cero, es que no se medía.
  desdeMedido: '2026-08-01',
  filas: [
    uso('2026-08-06', 101, 'crm', 9, 3),
    uso('2026-08-19', 101, 'plan', 4, 1),
    uso('2026-08-27', 102, 'crm', 6, 2),
    uso('2026-09-03', 101, 'crm', 14, 6),
    uso('2026-09-17', 102, 'crm', 11, 4),
    uso('2026-09-24', 101, 'plan', 5, 0),
    uso('2026-10-02', 101, 'crm', 16, 7),
    uso('2026-10-15', 102, 'crm', 13, 3),
    uso('2026-10-22', 101, 'plan', 6, 2),
    uso('2026-11-04', 101, 'crm', 12, 5),
    uso('2026-11-05', 101, 'crm', 8, 2),
    uso('2026-11-05', 102, 'crm', 4, 1),
    uso('2026-11-05', 101, 'plan', 3, 0),
  ],
  tabs: [
    { key: 'crm', label: 'CRM', keys: ['crm'] },
    { key: 'plan', label: 'Plan', keys: ['plan'] },
    { key: 'automations', label: 'Automations', keys: ['automations'] },
  ],
  ia: IA_EJEMPLO,
  inicio: estudioNorte.alta.slice(0, 10),
}
