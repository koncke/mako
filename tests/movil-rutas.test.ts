// =============================================================================
// MaKo Mobile — el contrato de destinos (lib/movil-rutas.ts)
// =============================================================================
// Fija cuatro cosas que se rompen sin un solo error:
//   · el prefijo: `/m` y `/m/...`, NUNCA /mako, /marketing ni la ruta PÚBLICA
//     /m.js (el cargador del Pixel). Un `startsWith('/m')` las atrapa a todas.
//   · quién ve qué: la MISMA regla del Sidebar (rolesWs de nav.ts + tabEnCapa),
//     sin una segunda tabla de permisos. Cada navKey existe en nav.ts y cada ícono
//     existe en el set (uno inventado dibuja un punto, sin error).
//   · la barra (CRM · Chats · Ops Center · Dashboard · More desde el 04/11/2026) y la regla del hueco: si un rol
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
// 15/10/2026, las siete de More (Calendario, Second Brain, Experiments, Offer, Copywriting, Curso y
// Comunidad; base 11 / 0), de a una y restaurando:
//   · Curso mapeado DESPUÉS del `dentro(p, '/customer-success')` de Clientes  → 10 / 1 (las siete)
//   · `/analisis` sin la pestaña Análisis fijada (`fija`)                     → 10 / 1 (las siete)
//   · `QUERY_DE_SECCION.experimentos` sin 'tab' (el push abría Retro)          → 10 / 1 (las siete)
// 04/11/2026, el Dashboard en el lugar de Plan (base 11 / 0, y sidebar-nueva 13 / 0), de a una y restaurando:
//   · `destinoDashboard` sin mirar General (el closer abría /m/hoy)          → 20 / 4 (las dos)
//   · `destinoActivo` sin el Dashboard dueño de /m/hoy y Avisos              → 10 / 1 (activo)
//   · `masCompleto` sin `dashboardEnBarra` (More sumaba otro Dashboard)      → sidebar-nueva 23 / 1
// Quién ve cada una y que cada fila sea la de la sidebar: tests/movil-mas-secciones.test.ts.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { TODOS_LOS_ITEMS, USER_NAV, ADMIN_NAV } from '../app/_components/nav';
import { NOMBRES_ICONO } from '../app/_components/icons';
import { LEAD_MAGNET_EN_PRODUCCION } from '../lib/lead-magnets/archivado';
import {
  DESTINOS_MOVIL, SECCIONES_MAS, HOME_MOVIL, RUTA_MAS, esRutaMovil, puedeVerKey, destinosVisibles, destinoActivo,
  barraMovil, gruposMas, seccionesMasVisibles, seccionDeRuta, rutaMovil, rutaMovilOHome, rutaEscritorio,
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
  // Las del super admin (17/10/2026) son herramientas de la plataforma: su key está en ADMIN_NAV (nav.ts → HERRAMIENTAS).
  const keys = new Set([...TODOS_LOS_ITEMS, ...USER_NAV, ...ADMIN_NAV].map((i) => i.key));
  const iconos = new Set(NOMBRES_ICONO);
  for (const d of [...DESTINOS_MOVIL, ...SECCIONES_MAS]) {
    if (d.navKey) assert.ok(keys.has(d.navKey), `${d.id} → navKey «${d.navKey}» no está en nav.ts`);
    assert.ok(iconos.has(d.icon), `${d.id} → el ícono «${d.icon}» no existe en app/_components/icons.tsx: dibujaría un punto`);
    assert.ok(d.href.startsWith('/m/'), d.href);
  }
  assert.equal(DESTINOS_MOVIL.length, 5, 'la barra es de cinco, nunca más (veto de la casa y de iOS)');
  // El del medio: General (14/10/2026), el Dashboard (17/10/2026 noche) y, desde el 20/10/2026, el OPS CENTER, la tab
  // principal (pedido bb885d5f). Probado rompiéndolo: con el Dashboard de vuelta al medio → caen éste y cuatro más.
  assert.equal(DESTINOS_MOVIL[2].href, '/m/second-brain');
  assert.equal(DESTINOS_MOVIL[2].id, 'mako', 'la MISMA id que su fila de More: así More no la repite');
  assert.equal(DESTINOS_MOVIL[DESTINOS_MOVIL.length - 1].href, RUTA_MAS, 'More va al final');
  // Ninguna sección de More comparte ruta con un destino de la barra ni con otra sección, salvo el Ops Center: su fila de
  // More (`mako`), la oculta de Second Brain y, desde el 20/10/2026, el lugar del medio de la barra son el MISMO chat, y
  // nadie lo ve dos veces (`gruposMas` saca lo que está en la barra; el test del admin de un cliente completo, abajo).
  const hrefs = [...DESTINOS_MOVIL, ...SECCIONES_MAS.filter((s) => s.id !== 'mako' && s.id !== 'second-brain')].map((d) => d.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(SECCIONES_MAS.find((s) => s.id === 'mako')?.href, SECCIONES_MAS.find((s) => s.id === 'second-brain')?.href);
});

