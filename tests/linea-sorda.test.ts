// =============================================================================
// La voz de MaKo que MANDA y no RECIBE (11/11/2026, «MaKo no responde nada»; Código Inmobiliario)
// =============================================================================
// De las 12:14 a las 21:51 UTC la voz estuvo `open`, contestaba la sonda y mandaba avisos, y no le entró un solo mensaje de una persona.
// Ni la sonda ni la alarma de demora la vieron; un `restart` no la curó. La causa de fondo (informe de esa noche): Evolution 2.3.7 con
// Baileys rc.9 traba los dispositivos de a uno. Lo que fija (lib/linea-sorda.ts, lib/canal-vigilante.ts):
//   1. cuándo está sorda: con el reloj real de ese día, de día y de noche, y con la otra línea viendo lo que la voz no;
//   2. la ráfaga del informe: MaKo mandó 2 o más a grupos en 30 min y no entró nada — la habría visto a las 14:10, no a las 15:20;
//      y sólo cuenta lo de DESPUÉS de vincularse (el store sin duplicados ni reacciones);
//   3. qué hace: avisa con el QR en un paso, repite cada 3 h, cierra cuando vuelve a recibir. ⛔ Nunca reinicia;
//   4. la función REAL del servidor (tests/_linea-sorda-hijo.ts): el mail y la campanita (nunca por WhatsApp), la marca que lee el panel,
//      y la voz recién re-vinculada que no se marca;
//   5. el cableado: corre en el cron alerta-critica, y no hay un `restart` en el código.
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ajenosQueLaVozNoVio, avisoDeSordera, estaSorda, horarioActivo, lecturaDeLaVoz, queHacerConLaSordera, RAFAGA_MS, REPETIR_QR_MS, SORDA_MS, type MarcaDeSordera } from '../lib/linea-sorda';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const T = (iso: string) => Date.parse(iso);
const S = (iso: string) => Math.floor(T(iso) / 1000);
// El 11/11: lo último de una persona (Patricia) a las 12:14; MaKo mandó a las 14:03, 14:07 y 20:39.
const DIA = { ultimaPersonaMs: T('2026-11-11T12:14:14Z'), ultimoPropioMs: T('2026-11-11T14:07:52Z'), ajenosQueNoVio: 0 };
const CODIGO = '120363429866357487@g.us', PATRICIA = '120363431445507386@g.us';
const propio = (id: string, iso: string, jid = CODIGO, tipo = 'conversation') => ({ key: { id, fromMe: true, remoteJid: jid }, messageTimestamp: S(iso), messageType: tipo });
const persona = (id: string, iso: string, jid = CODIGO) => ({ key: { id, fromMe: false, remoteJid: jid, participantAlt: '5491100000022@s.whatsapp.net' }, messageTimestamp: S(iso), messageType: 'conversation' });

test('1. cuándo está sorda: manda y no recibe en horario activo; la otra línea ve lo que ella no', () => {
  assert.equal(estaSorda(DIA, T('2026-11-11T14:10:00Z')).sorda, false, '1 h 56 min sin una persona, sin ráfaga, todavía es silencio');
  assert.deepEqual(estaSorda(DIA, T('2026-11-11T15:20:00Z')), { sorda: true, motivo: 'manda y no recibe de una persona hace 3.1 h' });
  assert.equal(SORDA_MS, 3 * 3_600_000);
  // De noche el silencio no dice nada (00:30 de Argentina).
  assert.equal(horarioActivo(T('2026-11-12T03:30:00Z')), false);
  assert.equal(estaSorda({ ...DIA, ultimoPropioMs: T('2026-11-12T03:00:00Z') }, T('2026-11-12T03:30:00Z')).sorda, false);
  // Si MaKo tampoco mandó nada desde el último mensaje de una persona, es un día quieto, no sordera.
  assert.equal(estaSorda({ ...DIA, ultimoPropioMs: T('2026-11-11T12:00:00Z') }, T('2026-11-11T16:00:00Z')).sorda, false);
  // La prueba directa: otra línea del grupo vio mensajes de personas que la voz no tiene (a cualquier hora).
  assert.deepEqual(estaSorda({ ...DIA, ajenosQueNoVio: 3 }, T('2026-11-12T03:30:00Z')), { sorda: true, motivo: 'otra línea vio 3 mensaje(s) de personas que la voz no tiene' });
  assert.equal(estaSorda({ ultimaPersonaMs: T('2026-11-11T15:00:00Z'), ultimoPropioMs: T('2026-11-11T15:10:00Z'), ajenosQueNoVio: 0 }, T('2026-11-11T15:20:00Z')).sorda, false, 'recibe');
  // Recién vinculada (21:51) y nadie escribió todavía: el silencio se cuenta desde el QR, no desde siempre.
  assert.equal(estaSorda({ ultimaPersonaMs: null, ultimoPropioMs: T('2026-11-11T22:30:00Z'), ajenosQueNoVio: 0, vinculadaDesdeMs: T('2026-11-11T21:51:00Z') }, T('2026-11-11T23:00:00Z')).sorda, false, 'marcó sorda una voz recién vinculada');
});

