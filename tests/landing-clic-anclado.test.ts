// =============================================================================
// El clic ANCLADO al elemento (snippet v22, mig 0201) — lo que el mapa de calor necesita
// =============================================================================
// El punto de página de la v20 no alcanza para ubicar un toque sobre una foto de la
// página: medido el 06/10/2026, el alto del documento en la misma página y al mismo
// ancho de celular dio 3.518, 3.993 y 4.650 px. El elemento tocado sí se ubica igual
// en cualquier foto donde exista. Lo que se cuida acá:
//   · que el selector salga sin una letra del texto (privacidad: el texto de la zona
//     tocada puede ser el nombre de quien mira);
//   · que el selector que arma el snippet resuelva de verdad (se EJECUTA, no se lee);
//   · que el clic al vacío y el de un botón viajen con su ancla;
//   · que el beacon guarde el ancla saneada y no invente un `fijo`.
//
// Se lee el snippet EMITIDO (las reglas de escape del template literal aplicadas),
// igual que tests/landing-snippet-emitido.test.ts.
//
// Probado rompiéndolo el 06/10/2026 (con todo puesto: 5 pasan / 0 fallan):
//   · selDe usa innerText                                     -> 4 / 1
//   · selDe cuenta TODOS los hermanos, no los de su etiqueta   -> 4 / 1
//   · el clic al vacío deja de mandar `sel`                   -> 4 / 1
//   · el beacon guarda `fijo: false` cuando no viene          -> 4 / 1
//   · el saneo del selector acepta comillas                   -> 4 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);
const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function snippetEmitido(): string {
  const s = leer('../lib/landing-token.ts');
  const desde = s.indexOf('return ' + BT + '<script>');
  const hasta = s.indexOf('</script>' + BT + ';', desde);
  assert.ok(desde > 0 && hasta > desde, 'no se encontró el template del snippet');
  const tpl = s.slice(desde + ('return ' + BT).length, hasta);
  const mapa: Record<string, string> = { n: '\n', t: '\t', r: '\r', [BS]: BS, [BT]: BT, $: '$' };
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] === BS && i + 1 < tpl.length) { out += mapa[tpl[i + 1]] ?? tpl[i + 1]; i++; } else out += tpl[i];
  }
  return out;
}

/** selDe + anclaDe tal cual salen, para EJECUTARLAS sobre un DOM de mentira. */
function funcionesDelAncla(gen: string): string {
  const i = gen.indexOf('function selDe');
  assert.ok(i > 0, 'no está la función que arma el selector');
  const j = gen.indexOf('function anclaDe', i);
  assert.ok(j > i, 'no está la función que arma el ancla');
  const fin = gen.indexOf('\n  // ', j);
  const bloque = gen.slice(i, fin > j ? fin : undefined);
  assert.ok(bloque.length > 800 && bloque.length < 4000, `el recorte quedó en ${bloque.length}: está mirando otra cosa`);
  return bloque;
}

type N = { nodeType: number; tagName: string; id?: string; parentElement: N | null; previousElementSibling: N | null; getBoundingClientRect?: () => unknown };

test('el selector se arma SIN una letra del texto', () => {
  const bloque = funcionesDelAncla(snippetEmitido());
  const sel = bloque.slice(0, bloque.indexOf('function anclaDe'));
  assert.doesNotMatch(sel, /innerText|textContent|\.value|getAttribute\('(alt|title|aria-label)'\)/, 'el selector lee texto: si el toque cae sobre un campo lleno, eso son los datos de la persona');
});