test('CRM · Chats · Ops Center · Dashboard · More; More por las familias de la sidebar', () => {
  // 20/10/2026 (pedido bb885d5f): el lugar del medio es el Ops Center; el Dashboard pasó a More.
  // 04/11/2026 (Martín: «en lugar de "Plan" en la bottom bar, pon "Dashboard"»): el Dashboard vuelve, donde estaba Plan.
  assert.deepEqual(DESTINOS_MOVIL.map((d) => d.label), ['CRM', 'Chats', 'Ops Center', 'Dashboard', 'More']);
  assert.equal(DESTINOS_MOVIL.find((d) => d.id === 'dashboard')?.href, HOME_MOVIL, 'quien ve General: el Dashboard unido');
  // Chats hereda la key de la bandeja de escritorio (/whatsapp): quien no la ve, no ve la pestaña.
  // La key de la bandeja UNIFICADA (/chats); ve lo mismo que `whatsapp` en todas las capas (tests/chats-registro).
  assert.equal(DESTINOS_MOVIL.find((d) => d.id === 'chats')?.navKey, 'chats');
  // 15/10/2026: las siete del prototipo v3, cada una en su lugar de la sidebar (Copywriting se gatea con la key
  // de su sección Ads Writer: la de la tab unificada no está en TODOS_LOS_ITEMS).
  // 29/10/2026: Copywriting ES el Copywriter (una pantalla, sin secciones): se gatea con su key, `copywriter`.
  // 17/10/2026, la sidebar nueva: dos familias (Operate con Dashboard y Clients; Sales Machine con Video y Copywriting),
  // Second Brain arriba sin título, y el Mapa y Experiments OCULTOS (sus páginas siguen; no son filas).
  assert.deepEqual(SECCIONES_MAS.map((s) => [s.id, s.navKey, s.familia, s.oculta ?? false]), [
    // 17/10/2026 noche, la sidebar del prototipo: lo diario, Sales, Marketing y Create, en el orden de la sidebar.
    // Plan dejó la barra el 04/11/2026: encabeza lo diario, como en la sidebar.
    ['plan', 'todo', 'diario', false], ['dashboard', 'graphics', 'diario', false],
    ['calendario', 'calendario', 'sales', false], ['automations', 'setting', 'sales', false],
    ['cs', 'customer-success', 'sales', false], ['partners', 'partners', null, true], ['agency', 'agency', null, true],
    ['offer', 'offer', 'marketing', false], ['ads', 'ads-manager', 'marketing', false],
    // Competitor Spy (6/11/2026): fila de Marketing, debajo del CoPilot, con su pantalla del teléfono.
    ['competitor-spy', 'market-an', 'marketing', false],
    // 29/10/2026 (Create sin pestañas): la fila Video abre el editor, como la sidebar.
    ['video', 'video-editor', 'create', false], ['image', 'image-editor', 'create', false], ['copywriting', 'copywriter', 'create', false],
    // AI Avatar, para todos desde el 29/10/2026: fila de Create, como Video.
    ['ai-avatar', 'ai-avatar', 'create', false], ['landing', 'landing-writer', 'create', false],
    // Lead Magnet (5/11/2026): sólo de la plataforma por ahora, oculta como Admin (More le arma la fila desde la sidebar).
    // ARCHIVADO el 11/11/2026 por pedido de Martín (lib/lead-magnets/archivado.ts): con el interruptor apagado, la fila no está.
    ...(LEAD_MAGNET_EN_PRODUCCION ? [['lead-magnet', 'lead-magnet-generator', null, true] as const] : []),
    ['mako', 'mako', null, false],
    ['second-brain', 'second-brain', null, true], ['experimentos', 'experimentos', null, true],
    ['curso', 'cs-curso', null, true], ['comunidad', 'cs-comunidad', null, true],
    // 17/10/2026, «Mobile 2»: las pantallas del menú de la foto, ocultas (More arma su fila desde USER_NAV).
    ['tickets', 'tickets', null, true], ['configuraciones', 'configuraciones', null, true],
    // Las del super admin (su página pregunta `getSesionAdmin`, como la de escritorio). MaKo Messages salió el 26/10/2026.
    ['api-mako', 'api-mako', null, true], ['conocimientos', 'conocimientos', null, true],
    ['cobros', 'admin-cobros', null, true], ['agente', 'admin-agente', null, true],
    // 26/10/2026: Customers en el teléfono (/m/customers), oculta como las demás del super admin.
    ['customers', 'admin-customers', null, true],
    ['approvals', 'admin-approvals', null, true],
    // 17/10/2026, las tabs de CREACIÓN: Image es fila (debajo de Video, como en la sidebar); las demás, ocultas
    // (secciones de Video, Image y Copywriting: lib/movil-creacion.ts y tests/m-creacion.test.ts).
    // 29/10/2026: Video Generator queda oculta (una plantilla de Video); Reels y Carousels se retiraron.
    // 29/10/2026: la fila oculta del método de redacción del super admin se fue (Martín: «no quiero ninguna mención»).
    ['video-generator', 'video-generator', null, true], ['stories', 'stories', null, true],
  ]);
});

