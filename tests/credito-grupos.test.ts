// =============================================================================
// El crédito de los planes 200 para TODOS los grupos de WhatsApp de MaKo (28/10/2026, ws10, Leandro)
// =============================================================================
// Martín, textual: «Y falló Gemini cuando te pedí que deprequemos Gemini por los grupos de WhatsApp... Y te pedí que habilites
// las API que tenemos disponibles con todas las cuentas de planes 200». Lo que fija este test (la parte de verdad,
// tests/_credito-grupos-hijo.ts):
//   1. las cuentas con clave, repartidas: una distinta primero en cada turno; la que se quedó sin crédito se saltea; la del
//      entorno cuenta;
//   2. la puerta 2 da la cuenta del grupo SÓLO al turno del grupo (`mako-doer-in`), nunca al Ops Center ni al Plan, nunca una
//      clave que no es de la lista, y la clave propia del negocio gana; con Haiku y como crédito;
//   3. el gasto va a la cuenta que pagó (antes, a la cuenta 1), y su fallo no va a la tarjeta del negocio ni se lee como «tu
//      clave de Claude»;
//   4. el interruptor: apagado o sin poder leerlo, ninguna cuenta, ni por la puerta; sin claves cargadas, ninguna;
//   5. N cuentas (el Cerebro, 28/10/2026: «armalo para N cuentas»): las del Uso (`CUENTAS_DEL_CREDITO`), UNA lista; con todas
//      cargadas el reparto las recorre a todas, y una clave con el prefijo que el Uso no conoce no paga nada.
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { FEATURE_DE_LOS_GRUPOS } from '../lib/veto-claude';
import { CLAVES_CREDITO_DE_LOS_GRUPOS, CUENTAS_DEL_CREDITO } from '../lib/credito-api';

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_credito-grupos-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@GRUPOS@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@GRUPOS@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const C1 = 'ANTHROPIC_CREDITO_CUENTA1';
const C2 = 'ANTHROPIC_CREDITO_CUENTA2';

test('1. las cuentas con clave, repartidas; la agotada se saltea; la del entorno cuenta', () => {
  const r = correr();
  assert.deepEqual(r.reparto, [[C1, C2], [C2, C1], [C1, C2]], 'todos los turnos empiezan por la misma cuenta');
  assert.deepEqual(r.sinLaAgotada, [C2], 'la cuenta sin crédito se vuelve a probar en cada turno');
  assert.deepEqual(r.conLaDelEntorno, [C2, 'ANTHROPIC_CREDITO_CUENTA3']);
  assert.deepEqual(r.ws10Cuenta3, { clave: 'sk-ant-api03-credito-cuenta3-', modelo: 'claude-haiku-4-5', esCredito: true, cuenta: 3 },
    'una cuenta que no es del crédito de la plataforma se pagó como clave del negocio (con Sonnet, sin la marca)');
  assert.equal(FEATURE_DE_LOS_GRUPOS, 'mako-doer-in');
});

test('2. la puerta 2: sólo el turno del grupo, nunca el Plan ni el Ops Center; su clave propia gana', () => {
  const r = correr();
  assert.equal(r.ws10SinCuenta, null, 'sin cuenta, el ws10 tiene una copia de la clave de MaKo: no es su Claude');
  assert.deepEqual(r.ws10Cuenta2, { clave: 'sk-ant-api03-credito-cuenta2-', modelo: 'claude-haiku-4-5', esCredito: true, cuenta: 2 });
  assert.equal(r.ws10OpsCenter, null, 'el Ops Center usó el crédito de los grupos');
  assert.equal(r.ws10Plan, null, 'el Plan pagó con el crédito de los grupos');
  assert.equal(r.ws10OtraClave, null, 'la puerta entregó una clave que no es del crédito de los grupos');
  assert.deepEqual(r.ws13ConLaSuya, { clave: 'sk-ant-api03-propia-del-ws13-', modelo: 'claude-haiku-4-5', esCredito: false, cuenta: null }, 'el crédito tapó su clave propia');
});

