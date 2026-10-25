// =============================================================================
// La nota de voz del chat de MaKo del lienzo sale YA y se escucha (24/10/2026, f17 de la llamada con Leandro)
// =============================================================================
// Leandro (29:49-30:15, docs/feedback-24-10.md): «se envió tipo transcripto cuando ahí en el chat mismo se debería poder
// escuchar el audio... cuando le das a enviar audio se tiene que enviar automáticamente, no esperar a transcribirlo». Hasta
// ese día `enviarAudio` (app/automations/ChatMako.tsx) transcribía primero y recién ahí mandaba el TEXTO: no se veía nada y
// no había audio que escuchar. Fija:
//   · el hilo (`hiloUnico`) dibuja el globo con el audio: el de la nota que se está transcribiendo («enviando»), el que no
//     se entendió (con su error y «Reintentar») y el mensaje que salió con lo entendido;
//   · `enviarAudio` pone el globo ANTES de transcribir, y lo entendido sale con su audio (`voces`);
//   · «Reintentar» de una nota que no se entendió la vuelve a transcribir.
// Correr: node --import tsx --test tests/chat-mako-nota-de-voz.test.ts
// ROTURAS (24/10/2026, una por vez y restaurada; base 3 / 0): el globo sin el audio (`voz` del extra) → 2 / 1; transcribir
// antes de poner el globo (lo de antes) → 2 / 1; el mensaje que salió sin su audio (`voces` sin registrar) → 2 / 1;
// «Reintentar» mandando el texto vacío → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hiloUnico } from '../app/automations/ChatMako';

const CHAT = readFileSync(join(__dirname, '..', 'app/automations/ChatMako.tsx'), 'utf8').replace(/\r\n/g, '\n');
const tramo = (desde: string, hasta: string) => {
  const i = CHAT.indexOf(desde);
  assert.ok(i >= 0, `falta «${desde}»`);
  return CHAT.slice(i, CHAT.indexOf(hasta, i + desde.length));
};
const nada = () => {};
const blob = {} as Blob;

test('el hilo dibuja la nota de voz: transcribiéndose, sin entender, y el mensaje que salió con ella', () => {
  const extraPorId = new Map<string, never>([
    ['pedido:a', { id: 'pedido:a', at: '2026-10-25T03:00:00Z', yo: '', voz: { url: 'blob:a', secs: 4, blob }, enviando: true } as never],
    ['pedido:b', { id: 'pedido:b', at: '2026-10-25T03:01:00Z', yo: '', voz: { url: 'blob:b', secs: 2, blob }, fallido: 'No se entendió el audio' } as never],
  ]);
  const yo = { id: 'yo-1', de: 'yo', texto: 'cambiá el primer mensaje', at: '2026-10-25T03:02:00Z', via: 'app' };
  const porId = new Map([['yo-1', { m: yo, i: 0 }]]) as never;
  const { items } = hiloUnico({
    hilo: [{ id: 'pedido:a' }, { id: 'pedido:b' }, { id: 'yo-1' }] as never, porId, extraPorId, total: 1, preguntaViva: null, ultimoMako: -1,
    deshabilitado: false, trabajando: false, elegir: nada, tocarBurbuja: nada, voces: new Map([['yo-1', { url: 'blob:c', secs: 6 }]]),
  });
  const [a, b, c] = items as Array<Record<string, unknown>>;
  assert.deepEqual([a.voz, a.estado, a.texto], [{ url: 'blob:a', secs: 4 }, 'enviando', ''], 'la nota que se transcribe no se ve, o no dice que sale');
  assert.deepEqual([b.voz, b.estado, b.error], [{ url: 'blob:b', secs: 2 }, 'error', 'No se entendió el audio']);
  assert.deepEqual([c.voz, c.texto], [{ url: 'blob:c', secs: 6 }, 'cambiá el primer mensaje'], 'el mensaje que salió perdió su audio');
  // Sin nota, nada cambia: el mensaje escrito no lleva audio.
  const sinVoz = hiloUnico({
    hilo: [{ id: 'yo-1' }] as never, porId, extraPorId: new Map(), total: 1, preguntaViva: null, ultimoMako: -1,
    deshabilitado: false, trabajando: false, elegir: nada, tocarBurbuja: nada,
  });
  assert.equal((sinVoz.items[0] as Record<string, unknown>).voz, undefined);
});

test('`enviarAudio` pone el globo ANTES de transcribir, y lo entendido sale con su audio', () => {
  const f = tramo('const enviarAudio = async (blob: Blob, secs: number): Promise<void> => {', '\n  };');
  const globo = f.indexOf('ponerExtras((xs) => [...xs, nota]);');
  const transcribe = f.indexOf('const r = await transcribirNota(blob);');
  assert.ok(globo > 0 && transcribe > globo, 'transcribe antes de mostrar el audio (lo de antes)');
  assert.match(f, /const nota: ExtraChat = \{ id: `\$\{PREFIJO_EXTRA\}\$\{nuevoId\('yo'\)\}`, at: new Date\(\)\.toISOString\(\), yo: '', voz, enviando: true \};/);
  assert.match(f, /await enviarTexto\(r\.texto, 'afuera', \[\], voz\);/);
  // El turno registra el audio en el mensaje que entra al hilo.
  assert.match(CHAT, /if \(voz\) voces\.current\.set\(yo\.id, voz\);/);
});

test('«Reintentar» de una nota que no se entendió la vuelve a transcribir', () => {
  const r = tramo('const reintentar = (id: string, texto: string) => {', '\n  };');
  assert.match(r, /if \(x\?\.voz && !texto\.trim\(\)\) \{ URL\.revokeObjectURL\(x\.voz\.url\); void enviarAudio\(x\.voz\.blob, x\.voz\.secs\); return; \}/);
  assert.match(r, /void enviarTexto\(texto, 'afuera', x\?\.adjuntos \?\? \[\], x\?\.voz\);/);
});
