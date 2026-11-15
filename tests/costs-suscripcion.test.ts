// =============================================================================
// Admin › Analytics › Costs: lo que se va de una suscripción, el primer mes, el techo del CAC y los cupos (10/11/2026)
// =============================================================================
// Martín, 10/11: «la torta de un cliente de 97: cuánto le queda y a dónde va cada dólar», dentro de SuperAdmin. La arma UNA
// función (`loQueSeVaDeUnaSuscripcion`, lib/economia-unitaria.ts) y la usan Costs y la torta de /admin/estrategia. Fija:
//   1. los números del 47 y el 97 con el escenario del modelo, sumando el precio al centavo;
//   2. que /admin/estrategia sale de la MISMA función (no de una cuenta propia);
//   3. cada selector mueve lo que tiene que mover, y nada más;
//   4. sin clientes, el fijo no se reparte y se avisa;
//   5. el reparto de Polar no dibuja una parte negativa en la barra y el total es el precio;
//   6. la página dibuja las tres secciones y los DÓLARES como dólares (el formateador de Polar recibe centavos).
//
// Probado rompiéndolo (base 6 pases / 0 fallos):
//   · `primerMesUsd` sin la parte del fijo (precio − cobro − impuesto − video − CAC)            → 3/3 (1, 3 y 6)
//   · la torta del 97 de estrategia con su propia cuenta (servir = sólo el video)              → 5/1 (2)
//   · `escenarioDe` ignora la pasarela elegida                                                  → 5/1 (3)
//   · con 0 clientes, el fijo se reparte entre 1 (sin aviso)                                     → 5/1 (4)
//   · DistributionChart dibuja también las partes negativas                                     → 5/1 (5)
//   · CostsPage vuelve a pasarle dólares a `fmt` (Fixed costs: «US$ 4,38 al mes sale de…»)      → 5/1 (6)
// Los datos de la página son ficticios (AGENTS.md: nada de clientes reales en tests/).
// =============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import {
  CAC_USD,
  ESCENARIO_DEL_MODELO,
  IMPUESTO,
  META_CLIENTES,
  MESES_DE_VIDA,
  NOMBRE_DE_PARTE,
  PASARELA,
  USO_SUPUESTO,
  loQueSeVaDeUnaSuscripcion,
  techoDeIa,
  type PlanPago,
} from '../lib/economia-unitaria'
import { USO_SUPUESTO as USO_DESDE_EL_CUPO, techoDeIa as techoDesdeElCupo } from '../lib/uso-del-cupo'
import { CUPO_MENSUAL, usdDeMt } from '../lib/mako-tokens-reglas'
import { fijoDeMartin, fijoSiPagaTodo } from '../lib/costos-fijos'
import { TORTAS } from '../app/admin/estrategia/datos'
import { armarCostos } from '../app/admin/_polar/datos/costos'
import type { ResumenPeriodo } from '../lib/costos-ia'
import { economiaDelMes } from '../lib/economia-unitaria'

const centavos = (n: number) => Math.round(n * 100)
const montos = (plan: PlanPago, cambios = {}) => loQueSeVaDeUnaSuscripcion(plan, cambios).partes.map((p) => p.usd)

