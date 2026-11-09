// =============================================================================
// Replicar un carrusel, guiado: qué pregunta MaKo y en qué orden (lib/carruseles/guiado.ts, 9/11/2026)
// =============================================================================
// Martín, 9/11: «ni siquiera me pregunta qué oferta» y el avatar «SÓLO si el carrusel tiene una persona: si es solo texto, que lo
// detecte y no le pregunte eso». Estos tests EJECUTAN la máquina de pasos con los hechos de una pestaña y tocan sus botones.
//
// Correr: node --import tsx --test tests/carruseles-guiado.test.ts
//
// PROBADO ROMPIÉNDOLO (9/11/2026, base 10/0), cada rotura con su rojo:
//   · el avatar siempre (también sin persona)          → 8/2 (2, 6)
//   · sin saber si hay persona, se saltea               → 9/1 (3)
//   · la principal no va primero                        → 9/1 (4)
//   · sin ofertas, lo escrito no es la oferta           → 9/1 (5)
//   · acepta una foto que no tiene                      → 9/1 (7)
//   · acepta los colores sin kit                        → 9/1 (6)
//   · dos ofertas iguales dan dos rótulos iguales       → 9/1 (4) — la primera versión del test daba VERDE: los dos «Taller»
//     caían en páginas distintas
//   · el rótulo no se corta                             → 9/1 (4)
//   · «Ahora no» no pausa                               → 9/1 (8)
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFERTAS_POR_PREGUNTA, VALOR, cortarRotulo, fotoDelGuiado, leerLectura, escribir, leerPedidoGuiado, pasoDe, pedidoDelGuiado, preguntaDe, responder, seguir,
  type HechosGuiado, type RespuestasGuiado,
} from '../lib/carruseles/guiado';
import { problemasDeApertura, TOPE_ROTULO, type Boton } from '../lib/aperturas/reglas';
import { marcasDeVoseo } from '../lib/voseo';

const base: HechosGuiado = {
  laminas: 9, creador: '@growithalex',
  ofertas: [{ id: 7, nombre: 'Taller de ventas', principal: false }, { id: 3, nombre: 'Mentoría 1 a 1', principal: true }],
  persona: true, leyendo: false, fotos: { cara: true, look: true }, kit: true,
};

/** El botón de la pregunta de ahora con ese rótulo (falla si no está: un rótulo que no se ve no se toca). */
function boton(h: HechosGuiado, r: RespuestasGuiado, rotulo: string): Boton<never> {
  const p = preguntaDe(h, r);
  assert.ok(p, `no hay pregunta (paso ${pasoDe(h, r)})`);
  const b = p.botones.find((x) => x.rotulo === rotulo);
  assert.ok(b, `«${rotulo}» no está entre ${p.botones.map((x) => `«${x.rotulo}»`).join(', ')}`);
  return b;
}
const tocar = (h: HechosGuiado, r: RespuestasGuiado, rotulo: string) => responder(h, r, boton(h, r, rotulo));

test('1. el camino entero: oferta → avatar → qué cambiar → resumen → generar, y lo que sale', () => {
  let r: RespuestasGuiado = {};
  assert.equal(pasoDe(base, r), 'oferta');
  r = tocar(base, r, 'Mentoría 1 a 1');
  assert.equal(pasoDe(base, r), 'avatar');
  r = tocar(base, r, 'Mi cara de marca');
  assert.equal(pasoDe(base, r), 'cambio');
  r = tocar(base, r, 'Sólo los textos');
  assert.equal(pasoDe(base, r), 'resumen');
  assert.match(preguntaDe(base, r)!.texto, /9 láminas para «Mentoría 1 a 1», con tu cara de marca y cambiando sólo los textos/);
  r = tocar(base, r, 'Generar las 9 láminas');
  assert.equal(pasoDe(base, r), 'listo');
  assert.deepEqual(pedidoDelGuiado(base, r), { ofertaId: 3, ofertaLibre: null, avatar: 'cara', cambio: 'textos', pedido: null });
  // Lo dicho queda en el hilo, en orden, con el rótulo que tocó.
  assert.deepEqual(r.charla?.map((c) => c.yo), ['Mentoría 1 a 1', 'Mi cara de marca', 'Sólo los textos', 'Generar las 9 láminas']);
});

