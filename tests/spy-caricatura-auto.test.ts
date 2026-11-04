// =============================================================================
// La caricatura de un competidor, sola y en segundo plano (4/11/2026)
// =============================================================================
// Martín (por el Cerebro): «me traje a @den.borgg y no me hizo la caricatura como habíamos quedado... Eso debe hacerse
// en segundo plano de manera automática». `pedirCaricatura` existía y no la llamaba nadie.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada:
//   · `pasoSiguiente` que genera también para un referente           → 1
//   · `pasoSiguiente` que genera en la prueba gratis                 → 2
//   · `pasoSiguiente` que pide sin rasgos                            → 3
//   · `rasgosDeRespuesta` que acepta «NONE»                          → 4
//   · `leerRegistro` que acepta una url que no es https              → 5
//   · la ruta propia de antes (`spy/caricaturas/…`) en vez de `rutaDeSubida` → 6
// Correr: node --import tsx --test tests/spy-caricatura-auto.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FALLOS_HASTA_RENDIRSE, caricaturasListas, leerRegistro, pasoSiguiente, rasgosDeRespuesta, sigueEnMarcha,
} from '../lib/spy-caricatura-reglas';
import { RUTA_SUBIDA, rutaDeSubida } from '../lib/flow-interfaz';

const RAIZ = resolve(import.meta.dirname, '..');
const FOTO = 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/avatar/denborgg.jpg';
const base = { referente: false, avatar: FOTO, enPrueba: false, puenteListo: true };

test('1. no se hace para un referente (ya está dibujado), sin foto, ni si ya está', () => {
  assert.deepEqual(pasoSiguiente(undefined, { ...base, referente: true }), { hacer: 'nada', porque: 'referente' });
  assert.deepEqual(pasoSiguiente(undefined, { ...base, avatar: null }), { hacer: 'nada', porque: 'sin-foto' });
  assert.deepEqual(pasoSiguiente({ url: 'https://x/c.jpg' }, base), { hacer: 'nada', porque: 'lista' });
});

test('2. en la prueba gratis y sin el puente de Flow no se pide; un pedido que ya salió se mira igual', () => {
  assert.deepEqual(pasoSiguiente(undefined, { ...base, enPrueba: true }), { hacer: 'nada', porque: 'prueba' });
  assert.deepEqual(pasoSiguiente({ rasgos: 'x y z w q' }, { ...base, puenteListo: false }), { hacer: 'nada', porque: 'sin-puente' });
  assert.deepEqual(pasoSiguiente({ trabajo: 51 }, { ...base, puenteListo: false }), { hacer: 'mirar-trabajo', trabajo: 51 });
});

test('3. primero los rasgos, después el pedido; y a los dos fallos se queda con su foto', () => {
  assert.deepEqual(pasoSiguiente(undefined, base), { hacer: 'rasgos' });
  assert.deepEqual(pasoSiguiente({ rasgos: 'short dark hair, thick beard' }, base), { hacer: 'pedir' });
  assert.deepEqual(pasoSiguiente({ rasgos: 'x', fallos: FALLOS_HASTA_RENDIRSE }, base), { hacer: 'nada', porque: 'se-rindio' });
  assert.equal(sigueEnMarcha({ hacer: 'pedir' }), true);
  assert.equal(sigueEnMarcha({ hacer: 'nada', porque: 'lista' }), false);
});

test('4. los rasgos: una línea limpia; «NONE», una negativa o algo muy corto no sirven', () => {
  assert.equal(rasgosDeRespuesta('"Short curly black hair, full beard, round glasses, olive skin, about 30."'), 'Short curly black hair, full beard, round glasses, olive skin, about 30');
  assert.equal(rasgosDeRespuesta('NONE'), null);
  assert.equal(rasgosDeRespuesta('none.'), null);
  assert.equal(rasgosDeRespuesta('NONE - there is no human face in this photo'), null, 'un «NONE» con explicación tampoco');
  assert.equal(rasgosDeRespuesta("I'm sorry, I cannot describe this person."), null);
  assert.equal(rasgosDeRespuesta('bald'), null);
  assert.equal(rasgosDeRespuesta(''), null);
});

test('5. el registro guardado: lo que no tiene la forma se descarta, y sólo lo listo va a la tarjeta', () => {
  const r = leerRegistro(JSON.stringify({
    '16': { url: 'https://x/c16.jpg', rasgos: ' beard ' },
    '17': { trabajo: 9, url: 'javascript:alert(1)' },
    abc: { url: 'https://x/no.jpg' },
    '18': 'roto',
  }));
  assert.deepEqual(Object.keys(r).sort(), ['16', '17']);
  assert.equal(r['17'].url, undefined);
  assert.equal(r['16'].rasgos, 'beard');
  assert.deepEqual([...caricaturasListas(r)], [[16, 'https://x/c16.jpg']]);
  assert.deepEqual(leerRegistro('{no es json'), {});
  assert.deepEqual(leerRegistro(null), {});
});

test('6. el pedido lleva una ruta que la cola le firma al puente, para que la imagen quede en nuestro Storage', () => {
  // Con `spy/caricaturas/…` el puente no la subía y sólo volvía la url de Flow, que vence en una hora.
  assert.match(rutaDeSubida('spy-caricatura', 'escena', 1, '0f8fad5b-d9cb-469f-a165-70867728950e'), RUTA_SUBIDA);
  const flow = readFileSync(resolve(RAIZ, 'lib/spy-caricatura-flow.ts'), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(flow, /ruta: rutaDeSubida\('spy-caricatura', 'escena', 1, randomUUID\(\)\)/);
  // Y alguien la llama: antes no había ni un llamador.
  const auto = readFileSync(resolve(RAIZ, 'lib/spy-caricatura-auto.ts'), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(auto, /await pedirCaricatura\(c, e\?\.rasgos \?\? ''\)/);
  const app = readFileSync(resolve(RAIZ, 'app/competitor-spy/SpyApp.tsx'), 'utf8');
  assert.match(app, /fetch\('\/api\/competitor-spy\/caricatura'/);
});
