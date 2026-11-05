// =============================================================================
// Varias claves de Spy (Apify) en un negocio: la primera con crédito, y a la siguiente SÓLO por falta de crédito (5/11/2026)
// =============================================================================
// Martín, 5/11/2026: «Dame la opción de tener varias claves de apify» y «dame la opción también en integraciones de cargar más
// api». La clave de Spy se queda sin crédito (el 5/11 la de la plataforma iba en US$8,01 de 10). Lo que se fija acá:
//   · una clave sin crédito (402) pasa a la siguiente, y la vuelta siguiente arranca por la que tiene (lib/spy-claves.ts);
//   · un 401 (la clave no entra), un 429 (demasiados pedidos) o un corte de red NO saltan: se dicen, con el número de la clave;
//   · ninguna clave sale en una respuesta: ni en la lectura, ni en el verificador de Integraciones, ni en su crédito;
//   · el alta del CRM sigue con la clave 1 sola (las extra son de Spy y de la biblioteca);
//   · la reserva de Spy se cuenta sobre el total libre, y una corrida larga no pide más de lo que le queda a SU clave;
//   · una corrida larga recuerda con qué clave se pidió (su huella), porque sólo esa cuenta la puede leer.
// Las funciones REALES (lib/instagram-perfil-server.ts, lib/metodo-verificar.ts) corren en tests/_spy-claves-hijo.ts.
//
// PROBADO ROMPIÉNDOLO (5/11/2026, base 13 pasan / 0 fallan; «pasan / fallan» con cada rotura):
//   · `conLaPrimeraConCredito` sin saltar (devuelve la primera respuesta siempre)          → 10 / 3  (1, 3 y 8)
//   · saltar con cualquier error (`!esFaltaDeCredito` → «no fue 2xx»)                      → 11 / 2  (2 y 9: el 401 y el 429 saltaban)
//   · `esFaltaDeCredito` sin el corte del 429                                             → 11 / 2  (2 y 9)
//   · `soloLaPrimera: !opts.variasClaves` → `soloLaPrimera: false` (el CRM usa todas)     → 12 / 1  (10)
//   · el verificador con la clave en su mensaje de error                                  → 11 / 2  (11 y 12)
//   · `ajustarAlCredito` sin el tope de SU clave                                          → 12 / 1  (5)
//   · el parser de `TareaLarga` sin `clave`                                               → 12 / 1  (6)
// Y un cambio sin efecto (renombrar `saltadas` a `saltos` adentro de lib/spy-claves.ts) lo deja en 13 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  claveDeHuella, conLaPrimeraConCredito, estaAgotada, olvidarTodasLasAgotadas, ordenDeClaves, resumenDeCredito, type ClaveApify,
} from '../lib/spy-claves';
import { ajustarAlCredito, creditoTotal, esFaltaDeCredito, leerTareas, pedidoDePublicaciones, RESERVA_CREDITO_USD } from '../lib/spy-todo-reglas';
import { CLAVES_APIFY_DE_SPY, nombreDeClaveApify, slotDeClaveApify } from '../lib/instagram-perfil';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const clave = (slot: number, token: string): ClaveApify => ({ token, slot, nombre: null, huella: `h${slot}`.padEnd(16, '0') });
const SIN_CREDITO = { status: 402, cuerpo: { error: { type: 'not-enough-usage-to-run-paid-actor' } } };

// ── 1. Lo puro ───────────────────────────────────────────────────────────────

test('1. sin crédito pasa a la siguiente; la vuelta siguiente arranca por la que tiene', async () => {
  olvidarTodasLasAgotadas();
  const ks = [clave(1, 'k1'), clave(2, 'k2'), clave(3, 'k3')];
  const usadas: string[] = [];
  const r = await conLaPrimeraConCredito(ks, async (k) => { usadas.push(k.token); return k.token === 'k1' ? SIN_CREDITO : { status: 201, cuerpo: [k.token] }; });
  assert.deepEqual(usadas, ['k1', 'k2'], 'la 1 contestó sin crédito: se probó la 2 y nada más');
  assert.equal(r?.clave.slot, 2);
  assert.equal(r?.saltadas, 1);
  assert.equal(estaAgotada('h1'.padEnd(16, '0')), true);
  assert.deepEqual(ordenDeClaves(ks).map((k) => k.slot), [2, 3, 1], 'la agotada va al final, no se descarta');
});