// ⚠️ LAS CIFRAS QUE DEPENDEN DEL CUPO SE DERIVAN; LAS QUE SON DECISIONES SE ESCRIBEN (15/11/2026)
// =============================================================================
// Estos tests estaban transcriptos de una corrida («61,53 · 14,83 · 24.250 MT») y se pusieron rojos ocho veces de una
// cuando el cupo cambió de 24.250 a 24.000 — por una decisión de Martín, no por un error. **Un test que repite el número
// que vigila no vigila nada: se rompe cuando el dueño decide, y calla cuando el cálculo se rompe de verdad**, porque los
// dos lados dicen lo mismo por casualidad y no por construcción. Es la tercera vez en el día que aparece esta misma clase
// de error en este repo (ver tests/mako-tokens-paquetes.test.ts, el divisor clavado).
//
// La línea que los separa: **«servir la cuenta» y el techo de IA salen del cupo, así que se derivan. La captación
// (US$97 ÷ 9 meses), el impuesto y la pasarela son DECISIONES de Martín y se escriben a mano** — si una de ésas cambia
// sola, es un error y el test tiene que gritar. Y la «ganancia» se deriva porque es, por definición, lo que queda.
// =============================================================================
const USD_DEL_PLAN_PAGO: Record<PlanPago, number> = { pro: 47, growth: 97 }
const r2 = (n: number) => Math.round(n * 100) / 100
/** El fijo repartido entre los clientes del escenario. No depende del cupo. */
const FIJO_POR_CLIENTE = ESCENARIO_DEL_MODELO.fijoMensualUsd / ESCENARIO_DEL_MODELO.clientes
/** «Servir la cuenta» = el video que se supone que gasta (una fracción del TECHO) + su parte del fijo. */
const servirDe = (plan: PlanPago) => r2(techoDeIa(plan) * USO_SUPUESTO + FIJO_POR_CLIENTE)
/** Lo que queda después de las cuatro partes que no son ganancia. */
const gananciaDe = (plan: PlanPago, resto: readonly number[]) =>
  r2(USD_DEL_PLAN_PAGO[plan] - resto.reduce((a, b) => a + b, 0))
/** Como lo escribe Intl en es-AR, para armar los regex sin repetir la cifra. */
const pesos = (n: number) => n.toFixed(2).replace('.', ',')
/** El HTML sin etiquetas y con los espacios normalizados (Intl pone un espacio duro entre «US$» y el número). */
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[  ]/g, ' ').replace(/\s+/g, ' ')

test('1. el 97 y el 47 con el escenario del modelo: las cinco partes, el primer mes y desde el segundo', () => {
  // 97: captación 10,78 (97 ÷ 9 meses, decisión de Martín del 10/11) · impuesto 8,11 · cobro 1,75 — esas tres van
  // escritas porque son decisiones. «Servir» sale del cupo y la ganancia es el resto, así que se derivan.
  // Con 22,2 meses de vida la captación eran 4,37 (el número del encargo) y la ganancia 67,94.
  const RESTO_97 = [10.78, servirDe('growth'), 8.11, 1.75]
  const RESTO_47 = [10.78, servirDe('pro'), 3.93, 0.85]
  assert.deepEqual(montos('growth'), [gananciaDe('growth', RESTO_97), ...RESTO_97])
  assert.deepEqual(montos('pro'), [gananciaDe('pro', RESTO_47), ...RESTO_47])
  const g = loQueSeVaDeUnaSuscripcion('growth')
  assert.deepEqual(g.partes.map((p) => p.clave), ['ganancia', 'conseguir', 'servir', 'impuesto', 'cobro'])
  // El primer mes paga el CAC entero; desde el segundo deja la ganancia más la captación.
  assert.equal(g.desdeElSegundoMesUsd, r2(gananciaDe('growth', RESTO_97) + 10.78))
  assert.equal(g.primerMesUsd, r2(g.desdeElSegundoMesUsd - ESCENARIO_DEL_MODELO.cacUsd))
  assert.equal(g.desdeElSegundoMesUsd, Math.round((g.partes[0].usd + g.partes[1].usd) * 100) / 100)
  const p = loQueSeVaDeUnaSuscripcion('pro')
  assert.equal(p.desdeElSegundoMesUsd, r2(gananciaDe('pro', RESTO_47) + 10.78))
  assert.equal(p.primerMesUsd, r2(p.desdeElSegundoMesUsd - ESCENARIO_DEL_MODELO.cacUsd))
  // Los cupos: el techo de IA del plan y lo que se supone que se usa. Leídos del cupo, no transcriptos.
  assert.deepEqual([g.cupoMt, g.techoIaUsd, g.videoUsd],
    [CUPO_MENSUAL.growth, usdDeMt(CUPO_MENSUAL.growth), usdDeMt(CUPO_MENSUAL.growth) * USO_SUPUESTO])
  assert.deepEqual([p.cupoMt, p.techoIaUsd], [CUPO_MENSUAL.pro, usdDeMt(CUPO_MENSUAL.pro)])
  // Lo que mudó de lib/uso-del-cupo.ts se sigue leyendo de ahí igual.
  assert.equal(USO_DESDE_EL_CUPO, USO_SUPUESTO)
  assert.equal(techoDesdeElCupo('growth'), techoDeIa('growth'))
  // El escenario del modelo es el del 7/11.
  assert.deepEqual(ESCENARIO_DEL_MODELO, {
    clientes: META_CLIENTES, cacUsd: CAC_USD, usoDelCupo: USO_SUPUESTO, pasarela: PASARELA, impuesto: IMPUESTO,
    fijoMensualUsd: fijoDeMartin(),
  })
})

