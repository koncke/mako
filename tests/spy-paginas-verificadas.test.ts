// «Sus páginas» no muestra un marco que no se pueda verificar, y un acortador se resuelve a su destino (4/11/2026).
//
// El Cerebro, con Martín: «`linktw.in/pywydg`: el iframe muestra el archivo triste gris de Chrome. Ese iframe roto se dibuja como si
// fuera la página. Es exactamente lo que te pedí evitar: no se muestra hasta confirmar que abrió bien, y un acortador se resuelve
// primero a su destino final… Dejá de mostrar iframes que no se puedan verificar». Y antes: «`viralidad.com` muestra un 500 enorme
// adentro del iframe».
//   1. una página que sólo redirige en el navegador (etiqueta `refresh`, `location = …`) se reconoce y dice a dónde manda; una página
//      de verdad con un `location.href` en un botón, no;
//   2. la ruta sigue esas redirecciones hasta tres veces (un bucle no la cuelga) y devuelve el destino;
//   3. lo que pinta el marco cuenta sólo si es la página: su «500» o el error de la ruta no; poco texto, todavía no;
//   4. una página de error se reconoce por su título o su principio, y «500 personas compraron» es una página;
//   5. la pantalla: el marco escondido con su esqueleto hasta que ÉL avisa (sólo sus mensajes cuentan), sin aviso a tiempo queda
//      «Abrir», y si se va a otra página tiene que volver a avisar;
//   6. la ruta: el destino viaja (`final`) y una página que contesta con su error no está abierta.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `redireccionDelCliente` sin el tope de texto                          → 1
//   · `paginaFinal` sin el corte de saltos (bucle)                          → 2
//   · `marcoVerificado` que acepta con poco texto                            → 3
//   · `marcoVerificado` sin mirar el error                                   → 3
//   · `esPaginaDeError` que toma «500 personas» como error                    → 4
//   · la pantalla sin comparar el que manda el mensaje con su marco           → 5
//   · el marco a la vista antes de verificar                                 → 5
//   · la ruta sin `paginaFinal`                                              → 6
//
// Correr: node --import tsx --test tests/spy-paginas-verificadas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esPaginaDeError, marcoVerificado, paginaFinal, redireccionDelCliente, SALTOS_DEL_CLIENTE, TEXTO_MINIMO_PINTADO } from '../lib/pagina-real';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BASE = 'https://linktw.in/pywydg';
const DESTINO = 'https://tienda.example.com/curso';

test('1. una página que sólo redirige en el navegador dice a dónde manda; una de verdad, no', () => {
  assert.equal(redireccionDelCliente(`<meta http-equiv="refresh" content="0;url=${DESTINO}">`, BASE), DESTINO, 'refresh con 0');
  assert.equal(redireccionDelCliente(`<meta content="2; URL='${DESTINO}'" http-equiv="Refresh">`, BASE), DESTINO, 'al revés, con comillas');
  assert.equal(redireccionDelCliente(`<html><head><script>window.location.href = "${DESTINO}";</script></head><body>Redirigiendo…</body></html>`, BASE), DESTINO);
  assert.equal(redireccionDelCliente(`<script>location.replace('${DESTINO}')</script>`, BASE), DESTINO);
  assert.equal(redireccionDelCliente('<script>location = "/ir"</script>', BASE), 'https://linktw.in/ir', 'relativa a la página');

  assert.equal(redireccionDelCliente(`<meta http-equiv="refresh" content="30;url=${DESTINO}">`, BASE), null, 'una espera larga no es una redirección');
  assert.equal(redireccionDelCliente('<script>location.href = "javascript:void(0)"</script>', BASE), null, 'sólo http y https');
  assert.equal(redireccionDelCliente(`<script>location.href = "${BASE}/"</script>`, BASE), null, 'la misma página no');
  const deVerdad = `<html><body><h1>Curso de marca personal</h1><p>${'Aprende a construir tu marca con un método probado. '.repeat(10)}</p>`
    + `<button onclick="x()">Comprar</button><script>function x(){ location.href = "${DESTINO}"; }</script></body></html>`;
  assert.equal(redireccionDelCliente(deVerdad, BASE), null, 'una página con contenido no se sigue por un botón');
});

test('2. la ruta sigue las redirecciones del navegador, hasta tres veces, y se queda con el destino', async () => {
  const paginas: Record<string, string> = {
    [BASE]: `<script>location.href="https://corto.example.com/a"</script>`,
    'https://corto.example.com/a': `<meta http-equiv="refresh" content="0;url=${DESTINO}">`,
    [DESTINO]: '<h1>Curso de marca personal</h1>',
  };
  const pedidas: string[] = [];
  const bajar = async (u: string) => { pedidas.push(u); return { html: paginas[u] ?? '', final: u }; };
  assert.deepEqual(await paginaFinal(BASE, bajar), { html: paginas[DESTINO], final: DESTINO });
  assert.deepEqual(pedidas, [BASE, 'https://corto.example.com/a', DESTINO]);

  // Dos que se mandan una a la otra: se corta, no se cuelga.
  let n = 0;
  const bucle = async (u: string) => { n++; return { html: `<script>location.href="${u.endsWith('/a') ? 'https://x.example.com/b' : 'https://x.example.com/a'}"</script>`, final: u }; };
  await paginaFinal('https://x.example.com/a', bucle);
  assert.equal(n, SALTOS_DEL_CLIENTE + 1, 'la primera y tres saltos');

  await assert.rejects(paginaFinal(BASE, async () => { throw new Error('403'); }), /403/, 'si no se puede bajar, tira (la ruta dice «no-pudo»)');
});