test('el selector que arma el snippet RESUELVE: posición entre hermanas de su etiqueta e id como ancla', () => {
  const bloque = funcionesDelAncla(snippetEmitido());
  const win = { innerHeight: 800, getComputedStyle: () => ({ position: 'static' }) };
  const f = new Function('window', bloque + '\nreturn { selDe, anclaDe };')(win);
  const body: N = { nodeType: 1, tagName: 'BODY', parentElement: null, previousElementSibling: null };
  const p1: N = { nodeType: 1, tagName: 'P', parentElement: body, previousElementSibling: null };
  const sec1: N = { nodeType: 1, tagName: 'SECTION', parentElement: body, previousElementSibling: p1 };
  const sec2: N = { nodeType: 1, tagName: 'SECTION', parentElement: body, previousElementSibling: sec1 };
  const btn: N = { nodeType: 1, tagName: 'BUTTON', parentElement: sec2, previousElementSibling: null,
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 200, height: 50 }) };
  // La <p> de adelante NO cuenta: nth-of-type cuenta sólo las de la misma etiqueta.
  assert.equal(f.selDe(btn), 'body > section:nth-of-type(2) > button:nth-of-type(1)');
  const precio: N = { nodeType: 1, tagName: 'DIV', id: 'precio', parentElement: sec2, previousElementSibling: btn };
  const span: N = { nodeType: 1, tagName: 'SPAN', parentElement: precio, previousElementSibling: null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  assert.equal(f.selDe(span), '#precio > span:nth-of-type(1)');
  // El ancla: dónde dentro de la caja, en milésimos, y el pliegue.
  assert.deepEqual(f.anclaDe(btn, { clientX: 150, clientY: 225 }), { sel: 'body > section:nth-of-type(2) > button:nth-of-type(1)', rx: 250, ry: 500, vh: 800, fijo: false });
  // Un elemento fijo se marca: se ubica sólo por el elemento.
  const fijoWin = { innerHeight: 700, getComputedStyle: () => ({ position: 'fixed' }) };
  const g = new Function('window', bloque + '\nreturn { anclaDe };')(fijoWin);
  assert.equal(g.anclaDe(btn, { clientX: 300, clientY: 250 }).fijo, true);
});

test('el toque al vacío y el clic en un botón viajan con su ancla', () => {
  const gen = snippetEmitido();
  const i = gen.indexOf("addEventListener('click'");
  const bloque = gen.slice(i, gen.indexOf('}, true);', i));
  const vacio = bloque.slice(bloque.indexOf('if (!accionable(el))'), bloque.indexOf("if (CLICKS >= 40) return;"));
  assert.match(vacio, /anclaDe\(tocado, ev\)/, 'el toque al vacío no lleva su ancla');
  assert.match(vacio, /dv\.sel = av\.sel/);
  const boton = bloque.slice(bloque.indexOf("if (CLICKS >= 40) return;"));
  assert.match(boton, /anclaDe\(el, ev\)/, 'el clic en un botón no lleva su ancla');
  assert.match(boton, /d\.sel = a\.sel/);
});

test('el beacon guarda el ancla y NO inventa un `fijo`', () => {
  const r = leer('../app/api/track/vsl/route.ts');
  assert.match(r, /sel: selector\(payload\.sel\)/);
  assert.match(r, /rel_x: milesimo\(payload\.rel_x\)/);
  assert.match(r, /rel_y: milesimo\(payload\.rel_y\)/);
  assert.match(r, /alto_ventana: pixel\(payload\.alto_ventana/);
  assert.match(r, /fijo: payload\.fijo === true \? true : payload\.fijo === false \? false : null/, 'un Pixel anterior a la v22 no lo midió: es NULL, no false');
});

test('el saneo del selector sólo acepta la forma de una ruta CSS', () => {
  const r = leer('../app/api/track/vsl/route.ts');
  const m = /return \/(\^\[[^\]]+\]\+\$)\/\.test\(s\) \? s : null;/.exec(r);
  assert.ok(m, 'no está el saneo del selector');
  const re = new RegExp(m[1]);
  assert.ok(re.test('body > section:nth-of-type(2) > button:nth-of-type(1)'));
  assert.ok(re.test('#precio > span:nth-of-type(1)'));
  // El beacon es público: un selector con comillas o corchetes no salió del snippet.
  assert.ok(!re.test('a[href="x"]'));
  assert.ok(!re.test("div'><script>"));
});
