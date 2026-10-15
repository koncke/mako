// =============================================================================
// MaKo Mobile — el contrato de destinos (lib/movil-rutas.ts)
// =============================================================================
// Fija cuatro cosas que se rompen sin un solo error:
//   · el prefijo: `/m` y `/m/...`, NUNCA /mako, /marketing ni la ruta PÚBLICA
//     /m.js (el cargador del Pixel). Un `startsWith('/m')` las atrapa a todas.
//   · quién ve qué: la MISMA regla del Sidebar (rolesWs de nav.ts + tabEnCapa),
//     sin una segunda tabla de permisos. Cada navKey existe en nav.ts y cada ícono
//     existe en el set (uno inventado dibuja un punto, sin error).
//   · la barra v2 (Today · CRM · Inbox · Plan · More) y la regla del hueco: si un rol
//     no ve uno de los cuatro primeros, lo ocupa la primera sección de More que ve;
//     y More no repite lo que subió a la barra.
//   · el mapa escritorio → móvil que usan los links de los Web Push y el desvío.
//
// Verificado ROMPIÉNDOLO (11/10/2026, v1):
//   · `esRutaMovil` con `p.startsWith('/m')`: 2 fallos (el prefijo y el mapa).
//   · la navKey de CRM cambiada a 'crm-x' (no existe en nav.ts): 3 fallos.
//   · `puedeVerKey` sin `tabEnCapa`: 1 fallo (la capa pm veía CRM).
//   · `rutaMovil` sin quitar el `#` antes de la query: 1 fallo.
// Verificado ROMPIÉNDOLO (11/10/2026, v2; base 10 pasan / 0 fallan), de a una y restaurando:
//   · `barraMovil` sin llenar el hueco (sólo los destinos visibles)    → 8 / 2 (el hueco, el activo)
//   · `gruposMas` sin sacar lo que subió a la barra                    → 9 / 1 (More repite)
//   · el ícono de Inbox cambiado a 'inbox' (no existe en el set)       → 9 / 1 (íconos)
//   · `/ads-manager` sin mapear en `rutaMovil`                          → 8 / 2 (el mapa v2, la home)
//   · `destinoActivo` sin marcar More en una sección de More           → 9 / 1 (activo)
// Verificado ROMPIÉNDOLO (11/10/2026, integración; base 10 / 0), de a una y restaurando
// (scratchpad/integ/romper.py):
//   · una ruta /m que conserva el `?ws=` del link                       → 9 / 1
//   · `/comercial` sin `?hoja=comercial`                                 → 9 / 1
//   · `/video-generator?plan=<uuid>` a la lista y no al anuncio          → 9 / 1
//   · `/landing-generator/<id>` a la lista y no a esa landing           → 9 / 1
//   · el closer sin Closing en su capa ve la fila Dashboard en More      → 9 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { TODOS_LOS_ITEMS, USER_NAV } from '../app/_components/nav';
import { NOMBRES_ICONO } from '../app/_components/icons';
import {
  DESTINOS_MOVIL, SECCIONES_MAS, HOME_MOVIL, RUTA_MAS, esRutaMovil, puedeVerKey, destinosVisibles, destinoActivo,
  barraMovil, gruposMas, seccionesMasVisibles, seccionDeRuta, rutaMovil, rutaMovilOHome,
} from '../lib/movil-rutas';

type Rol = Parameters<typeof barraMovil>[0];
const barra = (rol: Rol, capa: string | null) => barraMovil(rol, capa).map((d) => d.id);
const mas = (rol: Rol, capa: string | null) => gruposMas(rol, capa).map((g) => g.secciones.map((s) => s.id));
const familias = (rol: Rol, capa: string | null) => gruposMas(rol, capa).map((g) => g.titulo);

test('el prefijo móvil es /m o /m/..., nunca /mako, /marketing ni /m.js', () => {
  for (const p of ['/m', '/m/', '/m/hoy', '/m/crm/12', '/m/cuenta', '/m/mas', '/m/ads']) assert.equal(esRutaMovil(p), true, p);
  for (const p of ['/mako', '/mako-doer', '/marketing', '/mensajes', '/metodo', '/mi-curso', '/m.js', '/', '', null, undefined]) {
    assert.equal(esRutaMovil(p), false, String(p));
  }
});

