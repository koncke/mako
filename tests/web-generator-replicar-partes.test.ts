// =============================================================================
// Replicar POR PARTES: diseño, estructura, ángulos y texto, y la estructura que no pierde secciones (28/10/2026)
// =============================================================================
// Martín (28/10/2026): «una cosa es replicar el branding, otra cosa es replicar la estructura, otra cosa es replicar los
// ángulos de comunicación, los copies». Lo que fija:
//   1. la estructura de una página leída: se corta en su NIVEL DE SECCIÓN, lo de adentro queda como subtítulo y nunca
//      se pierde un renglón (antes: 20 secciones como mucho y las demás afuera, sin aviso: 100ads.ai perdía 13);
//   2. el molde y la fidelidad: lo que se cuenta de cada sección, en la original y en la réplica;
//   3. las partes: sus dependencias (el texto trae la estructura y los ángulos), el pedido viejo, la copia idéntica;
//   4. lo que lee la IA: la instrucción (reglas primero, con tope), la receta de cada combinación;
//   5. los ángulos: el saneo de lo que devuelve el modelo, y su prompt registrado en /configuraciones;
//   6. los enchufes del server: la ruta, replicar(), la lectura y el esquema importado.
// Correr: node --import tsx --test tests/web-generator-replicar-partes.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';
import {
  acomodoDeSeccion, esquemaDeReplica, fidelidadDeEstructura, imagenesPorSeccion, juntarHasta, moldeDeEsquema, moldeDeSeccion, nivelDeSeccion,
  notaDeSeccion, resumenDeMolde, textoDeMolde,
} from '../lib/editor-landing/replicar-estructura';
import {
  PARTES_ADAPTAR, PARTES_INICIALES, PARTES_TODAS, TOPE_INSTRUCCION, alternarParte, formatoConPartes, instruccionDePartes,
  dominioBase, enlacesDeLaOriginal, marcaDeUrl, mencionesDe, nombreDeCopia, partesDePedido, recetaDePartes, sinDestinoDeBoton, sinEnlacesALaOriginal,
} from '../lib/editor-landing/replicar-partes';
import { ANGULOS_SYSTEM_TEMPLATE, ANGULOS_USER_TEMPLATE, sanearAngulos, seccionesParaAngulos, textoDeAngulos } from '../lib/editor-landing/replicar-angulos';
import { MAX_SECCIONES, esquemaDelPedido, pedidoDeTanda, quitarPruebaDeLaOriginal, slotsDe, tarjetaDesdeEsquema } from '../lib/editor-landing/ia-reglas';
import { configDeReplica } from '../lib/editor-landing/replicar-reglas';
import { copyDeHtml, sinLetrasDobles } from '../lib/landing-extraer';
import { leerEventos, lineaDeEvento, vistaDeEventos } from '../lib/editor-landing/replicar-progreso';
import { ESPERA_FINAL_MS, PINTA_MS, TOPE_PINTURA_MS } from '../lib/editor-landing/replicar-escena';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

/** Una página como la de 100ads.ai, con la forma que la lee el extractor: 1 h1, 12 h2 y 20 h3 (33 títulos). */
function paginaLarga(): string {
  const r: string[] = ['Anuncios para productos digitales', '# 100 anuncios en lo que dura un café.', 'Con tu marca. Listos para testear.', '[BOTÓN] Quiero mi acceso'];
  for (let s = 1; s <= 12; s++) {
    r.push(`## Sección ${s}`, `Párrafo de la sección ${s} con varias palabras adentro.`);
    const tarjetas = s <= 8 ? (s % 2 === 0 ? 3 : 2) : 0;
    for (let t = 1; t <= tarjetas; t++) r.push(`### Tarjeta ${s}.${t}`, `• Viñeta ${s}.${t}`);
  }
  return r.join('\n');
}
const renglones = (t: string) => t.split('\n').filter((l) => l.trim()).length;
const renglonesDe = (e: { secciones: { titulo: string; puntos: string[] }[] }) => e.secciones.reduce((n, s) => n + 1 + s.puntos.length, 0);

// PROBADO ROMPIÉNDOLO (28/10/2026, base 9 / 0, una rotura por vez y restaurado por sha256):
//   R1 esquemaDeReplica vuelve a `esquemaConservado` ............ 6 / 3 (1, 1b, 2)
//   R2 el respaldo sin el subtítulo `###` ......................... 7 / 2 (1c, 2)
//   R3 el texto sin traer la estructura y los ángulos ............. 8 / 1 (3)
//   R4 los datos antes de las reglas en la instrucción ............ 8 / 1 (4)
//   R5 sin el filtro de números de sección en sanearAngulos ....... 8 / 1 (5)
//   R6 el registro del prompt con otra variable ................... 8 / 1 (5b)
//   R7 la ruta sin `partes`, `tema` y `angulos` ................... 8 / 1 (6)
// Y con los tests 0, 2b y 4b (base 10 / 0 y 12 / 0):
//   R8 sin vaciar las cifras ajenas ............................... 9 / 1 (4b)
//   R9 replicar.ts sin `quitarPruebaDeLaOriginal` ................. 9 / 1 (4b)
//   R10 el acomodo sin las tarjetas ............................... 11 / 1 (2b)
//   R11 un string sin cerrar en replicar.ts ....................... 11 / 1 (0)
//   R12 el Diagnóstico sin «Elegir qué replicar…» ................. 11 / 1 (6)
// Y con el 2c (base 13 / 0):
//   R13 la tanda sin la nota ...................................... 12 / 1 (2c)
//   R14 el saneo del pedido tira la nota .......................... 12 / 1 (2c)
//   R15 replicar.ts manda el esquema sin notas .................... 12 / 1 (2b)
// Y con los 10a-10d de la revisión de 45a8e5234 (base 21 / 0):
//   R16 nivelDeSeccion vuelve a «mientras no pase del tope» ....... 20 / 1 (10a)
//   R17 cifraAjena vuelve a comparar por subcadena ................ 20 / 1 (10b)
//   R18 los enlaces: sólo el host exacto, sin subdominios ......... 20 / 1 (10c)
//   R19 replicar.ts sin pasar los enlaces a «#» ................... 20 / 1 (10d)
//   R20 la IA ve el destino de los botones ........................ 20 / 1 (10d)
//   R21 la API lee los ángulos aunque tenga la estructura ......... 20 / 1 (10d)
//   R22 adaptar también en Presentación ........................... 20 / 1 (10d)
//   R23 el texto pegado sin el corte de la página ................. 20 / 1 (10d)
//   R24 ia.ts sin `corte` ......................................... 20 / 1 (6)
//   R25 la «Página web» arranca en las partes de siempre .......... 20 / 1 (10d)
//   R26 la lectura paga los ángulos siempre ....................... 20 / 1 (10d)
//   R27 el «#» sigue abriendo otra pestaña ........................ 20 / 1 (10c)
// Y con el 10e, los destinos de la original fuera de su dominio (base 22 / 0):
//   R28 sin «una dentro de la otra» (la IA acorta el Calendly) .... 21 / 1 (10e)
//   R29 un host pelado alcanza («calendly.com») ................... 21 / 1 (10e)
//   R30 el punto final queda pegado a la dirección ................ 21 / 1 (10e)
//   R31 replicar.ts no le pasa los destinos ....................... 21 / 1 (10d)
test('1. la estructura: se corta en el nivel de sección, lo de adentro queda como subtítulo y no se pierde nada', () => {
  const texto = paginaLarga();
  const h3 = texto.split('\n').filter((l) => l.startsWith('### ')).length;
  assert.ok(1 + 12 + h3 > MAX_SECCIONES, 'la página de prueba pasa el tope si se corta en cada título');
  const e = esquemaDeReplica(texto, 'x');
  assert.equal(e.secciones.length, 13, 'el h1 y los 12 h2');
  // Los renglones: el antetítulo de antes del h1 va adentro de la primera sección, nada se tira.
  assert.equal(renglonesDe(e), renglones(texto));
  assert.equal(e.secciones[0].titulo, '100 anuncios en lo que dura un café.');
  assert.equal(e.secciones[0].puntos[0], 'Anuncios para productos digitales');
  assert.deepEqual(e.secciones[2].puntos, ['Párrafo de la sección 2 con varias palabras adentro.', '### Tarjeta 2.1', '• Viñeta 2.1', '### Tarjeta 2.2', '• Viñeta 2.2', '### Tarjeta 2.3', '• Viñeta 2.3']);
  assert.equal(e.secciones[12].titulo, 'Sección 12', 'la última sección llega');
});

