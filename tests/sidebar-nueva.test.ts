// =============================================================================
// La sidebar nueva (17/10/2026) — docs/diseno-sidebar.md
// =============================================================================
// El pedido de Martín, textual:
//   «"Ops Center" no debería estar en la sección de Admin en la sidebar: debería estar donde "Second Brain", con una
//    criatura tipo ícono, moviéndose como siempre... Lo mismo para los otros workspaces, ya que Second Brain sigue
//    estando en la sección de "analize" y no debería.»
//   «Dashboard debería estar dentro de la sección "Operate", ya que se quedaría sola "analize", y la deprecamos. Y
//    también elimina "Content Machine" y que todo esté dentro de "Sales Machine"... Y "Calendario" debería ser
//    "Calendar": siempre todo en inglés los nombres de las tabs.»
//   «También quiero eliminar todas las tabs de la sidebar de "Admin"... la mayoría ya tienen lugares donde podrían vivir»
//   «eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats"»
// Y lo que pidió el Cerebro encima: lo mismo en TODOS los workspaces y en el teléfono, y que las rutas viejas no se
// rompan.
//
// Probado ROMPIÉNDOLO, de a uno, con la base en 8 pases y 0 fallos (17/10/2026):
//   · la segunda familia rotulada «Analyze»                                → 5 / 3 (familias, workspaces, teléfono)
//   · «Calendario» como label                                              → 6 / 2 (inglés, workspaces)
//   · Strategy sin `adminOnly`                                             → 7 / 1 (un cliente la vería)
//   · /contexto fuera de SUPERADMIN_MENU                                   → 7 / 1 (una herramienta sin casa)
//   · WhatsApp de vuelta como fila de Operate                              → 6 / 2 (Chats es la única, workspaces)
//   · el Sidebar dibujando las familias de ADMIN_FAMILIAS otra vez         → 7 / 1 (el shell del super admin)
//   · FAMILIAS_MAS con «Analyze»                                           → 7 / 1 (el teléfono)
//
// LA SIDEBAR DEL PROTOTIPO (17/10/2026 noche, docs/prototipos/sidebar-nueva-1710.md y coherencia-1710.md, partes 3 y 7;
// Martín: «la sidebar es confusa, copiá otras apps»): lo diario sin rótulo arriba, y Sales · Marketing · Create; «Home»
// sale de la barra y lleva al Dashboard; el buscador Ctrl K; la cara del menú de la foto y del More del teléfono; la
// barra de abajo CRM · Chats · Dashboard · Plan · More. Probado ROMPIÉNDOLO, de a uno, con la base en 11 pases y 0 fallos:
//   · General de vuelta como fila de lo diario                             → 9 / 2 (familias, workspaces)
//   · el alias «home» del buscador llevando a `general`                    → 10 / 1 (el buscador)
//   · el atajo global sin respetar el Ctrl K de la pantalla               → 10 / 1 (el buscador)
//   · la barra de abajo con «General» en el medio                          → 10 / 1 (la barra de abajo)
//   · AvatarM sin dibujar la foto                                          → 10 / 1 (la cara)
//   · masCompleto cruzando las familias por POSICIÓN (una lista de dos)    → 10 / 1 (la barra de abajo: Create se perdía)
//   · una «pronto» de vuelta en Create                                      → 10 / 1 (familias)
//
// «OPS CENTER» EN TODOS LOS NEGOCIOS (18/10/2026; Martín: «En todos los clientes también debe llamarse la tab «Ops Center»
// en lugar de «Second Brain» y tener la criatura de estrella»). Probado ROMPIÉNDOLO, de a uno, con la base en 12 pases y 0 fallos:
//   · la fila del negocio otra vez «Second Brain»                          → 10 / 2 (Ops Center, arriba de todo)
//   · la fila del negocio sin la estrella                                   → 11 / 1
//   · `arribaDe` dándole al super admin las dos                            → 10 / 2 (nadie ve dos, arriba de todo)
//   · el título de la pestaña de /second-brain todavía «Second Brain»       → 11 / 1
//   · la fila del teléfono todavía «Second Brain»                           → 11 / 1
//   · Ctrl K sin el alias «second brain»                                     → 11 / 1
//   · `rutaDeLaTab` sin mirar el `jefe` («Ops Center» caía en /second-brain) → 11 / 1
//
// FEEDBACK DEL 18/10, PT 10 Y EL PLIEGUE DEL PT 4 (20/10/2026). Martín: «La sidebar, si estoy en dark mode se debe adaptar a
// white mode, lo contrario» · «no quiero que cambien las criaturas de color» · «MaKo Partners debería ir dentro del
// desplegable del perfil, no como una tab» · «cuando está plegada el logo de MaKo está desalineado al resto de iconos» ·
// «quiero que Ops center esté dentro de la sección de «Plan, chats y dashboard» y que esa sección también se pueda plegar
// como las otras... Y quiero que por defecto estén todas desplegadas» · «si entro al second brain que la sidebar
// principal de todas las tabs se colapse». Probado ROMPIÉNDOLO, de a uno, con la base en 13 pases y 0 fallos:
//   · lo diario otra vez sin rótulo (no se pliega)                          → 10 / 3 (familias, pt 10, teléfono)
//   · el Ops Center fuera de lo diario                                      → 12 / 1 (pt 10)
//   · Marketing y Create plegadas por defecto                               → 12 / 1
//   · MaKo Partners fuera del menú de la foto                               → 12 / 1
//   · el logo plegado a la izquierda (`space-between` siempre)              → 12 / 1
//   · la barra no se pliega al entrar al Ops Center                         → 12 / 1
//   · la barra clara puesta en :root (pisaba las islas oscuras)             → 12 / 1
//   · la cara de la criatura con --ink                                      → 12 / 1
//   · el modo oscuro redefiniendo la tinta de las criaturas                 → 12 / 1
//
// ADMIN PLIEGA LA BARRA (6/11/2026, punto 37 de docs/admin/revision-cerebro-6-11.md; la copia de Polar trae la suya). Probado
// ROMPIÉNDOLO, de a uno, con la base en 13 pases y 0 fallos:
//   · `pliegaLaBarra` sin el caso de Admin                                  → 12 / 1 («/admin no pliega»)
//   · con `startsWith('/admin')` pelado (atrapa todo /admin)                → 12 / 1 («/admin/dev pliega»)
//   · sin el `/` del final de cada sección                                  → 12 / 1 («/admin/customersx pliega»)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARRIBA, FAMILIAS, MAKO_NAV, OPS_CENTER, SIN_FILA, SUPERADMIN_MENU, TODOS_LOS_ITEMS, ADMIN_NAV, arribaDe, itemsDe, type NavItem,
} from '../app/_components/nav';
import { puedeVerItem, resolverTab, type VistaNav } from '../lib/nav-visibilidad';
import { PRONTO } from '../app/_components/nav';
import { DESTINOS_MOVIL, FAMILIAS_MAS, barraMovil, gruposMas, masCompleto } from '../lib/movil-rutas';
import { ALIAS, buscarDestinos, type Destino } from '../lib/buscador-nav';
import { USER_NAV } from '../app/_components/nav';
import { pliegaLaBarra } from '../app/_components/Sidebar';
import { tituloDe } from '../lib/titulo-tab';
import { cabeceraPorRuta } from '../app/m/_ui/cabecera';
import { rutaDeLaTab } from '../lib/centro-chats';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SUPER: VistaNav = { adminShell: true, rolWs: '', capa: 'superadmin' };
const CLIENTE: VistaNav = { adminShell: false, rolWs: 'admin', capa: 'completo' };