test('admin de un cliente completo: la barra de cinco y More con todo, una caja por familia', () => {
  assert.deepEqual(barra('admin', 'completo'), ['crm', 'chats', 'mako', 'dashboard', 'mas']);
  // Desde el 20/10/2026 el Ops Center (`mako`) está en la barra, así que la caja de arriba (sin título) quedó vacía y no
  // se dibuja; lo diario (Plan desde el 04/11/2026: el Dashboard volvió a la barra), Sales, Marketing y Create.
  assert.deepEqual(mas('admin', 'completo'), [
    // Competitor Spy (6/11/2026): fila de Marketing, debajo del CoPilot.
    ['plan'], ['calendario', 'automations', 'cs'], ['offer', 'ads', 'competitor-spy'],
    // Image (la copia de Canva) es fila de More desde el 17/10/2026, debajo de Video; AI Avatar (de Pro) desde el 29/10/2026.
    ['video', 'image', 'copywriting', 'ai-avatar', 'landing'],
  ]);
  // Lo diario con título desde el 20/10/2026 (en escritorio lleva rótulo y el Ops Center adentro).
  assert.deepEqual(familias('admin', 'completo'), ['Today', 'Sales', 'Marketing', 'Create']);
});

test('quién ve qué en More: lo que nav.ts le da a cada rol, y nada más', () => {
  // Closer: Dashboard (graphics, su hoja Closing). Setter: Dashboard (su hoja Chat Analyst, desde la v5 del 12/10/2026) y
  // Automations (setting). El Ops Center (MaKo) lo tienen los dos en la barra desde el 20/10/2026.
  // 04/11/2026: el Dashboard del closer y del setter en la barra es SU hoja (/m/dashboard), y Plan pasa a More.
  assert.deepEqual(barra('closer', 'completo'), ['crm', 'chats', 'mako', 'dashboard', 'mas']);
  assert.equal(barraMovil('closer', 'completo').find((b) => b.id === 'dashboard')?.href, '/m/dashboard', 'su hoja, no /m/hoy');
  assert.equal(barraMovil('admin', 'completo').find((b) => b.id === 'dashboard')?.href, HOME_MOVIL, 'el unido');
  // Calendar desde el 6/11/2026: sólo sus «Llamadas» (app/calendario/page.tsx).
  assert.deepEqual(mas('closer', 'completo'), [['plan'], ['calendario']]);
  assert.deepEqual(mas('setter', 'completo'), [['plan'], ['calendario', 'automations']]);
  // Una familia sin nada que el rol vea no deja una caja vacía.
  assert.deepEqual(familias('closer', 'completo'), ['Today', 'Sales'], 'Sales por Calendar (sus «Llamadas», 6/11/2026)');
  // El closer entra al Dashboard SÓLO por la hoja Closing (app/dashboard/page.tsx): en una capa
  // sin Closing (pm tiene graphics, no closing), More no le ofrece una fila que lo rebota a Today.
  assert.equal(puedeVerKey('graphics', 'closer', 'pm'), true, 'el nav solo se la daría');
  assert.ok(!seccionesMasVisibles('closer', 'pm').some((s) => s.id === 'dashboard'));
  assert.ok(seccionesMasVisibles('admin', 'pm').some((s) => s.id === 'dashboard'), 'el admin sí');
  // Ads Manager, Customer Success, Video y Landing son de admin; las siete del 15/10/2026, también.
  for (const rol of ['closer', 'setter'] as const) {
    // Calendario salió de esta lista el 6/11/2026: el closer y el setter ven sus «Llamadas».
    assert.equal(puedeVerKey('calendario', rol, 'completo'), true, `${rol} no ve sus llamadas`);
    for (const k of ['ads-manager', 'customer-success', 'video-generator', 'landing-writer',
      'second-brain', 'experimentos', 'offer', 'ads-writer', 'cs-curso', 'cs-comunidad']) {
      assert.equal(puedeVerKey(k, rol, 'completo'), false, `${rol} ve ${k}`);
    }
  }
  // Sin rol resuelto: nada gateado (sólo More; el Ops Center pide la key `mako`). La puerta lo manda a /login igual.
  assert.deepEqual(barra(null, 'completo'), ['mas']);
  assert.deepEqual(seccionesMasVisibles(null, 'completo'), []);
  assert.equal(puedeVerKey('inexistente', 'admin', 'completo'), false);
});

