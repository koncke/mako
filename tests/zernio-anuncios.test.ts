// =============================================================================
// Publicar y editar anuncios por la Zernio del negocio (23/10/2026)
// =============================================================================
// Con la app propia del cliente en desarrollo, Meta rechaza todo anuncio con creativo NUEVO (1885183,
// ws13: 14 de 14). Zernio crea SÓLO ese anuncio, dentro del conjunto que ya creó MaKo, y cambia los
// textos de uno vivo. Lo demás sigue por Meta con el token del cliente.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ZERNIO_ANUNCIOS_PROBADO, rutaDelAnuncio, cuerpoAnuncioEnConjunto, cuerpoCambiarTextos, idsDelAnuncioCreado, subcodeDeZernio,
} from '../lib/zernio-ads-cuerpo';
import type { Creative } from '../lib/campaign-types';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const conexion = { accountId: 'z_meta_1', adAccountId: 'act_1426493815659364' };

test('Zernio sólo para el creativo NUEVO y con conexión; reusar un post propio sigue por Meta', () => {
  assert.equal(rutaDelAnuncio({ source: 'upload' }, conexion), 'zernio');
  assert.equal(rutaDelAnuncio({ source: 'upload' }, null), 'meta');
  // «Usar un ganador» pasa hoy con el token del cliente (medido el 16/09): no se manda a Zernio.
  assert.equal(rutaDelAnuncio({ source: 'existing' }, conexion), 'meta');
});

test('el anuncio va EN PAUSA dentro del conjunto de MaKo, sin tocar presupuesto ni puja', () => {
  const c: Creative = { source: 'upload', media_type: 'video', video_id: '9001', thumbnail_url: 'data:image/png;base64,xx', primary_text: 'Texto', headline: 'Título', cta_type: 'LEARN_MORE', destination_url: 'https://hola-mako.com/' };
  const b = cuerpoAnuncioEnConjunto({ conexion, adSetId: '777', nombre: 'Anuncio 1', creative: c, pageId: 'P1', instagramAccountId: 'IG1' });
  assert.equal(b.adSetId, '777');
  assert.equal(b.adAccountId, 'act_1426493815659364');
  assert.equal(b.accountId, 'z_meta_1');
  assert.equal(b.status, 'PAUSED');
  assert.equal(b.adStatus, 'PAUSED');
  assert.deepEqual(b.video, { id: '9001' }); // la vista local (data:) no viaja como miniatura
  assert.equal(b.body, 'Texto');
  assert.equal(b.headline, 'Título');
  assert.equal(b.callToAction, 'LEARN_MORE');
  assert.equal(b.linkUrl, 'https://hola-mako.com/');
  assert.equal(b.pageId, 'P1');
  assert.equal(b.instagramAccountId, 'IG1');
  // Con adSetId Zernio da 400 si se le pasa la puja, y el presupuesto lo hereda del conjunto.
  for (const k of ['bidStrategy', 'budgetAmount', 'budgetType', 'goal', 'existingCampaignId']) assert.ok(!(k in b), k);
});

test('la imagen va por su URL de Meta, no por la vista local del navegador; sin URL no se publica', () => {
  const c: Creative = { source: 'upload', media_type: 'image', image_hash: 'abc', thumbnail_url: 'data:image/png;base64,xx', primary_text: 'T', lead_form_id: 'F1' };
  const b = cuerpoAnuncioEnConjunto({ conexion, adSetId: '1', nombre: 'n', creative: c, imagenUrl: 'https://scontent.xx.fbcdn.net/img.jpg' });
  assert.equal(b.imageUrl, 'https://scontent.xx.fbcdn.net/img.jpg');
  // Formulario sin botón elegido: el de siempre de MaKo para leads.
  assert.equal(b.leadGenFormId, 'F1');
  assert.equal(b.callToAction, 'SIGN_UP');
  assert.throws(() => cuerpoAnuncioEnConjunto({ conexion, adSetId: '1', nombre: 'n', creative: c, imagenUrl: null }), /dirección pública/);
});

test('cambiar textos manda sólo lo que cambió, adentro de creative', () => {
  assert.deepEqual(cuerpoCambiarTextos({ primary_text: 'Nuevo', headline: 'H' }), { creative: { body: 'Nuevo', headline: 'H' } });
  assert.deepEqual(cuerpoCambiarTextos({ cta_type: 'NO_BUTTON', destination_url: 'https://x.com' }), { creative: { linkUrl: 'https://x.com' } });
  assert.throws(() => cuerpoCambiarTextos({}), /ningún texto/);
});

