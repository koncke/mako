// =============================================================================
// La revisión del Cerebro sobre 34b0687f0 (27/10/2026, C:/dev/revisiones/2710-mi-34b0687f0.md): los tres medios de «no existe»
// =============================================================================
// Cada test se pone ROJO sobre 34b0687f0 y VERDE desde 9f09fa3c3 (el ticket automático, lib/no-pude*.ts). Medido con un
// worktree de 34b0687f0 y este mismo archivo (y su hijo, tests/_no-existe-revision-hijo.ts, que sólo usa lo que esa punta tenía):
//   1. en el ws 10 (la regla de Leandro), un «no existe» que marcó MaKo sin que nadie lo confirme NO nace aprobado por la regla
//      ni va al Runner: espera a Martín;
//   2. un fallo de RUTEO (el turno llamó algo que existe y no viajó) sale como ruteo, con la respuesta de MaKo en el contexto, y
//      no como «no existe»; el turno de la app le pasa esa señal; y el arranque de Offer (sin el catálogo de MaKo) no lleva la
//      regla que hace marcar «no existe»;
//   3. diez «no existe» en un día no le traban el Soporte a la persona.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_no-existe-revision-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
});
type Fila = { ws: number; estado: string; despacho: string | null; regla: string | null };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  error?: string; uno: Fila[]; tres: { aMano: boolean; error: string | null; automaticos: number; otros: number };
  ruteo: { causa?: string | null; tipo?: string | null; titulo?: string | null; respuestaMako?: string | null; error?: string };
};

test('1. en el ws 10, un «no existe» que marcó MaKo no entra por la regla de Leandro ni va al Runner', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.uno.length, 1, 'no se levantó el pedido');
  assert.deepEqual(R.uno[0], { ws: 10, estado: 'esperando_decision', despacho: null, regla: null }, 'nació aprobado por la regla del negocio');
});

test('2. un fallo de ruteo sale como ruteo, con la respuesta de MaKo, y no como «no existe»', () => {
  assert.equal(R.ruteo.error, undefined, `no hay con qué separar el ruteo: ${R.ruteo.error}`);
  assert.equal(R.ruteo.causa, 'ruteo');
  assert.equal(R.ruteo.tipo, 'bug', 'un ruteo salió como un pedido de algo nuevo');
  assert.match(String(R.ruteo.titulo), /la operación existe «Editar una cuota»/);
  assert.match(String(R.ruteo.respuestaMako), /todavía no existe/, 'el ticket no guarda lo que contestó MaKo');
  const turno = fuente('lib/mako-turno-app.ts');
  assert.match(turno, /conTicketsDeMaKo\(respuesta, \{ ruteo: noViajo\.length > 0, yaRegistrado: fallasDeMako\.length > 0 \}/, 'el turno de la app no le pasa el ruteo al ticket');
  assert.match(fuente('lib/offer-ia.ts'), /\$\{p\.arranque \? '' : `\\n\\n\$\{reglaNoExisteEn\('respuesta'\)\}`\}`;/, 'el arranque de Offer, sin el catálogo de MaKo, marca «no existe»');
});

test('3. diez «no existe» en un día no le traban el Soporte a la persona, y ninguno se pierde callado', () => {
  assert.deepEqual({ aMano: R.tres.aMano, error: R.tres.error }, { aMano: true, error: null }, 'el ticket a mano rebotó por el tope que gastaron los automáticos');
  assert.equal(R.tres.automaticos, 6, 'los automáticos no tienen su propio tope (6 por negocio y día)');
  assert.equal(R.tres.otros, 4, 'con el tope lleno, los «no existe» que siguen se perdieron callados');
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Rojo sobre 34b0687f0 (los tres, cada uno por su causa) y verde desde 9f09fa3c3. Y sobre esta punta, una rotura por vez:
//   1. `clasificar` sin la rama de `automatico`                         → rojo el 1.
//   2. el arranque de Offer con la regla de «no existe»                  → rojo el 2.
//   3. el tope de la persona contando lo que abrió el sistema            → rojo el 3.
//   4. el tope de los automáticos sin anotar lo que sigue                 → rojo el 3.
