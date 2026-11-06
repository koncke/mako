// =============================================================================
// Varias cuentas de Stripe y de Mercado Pago en UN negocio (22/10/2026)
// =============================================================================
// Martín (feedback del CRM, punto 3): «que pueda tener varias cuentas de Stripe y MP conectadas». Una cuenta es un sufijo
// en el nombre de sus claves (`STRIPE_SECRET_KEY__C2`; la principal, sin sufijo) y cada cobro anota la suya (`cobros.cuenta`,
// mig 0328). Las reglas que fallan calladas:
//
//   1. CADA AVISO CON SU CUENTA: el `acct` (o el `user_id`) dice qué cuenta del negocio lo manda, y un aviso de una cuenta
//      NUNCA aplica un cobro de otra. La cuenta se busca ESTRICTA: con la base caída, «de ninguna» se releía con otra.
//   2. DESCONECTAR UNA no toca las otras: sus claves, su nombre, SU fila de ruteo y SU aviso en Stripe; las demás quedan.
//   3. UNA CUENTA NUEVA NUNCA HEREDA el sufijo de una que se fue: sus cobros y sus vínculos lo siguen nombrando, y un link
//      pendiente de la vieja se pagaría con las claves de la nueva.
//   4. EL VÍNCULO DE UN PRODUCTO («Vincular cobro») ENCUENTRA SU PAGO: `cobros.cuenta` guarda `c2` y el vínculo `stripe:c2`
//      (antes se comparaba `c2` con `stripe:c2`: un pago de la segunda cuenta nunca llegaba a su CRM), y sin cuenta elegida
//      el producto cobra por una de SU vínculo.
//   5. NINGUNA CLAVE AL NAVEGADOR NI AL ENTORNO: la ruta de las cuentas devuelve nombres y estados; las claves de la segunda
//      cuenta del ws1 no van a process.env.
//
// El comportamiento lo ejecuta un node aparte (tests/_cuentas-pago-hijo.ts, `--conditions=react-server`) con Stripe,
// Mercado Pago y Supabase de mentira. Lo de la ruta y las pantallas se lee del fuente.
//
// Probado ROMPIÉNDOLO (22-23/10/2026, con las dos revisiones de plata), una rotura por vez y restaurando: con el código
// como está, 17 pases y 0 fallos. Rota:
//   · `deOtraCuenta` siempre false (el aviso de c2 aplica el cobro de la principal)         → 16 / 1
//   · `deOtraCuenta` sin el id en el proveedor (sólo el sufijo)                             → 16 / 1
//   · `eliminarCredencial` con `borrarRoutingDeWs` también para las pasarelas             → 15 / 2
//   · `eliminarCredencial` sin soltar el ruteo de un id que no descifra                     → 16 / 1
//   · `soltarRuteoSinCuenta` suelta aunque el id de otra cuenta no se lea                   → 16 / 1
//   · `desconectarPasarela` sin el nombre (`alias`) en lo que borra                         → 15 / 2
//   · `proximaCuentaDe` sin `sufijosUsados`                                                 → 16 / 1
//   · `cuentaParaConectar` sin reusar el sufijo de SUS cobros                               → 16 / 1
//   · `cuentaParaConectar` hereda la principal libre                                        → 16 / 1
//   · `cuentaParaConectar` devuelve la cuenta ya conectada (la clave de prueba pisa la real) → 16 / 1
//   · `cuentaDeIdentificador` sin la lectura estricta                                       → 16 / 1
//   · `cuentaDelCobro` vuelve a devolver `c.cuenta` tal cual                                → 16 / 1
//   · `cuentaSinElegir` siempre la de siempre (ignora el vínculo)                           → 15 / 2
//   · `cuentaSinElegir` vuelve a la principal con la cuenta del vínculo caída               → 16 / 1
//   · `refParaCobrar` sin el vínculo del producto                                           → 16 / 1
//   · `guardarCredencial` rutea por el nombre exacto (no pregunta si el acct es de otro)    → 16 / 1
//   · `esClaveDePasarela` sin el nombre base (`STRIPE_SECRET_KEY__C2` al entorno del ws1)   → 16 / 1
//   · `yaConectadaComoOtra` apagado (la misma cuenta dos veces)                             → 13 / 4
//   · el cobro nace sin `cuenta_ref`                                                        → 16 / 1
//   · la 0328 sin completar `cuenta_ref` de los cobros de antes                             → 16 / 1
//   · `urlParaPagar` abre un link de MP sin mirar su cuenta                                 → 16 / 1
//   · `anularCobro` sin el try del cierre (corta después de anular)                         → 16 / 1
//   · el aviso de Stripe relee el `acct` en vez del que validó la ruta                      → 16 / 1
//   · `integracionConectada` sólo mira la principal                                         → 16 / 1
//   · `cobroReusable` sin comparar la cuenta (la landing)                                   → 16 / 1
//   · la landing pide el modo de la principal (no el de la cuenta del producto)             → 16 / 1
//   · la ruta de cuentas sin el corte de admin                                              → 16 / 1
//   · el asistente de la ficha sin mandar la cuenta elegida                                 → 16 / 1
// Correr: node --import tsx --test tests/cuentas-pago.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  CUENTA_PRINCIPAL, aliasLimpio, baseDeClave, claveDeCuenta, cuentaDeClave, cuentaSinElegir, cuentaValida, nombreDeCuenta,
  partirIdDeCuenta, proximaCuenta,
} from '../lib/cuentas-integracion';
import { cuentaDelCobro, vinculoDelPago, type VinculoCobro } from '../lib/cobro-etapa';
import { cobroReusable } from '../lib/editor-landing/pago-pedido';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_cuentas-pago-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el modelo: una cuenta es un sufijo en el nombre de sus claves, y su id es `proveedor:cuenta`', () => {
  assert.equal(claveDeCuenta('STRIPE_SECRET_KEY'), 'STRIPE_SECRET_KEY');
  assert.equal(claveDeCuenta('STRIPE_SECRET_KEY', 'c2'), 'STRIPE_SECRET_KEY__C2');
  assert.equal(baseDeClave('STRIPE_SECRET_KEY__C2'), 'STRIPE_SECRET_KEY');
  assert.equal(cuentaDeClave('STRIPE_SECRET_KEY__C2'), 'c2');
  assert.equal(cuentaDeClave('STRIPE_SECRET_KEY'), CUENTA_PRINCIPAL);
  assert.equal(cuentaDeClave('STRIPE_SECRET_KEY__X'), null, 'un sufijo que MaKo no acuña no es una cuenta');
  for (const malo of ['c1', 'c0', 'c1000', 'C2', 'c02', ' c2', 'principal ', '', null, 2]) assert.equal(cuentaValida(malo), false, String(malo));
  assert.throws(() => claveDeCuenta('STRIPE_SECRET_KEY', 'c1'), /Cuenta inválida/);
  assert.equal(proximaCuenta([]), 'c2');
  assert.equal(proximaCuenta(['principal', 'c2', 'c5']), 'c6');
  assert.deepEqual(partirIdDeCuenta('stripe:c2'), { proveedor: 'stripe', cuenta: 'c2' });
  assert.equal(partirIdDeCuenta('paypal:c2'), null);
  assert.equal(partirIdDeCuenta('stripe:c1'), null);
  assert.equal(nombreDeCuenta('stripe', 'c2', null), 'Stripe 2');
  assert.equal(nombreDeCuenta('mercadopago', CUENTA_PRINCIPAL, '  '), 'Mercado Pago');
  assert.equal(aliasLimpio('  Tienda\u0007   online '), 'Tienda online');
  assert.equal(aliasLimpio('x'.repeat(90)).length, 40);
});

