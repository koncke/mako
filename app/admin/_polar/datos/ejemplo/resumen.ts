// =============================================================================
// Datos de EJEMPLO de Admin › Overview, para capturas y pruebas de la vista (app/admin/_polar/web/DashboardOverview)
// =============================================================================
// FICTICIOS: ningún nombre, correo ni monto es de un cliente real. Se arman con las mismas funciones puras que usa el
// server (app/admin/_polar/datos/resumen.ts), así lo que se ve es lo que la portada dibujaría con esos datos. Los negocios,
// sus números, sus planes y sus pagos son los de ./negocios.ts (los mismos que Customers y la ficha).

import type { Entrada, MesIngresos, PorCobrar } from '@/lib/admin-ingresos-reglas'
import { armarIndice, type IndiceBusqueda } from '../busqueda-tipos'
import {
  actividadReciente, filasDeRiesgo, margenBruto, pedidosDeAgencias, pedidosDeBaja, pedidosDeIngreso, porCobrarResumen,
  topClientes, type IngresosResumen, type ResumenAdmin,
} from '../resumen'
import {
  ESENCIAL, HOY_NEGOCIOS, LEAD_SIN_CUENTA, NEGOCIOS, NOMBRES_EJEMPLO, PAGOS_EJEMPLO, PRO, WS_PLATAFORMA_EJEMPLO, pagadoPor,
} from './negocios'

/** «Ahora» de los ejemplos: el 6 de noviembre de 2026 a las 15:00 (hora de Buenos Aires). */
export const AHORA_EJEMPLO = Date.parse('2026-11-06T18:00:00Z')
const HOY = HOY_NEGOCIOS

const { estudioNorte, panaderia, clinica, optica, gimnasio, taller, floristeria, viajes, agencia } = NEGOCIOS

/** Lo cobrado de un mes: la suma de los pagos de ./negocios.ts de ese mes (los en pesos no suman). */
const cobradoDe = (m: string) => PAGOS_EJEMPLO.filter((p) => p.fecha.startsWith(m)).reduce((s, p) => s + (p.usd ?? 0), 0)

const mes = (m: string, mrr: number, mov: Partial<Pick<MesIngresos, 'nuevo' | 'vuelve' | 'sube' | 'baja' | 'corte'>> = {}): MesIngresos => ({
  mes: m, cobrado: cobradoDe(m), mrr, nuevo: 0, vuelve: 0, sube: 0, baja: 0, corte: 0, enCurso: m === HOY.slice(0, 7), ...mov,
})

const E = ESENCIAL.precioUsd
const P = PRO.precioUsd

/**
 * Los meses de `vistaDeIngresos()`: lo cobrado sale de los pagos, y lo que se paga por mes (MRR) de quién estaba pagando ese
 * mes. Panadería La Espiga (Esencial) en junio; Estudio Norte (Esencial) en julio; Clínica Dental Sonríe y Viajes Horizonte
 * (Pro) en agosto; en septiembre Estudio Norte pasa a Pro y entran Óptica Visión Clara, Gimnasio Fuerza Sur y Taller Mecánico
 * Ruta 9 (Esencial); en octubre se pausa el gimnasio; en noviembre entra Floristería Pétalo (Pro).
 */
const meses: MesIngresos[] = [
  mes('2025-12', 0),
  mes('2026-01', 0),
  mes('2026-02', 0),
  mes('2026-03', 0),
  mes('2026-04', 0),
  mes('2026-05', 0),
  mes('2026-06', E, { nuevo: E }),
  mes('2026-07', 2 * E, { nuevo: E }),
  mes('2026-08', 2 * E + 2 * P, { nuevo: 2 * P }),
  mes('2026-09', 4 * E + 3 * P, { nuevo: 3 * E, sube: P - E }),
  mes('2026-10', 3 * E + 3 * P, { corte: E }),
  mes('2026-11', 3 * E + 4 * P, { nuevo: P }),
]

const entradas: Entrada[] = PAGOS_EJEMPLO.filter((p) => p.fecha <= HOY).map((p) => ({
  fecha: p.fecha, usd: p.usd, medio: p.medio, recurrente: p.recurrente, nombre: p.nombre, cliente: p.cliente, id: p.id, concepto: p.concepto,
}))

