// =============================================================================
// Datos de EJEMPLO de Admin › Overview, para capturas y pruebas de la vista (app/admin/_polar/web/DashboardOverview)
// =============================================================================
// FICTICIOS: ningún nombre, correo ni monto es de un cliente real. Se arman con las mismas funciones puras que usa el
// server (app/admin/_polar/datos/resumen.ts), así lo que se ve es lo que la portada dibujaría con esos datos.

import type { Entrada, MesIngresos, PorCobrar } from '@/lib/admin-ingresos-reglas'
import { armarIndice, type IndiceBusqueda } from '../busqueda-tipos'
import { clientesEnRiesgo } from '../clientes'
import {
  actividadReciente, margenBruto, pedidosDeAgencias, pedidosDeBaja, pedidosDeIngreso, porCobrarResumen, riesgoDeOverview,
  topClientes, type IngresosResumen, type ResumenAdmin,
} from '../resumen'

/** «Ahora» de los ejemplos: el 6 de noviembre de 2026 a las 15:00 (hora de Buenos Aires). */
export const AHORA_EJEMPLO = Date.parse('2026-11-06T18:00:00Z')
const HOY = '2026-11-06'
/** El workspace de la plataforma de los ejemplos (arma el link al CRM de quien pagó sin cuenta de MaKo). */
const PLATAFORMA = 9

const mes = (m: string, cobrado: number, mrr: number, mov: Partial<Pick<MesIngresos, 'nuevo' | 'vuelve' | 'sube' | 'baja' | 'corte'>> = {}): MesIngresos => ({
  mes: m, cobrado, mrr, nuevo: 0, vuelve: 0, sube: 0, baja: 0, corte: 0, enCurso: m === HOY.slice(0, 7), ...mov,
})

const meses: MesIngresos[] = [
  mes('2025-12', 0, 0),
  mes('2026-01', 0, 0),
  mes('2026-02', 0, 0),
  mes('2026-03', 0, 0),
  mes('2026-04', 0, 0),
  mes('2026-05', 470, 470, { nuevo: 470 }),
  mes('2026-06', 1_440, 940, { nuevo: 470 }),
  mes('2026-07', 1_910, 1_410, { nuevo: 470 }),
  mes('2026-08', 2_380, 1_880, { nuevo: 470 }),
  mes('2026-09', 3_850, 2_350, { nuevo: 940, corte: 470 }),
  mes('2026-10', 4_320, 2_820, { nuevo: 470 }),
  mes('2026-11', 1_410, 2_820),
]

/** Los pagos de cada mes, que suman lo cobrado: mensualidades de US$ 470 y, si sobra, un pago único por la diferencia. */
function entradasDe(lista: readonly MesIngresos[]): Entrada[] {
  const quienes = ['Estudio Norte', 'Panadería La Espiga', 'Clínica Dental Sonríe', 'Taller Ruedas', 'Viajes Horizonte', 'Gimnasio Fuerza']
  const out: Entrada[] = []
  for (const m of lista) {
    const n = Math.floor(m.cobrado / 470)
    for (let i = 0; i < n; i++) out.push({ fecha: `${m.mes}-0${(i % 6) + 1}`, usd: 470, medio: 'transferencia', recurrente: true, nombre: quienes[i % quienes.length] })
    const resto = m.cobrado - n * 470
    if (resto > 0) out.push({ fecha: `${m.mes}-04`, usd: resto, medio: 'stripe', recurrente: false, nombre: 'Ana Gómez' })
  }
  return out.filter((e) => e.fecha <= HOY)
}

export const ingresosEjemplo: IngresosResumen = {
  hoy: HOY,
  meses,
  cobradoTotal: meses.reduce((s, m) => s + m.cobrado, 0),
  primerPago: '2026-05-04',
  entradas: entradasDe(meses),
  movimientos: [],
}

const clientes = [
  { clave: 'ws:21', nombre: 'Estudio Norte', ws: 21, pagos: 6, total: 2_820 },
  { clave: 'ws:22', nombre: 'Panadería La Espiga', ws: 22, pagos: 5, total: 2_350 },
  { clave: 'ws:23', nombre: 'Clínica Dental Sonríe', ws: 23, pagos: 4, total: 1_880 },
  { clave: 'ws:24', nombre: 'Taller Ruedas', ws: 24, pagos: 4, total: 1_880 },
  { clave: 'lead:310', nombre: 'Ana Gómez', ws: null, leadId: 310, pagos: 2, total: 1_000 },
  { clave: 'ws:25', nombre: 'Viajes Horizonte', ws: 25, pagos: 2, total: 940 },
  { clave: 'ws:26', nombre: 'Gimnasio Fuerza', ws: 26, pagos: 1, total: 940 },
]

const nombres: Record<number, string> = {
  21: 'Estudio Norte', 22: 'Panadería La Espiga', 23: 'Clínica Dental Sonríe', 24: 'Taller Ruedas', 25: 'Viajes Horizonte',
  26: 'Gimnasio Fuerza', 27: 'Agencia Brújula', 28: 'Floristería Pétalo',
}

const usdTxt = (c: number) => `US$ ${(c / 100).toLocaleString('es-AR')}`

/** Lo que `vistaDeIngresos().porCobrar` diría: una mensualidad atrasada y las que vencen en el próximo mes. */
const porCobrar: PorCobrar[] = [
  { cliente: 'ws:25', fecha: '2026-11-02', usd: 470, atrasado: true },
  { cliente: 'ws:22', fecha: '2026-11-09', usd: 470, atrasado: false },
  { cliente: 'ws:23', fecha: '2026-11-12', usd: 470, atrasado: false },
  { cliente: 'ws:24', fecha: '2026-11-18', usd: 470, atrasado: false },
  { cliente: 'lead:310', fecha: '2026-11-25', usd: 500, atrasado: false },
  { cliente: 'ws:21', fecha: '2026-12-03', usd: 470, atrasado: false },
]

