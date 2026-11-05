// =============================================================================
// La marca del negocio en kits (lib/marca/kits.ts) y lo que la usa: el bloque del prompt, los carruseles y «Discutir»
// =============================================================================
// El pedido (llamada con Leila del 30/10/2026): sus carruseles sólo tomaban el fondo de su marca; que MaKo le pida su manual,
// lo guarde en el Second Brain con varios kits y lo use al diseñar. Todo lo de acá EJECUTA el código con datos inventados.
//
// PROBADO ROMPIÉNDOLO (5/11/2026, una rotura por vez y restaurada; base 9/0):
//   · `sanearColores` sin el `normalizarHex` (guarda «rojo» como color) → 7/2 (el 1 y el 4);
//   · `sinKit` sin pasar el «por defecto» al siguiente → 8/1 (el 2);
//   · `bloqueDeMarca` sin `fuenteDelEditor` (sugiere una fuente que el editor no tiene) → 8/1 (el 3);
//   · `borradorDeLectura` sin sumar los colores escritos en el texto → 8/1 (el 4);
//   · `estiloConKit` sin `tintaSobre` (texto oscuro sobre fondo oscuro) → 8/1 (el 5);
//   · la cabecera del carrusel sin el logo (las iniciales siempre) → 8/1 (el 6);
//   · `respuestaDeDiscutir` cortando a la primera línea → 8/1 (el 7).
// Y cambios sin efecto (renombrar una variable local de `conKit`) lo dejan verde.
//
// Correr: node --import tsx --test tests/marca-kits.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KITS_VACIOS, bloqueDeMarca, borradorDeLectura, conKit, conPorDefecto, hexesDelTexto, kitElegido, kitPorDefecto, normalizarHex,
  resumenDeKit, sanearKits, sinKit, type KitMarca,
} from '../lib/marca/kits';
import { contraste, estiloConKit, logoDeKit } from '../lib/carruseles/marca-kit';
import { documentoDeCarrusel } from '../lib/carruseles/documento';
import { tipoCarrusel } from '../lib/carruseles/tipos';
import { esDiscutir, reglaDiscutir, respuestaDeDiscutir, TOPE_RESPUESTA_DISCUTIR } from '../lib/chat-editor-discutir';

const AHORA = '2026-11-05T12:00:00.000Z';
const kit = (o: Partial<KitMarca> & { id: string }): KitMarca => ({
  nombre: 'Panadería Sol', colores: [], fuentes: { titulos: null, texto: null }, logo: null, origen: null, actualizado: AHORA, ...o,
});
const SOL = kit({
  id: 'sol', colores: [{ hex: '#1E3A8A', rol: 'principal' }, { hex: '#F59E0B', rol: 'acento' }, { hex: '#0B1020', rol: 'fondo' }],
  fuentes: { titulos: 'Montserrat', texto: 'Inter' },
  logo: { subidoId: '11111111-2222-3333-4444-555555555555', url: 'https://ejemplo.supabase.co/storage/v1/object/public/image-editor/3/subidas/logo.png', nombre: 'Logo Sol', ancho: 400, alto: 200 },
});

test('1. el saneo: un color es #RRGGBB o no es, un rol lo tiene uno, y el de por defecto existe', () => {
  assert.equal(normalizarHex('#abc'), '#AABBCC');
  assert.equal(normalizarHex('rojo'), null);
  const k = sanearKits(JSON.stringify({
    kits: [{ id: 'a', nombre: '  Uno  ', colores: ['#fff', { hex: 'rojo' }, { hex: '#FFFFFF' }, { hex: '#123456', rol: 'principal' }, { hex: '#654321', rol: 'principal' }] }, { id: 'a' }, { nombre: 'sin id' }],
    porDefecto: 'no-existe',
  }));
  assert.equal(k.kits.length, 1, 'el repetido y el que no tiene id se van');
  assert.deepEqual(k.kits[0].colores, [{ hex: '#FFFFFF', rol: null }, { hex: '#123456', rol: 'principal' }, { hex: '#654321', rol: null }]);
  assert.equal(k.kits[0].nombre, 'Uno');
  assert.equal(k.porDefecto, 'a', 'un por defecto que no existe pasa al primero');
  assert.deepEqual(sanearKits('esto no es json'), KITS_VACIOS);
});

