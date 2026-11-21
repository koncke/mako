// generarImagen de ApiMart: el pedido armado SIN RED (21/11/2026). El replicador de carruseles regenera cada lámina con un modelo
// de IMAGEN con referencia (decisión del Cerebro y de Martín: «no quiero que sólo dependamos de Flow», 7/11; el puente de Flow no
// andaba en ningún ws el 21/11). Documentación pública de ApiMart (docs.apimart.ai, leída el 21/11):
//   POST /v1/images/generations · {model, prompt, size, n, image_urls, resolution?} → {data:[{task_id}]} · GET /v1/tasks/{id}.
//
// Esto fija:
//   1. el modelo por defecto es Nano Banana Pro (`gemini-3-pro-image-preview`): edita con referencias, escribe bien el texto y
//      acepta 4:5 (el carrusel); los otros dos del catálogo, con su precio;
//   2. el cuerpo: el id exacto, `image_urls` con las referencias EN ORDEN (la base primero), `n: 1` como número, el formato;
//   3. un modelo que no tiene 4:5 (Seedream) recibe el más cercano (3:4), nunca uno que rechace;
//   4. se rechaza ANTES de gastar: sin referencias, una referencia que no es http(s) ni data:image, de más referencias, un prompt
//      vacío o más largo que el tope del modelo;
//   5. lo que cuesta en MaKo Tokens sale de la calidad del modelo (el premium para Pro), y nunca menos de lo que cobra ApiMart;
//   6. la respuesta de un pedido de imagen (`data[0].task_id`) se lee como un arranque aceptado (la misma regla que el video).
//
// Correr: node --import tsx --test tests/apimart-imagen.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELOS_IMAGEN, MODELO_IMAGEN_POR_DEFECTO, comoQuedo, cuerpoDePedidoImagen } from '../lib/apimart-reglas';
import { MT_POR_USD, mtDeImagenDe } from '../lib/mako-tokens-reglas';

const BASE = 'https://sjyugcqypgeklskqrdad.supabase.co/storage/v1/object/public/spy-miniaturas/spy/carruseles/DTA2kpHCLOW-1.jpg';
const PERSONA = 'https://sjyugcqypgeklskqrdad.supabase.co/storage/v1/object/public/image-editor/9/cubos.png';

test('1 · el modelo por defecto es Nano Banana Pro, y el catálogo trae su precio', () => {
  assert.equal(MODELO_IMAGEN_POR_DEFECTO, 'gemini-3-pro-image-preview');
  assert.equal(MODELOS_IMAGEN['gemini-3-pro-image-preview'].usdPorImagen, 0.02);
  assert.ok(MODELOS_IMAGEN['gemini-2.5-flash-image-preview']);
  assert.ok(MODELOS_IMAGEN['seedream-4.0']);
});

test('2 · el cuerpo: id exacto, las referencias en orden, n como número y el formato del carrusel', () => {
  const c = cuerpoDePedidoImagen('gemini-3-pro-image-preview', [BASE, PERSONA], 'Replace «9 YOUTUBE COURSES» with «9 AGENTES DE IA».', '4:5');
  assert.equal(c.model, 'gemini-3-pro-image-preview');
  assert.deepEqual(c.image_urls, [BASE, PERSONA], 'la base va primero');
  assert.equal(c.n, 1);
  assert.equal(typeof c.n, 'number');
  assert.equal(c.size, '4:5');
  assert.equal(c.prompt, 'Replace «9 YOUTUBE COURSES» with «9 AGENTES DE IA».');
});

test('3 · un modelo sin 4:5 recibe el formato más cercano que sí tiene', () => {
  assert.equal(cuerpoDePedidoImagen('seedream-4.0', [BASE], 'x', '4:5').size, '3:4');
  assert.equal(cuerpoDePedidoImagen('gemini-2.5-flash-image-preview', [BASE], 'x', '4:5').size, '4:5');
});

test('4 · se rechaza ANTES de gastar lo que el proveedor rechazaría', () => {
  assert.throws(() => cuerpoDePedidoImagen('gemini-3-pro-image-preview', [], 'x', '4:5'), /referencia/);
  assert.throws(() => cuerpoDePedidoImagen('gemini-3-pro-image-preview', ['ftp://x/y.jpg'], 'x', '4:5'), /http/);
  assert.throws(() => cuerpoDePedidoImagen('gemini-3-pro-image-preview', [BASE], '   ', '4:5'), /prompt/i);
  assert.throws(() => cuerpoDePedidoImagen('gemini-2.5-flash-image-preview', [BASE], 'x'.repeat(1001), '4:5'), /largo/);
  assert.throws(() => cuerpoDePedidoImagen('gemini-3-pro-image-preview', Array(15).fill(BASE), 'x', '4:5'), /referencias/);
  assert.doesNotThrow(() => cuerpoDePedidoImagen('gemini-3-pro-image-preview', ['data:image/png;base64,iVBORw0KGgo='], 'x', '4:5'));
});

test('5 · lo que cuesta en MaKo Tokens nunca es menos de lo que cobra ApiMart', () => {
  for (const m of Object.values(MODELOS_IMAGEN)) {
    const mt = mtDeImagenDe(m.id as keyof typeof MODELOS_IMAGEN);
    assert.ok(mt / MT_POR_USD >= m.usdPorImagen, `${m.id}: cobra ${mt} MT (US$${mt / MT_POR_USD}) por una imagen que cuesta US$${m.usdPorImagen}`);
  }
});

test('6 · la respuesta de un pedido de imagen es un arranque aceptado', () => {
  assert.deepEqual(comoQuedo({ code: 200, data: [{ status: 'submitted', task_id: 'task_01ABC' }] }, 200), { estado: 'aceptado', taskId: 'task_01ABC' });
  assert.equal(comoQuedo({ error: { message: 'insufficient_user_quota' } }, 402).estado, 'rechazado');
});