test('el vínculo de un producto encuentra el pago de SU cuenta (`c2` en el cobro, `stripe:c2` en el vínculo)', () => {
  assert.equal(cuentaDelCobro({ proveedor: 'stripe', cuenta: 'c2' }), 'stripe:c2');
  assert.equal(cuentaDelCobro({ proveedor: 'mercadopago', cuenta: null }), 'mercadopago:principal');
  const v: VinculoCobro[] = [{ id: 1, funnelId: 4, etapa: 'ganado', productoId: 9, cuentas: ['stripe:c2'] }];
  const pago = (cuenta: string | null) => ({ producto_id: 9, pago_id: null, proveedor: 'stripe' as const, cuenta });
  assert.equal(vinculoDelPago(pago('c2'), v, { renovacion: false })?.id, 1, 'el pago de la segunda cuenta tiene que ir al CRM de su vínculo');
  assert.equal(vinculoDelPago(pago(null), v, { renovacion: false }), null, 'el de la principal no es de ese vínculo');
});

test('sin cuenta elegida, un producto vinculado cobra por una cuenta de SU vínculo', () => {
  // Sin vínculo, o con la de siempre adentro: la de siempre.
  assert.equal(cuentaSinElegir('stripe', 'principal', [], ['principal', 'c2']), 'principal');
  assert.equal(cuentaSinElegir('stripe', 'principal', ['stripe:principal', 'stripe:c2'], ['principal', 'c2']), 'principal');
  // Vinculado sólo por la segunda: la segunda (si cobra).
  assert.equal(cuentaSinElegir('stripe', 'principal', ['stripe:c2'], ['principal', 'c2']), 'c2');
  assert.equal(cuentaSinElegir('stripe', 'principal', ['stripe:c3', 'stripe:c2'], ['principal', 'c2']), 'c2', 'la primera del vínculo que COBRE');
  // Si ninguna del vínculo cobra: ninguna (cobrarlo por la principal podía ser cobrarlo en la cuenta de otra razón social).
  assert.equal(cuentaSinElegir('stripe', 'principal', ['stripe:c3'], ['principal', 'c2']), null);
  // Las cuentas de la otra pasarela no cuentan.
  assert.equal(cuentaSinElegir('stripe', 'principal', ['mercadopago:c2'], ['principal', 'c2']), 'principal');
  // Sin ninguna que cobre, null (crearCobro dice «no conectada»).
  assert.equal(cuentaSinElegir('stripe', null, ['stripe:c2'], []), null);
});

