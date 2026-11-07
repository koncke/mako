// =============================================================================
// El tope del plan al conectar una cuenta más de Stripe, Mercado Pago, Calendly o Cal (23/10/2026)
// =============================================================================
// MaKo Esencial trae «1 cuenta de Stripe o Mercado Pago»; MaKo Pro, varias (docs/ofertas-mako.md, lib/topes-plan.ts).
// Lo que falla callado si se rompe:
//   1. EL TOPE SE LE APLICA AL WS1 O A UN ACUERDO A MANO: también tienen capa `completo`, y no pagan por la pasarela.
//   2. SE FRENA LO QUE NO SUMA: volver a conectar, cambiar la clave o la principal que ya está.
//   3. SE GUARDA ANTES DE FRENAR: el tope va antes de tocar nada.
//   4. SIN PODER LEER EL PLAN, SE FRENA: el tope vende, no protege; un error no se le cobra al cliente.
//   5. LLEGA A UN COBRO: el tope vive sólo en las puertas que conectan una cuenta.
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 4 / 0, una rotura por vez:
//   · el ws1 tiene tope                                 → 3 / 1
//   · un acuerdo a mano tiene tope                      → 3 / 1
//   · sin poder leer el plan, frena                     → 3 / 1
//   · no mira si MaKo lo cobra por la pasarela          → 3 / 1
//   · agenda: el tope después de guardar (o sin tope)   → 2 / 2
//   · cobro: cambiarle la clave también se frena        → 3 / 1
//   · la principal: volver a conectarla se frena        → 3 / 1
//   · el cartel sin «Pasar a Pro»                       → 3 / 1
//
// 6/11/2026 (#494): el CTA del cartel va envuelto en `CtaPasarAPro` (al cliente de una agencia se le dice a quién
// pedírselo). La aserción del cartel se hizo MÁS estricta, no menos: fija lo de antes (que salga sólo con `msg.planes`,
// que apunte ahí y que diga «Pasar a Pro») y además el envoltorio y de dónde se importa. Las puertas del tope no se
// tocaron. Roturas nuevas, con el archivo en 4 / 0:
//   · el cartel sin el envoltorio (el link pelado)      → 3 / 1
//   · el envoltorio copiado en vez de importado         → 3 / 1
//
// Correr: node --import tsx --test tests/tope-cuentas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { topeAlConectar, LINK_PLANES } from '../lib/tope-cuentas-reglas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la regla: Esencial conecta una, Pro varias; el ws1 y los acuerdos a mano no tienen tope', () => {
  const esencial = { ws: 13, cobradoPorPasarela: true, capa: 'completo' };
  assert.equal(topeAlConectar({ ...esencial, usadas: 0 }), null, 'la primera cuenta siempre se conecta');
  assert.deepEqual(topeAlConectar({ ...esencial, usadas: 1 }), { tope: 1, texto: 'Llegaste al tope de tu plan (1). Pasa a MaKo Pro para tener más.' });
  assert.equal(topeAlConectar({ ws: 13, cobradoPorPasarela: true, capa: 'agencia', usadas: 7 }), null, 'Pro no tiene tope de cuentas');
  assert.equal(topeAlConectar({ ...esencial, cobradoPorPasarela: false, usadas: 4 }), null, 'a un acuerdo a mano se le aplicaba el tope');
  assert.equal(topeAlConectar({ ...esencial, ws: 1, usadas: 4 }), null, 'al ws1 se le aplicaba el tope');
  assert.equal(topeAlConectar({ ws: 13, cobradoPorPasarela: true, capa: null, usadas: 4 }), null, 'una capa que no es un plan no tiene tope');
  assert.equal(LINK_PLANES, '/configuraciones/plan', '«Pasar a Pro» lleva a cambiar de plan (RUTA_CAMBIAR_PLAN de lib/topes-plan.ts)');
});

test('lo que lee el plan: primero si MaKo lo cobra por la pasarela, y sin poder leer, no frena', () => {
  const src = sinComentarios(leer('lib/tope-cuentas.ts'));
  const f = src.slice(src.indexOf('export async function topeDeCuentas('));
  assert.ok(f.indexOf('await suscripcionDeMakoDe(ws)') < f.indexOf('getWorkspace(ws)'), 'se leía la capa antes de saber si MaKo le cobra el plan');
  assert.match(f, /if \(!\(await aplicanTopes\(ws\)\)\) return null;/);
  assert.match(f, /\} catch \(e\) \{[\s\S]*?return null;\s*\}/, 'sin poder leer el plan, frenaba la conexión');
  // Los grupos: las de cobro (Stripe y Mercado Pago juntas) y las de agenda (Calendly y Cal juntas).
  assert.match(src, /if \(grupo === 'cobro'\) return \(await cuentasDePago\(ws\)\)\.length;/);
  assert.match(src, /cuentasDeAgenda\(ws, 'calendly'\), cuentasDeAgenda\(ws, 'calcom'\)/);
});

