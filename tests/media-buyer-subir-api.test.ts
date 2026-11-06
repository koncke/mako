// =============================================================================
// Media Buyer — «Subir creativos» por la API de MaKo (27/10/2026)
// =============================================================================
// Estaba en FALTA de tests/media-buyer-api.test.ts («por la API no hay cómo mandar un video»). Entró en los dos pasos de la
// pantalla: `preparar_subida_media_buyer` (una lectura, sólo por HTTP) devuelve los conjuntos, los textos de partida y una URL
// firmada por archivo (la MISMA firma que creative-signurl, lib/ads-staging-firma.ts), y `subir_creativos_media_buyer` publica
// lo subido (la MISMA subida que la pantalla, lib/media-buyer/subir.ts), confirmada por una persona en /mako/revisar.
// Lo que se fija:
//   · el pedido se lee en UN lugar para la pantalla y la API (`leerPedidoDeSubida`);
//   · lo que va a fallar falla al PROPONER (`revisarSubida` y el staging), y el payload lleva los nombres de los parámetros
//     (la pantalla genérica lo vuelve a validar con ellos: una clave que no es un parámetro se pierde al revisar);
//   · los archivos y el conjunto no se cambian al revisar: `distintoAlRevisar` compara una lista de objetos entera
//     (`String([{…}])` es «[object Object]» para cualquier lista del mismo largo).
// Correr: node --import tsx --test tests/media-buyer-subir-api.test.ts
//
// Roturas (base 6/0, cada una restaurada antes de la siguiente; todas 5/1): `distintoAlRevisar` comparando con String() de
// vuelta; el preparar sin `faltanEnStaging`; el payload con `adSetId` en vez de `adsetId`; la ruta de la pantalla leyendo el
// pedido a mano otra vez; `subirCreativos` sin pasar por `revisarSubida`; la lectura firmando con un path armado a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerPedidoDeSubida } from '../lib/media-buyer/creativos';
import { distintoAlRevisar } from '../lib/api-mako/validar';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El runner `id` de ads.run.ts, hasta el siguiente runner de la misma columna. */
const runner = (id: string) => {
  const src = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  const i = src.indexOf(`\n  ${id}: {`);
  assert.ok(i > 0, `no encontré el runner ${id}`);
  const fin = src.slice(i + 1).search(/\n {2}[a-z_]+: \{/);
  return src.slice(i, fin > 0 ? i + 1 + fin : undefined);
};

test('leerPedidoDeSubida: el conjunto numérico, los archivos con su tipo, el botón y el link saneados, activo por defecto', () => {
  const p = leerPedidoDeSubida({
    adSetId: '120211', archivos: [{ path: 'nueva/1-a-x.mp4', tipo: 'video', nombre: 'x.mp4' }, { path: 'nueva/2-b-y.jpg', tipo: 'gif' }],
    textos: { textoPrincipal: 'Hola', titulo: 'T', cta: 'NO_EXISTE', link: '  ', formularioId: 'abc' },
  });
  assert.equal(p.adSetId, '120211');
  assert.deepEqual(p.archivos, [{ path: 'nueva/1-a-x.mp4', tipo: 'video', nombre: 'x.mp4' }, { path: 'nueva/2-b-y.jpg', tipo: 'image', nombre: 'creativo' }]);
  assert.deepEqual(p.textos, { textoPrincipal: 'Hola', titulo: 'T', cta: 'LEARN_MORE', link: null, formularioId: null });
  assert.equal(p.activo, true, 'como la pantalla: sin decirlo, activo');
  assert.equal(leerPedidoDeSubida({ activo: false }).activo, false);
  assert.equal(leerPedidoDeSubida({ adSetId: '12a' }).adSetId, null, 'un id que no es numérico no llega a Zernio');
  assert.deepEqual(leerPedidoDeSubida({ archivos: 'nueva/x' }).archivos, []);
});

test('distintoAlRevisar: una lista de objetos se compara entera; lo demás, como siempre', () => {
  const a = [{ path: 'nueva/1-a-x.mp4', tipo: 'video' }];
  assert.equal(distintoAlRevisar([{ path: 'nueva/9-z-otro.mp4', tipo: 'video' }], a), true, 'otro archivo del mismo largo');
  assert.equal(distintoAlRevisar(JSON.parse(JSON.stringify(a)), a), false, 'el mismo, ida y vuelta por el formulario');
  assert.equal(distintoAlRevisar({ x: 1 }, { x: 2 }), true);
  assert.equal(distintoAlRevisar('123', 123), false, 'un id como texto o como número es el mismo');
  assert.equal(distintoAlRevisar(['a', 'b'], ['a', 'b']), false);
  assert.equal(distintoAlRevisar(['a', 'c'], ['a', 'b']), true);
  assert.match(sinComentarios(leer('lib/api-mako/acciones.ts')), /if \(distintoAlRevisar\(nuevo, base\[p\.nombre\]\)\) \{/);
});

test('las dos operaciones: una lectura que sale sólo por HTTP, y una acción de plata confirmada en pantalla con lo fijo', () => {
  const prep = porId('preparar_subida_media_buyer')!;
  assert.equal(prep.tipo, 'lectura');
  assert.deepEqual([...prep.canales], ['http'], 'un archivo no viaja por un chat');
  const sub = porId('subir_creativos_media_buyer')!;
  assert.equal(sub.tipo, 'accion');
  assert.deepEqual([...sub.canales], ['http']);
  assert.equal(sub.costo, 'dinero');
  assert.equal('confirmacion' in sub ? sub.confirmacion : null, 'pantalla');
  const fijos = sub.parametros.filter((p) => p.fijoAlRevisar).map((p) => p.nombre).sort();
  // `original` (6/11/2026): contra qué anuncio se prueban los creativos (el Relevo pausa el original si uno le gana). También
  // es sobre QUÉ se hace: cambiarlo al revisar cambiaría qué anuncio puede terminar pausado.
  assert.deepEqual(fijos, ['adsetId', 'archivos', 'original'], 'sobre QUÉ se hace no se cambia al revisar');
});

test('subir_creativos_media_buyer: lo que va a fallar falla al proponer, y el payload lleva los nombres de los parámetros', () => {
  const r = runner('subir_creativos_media_buyer');
  const prep = r.slice(0, r.indexOf('ejecutar:'));
  const iPayload = prep.indexOf('payload: {');
  assert.ok(prep.indexOf('await revisarSubidaMB(ctx.ws,') > 0 && prep.indexOf('await revisarSubidaMB(ctx.ws,') < iPayload, 'la misma revisión que la pantalla, antes del payload');
  assert.ok(prep.indexOf('await faltanEnStaging(') > 0 && prep.indexOf('await faltanEnStaging(') < iPayload, 'un archivo que no está no se propone');
  assert.match(prep, /const p = leerPedidoDeSubida\(/);
  // El payload: cada clave es un parámetro declarado (la pantalla genérica lo valida otra vez con los parámetros).
  const literal = prep.slice(iPayload + 'payload: {'.length, prep.indexOf('},', iPayload));
  const claves = [...literal.matchAll(/([a-zA-Z]+):/g)].map((m) => m[1]);
  const params = new Set(porId('subir_creativos_media_buyer')!.parametros.map((p) => p.nombre));
  assert.ok(claves.length >= 8, `leí ${claves.length} claves del payload`);
  assert.deepEqual(claves.filter((c) => !params.has(c)), [], 'claves del payload que no son parámetros');
  // Y lo que publica es la subida de la pantalla, firmada como «la API de MaKo», con el id para deshacerla.
  const ej = r.slice(r.indexOf('ejecutar:'));
  assert.match(ej, /await subirCreativosMB\(ctx\.ws, \{[^}]*\}, [^,]+, 'la API de MaKo'\)/);
  assert.match(ej, /datos: \{ decisionId: r\.decisionId, anuncios: r\.creados \}/);
});

test('una sola subida, un solo pedido, una sola firma: la pantalla y la API pasan por las mismas funciones', () => {
  const ruta = sinComentarios(leer('app/api/media-buyer/route.ts'));
  const caso = ruta.slice(ruta.indexOf("case 'subir_creativos':"), ruta.indexOf('default:', ruta.indexOf("case 'subir_creativos':")));
  assert.match(caso, /= leerPedidoDeSubida\(body\);/);
  assert.doesNotMatch(caso, /body\.archivos|body\.textos/, 'el pedido no se vuelve a leer a mano');
  const subir = sinComentarios(leer('lib/media-buyer/subir.ts'));
  const sc = subir.slice(subir.indexOf('export async function subirCreativos('));
  assert.match(sc.slice(0, 400), /const rev = await revisarSubida\(ws, x\);\s*if \(!rev\.ok\) return rev;/, 'subirCreativos revisa con la misma función');
});

test('preparar_subida_media_buyer firma con la función de la ruta y barre como ella', () => {
  const r = runner('preparar_subida_media_buyer');
  assert.match(r, /const f = await firmarSubidaDeStaging\(nombre\);/);
  assert.match(r, /after\(\(\) => barrerStagingViejo\(\)\)/);
  assert.match(r, /conjuntosDeMB\(datos\)/);
  assert.match(r, /plantillaDelConjuntoMB\(ctx\.ws, datos, adsetId\)/);
  const firma = sinComentarios(leer('lib/ads-staging-firma.ts'));
  assert.match(firma, /const path = pathNuevoDeStaging\(nombreSeguroDeStaging\(nombre\)\);/);
  assert.match(sinComentarios(leer('app/api/ads-manager/creative-signurl/route.ts')), /await firmarSubidaDeStaging\(/);
});