test('el hueco: si el rol no ve uno de los cuatro, lo ocupa la primera sección de More que ve (y no se repite en More)', () => {
  // La capa pm no ve CRM ni la bandeja aunque sea admin (tabEnCapa manda): suben las dos primeras de More
  // que ve, en el orden de la sidebar. Desde el 15/10/2026 Calendario (Operate, que la capa pm tiene desde el
  // 13/10: los deadlines del Plan) va antes que Dashboard (Analyze), y MaKo se queda en More.
  assert.equal(puedeVerKey('crm', 'admin', 'pm'), false);
  // Desde el 20/10/2026 el lugar del medio es el Ops Center (un lugar FIJO: no sube a ocupar otro hueco), y las hojas del
  // Dashboard vuelven a poder subir: el Dashboard ya no está en la barra.
  // 04/11/2026: Plan es la primera de More que sube; el Dashboard es un lugar FIJO (su hoja: el admin de pm no ve General).
  assert.deepEqual(barra('admin', 'pm'), ['plan', 'calendario', 'mako', 'dashboard', 'mas']);
  assert.equal(barraMovil('admin', 'pm').find((b) => b.id === 'dashboard')?.href, '/m/dashboard');
  assert.deepEqual(mas('admin', 'pm'), []);
  // Un setter en pm: suben Plan y Calendar (sus «Llamadas», desde el 6/11/2026); su hoja (Chat Analyst) no está en pm, así
  // que no tiene Dashboard en la barra.
  assert.deepEqual(barra('setter', 'pm'), ['plan', 'calendario', 'mako', 'mas']);
  assert.deepEqual(mas('setter', 'pm'), []);
  // destinosVisibles sigue siendo la lista de los FIJOS que el rol ve.
  assert.deepEqual(destinosVisibles('admin', 'pm').map((d) => d.id), ['mako', 'dashboard', 'mas']);
  assert.deepEqual(destinosVisibles('setter', 'pm').map((d) => d.id), ['mako', 'mas']);
});