test('2. la ráfaga: 2 o más a grupos en 30 min sin que entre nada; sólo lo de después de vincularse', () => {
  assert.equal(RAFAGA_MS, 30 * 60_000);
  // El store REAL de ese día: cada envío guardado dos veces con el mismo id, y un 👍.
  const store = [persona('P-1214', '2026-11-11T12:14:14Z', PATRICIA), propio('M-1403', '2026-11-11T14:03:34Z'), propio('M-1403', '2026-11-11T14:03:34Z'),
    propio('M-1407', '2026-11-11T14:07:52Z'), propio('M-1407', '2026-11-11T14:07:52Z'), propio('R-1408', '2026-11-11T14:08:00Z', CODIGO, 'reactionMessage')];
  const l = lecturaDeLaVoz(store, T('2026-11-11T14:10:00Z'));
  assert.equal(l.aGruposEnRafaga, 2, 'contó los duplicados o el 👍');
  assert.equal(l.entroEnRafaga, false);
  assert.deepEqual(estaSorda({ ...l, ajenosQueNoVio: 0 }, T('2026-11-11T14:10:00Z')), { sorda: true, motivo: 'mandó 2 mensajes a grupos en 30 min y no entró ninguno' }, 'con la ráfaga la ve a las 14:10');
  // Una RESPUESTA en dos partes tiene su pedido justo antes: no es ráfaga sorda (Joan 13:50, MaKo 14:03 y 14:07).
  const conPedido = lecturaDeLaVoz([...store, persona('J-1350', '2026-11-11T13:50:00Z')], T('2026-11-11T14:10:00Z'));
  assert.equal(estaSorda({ ...conPedido, ajenosQueNoVio: 0 }, T('2026-11-11T14:10:00Z')).sorda, false, 'una respuesta en dos partes salió como sorda');
  // Un solo mensaje no es ráfaga; de noche, tampoco.
  assert.equal(estaSorda({ ...lecturaDeLaVoz(store.slice(0, 3), T('2026-11-11T14:10:00Z')), ajenosQueNoVio: 0 }, T('2026-11-11T14:10:00Z')).sorda, false);
  const noche = [propio('N-1', '2026-11-12T03:00:00Z'), propio('N-2', '2026-11-12T03:10:00Z')];
  assert.equal(estaSorda({ ...lecturaDeLaVoz(noche, T('2026-11-12T03:20:00Z')), ajenosQueNoVio: 0 }, T('2026-11-12T03:20:00Z')).sorda, false);
  // Lo de ANTES del último QR es de otro dispositivo: no cuenta.
  const tras = lecturaDeLaVoz(store, T('2026-11-11T14:10:00Z'), { vinculadaDesdeMs: T('2026-11-11T14:09:00Z') });
  assert.deepEqual([tras.aGruposEnRafaga, tras.ultimoPropioMs, tras.ultimaPersonaMs], [0, null, null]);
  // Lo que MaKo escribió visto como ajeno (su número en participantAlt) no es una persona.
  const eco = lecturaDeLaVoz([propio('M-1', '2026-11-11T14:03:00Z'), { ...persona('E-1', '2026-11-11T14:04:00Z'), key: { id: 'E-1', fromMe: false, remoteJid: CODIGO, participantAlt: '5491125052605@s.whatsapp.net' } }], T('2026-11-11T14:10:00Z'), { esDeMaKo: (alt) => String(alt).includes('25052605') });
  assert.equal(eco.ultimaPersonaMs, null);
});

