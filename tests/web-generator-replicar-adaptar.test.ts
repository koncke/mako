// =============================================================================
// «Replicar y adaptar»: el diseño de una landing de afuera con el texto de la oferta del negocio (27/10/2026)
// =============================================================================
// Leila, en la llamada (ticket 876470842-27, prometido para el 27/10): «Replicar y adaptar». Ya existía «Replica esta
// landing» (la copia con el texto de la original). Listo = las dos opciones en el cuadro de crear, y «adaptar» reescribe el
// texto con la oferta del negocio SIN tocar el diseño. Lo que fija:
//   1. la receta: en «Landing» el esquema sigue en «Conservar» (la estructura exacta de la original) y la tanda de
//      secciones reescribe con la instrucción de adaptar; en «Presentación» la instrucción va en las dos; la copia
//      idéntica no se adapta (el server ofrece «Landing»);
//   2. el cuadro: la pastilla del link tiene las dos opciones, y «adaptar» viaja hasta la derecha del Panel;
//   3. los enchufes: la ruta, replicar(), el panel «Replicar landing» y la operación de MaKo (por prompt) lo llevan.
// Correr: node --import tsx --test tests/web-generator-replicar-adaptar.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSTRUCCION_ADAPTAR, adaptaElFormato, configDeReplica } from '../lib/editor-landing/replicar-reglas';
import { alEnviar, cajaVacia, cambiarFormato, conLink, elegirPastilla, pastillaDe, type ComoGenerar } from '../app/web-generator/crear/caja-modos';
import { derechaDeAccion } from '../app/web-generator/panel-reglas';
import { PARAMS_DEFAULT } from '../lib/editor-landing/ia-reglas';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const URL_ = 'https://www.otra.com/oferta';

test('1. la receta: el esquema conserva la estructura y las secciones se reescriben con la oferta', () => {
  const land = configDeReplica('landing', URL_, { adaptar: true });
  assert.equal(land.adaptar, true);
  assert.equal(land.params?.modoTexto, 'conservar', 'el esquema: las mismas secciones, en el mismo orden');
  assert.equal(land.paramsSecciones?.modoTexto, 'generar', 'las secciones se escriben de nuevo');
  assert.equal(land.paramsSecciones?.instrucciones, INSTRUCCION_ADAPTAR);
  assert.equal(land.paramsSecciones?.fuenteImagenes, 'marcadores', 'las imágenes, como siempre: las de la original o huecos');
  assert.match(INSTRUCCION_ADAPTAR, /ESTE negocio/);
  assert.match(INSTRUCCION_ADAPTAR, /ni su marca, ni sus nombres, ni sus testimonios, ni sus cifras/);
  const pres = configDeReplica('presentacion', URL_, { adaptar: true });
  assert.equal(pres.params?.instrucciones, INSTRUCCION_ADAPTAR, 'en una presentación el esquema ya pasa por la IA');
  // Sin adaptar, la receta de siempre (sin campos nuevos); la copia idéntica nunca se adapta.
  assert.equal('adaptar' in configDeReplica('landing', URL_), false);
  assert.equal('paramsSecciones' in configDeReplica('landing', URL_), false);
  assert.equal(configDeReplica('web', URL_, { adaptar: true }).adaptar, undefined);
  assert.deepEqual(['presentacion', 'landing', 'web'].map((f) => adaptaElFormato(f as never)), [true, true, false]);
});

