// «Mejora el contraste» se MIDE: después de aplicarlo, el texto se lee sobre lo que tiene detrás (20/11/2026, la llamada con Leila,
// Fathom 205366178, 00:51:37: «No se lee, digo, y le puse a aumentar contraste»).
//
// Lo que había: la sugerencia era un pedido a la IA del chat, que mira un JSON de colores (no la foto) y nadie medía después. En su
// carrusel (ws 11, 14331b1a), letra crema #F3EEE2 sobre fotos claras del banco y, en las láminas agregadas, sobre blanco (1,1).
// Ahora (lib/image-editor/contraste.ts, y app/image-editor/mako/chat/contraste.ts mide los píxeles en el navegador):
//   1. crema sobre blanco pasa a casi negro, y se lee (4,5 o más);
//   2. sobre un blur con luces y sombras ningún color alcanza: letra blanca con un velo oscuro, con la opacidad justa;
//   3. lo que ya se lee no se toca;
//   4. en el documento: el velo va DEBAJO del texto, el color cambia, un texto bloqueado no se toca y uno con pastilla se mide
//      contra su pastilla; lo que se dice trae el contraste de antes y el de después;
//   5. el armado de respaldo de la réplica: una foto de fondo del banco lleva un velo de toda la lámina debajo de los textos, y si la
//      foto del original estaba desenfocada (la plantilla «con blur»), la escena va desenfocada.
//
// Correr: node --import tsx --test tests/carruseles-contraste-medido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRASTE_OBJETIVO, NOMBRE_VELO, arreglarContraste, contrasteDelTexto, fondoDe, fondoLiso, luminanciaRgb, queHacer, resumenDeContraste } from '../lib/image-editor/contraste';
import { VELO_DE_FONDO, documentoDeReplica, leerReplica, type Replica } from '../lib/carruseles/replica';

const CREMA = '#F3EEE2';

test('1 · crema sobre blanco (las láminas agregadas de Leila): pasa a casi negro, y se lee', () => {
  const blanco = fondoLiso('#FFFFFF')!;
  assert.ok(contrasteDelTexto(CREMA, blanco)! < 1.2, 'el caso de producción: contraste 1,1');
  const a = queHacer(CREMA, blanco)!;
  assert.equal(a.color, '#111111');
  assert.equal(a.velo, null);
  assert.ok(a.despues >= CONTRASTE_OBJETIVO);
});

test('2 · sobre un blur con luces y sombras: letra blanca y un velo con la opacidad justa', () => {
  // Una foto desenfocada: la mitad oscura (luminancia 0,04) y la mitad clara (0,7), como el fondo de la plantilla de Leila.
  const lums = [...Array(500).fill(0.04), ...Array(500).fill(0.7)];
  const f = fondoDe(lums)!;
  assert.ok(contrasteDelTexto('#FFFFFF', f)! < CONTRASTE_OBJETIVO && contrasteDelTexto('#111111', f)! < CONTRASTE_OBJETIVO, 'ningún color sólo alcanza');
  const a = queHacer(CREMA, f)!;
  assert.equal(a.color, '#FFFFFF');
  assert.ok(a.velo != null && a.velo >= 0.25 && a.velo <= 0.8, `velo ${a.velo}`);
  assert.ok(a.despues >= CONTRASTE_OBJETIVO, `con el velo queda en ${a.despues}`);
});

test('3 · lo que ya se lee no se toca', () => {
  assert.equal(queHacer('#FFFFFF', fondoDe([0.01, 0.02, 0.03, 0.04])!), null);
  assert.equal(queHacer('#111111', fondoLiso('#F3EEE2')!), null);
  assert.equal(queHacer('linear-gradient(red, blue)', fondoLiso('#FFFFFF')!), null, 'un color que no se entiende no se toca');
  assert.ok(Math.abs(luminanciaRgb(255, 255, 255) - 1) < 1e-9);
});

type Obj = Record<string, unknown>;
const textbox = (id: string, fill: string, extra: Obj = {}): Obj => ({ type: 'textbox', id, text: `Texto ${id}`, fill, fontSize: 49, left: 108, top: 600, width: 864, height: 60, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, ...extra });

