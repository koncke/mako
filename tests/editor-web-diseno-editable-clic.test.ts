// =============================================================================
// El «Diseño editable» recibe el clic aunque su sección no esté activa (25/10/2026)
// =============================================================================
// Martín (25/10, ~11:30): «Las landing de MaKo NO son editables, no puedo ni cambiar un título de lo que ya esta, cada
// bloque debe ser editable». Medido con clics en el editor real (#32): el clic en el título caía en el envoltorio del
// iframe, porque BarraFormato apaga los iframes de un bloque no activo (`pointer-events:none`, para videos y embeds), y
// esta sección se activa justamente con el clic de ADENTRO del iframe. Con la regla apagada en la pestaña, el cursor
// entró al título; en una copia, lo escrito se guardó y siguió ahí al recargar.
//
// El test no busca un texto: arma el camino del DOM que dibuja la vista (envoltorio `.gmx-nv` SIN `data-activo` >
// marco > iframe), junta TODAS las reglas de los dos CSS (CSS_G2 y CSS_EDITABLE) que tocan `pointer-events`, se queda con
// las que le pegan a ese iframe y decide la ganadora por especificidad. Un empate se cuenta como falla: las dos hojas son
// `<style>` distintos y su orden no está garantizado.
// Correr: node --import tsx --test tests/editor-web-diseno-editable-clic.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

type Elemento = { tag: string; clases: Set<string>; attrs: Map<string, string> };
type Compuesto = { tag: string | null; clases: string[]; attrs: Array<[string, string | null]>; no: Compuesto[] };

/** Un selector compuesto (`div.a.b[x="y"]:not(.c)`): sólo lo que usan estas hojas. */
function compuesto(s: string): Compuesto {
  const c: Compuesto = { tag: null, clases: [], attrs: [], no: [] };
  const re = /^([a-z][a-z0-9-]*|\*)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:not\(([^)]*)\)|(:{1,2}[\w-]+(?:\([^)]*\))?)/gy;
  let m: RegExpExecArray | null;
  let i = 0;
  while (i < s.length && (re.lastIndex = i, (m = re.exec(s)))) {
    if (m[1] && m[1] !== '*') c.tag = m[1];
    else if (m[2]) c.clases.push(m[2]);
    else if (m[3]) c.attrs.push([m[3], m[4] ?? null]);
    else if (m[5] !== undefined) c.no.push(compuesto(m[5]));
    else if (m[6]) throw new Error(`pseudo sin soporte en el test: ${m[6]}`);
    i = re.lastIndex;
  }
  if (i !== s.length) throw new Error(`no entiendo «${s}»`);
  return c;
}

const pega = (c: Compuesto, e: Elemento): boolean =>
  (!c.tag || c.tag === e.tag)
  && c.clases.every((k) => e.clases.has(k))
  && c.attrs.every(([a, v]) => e.attrs.has(a) && (v === null || e.attrs.get(a) === v))
  && c.no.every((n) => !pega(n, e));

const especificidad = (c: Compuesto): [number, number] => c.no.reduce<[number, number]>(
  ([a, b], n) => { const [x, y] = especificidad(n); return [a + x, b + y]; },
  [c.clases.length + c.attrs.length, c.tag ? 1 : 0]);

/** ¿El selector le pega al último del camino (de la raíz al elemento)? Descendiente (« ») e hijo («>»). */
function pegaAlCamino(selector: string, camino: Elemento[]): [number, number] | null {
  const partes = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
  const pasos: Array<{ c: Compuesto; hijo: boolean }> = [];
  for (let i = 0; i < partes.length; i++) {
    if (partes[i] === '>') continue;
    pasos.push({ c: compuesto(partes[i]), hijo: partes[i - 1] === '>' });
  }
  const prueba = (p: number, e: number): boolean => {
    if (!pega(pasos[p].c, camino[e])) return false;
    if (p === 0) return true;
    if (pasos[p].hijo) return e > 0 && prueba(p - 1, e - 1);
    for (let k = e - 1; k >= 0; k--) if (prueba(p - 1, k)) return true;
    return false;
  };
  if (!prueba(pasos.length - 1, camino.length - 1)) return null;
  return pasos.reduce<[number, number]>(([a, b], { c }) => { const [x, y] = especificidad(c); return [a + x, b + y]; }, [0, 0]);
}

