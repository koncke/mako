// =============================================================================
// El Second Brain de un gurú, como se MIRA: secciones con color, tamaños y su barra lateral (4/11/2026)
// =============================================================================
// Martín, textual: «Y dentro revisa la sidebar de cada second brain, estan bastante mal organizadas... Y los nodos son todos
// iguales, no esta bien diseñado como el que ya hicimos, que tienen diferentes colores, tamaños y que los titulos van apareciendo
// y desapareciendo por "sección"». Y del botón: «en lugar de "Su Second Brain" que diga "Second Brain de NOMBRE DEL GURU"... no
// debe abrirse un modal, sino que debe reemplazar lo que está en el chat... y en el botón... que esté "Volver al chat"».
//
// Todo corre el código: arma el grafo de un curso de prueba con `vistaDeReferente`, lo acomoda con el layout de verdad, mide los
// radios con `radioNodo` y dibuja `Grafo`, `BotonSecondBrainDe` y `PanelDeChat` con React.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), con el archivo en 12 / 0, una rotura por vez y restaurada:
//   1. `vistaDeReferente` con todas las clases en el área del primer módulo           →  9 / 3: «un color por módulo», «uniones», «la barra lateral»
//   2. sin el `peso` de la raíz y los módulos                                        → 11 / 1: «la raíz es lo más grande»
//   3. el piso del `peso` sacado de `gradosDe` (lib/cerebro-layout.ts)               → 11 / 1: «la raíz es lo más grande»
//   4. los módulos como `area:` en vez de `n1:` (su título se iría de lejos)         → 11 / 1: «sus títulos quedan de lejos»
//   5. la barra lateral del negocio con un curso («cosas que MaKo sabe»)             → 11 / 1: «la barra lateral»
//   6. `rotuloSecondBrain` con «Su Second Brain»                                     → 11 / 1: «el botón»
//   7. `PanelDeChat` que ignora `reemplazo`                                          → 11 / 1: «reemplaza la conversación»
//   8. las palabras de un título sin sacar los verbos                                → 11 / 1: «uniones con sentido»
// Correr: node --import tsx --test tests/cerebro-referente-vista.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import modulo from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { armarReferente, idDeClase, type ClaseDeCurso } from '../lib/cerebro-referente';
import { COLORES_DE_MODULO, nombreDeModulo, palabrasDeTitulo, vistaDeReferente } from '../lib/cerebro-referente-vista';
import { layoutCerebro, gradosDe } from '../lib/cerebro-layout';
import { gradosDe as gradosDelDibujo } from '../lib/cerebro-areas';
import { radioNodo, type Cerebro } from '../lib/cerebro-modelo';
import { filtroVacio } from '../lib/cerebro-filtro';

// El grafo y el panel traen CSS, que en node no carga (como tests/gurus-ops-center.test.ts).
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const HORMOZI = { id: 'hormozi', nombre: 'Hormozi', completo: 'Alex Hormozi', especialidad: 'Oferta', curso: '100M Money Models' };
const MODULOS = ['1. $100M Money Models', '2. Workshop Recordings', 'MODULO 3 - ANÁLISIS DE PUV'];
/** Nueve clases en tres módulos, de largo creciente: la novena es la más larga. */
const CLASES: ClaseDeCurso[] = Array.from({ length: 9 }, (_, i) => ({
  videoId: `v${i + 1}`, orden: i + 1, modulo: MODULOS[Math.floor(i / 3)],
  titulo: ['Continuity Offers', 'Continuity Bonus', 'Waived Fee', 'Attraction Offers', 'Win Your Money Back', 'Giveaways', 'Upsell Offers', 'Downsell Offers', 'Continuity Discounts'][i],
  texto: `Hola, en esta clase vemos ${i + 1}. ${'Una frase del curso. '.repeat(160 * (i + 1))}`,
}));