test('2. varios kits, uno por defecto: el primero lo es, y al borrarlo pasa al siguiente', () => {
  let k = KITS_VACIOS;
  const a = conKit(k, SOL); assert.ok(a.ok); k = a.kits;
  assert.equal(k.porDefecto, 'sol');
  const b = conKit(k, kit({ id: 'luna', nombre: 'Luna', colores: [{ hex: '#000000', rol: null }] })); assert.ok(b.ok); k = b.kits;
  assert.equal(k.porDefecto, 'sol', 'el segundo no le saca el lugar al primero');
  assert.equal(kitElegido(k, 'luna')?.nombre, 'Luna');
  assert.equal(kitElegido(k, 'otro'), null, 'uno pedido que no existe no se cambia por otro');
  assert.equal(kitPorDefecto(k)?.id, 'sol');
  const c = conPorDefecto(k, 'luna'); assert.ok(c.ok); assert.equal(c.kits.porDefecto, 'luna');
  const d = sinKit(k, 'sol'); assert.ok(d.ok);
  assert.equal(d.kits.porDefecto, 'luna', 'borrar el de por defecto pasa el lugar al que queda');
  assert.equal(conKit(k, kit({ id: 'vacio' })).ok, false, 'un kit sin colores, fuentes ni logo no se guarda');
});

