// =============================================================================
// WhatsApp entrega TARDE (10/11/2026, «No funciona MaKo en WhatsApp»; tickets #79 y #80)
// =============================================================================
// La voz estaba `open` y le llegaban los mensajes de los grupos en tandas, hasta 78 minutos tarde; la línea de Martín, un día. Un
// comprobante ya resuelto volvió a entrar y MaKo lo atendió otra vez. Lo que fija (lib/linea-demora.ts):
//   1. la hora de WhatsApp en sus formas (segundos, texto, `{ low }`) y el atraso: lo de más de 6 h no lo atiende MaKo sola;
//   2. la demora de la línea con las filas REALES del 10/11 (cola, hora de WhatsApp, instancia) y el mail que arma el código;
//   3. la entrada REAL del grupo (tests/_linea-demora-hijo.ts): un día tarde va a SuperAdmin una vez y no entra a la cola; 78 min
//      y sin hora, siguen;
//   4. el cableado: el freno va antes del comprobante y de la cola; la alarma corre en el cron y avisa por EMAIL.
//
// Probado rompiéndolo (10/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { demoraDeEntrega, horaDeWhatsApp, llegoTarde, textoDeLaDemora, TARDE_MS } from '../lib/linea-demora';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const S = (iso: string) => Math.floor(Date.parse(iso) / 1000);

test('1. la hora de WhatsApp y el atraso: lo de más de 6 h no lo atiende MaKo sola', () => {
  assert.equal(horaDeWhatsApp(1762817362), 1762817362000);
  assert.equal(horaDeWhatsApp('1762817362'), 1762817362000);
  assert.equal(horaDeWhatsApp({ low: 1762817362, high: 0 }), 1762817362000);
  assert.equal(horaDeWhatsApp(1762817362000), 1762817362000, 'ya en ms');
  for (const x of [undefined, null, '', 'x', 0, -5]) assert.equal(horaDeWhatsApp(x), null);
  const ahora = Date.parse('2026-11-10T21:07:31Z');
  // El «listo» de Joan del 9/11 21:31, entregado el 10/11 21:07 por la línea de Martín (1.416 min).
  assert.deepEqual(llegoTarde(S('2026-11-09T21:31:45Z'), ahora), { horas: 24 });
  // Las notas de Patricia: 78 min tarde, se atienden.
  assert.equal(llegoTarde(S('2026-11-10T19:49:31Z'), ahora), null);
  assert.equal(llegoTarde(undefined, ahora), null, 'sin hora no se frena');
  assert.equal(TARDE_MS, 6 * 3_600_000);
});

test('2. la demora de la línea, con las filas reales del 10/11; el mail lo arma el código', () => {
  const V = 'mako_superadmin_muylqv8r';
  const filas = [
    { created_at: '2026-11-10T21:10:37Z', ts: S('2026-11-10T21:10:35Z'), instancia: V },
    { created_at: '2026-11-10T21:46:38Z', ts: S('2026-11-10T21:46:37Z'), instancia: V },
    { created_at: '2026-11-10T23:47:55Z', ts: S('2026-11-10T22:49:22Z'), instancia: V },
    { created_at: '2026-11-10T23:47:55Z', ts: S('2026-11-10T23:17:41Z'), instancia: V },
    { created_at: '2026-11-11T00:37:55Z', ts: S('2026-11-10T23:20:20Z'), instancia: V },
    { created_at: '2026-11-11T00:37:55Z', ts: String(S('2026-11-10T23:22:11Z')), instancia: V },
    { created_at: '2026-11-11T00:37:55Z', ts: S('2026-11-10T23:35:01Z'), instancia: V },
    { created_at: '2026-11-10T21:07:31Z', ts: S('2026-11-09T21:31:45Z'), instancia: 'mako_ws9' },
  ];
  const d = demoraDeEntrega(filas, Date.parse('2026-11-11T01:00:00Z'));
  assert.deepEqual(d, [{ instancia: V, atrasadas: 5, deTotal: 5, maxMin: 78 }], 'la ventana es de 3 h: lo de las 21:10 ya no cuenta');
  assert.deepEqual(demoraDeEntrega(filas, Date.parse('2026-11-10T22:00:00Z')), [{ instancia: 'mako_ws9', atrasadas: 1, deTotal: 1, maxMin: 1416 }], 'lo que llega DESPUÉS de ahora no cuenta');
  assert.deepEqual(demoraDeEntrega(filas.slice(0, 2), Date.parse('2026-11-10T22:00:00Z')), [], 'a tiempo no es demora');
  assert.deepEqual(demoraDeEntrega([], Date.now()), [], 'el silencio solo no es demora (ticket #79)');
  const t = textoDeLaDemora(d);
  assert.equal(t.asunto, '⚠️ WhatsApp le entrega TARDE a MaKo (hasta 78 min)');
  assert.match(t.cuerpo, /· mako_superadmin_muylqv8r: 5 de 5 mensajes con más de 20 min de atraso \(el peor, 78 min\)\./);
  assert.match(t.cuerpo, /no lo contesta MaKo sola: va al grupo de SuperAdmin/);
});

