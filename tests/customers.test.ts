// =============================================================================
// Customers: los clientes de MaKo para el super admin — segmentos, MRR de verdad, y Billing y Agents adentro (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md puntos 10 y 12): «Para SuperAdmin, creame una vista especial para ver a mis
// clientes... Donde pueda ver a los partners, a agency y al resto de clientes» y «Elimina la tab de /admin/cobros y
// /admin/agente, para eso ya vamos a tener la nueva vista». Lo que fija:
//   1. los segmentos: un cliente de agencia es SÓLO eso; Agency y Partner pueden ir juntos; el resto es «cliente»;
//   2. el MRR sale de los cobros reales: suscripciones activas, sin pruebas, sin lo anulado o devuelto, sin inventar
//      dólares; y «en riesgo» es pausado o con un cobro que falló;
//   3. la puerta: sólo el super admin, antes de leer nada, también en el proxy;
//   4. Billing y Client Agents viven adentro (las rutas viejas redirigen después de su guard) y salen del menú;
//   5. la grilla es la MISMA (AdminView), filtrada por el segmento; /clients ya no la dibuja para el super admin;
//   6. la API: dos lecturas, sólo la plataforma, que el runner repregunta.
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola:
//   · `segmentosDe` deja a un cliente de agencia también como «cliente»                      → 1 fallo (1)
//   · `factura` cuenta la prueba gratis (sin `!esPruebaDePlan(c)`)                           → 2 fallos (2: MRR y en prueba)
//   · `mrrDe` inventa 0 para un cobro sin `monto_usd` (en vez de contarlo «sin dólares»)       → 1 fallo (2)
//   · /customers lee los clientes antes de la puerta                                         → 1 fallo (3)
//   · '/customers' sale de SOLO_ADMIN                                                        → 1 fallo (3)
//   · Billing vuelve al menú de la foto                                                      → 1 fallo (4)
//   · /clients vuelve a dibujar la grilla del super admin                                    → 1 fallo (5)
//   · `ver_clientes_de_mako` sin el `ctx.ws !== (await wsSuperAdmin())`                       → 1 fallo (6)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, SUPERADMIN_MENU, itemsDe } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';
import { DEFS } from '../lib/api-mako/areas/cobros.def';
import { enPrueba, enRiesgo, factura, kpisDeClientes, mrrDe, segmentosDe, type CobroMrr } from '../lib/clientes-plataforma-reglas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

