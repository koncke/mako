// «Subir creativos» del Media Buyer acepta un video que MaKo YA generó (lo prometido a Thiago, docs/promesas/2910-llamada-thiago.md,
// [31:25]: «que "Subir creativos" del Media Buyer deje elegir un video ya generado. Hoy solo acepta archivos del disco»).
// Corre la parte PURA de verdad (lib/media-buyer/creativos.ts) y fija el cableado del servidor (lib/media-buyer/subir.ts).
//
// Lo que fija:
//   · un video de MaKo llega SÓLO con su `ref` (montaje o toma con su clip): la url nunca viaja desde el navegador, y una ref
//     sin la forma de lib/creativo-mako.ts no se cuela como si fuera un archivo del staging;
//   · `original` (contra qué anuncio se prueba) es un id numérico o nada;
//   · el servidor resuelve cada ref en el negocio con resolverCreativoMako (la MISMA que arma la lista), la idempotencia de un
//     video de MaKo va atada a la subida, y la decisión anota el original para que el Relevo lo compare.
//
// Probado rompiéndolo (6/11/2026), base 6/0:
//   · `leerPedidoDeSubida` aceptando cualquier ref (sin `leerRefCreativo`) → 1 fallo, 5 pases;
//   · `archivoValido` sin mirar la ref (sólo el path) → 1 fallo, 5 pases;
//   · `subirCreativos` sin resolver la ref (usando la url del pedido) → 1 fallo, 5 pases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archivoValido, leerPedidoDeSubida } from '../lib/media-buyer/creativos';
import { esPathDeStaging } from '../lib/ads-staging';

const PLAN = '3f2a9c1e-1111-4222-8333-444455556666';
const TOMA = `toma:${PLAN}:2:op_abc-123`;

test('un video de MaKo entra por su ref: sin path, como video, y la url que mande el navegador se descarta', () => {
  const p = leerPedidoDeSubida({
    adSetId: '120', archivos: [{ ref: TOMA, nombre: 'Hook del avatar', tipo: 'image', url: 'https://otro.com/ajeno.mp4', path: 'nueva/x' }, { ref: 'montaje:77', nombre: 'Anuncio' }],
  });
  assert.deepEqual(p.archivos, [
    { path: '', tipo: 'video', nombre: 'Hook del avatar', ref: TOMA },
    { path: '', tipo: 'video', nombre: 'Anuncio', ref: 'montaje:77' },
  ]);
});

test('una ref sin la forma de lib/creativo-mako.ts no se cuela: queda sin ref y sin path, y no es un archivo válido', () => {
  const p = leerPedidoDeSubida({ adSetId: '120', archivos: [{ ref: `toma:${PLAN}:2`, nombre: 'vieja' }, { ref: 'https://x.com/v.mp4', nombre: 'url' }, { ref: 'montaje:../1', nombre: 'raro' }] });
  for (const a of p.archivos) {
    assert.equal(a.ref, undefined);
    assert.equal(a.path, '');
    assert.equal(archivoValido(a, esPathDeStaging), false, `«${a.nombre}» no se puede subir`);
  }
});

test('archivoValido: el del disco con su path del staging, el de MaKo con su ref', () => {
  assert.equal(archivoValido({ path: 'nueva/1700000000000-a-x.mp4', tipo: 'video', nombre: 'x' }, esPathDeStaging), true);
  assert.equal(archivoValido({ path: '../otro/x.mp4', tipo: 'video', nombre: 'x' }, esPathDeStaging), false);
  assert.equal(archivoValido({ path: '', tipo: 'video', nombre: 'x', ref: TOMA }, esPathDeStaging), true);
});

test('original: un id numérico de anuncio, o nada', () => {
  assert.equal(leerPedidoDeSubida({ original: '120230000001' }).original, '120230000001');
  assert.equal(leerPedidoDeSubida({ original: 'act_1' }).original, null);
  assert.equal(leerPedidoDeSubida({}).original, null);
});

test('el servidor resuelve la ref en el negocio con la MISMA función que arma la lista, y nunca con la url del pedido', () => {
  const src = readFileSync('lib/media-buyer/subir.ts', 'utf8').replace(/\r\n/g, '\n');
  const revisar = src.slice(src.indexOf('export async function revisarSubida('), src.indexOf('export async function subirCreativos('));
  assert.match(revisar, /resolverCreativoMako\(ref\)/);
  assert.match(revisar, /if \(c === 'cambio'\) return \{ ok: false/, 'una toma que se volvió a filmar después de elegirla no sale');
  assert.match(revisar, /archivos\.push\(\{ \.\.\.a, tipo: [^}]*url: c\.url \}\)/, 'la url sale de lo resuelto');
  const subir = src.slice(src.indexOf('export async function subirCreativos('));
  // La ref nueva: una subida = una decisión, así que deshacer y volver a subir el mismo video es otro anuncio.
  assert.match(subir, /const clave = a\.ref \? `mb-subir:\$\{ws\}:\$\{d\.id\}:\$\{a\.ref\}`/);
  assert.match(subir, /anuncioBase: \{ id: original\.id/, 'el Relevo necesita saber contra quién se probó');
  // Y la lista que se ofrece sale de las lecturas de lib/creativo-mako-fuentes.ts (las mismas que resuelven una ref).
  assert.match(src, /montadosDelWorkspace\(\), tomasDelWorkspace\(\)/);
});

test('la pantalla y la API reciben los videos de MaKo para elegirlos (subir_preparar y preparar_subida_media_buyer)', () => {
  const ruta = readFileSync('app/api/media-buyer/route.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(ruta, /generados = await generadosDelNegocio\(ws\)/);
  assert.match(ruta, /subirCreativos\(ws, \{ adSetId, archivos, textos, activo, original \}, quien\)/);
  const run = readFileSync('lib/api-mako/areas/ads.run.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(run, /generadosDelNegocioMB\(ctx\.ws\)/);
});
