// =============================================================================
// La lectura de Overview (la portada de Admin): lo que en Polar piden sus widgets con un hook, acá lo lee el server
// =============================================================================
// Las conversiones a las props de la vista son puras y viven en ./resumen.ts (con test). ⚠️ CRUZA NEGOCIOS: sólo el super
// admin, y lo pregunta la página (`exigirSuperAdmin()`) antes de llamar a esto.
//
// ⚠️ CADA LECTURA FALLA SOLA: si una se cae, su widget dice «No pude leer…» y los demás se dibujan igual. Lo que se leyó a
//    medias (las `avisos` de cada lector) va en `avisos` y la vista lo dice arriba.
// ⚠️ `vistaDeClientes` vuelve a leer `vistaDeIngresos` adentro (el MRR de cada negocio sale de ahí): son dos lecturas de los
//    pagos por carga de la portada. Se anotó; arreglarlo es tocar lib/clientes-plataforma.ts.

import 'server-only'
import { vistaDeIngresos } from '@/lib/admin-ingresos'
import { vistaDeClientes } from '@/lib/clientes-plataforma'
import { vistaDeActividad } from '@/lib/actividad'
import { pedidosPendientes } from '@/lib/pedidos-ingreso'
import { altasPendientes, pendientesDeAprobar } from '@/lib/agencia'
import { bajasPendientes } from '@/lib/baja-cuenta'
import { listarWorkspaces, wsSuperAdmin } from '@/lib/workspace'
import { zonaDelNegocio } from '@/lib/timezone'
import { hoyEnTz } from '@/lib/date-utils'
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas'
import { opcionesDeAlta } from './clientes-server'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import {
  actividadReciente, filasDeRiesgo, pedidosDeAgencias, pedidosDeBaja, pedidosDeIngreso, topClientes,
  type Lectura, type ResumenAdmin,
} from './resumen'

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const leer = <T,>(p: Promise<T>): Promise<Lectura<T>> =>
  p.then((datos): Lectura<T> => ({ ok: true, datos }), (e): Lectura<T> => ({ ok: false, error: msg(e) }))

export async function leerResumenDeAdmin(ahora: Date = new Date()): Promise<ResumenAdmin> {
  const ahoraMs = ahora.getTime()
  const [ingresos, clientes, actividad, ingreso, carteras, altas, bajas, wss, tz] = await Promise.all([
    leer(vistaDeIngresos(ahora)),
    leer(vistaDeClientes(ahoraMs)),
    leer(vistaDeActividad(ahora)),
    leer(pedidosPendientes()),
    pendientesDeAprobar(),
    altasPendientes(),
    leer(bajasPendientes()),
    listarWorkspaces().catch(() => []),
    wsSuperAdmin().then(zonaDelNegocio).catch(() => 'UTC'),
  ])

  const avisos: string[] = []
  const conAvisos = (de: string, l: Lectura<{ avisos: string[] }>) => {
    if (l.ok) for (const a of l.datos.avisos) avisos.push(`${de}: ${a}`)
  }
  conAvisos('Ingresos', ingresos)
  conAvisos('Clientes', clientes)
  conAvisos('Actividad', actividad)
  if (actividad.ok && !actividad.datos.medido) avisos.push('Actividad: lo que hace MaKo todavía no se mide (falta la migración 0398); se ven sólo los pagos.')

  const nombres: Record<number, string> = {}
  for (const w of wss) nombres[w.id] = w.nombre
  const usdTxt = formatCurrency('statistics')
  const usd = (c: number) => usdTxt(c, 'usd')

  return {
    ingresos: ingresos.ok
      ? {
          ok: true,
          datos: {
            hoy: ingresos.datos.hoy,
            meses: ingresos.datos.meses,
            cobradoTotal: ingresos.datos.cobradoTotal,
            primerPago: ingresos.datos.clientes.reduce<string | null>((m, c) => (c.primerPago && (!m || c.primerPago < m) ? c.primerPago : m), null),
            entradas: ingresos.datos.entradas,
            movimientos: ingresos.datos.movimientos,
          },
        }
      : ingresos,
    top: ingresos.ok ? { ok: true, datos: topClientes(ingresos.datos.clientes, ingresos.datos.cobradoTotal) } : ingresos,
    riesgo: clientes.ok
      ? { ok: true, datos: filasDeRiesgo(clientes.datos.filas.map((f) => ({ ...f, plan: nombreDePlan(f.capa) }))) }
      : clientes,
    // Sin los pagos no se arma: un Activity que muestra sólo lo de MaKo diría que hoy no entró nada.
    actividad: !ingresos.ok
      ? ingresos
      : !actividad.ok
        ? actividad
        : {
            ok: true,
            datos: actividadReciente({
              hoy: ingresos.datos.hoy,
              ahoraMs,
              entradas: ingresos.datos.entradas,
              pagos: ingresos.datos.pagos,
              acciones: actividad.datos.acciones.map((a) => ({ ...a, dia: hoyEnTz(tz, new Date(a.creado)) })),
              nombres: { ...nombres, ...actividad.datos.nombres },
              usdTxt: usd,
            }),
          },
    esperan: {
      ingreso: ingreso.ok ? { ok: true, datos: { pedidos: pedidosDeIngreso(ingreso.datos.pedidos), hayMas: ingreso.datos.hayMas } } : ingreso,
      agencias: pedidosDeAgencias(carteras, altas, nombres),
      bajas: bajas.ok ? { ok: true, datos: { bajas: pedidosDeBaja(bajas.datos, ahoraMs) } } : bajas,
      ...opcionesDeAlta(),
    },
    avisos,
  }
}
