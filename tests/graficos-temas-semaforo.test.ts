// LA PALETA CAMBIA, EL SEMÁFORO NO — la regla A6 de docs/diseno-dashboards-codeandchill.md
//
// Tenemos 7 plantillas de estilo donde la hoja guarda `plantilla`, `acento` y `fuente`, y «todo lo demás
// lo decide la plantilla, así ningún gráfico puede quedar mal combinado». Lo que no estaba escrito es qué
// pasa con el verde de «bueno» y el rojo de «malo» cuando alguien elige un acento rojo.
//
// La regla: el ACENTO cambia las series, nunca el semáforo. Un KPI se pinta por lo que SIGNIFICA su
// métrica (`colorDeTono`: lo cobrado es bueno, lo pendiente es malo) y eso sale de los tokens
// `--good`/`--bad`, no de la paleta de la hoja. `AGENTS.md`: «UN SOLO SIGNIFICADO POR COLOR».
//
// ⚠️ MEDIDO EL 31/10/2026, y vale decirlo porque este test NO lo arregla: cuatro plantillas (`mako`,
// `minimal`, `elevada`, `general`) tienen colores de SERIE idénticos al semáforo —`#D0504A` es
// exactamente `--bad` y `#1E9E57` exactamente `--good`—. No colisiona el acento (todos los primeros
// colores son azules), que es lo que este test blinda. Lo de las series está anotado en
// docs/hallazgos-graficos.md: cambiarlo repinta todas las hojas que ya existen, y eso es una decisión de
// producto, no una corrección que un test deba forzar por su cuenta.
//
// Correr: node --import tsx --test tests/graficos-temas-semaforo.test.ts
//
// Probados rompiéndolos (31/10/2026), con la base en 0 fallos (4 tests):
//   · poner `#D0504A` (el rojo de --bad) de primer color de la paleta `mako`
//       → 3 pass / 1 fail («el ACENTO de una plantilla nunca es un color del semáforo»)
//   · `colorDeTono('bueno')` devolviendo `paletaDe(tema)[0]` en vez de `var(--good)`
//       → 3 pass / 1 fail («el color de un KPI sale de su SIGNIFICADO…»)
//   · borrar la frase del panel
//       → 3 pass / 1 fail («la regla está DICHA en la pantalla»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETA_MAKO, PLANTILLAS_TEMA, colorDeTono, paletaDe, sanearTema, type TemaHoja } from '../lib/graficos-temas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/**
 * Los hex del SEMÁFORO en el tema claro (app/globals.css). Se leen del archivo y no se copian a mano:
 * si alguien cambia `--bad`, este test tiene que seguir midiendo contra el `--bad` de verdad.
 */
function semaforo(): Record<string, string> {
  const css = leer('app/globals.css');
  // El primer bloque `:root` es el tema claro; alcanza con la PRIMERA definición de cada token.
  const uno = (tok: string) => css.match(new RegExp(`--${tok}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  const out: Record<string, string> = {};
  for (const t of ['good', 'warn', 'warn-fill', 'bad']) {
    const v = uno(t);
    assert.ok(v, `no encontré --${t} en app/globals.css`);
    out[t] = v!.toLowerCase();
  }
  return out;
}

const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Distancia en sRGB. No es perceptual, pero para «¿es el mismo color?» alcanza y no necesita librería. */
const distancia = (a: string, b: string) => {
  const [x, y, z] = rgb(a); const [p, q, r] = rgb(b);
  return Math.sqrt((x - p) ** 2 + (y - q) ** 2 + (z - r) ** 2);
};

/** Cuánto tiene que separarse el acento del semáforo. 45 sobre 441 de máximo: «no es ese color». */
const MINIMA = 45;

test('el ACENTO de una plantilla nunca es un color del semáforo', () => {
  const sem = semaforo();
  for (const p of PLANTILLAS_TEMA) {
    // Las paletas de Corbel son variables (cambian en oscuro): se mide su color claro, que es el respaldo de la variable.
    const acento = (/#[0-9a-f]{6}/i.exec(p.paleta[0])?.[0] ?? p.paleta[0]).toLowerCase();
    for (const [tok, hex] of Object.entries(sem)) {
      const d = distancia(acento, hex);
      assert.ok(
        d >= MINIMA,
        `la plantilla «${p.id}» arranca en ${acento}, que está a ${d.toFixed(1)} de --${tok} (${hex}): ` +
        'el primer color de la serie es el acento, y un acento que es el rojo de «malo» hace que el color deje de significar una sola cosa',
      );
    }
  }
});

test('el color de un KPI sale de su SIGNIFICADO, no de la paleta de la hoja', () => {
  // Con cualquier plantilla y con CUALQUIER acento elegido a mano, «bueno» es --good y «malo» es --bad.
  const acentos = [null, '#d0504a', '#1e9e57', '#ee7b1c', '#3b6fb0'];
  for (const p of PLANTILLAS_TEMA) {
    for (const acento of acentos) {
      const tema: TemaHoja = { plantilla: p.id, acento, fuente: null };
      assert.equal(colorDeTono('bueno', tema), 'var(--good)', `«${p.id}» con acento ${acento}`);
      assert.equal(colorDeTono('malo', tema), 'var(--bad)', `«${p.id}» con acento ${acento}`);
      // Lo neutro no se pinta: null es «filete gris, número en tinta», nunca un color inventado.
      assert.equal(colorDeTono(null, tema), null);
      // Y el «acento» sí sigue a la hoja: es el único de los tres que la paleta decide.
      assert.equal(colorDeTono('acento', tema), paletaDe(tema)[1] ?? paletaDe(tema)[0]);
    }
  }
});

test('un acento elegido a mano cambia la serie 0 y NADA más', () => {
  const tema = sanearTema({ plantilla: 'vieja', acento: '#d0504a' });
  const paleta = paletaDe(tema);
  assert.equal(paleta[0], '#d0504a', 'el acento es el primer color de la serie');
  // Los otros siete siguen siendo los de la plantilla: elegir un acento no repinta la paleta entera.
  assert.deepEqual(paleta.slice(1), PLANTILLAS_TEMA.find((p) => p.id === 'vieja')!.paleta.slice(1));
});

test('la regla está DICHA en la pantalla, no escondida en una guía', () => {
  const panel = leer('app/dashboard/PanelEstilo.tsx');
  assert.match(panel, /Los colores de estado conservan su significado en cada paleta/,
    'la frase es la regla entera y tiene que estar en el panel de estilo');
});
