// =============================================================================
// Ticket #28 (29/10/2026): una sola pestaña, la de Zernio, y ningún token de Meta a la vista
// =============================================================================
// Martín, por WhatsApp en el grupo de MaKo (29/10, 12:56): «en una sola pestaña, la de Zernio, se pueda configurar tanto para
// pegar primero tu API y después para loguearte. Tenés que loguearte en Facebook, en Instagram, en varios lugares... y tampoco
// ya no debería pedirte nada de Access Token. Toda esa parte de los tokens ya no debería existir directamente».
// Lo que tiene que pasar:
//   1. META SE CONFIGURA EN ZERNIO: `?abrir=meta` y «conectar Meta» desde cualquier tab abren Zernio. La tarjeta de Meta queda como
//      el ESTADO de la cuenta (saldo, medio de pago, entrega), y su modal no pide nada: lleva a Zernio.
//   2. ZERNIO EN DOS PASOS: 1) la API key; 2) las redes, cada una con su login (Facebook, Instagram, TikTok, YouTube) y «Anuncios
//      de Meta» con su cuenta publicitaria y su píxel. Sin la clave, el paso 2 dice qué falta.
//   3. NINGÚN TOKEN DE META A LA VISTA: ni en la pantalla, ni en las notas y ayudas, ni en lo que MaKo dice, ni en la API.
//   4. LA GRILLA mide Meta como los demás lectores: conectada sólo por Zernio también cuenta, y lo que falta se dice en palabras.
//   5. LO QUE NO SE ROMPE: el corte sigue el 03/11 (el aviso que salió lo prometió), y el token guardado no se borra.
//
// Correr: node --import tsx --test tests/zernio-una-pestana.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { integracionQueConfigura, SE_CONFIGURA_EN, META_SE_CONECTA_EN_ZERNIO } from '../lib/integraciones-catalogo';
import { REDES, REDES_VISIBLES } from '../lib/zernio-redes';
import { CORTE_TOKEN_META } from '../lib/zernio-meta-cuerpo';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: lo que se mira es lo que corre y lo que se dibuja, no la historia. */
const codigo = (rel: string) => fuente(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');
/** Lo que un cliente LEE de Meta: un token nombrado, o la instrucción de pegarlo o generarlo. */
const NOMBRA_EL_TOKEN = /token de meta|access token|token del p[ií]xel|token de la p[aá]gina|pega(r|lo)? (un|el|tu) token|generar (nuevo )?token|o pega un token/i;

test('meta se configura en Zernio: el «dónde» es uno y lo usan ?abrir= y el botón de cualquier tab', () => {
  assert.equal(integracionQueConfigura('meta'), 'zernio');
  assert.equal(integracionQueConfigura('zernio'), 'zernio');
  assert.equal(integracionQueConfigura('calendly'), 'calendly', 'las demás se configuran en su tarjeta');
  assert.deepEqual(Object.keys(SE_CONFIGURA_EN), ['meta']);
  assert.match(codigo('app/_components/ConectarIntegracion.tsx'), /setAbierto\(\{ servicio: integracionQueConfigura\(servicio\), motivoGoogle \}\)/);
  const tablero = codigo('app/integraciones/IntegracionesBoard.tsx');
  assert.match(tablero, /const abrirCrudo = searchParams\.get\('abrir'\);\s*const abrir = abrirCrudo \? integracionQueConfigura\(abrirCrudo\) : null;/);
});

test('el modal de Meta no pide nada: lleva a Zernio (sin token, sin «Conectar con Meta», sin «O pega un token»)', () => {
  const f = codigo('app/integraciones/ServicioConfigForm.tsx');
  const bloque = f.slice(f.indexOf("{servicio.key === 'meta' && (\n        <div data-meta-en-zernio"));
  assert.ok(bloque.length > 0, 'el bloque que lleva a Zernio');
  assert.match(bloque.slice(0, 1600), /onClick=\{\(\) => integracion\.abrir\('zernio'\)\}/);
  assert.doesNotMatch(f, /ConectarMetaZernio/, 'conectar Meta vive en el paso 2 de Zernio, no acá');
  assert.doesNotMatch(f, /\/api\/integraciones\/meta[?'`]/, 'el «Conectar con Meta» de la app propia no se ofrece');
  assert.doesNotMatch(f, NOMBRA_EL_TOKEN);
  // Los campos: un token de Meta no se ve NUNCA, ni el de antes.
  assert.match(f, /\.filter\(\(c\) => !\(servicio\.key === 'meta' && esTokenDeMeta\(c\.env\)\)\)/);
  assert.match(f, /const esTokenDeMeta = \(env: string\): boolean => \/\^META_\[A-Z_\]\*TOKEN\$\/\.test\(env\);/);
});

test('Zernio en dos pasos: la clave, y después las redes (con «Anuncios de Meta», TikTok y YouTube); sin clave, dice qué falta', () => {
  const f = codigo('app/integraciones/ServicioConfigForm.tsx');
  assert.match(f, /data-paso-zernio="1"[^>]*>Paso 1 · Pega tu API key de Zernio</);
  assert.match(f, /servicio\.key === 'zernio' && servicio\.campos\.some\(\(c\) => c\.configurado\) && <ConectarRedes \/>/);
  const sinClave = f.slice(f.indexOf("servicio.key === 'zernio' && !servicio.campos.some((c) => c.configurado) && ("));
  assert.ok(sinClave.length > 0, 'sin la clave, el paso 2 igual se ve');
  assert.match(sinClave.slice(0, 900), /Paso 2 · Conecta tus redes[\s\S]*Falta tu API key de Zernio \(paso 1\)/);
  const r = codigo('app/integraciones/ConectarRedes.tsx');
  assert.match(r, /data-paso-zernio="2"[^>]*>Paso 2 · Conecta tus redes</);
  assert.match(r, /REDES_VISIBLES\.filter\(\(red\) => !REDES\[red\]\.anuncios\)\.map\(/, 'los anuncios no son una fila suelta');
  assert.match(r, /<ConectarMetaZernio onGuardado=\{/, '«Anuncios de Meta», con la cuenta publicitaria y el píxel');
  for (const red of ['facebook', 'instagram', 'tiktok', 'youtube', 'metaads'] as const) assert.ok(REDES_VISIBLES.includes(red), `${red} se ve`);
  assert.equal(REDES.metaads.anuncios, true);
  const m = codigo('app/integraciones/ConectarMetaZernio.tsx');
  assert.match(m, /volver: '\/integraciones\?abrir=zernio'/, 'la vuelta del login es a Zernio');
  assert.doesNotMatch(m, NOMBRA_EL_TOKEN);
  assert.doesNotMatch(m, /tokens/i);
});

test('ninguna nota, ayuda ni tutorial de Meta nombra el token, y los tokens de Meta están retirados', () => {
  const c = fuente('lib/metodo-catalogo.ts');
  const meta = c.slice(c.indexOf("key: 'meta',"), c.indexOf("key: 'zernio',"));
  for (const env of ['META_ACCESS_TOKEN', 'META_PAGE_ACCESS_TOKEN', 'META_CAPI_TOKEN']) {
    const linea = meta.split('\n').find((l) => l.includes(`env: '${env}'`)) ?? '';
    assert.match(linea, /retirado: true/, `${env} retirado`);
  }
  const textos = [...meta.matchAll(/(?:nota|label): '((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
  const pasosMeta = meta.slice(meta.indexOf('pasos: ['), meta.indexOf('],', meta.indexOf('pasos: [')));
  const ayudas = [...c.matchAll(/\n  (META_[A-Z_]+): \{\n    pasos: \[([\s\S]*?)\],/g)].map((x) => `${x[1]}: ${x[2]}`);
  assert.ok(ayudas.length >= 5, `se leyeron ${ayudas.length} ayudas de Meta: el extractor quedó viejo`);
  for (const t of [...textos, pasosMeta, ...ayudas]) assert.doesNotMatch(t, NOMBRA_EL_TOKEN, t.slice(0, 120));
  assert.match(pasosMeta, /Paso 1: pega tu API key de Zernio/);
  assert.match(pasosMeta, /Paso 2: en «Anuncios de Meta» toca "Conectar con Facebook"/);
});

test('lo que MaKo dice y su API: sin token de Meta (los pasos que dicta, ver_conexion_meta, ver_integracion, las descripciones)', () => {
  const cx = codigo('lib/conexiones-catalogo.ts');
  const pasos = cx.slice(cx.indexOf('const META_POR_ZERNIO = {'), cx.indexOf('} as const;', cx.indexOf('const META_POR_ZERNIO = {')));
  assert.match(pasos, /Si te pide la "API key de Zernio" \(paso 1\)/);
  assert.match(pasos, /En "Anuncios de Meta" \(paso 2\), toca "Conectar con Facebook"/);
  assert.doesNotMatch(pasos, NOMBRA_EL_TOKEN);
  const run = codigo('lib/api-mako/areas/integraciones.run.ts');
  assert.doesNotMatch(run, /token_del_pixel/, 'el modelo no ve «token»: lo explicaba');
  assert.match(run, /conexion_anterior_del_pixel: !!tokenPixel/);
  assert.match(run, /\(!c\.retirado \|\| \(e\?\.configurado && !\/\^META_\[A-Z_\]\*TOKEN\$\/\.test\(c\.env\)\)\)/, 'ver_integracion no lista un token de Meta, ni cargado');
  for (const def of ['lib/api-mako/areas/integraciones.def.ts', 'lib/api-mako/areas/ads.def.ts']) assert.doesNotMatch(codigo(def), /token de Meta|token del p[ií]xel/i, def);
  // Lo que ve la persona en el Media Buyer, en la conexión de Meta y en la extracción del onboarding.
  for (const f of ['lib/media-buyer/datos.ts', 'lib/meta-conexion-zernio.ts', 'lib/onboarding-extract.ts']) assert.doesNotMatch(codigo(f), /El token de Meta|Token de Meta inválido|token del p[ií]xel|Token del p[ií]xel|ni con el token/, f);
});

test('la grilla mide Meta como los otros lectores: conectada sólo por Zernio cuenta, y lo que falta se dice en palabras', () => {
  const g = codigo('lib/integraciones.ts');
  const meta = g.slice(g.indexOf("if (d.key === 'meta' && faltan.length) {"));
  assert.ok(meta.length > 0);
  assert.match(meta.slice(0, 900), /metaConectadaConCampos\(\(e\) => tiene\.get\(e\) === true\)/);
  assert.match(meta.slice(0, 900), /detalle: conectada \? 'Conectada y operativa\.' : META_SE_CONECTA_EN_ZERNIO/);
  assert.doesNotMatch(META_SE_CONECTA_EN_ZERNIO, NOMBRA_EL_TOKEN);
  assert.match(META_SE_CONECTA_EN_ZERNIO, /Zernio/);
});

test('lo que no se rompe: el corte sigue el 03/11 (lo prometió el aviso) y ninguna pantalla borra un token guardado', () => {
  assert.equal(CORTE_TOKEN_META, '2026-11-03');
  // El aviso que salió el 28/10 (C:/dev/revisiones/2810-avisos-token-0311.md): «Tus números se siguen viendo» → leer sigue.
  for (const f of ['app/integraciones/ServicioConfigForm.tsx', 'app/integraciones/ConectarRedes.tsx', 'app/integraciones/ConectarMetaZernio.tsx']) {
    assert.doesNotMatch(codigo(f), /quitar[^\n]*META_ACCESS_TOKEN|borrar[^\n]*META_[A-Z_]*TOKEN/, f);
  }
});
