// =============================================================================
// Leer, analizar y replicar una página de afuera: el lado del SERVIDOR (tanda 6, 14/10/2026)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página". Soluciona eso...». Y sus decisiones del mismo día: la página que no se lee desde el
// server se lee EN EL NAVEGADOR de la persona («si detecta que tenes el pixel instalado, que lo haga
// desde allí y sino desde la ventana emergente»), y «Replicar» pregunta 3 formatos: Presentación
// (diapositivas), Landing (secciones editables) y Página web (la copia idéntica de hoy).
//
// Lo que fija este archivo:
//   1. la LECTURA que manda el navegador (lectura-reglas.ts): sólo `fuente: 'navegador'`, con topes, sin
//      destinos que ejecutan; y cómo se dice lo probado para el análisis;
//   2. la falla «léela en tu navegador» con su forma EXACTA, y qué errores la merecen (un 403 sí, un 404
//      no) — la que reemplaza al callejón «No pude leer el texto de esa página»;
//   3. la receta de cada formato de Replicar (`configDeReplica`): ninguno con fotos de stock al azar, la
//      presentación en 16:9 condensada, la landing con el texto tal cual, la web por la copia fiel; y el
//      pedido viejo (`modo`) aceptado durante un deploy;
//   4. los enchufes (en el texto de las fuentes, que llevan server-only): la URL TAL CUAL al bajar, la
//      lectura aceptada por las tres entradas, las cabeceras de 64 KB y el tope de 5 MB;
//   5. `replicar_landing` en la API de MaKo con la puerta de /landing-generator.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez, con todo en verde antes (11 pass) y restaurado
// de memoria después (11 pass, sha256 igual). Pasan / fallan:
//   · sanearLectura acepta cualquier `fuente`                                          -> 10 / 1
//   · destinoSeguro deja pasar `javascript:`                                           -> 10 / 1
//   · lineasProbadas sin quitar las repetidas                                          -> 10 / 1
//   · fallaEnNavegador sin `pegable` (la pantalla vieja no ofrecería pegar)             -> 10 / 1
//   · motivoDeError devuelve 'bloquea-lectura' para cualquier error                    -> 10 / 1
//   · configDeReplica de 'landing' con fuenteImagenes 'stock'                          -> 10 / 1
//   · configDeReplica de 'presentacion' sin proporción 16:9                            -> 10 / 1
//   · formatoReplicar ignora el `modo` viejo                                           -> 10 / 1
//   · ia.ts importa con `extraerLanding(url, {})` (sin talCual: pierde el www)         -> 10 / 1
//   · replicar.ts baja con `htmlDePagina(url, {})` (sin talCual)                       -> 10 / 1
//   · la ruta del diagnóstico sin pasar `lectura`                                      -> 10 / 1
//   · landing-fetch con 16 KB de cabeceras                                             -> 10 / 1
//   · replicar_landing con canal http                                                  -> 10 / 1
//   · analizar_landing sin el `motivo` en los datos                                    -> 10 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorDeLectura } from '../lib/landing-extraer';
import {
  TOPES_LECTURA, fallaEnNavegador, lineasProbadas, mensajeEnNavegador, motivoDeError, motivoDePagina, sanearLectura,
} from '../lib/editor-landing/lectura-reglas';
import { MOTIVOS_EN_NAVEGADOR } from '../lib/editor-landing/lectura-tipos';
import {
  FORMATOS_REPLICAR, NOMBRE_FORMATO_REPLICAR, configDeReplica, formatoReplicar,
} from '../lib/editor-landing/replicar-reglas';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. La lectura del navegador ───────────────────────────────────────────────