const SUSC: CobroMrr = { tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', monto_usd: 97 };

// ── 1. Los segmentos ─────────────────────────────────────────────────────────────

test('segmentos: el cliente de una agencia es sólo eso; Agency y Partner pueden ir juntos; el resto es cliente', () => {
  const s = { partners: new Set([2, 3]), agencias: new Set([3, 13]), deAgencia: new Map([[15, 13], [2, 13]]) };
  assert.deepEqual(segmentosDe(15, s), ['de-agencia']);
  assert.deepEqual(segmentosDe(2, s), ['de-agencia'], 'un cliente de agencia no es cliente de MaKo aunque tenga link');
  assert.deepEqual(segmentosDe(3, s), ['agency', 'partner']);
  assert.deepEqual(segmentosDe(13, s), ['agency']);
  assert.deepEqual(segmentosDe(1, s), ['cliente']);
});

// ── 2. El MRR y el riesgo ────────────────────────────────────────────────────────

test('MRR: sólo lo que factura cada mes por la pasarela, en dólares, y lo que no trae dólares no se inventa', () => {
  assert.equal(factura(SUSC), true);
  assert.equal(factura({ ...SUSC, tipo: 'unico' }), false, 'un pago único no es recurrente');
  assert.equal(factura({ ...SUSC, suscripcion_estado: 'cancelada' }), false);
  assert.equal(factura({ ...SUSC, suscripcion_estado: null, estado: 'pendiente' }), false, 'un link sin autorizar no factura');
  assert.equal(factura({ ...SUSC, estado: 'reembolsado' }), false);
  assert.equal(factura({ ...SUSC, estado: 'anulado' }), false);
  assert.equal(factura({ ...SUSC, alta_capa: 'agencia', creado_por: 'planes:pro:prueba' }), false, 'una prueba gratis no es MRR');
  assert.equal(factura({ ...SUSC, estado: 'fallido' }), true, 'en mora sigue siendo MRR: la pasarela reintenta');
  assert.deepEqual(mrrDe([SUSC, { ...SUSC, monto_usd: 47 }, { ...SUSC, tipo: 'unico' }]), { usd: 144, sinDolares: 0 });
  assert.deepEqual(mrrDe([SUSC, { ...SUSC, monto_usd: null }]), { usd: 97, sinDolares: 1 });
  assert.deepEqual(mrrDe([]), { usd: 0, sinDolares: 0 }, 'un plan dado a mano no factura nada');
});

test('en prueba y en riesgo', () => {
  const prueba: CobroMrr = { tipo: 'suscripcion', estado: 'pendiente', suscripcion_estado: 'activa', alta_capa: 'completo', creado_por: 'planes:esencial:prueba' };
  assert.equal(enPrueba([prueba]), true);
  assert.equal(enPrueba([prueba, SUSC]), false, 'ya paga: no está en prueba');
  assert.equal(enPrueba([{ ...prueba, suscripcion_estado: 'cancelada' }]), false);
  assert.equal(enRiesgo('pausado', []), true);
  assert.equal(enRiesgo('activo', [{ ...SUSC, estado: 'fallido' }]), true);
  assert.equal(enRiesgo('activo', [SUSC]), false);
});

test('los números: activos y nuevos sin los clientes de agencias; el MRR, de todos (la agencia también le paga a MaKo)', () => {
  const ahora = Date.parse('2026-10-25T12:00:00Z');
  const k = kpisDeClientes([
    { estado: 'activo', creado: '2026-10-20T00:00:00Z', mrrUsd: 97, sinDolares: 0, riesgo: false, segmentos: ['agency'] },
    { estado: 'activo', creado: '2026-07-01T00:00:00Z', mrrUsd: 0, sinDolares: 0, riesgo: false, segmentos: ['cliente'] },
    { estado: 'pausado', creado: '2026-10-01T00:00:00Z', mrrUsd: 0, sinDolares: 1, riesgo: true, segmentos: ['cliente'] },
    { estado: 'activo', creado: '2026-10-22T00:00:00Z', mrrUsd: 47, sinDolares: 0, riesgo: false, segmentos: ['de-agencia'] },
  ], ahora);
  assert.equal(k.mrrUsd, 144);
  assert.equal(k.sinDolares, 1);
  assert.equal(k.pagan, 2);
  assert.equal(k.activos, 2);
  assert.equal(k.nuevos30, 2);
  assert.equal(k.enRiesgo, 1);
  assert.deepEqual(k.porSegmento, { partner: 0, agency: 1, cliente: 2, 'de-agencia': 1 });
});

// ── 3. La puerta ─────────────────────────────────────────────────────────────────

test('sólo el super admin, antes de leer nada; y el proxy también la cierra', () => {
  const page = leer('app/customers/page.tsx');
  const puerta = page.search(/const sesionAdmin = await getSesionAdmin\(\);\s*if \(!sesionAdmin\) redirect\('\/inicio'\);/);
  assert.ok(puerta > 0, 'sin la puerta del super admin');
  for (const lectura of ['<ContenidoCobros />', '<ContenidoAgentes />', 'await PestanaClientes(sesionAdmin)']) {
    assert.ok(page.indexOf(lectura) > puerta, `${lectura} antes de la puerta`);
  }
  assert.ok(page.indexOf('vistaDeClientes(') > puerta, 'los clientes se leen antes de la puerta');
  assert.doesNotMatch(page, /requireRolWs/, 'requireRolWs([]) la abriría al dueño de cada negocio');
  assert.match(leer('proxy.ts'), /const SOLO_ADMIN = \[[^\]]*'\/customers'[^\]]*\];/);
});

