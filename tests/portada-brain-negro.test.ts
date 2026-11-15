// =============================================================================
// El Second Brain de la portada: NEGRO SIEMPRE, y con los títulos legibles (15/11/2026)
// =============================================================================
// Martín: «lo mismo pasa con el Second Brain. El Second Brain siempre debe estar negro. No importa qué, siempre debe estar
// negro. El Second Brain tampoco lo copiaste tal cual como lo tenemos, porque no se ven los títulos, no se ven justamente,
// al menos no en el white mode, cuando sí debería verse todo».
//
// LAS DOS QUEJAS ERAN UNA SOLA FALLA. `.s-brain` pinta su caja con `background: var(--bg)`, y el `data-tema="oscuro"` estaba
// en un div HIJO. Una variable se resuelve en el elemento que la USA: la caja salía con los tokens claros de `:root`
// (--bg #efefed) mientras el grafo de adentro dibujaba sus etiquetas (`.cbg-et`, con `--cbg-texto: var(--ink)`) con el --ink
// oscuro, #ededeb. #ededeb sobre #efefed da 1,02:1 — los títulos estaban ahí, invisibles. En el modo oscuro se leían por
// accidente, porque el sol y la luna del sitio le llevaba ese #efefed a casi negro.
//
// Esto cuida las TRES cosas que lo mantienen negro, y viven en DOS archivos distintos — ahí está el riesgo de que se rompa
// sin que nadie toque la portada:
//   1. el atributo del tema va en el MISMO nodo que usa `var(--bg)`, como lo hace la app (app/second-brain/VistaCerebro.tsx);
//   2. la figura está marcada `data-tema-fijo`, para que el sol y la luna del sitio no entre;
//   3. y ese script SIGUE respetando la marca con `closest()`, que es lo único que cubre a los descendientes.
// Ninguna alcanza sola: con los tokens oscuros y sin la marca, el script le lleva el negro a casi blanco en el modo claro;
// con la marca y sin los tokens, la caja se queda con el #efefed claro en los DOS modos.
//
// PROBADO ROMPIÉNDOLO (15/11/2026): sacarle `data-tema-fijo` a `.s-brain` → rojo; devolver el `data-tema="oscuro"` al div de
// adentro → rojo; sacar `[data-tema-fijo]` del `fuera()` de TemaSitio → rojo; esconder `.cbg-et` en el recorte → rojo.
// Correr: node --import tsx --test tests/portada-brain-negro.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const BRAIN = leer('app/vsl/_sitio/BrainVivo.tsx');
const TEMA_SITIO = leer('app/vsl/_competencia/TemaSitio.tsx');

test('el tema oscuro y la marca van en el MISMO nodo que pinta con var(--bg)', () => {
  // La caja que se pinta es `.s-brain`, y es la que tiene que llevar el atributo: si el `data-tema` baja a un hijo, la caja
  // se pinta con los tokens claros y el grafo dibuja con los oscuros.
  const css = /\.s-brain \{([^}]*)\}/.exec(BRAIN);
  assert.ok(css, 'no está la regla .s-brain');
  assert.match(css[1], /background:\s*var\(--bg\)/, '.s-brain dejó de pintarse con el token del tema');

  const apertura = /<div className="s-brain"([^>]*)>/.exec(BRAIN);
  assert.ok(apertura, 'no está el <div className="s-brain">');
  assert.match(apertura[1], /data-tema="oscuro"/, 'el nodo que usa var(--bg) no lleva el tema oscuro');
  assert.match(apertura[1], /data-tema-fijo/, 'la figura no está marcada: el sol y la luna le va a dar vuelta el negro');

  // Y el tema se declara UNA sola vez: dos nodos con `data-tema` es justo la falla que se arregló. Los comentarios lo
  // nombran al explicar el porqué, así que se cuenta sobre el código, sin ellos.
  const codigo = BRAIN.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal((codigo.match(/data-tema="oscuro"/g) ?? []).length, 1, 'el tema está declarado en más de un nodo');
});

test('el --bg del tema oscuro es negro de verdad', () => {
  const css = leer('app/globals.css');
  const i = css.indexOf('[data-tema="oscuro"] {');
  assert.ok(i > 0, 'no está el bloque [data-tema="oscuro"]');
  const bg = /--bg:\s*#([0-9a-fA-F]{6})/.exec(css.slice(i));
  assert.ok(bg, 'el tema oscuro no define --bg');
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(bg[1].slice(k, k + 2), 16));
  const luz = (r + g + b) / 3 / 255;
  assert.ok(luz < 0.12, `--bg #${bg[1]} no es negro (luz ${luz.toFixed(3)}): el Second Brain tiene que estar negro siempre`);
});

