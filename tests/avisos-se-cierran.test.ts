// =============================================================================
// Un aviso se cierra: con su ✕, deslizándolo, y no se va solo mientras se lo mira (24/10/2026)
// =============================================================================
// Martín: «Las notificaciones de MaKo cuando pasa algo, deberían tener un botón X para cerrarlas o si las desplazo se van, porque
// estoy editando algo y aparecen y tengo que esperar a que se vayan para apretar el botón de atrás». Esto fija, en los TRES avisos de
// la app (Toast.tsx de la computadora, AvisoM del teléfono, AvisoArriba de NotificationsProvider):
//   · la ✕ («Cerrar aviso»);
//   · el arrastre de costado (`useDeslizarParaCerrar`, app/_ui/descartar.tsx) esparcido en la caja del aviso;
//   · que su temporizador espera mientras se lo mira (`esperarPausa`), y que ningún `setTimeout` lo cierra a pelo;
//   · la regla pura: desde UMBRAL_DESLIZAR px de costado (para los dos lados) se va; menos, vuelve a su lugar.
//
// Verificado ROMPIÉNDOLO (24/10/2026, base 6 / 0), de a una y restaurando a mano:
//   · `seDescarta` con `>` en vez de `>=`                                              → 5 / 1
//   · `esperarPausa` que cierra sin mirar la pausa                                     → 5 / 1
//   · la ✕ del teléfono borrada (AvisoM)                                               → 5 / 1
//   · el aviso de WhatsApp vuelve a `setTimeout(() => setToast(null), 5000)`           → 5 / 1
//   · `movido.current = false` después del corte de los botones                        → 5 / 1

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seDescarta, esperarPausa, avisoEnPausa, UMBRAL_DESLIZAR } from '../app/_ui/descartar';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AVISOS = ['app/_ui/Toast.tsx', 'app/m/_ui/ShellM.tsx', 'app/_components/NotificationsProvider.tsx'];

test('desde UMBRAL_DESLIZAR px de costado, para los dos lados, el aviso se va', () => {
  assert.equal(UMBRAL_DESLIZAR, 64);
  assert.equal(seDescarta(UMBRAL_DESLIZAR), true);
  assert.equal(seDescarta(-UMBRAL_DESLIZAR), true);
  assert.equal(seDescarta(UMBRAL_DESLIZAR - 1), false, 'un poco menos vuelve a su lugar');
  assert.equal(seDescarta(0), false);
});

test('el temporizador espera mientras un aviso está en pausa (el mouse o el dedo encima), y después cierra', () => {
  let enPausa = false;
  let preguntado = '';
  const g = globalThis as { document?: unknown };
  const antes = g.document;
  g.document = { querySelector: (sel: string) => { preguntado = sel; return enPausa ? {} : null; } };
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let cerradas = 0;
    const intento = esperarPausa(() => { cerradas++; }, 800);
    enPausa = true;
    intento();
    assert.equal(cerradas, 0, 'con el mouse encima no se cierra');
    assert.equal(preguntado, '[data-mk-aviso][data-pausa]', 'la pausa va por el DOM: la marca la pone el aviso');
    mock.timers.tick(800);
    assert.equal(cerradas, 0, 'sigue encima: vuelve a esperar');
    enPausa = false;
    mock.timers.tick(800);
    assert.equal(cerradas, 1, 'se fue el mouse: se cierra, una vez');
    mock.timers.tick(5000);
    assert.equal(cerradas, 1);
    assert.equal(avisoEnPausa(), false);
  } finally {
    mock.timers.reset();
    g.document = antes;
  }
});

test('el hook marca el aviso (data-mk-aviso / data-pausa) y un gesto nuevo olvida el arrastre anterior antes del corte de los botones', () => {
  const src = sinComentarios(leer('app/_ui/descartar.tsx'));
  assert.match(src, /'data-mk-aviso': ''/);
  assert.match(src, /'data-pausa': pausa \? '' : undefined/);
  const abajo = src.slice(src.indexOf('onPointerDown'), src.indexOf('onPointerMove'));
  const reset = abajo.indexOf('movido.current = false');
  const corte = abajo.indexOf(".closest('button");
  assert.ok(reset >= 0 && corte >= 0, 'el reset y el corte de los botones existen');
  assert.ok(reset < corte, 'sin esto, después de un arrastre con el dedo que vuelve a su lugar, el primer toque en la ✕ no hace nada');
  // Un arrastre no es un toque: el aviso de WhatsApp abre el chat al tocarlo.
  assert.match(src, /onClickCapture: \(e: MouseEvent<HTMLElement>\) => \{ if \(movido\.current\) \{ e\.preventDefault\(\); e\.stopPropagation\(\);/);
});

test('los tres avisos tienen la ✕ y el arrastre de costado', () => {
  for (const p of AVISOS) {
    const src = sinComentarios(leer(p));
    assert.match(src, /from '(\.\/|@\/app\/_ui\/)descartar'/, `${p}: usa app/_ui/descartar.tsx`);
    assert.match(src, /useDeslizarParaCerrar\(/, `${p}: el arrastre`);
    assert.match(src, /\{\.\.\.desliza\.props\}/, `${p}: esparcido en la caja del aviso`);
    assert.match(src, /desliza\.estilo/, `${p}: se corre con el dedo`);
    assert.match(src, /<button type="button"[^>]*aria-label="Cerrar aviso"|<button type="button" aria-label="Cerrar aviso"/, `${p}: la ✕`);
  }
  // El del teléfono: la ✕ de 44px (el dedo), con su clase en m.css.
  assert.match(sinComentarios(leer('app/m/_ui/ShellM.tsx')), /className="m-toast__cerrar"/);
  assert.match(leer('app/m/m.css'), /\.m-toast__cerrar \{[^}]*width: 44px; height: 44px;/);
});

test('ningún temporizador de aviso lo cierra sin mirar si se lo está mirando', () => {
  for (const p of AVISOS) {
    const src = sinComentarios(leer(p));
    assert.doesNotMatch(src, /setTimeout\(\(\) => set(Tpl)?Toast\(/, `${p}: un setTimeout que cierra a pelo`);
    assert.match(src, /setTimeout\(esperarPausa\(/, `${p}: su temporizador pasa por esperarPausa`);
  }
  // El de NotificationsProvider: el de WhatsApp (y el de prueba, que es el mismo). El de la plantilla se fue el
  // 12/11/2026 con su sondeo: no podía salir nunca (docs/hallazgos-ui.md).
  const np = sinComentarios(leer('app/_components/NotificationsProvider.tsx'));
  assert.equal((np.match(/setTimeout\(esperarPausa\(/g) || []).length, 1);
});

test('el aviso de arriba abre lo suyo al tocarlo, y su ✕ no lo abre', () => {
  const np = sinComentarios(leer('app/_components/NotificationsProvider.tsx'));
  assert.match(np, /aria-label="Cerrar aviso" onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCerrar\(\); \}\}/);
  assert.equal((np.match(/<AvisoArriba onAbrir=/g) || []).length, 1, 'el de WhatsApp (el de la plantilla se fue el 12/11/2026)');
});
