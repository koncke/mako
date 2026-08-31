// =============================================================================
// Las plantillas del espejo guardadas del lado del servidor
// =============================================================================
// Existe porque `sanearPlantillas` decide qué se persiste de un pedido
// AUTENTICADO contra Google. Si se equivoca hacia un lado guardamos una
// credencial; si se equivoca hacia el otro, guardamos una plantilla inservible y
// el cliente vuelve a leer «genera uno a mano» sin que nada explique por qué.
// Ninguno de los dos errores da un síntoma en el momento.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanearPlantillas, fundirPlantillas, faltantes, claseDePath, CLASES_UTILES,
  tieneCaraParcheable,
  type PlantillaEspejo,
} from '../lib/flow-plantillas';

const BASE = 'https://aisandbox-pa.googleapis.com';

const plantilla = (extra: Record<string, unknown> = {}) => ({
  clase: 'flowMedia:batchGenerateImages',
  url: `${BASE}/v1/projects/p-real/flowMedia:batchGenerateImages`,
  metodo: 'POST',
  headers: { 'content-type': 'application/json', 'x-client': 'flow' },
  cuerpo: '{"requests":[{"seed":1}]}',
  cuando: 1000,
  ...extra,
});

test('la clase es el último tramo del path, igual que en la extensión', () => {
  assert.equal(claseDePath('/v1/credits?key=abc'), 'credits');
  assert.equal(
    claseDePath('/v1/video:batchCheckAsyncVideoGenerationStatus'),
    'video:batchCheckAsyncVideoGenerationStatus',
  );
  assert.equal(
    claseDePath('/v1/projects/9973/flowMedia:batchGenerateImages'),
    'flowMedia:batchGenerateImages',
  );
});

test('la lista de clases útiles sale de ENDPOINTS y trae la del estado', () => {
  // La que faltaba el día que esto se escribió, y la razón de todo el trabajo.
  assert.ok(CLASES_UTILES.includes('video:batchCheckAsyncVideoGenerationStatus'));
  assert.ok(CLASES_UTILES.includes('flowMedia:batchGenerateImages'));
  assert.ok(CLASES_UTILES.includes('credits'));
  // Y NO trae lo que Flow pide para otras cosas: es un allowlist, no un «todo
  // menos». La telemetría del frontend de Google no tiene por qué estar en
  // nuestra base.
  assert.ok(!CLASES_UTILES.includes('flow:batchLogFrontendEvents'));
  assert.ok(!CLASES_UTILES.includes('v1:fetchUserRecommendations'));
});

