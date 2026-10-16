// Las pantallas tienen que llegar VISIBLES a quien no ejecuta JavaScript.
//
// El layout raíz envolvía la app entera en un `<Suspense fallback={null}>` («por el
// useSearchParams del WsProvider»), y React escribe aparte —en un `<div hidden id="S:0">`
// que sólo se ve cuando corre un script— todo bloque de Suspense de más de ~12.800 bytes,
// aunque ya esté listo. Medido en producción el 10/10/2026: /privacidad, la política que
// revisa Google para verificar la app de la agenda, llegaba con 19 caracteres visibles. El
// 08/10 la misma causa hizo rebotar dos veces la verificación del negocio en Meta.
//
// Dos guardas: (1) en app/layout.tsx, ningún <Suspense> envuelve a `{children}` — se mira
// con el parser de TypeScript, no con una regex, porque lo que importa es el ANIDAMIENTO;
// (2) las páginas legales, renderizadas en streaming adentro de un documento (que es la
// única forma de reproducir el bloque oculto), se leen enteras sin JavaScript, y adentro
// del Suspense viejo NO — el control que prueba que el test mide la condición real.
//
// Probado rompiéndolo: ver el comentario del final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import ts from 'typescript';
import { createElement, Fragment, Suspense, type ReactElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import Privacidad from '../app/privacidad/page';
import Terminos from '../app/terminos/page';
import Reembolsos from '../app/reembolsos/page';

const LAYOUT = resolve(__dirname, '..', 'app/layout.tsx');

/** Los nombres de los elementos JSX que envuelven a la expresión `{children}` del layout. */
function ancestrosDeChildren(fuente: string): string[][] {
  const sf = ts.createSourceFile('layout.tsx', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const caminos: string[][] = [];
  const visitar = (n: ts.Node, pila: string[]) => {
    if (ts.isJsxElement(n)) pila = [...pila, n.openingElement.tagName.getText(sf)];
    if (ts.isJsxExpression(n) && n.expression && ts.isIdentifier(n.expression) && n.expression.text === 'children') {
      caminos.push(pila);
    }
    ts.forEachChild(n, (h) => visitar(h, pila));
  };
  visitar(sf, []);
  return caminos;
}

test('en el layout raíz, ningún <Suspense> envuelve a las pantallas', () => {
  const caminos = ancestrosDeChildren(readFileSync(LAYOUT, 'utf8'));
  assert.equal(caminos.length, 1, `esperaba un solo {children} en el layout y hay ${caminos.length}`);
  const [camino] = caminos;
  // Si el parser dejó de ver el árbol, el test no mide nada: el WsProvider tiene que estar.
  assert.ok(camino.includes('WsProvider'), `no encontré WsProvider arriba de {children}: ${camino.join(' > ')}`);
  assert.ok(!camino.some((t) => t === 'Suspense' || t.endsWith('.Suspense')),
    `{children} quedó adentro de un Suspense: ${camino.join(' > ')}`);
});

// La premisa que sostiene todo lo anterior: sin el Suspense, `useSearchParams` del WsProvider
// sólo anda porque NINGUNA ruta se prerenderiza estática, y eso lo garantiza UNA línea — el
// `await getSesionAdmin()` del layout, que lee las cookies en cada request. 61 páginas no
// declaran `force-dynamic` y son dinámicas sólo por eso. Si esa lectura se mueve detrás de un
// return, a un hijo o a un componente cliente, el build de Vercel se cae y producción se queda en
// la versión anterior sin que nada lo diga acá.
test('el layout lee la sesión ANTES de dibujar: es lo que vuelve dinámicas a todas las rutas', () => {
  const src = readFileSync(LAYOUT, 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('export default async function RootLayout');
  assert.ok(ini > 0, 'el layout dejó de ser una función async: no puede leer la sesión');
  const ret = src.indexOf('\n  return (', ini);
  assert.ok(ret > ini, 'no encontré el return del layout');
  const antes = src.slice(ini, ret).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.match(antes, /await getSesionAdmin\(\)/, 'el layout ya no lee la sesión antes de dibujar');
});

// Un `loading.tsx` es un <Suspense> alrededor de la página de su segmento (y de todo lo que
// cuelga): uno en app/ o en un segmento público volvería a esconder esas páginas sin JavaScript,
// y el test de arriba seguiría verde porque mira el layout. Lista blanca EXPLÍCITA: un
// loading.tsx nuevo se decide —y sólo va en segmentos privados—; uno de la lista que ya no existe
// también falla, para que no quede un permiso escrito para algo que nadie usa.
const LOADING_PERMITIDOS = [
  'app/crm/loading.tsx',
  // El Centro de Operaciones (16/10/2026): /admin es privado entero, y Martín se quejó de que «tarda mucho en
  // aparecer». El esqueleto es la forma de la pantalla (la barra y la caja), para que nada salte al llegar.
  'app/admin/operaciones/loading.tsx',
  // MaKo Mobile (v2, 11/10/2026): /m es PRIVADO entero (cada page.tsx llama a requireMovil), así
  // que su esqueleto no esconde nada público. Es lo que hace sentir nativa la entrada a una
  // sección cuya lectura tarda (la pauta, el informe, el historial de videos, las landings).
  'app/m/ads/loading.tsx',
  'app/m/automations/loading.tsx',
  'app/m/dashboard/loading.tsx',
  'app/m/landing/loading.tsx',
  'app/m/landing/[id]/loading.tsx',
  'app/m/plan/loading.tsx',
  'app/m/video/loading.tsx',
  'app/m/video/[id]/loading.tsx',
  // v3 (14/10/2026): las pestañas de la barra y lo que se abre desde ellas. Medido en producción: sin
  // esqueleto, tocar una pestaña dejaba la pantalla anterior congelada 1,2-3,3 s (y más tras un deploy).
  'app/m/hoy/loading.tsx',
  'app/m/crm/loading.tsx',
  'app/m/crm/[id]/loading.tsx',
  'app/m/crm/[id]/chat/loading.tsx',
  'app/m/chats/loading.tsx',
  'app/m/mas/loading.tsx',
  'app/m/inbox/loading.tsx',
  'app/m/cs/loading.tsx',
];

test('no hay loading.tsx fuera de la lista blanca (cada uno esconde su página sin JavaScript)', () => {
  const raiz = resolve(__dirname, '..');
  const encontrados: string[] = [];
  const recorrer = (dir: string) => {
    for (const e of readdirSync(resolve(raiz, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) recorrer(rel);
      else if (/^loading\.(t|j)sx?$/.test(e.name)) encontrados.push(rel);
    }
  };
  recorrer('app');
  assert.deepEqual(encontrados.sort(), [...LOADING_PERMITIDOS].sort());
});

function streamear(el: ReactElement): Promise<string> {
  return new Promise((ok, mal) => {
    let html = '';
    let listo = false;
    const out = new Writable({ write(c, _e, cb) { html += c.toString(); cb(); } });
    out.on('finish', () => ok(html));
    const s = renderToPipeableStream(el, {
      onAllReady() { if (listo) return; listo = true; s.pipe(out); },
      onShellError: mal,
    });
  });
}

/** El texto que queda a la vista sin JavaScript: sin los `<div hidden id="S:n">` (cerrados por profundidad) ni scripts. */
function visibleSinJs(html: string): string {
  let out = html;
  for (;;) {
    const ini = out.indexOf('<div hidden id="S:');
    if (ini < 0) break;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = ini;
    let prof = 0;
    let fin = -1;
    for (let m = re.exec(out); m; m = re.exec(out)) {
      prof += m[0] === '</div>' ? -1 : 1;
      if (prof === 0) { fin = m.index + m[0].length; break; }
    }
    out = fin < 0 ? out.slice(0, ini) : out.slice(0, ini) + out.slice(fin);
  }
  return out.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

// ⚠️ Con <html><body> o no reproduce nada: React sólo escribe bloques aparte cuando renderiza
// un DOCUMENTO (tests/razon-social-sitio.test.ts lo midió con la portada).
const documento = (hijo: ReactElement) => createElement('html', null, createElement('body', null, hijo));

// ⚠️ Y CON LO QUE EL LAYOUT ESCRIBE ANTES DE LA PÁGINA. El umbral (~12.800 bytes) es ACUMULATIVO: una
// página CORTA renderizada sola nunca lo pasa, así que un <Suspense> propio de /reembolsos salía
// visible acá y oculto en producción (medido el 11/10/2026: sin esto, envolverla en un Suspense daba
// 7 pass / 0 fail). 16 KB de CSS delante —que no es texto visible— ponen a todas las páginas en el
// peor caso, que es el de producción.
const LO_DE_ANTES = createElement('style', { dangerouslySetInnerHTML: { __html: '.relleno{color:red} '.repeat(800) } });
const conLoDeAntes = (hijo: ReactElement) => createElement(Fragment, null, LO_DE_ANTES, hijo);

// El cuarto valor es el mínimo de caracteres visibles. 5000 sirve para /privacidad y /terminos (más de
// 10.000); /reembolsos es corta de verdad (~2.700), y el modo de falla que esto mide deja ~20, así que
// su mínimo es 2000: un umbral copiado de una página larga la daba por «casi vacía» estando entera.
const PAGINAS: Array<[string, () => ReactElement, string, number?]> = [
  ['/privacidad', () => createElement(Privacidad), 'Uso limitado de los datos de Google'],
  ['/terminos', () => createElement(Terminos), 'Responsable del servicio'],
  // La política de reembolsos (11/10/2026): la piden Stripe y Mercado Pago para aprobar la cuenta, y
  // su revisor la abre sin cuenta y puede que sin JavaScript, igual que el de Google las otras dos.
  ['/reembolsos', () => createElement(Reembolsos), 'El mes ya pagado no se reembolsa', 2000],
];

for (const [ruta, pagina, frase, minimo = 5000] of PAGINAS) {
  test(`${ruta} se lee entera sin JavaScript cuando nada la envuelve en un Suspense`, async () => {
    const html = await streamear(documento(conLoDeAntes(pagina())));
    assert.ok(!html.includes('<div hidden id="S:'), `${ruta} salió con un bloque oculto`);
    const vis = visibleSinJs(html);
    assert.ok(vis.includes(frase), `sin JavaScript no se lee «${frase}» en ${ruta}`);
    assert.ok(vis.length > minimo, `${ruta} se ve con ${vis.length} caracteres: está casi vacía`);
  });
}

test('control: adentro del Suspense que tenía el layout, /privacidad queda oculta (el test mide la condición real)', async () => {
  const html = await streamear(documento(createElement(Suspense, { fallback: null }, createElement(Privacidad))));
  assert.ok(html.includes('<div hidden id="S:'), 'React dejó de esconder los bloques grandes: este test ya no reproduce producción');
  assert.ok(!visibleSinJs(html).includes('Uso limitado de los datos de Google'));
});

// Probado rompiéndolo (10/10/2026), cada rotura por separado sobre una base de 6 pases:
//   · devolver el <Suspense fallback={null}> alrededor de <WsProvider> en app/layout.tsx: 1 fallo, 5 pases;
//   · envolver la página de /privacidad en un Suspense propio (app/privacidad/page.tsx): 1 fallo, 5 pases;
//   · cambiar `await getSesionAdmin()` del layout por una constante: 1 fallo, 5 pases;
//   · agregar un app/privacidad/loading.tsx: 1 fallo, 5 pases.
// Y el 11/10/2026, con /reembolsos sumada (base de 7 pases): envolverla en un Suspense propio daba
// 7 pases / 0 fallos SIN `conLoDeAntes` (una página corta sola no pasa el umbral) y 1 fallo, 6 pases
// con él. Restaurada: 7 pases.
