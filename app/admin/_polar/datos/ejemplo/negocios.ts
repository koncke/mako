// =============================================================================
// Los NEGOCIOS de los datos de ejemplo de Admin, en UN lugar (6/11/2026)
// =============================================================================
// FICTICIOS: ningún negocio, persona, email ni monto es de un cliente real. Antes cada archivo de ejemplo tenía su propia lista
// y el mismo negocio cambiaba de número de una pantalla a otra («Estudio Norte» era el ws 21 en Customers y el 42 en su ficha),
// o el mismo número era otro negocio, y pagaba US$ 470 o US$ 238 por mes, montos que no son de ningún plan de MaKo. Acá:
//   · cada negocio tiene SU número, el mismo en Overview, Customers, la ficha, Sales, Products y Analytics. «Estudio Norte»
//     es el 42;
//   · lo que paga cada uno es el precio de su plan (`PLANES_MAKO_DEFAULT`, lib/planes-mako.ts: Esencial y Pro, por mes o por
//     año), nunca un número inventado;
//   · los pagos están acá UNA vez y los demás ejemplos los toman de acá (lo cobrado por mes del Overview, lo que pagó cada uno
//     en Customers y los pedidos de la ficha suman lo mismo).

import { PLANES_MAKO_DEFAULT, type PlanMako } from '@/lib/planes-mako'
import type { Movimiento } from '@/lib/admin-ingresos-reglas'

const plan = (id: 'esencial' | 'pro'): PlanMako => {
  const p = PLANES_MAKO_DEFAULT.find((x) => x.id === id)
  if (!p) throw new Error(`Falta el plan «${id}» en PLANES_MAKO_DEFAULT`)
  return p
}

/** MaKo Esencial (US$ 47 por mes, US$ 470 por año; capa `completo`). */
export const ESENCIAL = plan('esencial')
/** MaKo Pro (US$ 97 por mes, US$ 970 por año; capa `agencia`). */
export const PRO = plan('pro')

/** El día «de hoy» de los ejemplos. */
export const HOY_NEGOCIOS = '2026-11-06'

/** El workspace de la plataforma (MaKo), que no es un cliente. */
export const WS_PLATAFORMA_EJEMPLO = 9

export type NegocioEjemplo = { ws: number; nombre: string; plan: PlanMako | null; alta: string }

export const NEGOCIOS = {
  estudioNorte: { ws: 42, nombre: 'Estudio Norte', plan: PRO, alta: '2026-07-01T12:00:00Z' },
  panaderia: { ws: 43, nombre: 'Panadería La Espiga', plan: ESENCIAL, alta: '2026-06-02T13:00:00Z' },
  clinica: { ws: 44, nombre: 'Clínica Dental Sonríe', plan: PRO, alta: '2026-08-01T16:30:00Z' },
  optica: { ws: 45, nombre: 'Óptica Visión Clara', plan: ESENCIAL, alta: '2026-09-05T12:00:00Z' },
  gimnasio: { ws: 46, nombre: 'Gimnasio Fuerza Sur', plan: ESENCIAL, alta: '2026-09-28T18:00:00Z' },
  taller: { ws: 47, nombre: 'Taller Mecánico Ruta 9', plan: ESENCIAL, alta: '2026-09-15T14:00:00Z' },
  floristeria: { ws: 48, nombre: 'Floristería Pétalo', plan: PRO, alta: '2026-11-02T11:00:00Z' },
  viajes: { ws: 49, nombre: 'Viajes Horizonte', plan: PRO, alta: '2026-08-02T15:00:00Z' },
  agencia: { ws: 50, nombre: 'Agencia Brújula', plan: null, alta: '2026-10-10T12:00:00Z' },
} as const satisfies Record<string, NegocioEjemplo>

/** Los nombres por número, para lo que arma la actividad y la búsqueda. */
export const NOMBRES_EJEMPLO: Record<number, string> = Object.fromEntries(Object.values(NEGOCIOS).map((n) => [n.ws, n.nombre]))