/** Las reglas `selector{...pointer-events:X...}` de una hoja escrita como lista de strings. */
function reglasPointer(css: string): Array<{ selector: string; valor: string }> {
  const out: Array<{ selector: string; valor: string }> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const valor = /pointer-events:\s*([a-z]+)/.exec(m[2])?.[1];
    if (!valor) continue;
    for (const s of m[1].split(',')) if (!/@|::?(before|after)|:hover|:focus/.test(s)) out.push({ selector: s.trim(), valor });
  }
  return out;
}

const el = (tag: string, clases: string, attrs: Record<string, string> = {}): Elemento =>
  ({ tag, clases: new Set(clases.split(/\s+/).filter(Boolean)), attrs: new Map(Object.entries(attrs)) });

test('el iframe del «Diseño editable» recibe el clic con la sección SIN activar (y la regla de los embeds sigue para los demás)', async () => {
  const { CSS_G2 } = await import('../app/web-generator/editor/BarraFormato');
  const { CSS_EDITABLE } = await import('../app/web-generator/editor/nodos/HtmlEditableVista');
  const reglas = [...reglasPointer(CSS_G2), ...reglasPointer(CSS_EDITABLE)];

  // El camino que dibuja HtmlEditableVista (lo confirma el test de abajo), sin `data-activo`: así está antes del clic.
  const lienzo = el('div', 'ProseMirror', { contenteditable: 'true' });
  const envoltorio = el('div', 'gmx-nv', { 'data-node-view-wrapper': '' });
  const marco = el('div', 'gmx-nv-marco gmx-editable-vivo gm-editable', { contenteditable: 'false' });
  const iframe = el('iframe', '', { sandbox: 'allow-same-origin', title: 'Diseño editable' });
  const caminoDe = (cuerpo: Elemento) => [lienzo, envoltorio, cuerpo, iframe];

  const ganadora = (camino: Elemento[]) => {
    const pegan = reglas.flatMap((r) => { const e = pegaAlCamino(r.selector, camino); return e ? [{ ...r, e }] : []; });
    pegan.sort((x, y) => y.e[0] - x.e[0] || y.e[1] - x.e[1]);
    return { pegan, primera: pegan[0], empate: pegan.length > 1 && pegan[0].e[0] === pegan[1].e[0] && pegan[0].e[1] === pegan[1].e[1] && pegan[0].valor !== pegan[1].valor };
  };

  const disenio = ganadora(caminoDe(marco));
  assert.ok(disenio.primera, 'ninguna regla de pointer-events le pega al iframe: ¿cambió el camino del DOM?');
  assert.equal(disenio.empate, false, `empate de especificidad: gana la hoja que se cargue última (${JSON.stringify(disenio.pegan)})`);
  assert.equal(disenio.primera.valor, 'auto', `el clic no llega al «Diseño editable»: gana «${disenio.primera.selector}{pointer-events:${disenio.primera.valor}}»`);

  // Un embed (InsertadoVista, HtmlLibreVista) sin activar sigue sin tragarse el clic que elige el bloque.
  const embed = ganadora(caminoDe(el('div', 'gmx-nv-marco gmx-html-vivo', { contenteditable: 'false' })));
  assert.equal(embed.primera?.valor, 'none', 'la regla de los embeds desapareció o les gana la del diseño');
});

test('el camino del DOM del test es el que dibuja la vista', () => {
  const vista = leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx');
  assert.match(vista, /<NodeViewWrapper className="gmx-nv" data-activo=\{mostrarBarra \? 'si' : undefined\}/);
  // 29/10/2026: la caja mide la escala de la copia (ref) y, achicada, recorta al alto escalado; el iframe sigue adentro.
  assert.match(vista, /<div ref=\{cajaMarco\} className="gmx-nv-marco gmx-editable-vivo gm-editable" contentEditable=\{false\}\n\s*style=\{escala < 1 \? \{ height: Math\.ceil\(alto \* escala\) \+ 'px', overflow: 'hidden' \} : undefined\}>\n\s*<iframe ref=\{marco\}/);
  // La sección se activa con el mousedown de ADENTRO del iframe: por eso el clic tiene que llegar.
  // (26/10/2026: el diseño activo vive en ../puente-diseno.ts, que también lee la barra «Texto».)
  assert.match(vista, /d\.addEventListener\('mousedown', \(e\) => \{\n\s*activarDiseno\(\{ doc: d, guardar: \(\) => guardarVivo\.current\(\) \}\);\n\s*marcarSeccion\(\);/);
  assert.match(vista, /if \(editable\) d\.body\.setAttribute\('contenteditable', 'true'\);/);
});