test('2. la torta de /admin/estrategia es la misma función, con los mismos nombres', () => {
  for (const [clave, plan] of [['pro', 'pro'], ['growth', 'growth']] as const) {
    const torta = TORTAS.find((t) => t.clave === clave)!
    const s = loQueSeVaDeUnaSuscripcion(plan)
    assert.equal(torta.total, s.precioUsd, `${clave}: el total es el precio del plan`)
    assert.deepEqual(torta.porciones.map((p) => [p.clave, p.label, p.usd]),
      s.partes.map((p) => [p.clave, NOMBRE_DE_PARTE[p.clave], p.usd]), `${clave}: las porciones`)
  }
})

test('3. cada selector mueve lo suyo, y las partes suman el precio al centavo en cualquier escenario', async () => {
  const { escenarioDe } = await import('../app/admin/(polar)/analytics/costs/Suscripcion')
  const base = { clientes: 50, cacUsd: 97, uso: 0.25, pasarela: 'mp-35', conImpuesto: true, fijo: 'tuyo' as const }
  assert.deepEqual(escenarioDe(base), ESCENARIO_DEL_MODELO, 'lo que viene elegido es el modelo')
  assert.equal(escenarioDe({ ...base, pasarela: 'mp-ya' }).pasarela, 0.0761)
  assert.equal(escenarioDe({ ...base, pasarela: 'directo' }).pasarela, 0)
  assert.equal(escenarioDe({ ...base, conImpuesto: false }).impuesto, 0)
  assert.equal(escenarioDe({ ...base, fijo: 'todo' }).fijoMensualUsd, fijoSiPagaTodo())

  const parte = (plan: PlanPago, clave: string, cambios = {}) =>
    loQueSeVaDeUnaSuscripcion(plan, cambios).partes.find((p) => p.clave === clave)!.usd
  // Orgánico: no hay captación, y el primer mes ya deja lo mismo que los demás.
  const organico = loQueSeVaDeUnaSuscripcion('growth', { cacUsd: 0 })
  assert.equal(parte('growth', 'conseguir', { cacUsd: 0 }), 0)
  assert.equal(organico.primerMesUsd, organico.desdeElSegundoMesUsd)
  // Sin video usado, servir es sólo el fijo; transferencia: cobro 0; sin impuesto: 0.
  assert.equal(parte('growth', 'servir', { usoDelCupo: 0 }), Math.round((fijoDeMartin() / META_CLIENTES) * 100) / 100)
  assert.equal(parte('growth', 'cobro', { pasarela: 0 }), 0)
  assert.equal(parte('growth', 'impuesto', { impuesto: 0 }), 0)
  // Más clientes, menos fijo por cabeza.
  assert.ok(parte('growth', 'servir', { clientes: 100 }) < parte('growth', 'servir', { clientes: 10 }))
  assert.equal(parte('growth', 'conseguir', { cacUsd: 50 }), Math.round((50 / MESES_DE_VIDA) * 100) / 100)

  for (const plan of ['pro', 'growth'] as const)
    for (const clientes of [10, 20, 50, 200])
      for (const cacUsd of [0, 50, 97])
        for (const usoDelCupo of [0, 0.25, 1])
          for (const pasarela of [0, 0.018, 0.0761])
            for (const fijoMensualUsd of [fijoDeMartin(), fijoSiPagaTodo()]) {
              const s = loQueSeVaDeUnaSuscripcion(plan, { clientes, cacUsd, usoDelCupo, pasarela, fijoMensualUsd })
              const suma = s.partes.reduce((a, p) => a + centavos(p.usd), 0)
              assert.equal(suma, centavos(s.precioUsd), `${plan} ${JSON.stringify({ clientes, cacUsd, usoDelCupo, pasarela })}`)
              assert.equal(centavos(s.primerMesUsd), centavos(s.desdeElSegundoMesUsd) - centavos(s.cacUsd))
            }
})

