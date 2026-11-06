// =============================================================================
// Admin › Settings: lo que arreglaron los puntos 15, 16, 25, 39, 41 y 42 de la revisión del Cerebro (docs/admin/revision-cerebro-6-11.md)
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-ajustes.test.ts
//
//   · 15: General y Customer Notifications mandan SÓLO lo que tocaron, y el server lo mezcla sobre lo guardado;
//   · 16: lo escrito se guarda al salir (no se descarta), sin mandar dos veces lo mismo ni un valor viejo encima; los precios de
//         Payments dicen «Guardado»;
//   · 25: Settings › Members (las personas de la plataforma), segundo en Settings como en Polar;
//   · 39, 41, 42: los nombres en inglés, los textos sin explicaciones internas y los errores con el `Alert` de Orbit.
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026). Base: 10 pass / 0 fail. Cada rotura, sola y restaurada de memoria (la base otra vez 10/0):
//   · `cambiosDelEmisor` devuelve el campo aunque no cambió (sin el `if (v !== …)`)                     → 6/3 (15 y los dos de la fila)
//   · `cambiosDelPedido` deja pasar una clave que no es del emisor                                      → 9/1 (15)
//   · `guardadoDiferido`: `salir()` cancela el timer sin mandar (el `clearTimeout` de antes)            → 7/3 (16)
//   · `guardadoDiferido`: lo pendiente se calcula al encolar y no cuando le toca                        → 9/1 (16, volver a lo de antes)
//   · `marcaDeGuardado` sin apagarse a los 2 segundos                                                   → 9/1 (16)
//   · Members fuera de SETTINGS_SECTIONS                                                               → 9/1 (25)
//   · Members fuera del grupo Organization (primera del de Payments)                                   → 9/1 (25)
//   · el grupo «Purchases» vuelve a «Compras»                                                           → 9/1 (39)
//   · un `<Text color="error">` suelto en Payments                                                      → 9/1 (42)
//   · y un cambio sin efecto (renombrar la local `fila` de `guardadoDiferido`)                          → 10/0
// ⚠️ Los tests de la fila esperan promesas que suelta el test: llevan `timeout`, o una rotura los cuelga en vez de ponerlos rojos.

import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import * as modulo from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  cambiosDelEmisor,
  cambiosDelPedido,
  emisorConCambios,
  guardadoDiferido,
  marcaDeGuardado,
  type CambiosEmisor,
  type Emisor,
} from '../app/admin/_polar/datos/ajustes'
import { getSettingsSection, SETTINGS_SECTIONS } from '../app/admin/_polar/web/Settings/settingsSections'
import { settingsGroupsList } from '../app/admin/_polar/web/Dashboard/navigationSettings'

// Las pantallas de Settings importan sus server actions ('use server' → lib/auth, con `server-only`): con la condición de
// react-server, `server-only` es un módulo vacío y se pueden dibujar (el molde de tests/general-meta-muestra.test.ts).
type Ctx = { conditions?: string[] }
type Resolver = (spec: string, ctx: Ctx, next: (spec: string, ctx: Ctx) => unknown) => unknown
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve: Resolver }) => void }
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'server-only') return next(spec, { ...ctx, conditions: [...(ctx.conditions ?? []), 'react-server'] })
    return next(spec, ctx)
  },
})

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const BASE: Emisor = { nombre: 'Estudio Norte', documento: 'CUIT 30-00000000-0', direccion: 'Calle 1', correo: 'hola@ejemplo.com', asunto: null, intro: null }

const flush = () => new Promise<void>((r) => setImmediate(r))

test('15 · cada pantalla manda sólo lo que tocó, y el server lo mezcla sobre lo guardado (no pisa lo de la otra)', () => {
  // General abierto con el emisor de antes (sin asunto); Notifications ya guardó el asunto.
  const enElServer: Emisor = { ...BASE, asunto: 'Tu recibo {{numero}}' }
  const valoresDeGeneral = { nombre: BASE.nombre, documento: BASE.documento ?? '', direccion: 'Calle 2', correo: BASE.correo ?? '' }
  const cambios = cambiosDelEmisor(BASE, valoresDeGeneral)
  assert.deepEqual(cambios, { direccion: 'Calle 2' }, 'sólo viaja la dirección, no la copia vieja del asunto')
  const guardado = emisorConCambios(enElServer, cambiosDelPedido(cambios))
  assert.equal(guardado.asunto, 'Tu recibo {{numero}}', 'el asunto que escribió Notifications sigue ahí')
  assert.equal(guardado.direccion, 'Calle 2')
  // Los espacios de más no son un cambio (el server los guarda colapsados), y un nombre vacío tampoco.
  assert.deepEqual(cambiosDelEmisor(BASE, { direccion: '  Calle   1 ' }), {})
  assert.deepEqual(cambiosDelEmisor(BASE, { nombre: '   ' }), {})
  assert.deepEqual(cambiosDelEmisor(BASE, { documento: '' }), { documento: null }, 'vaciar un campo sí es un cambio')
  // El server recorta el pedido a las claves del emisor, cada una texto o null.
  assert.deepEqual(cambiosDelPedido({ asunto: 'Hola', intro: null, nombre: 7, otra: 'x', __proto__: { correo: 'a@b.c' } }), { asunto: 'Hola', intro: null })
  assert.deepEqual(cambiosDelPedido(null), {})
})

