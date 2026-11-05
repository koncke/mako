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
// El rediseño del 26/10/2026 (Martín: «mejores muchísimo el diseño... investiga a fondo como lo tienen otras apps»; las
// referencias, en docs/customers/referencias/otras-apps). Cada rotura, sola:
//   · un onboarding sin terminar pide atención el mismo día (`DIAS_SIN_EMPEZAR = 0`)            → 1 fallo («Para mirar»)
//   · sin plata se dibuja la tarjeta con «US$ 0»                                              → 1 fallo (el rediseño)
//   · «MaKo Partners» vuelve a la barra del super admin (sin `noEnPlataforma`)                → 1 fallo (la barra)
//   · More del super admin sin Customers (la condición de `masCompleto` sin `!x.superAdmin`)    → 1 fallo (la barra)
//   · /m/customers sin la puerta del super admin                                               → 1 fallo (el teléfono)
//   · `cobradoPorMes` dibuja seis meses en cero sin ningún pago                                  → 1 fallo (la plata)
//   · `pagoPendiente` cuenta una prueba gratis                                                   → 1 fallo (la plata)
//   · «sin uso» sin mirar el onboarding                                                          → 1 fallo (la plata)
//   · «Administrar» no abre la ficha en Accounts (`abrirInicial` ignorado)                       → 1 fallo (el rediseño)
// La revisión adversarial del tren (siete fallas en b26a8ac40; el último test). Cada rotura, sola:
//   · /api/auth/me deja de marcar el uso (sin `marcarUso(sesion)`)                               → 1 fallo
//   · `marcarUso` sin el tope de 12 horas (sin el `.lt('ultimo_login', antes)`)                    → 1 fallo
//   · «Entrar a su cuenta» del teléfono vuelve a ser un Link                                     → 1 fallo
//   · un onboarding que no se pudo leer vuelve a ser «no lo terminó» (`?? false`)                → 1 fallo
//   · `sinUso` con `onboardingHecho` sin el `=== true`                                            → 1 fallo
//   · una de las lecturas vuelve a `.limit(5000)` sin paginar                                    → 1 fallo
//   · la flecha vuelve a comparar el mes en curso (`comparacionCerrada` sin el `slice(0, -1)`)    → 1 fallo
//   · la flecha vuelve pegada al número de arriba                                                → 1 fallo
//   · los clientes de agencia vuelven a quedar «Sin uso» (sin `!deAgencia.has(w.id)`)            → 1 fallo
//   · la ficha vuelve a decir «Nunca» de un cliente que opera su agencia (`haceTxt(f.sinEntrar)`)  → 1 fallo
//   · `ver_clientes_de_mako` sin el chequeo del super admin en la app                            → 1 fallo

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, SUPERADMIN_MENU, USER_NAV, itemsDe } from '../app/_components/nav';
import { masCompleto, rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import { puedeVerItem } from '../lib/nav-visibilidad';
import { DEFS } from '../lib/api-mako/areas/cobros.def';
import {
  cobradoPorMes, comparacionCerrada, enPrueba, enRiesgo, estadoEnUnaPalabra, factura, haceTxt, kpisDeClientes, mrrDe, pagoPendiente, paraMirar,
  segmentosDe, sinUso, ultimaVezTxt, type CobroMrr,
} from '../lib/clientes-plataforma-reglas';

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
  const page = leer('app/admin/page.tsx');
  const puerta = page.search(/const sesionAdmin = await getSesionAdmin\(\);\s*if \(!sesionAdmin\) redirect\('\/inicio'\);/);
  assert.ok(puerta > 0, 'sin la puerta del super admin');
  for (const lectura of ['<ContenidoCobros />', '<ContenidoAgentes />', 'await PestanaClientes(cliente)', 'await PestanaCuentas(sesionAdmin, cuenta)']) {
    assert.ok(page.indexOf(lectura) > puerta, `${lectura} antes de la puerta`);
  }
  assert.ok(page.indexOf('vistaDeClientes(') > puerta, 'los clientes se leen antes de la puerta');
  assert.doesNotMatch(page, /requireRolWs/, 'requireRolWs([]) la abriría al dueño de cada negocio');
  assert.match(leer('proxy.ts'), /const SOLO_ADMIN = \[[^\]]*'\/customers'[^\]]*\];/);
  assert.match(leer('proxy.ts'), /const SOLO_ADMIN = \['\/admin',/, 'Admin (/admin) también en el proxy');
});

