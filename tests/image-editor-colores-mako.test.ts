// =============================================================================
// El Image Editor con los COLORES DE MAKO, no los de Canva (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «Quiero que en las tabs de Editor e Image, pongas los colores de MaKo, no esos colores». Hasta ese
// día el cromo del editor tenía la paleta de Canva medida (el violeta #8B3DFF de acción y selección, el gris #F6F7F8, el
// degradé celeste → violeta de la barra de arriba, Noto Sans y «un solo tema: claro»). Lo que fija:
//   1. los tokens del editor (`--cv-*`, _doory/styles/tokens.css) apuntan a los de MaKo (app/globals.css), así que siguen
//      el tema claro u oscuro de la app; ninguno es un color clavado salvo los tres que no son cromo;
//   2. ninguna hoja del editor vuelve a clavar un color de Canva (sólo el cromo: el CONTENIDO del diseño no pasa por CSS);
//   3. el chat de MaKo del editor vive FUERA de `.cv` (la tarjeta izquierda de Create): sus estilos no pueden usar `--cv-*`;
//   4. el lienzo lee la selección de la raíz `.cv` (en <html> no hay `--cv-*`: usaba el violeta de respaldo de Doory) y se
//      vuelve a pintar cuando MaKo cambia de tema (`data-tema`);
//   5. la letra es la de MaKo: ni la hoja de Noto Sans ni su cargador.
//
// Correr: node --import tsx --test tests/image-editor-colores-mako.test.ts
// PROBADO ROMPIÉNDOLO (29/10/2026): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentariosCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function archivos(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const ruta = `${dir}/${nombre}`;
    if (statSync(join(RAIZ, ruta)).isDirectory()) out.push(...archivos(ruta, ext));
    else if (ext.test(nombre)) out.push(ruta);
  }
  return out;
}

const TOKENS = 'app/image-editor/_doory/styles/tokens.css';