test('4. sin clientes el fijo no se reparte entre nadie: null y un aviso, no un número', () => {
  const s = loQueSeVaDeUnaSuscripcion('growth', { clientes: 0 })
  assert.equal(s.fijoPorClienteUsd, null)
  assert.equal(s.avisos.length, 1)
  assert.equal(s.partes.find((p) => p.clave === 'servir')!.usd, Math.round(s.videoUsd * 100) / 100)
  assert.equal(loQueSeVaDeUnaSuscripcion('growth').avisos.length, 0)
})

const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} }
async function dibujar(el: ReturnType<typeof createElement>) {
  const { TooltipProvider } = await import('../app/admin/_polar/orbit/components/Tooltip')
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router as never },
      createElement(PathnameContext.Provider, { value: '/admin/analytics/costs' },
        createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never },
          createElement(TooltipProvider, null, el)))))
}

test('5. el reparto de Polar: una parte negativa no se dibuja en la barra, la leyenda la muestra y el total es el precio', async () => {
  const { default: DistributionChart } = await import('../app/admin/_polar/web/Metrics/DistributionChart')
  const items = [
    { key: 'ganancia', label: 'Ganancia', value: -10, color: '#8ED6B9' },
    { key: 'servir', label: 'Servir la cuenta', value: 40, color: '#F3AB71' },
    { key: 'cobro', label: 'Cobro', value: 17, color: '#CEC7C7' },
  ]
  const html = await dibujar(createElement(DistributionChart, {
    title: 'Plan de prueba', items, total: 47, formatear: (n: number) => `X${n}`,
  }))
  const franjas = [...html.matchAll(/style="width:([\d.]+)%;background-color:(#[0-9A-F]+)"/gi)]
  assert.equal(franjas.length, 2, 'sólo las partes positivas en la barra')
  assert.ok(!franjas.some((f) => f[2] === '#8ED6B9'), 'la ganancia negativa no se dibuja')
  assert.ok(Math.abs(franjas.reduce((a, f) => a + Number(f[1]), 0) - 100) < 0.001, 'la barra se llena, no se desborda')
  const t = texto(html)
  assert.match(t, /Ganancia X-10/)
  assert.match(t, /Total X47/)
})