test('2. un 401, un 429 o un corte de red NO saltan de clave: se contestan con la clave que los dio', async () => {
  olvidarTodasLasAgotadas();
  const ks = [clave(1, 'k1'), clave(2, 'k2')];
  for (const [status, cuerpo] of [[401, { error: { type: 'user-or-token-not-found' } }], [429, { error: { type: 'rate-limit-exceeded' } }], [500, null]] as const) {
    const usadas: string[] = [];
    const r = await conLaPrimeraConCredito(ks, async (k) => { usadas.push(k.token); return { status, cuerpo }; });
    assert.deepEqual(usadas, ['k1'], `un ${status} no es falta de crédito: no se gasta la otra cuenta`);
    assert.equal(r?.status, status);
    assert.equal(r?.clave.slot, 1);
  }
  const usadas: string[] = [];
  await assert.rejects(conLaPrimeraConCredito(ks, async (k) => { usadas.push(k.token); throw new Error('timeout'); }), /timeout/);
  assert.deepEqual(usadas, ['k1'], 'un corte de red sube tal cual');
  assert.equal(esFaltaDeCredito(429, { error: { type: 'rate-limit-exceeded', message: 'You have exceeded the rate limit' } }), false);
  assert.equal(esFaltaDeCredito(402, null), true);
  assert.equal(await conLaPrimeraConCredito([], async () => ({ status: 200, cuerpo: null })), null, 'sin claves, nada');
});

test('3. todas sin crédito: vuelve la última respuesta, y todas quedan recordadas', async () => {
  olvidarTodasLasAgotadas();
  const ks = [clave(1, 'k1'), clave(2, 'k2')];
  const r = await conLaPrimeraConCredito(ks, async () => SIN_CREDITO);
  assert.equal(r?.status, 402);
  assert.equal(r?.saltadas, 1);
  assert.ok(esFaltaDeCredito(r?.status ?? 0, r?.cuerpo), 'quien llama lo lee como «sin crédito»');
});

test('4. el crédito, por clave y en total, sin una sola clave', () => {
  const ks = [{ ...clave(1, 'secreta-uno'), nombre: 'Mi cuenta' }, clave(2, 'secreta-dos'), clave(3, 'secreta-tres')];
  const r = resumenDeCredito(ks, [{ usado: 8.01, tope: 10 }, { usado: 5, tope: 5 }, null]);
  assert.equal(r.porClave[0].rotulo, 'clave 1 (Mi cuenta)');
  assert.match(r.porClave[0].texto, /usó US\$8\.01 de US\$10\.00 este mes · le quedan US\$1\.99/);
  assert.equal(r.porClave[1].sinCredito, true);
  assert.equal(r.porClave[2].sinCredito, null, 'no se pudo leer: no es «sin crédito»');
  assert.match(r.total ?? '', /^US\$1\.99 este mes \(sin las que no pude leer\)/);
  assert.doesNotMatch(JSON.stringify(r), /secreta/);
  assert.deepEqual(creditoTotal([{ usado: 8.01, tope: 10 }, null, { usado: 1, tope: 5 }]), { usado: 9.01, tope: 15 });
  assert.equal(creditoTotal([null, null]), null);
});

test('5. la reserva de Spy va sobre el TOTAL libre, y una corrida no pide más de lo que le queda a su clave', () => {
  const pedido = pedidoDePublicaciones(undefined);
  // La 1 casi sin crédito (US$1,50 libres), la 2 con US$5: el total libre (6,5 − 2 de reserva = 4,5) deja una traída.
  const total = creditoTotal([{ usado: 8.5, tope: 10 }, { usado: 0, tope: 5 }]);
  const con1 = ajustarAlCredito(pedido, { usado: 8.5, tope: 10 }, total);
  assert.ok(con1, 'con el total alcanza');
  assert.ok((con1?.techoUsd ?? 99) <= 1.5 + 1e-9, 'pero no más de lo que le queda a la clave 1');
  // Sola, la 1 no llegaba (1,5 − 2 < 0): la reserva por clave la dejaba afuera.
  assert.equal(ajustarAlCredito(pedido, { usado: 8.5, tope: 10 }), null);
  // Una clave agotada no corre, aunque el total alcance.
  assert.equal(ajustarAlCredito(pedido, { usado: 10, tope: 10 }, total), null);
  // Con una sola clave, el de siempre (el total es ella).
  assert.deepEqual(ajustarAlCredito(pedido, { usado: 1.17, tope: 5 }), ajustarAlCredito(pedido, { usado: 1.17, tope: 5 }, { usado: 1.17, tope: 5 }));
  assert.equal(RESERVA_CREDITO_USD, 2);
});

