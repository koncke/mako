// =============================================================================
// Varias claves de Zernio por negocio: cada red queda atada a la clave con que se conectó (29/10/2026)
// =============================================================================
// Martín, 29/10 (audio en SuperAdmin): «Lo que yo habilito en MaKo es la posibilidad de pegar una segunda API key con otra cuenta de
// Gmail del cliente... y ya tendrías cuatro redes... te advierte: "che, esta es la tercera cuenta..."». Da vuelta el «NO a varias
// cuentas» de esa misma mañana (gana lo posterior). Cada clave es OTRA cuenta de Zernio DEL CLIENTE; MaKo no crea cuentas. Lo de
// abajo corre las funciones REALES (tests/_zernio-varias-claves-hijo.ts) con un Zernio de mentira de una cuenta por clave:
//
//   1. CON UNA SOLA CLAVE, TODO COMO ANTES: ni un pedido de más a Zernio.
//   2. LA LISTA JUNTA LAS CLAVES, cada red con su número; una clave extra rota no tumba la lista.
//   3. LO QUE OPERA SOBRE UNA CUENTA (un DM, un post) SALE CON LA CLAVE DUEÑA; una red recién conectada no espera el minuto de caché.
//   4. CONECTAR VA A LA PRIMERA CLAVE CON LUGAR; con todas llenas, el aviso ANTES del login con «agrega otra clave»; «Conectar igual»
//      va a la 1; con las 5 llenas, el aviso dice la salida que queda.
//   5. EL WEBHOOK, EN CADA CLAVE, con la misma URL del negocio.
//   6. LA PANTALLA: [Agregar otra clave] y [Conectar igual] en el aviso, y el formulario de Zernio abre la clave siguiente.
//
// Probado ROMPIÉNDOLO (29/10/2026), una rotura por vez y restaurando: ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/zernio-varias-claves.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_zernio-varias-claves-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('con una sola clave, todo como antes: ni un pedido de más a Zernio', () => {
  assert.deepEqual(R.a, { slot: 1, claves: [1], pedidosAZernio: [] });
});

test('las claves extra se leen (el email no es una clave) y la misma clave dos veces cuenta una', () => {
  assert.deepEqual(R.b.claves, ['1:sk_uno', '2:sk_dos']);
  assert.deepEqual(R.l, [1]);
});

test('la lista de redes junta las dos claves, cada red con su número, y cada perfil rutea al negocio', () => {
  assert.deepEqual(R.b.conexiones, ['acc_fb_1@1', 'acc_ig_1@1', 'acc_li_2@2']);
  assert.deepEqual(R.b.ruteoPerfil, ['prof_sk_dos→3', 'prof_sk_uno→3']);
  // Una extra rota (401) no tumba la lista: se ven las de la 1.
  assert.deepEqual(R.k, ['acc_fb_1@1']);
});

test('un DM y un post sobre una cuenta salen con la clave DUEÑA de esa cuenta', () => {
  assert.equal(R.c.dm2, 'msg_sk_dos');
  assert.equal(R.c.dm1, 'msg_sk_uno');
  assert.equal(R.c.post2, 'post_sk_dos');
  assert.equal(R.c.huellaPost2EsLaDeLa2, true);
  // Lo publicado con la 2 sigue siendo «del negocio»: se puede leer y cancelar.
  assert.deepEqual(R.c.huellasDelNegocio, ['dos', 'uno']);
  assert.deepEqual(R.c.salieron, ['sk_dos POST /inbox/conversations/conv_1/messages', 'sk_uno POST /inbox/conversations/conv_2/messages', 'sk_dos POST /posts']);
});

test('una red recién conectada con la clave 2 sale con la 2 sin esperar la caché, y una cuenta de nadie no hace releer en cada mensaje', () => {
  assert.equal(R.d.recien, 2);
  assert.deepEqual(R.d.nadie, [1, 1]);
  assert.equal(R.d.lecturasSegunda, 0);
});

