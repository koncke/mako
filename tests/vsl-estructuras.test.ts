// Las etiquetas de una estructura de VSL son CONTRATO con el parser de la UI y
// con el VSL Analyst (cada bloque se ancla a un tramo de la curva de retención).
// Una etiqueta inválida no rompe al guardar: rompe semanas después, dejando el
// guion como un bloque de texto plano. Por eso se valida al normalizar y por eso
// se testea acá.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTRUCTURAS_VSL_DEFAULT,
  estructuraVslPorId,
  normalizarEstructurasVsl,
} from '../lib/vsl-estructuras';

const ETIQUETA_OK = /^[A-Z0-9ÑÜ ]{2,48}$/;

test('las estructuras por defecto respetan el contrato del parser', () => {
  assert.ok(ESTRUCTURAS_VSL_DEFAULT.length >= 4, 'tiene que haber varias para elegir');
  for (const e of ESTRUCTURAS_VSL_DEFAULT) {
    assert.ok(e.id && e.nombre && e.guia, `${e.id}: le falta id/nombre/guia`);
    assert.ok(e.etiquetas.length >= 2, `${e.id}: menos de dos bloques no es una estructura`);
    for (const et of e.etiquetas) {
      assert.ok(ETIQUETA_OK.test(et), `${e.id}: etiqueta inválida "${et}"`);
      assert.equal(et, et.toUpperCase(), `${e.id}: "${et}" tiene minúsculas`);
      assert.equal(
        et.normalize('NFD').replace(/[̀-ͯ]/g, ''),
        et,
        `${e.id}: "${et}" tiene tildes y el parser no las matchea`,
      );
    }
    // Cada bloque tiene que estar explicado en la guía, o la IA no sabe qué poner.
    for (const et of e.etiquetas) {
      assert.ok(e.guia.includes(et), `${e.id}: el bloque ${et} no está en la guía`);
    }
  }
});

test('los ids no se repiten', () => {
  const ids = ESTRUCTURAS_VSL_DEFAULT.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('son de VSL largo, no de anuncio corto', () => {
  for (const e of ESTRUCTURAS_VSL_DEFAULT) {
    assert.ok(e.minutos >= 15, `${e.id}: ${e.minutos} min es un anuncio, no un VSL`);
    assert.ok(e.etiquetas.length >= 7, `${e.id}: un VSL necesita más bloques que un ad`);
  }
});

test('estructuraVslPorId encuentra y no inventa', () => {
  assert.ok(estructuraVslPorId(ESTRUCTURAS_VSL_DEFAULT, 'vsl-respuesta-directa'));
  assert.equal(estructuraVslPorId(ESTRUCTURAS_VSL_DEFAULT, 'no-existe'), undefined);
});

// ── El normalizador: lo que llega del editor del admin ──────────────────────

test('las etiquetas se suben a MAYÚSCULA y pierden las tildes', () => {
  const [e] = normalizarEstructurasVsl([
    { id: 'x', nombre: 'X', guia: 'g', etiquetas: ['garantía', 'Objeción', 'cta'] },
  ]);
  assert.deepEqual(e.etiquetas, ['GARANTIA', 'OBJECION', 'CTA']);
});

test('se descarta lo que rompería el parser, no se guarda roto', () => {
  const out = normalizarEstructurasVsl([
    { id: 'a', nombre: 'Sin guía', guia: '', etiquetas: ['LEAD', 'CTA'] },
    { id: 'b', nombre: 'Un solo bloque', guia: 'g', etiquetas: ['LEAD'] },
    { id: 'c', nombre: 'Etiqueta con dos puntos', guia: 'g', etiquetas: ['LEAD:', 'CTA'] },
    { id: 'd', nombre: 'Buena', guia: 'g', etiquetas: ['LEAD', 'CTA'] },
  ]);
  assert.deepEqual(out.map((e) => e.id), ['d'], 'solo entra la válida');
});

test('los ids duplicados no entran dos veces', () => {
  const out = normalizarEstructurasVsl([
    { id: 'dup', nombre: 'Una', guia: 'g', etiquetas: ['LEAD', 'CTA'] },
    { id: 'dup', nombre: 'Otra', guia: 'g', etiquetas: ['LEAD', 'CTA'] },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].nombre, 'Una', 'gana la primera');
});

test('el id sale del nombre cuando no viene', () => {
  const [e] = normalizarEstructurasVsl([
    { nombre: 'VSL de Diagnóstico Rápido', guia: 'g', etiquetas: ['LEAD', 'CTA'] },
  ]);
  assert.equal(e.id, 'vsl-de-diagnostico-rapido');
});

test('minutos inválidos caen a un default sano, no a cero', () => {
  const [a] = normalizarEstructurasVsl([{ id: 'a', nombre: 'A', guia: 'g', etiquetas: ['LEAD', 'CTA'] }]);
  assert.equal(a.minutos, 25);
  const [b] = normalizarEstructurasVsl([
    { id: 'b', nombre: 'B', guia: 'g', etiquetas: ['LEAD', 'CTA'], minutos: -3 },
  ]);
  assert.equal(b.minutos, 25);
});

test('un array vacío o basura devuelve lista vacía, sin explotar', () => {
  assert.deepEqual(normalizarEstructurasVsl(null), []);
  assert.deepEqual(normalizarEstructurasVsl('nope'), []);
  assert.deepEqual(normalizarEstructurasVsl([null, 3, 'x']), []);
});
