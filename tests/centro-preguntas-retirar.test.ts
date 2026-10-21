// =============================================================================
// Un chat retira la pregunta que ya no hace falta (21/10/2026, cartero 1.17.4)
// =============================================================================
// Martín dijo «no más preguntas», y Debate no tenía cómo sacar la 53053bcb de su chat del Ops Center: una pregunta de
// `preguntar` sólo la cerraba una respuesta. Lo que se fija:
//   1. `retirarDeLaLista` la deja superada (por el id entero o sus primeros 8), y se guarda así aunque sea de `preguntar`;
//      con dos abiertas que empiezan igual no adivina; una contestada, una ajena o un id raro no se tocan; lo que sube la
//      PC nunca viene superado;
//   2. `cartero.mjs retirar <id>` borra la que todavía no subió (sólo la de ESE chat) y le pide a MaKo la que ya está;
//      con un servidor de antes de la 1.17.4 lo dice («falta el deploy») en vez de decir que la retiró;
//   3. la ruta mira el token del cartero antes de retirar.
//
// Probado rompiéndolo (21/10/2026, con la base en 0 fallos):
//   · `retirarDeLaLista` que no marca la superada → 1 fallo (1);
//   · `sanearPregunta` que sólo guarda la superada de un wrap_up, como antes → 1 fallo (1);
//   · el cartero borrando la pregunta pendiente de cualquier chat → 1 fallo (2);
//   · el cartero sin reconocer el servidor viejo → 1 fallo (2);
//   · la ruta sin mirar el token → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estaAbierta, retirarDeLaLista, sanearPregunta, sanearPreguntas, type PreguntaChat } from '../lib/centro-preguntas-chat';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LOCAL = 'local_752add17-1111-4111-8111-111111111111';
const OTRO = 'local_33333333-3333-4333-8333-333333333333';
const ID = '53053bcb-4e80-49a4-9c57-6a94435c9401';
const IGUAL_COMIENZO = '53053bcb-0000-4000-8000-000000000002';
const pregunta = (id: string, extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id, local: LOCAL, pregunta: '¿Eliminar Gemini?', contexto: null,
  opciones: [{ titulo: 'Sólo del cliente', detalle: null }, { titulo: 'De todo', detalle: null }],
  recomendada: 0, varias: false, at: '2026-10-21T04:29:55.566Z', respuesta: null, ...extra,
});

test('1. retirar la deja superada, se guarda así, y no adivina', () => {
  const otra = pregunta('41f3e00d-8f6e-4c5b-9a1d-1b2c3d4e5f60');
  const ahora = new Date('2026-10-21T05:00:00.000Z');
  const r = retirarDeLaLista([pregunta(ID), otra], '53053BCB', ahora);
  assert.ok(r.ok, 'por sus primeros 8, como la nombra un chat');
  if (!r.ok) return;
  assert.equal(r.pregunta.superada, ahora.toISOString());
  assert.deepEqual(r.preguntas.map(estaAbierta), [false, true], 'sólo ésa deja de esperar');
  // Es de `preguntar` (sin origen): la superada tiene que sobrevivir a la lectura de la base.
  assert.equal(sanearPregunta(r.pregunta)?.superada, ahora.toISOString(), 'se guarda aunque no sea de wrap_up');
  assert.equal(sanearPreguntas([r.pregunta])[0].superada, undefined, 'lo que sube la PC nunca viene superado');
  const dos = retirarDeLaLista([pregunta(ID), pregunta(IGUAL_COMIENZO)], '53053bcb');
  assert.ok(!dos.ok && /más de una/.test(dos.error), 'con dos que empiezan igual, pide el id entero');
  assert.ok(retirarDeLaLista([pregunta(ID), pregunta(IGUAL_COMIENZO)], ID).ok, 'con el id entero, sí');
  const contestada = pregunta(ID, { respuesta: { elegidas: [0], otra: null, at: '2026-10-21T04:40:00.000Z', trabajo: '11111111-1111-4111-8111-111111111111' } });
  const c = retirarDeLaLista([contestada], ID);
  assert.ok(!c.ok && /ya no espera/.test(c.error), 'una contestada no se toca');
  assert.ok(!retirarDeLaLista([otra], ID).ok, 'una que no está, tampoco');
  assert.ok(!retirarDeLaLista([pregunta(ID)], '5305').ok, 'con menos de 8, no');
  assert.ok(!retirarDeLaLista([pregunta(ID)], '../x').ok);
});

