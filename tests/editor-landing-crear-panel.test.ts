// =============================================================================
// editor-landing-crear-panel — la PANTALLA de la tanda 6: «Crear con IA» en la tab, el «+» que sólo
// adjunta, el link pegado en el chat, las tarjetas de las plantillas y los cabos sueltos de las piezas
// =============================================================================
// Pedido de Martín (14/10/2026), textual:
//   «1. El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa página.". Soluciona eso...
//    2. La sección de "Importar con IA" no debería ser otra ruta, todo siempre en la misma ruta.
//    3. La sección de "Crear con IA", le faltan las opciones de "Analizar Landing" y "Replicar Landing". Y
//       que el botón de "Importar" que solo sea importar, no que sea con URL, para eso ya las otras opciones
//       que te dije... Y esta sección de "Crear con IA" debería estar en la tab principal de landing
//       generator, en la sección de "¿Qué vas a crear hoy?".
//    4. Como vamos a tener esa sección, elimina todas las opciones actuales dentro del "+" en el cuadro del
//       chat. Y que en ese + solo quede la opción de importar archivo y otras opciones así, para subir imagen
//       y esas cosas...
//    5. En el chat, si yo pego un link, me debería aparecer pintado de azul y que diga "Analiza esta landing"
//       y que se pueda cambiar a "Replica esta landing".
//    6. Las miniaturas y el título de abajo en las plantillas, deberían estar englobadas en un contendor […]
//       Elimina los subtitulos de cada plantilla. Y me gustaría que esos bloques tengan como una sombra […]»
// Y sus decisiones del mismo día: leer una landing «como un visitante» se hace en el navegador de la persona
// (con el Pixel o en una ventana emergente; con las emergentes bloqueadas NO se abre nada y se ve el aviso
// con la flecha, también en «Probar» del Pixel); «Replicar» pregunta 3 formatos (Presentación, Landing,
// Página web).
//
// Lo puro (el link pegado, la derecha del Panel en la URL, el redirect de /crear) se EJECUTA; lo que no es
// puro (que la pantalla use esas funciones, que la ventana se abra en el clic) se fija LEYENDO EL FUENTE sin
// comentarios (un guard de «esto NO está» se acusaría a sí mismo con el párrafo que explica por qué se fue).
//
// PROBADO ROMPIÉNDOLO (14/10/2026): al pie, con números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consultaDerecha, derechaDeAccion, derechaDeQuery, destinoCrear, linkEscrito, queryDeDerecha, sacarLink, type AccionCaja, type Derecha,
} from '../app/landing-generator/panel-reglas';
import type { LandingResumen } from '../lib/editor-landing/api-tipos';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Sin quitar los `{}` que deja un comentario de JSX: acá se buscan `: {}` de verdad (Replicar, Analizar).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (rel: string) => sinComentarios(leer(rel));
/** Lo que hay entre `desde` y `hasta` (o el final) en un fuente. */
const tramo = (src: string, desde: string, hasta?: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde.slice(0, 50)}»`);
  const j = hasta ? src.indexOf(hasta, i + desde.length) : -1;
  return src.slice(i, j > i ? j : undefined);
};

const CAJA = 'app/landing-generator/CajaCrear.tsx';
const CAJA_PEDIDO = 'app/landing-generator/CajaPedido.tsx';
const INICIO = 'app/landing-generator/Inicio.tsx';
const CREAR = 'app/landing-generator/crear/CrearConIA.tsx';
const REPLICAR = 'app/landing-generator/crear/Replicar.tsx';
const LEER = 'app/landing-generator/lector/LeerOPegar.tsx';
const PANEL_DG = 'app/landing-generator/diagnostico/PanelDiagnostico.tsx';
const PAGINA = 'app/api/landing-generator/diagnostico/pagina/route.ts';
const PROBAR = 'app/integraciones/ProbarTracking.tsx';

// ── 5 · El link pegado en la caja ────────────────────────────────────────────────────────────

test('sacarLink: un link pegado (o cerrado por un espacio) sale del texto; mientras se tipea, no', () => {
  assert.equal(sacarLink('', 'https://mi-landing.com/oferta?utm_source=fb'), 'https://mi-landing.com/oferta?utm_source=fb');
  assert.equal(sacarLink('', 'https://www.otra.com/x.'), 'https://www.otra.com/x', 'la puntuación que lo cierra no es del link');
  assert.equal(sacarLink('', '"https://a.com/x"'), 'https://a.com/x', 'las comillas no son del link (ni cuentan como texto)');
  // Tipeando de a una letra: recién cuando lo cierra un espacio.
  assert.equal(sacarLink('https://mi-lan', 'https://mi-land'), null);
  assert.equal(sacarLink('https://a.com', 'https://a.com.'), null, 'puede seguir siendo «a.com.ar»');
  assert.equal(sacarLink('https://a.com', 'https://a.com '), 'https://a.com');
  // Lo que no es la dirección de una página no se toca.
  for (const [a, b] of [['', 'hola'], ['', 'https://localhost:3000/x'], ['', 'ftp://a.com/x'], ['', 'https://']]) assert.equal(sacarLink(a, b), null, b);
});

// Verificación de la tanda 6 (15/10/2026), tres bordes del punto 5. PROBADO ROMPIÉNDOLO al pie (L1-L4).
test('sacarLink: con TEXTO al lado el link no sale (el chip escondía el resto y se perdía al enviar)', () => {
  for (const [a, b] of [
    ['', 'hazme una como https://x.com pero para dentistas'],
    ['mira ', 'mira https://www.otra.com/x.'],
    ['', 'ver "https://a.com/x" ahora'],
    ['hola https://a.com', 'hola https://a.com '],
    ['', 'https://a.com y https://b.com'],
  ]) assert.equal(sacarLink(a, b), null, `«${b}» queda entero en el campo`);
});

test('sacarLink: el «)» de un link que lo trae balanceado es del link; el que cierra la frase, no', () => {
  assert.equal(sacarLink('', 'https://otra.com/x(1)'), 'https://otra.com/x(1)');
  assert.equal(sacarLink('', 'https://otra.com/x(1).'), 'https://otra.com/x(1)');
  assert.equal(sacarLink('', 'https://es.wikipedia.org/wiki/Mercurio_(planeta)'), 'https://es.wikipedia.org/wiki/Mercurio_(planeta)');
  assert.equal(sacarLink('', '(https://otra.com/x)'), 'https://otra.com/x', 'el paréntesis de afuera no es del link');
  assert.equal(sacarLink('', 'https://otra.com/x).'), 'https://otra.com/x');
});

test('linkEscrito: un link TIPEADO y mandado con Enter (sin el espacio que lo cierra) es un link, no un pedido', () => {
  assert.equal(sacarLink('https://otra.co', 'https://otra.com'), null, 'mientras se tipea no sale: por eso hace falta');
  assert.equal(linkEscrito('https://otra.com'), 'https://otra.com/');
  assert.equal(linkEscrito('  otra.com/oferta?x=1  '), 'https://otra.com/oferta?x=1');
  assert.equal(linkEscrito('https://otra.com/x(1)'), 'https://otra.com/x(1)');
  assert.equal(linkEscrito('https://otra.com.'), 'https://otra.com/');
  for (const p of ['Una landing para dentistas', 'hazme una como https://x.com pero para dentistas', 'hola', '', 'https://localhost:3000']) {
    assert.equal(linkEscrito(p), null, `«${p}» es un pedido`);
  }
});

test('la caja: el link va EN LUGAR del campo, azul, con «Analiza esta landing» ⇄ «Replica esta landing» (y el formato)', () => {
  const src = fuente(CAJA);
  assert.match(src, /const r = sacarLink\(pedido, v\);/);
  assert.match(src, /enLugarDelCampo=\{conLink\}/);
  assert.match(src, /<ChipCaja icono="enlace" texto=\{hostDe\(link\)\}/);
  assert.match(src, /\{ valor: 'analizar', texto: 'Analiza esta landing', icono: 'reporte' \}/);
  assert.match(src, /\{ valor: 'replicar', texto: 'Replica esta landing', icono: 'copiar' \}/);
  assert.match(src, /\{accionLink === 'replicar' && \(\s*<Desplegable etiqueta="Formato" valor=\{formatoLink\}/);
  // Al mandar, lo mismo que las tarjetas: el Diagnóstico de esa URL o Replicar con su formato.
  assert.match(src, /onAccion\(accionLink === 'analizar' \? \{ que: 'analizar', url \} : \{ que: 'replicar', url, formato: formatoLink \}\);/);
  // Verificación de la tanda 6: el chip, o un link tipeado y mandado con Enter; y del chip no queda texto escondido.
  assert.match(src, /const url = link \?\? \(archivo \? null : linkEscrito\(pedido\)\);\s*if \(url\) \{/);
  assert.match(src, /setLink\(r\);\s*setPedido\(''\);/);
  assert.match(src, /\.gp \.gp-cc-link-accion \.gp-pildora \{[^}]*background: var\(--gp-azul-50\)/, 'la pastilla no es azul');
  // La caja es la MISMA de /automations: nada de esto vive adentro de ella.
  const caja = fuente(CAJA_PEDIDO);
  assert.doesNotMatch(caja, /sacarLink|Analiza esta landing|onAccion|Importar archivo/);
});

test('derechaDeAccion (se EJECUTA): «Analiza esta landing» abre el Diagnóstico de ESA página; «Replica esta landing» arranca solo', () => {
  // Verificación de la tanda 6: con la regla adentro de Inicio.tsx (`alAccion`), abrir el Diagnóstico VACÍO
  // con un link pegado (C1) o que Replicar no arrancara (C2) quedaban en verde. Ahora es pura y se ejecuta.
  const docs: LandingResumen[] = [{
    id: 12, titulo: 'Mía', tema: 'pewter', creado: '2026-10-01T00:00:00Z', actualizado: '2026-10-01T00:00:00Z',
    creadoPor: null, favorito: false, carpeta: null, papelera: false, slug: 'mia', publicadoAt: null, primera: null,
  }];
  const bases = ['https://hola-mako.site'];
  const de = (a: AccionCaja) => derechaDeAccion(a, docs, bases);
  assert.deepEqual(de({ que: 'analizar', url: 'su-landing.com/oferta' }), { tipo: 'diagnostico', url: 'https://su-landing.com/oferta' });
  assert.deepEqual(de({ que: 'analizar', url: 'https://hola-mako.site/mia/gracias' }), { tipo: 'diagnostico', docId: 12 }, 'una nuestra abre SU documento');
  assert.deepEqual(de({ que: 'analizar' }), { tipo: 'diagnostico' }, 'la tarjeta «Analizar landing» sin link: para pegar una');
  assert.deepEqual(de({ que: 'analizar', url: 'no es un link' }), { tipo: 'diagnostico' });
  assert.deepEqual(de({ que: 'replicar', url: 'https://su-landing.com/', formato: 'presentacion' }), { tipo: 'replicar', url: 'https://su-landing.com/', formato: 'presentacion', auto: true });
  assert.deepEqual(de({ que: 'replicar' }), { tipo: 'replicar' }, 'la tarjeta «Replicar landing» sin link no arranca nada');
  assert.deepEqual(de({ que: 'ia', paso: 'pegar', tipo: 'landing', arranque: { modo: 'plan', prompt: '' } }),
    { tipo: 'ia', paso: 'pegar', doc: 'landing', arranque: { modo: 'plan', prompt: '' } });
  // Y el Panel la usa tal cual (con su lista y sus bases).
  assert.match(fuente(INICIO), /const alAccion = \(a: AccionCaja\) => \{\s*setDerecha\(derechaDeAccion\(a, lista, props\.bases\)\);/);
});

// ── 2 · Todo en la misma ruta ────────────────────────────────────────────────────────────────

test('la derecha del Panel: Crear con IA por su paso (y el tipo), Replicar, y los links viejos de /crear', () => {
  const d = (q: Parameters<typeof derechaDeQuery>[0]) => derechaDeQuery(q, [], []);
  assert.deepEqual(d({ paso: 'generar' }), { tipo: 'ia', paso: 'generar', doc: 'landing' });
  assert.deepEqual(d({ paso: 'importar', tipo: 'presentacion' }), { tipo: 'ia', paso: 'importar', doc: 'presentacion' });
  assert.deepEqual(d({ paso: 'inicio' }), { tipo: 'crear' }, 'la pantalla «inicio» de Crear se fue a la caja');
  assert.deepEqual(d({ paso: 'esquema' }), { tipo: 'crear' });
  assert.deepEqual(d({ vista: 'replicar' }), { tipo: 'replicar' });
  assert.deepEqual(d({ paso: 'generar', diagnostico: '9' }), { tipo: 'diagnostico', docId: 9 }, 'el Diagnóstico de una landing manda');
  // El deep link del Landing Analyst: «Generar» con esa landing de base (Crear la valida contra su lista).
  assert.deepEqual(d({ url: 'https://ejemplo.com/landing', objetivo: 'agendar' }),
    { tipo: 'ia', paso: 'generar', doc: 'landing', arranque: { base: 'https://ejemplo.com/landing', objetivo: 'agendar' } });
  // Ida y vuelta: lo que se escribe es lo que se lee, con el ?ws=.
  const ida: Derecha[] = [
    { tipo: 'ia', paso: 'generar', doc: 'landing' }, { tipo: 'ia', paso: 'pegar', doc: 'presentacion' },
    { tipo: 'ia', paso: 'importar', doc: 'landing' }, { tipo: 'replicar' },
  ];
  for (const x of ida) {
    const p = new URLSearchParams(queryDeDerecha('?ws=3', x));
    assert.equal(p.get('ws'), '3');
    assert.deepEqual(d(consultaDerecha(Object.fromEntries(p))), x, JSON.stringify(x));
  }
  // Lo de UNA vez no queda en la URL: un F5 no vuelve a replicar ni a generar (se pagan).
  assert.equal(queryDeDerecha('?ws=3&url=https%3A%2F%2Fa.com', { tipo: 'replicar', url: 'https://a.com/', formato: 'web', auto: true }), '?ws=3&vista=replicar');
  assert.equal(queryDeDerecha('?url=https%3A%2F%2Fa.com&objetivo=agendar&paso=generar', { tipo: 'crear' }), '');
});

test('/landing-generator/crear redirige al Panel con la query entera (y su ?ws=); el Panel la abre a la derecha', () => {
  assert.equal(destinoCrear({}), '/landing-generator');
  assert.equal(destinoCrear({ paso: 'importar', tipo: 'presentacion', ws: '3' }), '/landing-generator?paso=importar&tipo=presentacion&ws=3');
  assert.equal(destinoCrear({ url: ['https://a.com/x', 'https://b.com/'], objetivo: 'agendar' }), '/landing-generator?url=https%3A%2F%2Fa.com%2Fx&objetivo=agendar');
  // Lo que promete el redirect es lo que el Panel abre (las dos puntas, una contra la otra).
  for (const [sp, esperado] of [
    [{ paso: 'pegar' }, { tipo: 'ia', paso: 'pegar', doc: 'landing' }],
    [{ url: 'https://a.com/x' }, { tipo: 'ia', paso: 'generar', doc: 'landing', arranque: { base: 'https://a.com/x' } }],
    [{}, { tipo: 'crear' }],
  ] as const) {
    const q = Object.fromEntries(new URL(destinoCrear(sp), 'https://hola-mako.com').searchParams);
    assert.deepEqual(derechaDeQuery(consultaDerecha(q), [], []), esperado);
  }
  const page = fuente('app/landing-generator/crear/page.tsx');
  const guard = page.indexOf("await requireRolWs([], { nav: 'landing-writer' });");
  assert.ok(guard > 0 && page.indexOf('redirect(') > guard, 'el redirect antes del guard');
  assert.match(page, /redirect\(await rutaConWs\(destinoCrear\(await searchParams\)\)\);/);
});

test('el Panel monta Crear con IA y Replicar a la derecha; adentro de Crear, «Inicio» y «Analizar» son funciones del Panel', () => {
  const src = fuente(INICIO);
  assert.match(src, /\} else if \(derecha\.tipo === 'ia'\) \{[\s\S]{0,200}<CrearConIA/);
  assert.match(src, /onSalir=\{cerrarDiagnostico\}\s+onAnalizar=\{abrirAnalizar\}\s+onPaso=\{recordarPaso\}/);
  assert.match(src, /\} else if \(derecha\.tipo === 'replicar'\) \{\s*contenido = <ReplicarUnaPagina key=\{derecha\.url \?\? ''\} url=\{derecha\.url\} formato=\{derecha\.formato\} auto=\{derecha\.auto\} \/>;/);
  assert.match(src, /\.gp \.gp-contenido\[data-vista="ia"\] \{ padding: 0; \}/);
  // Con el Panel montado, un <Link> a su propia ruta no le cambia la derecha (es un useState).
  const crear = fuente(CREAR);
  assert.doesNotMatch(crear, /<Link\b|import Link\b|href="\/landing-generator/, 'Crear volvió a navegar con un link');
  assert.match(crear, /onClick=\{props\.onSalir\}><Ico n="casa" t=\{14\} \/> Inicio<\/button>/);
  assert.match(crear, /onClick=\{props\.onAnalizar\}>Analizar una página<\/button>/);
  // Salir a la mitad: la generación termina y se guarda, pero no arrastra al editor desde otra pantalla.
  assert.match(crear, /if \(montada\.current\) irDuro\(`\/landing-generator\/\$\{d\.id\}`, ws\);/);
});

// ── 3 · «Crear con IA» en la tab, e «Importar» sólo archivos ─────────────────────────────────

test('«Crear con IA» en la caja: Pegar texto · Generar · Importar · Analizar landing · Replicar landing', () => {
  const src = fuente(CAJA);
  const opciones = tramo(src, 'export const OPCIONES_IA', '];');
  assert.deepEqual([...opciones.matchAll(/titulo: '([^']+)'/g)].map((m) => m[1]), ['Pegar texto', 'Generar', 'Importar', 'Analizar landing', 'Replicar landing']);
  assert.doesNotMatch(opciones, /URL|página web/i, '«Importar» es sólo un archivo');
  const iCaja = src.indexOf('<CajaPedido');
  const iTipo = src.indexOf('<SelectorTipo');
  const iIA = src.indexOf('className="gp-cc-ia"');
  const iPlantillas = src.indexOf('className="gp-cc-plantillas"');
  assert.ok(iCaja > 0 && iTipo > iCaja && iIA > iTipo && iPlantillas > iIA, 'el orden: la caja, el tipo, Crear con IA, las plantillas');
  assert.match(src, /if \(o === 'analizar'\) onAccion\(\{ que: 'analizar' \}\);\s*else if \(o === 'replicar'\) onAccion\(\{ que: 'replicar' \}\);\s*else onAccion\(\{ que: 'ia', paso: o, tipo \}\);/);
  // En el teléfono las cinco tarjetas van de a dos (y no cinco columnas de 70 px).
  assert.match(src, /@media \(max-width: 760px\) \{[^}]*\.gp \.gp-cc-opciones \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  // Y Crear ya no tiene la URL: ni la tarjeta, ni el esquema en modo importar.
  const crear = fuente(CREAR);
  assert.doesNotMatch(crear, /Importar desde URL|urlImportar|modo: 'importar'/);
  assert.match(crear, /<span className="gp-importar-titulo">Cargar un archivo<\/span>/);
});

// ── 4 · El «+» sólo adjunta ──────────────────────────────────────────────────────────────────

test('el «+»: Importar archivo y Subir imagen; lo de antes sigue alcanzable desde otro lado', () => {
  const src = fuente(CAJA);
  const mas = tramo(src, '<MenuFlotante ancla={menuMas}', '</MenuFlotante>');
  assert.deepEqual([...mas.matchAll(/texto="([^"]+)"/g)].map((m) => m[1]), ['Importar archivo', 'Subir imagen']);
  assert.match(src, /accept=\{ACCEPT_ARCHIVO\}/);
  assert.match(src, /accept=\{ACCEPT_IMAGEN\}/);
  assert.match(src, /export const ACCEPT_IMAGEN = extDe\(\['imagen'\]\);/);
  assert.doesNotMatch(src.match(/export const ACCEPT_ARCHIVO = [^\n]+/)?.[0] ?? '', /imagen/);
  // Se lee con el lector de la casa y queda como chip; al mandar, su texto va a «Pegar texto».
  assert.match(src, /void leerArchivo\(file, ac\.signal\)\.then\(/);
  // Verificación de la tanda 6 (rotura C3: `texto: ''` quedaba en verde): lo que viaja es EL TEXTO leído, y
  // «Pegar texto» lo pone en su campo y en lo que se manda.
  assert.match(src, /onAccion\(\{ que: 'ia', paso: 'pegar', tipo, arranque: \{ modo, prompt: pedido\.trim\(\), archivo: \{ nombre: archivo\.nombre, texto: archivo\.texto \} \} \}\);/);
  const crearIA = fuente(CREAR);
  assert.match(crearIA, /if \(arranque\.archivo\) \{[\s\S]{0,200}setTexto\(arranque\.archivo\.texto\);[\s\S]{0,200}texto: arranque\.archivo\.texto,/);
  assert.match(src, /adjunto=\{archivo \? \(\s*<ChipCaja icono=\{archivo\.imagen \? 'imagen' : 'archivo'\}/);
  // «Usar plantilla» = la grilla de abajo; «Del generador anterior» = la galería de Plantillas del Panel.
  const inicio = fuente(INICIO);
  assert.match(inicio, /\{tipo === 'landing' && \(\s*<button type="button" className="gp-btn gp-btn-contorno gp-galeria-borradores" onClick=\{onBorradores\}>/);
  assert.match(inicio, /\{borradores !== null && <DialogoBorradores onCerrar=\{cerrarBorradores\} ws=\{ws\} ahora=\{borradores\} \/>\}/);
  assert.match(src, /className="gp-cc-plantilla"/);
});

// ── 6 · Las tarjetas de las plantillas ───────────────────────────────────────────────────────

test('las plantillas: miniatura y nombre en UNA tarjeta con sombra, sin la descripción; la miniatura sigue marcando los [ ]', () => {
  const caja = fuente(CAJA);
  const grilla = tramo(caja, 'className="gp-cc-plantilla"', '</button>');
  assert.match(grilla, /<span className="gp-cc-nombre">\{p\.nombre\}<\/span>/);
  assert.doesNotMatch(grilla, /descripcion|gp-cc-desc/, 'volvió el subtítulo');
  assert.match(caja, /\.gp \.gp-cc-plantilla \{[^}]*border: 1px solid var\(--gp-borde-suave\);[^}]*background: var\(--gp-superficie\);[^}]*box-shadow: [^;]*rgba/);
  const inicio = fuente(INICIO);
  const tarjeta = tramo(inicio, 'className="gp-card gp-card-plantilla"', '</button>');
  assert.match(tarjeta, /<div className="gp-card-titulo">\{p\.nombre\}<\/div>/);
  assert.doesNotMatch(tarjeta, /descripcion|gp-card-meta/, 'volvió el subtítulo');
  assert.match(inicio, /\.gp \.gp-card-plantilla \{[^}]*border: 1px solid var\(--gp-borde-suave\);[^}]*background: var\(--gp-superficie\);[^}]*box-shadow: [^;]*rgba/);
  // En oscuro la sombra es más honda (una clara no se ve sobre un fondo oscuro).
  assert.match(caja, /\[data-tema="oscuro"\] \.gp \.gp-cc-plantilla/);
  assert.match(inicio, /\[data-tema="oscuro"\] \.gp \.gp-card-plantilla/);
  // Los [ ] resaltados de la miniatura cuelgan de `marcadores` (piezas:huecos-resaltados): no se tocan.
  assert.match(fuente('app/landing-generator/MiniaturaLanding.tsx'), /\{ modo: 'miniatura', incluirOcultas: true, marcadores: true \}/);
});

// ── 1 · El lector en la pantalla: Analizar y Replicar ────────────────────────────────────────

test('LeerOPegar: el lector se abre EN EL CLIC (sin await antes), con el aviso; sin texto en el navegador, «Pega el texto»', () => {
  const src = fuente(LEER);
  const clic = tramo(src, 'const leerAhora = () => {', '\n  };');
  assert.doesNotMatch(clic, /\bawait\b|async/, 'un await antes del lector y Chrome bloquea la ventana');
  assert.match(clic, /^const leerAhora = \(\) => \{\s*setNota\(null\);\s*void leer\(url\)\.then\(/, 'lo primero del clic es abrir el lector');
  assert.match(clic, /if \(r\.detalle\.palabras === 0\) \{ setNota\(SIN_TEXTO_EN_NAVEGADOR\); setPegar\(true\); return; \}/);
  assert.match(clic, /if \(r\.motivo !== 'bloqueadas'\) setNota\(r\.mensaje\);/);
  assert.match(src, /onClick=\{leerAhora\}/);
  assert.match(src, /\{aviso\}/);
  assert.match(src, /export const BOTON_LEER = 'Leer en tu navegador';/);
  assert.match(src, /export const BOTON_PEGAR = 'Pega el texto';/);
});

test('Replicar: 3 formatos con su ícono, `{ url, formato, lectura?, texto? }`, y el lector cuando el server no puede', () => {
  const src = fuente(REPLICAR);
  assert.match(src, /export const ICONO_FORMATO: Record<FormatoReplicar, string> = \{ presentacion: 'presentar', landing: 'paginas', web: 'globo' \};/);
  assert.match(src, /const cuerpo: PedidoReplicar = formato === 'web' \? \{ url, formato \} : \{ url, formato, \.\.\.extra \};/);
  assert.match(src, /postJson<RespuestaReplicar>\('\/api\/landing-generator\/replicar', cuerpo, PLAZO_IA_MS\)/);
  assert.match(src, /setEstado\(\{ fase: 'falla', formato, error: f\.error, enNavegador: f\.enNavegador === true, pegable: f\.pegable === true, probar: probar && probar !== formato \? probar : null \}\);/);
  // Verificación de la tanda 6: si el server propone otro formato (`probar`, una app de Vite en «Página web»),
  // la falla lo ofrece como botón, acá y en el Diagnóstico (L5 al pie).
  assert.match(src, /<FallaReplicar\s+error=\{estado\.error\}\s+probar=\{pedida \? estado\.probar : null\}\s+onProbar=\{\(f\) => \{ if \(!pedida\) return; setFormato\(f\); empezar\(pedida, f\); \}\}/);
  assert.match(src, /\{probar && \(\s*<button type="button" className="gp-btn gp-btn-contorno"[^>]*onClick=\{\(\) => onProbar\(probar\)\}>/);
  assert.match(src, /onLectura=\{\(lectura\) => void replicar\(pedida, estado\.formato, \{ lectura \}\)\}/);
  // Desde el link de la caja arranca solo, UNA vez (el ref sobrevive al doble montaje: replicar se paga).
  assert.match(src, /if \(arrancado\.current\) return;\s*arrancado\.current = true;/);
  const dg = fuente(PANEL_DG);
  assert.match(dg, /\{FORMATOS_REPLICAR\.map\(\(f\) => \(\s*<ItemMenu key=\{f\} icono=\{ICONO_FORMATO\[f\]\} texto=\{NOMBRE_FORMATO_REPLICAR\[f\]\} onClick=\{\(\) => replicar\(f\)\} \/>/);
  assert.doesNotMatch(dg, /'bloques'|'fiel'|Como bloques editables|Copia fiel/, 'volvió el pedido viejo de Replicar');
  assert.match(dg, /void pedirReplica\(urlPegada, formato, lectura && formato !== 'web' \? \{ lectura \} : \{\}\);/);
  assert.match(dg, /<FallaReplicar clase="gdg-error" error=\{estadoReplicar\.error\} probar=\{urlPegada \? estadoReplicar\.probar : null\} deshabilitado=\{replicando\} onProbar=\{replicar\} \/>/);
});

test('el Diagnóstico: el lector cuando el server contesta enNavegador, y la página TAL CUAL a la vista y a Replicar', () => {
  const dg = fuente(PANEL_DG);
  assert.match(dg, /setEnNavegador\(f\.enNavegador === true\);/);
  assert.match(dg, /\.\.\.\(extra\.lectura \? \{ lectura: extra\.lectura \} : \{\}\)/);
  assert.match(dg, /\{error && \(pegable \|\| enNavegador\) && urlPegada \? \(\s*<LeerOPegar/);
  assert.match(dg, /onLectura=\{\(lectura\) => void analizar\(\{ lectura \}\)\}/);
  assert.match(dg, /<VistaAfuera url=\{urlPegada\}/);
  assert.match(dg, /const urlPegada = urlVista && url \? url\.trim\(\) : null;/);
  // La vista previa baja la pegada tal cual (con su www y su query).
  const ruta = fuente(PAGINA);
  assert.equal((ruta.match(/htmlDePagina\(url, \{ talCual: true \}\)/g) ?? []).length, 2, 'la vista y la ventana del lector, las dos tal cual');
});

// ── Los cabos sueltos de las piezas ──────────────────────────────────────────────────────────

test('«Probar» del Pixel: la ventana se abre en el clic, ANTES del chequeo; si la prueba no arranca, se cierra', () => {
  const src = fuente(PROBAR);
  const arrancar = tramo(src, 'const arrancar = async () => {', '\n  };');
  const iAbre = arrancar.indexOf("window.open('about:blank', 'mako_prueba'");
  const iFetch = arrancar.indexOf("await fetch('/api/integraciones/landing/estado?diag=1'");
  assert.ok(iAbre > 0 && iFetch > iAbre, 'la ventana se abre después de un await: Chrome la bloquea y el aviso miente');
  assert.equal((arrancar.slice(0, iAbre).match(/\bawait\b/g) ?? []).length, 0);
  assert.match(arrancar, /if \(viejo\) \{ cerrarVentana\(\); setBloqueo\(true\); return; \}/);
  assert.match(arrancar, /chico\.location\.replace\(\s*conWs\(`\/integraciones\/escuchando\?p=\$\{id\}/);
  assert.equal((arrancar.match(/window\.open\(conWs\(/g) ?? []).length, 0, 'la ventana de la prueba se abre una sola vez, en el clic');
  // Y la pestaña de la LANDING también, antes del chequeo (sin permiso para el sitio, Chrome deja UNA ventana
  // por clic: abierta después, la landing quedaba bloqueada callada). Su bloqueo frena la prueba igual.
  // Rotura (14/10/2026, de memoria, verificada por hash; base 14 / 0): la pestaña de la landing no se abre
  // en el clic (`pestana = chico`) → 13 / 1; la condición del clic sin `!pestana` → 13 / 1. Sólo éste, las dos.
  const iPestana = arrancar.indexOf("pestana = window.open('about:blank', '_blank')");
  assert.ok(iPestana > iAbre && iFetch > iPestana, 'la pestaña de la landing se abre en el clic, después de la ventana y antes del chequeo');
  assert.doesNotMatch(arrancar, /'noopener'\)/, 'una pestaña con noopener no dice si la bloquearon');
  const iBloqueo = arrancar.indexOf('if (!chico || chico.closed || !pestana || pestana.closed) {');
  assert.ok(iBloqueo > iPestana && iBloqueo < iFetch, 'si la pestaña no abre, la prueba no arranca (en el clic, antes del chequeo)');
});