test('dos cuentas de Stripe: cada una con sus claves, su ruteo y su aviso; la misma cuenta dos veces, no', () => {
  assert.equal(R.dos.ok, true);
  assert.equal(R.dos.c, 'c2');
  assert.deepEqual(R.dos.cuentas, ['stripe:principal|Stripe|cobra', 'stripe:c2|Tienda|cobra']);
  assert.deepEqual(R.dos.ruteo, ['stripe/acct_A→13', 'stripe/acct_B→13'], 'la segunda cuenta tiene que reclamar SU acct (si no, sus avisos no llegan a nadie)');
  assert.deepEqual(R.dos.avisos, ['https://mako.test/api/webhooks/stripe?acct=acct_A', 'https://mako.test/api/webhooks/stripe?acct=acct_B']);
  assert.deepEqual(R.identificador, { b: 'c2', a: 'principal', z: null, keyC2: true, keyPrincipal: true });
  assert.equal(R.repetida.ok, false);
  assert.match(R.repetida.error, /ya está conectada aquí como «Stripe»/);
  assert.equal(R.repetida.igual, true, 'la misma cuenta dos veces dejó algo guardado');
  // La de OTRO negocio como segunda: «ocupada» (409), nada guardado y su ruteo sigue siendo del otro. El reclamo va por el
  // nombre BASE (`STRIPE_ACCOUNT_ID__C2` rutea como `STRIPE_ACCOUNT_ID`): por el exacto, ni se preguntaba de quién era.
  assert.deepEqual(R.ajena.r, { ok: false, status: 409, nadaGuardado: true });
  assert.equal(R.ajena.igual, true, 'la cuenta de otro negocio dejó algo guardado');
  assert.deepEqual(R.ajena.ruteo, ['stripe/acct_A→13', 'stripe/acct_B→99']);
});