// ── 4. Billing y Agents, adentro ─────────────────────────────────────────────────

test('Billing y Client Agents viven en Customers: las rutas viejas redirigen después de su guard y salen del menú', () => {
  for (const [rel, destino] of [['app/admin/cobros/page.tsx', '/customers?tab=billing'], ['app/admin/agente/page.tsx', '/customers?tab=agents']]) {
    const p = leer(rel);
    const guard = p.indexOf("redirect('/inicio')");
    assert.ok(guard > 0 && guard < p.indexOf(`redirect('${destino}')`), `${rel}: el guard, y después a ${destino}`);
  }
  assert.ok(!SUPERADMIN_MENU.some((i) => i.href === '/admin/cobros' || i.href === '/admin/agente'), 'volvieron al menú de la foto');
  const item = FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'admin-customers');
  assert.ok(item, 'Customers no está en la barra');
  assert.equal(item.href, '/customers');
  assert.equal(item.adminOnly, true);
  assert.equal(puedeVerItem(item, { adminShell: true, rolWs: 'admin', capa: 'superadmin' }), true, 'el super admin no la ve');
  assert.equal(puedeVerItem(item, { adminShell: false, rolWs: 'admin', capa: 'completo' }), false, 'el admin de un cliente la ve');
  assert.equal(item.match('/admin/cobros'), true, 'en Billing por la ruta vieja, la barra no marca Customers');
});

// ── 5. La MISMA grilla ───────────────────────────────────────────────────────────

test('la grilla es AdminView filtrada por el segmento, en tabla; /clients ya no la dibuja para el super admin', () => {
  const app = leer('app/customers/CustomersApp.tsx');
  assert.match(app, /<AdminView incrustado trabajo=\{trabajo\} clientes=\{clientes\} user=\{user\} verComputadoras=\{verComputadoras\}\s*segmento=\{segmento\} extra=\{extra\} \/>/);
  assert.match(app, /conDeAgencias: pill === 'de-agencia',/);
  const av = leer('app/admin/AdminView.tsx');
  assert.match(av, /\(segmento\?\.conDeAgencias \|\| !agenciaDe\.has\(w\.id\)\) && \(!segmento\?\.ws \|\| segmento\.ws\.has\(w\.id\)\)/);
  assert.match(av, /const \[tabla, setTabla\] = useState\(extra != null\);/);
  const pantalla = leer('app/customer-success/pantalla.tsx');
  assert.match(pantalla, /if \(\(await getSesionAdmin\(\)\) && !\(await estaImpersonando\(\)\)\) redirect\('\/customers'\);/);
  assert.doesNotMatch(pantalla, /<AdminView/, '/clients volvió a dibujar la grilla del super admin');
});

// ── 6. La API ────────────────────────────────────────────────────────────────────

test('la API: dos lecturas, sólo la plataforma y su admin, sin HTTP; el runner repregunta la plataforma', () => {
  for (const id of ['ver_clientes_de_mako', 'ver_agentes_de_clientes']) {
    const d = DEFS.find((x) => x.id === id);
    assert.ok(d, `falta ${id}`);
    assert.equal(d.tipo, 'lectura');
    assert.equal(d.gating?.soloPlataforma, true, `${id}: sólo la plataforma`);
    assert.equal(d.gating?.rolMinimo, 'admin', `${id}: sólo el admin`);
    assert.ok(!d.canales.includes('http' as never), `${id}: datos de todos los negocios, no salen por HTTP`);
  }
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  for (const id of ['ver_clientes_de_mako', 'ver_agentes_de_clientes']) {
    const i = run.indexOf(`${id}: {`);
    assert.ok(i > 0, `falta el runner de ${id}`);
    assert.match(run.slice(i, i + 300), /if \(ctx\.ws !== \(await wsSuperAdmin\(\)\)\) return fallo\(/, `${id}: el runner no repregunta`);
  }
});
