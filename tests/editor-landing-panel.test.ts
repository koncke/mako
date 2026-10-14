// =============================================================================
// editor-landing-panel — T1 y T2 de la tanda 2: el Panel es una barra de DOCUMENTOS y el
// Diagnóstico se abre a la derecha
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, puntos 1-4), textual: «Aún no se ve igual... Muchos
// botones a la derecha.» · «"Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la
// derecha.» · «Elimina las tab de "Recientes, creadas por mi, publicadas y favoritas". También
// elimina la tab de "landings", que en la sidebar aparezcan las landings creadas/analizadas con
// el nombre de las mismas... Y también elimina el botón de "diagnostico" de la sidebar, en su
// lugar que esté dentro de los 3 puntos que debe tener cada landing, junto a otros botones como
// renombrar, eliminar, archivar, duplicar, etc... También elimina la funcionalidad de
// "carpetas".» · «También agrega el botón de "Nueva landing" como placeholder en el primer puesto
// arriba de las demás landing.» Decisiones T1 y T2 de docs/diseno-editor-landing.md.
//
// Lo que estos tests cuidan:
//   · los RENGLONES (app/landing-generator/panel-reglas.ts, puro): documentos por nombre con su
//     tipo, las analizadas de afuera con su host, y las analizadas que son NUESTRAS fuera (se
//     cruzan por la URL normalizada del Landing Analyst, no por un parecido);
//   · la DERECHA en la URL: lo que se escribe (`queryDeDerecha`) es lo que se vuelve a leer
//     (`derechaDeQuery`), y /landing-generator/analizar aterriza en el Diagnóstico que promete;
//   · la PANTALLA (fuente sin comentarios: un guard de «esto NO está» se acusa a sí mismo por el
//     párrafo que explica por qué se fue): sin las vistas y la fila de botones que se fueron, con
//     «Nueva landing» primero, el «⋯» completo, el Diagnóstico montado a la derecha y eliminar
//     pasando por la Papelera;
//   · el server: `listar` llena `formato`/`proporcion` (el ícono del renglón) y la miniatura de una
//     presentación toma la forma de su diapositiva (se RENDERIZA, no se lee).
//
// PROBADO ROMPIÉNDOLO (12/10/2026): al pie, con números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto.supabase.co';

import {
  ICONO_FILA, SIN_TITULO, destinoAnalizar, docDeUrl, derechaDeQuery, enPapelera, esDiagnosticoDe, filasDelPanel,
  filtrarFilas, hostDe, idValido, queryDeDerecha, urlDeBusqueda, urlParaAnalizar, type Analizada, type Derecha, type FilaPanel,
} from '../app/landing-generator/panel-reglas';
import type { LandingResumen } from '../lib/editor-landing/api-tipos';
import { TEMAS } from '../lib/editor-landing/temas';
import { MiniaturaLanding } from '../app/landing-generator/MiniaturaLanding';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (un `/*` adentro de un `//` abre un bloque falso)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\}/g, '');          // lo que queda de un `{/* … */}` de JSX

const APP = 'https://hola-mako.com';
/** Las bases de las landings en producción (tanda 4): hola-mako.site, y la de antes, hola-mako.com/l. */
const BASES = ['https://hola-mako.site', 'https://hola-mako.com/l'];

function doc(id: number, p: Partial<LandingResumen> = {}): LandingResumen {
  return {
    id, titulo: `Landing ${id}`, tema: 'pewter', creado: '2026-10-01T00:00:00Z', actualizado: '2026-10-01T00:00:00Z',
    creadoPor: null, favorito: false, carpeta: null, papelera: false, slug: null, publicadoAt: null, primera: null, ...p,
  };
}
const analizada = (url: string): Analizada => ({ url, veredicto: null, score: null });

// ── 1 · Los renglones ────────────────────────────────────────────────────────────────────────

test('hostDe: el host sin «www.» y la ruta sin la barra final; lo que no es URL vuelve igual', () => {
  assert.equal(hostDe('https://www.ejemplo.com/'), 'ejemplo.com');
  assert.equal(hostDe('https://ejemplo.com/oferta/'), 'ejemplo.com/oferta');
  assert.equal(hostDe('no es una url'), 'no es una url');
});

