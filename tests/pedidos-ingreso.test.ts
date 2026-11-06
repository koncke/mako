// =============================================================================
// «Quieren entrar»: quien pide entrar a MaKo ya no desaparece en silencio (30/10/2026)
// =============================================================================
// Martín: «Me llegó una solicitud de ingreso de Gabriela González por la landing, eso como en agencia debería aparecerme en
// super admin para aceptarla». Medido ese día: quien entraba con Google sin cuenta veía «no autorizada» y no quedaba nada.
// Corre con el código real sobre una base de mentira (tests/_pedidos-ingreso-hijo.ts), incluido el pedido entero de /planes,
// que en producción no se puede probar sin dejar un lead y un mail de verdad.
//
// Probado rompiéndolo (30/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUTA_QUIEREN_ENTRAR, altaDelPedido, detalleDelPedido, pedidoQueVuelve, textoDelCartel } from '../lib/pedidos-ingreso-reglas';
import { inicialDeAlta } from '../app/admin/_polar/datos/alta';
import { faltasDeEspera, filasDeEspera } from '../app/admin/_polar/datos/resumen';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_pedidos-ingreso-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('Google: queda registrado una vez, avisa una vez, y quien insiste suma un intento', () => {
  assert.equal(R.primera, true);
  assert.equal(R.mailsTrasPrimera, 1);
  assert.equal(R.segunda, true);
  assert.equal(R.mailsTrasSegunda, 1, 'el aviso sale una sola vez por correo');
  assert.equal(R.filaAna.intentos, 2);
  assert.equal(R.filaAna.correo_verificado, true);
  assert.equal(R.filaAna.nombre, 'Ana Pérez');
});

test('NO entran: un correo sin confirmar por Google, ni quien ya tiene usuario, ni un suspendido', () => {
  assert.equal(R.sinVerificar, false);
  assert.equal(R.verificadoAusente, false, 'sin el dato de Google, tampoco');
  assert.equal(R.yaTiene, false);
  assert.equal(R.suspendido, false, 'un suspendido no tiene que pedir entrar');
  for (const email of ['falso@ejemplo.com', 'ausente@ejemplo.com', 'ya-tiene@ejemplo.com', 'suspendido@ejemplo.com']) assert.ok(!R.filasGoogle.includes(email), email);
});

test('un mail que no sale no pierde el pedido', () => {
  assert.equal(R.conElMailCaido, true);
  assert.ok(R.filasGoogle.includes('sin-mail@ejemplo.com'));
});

test('la bandeja: lo pendiente; lo descartado no vuelve aunque insista; darle de alta lo saca solo', () => {
  assert.deepEqual([...R.bandeja].sort(), ['ana@ejemplo.com', 'sin-mail@ejemplo.com']);
  assert.deepEqual(R.descartar, { ok: true });
  assert.equal(R.descartarInexistente.ok, false);
  assert.equal(R.insiste, true, 'a la persona se le dice lo mismo');
  assert.equal(R.mailsAlInsistir, 0);
  assert.deepEqual(R.bandejaTrasDescartar, ['ana@ejemplo.com']);
  assert.deepEqual(R.bandejaTrasElAlta, []);
});

test('el pedido de /planes, entero: lead, historial, aviso y bandeja, con el rótulo de correo sin verificar', () => {
  assert.equal(R.pedidoOk.status, 200);
  assert.deepEqual(R.pedidoOk.body, { ok: true, pedido: true });
  assert.deepEqual(R.leadDelPedido, [{ email: 'gabi@ejemplo.com', telefono: '+5491112345678', origen_lead: 'landing' }]);
  assert.equal(R.historial.length, 1);
  assert.equal(R.historial[0].campo, 'Pedido de plan');
  assert.match(R.historial[0].valor, /Quiere MaKo Pro desde la landing «coaches»/);
  assert.deepEqual(R.mailsDelPedido.map((m: { tag: string }) => m.tag), ['planes-pedido'], 'un solo aviso: no dos mails por el mismo pedido');
  assert.equal(R.filaDelPedido.origen, 'planes');
  assert.equal(R.filaDelPedido.correo_verificado, false);
  assert.equal(R.filaDelPedido.detalle, 'Quiere MaKo Pro');
  assert.equal(R.filaDelPedido.whatsapp, '5491112345678');
  assert.equal(R.filaDelPedido.lead_id, 1);
});