/** Alguien que pagó sin tener todavía su cuenta de MaKo (un lead del CRM de la plataforma). */
export const LEAD_SIN_CUENTA = { clave: 'lead:501', nombre: 'Marta Ríos', leadId: 501 } as const

export type PagoEjemplo = {
  id: string
  /** `ws:<n>` o la clave del lead. */
  cliente: string
  ws: number | null
  nombre: string
  fecha: string
  /** `null` = se cobró en pesos y no tiene su valor en dólares (no suma). */
  usd: number | null
  recurrente: boolean
  concepto: string
  medio: string
}

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Las mensualidades de un negocio: una por fecha, al precio del plan de ese mes. */
function mensualidades(n: NegocioEjemplo, cobros: ReadonlyArray<[fecha: string, p: PlanMako | 'pesos']>): PagoEjemplo[] {
  return cobros.map(([fecha, p]) => ({
    id: `pg-${n.ws}-${fecha}`,
    cliente: `ws:${n.ws}`,
    ws: n.ws,
    nombre: n.nombre,
    fecha,
    usd: p === 'pesos' ? null : p.precioUsd,
    recurrente: true,
    concepto: `Mensualidad de ${MES[Number(fecha.slice(5, 7)) - 1]}${p === 'pesos' ? ', en pesos' : ''}`,
    medio: p === 'pesos' ? 'transferencia' : 'stripe',
  }))
}

/**
 * Todos los pagos que entraron, el más viejo primero. Estudio Norte empezó con Esencial (su primera mensualidad, en pesos) y
 * pasó a Pro en septiembre; Gimnasio Fuerza Sur pagó un mes y se pausó; Taller Mecánico Ruta 9 tuvo un cobro fallido el
 * 15 de octubre; Panadería La Espiga y Viajes Horizonte no pagaron la del 2 de noviembre; Marta Ríos pagó un año de Esencial
 * sin tener todavía su cuenta.
 */
export const PAGOS_EJEMPLO: PagoEjemplo[] = [
  ...mensualidades(NEGOCIOS.estudioNorte, [['2026-07-01', 'pesos'], ['2026-08-01', ESENCIAL], ['2026-09-01', PRO], ['2026-10-01', PRO], ['2026-11-01', PRO]]),
  ...mensualidades(NEGOCIOS.panaderia, [['2026-06-02', ESENCIAL], ['2026-07-02', ESENCIAL], ['2026-08-02', ESENCIAL], ['2026-09-02', ESENCIAL], ['2026-10-02', ESENCIAL]]),
  ...mensualidades(NEGOCIOS.clinica, [['2026-08-01', PRO], ['2026-09-01', PRO], ['2026-10-01', PRO], ['2026-11-01', PRO]]),
  ...mensualidades(NEGOCIOS.optica, [['2026-09-05', ESENCIAL], ['2026-10-05', ESENCIAL], ['2026-11-05', ESENCIAL]]),
  ...mensualidades(NEGOCIOS.gimnasio, [['2026-09-28', ESENCIAL]]),
  ...mensualidades(NEGOCIOS.taller, [['2026-09-15', ESENCIAL]]),
  ...mensualidades(NEGOCIOS.floristeria, [['2026-11-02', PRO]]),
  ...mensualidades(NEGOCIOS.viajes, [['2026-08-02', PRO], ['2026-09-02', PRO], ['2026-10-02', PRO]]),
  {
    id: 'pg-lead-501', cliente: LEAD_SIN_CUENTA.clave, ws: null, nombre: LEAD_SIN_CUENTA.nombre, fecha: '2026-10-22',
    usd: ESENCIAL.precioAnualUsd ?? null, recurrente: false, concepto: `${ESENCIAL.nombre}, un año`, medio: 'mercadopago',
  },
].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id))

