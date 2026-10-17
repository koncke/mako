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
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARRIBA, FAMILIAS, MAKO_NAV, OPS_CENTER, SIN_FILA, SUPERADMIN_MENU, TODOS_LOS_ITEMS, ADMIN_NAV, arribaDe, itemsDe, type NavItem,
} from '../app/_components/nav';
import { puedeVerItem, resolverTab, type VistaNav } from '../lib/nav-visibilidad';
import { FAMILIAS_MAS, gruposMas } from '../lib/movil-rutas';

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

test('las familias: Operate y Sales Machine, en ese orden; Analyze, Content Machine, Customer Success y Admin se fueron', () => {
  assert.deepEqual(FAMILIAS.map((f) => [f.key, f.label]), [['operate', 'Operate'], ['create', 'Sales Machine']]);
  const operate = itemsDe(FAMILIAS[0]).map((i) => i.key);
  for (const k of ['general', 'todo', 'calendario', 'graphics', 'crm', 'chats', 'ads-manager', 'customer-success', 'partners']) {
    assert.ok(operate.includes(k), `«${k}» no está en Operate`);
  }
  const sales = itemsDe(FAMILIAS[1]).map((i) => i.key);
  for (const k of ['offer', 'landing-writer', 'setting', 'video-editor', 'video-generator', 'image-editor', 'ads-writer']) {
    assert.ok(sales.includes(k), `«${k}» no está en Sales Machine`);
  }
  // Dashboard va al lado de General (es cómo viene lo tuyo), no al final.
  assert.deepEqual(FAMILIAS[0].bloques[0].map((i) => i.key), ['general', 'todo', 'calendario', 'graphics']);
});

test('arriba de todo: Ops Center (sólo el super admin) y Second Brain (los demás), cada uno con su criatura', () => {
  assert.deepEqual(ARRIBA.map((i) => [i.key, i.label, i.criatura]), [
    ['admin-operaciones', 'Ops Center', 'Ops Center'],
    ['mako', 'Second Brain', 'Second Brain'],
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
  const RUTAS = ['/admin/copywriting', '/agencia', '/mensajes', '/admin/dev', '/admin/agente', '/admin/estrategia',
    '/admin/cobros', '/admin/operaciones', '/contexto', '/modelos-ia', '/conocimientos', '/admin/offer-playbook'];
  const secciones = FAMILIAS.flatMap((f) => f.bloques.flat()).flatMap((t) => (t.secciones ?? []).map((s) => ({ tab: t, s })));
  for (const ruta of RUTAS) {
    const arriba = ARRIBA.find((i) => i.href === ruta);
    const enTab = secciones.find(({ s }) => s.href === ruta);
    const enMenu = SUPERADMIN_MENU.find((i) => i.href === ruta);
    const item = arriba ?? enTab?.s ?? enMenu;
    assert.ok(item, `${ruta} se quedó sin casa: no está arriba, ni en una tab, ni en el menú de la foto`);
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
  const panel = sinComentarios(leer('app/chats/PanelBandejas.tsx'));
  assert.match(panel, /<Link href="\/email"/, 'Chats no lleva a Email');
  assert.match(panel, /value: 'email', label: 'Email'/, 'el «+» de Canales no ofrece Email');
  const app = sinComentarios(leer('app/chats/ChatsApp.tsx'));
  assert.match(app, /if \(canal === 'whatsapp'\) \{ router\.push\('\/whatsapp'\)/);
  assert.match(app, /if \(canal === 'email'\) \{ router\.push\('\/email'\)/);
  // Email lo veía admin y setter (el guard de su página); el closer no, tampoco desde Chats.
  assert.match(sinComentarios(leer('app/chats/page.tsx')), /const veEmail = rolWs !== 'closer';/);
});

test('nada se rompe: cada destino de la barra y de lo que dejó de ser fila tiene su página', () => {
  const existe = (href: string): boolean => {
    const ruta = href.split(/[?#]/)[0].replace(/^\//, '');
    const base = join(RAIZ, 'app', ...ruta.split('/'));
    // Una ruta dinámica también vale (/clients/community es app/clients/[seccion]/page.tsx).
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
  assert.deepEqual(visibles(CLIENTE), [
    ['Operate', ['General', 'Plan', 'Calendar', 'Dashboard', 'CRM', 'Chats', 'Ads Manager', 'Clients']],
    ['Sales Machine', ['Offer', 'Web Generator', 'Automations', 'Video', 'Image', 'Copywriting']],
  ]);
  // El setter: lo que su rol tiene anotado, en las mismas familias.
  assert.deepEqual(visibles({ adminShell: false, rolWs: 'setter', capa: 'completo' }), [
    ['Operate', ['Plan', 'Dashboard', 'CRM', 'Chats']],
    ['Sales Machine', ['Automations']],
  ]);
});

test('el teléfono sigue a la sidebar: las mismas familias, y Second Brain arriba (menos para el super admin)', () => {
  assert.deepEqual(FAMILIAS_MAS.map((f) => f.label), FAMILIAS.map((f) => f.label));
  const grupos = gruposMas('admin', 'completo');
  assert.equal(grupos[0].titulo, null, 'Second Brain no va arriba, sin título');
  assert.deepEqual(grupos[0].secciones.map((s) => s.id), ['mako']);
  // Y el Ops Center del super admin, arriba con su criatura (no en una caja «Super admin» al final).
  const mas = sinComentarios(leer('app/m/mas/page.tsx'));
  assert.match(mas, /leading=\{criatura\('Ops Center'\)\} titulo="Ops Center"/);
  assert.doesNotMatch(mas, /titulo="Super admin"/);
});