/** Un MaKo de mentira: `viejo` contesta como un servidor de antes de la 1.17.4 (toma el pedido por una vuelta). */
function servidor(viejo: boolean) {
  const pedidos: Array<{ query: string; cuerpo: unknown; auth: string | undefined }> = [];
  const srv = createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (p) => partes.push(p)).on('end', () => {
      const u = new URL(req.url ?? '/', 'http://x');
      const cuerpo = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}') as { id?: string };
      pedidos.push({ query: u.search, cuerpo, auth: req.headers.authorization });
      res.setHeader('content-type', 'application/json');
      if (viejo) { res.statusCode = 503; res.end(JSON.stringify({ error: 'falta la cuenta del cartero' })); return; }
      res.end(JSON.stringify({ ok: true, pregunta: { id: ID } }));
    });
  });
  return { srv, pedidos };
}

async function correr(dir: string, args: string[]): Promise<{ ok: boolean; salida: string }> {
  return new Promise((ok) => execFile(process.execPath, [join(RAIZ, 'scripts/operaciones/cartero.mjs'), 'retirar', ...args],
    { env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '' } },
    (e, so, se) => ok({ ok: !e, salida: e ? se || e.message : so })));
}

test('2. `cartero.mjs retirar` borra la que no subió (sólo la de ese chat) y le pide a MaKo la que ya está', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-retirar-'));
  mkdirSync(join(dir, 'preguntas'), { recursive: true });
  const suya = join(dir, 'preguntas', `${ID}.json`);
  const ajena = join(dir, 'preguntas', `${IGUAL_COMIENZO}.json`);
  writeFileSync(suya, JSON.stringify(pregunta(ID)));
  writeFileSync(ajena, JSON.stringify(pregunta(IGUAL_COMIENZO, { local: OTRO })));
  for (const viejo of [false, true]) {
    const { srv, pedidos } = servidor(viejo);
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
    const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ url, token: `mkop_${'x'.repeat(30)}`, cwds: [], carteros: {}, carpetas: {} }));
    try {
      const r = await correr(dir, ['53053bcb', '--chat', LOCAL]);
      assert.deepEqual(pedidos.map((p) => [p.query, p.cuerpo, p.auth]), [['?retirar-pregunta=1', { local: LOCAL, id: '53053bcb' }, `Bearer mkop_${'x'.repeat(30)}`]], 'le pide a MaKo, con el token, el chat y el id');
      if (!viejo) {
        assert.ok(r.ok, r.salida);
        assert.equal((JSON.parse(r.salida) as { ok: boolean }).ok, true);
        assert.equal(existsSync(suya), false, 'la que no subió se borra');
        assert.equal(existsSync(ajena), true, 'la del OTRO chat, aunque empiece igual, no');
      } else {
        // La de este chat ya no estaba (se borró en la primera); el servidor viejo no sabe retirar: lo dice.
        assert.equal(r.ok, false, 'no dice que la retiró');
        assert.match(r.salida, /falta el deploy de la 1\.17\.4/);
      }
    } finally {
      srv.close();
    }
  }
  const sinChat = await correr(dir, ['53053bcb']);
  assert.ok(!sinChat.ok && /no sé qué chat es/.test(sinChat.salida), 'sin saber de qué chat es, no hace nada');
});

test('3. la ruta mira el token del cartero antes de retirar', () => {
  const ruta = sinComentarios(leer('app/api/operaciones/cartero/route.ts'));
  assert.match(ruta, /if \(req\.nextUrl\.searchParams\.has\('retirar-pregunta'\)\) \{\s*if \(!\(await tokenDelCarteroValido\(token\)\)\) return NextResponse\.json\(\{ error: 'token del cartero inválido' \}, \{ status: 401 \}\);[\s\S]{0,300}await retirarPregunta\(/,
    'el token, y recién después la base');
  assert.ok(ruta.indexOf("has('retirar-pregunta')") < ruta.indexOf('await cicloCartero('), 'antes de la vuelta: si no, el pedido se tomaba por una');
  assert.match(leer('AGENTS.md'), /cartero\.mjs retirar <id>/, 'los chats saben que existe');
});
