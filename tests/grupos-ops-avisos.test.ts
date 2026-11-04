// =============================================================================
// TODOS los avisos caen en el grupo de la app, sin depender de WhatsApp (3/11/2026)
// =============================================================================
// El hijo corre `emitirAviso` y las puertas de lib/mako-grupo.ts de verdad: tests/_grupos-ops-avisos-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  // Una sola vez aunque falle: cada test volvería a correr el hijo, y el archivo pasaría el tope del vigía de tandas.
  if (fallo) throw fallo;
  try { return correrElHijo(); } catch (e) { fallo = e; throw e; }
}
function correrElHijo(): Record<string, any> {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupos-ops-avisos-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
const JID = '120363000000000010@g.us';
const JID_SUPER = '120363000000000009@g.us';

test('⚠️ con WhatsApp caído: la fila con su rótulo, `enApp`, la memoria, y el puente por mail sigue', () => {
  const c = R().cae;
  assert.equal(c.filas.length, 1);
  assert.equal(c.filas[0].autor, 'mako');
  assert.match(c.filas[0].texto, /¿Lo cargo al plan\?/);
  assert.equal(c.filas[0].tipo, 'prueba-aviso');
  assert.equal(c.r.enApp, true);
  assert.equal(c.r.wa, false, '`wa` sigue diciendo sólo WhatsApp');
  assert.match(c.r.waError, /Evolution 400/);
  assert.equal(c.conv.length, 1, 'un «¿lo cargo?» sin WhatsApp queda sin memoria');
  assert.equal(c.conv[0].jid, JID);
  assert.equal(c.conv[0].role, 'assistant');
  assert.match(c.conv[0].id, /^app:\d+$/, 'sin `key.id`, el id es el de la fila');
  assert.ok(c.mails >= 1, 'el puente por mail queda igual: las suscripciones de push tenían 0 filas');
  assert.deepEqual(c.notif, [null], 'la campanita diría «no llegó» con el aviso a la vista');
});

test('sin grupo de WhatsApp: la fila, y la memoria con la clave de la app; a Evolution, nada', () => {
  const s = R().sinGrupo;
  assert.equal(s.filas.length, 1);
  assert.equal(s.r.enApp, true);
  assert.equal(s.r.sinGrupo, 'app');
  assert.deepEqual(s.conv.map((x: { jid: string }) => x.jid), ['app12@g.us'], 'la clave termina en @g.us a propósito');
  assert.deepEqual(s.evolution, []);
});

test('`canal.wa` falso: se copia igual; a Evolution, nada', () => {
  const s = R().sinWa;
  assert.equal(s.filas.length, 1);
  assert.deepEqual(s.evolution, []);
});

test('lo que el negocio eligió que no salga, no se copia: una tarjeta por email, apagado, deduplicado, en cola', () => {
  const r = R();
  assert.equal(r.noSeCopia.porEmail, 0, 'la tarjeta por email ya eligió su canal, y apagado tampoco');
  assert.equal(r.noSeCopia.apagado, true);
  assert.equal(r.deduped.filas, 1);
  assert.equal(r.deduped.deduped, true);
  assert.equal(r.enCola.agrupado, true);
  assert.equal(r.enCola.filas, 0, 'lo que el negocio juntó para la mañana no interrumpe ahora');
});

test('con WhatsApp bien: la fila lleva el id que le dio WhatsApp; es lo que encuentra el eco', () => {
  const b = R().bien;
  assert.equal(b.r.wa, true);
  assert.equal(b.r.enApp, true);
  assert.equal(b.filas.length, 1);
  assert.match(b.filas[0].wa, /^env-/);
  assert.equal(b.conv[0].id, b.filas[0].wa);
});

test('por partes: una fila por parte, y el binario se sube después', () => {
  const p = R().partes;
  assert.equal(p.filas.length, 2);
  assert.equal(p.filas[0].texto, 'Mira este video');
  assert.equal(p.filas[1].adjunto.tipo, 'audio');
  assert.deepEqual(p.antesDeSubir, ['sin', null], 'la fila nace con `path` null: la tarjeta no se frena subiendo un audio');
  assert.match(p.filas[1].adjunto.path, /^grupos\/10\/.+\.ogg$/);
});

test('una tarjeta con un video: el hilo guarda el PDF y del video deja el texto', () => {
  assert.deepEqual(R().partesConVideo, [{ texto: 'Mira el video\n(un video)', adjunto: null }, { texto: 'El precio', adjunto: 'pdf' }]);
});

test('⚠️ un aviso `alDueno` va al grupo de la plataforma y NUNCA a la memoria del cliente', () => {
  for (const a of [R().alDueno, R().alDuenoCaido]) {
    assert.equal(a.deCliente, 0, 'el cliente vería avisos de agencia sobre él');
    assert.equal(a.dePlataforma, 1);
    assert.ok(a.conv.every((x: { jid: string }) => x.jid === JID_SUPER), `la memoria del cliente: ${JSON.stringify(a.conv)}`);
    assert.equal(a.conv.length, 1);
  }
});

test('una insistencia sobre lo que quedó sólo en el hilo, sólo si alguien usa el grupo', () => {
  assert.deepEqual(R().insistencia, { sinNadie: 0, conAlguien: 1, conWhatsApp: 1 });
});

test('las puertas directas: copian ellas, y `memoria: null` y `sinCopia` no', () => {
  const r = R();
  assert.equal(r.puertaMako.r.ok, true);
  assert.equal(r.puertaMako.r.enApp, true);
  assert.match(r.puertaMako.r.id, /^app:\d+$/);
  assert.equal(r.puertaMako.filas.length, 1);
  assert.equal(r.puertaMako.conv.length, 1, 'la memoria corre una vez');
  assert.equal(r.puertaEquipo.filas[0].autor, 'equipo');
  assert.equal(r.puertaEquipo.conv.length, 0, 'lo del equipo no es un turno de MaKo: un «sí» a eso no confirma');
  assert.match(r.puertaEquipo.anillo[0], /"id":"app:\d+"/);
  assert.equal(r.puertaNula.filas, 0);
  assert.equal(r.puertaNula.r.ok, false);
  assert.equal(r.superAdmin.conCopia, 1);
  assert.equal(r.superAdmin.superCon.enApp, true);
  assert.equal(r.superAdmin.sinCopia, 0);
  assert.equal(r.superAdmin.superSin.ok, false);
  assert.equal(r.sinContexto.filas, 0, 'el panel de /agencia se ve por su eco; sin contexto no se copia');
});

test('el contexto del turno: sólo de la app, no toca Evolution; mixto, a los dos; una clave de la app nunca llega', () => {
  const r = R();
  assert.equal(r.contextoSoloApp.filas.length, 1);
  assert.deepEqual(r.contextoSoloApp.evolution, []);
  assert.match(r.contextoSoloApp.r.id, /^app:/);
  assert.equal(r.contextoMixto.filas.length, 1);
  assert.equal(r.contextoMixto.evolution.length, 1);
  assert.match(r.contextoMixto.filas[0].wa, /^env-/);
  assert.equal(r.claveDeLaApp.filas.length, 1);
  assert.deepEqual(r.claveDeLaApp.evolution, []);
});

test('⚠️ reintentos sin burbujas de más, con WhatsApp caído', () => {
  const r = R();
  assert.equal(r.ticket.t1, true, 'el aviso de un ticket quedó en el hilo: salió');
  assert.equal(r.ticket.t2, false, 'ya estaba avisado');
  assert.equal(r.ticket.filas, 1, 'cada corrida del cron sumaba una burbuja');
  assert.equal(r.ticket.avisado, true);
  assert.equal(r.arreglo.a1.ok, true);
  assert.equal(r.arreglo.a2.motivo, 'ya-avisado', 'la reserva no se borra si quedó en el hilo');
  assert.equal(r.arreglo.filas, 1);
  assert.equal(r.consumidores.llego, true);
  assert.equal(r.consumidores.noLlego, false);
  assert.deepEqual(r.consumidores.resultado, { ok: true, resumen: 'Le avisé al equipo.' }, 'el motor dispararía el aviso de respaldo: doble burbuja, con «Evolution 400»');
  assert.equal(r.consumidores.sinCopia.ok, false);
});

test('la copia no frena ni tira el envío', () => {
  const r = R();
  assert.equal(r.colgada.r.ok, true);
  assert.equal(r.colgada.evolution.length, 1);
  assert.ok(r.colgada.ms < 4500, `esperó ${r.colgada.ms} ms a una base colgada`);
  assert.equal(r.rota.ok, true);
  assert.equal(r.rota.wa, true);
  assert.equal(r.rota.enApp, false);
  assert.equal(r.rota.evolution.length, 1);
});

test('la copia tapa las claves: el hilo lo lee gente de otro negocio', () => {
  assert.equal(R().copiaTapa.enLaBase, false);
  assert.match(R().copiaTapa.texto, /\[clave tapada\]/);
});

test('el push: los miembros de verdad, sin ?ws=, sin el super admin; y las preferencias de cada uno', () => {
  const { aTodos, sinAdmins, conPreferencias } = R().push;
  const a = aTodos.map((p: { a: string }) => p.a).sort();
  assert.deepEqual(a, ['agencia', 'ana', 'cris'], `sin el super admin: le sonaría cada cliente. Le llegó a ${a}`);
  for (const p of aTodos) assert.ok(!String(p.cuerpo.url).includes('ws='), `sin ?ws=: ${p.cuerpo.url}`);
  const deCris = aTodos.find((p: { a: string }) => p.a === 'cris').cuerpo;
  // Con la marca y no con «no dice hola-mako.com»: el payload corta en la primera frase, y un link se corta en su primer punto.
  assert.match(String(deCris.cuerpo), /\(en MaKo\)/, `un invitado no recibe links: ${deCris.cuerpo}`);
  assert.equal(deCris.titulo, 'Grupo de Fiesta');
  const deAna = aTodos.find((p: { a: string }) => p.a === 'ana').cuerpo;
  assert.equal(deAna.titulo, 'MaKo <> Fiesta');
  assert.match(String(deAna.url), /grupo=10/);
  assert.equal(deAna.tag, 'grupo:10', 'se reemplaza y no apila');
  assert.ok(!sinAdmins.includes('ana'), 'el aviso ya le sonó por `enviarPushAviso`: no suena dos veces');
  assert.ok(sinAdmins.includes('cris') && sinAdmins.includes('agencia'));
  assert.deepEqual(conPreferencias, [], `con el interruptor, el grupo apagado y «No molestar», nadie: ${conPreferencias}`);
});

test('un closer invitado sin preferencias guardadas lo recibe: `normalizarPush` lo daría apagado', () => {
  assert.ok(R().push.aTodos.some((p: { a: string }) => p.a === 'cris'));
});

// PROBADO ROMPIÉNDOLO (3/11/2026): una rotura por vez sobre el código real, corriendo este archivo, y restaurada. Las 18 dieron rojo:
//   · emitirAviso no copia → 8 en rojo: «⚠️ con WhatsApp caído: la fila con su rótulo, `enApp`, la me»
//   · la memoria sólo con WhatsApp → 4 en rojo: «⚠️ con WhatsApp caído: la fila con su rótulo, `enApp`, la me»
//   · sin enApp en enviarAlGrupoMaKo → 2 en rojo: «las puertas directas: copian ellas, y `memoria: null` y `sin»
//   · alDueno a la memoria del cliente → 1 en rojo: «⚠️ un aviso `alDueno` va al grupo de la plataforma y NUNCA a»
//   · la campanita dice no llegó → 1 en rojo: «⚠️ con WhatsApp caído: la fila con su rótulo, `enApp`, la me»
//   · la copia sin tope → 1 en rojo: «la copia no frena ni tira el envío»
//   · la copia tira → 15 en rojo: «⚠️ con WhatsApp caído: la fila con su rótulo, `enApp`, la me»
//   · la insistencia sin nadie en la app → 1 en rojo: «una insistencia sobre lo que quedó sólo en el hilo, sólo si»
//   · la copia en el ws del cliente → 1 en rojo: «⚠️ un aviso `alDueno` va al grupo de la plataforma y NUNCA a»
//   · resultadoDelAviso no mira enApp → 1 en rojo: «⚠️ reintentos sin burbujas de más, con WhatsApp caído»
//   · un soloApp va a Evolution → 1 en rojo: «el contexto del turno: sólo de la app, no toca Evolution; mi»
//   · la copia no tapa → 1 en rojo: «la copia tapa las claves: el hilo lo lee gente de otro negoc»
//   · push con normalizarPush → 2 en rojo: «el push: los miembros de verdad, sin ?ws=, sin el super admi»
//   · push ignora pushYaSalio → 1 en rojo: «el push: los miembros de verdad, sin ?ws=, sin el super admi»
//   · push con ?ws= → 1 en rojo: «el push: los miembros de verdad, sin ?ws=, sin el super admi»
//   · push sin links para el invitado → 1 en rojo: «el push: los miembros de verdad, sin ?ws=, sin el super admi»
//   · la tarjeta por email se copia → 1 en rojo: «lo que el negocio eligió que no salga, no se copia: una tarj»
//   · la tarjeta con video como PDF → 1 en rojo: «una tarjeta con un video: el hilo guarda el PDF y del video»