test('sanearLectura: sólo lo que dice venir del navegador, con topes y sin lo que no es texto', () => {
  assert.equal(sanearLectura(null), null);
  assert.equal(sanearLectura('texto'), null);
  assert.equal(sanearLectura([]), null);
  assert.equal(sanearLectura({ texto: 'Hola', interacciones: [] }), null, 'sin fuente no es una lectura');
  assert.equal(sanearLectura({ texto: 'Hola', interacciones: [], fuente: 'servidor' }), null);
  assert.equal(sanearLectura({ texto: '   ', interacciones: [], fuente: 'navegador' }), null, 'vacía no es una lectura');

  const l = sanearLectura({
    fuente: 'navegador',
    texto: '# Título\r\n\r\n\r\n\r\nUn párrafo\u0007 con   espacios\n[BOTÓN] Agenda',
    interacciones: [
      { tipo: 'Boton', texto: '  Agenda\n tu llamada ', destino: 'https://calendly.com/ejemplo/30min' },
      { tipo: 'boton', texto: 'Malo', destino: 'javascript:alert(1)' },
      { tipo: '', texto: 'sin tipo' },
      { tipo: 'calendario', texto: '' },
      'basura',
    ],
  });
  assert.ok(l);
  assert.equal(l.texto, '# Título\n\nUn párrafo con espacios\n[BOTÓN] Agenda', 'los renglones quedan (son el orden), los de control y los espacios de más no');
  assert.deepEqual(l.interacciones, [
    { tipo: 'boton', texto: 'Agenda tu llamada', destino: 'https://calendly.com/ejemplo/30min' },
    { tipo: 'boton', texto: 'Malo' },
  ], 'un destino que ejecuta se va; sin tipo, o sin texto ni destino, no es una interacción');

  const grande = sanearLectura({
    fuente: 'navegador',
    texto: 'a'.repeat(TOPES_LECTURA.texto + 500),
    interacciones: Array.from({ length: 500 }, (_, i) => ({ tipo: 'boton', texto: `B${i}`.padEnd(1000, 'x'), destino: `https://a.com/${'p'.repeat(2000)}` })),
  });
  assert.ok(grande);
  assert.equal(grande.texto.length, TOPES_LECTURA.texto);
  assert.equal(grande.interacciones.length, TOPES_LECTURA.interacciones);
  assert.ok(grande.interacciones.every((i) => i.texto.length <= TOPES_LECTURA.textoInteraccion && (i.destino ?? '').length <= TOPES_LECTURA.destino));
});

test('lo probado, dicho para el análisis: botones con destino, el calendario, sin repetidos', () => {
  assert.deepEqual(lineasProbadas({
    interacciones: [
      { tipo: 'boton', texto: 'Agenda tu llamada', destino: 'https://calendly.com/ejemplo' },
      { tipo: 'boton', texto: 'Agenda tu llamada', destino: 'https://calendly.com/ejemplo' },
      { tipo: 'boton', texto: 'Quiero entrar' },
      { tipo: 'calendario', texto: 'Calendly: no cargó', destino: 'https://calendly.com/ejemplo' },
      { tipo: 'desplegable', texto: '¿Hay garantía?' },
      { tipo: 'otro', texto: 'algo' },
    ],
  }), [
    'Botón «Agenda tu llamada» → https://calendly.com/ejemplo',
    'Botón «Quiero entrar» → (sin destino)',
    'Calendario: Calendly: no cargó → https://calendly.com/ejemplo',
    'Desplegable abierto: «¿Hay garantía?»',
    'otro: algo',
  ]);
});

// ── 2. «Léela en tu navegador» ────────────────────────────────────────────────

test('la falla «léela en tu navegador»: la forma exacta, y sólo para lo que el navegador arregla', () => {
  assert.deepEqual([...MOTIVOS_EN_NAVEGADOR], ['se-arma-en-navegador', 'bloquea-lectura']);
  assert.deepEqual(fallaEnNavegador('se-arma-en-navegador'), {
    ok: false, error: mensajeEnNavegador('se-arma-en-navegador'), pegable: true, enNavegador: true, motivo: 'se-arma-en-navegador',
  });
  assert.doesNotMatch(mensajeEnNavegador('se-arma-en-navegador'), /No pude leer el texto/, 'el callejón de antes no vuelve');
  assert.match(mensajeEnNavegador('bloquea-lectura'), /navegador.*pega/i);

  assert.equal(motivoDeError(new ErrorDeLectura('La página respondió 403.', 403)), 'bloquea-lectura');
  assert.equal(motivoDeError(new ErrorDeLectura('La página respondió 429.', 429)), 'bloquea-lectura');
  assert.equal(motivoDeError(new ErrorDeLectura('La página respondió 404.', 404)), null, 'una página que no existe no existe en ningún navegador');
  assert.equal(motivoDeError(new Error('No se pudo resolver el dominio')), null);

  assert.equal(motivoDePagina({ bloqueada: true, texto: 'Edit with' }), 'se-arma-en-navegador');
  assert.equal(motivoDePagina({ bloqueada: false, texto: '  ' }), 'se-arma-en-navegador');
  assert.equal(motivoDePagina({ bloqueada: false, texto: 'Hay texto' }), null);
});

// ── 3. Los formatos de Replicar ───────────────────────────────────────────────