test('4 · en el documento: el velo va debajo del texto, el color cambia, lo bloqueado no, la pastilla se mide contra la pastilla', () => {
  const doc = { width: 1080, height: 1350, pages: [{ id: 'p1', objects: [
    { type: 'image', id: 'foto', src: 'https://x/f.jpg' },
    textbox('t1', CREMA),
    textbox('t2', CREMA, { locked: true }),
    textbox('t3', '#FFFFFF', { effects: { background: { color: '#F25F4C' } }, textBackgroundColor: '#F25F4C' }),
    textbox('t4', '#FFFFFF'),
  ] }] };
  const blur = fondoDe([...Array(50).fill(0.04), ...Array(50).fill(0.7)])!;
  const fondos = new Map([['t1', blur], ['t2', blur], ['t3', fondoLiso('#FFFFFF')!], ['t4', fondoDe([0.01, 0.02])!]]);
  let n = 0;
  const { doc: nuevo, cambios } = arreglarContraste(doc, fondos, { nuevoId: () => `v${++n}` });
  const objs = nuevo.pages[0].objects;
  const i1 = objs.findIndex((o) => o.id === 't1');
  assert.equal(objs[i1 - 1].name, NOMBRE_VELO, 'el velo no quedó justo debajo del texto');
  assert.match(String(objs[i1 - 1].fill), /^rgba\(0,0,0,0\.\d+\)$/);
  assert.ok((objs[i1 - 1].width as number) > 864 && (objs[i1 - 1].left as number) < 108, 'el velo es del tamaño del texto, con margen');
  assert.equal(objs[i1].fill, '#FFFFFF');
  assert.equal(objs.find((o) => o.id === 't2')!.fill, CREMA, 'un texto bloqueado no se toca');
  // Blanco sobre una pastilla naranja: 3,0; medido contra la pastilla (no contra el blanco de atrás), pasa a casi negro.
  assert.equal(objs.find((o) => o.id === 't3')!.fill, '#111111');
  assert.equal(objs.find((o) => o.id === 't4')!.fill, '#FFFFFF', 'lo que se leía quedó igual');
  assert.deepEqual(cambios.map((c) => c.id), ['t1', 't3']);
  assert.ok(cambios.every((c) => c.contrasteDespues >= CONTRASTE_OBJETIVO && c.contrasteAntes < CONTRASTE_OBJETIVO));
  assert.equal(doc.pages[0].objects.length, 5, 'el original no se toca');
  const dicho = resumenDeContraste(cambios, 4);
  assert.match(dicho, /Medí los 4 textos/);
  assert.match(dicho, /velo/);
  assert.match(dicho, /peor contraste es \d+,\d/);
});

test('5 · el armado de respaldo: velo sobre la foto de fondo, debajo de los textos, y el blur del original', () => {
  const crudo = JSON.stringify({ proporcion: '4:5', titulo: 'X', laminas: [{ n: 1, fondo: '#1F1F1F', cuadros: [{ x: 0, y: 0, ancho: 1, alto: 1, tipo: 'escena', persona: false, desenfocada: true, busqueda: 'calm office' }], textos: [{ rol: 'titulo', texto: 'Tu negocio te está consumiendo', x: 0.1, y: 0.35, ancho: 0.8, tamano: 0.08, color: CREMA }] }] });
  const r = leerReplica(crudo, { laminas: 1 }) as Replica;
  assert.equal(r.laminas[0].cuadros[0].desenfocada, true);
  const foto = { id: '', url: 'https://x.supabase.co/storage/v1/object/public/landing-imagenes/11/f.jpg', ancho: 1200, alto: 1500 };
  let n = 0;
  const doc = documentoDeReplica({ replica: r, estilo: { titular: { familia: 'Montserrat', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } } as never, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId: () => `o${++n}`, escenas: new Map([['calm office', foto]]) });
  const objs = (doc.pages as Array<{ objects: Obj[] }>)[0].objects;
  const iFoto = objs.findIndex((o) => o.type === 'image');
  const iVelo = objs.findIndex((o) => o.name === VELO_DE_FONDO);
  const iTexto = objs.findIndex((o) => o.type === 'textbox');
  assert.ok(iFoto >= 0 && iVelo > iFoto && iTexto > iVelo, `el orden tiene que ser foto, velo, texto: ${objs.map((o) => o.name ?? o.type).join(' · ')}`);
  assert.deepEqual(objs[iFoto].filters, [{ type: 'blur', value: 0.22 }]);
  // Sin foto de fondo, ningún velo.
  const sinFoto = documentoDeReplica({ replica: r, estilo: { titular: { familia: 'Montserrat', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } } as never, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId: () => `s${++n}` });
  assert.equal((sinFoto.pages as Array<{ objects: Obj[] }>)[0].objects.filter((o) => o.name === VELO_DE_FONDO).length, 0);
});