test('conectar va a la primera clave con lugar, sin aviso', () => {
  assert.deepEqual(R.e.r, { ok: true, tipo: 'url', url: 'https://zernio.com/oauth/twitter?con=sk_dos' });
  assert.deepEqual(R.e.connect, ['sk_dos GET /connect/twitter']);
  // «Conectar otra» de una red que una clave ya tiene es OTRA cuenta: con las dos llenas, el aviso (la de la llamada con Thiago).
  assert.equal(R.h.r.ok, false);
  assert.equal(R.h.r.motivo, 'cobro');
  assert.match(R.h.r.error, /^Otra cuenta de LinkedIn cuenta como una red más\. Esta clave de Zernio ya tiene 2 redes\./);
  assert.deepEqual(R.h.connect, [], 'ningún login antes del aviso');
  // Reconectar ESA cuenta no suma: entra sin aviso, en su clave.
  assert.deepEqual(R.h.reconectar, { ok: true, connect: ['sk_dos GET /connect/linkedin'] });
});

test('con todas las claves llenas, el aviso ANTES del login ofrece otra clave; «Conectar igual» va a la 1', () => {
  assert.equal(R.f.r.ok, false);
  assert.equal(R.f.r.motivo, 'cobro');
  assert.equal(R.f.r.puedeAgregarClave, true);
  assert.match(R.f.r.error, /^Esta clave de Zernio ya tiene 2 redes\. Si conectas otra, Zernio te empieza a cobrar/);
  assert.match(R.f.r.error, /Para no pagar, agrega otra clave de Zernio \(de otra cuenta tuya, con otro Gmail\)\./);
  assert.deepEqual(R.f.connect, [], 'ningún login antes de que la persona elija');
  assert.deepEqual(R.g, ['sk_uno GET /connect/youtube']);
});

test('un 2.º Instagram: con la clave llena avisa ANTES del login y dice por qué; con lugar, entra gratis', () => {
  assert.equal(R.otroInstagram.r.ok, false);
  assert.equal(R.otroInstagram.r.motivo, 'cobro');
  assert.match(R.otroInstagram.r.error, /^Otra cuenta de Instagram cuenta como una red más\. Esta clave de Zernio ya tiene 2 redes\. Si conectas otra, Zernio te empieza a cobrar \(US\$6 por mes/);
  assert.deepEqual(R.otroInstagram.connect, []);
  assert.deepEqual(R.otroInstagramGratis, { ok: true, connect: ['sk_uno GET /connect/instagram'] });
});

test('con las 5 claves llenas, el aviso no ofrece otra: dice la salida que queda', () => {
  assert.equal(R.i.puedeAgregarClave, false);
  assert.match(R.i.error, /Para no pagar, desconecta en zernio\.com una que ya no uses\./);
  assert.doesNotMatch(R.i.error, /agrega otra clave/);
});

test('el webhook queda en CADA clave, con la misma URL del negocio', () => {
  assert.equal(R.j.wh, 'creado');
  assert.deepEqual(R.j.urls, ['sk_dos:/api/webhooks/zernio?w=3', 'sk_uno:/api/webhooks/zernio?w=3']);
});

test('ningún texto de la pantalla promete que sea gratis para siempre', () => {
  // Lo que se ve: el aviso (con y sin lugar), el motivo y las notas de las claves en la tarjeta de Zernio.
  const cat = leer('lib/metodo-catalogo.ts');
  const tarjeta = cat.slice(cat.indexOf("key: 'zernio',"), cat.indexOf("key: 'email',", cat.indexOf("key: 'zernio',")));
  const notas = [...tarjeta.matchAll(/nota: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(notas.length >= 3, `encontré ${notas.length} notas en la tarjeta de Zernio`);
  const motivo = /'cobro': '([^']+)'/.exec(leer('lib/zernio-redes.ts'))?.[1] ?? '';
  assert.ok(motivo.length > 20);
  for (const t of [R.f.r.error, R.i.error, motivo, ...notas]) {
    assert.doesNotMatch(t, /para siempre|siempre gratis|nunca (vas a )?pag|ilimitad/i, t);
  }
});

test('la pantalla: el aviso tiene [Agregar otra clave] y [Conectar igual], y el formulario de Zernio abre la clave siguiente', () => {
  const h = leer('app/_components/ConectarViaZernio.tsx');
  assert.match(h, /otraClave: res\.puedeAgregarClave !== false/);
  assert.match(h, /data-agregar-otra-clave\s+onClick=\{\(\) => \{ setAvisoCobro\(null\); pedirOtraClave\(\); \}\}/);
  assert.match(h, />\s*Agregar otra clave\s*</);
  assert.match(h, /conectar\(a\.red, \{ \.\.\.a\.extra, aceptaCobro: true \}\)/);
  // La marca en la pestaña + el evento; si el modal de Zernio no está abierto, se abre.
  const p = h.slice(h.indexOf('const pedirOtraClave = useCallback('), h.indexOf('const modalTodo = ('));
  assert.match(p, /sessionStorage\.setItem\(EVENTO_OTRA_CLAVE_ZERNIO, '1'\)/);
  assert.match(p, /dispatchEvent\(new Event\(EVENTO_OTRA_CLAVE_ZERNIO\)\)/);
  assert.match(p, /if \(!optsRef\.current\.keyAca\) abrirIntegracion\('zernio'\)/);

  const f = leer('app/integraciones/ServicioConfigForm.tsx');
  assert.match(f, /window\.addEventListener\(EVENTO_OTRA_CLAVE_ZERNIO, abrirSiguiente\)/);
  assert.match(f, /sessionStorage\.getItem\(EVENTO_OTRA_CLAVE_ZERNIO\) === '1'/);
  assert.match(f, /'Agregar otra clave de Zernio \(de otra cuenta tuya\)'/);
  // El email de cada clave no cuenta como otra clave.
  assert.match(f, /c\.configurado && !c\.env\.endsWith\('_ACCOUNT'\)\)\.length \+ 1/);
});