test('2. sólo texto: con un «no» MEDIDO no pregunta el avatar, y el pedido no lleva avatar', () => {
  const h = { ...base, persona: false };
  let r = tocar(h, {}, 'Mentoría 1 a 1');
  assert.equal(pasoDe(h, r), 'cambio', 'un carrusel sin persona pasó por la pregunta del avatar');
  r = tocar(h, r, 'Sólo los textos');
  assert.doesNotMatch(preguntaDe(h, r)!.texto, /cara de marca|sin persona/);
  assert.equal(pedidoDelGuiado(h, tocar(h, r, 'Generar las 9 láminas'))!.avatar, null);
});

test('3. sin saber si hay persona: mientras lee espera; si la lectura no pudo, pregunta con «No tiene persona»', () => {
  const leyendo = { ...base, persona: null, leyendo: true };
  const r = tocar(leyendo, {}, 'Mentoría 1 a 1');
  assert.equal(pasoDe(leyendo, r), 'leyendo');
  assert.equal(preguntaDe(leyendo, r), null);
  const sinSaber = { ...base, persona: null, leyendo: false };
  assert.equal(pasoDe(sinSaber, r), 'avatar', 'sin poder ver si tiene persona no se puede saltear: dejaría la cara del competidor');
  const r2 = tocar(sinSaber, r, 'No tiene persona');
  assert.equal(pasoDe(sinSaber, r2), 'cambio');
  assert.equal(pedidoDelGuiado(sinSaber, tocar(sinSaber, tocar(sinSaber, r2, 'Sólo los textos'), 'Generar las 9 láminas'))!.avatar, 'ninguno');
});

test('4. las ofertas: la principal primero, de a dos con «Ver más» que da la vuelta, y rótulos únicos y cortos', () => {
  const muchas: HechosGuiado = {
    ...base,
    ofertas: [
      // La principal y la que le sigue se llaman igual: caen en la MISMA pregunta (con «Taller» en otra página, la regla de
      // los rótulos únicos daba verde sin mirar nada: lo cazó el arnés de romper).
      { id: 1, nombre: 'Taller', principal: false },
      { id: 2, nombre: 'Programa de 12 semanas para dueños de clínicas dentales', principal: false },
      { id: 3, nombre: 'Taller', principal: true },
      { id: 4, nombre: 'Curso grabado', principal: false },
    ],
  };
  const p1 = preguntaDe(muchas, {})!;
  const opciones = p1.botones.filter((b) => b.tipo === 'respuesta' && b.valor.startsWith('oferta:') && b.valor !== VALOR.ofertaMas);
  assert.equal(opciones.length, OFERTAS_POR_PREGUNTA);
  assert.equal((opciones[0] as { valor: string }).valor, VALOR.oferta(3), 'la principal va primero');
  for (const b of p1.botones) assert.ok(b.rotulo.length <= TOPE_ROTULO, `«${b.rotulo}» pasa de ${TOPE_ROTULO}`);
  assert.equal(new Set(p1.botones.map((b) => b.rotulo)).size, p1.botones.length, 'dos botones dicen lo mismo');
  const r1 = tocar(muchas, {}, 'Ver más');
  const p2 = preguntaDe(muchas, r1)!;
  assert.ok(p2.botones.some((b) => b.tipo === 'respuesta' && b.valor === VALOR.oferta(4)), 'la segunda página trae las que faltaban');
  for (const b of p2.botones) assert.ok(b.rotulo.length <= TOPE_ROTULO, `«${b.rotulo}» pasa de ${TOPE_ROTULO}`);
  assert.ok(p2.botones.some((b) => b.rotulo.endsWith('…')), 'el nombre largo se corta con «…»');
  const r2 = tocar(muchas, r1, 'Ver más');
  assert.deepEqual(preguntaDe(muchas, r2)!.botones.map((b) => b.rotulo), p1.botones.map((b) => b.rotulo), '«Ver más» da la vuelta');
  assert.equal(cortarRotulo('x'.repeat(40)).length, TOPE_ROTULO);
});