test('docDeUrl: una URL de hola-mako.site/<slug> o hola-mako.com/l/<slug> (o una de sus páginas) es NUESTRA; un slug que empieza igual no', () => {
  const docs = [doc(5, { slug: 'mi-landing' }), doc(6, { slug: 'mi-landing-2' }), doc(7)];
  // Tanda 4: la dirección vigente, la que se comparte desde el 14/10/2026.
  assert.equal(docDeUrl('https://hola-mako.site/mi-landing', docs, BASES), 5);
  assert.equal(docDeUrl('https://www.hola-mako.site/mi-landing/gracias?utm_source=x', docs, BASES), 5);
  assert.equal(docDeUrl('https://hola-mako.site/mi-landing-2', docs, BASES), 6);
  assert.equal(docDeUrl('https://hola-mako.site/l/mi-landing', docs, BASES), null, 'hola-mako.site no lleva /l');
  assert.equal(docDeUrl('https://hola-mako.com/mi-landing', docs, BASES), null, 'la app sin /l no es una landing');
  // La de antes (redirige, pero lo analizado con ella sigue siendo de la landing).
  assert.equal(docDeUrl('https://hola-mako.com/l/mi-landing', docs, BASES), 5);
  // Su dominio propio VERIFICADO (el server sólo lo manda así): la raíz y sus páginas son ella.
  const conDominio = [...docs, doc(8, { slug: 'promo', dominio: 'promo.tunegocio.com' })];
  assert.equal(docDeUrl('https://promo.tunegocio.com/', conDominio, BASES), 8);
  assert.equal(docDeUrl('https://www.promo.tunegocio.com/gracias?utm_source=fb', conDominio, BASES), 8);
  assert.equal(docDeUrl('https://promo.tunegocio.com.evil.tld/', conDominio, BASES), null);
  assert.equal(docDeUrl('https://tunegocio.com/', conDominio, BASES), null, 'el dominio raíz no es el subdominio conectado');
  assert.equal(docDeUrl('https://www.hola-mako.com/l/mi-landing/?utm_source=x', docs, BASES), 5, 'la clave es la del Landing Analyst: sin www, sin query, sin barra');
  assert.equal(docDeUrl('https://hola-mako.com/l/mi-landing/gracias', docs, BASES), 5, 'una página de la landing es de la landing');
  assert.equal(docDeUrl('https://hola-mako.com/l/mi-landing-2', docs, BASES), 6, 'el prefijo no confunde dos slugs');
  assert.equal(docDeUrl('https://hola-mako.com/l/otra', docs, BASES), null, 'un slug que no es de este negocio no es nuestro');
  assert.equal(docDeUrl('https://otra.com/l/mi-landing', docs, BASES), null);
  assert.equal(docDeUrl('::', docs, BASES), null);
});

test('filasDelPanel: documentos por nombre (el editado último arriba) y después las de afuera, sin la papelera, sin las nuestras y sin repetidas', () => {
  const docs = [
    doc(1, { titulo: 'Agenda tu llamada', actualizado: '2026-10-02T00:00:00Z', slug: 'agenda', publicadoAt: '2026-10-02T00:00:00Z' }),
    doc(2, { titulo: 'Pitch', formato: 'presentacion', proporcion: '4:3', actualizado: '2026-10-05T00:00:00Z' }),
    doc(3, { titulo: 'Vieja', papelera: true, actualizado: '2026-10-09T00:00:00Z' }),
    doc(4, { titulo: '   ', actualizado: '2026-10-01T00:00:00Z' }),
  ];
  const filas = filasDelPanel(docs, [
    analizada('https://www.otra.com/oferta'),
    analizada('https://otra.com/oferta/?fbclid=1'),     // la misma página: no se repite
    analizada('https://hola-mako.com/l/agenda'),         // es NUESTRA: ya está como documento
    analizada('https://hola-mako.site/agenda/gracias'),  // también (tanda 4: la dirección vigente)
    analizada('esto no es una url'),
    analizada('https://tercera.mx/'),
  ], BASES);
  assert.deepEqual(filas.map((f) => [f.tipo, f.nombre]), [
    ['presentacion', 'Pitch'],
    ['landing', 'Agenda tu llamada'],
    ['landing', SIN_TITULO],
    ['analizada', 'otra.com/oferta'],
    ['analizada', 'tercera.mx'],
  ]);
  assert.equal(new Set(filas.map((f) => f.clave)).size, filas.length, 'las claves de los renglones no se repiten');
  const ext = filas[3];
  assert.ok(ext.tipo === 'analizada' && ext.url === 'https://www.otra.com/oferta', 'la de afuera conserva su URL tal cual (la abre el Diagnóstico)');
  assert.deepEqual(ICONO_FILA, { landing: 'paginas', presentacion: 'presentar', analizada: 'globo' });
});