test('el catálogo: claves 2 a 5 opcionales con su número, y ninguna puede ser la de la plataforma', () => {
  const cat = leer('lib/metodo-catalogo.ts');
  assert.match(cat, /\.\.\.CLAVES_ZERNIO\.slice\(1\)\.flatMap\(/);
  assert.match(cat, /label: `API key de Zernio \$\{slotDeClaveZernio\(env\)\}`, secreto: true, opcional: true/);
  const cr = leer('lib/credenciales.ts');
  assert.match(cr, /new Set\(\['ZERNIO_API_KEY', 'ZERNIO_API_KEY_2', 'ZERNIO_API_KEY_3', 'ZERNIO_API_KEY_4', 'ZERNIO_API_KEY_5'\]\)/);
  assert.match(cr, /envCred\(\/\^ZERNIO_API_KEY_\\d\$\/\.test\(clave\) \? 'ZERNIO_API_KEY' : clave\)/);
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Con el código como está: 13 pases y 0 fallos. Rota, una por vez y restaurando:
//   · las extra se buscan con la base (el bug del separador `__`, que tuvo la primera versión) → 6 / 7
//   · un DM o un post salen siempre con la clave 1                                          → 11 / 2
//   · sin la relectura de una red recién conectada                                           → 12 / 1
//   · conectar va siempre a la clave 1                                                       → 12 / 1
//   · el aviso no dice si se puede agregar otra clave                                        → 12 / 1
//   · la lista no junta las claves extra                                                     → 12 / 1
//   · el webhook sólo en la clave 1                                                          → 12 / 1
//   · el aviso sin [Agregar otra clave]                                                      → 12 / 1
//   · el email de la clave cuenta como otra clave                                            → 12 / 1
// Y el 2.º Instagram (29/10/2026, la llamada con la agencia; corrido junto con el barrido y las recurrentes, 29 / 0):
//   · el 2.º Instagram se da por «volver a entrar» (sin aviso)                                → 27 / 2
//   · el aviso no dice que otra cuenta de la misma red cuenta                                 → 27 / 2