test('se descarta lo que no está en la lista', () => {
  const out = sanearPlantillas([
    plantilla(),
    plantilla({ clase: 'flow:batchLogFrontendEvents', url: `${BASE}/v1/flow:batchLogFrontendEvents` }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.clase, 'flowMedia:batchGenerateImages');
});

test('NUNCA se guarda un Authorization, ni con mayúscula', () => {
  // ⚠️ Con mayúscula es como lo manda Flow, y `delete o.authorization` no lo
  // borra. Ese error exacto ya dejó un bearer guardado en chrome.storage.local
  // mientras el comentario de al lado prometía lo contrario.
  const out = sanearPlantillas([
    plantilla({
      headers: {
        Authorization: 'Bearer SECRETO',
        authorization: 'Bearer OTRO',
        Cookie: 'SID=xxx',
        'content-type': 'application/json',
      },
    }),
  ]);
  const h = out[0]?.headers ?? {};
  assert.deepEqual(Object.keys(h), ['content-type']);
  assert.ok(!JSON.stringify(out).includes('SECRETO'));
  assert.ok(!JSON.stringify(out).includes('SID=xxx'));
});

test('se borra el TOKEN del captcha y se conserva el resto del contexto', () => {
  // ⚠️ El `applicationType` NO es una credencial: es una constante del contrato.
  // Tirar el `recaptchaContext` entero ya produjo un «reCAPTCHA evaluation
  // failed», así que se borra la hoja y no la rama.
  const cuerpo = JSON.stringify({
    clientContext: {
      projectId: 'p-real',
      sessionId: ';123',
      recaptchaContext: { token: 'TOKEN-VIVO', applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
    },
    requests: [{ seed: 1 }],
  });
  const out = sanearPlantillas([plantilla({ cuerpo })]);
  const guardado = out[0]?.cuerpo ?? '';
  assert.ok(!guardado.includes('TOKEN-VIVO'));
  assert.ok(guardado.includes('RECAPTCHA_APPLICATION_TYPE_WEB'));
  assert.ok(guardado.includes('p-real'));
  assert.ok(guardado.includes(';123'));
});

test('una url de otro origen se descarta', () => {
  // Una plantilla apuntando a otro lado convertiría a nuestro puente en un
  // cliente de un tercero, con las cookies de la persona.
  const out = sanearPlantillas([plantilla({ url: 'https://evil.example.com/v1/credits' })]);
  assert.equal(out.length, 0);
});

test('una plantilla SIN CUERPO no pisa a una completa', () => {
  // ⚠️ Es la regla que evita el bug que costó el HTTP 400: una cáscara —url
  // buena, headers buenos, cuerpo vacío— no se distingue de una sana en ningún
  // punto del camino. Si además pudiera reemplazar a una completa, la próxima
  // recarga de Flow rompería lo que ya funcionaba y nada lo diría.
  const completa: PlantillaEspejo = { ...plantilla(), cuerpo: '{"requests":[]}' } as PlantillaEspejo;
  const cascara: PlantillaEspejo = { ...plantilla({ cuando: 9999 }), cuerpo: null } as PlantillaEspejo;

  const r = fundirPlantillas([completa], [cascara]);
  assert.equal(r.length, 1);
  assert.equal(r[0]?.cuerpo, '{"requests":[]}', 'la cáscara pisó a la completa');

  // Y al revés SÍ: una completa reemplaza a una cáscara aunque sea más vieja.
  const r2 = fundirPlantillas([cascara], [{ ...completa, cuando: 1 } as PlantillaEspejo]);
  assert.equal(r2[0]?.cuerpo, '{"requests":[]}');
});

test('a igualdad de utilidad, gana la más nueva', () => {
  const vieja = { ...plantilla({ cuando: 1 }), cuerpo: '{"v":1}' } as PlantillaEspejo;
  const nueva = { ...plantilla({ cuando: 2 }), cuerpo: '{"v":2}' } as PlantillaEspejo;
  assert.equal(fundirPlantillas([vieja], [nueva])[0]?.cuerpo, '{"v":2}');
  assert.equal(fundirPlantillas([nueva], [vieja])[0]?.cuerpo, '{"v":2}');
});

test('un GET sin cuerpo es una plantilla válida', () => {
  // `/v1/credits` es un GET pelado: no tener cuerpo no lo hace una cáscara.
  const get = { ...plantilla({ clase: 'credits', metodo: 'GET', cuando: 5 }), cuerpo: null } as PlantillaEspejo;
  const otro = { ...plantilla({ clase: 'credits', metodo: 'GET', cuando: 9 }), cuerpo: null } as PlantillaEspejo;
  const r = fundirPlantillas([get], [otro]);
  assert.equal(r.length, 1);
  assert.equal(r[0]?.cuando, 9);
});

test('solo vuelven al navegador las clases que le faltan', () => {
  const guardadas = sanearPlantillas([
    plantilla(),
    plantilla({ clase: 'credits', url: `${BASE}/v1/credits?key=k`, metodo: 'GET', cuerpo: null }),
  ]);
  const out = faltantes(guardadas, ['flowMedia:batchGenerateImages']);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.clase, 'credits');

  // Si el navegador las tiene todas, no viaja nada: son decenas de KB cada 15 s.
  assert.equal(faltantes(guardadas, guardadas.map((p) => p.clase)).length, 0);
});

test('la basura no rompe nada', () => {
  assert.deepEqual(sanearPlantillas(null), []);
  assert.deepEqual(sanearPlantillas('x'), []);
  assert.deepEqual(sanearPlantillas([null, 3, { clase: 'credits' }]), []);
});

// =============================================================================
// La guarda de la cara: `parchar` inventa lo que falta, así que hay que preguntar
// =============================================================================

test('la cara sólo se parchea si la plantilla ya trae imageInputs completo', () => {
  // ⚠️ El cuerpo MEDIDO del pedido de imagen de Flow, 31/08/2026.
  const real = JSON.stringify({
    clientContext: { projectId: 'p', tool: 'PINHOLE' },
    requests: [{
      imageModelName: 'NARWHAL',
      structuredPrompt: { parts: [{ text: 'x' }] },
      imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: '268d674a-x' }],
    }],
  });
  assert.equal(tieneCaraParcheable(real), true);

  // Sin el array: parchear crearía `[{name}]` SIN su `imageInputType`, devolvería
  // éxito, y saldría un cuerpo mal formado hecho por nosotros — con una imagen de
  // resultado y ningún error. Es el modo de falla más caro que hay.
  assert.equal(tieneCaraParcheable(JSON.stringify({ requests: [{ seed: 1 }] })), false);

  // Con el array pero SIN el tipo: media plantilla es peor que ninguna.
  assert.equal(
    tieneCaraParcheable(JSON.stringify({ requests: [{ imageInputs: [{ name: 'x' }] }] })),
    false,
  );

  // ⚠️ `null` NO es `false`: es «no se puede saber». El cuerpo se guarda cortado a
  // 20.000 caracteres, así que puede llegar sin parsear. No poder comprobar algo
  // no autoriza a asumirlo — con `null` no se parchea.
  assert.equal(tieneCaraParcheable(null), null);
  assert.equal(tieneCaraParcheable('{"requests":[{"imageInp'), null);
});