test('un aviso de una cuenta NUNCA aplica un cobro de otra (y la cuenta del aviso se busca estricta)', () => {
  assert.match(R.aviso.principalPorC2, /^ignorado: el cobro es de otra cuenta de Stripe/);
  assert.match(R.aviso.c2PorPrincipal, /^ignorado: el cobro es de otra cuenta de Stripe/);
  // Los de su cuenta pasan el corte y van a releer (Stripe de mentira contesta 404 → tira).
  assert.match(R.aviso.c2PorC2, /^tira: Stripe 404 releyendo la sesión de pago/);
  assert.match(R.aviso.principalPorPrincipal, /^tira: Stripe 404 releyendo la sesión de pago/);
  assert.match(R.estricta, /^tira: /, 'con la base caída, «de ninguna cuenta» relee con la principal y el aviso se pierde con un 200');
});

test('desconectar UNA cuenta: sus claves, su nombre, su ruteo y su aviso; la principal queda entera', () => {
  assert.equal(R.desconectaUna.ok, true);
  assert.deepEqual(R.desconectaUna.cuentas, ['stripe:principal|Stripe|cobra']);
  assert.deepEqual(R.desconectaUna.ruteo, ['stripe/acct_A→13']);
  assert.deepEqual(R.desconectaUna.avisos, ['https://mako.test/api/webhooks/stripe?acct=acct_A']);
  assert.deepEqual(R.desconectaUna.claves, ['STRIPE_ACCOUNT_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], 'quedó algo de la cuenta desconectada');
  // Y borrar el id de UNA suelta sólo su ruteo.
  assert.deepEqual(R.eliminarUna.ruteo, ['stripe/acct_B→13'], 'borrar el acct de la principal cortó los avisos de la otra cuenta');
});

test('una cuenta nueva nunca hereda el sufijo de una que dejó cobros o vínculos (de ESTE negocio)', () => {
  assert.deepEqual(R.noReusa, { libre: 'c2', conCobro: 'c3', conVinculo: 'c5', deOtroNegocio: 'c2' });
});

test('Mercado Pago: dos cuentas, cada una con su token y su user_id', () => {
  assert.equal(R.mp.ok, true);
  assert.deepEqual(R.mp.cuentas, ['mercadopago:principal|Mercado Pago|cobra', 'mercadopago:c2|Mercado Pago 2|cobra']);
  assert.deepEqual(R.mp.ruteo, ['mercadopago/111→13', 'mercadopago/222→13']);
  assert.equal(R.mp.userC2, '222');
  assert.equal(R.mp.tokenC2, true);
  assert.equal(R.mp.de222, 'c2');
});

test('las claves de la segunda cuenta (y los nombres) del ws1 no van a process.env', () => {
  assert.deepEqual(R.env.enEnv, [], 'una clave de cobro del ws1 (Mauricio, un cliente) en el entorno la leería otro camino');
  assert.equal(R.env.guardadas, 5, 'no es el control: las cinco tienen que estar guardadas en su fila');
});

test('el nombre de una cuenta: limpio, y vacío vuelve al de siempre', () => {
  assert.deepEqual(R.renombrar.renombrada, ['stripe:principal|Stripe|cobra', 'stripe:c2|Tienda online|cobra']);
  assert.deepEqual(R.renombrar.sinNombre, ['stripe:principal|Stripe|cobra', 'stripe:c2|Stripe 2|cobra']);
});

test('la ruta de las cuentas: sólo el admin, cerrada sin negocio, y nunca devuelve una clave', () => {
  const src = sinComentarios(leer('app/api/integraciones/cuentas/route.ts'));
  const ctx = src.slice(src.indexOf('async function contexto('), src.indexOf('export async function GET('));
  assert.match(ctx, /if \(!esSuperAdmin && !esAdminWs\) return \{ error: 'solo admin', status: 403 \};/);
  assert.match(ctx, /if \(ws == null\) return \{ error: 'workspace no resuelto', status: 403 \};/);
  assert.equal((src.match(/const ctx = await contexto\(\);\s*\n\s*if \('error' in ctx\) return/g) ?? []).length, 2, 'GET y POST pasan por el contexto');
  // Lo que vuelve: nombres y estados (`cuentasDePago`), mensajes. La clave guardada sólo se pasa a la conexión.
  // Sin los textos ('Pega la clave…'): lo que importa es si un CAMPO lleva la clave.
  for (const r of src.match(/NextResponse\.json\(\{[^}]*\}/g) ?? []) {
    assert.doesNotMatch(r.replace(/'[^']*'|`[^`]*`/g, "''"), /\bclave\b|\bguardada\b/, `una respuesta con una clave: ${r}`);
  }
  assert.match(src, /credDelCliente\(claveDeCuenta\(CLAVE_PASARELA\[p\], cuenta\), ctx\.ws\)/, 'la clave guardada se lee con credDelCliente, nunca del entorno');
  assert.match(src, /descubrirPasarela\(p, ctx\.ws, clave, ctx\.autor, \{ guardarClave: true, cuenta \}\)/);
  assert.match(src, /desconectarPasarela\(ctx\.ws, p, ctx\.autor, cuenta\)/);
  // La pantalla no arrastra nada del server. `CtaPasarAPro` (6/11/2026, #494) es 'use client' y lee /api/auth/me por fetch:
  // es el que esconde «Pasar a Pro» al cliente de una agencia, que le pide el cambio de plan a ella.
  const ui = leer('app/integraciones/CuentasDePago.tsx');
  assert.deepEqual([...ui.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort(),
    ['../_components/CtaPasarAPro', '../components/ConfirmDialog', '@/lib/cuentas-integracion', 'react']);
  assert.match(leer('app/integraciones/ServicioConfigForm.tsx'), /\(esPasarela\(servicio\.key\) \|\| esProveedorAgendaConCuentas\(servicio\.key\)\) && \(\s*\n\s*<CuentasDePago/);
});

test('la MISMA cuenta que se va y vuelve: el sufijo de sus cobros, y sus avisos la encuentran por su id', () => {
  // Revisión de plata (22/10/2026): con el sufijo solo, B reconectada como c3 dejaba sus cobros (c2) huérfanos: cada
  // renovación se ignoraba con un 200 y no se podía devolver ni cancelar.
  assert.equal(R.vuelve.sufijo, 'c2', 'la cuenta que vuelve tiene que caer en el sufijo de SUS cobros');
  assert.match(R.vuelve.avisoPorC3, /^tira: Stripe 404 releyendo/, 'el aviso de B (reconectada como c3) tiene que aplicar su cobro de c2');
  assert.match(R.vuelve.avisoPorPrincipal, /^ignorado: el cobro es de otra cuenta/);
  // «Conectar otra»: la principal sólo sin ninguna; nunca hereda la de otra cuenta; una ya conectada no entra (la conexión
  // dice «ya está conectada aquí»): con la clave de PRUEBA de la misma cuenta, la principal quedaba cobrando en prueba.
  assert.deepEqual(R.paraConectar, { sinNinguna: 'principal', yaEsta: 'c3', sinPrincipal: 'c3' });
  assert.deepEqual(R.pruebaSobreReal.r, { ok: false, status: 409 });
  assert.equal(R.pruebaSobreReal.keyPrincipal, true, 'la clave real de la principal quedó pisada por la de prueba');
  assert.deepEqual(R.pruebaSobreReal.claves, ['STRIPE_ACCOUNT_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
  // Y el cobro anota su cuenta en el proveedor al nacer.
  // ⚠️ SE FIJA LA FORMA POR PASARELA, NO EL TERNARIO (31/10/2026). Antes esto clavaba
  // `cuenta_ref: (d.pasarela === 'stripe' ? stripe?.acct : mp?.userId) ?? null`, y ese ternario era justo el bug: con
  // una tercera pasarela, un cobro de Creem guardaba el `user_id` de Mercado Pago en `cuenta_ref`, que es lo que
  // después ENCUENTRA la cuenta del cobro (no se podía releer, ni devolver, ni cancelar). El test ahora exige que el
  // dato salga de una tabla indexada por la pasarela del cobro, que es lo que no se puede equivocar al sumar la cuarta.
  const cobrosSrc = sinComentarios(leer('lib/cobros.ts'));
  assert.match(cobrosSrc, /cuenta_ref: porPasarela\[d\.pasarela\]\.ref,/);
  assert.match(cobrosSrc, /creem: \{ cred: creem, ref: creem\?\.webhookId \?\? null \},/);
  assert.doesNotMatch(cobrosSrc, /cuenta_ref: \(d\.pasarela === 'stripe'/, 'volvió el ternario de dos ramas en cuenta_ref');
});

test('un id que no descifra igual suelta su ruteo; un link de una cuenta desconectada no abre; la tarjeta ve las de más', () => {
  assert.deepEqual(R.ilegible.ruteo, ['stripe/acct_A→13'], 'quedó reclamada una cuenta que ya no se puede soltar');
  assert.deepEqual(R.ilegibleOtra.ruteo, ['stripe/acct_A→13', 'stripe/acct_B→13'], 'con el id de otra cuenta ilegible, se soltó su ruteo (sus avisos se pierden)');
  assert.deepEqual(R.pagar.conectadaMp, { url: 'https://www.mercadopago.com/checkout/x' });
  assert.deepEqual(R.pagar.desconectadaMp, { error: 'desconectada' }, 'el link de MP de una cuenta desconectada cobraba donde MaKo no se entera');
  assert.deepEqual(R.tarjeta, { ninguna: false, soloC2: true });
});

// 6/11/2026: la tarjeta de Apify decía «Sin conectar» con Spy leyendo perfecto, y el cliente volvía a configurar al vicio.
// Conectada = AL MENOS UNA de las cinco claves con valor real, igual que una pasarela con sólo una cuenta con sufijo.
test('la tarjeta de Apify se conecta con cualquiera de sus claves, no sólo con la primera', () => {
  assert.deepEqual(R.apify, { sinNinguna: false, soloLa2: true, soloLa1: true, soloElNombre: false });
});

test('la 0328 completa la cuenta de los cobros de ANTES, sólo donde no hay duda', () => {
  const sql = leer('supabase/migrations/0328_cobro_por_cuenta.sql').replace(/--.*$/gm, '');
  assert.match(sql, /add column if not exists cuenta text/);
  assert.match(sql, /add column if not exists cuenta_ref text/);
  // Del ruteo, con UNA fila por pasarela, sin cuentas con sufijo, y sólo lo que está en NULL (idempotente).
  assert.match(sql, /update cobros c\s+set cuenta_ref = r\.identificador/);
  assert.match(sql, /having count\(\*\) = 1/);
  assert.match(sql, /where c\.cuenta_ref is null\s+and c\.cuenta is null/);
  assert.match(sql, /'STRIPE\\_ACCOUNT\\_ID\\_\\_%'/);
  assert.match(sql, /'MERCADOPAGO\\_USER\\_ID\\_\\_%'/);
});

test('la landing no reusa un pendiente de OTRA cuenta', () => {
  assert.deepEqual(R.refParaCobrar, { vinculado: 'acct_B', suelto: 'acct_A' });
  const pendiente = {
    estado: 'pendiente' as const, producto_id: 9, proveedor: 'stripe' as const, monto: 10, moneda: 'USD', tipo: 'unico' as const,
    email: 'a@b.test', alta_capa: null, creado_por: 'Landing «Mi landing» (mi-landing)', modo: 'real' as const, cuenta_ref: 'acct_A',
  };
  const buscado = { productoId: 9, pasarela: 'stripe' as const, monto: 10, moneda: 'USD', tipo: 'unico' as const, email: 'a@b.test', slug: 'mi-landing', modo: 'real' as const };
  assert.equal(cobroReusable(pendiente as never, buscado), true, 'sin la cuenta (los tests de antes), como siempre');
  assert.equal(cobroReusable(pendiente as never, { ...buscado, cuentaRef: 'acct_A' }), true);
  assert.equal(cobroReusable(pendiente as never, { ...buscado, cuentaRef: 'acct_B' }), false, 'un pendiente de la principal reusado cuando el producto cobra por la segunda');
  assert.equal(cobroReusable(pendiente as never, { ...buscado, cuentaRef: null }), false, 'sin saber la cuenta de hoy no se reusa');
});

test('lo chico de la segunda revisión: anular no corta, el aviso usa el id validado, la landing pide el modo del producto', () => {
  // Anular con la base cayendo a mitad (buscar la cuenta del cobro tira): el cobro queda anulado y anular contesta ok.
  assert.deepEqual(R.anular, { r: { ok: true }, estado: 'anulado' }, 'anular cortó después de anular: «No pude anular» de algo anulado');
  assert.match(sinComentarios(leer('app/api/webhooks/stripe/route.ts')), /procesarEventoStripe\(wsFinal, ev, cuentaFinal, cuenta \? acct : null\)/);
  assert.match(sinComentarios(leer('app/api/webhooks/mercadopago/route.ts')), /aplicarNotificacionMp\(wsFinal, lectura, cuentaFinal, cuenta \? n\.userId : null\)/);
  assert.match(sinComentarios(leer('lib/editor-landing/pago-landing-server.ts')), /modo: \(pasarela, productoId\) => modoDeLaPasarela\(l\.ws, pasarela, productoId\),/);
  assert.match(sinComentarios(leer('lib/editor-landing/pago-pedido.ts')), /await dep\.modo\(pasarela, p\.productoId\)/);
});

test('elegir la cuenta: «Vincular cobro» y el link de la ficha', () => {
  // «Vincular cobro»: las cuentas que cobran, con su nombre.
  const vinc = sinComentarios(leer('app/crm/cobro-etapa-actions.ts'));
  assert.match(vinc, /const cs = await cuentasDePago\(await wsObligatorio\(\)\);\s*\n\s*return cs\.filter\(\(c\) => c\.conectada\)/);
  // La ficha: el asistente manda la cuenta elegida y la acción se la pasa a crearCobro, que la valida.
  const asis = sinComentarios(leer('app/crm/[id]/CobrarConLink.tsx'));
  assert.match(asis, /cuenta: opciones\.length > 1 \? cuenta\?\.id \?\? null : null,/);
  assert.match(asis, /onClick=\{\(\) => setCuentaElegida\(c\.id\)\}/);
  const acc = sinComentarios(leer('app/crm/[id]/cobros-actions.ts'));
  assert.match(acc, /cuenta: textoCorto\(d\.cuenta, 60\),/);
  const cobros = sinComentarios(leer('lib/cobros.ts'));
  // Igual que arriba: el guard pregunta por la pasarela PEDIDA en la tabla, no `stripe ? stripe : mp`. Con el ternario,
  // una cuenta pedida de Creem se validaba contra las credenciales de Mercado Pago: con MP conectado, el guard PASABA
  // sin haber leído una sola credencial de Creem.
  assert.match(cobros, /if \(pedida && !porPasarela\[pedida\.proveedor\]\.cred\) return \{ ok: false, error: 'Esa cuenta de cobro no está conectada\.' \};/);
  assert.match(cobros, /return cuentaSinElegir\(pas, porDefecto, delVinculo, cobran\.map\(\(x\) => x\.cuenta\)\);/);
});
