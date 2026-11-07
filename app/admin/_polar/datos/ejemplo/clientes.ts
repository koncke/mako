// =============================================================================
// Datos de EJEMPLO de Admin › Customers (la lista, Overview, Top Customers, At Risk y Cost Drivers), para capturas y
// pruebas de las vistas de app/admin/_polar/web/Customer y app/admin/(polar)/customers.
// =============================================================================
// FICTICIOS: ningún negocio, nombre ni monto es de un cliente real. Se arman con las mismas funciones puras que usa el
// server (app/admin/_polar/datos/clientes.ts), así lo que se ve es lo que la página dibujaría con esos datos. Los negocios,
// sus números, sus planes y sus pagos son los de ./negocios.ts (los mismos que el Overview y la ficha).

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
import { LEAD_SIN_CUENTA, MRR_EJEMPLO, NEGOCIOS, PAGOS_EJEMPLO, WS_PLATAFORMA_EJEMPLO, pagadoPor, type NegocioEjemplo } from './negocios'

/** «Ahora» de los ejemplos: el 6 de noviembre de 2026 a las 15:00 (hora de Buenos Aires). */
export const AHORA_EJEMPLO = Date.parse('2026-11-06T18:00:00Z')
export const MES_EJEMPLO = '2026-11'

type FilaEjemplo = Pick<FilaCliente, 'ws' | 'nombre' | 'capa' | 'estado' | 'creado' | 'motivoRiesgo' | 'sinEntrar' | 'mrrUsd' | 'planAManoTxt' | 'segmentos'>

/** Un negocio de ./negocios.ts como lo lee `vistaDeClientes`: la capa de su plan y lo que paga hoy por mes. */
const fila = (n: NegocioEjemplo, extra: Partial<FilaEjemplo> = {}): FilaEjemplo => ({
  ws: n.ws, nombre: n.nombre, capa: n.plan?.capa ?? 'agencia', estado: 'activo', creado: n.alta, motivoRiesgo: null, sinEntrar: 2,
  mrrUsd: MRR_EJEMPLO[n.ws] ?? 0, planAManoTxt: null, segmentos: ['cliente'], ...extra,
})

const filas: FilaEjemplo[] = [
  fila(NEGOCIOS.estudioNorte, { sinEntrar: 0 }),
  fila(NEGOCIOS.panaderia, { sinEntrar: 1 }),
  fila(NEGOCIOS.clinica),
  fila(NEGOCIOS.optica, { motivoRiesgo: 'sin-uso', sinEntrar: 19 }),
  fila(NEGOCIOS.gimnasio, { estado: 'pausado', motivoRiesgo: 'pausado', sinEntrar: 12 }),
  fila(NEGOCIOS.taller, { motivoRiesgo: 'cobro', sinEntrar: 3 }),
  fila(NEGOCIOS.floristeria, { sinEntrar: 0 }),
  fila(NEGOCIOS.viajes, { motivoRiesgo: 'cobro', sinEntrar: 1 }),
  fila(NEGOCIOS.agencia, { segmentos: ['agency'], sinEntrar: 0 }),
]

const resumen = (clave: string, ws: number | null, nombre: string, extra: Partial<ClienteResumen>): ClienteResumen => {
  const pagado = pagadoPor(clave)
  return {
    clave, ws, nombre, leadId: null, total: pagado.total, sinDolares: pagado.sinDolares, pagos: pagado.pagos,
    primerPago: pagado.primero, ultimoPago: pagado.ultimo, mrr: ws != null ? (MRR_EJEMPLO[ws] ?? 0) : 0, estado: 'al-dia',
    proximo: null, diasAtraso: null, ...extra,
  }
}

const de = (n: NegocioEjemplo, extra: Partial<ClienteResumen> = {}) => resumen(`ws:${n.ws}`, n.ws, n.nombre, extra)

/** Lo que dice `vistaDeIngresos().clientes` de cada uno: lo que pagó sale de los pagos de ./negocios.ts. */
const clientesIngreso: ClienteResumen[] = [
  de(NEGOCIOS.estudioNorte, { proximo: '2026-12-01' }),
  de(NEGOCIOS.panaderia, { estado: 'atrasado', proximo: '2026-11-02', diasAtraso: 4 }),
  de(NEGOCIOS.clinica, { proximo: '2026-12-01' }),
  de(NEGOCIOS.optica, { proximo: '2026-12-05' }),
  de(NEGOCIOS.gimnasio, { estado: 'cortado' }),
  de(NEGOCIOS.taller, { estado: 'atrasado', proximo: '2026-10-15', diasAtraso: 22 }),
  de(NEGOCIOS.floristeria, { proximo: '2026-12-02' }),
  de(NEGOCIOS.viajes, { estado: 'atrasado', proximo: '2026-11-02', diasAtraso: 4 }),
  resumen(LEAD_SIN_CUENTA.clave, null, LEAD_SIN_CUENTA.nombre, { leadId: LEAD_SIN_CUENTA.leadId, estado: 'pago-unico' }),
]

const entradas: Entrada[] = PAGOS_EJEMPLO.map((p) => ({
  fecha: p.fecha, usd: p.usd, medio: p.medio, recurrente: p.recurrente, nombre: p.nombre, cliente: p.cliente, id: p.id, concepto: p.concepto,
}))

const lecturaClientes: Lectura<{ filas: FilaEjemplo[] }> = { ok: true, datos: { filas }, avisos: [] }
const lecturaIngresos: Lectura<{ entradas: Entrada[]; clientes: ClienteResumen[] }> = {
  ok: true, datos: { entradas, clientes: clientesIngreso }, avisos: [],
}

const corte = (clave: string, llamadas: number, costUsd: number) => ({ clave, llamadas, tokens: llamadas * 1800, costUsd, atribuible: true })
/** El gasto de IA de noviembre, como lo lee `leerCostos`: lo reparte Cost Drivers y lo dice la ficha de cada negocio. */
export const LECTURA_COSTOS_EJEMPLO: Lectura<Pick<ResumenPeriodo, 'periodo' | 'costUsd' | 'porWorkspace'>> = {
  ok: true,
  datos: {
    periodo: MES_EJEMPLO,
    costUsd: 4.2,
    // El de la plataforma (MaKo) no es de ningún cliente: no entra en la lista.
    porWorkspace: [
      corte(String(NEGOCIOS.clinica.ws), 412, 2.1),
      corte(String(NEGOCIOS.estudioNorte.ws), 268, 1.26),
      corte(String(NEGOCIOS.optica.ws), 90, 0.42),
      corte(String(WS_PLATAFORMA_EJEMPLO), 120, 0.42),
    ],
  },
  avisos: [],
}

export const LISTA_EJEMPLO: ClienteDeLista[] = listaDeClientes(filas)
export const OVERVIEW_EJEMPLO: PropsOverview = vistaDeOverview(lecturaClientes, lecturaIngresos, LECTURA_COSTOS_EJEMPLO, MES_EJEMPLO, AHORA_EJEMPLO)
export const TOP_EJEMPLO: PropsTop = vistaDeTop(lecturaIngresos, AHORA_EJEMPLO)
export const AT_RISK_EJEMPLO: PropsAtRisk = vistaDeAtRisk(lecturaClientes, lecturaIngresos)
export const COSTOS_EJEMPLO: PropsCostos = vistaDeCostos(lecturaClientes, LECTURA_COSTOS_EJEMPLO, MES_EJEMPLO)