/** El gasto de IA de MaKo por día (UTC), de junio a hoy: entre US$ 6 y US$ 11,40 por día. */
function gastoPorDiaDe(desde: string, hasta: string): Array<{ clave: string; costUsd: number }> {
  const out: Array<{ clave: string; costUsd: number }> = []
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t)
    out.push({ clave: d.toISOString().slice(0, 10), costUsd: 6 + (d.getUTCDate() % 7) * 0.9 })
  }
  return out
}

export const resumenEjemplo: ResumenAdmin = {
  ingresos: { ok: true, datos: ingresosEjemplo },
  top: { ok: true, datos: topClientes(clientes, ingresosEjemplo.cobradoTotal, 5, PLATAFORMA) },
  // La misma cuenta que Customers › At Risk: Viajes Horizonte, atrasada en Por cobrar, también sale acá (y primero).
  riesgo: riesgoDeOverview(
    {
      atRisk: clientesEnRiesgo(
        [
          { ws: 25, nombre: 'Viajes Horizonte', capa: 'completo', estado: 'activo', motivoRiesgo: 'cobro', sinEntrar: 3, mrrUsd: 470, planAManoTxt: null, segmentos: ['cliente'] },
          { ws: 26, nombre: 'Gimnasio Fuerza', capa: 'esencial', estado: 'activo', motivoRiesgo: 'sin-uso', sinEntrar: 21, mrrUsd: 0, planAManoTxt: null, segmentos: ['cliente'] },
          { ws: 28, nombre: 'Floristería Pétalo', capa: 'completo', estado: 'pausado', motivoRiesgo: 'pausado', sinEntrar: 40, mrrUsd: 0, planAManoTxt: null, segmentos: ['cliente'] },
          { ws: 21, nombre: 'Estudio Norte', capa: 'completo', estado: 'activo', motivoRiesgo: null, sinEntrar: 0, mrrUsd: 470, planAManoTxt: null, segmentos: ['cliente'] },
        ],
        [{ clave: 'ws:25', ws: 25, leadId: null, nombre: 'Viajes Horizonte', estado: 'atrasado', mrr: 470, diasAtraso: 4 }],
      ),
      error: null,
    },
    PLATAFORMA,
  ),
  actividad: {
    ok: true,
    datos: actividadReciente({
      hoy: HOY,
      ahoraMs: AHORA_EJEMPLO,
      entradas: [{ fecha: '2026-11-06' }, { fecha: '2026-11-04' }],
      pagos: [
        { id: 'p:901', fecha: '2026-11-06', usd: 470, nombre: 'Estudio Norte', cliente: 'ws:21', recurrente: true },
        { id: 'p:900', fecha: '2026-11-04', usd: 470, nombre: 'Taller Ruedas', cliente: 'ws:24', recurrente: true },
      ],
      acciones: [
        { creado: '2026-11-06T17:48:00Z', dia: '2026-11-06', ws: 22, titulo: 'Mover un lead de etapa', tipo: 'accion', ok: true },
        { creado: '2026-11-06T16:10:00Z', dia: '2026-11-06', ws: 23, titulo: 'Ver los leads', tipo: 'lectura', ok: true },
        { creado: '2026-11-06T13:02:00Z', dia: '2026-11-06', ws: 27, titulo: 'Agendar una reunión', tipo: 'accion', ok: false },
        { creado: '2026-11-05T20:30:00Z', dia: '2026-11-05', ws: 21, titulo: 'Crear una tarea', tipo: 'accion', ok: true },
      ],
      nombres,
      usdTxt,
    }),
  },
  porCobrar: { ok: true, datos: porCobrarResumen(porCobrar, clientes, HOY, PLATAFORMA) },
  margen: {
    ok: true,
    datos: margenBruto({ hoy: HOY, meses, entradas: ingresosEjemplo.entradas, gastoPorDia: gastoPorDiaDe('2026-06-01', HOY) }),
  },
  esperan: {
    disputas: { ok: true, datos: { porResponder: 1 } },
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
      [{ agencia_ws: 27, cliente_ws: 22 }],
      [{ id: 7, agencia_ws: 27, cliente_ws: 23, email: 'sofia@ejemplo.com', rol_ws: 'closer' }],
      nombres,
    ),
    bajas: {
      ok: true,
      datos: {
        bajas: pedidosDeBaja([
          { id: 3, alcance: 'persona', email: 'pedro@ejemplo.com', negocio: null, negocio_id: 24, prueba: false, vence_at: '2026-11-20T12:00:00Z', notas: null },
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
    { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
    ...Object.entries(nombres).map(([id, nombre]) => ({ id: Number(id), nombre, capa: 'completo', estado: id === '28' ? 'pausado' : 'activo' })),
  ],
  usuarios: [
    { id: 1, nombre: 'Equipo MaKo', email: 'equipo@ejemplo.com', workspace_id: 9 },
    { id: 2, nombre: 'Ana Gómez', email: 'ana@ejemplo.com', workspace_id: 21 },
    { id: 3, nombre: 'Pedro Díaz', email: 'pedro@ejemplo.com', workspace_id: 24 },
  ],
  plataforma: PLATAFORMA,
  plan: (capa) => (capa === 'completo' ? 'Completo' : capa),
})