const vista = (clases = CLASES) => {
  const v = vistaDeReferente(HORMOZI, armarReferente(HORMOZI, clases));
  return { ...v, ...layoutCerebro(v.nodos, v.aristas) } as Cerebro<string>;
};
const radios = (c: Cerebro<string>) => {
  const g = gradosDe(c.nodos, c.aristas);
  return Object.fromEntries(c.nodos.map((n) => [n.id, radioNodo(g[n.id] ?? 0)]));
};

test('un color por módulo: cada sección del curso es un área con el suyo, y sus clases lo llevan', () => {
  const c = vista();
  const areas = c.taxonomia!.areas;
  assert.equal(areas.length, 3);
  assert.equal(new Set(areas.map((a) => a.color)).size, 3, 'dos módulos con el mismo color no se distinguen en el mapa');
  assert.deepEqual(areas.map((a) => a.color), COLORES_DE_MODULO.slice(0, 3));
  const clase = (i: number) => c.nodos.find((n) => n.id === idDeClase('hormozi', `v${i}`))!;
  assert.equal(clase(1).area, areas[0].id);
  assert.equal(clase(4).area, areas[1].id);
  assert.equal(clase(9).area, areas[2].id);
  assert.equal(new Set(c.nodos.filter((n) => n.tipo === 'Clase').map((n) => n.area)).size, 3, 'las clases de un curso no son todas del mismo color');
});

test('sus títulos quedan de lejos: cada módulo es una carpeta madre (`n1:`) y cuelga de la raíz', () => {
  const c = vista();
  const mods = c.nodos.filter((n) => n.id.startsWith('n1:'));
  assert.equal(mods.length, 3, 'el grafo dibuja de lejos sólo el nivel 1 (Grafo.tsx → `entraPorNivel`)');
  for (const m of mods) assert.ok(c.aristas.some((a) => a.de === 'raiz' && a.a === m.id), `${m.etiqueta} no cuelga del curso`);
  assert.equal(c.nodos.find((n) => n.id === 'raiz')?.etiqueta, '100M Money Models');
  // Cada clase cuelga de SU módulo, y se encadena con la anterior del mismo módulo.
  assert.ok(c.aristas.some((a) => a.de === 'n1:mod-2' && a.a === idDeClase('hormozi', 'v4')));
  assert.ok(c.aristas.some((a) => a.de === idDeClase('hormozi', 'v4') && a.a === idDeClase('hormozi', 'v5')));
  assert.ok(!c.aristas.some((a) => a.de === idDeClase('hormozi', 'v3') && a.a === idDeClase('hormozi', 'v4')), 'la cadena no cruza de módulo');
  assert.equal(Object.keys(c.posiciones).length, c.nodos.length, 'el layout acomoda todos');
});

test('la raíz es lo más grande, después los módulos, y una clase larga más que una corta', () => {
  const c = vista();
  const r = radios(c);
  const clases = c.nodos.filter((n) => n.tipo === 'Clase').map((n) => r[n.id]);
  const mods = c.nodos.filter((n) => n.id.startsWith('n1:')).map((n) => r[n.id]);
  assert.ok(r.raiz > Math.max(...mods), `raíz ${r.raiz} contra módulos ${mods}`);
  assert.ok(Math.min(...mods) > Math.max(...clases), `módulos ${mods} contra clases ${clases}`);
  assert.ok(r[idDeClase('hormozi', 'v9')] > r[idDeClase('hormozi', 'v1')], 'la clase más larga se ve más grande');
  assert.ok(new Set(Object.values(r)).size >= 4, 'los puntos no son todos iguales');
  // Las DOS puntas miden igual: el layout (lib/cerebro-layout.ts) y el dibujo (lib/cerebro-areas.ts).
  assert.deepEqual(gradosDelDibujo(c.nodos, c.aristas), gradosDe(c.nodos, c.aristas));
});