test('1b. el nivel de sección y el tope: si sobran, se juntan las vecinas más chicas, sin tirar texto', () => {
  assert.equal(nivelDeSeccion(['# a', '## b', '## c', '### d']), 2, 'un h1 solo es el hero, y una tarjeta no se suelta aunque sean pocas');
  assert.equal(nivelDeSeccion(['# a', '# b', '# c', '## d', '## e', '## f']), 2, 'h1 en tres bloques: baja a h2');
  assert.equal(nivelDeSeccion(['## a', '## b', '## c', '## d', '### e', '### f']), 2, 'cuatro secciones ya alcanzan: las tarjetas quedan adentro');
  assert.equal(nivelDeSeccion(['texto sin títulos', '# uno']), null);
  // 30 secciones en su nivel: quedan MAX_SECCIONES, con todos los renglones.
  const muchas = Array.from({ length: 30 }, (_, i) => `## S${i + 1}\nTexto ${'x '.repeat(i % 5 === 0 ? 40 : 2)}`).join('\n');
  const e = esquemaDeReplica(muchas, 'x');
  assert.equal(e.secciones.length, MAX_SECCIONES);
  assert.equal(renglonesDe(e), renglones(muchas));
  const j = juntarHasta([{ titulo: 'A', puntos: ['uno dos tres cuatro'] }, { titulo: 'B', puntos: ['b'] }, { titulo: 'C', puntos: ['c'] }], 2);
  assert.deepEqual(j, [{ titulo: 'A', puntos: ['uno dos tres cuatro'] }, { titulo: 'B', puntos: ['b', '### C', 'c'] }], 'se juntan las dos más chicas');
  // Lo pegado por la persona con cortes `---` sigue como siempre.
  assert.equal(esquemaDeReplica('Uno\ntexto\n---\nDos\ntexto', 'x').secciones.length, 2);
});