test('configDeReplica: tres formatos, ninguno con fotos de stock al azar', () => {
  assert.deepEqual([...FORMATOS_REPLICAR], ['presentacion', 'landing', 'web']);
  assert.deepEqual(NOMBRE_FORMATO_REPLICAR, { presentacion: 'Presentación', landing: 'Landing', web: 'Página web' });
  const url = 'https://www.ejemplo.com/oferta?v=2';
  const origen = { modo: 'importar', basadoEnUrl: url };

  const pres = configDeReplica('presentacion', url);
  assert.equal(pres.via, 'bloques');
  assert.deepEqual(pres.config, { formato: 'presentacion', proporcion: '16:9', origen });
  assert.equal(pres.params?.formato, 'presentacion', 'ia.ts lee el formato CRUDO del pedido (esDiapositivas)');
  assert.equal(pres.params?.modoTexto, 'condensar', 'una diapositiva no lleva el párrafo entero');

  const land = configDeReplica('landing', url);
  assert.equal(land.via, 'bloques');
  assert.deepEqual(land.config, { formato: 'pagina', origen });
  assert.equal(land.params?.modoTexto, 'conservar', 'el texto tal cual');

  const web = configDeReplica('web', url);
  assert.deepEqual(web, { formato: 'web', via: 'fiel', params: null, config: { formato: 'pagina', origen } });

  for (const f of FORMATOS_REPLICAR) {
    const p = configDeReplica(f, url).params;
    if (p) assert.equal(p.fuenteImagenes, 'marcadores', `${f}: las imágenes quedan como huecos, nunca stock al azar`);
  }
});

test('formatoReplicar: el formato manda; sin él, el modo viejo de la tanda 2 durante el deploy', () => {
  for (const f of FORMATOS_REPLICAR) assert.equal(formatoReplicar(f), f);
  assert.equal(formatoReplicar(undefined, 'bloques'), 'landing');
  assert.equal(formatoReplicar(undefined, 'fiel'), 'web');
  assert.equal(formatoReplicar('', 'fiel'), 'web');
  assert.equal(formatoReplicar('diapositivas', 'fiel'), null, 'un formato que no existe no cae al modo viejo');
  assert.equal(formatoReplicar(undefined, undefined), null);
  assert.equal(formatoReplicar(undefined, 'otro'), null);
});

// ── 4. Los enchufes (las fuentes llevan server-only: se miran en el texto) ────

test('Importar: baja la URL TAL CUAL, acepta la lectura del navegador y contesta enNavegador (nunca el callejón)', () => {
  const ia = sinComentarios(leer('lib/editor-landing/ia.ts'));
  assert.match(ia, /extraerLanding\(url, \{ talCual: true \}\)/, 'normalizarUrl le saca el www: hay hosts que sólo existen con www');
  assert.match(ia, /sanearLectura\(p\.lectura\)/);
  assert.match(ia, /motivoDePagina\(pagina\)[\s\S]{0,80}enNavegador\(motivo\)/);
  assert.match(ia, /motivoDeError\(e\)[\s\S]{0,80}enNavegador\(motivo\)/);
  assert.doesNotMatch(ia, /No pude leer el texto de esa página/);
  const ruta = sinComentarios(leer('app/api/landing-generator/ia/route.ts'));
  assert.match(ruta, /lectura: body\.lectura/);
  assert.match(ruta, /enNavegador: true, motivo: r\.motivo/);
});

test('Replicar: el formato y la lectura llegan a replicar(), y la copia idéntica baja la URL tal cual', () => {
  const ruta = sinComentarios(leer('app/api/landing-generator/replicar/route.ts'));
  assert.match(ruta, /replicar\(\{ url: body\.url, formato: body\.formato, modo: body\.modo, lectura: body\.lectura, texto: body\.texto \}\)/);
  const rep = sinComentarios(leer('lib/editor-landing/replicar.ts'));
  assert.match(rep, /htmlDePagina\(url, \{ talCual: true \}\)/);
  assert.match(rep, /configDeReplica\(formato, url\)/);
  assert.match(rep, /crear\(\{ accion: 'crear', titulo, contenido, config \}\)/, 'la landing nace con el formato y el origen de su receta');
  assert.doesNotMatch(rep, /buscarYCopiar|fuenteImagenes: 'stock'/);
});