test('3. qué hace: avisa con el QR en un paso, repite cada 3 h, cierra al volver; nunca reinicia', () => {
  const extra = { linea: 'mako_superadmin_muylqv8r', vinculadaDesde: T('2026-11-11T02:51:07Z'), motivo: 'x' };
  const a = queHacerConLaSordera(true, null, T('2026-11-11T14:10:00Z'), extra);
  assert.equal(a.accion, 'avisar');
  assert.deepEqual([a.marca?.linea, a.marca?.vinculadaDesde], [extra.linea, extra.vinculadaDesde], 'la marca no lleva lo que lee el panel');
  assert.equal(queHacerConLaSordera(true, a.marca, T('2026-11-11T14:20:00Z'), extra).accion, 'nada', 'repitió el aviso a los 10 min');
  assert.equal(REPETIR_QR_MS, 3 * 3_600_000);
  const c = queHacerConLaSordera(true, a.marca, T('2026-11-11T17:10:00Z'), extra);
  assert.equal(c.accion, 'pedir-qr', 'a las 3 h no insistió con el QR');
  assert.equal(queHacerConLaSordera(true, c.marca, T('2026-11-11T18:00:00Z'), extra).accion, 'nada');
  // ⚠️ CAMBIADO A PROPÓSITO el 12/11/2026: «volvió» pide la PRUEBA, una persona con hora posterior a la marca (Joan, 22:00).
  assert.deepEqual(queHacerConLaSordera(false, c.marca, T('2026-11-11T22:05:00Z'), extra, T('2026-11-11T22:00:00Z')), { accion: 'volvio', marca: null });
  assert.deepEqual(queHacerConLaSordera(false, null, T('2026-11-11T22:05:00Z')), { accion: 'nada', marca: null });
  // Sin la prueba (de noche «fuera de horario», o MaKo sin mandar nada) la marca QUEDA: antes, a las 23 se borraba con un «volvió» falso.
  assert.deepEqual(queHacerConLaSordera(false, c.marca, T('2026-11-12T02:30:00Z'), extra, T('2026-11-11T12:14:14Z')), { accion: 'nada', marca: c.marca }, 'la noche borró la marca');
  assert.deepEqual(queHacerConLaSordera(false, c.marca, T('2026-11-12T02:30:00Z'), extra), { accion: 'nada', marca: c.marca });
  // Lo que llega tarde, en tanda, trae su hora vieja: no es la prueba de que volvió.
  assert.equal(queHacerConLaSordera(false, c.marca, T('2026-11-12T06:00:00Z'), extra, T('2026-11-11T13:30:00Z')).accion, 'nada');
  // Re-vinculada después de marcarla: la marca es de otro dispositivo; se limpia, sin aviso.
  assert.deepEqual(queHacerConLaSordera(false, c.marca, T('2026-11-11T23:30:00Z'), { ...extra, vinculadaDesde: T('2026-11-11T21:50:20Z') }), { accion: 'nada', marca: null });
  // La marca de la versión que reiniciaba (desplegada sólo en la punta) se lee: lo último que se avisó.
  const vieja = { desde: '2026-11-11T15:20:00.000Z', reiniciadaAt: '2026-11-11T15:20:00.000Z', qrPedidoAt: '2026-11-11T15:41:00.000Z' } as unknown as MarcaDeSordera;
  assert.equal(queHacerConLaSordera(true, vieja, T('2026-11-11T16:00:00Z')).accion, 'nada');
  assert.equal(queHacerConLaSordera(true, vieja, T('2026-11-11T18:41:00Z')).accion, 'pedir-qr');
  const aviso = avisoDeSordera('avisar', 'mandó 2 mensajes a grupos en 30 min y no entró ninguno', 'mako_superadmin_muylqv8r');
  assert.doesNotMatch(aviso.cuerpo, /reinici[eé]/i, 'el aviso dice que la reinició');
  assert.match(aviso.cuerpo, /Un reinicio no la cura/);
  assert.match(aviso.cuerpo, /«Conectar por QR»: como está marcada sorda, la desvincula sola y muestra el QR/);
  assert.match(aviso.cuerpo, /Baileys 7\.0\.0-rc\.9/);
});