test('filtrarFilas («Ir a»): por nombre, sin acentos ni mayúsculas', () => {
  const filas = filasDelPanel([doc(1, { titulo: 'Presentación comercial', formato: 'presentacion' }), doc(2, { titulo: 'Webinar' })], [analizada('https://otra.com/')], BASES);
  assert.deepEqual(filtrarFilas(filas, 'PRESENTACION').map((f) => f.nombre), ['Presentación comercial']);
  assert.deepEqual(filtrarFilas(filas, 'otra').map((f) => f.nombre), ['otra.com']);
  assert.equal(filtrarFilas(filas, '  ').length, 3);
});

test('enPapelera: sólo lo archivado, el editado último arriba', () => {
  const docs = [doc(1, { papelera: true, actualizado: '2026-10-01T00:00:00Z' }), doc(2), doc(3, { papelera: true, actualizado: '2026-10-03T00:00:00Z' })];
  assert.deepEqual(enPapelera(docs).map((d) => d.id), [3, 1]);
});

// ── 2 · La derecha y la URL ──────────────────────────────────────────────────────────────────

test('idValido y urlParaAnalizar: enteros positivos; http(s) con un host con punto (sin esquema, https)', () => {
  assert.equal(idValido('12'), 12);
  for (const v of ['0', '-3', '1.5', 'abc', '', null, undefined, '1e3']) assert.equal(idValido(v as string | null), null, String(v));
  assert.equal(urlParaAnalizar('tu-pagina.com'), 'https://tu-pagina.com/');
  assert.equal(urlParaAnalizar('https://a.com/x?y=1'), 'https://a.com/x?y=1');
  for (const v of ['', 'javascript:alert(1)', 'ftp://a.com/', 'localhost', 'x'.repeat(2_001)]) assert.equal(urlParaAnalizar(v), null, v.slice(0, 30));
});

test('urlDeBusqueda: el «Ir a» ofrece analizar sólo lo que es la dirección de una página, no un nombre', () => {
  assert.equal(urlDeBusqueda('otra.com'), 'https://otra.com/');
  assert.equal(urlDeBusqueda('  https://a.com/x  '), 'https://a.com/x');
  for (const q of ['', 'pitch', 'Agenda tu llamada', 'mi landing.com', 'landing.v2', 'version 2.0', '1.5']) assert.equal(urlDeBusqueda(q), null, q);
});

test('derechaDeQuery: diagnóstico por id, por URL (la nuestra abre NUESTRO documento), vacío para pegar una, las vistas, y la caja por default', () => {
  const docs = [doc(5, { slug: 'mi-landing' })];
  const d = (q: { vista?: string | null; diagnostico?: string | null; analizar?: string | null }) => derechaDeQuery(q, docs, BASES);
  assert.deepEqual(d({ diagnostico: '9' }), { tipo: 'diagnostico', docId: 9 });
  assert.deepEqual(d({ diagnostico: '9', analizar: 'https://a.com/', vista: 'temas' }), { tipo: 'diagnostico', docId: 9 }, 'el id manda');
  assert.deepEqual(d({ analizar: 'https://a.com/x' }), { tipo: 'diagnostico', url: 'https://a.com/x' });
  assert.deepEqual(d({ analizar: 'https://hola-mako.com/l/mi-landing' }), { tipo: 'diagnostico', docId: 5 }, 'una URL nuestra abre el diagnóstico del documento');
  assert.deepEqual(d({ analizar: 'https://hola-mako.site/mi-landing' }), { tipo: 'diagnostico', docId: 5 }, 'la de hola-mako.site también (tanda 4)');
  assert.deepEqual(d({ analizar: '' }), { tipo: 'diagnostico' }, 'vacía: el Diagnóstico para pegar una URL');
  assert.deepEqual(d({ analizar: 'javascript:alert(1)' }), { tipo: 'diagnostico' });
  assert.deepEqual(d({ diagnostico: 'abc', analizar: null, vista: 'papelera' }), { tipo: 'papelera' });
  assert.deepEqual(d({ vista: 'plantillas' }), { tipo: 'plantillas' });
  assert.deepEqual(d({ vista: 'temas' }), { tipo: 'temas' });
  for (const v of ['favoritos', 'recientes', 'mias', 'publicadas', 'todas', 'carpeta:Clientes', null]) {
    assert.deepEqual(d({ vista: v }), { tipo: 'crear' }, `la vista «${v}» se fue: la caja de crear`);
  }
});