/** Lo que la barra DIBUJA: las tabs (ya resueltas) y sus secciones, los desplegables y lo de arriba. */
const dibujadas = (): NavItem[] => [
  ...ARRIBA,
  ...FAMILIAS.flatMap((f) => [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)]),
];

test('las familias del prototipo: lo diario, y Sales · Marketing · Create; Home y las «pronto» salieron', () => {
  // Lo diario lleva rótulo y se pliega desde el 20/10/2026 (el test del pt 10, abajo).
  assert.deepEqual(FAMILIAS.map((f) => [f.key, f.label, !!f.sinRotulo]), [
    ['diario', 'Today', false], ['sales', 'Sales', false], ['marketing', 'Marketing', false], ['create', 'Create', false],
  ]);
  const de = (k: string) => itemsDe(FAMILIAS.find((f) => f.key === k)!).map((i) => i.key);
  assert.deepEqual(FAMILIAS[0].bloques.flat().map((i) => i.key), ['todo', 'bandeja', 'graphics'], 'lo diario: Plan, Chats y Dashboard');
  for (const k of ['crm', 'calendario', 'setting', 'customer-success']) assert.ok(de('sales').includes(k), `«${k}» no está en Sales`);
  for (const k of ['offer', 'landing-writer', 'ads-manager']) assert.ok(de('marketing').includes(k), `«${k}» no está en Marketing`);
  // Copywriting ES el Copywriter desde el 29/10/2026 (key `copywriter`); el Ads Writer sigue por su ruta, en SIN_FILA.
  for (const k of ['video-editor', 'image-editor', 'copywriter']) assert.ok(de('create').includes(k), `«${k}» no está en Create`);
  assert.ok(!de('create').includes('ads-writer') && SIN_FILA.some((i) => i.key === 'ads-writer'), 'Ads Writer');
  // Video Generator dejó de ser fila el 29/10/2026 (Create sin pestañas: es una plantilla de Video). Su key sigue en SIN_FILA.
  assert.ok(!de('create').includes('video-generator') && SIN_FILA.some((i) => i.key === 'video-generator'), 'Video Generator');
  // «Home» (/general) ya no es fila: redirige al Dashboard (Focus). Su key sigue (capas, onboarding) en SIN_FILA, y el
  // Dashboard se marca estando en /general.
  assert.ok(!FAMILIAS.flatMap(itemsDe).some((i) => i.key === 'general'), 'General volvió a ser fila');
  assert.ok(SIN_FILA.some((i) => i.key === 'general'), 'sin el ítem general, el título y el teléfono lo pierden');
  const dash = FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'graphics')!;
  assert.equal(dash.match('/general'), true, 'en /general la barra no marca Dashboard');
  // Las «pronto» viven en el menú de la foto › Platform › Coming soon, no en la lista (prototipo: «lo poco usado detrás de More»).
  assert.ok(PRONTO.length > 0 && PRONTO.every((i) => i.adminOnly), 'una «pronto» la vería un cliente');
  assert.ok(!FAMILIAS.flatMap(itemsDe).some((i) => PRONTO.includes(i)), 'una «pronto» volvió a una familia');
  assert.ok(PRONTO.every((i) => TODOS_LOS_ITEMS.includes(i)), 'una «pronto» perdió su título de pestaña');
});