test('5. sin ofertas: «Cargar una oferta» (link) o «Lo escribo yo», y lo escrito ES la oferta', () => {
  const h = { ...base, ofertas: [] };
  const p = preguntaDe(h, {})!;
  assert.ok(p.botones.some((b) => b.tipo === 'ir' && b.rotulo === 'Cargar una oferta'));
  let r = tocar(h, {}, 'Lo escribo yo');
  assert.equal(r.escribiendo, 'oferta');
  r = escribir(h, r, '  Un curso   de fotografía  ');
  assert.deepEqual(r.oferta, { libre: 'Un curso de fotografía' });
  assert.equal(pasoDe(h, r), 'avatar');
  // Sin tocar «Lo escribo yo», lo escrito en la pregunta de la oferta también es la oferta (no hay otra que elegir).
  assert.deepEqual(escribir(h, {}, 'Mi consultoría').oferta, { libre: 'Mi consultoría' });
  // «No pude leer» no es «no tienes»: no ofrece cargar, ofrece escribirla.
  const nul = preguntaDe({ ...base, ofertas: null }, {})!;
  assert.match(nul.texto, /No pude leer tus ofertas/);
  assert.ok(!nul.botones.some((b) => b.tipo === 'ir'));
});

test('6. qué cambiar: «Lo escribo yo» hace que la caja conteste; sin kit, no ofrece los colores', () => {
  const h = { ...base, persona: false };
  let r = tocar(h, {}, 'Mentoría 1 a 1');
  r = tocar(h, r, 'Lo escribo yo');
  assert.equal(r.escribiendo, 'cambio');
  r = escribir(h, r, 'Que el fondo sea azul');
  assert.deepEqual(r.cambio, { libre: 'Que el fondo sea azul' });
  assert.match(preguntaDe(h, r)!.texto, /además: Que el fondo sea azul/);
  assert.equal(pedidoDelGuiado(h, r)!.cambio, 'libre');
  assert.equal(pedidoDelGuiado(h, r)!.pedido, 'Que el fondo sea azul');
  const sinKit = { ...h, kit: false };
  const rc = tocar(sinKit, {}, 'Mentoría 1 a 1');
  assert.ok(!preguntaDe(sinKit, rc)!.botones.some((b) => b.rotulo === 'Textos y mis colores'));
  assert.equal(responder(sinKit, rc, { tipo: 'respuesta', rotulo: 'x', valor: VALOR.cambio('marca') }), rc, 'los colores sin kit no se aceptan');
});

test('7. el avatar: sólo las fotos que tiene; sin ninguna, «Subir mi foto» (link) y «Sin persona»', () => {
  const soloCara = { ...base, fotos: { cara: true, look: false } };
  const r = tocar(soloCara, {}, 'Mentoría 1 a 1');
  const rotulos = preguntaDe(soloCara, r)!.botones.map((b) => b.rotulo);
  assert.ok(rotulos.includes('Mi cara de marca') && !rotulos.includes('Mi último look'));
  assert.equal(responder(soloCara, r, { tipo: 'respuesta', rotulo: 'x', valor: VALOR.avatar('look') }), r, 'una foto que no tiene no se acepta');
  const sinFotos = { ...base, fotos: { cara: false, look: false } };
  const p = preguntaDe(sinFotos, tocar(sinFotos, {}, 'Mentoría 1 a 1'))!;
  assert.ok(p.botones.some((b) => b.tipo === 'ir' && b.rotulo === 'Subir mi foto'));
  assert.ok(p.botones.some((b) => b.rotulo === 'Sin persona'));
});

test('8. «Ahora no» pausa y «Seguir» vuelve a la misma pregunta; lo escrito fuera de una pregunta se anota', () => {
  let r = tocar(base, {}, 'Mentoría 1 a 1');
  r = tocar(base, r, 'Ahora no');
  assert.equal(pasoDe(base, r), 'pausado');
  assert.equal(preguntaDe(base, r), null);
  r = seguir(r);
  assert.equal(pasoDe(base, r), 'avatar');
  r = escribir(base, r, 'Hazlo más corto');
  assert.deepEqual(r.extras, ['Hazlo más corto']);
  assert.equal(pasoDe(base, r), 'avatar', 'un pedido extra no contesta la pregunta');
  r = tocar(base, tocar(base, r, 'Sin persona'), 'Sólo los textos');
  assert.equal(pedidoDelGuiado(base, r)!.pedido, 'Hazlo más corto');
  // «Cambiar algo» vuelve a la oferta y conserva lo escrito.
  const de0 = tocar(base, r, 'Cambiar algo');
  assert.equal(pasoDe(base, de0), 'oferta');
  assert.deepEqual(de0.extras, ['Hazlo más corto']);
});