// ── 4. Billing y Agents, adentro ─────────────────────────────────────────────────

test('Billing y Client Agents viven en Customers: las rutas viejas redirigen después de su guard y salen del menú', () => {
  for (const [rel, destino] of [['app/admin/cobros/page.tsx', '/admin?tab=billing'], ['app/admin/agente/page.tsx', '/admin?tab=agents'], ['app/customers/page.tsx', 'destinoDeCustomers(await searchParams)']]) {
    const p = leer(rel);
    const guard = p.indexOf("redirect('/inicio')");
    assert.ok(guard > 0 && guard < Math.max(p.indexOf(`redirect('${destino}')`), p.indexOf(`redirect(${destino})`)), `${rel}: el guard, y después a ${destino}`);
  }
  assert.ok(!SUPERADMIN_MENU.some((i) => i.href === '/admin/cobros' || i.href === '/admin/agente'), 'volvieron al menú de la foto');
  const item = FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'admin-customers');
  assert.ok(item, 'Admin no está en la barra');
  assert.equal(item.href, '/admin');
  assert.equal(item.label, 'Admin');
  assert.equal(item.match('/admin/dev'), false, 'las subrutas de /admin son otras tabs');
  assert.equal(item.match('/customers'), true, 'el link viejo sigue marcando Admin');
  assert.equal(item.adminOnly, true);
  assert.equal(puedeVerItem(item, { adminShell: true, rolWs: 'admin', capa: 'superadmin' }), true, 'el super admin no la ve');
  assert.equal(puedeVerItem(item, { adminShell: false, rolWs: 'admin', capa: 'completo' }), false, 'el admin de un cliente la ve');
  assert.equal(item.match('/admin/cobros'), true, 'en Billing por la ruta vieja, la barra no marca Customers');
});

// ── 5. El rediseño (26/10/2026): lo suyo, sin tarjetas en cero; la grilla de administración en Accounts ───────────

