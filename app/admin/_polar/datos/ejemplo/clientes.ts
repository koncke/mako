// =============================================================================
// Datos de EJEMPLO de Admin › Customers (la lista, Overview, Top Customers, At Risk y Cost Drivers), para capturas y
// pruebas de las vistas de app/admin/_polar/web/Customer y app/admin/(polar)/customers.
// =============================================================================
// FICTICIOS: ningún negocio, nombre ni monto es de un cliente real. Se arman con las mismas funciones puras que usa el
// server (app/admin/_polar/datos/clientes.ts), así lo que se ve es lo que la página dibujaría con esos datos.

import type { ClienteResumen, Entrada } from '@/lib/admin-ingresos-reglas'
import type { FilaCliente } from '@/lib/clientes-plataforma'
import type { ResumenPeriodo } from '@/lib/costos-ia'
import {
  listaDeClientes,
  vistaDeAtRisk,
  vistaDeCostos,
  vistaDeOverview,
  vistaDeTop,
  type ClienteDeLista,
  type Lectura,
  type PropsAtRisk,
  type PropsCostos,
  type PropsOverview,
  type PropsTop,
} from '../clientes'

/** «Ahora» de los ejemplos: el 6 de noviembre de 2026 a las 15:00 (hora de Buenos Aires). */
export const AHORA_EJEMPLO = Date.parse('2026-11-06T18:00:00Z')
export const MES_EJEMPLO = '2026-11'

type FilaEjemplo = Pick<FilaCliente, 'ws' | 'nombre' | 'capa' | 'estado' | 'creado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt' | 'segmentos'>

const fila = (ws: number, nombre: string, creado: string, extra: Partial<FilaEjemplo> = {}): FilaEjemplo => ({
  ws, nombre, capa: 'completo', estado: 'activo', creado, motivoRiesgo: null, sinEntrar: 2, mrrUsd: 0, planAManoTxt: null, segmentos: ['cliente'], ...extra,
})

const filas: FilaEjemplo[] = [
  fila(21, 'Estudio Norte', '2026-04-12T15:00:00Z', { mrrUsd: 470 }),
  fila(22, 'Panadería La Espiga', '2026-06-03T13:00:00Z', { mrrUsd: 470 }),
  fila(23, 'Clínica Dental Sonríe', '2026-07-20T16:30:00Z', { capa: 'agencia', mrrUsd: 970 }),
  fila(24, 'Óptica Visión Clara', '2026-09-01T12:00:00Z', { motivoRiesgo: 'sin-uso', sinEntrar: 19 }),
  fila(25, 'Gimnasio Fuerza Sur', '2026-09-28T18:00:00Z', { estado: 'pausado', motivoRiesgo: 'pausado' }),
  fila(26, 'Taller Mecánico Ruta 9', '2026-10-15T14:00:00Z', { motivoRiesgo: 'cobro', mrrUsd: 470 }),
  fila(27, 'Floristería Pétalo', '2026-11-02T11:00:00Z', { sinEntrar: 0 }),
]

const resumen = (clave: string, ws: number | null, nombre: string, extra: Partial<ClienteResumen>): ClienteResumen => ({
  clave, ws, nombre, leadId: null, total: 0, sinDolares: 0, pagos: 0, primerPago: null, ultimoPago: null, mrr: 0,
  estado: 'pago-unico', proximo: null, diasAtraso: null, ...extra,
})

const clientesIngreso: ClienteResumen[] = [
  resumen('ws:21', 21, 'Estudio Norte', { total: 3290, pagos: 7, mrr: 470, estado: 'al-dia' }),
  resumen('ws:22', 22, 'Panadería La Espiga', { total: 2350, pagos: 5, mrr: 470, estado: 'atrasado', diasAtraso: 4 }),
  resumen('ws:23', 23, 'Clínica Dental Sonríe', { total: 3880, pagos: 4, mrr: 970, estado: 'al-dia' }),
  resumen('lead:501', null, 'Ana Gómez', { total: 300, pagos: 1, estado: 'pago-unico' }),
]

const entrada = (cliente: string, nombre: string, fecha: string, usd: number): Entrada => ({
  fecha, usd, medio: 'transferencia', recurrente: true, nombre, cliente,
})

const entradas: Entrada[] = [
  ...['2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05'].map((f) => entrada('ws:21', 'Estudio Norte', f, 470)),
  ...['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'].map((f) => entrada('ws:22', 'Panadería La Espiga', f, 470)),
  ...['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'].map((f) => entrada('ws:23', 'Clínica Dental Sonríe', f, 970)),
  entrada('lead:501', 'Ana Gómez', '2026-10-22', 300),
]

const lecturaClientes: Lectura<{ filas: FilaEjemplo[] }> = { ok: true, datos: { filas }, avisos: [] }
const lecturaIngresos: Lectura<{ entradas: Entrada[]; clientes: ClienteResumen[] }> = {
  ok: true, datos: { entradas, clientes: clientesIngreso }, avisos: [],
}

const corte = (clave: string, llamadas: number, costUsd: number) => ({ clave, llamadas, tokens: llamadas * 1800, costUsd, atribuible: true })
const lecturaCostos: Lectura<Pick<ResumenPeriodo, 'periodo' | 'costUsd' | 'porWorkspace'>> = {
  ok: true,
  datos: {
    periodo: MES_EJEMPLO,
    costUsd: 4.2,
    porWorkspace: [corte('23', 412, 2.1), corte('21', 268, 1.26), corte('24', 90, 0.42), corte('9', 120, 0.42)],
  },
  avisos: [],
}

export const LISTA_EJEMPLO: ClienteDeLista[] = listaDeClientes(filas)
export const OVERVIEW_EJEMPLO: PropsOverview = vistaDeOverview(lecturaClientes, lecturaIngresos, lecturaCostos, MES_EJEMPLO, AHORA_EJEMPLO)
export const TOP_EJEMPLO: PropsTop = vistaDeTop(lecturaIngresos, AHORA_EJEMPLO)
export const AT_RISK_EJEMPLO: PropsAtRisk = vistaDeAtRisk(lecturaClientes, lecturaIngresos)
export const COSTOS_EJEMPLO: PropsCostos = vistaDeCostos(lecturaClientes, lecturaCostos, MES_EJEMPLO)
