// =============================================================================
// Varias cuentas de Calendly y Cal.com en UN negocio (fase B, 23/10/2026)
// =============================================================================
// El mismo modelo que las pasarelas (lib/cuentas-integracion.ts, tests/cuentas-pago.test.ts): una cuenta es un sufijo en
// el nombre de sus claves (`CALENDLY_API_TOKEN__C2`). Lo que falla callado si se rompe:
//
//   1. EL AVISO DE LA SEGUNDA CUENTA SE VERIFICA CON SU SECRETO. Con uno solo por negocio, cada reserva de la segunda
//      cuenta daba 401 «firma rechazada», y Calendly deshabilita la suscripción después de varios no-2xx.
//   2. LOS SECRETOS SE LEEN ESTRICTOS: con la base caída, «no hay secreto» rechazaba una firma buena.
//   3. LA REUNIÓN DE UN LEAD SE BUSCA EN TODAS LAS CUENTAS, y se cancela con el token de la que la tiene (con el de otra,
//      Calendly contesta 404). Una cuenta que no se puede leer TIRA con su nombre: «no pude leer» no es «no tiene».
//   4. CONECTAR OTRA prueba el token ANTES de guardarlo, y nunca pisa una cuenta que ya está.
//
// Parte 2 («Asignar evento» por cuenta, sobre la agenda rápida del CRM), probada rompiéndola con 6 tests en verde. Rota:
//   · `eventosDelProveedor` lee sólo la principal                           → 5 / 1
//   · los eventos salen sin su cuenta                                        → 5 / 1
//   · una fila por proveedor en vez de por cuenta                            → 5 / 1
//   · crear ignora la cuenta pedida                                          → 5 / 1
//   · editar sin cuenta no busca la que tiene el evento                      → 5 / 1
//   · una cuenta inválida pasa                                               → 5 / 1
// Parte 1, probada rompiéndola (23/10/2026) cuando eran 5 tests: con el código como está, 5 pases y 0 fallos. Rota:
//   · `cuentaQueFirmo` prueba sólo la primera                                → 4 / 1
//   · el aviso de Calendly verifica sólo con la principal                    → 4 / 1
//   · el aviso de Cal.com verifica sólo con la principal                     → 4 / 1
//   · `firmasDeAgenda` con la lectura tolerante                              → 4 / 1
//   · la próxima reunión se busca sólo en la principal                       → 4 / 1
//   · cancelar con el token de la principal                                  → 4 / 1
//   · la API de MaKo cancela sin la cuenta que la encontró                   → 4 / 1
//   · conectar guarda el token sin probarlo                                  → 4 / 1
//   · conectar pisa la principal                                             → 4 / 1
//   · `tokensDeAgenda` sólo la principal                                     → 3 / 2
//   · `cuentasDeAgenda` sin el nombre                                        → 4 / 1
//
// Correr: node --import tsx --test tests/cuentas-agenda.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cuentaQueFirmo, nombreDeCuenta } from '../lib/cuentas-integracion';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_cuentas-agenda-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('cuentaQueFirmo: vale el secreto de la cuenta que firmó, y sin ninguno tira el error de la principal', () => {
  const secretos = [{ cuenta: 'principal', firma: 'A' }, { cuenta: 'c2', firma: 'B' }];
  const verificaCon = (buena: string) => (s: string) => { if (s !== buena) throw new Error(`firma ${s} no`); };
  assert.equal(cuentaQueFirmo(secretos, verificaCon('A')), 'principal');
  assert.equal(cuentaQueFirmo(secretos, verificaCon('B')), 'c2', 'el aviso de la segunda cuenta se rechazaba con el secreto de la primera');
  assert.throws(() => cuentaQueFirmo(secretos, verificaCon('Z')), /firma A no/, 'sin ninguno: el error de la principal, el mensaje de siempre');
  assert.throws(() => cuentaQueFirmo([], verificaCon('A')), /No hay ningún secreto/);
  assert.equal(nombreDeCuenta('calcom', 'c3', null), 'Cal.com 3');
});

test('las cuentas de agenda: con su nombre, el token de cada una, y la que sigue', () => {
  assert.deepEqual(R.cuentas, ['principal|Calendly|token|firma', 'c2|Agenda del equipo|token|-']);
  assert.deepEqual(R.tokens, ['principal:tok_principal', 'c2:tok_c2']);
  assert.equal(R.proxima, 'c3');
});