test('el formulario rechaza sin crear nada: el bot, sin WhatsApp, y desde otro sitio', () => {
  assert.deepEqual(R.trampa, { status: 200, body: { ok: true } });
  assert.equal(R.sinWhatsapp.status, 400);
  assert.equal(R.otroOrigen.status, 403);
  assert.equal(R.noCreoNada, true);
  assert.equal(R.limpio, null);
});

test('la ruta de la bandeja es sólo del super admin', () => {
  assert.equal(R.getSinAdmin, 403);
  assert.equal(R.postSinAdmin, 403);
  assert.equal(R.getConAdmin.status, 200);
  assert.ok(R.getConAdmin.emails.includes('gabi@ejemplo.com'));
});

test('el cableado: la pantalla de login lo dice, sólo si quedó; la bandeja abre el alta de siempre', () => {
  const cb = fuente('app/api/auth/callback/google/route.ts');
  assert.match(cb, /\(await registrarPedido\(intentoDeGoogle\(ui\)\)\)\) return fail\('pedido-registrado'\);\s*return fail\('no-autorizado'\);/);
  assert.ok(cb.indexOf('await accesoInvitadoPorEmail(email)') < cb.indexOf('registrarPedido('), 'el alumno de un curso no es un pedido');
  const login = fuente('app/login/LoginForm.tsx');
  assert.match(login, /'pedido-registrado': TEXTO_PEDIDO_REGISTRADO,/);
  // La bandeja: desde el 6/11/2026 es el aviso «Quieren entrar» de la portada de Admin (la copia de Polar; antes,
  // app/admin/PedidosDeIngreso.tsx en la grilla vieja). «Dar de alta» abre EL formulario de alta con lo del pedido puesto, y al
  // crear se vuelve a pedir la página (el server ya sacó el pedido de la lista).
  const bandeja = fuente('app/admin/_polar/web/DashboardOverview/EsperaBanners.tsx');
  assert.match(bandeja, /<CreateCustomerModal\s+key=\{alta\.id\}\s+pedido=\{alta\}\s+opciones=\{opciones\}\s+onClose=\{\(\) => setAlta\(null\)\}\s+onCreated=\{\(\) => router\.refresh\(\)\}/, '«Dar de alta» abre el alta de siempre, con el pedido');
  assert.deepEqual(inicialDeAlta({ planes: [{ id: 'completo', nombre: 'Pro', descripcion: '', aviso: null }], planPorDefecto: 'completo' }, { email: 'ana@b.co', nombre: null }),
    { nombre: 'ana', email: 'ana@b.co', adminNombre: '', plan: 'completo' }, 'el alta trae lo del pedido (`altaDelPedido`)');
  // Desde la revisión del Cerebro del 6/11/2026 (punto 38) lo que espera es UNA lista, una fila por espera, y lo que no se pudo
  // leer va en el aviso de lectura de arriba (`faltasDeEspera`): sin nadie no hay fila, y un error de lectura no es «nadie».
  // Probado rompiéndolo (6/11/2026): `faltasDeEspera` sin la lectura de quién quiere entrar → 9/1 (este test); base 10/0.
  const nada = { disputas: { ok: true as const, datos: { porResponder: 0 } }, bajas: { ok: true as const, datos: { bajas: [] } }, agencias: { carteras: [], altas: [] } };
  assert.deepEqual(filasDeEspera({ ...nada, ingreso: { ok: true, datos: { pedidos: [], hayMas: false } } }), [], 'sin nadie no se dibuja');
  assert.deepEqual(faltasDeEspera({ ...nada, ingreso: { ok: false, error: 'caída' } }), ['quién quiere entrar: caída'], 'pero un error sí');
  assert.doesNotMatch(bandeja, /dangerouslySetInnerHTML/, 'los datos los escribe quien pide');
});

