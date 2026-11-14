// =============================================================================
// El reel de prueba (Trial Reels) desde el piloto de Instagram (14/11/2026)
// =============================================================================
// Martín a Julio (13/11): «publica sola en Trial Reels». Zernio lo recibe en `platformSpecificData.trialParams.graduationStrategy`
// (docs.zernio.com/platforms/instagram/fields) y Meta sólo lo acepta en un REEL. Fija:
//   · «Lo hago solo» = SS_PERFORMANCE (Instagram lo pasa al feed si le va bien); «Te pregunto» = MANUAL; apagado de fábrica;
//   · sólo un reel de Instagram lleva `trialParams`: una historia, un post o un video de otra red salen como siempre;
//   · sin el modo, el cuerpo es el de siempre.
// Correr: node --import tsx --test tests/copiloto-reel-de-prueba.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADUACION_DE_PRUEBA, pilotoDeFabrica, sanearPilotoRedes } from '../lib/copiloto/piloto-redes';
import { cuerpoDelPost, type EventoParaPublicar } from '../lib/calendario-publicar-reglas';

const EV: EventoParaPublicar = {
  id: 'e1', tipo: 'publicacion', formato: 'reel', titulo: 'Reel', inicio: '2026-11-20T15:00:00Z', dia_completo: false, estado: 'planeado',
  red: 'instagram', cuenta_red: 'acc1', archivo: 'x.mp4', archivo_tipo: 'video', texto: 'Comenta GUÍA', post_id: null, publicacion: null,
  publicacion_motivo: null, publicacion_url: null,
};

test('los modos: solo pasa al feed si le va bien, te pregunto lo pasas tú; apagado de fábrica', () => {
  assert.deepEqual(GRADUACION_DE_PRUEBA, { no: null, solo: 'SS_PERFORMANCE', pregunta: 'MANUAL' });
  const fab = pilotoDeFabrica(null);
  assert.equal(fab.instagram.reelDePrueba, 'no');
  assert.equal(sanearPilotoRedes({ instagram: { reelDePrueba: 'solo' } }, fab).instagram.reelDePrueba, 'solo');
  assert.equal(sanearPilotoRedes({ instagram: { reelDePrueba: 'siempre' } }, fab).instagram.reelDePrueba, 'no', 'lo que no existe, apagado');
});

test('sólo un reel de Instagram lleva trialParams', () => {
  const c = cuerpoDelPost(EV, 'https://supa.test/x.mp4', { prueba: 'SS_PERFORMANCE' });
  assert.deepEqual(c.platforms[0].platformSpecificData, { contentType: 'reel', trialParams: { graduationStrategy: 'SS_PERFORMANCE' } });
  assert.deepEqual(cuerpoDelPost(EV, 'u', { prueba: 'MANUAL' }).platforms[0].platformSpecificData?.trialParams, { graduationStrategy: 'MANUAL' });
  assert.deepEqual(cuerpoDelPost({ ...EV, formato: 'story' }, 'u', { prueba: 'MANUAL' }).platforms[0].platformSpecificData, { contentType: 'story' });
  assert.equal(cuerpoDelPost({ ...EV, red: 'facebook' }, 'u', { prueba: 'MANUAL' }).platforms[0].platformSpecificData?.trialParams, undefined);
  assert.equal(cuerpoDelPost({ ...EV, red: 'tiktok', formato: 'video' }, 'u', { prueba: 'MANUAL' }).platforms[0].platformSpecificData, undefined);
});

test('sin el modo, el cuerpo de siempre', () => {
  assert.deepEqual(cuerpoDelPost(EV, 'u'), cuerpoDelPost(EV, 'u', { prueba: null }));
  assert.deepEqual(cuerpoDelPost(EV, 'u').platforms[0].platformSpecificData, { contentType: 'reel' });
});
