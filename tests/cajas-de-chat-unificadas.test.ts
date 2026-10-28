// =============================================================================
// Todas las cajas de chat ofrecen lo mismo, y lo que no, está escrito con su porqué (28/10/2026)
// =============================================================================
// Martín (28/10): «que se pueda utilizar el chat de la misma manera en todos lados». La lista vive en lib/cajas-de-chat.ts.
// Barre el repo: una caja nueva que no esté en la lista, o una de la lista que pierda sus adjuntos o su voz, da rojo. Y la
// nota de voz que sale en el acto en las pantallas cuyo motor lee texto (app/_chat/notas-en-el-acto.ts): se dibuja ya, sale en
// orden, sobrevive a que el panel se cierre, y la que no se entendió se reintenta o se descarta.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAJAS_DE_CHAT, CAJAS_PROPIAS } from '../lib/cajas-de-chat';
import { conNotas, crearNotasEnElActo, filaDeNota } from '../app/_chat/notas-en-el-acto';
import type { ItemHilo } from '../app/m/mako/chat-ui';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const delRepo = (): string[] => execFileSync('git', ['ls-files', '-z', '--', 'app', 'components'], { cwd: raiz, encoding: 'utf8' })
  .split('\0').filter((f) => /\.tsx?$/.test(f));
const fuenteDe = (f: string) => { try { return sinComentarios(leer(f)); } catch { return ''; } };