test('Ops Center en todos los negocios: la fila de /second-brain se llama así y lleva la estrella, y nadie ve dos', () => {
  const ops = MAKO_NAV.find((i) => i.key === 'mako')!;
  assert.deepEqual([ops.label, ops.href, ops.criatura, ops.estrella], ['Ops Center', '/second-brain', 'Ops Center', true]);
  assert.equal(OPS_CENTER.estrella, true, 'el del super admin perdió la estrella');
  // La barra dibuja la estrella por el ítem, no por la key del Ops Center del super admin.
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /<Criatura nombre=\{item\.criatura\} estrella=\{!!item\.estrella\}/);
  // Uno solo arriba, para cada quien: el super admin, el suyo; un negocio (admin, setter, closer), el de su negocio.
  const vistas: VistaNav[] = [SUPER, CLIENTE, { adminShell: false, rolWs: 'setter', capa: 'completo' }, { adminShell: false, rolWs: 'closer', capa: 'completo' }];
  for (const v of vistas) {
    const arriba = arribaDe(v.adminShell, (it) => puedeVerItem(it, v));
    assert.equal(arriba.filter((i) => i.label === 'Ops Center').length, 1, `${v.rolWs || 'super admin'}: no ve UN Ops Center`);
  }
  // El título de la pestaña y la pantalla del teléfono (su cabecera y el «volver» de sus subpantallas).
  assert.equal(tituloDe('/second-brain'), 'MaKo - Ops Center');
  assert.equal(cabeceraPorRuta('/m/second-brain').titulo, 'Ops Center');
  assert.equal(cabeceraPorRuta('/m/second-brain/mapa').padre?.label, 'Ops Center');
  // More: la fila de arriba del negocio era Ops Center con la estrella; desde el 20/10/2026 el Ops Center es el lugar del
  // medio de la barra (pedido bb885d5f) y More no lo repite, ni al negocio ni al super admin.
  const arribaMas = (adminShell: boolean) => masCompleto('admin', 'completo', adminShell).find((g) => g.id === 'arriba')?.filas.map((f) => f.label) ?? [];
  assert.deepEqual(arribaMas(false), []);
  assert.deepEqual(arribaMas(true), []);
  assert.equal(barraMovil('admin', 'completo')[2].label, 'Ops Center');
  assert.match(sinComentarios(leer('app/m/mas/page.tsx')), /criatura\(f\.label, !!MAKO_NAV\.find\(\(it\) => it\.key === f\.key\)\?\.estrella\)/);
  // Ctrl K: «second brain» y «cerebro» llevan ahí; al super admin, a su Ops Center.
  const negocio: Destino[] = [{ item: ops, donde: null }];
  const superAdmin: Destino[] = [{ item: OPS_CENTER, donde: null }];
  for (const q of ['second brain', 'cerebro']) {
    assert.equal(buscarDestinos(q, negocio)[0]?.item.key, 'mako', `«${q}» no lleva al Ops Center del negocio`);
    assert.equal(buscarDestinos(q, superAdmin)[0]?.item.key, 'admin-operaciones', `«${q}» no lleva al Ops Center del super admin`);
  }
  // El Ops Center del super admin sigue encontrando la tab de cada jefe: «Ops Center» no se confunde con /second-brain.
  const tabs = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV];
  assert.equal(rutaDeLaTab('Ops Center', tabs), '/admin/operaciones');
  assert.equal(rutaDeLaTab('Second Brain', tabs), '/second-brain');
});