test('1c. el respaldo sin IA dibuja el subtítulo `###` como título, no como texto', () => {
  const t = tarjetaDesdeEsquema({ titulo: 'Beneficios', puntos: ['### Rápido', 'En minutos.', '### Barato', 'Sin agencia.'] }, false);
  const tipos = (t.content ?? []).map((n) => `${n.type}${n.type === 'heading' ? (n.attrs as { level?: number }).level : ''}`);
  assert.deepEqual(tipos, ['heading2', 'heading3', 'paragraph', 'heading3', 'paragraph']);
  assert.doesNotMatch(JSON.stringify(t), /###/);
});

// Las landings de Martín (28/10/2026): respond.io tenía su megamenú y el selector de idiomas en un `<header class="fixed">`
// sin <nav> (79 renglones en la primera sección); tryholo.ai escribe dos veces cada letra de una animación.
test('1d. el extractor: la barra fija de arriba no es copy, y las letras dobles de una animación vuelven a ser palabras', () => {
  const html = '<body><header class="fixed top-0 z-50"><ul><li>Spanish</li><li>Capture from Ads</li></ul><a class="btn btn-primary" href="/x">Start Free Trial</a></header>'
    + '<main><h1>Customers ask on chat</h1><p>Respond.io unifies all customer touchpoints in one inbox.</p></main></body>';
  const t = copyDeHtml(html).texto;
  assert.doesNotMatch(t, /Spanish|Capture from Ads/, 'el menú de la barra fija no entra');
  assert.match(t, /\[BOTÓN\] Start Free Trial/, 'su botón sí');
  assert.match(t, /^# Customers ask on chat/m);
  // Un <header> que no es fijo puede ser el hero: se lee.
  assert.match(copyDeHtml('<header class="hero"><h1>La portada</h1><p>Un texto de la portada que se lee.</p></header>').texto, /# La portada/);
  assert.equal(sinLetrasDobles('Holo runs your a a d d s s , e e m m a a i i l l , and S S E E O O end to end'), 'Holo runs your ads, email, and SEO end to end');
  assert.equal(sinLetrasDobles('Plan A y B , a la vez'), 'Plan A y B , a la vez', 'sin corridas, igual');
  assert.equal(sinLetrasDobles('la a a b'), 'la a a b', 'un solo par no es una corrida');
});

test('2. el molde de cada sección y la fidelidad de una réplica', () => {
  const m = moldeDeSeccion({ titulo: 'Planes', puntos: ['### Pro', 'Para crecer.', '• Uno', '• Dos', '[BOTÓN] Comprar → https://x.com', '[DESPLEGABLE] ¿Cancelo? → Sí'] });
  assert.deepEqual({ ...m, titulo: '' }, { titulo: '', subtitulos: 1, parrafos: 1, vinetas: 2, botones: 1, desplegables: 1, palabras: 9 });
  assert.equal(resumenDeMolde(m), '1 subtítulo · 1 párrafo · 2 viñetas · 1 botón · 1 pregunta desplegable');
  const e = esquemaDeReplica(paginaLarga(), 'x');
  const moldes = moldeDeEsquema(e);
  assert.match(textoDeMolde(moldes), /^1\. «100 anuncios en lo que dura un café\.»: 2 párrafos · 1 botón \(~/);
  assert.ok(textoDeMolde(moldes, 200).length <= 260, 'con tope, y dice cuántas faltan');
  // La réplica armada desde el mismo esquema tiene la misma estructura.
  const copia = e.secciones.map((s, i) => tarjetaDesdeEsquema(s, i === 0));
  const f = fidelidadDeEstructura(moldes, copia);
  assert.equal(f.secciones.copia, f.secciones.original);
  assert.equal(f.titulos.copia, f.titulos.original);
  assert.equal(f.botones.copia, f.botones.original);
  assert.equal(f.seccionesParejas, e.secciones.length);
  // Una réplica con la mitad de las secciones lo muestra.
  assert.equal(fidelidadDeEstructura(moldes, copia.slice(0, 6)).secciones.copia, 6);
});

test('3. las partes: el texto trae la estructura y los ángulos, nunca quedan las cuatro apagadas', () => {
  assert.deepEqual(PARTES_INICIALES, { diseno: false, estructura: true, angulos: true, texto: false }, 'el caso de Martín');
  const conTexto = alternarParte({ diseno: false, estructura: false, angulos: false, texto: false } as never, 'texto');
  assert.deepEqual(conTexto, { diseno: false, estructura: true, angulos: true, texto: true });
  assert.deepEqual(alternarParte(conTexto, 'estructura'), { diseno: false, estructura: false, angulos: true, texto: false });
  assert.deepEqual(alternarParte(PARTES_TODAS, 'angulos'), { diseno: true, estructura: true, angulos: false, texto: false });
  const sola = { diseno: false, estructura: true, angulos: false, texto: false };
  assert.deepEqual(alternarParte(sola, 'estructura'), sola, 'apagar la última no hace nada');
  // El pedido: sin `partes`, lo de siempre; con `partes`, lo que dice (lista, objeto o texto).
  assert.deepEqual(partesDePedido(undefined), PARTES_TODAS);
  assert.deepEqual(partesDePedido(undefined, true), PARTES_ADAPTAR);
  assert.deepEqual(partesDePedido(['estructura', 'ángulos']), PARTES_INICIALES);
  assert.deepEqual(partesDePedido('diseño, texto'), PARTES_TODAS);
  assert.deepEqual(partesDePedido({ estructura: true, angulos: true }), PARTES_INICIALES);
  assert.equal(partesDePedido([]), null);
  // `partesDePedido(null)` es TODAS (el pedido viejo de la API). Y desde el 28/10/2026 (~09:40, Martín: «Enfocate primero en
  // replicar tal cual») la pantalla arranca SIEMPRE en la copia idéntica: tests/web-generator-copia-identica.test.ts, el 13.
  assert.deepEqual(partesDePedido(null), PARTES_TODAS);
  assert.equal(partesDePedido(['marca']), null);
  // La copia idéntica es TODO.
  assert.equal(formatoConPartes('web', PARTES_TODAS), true);
  assert.equal(formatoConPartes('web', PARTES_ADAPTAR), false);
  assert.equal(formatoConPartes('landing', PARTES_INICIALES), true);
  assert.equal(nombreDeCopia(PARTES_TODAS, 'otra.com', 'Su título'), 'Su título');
  assert.equal(nombreDeCopia(PARTES_ADAPTAR, 'otra.com', 'Su título'), 'Adaptada de otra.com');
  assert.equal(nombreDeCopia(PARTES_INICIALES, 'otra.com', 'Su título'), 'Basada en otra.com');
});

test('2b. cómo está acomodada cada sección: dónde lleva imágenes y si sus subtítulos son tarjetas', () => {
  const m = moldeDeSeccion({ titulo: 'Beneficios', puntos: ['### Rápido', 'a', '### Barato', 'b', '### Fácil', 'c'] });
  assert.equal(acomodoDeSeccion(m, { cantidad: 1, fondo: false }), 'una imagen junto al texto, 3 tarjetas o pasos con su subtítulo');
  assert.equal(acomodoDeSeccion(m, { cantidad: 1, fondo: true }), 'imagen de fondo, 3 tarjetas o pasos con su subtítulo');
  assert.equal(acomodoDeSeccion(moldeDeSeccion({ titulo: 'Logos', puntos: ['x'] }), { cantidad: 6, fondo: false }), '6 imágenes (galería o logos)');
  assert.equal(acomodoDeSeccion(moldeDeSeccion({ titulo: 'Solo', puntos: ['x'] }), null), '');
  // Las imágenes de cada sección de la réplica: las de SUS partes de la original.
  const imgs = imagenesPorSeccion([[0], [1, 2], []], [{ seccion: 0, fondo: true }, { seccion: 2, fondo: false }, { seccion: 2, fondo: false }, { seccion: 5, fondo: false }]);
  assert.deepEqual(imgs, [{ cantidad: 1, fondo: true }, { cantidad: 2, fondo: false }, null]);
  // En el molde, al final de la línea de su sección.
  assert.match(textoDeMolde([m], 1_600, ['una imagen junto al texto']), /^1\. «Beneficios»: 3 subtítulos · 3 párrafos \(~\d+ palabras\); una imagen junto al texto$/);
  // replicar.ts lee el estilo también sin el diseño (sólo para el acomodo), y sin el diseño nada de él pasa a la copia.
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /const usaEstilo = partes\.diseno \|\| \(partes\.estructura && !partes\.texto && recetaFormato\.formato === 'landing'\);/);
  assert.match(rep, /const estilo = partes\.diseno \? estiloLeido : null;/);
  // La nota de cada sección (su ángulo, su forma y su acomodo) viaja CON la sección a su tanda.
  assert.match(rep, /return notaDeSeccion\(m, acomodos\[i\], /);
  assert.match(rep, /pedirSecciones\(\{ esquema: esqTandas, indices, params: receta\.paramsSecciones \?\? params \}\)/);
});

// Medido el 28/10/2026: con el molde y el ángulo de cada sección en la instrucción común (5.000 caracteres, la misma para
// todas las tandas), gohighlevel, leadsales y kommo perdían las últimas secciones. Ahora van con cada sección.
test('2c. la nota de cada sección viaja con ella a su tanda (y sin nota, el pedido es el de siempre)', () => {
  const m = moldeDeSeccion({ titulo: 'Precio', puntos: ['Acceso Pro', '[BOTÓN] Comprar'] });
  const nota = notaDeSeccion(m, 'una imagen junto al texto', 'Precio: plan con garantía');
  assert.equal(nota, 'ángulo: Precio: plan con garantía; forma: 1 párrafo · 1 botón (~4 palabras); acomodo: una imagen junto al texto');
  assert.ok(notaDeSeccion(m, 'x'.repeat(500)).length <= 400);
  const esq = { titulo: 'x', secciones: [{ titulo: 'Hero', puntos: ['a'] }, { titulo: 'Precio', puntos: ['b'], nota }] };
  const conNota = pedidoDeTanda(esq, [1]);
  assert.match(conNota.pedidas, /^\[1\] Precio {2}\(es el CIERRE[^\n]*\n\(Molde de la referencia para esta sección: ángulo: Precio/);
  assert.doesNotMatch(pedidoDeTanda(esq, [0]).pedidas, /Molde/, 'sin nota, como siempre');
  // El saneo del pedido la conserva (la tanda lo pasa por `esquemaDelPedido`), con tope.
  assert.equal(esquemaDelPedido(esq)?.secciones[1].nota, nota);
  assert.equal(esquemaDelPedido({ titulo: 'x', secciones: [{ titulo: 'a', puntos: [], nota: 'n'.repeat(900) }] })?.secciones[0].nota?.length, 400);
  assert.equal('nota' in (esquemaDelPedido(esq)?.secciones[0] ?? {}), false);
});

test('4. la instrucción: reglas primero, datos al final, con tope; y la receta de cada combinación', () => {
  assert.equal(instruccionDePartes(PARTES_TODAS), null, 'con el texto literal no se escribe nada');
  const i = instruccionDePartes(PARTES_INICIALES, { molde: '1. «Hero»: 2 párrafos', angulos: 'Promesa: más ventas' })!;
  assert.match(i, /ESTRUCTURA \(se toma\)/);
  assert.match(i, /ÁNGULOS \(se toman\): en cada sección, el mismo ángulo/);
  assert.match(i, /no copies frases de la referencia/);
  assert.match(i, /ni su marca, ni sus nombres, ni sus testimonios, ni sus cifras/);
  assert.ok(i.indexOf('TEXTO (no se toma)') < i.indexOf('MOLDE de la referencia'), 'las reglas antes que los datos');
  assert.match(instruccionDePartes({ diseno: true, estructura: true, angulos: false, texto: false })!, /ÁNGULOS \(no se toman\): de la referencia usa SOLO la forma/);
  assert.match(instruccionDePartes({ diseno: false, estructura: false, angulos: true, texto: false })!, /ESTRUCTURA \(no se toma\)/);
  // Con el molde y los ángulos más largos, entra en el tope de ia.ts y la regla de no copiar sigue.
  const larga = instruccionDePartes(PARTES_INICIALES, { molde: 'm'.repeat(1_600), angulos: 'a'.repeat(1_600) })!;
  assert.ok(larga.length <= TOPE_INSTRUCCION, `${larga.length} > ${TOPE_INSTRUCCION}`);
  assert.match(larga, /no copies frases/);
  // La receta: el caso de Martín conserva el esquema de la página y escribe las secciones de nuevo.
  const base = configDeReplica('landing', 'https://otra.com').params!;
  const r = recetaDePartes('landing', base, PARTES_INICIALES, { esquema: 'E', secciones: 'S' });
  assert.equal(r.esquema, 'pagina');
  assert.equal(r.paramsEsquema.modoTexto, 'conservar');
  assert.equal(r.paramsSecciones.modoTexto, 'generar');
  assert.equal(r.paramsSecciones.instrucciones, 'S');
  assert.equal(r.paramsSecciones.fuenteImagenes, 'marcadores', 'nunca fotos de stock');
  assert.equal(r.copiaDiseno, false);
  const sinEstructura = recetaDePartes('landing', base, { diseno: true, estructura: false, angulos: true, texto: false }, { esquema: 'E', secciones: 'S' });
  assert.equal(sinEstructura.esquema, 'generar');
  assert.equal(sinEstructura.paramsEsquema.instrucciones, 'E');
  const tal = recetaDePartes('landing', base, PARTES_TODAS);
  assert.equal(tal.paramsSecciones.modoTexto, 'conservar');
  assert.equal(tal.copiaDiseno, true);
  const pres = recetaDePartes('presentacion', configDeReplica('presentacion', 'https://otra.com').params!, PARTES_INICIALES, { esquema: 'E', secciones: 'S' });
  assert.equal(pres.paramsEsquema.modoTexto, 'generar');
  assert.equal(pres.paramsEsquema.formato, 'presentacion');
});

test('5. los ángulos: el saneo de la salida del modelo y su texto para la réplica', () => {
  assert.equal(sanearAngulos(null), null);
  assert.equal(sanearAngulos({ tono: 'cercano' }), null, 'sin promesa ni dolores no es una lectura');
  const a = sanearAngulos({
    promesa: '  100 anuncios en lo que dura un café  ', dolores: ['El anuncio se quema', '', 7, ...Array(10).fill('otro')],
    forma_de_venta: 'Compra directa con garantía', pruebaSocial: ['Testimonios en video'],
    secciones: [{ n: 2, tipo: 'Prueba', angulo: 'Casos por rubro' }, { n: 1, tipo: 'hero', angulo: 'Velocidad' }, { n: 1, tipo: 'x' }, { n: 99, tipo: 'cierre' }, { n: 3, tipo: 'nada' }],
  }, 5)!;
  assert.equal(a.promesa, '100 anuncios en lo que dura un café');
  assert.equal(a.dolores.length, 6);
  assert.equal(a.formaDeVenta, 'Compra directa con garantía', 'acepta el nombre con guion bajo');
  assert.deepEqual(a.secciones, [{ n: 1, tipo: 'hero', angulo: 'Velocidad' }, { n: 2, tipo: 'prueba', angulo: 'Casos por rubro' }, { n: 3, tipo: 'otro', angulo: '' }]);
  const esq = { titulo: 'x', secciones: [{ titulo: 'Portada', puntos: [] }, { titulo: 'Casos', puntos: [] }, { titulo: 'Cierre', puntos: [] }] };
  const sin = textoDeAngulos(a);
  assert.match(sin, /Promesa: 100 anuncios/);
  assert.doesNotMatch(sin, /Ángulo de cada sección/);
  assert.match(textoDeAngulos(a, { esquema: esq, porSeccion: true }), /2\. «Casos» Prueba social: Casos por rubro/);
  assert.ok(textoDeAngulos(a, { tope: 50 }).length <= 50);
  // Lo que se le manda: cada sección con su parte del tope (las del final también llegan).
  const largo = { titulo: 'x', secciones: Array.from({ length: 10 }, (_, k) => ({ titulo: `S${k + 1}`, puntos: ['p '.repeat(2_000)] })) };
  const enviado = seccionesParaAngulos(largo, 6_000);
  assert.match(enviado, /=== SECCIÓN 10: S10 ===/);
  assert.ok(enviado.length < 6_500);
});

test('5b. el prompt de los ángulos está en el registro con SU key, SU default y exactamente SUS slots', () => {
  const reg = fuente('lib/prompt-registry.ts');
  assert.match(reg, /from '\.\/editor-landing\/replicar-angulos';/);
  for (const [key, alias, tpl] of [
    ['landing_editor.angulos.system', 'LANDING_EDITOR_ANGULOS_SYSTEM', ANGULOS_SYSTEM_TEMPLATE],
    ['landing_editor.angulos.user', 'LANDING_EDITOR_ANGULOS_USER', ANGULOS_USER_TEMPLATE],
  ] as const) {
    const i = reg.indexOf(`key: '${key}'`);
    assert.ok(i > 0, `falta ${key}`);
    const fila = reg.slice(i, reg.indexOf('context:', i));
    assert.match(fila, new RegExp(`default: ${alias},`));
    assert.deepEqual([...fila.matchAll(/v\('(\w+)'/g)].map((m) => m[1]).sort(), slotsDe(tpl).sort());
  }
  const lectura = fuente('lib/editor-landing/replicar-lectura.ts');
  assert.match(lectura, /system: \{ key: 'landing_editor\.angulos\.system', tpl: ANGULOS_SYSTEM_TEMPLATE \}/);
  assert.match(lectura, /user: \{ key: 'landing_editor\.angulos\.user', tpl: ANGULOS_USER_TEMPLATE \}/);
  assert.match(lectura, /renderPrompt\(PROMPTS_ANGULOS\.system\.key, PROMPTS_ANGULOS\.system\.tpl, \{ tipos: /);
  assert.match(lectura, /renderPrompt\(PROMPTS_ANGULOS\.user\.key, PROMPTS_ANGULOS\.user\.tpl, \{\s*pagina: [^,]+,\s*contenido: contenidoNoConfiable\(/);
  assert.match(lectura, /feature: FEATURE_GENERAR/, 'la IA del negocio, la misma de crear');
});

test('4b. la réplica escrita de nuevo no se queda con las citas ni las cifras de la original (en código, no en el prompt)', () => {
  const original = 'Literalmente despegó mi facturación, despegó mi negocio. +3.000 marcas que pasaron por 100ads. 3 pasos simples.';
  const item = (valor: string, texto: string) => ({ type: 'optimizadoItem', attrs: { valor }, content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] });
  const t = {
    type: 'tarjeta', content: [
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Literalmente despegó mi facturación, despegó mi negocio.' }] }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[Testimonio real de un cliente tuyo]' }] }] },
      { type: 'optimizado', attrs: { variante: 'numeros-grandes' }, content: [item('+3.000', 'marcas'), item('3', 'pasos'), item('[00]%', 'clientes')] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Literalmente despegó mi facturación, despegó mi negocio y el de cientos.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tu equipo agenda más reuniones con la misma inversión en anuncios.' }] },
    ],
  };
  const r = quitarPruebaDeLaOriginal(t as never, original);
  assert.equal(r.quitados, 2, 'la cita textual y el +3.000');
  assert.equal(r.copiadas, 1, 'la frase igual a la original se cuenta, la nueva no');
  const json = JSON.stringify(r.tarjeta);
  assert.doesNotMatch(json, /"text":"Literalmente despegó mi facturación, despegó mi negocio\."/);
  assert.match(json, /\[Testimonio real de un cliente tuyo\]/, 'el marcador honesto se queda');
  assert.match(json, /"valor":"3"/, '«3 pasos» no es una cifra de nadie');
  assert.match(json, /"valor":"\[00\]%"/);
  assert.match(fuente('lib/editor-landing/replicar.ts'), /const f = quitarPruebaDeLaOriginal\(t, original\);/);
});

// El 28/10/2026 un `'\n'` escrito por un script quedó como un salto de línea DENTRO de un string de replicar.ts: este test
// lee los fuentes como texto y dio verde sobre un archivo que no compilaba (lo cazó tests-afectados, por los que lo importan).
test('0. los archivos de replicar compilan (un test que lee el fuente como texto no lo prueba)', () => {
  for (const f of [
    'lib/editor-landing/replicar.ts', 'lib/editor-landing/replicar-partes.ts', 'lib/editor-landing/replicar-estructura.ts',
    'lib/editor-landing/replicar-angulos.ts', 'lib/editor-landing/replicar-lectura.ts', 'lib/editor-landing/replicar-lectura-tipos.ts',
    'lib/editor-landing/ia-reglas.ts', 'lib/editor-landing/ia.ts', 'app/api/landing-generator/replicar/leer/route.ts',
    'app/web-generator/crear/Replicar.tsx', 'app/web-generator/diagnostico/PanelDiagnostico.tsx',
  ]) {
    assert.doesNotThrow(() => transformSync(readFileSync(join(RAIZ, f), 'utf8'), { loader: f.endsWith('x') ? 'tsx' : 'ts' }), f);
  }
});

test('6. los enchufes: la ruta, replicar(), la lectura y el esquema importado', () => {
  // El Diagnóstico de una de afuera ofrece «Elegir qué replicar…»: abre la lectura y las partes (el Panel, en el clic).
  const dg = fuente('app/web-generator/diagnostico/PanelDiagnostico.tsx');
  assert.match(dg, /<ItemMenu icono="paginas" texto="Elegir qué replicar…" onClick=\{\(\) => \{ setMenuReplicar\(null\); onReplicarPorPartes\(urlPegada\); \}\} \/>/);
  assert.match(fuente('app/web-generator/Inicio.tsx'), /onReplicarPorPartes=\{\(u\) => abrirDerechaEnElClic\(\{ tipo: 'replicar', url: u, auto: true \}\)\}/);
  const ruta = fuente('app/api/landing-generator/replicar/route.ts');
  assert.match(ruta, /partes: body\.partes, tema: body\.tema, angulos: body\.angulos/);
  const leer = fuente('app/api/landing-generator/replicar/leer/route.ts');
  assert.match(leer, /if \(rol !== 'admin'\) return falla\(403/);
  assert.match(leer, /tabEnCapa\('landing-writer'/);
  assert.match(leer, /leerParaReplicar\(\{ url: body\.url, lectura: body\.lectura, texto: body\.texto, conAngulos: body\.angulos !== false \}\)/);
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /const partes = partesDePedido\(p\.partes, p\.adaptar === true\);/);
  assert.match(rep, /if \(!formatoConPartes\(formato, partes\)\) return falla\(ERROR_WEB_PARCIAL, 400, 'landing'\);/);
  assert.match(rep, /!usaEstilo \? Promise\.resolve\(null\)/, 'sin el diseño ni la estructura reescrita no se lee el estilo de la original');
  assert.match(rep, /partes\.diseno \? await temaParaLaCopia\(estilo, url\)/);
  assert.match(rep, /pedirEsquema\(\{ modo: 'generar', prompt: PEDIDO_SIN_ESTRUCTURA, params \}\)/);
  assert.match(rep, /crearLanding\(nombreDeCopia\(partes, hostDe\(url\), esq\.titulo\), contenido, config\)/);
  const ia = fuente('lib/editor-landing/ia.ts');
  assert.match(ia, /p\.modo === 'importar' \|\| p\.corte === 'pagina' \? esquemaDeReplica\(texto, tituloFallback\) : esquemaConservado\(texto, tituloFallback\)/);
});

// AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE» (28/10/2026): la réplica manda una línea por cosa armada.
test('7. en vivo: las líneas del flujo, una línea rota que no rompe, y lo que se dibuja', () => {
  const a = lineaDeEvento({ fase: 'leer' }) + lineaDeEvento({ fase: 'esquema', secciones: ['Hero', 'Precio', 'Cierre'] });
  const corte = a.length - 5;
  const uno = leerEventos('', a.slice(0, corte));
  assert.equal(uno.eventos.length, 1, 'lo que llegó a medias espera al próximo trozo');
  const dos = leerEventos(uno.resto, a.slice(corte) + '{roto\n' + lineaDeEvento({ fase: 'seccion', indice: 2, titulo: 'Cierre' }));
  assert.deepEqual(dos.eventos.map((e) => e.fase), ['esquema', 'seccion'], 'la línea rota se descarta');
  const eventos = [...uno.eventos, ...dos.eventos, { fase: 'seccion', indice: 0, titulo: 'Hero' } as const, { fase: 'seccion', indice: 2, titulo: 'Cierre' } as const];
  const v = vistaDeEventos(eventos);
  assert.equal(v.total, 3);
  assert.deepEqual(v.piezas.map((p) => p.texto), ['Cierre', 'Hero'], 'en el orden en que llegaron, sin repetir');
  assert.deepEqual(v.fases.map((f) => f.estado), ['hecha', 'hecha', 'ahora', 'pendiente']);
  const fin = vistaDeEventos([...eventos, { fase: 'diseno' }, { fase: 'fin', respuesta: { ok: true, id: 9, titulo: 'x', secciones: 3, formato: 'landing' } }]);
  assert.equal(fin.terminado, true);
  assert.deepEqual(fin.fases.map((f) => f.estado), ['hecha', 'hecha', 'hecha', 'hecha']);
  const mal = vistaDeEventos([{ fase: 'leer' }, { fase: 'fin', respuesta: { ok: false, error: 'x' } }]);
  assert.equal(mal.fallo, true);
  assert.deepEqual(mal.fases.map((f) => f.estado), ['fallo', 'pendiente', 'pendiente', 'pendiente']);
  // La pantalla replica en vivo y abre el editor cuando YA se vio todo.
  const pantalla = fuente('app/web-generator/crear/Replicar.tsx');
  assert.match(pantalla, /const \{ estado, eventos, lista, replicar \} = useReplicarEnVivo\(\);/);
  // 9/11/2026 (el reel de Web Replicate): la espera dejó de ser 600 ms fijos. Lo que se cuida es que el editor se abra
  // DESPUÉS de que se vio todo (por `onTodoVisible`), y que esa espera alcance para que termine de pintarse el diseño sin
  // pasar de unos segundos.
  assert.match(pantalla, /onTodoVisible=\{\(\) => setTimeout\(abrirCopia, ESPERA_FINAL_MS\)\}/, 'el editor se abre cuando ya se vio todo');
  assert.ok(ESPERA_FINAL_MS >= TOPE_PINTURA_MS + PINTA_MS, `la espera (${ESPERA_FINAL_MS} ms) deja terminar la pintura del diseño`);
  assert.ok(ESPERA_FINAL_MS <= 5_000, `segundos, no minutos (${ESPERA_FINAL_MS} ms)`);
  assert.match(pantalla, /enVivo: true/);
});

// Medido el 28/10/2026 en el ws9: con el perfil del negocio vacío, la réplica «adaptada» seguía hablando de la competencia
// (Reportei nombrada 11 veces, respond.io 22). La oferta manda, la marca de la otra no se nombra, y lo que quede se cuenta.
test('8. «Tu oferta» manda, la marca de la referencia no se nombra y sus menciones se cuentan', () => {
  assert.equal(marcaDeUrl('https://tryholo.ai/'), 'Holo', 'sin el «try» del producto');
  assert.equal(marcaDeUrl('https://www.reportei.com/es/'), 'Reportei');
  assert.equal(marcaDeUrl('https://masterads.ai/mkt/register'), 'Masterads');
  assert.equal(marcaDeUrl('https://ab.co/'), null);
  assert.equal(mencionesDe('Con Reportei, REPORTEI.com y reporteis', 'Reportei'), 3);
  assert.equal(mencionesDe('Master Ads te ayuda; masterads.ai también', 'Masterads'), 2, 'separada o junta');
  assert.equal(mencionesDe('Con Reportei', null), 0);
  const i = instruccionDePartes(PARTES_INICIALES, { oferta: 'Mentoría de 8 semanas para agencias; US$997.', marca: 'Reportei', angulos: 'Promesa: x' })!;
  assert.ok(i.indexOf('LA OFERTA DE ESTE NEGOCIO') < i.indexOf('TEXTO (no se toma)'), 'la oferta va entre las reglas, antes de los datos');
  assert.match(i, /La referencia es «Reportei»: no la nombres/);
  assert.doesNotMatch(instruccionDePartes(PARTES_INICIALES)!, /\n\n\n|OFERTA DE ESTE|La referencia es/, 'sin oferta ni marca, sin renglones vacíos');
  assert.ok(instruccionDePartes(PARTES_INICIALES, { oferta: 'x'.repeat(5_000) })!.length <= TOPE_INSTRUCCION);
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /instruccionDePartes\(partes, \{ angulos: angulos \? textoDeAngulos\(angulos\) : undefined, oferta: entrada\.oferta, marca: marca \?\? undefined \}\)/);
  assert.match(rep, /const menciones = partes\.texto \? 0 : mencionesDe\(/);
  assert.match(fuente('lib/editor-landing/replicar-lectura.ts'), /tieneOferta: perfil\.replace\(/, 'la lectura dice si el negocio tiene la oferta cargada');
  const pantalla = fuente('app/web-generator/crear/Replicar.tsx');
  assert.match(pantalla, /\{lectura\.lectura\.tieneOferta === false && !oferta\.trim\(\) && \(/);
  assert.match(pantalla, /\.\.\.\(tuOferta \? \{ oferta: tuOferta \} : \{\}\),/);
});

test('9. en vivo: la ruta manda el flujo y replicar.ts avisa lo que armó, sin frenar el trabajo', () => {
  const ruta = fuente('app/api/landing-generator/replicar/route.ts');
  assert.match(ruta, /if \(body\.enVivo === true\) \{/);
  assert.match(ruta, /'Content-Type': 'application\/x-ndjson; charset=utf-8'/);
  assert.match(ruta, /enviar\(\{ fase: 'fin', respuesta \}\);\s*ctrl\.close\(\);/, 'la última línea es la respuesta de siempre');
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /const avisar = \(e: EventoReplica\) => \{ try \{ alProgreso\?\.\(e\); \} catch \{/, 'un error al avisar no corta la réplica');
  assert.match(rep, /avisar\(\{ fase: 'esquema', secciones: esq\.secciones\.map\(\(s\) => s\.titulo\) \}\);/);
  assert.match(rep, /porIndice\.set\(indices\[k\], t\); avisar\(\{ fase: 'seccion', indice: indices\[k\]/, 'una sección se avisa cuando su tanda VOLVIÓ');
  assert.match(rep, /avisar\(\{ fase: 'seccion', indice: i, titulo: s\.titulo, respaldo: true \}\);/);
});

// La revisión adversarial de 45a8e5234 (Cerebro, 28/10/2026, C:/dev/revisiones/2810-replicar-45a8e5234.md): sus siete
// defectos, cada uno con su caso.
test('10a. dos o tres h1 con muchos h2 no colapsan la página en dos secciones (revisión, 1)', () => {
  // Webflow o Framer: un h1 en el hero y otro en el cierre. Con 19 h2 o más, el corte se quedaba en h1: 2 secciones.
  for (const [h1, h2] of [[2, 20], [3, 25], [2, 19]] as const) {
    const r: string[] = ['# Hero de la página', 'Bajada del hero.'];
    for (let i = 1; i <= h2; i++) r.push(`## Sección ${i}`, `Párrafo de la sección ${i}.`);
    for (let i = 2; i <= h1; i++) r.push(`# Cierre ${i}`, 'Último empujón.');
    const texto = r.join('\n');
    assert.equal(nivelDeSeccion(texto.split('\n')), 2, `${h1} h1 + ${h2} h2: el nivel es h2`);
    const e = esquemaDeReplica(texto, 'x');
    assert.equal(e.secciones.length, MAX_SECCIONES, `${h1} h1 + ${h2} h2: tantas secciones como entran`);
    assert.equal(renglonesDe(e), renglones(texto), 'sin tirar un renglón');
    assert.match(JSON.stringify(e.secciones.at(-1)), new RegExp(`Cierre ${h1}`), 'el cierre llega');
  }
  // El caso que ya andaba sigue igual: un h1 solo es el hero.
  assert.equal(nivelDeSeccion(['# a', '## b', '## c', '### d']), 2);
});

test('10b. las cifras de la original se comparan como números enteros, no como pedazos (revisión, 2)', () => {
  const original = 'Más de 2.100 agencias y 41.450 reportes enviados. Soporte 24 horas, 7 días. Desde $100.000 por mes.';
  const item = (valor: string) => ({ type: 'optimizadoItem', attrs: { valor }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] });
  const valores = ['100%', '+500', '24/7', '8 semanas', '+2.100', '41.450', '1000+'];
  const t = { type: 'tarjeta', content: [{ type: 'optimizado', attrs: { variante: 'numeros-grandes' }, content: valores.map(item) }] };
  const r = quitarPruebaDeLaOriginal(t as never, original);
  const quedan = (r.tarjeta.content?.[0].content ?? []).map((n) => n.attrs?.valor);
  assert.deepEqual(quedan, ['100%', '+500', '24/7', '8 semanas', '', '', '1000+'], 'sólo se vacían las cifras de la otra');
  assert.equal(r.quitados, 2);
});

test('10c. la copia escrita para el negocio no manda a la página de la original (revisión, 3)', () => {
  assert.equal(dominioBase('https://www.competidor.com/es'), 'competidor.com');
  assert.equal(dominioBase('app.competidor.com'), 'competidor.com');
  assert.equal(dominioBase('https://www.tienda.com.ar/x'), 'tienda.com.ar');
  assert.equal(dominioBase('no es una url'), '');
  // La IA no ve a dónde llevaba el botón; un renglón que no es botón queda igual.
  assert.equal(sinDestinoDeBoton('[BOTÓN] Probar gratis → https://app.competidor.com/signup'), '[BOTÓN] Probar gratis');
  assert.equal(sinDestinoDeBoton('[BOTÓN] Ver planes'), '[BOTÓN] Ver planes');
  assert.equal(sinDestinoDeBoton('Antes → después'), 'Antes → después');
  // El respaldo sin IA armaba el botón con el destino ajeno.
  const respaldo = tarjetaDesdeEsquema({ titulo: 'Empieza', puntos: ['[BOTÓN] Probar gratis → https://app.competidor.com/signup', '[BOTÓN] Agenda → https://calendly.com/mi-negocio'] }, false);
  const texto = { type: 'paragraph', content: [{ type: 'text', text: 'precios', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://competidor.com/precios' } }] }, { type: 'text', text: 'ancla', marks: [{ type: 'link', attrs: { href: '#planes' } }] }] };
  const t = { ...respaldo, content: [...(respaldo.content ?? []), texto] };
  const r = sinEnlacesALaOriginal(t, 'https://www.competidor.com/es');
  assert.equal(r.cambiados, 2, 'el botón al signup y el enlace del texto');
  const json = JSON.stringify(r.tarjeta);
  assert.doesNotMatch(json, /competidor\.com/);
  assert.match(json, /"href":"https:\/\/calendly\.com\/mi-negocio"/, 'lo que no es de la original se queda');
  assert.match(json, /"href":"#planes"/);
  assert.match(json, /"href":"#","variante":"primario","nuevaPestana":false/, 'un «#» no abre otra pestaña');
  assert.match(JSON.stringify(t), /app\.competidor\.com\/signup/, 'puro: no toca la tarjeta que recibe');
});

test('10d. los enchufes de la revisión: la API no paga ángulos que no usa, Presentación, el texto pegado, la «Página web» (4 a 7)', () => {
  const rep = fuente('lib/editor-landing/replicar.ts');
  // 4. Con la estructura, el esquema no usa los ángulos: no se leen antes de él (la API no trae la lectura).
  assert.match(rep, /angulos = sanearAngulos\(entrada\.angulos\);\n\s*if \(!angulos && !partes\.estructura\) \{/);
  // 5. `adaptar` (el chequeo de lo copiado y el aviso de «el texto de la original») sólo con las mismas secciones.
  assert.match(rep, /\.\.\.\(mismasSecciones && !partes\.texto \? \{ adaptar: true as const \} : \{\}\),/);
  // 3. La IA no ve el destino, y los enlaces a la original pasan a «#» en todas las tarjetas, las de respaldo también.
  assert.match(rep, /\.\.\.\(partes\.texto \? \{\} : \{ puntos: s\.puntos\.map\(sinDestinoDeBoton\) \}\),/);
  // 13/11/2026: el paso se llama `sinEnlacesAjenos` (después viene el botón por sección); la regla es la misma.
  assert.match(rep, /const sinEnlacesAjenos = partes\.texto \? tarjetasCrudas : tarjetasCrudas\.map\(\(t\) => \{\r?\n\s*const r = sinEnlacesALaOriginal\(t, url, destinosOriginal\);/);
  assert.match(rep, /const destinosOriginal = mismasSecciones && !partes\.texto \? enlacesDeLaOriginal\(esq\.secciones\.flatMap\(\(s\) => s\.puntos\)\.join\('\\n'\)\) : new Set<string>\(\);/);
  // 6. El texto pegado se corta como la lectura que vio la persona.
  assert.match(rep, /pedirEsquema\(\{ modo: 'pegar', texto: entrada\.texto, params, corte: 'pagina' \}\)/);
  // 7. La «Página web» de la caja: arranca con todo y la lectura no paga los ángulos.
  const pantalla = fuente('app/web-generator/crear/Replicar.tsx');
  // (la copia idéntica: desde el 28/10/2026 la pantalla arranca siempre con las cuatro partes y lee sin ángulos con ellas)
  assert.match(pantalla, /useState<PartesReplica>\(\(\) => \(adaptarInicial \? PARTES_ADAPTAR : PARTES_TODAS\)\)/);
  // La línea que lee (no la literal: el 4/11/2026, ticket #54, sumó lo elegido para el borrador): con la ventana del clic y,
  // con las cuatro partes, sin pagar los ángulos.
  const leePagina = pantalla.split('\n').find((l) => l.includes('void leer(u, { ventana')) ?? '';
  assert.match(leePagina, /\.\.\.\(sonTodas\(partesVivas\.current\) \? \{ sinAngulos: true \} : \{\}\)/, 'la copia idéntica lee sin pagar los ángulos');
  assert.match(pantalla, /\.\.\.\(sinAngulos \? \{ angulos: false \} : \{\}\)/);
  assert.match(fuente('lib/editor-landing/replicar-lectura.ts'), /p\.conAngulos === false \? Promise\.resolve\(\{ angulos: null \}\) : angulosDePagina\(esq, t\.url\)/);
});

test('10e. tampoco a la agenda ni al WhatsApp de la original, aunque no sean de su dominio (revisión, 3)', () => {
  const original = [
    '[BOTÓN] Agenda una demo → https://calendly.com/competidor/30min?utm_source=web',
    '[BOTÓN] Escríbenos → https://wa.me/5491112345678?text=hola.',
    'Míranos en https://www.youtube.com/@competidor.',
  ].join('\n');
  assert.deepEqual([...enlacesDeLaOriginal(original)].sort(), ['calendly.com/competidor/30min', 'wa.me/5491112345678', 'youtube.com/@competidor']);
  const boton = (href: string) => ({ type: 'boton', attrs: { href, variante: 'primario', nuevaPestana: true }, content: [{ type: 'text', text: 'x' }] });
  const hrefs = [
    'https://calendly.com/competidor', // la IA lo vio en «[CALENDARIO]» y lo acortó: es de la original
    'https://calendly.com/competidor/30min?utm_source=copia', // el del respaldo, con otra consulta
    'https://wa.me/5491112345678',
    'https://www.youtube.com/@competidor/',
    'https://calendly.com/mi-negocio', // el del negocio: se queda
    'https://calendly.com', // un host pelado no es de nadie
    'https://wa.me/5491199999999', // otro número: se queda
  ];
  const t = { type: 'tarjeta', content: [{ type: 'botones', content: hrefs.map(boton) }] };
  const r = sinEnlacesALaOriginal(t as never, 'https://competidor.com', enlacesDeLaOriginal(original));
  assert.equal(r.cambiados, 4);
  assert.deepEqual((r.tarjeta.content?.[0].content ?? []).map((n) => n.attrs?.href), ['#', '#', '#', '#', 'https://calendly.com/mi-negocio', 'https://calendly.com', 'https://wa.me/5491199999999']);
  // Sin los destinos queda la regla del dominio sola: ninguno de éstos es de «competidor.com».
  assert.equal(sinEnlacesALaOriginal(t as never, 'https://competidor.com').cambiados, 0);
});
