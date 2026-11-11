// =============================================================================
// La voz de MaKo que MANDA y no RECIBE (11/11/2026, «MaKo no responde nada»; Código Inmobiliario)
// =============================================================================
// De las 12:14 a las 21:3x UTC la voz estuvo `open`, contestaba la sonda y mandaba avisos, y no le entró un solo mensaje de una persona.
// Ni la sonda ni la alarma de demora la vieron; un `restart` no la curó. Lo que fija (lib/linea-sorda.ts, lib/canal-vigilante.ts):
//   1. cuándo está sorda: con el reloj real de ese día, de día y de noche, y con la otra línea viendo lo que la voz no;
//   2. qué hace: reinicia UNA vez y pide el QR, espera, insiste a los 20 min, y cierra cuando vuelve a recibir;
//   3. la función REAL del servidor (tests/_linea-sorda-hijo.ts): el reinicio, el mail y la campanita, nunca por WhatsApp;
//   4. el cableado: corre en el cron alerta-critica.
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { avisoDeSordera, estaSorda, horarioActivo, queHacerConLaSordera, ESPERA_TRAS_REINICIO_MS, SORDA_MS } from '../lib/linea-sorda';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const T = (iso: string) => Date.parse(iso);
// El 11/11: lo último de una persona (Patricia) a las 12:14; MaKo mandó a las 14:03, 14:07 y 20:39.
const DIA = { ultimaPersonaMs: T('2026-11-11T12:14:14Z'), ultimoPropioMs: T('2026-11-11T14:07:52Z'), ajenosQueNoVio: 0 };

test('1. cuándo está sorda: manda y no recibe en horario activo; la otra línea ve lo que ella no', () => {
  assert.equal(estaSorda(DIA, T('2026-11-11T14:10:00Z')).sorda, false, '1 h 56 min sin una persona todavía es silencio');
  const s = estaSorda(DIA, T('2026-11-11T15:20:00Z'));
  assert.deepEqual(s, { sorda: true, motivo: 'manda y no recibe de una persona hace 3.1 h' });
  assert.equal(SORDA_MS, 3 * 3_600_000);
  // De noche el silencio no dice nada (00:30 de Argentina).
  assert.equal(horarioActivo(T('2026-11-12T03:30:00Z')), false);
  assert.equal(estaSorda({ ...DIA, ultimoPropioMs: T('2026-11-12T03:00:00Z') }, T('2026-11-12T03:30:00Z')).sorda, false);
  // Si MaKo tampoco mandó nada desde el último mensaje de una persona, es un día quieto, no sordera.
  assert.equal(estaSorda({ ...DIA, ultimoPropioMs: T('2026-11-11T12:00:00Z') }, T('2026-11-11T16:00:00Z')).sorda, false);
  // La prueba directa: otra línea del grupo vio mensajes de personas que la voz no tiene (a cualquier hora).
  assert.deepEqual(estaSorda({ ...DIA, ajenosQueNoVio: 3 }, T('2026-11-12T03:30:00Z')), { sorda: true, motivo: 'otra línea vio 3 mensaje(s) de personas que la voz no tiene' });
  assert.equal(estaSorda({ ultimaPersonaMs: T('2026-11-11T15:00:00Z'), ultimoPropioMs: T('2026-11-11T15:10:00Z'), ajenosQueNoVio: 0 }, T('2026-11-11T15:20:00Z')).sorda, false, 'recibe');
});

