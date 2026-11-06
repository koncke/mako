// =============================================================================
// Hijo de tests/admin-polar-costos-meses.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre las funciones REALES de lib/costos-ia.ts (`resumenDelPeriodo`, `mesesConDatos`, con `server-only`) contra un PostgREST
// de mentira, en un node aparte con `--conditions=react-server`. Cuenta los pedidos y las filas que cada una le pide a
// `anthropic_usage`: lo que fija el test es que los meses con datos NO salen de leer la tabla entera (punto 33 de la revisión
// del 6/11/2026). Nada sale a la red: lo que no es la base se anota en `red` y tiene que dar vacío.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira'

const pg = crearPostgrest({ tablas: ['anthropic_usage'] })

let pedidos = 0
let filas = 0
let caida = false
const red: string[] = []
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url)
  if (u.host === 'supa.test') {
    if (u.pathname.endsWith('/anthropic_usage')) {
      pedidos += 1
      if (caida) return new Response(JSON.stringify({ code: '57014', message: 'la base no contestó' }), { status: 500 })
      const r = await pg.responder(u, init)
      const cuerpo = await r.clone().json().catch(() => null)
      if (Array.isArray(cuerpo)) filas += cuerpo.length
      return r
    }
    return pg.responder(u, init)
  }
  red.push(u.host + u.pathname)
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 })
}) as typeof fetch

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'

/** Lo que pidió una llamada: cuántos pedidos y cuántas filas volvieron. */
async function medir<T>(fn: () => Promise<T>): Promise<{ valor: T; pedidos: number; filas: number }> {
  pedidos = 0
  filas = 0
  const valor = await fn()
  return { valor, pedidos, filas }
}

async function main() {
  const { resumenDelPeriodo, mesesConDatos } = await import('../lib/costos-ia')
  // 300 filas: agosto, septiembre y noviembre (octubre sin nada). Ninguna página pasa de 1000.
  let id = 0
  const fila = (created_at: string) => ({
    id: ++id, created_at, feature: 'closing', motivo: null, model: 'claude-haiku-4-5', provider: 'anthropic', cost_usd: 0.01,
    input_tokens: 10, output_tokens: 5, workspace_id: 9,
  })
  for (let i = 0; i < 120; i++) pg.db.anthropic_usage.push(fila(`2026-08-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z`))
  for (let i = 0; i < 100; i++) pg.db.anthropic_usage.push(fila(`2026-09-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z`))
  for (let i = 0; i < 80; i++) pg.db.anthropic_usage.push(fila(`2026-11-0${1 + (i % 5)}T10:00:00.000Z`))

  const ahora = new Date('2026-11-06T15:00:00.000Z')
  const resumen = await medir(() => resumenDelPeriodo('2026-11'))
  const conMeses = await medir(() => resumenDelPeriodo('2026-11', { conMeses: true }))
  const meses = await medir(() => mesesConDatos({ ahora }))
  caida = true
  const caidos = await medir(() => mesesConDatos({ ahora }))
  let estricto: string | null = null
  try { await mesesConDatos({ ahora, estricto: true }) } catch (e) { estricto = e instanceof Error ? e.message : String(e) }
  caida = false

  process.stdout.write(JSON.stringify({
    total: pg.db.anthropic_usage.length,
    resumen: { pedidos: resumen.pedidos, filas: resumen.filas, filasLeidas: resumen.valor.filas, meses: resumen.valor.mesesDisponibles },
    conMeses: { pedidos: conMeses.pedidos, filas: conMeses.filas, meses: conMeses.valor.mesesDisponibles },
    meses: { pedidos: meses.pedidos, filas: meses.filas, valor: meses.valor },
    caidos: caidos.valor,
    estricto,
    red,
  }))
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e))
  process.exit(1)
})
