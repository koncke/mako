// «VOLVER A VINCULAR POR QR» EN «TU NÚMERO», CON LA LÍNEA CONECTADA Y SORDA (13/11/2026).
//
// El 12-13/11 la voz de MaKo estaba en el …3479 (la línea de Martín, por su decisión) y sorda: figuraba CONECTADA y no recibía.
// «Vincular por QR» de «Tu número» (/agencia) sólo aparecía con la línea desconectada, así que para re-vincularla Martín tenía que
// cerrar el dispositivo desde su teléfono primero. `conectar` (lib/evolution.ts) ya sabía soltar una línea marcada sorda y dar el
// QR en un paso; faltaba el botón. Ahora son dos pasos: el botón y escanear. docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (13/11/2026), cada rotura por separado y vuelta atrás:
//   V1 `motivoParaVolverAVincular` sin el corte de la vinculación     → falla «sólo con la marca de esta vinculación»
//   V2 el estado de «Tu número» sin `sorda`                           → falla «el estado lo trae»
//   V3 el panel sin el botón                                          → falla «el panel lo ofrece»
//   V4 el botón con la línea desconectada (sin `personalConectado`)  → falla «el panel lo ofrece»
//   V5 `conectar` sin soltar la línea marcada                         → falla «el clic da el QR en un paso»
//   V6 el aviso con los pasos fijos del canal (…2605)                 → falla «el aviso de voz sorda»
//
// Y LO MISMO EN LA LÍNEA DE MaKo (el …2605, 14/11/2026). La voz volvió al …2605 y quedó sorda otra vez. El aviso decía «Conectar por
// QR», pero ese botón sólo se dibujaba con la línea CAÍDA. `conectarCanalMaKo` ya la soltaba; faltaba, otra vez, el botón.
// PROBADO ROMPIÉNDOLO (14/11/2026), cada rotura por separado y vuelta atrás:
//   C1 `estadoCanalMaKo` sin `sorda`                                  → falla «la línea de MaKo: el estado lo trae»
//   C2 `sorda` también con la línea caída (sin el corte de `conectado`) → falla «la línea de MaKo: el estado lo trae»
//   C3 el panel sin `canalSorda` en el botón                          → falla «la línea de MaKo: el panel lo ofrece»
//   C4 `conectarCanalMaKo` sin soltar la línea marcada                → falla «la línea de MaKo: el clic la suelta»
//   C5 el aviso con «Conectar por QR» (el botón que no estaba)        → falla «el aviso de voz sorda»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisoDeSordera, motivoParaVolverAVincular } from '../lib/linea-sorda';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

const MARCA = { motivo: 'está sorda desde 2026-11-12 17:40 UTC (manda y no recibe de una persona hace 23.9 h)', vinculadaDesde: 1_791_472_194_174 };

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('sólo con la marca medida sobre ESTA vinculación (la misma condición con la que conectar la suelta)', () => {
  assert.equal(motivoParaVolverAVincular(MARCA, MARCA.vinculadaDesde), MARCA.motivo, 'marcada sobre esta vinculación: hay que ofrecerlo');
  assert.equal(motivoParaVolverAVincular(MARCA, MARCA.vinculadaDesde + 60_000), null, 're-vinculada después de la marca: ya se curó, no se ofrece');
  assert.equal(motivoParaVolverAVincular(null, MARCA.vinculadaDesde), null);
  assert.equal(motivoParaVolverAVincular({ ...MARCA, vinculadaDesde: null }, MARCA.vinculadaDesde), null, 'una marca sin vinculación no alcanza');
  assert.equal(motivoParaVolverAVincular(MARCA, null), null, 'sin saber cuándo se vinculó, no');
});

test('el estado de «Tu número» lo trae: la marca y la vinculación de su línea', () => {
  const src = fuenteSinComentarios('lib/mako-canal.ts');
  const estado = bloque(src, 'export async function estadoNumeroPersonal(', 'export async function vincularNumeroPersonal(');
  assert.match(estado, /marcaDeLineaEnferma\(row\.instance_name\)/);
  assert.match(estado, /vinculadaDesdeDeLinea\(row\.instance_name\)/);
  assert.match(estado, /sorda: motivoParaVolverAVincular\(marca, vinculadaAhora\)/);
  assert.match(bloque(src, 'export async function vincularNumeroPersonal(', 'export async function usarNumeroPersonalComoVoz('), /conectar\(\{ linea: row\.instance_name \}\)/,
    'el botón no re-vincula la MISMA línea');
});

