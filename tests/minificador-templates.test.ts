// El minificador del build (SWC, el de Next 16.2) se COME texto al juntar templates de constantes.
//
// Medido el 13/10/2026 en producción: el script que pone el tema oscuro en MaKo Mobile
// (app/m/_ui/tema.ts) llegaba al navegador como `localStorage.getItem('mako.modoif(o){…` — sin
// `');var o=g==='oscuro';` — y tiraba «SyntaxError: missing ) after argument list» en cada página de
// /m. El fuente se leía perfecto y parseaba: lo que cambiaba era lo EMITIDO.
//
// La forma exacta, reproducida con `transform` de next/dist/build/swc (minify + compress):
//
//   const K = 'kk', J = 'jj';
//   `a${K}b` + `c` + `d${J}e`   →   "akkdjje"    (se pierden «b» y «c»)
//
// Hace falta que los DOS templates queden enteramente constantes (con una variable adentro no pasa) y
// que la constante se pueda meter en el template: en un archivo suelto SWC no siempre lo hace, pero
// en el build sí lo hizo con una constante IMPORTADA (`LS_MODO`). Por eso el test no confía en el
// archivo suelto: le pone las constantes adentro, como el build, antes de minificar.
//
// La regla: un script o un texto armado con constantes va en UN SOLO template literal (o con
// `[…].join('')`), nunca partido en templates con `+`.
//
// Verificado rompiéndolo (13/10/2026) — base 3 / 0: devolver tema.ts a los tres templates con `+`
// → 1 / 2 (el barrido lo nombra, y lo emitido no parsea).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { LS_MODO, ATTR_MODO } from '../lib/temas-candidatos';
import { TEMA_ANTES_DE_PINTAR } from '../app/m/_ui/tema';

const RAIZ = join(__dirname, '..');
const req = createRequire(join(RAIZ, 'package.json'));

/** Las cadenas `+` con dos o más templates cuyas `${…}` son TODAS constantes en MAYÚSCULAS. */
function sospechosos(): string[] {
  const archivos = execSync('git ls-files app lib proxy.ts', { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(tsx?)$/.test(f));
  const out: string[] = [];
  for (const f of archivos) {
    let src: string;
    try { src = readFileSync(join(RAIZ, f), 'utf8'); } catch { continue; }
    // Prefiltro barato: sólo se parsea lo que tiene una `${CONSTANTE}` y un template seguido de «+».
    if (!/\$\{[A-Z][A-Z0-9_]*\}/.test(src) || !/`\s*\+/.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const operandos = (n: ts.Node, acc: ts.Node[]): ts.Node[] => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { operandos(n.left, acc); operandos(n.right, acc); }
      else if (ts.isParenthesizedExpression(n)) operandos(n.expression, acc);
      else acc.push(n);
      return acc;
    };
    const constante = (t: ts.TemplateExpression) => t.templateSpans.every((s) => ts.isIdentifier(s.expression) && /^[A-Z][A-Z0-9_]*$/.test(s.expression.text));
    const visitar = (n: ts.Node) => {
      const esMas = (x: ts.Node) => ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken;
      if (esMas(n) && !esMas(n.parent)) {
        const temps = operandos(n, []).filter(ts.isTemplateExpression).filter(constante);
        if (temps.length >= 2) out.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return out;
}

test('nadie arma un texto con templates de constantes unidos con «+» (el minificador se come el medio)', () => {
  assert.deepEqual(sospechosos(), []);
});

/** Minifica `codigo` con el SWC del build y devuelve el módulo emitido. */
async function minificar(codigo: string, archivo: string): Promise<string> {
  const swc = req('next/dist/build/swc/index.js');
  if (swc.loadBindings) await swc.loadBindings();
  const r = await swc.transform(codigo, {
    filename: archivo,
    jsc: { parser: { syntax: 'typescript', tsx: archivo.endsWith('x') }, target: 'es2020', minify: { compress: true, mangle: false } },
    minify: true,
    module: { type: 'es6' },
  });
  return r.code as string;
}

test('el script del tema de /m sale ENTERO del minificador, con las constantes adentro como en el build', async () => {
  const fuente = readFileSync(join(RAIZ, 'app/m/_ui/tema.ts'), 'utf8')
    .replace(/^import .*temas-candidatos.*$/m, `const LS_MODO = ${JSON.stringify(LS_MODO)}; const ATTR_MODO = ${JSON.stringify(ATTR_MODO)};`);
  const emitido = await minificar(fuente, 'tema.ts');
  const m = emitido.match(/TEMA_ANTES_DE_PINTAR=("(?:[^"\\]|\\.)*")/);
  assert.ok(m, `no encontré el script en lo emitido: ${emitido.slice(0, 300)}`);
  const valor = JSON.parse(m![1]) as string;
  assert.equal(valor, TEMA_ANTES_DE_PINTAR, 'el minificador cambió el texto del script');
  assert.doesNotThrow(() => new Function(valor), 'lo emitido no parsea');
});

test('el script del tema oscuro de escritorio sale entero del minificador', async () => {
  const fuente = readFileSync(join(RAIZ, 'app/_components/TemaOscuroScript.tsx'), 'utf8');
  const emitido = await minificar(fuente, 'TemaOscuroScript.tsx');
  // Lo que sale: un template con las constantes adentro o ya resuelto. Se resuelve a mano y se parsea.
  const m = emitido.match(/__html:(`[^`]*`|"(?:[^"\\]|\\.)*")/);
  assert.ok(m, 'no encontré el script en lo emitido');
  const valor = m![1].startsWith('`')
    ? m![1].slice(1, -1).replace(/\$\{MARCA\}/g, 'data-tema').replace(/\$\{VALOR\}/g, 'oscuro').replace(/\$\{PRESTADO\}/g, 'data-tema-prestado')
    : JSON.parse(m![1]);
  assert.ok(valor.includes("d.setAttribute('data-tema-prestado','1')") && valor.includes("!=='oscuro'"), valor);
  assert.doesNotThrow(() => new Function(valor), 'lo emitido no parsea');
});
