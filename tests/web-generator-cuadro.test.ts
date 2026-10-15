// =============================================================================
// web-generator-cuadro — el cuadro «¿Qué vas a crear hoy?» con MODOS (tanda 7 del Web Generator, 15/10/2026)
// =============================================================================
// Feedback de Martín sobre la tanda 6, textual (puntos 2 a 7):
//   «2. Las 5 opciones abajo del título "¿Qué vas a crear hoy?".
//    3. Cuando le doy click a una opción, lo que debe cambiar es el recuadro de chat de abajo, no redireccionarme a
//       otro lugar.
//    4. No entiendo la diferencia entre las 2 primeras... Si tu tampoco ves diferencia entre esas 2, elimina y
//       conserva la de "Generar desde una idea".
//    5. Cuando vayas reemplazando el bloque de texto que está hoy en día, no quiero que desaparezca el diseño de ese
//       recuadro, quiero que se mantenga igual... […] Tampoco quiero el botón de "aleatorio"... Todas las opciones como
//       "Español México, la cantidad de secciones, el CTA de Agendar reunión u otros, etc... Deben ir dentro de + o en
//       algún desplegable así...
//    6. Si elijo "Importar" simplemente el cuadro de texto se transforma en un contenedor de importación típico […] Y
//       ya por defecto el cuadro de texto en cualquier estado debe admitir un arrastre de archivo […]
//    7. Y para las opciones de link, lo mismo que lo anterior […] esos son chips del texto... Pero si le doy a borrar,
//       se deben borrar. O si quiero seguir escribiendo luego de pegar eso.»
//
// Lo PURO (qué modo queda, el umbral del texto largo, el link a chips y su borrado, qué se manda en cada modo, la URL
// de cada modo) se EJECUTA (app/web-generator/crear/caja-modos.ts, crear/ajustes.ts, panel-reglas.ts). El cuadro se
// DIBUJA en sus cuatro modos con renderToStaticMarkup. Y lo que no es puro (que las pantallas usen esas funciones, que
// /automations no cambie) se fija leyendo el fuente SIN comentarios y extrayendo el bloque antes de buscar.
//
// PROBADO ROMPIÉNDOLO (15/10/2026): al pie, con números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OPCIONES_MODO, TEXTO_LARGO_CARACTERES, TEXTO_LARGO_RENGLONES, alEnviar, alEscribir, avisoDeTexto, borrarAlInicio, cajaDeSemilla, cajaVacia,
  conArchivo, conLink, elegirModo, esTextoLargo, linkSoltado, listoParaEnviar, muestraTuTexto, placeholderDe, quitarArchivo, quitarLink,
  tipoDeArchivo, vistaDeCaja, type ArchivoCaja, type ComoGenerar, type EstadoCaja,
} from '../app/web-generator/crear/caja-modos';
import { MODOS_TEXTO, instruccionesConArchivo, paramsIniciales } from '../app/web-generator/crear/ajustes';
import {
  consultaDerecha, derechaDeAccion, derechaDeCaja, derechaDeQuery, derechaDeVuelta, modoCajaDe, queryDeDerecha, type Derecha,
} from '../app/web-generator/panel-reglas';
import { aceptaArrastre } from '../app/web-generator/CajaPedido';
import CajaCrear from '../app/web-generator/CajaCrear';
import { PARAMS_DEFAULT, MAX_INSTRUCCIONES } from '../lib/editor-landing/ia-reglas';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (rel: string) => sinComentarios(leer(rel));
/** El bloque entre `desde` y `hasta` (lo que se busca, se busca ADENTRO de él). */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde.slice(0, 60)}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta.slice(0, 40)}»`);
  return src.slice(i, j + hasta.length);
};

const como = (c: Partial<ComoGenerar> = {}): ComoGenerar => ({ tipo: 'landing', modo: 'plan', params: { ...PARAMS_DEFAULT }, ...c });
const leido = (nombre = 'propuesta.pdf', texto = 'El texto del archivo'): ArchivoCaja => ({ nombre, imagen: false, estado: 'listo', texto });
const largo = 'Notas de la oferta. '.repeat(30);

// ── 2, 3 y 4 · Los modos ─────────────────────────────────────────────────────────────────────────

test('los modos: Generar · Importar · Analizar landing · Replicar landing (sin «Pegar texto»), Generar por default', () => {
  assert.deepEqual(OPCIONES_MODO.map((o) => o.titulo), ['Generar', 'Importar', 'Analizar landing', 'Replicar landing']);
  assert.equal(cajaVacia().modo, 'generar');
  for (const o of OPCIONES_MODO) assert.deepEqual(marcasDeVoseo(o.titulo), [], o.titulo);
  // Lo que se VE en cada modo, con el cuadro vacío: el texto, el contenedor de importar, el del link.
  assert.deepEqual(OPCIONES_MODO.map((o) => vistaDeCaja(cajaVacia(o.id))), ['texto', 'importar', 'link', 'link']);
});

test('elegir un modo cambia el cuadro y NO toca lo escrito (a lo sumo lo tapa el contenedor, y vuelve)', () => {
  const escrito: EstadoCaja = { ...cajaVacia(), texto: 'Una landing para dentistas' };
  for (const m of ['importar', 'analizar', 'replicar', 'generar'] as const) {
    assert.equal(elegirModo(escrito, m).texto, 'Una landing para dentistas', m);
    assert.equal(elegirModo(escrito, m).modo, m);
  }
  assert.equal(vistaDeCaja(elegirModo(escrito, 'analizar')), 'link', 'Analizar sin link: el contenedor del link');
  assert.equal(vistaDeCaja(elegirModo(elegirModo(escrito, 'analizar'), 'generar')), 'texto', 'y al volver, el texto sigue ahí');
  // Con un link: el modo es su pastilla (Analiza ⇄ Replica); Generar lo deja de referencia; Importar también.
  const conL = conLink(cajaVacia(), 'https://otra.com/oferta');
  assert.deepEqual(conL.link, { url: 'https://otra.com/oferta', accion: 'analizar', formato: 'landing' });
  assert.equal(conL.modo, 'analizar');
  assert.equal(elegirModo(conL, 'replicar').link?.accion, 'replicar');
  assert.equal(elegirModo(conL, 'generar').link?.accion, null, 'Generar: el link queda como referencia del pedido');
  assert.equal(vistaDeCaja(elegirModo(conL, 'generar')), 'texto');
  // Con un archivo: Generar, Analizar o Replicar lo sueltan (no leen un archivo); Importar lo deja.
  const conA = conArchivo(cajaVacia('importar'), leido());
  assert.equal(conA.modo, 'importar');
  assert.equal(vistaDeCaja(conA), 'texto', 'con el archivo, vuelve al texto (con su miniatura)');
  for (const m of ['generar', 'analizar', 'replicar'] as const) assert.equal(elegirModo(conA, m).archivo, null, m);
  assert.ok(elegirModo(conA, 'importar').archivo);
});

// ── 5 · El texto largo y «Tu texto» ──────────────────────────────────────────────────────────────

test('el umbral del texto largo: 500 caracteres o 5 renglones con algo (un pedido largo no es un texto)', () => {
  assert.equal(TEXTO_LARGO_CARACTERES, 500);
  assert.equal(TEXTO_LARGO_RENGLONES, 5);
  assert.equal(esTextoLargo('a'.repeat(499)), false);
  assert.equal(esTextoLargo('a'.repeat(500)), true);
  assert.equal(esTextoLargo(`  ${'a'.repeat(499)}  `), false, 'los espacios de los bordes no cuentan');
  assert.equal(esTextoLargo('Hero\nBeneficios\nPrecio\nGarantía'), false);
  assert.equal(esTextoLargo('Hero\nBeneficios\nPrecio\nGarantía\nPreguntas'), true, 'un esquema pegado es contenido aunque sea corto');
  assert.equal(esTextoLargo('Hero\n\n\nBeneficios\n\n\nPrecio\n\n'), false, 'los renglones vacíos no cuentan');
  // El ejemplo más largo del cuadro y un pedido detallado quedan como pedido.
  assert.equal(esTextoLargo('Una landing para agendar una llamada de diagnóstico gratis, para dueños de clínicas dentales, en tono cercano'), false);
});

test('«Tu texto» aparece SOLA con un texto largo o un archivo (y no con una acción de link); sus valores son los del server', () => {
  assert.deepEqual(MODOS_TEXTO.map((m) => [m.valor, m.texto]), [['generar', 'Usar de guía'], ['condensar', 'Resumir'], ['conservar', 'Tal cual']]);
  assert.equal(muestraTuTexto({ ...cajaVacia(), texto: 'corto' }), false);
  assert.equal(muestraTuTexto({ ...cajaVacia(), texto: largo }), true);
  assert.equal(muestraTuTexto(conArchivo(cajaVacia(), leido())), true);
  assert.equal(muestraTuTexto({ ...conLink(cajaVacia(), 'https://otra.com'), texto: largo }), false, 'Analizar no usa el texto');
});

// ── 7 · El link como chips, y borrarlos ──────────────────────────────────────────────────────────

test('pegar un link SOLO lo vuelve chips (Analiza por default, Replica en Replicar); con texto al lado queda en el texto', () => {
  const g = alEscribir(cajaVacia(), 'https://mi-landing.com/oferta?utm_source=fb');
  assert.deepEqual(g.link, { url: 'https://mi-landing.com/oferta?utm_source=fb', accion: 'analizar', formato: 'landing' });
  assert.equal(g.texto, '');
  assert.equal(g.modo, 'analizar');
  assert.equal(alEscribir(cajaVacia('replicar'), 'https://otra.com').link?.accion, 'replicar');
  // Tipeando, a medio link: no.
  assert.equal(alEscribir({ ...cajaVacia(), texto: 'https://mi-lan' }, 'https://mi-land').link, null);
  // Con texto al lado, todo queda en el texto (va como pedido a Generar: lo escrito no se esconde).
  const frase = alEscribir(cajaVacia(), 'hazme una como https://x.com pero para dentistas');
  assert.equal(frase.link, null);
  assert.equal(frase.texto, 'hazme una como https://x.com pero para dentistas');
  // Con un archivo, el link pegado son instrucciones del archivo.
  assert.equal(alEscribir(conArchivo(cajaVacia(), leido()), 'https://x.com').link, null);
  // Y después de los chips se sigue escribiendo: el texto es del campo.
  assert.equal(alEscribir(g, 'mira el precio').texto, 'mira el precio');
  assert.ok(alEscribir(g, 'mira el precio').link, 'escribir no se lleva el chip');
});

test('Backspace al principio: primero la pastilla, después el link; se queda en el texto y lo escrito no se toca', () => {
  const e: EstadoCaja = { ...elegirModo(conLink(cajaVacia('analizar'), 'https://otra.com'), 'replicar'), texto: 'algo' };
  const uno = borrarAlInicio(e);
  assert.ok(uno);
  assert.deepEqual(uno.link, { url: 'https://otra.com', accion: null, formato: 'landing' }, 'la pastilla (con su formato) primero');
  assert.equal(uno.modo, 'generar', 'sin pastilla, el link es una referencia del pedido');
  const dos = borrarAlInicio(uno);
  assert.ok(dos);
  assert.equal(dos.link, null, 'después el link');
  assert.equal(dos.modo, 'generar');
  assert.equal(vistaDeCaja(dos), 'texto', 'el contenedor no salta debajo del cursor');
  assert.equal(dos.texto, 'algo');
  assert.equal(borrarAlInicio(dos), null, 'sin chips, Backspace es el del campo');
});

test('la ✕ del link o del archivo: con algo escrito vuelve al texto; si no, a donde estaba', () => {
  const desdeAnalizar = conLink(cajaVacia('analizar'), 'https://otra.com');
  assert.equal(vistaDeCaja(quitarLink(desdeAnalizar)), 'link', 'vacío: el contenedor para pegar otro');
  assert.equal(quitarLink({ ...desdeAnalizar, texto: 'algo' }).modo, 'generar', 'con texto: el texto, a la vista');
  assert.equal(quitarLink(alEscribir(cajaVacia(), 'https://otra.com')).modo, 'generar', 'pegado en Generar: vuelve a Generar');
  const desdeImportar = conArchivo(cajaVacia('importar'), leido());
  assert.equal(vistaDeCaja(quitarArchivo(desdeImportar)), 'importar', 'vacío: el contenedor de importar');
  assert.equal(quitarArchivo(conArchivo(cajaVacia(), leido())).modo, 'generar', 'adjuntado desde Generar: vuelve a Generar');
  assert.equal(quitarArchivo({ ...desdeImportar, texto: 'algo' }).modo, 'generar');
});

test('lo arrastrado: la text/uri-list (sin sus comentarios) o un texto que es SÓLO un link; lo demás sigue al navegador', () => {
  assert.equal(linkSoltado('# un comentario\r\nhttps://otra.com/oferta\r\n', ''), 'https://otra.com/oferta');
  assert.equal(linkSoltado('', 'https://otra.com/x.'), 'https://otra.com/x');
  assert.equal(linkSoltado('', 'hola mundo'), null);
  assert.equal(linkSoltado('javascript:alert(1)', ''), null);
  assert.equal(linkSoltado('file:///C:/x.html', 'texto suelto'), null);
  assert.equal(aceptaArrastre(['Files']), true);
  assert.equal(aceptaArrastre(['text/uri-list', 'text/plain']), true);
  assert.equal(aceptaArrastre(['application/x-moz-nativeimage']), false);
  // Soltar un link con un archivo puesto: va al texto (son sus instrucciones), no pisa nada.
  const conA = conArchivo(cajaVacia(), leido());
  assert.equal(conLink(conA, 'https://otra.com').texto, 'https://otra.com');
  assert.ok(conLink(conA, 'https://otra.com').archivo);
});

// ── Qué se manda en cada modo ────────────────────────────────────────────────────────────────────

test('alEnviar (se EJECUTA): Analizar y Replicar mandan el link (y el formato); lo escrito al lado se AVISA', () => {
  const a = conLink(cajaVacia(), 'https://otra.com/oferta');
  assert.deepEqual(alEnviar(a, como()), { que: 'accion', accion: { que: 'analizar', url: 'https://otra.com/oferta' } });
  const r = { ...elegirModo(a, 'replicar'), link: { url: 'https://otra.com/oferta', accion: 'replicar' as const, formato: 'presentacion' as const } };
  assert.deepEqual(alEnviar(r, como()), { que: 'accion', accion: { que: 'replicar', url: 'https://otra.com/oferta', formato: 'presentacion' } });
  // Lo escrito al lado no viaja (no lo aceptan) y la pantalla lo dice ANTES de mandar.
  assert.equal(avisoDeTexto({ ...a, texto: 'para dentistas' }), 'Analizar no usa tu texto.');
  assert.equal(avisoDeTexto({ ...r, texto: 'para dentistas' }), 'Replicar no usa tu texto.');
  assert.equal(avisoDeTexto(a), null);
  assert.equal(avisoDeTexto({ ...borrarAlInicio(a)!, texto: 'para dentistas' }), null, 'de referencia, sí viaja: no hay aviso');
  assert.equal(placeholderDe(a), 'Listo para analizar');
});

test('alEnviar (se EJECUTA): el pedido corto a Generar, el texto largo como texto, el archivo con sus instrucciones, y los ajustes siempre', () => {
  const params = { ...PARAMS_DEFAULT, cantidad: 5, idioma: 'en-US', objetivo: 'vender' as const, modoTexto: 'conservar' as const };
  const c = como({ modo: 'express', params, tipo: 'presentacion' });
  assert.deepEqual(alEnviar({ ...cajaVacia(), texto: '  Una landing para dentistas  ' }, c),
    { que: 'accion', accion: { que: 'ia', tipo: 'presentacion', arranque: { modo: 'express', params, prompt: 'Una landing para dentistas' } } });
  // Largo (ex «Pegar texto»): va como texto, con «Tu texto» en los params.
  const r = alEnviar({ ...cajaVacia(), texto: largo }, c);
  assert.equal(r.que, 'accion');
  assert.deepEqual(r.que === 'accion' && r.accion.que === 'ia' ? r.accion.arranque : null, { modo: 'express', params, texto: largo.trim() });
  // Un archivo leído: su texto, y lo escrito (con el link de referencia adelante) como instrucciones.
  const conA = { ...conArchivo(borrarAlInicio(conLink(cajaVacia(), 'https://ref.com/x'))!, leido()), texto: 'hazla corta' };
  assert.deepEqual(alEnviar(conA, c), {
    que: 'accion',
    accion: { que: 'ia', tipo: 'presentacion', arranque: { modo: 'express', params, prompt: 'https://ref.com/x hazla corta', archivo: { nombre: 'propuesta.pdf', texto: 'El texto del archivo' } } },
  });
  // Mientras se lee (o si no se pudo), nada.
  assert.deepEqual(alEnviar(conArchivo(cajaVacia(), { nombre: 'a.pdf', imagen: false, estado: 'leyendo' }), c), { que: 'nada' });
  assert.equal(listoParaEnviar(conArchivo(cajaVacia(), { nombre: 'a.pdf', imagen: false, estado: 'error' })), false);
  // Un link de referencia y un pedido corto: el link adelante del pedido.
  const ref = { ...borrarAlInicio(conLink(cajaVacia(), 'https://ref.com/x'))!, texto: 'pero para dentistas' };
  const rr = alEnviar(ref, c);
  assert.deepEqual(rr.que === 'accion' && rr.accion.que === 'ia' ? rr.accion.arranque.prompt : null, 'https://ref.com/x\npero para dentistas');
  // El Panel lo abre como Crear con el tipo y el pedido (`derechaDeAccion`).
  assert.deepEqual(derechaDeAccion({ que: 'ia', tipo: 'landing', arranque: { prompt: 'x', modo: 'plan' } }, [], []),
    { tipo: 'ia', doc: 'landing', arranque: { prompt: 'x', modo: 'plan' } });
});

test('alEnviar (se EJECUTA): un link ESCRITO primero se vuelve chips; vacío o en el contenedor de importar, nada', () => {
  const e = alEnviar(cajaVacia('analizar'), como(), '  otra.com/oferta ');
  assert.equal(e.que, 'chips');
  assert.equal(e.que === 'chips' ? e.estado.link?.url : null, 'https://otra.com/oferta');
  assert.equal(e.que === 'chips' ? vistaDeCaja(e.estado) : null, 'texto', 'vuelve al texto, con los chips');
  assert.deepEqual(alEnviar(cajaVacia('analizar'), como(), 'no es un link'), { que: 'nada' });
  const t = alEnviar({ ...cajaVacia(), texto: 'https://otra.com' }, como());
  assert.equal(t.que === 'chips' ? t.estado.link?.accion : null, 'analizar', 'tipeado en Generar y mandado con Enter');
  assert.deepEqual(alEnviar(cajaVacia('importar'), como()), { que: 'nada' });
  assert.deepEqual(alEnviar(cajaVacia(), como()), { que: 'nada' });
  assert.equal(listoParaEnviar(cajaVacia('replicar'), 'otra.com'), true);
  assert.equal(listoParaEnviar(cajaVacia('importar')), false);
});

// ── La URL: cada modo en su lugar de siempre ─────────────────────────────────────────────────────

test('cada modo del cuadro es una derecha con su lugar en la URL, de ida y de vuelta (y con una presentación)', () => {
  const casos: [Parameters<typeof derechaDeCaja>[0], Parameters<typeof derechaDeCaja>[1], string][] = [
    ['generar', 'landing', '?ws=3'],
    ['importar', 'landing', '?ws=3&paso=importar'],
    ['analizar', 'landing', '?ws=3&analizar='],
    ['replicar', 'landing', '?ws=3&vista=replicar'],
    ['generar', 'presentacion', '?ws=3&tipo=presentacion'],
    ['importar', 'presentacion', '?ws=3&paso=importar&tipo=presentacion'],
  ];
  for (const [modo, doc, url] of casos) {
    const d = derechaDeCaja(modo, doc);
    assert.equal(modoCajaDe(d), modo);
    assert.equal(queryDeDerecha('?ws=3', d), url, `${modo} ${doc}`);
    assert.deepEqual(derechaDeQuery(consultaDerecha(Object.fromEntries(new URLSearchParams(url))), [], []), d, url);
  }
  // Los resultados no son el cuadro.
  for (const d of [{ tipo: 'diagnostico', url: 'https://a.com/' }, { tipo: 'replicar', url: 'https://a.com/', auto: true }, { tipo: 'plantillas' }] as Derecha[]) {
    assert.equal(modoCajaDe(d), null, JSON.stringify(d));
  }
  // Los `?paso=` de la tanda 6: «Pegar texto» es Generar (con un texto largo); el deep link de la base, el cuadro con la base.
  assert.deepEqual(derechaDeQuery({ paso: 'pegar' }, [], []), { tipo: 'crear' });
  assert.deepEqual(derechaDeQuery({ url: 'https://a.com/x', objetivo: 'vender' }, [], []), { tipo: 'crear', semilla: { base: 'https://a.com/x', objetivo: 'vender' } });
  // Crear con IA (el resultado): un F5 vuelve al cuadro en el modo de donde salió, sin repedir.
  assert.equal(queryDeDerecha('', { tipo: 'ia', doc: 'landing', arranque: { archivo: { nombre: 'a.pdf', texto: 'x' } } }), '?paso=importar');
  // «Volver» de Crear: el cuadro con lo que se había mandado (un archivo, en Importar).
  assert.deepEqual(derechaDeVuelta({ texto: 'algo', tipo: 'presentacion' }), { tipo: 'crear', doc: 'presentacion', semilla: { texto: 'algo', tipo: 'presentacion' } });
  assert.equal(modoCajaDe(derechaDeVuelta({ archivo: { nombre: 'a.pdf', texto: 'x' } })), 'importar');
  assert.deepEqual(derechaDeVuelta(null), { tipo: 'crear' });
});

test('los ajustes con los que abre: la base VALIDADA contra las analizadas, el objetivo de la lista; las instrucciones de un archivo, juntas', () => {
  const analizadas = [{ url: 'https://mia.com/landing' }];
  assert.equal(paramsIniciales({ base: 'https://mia.com/landing' }, analizadas).basadoEnUrl, 'https://mia.com/landing');
  assert.equal(paramsIniciales({ base: 'https://ajena.com' }, analizadas).basadoEnUrl, null, 'una URL cualquiera no mete un diagnóstico ajeno');
  assert.equal(paramsIniciales({ params: { basadoEnUrl: 'https://ajena.com' } }, analizadas).basadoEnUrl, null, 'tampoco por los params');
  assert.equal(paramsIniciales({ objetivo: 'vender' }, []).objetivo, 'vender');
  assert.equal(paramsIniciales({ objetivo: 'cualquiera' }, []).objetivo, PARAMS_DEFAULT.objetivo);
  assert.deepEqual(paramsIniciales({ params: { cantidad: 4, idioma: 'pt-BR' } }, []), { ...PARAMS_DEFAULT, cantidad: 4, idioma: 'pt-BR' });
  assert.equal(instruccionesConArchivo('  hazla corta ', 'tono formal'), 'hazla corta\n\ntono formal');
  assert.equal(instruccionesConArchivo('', ''), '');
  assert.equal(instruccionesConArchivo('x'.repeat(MAX_INSTRUCCIONES), 'y').length, MAX_INSTRUCCIONES);
  // Lo de vuelta de Crear con un archivo: Importar con su miniatura y lo escrito al lado.
  const s = cajaDeSemilla('importar', { archivo: { nombre: 'a.pdf', texto: 'x' }, texto: 'hazla corta' });
  assert.deepEqual([s.modo, vistaDeCaja(s), s.texto, s.archivo?.estado], ['importar', 'texto', 'hazla corta', 'listo']);
});

test('la miniatura del archivo dice su tipo', () => {
  assert.deepEqual(['a.pdf', 'b.docx', 'c.PPTX', 'd.xlsx', 'e.png', 'f.mp3', 'g.md'].map((n) => tipoDeArchivo(n).etiqueta),
    ['PDF', 'Word', 'PowerPoint', 'Excel', 'Imagen', 'Audio', 'MD']);
});

// ── El cuadro dibujado ───────────────────────────────────────────────────────────────────────────

const dibujar = (props: Partial<Parameters<typeof CajaCrear>[0]> = {}) =>
  renderToStaticMarkup(createElement(CajaCrear, { onAccion: () => {}, ...props }));

test('dibujado: las opciones ARRIBA del cuadro, el MISMO cuadro en los cuatro modos, y sin tarjetas de Crear con IA', () => {
  for (const modo of ['generar', 'importar', 'analizar', 'replicar'] as const) {
    const html = dibujar({ modo });
    const iTitulo = html.indexOf('<h1 class="gp-cc-titulo">¿Qué vas a crear hoy?</h1>');
    const iModos = html.indexOf('class="gp-cc-modos" role="group"');
    const iCuadro = html.indexOf('<form class="gp-cc-caja" data-caja-pedido=""');
    assert.ok(iTitulo >= 0 && iModos > iTitulo && iCuadro > iModos, `${modo}: el título, las opciones y el cuadro, en ese orden`);
    assert.equal((html.match(/<form class="gp-cc-caja"/g) ?? []).length, 1, `${modo}: un cuadro`);
    assert.match(html, /class="gp-cc-fila"/, `${modo}: la fila de abajo de siempre`);
    // (Sólo en el grupo: la hoja de la página también nombra `[aria-pressed="true"]`.)
    const modos = bloque(html, 'class="gp-cc-modos"', '</div>');
    assert.deepEqual([...modos.matchAll(/aria-pressed="true">(?:<span[^>]*>.*?<\/span>)? ?([^<]+)</g)].map((x) => x[1]),
      [OPCIONES_MODO.find((o) => o.id === modo)!.titulo], `${modo}: marcado, y sólo él`);
    assert.doesNotMatch(html, /gp-cc-opcion|Crear con IA|Ejemplos de instrucciones|Aleatorio|Pegar texto/, `${modo}: volvió una tarjeta`);
  }
  assert.match(dibujar({ modo: 'generar' }), /<textarea class="gp-cc-entrada"/);
  assert.match(dibujar({ modo: 'importar' }), /class="gp-cc-soltar"[\s\S]*Suelta tu archivo aquí o <button type="button" class="gp-cc-soltar-elegir">elígelo<\/button>/);
  assert.match(dibujar({ modo: 'analizar' }), /placeholder="Pega o suelta el link de la landing" aria-label="Link de la landing a analizar"/);
  assert.match(dibujar({ modo: 'replicar' }), /aria-label="Link de la landing a replicar"/);
  // Sin micrófono en los contenedores (no hay campo donde dictar); el «+» y el ↑, siempre.
  assert.match(dibujar({ modo: 'generar' }), /aria-label="Dictar el pedido"/);
  for (const modo of ['importar', 'analizar'] as const) {
    const html = dibujar({ modo });
    assert.doesNotMatch(html, /Dictar el pedido/, modo);
    assert.match(html, /aria-label="Adjuntar"/, modo);
    assert.match(html, /class="gp-cc-enviar" aria-label="Enviar" disabled=""/, modo);
  }
  // «Plan» dice cómo se genera; en Analizar y Replicar no se genera.
  assert.match(dibujar({ modo: 'generar' }), /aria-label="Cómo se genera: Plan" aria-haspopup="dialog"/);
  assert.doesNotMatch(dibujar({ modo: 'analizar' }), /Cómo se genera/);
});

test('dibujado: lo que vuelve de Crear (un texto largo, un archivo) y la landing de base, a la vista adentro del cuadro', () => {
  const t = dibujar({ modo: 'generar', semilla: { texto: largo } });
  assert.match(t, /role="group" aria-label="Qué hacer con tu texto"/, '«Tu texto» con un texto largo');
  assert.match(t, /aria-pressed="true"[^>]*title="Escribe el copy completo con tu texto como guía"/);
  const a = dibujar({ modo: 'importar', semilla: { archivo: { nombre: 'propuesta.pdf', texto: 'x' }, texto: 'hazla corta' } });
  assert.match(a, /class="gp-cc-archivo" data-familia="pdf" data-estado="listo" role="group" aria-label="Archivo: propuesta.pdf"/);
  assert.match(a, /aria-label="Quitar el archivo"/);
  assert.match(a, />hazla corta<\/textarea>/);
  const b = dibujar({ modo: 'generar', semilla: { base: 'https://mia.com/landing' }, analizadas: [{ url: 'https://mia.com/landing', veredicto: null, score: null }] });
  assert.match(b, /aria-label="Landing de base: mia.com\/landing"/, 'lo que viaja a la IA se ve');
  assert.doesNotMatch(dibujar({ modo: 'generar', semilla: { base: 'https://ajena.com' } }), /Landing de base/);
});

// ── El cableado (leyendo el fuente sin comentarios) ──────────────────────────────────────────────

test('la caja compartida: todo lo nuevo por props OPCIONALES, y /automations y el Dashboard no las usan', () => {
  const caja = fuente('app/web-generator/CajaPedido.tsx');
  const props = bloque(caja, 'export type PropsCajaPedido = {', '\n};');
  for (const p of ['bajoTitulo', 'antesDelCampo', 'onBorrarAlInicio', 'bajoElCampo', 'onSoltar', 'dictado', 'refCampo', 'modo']) {
    assert.match(props, new RegExp(`\\b${p}\\?:`), `${p} no es opcional`);
  }
  // Backspace: sólo con el cursor al principio y sin selección, y sólo si quien monta borró un chip.
  const campo = bloque(caja, 'function CampoPedido(', '\n}\n');
  assert.match(campo, /if \(e\.key === 'Backspace' && onBorrarAlInicio && t\.selectionStart === 0 && t\.selectionEnd === 0 && onBorrarAlInicio\(\)\) e\.preventDefault\(\);/);
  // El arrastre: sólo con `onSoltar`; el dragover se acepta sólo con lo que la caja toma (si no, el navegador abre el archivo).
  const form = bloque(caja, '<form className="gp-cc-caja"', '>\n');
  assert.match(form, /onDragOver=\{soltar \? \(e\) => \{ if \(!sePuede\(e\.dataTransfer\)\) return; e\.preventDefault\(\);/);
  assert.match(form, /onDrop=\{soltar \? \(e\) => \{ capas\.current = 0; setArrastre\(false\); if \(soltar\(e\.dataTransfer\)\) e\.preventDefault\(\); \} : undefined\}/);
  for (const f of ['app/automations/ChatMako.tsx', 'app/dashboard/NuevaHoja.tsx']) {
    assert.doesNotMatch(fuente(f), /bajoTitulo=|antesDelCampo=|onBorrarAlInicio=|bajoElCampo=|onSoltar=|dictado=|refCampo=/, `${f} cambió`);
  }
});

test('el cuadro del Web Generator usa ESTAS funciones, y el Panel lo monta en sus cuatro modos sin remontarlo', () => {
  const src = fuente('app/web-generator/CajaCrear.tsx');
  assert.match(src, /onValor=\{\(v\) => \{ setError\(null\); setEstado\(\(e\) => alEscribir\(e, v\)\); \}\}/);
  assert.match(src, /const r = alEnviar\(estado, \{ tipo, modo: modoGen, params \}, escritoLink\);/);
  assert.match(src, /if \(r\.que === 'accion'\) onAccion\(r\.accion\);/);
  assert.match(src, /const n = borrarAlInicio\(estado\);\s*if \(!n\) return false;\s*setEstado\(n\);\s*return true;/);
  assert.match(src, /onSoltar=\{soltar\}/);
  assert.match(src, /listo=\{listoParaEnviar\(estado, escritoLink\)\}/);
  assert.match(src, /aria-pressed=\{estado\.modo === o\.id\} onClick=\{\(\) => elegir\(o\.id\)\}/);
  // «Más ajustes» va AFUERA del <form> (un Enter en «Tono» mandaría el pedido): después del cierre de la caja.
  const iCaja = src.indexOf('<CajaPedido');
  const iCierre = src.indexOf('\n      />', iCaja);
  assert.ok(iCaja > 0 && src.indexOf('<PanelMasAjustes') > iCierre, '«Más ajustes» quedó adentro del cuadro');
  assert.ok(src.indexOf('<BotonComo') > iCaja && src.indexOf('<BotonComo') < iCierre, '«Plan» va en la fila de abajo del cuadro');
  // El desplegable de Plan: una capa propia (no un MenuFlotante) que no se cierra al elegir en un menú de adentro.
  const capa = fuente('app/web-generator/crear/AjustesCaja.tsx');
  assert.match(capa, /role="dialog"\s+aria-label="Cómo se genera"/);
  assert.match(capa, /useCapaModal\(true, \{ anidada: true \}\)/);
  assert.match(capa, /t\.closest\?\.\('\[role="menu"\]'\)\) return;/);
  // El Panel: el MISMO CajaCrear para los cuatro modos, con el modo en la URL.
  const inicio = fuente('app/web-generator/Inicio.tsx');
  assert.match(inicio, /const modoCaja = modoCajaDe\(derecha\);\s*let contenido: ReactNode;\s*if \(modoCaja\) \{\s*contenido = \(\s*<CajaCrear\s+modo=\{modoCaja\}\s+onModo=\{alModoCaja\}/);
  assert.doesNotMatch(inicio, /AnalizarUnaPagina|recordarPaso|onPaso=/);
  // Crear con IA ya no tiene pantallas de entrada (ni ejemplos en tarjetas, ni «Aleatorio»).
  const crear = fuente('app/web-generator/crear/CrearConIA.tsx');
  assert.doesNotMatch(crear, /Ejemplos de instrucciones|Aleatorio|EJEMPLOS_LANDING|gp-ejemplo|Importar con IA|Cargar un archivo|paso === 'generar'|paso === 'importar'/);
  assert.match(crear, /onClick=\{volver\}><Ico n="flecha-izquierda" t=\{14\} \/> Volver<\/button>/);
});

test('ni el cuadro ni sus piezas tienen voseo (el guard del repo no ve un archivo nuevo sin `git add`)', () => {
  const malas: Record<string, string[]> = {};
  for (const f of [
    'app/web-generator/CajaCrear.tsx', 'app/web-generator/CajaPedido.tsx', 'app/web-generator/crear/caja-modos.ts', 'app/web-generator/crear/ajustes.ts',
    'app/web-generator/crear/AjustesCaja.tsx', 'app/web-generator/crear/recientes.ts', 'app/web-generator/crear/CrearConIA.tsx', 'app/web-generator/Inicio.tsx',
  ]) {
    const m = marcasDeVoseo(fuente(f));
    if (m.length) malas[f] = m;
  }
  assert.deepEqual(malas, {});
});

// ── PROBADO ROMPIÉNDOLO (15/10/2026) ─────────────────────────────────────────────────────────────
// Base: 19 / 0. Un arnés rompe UNA cosa, corre este archivo, restaura DE MEMORIA y compara el sha256. Pasan / fallan:
//   R1  esTextoLargo con «>» (500 justos no es largo)                 → 18 / 1 «el umbral del texto largo…»
//   R2  Backspace borra el link antes que la pastilla                  → 17 / 2 «Backspace al principio…», «alEnviar… el pedido corto…»
//   R3  un link soltado con un archivo puesto se vuelve chips          → 18 / 1 «lo arrastrado…»
//   R4  Replicar sin el formato                                        → 18 / 1 «alEnviar… Analizar y Replicar…»
//   R5  el texto largo va como pedido (prompt)                         → 18 / 1 «alEnviar… el pedido corto…»
//   R6  Importar no escribe su paso en la URL                          → 18 / 1 «cada modo del cuadro es una derecha…»
//   R7  elegir Generar deja el archivo                                 → 18 / 1 «elegir un modo cambia el cuadro…»
//   R8  Backspace con una selección borra un chip (CajaPedido)         → 18 / 1 «la caja compartida…»
//   R9  el dragover acepta cualquier cosa (CajaPedido)                 → 18 / 1 «la caja compartida…»
//   R10 `bajoTitulo` obligatoria (CajaPedido)                          → 18 / 1 «la caja compartida…»
//   R11 micrófono en los contenedores (CajaCrear)                      → 18 / 1 «dibujado: las opciones ARRIBA…»
//   R12 el Panel no escucha el modo del cuadro (Inicio)                → 18 / 1 «el cuadro del Web Generator usa ESTAS funciones…»
//   R13 voseo en el contenedor del link («Tocá acá…»)                  → 17 / 2 «dibujado: las opciones ARRIBA…», «ni el cuadro… voseo»
//   R14 el aviso de lo escrito al revés                                → 18 / 1 «alEnviar… Analizar y Replicar…»
//   R15 la uri-list con sus comentarios                                → 18 / 1 «lo arrastrado…»
//   R16 la landing de base sin validar (ajustes.ts)                    → 17 / 2 «los ajustes con los que abre…», «dibujado: lo que vuelve de Crear…»
//   R17 «Tu texto» también con Analizar                                → 18 / 1 ««Tu texto» aparece SOLA…»
//   R18 «Volver» de Crear sin lo mandado (`onSalir()`)                 → 18 / 1 «el cuadro del Web Generator usa ESTAS funciones…»
// Restaurado: 19 / 0.