test('el lugar activo de una ruta', () => {
  // El Dashboard en la barra (04/11/2026) es dueño de la portada, de las hojas y de su campana.
  assert.equal(destinoActivo('/m/hoy'), 'dashboard');
  assert.equal(destinoActivo('/m/inbox'), 'dashboard');
  assert.equal(destinoActivo('/m/dashboard'), 'dashboard');
  // Sin él en la barra (el setter de pm), son de More, como del 20/10 al 04/11/2026.
  const setterPm = barraMovil('setter', 'pm');
  assert.equal(destinoActivo('/m/hoy', setterPm), 'mas');
  assert.equal(destinoActivo('/m/inbox', setterPm), 'mas');
  // Plan es una sección de More: lo marca More.
  assert.equal(destinoActivo('/m/plan'), 'mas');
  assert.equal(destinoActivo('/m/crm/45'), 'crm');
  assert.equal(destinoActivo('/m/mas'), 'mas');
  // Una sección de More (y sus subpantallas) y la cuenta marcan More.
  assert.equal(destinoActivo('/m/ads'), 'mas');
  assert.equal(destinoActivo('/m/video/12'), 'mas');
  assert.equal(destinoActivo('/m/cuenta'), 'mas');
  // El Ops Center del medio es dueño del chat, del grafo y de /m/mako; y para el super admin (su lugar abre el Centro),
  // también del chat: los dos son su Ops Center.
  assert.equal(destinoActivo('/m/second-brain'), 'mako');
  assert.equal(destinoActivo('/m/second-brain/mapa'), 'mako');
  assert.equal(destinoActivo('/m/mako'), 'mako');
  const centro = barraMovil('admin', 'superadmin', true);
  assert.equal(centro.find((b) => b.id === 'mako')?.href, '/m/operaciones', 'el super admin: su Ops Center es el Centro');
  assert.equal(barraMovil('admin', 'superadmin').find((b) => b.id === 'mako')?.href, '/m/second-brain', 'mirando un cliente: el del cliente');
  assert.equal(destinoActivo('/m/operaciones', centro), 'mako');
  assert.equal(destinoActivo('/m/second-brain/mapa', centro), 'mako');
  // Salvo que haya subido a la barra: ahí se marca a sí misma.
  const pm = barraMovil('admin', 'pm');
  assert.equal(destinoActivo('/m/calendario', pm), 'calendario');
  assert.equal(destinoActivo('/m/calendario/x', pm), 'calendario');
  // Las hojas del Dashboard: el lugar Dashboard, también una subpantalla suya.
  assert.equal(destinoActivo('/m/dashboard', pm), 'dashboard');
  assert.equal(destinoActivo('/m/dashboard/x'), 'dashboard');
  assert.equal(destinoActivo('/m/plan', pm), 'plan', 'Plan subió a la barra de pm: se marca a sí mismo');
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
  // Los links profundos de UNA conversación abren SU pantalla, con todos sus canales (17/10/2026): el de un lead
  // que manda MaKo (/chats?lead=N) y el de una clave (?c=, un aviso de Instagram). Hasta ese día ?c= iba a la lista,
  // que no tenía Instagram, y ?lead= al WhatsApp del lead.
  assert.equal(rutaMovil('/chats?lead=412&ws=3'), '/m/chats/lead%3A412');
  assert.equal(rutaMovil('/chats?c=ig%3A77&ws=3'), '/m/chats/ig%3A77');
  assert.equal(rutaMovil('/whatsapp?lead=9'), '/m/chats/lead%3A9');
  // El de un mensaje de WhatsApp no nombra la clave: va a la lista CON la query (la página lo busca), sin el ws.
  assert.equal(rutaMovil('/chats?linea=mako_ws3&chat=5491100000000%40s.whatsapp.net&ws=3'), '/m/chats?linea=mako_ws3&chat=5491100000000%40s.whatsapp.net');
  // Y vuelven a escritorio con la misma URL (un push sale por acá y vuelve por rutaEscritorio).
  assert.equal(rutaEscritorio('/m/chats/lead%3A412'), '/chats?c=lead%3A412');
  assert.equal(rutaEscritorio('/m/chats/ig%3A77?ws=3'), '/chats?ws=3&c=ig%3A77');
  assert.equal(rutaEscritorio('/m/chats?linea=mako_ws3&chat=1%40s.whatsapp.net'), '/chats?linea=mako_ws3&chat=1%40s.whatsapp.net');
  assert.equal(rutaMovil('/chats?lead=abc'), '/m/chats');
  // «Configuración del negocio» tiene su pantalla desde el 17/10/2026, y el `?tab=` viejo va a donde lo manda la computadora
  // (`rutaDeTabVieja`): `notif` a las Notificaciones DEL NEGOCIO (antes, «Tu cuenta»).
  assert.equal(rutaMovil('/configuraciones?tab=notif'), '/m/configuraciones/notificaciones');
  assert.equal(rutaMovil('/configuraciones?tab=criterio'), '/m/configuraciones');
  assert.equal(rutaMovil('/configuraciones'), '/m/configuraciones');
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
  // La salud de Meta no es el Dashboard: es Integraciones (el ítem de nav.ts la marca), con su pantalla desde el 17/10/2026.
  assert.equal(rutaMovil('/marketing/salud'), '/m/configuraciones/integraciones', 'la salud de Meta no es el Dashboard');
  assert.equal(rutaMovil('/ads-manager'), '/m/ads');
  assert.equal(rutaMovil('/ads-manager/123?ws=4'), '/m/ads');
  // Marketing CoPilot (6/11/2026): «Cambiar mi estrategia» (`?estrategia=1`) viaja y reabre la charla en el teléfono; lo demás de la
  // computadora (`vista`, `decision`) no lo lee el teléfono y no viaja. Y de vuelta a la computadora, igual.
  assert.equal(rutaMovil('/ads-manager?estrategia=1'), '/m/ads?estrategia=1');
  assert.equal(rutaMovil('/ads-manager?vista=campanas&decision=abc&ws=4'), '/m/ads');
  assert.equal(rutaEscritorio('/m/ads?estrategia=1'), '/ads-manager?estrategia=1');
  assert.equal(rutaMovil('/customer-success'), '/m/cs');
  assert.equal(rutaMovil('/customer-success?vista=avance'), '/m/cs');
  for (const p of ['/automations', '/automations?sec=12', '/chatbot?sec=12', '/chat-bot', '/chat-agent', '/setting']) {
    assert.equal(rutaMovil(p), '/m/automations', p);
  }
  assert.equal(rutaMovil('/settings'), null, 'el prefijo va con barra');
  assert.equal(rutaMovil('/video-generator'), '/m/video');
  // El id del plan y el de una landing son LOS MISMOS en los dos lados: abren esa cosa.
  const plan = '3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f';
  assert.equal(rutaMovil(`/video-generator?plan=${plan}&ws=2`), `/m/video/${plan}`);
  assert.equal(rutaMovil('/video-generator?plan=no-es-un-id'), '/m/video');
  assert.equal(rutaMovil('/web-generator'), '/m/landing');
  assert.equal(rutaMovil('/web-generator/42'), '/m/landing/42');
  assert.equal(rutaMovil('/web-generator/crear'), '/m/landing');
  // Las viejas (15/10/2026: la tab se renombró a Web Generator) siguen yendo al teléfono.
  assert.equal(rutaMovil('/landing-generator'), '/m/landing');
  assert.equal(rutaMovil('/landing-generator/42'), '/m/landing/42');
  assert.equal(rutaMovil('/landing-generator/crear'), '/m/landing');
  assert.equal(rutaMovil('/landing-writer/5'), '/m/landing');
});