test('2. el cuadro de crear: «Replica y adapta» en la pastilla del link, y viaja hasta la derecha del Panel', () => {
  const como: ComoGenerar = { tipo: 'landing', modo: 'plan', params: { ...PARAMS_DEFAULT } };
  const conL = conLink(cajaVacia(), URL_);
  const ad = elegirPastilla(conL, 'adaptar');
  assert.equal(ad.link?.accion, 'replicar');
  assert.equal(ad.link?.adaptar, true);
  assert.equal(pastillaDe(ad.link!), 'adaptar');
  assert.deepEqual(alEnviar(ad, como), { que: 'accion', accion: { que: 'replicar', url: URL_, formato: 'landing', adaptar: true } });
  // Volver a «Replica esta landing» la deja tal cual; a «Analiza», analiza.
  const tal = elegirPastilla(ad, 'replicar');
  assert.equal(tal.link?.adaptar, undefined);
  assert.deepEqual(alEnviar(tal, como), { que: 'accion', accion: { que: 'replicar', url: URL_, formato: 'landing' } });
  assert.equal(pastillaDe(elegirPastilla(ad, 'analizar').link!), 'analizar');
  // La copia idéntica no se adapta: elegir adaptar con «Página web» pasa a «Landing».
  assert.equal(elegirPastilla(cambiarFormato(elegirPastilla(conL, 'replicar'), 'web'), 'adaptar').link?.formato, 'landing');
  // La derecha del Panel lo recibe, y arranca sola como siempre.
  assert.deepEqual(derechaDeAccion({ que: 'replicar', url: URL_, formato: 'landing', adaptar: true }, [], []),
    { tipo: 'replicar', url: URL_, formato: 'landing', adaptar: true, auto: true });
  // La pastilla y el panel muestran las dos opciones.
  const caja = fuente('app/web-generator/CajaCrear.tsx');
  assert.match(caja, /\{ valor: 'replicar', texto: 'Replica esta landing'/);
  assert.match(caja, /\{ valor: 'adaptar', texto: 'Replica y adapta a tu oferta'/);
  // 28/10/2026: el panel ya no tiene «Tal cual | Adaptada»: tiene QUÉ replicar por partes (replicar-partes.ts), y «adapta»
  // arranca con diseño + estructura + ángulos (el texto, escrito para la oferta).
  const panel = fuente('app/web-generator/crear/Replicar.tsx');
  // (y desde el 28/10, ~09:40, sin «adapta» arranca en la copia idéntica: tests/web-generator-copia-identica.test.ts)
  assert.match(panel, /useState<PartesReplica>\(\(\) => \(adaptarInicial \? PARTES_ADAPTAR : PARTES_TODAS\)\)/);
  assert.match(panel, /<SelectorPartes partes=\{partes\} onCambio=\{cambiarPartes\}/);
  assert.match(fuente('app/web-generator/Inicio.tsx'), /<ReplicarUnaPagina [^>]*adaptar=\{derecha\.adaptar\}/);
});

test('3. los enchufes: la ruta, replicar(), el pedido de la pantalla y la operación de MaKo llevan «adaptar»', () => {
  assert.match(fuente('app/api/landing-generator/replicar/route.ts'), /replicar\(\{ [^}]*adaptar: body\.adaptar, foto: body\.foto \}\)/);
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /if \(p\.adaptar === true && formato === 'web'\) return falla\(ERROR_ADAPTAR_WEB, 400, 'landing'\);/);
  assert.match(rep, /configDeReplica\(formato, url, \{ adaptar: p\.adaptar === true \}\)/);
  // 28/10/2026: el esquema de las tandas lleva la nota de cada sección (su molde y su ángulo: tests/web-generator-replicar-partes.test.ts).
  // 13/11/2026: cada vuelta lleva su esquema (por defecto el de las notas, `esquemaVuelta = esqTandas`); los parámetros, los mismos.
  assert.match(rep, /pedirSecciones\(\{ esquema: esquemaVuelta, indices, params: receta\.paramsSecciones \?\? params \}\)/, 'las tandas usan los parámetros de adaptar');
  assert.match(rep, /sinIA && receta\.adaptar\s*\?\s*\(sinIA === 1 \? `Una \$\{una\} quedó con el texto de la original: adáptala con MaKo\.`/,
    'una adaptada: la sección sin IA quedó con el texto de la otra, y se dice así (no «quedó sin diseño»)');
  const pantalla = fuente('app/web-generator/crear/Replicar.tsx');
  assert.match(pantalla, /\.\.\.\(adaptar \? \{ adaptar: true \} : \{\}\)/, 'el pedido de la pantalla lo manda');
  // Por prompt: replicar_landing tiene «adaptar», y la copia idéntica lo rechaza antes de la tarjeta.
  assert.ok(porId('replicar_landing')?.parametros.some((x) => x.nombre === 'adaptar' && x.tipo === 'boolean'));
  const run = fuente('lib/api-mako/areas/landing.run.ts');
  assert.match(run, /if \(adaptar && formato === 'web'\) return \{ error: ERROR_ADAPTAR_WEB \};/);
  assert.match(run, /replicarEnEditor\(\{ [^}]*adaptar: payload\.adaptar === true \}\)/);
});
