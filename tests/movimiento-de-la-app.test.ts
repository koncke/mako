// =============================================================================
// El movimiento de toda la app: el barrido de claro a oscuro y la aparición de las tabs (31/10/2026)
// =============================================================================
// Correr: node --import tsx --test tests/movimiento-de-la-app.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conBarrido } from '../app/_components/barrido-tema';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');

type Llamada = { keyframes: { clipPath: string[] }; opciones: { duration: number; easing: string; pseudoElement: string } };

function escena({ conApi = true, reducido = false, salta = false } = {}) {
  const animaciones: Llamada[] = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { innerWidth: 1000, innerHeight: 600, matchMedia: () => ({ matches: reducido }) };
  g.document = {
    documentElement: { animate: (keyframes: Llamada['keyframes'], opciones: Llamada['opciones']) => { animaciones.push({ keyframes, opciones }); } },
    ...(conApi ? { startViewTransition: (cambiar: () => void) => { cambiar(); return { ready: salta ? Promise.reject(new Error('saltada')) : Promise.resolve() }; } } : {}),
  };
  return animaciones;
}
const boton = { getBoundingClientRect: () => ({ left: 100, top: 20, width: 40, height: 40 }) } as unknown as HTMLElement;
const pasoLaPromesa = () => new Promise((r) => setTimeout(r, 0));

test('el círculo se abre desde el centro del botón y llega a la esquina más lejana, con los valores medidos', async () => {
  const a = escena();
  let cambio = 0;
  conBarrido(boton, () => { cambio++; });
  await pasoLaPromesa();
  assert.equal(cambio, 1);
  const radio = Math.hypot(1000 - 120, 600 - 40);
  assert.deepEqual(a[0].keyframes.clipPath, ['circle(0px at 120px 40px)', `circle(${radio}px at 120px 40px)`]);
  assert.equal(a[0].opciones.duration, 450);
  assert.equal(a[0].opciones.easing, 'cubic-bezier(.65, 0, .35, 1)');
  assert.equal(a[0].opciones.pseudoElement, '::view-transition-new(root)');
});

test('quien pidió menos movimiento, o un navegador sin la API, cambia al instante y sin animar', async () => {
  for (const op of [{ reducido: true }, { conApi: false }]) {
    const a = escena(op);
    let cambio = 0;
    conBarrido(boton, () => { cambio++; });
    await pasoLaPromesa();
    assert.equal(cambio, 1, JSON.stringify(op));
    assert.equal(a.length, 0, JSON.stringify(op));
  }
});

test('una transición que el navegador salta no rompe nada: el tema ya cambió', async () => {
  const a = escena({ salta: true });
  let cambio = 0;
  conBarrido(boton, () => { cambio++; });
  await pasoLaPromesa();
  assert.equal(cambio, 1);
  assert.equal(a.length, 0);
});

test('sin apagar el fundido del navegador el barrido no se ve', () => {
  assert.match(leer('app/globals.css'), /::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{\s*mix-blend-mode: normal;\s*animation: none;\s*\}/);
});

test('el interruptor de toda la app usa el barrido', () => {
  const i = leer('app/_components/InterruptorModo.tsx');
  assert.match(i, /conBarrido\(e\.currentTarget, \(\) => aplicarModo\(!oscuro\)\)/);
  assert.equal(i.split('onClick={alternar}').length - 1, 2, 'los dos botones: la barra y la cabecera del teléfono');
});

test('la aparición está en el layout raíz, una sola vez, y no envuelve ni vuelve a montar la pantalla', () => {
  const l = leer('app/layout.tsx');
  assert.equal(l.split('<AparicionDeTab />').length - 1, 1);
  const a = leer('app/_components/AparicionDeTab.tsx');
  assert.match(a, /\.animate\(\{ opacity: \[0, 1\] \}/);
  assert.doesNotMatch(a, /animate\(\{[^}]*(transform|translate)/, 'un transform le cambia el ancla a lo fixed');
  assert.match(a, /prefers-reduced-motion/);
  assert.match(a, /if \(primera\.current\)/, 'no apaga lo que el server ya pintó');
  assert.match(a, /return null;/);
});
