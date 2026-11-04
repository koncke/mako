// =============================================================================
// Ticket #36 (3/11/2026): «No pude copiar» en el Ops Center, desde la app de Claude
// =============================================================================
// `copiar` sólo probaba `navigator.clipboard`: rechazado (permisos, sin foco), no copiaba. No se reprodujo en la app; lo que se fija
// es el comportamiento: con `writeText` rechazado copia igual, y si fallan los dos caminos el aviso dice qué hacer.
//
// Probado rompiéndolo (3/11/2026), una rotura por vez: `copiar` con sólo clipboard, 1 fallo; sin el camino viejo, 2; el textarea
// colgado en la página, 1; «Copiado» sin haber copiado, 1; el aviso viejo en una pantalla, 1.
// =============================================================================

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { copiarTexto, NO_PUDE_COPIAR } from '../lib/copiar-texto';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

type Global = { navigator?: unknown; document?: unknown };
const g = globalThis as unknown as Global;
const navegadorOriginal = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  if (navegadorOriginal) Object.defineProperty(globalThis, 'navigator', navegadorOriginal);
  else delete g.navigator;
  delete g.document;
});

function navegador(writeText: ((t: string) => Promise<void>) | null) {
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: writeText ? { writeText } : undefined }, configurable: true });
}
/** Un documento de mentira: anota qué se seleccionó y si el textarea se sacó. */
function documento(execOk: boolean | 'tira') {
  const r = { copiado: null as string | null, puestos: 0, sacados: 0 };
  g.document = {
    createElement: () => ({ value: '', style: {}, setAttribute() {}, select() {}, setSelectionRange() {} }),
    body: { appendChild: () => { r.puestos++; }, removeChild: () => { r.sacados++; } },
    execCommand: (cmd: string) => {
      if (execOk === 'tira') throw new Error('execCommand no');
      r.copiado = cmd;
      return execOk;
    },
  };
  return r;
}

test('con writeText que anda, no toca el camino viejo', async () => {
  const escrito: string[] = [];
  navegador(async (t) => { escrito.push(t); });
  const d = documento(true);
  assert.equal(await copiarTexto('hola'), true);
  assert.deepEqual(escrito, ['hola']);
  assert.equal(d.puestos, 0);
});

test('con writeText RECHAZADO copia igual por el camino viejo, y saca el textarea', async () => {
  navegador(async () => { throw new Error('NotAllowedError'); });
  const d = documento(true);
  assert.equal(await copiarTexto('hola'), true);
  assert.equal(d.copiado, 'copy');
  assert.equal(d.puestos, 1);
  assert.equal(d.sacados, 1, 'el textarea queda colgado en la página');
});

test('sin la API de clipboard también copia', async () => {
  navegador(null);
  const d = documento(true);
  assert.equal(await copiarTexto('hola'), true);
  assert.equal(d.copiado, 'copy');
});

test('si fallan los dos, dice que no: nunca «Copiado» sobre lo que no se copió', async () => {
  navegador(async () => { throw new Error('NotAllowedError'); });
  documento(false);
  assert.equal(await copiarTexto('hola'), false);
  navegador(async () => { throw new Error('NotAllowedError'); });
  documento('tira');
  assert.equal(await copiarTexto('hola'), false);
});

test('el Ops Center y los dos chats copian por ese camino, y el aviso dice «cópialo a mano»', () => {
  assert.match(NO_PUDE_COPIAR, /cópialo a mano/);
  const mandar = leer('app/admin/operaciones/mandar.ts');
  assert.match(mandar, /export const copiar = copiarTexto;/);
  assert.doesNotMatch(mandar, /navigator\.clipboard/, 'una segunda copia del camino, otra vez');
  assert.doesNotMatch(leer('app/m/copywriting/api.ts'), /navigator\.clipboard/);
  for (const rel of ['app/admin/operaciones/useCentro.ts', 'app/m/operaciones/ChatsMovil.tsx', 'app/second-brain/useChatCliente.ts']) {
    const src = leer(rel);
    assert.match(src, /NO_PUDE_COPIAR/, `${rel} sin el aviso`);
    assert.doesNotMatch(src, /'No pude copiar'/, `${rel} con el aviso viejo`);
  }
});