/** Las declaraciones `--cv-*` de la raíz `.cv` (el primer bloque). */
function tokens(): Map<string, string> {
  const css = sinComentariosCss(leer(TOKENS));
  const bloque = /\.cv\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  return new Map([...bloque.matchAll(/(--cv-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

test('1: los tokens del cromo son los de MaKo', () => {
  const t = tokens();
  const esperado: Record<string, string> = {
    '--cv-color-brand': 'var(--primary)',
    '--cv-color-brand-hover': 'var(--primary-strong)',
    '--cv-color-brand-soft': 'var(--primary-bg)',
    '--cv-color-on-brand': 'var(--on-primary)',
    '--cv-color-cta': 'var(--primary)',
    '--cv-selection-color': 'var(--primary)',
    '--cv-color-selected': 'var(--primary-bg)',
    '--cv-color-selected-text': 'var(--primary-strong)',
    '--cv-color-bg': 'var(--bg)',
    '--cv-chrome': 'var(--bg)',
    '--cv-color-canvas-workspace': 'var(--bg)',
    '--cv-color-surface': 'var(--surface)',
    '--cv-color-bg-subtle': 'var(--surface-2)',
    '--cv-color-bg-muted': 'var(--velo-hover)',
    '--cv-color-border': 'var(--border)',
    '--cv-color-border-strong': 'var(--border-strong)',
    '--cv-color-text': 'var(--ink)',
    '--cv-color-text-muted': 'var(--dim)',
    '--cv-color-text-subtle': 'var(--faint)',
    '--cv-header-bg': 'var(--surface)',
    '--cv-header-text': 'var(--ink)',
    '--cv-color-success': 'var(--good)',
    '--cv-color-warning': 'var(--warn)',
    '--cv-color-danger': 'var(--bad)',
    '--cv-focus-ring': 'var(--focus-ring)',
  };
  for (const [k, v] of Object.entries(esperado)) assert.equal(t.get(k), v, `${k} tiene que ser ${v}`);
  assert.match(t.get('--cv-font-sans') ?? '', /'Geist'/, 'la letra de MaKo');
  assert.doesNotMatch(t.get('--cv-font-sans') ?? '', /Noto/);
});

test('1: ningún token es un color clavado, salvo los que no son cromo', () => {
  // La pantalla de presentación (negra en todo tema: es una pantalla proyectada) y las guías del lienzo (magenta, para no
  // confundirse con la selección azul).
  const CLAVADOS = new Set(['--cv-color-stage', '--cv-color-on-stage', '--cv-guide-color']);
  for (const [k, v] of tokens()) {
    if (CLAVADOS.has(k)) continue;
    assert.doesNotMatch(v, /#[0-9a-f]{3,8}\b|\brgba?\((?!18 21 27)/i, `${k}: ${v} — un color clavado no sigue el tema de la app`);
  }
  const css = sinComentariosCss(leer(TOKENS));
  assert.doesNotMatch(css, /--cv-header-gradient|--cv-violet-|--cv-pastel-/, 'el degradé y las escalas de Canva se fueron');
  assert.match(css, /\[data-tema='oscuro'\] \.cv \{\s*color-scheme: dark;/, 'en oscuro, los controles nativos también');
});

test('2: ninguna hoja del editor clava un color de Canva', () => {
  const CANVA = /#(8b3dff|7630d7|a370fc|ebdcff|f1eaff|f3ecff|e7dbff|d4bfff|612dae|5100a8|00c4cc|02c4cc|3d8bff|6430f5|f6f7f8|f3ebfd|0e1318|daf1f8|e9defc|7d2ae8|6a52d9)\b|rgb\(163 112 252|rgb\(21 30 130|--cv-header-gradient|--cv-violet-|--cv-pastel-|--cv-ink\b|--cv-paper\b/i;
  const malos: string[] = [];
  for (const f of [...archivos('app/image-editor', /\.css$/), ...archivos('app/m/image-editor', /\.css$/)]) {
    if (f === TOKENS) continue;
    sinComentariosCss(leer(f)).split('\n').forEach((l, i) => { if (CANVA.test(l)) malos.push(`${f}:${i + 1}: ${l.trim()}`); });
  }
  assert.deepEqual(malos, [], `colores de Canva en el cromo:\n  ${malos.join('\n  ')}`);
});

test('2: la barra de arriba es la superficie de MaKo, y «Compartir» el botón primario', () => {
  const barra = sinComentariosCss(leer('app/image-editor/_doory/editor/TopBar.module.css'));
  const bar = /\.bar \{([^}]*)\}/.exec(barra)?.[1] ?? '';
  assert.match(bar, /background: var\(--cv-header-bg\);/);
  assert.match(bar, /color: var\(--cv-header-text\);/);
  const share = /\.share \{([^}]*)\}/.exec(barra)?.[1] ?? '';
  assert.match(share, /background: var\(--cv-color-cta\);/);
  assert.match(share, /color: var\(--cv-color-on-cta\);/);
});

test('3: el chat de MaKo del editor vive fuera de `.cv`: sus estilos son los de MaKo', () => {
  const css = sinComentariosCss(leer('app/image-editor/mako/chat/chat.module.css'));
  assert.doesNotMatch(css, /var\(--cv-/, 'afuera de `.cv` un `--cv-*` no vale nada: el chat saldría sin colores');
  assert.match(css, /\.ranura\[hidden\] \{\s*display: none;/, 'el hueco escondido mientras abre (su `display: flex` le gana al [hidden])');
});

test('4: el lienzo lee los tokens de la raíz `.cv` y se repinta con el tema de MaKo', () => {
  const tema = sinComentarios(leer('app/image-editor/_doory/editor/engine/objects/theme.ts'));
  assert.match(tema, /document\.querySelector\('\.cv'\) \?\? document\.documentElement/);
  assert.match(tema, /export function readCanvasTheme\(el: Element = raizDeTokens\(\)\)/);
  assert.match(tema, /selection: '#2F6FED'/, 'el respaldo es el azul de MaKo, no el violeta de Doory');
  const motor = sinComentarios(leer('app/image-editor/_doory/editor/engine/editor.ts'));
  assert.match(motor, /attributeFilter: \[[^\]]*'data-tema'[^\]]*\]/, 'sin `data-tema`, cambiar de tema no repinta la selección');
});

test('5: la letra es la de MaKo: sin Noto Sans ni su cargador', () => {
  assert.ok(!existsSync(join(RAIZ, 'app/image-editor/fuenteUi.tsx')), 'fuenteUi.tsx cargaba Noto Sans de Google');
  for (const f of archivos('app/image-editor', /\.(tsx?|css)$/)) {
    assert.doesNotMatch(sinComentarios(leer(f)), /Noto\+Sans|'Noto Sans'/, `${f} vuelve a pedir Noto Sans`);
  }
});

// PROBADO ROMPIÉNDOLO (29/10/2026, base 7/0; de a una, restaurando y comparando con `cmp`):
//   · `--cv-color-brand: #8b3dff` en tokens.css                                  → 5/2 (1 y 1: no es MaKo y es un color clavado);
//   · el violeta translúcido de Canva (`rgb(163 112 252 / 0.15)`) en Switch.module.css → 6/1 (2);
//   · `readCanvasTheme` leyendo otra vez de `document.documentElement`            → 6/1 (4);
//   · `color: var(--cv-color-text)` en chat.module.css                             → 6/1 (3).
// Restaurado: 7/0.
