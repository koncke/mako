// =============================================================================
// EL VELO DEL MOTOR ENTRA CON EL BARRIDO DEL SOL Y LA LUNA (20/11/2026, OD-F2)
// =============================================================================
// La auditoría del Cerebro (auditoria-onboarding-reto-20-11.md, OD-F2): «La pantalla se oscurece de golpe, sin el barrido del sol y
// la luna». Lo acordado: un círculo claro que se cierra hacia lo marcado en ~720 ms, sin animación con menos movimiento. Las cuentas
// viven en app/_ui/tutorial/iris.ts; el motor (app/_ui/tutorial/MotorTutorial.tsx) recorta su hueco con ellas.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): con el radio inicial sólo hasta el borde más cercano cae el 1;
// con el círculo fuera del centro del hueco, el 2; barriendo cada vez que se mide el hueco, el 3; sin mirar menos movimiento, el 3;
// con el motor sin `tocaIris`, el 4; con la tarjeta visible durante el barrido, el 4.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MS_IRIS, radioA, radioInicial, recorteIris, suave, tocaIris } from '../app/_ui/tutorial/iris';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. arranca sin tapar nada (hasta la esquina más lejana) y termina en 0, en 720 ms y con la curva del barrido', () => {
  assert.equal(MS_IRIS, 720);
  // Un hueco arriba a la izquierda en una pantalla de 1440×900: la esquina más lejana es la de abajo a la derecha.
  assert.equal(Math.round(radioInicial(100, 100, 1440, 900)), Math.round(Math.hypot(1340, 800)));
  assert.equal(Math.round(radioInicial(1400, 850, 1440, 900)), Math.round(Math.hypot(1400, 850)));
  const r0 = 1000;
  assert.equal(radioA(0, r0), r0);
  assert.equal(radioA(MS_IRIS, r0), 0);
  assert.equal(radioA(MS_IRIS * 3, r0), 0, 'pasado el tiempo, nunca negativo');
  assert.equal(suave(0.5), 0.5, 'la mitad del tiempo, la mitad del camino (curva simétrica)');
  assert.ok(suave(0.1) < 0.1 && suave(0.9) > 0.9, 'arranca y termina despacio, como cubic-bezier(.65, 0, .35, 1)');
});

test('2. el recorte: la pantalla entera menos un círculo centrado en el hueco, en coordenadas del hueco', () => {
  const p = recorteIris({ x: 200, y: 100, ancho: 80, alto: 40 }, { ancho: 1440, alto: 900 }, 50);
  assert.match(p, /^path\(evenodd, "/, 'evenodd: el círculo es un agujero en el rectángulo');
  assert.ok(p.includes('M-200 -100H1240V800H-200Z'), `la pantalla entera, corrida al hueco: ${p}`);
  // El centro del hueco (40, 20) en sus coordenadas: el círculo arranca en x = 40 − 50 y recorre 2r.
  assert.ok(p.includes('M-10 20a50 50 0 1 0 100 0a50 50 0 1 0 -100 0Z'), `el círculo centrado en el hueco: ${p}`);
});

test('3. barre SÓLO cuando el hueco aparece y es de una marca nueva, y nunca con menos movimiento', () => {
  const base = { habia: false, hay: true, clave: 'v1.2|[data-recorrido="x"]', barrida: null, menosMovimiento: false };
  assert.equal(tocaIris(base), true, 'aparece el hueco de una marca nueva');
  assert.equal(tocaIris({ ...base, habia: true }), false, 'el mismo hueco que se vuelve a medir (scroll, tamaño)');
  assert.equal(tocaIris({ ...base, barrida: base.clave }), false, 'el mismo lugar que parpadeó un cuadro');
  assert.equal(tocaIris({ ...base, hay: false }), false, 'sin hueco, nada');
  assert.equal(tocaIris({ ...base, clave: null }), false, 'sin paso, nada');
  assert.equal(tocaIris({ ...base, menosMovimiento: true }), false, 'quien pidió menos movimiento: el velo aparece sin barrido');
});

test('4. el motor recorta su hueco con el barrido y esconde la tarjeta mientras dura', () => {
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /import \{[^}]*\btocaIris\b[^}]*\} from '\.\/iris'/);
  assert.match(m, /tocaIris\(\{ habia: habiaHueco\.current, hay: hayHueco, clave: claveMarca, barrida: barrida\.current, menosMovimiento: !!menosMovimiento\(\) \}\)/);
  // El recorte lo anima `barrer` (iris.ts), que comparte con la entrada de los videos de los chats (V5).
  assert.match(m, /import \{[^}]*\bbarrer\b[^}]*\} from '\.\/iris'/);
  assert.match(m, /return barrer\(nodo, \(\) => capa\.removeAttribute\('data-iris'\)\);/, 'el hueco (su sombra de 200vmax es el velo) se recorta');
  const ir = sinComentarios(leer('app/_ui/tutorial/iris.ts'));
  assert.match(ir, /nodo\.style\.clipPath = recorteIris\(/);
  assert.match(ir, /return \(\) => \{ if \(raf\) cancelAnimationFrame\(raf\); listo\(\); \};/, 'al irse el hueco a mitad, nada queda recortado');
  assert.match(m, /<div ref=\{huecoRef\} className="mk-rec__hueco"/);
  assert.match(m, /<div ref=\{capaRef\} className="mk-rec mk-tuto"/);
  assert.match(m, /capa\.setAttribute\('data-iris', ''\)/);
  assert.match(m, /\.mk-tuto\[data-iris\] \.mk-rec__tarjeta \{ opacity: 0; \}/, 'la tarjeta aparece al terminar el barrido');
  // El Recorrido de todos (app/_ui/Recorrido.tsx) no se toca: el barrido es del motor, que sólo monta quien ve el V2.
  assert.doesNotMatch(sinComentarios(leer('app/_ui/Recorrido.tsx')), /iris/i);
  assert.match(leer('app/layout.tsx'), /sesion && veV2 && <MotorTutorial /);
});