test('4. la función real: mail y campanita (nunca WhatsApp), la marca para el panel, sin reiniciar', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_linea-sorda-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@SORDA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@SORDA@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.deepEqual([o.antes.r.accion, o.antes.mails.length], ['nada', 0], 'antes de los envíos de las 14:03 no hay nada que ver');
  assert.equal(o.sorda.r.accion, 'avisar');
  assert.match(o.sorda.r.motivo, /mandó 2 mensajes a grupos en 30 min y no entró ninguno/);
  assert.deepEqual(o.sorda.mails, ['La voz de MaKo no recibe mensajes']);
  assert.deepEqual(o.sorda.campanita, ['La voz de MaKo no recibe mensajes']);
  const marca = JSON.parse(o.sorda.marca);
  assert.deepEqual([marca.linea, marca.vinculadaDesde], ['mako_superadmin_muylqv8r', T('2026-11-11T02:51:07Z')], 'la marca no dice sobre qué vinculación se midió');
  assert.deepEqual([o.diezMin.r.accion, o.diezMin.mails.length], ['nada', 0]);
  assert.deepEqual([o.tresHoras.r.accion, o.tresHoras.mails], ['pedir-qr', ['La voz de MaKo sigue sorda: hace falta el QR']]);
  assert.deepEqual([o.volvio.r.accion, o.volvio.mails, o.volvio.marca], ['volvio', ['La voz de MaKo volvió a recibir'], '']);
  // Martín la re-vinculó: lo de antes del QR (los envíos de la tarde, ya sin nadie que escriba) no la vuelve a marcar.
  assert.deepEqual([o.reVinculada.r.accion, o.reVinculada.r.sorda, o.reVinculada.mails.length], ['nada', false, 0], JSON.stringify(o.reVinculada.r));
  // La noche del 12/11, con el store real de esa noche: Mauricio a las 00:40 UTC, MaKo manda a la 01:04, 02:50 y 03:31, y nada más.
  // A las 9 de Argentina la marca (antes no puede: de noche nadie escribe); a las 23:30 la noche NO la borra; la tanda que llega tarde
  // (el mensaje de las 05:44, con su hora vieja) tampoco; se cierra cuando escribe una persona.
  const n = o.nocheDel12;
  assert.deepEqual([n.antesDeLas9.r.accion, n.antesDeLas9.r.motivo, n.antesDeLas9.mails.length], ['nada', 'fuera de horario', 0]);
  assert.deepEqual([n.alas9.r.accion, n.alas9.mails], ['avisar', ['La voz de MaKo no recibe mensajes']]);
  assert.match(n.alas9.r.motivo, /manda y no recibe de una persona hace 11\.3 h/);
  assert.deepEqual([n.alas2330.r.accion, n.alas2330.mails, !!n.alas2330.marca], ['nada', [], true], 'a las 23 la noche borró la marca con un «volvió» falso');
  assert.deepEqual([n.tanda.r.accion, n.tanda.mails, !!n.tanda.marca], ['nada', [], true], 'la tanda atrasada cerró la marca');
  assert.deepEqual([n.volvio.r.accion, n.volvio.mails, n.volvio.marca], ['volvio', ['La voz de MaKo volvió a recibir'], '']);
  assert.deepEqual([n.reVinculadaConMarca.r.accion, n.reVinculadaConMarca.mails, n.reVinculadaConMarca.marca], ['nada', [], ''], 'la marca de un dispositivo viejo quedó (o avisó un «volvió» sin prueba)');
  for (const k of ['antesDeLas9', 'alas9', 'alas2330', 'tanda', 'volvio', 'reVinculadaConMarca']) assert.equal(n[k].whatsapp + n[k].reinicios, 0, k);
  // 13/11 18:20: lo que la línea de Martín ve en sus grupos personales no marca la voz; lo de un grupo de MaKo que la voz no tiene, sí.
  const ol = o.otraLinea;
  assert.deepEqual([ol.personales.r.accion, ol.personales.r.sorda, ol.personales.mails, ol.personales.marca], ['nada', false, [], ''],
    `los grupos personales de Martín marcaron sorda la voz: ${JSON.stringify(ol.personales.r)}`);
  assert.deepEqual([ol.deMaKo.r.accion, ol.deMaKo.r.motivo], ['avisar', 'otra línea vio 1 mensaje(s) de personas que la voz no tiene']);
  for (const k of ['personales', 'deMaKo']) assert.equal(ol[k].whatsapp + ol[k].reinicios, 0, k);
  for (const k of ['antes', 'sorda', 'diezMin', 'tresHoras', 'volvio', 'reVinculada']) {
    assert.equal(o[k].whatsapp, 0, `${k}: la alarma de la voz salió por la voz`);
    assert.equal(o[k].reinicios, 0, `${k}: reinició la voz (un restart no la cura)`);
  }
});