export const ingresosEjemplo: IngresosResumen = {
  hoy: HOY,
  meses,
  cobradoTotal: meses.reduce((s, m) => s + m.cobrado, 0),
  primerPago: PAGOS_EJEMPLO[0].fecha,
  entradas,
  movimientos: [],
}

/** Lo que pagó cada uno (los clientes de `vistaDeIngresos`), de los mismos pagos. */
const clientes = [...Object.values(NEGOCIOS).map((n) => ({ clave: `ws:${n.ws}`, nombre: n.nombre, ws: n.ws as number | null })), {
  clave: LEAD_SIN_CUENTA.clave, nombre: LEAD_SIN_CUENTA.nombre, ws: null,
}].map((c) => {
  const pagado = pagadoPor(c.clave)
  return { ...c, pagos: pagado.pagos, total: pagado.total }
}).filter((c) => c.pagos > 0)

const nombres: Record<number, string> = NOMBRES_EJEMPLO

const usdTxt = (c: number) => `US$ ${(c / 100).toLocaleString('es-AR')}`

/** Lo que `vistaDeIngresos().porCobrar` diría: lo atrasado y lo que vence en los próximos 31 días, el más cercano primero. */
const porCobrar: PorCobrar[] = [
  { cliente: `ws:${taller.ws}`, fecha: '2026-10-15', usd: E, atrasado: true },
  { cliente: `ws:${panaderia.ws}`, fecha: '2026-11-02', usd: E, atrasado: true },
  { cliente: `ws:${viajes.ws}`, fecha: '2026-11-02', usd: P, atrasado: true },
  { cliente: `ws:${clinica.ws}`, fecha: '2026-12-01', usd: P, atrasado: false },
  { cliente: `ws:${estudioNorte.ws}`, fecha: '2026-12-01', usd: P, atrasado: false },
  { cliente: `ws:${floristeria.ws}`, fecha: '2026-12-02', usd: P, atrasado: false },
  { cliente: `ws:${optica.ws}`, fecha: '2026-12-05', usd: E, atrasado: false },
]

/** El gasto de IA de MaKo por día (UTC), de junio a hoy: entre US$ 0,55 y US$ 0,85 por día (lo de noviembre es lo que reparte
 *  Customers › Cost Drivers: ./clientes.ts). */
function gastoPorDiaDe(desde: string, hasta: string): Array<{ clave: string; costUsd: number }> {
  const out: Array<{ clave: string; costUsd: number }> = []
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t)
    out.push({ clave: d.toISOString().slice(0, 10), costUsd: 0.55 + (d.getUTCDate() % 7) * 0.05 })
  }
  return out
}