test('los secretos de los avisos: el de cada cuenta, leídos estrictos', () => {
  assert.deepEqual(R.firmas, ['principal:firma_A', 'c2:firma_B']);
  assert.match(R.firmasCaida, /^tira: /, 'con la base caída, «no hay secreto» rechaza una firma buena con un 401');
  // Y los dos avisos los usan, en el try que contesta por el clasificador.
  const calendly = sinComentarios(leer('app/api/webhooks/calendly/route.ts'));
  const calcom = sinComentarios(leer('app/api/webhooks/calcom/route.ts'));
  assert.match(calendly, /cuentaQueFirmo\(secretos, \(s\) => verifyCalendlySignature\(rawBody, signatureHeader, s\)\)/);
  assert.match(calcom, /cuentaQueFirmo\(secretos\.length \? secretos : \[\{ cuenta: CUENTA_PRINCIPAL, firma: '' \}\], \(s\) => verifyCalcomSignature\(rawBody, firma, s\)\)/);
});

test('la reunión de un lead se busca en TODAS las cuentas y se cancela con el token de la suya', () => {
  assert.equal(R.proximaReunion, 'c2:R1 de B', 'la más próxima estaba en la segunda cuenta');
  assert.deepEqual(R.cancelaciones, ['tok_c2:EV_B:ok'], 'cancelar con el token de otra cuenta da 404');
  assert.match(R.rota, /^tira: Calendly 2: /, 'una cuenta que no se puede leer no es «no tiene reunión»');
  assert.match(R.sinCuentas, /no tiene el token de Calendly cargado/);
  // La operación de la API de MaKo cancela con la cuenta que la encontró.
  assert.match(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')), /await cancelarReunionCalendly\(String\(payload\.uri\), String\(payload\.motivo \?\? ''\), ahora\.cuenta\);/);
});

test('«Asignar evento» con dos cuentas: los eventos de las dos con su cuenta, crear en la elegida, editar con la dueña', () => {
  assert.deepEqual(R.asignar.eventos, ['R1 Ventas|principal|Calendly', 'Demo del equipo|c2|Agenda del equipo'], 'los eventos de la segunda cuenta no se listaban');
  assert.deepEqual(R.asignar.filas, ['principal|Calendly|conectada', 'c2|Agenda del equipo|conectada'], 'una fila por cuenta');
  assert.equal(R.escribir.creado, 'ok:c2', 'el evento nuevo va a la cuenta elegida');
  assert.equal(R.escribir.editado, 'ok:c2', 'editar sin cuenta tiene que encontrar la que TIENE el evento');
  assert.deepEqual(R.escribir.escrituras, ['tok_c2:crear', 'tok_c2:editar:ETB-0002:ok'], 'con el token de otra cuenta, Calendly contesta 404');
  assert.equal(R.escribir.cuentaMala, 'Esa cuenta de Calendly no está conectada.');
  assert.equal(R.escribir.invalida, 'Esa cuenta no existe.');
});

test('conectar otra cuenta de agenda: prueba el token antes de guardarlo y nunca pisa una que ya está', () => {
  const ruta = sinComentarios(leer('app/api/integraciones/cuentas/route.ts'));
  const post = ruta.slice(ruta.indexOf('async function postAgenda('), ruta.indexOf('/** El id de la cuenta EN EL PROVEEDOR'));
  const prueba = post.indexOf('if (!(await tokenDeAgendaValido(p, token))) {');
  const guarda = post.indexOf('await guardar(claveDeCuenta(b.clave, cuenta), token);');
  assert.ok(prueba > 0 && guarda > prueba, 'una clave que el proveedor no acepta quedaba guardada');
  assert.match(post.slice(prueba, guarda), /return NextResponse\.json\(\{ ok: false, error: `\$\{NOMBRE_AGENDA\[p\]\} no aceptó esa clave\. No la guardé\.`, nadaGuardado: true \}, \{ status: 422 \}\);/);
  assert.match(post, /const cuenta = \(await lista\(\)\)\.length \? await proximaCuentaDeAgenda\(ctx\.ws, p\) : CUENTA_PRINCIPAL;/);
  // Y la agenda pasa por el mismo corte de admin que el resto de la ruta.
  assert.match(ruta, /if \(esProveedorAgendaConCuentas\(p\)\) \{\s*try \{\s*return await postAgenda\(ctx, p, body\);/);
  assert.ok(ruta.indexOf('const ctx = await contexto();') < ruta.indexOf('return await postAgenda(ctx, p, body);'));
});