test('el texto de una clase no viaja: sólo cómo empieza, y la clase dice de dónde sale', () => {
  const c = vista();
  const n = c.nodos.find((x) => x.id === idDeClase('hormozi', 'v9'))!;
  assert.equal(n.cuerpo, undefined);
  assert.ok(n.detalle.startsWith('Hola, en esta clase vemos 9.'));
  assert.ok(n.detalle.length < 300, `${n.detalle.length} caracteres`);
  assert.equal(n.fuente, '«100M Money Models», clase 9');
  assert.deepEqual(n.datos?.find((d) => d.k === 'Clase'), { k: 'Clase', v: '9 de 9' });
  assert.ok(JSON.stringify(c).length < 30_000, 'el grafo de nueve clases no pesa como el curso');
});

test('uniones con sentido: entre módulos, sólo por una palabra propia del título', () => {
  const c = vista();
  const cruzadas = c.aristas.filter((a) => a.motivo.startsWith('Las dos'));
  // «Continuity» está en tres títulos de dos módulos (1 y 3): se unen por eso.
  assert.ok(cruzadas.some((a) => a.motivo === 'Las dos hablan de «continuity»'), JSON.stringify(cruzadas));
  for (const a of cruzadas) {
    const de = c.nodos.find((n) => n.id === a.de)!;
    const al = c.nodos.find((n) => n.id === a.a)!;
    assert.notEqual(de.area, al.area, 'dentro de un módulo ya los une la cadena');
  }
  assert.deepEqual(palabrasDeTitulo('Vamos creando anuncios para vender'), ['anuncios'], 'ni «vamos» ni un verbo unen dos clases');
  assert.deepEqual(palabrasDeTitulo('Clase 3: Objeciones'), ['objeciones']);
});

test('el nombre de un módulo, sin su numeración ni gritos', () => {
  assert.equal(nombreDeModulo('MODULO 2 - ATENCION', 1), 'Atencion');
  assert.equal(nombreDeModulo('Módulo 1_ Génesis Fundacional', 0), 'Génesis Fundacional');
  assert.equal(nombreDeModulo('(3) Systems & Processes', 2), 'Systems & Processes');
  assert.equal(nombreDeModulo('G4 - FASE 1 - PREPARACIÓN - M2', 1), 'Preparación');
  assert.equal(nombreDeModulo('MODULO 3 - ANÁLISIS DE PUV', 2), 'Análisis de PUV');
  assert.equal(nombreDeModulo('1. $100M Money Models', 0), '$100M Money Models');
  assert.equal(nombreDeModulo('MODULO 4', 3), 'Módulo 4', 'sin nombre, el número');
});

test('un curso de un solo módulo no repite su nombre al lado de la raíz', () => {
  const c = vista(CLASES.map((x) => ({ ...x, modulo: 'Social Funnel - Emilio Puigrredó' })));
  assert.deepEqual(c.taxonomia!.areas.map((a) => a.nombre), ['Las clases']);
  assert.deepEqual(c.curso, { nombre: '100M Money Models', de: 'Alex Hormozi', modulos: 1 });
});

test('la barra lateral: qué curso es, de quién, cuántas clases y sus módulos; nada de «lo que MaKo sabe»', async () => {
  const { Grafo } = await import('../app/second-brain/Grafo');
  const html = renderToStaticMarkup(createElement(Grafo, { cerebro: vista(), filtro: filtroVacio(), onFiltro: () => {} }));
  const barra = html.slice(html.indexOf('<aside'));
  assert.ok(barra.includes('Curso de Alex Hormozi'), 'de quién es');
  assert.match(barra, /9 clases · 3 módulos/);
  assert.ok(barra.includes('>Módulos<'));
  for (const m of ['$100M Money Models', 'Workshop Recordings', 'Análisis de PUV']) assert.ok(barra.includes(m), `falta el módulo ${m}`);
  assert.doesNotMatch(html, /cosas? que MaKo sabe|de MaKo · \d+ tuyas|Todavía no sé nada de tu negocio/);
  assert.doesNotMatch(html, /Buscar con MaKo/, 'la búsqueda con MaKo mira el negocio, no el curso');
  assert.match(html, /placeholder="Buscar una clase"/);
  assert.match(html, /aria-label="Second Brain de Alex Hormozi: 9 clases/);
});

test('el grafo del negocio sigue igual: sin curso, la barra de siempre', async () => {
  const { Grafo } = await import('../app/second-brain/Grafo');
  const negocio: Cerebro<string> = { negocio: 'X', nodos: [], aristas: [], cuenta: { total: 0, mako: 0, usuario: 0, pendientes: 0 }, vacias: [], posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 } };
  const html = renderToStaticMarkup(createElement(Grafo, { cerebro: negocio, filtro: filtroVacio(), onFiltro: () => {} }));
  assert.match(html, /cosas que MaKo sabe/);
  assert.match(html, /placeholder="Buscar un dato"/);
});