test('toda caja de chat del repo está en la lista (una nueva no nace sin adjuntos ni voz sin que nadie lo decida)', () => {
  const archivos = delRepo();
  const conCaja = archivos.filter((f) => f.endsWith('.tsx') && /<CajaChat[\s{/]/.test(fuenteDe(f)));
  const enLista = new Set(CAJAS_DE_CHAT.map((c) => c.archivo));
  assert.deepEqual(conCaja.filter((f) => !enLista.has(f)), [], 'una caja de chat nueva: súmala a lib/cajas-de-chat.ts con lo que ofrece, o con su porqué');
  assert.deepEqual([...enLista].filter((f) => !conCaja.includes(f)), [], 'la lista nombra una caja que ya no existe');
  // Las cajas propias que graban una nota (no son CajaChat): también en la lista.
  const propias = archivos.filter((f) => !f.startsWith('app/_chat/') && /\buseNotaQueSeManda\(/.test(fuenteDe(f)));
  assert.deepEqual(propias.sort(), CAJAS_PROPIAS.map((c) => c.archivo).sort(), 'una caja propia nueva: súmala a CAJAS_PROPIAS');
});

test('cada caja ofrece adjuntos y voz, salvo lo que la lista dice con su porqué', () => {
  const mal: string[] = [];
  for (const c of [...CAJAS_DE_CHAT, ...CAJAS_PROPIAS]) {
    const fuente = fuenteDe(c.props ?? c.archivo);
    const tieneAdjuntos = /\badjuntos(=\{|:)/.test(fuente);
    const tieneVoz = /\b(voz|onGrabada)(=\{|:)/.test(fuente);
    if (!c.falta?.adjuntos && !tieneAdjuntos) mal.push(`${c.archivo}: sin adjuntos`);
    if (!c.falta?.voz && !tieneVoz) mal.push(`${c.archivo}: sin voz que salga en el acto`);
    // Lo que la lista da por pendiente y ya está: se saca de la lista (que no quede una excepción vieja).
    if (c.falta?.adjuntos?.startsWith('pendiente') && tieneAdjuntos) mal.push(`${c.archivo}: ya tiene adjuntos, sácalo de la lista`);
    if (c.falta?.voz?.startsWith('pendiente') && tieneVoz) mal.push(`${c.archivo}: ya tiene voz, sácalo de la lista`);
    for (const [que, porque] of Object.entries(c.falta ?? {})) {
      if (!/^(pendiente|no corresponde): \S/.test(porque ?? '')) mal.push(`${c.archivo}: lo que falta de ${que} dice «pendiente: …» o «no corresponde: …», con su porqué`);
    }
  }
  assert.deepEqual(mal, []);
});

test('la pantalla que usa la nota en el acto la DIBUJA, la manda y deja descartarla (si no, la nota se ve recién al salir)', () => {
  const usan = delRepo().filter((f) => !f.startsWith('app/_chat/') && /\buseNotaEnElActo\(/.test(fuenteDe(f)));
  assert.ok(usan.length >= 7, `las pantallas sin audio propio: ${usan.length}`);
  const mal: string[] = [];
  for (const f of usan) {
    const s = fuenteDe(f);
    if (!/\.conNotas\(/.test(s)) mal.push(`${f}: el hilo no lleva las notas (nota.conNotas(items))`);
    if (!/\.onGrabada\b/.test(s)) mal.push(`${f}: la caja no le da la grabación (onGrabada={nota.onGrabada})`);
    if (!/\.descartar\b/.test(s)) mal.push(`${f}: la nota que no se entendió no se puede descartar`);
  }
  assert.deepEqual(mal, []);
  // Y la nota no vacía lo que la persona está escribiendo: las pantallas que vacían la caja al mandar, no lo hacen con la nota.
  for (const f of ['app/_components/MakoChat.tsx', 'app/whatsapp/WhatsAppAdvisor.tsx', 'app/dashboard/PanelEditarMako.tsx', 'app/image-editor/mako/chat/PanelMakoIA.tsx', 'app/video-editor/_opencut/chat/PanelChat.tsx']) {
    assert.match(fuenteDe(f), /dejarCaja: true/, `${f}: la nota sale sin vaciar la caja`);
  }
});

// ── El almacén de las notas, sin React ──
const espera = () => new Promise((r) => setTimeout(r, 0));
function conTranscriptor() {
  const pendientes: Array<(r: { texto: string } | { error: string }) => void> = [];
  const notas = crearNotasEnElActo(() => new Promise((res) => { pendientes.push(res); }), () => 'blob:nota');
  return { notas, pendientes };
}
const audio = new Blob(['x']);

test('la nota se dibuja ya, con «Enviando…», y sale con su texto; su globo sigue sonando', async () => {
  const { notas, pendientes } = conTranscriptor();
  const id = notas.grabar('chat:1', audio, 7, new Date('2026-10-28T10:00:00Z'));
  const fila = filaDeNota(notas.de('chat:1').notas[0]);
  assert.deepEqual(fila, { k: 'msg', id, role: 'user', texto: '', at: '2026-10-28T10:00:00.000Z', voz: { url: 'blob:nota', secs: 7 }, estado: 'enviando' });
  assert.equal(notas.siguiente('chat:1'), null, 'mientras se pasa a texto, no sale');
  pendientes[0]({ texto: 'Cambia el título' });
  await espera();
  const y = notas.siguiente('chat:1');
  assert.equal(y?.texto, 'Cambia el título');
  notas.salio('chat:1', y!.id);
  assert.equal(notas.de('chat:1').notas.length, 0);
  // La pantalla ya dibuja su mensaje (con el texto): el hilo le pone el audio.
  const items: ItemHilo[] = [{ k: 'msg', id: 'u1', role: 'user', texto: 'Cambia el título', at: null }, { k: 'msg', id: 'm1', role: 'assistant', texto: 'Listo', at: null }];
  const hilo = conNotas(items, notas.de('chat:1'));
  assert.deepEqual((hilo[0] as Extract<ItemHilo, { k: 'msg' }>).voz, { url: 'blob:nota', secs: 7 });
  assert.equal((hilo[1] as Extract<ItemHilo, { k: 'msg' }>).voz, undefined, 'lo de MaKo no');
});

test('salen en el orden en que se grabaron, y una nota no viaja a otro chat', async () => {
  const { notas, pendientes } = conTranscriptor();
  notas.grabar('chat:1', audio, 3);
  notas.grabar('chat:1', audio, 4);
  notas.grabar('chat:2', audio, 5);
  pendientes[1]({ texto: 'la segunda' });
  await espera();
  assert.equal(notas.siguiente('chat:1'), null, 'la segunda espera a la primera');
  pendientes[0]({ texto: 'la primera' });
  await espera();
  assert.equal(notas.siguiente('chat:1')?.texto, 'la primera');
  assert.equal(notas.siguiente('chat:2'), null, 'la de otro chat sigue en lo suyo');
  // Lo que se dibuja: las dos, al final del hilo de la pantalla.
  assert.equal(conNotas([{ k: 'msg', id: 'a', role: 'assistant', texto: 'hola', at: null }], notas.de('chat:1')).length, 3);
});

test('sobrevive a que la pantalla se vaya: el almacén no es de React, y al volver al chat sale', async () => {
  const { notas, pendientes } = conTranscriptor();
  let avisos = 0;
  const soltar = notas.suscribir(() => { avisos++; });
  notas.grabar('panel', audio, 2);
  soltar(); // el panel se cerró
  pendientes[0]({ texto: 'lo que dije' });
  await espera();
  assert.equal(avisos, 1, 'sin oyentes, igual se pasó a texto');
  assert.equal(notas.siguiente('panel')?.texto, 'lo que dije', 'al volver, está para salir');
});

test('la que no se entendió dice por qué, se reintenta o se descarta; el «Reintentar» de lo demás es de la pantalla', async () => {
  const { notas, pendientes } = conTranscriptor();
  const id = notas.grabar('chat:1', audio, 2);
  pendientes[0]({ error: 'No se escuchó nada en la nota. Grábala de nuevo.' });
  await espera();
  const fila = filaDeNota(notas.de('chat:1').notas[0]);
  assert.equal(fila.estado, 'error');
  assert.equal(fila.error, 'No se escuchó nada en la nota. Grábala de nuevo.');
  assert.equal(fila.descartable, true);
  assert.equal(notas.siguiente('chat:1'), null, 'no sale nada a medias');
  assert.equal(notas.reintentar('chat:1', id), true);
  assert.equal(notas.de('chat:1').notas[0].estado, 'pasando');
  pendientes[1]({ texto: 'ahora sí' });
  await espera();
  assert.equal(notas.siguiente('chat:1')?.texto, 'ahora sí');
  assert.equal(notas.reintentar('chat:1', 'u-de-la-pantalla'), false, 'no es una nota: lo reintenta la pantalla');
  // Descartada mientras se pasaba a texto: no vuelve.
  const otra = notas.grabar('chat:3', audio, 1);
  notas.descartar('chat:3', otra);
  pendientes[2]({ texto: 'tarde' });
  await espera();
  assert.equal(notas.de('chat:3').notas.length, 0);
});