test('16 · al salir antes del segundo, lo escrito se GUARDA (no se descarta), y una sola vez', { timeout: 5000 }, async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let escrito: CambiosEmisor = {}
    const enviados: CambiosEmisor[] = []
    const g = guardadoDiferido<CambiosEmisor>({
      demoraMs: 1000,
      pendiente: () => (Object.keys(escrito).length ? escrito : null),
      enviar: async (c) => { enviados.push(c); escrito = {} },
    })
    escrito = { asunto: 'Tu recibo' }
    g.cambio()
    mock.timers.tick(400)
    await flush()
    assert.equal(enviados.length, 0, 'todavía no pasó el segundo')
    await g.salir()
    assert.deepEqual(enviados, [{ asunto: 'Tu recibo' }], 'salir guardó lo pendiente')
    mock.timers.tick(2000)
    await flush()
    await g.salir()
    assert.equal(enviados.length, 1, 'el timer cancelado y un segundo «salir» no lo mandan otra vez')
  } finally {
    mock.timers.reset()
  }
})

test('16 · los guardados van en fila y cada uno manda lo escrito AL SALIR: nunca un valor viejo encima de uno nuevo', { timeout: 5000 }, async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let guardado: Emisor = { ...BASE }
    let escrito = { asunto: '' }
    const enviados: string[] = []
    let soltar: (() => void) | null = null
    const g = guardadoDiferido<CambiosEmisor>({
      demoraMs: 1000,
      pendiente: () => {
        const c = cambiosDelEmisor(guardado, escrito)
        return Object.keys(c).length ? c : null
      },
      enviar: (c) => {
        enviados.push(String(c.asunto))
        return new Promise<void>((r) => {
          soltar = () => { guardado = emisorConCambios(guardado, c); r() }
        })
      },
    })
    escrito = { asunto: 'A' }
    g.cambio()
    mock.timers.tick(1000)
    await flush()
    assert.deepEqual(enviados, ['A'], 'el primero salió y está en vuelo')
    // Mientras vuela, se vuelve a escribir y se sale: el segundo espera al primero y manda lo de AHORA.
    escrito = { asunto: 'B' }
    g.cambio()
    const fin = g.salir()
    await flush()
    assert.deepEqual(enviados, ['A'], 'no sale mientras el anterior no volvió')
    soltar!()
    await flush()
    await flush()
    soltar!()
    await fin
    assert.deepEqual(enviados, ['A', 'B'])
    assert.equal(guardado.asunto, 'B', 'lo último que quedó es lo último que se escribió')
    // Escribir y volver al valor guardado: no se manda nada.
    escrito = { asunto: 'B' }
    g.cambio()
    await g.salir()
    assert.deepEqual(enviados, ['A', 'B'])
  } finally {
    mock.timers.reset()
  }
})

test('16 · volver a lo de antes mientras vuela el primer guardado también se guarda (lo pendiente se calcula al salir)', { timeout: 5000 }, async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let guardado: Emisor = { ...BASE }
    let escrito = { asunto: '' }
    const enviados: Array<string | null | undefined> = []
    const soltar: Array<() => void> = []
    const g = guardadoDiferido<CambiosEmisor>({
      demoraMs: 1000,
      pendiente: () => {
        const c = cambiosDelEmisor(guardado, escrito)
        return Object.keys(c).length ? c : null
      },
      enviar: (c) => {
        enviados.push(c.asunto)
        return new Promise<void>((r) => soltar.push(() => { guardado = emisorConCambios(guardado, c); r() }))
      },
    })
    escrito = { asunto: 'A' }
    g.cambio()
    mock.timers.tick(1000)
    await flush()
    // Se borra lo escrito (vuelve a lo guardado ANTES del primer envío) y se sale: el server quedó con «A».
    escrito = { asunto: '' }
    g.cambio()
    const fin = g.salir()
    soltar[0]()
    await flush()
    await flush()
    soltar[1]?.()
    await fin
    assert.deepEqual(enviados, ['A', null], 'el segundo deshace el «A» que quedó guardado')
    assert.equal(guardado.asunto, null)
  } finally {
    mock.timers.reset()
  }
})