test('9. cada pregunta cumple las reglas de una apertura de la casa, y ninguna habla de vos', () => {
  const variantes: HechosGuiado[] = [
    base, { ...base, persona: false }, { ...base, persona: null }, { ...base, ofertas: [] }, { ...base, ofertas: null },
    { ...base, fotos: { cara: false, look: false } }, { ...base, kit: false }, { ...base, laminas: 1 },
    { ...base, ofertas: [{ id: 9, nombre: 'Una sola', principal: true }] },
  ];
  const caminos: ((h: HechosGuiado) => RespuestasGuiado)[] = [
    () => ({}),
    (h) => ({ escribiendo: 'oferta' as const, ...(h.ofertas?.length ? {} : {}) }),
    (h) => escribir(h, { escribiendo: 'oferta' }, 'Mi curso'),
    (h) => ({ ...escribir(h, { escribiendo: 'oferta' }, 'Mi curso'), avatar: 'ninguno' as const }),
    (h) => ({ ...escribir(h, { escribiendo: 'oferta' }, 'Mi curso'), avatar: 'ninguno' as const, escribiendo: 'cambio' as const }),
    (h) => ({ ...escribir(h, { escribiendo: 'oferta' }, 'Mi curso'), avatar: 'ninguno' as const, cambio: 'textos' as const }),
  ];
  let vistas = 0;
  for (const h of variantes) for (const c of caminos) {
    const r = c(h);
    const p = preguntaDe(h, r);
    if (!p) continue;
    vistas++;
    const primerPaso = pasoDe(h, r) === 'oferta' && !r.escribiendo;
    assert.deepEqual(problemasDeApertura(p, { primerPaso }), [], `${p.id}: ${JSON.stringify(problemasDeApertura(p, { primerPaso }))}`);
    assert.deepEqual(marcasDeVoseo([p.texto, ...p.botones.map((b) => b.rotulo)].join(' · ')), [], `${p.id} habla de vos`);
  }
  // Un cero no es un resultado hasta que se ve el denominador.
  assert.ok(vistas >= 30, `se miraron ${vistas} preguntas`);
});

test('10. lo que manda el navegador se lee sin creerle', () => {
  assert.deepEqual(leerPedidoGuiado({ ofertaId: 3.5, avatar: 'otro', cambio: 'todo', pedido: '   ' }), { ofertaId: null, ofertaLibre: null, avatar: null, cambio: 'textos', pedido: null });
  assert.deepEqual(leerPedidoGuiado({ ofertaId: 12, ofertaLibre: 'no viaja con un id', avatar: 'look', cambio: 'marca' }), { ofertaId: 12, ofertaLibre: null, avatar: 'look', cambio: 'marca', pedido: null });
  assert.equal(leerPedidoGuiado({ ofertaLibre: 'x'.repeat(900) }).ofertaLibre!.length, 300);
  assert.deepEqual(leerPedidoGuiado(null), { ofertaId: null, ofertaLibre: null, avatar: null, cambio: 'textos', pedido: null });
});

test('11. la foto que se busca: la elegida, ninguna con «Sin persona», y la cara de marca sin guiado', () => {
  const g = (avatar: 'cara' | 'look' | 'ninguno' | null) => ({ ofertaId: 1, ofertaLibre: null, avatar, cambio: 'textos' as const, pedido: null });
  assert.equal(fotoDelGuiado(g('ninguno')), null, '«Sin persona» no pone ninguna foto: la cara del dueño encima de otra persona es el bug de antes');
  assert.equal(fotoDelGuiado(g('look')), 'look');
  assert.equal(fotoDelGuiado(g('cara')), 'cara');
  assert.equal(fotoDelGuiado(g(null)), 'cara');
  assert.equal(fotoDelGuiado(null), 'cara', 'sin guiado, lo de siempre');
});

test('12. la lectura: un sí o un no de verdad, y «no sé» cuando no se entiende (nunca un no por no entender)', () => {
  assert.deepEqual(leerLectura('```json\n{"persona": true, "lettering": false}\n```'), { persona: true, lettering: false });
  assert.deepEqual(leerLectura('{"persona": "no", "lettering": "sí"}'), { persona: false, lettering: true });
  assert.deepEqual(leerLectura('{"persona": "tal vez"}'), { persona: null, lettering: null });
  assert.deepEqual(leerLectura('No veo las imágenes.'), { persona: null, lettering: null });
  assert.deepEqual(leerLectura('{roto'), { persona: null, lettering: null });
});