test('2. qué hace: reinicia UNA vez y pide el QR; insiste a los 20 min; cierra al volver', () => {
  const a = queHacerConLaSordera(true, null, T('2026-11-11T15:20:00Z'));
  assert.equal(a.accion, 'reiniciar-y-avisar');
  const b = queHacerConLaSordera(true, a.marca, T('2026-11-11T15:30:00Z'));
  assert.equal(b.accion, 'nada', 'repitió el reinicio o el aviso a los 10 min');
  assert.equal(ESPERA_TRAS_REINICIO_MS, 20 * 60_000);
  const c = queHacerConLaSordera(true, b.marca, T('2026-11-11T15:41:00Z'));
  assert.equal(c.accion, 'pedir-qr', 'el reinicio no la curó y no se pidió el QR');
  assert.equal(queHacerConLaSordera(true, c.marca, T('2026-11-11T16:00:00Z')).accion, 'nada', 'el QR se pidió de nuevo a los 19 min');
  assert.equal(queHacerConLaSordera(true, c.marca, T('2026-11-11T18:41:00Z')).accion, 'pedir-qr', 'a las 3 h, otra vez');
  assert.deepEqual(queHacerConLaSordera(false, c.marca, T('2026-11-11T22:05:00Z')), { accion: 'volvio', marca: null });
  assert.deepEqual(queHacerConLaSordera(false, null, T('2026-11-11T22:05:00Z')), { accion: 'nada', marca: null });
  // El aviso lleva los pasos del QR desde el primero: un reinicio casi nunca la cura.
  const aviso = avisoDeSordera('reiniciar-y-avisar', 'manda y no recibe de una persona hace 3.1 h', 'mako_superadmin_muylqv8r');
  assert.match(aviso.cuerpo, /La reinicié; un reinicio casi nunca la cura/);
  assert.match(aviso.cuerpo, /Dispositivos vinculados → tocar el dispositivo de MaKo → Cerrar sesión/);
  assert.match(aviso.cuerpo, /«Conectar por QR»/);
});

test('3. la función real: reinicia, avisa por mail y campanita (nunca por WhatsApp), insiste y cierra', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_linea-sorda-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@SORDA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@SORDA@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.deepEqual([o.antes.r.accion, o.antes.reinicios.length, o.antes.mails.length], ['nada', 0, 0]);
  assert.equal(o.sorda.r.accion, 'reiniciar-y-avisar');
  assert.deepEqual(o.sorda.reinicios, ['/instance/restart/mako_superadmin_muylqv8r']);
  assert.deepEqual(o.sorda.mails, ['La voz de MaKo no recibe mensajes']);
  assert.deepEqual(o.sorda.campanita, ['La voz de MaKo no recibe mensajes']);
  assert.deepEqual([o.diezMin.r.accion, o.diezMin.reinicios.length, o.diezMin.mails.length], ['nada', 0, 0]);
  assert.deepEqual([o.veinteMin.r.accion, o.veinteMin.reinicios.length, o.veinteMin.mails], ['pedir-qr', 0, ['La voz de MaKo sigue sorda: hace falta el QR']]);
  assert.deepEqual([o.volvio.r.accion, o.volvio.mails, o.volvio.marca], ['volvio', ['La voz de MaKo volvió a recibir'], '']);
  for (const k of ['antes', 'sorda', 'diezMin', 'veinteMin', 'volvio']) assert.equal(o[k].whatsapp, 0, `${k}: la alarma de la voz salió por la voz`);
});

test('4. el cableado: corre en el cron alerta-critica, cada 10 min', () => {
  assert.match(sinComentarios(leer('app/api/cron/alerta-critica/route.ts')), /const sorda = await vigilarSorderaDeLaVoz\(\)\.catch\(/);
  const vig = sinComentarios(leer('lib/canal-vigilante.ts'));
  assert.match(vig, /if \(accion === 'reiniciar-y-avisar'\) \{\n\s*const ok = await reiniciarInstancia\(voz\)/, 'reinicia en otro momento que la primera vez');
  assert.match(vig, /await avisarPorEmail\(wsSA, aviso\.titulo, aviso\.cuerpo\);/);
  assert.match(vig, /tipo: 'voz-sorda'/);
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   S1 sin mirar si MaKo mandó después del último mensaje de una persona          → falla el 1
//   S2 sin el horario activo                                                       → falla el 1
//   S3 sin la espera tras el reinicio (pide el QR en cada corrida)                 → fallan el 2 y el 3
//   S4 reinicia en cada corrida                                                    → fallan el 2 y el 3
//   S5 el cron sin el detector                                                     → falla el 4
