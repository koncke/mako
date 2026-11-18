// =============================================================================
// Admin › Customers › <negocio> › Usage: «Por persona», lo que hizo cada una (F169, 18/11/2026)
// =============================================================================
// Correr: node --import tsx --test tests/admin-polar-uso-por-persona.test.ts
//
// La pestaña Usage sumaba por TAB (`usoDelNegocio`) y de cada persona sólo decía cuántas fueron. `usoPorPersona`
// (app/admin/_polar/datos/cliente.ts) suma las MISMAS filas, en el MISMO rango, por quién las abrió, y la vista lo dibuja con la
// persona como la dibuja Members.
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026). Base: 3 pass / 0 fail. Cada rotura, restaurada después:
//   · `usoPorPersona` sin el corte del rango (`f.dia < desde || f.dia > hasta`)                → 1/2 (suma, rango vacío)
//   · `usoPorPersona` sin juntar las keys de una tab (usa `f.tab` en vez de `tabDe`)           → 2/1 (suma)
//   · la vista sin pasarle `personas` a `usoPorPersona` (un `[]` en su lugar)                  → 2/1 (vista)
//   · un cambio sin efecto (renombrar la variable local `quien`)                               → 3/0

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { usoDelNegocio, usoPorPersona, type PersonaDelUso } from '../app/admin/_polar/datos/cliente'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const TABS = [
  { key: 'crm', label: 'CRM', keys: ['crm', 'crm-ficha'] },
  { key: 'plan', label: 'Plan', keys: ['plan'] },
  { key: 'automations', label: 'Automations', keys: ['automations'] },
]
const PERSONAS: PersonaDelUso[] = [
  { id: 7, nombre: 'Carla Méndez', email: 'carla@estudio-norte.test', cara: null },
  { id: 9, nombre: '', email: 'pablo@estudio-norte.test', cara: 'https://lh3.googleusercontent.com/x' },
]
const FILAS = [
  { dia: '2026-11-10', usuario: 7, tab: 'crm', pantallas: 5, acciones: 2 },
  { dia: '2026-11-11', usuario: 7, tab: 'crm-ficha', pantallas: 4, acciones: 1 },
  { dia: '2026-11-12', usuario: 7, tab: 'plan', pantallas: 3, acciones: 0 },
  { dia: '2026-11-12', usuario: 9, tab: 'automations', pantallas: 2, acciones: 4 },
  { dia: '2026-10-01', usuario: 9, tab: 'automations', pantallas: 50, acciones: 50 },
  { dia: '2026-11-13', usuario: 11, tab: 'plan', pantallas: 1, acciones: 0 },
  { dia: '2026-11-13', usuario: 7, tab: 'plan', pantallas: 0, acciones: 0 },
]

test('suma por persona en el rango, con la tab que más usó y su último día', () => {
  const r = usoPorPersona(FILAS, TABS, PERSONAS, '2026-11-01', '2026-11-30')
  assert.deepEqual(r.map((p) => [p.id, p.nombre, p.email, p.pantallas, p.acciones, p.tabs, p.masUsada, p.ultimo]), [
    // 7: CRM y su ficha son UNA tab (9 pantallas + 3 acciones), más el Plan. Lo más usado, el CRM.
    [7, 'Carla Méndez', 'carla@estudio-norte.test', 12, 3, 2, 'CRM', '2026-11-12'],
    // 9: lo de octubre queda fuera del rango (si entrara, sería la primera).
    [9, 'pablo@estudio-norte.test', '', 2, 4, 1, 'Automations', '2026-11-12'],
    // 11: no está entre las personas leídas (alguien de su agencia, o no se pudieron leer): sale igual, sin esconder su uso.
    [11, 'Sin nombre', '', 1, 0, 1, 'Plan', '2026-11-13'],
  ])
  assert.equal(r[1].cara, 'https://lh3.googleusercontent.com/x', 'la cara de Members viaja con la persona')
})

test('las pantallas de las personas son las mismas que las de las tabs (la tabla de arriba y la de abajo cuadran)', () => {
  const desde = '2026-11-01'
  const hasta = '2026-11-30'
  const porTab = usoDelNegocio(FILAS, TABS, [], desde, hasta, 'day').medidores.reduce((s, m) => s + m.consumido, 0)
  const porPersona = usoPorPersona(FILAS, TABS, PERSONAS, desde, hasta).reduce((s, p) => s + p.pantallas, 0)
  assert.equal(porPersona, porTab)
  assert.deepEqual(usoPorPersona(FILAS, TABS, PERSONAS, '2026-12-01', '2026-12-31'), [], 'un rango sin uso: nadie')
})

test('la vista: Usage le pasa las personas y dibuja «Por persona» con las filas del rango', () => {
  const vista = sinComentarios(leer('app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView.tsx'))
  assert.match(vista, /usoPorPersona\(filas, tabs, personas, desde, hasta\)/, 'las mismas filas y el mismo rango que la tabla de las tabs')
  assert.match(vista, /data=\{porPersona\}/, 'la tabla dibuja lo de cada persona')
  const pagina = leer('app/admin/(polar)/customers/[id]/usage/page.tsx')
  assert.match(pagina, /personas=\{uso\.personas\}/, 'la página pasa quién es cada uno')
  const server = sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts'))
  assert.match(server, /todos\.filter\(\(u\) => ids\.has\(u\.id\)\)/, 'viajan sólo las personas con uso en este negocio')
})