test('queryDeDerecha: escribe la derecha y conserva el ?ws=; lo escrito se vuelve a leer igual', () => {
  assert.equal(queryDeDerecha('?ws=3&vista=temas', { tipo: 'crear' }), '?ws=3');
  assert.equal(queryDeDerecha('', { tipo: 'crear' }), '');
  assert.equal(queryDeDerecha('?ws=3&diagnostico=7', { tipo: 'papelera' }), '?ws=3&vista=papelera');
  assert.equal(queryDeDerecha('', { tipo: 'diagnostico', docId: 7 }), '?diagnostico=7');
  assert.equal(queryDeDerecha('?ws=3', { tipo: 'diagnostico', url: 'https://a.com/x' }), '?ws=3&analizar=https%3A%2F%2Fa.com%2Fx');
  assert.equal(queryDeDerecha('?analizar=https%3A%2F%2Fa.com', { tipo: 'diagnostico' }), '?analizar=');
  const ida: Derecha[] = [
    { tipo: 'crear' }, { tipo: 'plantillas' }, { tipo: 'temas' }, { tipo: 'papelera' },
    { tipo: 'diagnostico', docId: 7 }, { tipo: 'diagnostico', url: 'https://a.com/x' }, { tipo: 'diagnostico' },
  ];
  for (const d of ida) {
    const p = new URLSearchParams(queryDeDerecha('?ws=3', d));
    assert.equal(p.get('ws'), '3');
    assert.deepEqual(derechaDeQuery({ vista: p.get('vista'), diagnostico: p.get('diagnostico'), analizar: p.get('analizar') }, [], BASES), d, JSON.stringify(d));
  }
});

test('esDiagnosticoDe: marca el renglón cuyo diagnóstico está abierto (la de afuera por la URL normalizada)', () => {
  const [propio, ext] = filasDelPanel([doc(5)], [analizada('https://www.a.com/x')], BASES) as [FilaPanel, FilaPanel];
  assert.equal(esDiagnosticoDe({ tipo: 'diagnostico', docId: 5 }, propio), true);
  assert.equal(esDiagnosticoDe({ tipo: 'diagnostico', docId: 6 }, propio), false);
  assert.equal(esDiagnosticoDe({ tipo: 'diagnostico', url: 'https://a.com/x/' }, ext), true);
  assert.equal(esDiagnosticoDe({ tipo: 'diagnostico', url: 'https://a.com/y' }, ext), false);
  assert.equal(esDiagnosticoDe({ tipo: 'crear' }, propio), false);
  assert.equal(esDiagnosticoDe({ tipo: 'diagnostico' }, ext), false);
});

test('destinoAnalizar: /landing-generator/analizar aterriza en el Panel con el Diagnóstico que pide, y lleva el ?ws= del link', () => {
  assert.equal(destinoAnalizar({}), '/landing-generator?analizar=');
  assert.equal(destinoAnalizar({ url: 'https://a.com/x', ws: '3' }), '/landing-generator?analizar=https%3A%2F%2Fa.com%2Fx&ws=3');
  assert.equal(destinoAnalizar({ diagnostico: '12' }), '/landing-generator?diagnostico=12');
  assert.equal(destinoAnalizar({ id: '12', url: 'https://a.com/' }), '/landing-generator?diagnostico=12', 'el id manda');
  assert.equal(destinoAnalizar({ id: 'x', analizar: ' a.com ' }), '/landing-generator?analizar=a.com');
  assert.equal(destinoAnalizar({ url: ['https://a.com/', 'https://b.com/'] }), '/landing-generator?analizar=https%3A%2F%2Fa.com%2F');
  // Lo que promete el redirect es lo que el Panel abre (las dos puntas, una contra la otra).
  for (const [sp, esperado] of [
    [{}, { tipo: 'diagnostico' }],
    [{ url: 'https://a.com/x' }, { tipo: 'diagnostico', url: 'https://a.com/x' }],
    [{ id: '12' }, { tipo: 'diagnostico', docId: 12 }],
  ] as const) {
    const p = new URL(destinoAnalizar(sp), APP).searchParams;
    assert.deepEqual(derechaDeQuery({ vista: p.get('vista'), diagnostico: p.get('diagnostico'), analizar: p.get('analizar') }, [], BASES), esperado);
  }
});

// ── 3 · La pantalla ──────────────────────────────────────────────────────────────────────────

const INICIO = 'app/landing-generator/Inicio.tsx';
const PAGE = 'app/landing-generator/page.tsx';
const ANALIZAR = 'app/landing-generator/analizar/page.tsx';
const REGLAS = 'app/landing-generator/panel-reglas.ts';
const MINI = 'app/landing-generator/MiniaturaLanding.tsx';

