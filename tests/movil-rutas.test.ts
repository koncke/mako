// =============================================================================
// MaKo Mobile — el contrato de destinos (lib/movil-rutas.ts)
// =============================================================================
// Fija tres cosas que se rompen sin un solo error:
//   · el prefijo: `/m` y `/m/...`, NUNCA /mako, /marketing ni la ruta PÚBLICA
//     /m.js (el cargador del Pixel). Un `startsWith('/m')` las atrapa a todas.
//   · quién ve qué: la MISMA regla del Sidebar (rolesWs de nav.ts + tabEnCapa),
//     sin una segunda tabla de permisos. Cada navKey existe en nav.ts.
//   · el mapa escritorio → móvil que usan los links de los Web Push.
//
// Verificado ROMPIÉNDOLO (11/10/2026):
//   · `esRutaMovil` con `p.startsWith('/m')`: 2 fallos, 8 pases (el prefijo y
//     el mapa, que dejaba pasar /mako como si ya fuera móvil).
//   · la navKey de CRM cambiada a 'crm-x' (no existe en nav.ts): 3 fallos, 7 pases.
//   · `puedeVerKey` sin `tabEnCapa`: 1 fallo, 9 pases (la capa pm veía CRM).
//   · `rutaMovil` sin quitar el `#` antes de la query: 1 fallo, 9 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { TODOS_LOS_ITEMS, USER_NAV } from '../app/_components/nav';
import {
  DESTINOS_MOVIL, HOME_MOVIL, esRutaMovil, puedeVerKey, destinosVisibles, destinoActivo,
  rutaMovil, rutaMovilOHome,
} from '../lib/movil-rutas';

const ids = (rol: Parameters<typeof destinosVisibles>[0], capa: string | null) =>
  destinosVisibles(rol, capa).map((d) => d.id);

test('el prefijo móvil es /m o /m/..., nunca /mako, /marketing ni /m.js', () => {
  for (const p of ['/m', '/m/', '/m/hoy', '/m/crm/12', '/m/cuenta']) assert.equal(esRutaMovil(p), true, p);
  for (const p of ['/mako', '/mako-doer', '/marketing', '/mensajes', '/metodo', '/mi-curso', '/m.js', '/', '', null, undefined]) {
    assert.equal(esRutaMovil(p), false, String(p));
  }
});

test('cada destino con navKey hereda una key que EXISTE en nav.ts', () => {
  const keys = new Set([...TODOS_LOS_ITEMS, ...USER_NAV].map((i) => i.key));
  for (const d of DESTINOS_MOVIL) {
    if (d.navKey) assert.ok(keys.has(d.navKey), `${d.id} → navKey «${d.navKey}» no está en nav.ts`);
    assert.ok(d.href.startsWith('/m/'), d.href);
  }
  assert.ok(DESTINOS_MOVIL.length <= 5, 'más de 5 destinos en la barra es un veto');
  assert.equal(DESTINOS_MOVIL[0].href, HOME_MOVIL);
});

test('los nombres van en inglés, como el escritorio', () => {
  assert.deepEqual(DESTINOS_MOVIL.map((d) => d.label), ['Today', 'Inbox', 'MaKo', 'CRM', 'Plan']);
});

test('admin de un cliente completo ve los cinco', () => {
  assert.deepEqual(ids('admin', 'completo'), ['hoy', 'inbox', 'mako', 'crm', 'plan']);
});

test('closer y setter ven lo que nav.ts les da (CRM, Plan, MaKo)', () => {
  assert.deepEqual(ids('closer', 'completo'), ['hoy', 'inbox', 'mako', 'crm', 'plan']);
  assert.deepEqual(ids('setter', 'completo'), ['hoy', 'inbox', 'mako', 'crm', 'plan']);
});

test('la capa pm no ve CRM aunque sea admin (tabEnCapa manda)', () => {
  assert.deepEqual(ids('admin', 'pm'), ['hoy', 'inbox', 'mako', 'plan']);
  assert.equal(puedeVerKey('crm', 'admin', 'pm'), false);
});

test('sin rol resuelto no ve nada gateado, sólo Today e Inbox', () => {
  assert.deepEqual(ids(null, 'completo'), ['hoy', 'inbox']);
  assert.equal(puedeVerKey('inexistente', 'admin', 'completo'), false);
});

test('el destino activo de una ruta', () => {
  assert.equal(destinoActivo('/m/hoy'), 'hoy');
  assert.equal(destinoActivo('/m/crm/45'), 'crm');
  assert.equal(destinoActivo('/m/cuenta'), null);
  assert.equal(destinoActivo('/crm'), null);
  assert.equal(destinoActivo('/mako'), null);
});

test('el mapa escritorio → móvil de los links que salen', () => {
  assert.equal(rutaMovil('/general'), '/m/hoy');
  assert.equal(rutaMovil('/crm/12'), '/m/crm/12');
  assert.equal(rutaMovil('/crm/12/resumen?ws=3'), '/m/crm/12');
  assert.equal(rutaMovil('/crm/12#notas'), '/m/crm/12');
  assert.equal(rutaMovil('https://hola-mako.com/mako/revisar/abc?ws=1'), '/m/inbox');
  assert.equal(rutaMovil('/configuraciones?tab=notif'), '/m/cuenta');
  assert.equal(rutaMovil('/configuraciones'), null);
  assert.equal(rutaMovil('/ads-manager'), null);
  assert.equal(rutaMovil('/m/plan'), '/m/plan');
  assert.equal(rutaMovil(null), null);
});

test('un link sin equivalente móvil cae en la home', () => {
  assert.equal(rutaMovilOHome('/ads-manager'), HOME_MOVIL);
  assert.equal(rutaMovilOHome(undefined), HOME_MOVIL);
});