test('3. la entrada real: un día tarde va a SuperAdmin una vez y no entra a la cola; 78 min y sin hora siguen', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_linea-demora-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 480_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@DEMORA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@DEMORA@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.deepEqual(o.unDia.r, { engaged: false, skip: 'llegó tarde (24 h)' });
  assert.deepEqual([o.unDia.entro, o.unDia.reacciones, o.unDia.superAdmin.length], [false, 0, 1], JSON.stringify(o.unDia));
  assert.match(o.unDia.superAdmin[0], /^📨 WhatsApp entregó con 24 h de atraso un mensaje de Joan en el grupo de Código Inmobiliario \(ws13\):\n«Mako te mando el comprobante/);
  assert.deepEqual([o.reentrega.entro, o.reentrega.superAdmin.length], [false, 0], 'la re-entrega por la otra línea avisó otra vez');
  for (const k of ['unaHora', 'sinHora']) assert.deepEqual([o[k].entro, o[k].reacciones, o[k].superAdmin.length], [true, 1, 0], `${k}: ${JSON.stringify(o[k])}`);
});

test('4. el cableado: el freno antes del comprobante y de la cola; la alarma en el cron, por EMAIL', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const iTarde = doer.indexOf('const tarde = data.key?.fromMe ? null : llegoTarde(data.messageTimestamp, Date.now());');
  const iComprobante = doer.indexOf('if (jid === suyo && (await comprobanteDeLaMensualidad(');
  const iCola = doer.indexOf('return runWithWorkspace(wsData, () => bufferearYResponder(wsData, instance, tapado.mensaje, tapado));');
  assert.ok(iTarde > 0 && iComprobante > iTarde && iCola > iComprobante, 'el freno del atraso va después del comprobante o de la cola');
  assert.match(doer, /if \(tarde\) \{\n\s*await avisarQueLlegoTarde\(wsData, jid, data, tarde\.horas\)/);
  const vig = sinComentarios(leer('lib/canal-vigilante.ts'));
  assert.match(vig, /export async function vigilarDemoraDeLaLinea\(/);
  assert.match(vig, /const r = await avisarPorEmail\(wsSA, asunto, cuerpo\);/, 'la alarma de la línea viaja por la línea');
  assert.match(sinComentarios(leer('app/api/cron/alerta-critica/route.ts')), /const demora = await vigilarDemoraDeLaLinea\(\)\.catch\(/);
});

// ── Probado rompiéndolo (10/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   T1 sin el freno del atraso en la entrada                                             → fallan el 3 y el 4
//   T2 el atraso sin tope (`ahora - h <= tope` → nunca tarde)                             → fallan el 1 y el 3
//   T3 el aviso sin el registro por id (la re-entrega avisa otra vez)                     → falla el 3
//   T4 la demora sin la ventana de 3 h                                                    → falla el 2
//   T5 el cron sin la alarma de la demora                                                 → falla el 4