test('el sol y la luna del sitio sigue dejando afuera lo marcado, y a sus descendientes', () => {
  const fuera = /var fuera=function\(n\)\{[^}]*\}/.exec(TEMA_SITIO);
  assert.ok(fuera, 'no está el descarte `fuera()` de TemaSitio: la marca de la figura puede haber quedado sin efecto');
  assert.match(fuera[0], /\[data-tema-fijo\]/, 'el script dejó de respetar [data-tema-fijo]');
  // `closest()` mira el elemento Y sus ancestros: es lo que hace que marcar el contenedor alcance para toda la figura.
  // Con un `matches()` habría que marcar cada nodo, y el grafo los crea solo.
  assert.match(fuera[0], /n\.closest\(/, 'el descarte dejó de ser por closest(): marcar el contenedor ya no cubre al grafo');
});

test('el piso de alto de la figura no se pasa de la fila, o los títulos de abajo quedan afuera del recorte', () => {
  // LA OTRA MITAD DE «no se ven los títulos», y NO es el color: en el teléfono quedaban dibujados AFUERA del recuadro.
  // MEDIDO en el navegador a 375 px (15/11/2026): la fila `.s-zz-vis` es `aspect-ratio:16/10` con `overflow:hidden` y con
  // `.s-cont{padding:0 20px}` el contenido mide 335,2 px, así que la fila da 210,1 px de alto. Un `min-height` FIJO le gana
  // al `height:100%`: con 380px la figura se plantaba en 380 px y 169,9 px —el 44,7 % del mapa, con sus títulos— caían
  // fuera del recorte. En los DOS modos, así que el negro no lo tapa.
  // El piso tiene que estar acotado al alto de la fila (`min(…, 100%)`): así nunca se pasa, y el grafo se reencuadra solo
  // —`ajustar()` mide la caja y corre con un ResizeObserver, app/second-brain/Grafo.tsx:1240— en vez de salirse.
  // A 1440 px no cambia nada: medido, la figura sigue en 398,9 px dentro de una fila de 400,5 px.
  const css = /\.s-brain \{([^}]*)\}/.exec(BRAIN);
  assert.ok(css, 'no está la regla .s-brain');
  assert.match(css[1], /overflow:\s*hidden/, '.s-brain dejó de recortar: el porqué de este test es justamente el recorte');
  const min = /min-height:\s*([^;]+)/.exec(css[1]);
  assert.ok(min, '.s-brain se quedó sin piso de alto');
  const valor = min[1].trim();
  assert.match(
    valor,
    /min\(\s*[\d.]+px\s*,\s*100%\s*\)/,
    `el piso de alto es "${valor}": un valor suelto le gana al height:100% y dibuja el mapa afuera de la fila (210 px a 375 px de ancho). Va acotado con min(…, 100%)`,
  );
});

test('el recorte de la figura no esconde los títulos de los nodos', () => {
  // Los nombres de los nodos son `.cbg-et` / `.cbg-et-n1` / `.cbg-et-area` (app/second-brain/Grafo.tsx). El recorte de la
  // portada esconde la barra, el pie y la ficha, no las etiquetas del mapa.
  // Se mira la REGLA entera, no el renglón: la lista de selectores del recorte ocupa tres líneas y el `display: none` está
  // sólo en la última, así que un `.cbg-et` agregado arriba pasaba sin que nadie lo viera.
  const hoja = /const CSS = `([\s\S]*?)`;/.exec(BRAIN);
  assert.ok(hoja, 'no está la hoja de estilos del recorte');
  const ocultas = hoja[1].split('}').filter((r) => /display:\s*none/.test(r));
  assert.ok(ocultas.length > 0, 'el recorte dejó de esconder la barra y el pie del grafo');
  for (const regla of ocultas) {
    const selector = regla.slice(0, regla.indexOf('{'));
    assert.doesNotMatch(selector, /cbg-et|cbg-mapa|cbg-lienzo|cbg-nodo|cbg-marco/, `el recorte esconde el mapa: ${selector.trim()}`);
  }
});