test('cada destino y cada sección de More hereda una key que EXISTE en nav.ts, con un ícono que existe', () => {
  const keys = new Set([...TODOS_LOS_ITEMS, ...USER_NAV].map((i) => i.key));
  const iconos = new Set(NOMBRES_ICONO);
  for (const d of [...DESTINOS_MOVIL, ...SECCIONES_MAS]) {
    if (d.navKey) assert.ok(keys.has(d.navKey), `${d.id} → navKey «${d.navKey}» no está en nav.ts`);
    assert.ok(iconos.has(d.icon), `${d.id} → el ícono «${d.icon}» no existe en app/_components/icons.tsx: dibujaría un punto`);
    assert.ok(d.href.startsWith('/m/'), d.href);
  }
  assert.equal(DESTINOS_MOVIL.length, 5, 'la barra es de cinco, nunca más (veto de la casa y de iOS)');
  // v3 (Martín, 14/10/2026): «el ícono del medio, abajo, va a ser General», y es donde se abre.
  assert.equal(DESTINOS_MOVIL[2].href, HOME_MOVIL);
  assert.equal(DESTINOS_MOVIL[DESTINOS_MOVIL.length - 1].href, RUTA_MAS, 'More va al final');
  // Ninguna sección de More comparte ruta con un destino de la barra.
  const hrefs = [...DESTINOS_MOVIL, ...SECCIONES_MAS].map((d) => d.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test('v3: CRM · Chats · General · Plan · More; More por las familias de la sidebar', () => {
  assert.deepEqual(DESTINOS_MOVIL.map((d) => d.label), ['CRM', 'Chats', 'General', 'Plan', 'More']);
  // Chats hereda la key de la bandeja de escritorio (/whatsapp): quien no la ve, no ve la pestaña.
  // La key de la bandeja UNIFICADA (/chats); ve lo mismo que `whatsapp` en todas las capas (tests/chats-registro).
  assert.equal(DESTINOS_MOVIL.find((d) => d.id === 'chats')?.navKey, 'chats');
  assert.deepEqual(SECCIONES_MAS.map((s) => [s.id, s.navKey, s.familia]), [
    ['ads', 'ads-manager', 'operate'], ['dashboard', 'graphics', 'analyze'], ['landing', 'landing-writer', 'sales'],
    ['automations', 'setting', 'sales'], ['video', 'video-generator', 'content'], ['cs', 'customer-success', 'customer'],
    ['mako', 'mako', null],
  ]);
});

test('admin de un cliente completo: la barra de cinco y More con todo, una caja por familia', () => {
  assert.deepEqual(barra('admin', 'completo'), ['crm', 'chats', 'hoy', 'plan', 'mas']);
  assert.deepEqual(mas('admin', 'completo'), [['ads'], ['dashboard'], ['landing', 'automations'], ['video'], ['cs'], ['mako']]);
  // Cada caja lleva el nombre de su familia en la sidebar; MaKo va última y sin título, como en escritorio.
  assert.deepEqual(familias('admin', 'completo'),
    ['Operate', 'Analyze', 'Sales Machine', 'Content Machine', 'Customer Success', null]);
});

test('quién ve qué en More: lo que nav.ts le da a cada rol, y nada más', () => {
  // Closer: Dashboard (graphics, su hoja Closing) y MaKo. Setter: Dashboard (su hoja Chat Analyst, desde la v5
  // del 12/10/2026), Automations (setting) y MaKo.
  assert.deepEqual(mas('closer', 'completo'), [['dashboard'], ['mako']]);
  assert.deepEqual(mas('setter', 'completo'), [['dashboard'], ['automations'], ['mako']]);
  // Una familia sin nada que el rol vea no deja una caja vacía.
  assert.deepEqual(familias('closer', 'completo'), ['Analyze', null]);
  // El closer entra al Dashboard SÓLO por la hoja Closing (app/dashboard/page.tsx): en una capa
  // sin Closing (pm tiene graphics, no closing), More no le ofrece una fila que lo rebota a Today.
  assert.equal(puedeVerKey('graphics', 'closer', 'pm'), true, 'el nav solo se la daría');
  assert.ok(!seccionesMasVisibles('closer', 'pm').some((s) => s.id === 'dashboard'));
  assert.ok(seccionesMasVisibles('admin', 'pm').some((s) => s.id === 'dashboard'), 'el admin sí');
  // Ads Manager, Customer Success, Video y Landing son de admin.
  for (const rol of ['closer', 'setter'] as const) {
    for (const k of ['ads-manager', 'customer-success', 'video-generator', 'landing-writer']) {
      assert.equal(puedeVerKey(k, rol, 'completo'), false, `${rol} ve ${k}`);
    }
  }
  // Sin rol resuelto: nada gateado (sólo General y More, que se componen por rol).
  assert.deepEqual(barra(null, 'completo'), ['hoy', 'mas']);
  assert.deepEqual(seccionesMasVisibles(null, 'completo'), []);
  assert.equal(puedeVerKey('inexistente', 'admin', 'completo'), false);
});

test('el hueco: si el rol no ve uno de los cuatro, lo ocupa la primera sección de More que ve (y no se repite en More)', () => {
  // La capa pm no ve CRM ni la bandeja aunque sea admin (tabEnCapa manda): suben Dashboard y MaKo.
  assert.equal(puedeVerKey('crm', 'admin', 'pm'), false);
  assert.deepEqual(barra('admin', 'pm'), ['dashboard', 'mako', 'hoy', 'plan', 'mas']);
  assert.deepEqual(mas('admin', 'pm'), []);
  // Un setter en pm: sólo ve MaKo de More, y sube (queda un hueco sin llenar: la barra es de cuatro).
  assert.deepEqual(barra('setter', 'pm'), ['mako', 'hoy', 'plan', 'mas']);
  assert.deepEqual(mas('setter', 'pm'), []);
  // destinosVisibles sigue siendo la lista de los FIJOS que el rol ve.
  assert.deepEqual(destinosVisibles('admin', 'pm').map((d) => d.id), ['hoy', 'plan', 'mas']);
});

test('el lugar activo de una ruta', () => {
  assert.equal(destinoActivo('/m/hoy'), 'hoy');
  assert.equal(destinoActivo('/m/crm/45'), 'crm');
  assert.equal(destinoActivo('/m/mas'), 'mas');
  // Una sección de More (y sus subpantallas) y la cuenta marcan More.
  assert.equal(destinoActivo('/m/ads'), 'mas');
  assert.equal(destinoActivo('/m/video/12'), 'mas');
  assert.equal(destinoActivo('/m/mako'), 'mas');
  assert.equal(destinoActivo('/m/cuenta'), 'mas');
  // Salvo que haya subido a la barra: ahí se marca a sí misma.
  const pm = barraMovil('admin', 'pm');
  assert.equal(destinoActivo('/m/dashboard', pm), 'dashboard');
  assert.equal(destinoActivo('/m/dashboard/x', pm), 'dashboard');
  assert.equal(destinoActivo('/m/configurar'), null);
  assert.equal(destinoActivo('/crm'), null);
  assert.equal(destinoActivo('/mako'), null);
  assert.equal(seccionDeRuta('/m/landing/7')?.id, 'landing');
  assert.equal(seccionDeRuta('/m/landingx'), null, 'el prefijo va con barra');
});

test('el mapa escritorio → móvil de los links que salen', () => {
  assert.equal(rutaMovil('/general'), '/m/hoy');
  assert.equal(rutaMovil('/crm/12'), '/m/crm/12');
  assert.equal(rutaMovil('/crm/12/resumen?ws=3'), '/m/crm/12');
  assert.equal(rutaMovil('/crm/12#notas'), '/m/crm/12');
  assert.equal(rutaMovil('https://hola-mako.com/mako/revisar/abc?ws=1'), '/m/inbox');
  // La bandeja de escritorio es la pestaña Chats del teléfono (v3).
  assert.equal(rutaMovil('/whatsapp'), '/m/chats');
  assert.equal(rutaMovil('/chats'), '/m/chats', 'la bandeja unificada de escritorio es la misma pestaña');
  // El link profundo de un lead que manda MaKo (/chats?lead=N) abre SU chat, no la lista.
  assert.equal(rutaMovil('/chats?lead=412&ws=3'), '/m/crm/412/chat');
  assert.equal(rutaMovil('/chats?lead=abc'), '/m/chats');
  assert.equal(rutaMovil('/configuraciones?tab=notif'), '/m/cuenta');
  assert.equal(rutaMovil('/configuraciones'), null);
  assert.equal(rutaMovil('/m/plan'), '/m/plan');
  // Un link que YA es de /m conserva la query que su pantalla lee, pero nunca un `?ws=` viejo
  // (conWs no pisa el que ya está: ganaría el del link, no el de la persona).
  assert.equal(rutaMovil('/m/inbox?vista=avisos&ws=9'), '/m/inbox?vista=avisos');
  assert.equal(rutaMovil('/m/plan?ws=9'), '/m/plan');
  assert.equal(rutaMovil(null), null);
});

test('el mapa v2: cada pantalla de escritorio de una sección de More cae en su sección', () => {
  for (const p of ['/dashboard', '/dashboard?hoja=marketing', '/marketing', '/graficos', '/graficos/3']) {
    assert.equal(rutaMovil(p), '/m/dashboard', p);
  }
  // Comercial es la segunda pestaña del segmentado (la página lee `?hoja=comercial`).
  assert.equal(rutaMovil('/comercial'), '/m/dashboard?hoja=comercial');
  assert.equal(rutaMovil('/dashboard?hoja=comercial&ws=3'), '/m/dashboard?hoja=comercial');
  // Otra hoja abre su pantalla (la página resuelve el id o la plantilla, como escritorio).
  assert.equal(rutaMovil('/dashboard?hoja=closing'), '/m/dashboard/closing');
  assert.equal(rutaMovil('/marketing/salud'), null, 'la salud de Meta no es el Dashboard');
  assert.equal(rutaMovil('/ads-manager'), '/m/ads');
  assert.equal(rutaMovil('/ads-manager/123?ws=4'), '/m/ads');
  assert.equal(rutaMovil('/customer-success'), '/m/cs');
  assert.equal(rutaMovil('/customer-success/curso'), '/m/cs');
  for (const p of ['/automations', '/automations?sec=12', '/chatbot?sec=12', '/chat-bot', '/chat-agent', '/setting']) {
    assert.equal(rutaMovil(p), '/m/automations', p);
  }
  assert.equal(rutaMovil('/settings'), null, 'el prefijo va con barra');
  assert.equal(rutaMovil('/video-generator'), '/m/video');
  // El id del plan y el de una landing son LOS MISMOS en los dos lados: abren esa cosa.
  const plan = '3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f';
  assert.equal(rutaMovil(`/video-generator?plan=${plan}&ws=2`), `/m/video/${plan}`);
  assert.equal(rutaMovil('/video-generator?plan=no-es-un-id'), '/m/video');
  assert.equal(rutaMovil('/landing-generator'), '/m/landing');
  assert.equal(rutaMovil('/landing-generator/42'), '/m/landing/42');
  assert.equal(rutaMovil('/landing-generator/crear'), '/m/landing');
  assert.equal(rutaMovil('/landing-writer/5'), '/m/landing');
});

test('un link sin equivalente móvil cae en la home', () => {
  assert.equal(rutaMovilOHome('/configuraciones'), HOME_MOVIL);
  assert.equal(rutaMovilOHome('/whatsapp'), '/m/chats');
  assert.equal(rutaMovilOHome('/ads-manager'), '/m/ads');
  assert.equal(rutaMovilOHome(undefined), HOME_MOVIL);
});
