// =============================================================================
// Conectar Stripe y Mercado Pago: qué se guarda, en qué orden, y qué NO
// =============================================================================
// lib/cobros-conexion.ts es lo que corre cuando alguien pega su clave de cobro en /integraciones
// (la acción 'descubrir-pago' de /api/integraciones/credencial). Tres reglas que fallan calladas:
//
//   1. NADA SE GUARDA SI EL PROVEEDOR NO ACEPTA LA CLAVE. El tilde genérico del formulario guarda
//      sin probar cuando faltan campos obligatorios, y en una pasarela siempre faltan (los
//      derivados no existen todavía): por ese camino una clave rota quedaba adentro.
//   2. EL ID DE LA CUENTA SE RECLAMA ANTES QUE LA CLAVE, y si es de otro workspace no se guarda
//      nada. Con la clave guardada y la cuenta ajena, los links se crearían en una cuenta cuyos
//      avisos le llegan a otro.
//   3. CAMBIAR DE CUENTA SUELTA LA VIEJA y borra la firma que era de ella.
//
// Los módulos llevan `server-only`: el comportamiento lo ejecuta un node aparte
// (tests/_cobros-conexion-hijo.ts, con `--conditions=react-server`) con `fetch` de mentira para
// Stripe, Mercado Pago y el PostgREST de Supabase. Lo de la ruta y el formulario se lee del fuente.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez y restaurando de memoria. Con el código
// como está: 7 pases, 0 fallos. Rota (pases / fallos):
//   · descubrirStripe guarda la clave ANTES de leer la cuenta                       → 4 / 3
//   · reclamarCuenta sin `soltarIdentificador` (el cambio no suelta la vieja)       → 5 / 2
//   · el webhook registrado sin `?acct=` en la URL                                  → 6 / 1
//   · descubrirMercadoPago sin `borrarVieja` de la clave del aviso                  → 6 / 1
//   · la whitelist de 'guardar' de /api/metodo vuelve a aceptar los derivados       → 6 / 1
// Correr: node --import tsx --test tests/cobros-conexion.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

type Creds = Record<string, string | null>;
type Caso = { r: { ok: boolean; status?: number; nadaGuardado?: boolean; completa?: boolean; mensaje?: string; error?: string; guardadas?: string[]; facts?: Array<{ k: string; v: string }> }; creds?: Creds; ruteo?: string[]; log?: string[]; endpoints?: Array<{ url: string }> };

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_cobros-conexion-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Caso>;

test('una clave que el proveedor rechaza no deja NADA guardado (ni la clave)', () => {
  for (const [nombre, c] of [['Stripe', R.claveRota], ['Mercado Pago', R.mpRoto]] as const) {
    assert.equal(c.r.ok, false, `${nombre}: tenía que fallar`);
    assert.equal(c.r.nadaGuardado, true, `${nombre}: el formulario dice «No la guardé» sólo si es verdad`);
    assert.deepEqual(Object.values(c.creds ?? {}).filter(Boolean), [], `${nombre}: quedó algo guardado con una clave rota`);
    assert.deepEqual(c.ruteo, [], `${nombre}: quedó una fila de ruteo con una clave rota`);
  }
  assert.deepEqual(R.claveRota.log, ['stripe GET /v1/account'], 'con la clave rota no se toca ni la base ni los avisos de Stripe');
});

test('Stripe: la cuenta se reclama ANTES que la clave, y el aviso nombra la cuenta en su URL', () => {
  const c = R.conecta;
  assert.equal(c.r.ok, true);
  assert.equal(c.r.completa, true);
  assert.deepEqual(c.creds, {
    STRIPE_SECRET_KEY: 'rk_live_CUENTAaaaaaaaaaaaaaa',
    STRIPE_ACCOUNT_ID: 'acct_A',
    STRIPE_WEBHOOK_SECRET: 'whsec_prueba1AAAAAAAAAAAAAAAAAAAA',
  });
  assert.deepEqual(c.ruteo, ['stripe/acct_A→9']);
  const log = c.log ?? [];
  const i = (s: string) => log.indexOf(s);
  assert.ok(i('db POST webhook_routing acct_A') >= 0 && i('db POST webhook_routing acct_A') < i('db POST credenciales STRIPE_SECRET_KEY'),
    `la clave se guardó antes de reclamar la cuenta:\n${log.join('\n')}`);
  assert.ok(i('stripe POST /v1/webhook_endpoints') < i('db POST credenciales STRIPE_WEBHOOK_SECRET'), 'la firma se guarda con la que devolvió Stripe al crear el aviso');
  // Un evento de una cuenta directa (sin Connect) no trae `account`: la URL es lo único que dice de quién es.
  assert.deepEqual(c.endpoints?.map((e) => e.url), ['https://mako.test/api/webhooks/stripe?acct=acct_A']);
  // Los facts: cuenta, país, moneda, modo. Ni plata ni datos personales (el mock trae un email).
  assert.ok(!JSON.stringify(c.r.facts).includes('@'), 'un fact trae el email de la cuenta');
});