// Verificación de la tanda 6 (15/10/2026): una app de Vite o Lovable en «Página web» contesta 422 con «Prueba el
// formato «Landing».» y `probar: 'landing'`, que la pantalla ofrece como botón (tests/editor-landing-htmllibre.test.ts
// prueba `copiaFiel`; tests/editor-landing-crear-panel.test.ts, la pantalla). PROBADO ROMPIÉNDOLO (15/10/2026),
// base 12 / 0: replicar.ts sin pasar `copia.probar` → 11 / 1; la ruta sin reenviar `probar` → 11 / 1. Restaurado 12 / 0.
test('Replicar «Página web»: el formato que sí anda (`probar`) llega del server a la pantalla, con 422', () => {
  const rep = sinComentarios(leer('lib/editor-landing/replicar.ts'));
  assert.match(rep, /if \(!copia\.ok\) return falla\(copia\.error, 422, copia\.probar\);/);
  assert.match(rep, /const falla = \(error: string, status = 400, probar\?: FormatoReplicar\): ResultadoReplicar => \(\{ ok: false, error, status, \.\.\.\(probar \? \{ probar \} : \{\}\) \}\);/);
  const ruta = sinComentarios(leer('app/api/landing-generator/replicar/route.ts'));
  assert.match(ruta, /\.\.\.\(r\.probar \? \{ probar: r\.probar \} : \{\}\),/);
});

test('Diagnóstico: la lectura llega al análisis, y lo probado entra al meta como no confiable', () => {
  const ruta = sinComentarios(leer('app/api/landing-generator/diagnostico/route.ts'));
  assert.match(ruta, /analizar\(\{ docId: body\.docId, url: body\.url, texto: body\.texto, lectura: body\.lectura \}\)/);
  const srv = sinComentarios(leer('lib/editor-landing/diagnostico-server.ts'));
  assert.match(srv, /sanearLectura\(p\.lectura\)/);
  assert.match(srv, /analizarLanding\(obj\.url, entrada\.texto, \{ lectura: entrada\.lectura, leer: entrada\.leer \}\)/);
  const an = sinComentarios(leer('lib/landing-analyst.ts'));
  assert.match(an, /navegador \? LINEA_LEIDA_EN_NAVEGADOR : null/);
  assert.match(an, /contenidoNoConfiable\([^)]*probado[\s\S]{0,140}'probado_en_navegador'\)/);
  assert.match(an, /enNavegador: true, motivo: 'se-arma-en-navegador'/);
});

test('la red: cabeceras de hasta 64 KB y páginas de hasta 5 MB', () => {
  const f = sinComentarios(leer('lib/landing-fetch.ts'));
  assert.match(f, /const MAX_BYTES = 5_000_000;/);
  assert.match(f, /const MAX_CABECERAS = 65_536;/);
  assert.match(f, /maxHeaderSize: MAX_CABECERAS/, 'node corta en 16 KB y hay sitios que mandan 17');
  assert.match(f, /throw new ErrorDeLectura\(/, 'el código HTTP viaja: separa «no nos deja» de «no existe»');
});

// ── 5. La API de MaKo ─────────────────────────────────────────────────────────

test('replicar_landing: acción por chat, reversible, con la puerta de /web-generator y sin http', () => {
  const d = porId('replicar_landing');
  assert.ok(d && esAccion(d), 'replicar_landing no está en el registro');
  assert.equal(d.area, 'landing');
  assert.equal(d.confirmacion, 'chat', 'crea un borrador, como crear_landing_desde_diseno');
  assert.equal(d.reversible, true, 'va a la papelera');
  assert.deepEqual(d.gating, { tab: 'landing-writer', rolMinimo: 'admin' });
  assert.equal(d.costo, 'ia');
  assert.deepEqual([...d.canales].sort(), ['app', 'whatsapp'], 'por bloques tarda hasta 240 s: más que el techo de 60 s de la ruta HTTP');
  const formato = d.parametros.find((p) => p.nombre === 'formato');
  assert.deepEqual([...(formato?.enum ?? [])], [...FORMATOS_REPLICAR], 'la MISMA lista que la pantalla');
  assert.deepEqual(d.parametros.map((p) => p.nombre), ['url', 'formato', 'texto']);
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const i = run.search(/^ {2}replicar_landing: \{/m);
  const bloque = run.slice(i, i + 4000);
  assert.match(bloque, /if \(enFlujo\(ctx\)\) return \{ error:/, 'no corre en una automatización (crearía una copia por lead)');
  assert.match(bloque, /replicarEnEditor\(\{ url, formato, texto:/, 'el MISMO server que la pantalla');
  assert.doesNotMatch(bloque, /\.from\(|getTenantDb/);
});

test('analizar_landing dice el motivo nuevo cuando la página se lee en el navegador', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const i = run.search(/^ {2}analizar_landing: \{/m);
  const bloque = run.slice(i, i + 3500);
  assert.match(bloque, /en_navegador: true, motivo: r\.motivo/);
  assert.match(bloque, /Web Generator → Diagnóstico/);
});
