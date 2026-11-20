// LOS CHATS DEL NEGOCIO, MIRANDO COMO ADMINISTRADOR (20/11/2026, decidido por el Cerebro con la D7: «mirando como administrador se ve LO
// MISMO que ve el cliente»; la llamada con Leila: «en los chats de acá no está el chat de onboarding»). Mirando un negocio, la lista y la
// lectura son las del DUEÑO; escribir, sólo en los de prueba (ws 3 y 9). En el de un cliente, la caja queda en lectura con su aviso.
// Nunca se escribe como el administrador dentro de la lista del cliente.
// Roto a propósito el 20/11 (cada uno cae): el ws 11 escribiendo (1), la lista del administrador mirando (2), el POST sin la guarda (2),
// el teléfono sin la guarda (2), la fila «Onboarding» con la clave del administrador (2), la caja sin el aviso (3), y una agencia
// tratada como el administrador (2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVISO_SOLO_LECTURA, chatDelNegocio } from '../lib/chat-del-negocio-reglas';
import { escribeComoElCliente } from '../lib/onboarding-v2/revision';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. mirando el ws 3: la lista del dueño y se escribe; mirando el ws 11: la lista del dueño y NO se escribe', () => {
  const ws3 = chatDelNegocio({ mirando: true, hayDueno: true, escribeComoElCliente: escribeComoElCliente(3) });
  assert.deepEqual(ws3, { de: 'dueno', soloLectura: false });
  const ws11 = chatDelNegocio({ mirando: true, hayDueno: true, escribeComoElCliente: escribeComoElCliente(11) });
  assert.deepEqual(ws11, { de: 'dueno', soloLectura: true });
  // Sin mirar, como siempre: los suyos y se escribe.
  assert.deepEqual(chatDelNegocio({ mirando: false, hayDueno: true, escribeComoElCliente: false }), { de: 'quien-mira', soloLectura: false });
  // Un negocio de prueba sin dueño: quien mira hace de cliente; uno de cliente sin dueño, se lee y no se escribe.
  assert.deepEqual(chatDelNegocio({ mirando: true, hayDueno: false, escribeComoElCliente: true }), { de: 'quien-mira', soloLectura: false });
  assert.deepEqual(chatDelNegocio({ mirando: true, hayDueno: false, escribeComoElCliente: false }), { de: 'quien-mira', soloLectura: true });
  assert.equal(AVISO_SOLO_LECTURA, 'Estás mirando como administrador: aquí sólo lees.');
});

test('2. las rutas de los chats usan la persona del NEGOCIO, y lo que escribe se corta en lectura', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  const p = t.slice(t.indexOf('export async function personaDelChatDelNegocio'), t.indexOf('// ── Las sesiones de la persona'));
  assert.match(p, /return \{ \.\.\.p, \.\.\.\(n\.dueno \? \{ chartKey: n\.dueno\.chartKey, quien: n\.dueno\.quien \} : \{\}\), soloLectura: n\.soloLectura \};/);

  const escritorio = sinComentarios(leer('app/api/mako/chat/route.ts'));
  const telefono = sinComentarios(leer('app/api/m/mako/route.ts'));
  for (const [nombre, r] of [['la computadora', escritorio], ['el teléfono', telefono]] as const) {
    assert.doesNotMatch(r, /await personaDelRequest\(\)/, `${nombre}: con la persona de quien mira`);
    assert.match(r, /export async function GET\(req: NextRequest\) \{\n\s*const persona = await personaDelChatDelNegocio\(\);/, `${nombre}: GET`);
    // La guarda va ANTES de todo lo demás del POST (mandar, crear, renombrar, marcar, confirmar: todo escribe).
    assert.match(r, /export async function POST\(req: NextRequest\) \{\n\s*const persona = await personaDelChatDelNegocio\(\);\n\s*if \('error' in persona\) return json\(\{ ok: false, error: persona\.error \}, persona\.status\);\n\s*if \(persona\.soloLectura\) return json\(\{ ok: false, error: AVISO_SOLO_LECTURA \}, 403\);/, `${nombre}: POST`);
  }
  assert.match(sinComentarios(leer('lib/cerebro-chats.ts')), /const p = await personaDelChatDelNegocio\(\);/, 'los chats del grafo, también los del dueño');

  // Sólo el ADMINISTRADOR de MaKo: una agencia mirando a su cliente sigue como estaba.
  const n = sinComentarios(leer('lib/chat-del-negocio.ts'));
  assert.match(n, /const admin = await getSesionAdmin\(\)\.catch\(\(\) => null\);\n\s*const mirando = !!admin && \(await estaImpersonando\(\)\.catch\(\(\) => false\)\);/);
  assert.match(n, /\.eq\('email', email\)\.eq\('workspace_id', ws\)\.maybeSingle\(\)/, 'la fila del dueño en ESE negocio');

  // La fila «Onboarding», con la clave del dueño: si no, mirando quedaba afuera.
  assert.match(sinComentarios(leer('lib/onboarding-arranque-server.ts')), /const chartKey = delNegocio\?\.dueno\?\.chartKey \?\? \(persona \? chartKeyDePersona\(persona\) : null\);/);
});

test('3. la caja: mirando el negocio de un cliente, el aviso de una línea en lugar de la caja', () => {
  const c = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(c, /\{soloLectura\n\s*\? <p className="co-caja" role="note" data-solo-lectura=""[^>]*>\{AVISO_SOLO_LECTURA\}<\/p>\n\s*: <div className="co-caja"><CajaDelCliente /);
  assert.match(sinComentarios(leer('app/second-brain/page.tsx')), /const \{ soloLectura \} = await elChatDelNegocio\(\)\.catch\(\(\) => \(\{ soloLectura: false \}\)\);/);
  assert.match(sinComentarios(leer('app/second-brain/page.tsx')), /soloLectura=\{soloLectura\} \/>;/);
  assert.match(sinComentarios(leer('app/second-brain/pagina.tsx')), /hiloOnboarding=\{hiloOnboarding\} soloLectura=\{soloLectura\} \/>/);
});