test('las siete de More (15/10/2026): cada pantalla de escritorio, y sus alias, caen en su sección', () => {
  const casos: [string, string | null][] = [
    ['/calendario', '/m/calendario'], ['/calendario?vista=mes&fecha=2026-10-14&gcal=ok&ws=13', '/m/calendario?vista=mes&fecha=2026-10-14'],
    ['/second-brain', '/m/second-brain'], ['/second-brain?area=voz&vista=persona', '/m/second-brain?area=voz&vista=persona'],
    ['/experimentos', '/m/experimentos'], ['/experimentos?tab=conclusions&ws=3', '/m/experimentos?tab=conclusions'],
    // /analisis redirige en escritorio a la pestaña Análisis con la query entera, y su `tab` no se puede pisar.
    ['/analisis', '/m/experimentos?tab=analisis'],
    ['/analisis?desde=2026-06-01&hasta=2026-08-31&tab=retro', '/m/experimentos?desde=2026-06-01&hasta=2026-08-31&tab=analisis'],
    // El informe congelado que se mandó por WhatsApp no tiene pantalla en el teléfono: se queda en la suya.
    ['/analisis/trimestre', null],
    ['/offer', '/m/offer'], ['/offer?oferta=7&funnel=2', '/m/offer?oferta=7&funnel=2'], ['/offer-analyst', '/m/offer'],
    ['/ads-writer', '/m/copywriting'], ['/ads-writer?tab=analizar', '/m/copywriting?tab=analizar'], ['/content-machine', '/m/copywriting'],
    // Lo demás de la tab Copywriting tiene pantalla en el teléfono desde el 17/10/2026: Stories la suya
    // (tests/m-creacion.test.ts), y las «Coming soon», la de /m/pronto (tests/movil-toda-tab.test.ts).
    ['/youtube-writer', '/m/pronto/youtube-writer'], ['/stories', '/m/stories'], ['/ideas', '/m/pronto/ideas'],
    // Curso y Comunidad ANTES que Clientes (`dentro(p, '/customer-success')` se quedaba con las dos).
    ['/customer-success/curso', '/m/curso'], ['/customer-success/curso?producto=3', '/m/curso?producto=3'],
    ['/customer-success/curso/vista?producto=3', '/m/curso?producto=3'],
    // El Avance se fue del Curso a Clientes: el link viejo, en escritorio, redirige ahí.
    ['/customer-success/curso?vista=avance&producto=3', '/m/cs'],
    ['/customer-success/comunidad', '/m/comunidad'], ['/customer-success/comunidad?post=12&ws=3', '/m/comunidad?post=12'],
    // La tab Clients (17/10/2026): Classroom y las cinco sub-tabs de la comunidad, ANTES que Clients.
    ['/classroom/clients', '/m/cs'], ['/classroom/clients?producto=3&cliente=21', '/m/cs'], ['/classroom', '/m/curso'],
    ['/classroom?producto=3', '/m/curso?producto=3'], ['/classroom/preview?producto=3', '/m/curso?producto=3'],
    ['/classroom/community', '/m/comunidad'], ['/classroom/community?post=12&ws=3', '/m/comunidad?post=12'],
    ['/classroom/calendar', '/m/comunidad'], ['/classroom/members', '/m/comunidad'], ['/classroom/leaderboards', '/m/comunidad'],
    // Members es la vista «Miembros» de Clients desde el 29/10/2026: en el teléfono sigue adentro de la comunidad.
    ['/classroom/clients?vista=miembros&producto=3', '/m/comunidad?producto=3'], ['/classroom/clients?vista=tabla', '/m/cs'],
    ['/classroom/about?producto=4', '/m/comunidad?producto=4'], ['/clientsx', null],
    // El prefijo va con barra.
    ['/calendariox', null], ['/offerx', null], ['/second-brainx', null],
  ];
  for (const [p, esperado] of casos) assert.equal(rutaMovil(p), esperado, p);
  // Un Web Push sale por `rutaMovilOHome` y VUELVE a escritorio (lib/push-payload.ts: linkApp → conWs →
  // rutaEscritorio): lo que no se conserva acá, la computadora también lo pierde.
  for (const p of ['/experimentos?tab=analisis', '/ads-writer?tab=analizar', '/classroom/community?post=12',
    '/calendario?vista=mes&fecha=2026-10-14', '/second-brain?area=voz&vista=persona', '/offer?oferta=7']) {
    assert.equal(rutaEscritorio(rutaMovilOHome(p)), p, p);
  }
  assert.equal(rutaEscritorio(rutaMovilOHome('/offer-analyst')), '/offer');
  assert.equal(rutaEscritorio(rutaMovilOHome('/analisis?desde=2026-06-01')), '/experimentos?desde=2026-06-01&tab=analisis');
});

test('un link sin equivalente móvil cae en la home', () => {
  assert.equal(rutaMovilOHome('/metodo'), HOME_MOVIL);
  assert.equal(rutaMovilOHome('/whatsapp'), '/m/chats');
  assert.equal(rutaMovilOHome('/ads-manager'), '/m/ads');
  assert.equal(rutaMovilOHome(undefined), HOME_MOVIL);
});