test('lo que espera a Martín se ve al entrar a Admin: la portada, el teléfono y el link del aviso', () => {
  assert.equal(textoDelCartel(0, 0), null, 'sin nada, no se dibuja');
  assert.equal(textoDelCartel(1, 0), '1 quiere entrar');
  assert.equal(textoDelCartel(2, 1), '2 quieren entrar · 1 pedido de agencia');
  assert.equal(textoDelCartel(0, 3), '3 pedidos de agencia');
  // Desde el 6/11/2026 (la copia de Polar) lo que espera va arriba de la portada de Admin (Overview, /admin), donde Polar avisa
  // lo que hay que responder: el aviso «Quieren entrar» y los de las agencias y las bajas.
  assert.equal(RUTA_QUIEREN_ENTRAR, '/admin');
  assert.match(fuente('app/admin/_polar/web/DashboardOverview/DashboardPage.tsx'), /<EsperaBanners esperan=\{resumen\.esperan\} avisos=\{resumen\.avisos\} \/>/);
  assert.match(fuente('app/admin/_polar/web/DashboardOverview/EsperaBanners.tsx'), /<QuierenEntrar esperan=\{esperan\} \/>/);
  assert.match(fuente('app/admin/(polar)/page.tsx'), /leerResumenDeAdmin\(\)/, 'la portada lee lo que espera');
  assert.match(fuente('app/m/customers/page.tsx'), /<CustomersM vista=\{vista\} arriba=\{bandeja\} ingresos=\{ingresos\} errores=\{errores\} actividad=\{actividad\} \/>/);
  assert.match(fuente('app/m/customers/CustomersM.tsx'), /padre=\{\{ href: RUTA_MAS, label: 'More' \}\} \/>\s*\{arriba\}/);
  assert.equal(R.linkDelAviso, true, 'el aviso lleva a la portada de Admin, donde está «Quieren entrar» (un `?tab=` viejo redirige a otra sección)');
  assert.deepEqual(R.espera, { quierenEntrar: 1, deAgencias: 2 });
});

test('las reglas de la fila', () => {
  const f = { nombre: 'Ana', correo_verificado: true, detalle: 'Quiere MaKo Pro', whatsapp: '5491112345678', lead_id: 7, intentos: 3 };
  const p = { email: 'a@b.co', nombre: null, origen: 'planes' as const, verificado: false, detalle: null, whatsapp: null, leadId: null };
  const v = pedidoQueVuelve(f, p, '2026-10-30T00:00:00Z');
  assert.equal(v.intentos, 4);
  assert.equal(v.correo_verificado, true, 'lo que Google confirmó no se desconfirma');
  assert.deepEqual([v.nombre, v.detalle, v.whatsapp, v.lead_id], ['Ana', 'Quiere MaKo Pro', '5491112345678', 7], 'no pisa con vacíos');
  assert.match(detalleDelPedido({ origen: 'planes', correo_verificado: false, detalle: 'Quiere MaKo Pro', whatsapp: null, intentos: 1 }), /^Quiere MaKo Pro · Correo sin verificar$/);
  assert.match(detalleDelPedido({ origen: 'google', correo_verificado: true, detalle: null, whatsapp: null, intentos: 2 }), /^Intentó entrar con Google · Correo verificado por Google · 2 intentos$/);
  assert.deepEqual(altaDelPedido({ email: 'ana@b.co', nombre: null }), { nombre: 'ana', adminEmail: 'ana@b.co', adminNombre: '' });
});

// Roturas (30/10/2026; base 10 / 0), cada una restaurada (pasan / fallan):
//   · un correo sin el dato de Google entra (`=== false` en vez de `!== true`)   -> 7 / 3
//   · quien ya tiene usuario es un pedido                                        -> 9 / 1
//   · el aviso sale también en los de /planes (dos mails por pedido)             -> 9 / 1
//   · el aviso sale cada vez que insiste                                         -> 8 / 2
//   · un mail que no sale pierde el pedido                                       -> 9 / 1
//   · el descartado vuelve al insistir                                           -> 8 / 2
//   · la bandeja muestra a quien ya tiene usuario                                -> 8 / 2
//   · lo que Google confirmó se desconfirma                                      -> 9 / 1
//   · la ruta de la bandeja sin la puerta                                        -> 9 / 1
//   · el login promete aunque no haya quedado                                    -> 9 / 1
//   · /planes no entra a la bandeja                                              -> 7 / 3
//   · el aviso lleva a /admin                                                    -> 9 / 1
//   · el cartel no cuenta los pedidos de agencia                                 -> 9 / 1
//   · Customers sin el cartel                                                    -> 9 / 1
