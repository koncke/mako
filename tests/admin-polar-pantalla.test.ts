// =============================================================================
// Admin (la copia de Polar): lo que se vio MAL en las capturas del 6/11/2026, ejecutado
// =============================================================================
// La comparación con las capturas de Polar (docs/admin/referencia-polar/) encontró cuatro cosas que ningún test miraba, porque
// todo compilaba y cada dato estaba bien: se veían mal. Lo que fija este archivo:
//   1. la regla de los bordes de `.pl` (polar.css) va adentro de `@layer base`: sin capa le ganaba a TODA utilidad de Tailwind
//      (las utilidades viven en `@layer utilities`, y lo que no tiene capa gana siempre) y los ítems de la barra salían con un
//      borde gris que en Polar no tienen;
//   2. Analytics › Events dice la hora con UN formato: el día de un pago iba con el año («04 de nov de 2026», cortado en la celda
//      como «04 de nov de 20…») al lado de «06-nov, 14:20:00»;
//   3. el selector de fechas de Sales (Orders y Subscriptions) muestra su rótulo: el ícono y el rótulo iban en un <span> que el
//      SelectTrigger de Orbit recorta a un renglón (`[&>span]:line-clamp-1`), y el rótulo quedaba en el segundo, invisible;
//   4. la tabla de Members entra en la columna de la ficha a 1440 (744 px): con el ancho por defecto de TanStack medía 1.000.
//   Lo que no se puede ejecutar en node (el alto del contenedor de Admin, que con `flex-1` le ganaba al `height` y hacía scrollear
//   el documento) queda en docs/hallazgos-customers.md y en las capturas de docs/admin/polar/.
//
// Correr: node --import tsx --test tests/admin-polar-pantalla.test.ts
//
// Probado rompiéndolo el 6/11/2026 (base 4/0). Cada rotura, sola:
//   · la regla `.pl *{border-color}` sin capa, o en una capa nueva (va después de utilities) → 3/1 (1), las dos
//   · `formatEventTimestamp` con `year: 'numeric'` en el día de un pago         → 3/1 (2)
//   · DateRangeSelect vuelve a envolver ícono y rótulo en un <span className="flex"> → 3/1 (3)
//   · Members con `persona: 400`                                                → 3/1 (4)
// =============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss, { type AtRule, type Rule } from 'postcss'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { formatEventTimestamp } from '../app/admin/_polar/web/Events/EventLogRow'
import { DateRangeSelect } from '../app/admin/_polar/web/Orders/DateRangeSelect'
import { ANCHOS_MIEMBROS } from '../app/admin/_polar/web/Customer/CustomerPage/MembersSection'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

test('1. ninguna regla de polar.css con «*» queda fuera de una capa (le ganaría a las utilidades de Tailwind)', () => {
  const css = readFileSync(join(RAIZ, 'app/admin/_polar/polar.css'), 'utf8')
  const raiz = postcss.parse(css)
  const conAsterisco: { selector: string; capa: string | null }[] = []
  raiz.walkRules((r: Rule) => {
    if (!r.selectors.some((s) => /(^|\s|>)\*(\s|$|,|::)/.test(s) || s.trim() === '*')) return
    let capa: string | null = null
    for (let p = r.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && (p as AtRule).name === 'layer') capa = (p as AtRule).params
    }
    conAsterisco.push({ selector: r.selector, capa })
  })
  assert.ok(conAsterisco.some((x) => x.selector.includes('.pl *')), 'la regla de los bordes de `.pl` sigue existiendo')
  // Tailwind declara `@layer theme, base, components, utilities;`: lo que no está en una de las tres de antes de `utilities`
  // (sin capa, o en una capa nueva, que va DESPUÉS de las declaradas) le gana a las clases.
  const antesDeLasUtilidades = new Set(['theme', 'base', 'components'])
  const lesGana = conAsterisco.filter((x) => x.capa === null || !antesDeLasUtilidades.has(x.capa))
  assert.deepEqual(lesGana, [], 'una regla con «*» fuera de theme/base/components le pinta el borde a todo, por encima de las clases de Tailwind')
})

test('2. Events: el día de un pago va en el mismo formato que una hora, sin el año', () => {
  const dia = formatEventTimestamp('2026-11-04T00:00:00Z', true)
  const conHora = formatEventTimestamp('2026-11-04T14:20:00Z')
  assert.doesNotMatch(dia, /2026|\bde\b/, `«${dia}»: el año alarga la celda y la corta`)
  assert.ok(conHora.startsWith(dia.slice(0, 3)), `el día («${dia}») y la hora («${conHora}») arrancan igual`)
  assert.ok(dia.length <= 8, `«${dia}» entra en la celda`)
})

test('3. el selector de fechas de Sales: el rótulo no queda en un <span> junto al ícono', () => {
  const html = renderToStaticMarkup(createElement(DateRangeSelect, { value: 'allTime', onChange: () => {} }))
  const boton = html.match(/<button[^>]*>([\s\S]*)<\/button>/)
  assert.ok(boton, 'se dibuja el botón del selector')
  // Los hijos directos del botón: un <span> que tenga adentro un <svg> Y otro <span> es el que Orbit recorta a un renglón.
  let profundidad = 0
  let actual = ''
  const hijos: string[] = []
  for (const parte of boton[1].split(/(<\/?[a-z][^>]*>)/)) {
    if (!parte) continue
    actual += parte
    if (/^<\//.test(parte)) profundidad--
    else if (/^<[a-z]/.test(parte) && !/\/>$/.test(parte)) profundidad++
    if (profundidad === 0) { if (actual.trim()) hijos.push(actual); actual = '' }
  }
  const spansConIconoYRotulo = hijos.filter((h) => h.startsWith('<span') && h.includes('<svg') && /<span[\s\S]*<span/.test(h))
  assert.deepEqual(spansConIconoYRotulo, [], 'el ícono y el rótulo no comparten un <span>: el segundo renglón no se ve')
  assert.ok(hijos.some((h) => h.startsWith('<svg')), 'el ícono del calendario es un hijo del botón')
})

test('4. Members entra en la columna de la ficha a 1440 (744 px)', () => {
  const total = Object.values(ANCHOS_MIEMBROS).reduce((a, b) => a + b, 0)
  assert.ok(total <= 744, `las columnas suman ${total} px y la ficha tiene 744`)
  assert.equal(Object.keys(ANCHOS_MIEMBROS).length, 7, 'las siete columnas de Members tienen su ancho')
})