test('pt 10 y 4 (20/10): el Ops Center adentro de lo diario, todo desplegado, Partners en la foto, la barra sigue el modo', () => {
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  // El Ops Center (arribaDe) va PRIMERO adentro de lo diario, que tiene rótulo y se pliega; no queda un bloque suelto arriba.
  assert.equal(FAMILIAS.find((f) => f.key === 'diario')?.sinRotulo, undefined, 'lo diario volvió a ir sin rótulo (no se pliega)');
  assert.match(sb, /if \(f\.key === 'diario' && arriba\.length\) \{\s*const \[primero = \[\], \.\.\.resto\] = bloques;\s*return \{ \.\.\.f, bloques: \[\[\.\.\.arriba, \.\.\.primero\], \.\.\.resto\], grupos \};/);
  assert.doesNotMatch(sb, /arriba\.map\(\(it\) => \(\s*<NavLink/, 'volvió el bloque suelto de arriba');
  // Todas desplegadas por defecto, con la clave nueva (la vieja traía Marketing y Create plegadas guardadas).
  assert.match(sb, /const PLEGADAS = 'mk-nav-plegadas-v2';/);
  assert.match(sb, /export const PLEGADAS_DE_ENTRADA: readonly string\[\] = \[\];/);
  // MaKo Partners: en el menú de la foto; en el teléfono, su fila sale del menú. Desde el 24/10/2026 la ve el ADMIN de
  // cualquier negocio (Martín: «la tab de MaKo Partners para clientes»), no sólo el de una agencia; closer y setter, no.
  const partners = USER_NAV.find((i) => i.key === 'partners');
  assert.ok(partners, 'MaKo Partners no está en el menú de la foto');
  assert.ok(!FAMILIAS.flatMap(itemsDe).some((i) => i.key === 'partners'), 'MaKo Partners volvió a ser una tab');
  assert.equal(puedeVerItem(partners!, { adminShell: false, rolWs: 'admin', capa: 'agencia' }), true);
  assert.equal(puedeVerItem(partners!, CLIENTE), true, 'el admin de un negocio que no es agencia no llega a su tablero de referidos');
  for (const rolWs of ['closer', 'setter']) {
    assert.equal(puedeVerItem(partners!, { adminShell: false, rolWs, capa: 'completo' }), false, `el ${rolWs} la vería`);
  }
  // En el teléfono NO (4/11/2026, Martín: el teléfono no vende en ningún teléfono; lib/tienda.ts → TABS_QUE_VENDEN). Hasta ese
  // día su fila salía del menú de la foto. El resto del menú sigue ahí.
  for (const capa of ['agencia', 'completo']) {
    const menuMas = masCompleto('admin', capa, false).find((g) => g.id === 'menu')?.filas.map((f) => f.label) ?? [];
    assert.ok(!menuMas.includes('MaKo Partners'), `en el teléfono (${capa}) volvió MaKo Partners`);
    assert.ok(menuMas.includes('Report a problem'), `en el teléfono (${capa}) se vació el menú de la foto`);
  }
  // Plegada, la marca centrada como los íconos.
  assert.match(sb, /justifyContent: open \? 'space-between' : 'center', flex: 'none' \}\}>\s*<Marca open=\{open\} \/>/);
  // Al entrar al Ops Center (el de cada negocio y el del super admin) la barra se pliega; la flecha la abre ahí.
  assert.equal(pliegaLaBarra('/second-brain'), true);
  assert.equal(pliegaLaBarra('/second-brain/mapa'), true);
  assert.equal(pliegaLaBarra('/admin/operaciones'), true);
  assert.equal(pliegaLaBarra('/crm'), false);
  assert.equal(pliegaLaBarra('/second-brainx'), false);
  // Y Admin (6/11/2026, punto 37 de docs/admin/revision-cerebro-6-11.md): la copia de Polar trae su propia barra. /admin exacto y
  // sus secciones (SECCIONES_ADMIN), con sus subpáginas; nunca las otras tabs del super admin que cuelgan de /admin.
  for (const r of ['/admin', '/admin/customers', '/admin/customers/12/usage', '/admin/analytics/events', '/admin/sales/subscriptions/c-4', '/admin/products/checkout-links/7', '/admin/finance/income', '/admin/settings/payments']) {
    assert.equal(pliegaLaBarra(r), true, `${r} no pliega la barra de MaKo`);
  }
  for (const r of ['/admin/dev', '/admin/dev/crm', '/admin/ui', '/admin/approvals', '/admin/cobros', '/admin/customersx', '/adminx', '/admin/salesforce']) {
    assert.equal(pliegaLaBarra(r), false, `${r} pliega la barra y no es la copia de Polar`);
  }
  // Desde el 21/10/2026 la misma regla pliega también en una ventana chica (tests/ventana-chica.test.ts), y desde el 22/10
  // con el panel de MaKo abierto (tests/sidebar-mako-abierto.test.ts).
  assert.match(sb, /const plegadaAca = enOpsCenter \|\| angosta \|\| makoAbierto;/);
  assert.match(sb, /const fija = barraFija\(fijaGuardada, plegadaAca, abiertaAca\);/);
  // La barra sigue el modo: blanca en claro, ACOTADA a la barra (en :root las --sidebar* siguen oscuras: son la «isla
  // oscura» de 43 archivos), y su hover con token. La palabra MaKo con la tinta de la barra. Desde el 6/11/2026 la regla no
  // alcanza al sidebar de Admin (el de Polar, `.pl`; era Studio Admin, `.sa`), que marca sus piezas con el mismo `data-sidebar`.
  const ui = leer('app/_ui/ui.css');
  assert.match(ui, /:root:not\(\[data-tema="oscuro"\]\):not\(\[data-tema-candidato\]\) \[data-sidebar\]:not\(\.pl \[data-sidebar\]\) \{\s*--sidebar: #FFFFFF;/);
  assert.match(ui, /\.mk-navrow:hover \{ background: var\(--sidebar-hover, /);
  assert.match(leer('app/globals.css'), /:root \{[\s\S]*?--sidebar: #121212;/);
  assert.match(sb, /<MakoWord base="var\(--on-sidebar\)">MaKo<\/MakoWord>/);
  // Las criaturas no cambian de color: la cara va con tokens que ningún tema redefine.
  const muneco = sinComentarios(leer('app/admin/operaciones/Muneco.tsx'));
  assert.match(muneco, /const TINTA = 'var\(--criatura-tinta\)';/);
  assert.doesNotMatch(muneco, /var\(--ink\)|var\(--bad\)/, 'la cara de la criatura volvió a un color que cambia con el modo');
  assert.equal(leer('app/globals.css').split('--criatura-tinta:').length - 1, 1, 'un tema redefine la tinta de las criaturas');
});

test('el buscador (Ctrl K): «home» y «general» llevan al Dashboard, y encuentra lo de adentro de una tab', () => {
  for (const k of ['home', 'general', 'focus']) assert.equal(ALIAS[k], 'graphics', `«${k}» no lleva al Dashboard`);
  const destinos: Destino[] = FAMILIAS.flatMap((f) => f.bloques.flat()).flatMap((t) => [
    { item: t, donde: null },
    ...(t.secciones ?? []).map((s) => ({ item: s, donde: t.label })),
  ]);
  assert.equal(buscarDestinos('home', destinos)[0]?.item.key, 'graphics');
  assert.equal(buscarDestinos('Customer Success', destinos)[0]?.item.key, 'customer-success');
  assert.equal(buscarDestinos('', destinos).length, 0);
  // Sin modal (regla de Martín): la lista cuelga del campo, en un portal; y la pantalla con su propio Ctrl K gana.
  const b = sinComentarios(leer('app/_components/BuscadorNav.tsx'));
  assert.doesNotMatch(b, /<Modal\b/);
  assert.match(b, /if \(e\.defaultPrevented\) return;/);
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /<BuscadorNav /);
});

test('la cara: la foto real en el botón de la barra y en el More del teléfono (el menú de la foto ya no la repite)', () => {
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  // Desde el 25/10/2026 (Martín: «no me gusta que... el desplegable del perfil, antes de "settings" tenga nuevamente mi foto de
  // perfil, que esté solo settings»): la foto y el nombre están en el botón que abre el menú, no adentro (tests/menu-perfil-tuerca).
  assert.doesNotMatch(sb, /usuarioDe\(/, 'el menú de la foto volvió a repetir la cara');
  assert.match(sb, /<Identidad open=\{open\} nombre=\{nombreVisible\} avatar=\{avatarVisible\}/, 'el botón de la barra no lleva la foto');
  const piezas = sinComentarios(leer('app/m/_ui/Piezas.tsx'));
  assert.match(piezas, /if \(foto\?\.trim\(\)\) return <img className=\{`m-avatar m-avatar--\$\{tam\} m-avatar--foto`\}/, 'AvatarM no dibuja la foto');
  const mas = sinComentarios(leer('app/m/mas/page.tsx'));
  assert.match(mas, /foto=\{tuyo\?\.avatarUrl\}/, 'More no le pasa la foto');
  assert.match(mas, /const tuyo = perfil && !perfil\.vista\.deOtro/, 'More mostraría la foto de otro');
  assert.match(mas, /href=\{RUTA_CUENTA\}/, 'la cara no abre My Profile');
});

test('la barra de abajo del teléfono: CRM · Chats · Ops Center · Dashboard · More, y More con las familias de la sidebar', () => {
  // El del medio es el Ops Center desde el 20/10/2026 (pedido bb885d5f); hasta ese día, el Dashboard. Desde el 04/11/2026
  // el Dashboard vuelve, en el lugar de Plan (Martín: «en lugar de "Plan" en la bottom bar, pon "Dashboard"»).
  assert.deepEqual(DESTINOS_MOVIL.map((d) => d.label), ['CRM', 'Chats', 'Ops Center', 'Dashboard', 'More']);
  assert.deepEqual(barraMovil('admin', 'completo').map((b) => b.label), ['CRM', 'Chats', 'Ops Center', 'Dashboard', 'More']);
  // More: las familias por su KEY (con cuatro, cruzarlas por posición perdía Create).
  const mas = masCompleto('admin', 'completo', false);
  assert.deepEqual(mas.filter((g) => FAMILIAS_MAS.some((f) => f.id === g.id)).map((g) => g.titulo), ['Today', 'Sales', 'Marketing', 'Create']);
  // UN solo Dashboard (24/10/2026, Martín: «En mobile aparecen 2 dashboards»): quien ve General lo abre unido en /m/hoy, con
  // las hojas en su segmentado; la fila de las hojas sobra. El closer tiene como Dashboard SU hoja, como en la computadora.
  const diario = (rol: 'admin' | 'closer') => masCompleto(rol, 'completo', false).find((g) => g.id === 'diario')!.filas
    .filter((f) => f.tipo !== 'grupo' && (f.href === '/m/hoy' || f.href === '/m/dashboard')).map((f) => [f.label, f.tipo === 'grupo' ? null : f.href]);
  // 04/11/2026: ese Dashboard está en la BARRA (el unido para quien ve General, su hoja para el closer), y More no suma
  // ninguno: con uno en la barra y otro en More volvían los dos «Dashboard». Plan es la fila de lo diario.
  assert.deepEqual(diario('admin'), []);
  assert.deepEqual(diario('closer'), []);
  assert.equal(barraMovil('admin', 'completo').find((b) => b.id === 'dashboard')?.href, '/m/hoy');
  assert.equal(barraMovil('closer', 'completo').find((b) => b.id === 'dashboard')?.href, '/m/dashboard');
  for (const rol of ['admin', 'closer'] as const) {
    const filas = masCompleto(rol, 'completo', false).find((g) => g.id === 'diario')!.filas;
    assert.ok(filas.some((f) => f.label === 'Plan' && f.tipo === 'pantalla' && f.href === '/m/plan'), `${rol}: Plan sigue a un toque, en More`);
  }
  // «Agency Dashboard» (25/10/2026) es otra tab, la de las agencias: no es el segundo Dashboard que cuida esto.
  assert.equal(mas.flatMap((g) => g.filas).filter((f) => /dashboard/i.test(f.label) && f.label !== 'Agency Dashboard').length, 0, 'More repite el Dashboard de la barra');
  const create = mas.find((g) => g.id === 'create')!;
  // AI Avatar, de Pro desde el 29/10/2026: una fila más de Create, como en la sidebar.
  assert.deepEqual(create.filas.map((f) => f.label), ['Video', 'Image', 'Copywriting', 'AI Avatar']);
});

test('arriba de todo: Ops Center (sólo el super admin) y Second Brain (los demás), cada uno con su criatura', () => {
  // Desde el 18/10/2026 la de cada negocio también se llama Ops Center y lleva la estrella (el test de abajo).
  assert.deepEqual(ARRIBA.map((i) => [i.key, i.label, i.criatura]), [
    ['admin-operaciones', 'Ops Center', 'Ops Center'],
    ['mako', 'Ops Center', 'Ops Center'],
  ]);
  assert.equal(OPS_CENTER.adminOnly, true);
  assert.equal(puedeVerItem(OPS_CENTER, CLIENTE), false, 'el admin de un cliente vería el Ops Center');
  assert.equal(puedeVerItem(MAKO_NAV[0], CLIENTE), true, 'el admin de un cliente no vería Second Brain');
  assert.equal(puedeVerItem(MAKO_NAV[0], { adminShell: false, rolWs: 'setter', capa: 'completo' }), true, 'el setter tampoco');
  // El super admin NO ve Second Brain (17/10/2026, Martín: «el second brain vive dentro de ops center y es el grafo, no otro
  // chat»): sólo el Ops Center. Los demás, su Second Brain. Probado rompiéndolo: `arribaDe` devolviendo ARRIBA entero → 1 fallo.
  assert.deepEqual(arribaDe(true, (it) => puedeVerItem(it, SUPER)).map((i) => i.key), ['admin-operaciones'], 'el super admin: sólo Ops Center');
  assert.deepEqual(arribaDe(false, (it) => puedeVerItem(it, CLIENTE)).map((i) => i.key), ['mako'], 'el cliente: Second Brain y no Ops Center');
  // Una sola entrada de Second Brain: ninguna familia vuelve a tener otra fila a /second-brain.
  assert.ok(!FAMILIAS.flatMap(itemsDe).some((i) => i.href.startsWith('/second-brain')), 'volvió una fila de Second Brain a una familia');
  // El Sidebar dibuja la criatura (el muñeco del Ops Center) para los ítems con `criatura`, y su movimiento vive en
  // ui.css, que carga en todas las pantallas (centro.css sólo en el Centro).
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(sb, /if \(item\.criatura\) return <Criatura nombre=\{item\.criatura\}/);
  assert.match(sinComentarios(leer('app/_components/Criatura.tsx')), /<Muneco titulo=\{nombre\} animo="trabajando"/);
  assert.match(leer('app/_ui/ui.css'), /\.mk-criatura \.mun-cuerpo \{ animation:/);
});

test('los nombres de las tabs, en inglés: ningún rótulo dibujado en castellano', () => {
  const castellano = /[áéíóúñ¿¡]|\b(de|del|los|las|con|y|el|la)\b|^(Calendario|Clientes|Curso|Comunidad|Cobros|Contexto|Modelos|Conocimientos)/i;
  const rotulos = dibujadas().flatMap((t) => [t.label, ...(t.secciones ?? []).flatMap((s) => [s.label, s.seccion ?? s.label])]);
  for (const r of [...rotulos, ...FAMILIAS.map((f) => f.label), ...SUPERADMIN_MENU.map((i) => i.label)]) {
    assert.doesNotMatch(r, castellano, `«${r}» no está en inglés`);
  }
  assert.equal(TODOS_LOS_ITEMS.find((i) => i.key === 'calendario')?.label, 'Calendar');
});

test('cada herramienta de la ex familia Admin tiene casa, la ve el super admin y no un cliente', () => {
  // /agencia salió de la lista el 24/10/2026: ya no es una sección (Martín: «En SuperAdmin no deben haber 3 tabs allí»). Su
  // casa es Chats, donde el número de MaKo es una línea del chip «Canales» (docs/diseno-chats.md §8.5); la ruta sigue para
  // sus links y la barra marca Chats estando ahí (abajo).
  // /admin/dev, /contexto y /modelos-ia se fueron el 25/10/2026 (redirigen, next.config.ts). /admin/cobros y /admin/agente
  // salieron el mismo día: son las pestañas Billing y Agents de Customers (tests/customers.test.ts). /admin/copywriting y
  // /admin/guiones (el método de redacción y las bibliotecas de guiones) se fueron el 29/10/2026 (Martín: «Elimina esto
  // […], no quiero ninguna mención en todo MaKo»): redirigen al Copywriter y NO tienen casa a propósito (abajo).
  // /mensajes (MaKo Messages) salió el 26/10/2026 (Martín: «elimina eso»): redirige a Automations (tests/mensajes-mako-retirado).
  const RUTAS = ['/admin/estrategia', '/admin/operaciones', '/conocimientos', '/admin/offer-playbook', '/admin/approvals'];
  for (const ruta of ['/admin/copywriting', '/admin/guiones']) {
    assert.ok(![...ADMIN_NAV, ...SUPERADMIN_MENU, ...ARRIBA, ...FAMILIAS.flatMap(itemsDe)].some((i) => i.href === ruta), `${ruta} volvió a tener un ítem`);
    assert.match(sinComentarios(leer(`app${ruta}/page.tsx`)), /redirect\(await rutaConWs\('\/copywriter'\)\);/, `${ruta} no redirige al Copywriter`);
  }
  const chats = FAMILIAS.flatMap((f) => f.bloques.flat()).find((t) => t.key === 'bandeja');
  assert.equal(chats?.match('/agencia'), true, '/agencia: estando ahí, la barra no marca Chats');
  assert.ok(!(chats?.secciones ?? []).some((s) => s.href === '/agencia'), '«MaKo WhatsApp» volvió a ser una sección de Chats');
  const secciones = FAMILIAS.flatMap((f) => f.bloques.flat()).flatMap((t) => (t.secciones ?? []).map((s) => ({ tab: t, s })));
  // Strategy y Offer Playbook dejaron de ser secciones de Offer el 29/10/2026 (Martín: «sin otras tabs, incluso en
  // SuperAdmin»): su casa es el pie de la lista de ofertas, que la pantalla dibuja sólo para el super admin.
  const offer = FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'offer')!;
  const pieOffer = sinComentarios(leer('app/offer/OfferApp.tsx')).match(/pieLista=\{superAdmin \? \(([\s\S]*?)\) : undefined\}/)?.[1] ?? '';
  for (const ruta of RUTAS) {
    const arriba = ARRIBA.find((i) => i.href === ruta);
    const enTab = secciones.find(({ s }) => s.href === ruta);
    const enMenu = SUPERADMIN_MENU.find((i) => i.href === ruta);
    const enPie = pieOffer.includes(`<Link href="${ruta}">`) ? ADMIN_NAV.find((i) => i.href === ruta) : undefined;
    const item = arriba ?? enTab?.s ?? enMenu ?? enPie;
    assert.ok(item, `${ruta} se quedó sin casa: no está arriba, ni en una tab, ni en el menú de la foto, ni al pie de Offer`);
    if (enPie) assert.equal(offer.match(ruta), true, `${ruta}: estando ahí, la barra no marca Offer`);
    assert.equal(item.adminOnly, true, `${ruta} la vería un cliente`);
    assert.equal(puedeVerItem(item, SUPER), true, `${ruta}: el super admin no la ve`);
    assert.equal(puedeVerItem(item, CLIENTE), false, `${ruta}: el admin de un cliente la ve`);
    assert.ok(ADMIN_NAV.includes(item), `${ruta}: sin el ítem en ADMIN_NAV pierde el título de la pestaña`);
    // La tab que la recibe se ve para el super admin con la sección adentro, y para un cliente sin ella.
    if (enTab) {
      assert.equal(enTab.tab.match(ruta), true, `${ruta}: estando ahí, la barra no marca ${enTab.tab.label}`);
      assert.ok(resolverTab(enTab.tab, SUPER), `${ruta}: el super admin no ve ${enTab.tab.label}`);
    }
  }
  // Y el Sidebar ya no dibuja la familia Admin: el shell del super admin es el mismo que el de un cliente.
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.doesNotMatch(sb, /ADMIN_FAMILIAS\.filter\(/, 'el Sidebar volvió a dibujar las familias de admin');
  assert.match(sb, /SUPERADMIN_MENU\.map\(filaMenu\)/, 'el menú de la foto no ofrece las herramientas del super admin');
});

test('Chats es la única tab de conversaciones; WhatsApp y Email se configuran desde Chats y sus páginas siguen', () => {
  const filas = FAMILIAS.flatMap(itemsDe).map((i) => i.key);
  assert.ok(!filas.includes('whatsapp') && !filas.includes('email'), 'WhatsApp o Email volvieron a ser filas');
  for (const k of ['whatsapp', 'email']) assert.ok(SIN_FILA.some((i) => i.key === k), `sin el ítem ${k}, el teléfono y el título lo pierden`);
  for (const p of ['app/whatsapp/page.tsx', 'app/email/page.tsx']) assert.ok(existsSync(join(RAIZ, p)), `${p} se borró: los links de afuera se rompen`);
  // Desde el 24/10/2026 (docs/diseno-chats.md §8.4) conectar un canal es un modal SOBRE Chats, el de cada medio que usa
  // Automations: ni WhatsApp ni Email llevan a su página («salta el diseño de la tab vieja de WhatsApp... solo debería
  // saltar el QR»; «Faltan los Email aquí»).
  const conectar = sinComentarios(leer('app/chats/ConectarCanal.tsx'));
  assert.match(conectar, /\{ canal: 'email', nombre: 'Email'/, '«Conectar un canal» no ofrece Email');
  assert.match(conectar, /<ConectarMedio medio="whatsapp"/, 'WhatsApp no se conecta con el modal del QR');
  assert.match(conectar, /<ConectarMedio medio="email"/, 'el email no se conecta con el remitente del negocio');
  const app = sinComentarios(leer('app/chats/ChatsApp.tsx'));
  assert.doesNotMatch(app, /router\.push\('\/(whatsapp|email)'\)|href="\/(whatsapp|email)"/, 'Chats vuelve a llevar a otra tab para conectar');
  // Y /whatsapp ya no dibuja la tab vieja: traduce sus links y lleva a Chats.
  const wa = sinComentarios(leer('app/whatsapp/page.tsx'));
  assert.match(wa, /redirect\(await rutaConWs\(query \? `\/chats\?\$\{query\}` : '\/chats'\)\)/, '/whatsapp no lleva a Chats');
  assert.doesNotMatch(wa, /<WhatsAppApp\b/, '/whatsapp volvió a dibujar la tab vieja');
});

test('nada se rompe: cada destino de la barra y de lo que dejó de ser fila tiene su página', () => {
  // Un grupo de rutas (`(polar)`, la carpeta de Admin) no es un segmento de la URL: /admin es app/admin/(polar)/page.tsx.
  const grupos = (dir: string): string[] =>
    existsSync(dir) ? readdirSync(dir).filter((d) => d.startsWith('(') && d.endsWith(')')).map((d) => join(dir, d)) : [];
  const conGrupos = (dir: string, segmentos: string[]): string[] => {
    const aca = [dir, ...grupos(dir)];
    if (!segmentos.length) return aca;
    const [s, ...resto] = segmentos;
    return aca.flatMap((d) => conGrupos(join(d, s), resto));
  };
  const existe = (href: string): boolean => {
    const ruta = href.split(/[?#]/)[0].replace(/^\//, '');
    return conGrupos(join(RAIZ, 'app'), ruta.split('/').filter(Boolean)).some(existeEn);
  };
  const existeEn = (base: string): boolean => {
    // Una ruta dinámica también vale (/classroom/community es app/classroom/[seccion]/page.tsx).
    const padre = join(base, '..');
    const dinamica = existsSync(padre) && readdirSync(padre).some((d) => d.startsWith('[') && d.endsWith(']') && !d.includes('.') &&existsSync(join(padre, d, 'page.tsx')));
    return ['page.tsx', 'route.ts'].some((f) => existsSync(join(base, f))) || existsSync(join(base, '[[...resto]]', 'page.tsx')) || dinamica;
  };
  const todos = [...dibujadas().flatMap((t) => t.secciones ?? [t]), ...SIN_FILA, ...SUPERADMIN_MENU];
  for (const it of todos) assert.ok(existe(it.href), `«${it.label}» apunta a ${it.href}, que no tiene página`);
});

test('todos los workspaces: la misma barra para el super admin, un cliente y un setter, filtrada por la misma regla', () => {
  const visibles = (v: VistaNav) => FAMILIAS.map((f) => [f.label, f.bloques.flat().map((t) => resolverTab(t, v)).filter(Boolean).map((t) => t!.label)]);
  // El admin de un cliente completo: las dos familias, sin nada del super admin.
  // ⚠️ Competitor Spy ENTRÓ acá el 2/11/2026: dejó de ser `adminOnly`. Martín: «todos los usuarios
  //    no pueden ver la nueva tab y eso ya debería estar disponible... no tiene sentido que uno
  //    analice a Alex Hormozi y luego otro vuelva a analizar al mismo».
  assert.deepEqual(visibles(CLIENTE), [
    ['Today', ['Plan', 'Chats', 'Dashboard']],
    ['Sales', ['CRM', 'Calendar', 'Automations', 'Classroom']],
    // ⚠️ 2/11/2026 — OFFER YA NO SE DIBUJA. Martín: «la de offer no la quiero». El ítem SIGUE
    // EXISTIENDO con su key —es contrato con la base— y se oculta con `fueraDeLaBarra`
    // (lib/nav-visibilidad.ts). Ads Manager NO se tocó, por pedido suyo.
    ['Marketing', ['Web Generator', 'Ads Manager', 'Competitor Spy']],
    ['Create', ['Video', 'Image', 'Copywriting', 'AI Avatar']],
  ]);
  // El setter: lo que su rol tiene anotado, en las mismas familias. Calendar desde el 6/11/2026 (sólo sus «Llamadas»).
  assert.deepEqual(visibles({ adminShell: false, rolWs: 'setter', capa: 'completo' }), [
    ['Today', ['Plan', 'Chats', 'Dashboard']],
    ['Sales', ['CRM', 'Calendar', 'Automations']],
    ['Marketing', []],
    ['Create', []],
  ]);
});

test('el teléfono sigue a la sidebar: las mismas familias, y el Ops Center en el medio de la barra', () => {
  assert.deepEqual(FAMILIAS_MAS.map((f) => [f.id, f.label]), FAMILIAS.map((f) => [f.key, f.sinRotulo ? null : f.label]));
  // Second Brain (el Ops Center) iba arriba de More, sin título, hasta el 20/10/2026: ahora es el lugar del medio.
  const grupos = gruposMas('admin', 'completo');
  assert.equal(grupos[0].titulo, 'Today', 'More repite el Ops Center que ya está en la barra');
  assert.ok(!grupos.some((g) => g.secciones.some((s) => s.id === 'mako')));
  // Y el Ops Center del super admin, arriba con su criatura (no en una caja «Super admin» al final).
  const mas = sinComentarios(leer('app/m/mas/page.tsx'));
  assert.match(mas, /leading=\{criatura\('Ops Center', true\)\} titulo="Ops Center"/);
  assert.doesNotMatch(mas, /titulo="Super admin"/);
});