/** Lo que paga hoy por mes cada negocio (el precio de su plan, o 0 si está pausado o no paga). */
export const MRR_EJEMPLO: Record<number, number> = {
  [NEGOCIOS.estudioNorte.ws]: PRO.precioUsd,
  [NEGOCIOS.panaderia.ws]: ESENCIAL.precioUsd,
  [NEGOCIOS.clinica.ws]: PRO.precioUsd,
  [NEGOCIOS.optica.ws]: ESENCIAL.precioUsd,
  [NEGOCIOS.gimnasio.ws]: 0,
  [NEGOCIOS.taller.ws]: ESENCIAL.precioUsd,
  [NEGOCIOS.floristeria.ws]: PRO.precioUsd,
  [NEGOCIOS.viajes.ws]: PRO.precioUsd,
  [NEGOCIOS.agencia.ws]: 0,
}

/** Lo que pagó un cliente (`ws:<n>` o la clave del lead), en dólares, y cuántos pagos (los en pesos cuentan como pago). */
export function pagadoPor(cliente: string): { total: number; pagos: number; sinDolares: number; primero: string | null; ultimo: string | null } {
  const suyos = PAGOS_EJEMPLO.filter((p) => p.cliente === cliente)
  return {
    total: suyos.reduce((s, p) => s + (p.usd ?? 0), 0),
    pagos: suyos.length,
    sinDolares: suyos.filter((p) => p.usd == null).length,
    primero: suyos[0]?.fecha ?? null,
    ultimo: suyos[suyos.length - 1]?.fecha ?? null,
  }
}

const mov = (fecha: string, n: { ws: number }, tipo: Movimiento['tipo'], antes: number, despues: number): Movimiento => ({
  fecha, cliente: `ws:${n.ws}`, tipo, delta: despues - antes, antes, despues,
})

/**
 * Lo que cambió lo que paga por mes cada negocio (`movimientosDe` de lib/admin-ingresos-reglas.ts), el más nuevo primero: la
 * historia de los meses del Overview. Panadería La Espiga empieza en junio; Estudio Norte en julio (Esencial) y sube a Pro en
 * septiembre; Clínica Dental Sonríe y Viajes Horizonte en agosto; Óptica Visión Clara, Taller Mecánico Ruta 9 y Gimnasio Fuerza
 * Sur en septiembre; el gimnasio se corta en octubre; Floristería Pétalo empieza en noviembre. Acá y no en ./analytics.ts
 * (6/11/2026): el Overview (./resumen.ts) arma con ellos las suscripciones activas de sus métricas por defecto, y Analytics ›
 * Metrics y Events los toman de acá: una sola historia.
 */
export const MOVIMIENTOS_EJEMPLO: Movimiento[] = [
  mov('2026-11-02', NEGOCIOS.floristeria, 'nuevo', 0, PRO.precioUsd),
  mov('2026-10-28', NEGOCIOS.gimnasio, 'corte', ESENCIAL.precioUsd, 0),
  mov('2026-09-28', NEGOCIOS.gimnasio, 'nuevo', 0, ESENCIAL.precioUsd),
  mov('2026-09-15', NEGOCIOS.taller, 'nuevo', 0, ESENCIAL.precioUsd),
  mov('2026-09-05', NEGOCIOS.optica, 'nuevo', 0, ESENCIAL.precioUsd),
  mov('2026-09-01', NEGOCIOS.estudioNorte, 'sube', ESENCIAL.precioUsd, PRO.precioUsd),
  mov('2026-08-02', NEGOCIOS.viajes, 'nuevo', 0, PRO.precioUsd),
  mov('2026-08-01', NEGOCIOS.clinica, 'nuevo', 0, PRO.precioUsd),
  mov('2026-07-01', NEGOCIOS.estudioNorte, 'nuevo', 0, ESENCIAL.precioUsd),
  mov('2026-06-02', NEGOCIOS.panaderia, 'nuevo', 0, ESENCIAL.precioUsd),
]