test('la respuesta de Zernio: el id de META del anuncio, o un error; el subcode de Meta adentro de su error', () => {
  assert.deepEqual(idsDelAnuncioCreado({ ad: { _id: 'z1', platformAdId: '120000' } }), { adId: '120000', zernioId: 'z1' });
  assert.deepEqual(idsDelAnuncioCreado({ ads: [{ platformAdId: 120001 }] }), { adId: '120001', zernioId: null });
  assert.throws(() => idsDelAnuncioCreado({ ad: { _id: 'z1' } }), /platformAdId/);
  assert.equal(subcodeDeZernio({ type: 'platform_error', platformError: { error_subcode: 1885183 } }), 1885183);
  assert.equal(subcodeDeZernio({ error: 'x' }), null);
});

test('la clave es la del NEGOCIO: la de la plataforma sólo en el negocio de la plataforma', () => {
  const src = leer('../lib/zernio-ads.ts');
  assert.match(src, /if \(ws === \(await wsSuperAdmin\(\)\.catch\(\(\) => null\)\)\) return envCred\('ZERNIO_API_KEY'\);\n\s*const base = await credDelCliente\('ZERNIO_API_KEY', ws\);\n\s*if \(!base\) return null;/);
  // Con varias claves (29/10/2026), la dueña de la conexión de anuncios, SÓLO entre las del negocio (`cfgDeCuenta`); si no, la suya.
  assert.match(src, /return \(await cfgDeCuenta\(ws, conexion\)\.catch\(\(\) => null\)\)\?\.apiKey \?\? base;/);
  // Nada más en el archivo resuelve claves: ni `credWs` (cae a la del dueño) ni `cfg` del canal (cae a la plataforma).
  assert.doesNotMatch(src, /\bcredWs\(|from '\.\/zernio'.*\bcfg\b/);
  // Se publica sólo en la cuenta publicitaria EXACTA del negocio.
  assert.match(src, /adAccountId: act \}\);\n[\s\S]*?l\?\.accounts\?\.some\(\(x\) => x\.id === act\)/);
});

test('si Zernio no contesta, se publica por Meta como siempre; y no se ofrece hasta la prueba', () => {
  const lib = leer('../lib/meta-ads-create.ts');
  assert.match(lib, /conexionAnunciosZernio\(ws, await credWs\('META_AD_ACCOUNT_ID', ws\)\)\.catch\(/);
  assert.match(lib, /const conexion = ad\.creative\.source === 'existing' \? null : await conexionZernioDelWs\(\);/);
  // Un rechazo que vuelve por Zernio nombra a Zernio y conserva el subcode de Meta: la traducción de
  // rechazos de siempre (meta-publicar-errores) lo reconoce igual.
  // (26/10/2026: el mismo texto dice «leerlo en Meta» cuando lo que falló por Zernio es una lectura.)
  assert.match(lib, /const z = leerErrorDeZernio\(e\);\n\s*if \(!z\) return e;\n\s*return new MetaWriteError\(`Zernio no pudo \$\{que === 'leer' \? 'leerlo en Meta' : 'publicar'\}: \$\{z\.mensaje\}`, undefined, z\.subcode \?\? undefined\);/);
  // Y meta-ads-create no importa el cliente de Zernio: lo lee por lib/zernio-ads (tests/sin-instagram.test.ts).
  assert.doesNotMatch(lib, /from '\.\/zernio'/);
  assert.match(lib, /crearAnuncioPorZernio\([^\n]*\)\.catch\(\(e\) => \{ throw errorDeZernio\(e\); \}\);/);
  // Con el interruptor apagado, NINGÚN anuncio sale por Zernio aunque el negocio tenga clave y conexión (ws11 y
  // ws13 ya tienen su clave): la ruta nueva no corre hasta la prueba. La excepción (26/10/2026) es el negocio que conectó
  // Meta POR Zernio («Conectar con Facebook», `canalMeta` → zernio): sin token no hay otro camino, y se midió en la cuenta de
  // MaKo (tests/zernio-meta-escribir.test.ts).
  assert.match(lib, /async function conexionZernioDelWs\(\)[^{]*\{[\s\S]{0,400}?if \(!ZERNIO_ANUNCIOS_PROBADO\) return null;/);
  // La prueba que decide no corrió: hasta entonces la pantalla no ofrece conectar Zernio para anuncios.
  assert.equal(ZERNIO_ANUNCIOS_PROBADO, false);
});