test('el editor marca la cifra «[00]%» de un ítem (el NodeView pide `completar`)', () => {
  assert.match(fuente('app/landing-generator/editor/nodos/OptimizadoVista.tsx'), /const arbol = specOptimizadoItem\(attrs, \{ completar: true \}\);/);
});

test('ni las pantallas nuevas ni las tocadas tienen voseo (el guard del repo no ve un archivo nuevo sin `git add`)', () => {
  const malas: Record<string, string[]> = {};
  for (const f of [CAJA, INICIO, CREAR, REPLICAR, LEER, PANEL_DG, 'app/landing-generator/panel-reglas.ts', 'app/landing-generator/crear/page.tsx']) {
    const m = marcasDeVoseo(fuente(f));
    if (m.length) malas[f] = m;
  }
  assert.deepEqual(malas, {});
});

// ── PROBADO ROMPIÉNDOLO (14/10/2026) ─────────────────────────────────────────────────────────
// Una rotura por vez contra la base en verde (14 pasan / 0 fallan), con un arnés que restaura DE MEMORIA y
// compara el sha256 antes y después (pasan / fallan, y el test que se pone rojo). Al final, 14 / 0 otra vez.
//   R1  sacarLink se lleva el link a medio tipear (sin «cerrado»)            → 13 / 1 (sacarLink)
//   R2  el link pegado no va en lugar del campo                              → 13 / 1 (la caja: el link…)
//   R3  la derecha deja el link de Replicar en la URL (un F5 replica otra vez) → 13 / 1 (la derecha del Panel)
//   R4  /crear pierde el ?ws= del link                                        → 13 / 1 (/landing-generator/crear redirige…)
//   R5  «Inicio» de Crear vuelve a ser un link a /landing-generator           → 13 / 1 (el Panel monta Crear…)
//   R6  falta «Replicar landing» en Crear con IA                              → 13 / 1 («Crear con IA» en la caja)
//   R7  vuelve «Usar plantilla» al «+»                                        → 13 / 1 (el «+»)
//   R8  vuelve el subtítulo de la plantilla                                   → 13 / 1 (las plantillas)
//   R9  un `await` antes del lector (Chrome bloquearía la ventana)            → 13 / 1 (LeerOPegar)
//   R10 Replicar no manda la lectura del navegador                            → 13 / 1 (Replicar)
//   R11 la vista del Diagnóstico con la URL normalizada (sin www)             → 13 / 1 (el Diagnóstico)
//   R12 «Probar» con un `await` antes de abrir la ventana                     → 13 / 1 («Probar» del Pixel)
//   R13 el editor sin la marca de la cifra «[00]%»                            → 13 / 1 (el editor marca la cifra)
//   R14 voseo en Replicar («Tocá acá y pegá la dirección.»)                   → 13 / 1 (voseo)
//       La primera versión («Pegá la dirección y elegí el formato.») dio VERDE, 14 / 0: el detector de la casa
//       (`VOSEO`, lib/puestas-data.ts) no conoce «pegá» ni «elegí». Por eso la rotura usa «tocá» y «acá».