test('las puertas: sólo lo que SUMA una cuenta, y antes de guardar nada', () => {
  const ruta = sinComentarios(leer('app/api/integraciones/cuentas/route.ts'));
  // Agenda: conectar siempre suma; el tope va antes de probar y de guardar el token.
  const agenda = ruta.slice(ruta.indexOf('async function postAgenda('));
  const ta = agenda.indexOf("const tope = await topeDeCuentas(ctx.ws, 'agenda');");
  assert.ok(ta > 0 && ta < agenda.indexOf('await guardar(claveDeCuenta(b.clave, cuenta), token);'), 'el tope de agenda iba después de guardar');
  // Cobro: sólo si la cuenta es nueva (cambiarle la clave a una que ya está no suma), y antes de descubrirPasarela.
  const cobro = ruta.slice(ruta.indexOf("if (body.action === 'conectar') {\n      const clave"));
  assert.match(cobro, /if \(!\(await lista\(\)\)\.some\(\(x\) => x\.cuenta === cuenta\)\) \{\s*const tope = await topeDeCuentas\(ctx\.ws, 'cobro'\);/, 'cambiarle la clave a una cuenta que ya está se frenaba por el tope');
  assert.ok(cobro.indexOf("topeDeCuentas(ctx.ws, 'cobro')") < cobro.indexOf('await descubrirPasarela('), 'el tope de cobro iba después de conectar');
  // La principal de una pasarela que todavía no estaba (la tarjeta de Integraciones) también suma.
  const cred = sinComentarios(leer('app/api/integraciones/credencial/route.ts'));
  const pago = cred.slice(cred.indexOf("if (body.action === 'descubrir-pago') {"));
  assert.match(pago, /if \(!\(await cuentasDePago\(ctx\.ws, pasarela\)\)\.some\(\(x\) => x\.principal\)\) \{\s*const tope = await topeDeCuentas\(ctx\.ws, 'cobro'\);/, 'volver a conectar la principal se frenaba por el tope');
  assert.ok(pago.indexOf("topeDeCuentas(ctx.ws, 'cobro')") < pago.indexOf('await descubrirPasarela('));
  // Y contesta el cartel con «Pasar a Pro», sin guardar nada.
  for (const src of [ruta, pago]) assert.match(src, /error: tope\.texto, tope: tope\.tope, planes: LINK_PLANES, nadaGuardado: true \}, \{ status: 402 \}/);
  // El cartel del 402: el CTA sale sólo con `msg.planes`, apunta ahí y dice «Pasar a Pro».
  // ⚠️ DESDE EL 6/11/2026 (#494) VA ENVUELTO EN `CtaPasarAPro`: al cliente de una AGENCIA se le dice a quién pedírselo en
  //    vez del link, porque su plan lo paga su agencia y el que hacía clic le pagaba a MaKo un SEGUNDO plan del mismo
  //    negocio. El envoltorio devuelve `children` tal cual a todos los demás (app/_components/CtaPasarAPro.tsx), así que
  //    esto sigue fijando lo de antes —la condición, el destino y el rótulo— y además que el envoltorio esté puesto.
  //    Lo que NO cambia es el tope: las puertas de arriba son las que cuidan la plata y no se aflojan por esto.
  const cartel = leer('app/integraciones/CuentasDePago.tsx');
  assert.match(cartel, /\{msg\.planes && <CtaPasarAPro><a href=\{msg\.planes\}[^>]*>Pasar a Pro<\/a><\/CtaPasarAPro>\}/);
  assert.match(sinComentarios(cartel), /import \{ CtaPasarAPro \} from '\.\.\/_components\/CtaPasarAPro';/, 'el envoltorio tiene que venir del componente compartido, no de una copia local');
});

test('el tope vive SÓLO en las puertas que conectan: nunca desconecta ni frena un cobro', () => {
  const usan = execFileSync('git', ['grep', '-l', 'topeDeCuentas(', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(usan, ['app/api/integraciones/credencial/route.ts', 'app/api/integraciones/cuentas/route.ts', 'lib/tope-cuentas.ts'],
    'el tope apareció en otro lado: un cobro o una desconexión no se frenan por el plan');
  const ruta = sinComentarios(leer('app/api/integraciones/cuentas/route.ts'));
  assert.equal((ruta.match(/topeDeCuentas\(/g) ?? []).length, 2, 'una cuenta por grupo y nada más (ni reconectar, ni renombrar, ni desconectar)');
});