test('una cuenta que ya es de OTRO workspace: 409 y nada guardado', () => {
  const c = R.ocupada;
  assert.equal(c.r.ok, false);
  assert.equal(c.r.status, 409);
  assert.equal(c.r.nadaGuardado, true);
  assert.deepEqual(Object.values(c.creds ?? {}).filter(Boolean), [], 'la clave de una cuenta ajena quedó guardada');
  assert.deepEqual(c.ruteo, ['stripe/acct_A→13'], 'el ruteo del dueño real no se toca');
  assert.ok(!(c.log ?? []).includes('stripe POST /v1/webhook_endpoints'), 'se registró un aviso en la cuenta de otro');
});

test('cambiar de cuenta suelta la vieja; sin permiso para el aviso, borra la firma de la otra cuenta', () => {
  assert.deepEqual(R.cambio.ruteo, ['stripe/acct_B→9'], 'la cuenta vieja quedó reclamada por un workspace que ya no la usa');
  assert.equal(R.cambio.creds?.STRIPE_WEBHOOK_SECRET, 'whsec_prueba2AAAAAAAAAAAAAAAAAAAA');

  const s = R.sinPermiso;
  assert.equal(s.r.ok, true, 'la clave sirve: se guarda aunque el aviso no');
  assert.equal(s.r.completa, false, 'sin el aviso no está completa, y el formulario lo pinta en rojo');
  assert.match(s.r.mensaje ?? '', /rak_webhook_write/, 'el permiso que falta tiene que llegar con el nombre que usa Stripe');
  assert.equal(s.creds?.STRIPE_ACCOUNT_ID, 'acct_B');
  assert.equal(s.creds?.STRIPE_WEBHOOK_SECRET, null, 'quedó la firma de la cuenta anterior: «conectada» con un aviso que no existe');
});

test('volver a conectar con la clave guardada no la reescribe', () => {
  assert.equal(R.reconecta.r.ok, true);
  assert.ok(!(R.reconecta.log ?? []).includes('db POST credenciales STRIPE_SECRET_KEY'));
  assert.ok((R.reconecta.log ?? []).includes('stripe POST /v1/webhook_endpoints'), 'volver a conectar re-registra el aviso (la dirección de HOY)');
});

test('Mercado Pago: la cuenta y el token; al cambiar de cuenta se borra la clave del aviso vieja', () => {
  const c = R.mpConecta;
  assert.equal(c.r.ok, true);
  assert.deepEqual(c.creds, { MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-1111111111111111-101112-aaaaaaaa-111', MERCADOPAGO_USER_ID: '111', MERCADOPAGO_WEBHOOK_SECRET: null });
  assert.deepEqual(c.ruteo, ['mercadopago/111→13']);
  const log = c.log ?? [];
  assert.ok(log.indexOf('db POST webhook_routing 111') < log.indexOf('db POST credenciales MERCADOPAGO_ACCESS_TOKEN'), 'el token se guardó antes de reclamar la cuenta');

  const m = R.mpCambio;
  assert.deepEqual(m.ruteo, ['mercadopago/222→13'], 'la cuenta vieja quedó reclamada');
  assert.equal(m.creds?.MERCADOPAGO_WEBHOOK_SECRET, null, 'la clave del aviso de la cuenta vieja rechazaría cada aviso firmado de la nueva');
  assert.ok(m.r.facts?.some((f) => f.k === 'Modo' && /Prueba/.test(f.v)), 'una cuenta de prueba se dice');
});

test('los derivados no entran por ningún «guardar», y la clave de la pasarela va al descubrimiento', () => {
  // La ruta de la tab y la de /metodo: las dos whitelists, porque cerrar una deja la otra.
  for (const f of ['app/api/integraciones/credencial/route.ts', 'app/api/metodo/route.ts']) {
    assert.match(sinComentarios(leer(f)), /servicio\.campos\.filter\(\(c\) => !c\.derivado\)/, `${f}: la whitelist de 'guardar' acepta los ids derivados`);
  }
  // El catálogo marca los tres, cada uno en su línea (la lee tests/webhook-ruteo-obligatorio.test.ts).
  const cat = leer('lib/metodo-catalogo.ts');
  for (const env of ['STRIPE_ACCOUNT_ID', 'STRIPE_WEBHOOK_SECRET', 'MERCADOPAGO_USER_ID']) {
    const linea = cat.split('\n').find((l) => l.includes(`{ env: '${env}'`)) ?? '';
    assert.match(linea, /auto: true/, `${env} sin auto`);
    assert.match(linea, /derivado: true/, `${env} sin derivado`);
  }
  // El formulario: la clave de una pasarela va a 'descubrir-pago', y «cargarlos a mano» no abre un derivado.
  const form = sinComentarios(leer('app/integraciones/ServicioConfigForm.tsx'));
  assert.match(form, /esPasarela\(servicio\.key\) && campo && !campo\.auto && !campo\.opcional\) \{ void conectarPasarela\(env, v\); return; \}/);
  assert.match(form, /action: 'descubrir-pago'/);
  assert.match(form, /\(!c\.auto \|\| \(manual && !c\.derivado\)\)/);
  // La ruta lee la clave guardada con credDelCliente: credWs cae al process.env del ws1 (Mauricio).
  const ruta = sinComentarios(leer('app/api/integraciones/credencial/route.ts'));
  const rama = ruta.slice(ruta.indexOf("'descubrir-pago'"), ruta.indexOf("'elegir'"));
  assert.match(rama, /credDelCliente\(env, ctx\.ws\)/);
  assert.doesNotMatch(rama, /credWs\(/);
});