test('6. una corrida larga recuerda su clave (la huella), y la de antes es la 1', () => {
  const t = leerTareas(JSON.stringify({ 7: { instagram: { run: 'abcdef123', dataset: 'ghijkl456', clave: '0123456789abcdef' }, anuncios: { run: 'abcdef123', dataset: 'ghijkl456', clave: 'NO-ES-UNA-HUELLA' } } }));
  assert.equal(t['7'].instagram?.clave, '0123456789abcdef');
  assert.equal(t['7'].anuncios?.clave, undefined, 'lo que no tiene forma de huella se descarta');
  const ks = [clave(2, 'k2'), clave(1, 'k1')];
  assert.equal(claveDeHuella(ks, undefined)?.slot, 1, 'sin huella (pedida antes de las varias claves): la 1');
  assert.equal(claveDeHuella(ks, 'h2'.padEnd(16, '0'))?.slot, 2);
  assert.equal(claveDeHuella(ks, 'ffffffffffffffff'), null, 'la quitaron: no se lee con otra');
  const todo = sinComentarios(leer('lib/spy-todo.ts'));
  assert.equal((todo.match(/claveDeHuella\(claves, t\.clave\)/g) ?? []).length, 2, 'publicaciones y anuncios leen con la clave que empezó');
  assert.match(todo, /return \{ run: d\.id, dataset: d\.defaultDatasetId, clave: r\.clave\.huella \};/, 'la corrida se anota con su huella');
});

test('7. los nombres: la 1 de siempre y cuatro más, cada una con su nombre opcional', () => {
  assert.deepEqual(CLAVES_APIFY_DE_SPY, ['APIFY_INSTAGRAM_TOKEN', 'APIFY_INSTAGRAM_TOKEN_2', 'APIFY_INSTAGRAM_TOKEN_3', 'APIFY_INSTAGRAM_TOKEN_4', 'APIFY_INSTAGRAM_TOKEN_5']);
  assert.equal(slotDeClaveApify('APIFY_INSTAGRAM_TOKEN_3'), 3);
  assert.equal(slotDeClaveApify('OTRA'), null);
  assert.equal(nombreDeClaveApify('APIFY_INSTAGRAM_TOKEN_2'), 'APIFY_INSTAGRAM_TOKEN_2_ACCOUNT');
});

// ── 2. Las funciones de verdad ──────────────────────────────────────────────

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_spy-claves-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 120_000 });
type Lectura = { ok: boolean; motivo: string | null; detalle: string | null; pedidos: string[]; crudo: string };
const R = JSON.parse(salida.trim().split('\n').pop() as string) as Record<string, Lectura> & {
  lote: { ok: number; pedidos: string[]; crudo: string };
  verificar: { ok: boolean; detalle?: string; facts?: Array<{ k: string; v: string }>; crudo: string };
  verificarRota: { ok: boolean; error?: string; crudo: string };
};
const CLAVES_DE_MENTIRA = /clave-(uno|dos)-[a-z-]+-[A-Z]{4}/;
const conClave = (n: number) => (p: string) => p.endsWith(` ${n}`);

test('8. Spy lee con la 2 cuando la 1 se quedó sin crédito, y la vez siguiente va directo a la 2', () => {
  assert.equal(R.saltaALa2.ok, true);
  assert.deepEqual(R.saltaALa2.pedidos.map((p) => p.split(' ')[1]), ['1', '2']);
  assert.equal(R.arrancaPorLa2.ok, true);
  assert.ok(R.arrancaPorLa2.pedidos.every(conClave(2)), 'la 1 quedó recordada sin crédito: no se le pregunta otra vez');
  assert.equal(R.unaSolaAnda.ok, true, 'la clave de siempre sola sigue andando sin tocar nada');
  assert.equal(R.lote.ok, 2, 'el lote del buscador también salta');
  assert.deepEqual(R.lote.pedidos.map((p) => p.split(' ')[1]), ['1', '2']);
});