test('3. el bloque del prompt: corto, con las fuentes que el editor TIENE y el logo sólo donde se puede poner', () => {
  const sinLaFuente = (f: string) => (f === 'Montserrat' ? 'Montserrat' : null);
  const b = bloqueDeMarca(SOL, { fuenteDelEditor: sinLaFuente, logo: 'la foto con "logo": true' });
  assert.match(b, /«Panadería Sol»/);
  assert.match(b, /#1E3A8A \(principal\), #F59E0B \(acento\), #0B1020 \(fondo\)/);
  assert.match(b, /Montserrat \(títulos\)/);
  assert.doesNotMatch(b, /Inter/, 'una fuente que el editor no tiene no se sugiere');
  assert.match(b, /Logo: la foto con "logo": true/);
  assert.ok(b.length < 400, `el bloque lo paga el cliente: ${b.length} caracteres`);
  assert.doesNotMatch(bloqueDeMarca(SOL), /Logo/, 'sin decir cómo se pone el logo, no se nombra (el video no pone imágenes)');
  assert.equal(bloqueDeMarca(null), '', 'sin kit, nada: MaKo no inventa una marca');
});

test('4. lo que lee la IA de un manual es un BORRADOR, y los colores escritos en el texto se suman', () => {
  const leido = 'Paleta: Azul noche HEX 1E3A8A · Ámbar #F59E0B · y el #FFF del fondo. Tipografía: Montserrat Bold.';
  assert.deepEqual(hexesDelTexto(leido), ['#1E3A8A', '#F59E0B', '#FFFFFF']);
  const b = borradorDeLectura({ nombre: 'Sol', colores: [{ hex: '#1e3a8a', rol: 'principal' }], fuentes: { titulos: '"Montserrat", sans-serif', texto: 'sans-serif' }, logo: { hay: true, caja: { x: 5, y: 5, ancho: 20, alto: 10 } } }, leido);
  assert.deepEqual(b.colores.map((c) => c.hex), ['#1E3A8A', '#F59E0B', '#FFFFFF']);
  assert.equal(b.colores[0].rol, 'principal');
  assert.equal(b.fuentes.titulos, 'Montserrat');
  assert.equal(b.fuentes.texto, null, 'una familia de respaldo no es una fuente de la marca');
  assert.deepEqual(b.logo, { hay: true, caja: { x: 5, y: 5, ancho: 20, alto: 10 } });
  assert.deepEqual(borradorDeLectura({ logo: { hay: true, caja: { x: 90, y: 0, ancho: 50, alto: 10 } } }).logo, { hay: true, caja: null }, 'una caja que se sale de la imagen no se recorta: el logo se sube a mano');
  assert.equal(borradorDeLectura(null, '').colores.length, 0);
});

test('5. el carrusel con la marca: su acento, su fondo, una tinta que se lee y sus fuentes', () => {
  const t = tipoCarrusel('historia');
  assert.ok(t, 'el tipo «historia» existe');
  const e = estiloConKit(t.estilo, SOL, (f) => f);
  assert.equal(e.acento, '#F59E0B');
  assert.equal(e.fondo, '#0B1020');
  assert.ok(contraste(e.tinta, e.fondo) >= 4.5, `la tinta ${e.tinta} no se lee sobre ${e.fondo}`);
  assert.equal(e.fondoCierre, '#1E3A8A', 'el cierre va con el principal');
  assert.ok(contraste(e.tintaCierre, e.fondoCierre) >= 4.5);
  assert.equal(e.titular.familia, 'Montserrat');
  assert.equal(e.texto.familia, 'Inter');
  assert.equal(estiloConKit(t.estilo, kit({ id: 'x', fuentes: { titulos: 'Inventada', texto: null }, colores: [{ hex: '#111111', rol: null }] }), () => null).titular.familia, t.estilo.titular.familia, 'una fuente que el editor no tiene no entra');
  assert.deepEqual(estiloConKit(t.estilo, null), t.estilo, 'sin kit, el tipo tal cual');
});

test('6. la cabecera del carrusel lleva el logo de la marca en lugar de las iniciales', () => {
  const t = tipoCarrusel('historia')!;
  let n = 0;
  const doc = documentoDeCarrusel({ laminas: t.estructura(3), estilo: estiloConKit(t.estilo, SOL), marca: { nombre: 'Panadería Sol', usuario: null, logo: logoDeKit(SOL) }, nuevoId: () => `o${++n}` });
  const pagina = (doc.pages as Array<{ objects: Array<Record<string, unknown>> }>)[0];
  const logo = pagina.objects.find((o) => o.name === 'Cabecera: logo');
  assert.ok(logo, 'la cabecera no trae el logo');
  assert.equal(logo.type, 'image');
  assert.equal(logo.src, SOL.logo!.url);
  assert.ok(Math.max(Number(logo.width) * Number(logo.scaleX), Number(logo.height) * Number(logo.scaleY)) <= 72.01, 'el logo entra en su cuadrado');
  assert.equal(pagina.objects.some((o) => o.name === 'Cabecera: iniciales'), false);
  n = 0;
  const sinLogo = documentoDeCarrusel({ laminas: t.estructura(3), estilo: t.estilo, marca: { nombre: 'Panadería Sol', usuario: null }, nuevoId: () => `o${++n}` });
  assert.ok((sinLogo.pages as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects.some((o) => o.name === 'Cabecera: iniciales'), 'sin logo, las iniciales');
});

test('7. «Discutir»: sólo con la palabra, la regla deja las operaciones vacías y la respuesta va entera', () => {
  assert.equal(esDiscutir('discutir'), true);
  assert.equal(esDiscutir('editar'), false);
  assert.equal(esDiscutir(undefined), false, 'sin elegir, Editar (lo de siempre)');
  assert.match(reglaDiscutir('el diseño'), /"operaciones" va SIEMPRE vacío/);
  assert.equal(respuestaDeDiscutir('Primera idea.\nSegunda idea.'), 'Primera idea.\nSegunda idea.');
  assert.equal(Array.from(respuestaDeDiscutir('😀'.repeat(TOPE_RESPUESTA_DISCUTIR + 10))).length, TOPE_RESPUESTA_DISCUTIR, 'se corta sin partir un emoji');
});

test('8. el resumen de un kit dice qué trae, sin repetir una fuente', () => {
  assert.equal(resumenDeKit(SOL), '3 colores · Montserrat y Inter · con logo');
  assert.equal(resumenDeKit(kit({ id: 'x', fuentes: { titulos: 'Inter', texto: 'Inter' } })), 'Inter');
});

test('9. reemplazar un kit lo cambia en su lugar, y no pasa el tope', () => {
  const k = conKit(KITS_VACIOS, SOL);
  assert.ok(k.ok);
  const otro = conKit(k.kits, { ...SOL, nombre: 'Sol 2' });
  assert.ok(otro.ok);
  assert.equal(otro.kits.kits.length, 1);
  assert.equal(otro.kits.kits[0].nombre, 'Sol 2');
  let lleno = KITS_VACIOS;
  for (let i = 0; i < 30; i++) { const r = conKit(lleno, kit({ id: `k${i}`, colores: [{ hex: '#000000', rol: null }] })); assert.ok(r.ok); lleno = r.kits; }
  assert.equal(conKit(lleno, kit({ id: 'k30', colores: [{ hex: '#000000', rol: null }] })).ok, false, 'el kit 31 no pisa a otro');
});