test('5. el cableado: corre en el cron alerta-critica; ningún `restart` en el código', () => {
  assert.match(sinComentarios(leer('app/api/cron/alerta-critica/route.ts')), /const sorda = await vigilarSorderaDeLaVoz\(\)\.catch\(/);
  const vig = sinComentarios(leer('lib/canal-vigilante.ts'));
  assert.match(vig, /await avisarPorEmail\(wsSA, aviso\.titulo, aviso\.cuerpo\);/);
  assert.match(vig, /tipo: 'voz-sorda'/);
  assert.match(vig, /queHacerConLaSordera\(sorda, marca, ahora, \{ linea: voz, vinculadaDesde: vinculadaDesdeMs, motivo \}, lectura\.ultimaPersonaMs\)/, 'sin la prueba, cualquier «no sé» cierra la marca');
  const conRestart = readdirSync(new URL('../lib/', import.meta.url), { recursive: true }).map(String).filter((f) => f.endsWith('.ts'))
    .filter((f) => /instance\/restart/.test(sinComentarios(leer(`lib/${f.replace(/\\/g, '/')}`))));
  assert.deepEqual(conRestart, [], 'volvió un POST /instance/restart: no cura una línea sorda (informe del 11/11)');
});

test('6. la otra línea sólo cuenta los grupos de MaKo (13/11/2026 18:20: falsa alarma con los grupos personales de Martín)', () => {
  // La voz volvió al …2605 a las 17:12 y el …3479 (el personal de Martín) quedó como «la otra». A las 18:20 la marca dijo «otra línea vio 6
  // mensaje(s)…»: los 6 eran de 3 grupos personales suyos donde la voz no está; en el grupo de MaKo que comparten, la voz los tenía todos.
  const ahoraMs = T('2026-11-13T18:20:30Z');
  const PERSONAL_1 = '120363000000000001@g.us', PERSONAL_2 = '120363000000000002@g.us', PERSONAL_3 = '120363000000000003@g.us';
  const MAURICIO = '120363421096661065@g.us';
  const deOtra = [
    persona('A1', '2026-11-13T17:13:18Z', PERSONAL_1), persona('A2', '2026-11-13T16:08:51Z', PERSONAL_2), persona('A3', '2026-11-13T16:01:11Z', PERSONAL_1),
    persona('A4', '2026-11-13T15:59:48Z', PERSONAL_3), persona('A5', '2026-11-13T15:59:38Z', PERSONAL_3), persona('A6', '2026-11-13T15:59:31Z', PERSONAL_3),
    persona('M1', '2026-11-13T15:59:48Z', MAURICIO), persona('M2', '2026-11-13T15:58:01Z', MAURICIO),
  ];
  const base = { vistos: new Set(['M1', 'M2']), gruposDeMaKo: new Set([MAURICIO, CODIGO]), vinculadaDesdeMs: T('2026-11-12T12:13:07Z'), ahoraMs, esDeMaKo: () => false };
  assert.equal(ajenosQueLaVozNoVio(deOtra, base), 0, 'contó los grupos personales de Martín: la voz estaba bien');
  assert.equal(estaSorda({ ultimaPersonaMs: T('2026-11-13T15:59:48Z'), ultimoPropioMs: T('2026-11-13T16:00:30Z'), ajenosQueNoVio: ajenosQueLaVozNoVio(deOtra, base) }, ahoraMs).sorda, false);
  // La prueba directa sigue: un mensaje en un grupo de MaKo que la voz no tiene, sí cuenta (una vez, aunque el store lo traiga dos veces).
  const perdido = persona('C1', '2026-11-13T17:40:00Z', CODIGO);
  assert.equal(ajenosQueLaVozNoVio([...deOtra, perdido, perdido], base), 1, 'un mensaje de un grupo de MaKo que la voz no vio ya no cuenta');
  // Lo que ya filtraba: lo propio, lo de MaKo, las reacciones, lo de antes de vincularse, lo de hace más de 3 h y lo de hace menos de 10 min.
  const C = (id: string, iso: string) => persona(id, iso, CODIGO);
  assert.equal(ajenosQueLaVozNoVio([propio('P1', '2026-11-13T17:40:00Z'), { ...C('R1', '2026-11-13T17:40:00Z'), messageType: 'reactionMessage' },
    C('V1', '2026-11-12T12:00:00Z'), C('H1', '2026-11-13T15:10:00Z'), C('N1', '2026-11-13T18:15:00Z')], base), 0);
  assert.equal(ajenosQueLaVozNoVio([C('K1', '2026-11-13T17:40:00Z')], { ...base, esDeMaKo: () => true }), 0, 'lo que escribió MaKo, visto desde la otra');
  // Sin la lista de grupos (no se pudo leer) no cuenta nada: un error no es una sordera.
  assert.equal(ajenosQueLaVozNoVio([perdido], { ...base, gruposDeMaKo: new Set<string>() }), 0);
  // El cableado: el detector le pasa los grupos de MaKo leídos estricto, y sin ellos no cuenta.
  const vig = sinComentarios(leer('lib/canal-vigilante.ts'));
  assert.match(vig, /const gruposDeMaKo = otra && otra !== voz \? await gruposDeMaKoEstricto\(\)\.catch\(\(\) => null\) : null;/);
  assert.match(vig, /if \(otra && otra !== voz && gruposDeMaKo\?\.size\) \{/);
  assert.match(vig, /ajenosQueNoVio = ajenosQueLaVozNoVio\(deOtra, \{ vistos, gruposDeMaKo,/);
  assert.match(vig, /\.in\('key', \[KEY_GRUPO_JID, KEY_GRUPO_SUPERADMIN\]\)/);
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   S1 sin mirar si MaKo mandó después del último mensaje de una persona          → falla el 1
//   S2 sin el horario activo                                                       → fallan el 1 y el 2
//   S3 la ráfaga sin buscar el pedido de media hora antes                          → falla el 2
//   S4 la ráfaga contando duplicados y reacciones                                  → fallan el 2 y el 4
//   S5 sin recortar lo de antes de vincularse                                      → falla el 2
//   S6 vuelve el reinicio en el primer aviso                                       → fallan el 4 y el 5
//   S7 el cron sin el detector                                                     → falla el 5
// ── Probado rompiéndolo (12/11/2026, «no está sorda» no es «volvió»; base 5/0) ──────────────────────────────────────────
//   D1 la versión de antes: cualquier «no está sorda» cierra la marca               → fallan el 3 y el 4
//   D2 el cron sin pasarle la prueba (`lectura.ultimaPersonaMs`)                     → fallan el 4 y el 5
//   D3 la marca vieja no se borra (sólo se escribe si hay una nueva)                 → falla el 4
//   D4 la tanda atrasada (con su hora vieja) cuenta como prueba                      → fallan el 3 y el 4
//   D5 sin limpiar la marca de un dispositivo viejo                                  → fallan el 3 y el 4
// ── Probado rompiéndolo (13/11/2026, la otra línea y los grupos personales de Martín; base 6/0) ─────────────────────────────
//   O1 la otra línea cuenta cualquier grupo (la versión de antes)                    → fallan el 4 y el 6
//   O2 el detector no le pasa los grupos de MaKo (cuenta todos)                      → fallan el 4 y el 6
//   O3 sin sacar los duplicados del store de la otra                                 → falla el 6
//   O4 los grupos de MaKo sin el «MaKo <> cliente» (sólo el del super admin)         → fallan el 4 y el 6
//   O5 sin la lista de grupos, cuenta todo                                           → falla el 6