export const resumenEjemplo: ResumenAdmin = {
  ingresos: { ok: true, datos: ingresosEjemplo },
  top: { ok: true, datos: topClientes(clientes, ingresosEjemplo.cobradoTotal) },
  riesgo: {
    ok: true,
    datos: filasDeRiesgo([
      { ws: viajes.ws, nombre: viajes.nombre, plan: PRO.nombre, riesgo: true, motivoRiesgo: 'cobro', sinEntrar: 1, mrrUsd: P },
      { ws: taller.ws, nombre: taller.nombre, plan: ESENCIAL.nombre, riesgo: true, motivoRiesgo: 'cobro', sinEntrar: 3, mrrUsd: E },
      { ws: optica.ws, nombre: optica.nombre, plan: ESENCIAL.nombre, riesgo: true, motivoRiesgo: 'sin-uso', sinEntrar: 19, mrrUsd: E },
      { ws: gimnasio.ws, nombre: gimnasio.nombre, plan: ESENCIAL.nombre, riesgo: true, motivoRiesgo: 'pausado', sinEntrar: 12, mrrUsd: 0 },
      { ws: estudioNorte.ws, nombre: estudioNorte.nombre, plan: PRO.nombre, riesgo: false, motivoRiesgo: null, sinEntrar: 0, mrrUsd: P },
    ]),
  },
  actividad: {
    ok: true,
    datos: actividadReciente({
      hoy: HOY,
      ahoraMs: AHORA_EJEMPLO,
      entradas,
      pagos: [...PAGOS_EJEMPLO].reverse().slice(0, 4).map((p) => ({
        id: p.id, fecha: p.fecha, usd: p.usd, nombre: p.nombre, cliente: p.cliente, recurrente: p.recurrente,
      })),
      acciones: [
        { creado: '2026-11-06T17:48:00Z', dia: '2026-11-06', ws: panaderia.ws, titulo: 'Mover un lead de etapa', tipo: 'accion', ok: true },
        { creado: '2026-11-06T16:10:00Z', dia: '2026-11-06', ws: clinica.ws, titulo: 'Ver los leads', tipo: 'lectura', ok: true },
        { creado: '2026-11-06T13:02:00Z', dia: '2026-11-06', ws: agencia.ws, titulo: 'Agendar una reunión', tipo: 'accion', ok: false },
        { creado: '2026-11-05T20:30:00Z', dia: '2026-11-05', ws: estudioNorte.ws, titulo: 'Crear una tarea', tipo: 'accion', ok: true },
      ],
      nombres,
      usdTxt,
    }),
  },
  porCobrar: { ok: true, datos: porCobrarResumen(porCobrar, clientes, HOY) },
  margen: {
    ok: true,
    datos: margenBruto({ hoy: HOY, meses, entradas: ingresosEjemplo.entradas, gastoPorDia: gastoPorDiaDe('2026-06-01', HOY) }),
  },
  esperan: {
    ingreso: {
      ok: true,
      datos: {
        pedidos: pedidosDeIngreso([
          { id: 41, email: 'ana@ejemplo.com', nombre: 'Ana Gómez', origen: 'google', correo_verificado: true, detalle: null, whatsapp: null, intentos: 2 },
          { id: 42, email: 'luis@ejemplo.com', nombre: null, origen: 'planes', correo_verificado: false, detalle: 'Pidió el plan Pro', whatsapp: '5491100000000', intentos: 1 },
        ]),
        hayMas: false,
      },
    },
    agencias: pedidosDeAgencias(
      [{ agencia_ws: agencia.ws, cliente_ws: panaderia.ws }],
      [{ id: 7, agencia_ws: agencia.ws, cliente_ws: clinica.ws, email: 'sofia@ejemplo.com', rol_ws: 'closer' }],
      nombres,
    ),
    bajas: {
      ok: true,
      datos: {
        bajas: pedidosDeBaja([
          { id: 3, alcance: 'persona', email: 'pedro@ejemplo.com', negocio: null, negocio_id: optica.ws, prueba: false, vence_at: '2026-11-20T12:00:00Z', notas: null },
        ], AHORA_EJEMPLO),
      },
    },
    planes: [
      { id: 'esencial', nombre: 'Esencial', descripcion: 'Lo básico para vender con MaKo.', aviso: null },
      { id: 'completo', nombre: 'Completo', descripcion: 'Todo el producto: ads, CRM, analistas, chats, Retro y Plan.', aviso: 'Dado de alta a mano no tiene los topes de su plan.' },
    ],
    planPorDefecto: 'completo',
  },
  avisos: [],
}

/** El índice de la búsqueda ⌘K de los ejemplos. */
export const indiceEjemplo: IndiceBusqueda = armarIndice({
  workspaces: [
    { id: WS_PLATAFORMA_EJEMPLO, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
    ...Object.values(NEGOCIOS).map((n) => ({
      id: n.ws, nombre: n.nombre, capa: n.plan?.capa ?? 'agencia', estado: n.ws === gimnasio.ws ? 'pausado' : 'activo',
    })),
  ],
  usuarios: [
    { id: 1, nombre: 'Equipo MaKo', email: 'equipo@ejemplo.com', workspace_id: WS_PLATAFORMA_EJEMPLO },
    { id: 2, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', workspace_id: estudioNorte.ws },
    { id: 3, nombre: 'Pedro Díaz', email: 'pedro@ejemplo.com', workspace_id: optica.ws },
  ],
  plataforma: WS_PLATAFORMA_EJEMPLO,
  plan: (capa) => (capa === ESENCIAL.capa ? ESENCIAL.nombre : capa === PRO.capa ? PRO.nombre : capa),
})