test('6. Costs dibuja las tres secciones, con la ganancia del 97 derivada del cupo y los dólares como dólares', async () => {
  const corte = (clave: string, costUsd: number) => ({ clave, llamadas: 1, tokens: 0, costUsd })
  const resumen: ResumenPeriodo = {
    periodo: '2026-11', desde: null, hasta: null, filas: 1, llamadas: 1, tokens: 0, costUsd: 0.5,
    porFeature: [corte('closing', 0.5)], porProveedor: [], porModelo: [], porDia: [corte('2026-11-05', 0.5)],
    porWorkspace: [], mesesDisponibles: [], delNegocio: { llamadas: 0, costUsd: 0 }, delCredito: { llamadas: 0, costUsd: 0 },
  }
  const vista = armarCostos({
    periodo: '2026-11', actual: resumen, previo: null, hoy: '2026-11-10', mesesConDatos: ['2026-11'], cobrado: 485, avisos: [],
  })
  const economia = economiaDelMes({ clientesQuePagan: 5, mrrUsd: 485, iaDelMesUsd: 0.5, fijoMensualUsd: fijoDeMartin() })
  const { default: CostsPage } = await import('../app/admin/(polar)/analytics/costs/CostsPage')
  const t = texto(await dibujar(createElement(CostsPage, { vista, economia })))
  for (const titulo of ['Subscription breakdown', 'First month', 'AI quota']) assert.ok(t.includes(titulo), titulo)
  // Las cifras que dependen del cupo se arman con los mismos derivados de arriba: así la pantalla y la cuenta no pueden
  // separarse, y el día que Martín vuelva a mover el cupo este test lo sigue en vez de ponerse rojo.
  const g97 = gananciaDe('growth', [10.78, servirDe('growth'), 8.11, 1.75])
  const desde97 = r2(g97 + 10.78)
  const desde47 = r2(gananciaDe('pro', [10.78, servirDe('pro'), 3.93, 0.85]) + 10.78)
  const pierde97 = r2(ESCENARIO_DEL_MODELO.cacUsd - desde97)
  assert.match(t, new RegExp(`Plan de US\\$97 Ganancia US\\$ ${pesos(g97)} Captación US\\$ 10,78 Servir la cuenta US\\$ ${pesos(servirDe('growth'))} Impuesto US\\$ 8,11 Cobro US\\$ 1,75 Total US\\$ 97,00`))
  assert.match(t, new RegExp(`US\\$97 · primer mes .*?\u2212US\\$ ${pesos(pierde97)}`))
  assert.match(t, new RegExp(`el de 97 arranca perdiendo US\\$ ${pesos(pierde97)}`))
  assert.match(t, new RegExp(`Techo del CAC: US\\$ ${pesos(desde47)} en el de 47 y US\\$ ${pesos(desde97)} en el de 97`))
  assert.match(t, new RegExp(`${CUPO_MENSUAL.growth.toLocaleString('es-AR')} MT`))
  // El formateador de Polar recibe CENTAVOS: el fijo de US$438,25 no puede salir como US$4,38.
  assert.match(t, /US\$ 438,25 al mes sale de tu bolsillo/)
  assert.doesNotMatch(t, /US\$ 4,38 al mes/)
  // Y la sección de IA, que sí viene en centavos, sigue igual (0,5 dólares = 50 centavos).
  assert.match(t, /US\$ 0,50/)
})

test('7. con el CAC en 0 y cobrando por transferencia, los selectores dan otra torta y el techo dice que se gana desde el primer mes', async () => {
  const { SuscripcionCosts } = await import('../app/admin/(polar)/analytics/costs/Suscripcion')
  const t = texto(await dibujar(createElement(SuscripcionCosts, { inicial: { cacUsd: 0, pasarela: 'directo' } })))
  // Lo elegido se ve en el selector aunque la página todavía no se haya hidratado.
  assert.match(t, /CAC US\$0 \(orgánico\)/)
  assert.match(t, /Transferencia o Binance — 0%/)
  // Sin CAC y sin pasarela: las dos partes que esos selectores apagan son 0, y la ganancia es el resto.
  const servir = servirDe('growth')
  assert.match(t, new RegExp(`Plan de US\\$97 Ganancia US\\$ ${pesos(gananciaDe('growth', [0, servir, 8.11, 0]))} Captación US\\$ 0,00 Servir la cuenta US\\$ ${pesos(servir)} Impuesto US\\$ 8,11 Cobro US\\$ 0,00`))
  assert.match(t, /los dos planes dejan plata desde el primer mes/)
})