test('se fueron las vistas de filtros, las carpetas y la fila de botones de la derecha', () => {
  const src = sinComentarios(leer(INICIO));
  const fuera: Array<[RegExp, string]> = [
    [/Recientes|leerRecientes/, 'Recientes'],
    [/Creadas por mí|Creada por ti/, 'Creadas por mí'],
    [/Favoritos|accion: 'favorito'/, 'Favoritos'],
    [/'Publicadas'|>Publicadas</, 'Publicadas'],
    [/carpeta:|Carpetas|accion: 'carpeta'|Mover a carpeta/, 'Carpetas'],
    [/Nuevo desde cero/, 'Nuevo desde cero'],
    [/Crear nuevo/, 'Crear nuevo IA'],
    [/'Importar'|> Importar|Importar ▾|menuImportar/, 'Importar'],
    [/Ordenar por/, 'Ordenar por'],
    [/Cuadrícula/, 'Cuadrícula / Lista'],
    [/landing-generator\/analizar/, 'el Diagnóstico como otra ruta'],
  ];
  const vueltas = fuera.filter(([re]) => re.test(src)).map(([, que]) => que);
  assert.deepEqual(vueltas, [], 'volvió algo que Martín pidió sacar');
});

test('la barra: «Ir a», «Nueva landing» PRIMERO, la lista de documentos, y abajo Plantillas · Temas · Papelera', () => {
  const src = sinComentarios(leer(INICIO));
  const iBusca = src.indexOf('className="gp-ir-a"');
  const iNueva = src.indexOf('<span>Nueva landing</span>');
  const iLista = src.indexOf('className="gp-docs"');
  const iFilas = src.indexOf('{filas.map(renglon)}');
  const iAbajo = src.indexOf("{itemNav('plantillas', 'Plantillas', 'plantillas')}");
  assert.ok(iBusca > 0 && iNueva > iBusca && iLista > iNueva && iFilas > iLista && iAbajo > iFilas, 'el orden de la barra cambió');
  assert.equal(src.split('Nueva landing').length - 1, 1, '«Nueva landing» es UN renglón, y es el primero');
  assert.match(src, /\{itemNav\('plantillas', 'Plantillas', 'plantillas'\)\}\s*\{itemNav\('temas', 'Temas', 'paleta'\)\}\s*\{itemNav\('papelera', 'Papelera', 'papelera'\)\}/);
  assert.match(src, /<button type="button" className="gp-doc-nuevo" aria-current=\{derecha\.tipo === 'crear' \? 'page' : undefined\} onClick=\{nuevaLanding\}>/,
    '«Nueva landing» no abre la caja de crear a la derecha');
  assert.match(src, /const nuevaLanding = \(\) => \{\s*setDerecha\(\{ tipo: 'crear' \}\);/);
  // Clic en un documento nuestro abre el editor; en una de afuera, su Diagnóstico.
  assert.match(src, /<Link href=\{`\/landing-generator\/\$\{f\.doc\.id\}`\} className="gp-doc-abrir"/);
  assert.match(src, /className="gp-doc-abrir" title=\{f\.url\}[^>]*onClick=\{\(\) => abrirDiagnostico\(f\)\}/);
});

test('el «⋯» de cada renglón: Abrir, Diagnóstico, Cambiar nombre, Duplicar, Archivar y Eliminar (tacho rojo)', () => {
  const src = sinComentarios(leer(INICIO));
  const ini = src.indexOf('<MenuFlotante ancla={menu.ancla}');
  const bloque = src.slice(ini, src.indexOf('</MenuFlotante>', ini));
  assert.ok(ini > 0 && bloque.length > 500 && bloque.length < 4_000, `el bloque del menú mide ${bloque.length}`);
  const propio = bloque.slice(bloque.indexOf(') : ('));
  const enOrden = ['texto="Abrir"', 'texto="Diagnóstico"', 'texto="Cambiar nombre"', 'texto="Duplicar"', 'texto="Archivar"', 'peligro texto="Eliminar"'];
  const pos = enOrden.map((t) => propio.indexOf(t));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), `faltan o se desordenaron: ${enOrden.filter((_, i) => pos[i] < 0).join(', ')}`);
  // Cambiar nombre es AHÍ MISMO (el renglón se vuelve un campo), no un diálogo.
  assert.match(propio, /texto="Cambiar nombre" onClick=\{\(\) => \{ setMenu\(null\); setRenombrando\(\{ id: mf\.doc\.id, texto: mf\.doc\.titulo \}\); \}\}/);
  const campo = src.slice(src.indexOf('className="gp-doc-input"'), src.indexOf('/>', src.indexOf('className="gp-doc-input"')));
  assert.match(campo, /onBlur=\{\(\) => void guardarNombre\(\)\}/, 'el campo de «Cambiar nombre» no guarda al salir');
  assert.match(campo, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); void guardarNombre\(\); \}/);
  assert.match(campo, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); setRenombrando\(null\); \}/);
  // Una de afuera: su Diagnóstico y Eliminar (borra el diagnóstico, no el seguimiento del Pixel).
  const ajena = bloque.slice(0, bloque.indexOf(') : ('));
  assert.match(ajena, /texto="Diagnóstico"/);
  assert.match(ajena, /peligro texto="Eliminar"/);
  assert.match(src, /fetch\(`\/api\/landing-analyst\/view\?url=\$\{encodeURIComponent\(url\)\}`, \{ method: 'DELETE'/);
});

