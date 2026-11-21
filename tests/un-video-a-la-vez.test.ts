// =============================================================================
// UN SOLO VIDEO A LA VEZ, Y EN LA ESQUINA SÓLO EL ÚLTIMO (21/11/2026, Martín probando en el ws 3, por el Cerebro)
// =============================================================================
// «me reproduje un video de arriba y después estoy reproduciendo el de abajo, pero se marca abajo a la derecha el video de arriba».
// La regla:
//   · al darle play a un video, se pausan todos los demás (el flotante, el del chat, el del motor);
//   · el recuadro de abajo a la derecha muestra SÓLO el último video que la persona reprodujo: al darle play a otro, el anterior se pausa
//     y deja de flotar;
//   · flota únicamente si ese último NO está a la vista (scroll, otra pestaña u otra pantalla): a la vista en el chat, no hay flotante;
//   · en el flotante NO va «Omitir recorrido»: la X alcanza (el «Omitir» del recorrido queda en las marcas).
// Los videos mudos en bucle son de adorno: ni pausan a los demás ni se pausan.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instalarUnVideoALaVez } from '../app/_ui/tutorial/un-video-a-la-vez';
import { cerrarTutorial, reproducirFlotante, senalAhora } from '../app/_ui/tutorial/store';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

type Falso = { tagName: string; muted: boolean; loop: boolean; paused: boolean; dentroDe: string | null; pause(): void; closest(sel: string): object | null };
const video = (o: Partial<Falso> = {}): Falso => ({
  tagName: 'VIDEO', muted: false, loop: false, paused: true, dentroDe: null,
  pause() { this.paused = true; },
  closest(sel: string) { return this.dentroDe && sel.split(',').some((s) => s.trim() === this.dentroDe) ? {} : null; },
  ...o,
});
/** Un documento de mentira: los videos que tiene y lo que hay en la esquina. */
function documento(videos: Falso[], enLaEsquina: string[] = []) {
  let alPlay: ((e: { target: unknown }) => void) | null = null;
  const doc = {
    addEventListener: (tipo: string, f: (e: { target: unknown }) => void, captura?: boolean) => { if (tipo === 'play' && captura) alPlay = f; },
    removeEventListener: () => { alPlay = null; },
    querySelectorAll: (sel: string) => (sel === 'video' ? videos : []),
    querySelector: (sel: string) => (enLaEsquina.includes(sel) ? {} : null),
  };
  const play = (v: Falso) => { v.paused = false; alPlay?.({ target: v }); };
  return { doc: doc as unknown as Document, play };
}

test('1. dos videos en el hilo: play al de arriba, que flota al salir de la vista; play al de abajo: arriba se pausa y deja la esquina, abajo no flota', () => {
  cerrarTutorial();
  const arriba = video(), abajo = video();
  const { doc, play } = documento([arriba, abajo]);
  const sacar = instalarUnVideoALaVez(doc);
  play(arriba);
  // Se scrolleó: el de arriba salió de la vista y pasó a la esquina (useVideoQueFlota lo pausa en el chat y lo manda a la esquina).
  assert.equal(reproducirFlotante('arriba', 'El video de arriba', 12), true);
  arriba.pause();
  assert.equal(senalAhora()?.tipo, 'video');
  play(abajo);
  assert.equal(senalAhora(), null, 'el de arriba ya no está en la esquina');
  assert.equal(abajo.paused, false, 'el de abajo corre, a la vista, sin flotar');
  sacar();
});

test('2. los dos a la vista: play al de arriba y después al de abajo → el de arriba se pausa (así, al scrollear, no flota)', () => {
  cerrarTutorial();
  const arriba = video(), abajo = video();
  const { doc, play } = documento([arriba, abajo]);
  const sacar = instalarUnVideoALaVez(doc);
  play(arriba);
  play(abajo);
  assert.equal(arriba.paused, true);
  assert.equal(abajo.paused, false);
  assert.equal(senalAhora(), null, 'nada en la esquina');
  sacar();
});

test('3. el de la esquina manda cuando lo reproducen; los de adorno (en bucle) no cuentan', () => {
  cerrarTutorial();
  const chat = video(), esquina = video({ dentroDe: '.mk-pip' }), adorno = video({ muted: true, loop: true, paused: false });
  const { doc, play } = documento([chat, esquina, adorno]);
  const sacar = instalarUnVideoALaVez(doc);
  play(chat);
  // Pasó a la esquina (en la app, el del chat queda pausado; aquí sigue, para ver que el play de la esquina lo pausa).
  reproducirFlotante('el-de-la-esquina', 'En la esquina', 3);
  play(esquina);
  assert.equal(senalAhora()?.tipo, 'video', 'dale play al de la esquina no lo saca de la esquina');
  assert.equal(chat.paused, true, 'y pausa el del chat');
  assert.equal(adorno.paused, false, 'el de adorno (en bucle) sigue');
  play(adorno);
  assert.equal(esquina.paused, false, 'uno de adorno que arranca no pausa a nadie');
  sacar();
  cerrarTutorial();
});

// EN PRODUCCIÓN (21/11, 05:24 UTC, el Cerebro con clics de verdad): el flotante, si el navegador no lo deja arrancar con sonido, arranca
// SILENCIADO (VideoEnLaEsquina: `el.muted = true`), y lo mismo un video del chat. La regla salteaba los silenciados: el de la bienvenida
// siguió en la esquina (0:21 / 0:25) mientras corría el del código.
test('5. un video silenciado por el navegador cuenta igual: el flotante mudo se pausa y deja la esquina, y un play mudo también manda', () => {
  cerrarTutorial();
  const bienvenida = video(), codigo = video({ muted: true }), esquina = video({ dentroDe: '.mk-pip', muted: true });
  const { doc, play } = documento([bienvenida, codigo, esquina]);
  const sacar = instalarUnVideoALaVez(doc);
  play(bienvenida);
  // Salió de la vista: pasa a la esquina, y la esquina arranca SILENCIADA.
  reproducirFlotante('bienvenida', 'Bienvenida', 20);
  bienvenida.pause();
  play(esquina);
  play(codigo);
  assert.equal(esquina.paused, true, 'el flotante, aunque esté mudo, se pausa');
  assert.equal(senalAhora(), null, 'y deja la esquina');
  assert.equal(codigo.paused, false);
  sacar();
  cerrarTutorial();
});

test('4. lo instala el motor, en toda la pantalla; y en el video flotante no va «Omitir recorrido»', () => {
  const m = sinComentarios(fuente('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /useEffect\(\(\) => instalarUnVideoALaVez\(document\), \[\]\);/);
  const chico = m.slice(m.indexOf('function VideoChico('), m.indexOf('const CSS_ENSAYO'));
  assert.ok(chico.length > 200, 'está VideoChico');
  assert.doesNotMatch(chico, /Omitir recorrido/, 'en el video, la X alcanza');
  const u = sinComentarios(fuente('app/_ui/tutorial/un-video-a-la-vez.ts'));
  assert.match(u, /addEventListener\('play', alPlay, true\)/, 'el play no burbujea: se oye en captura');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026), de a una rotura, y cada una cae:
//   · sin pausar a los demás                                → 2, 3
//   · sin soltar lo que flota                                → 1
//   · el de la esquina se suelta a sí mismo                  → 3
//   · los de adorno (en bucle) también mandan                 → 3
//   · los silenciados no cuentan (la regla vieja)              → 5
//   · «Omitir recorrido» de vuelta en el video               → 4
// ─────────────────────────────────────────────────────────────────────────────