test('16 · «Guardado» se ve dos segundos en la fila del precio, y guardar de nuevo reinicia la cuenta', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const vistos: boolean[] = []
    const m = marcaDeGuardado((v) => vistos.push(v))
    m.marcar()
    assert.deepEqual(vistos, [true])
    mock.timers.tick(1500)
    m.marcar()
    mock.timers.tick(1500)
    assert.deepEqual(vistos, [true, true], 'el segundo guardado reinició los 2 segundos')
    mock.timers.tick(500)
    assert.deepEqual(vistos, [true, true, false])
    m.marcar()
    m.limpiar()
    mock.timers.tick(5000)
    assert.deepEqual(vistos, [true, true, false, true], 'si la fila se va, no se apaga después')
  } finally {
    mock.timers.reset()
  }
})

test('25 · Settings › Members existe y va SEGUNDA en la barra, después de General (como en Polar)', () => {
  assert.equal(getSettingsSection('members')?.title, 'Members')
  assert.equal(Object.keys(SETTINGS_SECTIONS)[0], 'members')
  const [organizacion] = settingsGroupsList()
  assert.equal(organizacion.title, 'Organization')
  assert.deepEqual(organizacion.routes.map((r) => r.title), ['General', 'Members'], 'en el grupo de la organización, segunda')
  const members = settingsGroupsList().flatMap((g) => g.routes).find((r) => r.title === 'Members')
  assert.equal(members?.link, '/admin/settings/members')
})

test('39 · Customer Notifications: el grupo se llama «Purchases», como en Polar', async () => {
  const { default: OrganizationCustomerEmailSettings } = await import('../app/admin/_polar/web/Settings/OrganizationCustomerEmailSettings')
  const html = renderToStaticMarkup(createElement(OrganizationCustomerEmailSettings, { emisor: BASE, waSolo: true }))
  assert.ok(html.includes('Purchases'), 'el grupo')
  assert.ok(!html.includes('Compras'), 'sin el nombre en español')
})

test('39 · General: el grupo se llama «Profile»', async () => {
  const { default: OrganizationProfileSettings } = await import('../app/admin/_polar/web/Settings/OrganizationProfileSettings')
  const html = renderToStaticMarkup(createElement(OrganizationProfileSettings, { emisor: BASE }))
  assert.ok(html.includes('Profile'))
  assert.ok(!html.includes('>Perfil<'))
})

test('41 · Payments: el monto de Mercado Pago dice la consecuencia, sin el criterio interno', async () => {
  const { default: OrganizationPaymentSettings } = await import('../app/admin/_polar/web/Settings/OrganizationPaymentSettings')
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { SearchParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime')
  const nada = () => {}
  const router = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada }
  const html = renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router as never },
      createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never },
        createElement(OrganizationPaymentSettings, {
          datos: {
            locales: { moneda: 'ARS', planes: [{ id: 'pro', nombre: 'MaKo Pro', precioUsd: 97, local: 120000, activo: true }] },
            errorLocales: null,
            precioAgencia: { usd: 47, mp: { moneda: 'ARS', monto: 50000 } },
            errorAgencia: null,
            conMercadoPago: true,
          },
        }))))
  assert.ok(html.includes('Sin este monto no sale el link del primer mes.'))
  assert.ok(!html.includes('no se inventa una tasa'))
  assert.ok(!html.includes('Guardado'), '«Guardado» sólo después de guardar')
})

test('42 · en Settings, un error es el `Alert` de Orbit: ningún texto rojo suelto ni un aviso armado a mano', () => {
  const dir = 'app/admin/_polar/web/Settings'
  const archivos = readdirSync(join(RAIZ, dir)).filter((f) => f.endsWith('.tsx'))
  assert.ok(archivos.length >= 4, `se encontraron ${archivos.length}: el barrido no está mirando`)
  for (const f of archivos) {
    const src = sinComentarios(leer(`${dir}/${f}`))
    assert.doesNotMatch(src, /<Text color="error"|role="alert"|function Fallo/, `${f}: un error fuera del Alert`)
  }
})