test('archivar es la Papelera con un Deshacer que devuelve la MISMA landing; eliminar pasa por la Papelera primero', () => {
  const src = sinComentarios(leer(INICIO));
  assert.match(src, /avisar\('Archivada', \(\) => void restaurar\(d\)\);/);
  const ini = src.indexOf('const eliminarDoc = async');
  const cuerpo = src.slice(ini, src.indexOf('const eliminarAnalizada', ini));
  const iPapelera = cuerpo.indexOf("accion: 'papelera'");
  const iBorrar = cuerpo.indexOf("accion: 'borrar'");
  assert.ok(ini > 0 && iPapelera > 0 && iBorrar > iPapelera, 'eliminar desde el ⋯ tiene que archivar antes de borrar (el server sólo borra lo de la Papelera)');
  assert.match(cuerpo, /if \(!d\.papelera\) \{/);
  // La confirmación: una frase con la consecuencia, pegada al botón del tacho rojo de la casa.
  assert.match(src, /className="gp-btn gp-btn-borrar" disabled=\{enVuelo\} onClick=\{\(\) => void eliminar\(\)\}>\s*\{enVuelo \? <span className="gp-giro" \/> : <IconoBorrar size=\{14\} \/>\} Eliminar/);
  assert.match(src, /frase=\{`Se elimina «\$\{dialogo\.doc\.titulo\.trim\(\) \|\| SIN_TITULO\}» con su historial y no se puede deshacer\.`\}/);
});

test('la derecha: la caja de crear por default, el Diagnóstico montado AHÍ (con key por landing) y la URL al día', () => {
  const src = sinComentarios(leer(INICIO));
  assert.match(src, /^import CajaCrear, \{ type AccionCaja \} from '\.\/CajaCrear';$/m);
  assert.match(src, /^import PanelDiagnostico from '\.\/diagnostico\/PanelDiagnostico';$/m);
  // Tanda 6: la caja le pasa al Panel lo que se eligió (Crear con IA, Analizar, Replicar) para abrirlo AHÍ.
  assert.match(src, /\} else \{\s*contenido = <CajaCrear onAccion=\{alAccion\} \/>;\s*\}/, 'la caja no es lo que se ve por default');
  assert.match(src, /<PanelDiagnostico key=\{`\$\{derecha\.docId \?\? ''\}\|\$\{derecha\.url \?\? ''\}`\} docId=\{derecha\.docId\} url=\{derecha\.url\} onCerrar=\{cerrarDiagnostico\} onAnalizada=\{sumarAnalizada\} \/>/);
  // Integración (12/10/2026, PEDIDO 3 del Panel): una página de afuera recién analizada entra a la
  // barra sin recargar, comparada normalizada (no se duplica el renglón). Probado rompiéndolo: sin
  // el `onAnalizada` → 1 fallo; agregando sin comparar (`[{ url, … }, ...l]` siempre) → 1 fallo.
  assert.match(src, /setAnalizadas\(\(l\) => \(l\.some\(\(a\) => clave\(a\.url\) === clave\(url\)\) \? l : \[\{ url, veredicto: null, score: null \}, \.\.\.l\]\)\);/);
  assert.match(src, /const cerrarDiagnostico = useCallback\(\(\) => setDerecha\(\{ tipo: 'crear' \}\), \[\]\);/, 'onCerrar de identidad fija');
  assert.match(src, /const s = queryDeDerecha\(window\.location\.search, derecha\);\s*if \(s !== window\.location\.search\) window\.history\.replaceState\(/);
  assert.match(src, /const \[derecha, setDerecha\] = useState<Derecha>\(props\.derechaInicial\);/);
  // El Diagnóstico sin landing pide la dirección; el «Ir a» con una dirección ofrece analizarla;
  // las dos van por `analizarUrl`, que abre NUESTRO documento si la URL es nuestra.
  assert.match(src, /if \(derecha\.tipo === 'diagnostico' && !derecha\.docId && !derecha\.url\) \{\s*contenido = <AnalizarUnaPagina onAnalizar=\{analizarUrl\} \/>;/);
  assert.match(src, /\{urlBuscada && \([\s\S]{0,300}onClick=\{\(\) => analizarUrl\(urlBuscada\)\}/);
  assert.match(src, /const analizarUrl = \(url: string\) => \{\s*const propia = docDeUrl\(url, lista, props\.bases\);/);
  // Una plantilla se crea con el config de crear/tipo.ts (una presentación sin formato nacería página).
  assert.match(src, /const usarPlantilla = \(p: PlantillaGaleria\) => void crearYAbrir\(pedidoDePlantilla\(p\)\);/);
});

test('las páginas: el Panel lee las analizadas DESPUÉS del guard y resuelve la derecha; analizar/ sólo redirige', () => {
  const page = sinComentarios(leer(PAGE));
  const guard = page.indexOf("await requireRolWs([], { nav: 'landing-writer' });");
  assert.ok(guard > 0 && page.indexOf('listarAnalizadas()') > guard, 'la lectura corre antes del guard');
  // Tanda 4: las bases las da el server (`basesLandings`), y van a la derecha Y a la pantalla.
  assert.match(page, /const bases = basesLandings\(\);/);
  // Tanda 6: toda la query de la derecha (también `?paso=` y los links viejos de /crear) por `consultaDerecha`.
  assert.match(page, /derechaDeQuery\(consultaDerecha\(sp\), docs, bases\)/);
  assert.match(page, /bases=\{bases\}/);
  assert.match(page, /analizadas=\{analizadas\}/);
  assert.match(page, /derechaInicial=\{derechaInicial\}/);
  const an = sinComentarios(leer(ANALIZAR));
  const g2 = an.indexOf("await requireRolWs([], { nav: 'landing-writer' });");
  assert.ok(g2 > 0 && an.indexOf('redirect(') > g2);
  assert.match(an, /redirect\(await rutaConWs\(destinoAnalizar\(await searchParams\)\)\);/, 'el redirect sin la query o sin el ?ws= de la pestaña');
  assert.doesNotMatch(an, /LandingAnalystApp|getLandingViewData/, 'la ruta volvió a dibujar el diagnóstico (va a la derecha del Panel)');
});

test('server: `listar` (y `duplicar`) traen el formato y la proporción desde config', () => {
  const src = sinComentarios(leer('lib/editor-landing/server.ts'));
  const cols = /const COLS_RESUMEN = '([^']+)';/.exec(src)?.[1] ?? '';
  assert.match(cols, /\bformato:config->>formato\b/);
  assert.match(cols, /\bproporcion:config->>proporcion\b/);
  const ini = src.indexOf('function aResumen(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(cuerpo, /formato: formatoDe\(f\),/);
  assert.match(cuerpo, /proporcion: proporcionDe\(f\),/);
  // Tanda 4: el dominio propio, y SÓLO el verificado (uno pendiente no sirve nada todavía).
  assert.match(cols, /\bdominio, dominio_estado\b/);
  assert.match(cuerpo, /dominio: f\.dominio_estado === 'verificado' && typeof f\.dominio === 'string' && f\.dominio \? f\.dominio : null,/);
});

test('la miniatura de una presentación es la diapositiva: el padre del .gm-doc declara el formato y el cuadro toma su forma', () => {
  const pres = renderToStaticMarkup(createElement(MiniaturaLanding, { tarjeta: null, tema: TEMAS[0], formato: 'presentacion', proporcion: '4:3' }));
  assert.match(pres, /<div class="gp-mini" style="aspect-ratio:4 \/ 3"/);
  assert.match(pres, /<div class="gp-mini-lienzo" data-formato="presentacion" data-proporcion="4:3"><div class="gm-doc/, 'el padre DIRECTO del .gm-doc no declara el formato (css.ts no lo lee)');
  const fluida = renderToStaticMarkup(createElement(MiniaturaLanding, { tarjeta: null, tema: TEMAS[0], formato: 'presentacion', proporcion: 'fluido' }));
  assert.match(fluida, /aspect-ratio:16 \/ 9/);
  assert.match(fluida, /data-proporcion="16:9"/, 'una miniatura necesita un cuadro: «Fluido» se dibuja 16:9');
  const pagina = renderToStaticMarkup(createElement(MiniaturaLanding, { tarjeta: null, tema: TEMAS[0] }));
  assert.match(pagina, /aspect-ratio:16 \/ 10/);
  assert.doesNotMatch(pagina, /data-formato|data-proporcion/);
});

test('ni la pantalla, ni las páginas, ni las reglas tienen voseo (el guard del repo no ve un archivo nuevo sin `git add`)', () => {
  const malas: Record<string, string[]> = {};
  for (const f of [INICIO, PAGE, ANALIZAR, REGLAS, MINI]) {
    const m = marcasDeVoseo(sinComentarios(leer(f)));
    if (m.length) malas[f] = m;
  }
  assert.deepEqual(malas, {});
});

// ── PROBADO ROMPIÉNDOLO (12/10/2026) ─────────────────────────────────────────────────────────
// Una rotura por vez contra la base en verde (20 pass / 0 fail), con un arnés que restaura SÓLO
// lo roto y verifica con md5 (pass / fail, y el test que se pone rojo):
//   1. docDeUrl sin las páginas de la landing (/l/<slug>/gracias)            → 19 / 1 (2)
//   2. filasDelPanel lista las analizadas que son nuestras                    → 19 / 1 (3)
//   3. filasDelPanel con la Papelera en la barra                              → 19 / 1 (3)
//   4. filasDelPanel sin sacar las URLs repetidas                             → 19 / 1 (3)
//   5. derechaDeQuery: una URL nuestra no abre el documento                   → 19 / 1 (8)
//   6. queryDeDerecha no borra la derecha anterior                            → 19 / 1 (9)
//   7. queryDeDerecha pierde el ?ws=                                          → 19 / 1 (9)
//   8. esDiagnosticoDe compara la URL cruda                                   → 19 / 1 (10)
//   9. destinoAnalizar pierde el ?ws= del link                                → 19 / 1 (11)
//  10. destinoAnalizar: la URL manda sobre el id                              → 19 / 1 (11)
//  11. vuelve «Nuevo desde cero» a la pantalla                                → 19 / 1 (12)
//  12. un segundo «Nueva landing» después de la lista                         → 19 / 1 (13)
//      (la primera versión del test daba VERDE: buscaba la PRIMERA aparición; ahora cuenta)
//  13. se va «Archivar» del ⋯                                                 → 19 / 1 (14)
//  14. eliminar desde el ⋯ sin pasar por la Papelera                          → 19 / 1 (15)
//  15. archivar sin Deshacer                                                  → 19 / 1 (15)
//  16. el Diagnóstico sin key por landing                                     → 19 / 1 (16)
//  17. la derecha por default no es la caja de crear                          → 19 / 1 (16)
//  18. analizar/ redirige sin rutaConWs                                       → 19 / 1 (17)
//  19. server: `listar` sin `formato` (lib/editor-landing/server.ts)          → 19 / 1 (18)
//  20. la miniatura sin data-formato en el padre del .gm-doc                  → 19 / 1 (19)
//  21. voseo («Mirá tu landing») en panel-reglas.ts                           → 19 / 1 (20)
//  22. urlDeBusqueda acepta cualquier dominio (también un nombre con punto)   → 19 / 1 (7)
//  23. el Diagnóstico vacío monta el panel sin landing (en vez de la caja)    → 19 / 1 (16)
// Tanda 6 (14/10/2026): dos aserciones de la pantalla cambiaron de forma (la caja recibe `onAccion` y la
// página lee la derecha con `consultaDerecha`); lo nuevo de la derecha lo fija
// tests/editor-landing-crear-panel.test.ts, con sus roturas.
// Restaurado: 20 / 0.
//
// Tanda 4 (14/10/2026, hola-mako.site): base 20 / 0. Rota con el arnés de editor-landing-origen:
//  24. docDeUrl mirando sólo la primera base (hola-mako.com/l/… «de afuera»)  → 17 / 3 «docDeUrl…», «filasDelPanel…», «derechaDeQuery…»
//  25. docDeUrl sin el dominio propio (https://<dominio> «de afuera»)         → 19 / 1 «docDeUrl…»
//  26. aResumen mandando también el dominio PENDIENTE                         → 19 / 1 «server: `listar`…»