test('Customers dibuja lo suyo: plata sólo si entró algo, «Para mirar», chips y la ficha en un panel; la grilla vieja vive en Accounts', () => {
  const app = leer('app/customers/CustomersApp.tsx');
  assert.doesNotMatch(app, /<AdminView/, 'la grilla vieja volvió a la pestaña Customers');
  // Sin plata, una línea que lo dice y el link a vender: nunca un «US$ 0».
  assert.match(app, /if \(numero <= 0 && !cobrado\) \{\s*return \(\s*<div className="cu-plata-vacia">/);
  assert.match(app, /Todavía no entró plata por MaKo\./);
  assert.match(app, /href="\/admin\?tab=billing">Vender un plan/);
  // La ficha: UNA acción principal, y «Administrar» lleva a Accounts con su ficha abierta.
  assert.equal((app.match(/className="cu-entrar"/g) ?? []).length, 1);
  assert.match(app, /href=\{`\/admin\?tab=accounts&cuenta=\$\{f\.ws\}`\}/);
  const page = leer('app/admin/page.tsx');
  assert.match(page, /<AdminView incrustado trabajo=\{trabajo\}[\s\S]*?abrirInicial=\{cuenta\} \/>/);
  assert.match(page, /tab === 'accounts' \? await PestanaCuentas\(sesionAdmin, cuenta\)/);
  assert.doesNotMatch(page, /searchParams[^\n]*\bws\?/, '?ws= hace mirar a un cliente: la ficha va en ?cuenta=');
  assert.match(leer('app/admin/AdminView.tsx'), /const \[abierto, setAbierto\] = useState<number \| null>\(abrirInicial\);/);
  const pantalla = leer('app/customer-success/pantalla.tsx');
  // Desde el 29/10/2026 el super admin ve acá el directorio de la comunidad («Members»); un link que nombra a un cliente sigue
  // yendo a Customers. La guarda de que no lee leads está en tests/cs-kanban-ficha-ui.test.ts.
  assert.match(pantalla, /if \(\(await getSesionAdmin\(\)\) && !\(await estaImpersonando\(\)\)\) \{\s*if \(leerClienteDeUrl\(\(await searchParams\)\[PARAM_CLIENTE\]\) != null\) redirect\('\/customers'\);\s*return <MiembrosDeLaPlataforma searchParams=\{searchParams\} \/>;\s*\}/);
  assert.doesNotMatch(pantalla, /<AdminView/, '/clients volvió a dibujar la grilla del super admin');
});

test('«Para mirar»: un renglón por cliente con su motivo más grave, en orden', () => {
  const ahora = Date.parse('2026-10-26T12:00:00Z');
  const base = { estado: 'activo', creado: '2026-08-01T00:00:00Z', prueba: false, pagoPendiente: false, motivoRiesgo: null, sinEntrar: 2, onboardingHecho: true } as const;
  const items = paraMirar([
    { ...base, ws: 1, nombre: 'Al día' },
    { ...base, ws: 2, nombre: 'Pausado', estado: 'pausado', motivoRiesgo: 'pausado' },
    { ...base, ws: 3, nombre: 'Sin uso', motivoRiesgo: 'sin-uso', sinEntrar: 20 },
    { ...base, ws: 4, nombre: 'Nuevo', creado: '2026-10-21T00:00:00Z' },
    { ...base, ws: 5, nombre: 'Sin empezar', onboardingHecho: false, creado: '2026-10-10T00:00:00Z' },
    { ...base, ws: 6, nombre: 'Pagos', pagoPendiente: true, motivoRiesgo: 'sin-uso', sinEntrar: null },
  ], ahora);
  assert.deepEqual(items.map((i) => [i.ws, i.motivo]), [[2, 'pausado'], [6, 'pago'], [3, 'sin-uso'], [5, 'sin-empezar'], [4, 'nuevo']]);
  assert.equal(items.find((i) => i.ws === 3)?.texto, 'Nadie de su equipo entra hace 20 días');
  assert.equal(items.find((i) => i.ws === 4)?.texto, 'Se sumó hace 5 días');
  // Recién dado de alta y sin terminar su configuración: está empezando, no pide atención todavía (salvo «nuevo»).
  assert.deepEqual(paraMirar([{ ...base, ws: 7, nombre: 'Hoy', onboardingHecho: false, creado: '2026-10-25T12:00:00Z' }], ahora).map((i) => i.motivo), ['nuevo']);
  assert.deepEqual(estadoEnUnaPalabra({ ...base, motivoRiesgo: 'cobro' }), { rotulo: 'En riesgo', tono: 'bad' });
  assert.deepEqual(estadoEnUnaPalabra({ ...base, onboardingHecho: false }), { rotulo: 'Sin empezar', tono: 'warn' });
  assert.deepEqual(estadoEnUnaPalabra(base), { rotulo: 'Activo', tono: 'good' });
});

test('la actividad y la plata: «sin uso» sólo con el onboarding hecho; un mes sin pagos es 0, seis sin nada es null', () => {
  assert.equal(sinUso({ sinEntrar: 14, sinLeads: null, onboardingHecho: true }), true);
  assert.equal(sinUso({ sinEntrar: 13, sinLeads: null, onboardingHecho: true }), false);
  assert.equal(sinUso({ sinEntrar: null, sinLeads: null, onboardingHecho: true }), true, 'nadie entró nunca');
  assert.equal(sinUso({ sinEntrar: 90, sinLeads: null, onboardingHecho: false }), false, 'todavía está empezando');
  assert.deepEqual([haceTxt(null), haceTxt(0), haceTxt(1), haceTxt(5), haceTxt(65)], ['Nunca', 'Hoy', 'Ayer', 'Hace 5 días', 'Hace 2 meses']);
  const ahora = Date.parse('2026-10-26T12:00:00Z');
  assert.equal(cobradoPorMes([], ahora), null, 'sin pagos no hay curva: una línea en cero se lee como «se cayó todo»');
  assert.equal(cobradoPorMes([{ fecha: '2026-10-02', usd: null }], ahora), null, 'sin su valor en dólares no se suma');
  assert.deepEqual(cobradoPorMes([{ fecha: '2026-10-02', usd: 47 }, { fecha: '2026-08-15', usd: 97 }, { fecha: '2025-01-01', usd: 500 }], ahora),
    [{ mes: '2026-05', usd: 0 }, { mes: '2026-06', usd: 0 }, { mes: '2026-07', usd: 0 }, { mes: '2026-08', usd: 97 }, { mes: '2026-09', usd: 0 }, { mes: '2026-10', usd: 47 }]);
  const prueba = { tipo: 'suscripcion', estado: 'pendiente', suscripcion_estado: 'activa', alta_capa: 'completo', creado_por: 'planes:esencial:prueba' };
  assert.equal(pagoPendiente([prueba]), false, 'una prueba gratis no espera nada');
  assert.equal(pagoPendiente([{ ...prueba, suscripcion_estado: null }]), false, 'una prueba que todavía no se autorizó tampoco: no es un pago de nadie');
  assert.equal(pagoPendiente([{ tipo: 'suscripcion', estado: 'pendiente', suscripcion_estado: 'activa' }]), false, 'autorizada, espera su primer cobro');
  assert.equal(pagoPendiente([{ tipo: 'unico', estado: 'pendiente', suscripcion_estado: null }]), true, 'el primer mes sin pagar');
  assert.equal(pagoPendiente([{ tipo: 'suscripcion', estado: 'fallido', suscripcion_estado: 'activa' }]), true);
});

test('la barra del super admin: Customers sí; MaKo Partners y Agency Dashboard no (los negocios los siguen viendo)', () => {
  const SUPER = { adminShell: true, rolWs: 'admin', capa: 'superadmin' };
  const NEGOCIO = { adminShell: false, rolWs: 'admin', capa: 'agencia' };
  for (const key of ['partners', 'agency']) {
    const it = USER_NAV.find((i) => i.key === key)!;
    assert.equal(puedeVerItem(it, SUPER), false, `${key} sigue en la barra del super admin`);
    assert.equal(puedeVerItem(it, NEGOCIO), true, `${key}: el negocio dejó de verla`);
  }
  const masSa = masCompleto('admin', 'superadmin', true).flatMap((g) => g.filas);
  assert.ok(masSa.some((f) => f.label === 'Admin' && f.tipo === 'pantalla' && f.href === '/m/customers'), 'el teléfono del super admin sin Admin');
  assert.ok(!masSa.some((f) => f.label === 'MaKo Partners' || f.label === 'Agency Dashboard'), 'el teléfono del super admin muestra Partners o Agency');
});

test('el teléfono: /m/customers con la puerta de escritorio y los MISMOS datos; la ida y la vuelta de la ruta', () => {
  assert.equal(rutaMovil('/admin'), '/m/customers');
  assert.equal(rutaEscritorio('/m/customers'), '/admin');
  assert.equal(rutaMovil('/admin/dev'), null, 'una subruta de /admin no es Admin');
  const page = leer('app/m/customers/page.tsx');
  const puerta = page.indexOf('if (!(await getSesionAdmin())) redirect(');
  assert.ok(puerta > 0 && puerta < page.indexOf('vistaDeClientes()'), 'la puerta del super admin, antes de leer');
  const app = leer('app/m/customers/CustomersM.tsx');
  // Sin plata, una línea que dice qué hacer (nunca «US$ 0»). Desde el 5/11/2026, con los pagos a mano: «cárgalos en el CRM».
  assert.match(app, /Todavía no entró ningún pago/);
  assert.doesNotMatch(app, /^import (?!type )[^;]*from ['"]@\/lib\/admin-ingresos['"]/m, 'lib/admin-ingresos.ts es server-only: el teléfono importa sólo su tipo');
  assert.doesNotMatch(app, /^import (?!type )[^;]*from ['"]@\/lib\/clientes-plataforma['"]/m, 'lib/clientes-plataforma.ts es server-only: el teléfono importa sólo su tipo');
});

// ── 6. La API ────────────────────────────────────────────────────────────────────

test('la API: dos lecturas, sólo la plataforma y su admin, sin HTTP; el runner repregunta la plataforma', () => {
  for (const id of ['ver_clientes_de_mako', 'ver_agentes_de_clientes', 'ver_quieren_entrar']) {
    const d = DEFS.find((x) => x.id === id);
    assert.ok(d, `falta ${id}`);
    assert.equal(d.tipo, 'lectura');
    assert.equal(d.gating?.soloPlataforma, true, `${id}: sólo la plataforma`);
    assert.equal(d.gating?.rolMinimo, 'admin', `${id}: sólo el admin`);
    assert.ok(!d.canales.includes('http' as never), `${id}: datos de todos los negocios, no salen por HTTP`);
  }
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  for (const id of ['ver_clientes_de_mako', 'ver_agentes_de_clientes', 'ver_quieren_entrar']) {
    const i = run.indexOf(`${id}: {`);
    assert.ok(i > 0, `falta el runner de ${id}`);
    assert.match(run.slice(i, i + 300), /if \(ctx\.ws !== \(await wsSuperAdmin\(\)\)\) return fallo\(/, `${id}: el runner no repregunta`);
  }
});

// ── 7. La revisión adversarial del tren (26/10/2026, siete fallas en b26a8ac40) ───────────────────────────────────

test('la revisión del tren: el uso de verdad, el teléfono que recarga, el «no pude leer», el paginado, la flecha, las agencias y el super admin', () => {
  // 2. «La última vez que entró» se marca en cada pantalla, sin esperarla, y como mucho una vez cada 12 horas.
  const me = leer('app/api/auth/me/route.ts');
  const marca = me.indexOf('marcarUso(sesion);');
  assert.ok(marca > me.indexOf('if (!sesion) return') && marca < me.indexOf('Promise.all('), '/api/auth/me no marca el uso (o lo marca sin sesión)');
  assert.doesNotMatch(me, /await marcarUso/, 'la respuesta no espera una escritura');
  const uso = leer('lib/ultimo-uso.ts');
  assert.match(uso, /\.update\(\{ ultimo_login: ahora \}\)[\s\S]*?\.eq\('id', Number\(sesion\.sub\)\)[\s\S]*?\.lt\('ultimo_login', antes\)/,
    'sin el tope de 12 horas en la consulta, cada pantalla es una escritura (y `.lt` deja quieto el null de quien nunca entró)');
  // 3. En el teléfono, «Entrar a su cuenta» recarga entera: el layout de /m es el que dibuja «Viendo a X».
  const movil = leer('app/m/customers/CustomersM.tsx');
  assert.doesNotMatch(movil, /ButtonLink[^>]*href=\{`\/inicio\?ws=/, 'un Link deja el cromo del super admin');
  assert.match(movil, /window\.location\.href = `\/inicio\?ws=\$\{c\.ws\}`/);
  // 4. Un onboarding que no se pudo leer es `null`: ni «Sin empezar», ni «Sin uso», ni «Para mirar».
  const servidor = leer('lib/clientes-plataforma.ts');
  assert.match(servidor, /onboardingHecho: hechos \? hechos\.has\(w\.id\) : null,/);
  const ahora = Date.parse('2026-10-26T12:00:00Z');
  const sinLeer = { estado: 'activo', creado: '2026-08-01T00:00:00Z', prueba: false, pagoPendiente: false, motivoRiesgo: null, sinEntrar: 40, onboardingHecho: null } as const;
  assert.deepEqual(estadoEnUnaPalabra(sinLeer), { rotulo: 'Activo', tono: 'good' });
  assert.deepEqual(paraMirar([{ ...sinLeer, ws: 1, nombre: 'X' }], ahora), []);
  assert.equal(sinUso({ sinEntrar: 40, sinLeads: null, onboardingHecho: null }), false);
  assert.match(leer('app/customers/CustomersApp.tsx'), /\['Configuración', f\.onboardingHecho == null \? '—'/);
  // 5. Las lecturas que crecen con el uso, paginadas (PostgREST corta en 1000 sin avisar y sin orden).
  assert.doesNotMatch(servidor, /\.limit\(\d{4,}\)/, 'un `.limit()` grande no pasa el techo de 1000');
  for (const tabla of ['usuarios', 'agente_sesiones', 'pagos', 'partner_codigos']) {
    assert.match(servidor, new RegExp(String.raw`(leerPorPaginas|leerTodo)<[^>]*>\(\s*getSupabaseServer\(\), '${tabla}'`), `${tabla}: sin paginar`);
  }
  // 6. La flecha compara sólo meses cerrados, nombra los dos, y no va pegada al MRR.
  const serie = (usd: number[]) => usd.map((u, i) => ({ mes: `2026-${String(5 + i).padStart(2, '0')}`, usd: u }));
  assert.deepEqual(comparacionCerrada(serie([0, 0, 0, 200, 500, 100])), { mes: '2026-09', contra: '2026-08', pct: 150 }, 'octubre está a medias');
  assert.equal(comparacionCerrada(serie([0, 0, 0, 0, 500, 100])), null, 'contra un mes en cero no hay %');
  assert.equal(comparacionCerrada(null), null);
  assert.equal(comparacionCerrada(serie([300, 100])), null, 'con un solo mes cerrado no hay contra qué');
  const app = leer('app/customers/CustomersApp.tsx');
  assert.match(app, /<p className="cu-plata-num">\{usdTxt\(numero\)\}<\/p>/, 'nada pegado al número de arriba');
  assert.doesNotMatch(app, /% vs \{MES/);
  // 7. A un cliente de agencia lo opera su agencia con su propia sesión: nunca «Sin uso», y su «Última vez» lo dice.
  assert.match(servidor, /const porUso = actividadLeida && !deAgencia\.has\(w\.id\) && sinUso\(actividad\);/);
  assert.equal(ultimaVezTxt({ sinEntrar: null, segmentos: ['de-agencia'] }), 'Lo opera su agencia');
  assert.equal(ultimaVezTxt({ sinEntrar: 3, segmentos: ['de-agencia'] }), 'Hace 3 días', 'si su equipo entra, se dice');
  assert.equal(ultimaVezTxt({ sinEntrar: null, segmentos: ['cliente'] }), 'Nunca');
  assert.doesNotMatch(app + movil, /haceTxt\((f|c)\.sinEntrar\)/, 'la «Última vez» se dice con ultimaVezTxt en las dos pantallas');
  // 8. En la app, el super admin GLOBAL (como la pantalla), no el admin del workspace de la plataforma.
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  for (const id of ['ver_clientes_de_mako', 'ver_agentes_de_clientes', 'ver_quieren_entrar']) {
    const i = run.indexOf(`${id}: {`);
    assert.match(run.slice(i, i + 400), /if \(ctx\.canal === 'app' && !\(await esSuperAdmin\(\)\)\) return fallo\(/, `${id}: sin el super admin`);
  }
});