test('3. lo que pinta el marco cuenta sólo si es la página', () => {
  const buena = { tipo: 'pinto', texto: 240, muestra: 'Marca Personal 360 · 22 de noviembre · Monterrey', titulo: 'Marca Personal 360' };
  assert.equal(marcoVerificado(buena), 'si');
  assert.equal(marcoVerificado({ ...buena, tipo: 'listo' }), 'si', 'el primer aviso también, si ya pintó');
  assert.equal(marcoVerificado({ ...buena, texto: TEXTO_MINIMO_PINTADO - 1 }), 'espera', 'poco texto: todavía no');
  assert.equal(marcoVerificado({ tipo: 'pinto', texto: 30, muestra: '500 Internal Server Error', titulo: '500' }), 'no', 'su «500»');
  assert.equal(marcoVerificado({ tipo: 'pinto', texto: 400, muestra: 'Application error: a client-side exception has occurred', titulo: '' }), 'no');
  assert.equal(marcoVerificado({ tipo: 'error', texto: 0 }), 'no', 'el documento de error de la ruta');
  assert.equal(marcoVerificado({ tipo: 'cita', texto: 900 }), 'espera', 'otro mensaje del protocolo no decide');
  assert.equal(marcoVerificado({ tipo: 'pinto', texto: '900' }), 'espera', 'un número que no es número no cuenta');
});

test('4. una página de error se reconoce por su título o su principio', () => {
  assert.equal(esPaginaDeError('500', ''), true);
  assert.equal(esPaginaDeError('404: This page could not be found.', ''), true);
  assert.equal(esPaginaDeError('', 'Error 502 · Bad Gateway'), true);
  assert.equal(esPaginaDeError('Algo salió mal. Intenta de nuevo.', ''), true);
  assert.equal(esPaginaDeError('500 personas compraron esta semana el curso de marca personal', 'Curso'), false, '«500 personas» es una página');
  assert.equal(esPaginaDeError(`Error 404 y cómo arreglarlo: ${'una guía larga sobre errores de páginas. '.repeat(8)}`, 'Blog'), false, 'un texto largo sobre errores es una página');
});

test('5. la pantalla: escondido con su esqueleto hasta que el marco avisa; sin aviso, «Abrir»', () => {
  const src = sinComentarios(leer('app/competitor-spy/SusPaginas.tsx'));
  assert.match(src, /e\.source !== marco\.current\?\.contentWindow/, 'sólo los avisos de SU marco cuentan');
  assert.match(src, /marcoVerificado\(e\.data as AvisoDelMarco\)/);
  assert.match(src, /style=\{veredicto === 'si' \? undefined : \{ visibility: 'hidden' \}\}/, 'escondido (cargando) hasta verificarse');
  assert.match(src, /\{veredicto !== 'si' && <EsqueletoPagina \/>\}/, 'con su esqueleto encima');
  assert.match(src, /window\.setTimeout\(\(\) => setVisto\(\(m\) => \(m\[clave\] \? m : \{ \.\.\.m, \[clave\]: 'no' \}\)\), PLAZO_MARCO_MS\)/, 'sin aviso a tiempo, no se muestra');
  assert.match(src, /const conAbrirGrande = !conVistaPrevia \|\| estado === 'no-pudo' \|\| veredicto === 'no';/);
  assert.match(src, /src=\{conWs\(srcPaginaDiagnostico\(destino\), ws\)\}/, 'el destino de un acortador, no el acortador');
  const alCargar = src.slice(src.indexOf('const alCargar = () => {'), src.indexOf('const conAbrirGrande'));
  assert.ok(alCargar.length > 50 && alCargar.length < 900, 'el recorte es alCargar');
  assert.match(alCargar, /if \(cargas\.current < 2 \|\| !clave\) return;/, 'la primera carga es la suya');
  assert.match(alCargar, /delete n\[clave\]/, 'si se va a otra página, vuelve a esperar su aviso');
  assert.match(alCargar, /PLAZO_OTRA_PAGINA_MS/);
});

test('6. la ruta: sigue el acortador, la página de error no está abierta, y el destino viaja', () => {
  const r = sinComentarios(leer('app/api/competitor-spy/pagina/route.ts'));
  assert.match(r, /const pagina = await paginaFinal\(url, paginaParaVer\);/);
  assert.match(r, /if \(esPaginaDeError\(texto\.slice\(0, 240\), titulo\)\) \{[\s\S]{0,200}?estado: 'no-pudo'/);
  assert.match(r, /estado: 'abierta', \.\.\.\(final \? \{ final \} : \{\}\)/);
  assert.match(r, /soloAdminDeTab\('market-an'\)/, 'la misma puerta');
  assert.match(r, /if \(!suyas\.some\(/, 'sólo sus páginas: no es un lector de cualquier dirección');
  // El marco avisa la muestra y el título (lib/editor-landing/diagnostico.ts), con los que se reconoce su página de error.
  const d = leer('lib/editor-landing/diagnostico.ts');
  assert.equal((d.match(/muestra: ULTIMO\.slice\(0, 240\), titulo: tituloDe\(\)/g) ?? []).length, 2, 'en «listo» y en «pinto»');
});