// ── VERIFICACIÓN DE LA TANDA 6 (14/10/2026): PROBADO ROMPIÉNDOLO ──────────────────────────────
// Base: 15 / 0. Las tres que la verificación encontró en VERDE (C1, C2, C3) y una más:
//   C1 «Analiza esta landing» abre el Diagnóstico vacío (sin la URL)  → 14 / 1 «derechaDeAccion…» (antes: 14 / 0)
//   C2 «Replica esta landing» no arranca sola (`auto: false`)         → 14 / 1 «derechaDeAccion…» (antes: 14 / 0)
//   C3 el archivo del «+» llega vacío a «Pegar texto» (`texto: ''`)  → 14 / 1 «el «+»…»            (antes: 14 / 0)
//   C4 el Panel con su propia regla para «analizar»                    → 14 / 1 «derechaDeAccion…»
// Restaurado: 15 / 0.

// ── EL LINK DE LA CAJA, LOS BORDES (verificación de la tanda 6, 15/10/2026): PROBADO ROMPIÉNDOLO ──────────
// Base: 18 / 0. Arnés que rompe, corre ESTE archivo, restaura de memoria y compara el sha256:
//   L1 sacarLink saca el link aunque haya texto al lado (lo de antes)   → 17 / 1 «sacarLink: con TEXTO al lado…»
//   L2 sinCierre le quita siempre el «)» final (la regex de antes)      → 16 / 2 «…el «)» de un link…», «linkEscrito…»
//   L3 CajaCrear manda sólo el chip (sin `linkEscrito`)                 → 17 / 1 «la caja: el link va EN LUGAR…»
//   L4 linkEscrito que nunca encuentra un link                          → 17 / 1 «linkEscrito…»
// Restaurado: 18 / 0.
// Y Replicar con `probar` (la misma verificación). Base: 18 / 0.
//   H4 Replicar.tsx sin ofrecer el formato que propone el server       → 17 / 1 «Replicar: 3 formatos…»
//   H5 el Diagnóstico sin ofrecerlo                                    → 17 / 1 «Replicar: 3 formatos…»
// Restaurado: 18 / 0.