test('el panel lo ofrece con la línea conectada y sorda, y no muestra el ✓ de que MaKo habla por ahí', () => {
  const panel = fuenteSinComentarios('app/agencia/CanalMaKoPanel.tsx');
  assert.match(panel, /const personalSorda = personalConectado && !!personal\?\.sorda;/);
  assert.match(panel, /\{personalSorda && \(\s*<button[^>]*onClick=\{vincularPersonal\}>\{qrPersonal \? 'Regenerar QR' : 'Volver a vincular por QR'\}<\/button>/);
  assert.match(panel, /\{personalSorda \? \([\s\S]{0,300}No recibe mensajes[\s\S]{0,40}\) : personal\?\.esVoz && /, 'con la línea sorda sigue el ✓ verde');
});

test('el aviso de voz sorda manda al botón y al teléfono de ESA línea', () => {
  const tuNumero = avisoDeSordera('avisar', 'mandó 2 mensajes a grupos en 30 min y no entró ninguno', 'mako_ws9').cuerpo;
  assert.match(tuNumero, /«Tu número» → «Volver a vincular por QR»/);
  assert.match(tuNumero, /tu teléfono personal/);
  assert.doesNotMatch(tuNumero, /…2605|«Conectar por QR»/, 'con la voz en el …3479 manda al teléfono de MaKo');
  const canal = avisoDeSordera('pedir-qr', 'sigue sin recibir', 'mako_superadmin_muylqv8r').cuerpo;
  assert.match(canal, /«MaKo» → «Volver a vincular por QR»/, 'el aviso nombra el botón que el panel dibuja con la línea sorda');
  assert.match(canal, /teléfono de MaKo \(…2605\)/);
  assert.doesNotMatch(canal, /«Tu número»|teléfono personal/, 'con la voz en el …2605 manda al teléfono de Martín');
});

test('la línea de MaKo: el estado lo trae, sólo con la línea conectada y con la misma marca', () => {
  const src = fuenteSinComentarios('lib/mako-canal.ts');
  const estado = bloque(src, 'export async function estadoCanalMaKo(', 'async function estadoDeLinea(');
  assert.match(estado, /const sorda = linea\.estado === 'conectado'\s*\?\s*motivoParaVolverAVincular\(await marcaDeLineaEnferma\(inst\), await vinculadaDesdeDeLinea\(inst\)/);
  assert.match(estado, /return \{ \.\.\.linea, esVozActiva: [^}]*, sorda \};/);
});

test('la línea de MaKo: el panel lo ofrece con la línea conectada y sorda', () => {
  const panel = fuenteSinComentarios('app/agencia/CanalMaKoPanel.tsx');
  assert.match(panel, /const canalSorda = estado === 'conectado' && !!info\.sorda;/);
  assert.match(panel, /\{\(estado !== 'conectado' \|\| canalSorda\) && !sinConfirmar && <button[^>]*onClick=\{conectar\}>\{busy \? 'Generando…' : qr \? 'Regenerar QR' : canalSorda \? 'Volver a vincular por QR' : 'Conectar por QR'\}<\/button>\}/);
  assert.match(panel, /\{canalSorda && <div[^>]*>No recibe mensajes: vuelve a vincularlo\.<\/div>\}/);
  assert.match(panel, /sorda: j\.sorda \?\? null/, 'el panel tira el `sorda` que manda la ruta');
});

test('la línea de MaKo: el clic la suelta con la misma condición (logout, sin borrarla)', () => {
  const src = fuenteSinComentarios('lib/mako-canal.ts');
  const c = bloque(src, "if (sondeo === 'vivo') {", "if (sondeo === 'sin_respuesta') {");
  assert.match(c, /const marca = await marcaDeLineaEnferma\(inst\);/);
  assert.match(c, /if \(!marca \|\| !puedeSoltarseSorda\(marca, await vinculadaDesdeDeLinea\(inst\)/);
});

test('el clic da el QR en un paso: conectar suelta la línea abierta y marcada sorda, sin borrarla', () => {
  const src = fuenteSinComentarios('lib/evolution.ts');
  const c = bloque(src, 'export async function conectar(', 'if (hayQueRecrear(');
  assert.match(c, /const marca = await marcaDeLineaEnferma\(instance\);/);
  assert.match(c, /if \(marca && puedeSoltarseSorda\(marca, vinculadaDesdeDe\(fila\)\)\)/);
  assert.match(c, /\/instance\/logout\//);
  assert.doesNotMatch(c.slice(c.indexOf('const marca = await marcaDeLineaEnferma')), /\/instance\/delete\//, 'soltar la sorda la borra: se pierde la línea');
});