test('9. una clave que no entra (401) o apurada (429) NO salta: lo dice, con su número', () => {
  assert.equal(R.rotaNoSalta.ok, false);
  assert.equal(R.rotaNoSalta.motivo, 'sin-permiso');
  assert.match(R.rotaNoSalta.detalle ?? '', /HTTP 401 \(clave 1\)/);
  assert.equal(R.rotaNoSalta.pedidos.length, 1, 'no se gastó la otra cuenta');
  assert.equal(R.apuradaNoSalta.ok, false);
  assert.match(R.apuradaNoSalta.detalle ?? '', /HTTP 429 \(clave 1\)/);
  assert.equal(R.apuradaNoSalta.pedidos.length, 1);
});

test('10. el alta del CRM sigue con la clave 1 sola: las extra son de Spy', () => {
  assert.equal(R.crmSoloLa1.ok, false);
  assert.ok(R.crmSoloLa1.pedidos.length > 0 && R.crmSoloLa1.pedidos.every(conClave(1)), `la 2 no se tocó: ${R.crmSoloLa1.pedidos.join(' · ')}`);
  assert.doesNotMatch(sinComentarios(leer('app/api/crm/instagram-buscar/route.ts')), /variasClaves|clavesApifyDeSpy/);
});

test('11. la tarjeta de Integraciones: el crédito de cada clave con su nombre, el total, y cuál no entra', () => {
  assert.equal(R.verificar.ok, true);
  const facts = R.verificar.facts ?? [];
  assert.deepEqual(facts.map((f) => f.k), ['Clave 1 (Cuenta A)', 'Clave 2 (Cuenta B)', 'Libre en total']);
  assert.match(facts[0].v, /usó US\$5\.00 de US\$5\.00 este mes · le quedan US\$0\.00/);
  assert.match(facts[2].v, /^US\$3\.50 este mes\. Se guardan US\$2\.00 para leer en Spy\.$/);
  assert.match(R.verificar.detalle ?? '', /^Las 2 claves entran\./, 'lo mismo que contesta la API de MaKo (probar_conexion_integracion)');
  assert.equal(R.verificarRota.ok, false);
  assert.equal(R.verificarRota.error, 'La clave 2 (Cuenta B) no entra a Apify. Cópiala de nuevo o quítala.');
});

test('12. ninguna clave sale en ninguna respuesta', () => {
  for (const [nombre, x] of Object.entries(R)) assert.doesNotMatch(x.crudo, CLAVES_DE_MENTIRA, `«${nombre}» devolvió una clave`);
  // El script de la biblioteca tampoco imprime una: sólo su número, su nombre y su crédito.
  const script = sinComentarios(leer('scripts/carruseles-biblioteca.mts'));
  assert.doesNotMatch(script, /console\.log\([^)]*\$\{[^}]*\btoken\b[^}]*\}/, 'un console.log con la clave');
  assert.match(script, /clavesApifyDeSpy\(await wsSuperAdmin\(\), \{ conNombres: true \}\)/);
  assert.match(script, /B\.techoConCredito\(techoPedido, c0, B\.RESERVA_CREDITO_USD\)/, 'el techo sale del total de todas las claves');
});

test('13. la tarjeta: «Agregar otra clave de Apify» abre la clave y su nombre juntos, y muestra el crédito', () => {
  const form = sinComentarios(leer('app/integraciones/ServicioConfigForm.tsx'));
  assert.match(form, /const esApify = servicio\.key === 'apify-instagram';/);
  assert.match(form, /\.\.\.\(dePares \? \[`\$\{proxima\.env\}_ACCOUNT`\] : \[\]\)/, 'un clic abre la clave y su nombre');
  assert.match(form, /esApify \? 'Agregar otra clave de Apify \(de otra cuenta tuya\)'/);
  assert.match(form, /<CreditoApify firma=/);
  const credito = sinComentarios(leer('app/integraciones/CreditoApify.tsx'));
  assert.match(credito, /action: 'verificar', servicio: 'apify-instagram', valores: \{\}/, 'lee las GUARDADAS en el servidor: la clave no viaja');
});
