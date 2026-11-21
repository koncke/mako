// La letra de la réplica se PARECE a la de la referencia (20/11/2026, la llamada con Leila, Fathom 205366178, 00:51:32: «La
// tipografía no es lo mismo»).
//
// Lo que había: seis categorías con UNA familia cada una (lib/carruseles/replica.ts → `LETRA_DEL_EDITOR`). En su carrusel (ws 11,
// 14331b1a) todo salió Montserrat 800 + Inter, y una serif fina de revista salía en Playfair Display 800. Ahora la IA nombra la
// familia del editor que más se parece, de una lista cerrada (`FUENTES_PARA_ELEGIR`), y el código:
//   1. la acepta sólo si es de la lista y el editor la tiene (una inventada o de otro catálogo, no);
//   2. en el armado de respaldo, va esa familia con el peso más cercano que el editor tiene (DM Serif Display sólo tiene 400: no se
//      pide un 800 que el navegador engordaría falso), y la itálica si la dijo;
//   3. en la réplica fiel, va esa familia en vez de Inter, sin apretarla con la tabla de otra letra;
//   4. el prompt le muestra la lista por estilo.
//
// Correr: node --import tsx --test tests/carruseles-letra-parecida.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUENTES_PARA_ELEGIR, documentoDeReplica, fuenteParecida, leerReplica, pesoQueExiste, promptDeReplica, type Replica } from '../lib/carruseles/replica';
import { fuenteDelEditorDeImagen } from '../lib/image-editor/fuente-del-editor';

const crudo = (textos: Array<Record<string, unknown>>) => JSON.stringify({ proporcion: '4:5', titulo: 'X', laminas: [{ n: 1, fondo: '#F3EEE2', cuadros: [], textos }] });
const T = (extra: Record<string, unknown>) => ({ rol: 'titulo', texto: 'Tu negocio te está consumiendo', x: 0.1, y: 0.3, ancho: 0.8, tamano: 0.08, color: '#111111', letra: 'serif', ...extra });

test('1 · la familia se acepta sólo si es de la lista y el editor la tiene', () => {
  for (const fs of Object.values(FUENTES_PARA_ELEGIR)) for (const f of fs) assert.ok(fuenteDelEditorDeImagen(f), `el editor no tiene «${f}»`);
  assert.deepEqual(fuenteParecida('dm serif display'), { familia: 'DM Serif Display', respaldo: 'serif' });
  assert.equal(fuenteParecida('Helvetica Neue'), null, 'una que no es de la lista');
  assert.equal(fuenteParecida('Lobster'), null, 'una del editor que no está en la lista');
  const r = leerReplica(crudo([T({ fuente: 'Cormorant Garamond', italica: true }), T({ rol: 'cuerpo', fuente: 'Comic Sans' })]), { laminas: 1 }) as Replica;
  assert.equal(r.laminas[0].textos[0].fuente, 'Cormorant Garamond');
  assert.equal(r.laminas[0].textos[0].italica, true);
  assert.equal(r.laminas[0].textos[1].fuente, undefined);
});

test('2 · el armado de respaldo usa esa familia, con el peso que existe y la itálica', () => {
  assert.equal(pesoQueExiste('DM Serif Display', 800), 400, 'sólo tiene 400');
  assert.equal(pesoQueExiste('Montserrat', 800), 800);
  const r = leerReplica(crudo([T({ fuente: 'DM Serif Display' }), T({ rol: 'cuerpo', texto: 'Por dos fuerzas.', y: 0.6, tamano: 0.045, fuente: 'Lora', italica: true, letra: 'serif' })]), { laminas: 1 }) as Replica;
  let n = 0;
  const doc = documentoDeReplica({ replica: r, estilo: { titular: { familia: 'Montserrat', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } } as never, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId: () => `o${++n}` });
  const textos = (doc.pages as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects.filter((o) => o.type === 'textbox');
  assert.equal(textos[0].fontFamily, '"DM Serif Display", serif');
  assert.equal(textos[0].fontWeight, 400);
  assert.equal(textos[1].fontFamily, '"Lora", serif');
  assert.equal(textos[1].fontStyle, 'italic');
  // Sin familia, la de su categoría, como antes.
  const sin = leerReplica(crudo([T({})]), { laminas: 1 }) as Replica;
  const doc2 = documentoDeReplica({ replica: sin, estilo: { titular: { familia: 'Montserrat', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } } as never, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId: () => `p${++n}` });
  assert.equal((doc2.pages as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects.find((o) => o.type === 'textbox')!.fontFamily, '"Playfair Display", serif');
});

test('3 · en la réplica fiel va esa familia (no Inter), sin apretarla con otra tabla', () => {
  const r = leerReplica(crudo([T({ letra: 'sans', fuente: 'Poppins', original: 'Your business is eating you' })]), { laminas: 1 }) as Replica;
  const bloque = { caja: { x: 108, y: 400, ancho: 864, alto: 90 }, renglones: 1, paso: 0, altoRenglon: 70, tinta: '#111111', fondo: '#F3EEE2', alineacion: 'left', principal: true, trazo: 0 } as never;
  let n = 0;
  const doc = documentoDeReplica({ replica: r, estilo: { titular: { familia: 'Montserrat', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } } as never, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId: () => `f${++n}`, planchas: [{ src: 'https://x/plancha.jpg', textos: [bloque], personas: [] }] });
  const t = (doc.pages as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects.find((o) => o.type === 'textbox')!;
  assert.equal(t.fontFamily, '"Poppins", sans-serif');
  assert.equal(t.charSpacing, 0, 'Poppins no está en la tabla de anchos: no se aprieta con la de otra letra');
});

test('4 · el prompt muestra la lista por estilo', () => {
  const p = promptDeReplica({ laminas: 3, vistas: 3, negocio: '', voz: '', nombreNegocio: 'X', cta: null, conAvatar: false });
  assert.match(p, /"fuente": de ESTA lista/);
  for (const f of ['Cormorant Garamond', 'Bebas Neue', 'Great Vibes', 'DM Sans']) assert.ok(p.includes(f), `falta ${f}`);
});