test('3. el gasto va a la cuenta que pagó; su fallo no es «tu clave de Claude» ni va a la tarjeta del negocio', () => {
  const r = correr();
  assert.equal(r.chatCuenta2, 'hola desde Claude', `el chat del grupo no contestó: ${r.chatCuenta2}`);
  assert.deepEqual(r.chatCuenta2Anthropic, [{ clave: 'sk-ant-api03-credito-cuenta2-', modelo: 'claude-haiku-4-5' }]);
  assert.equal(r.gasto.length, 1);
  assert.match(r.gasto[0], /^⚠ crédito de Claude de la plataforma \(cuenta 2\) · Claude del grupo/);
  assert.deepEqual(r.pago, [{ cuenta: 'claude2', negocio: null }], 'el Uso se lo anota a otra cuenta');
  assert.match(r.chatCuenta1, /^tiró: falló la IA \(el crédito de Claude de MaKo, cuenta 1: Your credit balance is too low/);
  assert.doesNotMatch(r.chatCuenta1, /tu clave de Claude/, 'el negocio leería que SU clave no tiene crédito');
  // Desde el 11/11/2026 la puerta deja la fila «sin crédito» (antes, nada: el Uso no se enteraba); ninguna va a la tarjeta del negocio.
  assert.deepEqual(r.filasDelFallo, ['10:⚠ crédito de Claude de la plataforma (cuenta 1) · sin crédito hasta el próximo ciclo'],
    'el fallo de una cuenta nuestra quedó en la tarjeta del negocio, o la cuenta sin saldo no dejó su fila');
  assert.ok(r.sinCreditoAt, 'el Uso de SuperAdmin no ve que la cuenta 1 se quedó sin crédito');
});

test('8. el chat con herramientas del ws9 va primero con el crédito, con plazo; si ya corrió una herramienta, no prueba otra cuenta', () => {
  const r = correr();
  assert.equal(r.opsCenterWs9, 'hola desde Claude', `el Ops Center del ws9 no contestó con el crédito: ${r.opsCenterWs9}`);
  assert.deepEqual(r.opsCenterWs9Anthropic, [{ clave: 'sk-ant-api03-credito-cuenta2-', modelo: 'claude-haiku-4-5' }]);
  assert.equal(r.opsCenterConPlazo, true, 'un pedido del bucle con herramientas salió sin plazo');
  assert.match(String(r.opsCenterWs10), /^tiró: /, 'el ws10 sin IA propia contestó con algo');
  assert.equal(r.opsCenterWs10Credito, 0, 'el Ops Center de un negocio usó el crédito');
  assert.equal(r.herramientaYFalla.corridas, 1);
  assert.equal(r.herramientaYFalla.pedidos, 2, 'después de correr una herramienta se probó otra cuenta: duplicaría la escritura');
  assert.match(r.herramientaYFalla.r, /^tiró: falló la IA \(el crédito de Claude de MaKo, cuenta \d: Number of request tokens/);
});

test('4. el interruptor: apagado o sin leerlo, ninguna cuenta, tampoco por la puerta; sin claves, ninguna', () => {
  const r = correr();
  assert.deepEqual(r.sinLeer, [], 'sin poder leer el interruptor, gastó el crédito');
  assert.deepEqual(r.apagado, []);
  assert.equal(r.apagadoPermisoSigue, null, 'apagado, la puerta 2 entregó la cuenta igual');
  assert.deepEqual(r.prendido, [C2], 'prendido otra vez (la cuenta 1 sigue agotada)');
  assert.deepEqual(r.sinClaves, []);
});

test('5. N cuentas: las del Uso, una sola lista; el reparto recorre todas; una clave que el Uso no conoce no paga', () => {
  const r = correr();
  const [C3, C4] = ['ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4'];
  // Las tres rotaciones, empiece por la que empiece: el contador del reparto es del proceso y lo mueven los casos de arriba.
  const rotacion = (a: string[]) => a.join(',');
  assert.deepEqual(r.nCuentas.map(rotacion).sort(), [[C2, C3, C4], [C3, C4, C2], [C4, C2, C3]].map(rotacion).sort(), 'el reparto no recorre todas las cuentas cargadas');
  assert.equal(r.laNueve, null, 'una clave que el Uso no conoce pagó un turno');
  assert.deepEqual(r.ws10Cuenta4, { clave: 'sk-ant-api03-credito-cuenta4-', modelo: 'claude-haiku-4-5', esCredito: true, cuenta: 4 });
  // Una cuenta del grupo que el Uso no conoce sería gasto que no se ve: las del grupo SON las del Uso, sin copia.
  assert.deepEqual([...CLAVES_CREDITO_DE_LOS_GRUPOS], CUENTAS_DEL_CREDITO.map((c) => c.clave));
  assert.ok(CLAVES_CREDITO_DE_LOS_GRUPOS.includes('ANTHROPIC_CREDITO_CUENTA5'), 'la cuenta 5 (Max 20x, Martín 28/10) no paga los grupos');
  const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.match(leer('lib/credito-api.ts'), /export const CLAVES_CREDITO_DE_LOS_GRUPOS: readonly string\[\] = CUENTAS_DEL_CREDITO\.map\(\(c\) => c\.clave\);/);
  assert.doesNotMatch(leer('lib/veto-claude.ts'), /export const CLAVES_CREDITO_DE_LOS_GRUPOS/, 'volvió la copia con los nombres fijos');
});

test('7. desde el 11/11/2026: el Ops Center del ws9 SÍ usa el crédito (el Plan no); un negocio, sólo en WhatsApp', () => {
  const r = correr();
  assert.deepEqual(r.ws9OpsCenter, { clave: 'sk-ant-api03-credito-cuenta2-', modelo: 'claude-haiku-4-5', esCredito: true, cuenta: 2 },
    'el chat del Ops Center del espacio de MaKo no usó el crédito');
  assert.equal(r.ws9Plan, null, 'el Plan pagó con el crédito en el espacio de MaKo');
  assert.equal(r.ws10OpsCenter, null, 'el Ops Center de un negocio usó el crédito: cada negocio paga su IA');
  assert.deepEqual(r.ws10Adjunto, { clave: 'sk-ant-api03-credito-cuenta2-', modelo: 'claude-haiku-4-5', esCredito: true, cuenta: 2 },
    'las fotos y los PDF de un grupo no usan el crédito de los grupos');
  assert.deepEqual(r.textoWs14, { texto: 'hola desde Claude', model: 'claude-haiku-4-5' });
  assert.equal(r.textoWs14SinSaldo.esCredito, true);
  assert.match(r.textoWs14SinSaldo.error, /credit balance is too low/);
  assert.deepEqual(r.filasWs14, [
    '14:2:⚠ crédito de Claude de la plataforma (cuenta 2) · Leer el adjunto',
    '14:1:⚠ crédito de Claude de la plataforma (cuenta 1) · sin crédito hasta el próximo ciclo',
  ], 'el gasto del crédito de un negocio no quedó en SU ws con su cuenta, o el fallo fue a su tarjeta');
});

test('9. la foto de un grupo (`leerDocumentoIA`): sin su Claude la lee el crédito; con SU Claude sin saldo, un pedido a su clave y ninguno al crédito', () => {
  const r = correr();
  assert.deepEqual(r.fotoWs14, { texto: 'hola desde Claude', pedidos: ['sk-ant-api03-credito-cuenta2-'] },
    'un negocio sin su Claude no leyó la foto del grupo con el crédito');
  const suya = r.fotoWs13.pedidos.filter((c: string) => c === 'sk-ant-api03-propia-del-ws13-').length;
  const delCredito = r.fotoWs13.pedidos.filter((c: string) => /credito/.test(c)).length;
  assert.equal(suya, 1, `con su Claude sin saldo, su clave se pidió ${suya} veces (la puerta 2 le da la suya en cada cuenta del crédito)`);
  assert.equal(delCredito, 0, 'el crédito se usó con un negocio que tiene su Claude');
  // Sin nada que mire después, un 529 de una cuenta prueba la siguiente (antes: «al respaldo», que no había, y la foto sin leer).
  assert.deepEqual(r.fotoWs14Con529, { texto: 'hola desde Claude', pedidos: 2 }, 'con un 529 y sin respaldo, la foto del grupo quedó sin leer');
});

test('6. el % del vigía (11/11/2026): primero la que menos gastó; la plataforma deja el último 10% para WhatsApp; su interruptor', () => {
  const r = correr();
  const [C3, C4] = ['ANTHROPIC_CREDITO_CUENTA3', 'ANTHROPIC_CREDITO_CUENTA4'];
  assert.deepEqual(r.usoGrupos, [C3, C4, C2], 'los grupos no van primero por la cuenta que menos gastó (o saltearon la del 95%)');
  assert.deepEqual(r.usoPlataforma, [C3, C4], 'la plataforma usó la cuenta del 95%: ese resto es de WhatsApp');
  assert.equal(r.usoViejo, 3, 'un % de hace 3 horas salteó una cuenta: puede ser de otro ciclo');
  assert.deepEqual(r.plataformaApagada, { plataforma: [], grupos: 3, clave: null, claveGrupos: true },
    'el interruptor de la plataforma no apaga sólo lo de la plataforma');
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   R1 sin el reparto (`const i = 0`)                                                    → falla el 1
//   R2 sin saltear la agotada                                                            → falla el 1
//   R3 la puerta sin mirar la feature del grupo                                          → falla el 2
//   R4 la cuenta del grupo antes que su clave propia                                     → falla el 2
//   R5 sin `cuentaDelCredito` en la marca del gasto                                      → falla el 3
//   R6 el fallo de la cuenta como «tu clave de Claude»                                   → falla el 3
//   R7 `claveDeLaCuentaDeLosGrupos` sin mirar el interruptor                             → falla el 4
//   R8 `cuentasDelCreditoDeLosGrupos` sin el interruptor                                 → falla el 4
//   R9 la lista de los grupos como copia fija (cuatro nombres)                           → falla el 5
//   R10 `claveDeLaCuentaDeLosGrupos` sin mirar que el nombre sea del Uso                  → falla el 5
//   R11 el reparto sólo entre las dos primeras cuentas                                   → falla el 5
// El % del vigía (11/11/2026), con el mismo arnés:
//   R12 la plataforma sin saltear la cuenta del 90%                                      → falla el 6
//   R13 el orden sin mirar el % (sólo el reparto)                                        → falla el 6
//   R14 un % de hace horas cuenta igual                                                  → falla el 6
//   R15 la plataforma con el interruptor de los grupos                                   → falla el 6
// La puerta para el espacio de MaKo (11/11/2026), con el mismo arnés:
//   R16 `esElEspacioDeLaPlataforma` siempre true (un negocio usa el crédito)            → fallan el 2 y el 7
//   R17 «es la plataforma» comparado con el ws1 (OWNER_WS, Mauricio) y no con el super admin → falla el 7
//   R18 el fallo de una cuenta del crédito a la tarjeta del negocio (`anotarFalloDeSuClave`) → falla el 7
//   R19 la fila del gasto del crédito sin el ws del pedido (caía al ws9)                 → falla el 7
//   R20 `conClaveDelNegocio` sin pasarle la cuenta a la puerta                           → falla el 7
// El bucle con herramientas (11/11/2026), con el mismo arnés:
//   R21 el `fetch` sin `signal`                                                          → falla el 8
//   R22 sin re-lanzar cuando ya corrió una herramienta (prueba otra cuenta)             → falla el 8
//   R23 la cuenta sin saldo sin su fila «sin crédito» (sólo en memoria, como antes)     → falla el 3
//   R24 sin el crédito primero en la plataforma                                          → falla el 8
// La foto de un grupo (revisión del 11/11/2026), con el mismo arnés:
//   R25 el lazo del crédito de `leerDocumentoIA` aunque su Claude haya contestado un error   → falla el 9
//   R26 `leerDocumentoIA` sin `tambienLosGrupos`                                         → falla el 9
//   R27 la foto sin `sinRespaldo`: un 529 de la primera cuenta deja la foto sin leer          → falla el 9
