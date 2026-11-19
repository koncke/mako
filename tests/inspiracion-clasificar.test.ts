// Inspiración: cómo se lee la respuesta de la IA y qué contesta MaKo por WhatsApp (lib/inspiracion/clasificar.ts, 19/11/2026).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMPTS_INSPIRACION, leerVeredicto, respuestaWhatsApp, textoDeLasCarpetas, textoDeLaPieza } from '../lib/inspiracion/clasificar';

test('lee el JSON aunque venga con texto alrededor, y acota la confianza', () => {
  const v = leerVeredicto('Claro:\n{"carpeta_id": 2, "confianza": 140, "por_que": "vende una app", "lectura": {"formato": "reel animado", "gancho": "Encontré una app"}}', [1, 2]);
  assert.equal(v?.carpetaId, 2);
  assert.equal(v?.confianza, 100);
  assert.equal(v?.lectura.gancho, 'Encontré una app');
  assert.equal(v?.carpetaNueva, null, 'con carpeta no propone una nueva');
});

test('una carpeta que no existe no se inventa: queda null y vale la propuesta de una nueva', () => {
  const v = leerVeredicto('{"carpeta_id": 99, "confianza": 95, "carpeta_nueva": "Anuncios pagados"}', [1, 2]);
  assert.equal(v?.carpetaId, null);
  assert.equal(v?.carpetaNueva, 'Anuncios pagados');
});

test('sin JSON o roto: null (la pieza va a la bandeja sin sugerencia)', () => {
  assert.equal(leerVeredicto('no sé', [1]), null);
  assert.equal(leerVeredicto('{"carpeta_id": 1,', [1]), null);
  assert.equal(leerVeredicto(null, [1]), null);
});

test('la pieza y las carpetas como texto', () => {
  assert.match(textoDeLaPieza({ tipoLink: 'reel', cuenta: 'hormozi', pie: 'Comment SALES' }), /un reel[\s\S]*@hormozi[\s\S]*Comment SALES/);
  assert.match(textoDeLaPieza({ tipoLink: 'post', cuenta: null, pie: null }), /\(sin pie\)/);
  assert.equal(textoDeLasCarpetas([]), '(todavía no tiene carpetas: propón una nueva)');
  const t = textoDeLasCarpetas([{ id: 3, nombre: 'Serie 3', descripcion: 'vender una app', ejemplos: ['@a: uno', '@b: dos', '@c: tres', '@d: cuatro'] }]);
  assert.match(t, /id 3: «Serie 3» — vender una app/);
  assert.equal((t.match(/confirmada/g) ?? []).length, 3, 'hasta 3 ejemplos');
});

test('los textos editables declaran sus slots', () => {
  for (const slot of ['{{pieza}}', '{{nota}}', '{{carpetas}}']) assert.ok(PROMPTS_INSPIRACION.usuario.tpl.includes(slot), slot);
  assert.match(PROMPTS_INSPIRACION.sistema.tpl, /contenido_no_confiable/);
});

const link = 'https://hola-mako.com/copywriter?ver=inspiracion';

test('WhatsApp: uno seguro, uno dudoso, uno repetido', () => {
  assert.equal(respuestaWhatsApp([{ como: 'nueva', estado: 'ordenada', carpeta: 'Serie 3' }], link), 'Guardado en Inspiración › Serie 3.');
  assert.equal(respuestaWhatsApp([{ como: 'nueva', estado: 'por_revisar', carpeta: null }], link),
    `Guardado. No estoy seguro de en qué carpeta va: te lo dejé en Copywriting › Inspiración para que me digas. ${link}`);
  assert.equal(respuestaWhatsApp([{ como: 'repetida', estado: 'ordenada', carpeta: 'Serie 1' }], link), 'Ese ya lo tenías guardado en Serie 1.');
});

test('WhatsApp: varios, con el link sólo si hay algo para decidir', () => {
  const t = respuestaWhatsApp([
    { como: 'nueva', estado: 'ordenada', carpeta: 'Carruseles' },
    { como: 'nueva', estado: 'ordenada', carpeta: 'Carruseles' },
    { como: 'nueva', estado: 'ordenada', carpeta: 'Serie 1' },
    { como: 'nueva', estado: 'sin_leer', carpeta: null },
  ], link);
  assert.equal(t, `Guardé 4: 2 en Carruseles, 1 en Serie 1 y 1 para que me digas dónde va. ${link}`);
  const sinDudas = respuestaWhatsApp([
    { como: 'nueva', estado: 'ordenada', carpeta: 'Serie 1' },
    { como: 'repetida', estado: 'ordenada', carpeta: 'Serie 1' },
  ], link);
  assert.equal(sinDudas, 'Guardé 1: 1 en Serie 1. Uno ya lo tenías.');
  assert.equal(respuestaWhatsApp([], link), '');
});
