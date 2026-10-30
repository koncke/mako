// =============================================================================
// Los tokens de `.ce` son hex: `hsl(var(--x))` es CSS inválido y sale transparente
// =============================================================================
// Documentado en docs/hallazgos-video-editor.md («El tema vive en .ce»): los tokens
// de OpenCut eran tripletes HSL y en el port son hex, así que `hsl(#262626)` no vale
// y lo que lo usa se dibuja SIN color, sin error. Los marcadores salieron sin fondo
// por esto, y quedaba uno más —el anillo de selección— que este test terminó de sacar.
//
// Un grep que se corre en cada suite vale más que la nota «se buscan con grep».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..', 'app', 'video-editor');

function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.(tsx?|css)$/.test(n)) out.push(p);
  }
  return out;
}

test('ningún archivo del editor usa hsl(var(--…))', () => {
  const culpables: string[] = [];
  for (const p of archivos(RAIZ)) {
    const src = readFileSync(p, 'utf8');
    const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    for (const m of sinComentarios.matchAll(/hsl\(var\(/g)) {
      const linea = sinComentarios.slice(0, m.index).split('\n').length;
      culpables.push(`${relative(RAIZ, p).replace(/\\/g, '/')}:${linea}`);
    }
  }
  assert.deepEqual(
    culpables, [],
    'Estos usan `hsl(var(--…))`, que con tokens hex es inválido y se dibuja transparente:\n  '
    + culpables.join('\n  ') + '\n\nUsá `var(--token)` directo, o la clase de Tailwind (`ring-primary`).',
  );
});

// =============================================================================
// Los colores de MaKo, no los de CapCut (29/10/2026)
// =============================================================================
// Martín: «Quiero que en las tabs de Editor e Image, pongas los colores de MaKo, no esos colores». La paleta de `.ce`
// (capcut-theme.css) pasó de los hex MEDIDOS de CapCut (casi negro, el cian #00c1cd) a los tokens de app/globals.css, y el
// editor dejó de forzar el oscuro: sigue el tema que eligió la persona.
// ⚠️ PROBADO ROMPIENDOLO (29/10/2026, base 5/0): `--cc-panel: #262626;` de vuelta → 1 fallo; `--primary: var(--cc-accent);`
// en `.ce` (el CICLO) → 1; `color-scheme: dark;` en `.ce` → 1; el `@custom-variant dark` atado a `.ce` → 1; `<TemaOscuro />`
// en VideoEditorCliente → 1; el cian en una clase del motor → 1.

const TEMA = readFileSync(join(RAIZ, 'capcut-theme.css'), 'utf8').replace(/\r\n/g, '\n');
const sinComentariosCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque `.ce { … }` (el primero: la paleta). */
const bloqueCe = (): string => {
  const css = sinComentariosCss(TEMA);
  const i = css.indexOf('\n.ce {');
  assert.ok(i >= 0, 'no encontré el bloque `.ce {` de capcut-theme.css');
  return css.slice(i, css.indexOf('\n}', i));
};

test('la paleta de `.ce` sale de los tokens de MaKo (salvo los colores de los clips, que son dato)', () => {
  const props = [...bloqueCe().matchAll(/(--cc-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()] as const);
  assert.ok(props.length > 30, `leí ${props.length} --cc-*: el bloque cambió de forma`);
  const clavados = props.filter(([n, v]) => !n.startsWith('--cc-clip-') && !/\bvar\(--/.test(v));
  assert.deepEqual(clavados, [], 'Estos --cc-* tienen un color clavado (de CapCut): van sobre un token de MaKo (--surface, --ink, --primary…)');
  assert.equal(new Map(props).get('--cc-accent'), 'var(--primary)', 'el acento del editor es el azul de MaKo');
});

test('`.ce` no redefine los tokens de MaKo que sus --cc-* leen (sería un ciclo: los dos quedan inválidos y transparentes)', () => {
  const ce = bloqueCe();
  for (const t of ['primary', 'border', 'bg', 'surface', 'surface-2', 'ink', 'dim', 'faint', 'border-strong', 'on-primary', 'velo-hover', 'focus-ring']) {
    assert.doesNotMatch(ce, new RegExp(`\\n\\s*--${t}:`), `.ce redefine --${t}: el editor tiene que tomarlo tal cual de MaKo`);
  }
});

test('el editor no fuerza el oscuro: ni `color-scheme`, ni `dark:` atado a `.ce`, ni TemaOscuro en sus páginas', () => {
  const css = sinComentariosCss(TEMA);
  assert.doesNotMatch(css, /color-scheme:\s*dark/);
  assert.match(css, /@custom-variant dark \(&:where\(\[data-tema="oscuro"\], \[data-tema="oscuro"\] \*\)\);/, '`dark:` sigue al tema de MaKo');
  for (const f of ['VideoEditorCliente.tsx', 'page.tsx', '[proyecto]/page.tsx', '../m/video-editor/[proyecto]/page.tsx', '../m/video-editor/EditorVideoM.tsx']) {
    const src = readFileSync(join(RAIZ, f), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /TemaOscuro/, `${f}: volvió a forzar el oscuro`);
    assert.doesNotMatch(src, /<PantallaCompletaM[^>]*\boscura\b/, `${f}: la capa del teléfono volvió a ser oscura`);
  }
});

test('ni el cian de CapCut en el editor (salvo estilos de texto, que son contenido del video)', () => {
  const culpables: string[] = [];
  for (const p of archivos(RAIZ)) {
    const rel = relative(RAIZ, p).replace(/\\/g, '/');
    // Los estilos predefinidos de texto y subtítulos son DISEÑOS que la persona le pone a su video («Etiqueta cian»).
    if (/^_opencut\/(text\/estilos-predefinidos|subtitles\/estilos)\.ts$/.test(rel)) continue;
    const src = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    if (/#00c1cd|0 193 205|0,\s*193,\s*205/i.test(src)) culpables.push(rel);
  }
  assert.deepEqual(culpables, [], 'el cian de CapCut: el acento del editor es `--primary` (el azul de MaKo)');
});