test('el botón: «Second Brain de <gurú>» y, abierto, «Volver al chat»; tocarlo cambia de lado', async () => {
  const { BotonSecondBrainDe, rotuloSecondBrain } = await import('../app/second-brain/SuSecondBrain');
  const r = { nombre: 'Hormozi' };
  assert.equal(rotuloSecondBrain(r, false), 'Second Brain de Hormozi');
  assert.equal(rotuloSecondBrain(r, true), 'Volver al chat');
  const asesor = { id: 'hormozi', nombre: 'Hormozi', completo: 'Alex Hormozi', especialidad: 'Oferta', curso: '100M Money Models' } as const;
  const cerrado = renderToStaticMarkup(createElement(BotonSecondBrainDe, { referente: asesor, viendo: false, onCambiar: () => {} }));
  assert.match(cerrado, /class="co-chip co-cab__cerebro"/, 'a la derecha del todo de la cabecera (centro.css)');
  assert.match(cerrado, />Second Brain de Hormozi</);
  const pedidos: boolean[] = [];
  const el = BotonSecondBrainDe({ referente: asesor, viendo: true, onCambiar: (v) => pedidos.push(v) });
  (el.props as { onClick: () => void }).onClick();
  assert.deepEqual(pedidos, [false], 'con el grafo abierto, el botón vuelve al chat');
});

test('reemplaza la conversación: el grafo ocupa su lugar y el chat queda montado, escondido', async () => {
  const { PanelDeChat } = await import('../app/admin/operaciones/PanelChat');
  const panel = (reemplazo?: string) => renderToStaticMarkup(createElement(PanelDeChat, {
    cabecera: { clave: 'k', titulo: 'Hormozi', animo: 'despierto' }, hilo: { current: null }, caja: createElement('textarea'), estado: '',
    reemplazo: reemplazo ? createElement('div', { id: 'el-grafo' }, reemplazo) : undefined,
    children: createElement('p', { id: 'la-charla' }, 'Hola'),
  }));
  const con = panel('grafo');
  assert.match(con, /<div class="co-reemplazo"><div id="el-grafo">grafo<\/div><\/div>/);
  assert.match(con, /<div class="co-conv" style="display:none">/, 'la conversación queda montada: al volver sigue donde estaba');
  assert.ok(con.includes('id="la-charla"'));
  const sin = panel();
  assert.doesNotMatch(sin, /co-reemplazo|display:none/);
});

test('los tres chats donde aconseja un gurú usan el botón y el reemplazo, y ninguno abre un modal', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
  for (const f of ['app/second-brain/ChatDelReferente.tsx', 'app/second-brain/ChatDelCoach.tsx', 'app/second-brain/ChatSecondBrain.tsx']) {
    const src = leer(f);
    assert.match(src, /<BotonSecondBrainDe referente=/, `${f}: sin el botón`);
    assert.match(src, /reemplazo=\{[^}]*<CerebroDelGuru referente=/, `${f}: el grafo no va en el lugar de la conversación`);
  }
  assert.doesNotMatch(leer('app/second-brain/SuSecondBrain.tsx'), /<Modal/, '«no debe abrirse un modal»');
  const m = leer('app/m/second-brain/HojaDelGuru.tsx');
  assert.match(m, /<BotonSecondBrainDe referente=\{r\} viendo=\{false\} onCambiar=\{setViendoCerebro\} \/>/, 'en el teléfono');
  assert.match(m, /<CerebroDelGuru referente=\{r\} movil \/>/);
});
