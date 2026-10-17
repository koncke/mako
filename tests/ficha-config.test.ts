// =============================================================================
// La ficha de UN funnel: sólo lo cambiado, el respaldo del negocio y los cambios como parches
// =============================================================================
// lib/ficha/config.ts (decisión 1 de docs/diseno-ficha-bloques.md): la ficha se guarda POR FUNNEL en
// `funnels.data.ficha` con SÓLO lo que alguien cambió; lo que nadie tocó sigue a la plantilla, y lo que
// el negocio ya eligió en el Resumen y en los avisos queda de respaldo. Se prueba EJECUTANDO el saneo, la
// ficha que se dibuja y cada cambio.
//
// Correr: npx tsx --test tests/ficha-config.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 10/0), cada rotura restaurada antes de la siguiente:
//   · el saneo sin tirar un ancho que el bloque no acepta (lo deja pasar)          → 9 / 1
//   · `listaDeEntrada` sin el respaldo de Instagram (redes con las cuatro)        → 9 / 1
//   · los apagados calculados sobre la ficha que QUEDÓ y no sobre la plantilla     → 9 / 1
//   · el negocio ganándole a lo elegido a mano en el funnel                        → 9 / 1
//   · `normalizar` sin borrar una tab igual a la de la plantilla                   → 9 / 1
//   · quitar `contacto` permitido                                                  → 9 / 1
//   · una asistencia que se deja apagar a mano                                      → 9 / 1
//
// ⚠️ DOS ASERCIONES REESCRITAS EL 16/10/2026 (el Resumen nativo): el Resumen de entrada de cada tipo es su plantilla
// ARMADA (lib/ficha/plantillas-resumen.ts), con otro orden y, en las de llamada, con las redes ya puestas. Lo que se
// fija no cambia: (1) LinkedIn prendido a propósito suma las redes después del contacto en un Resumen que no las trae
// (ahora el del carrito, «Si compró»); (2) devolver un bloque a su lugar deja la ficha sin nada guardado (las notas
// del carrito van décimas, al final). Re-verificado rompiéndolo: `listaDeIds` sin sumar las redes → 9 / 1.
//
// ⚠️ TRES ASERCIONES REESCRITAS EL 16/10/2026 (verificación de la tanda 1): las plantillas de entrada del Resumen ahora
// traen «Redes y web» e «Ingreso estimado» en los nueve tipos, porque el contacto de antes los mostraba ADENTRO
// (tests/ficha-resumen-lo-de-antes.test.ts). Las tres leían una plantilla concreta como dato del test, y por eso cambian:
//   (1) «un Resumen que no trae las redes» ya no es el del carrito: es la ÉPICA elegida a mano (la regla, igual: LinkedIn
//       prendido a propósito suma las redes después del contacto);
//   (2) «el primer cambio arranca de lo que se veía» compara con el Resumen que se VE (la plantilla de la tab), no con la
//       lista del tipo: daban lo mismo por casualidad (las dos de 15);
//   (3) devolver las notas «a su lugar» las pone en SU lugar (el que tenían), no en el décimo fijo.
// Re-verificado rompiéndolo (base 10/0): `listaDeIds` sin sumar las redes → 9 / 1; el primer cambio arrancando de la
// lista del tipo (`listaDeEntrada`) en vez de lo que se veía → 8 / 2.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearFicha, fichaEfectiva, aplicarCambio, sanearCambio, normalizar, listaDeEntrada, dondeSeCompleta, bloquesDeTab,
  describirCambio, RESPALDO_VACIO, type FichaGuardada, type RespaldoNegocio, type CambioFicha,
} from '../lib/ficha/config';
import { plantillaFicha, listaDePlantilla } from '../lib/ficha/plantillas';
import { TEMA_BASE } from '../lib/graficos-temas';

const ids = (l: ReadonlyArray<{ id: string }>) => l.map((b) => b.id);
const ok = (r: ReturnType<typeof aplicarCambio>) => { assert.ok(r.ok, r.ok ? '' : r.error); return r as Extract<typeof r, { ok: true }>; };

test('el saneo: ids que no existen se tiran, un ancho o un diseño que no van caen al de entrada', () => {
  const g = sanearFicha({
    plantilla: 'inventada',
    tabs: {
      pagos: [{ id: 'cuotas', ancho: 3, diseno: 'tabla' }, { id: 'no-existe' }, { id: 'venta', ancho: 6, diseno: 'raro', icono: 'dinero' }, { id: 'cuotas' }, { id: 'reunion-1' }],
      inventada: [{ id: 'notas' }],
      resumen: [{ id: 'notas' }],
    },
    avisos: { empresa: false, asistenciaR1: false, inventado: true, plan: 'no' },
    estilo: { tema: { plantilla: 'nada', acento: '#ABCDEF', fuente: 'nada' }, densidad: 'gigante' },
  });
  assert.equal(g.plantilla, undefined, 'una plantilla que no existe se tira');
  assert.deepEqual(g.tabs?.pagos, [{ id: 'cuotas', ancho: 12, diseno: 'tabla' }, { id: 'venta', ancho: 6, diseno: 'cajas' }],
    'cuotas no va de ¼; un diseño raro cae al primero; el ícono igual al del catálogo no se guarda; repetidos y bloques de otra tab, afuera');
  assert.deepEqual(ids(g.tabs!.resumen!), ['contacto', 'notas'], 'contacto no se quita: vuelve arriba');
  assert.equal((g.tabs as Record<string, unknown>).inventada, undefined);
  assert.deepEqual(g.avisos, { empresa: false }, 'una asistencia no se apaga; un id o un valor que no son, afuera');
  assert.deepEqual(g.estilo, { tema: { plantilla: 'mako', acento: '#abcdef', fuente: null } }, 'el TemaHoja del Dashboard, saneado con sanearTema');
  assert.deepEqual(sanearFicha('basura'), {});
  assert.deepEqual(sanearFicha(null), {});
});

test('una respuesta destacada puede ir varias veces; el resto, una', () => {
  const g = sanearFicha({ tabs: { resumen: [{ id: 'contacto' }, { id: 'respuesta-destacada', opciones: { pregunta: 'Zona' } }, { id: 'respuesta-destacada', opciones: { pregunta: 'Presupuesto' } }] } });
  assert.deepEqual(g.tabs!.resumen!.map((b) => b.opciones?.pregunta ?? null), [null, 'Zona', 'Presupuesto']);
});

test('lo que nadie tocó sigue a la plantilla, con el respaldo del negocio', () => {
  const sinRespaldo = fichaEfectiva('dos-reuniones', {}, RESPALDO_VACIO);
  assert.deepEqual(ids(sinRespaldo.tabs.reuniones), [...listaDePlantilla(plantillaFicha('dos-reuniones'), 'reuniones')]);
  assert.deepEqual(sinRespaldo.tocadas, []);
  const redes = sinRespaldo.tabs.resumen.find((b) => b.id === 'redes-y-web')!;
  assert.deepEqual(redes.opciones?.redes, ['web', 'instagram'], 'lo de fábrica de crm.resumen.campos: web e Instagram');
  // Tracking: Evento no trae lista, usa la del respaldo (§4).
  assert.deepEqual(ids(fichaEfectiva('evento', {}, RESPALDO_VACIO).tabs.tracking), [...listaDePlantilla(plantillaFicha('respaldo'), 'tracking')]);

  const negocio: RespaldoNegocio = { resumen: { instagram: false, linkedin: true, form_meta: false, direccion: true, ingreso: false, cohorte: false }, apagados: [] };
  const f = fichaEfectiva('dos-reuniones', {}, negocio);
  assert.deepEqual(f.tabs.resumen.find((b) => b.id === 'redes-y-web')!.opciones?.redes, ['web', 'linkedin'], 'Instagram apagado, LinkedIn prendido');
  assert.deepEqual(f.tabs.resumen.find((b) => b.id === 'lo-que-contesto')!.opciones?.fuentes, ['landing', 'agenda'], 'sin el formulario de Meta');
  assert.ok(ids(f.tabs.resumen).includes('direccion'), 'la dirección prendida entra al Resumen');
  assert.ok(!ids(f.tabs.resumen).includes('ingreso-estimado'), 'ingreso apagado');
  assert.ok(!ids(f.tabs.reuniones).includes('cohorte'), 'cohorte apagada');
  // La épica no trae redes: LinkedIn prendido a propósito las suma, después del contacto.
  const epica: FichaGuardada = { plantillasTab: { resumen: 'resumen-epica' } };
  const carrito = ids(fichaEfectiva('carrito', epica, negocio).tabs.resumen);
  assert.ok(!ids(fichaEfectiva('carrito', epica, RESPALDO_VACIO).tabs.resumen).includes('redes-y-web'));
  assert.equal(carrito[carrito.indexOf('contacto') + 1], 'redes-y-web');
  // Sin ninguna red, sin bloque.
  const sinRedes = listaDeEntrada(plantillaFicha('prospeccion'), 'resumen', { resumen: { web: false, instagram: false }, apagados: [] });
  assert.ok(!ids(sinRedes).includes('redes-y-web'));
});

test('una tab que alguien tocó ya no sigue a la plantilla ni al respaldo', () => {
  const g: FichaGuardada = { tabs: { pagos: [{ id: 'venta', ancho: 6, diseno: 'cajas' }] } };
  const f = fichaEfectiva('una-llamada', g, { resumen: { ingreso: false }, apagados: [] });
  assert.deepEqual(ids(f.tabs.pagos), ['venta']);
  assert.deepEqual(f.tocadas, ['pagos']);
});

test('los avisos: plantilla + negocio, lo elegido a mano en el funnel gana, las asistencias siempre', () => {
  const carrito = fichaEfectiva('carrito', {}, { resumen: {}, apagados: ['telefono'] });
  for (const id of ['setter', 'calificado', 'empresa', 'plan', 'dealFiscal', 'telefono']) assert.ok(carrito.apagados.includes(id as never), `carrito: ${id}`);
  assert.ok(!carrito.apagados.includes('comprobante'));
  assert.equal(carrito.avisos.find((a) => a.id === 'telefono')!.por, 'negocio');
  assert.equal(carrito.avisos.find((a) => a.id === 'setter')!.por, 'plantilla');
  assert.equal(carrito.avisos.find((a) => a.id === 'asistenciaR1')!.por, 'siempre');
  const aMano = fichaEfectiva('carrito', { avisos: { setter: true, telefono: true, monto: false } }, { resumen: {}, apagados: ['telefono'] });
  assert.ok(!aMano.apagados.includes('setter') && !aMano.apagados.includes('telefono') && aMano.apagados.includes('monto'));
  assert.equal(aMano.avisos.find((a) => a.id === 'telefono')!.por, 'a-mano');
});

test('sacar un bloque a mano NO apaga su aviso', () => {
  const r = ok(aplicarCambio({}, { op: 'quitar', tab: 'pagos', bloque: 'cuotas' }, 'dos-reuniones', RESPALDO_VACIO));
  const f = fichaEfectiva('dos-reuniones', r.ficha, RESPALDO_VACIO);
  assert.ok(!ids(f.tabs.pagos).includes('cuotas'));
  assert.ok(!f.apagados.includes('plan') && !f.apagados.includes('comprobante'), 'el plan y el comprobante siguen avisando');
  assert.equal(dondeSeCompleta(f, 'plan'), null, 'sin el bloque, «Completar» abre el asistente');
  assert.equal(dondeSeCompleta(fichaEfectiva('dos-reuniones', {}, RESPALDO_VACIO), 'setter'), 'resumen', 'setter y closer pasan al Resumen');
});

test('los cambios: poner, mover, ancho, diseño, y lo que no se puede', () => {
  const R = RESPALDO_VACIO;
  const puesto = ok(aplicarCambio({}, { op: 'poner', tab: 'resumen', bloque: 'sexo', lugar: 2 }, 'landing', R));
  assert.equal(ids(puesto.ficha.tabs!.resumen!)[1], 'sexo');
  assert.equal(ids(puesto.ficha.tabs!.resumen!).length, fichaEfectiva('landing', {}, R).tabs.resumen.length + 1, 'el primer cambio arranca de lo que se veía');
  const movido = ok(aplicarCambio(puesto.ficha, { op: 'mover', tab: 'resumen', bloque: 'sexo', lugar: 99 }, 'landing', R));
  assert.equal(ids(movido.ficha.tabs!.resumen!).at(-1), 'sexo', 'un lugar fuera de rango va al final');
  const ancho = ok(aplicarCambio(movido.ficha, { op: 'ancho', tab: 'resumen', bloque: 'sexo', ancho: 3 }, 'landing', R));
  assert.equal(ancho.ficha.tabs!.resumen!.find((b) => b.id === 'sexo')!.ancho, 3);
  const malAncho = aplicarCambio(ancho.ficha, { op: 'ancho', tab: 'resumen', bloque: 'sexo', ancho: 12 }, 'landing', R);
  assert.equal(malAncho.ok, false);
  const diseno = aplicarCambio(ancho.ficha, { op: 'diseno', tab: 'resumen', bloque: 'sexo', diseno: 'mapa' }, 'landing', R);
  assert.equal(diseno.ok, false, 'un diseño de otro bloque');
  assert.equal(aplicarCambio({}, { op: 'poner', tab: 'resumen', bloque: 'contacto' }, 'landing', R).ok, false, 'ya está');
  assert.equal(aplicarCambio({}, { op: 'quitar', tab: 'resumen', bloque: 'contacto' }, 'landing', R).ok, false, 'contacto no se quita');
  // ⚠️ REESCRITO EL 16/10/2026: era `cuotas`, que la lista de Formulario de Meta no trae. Desde la ficha por tab, la
  //    tab Pagos de un funnel sin tocar es la plantilla de Pagos sugerida para su tipo («Cobrar una venta», que SÍ trae
  //    cuotas: lib/ficha/plantillas-pagos.ts). La regla no cambió: quitar lo que no está puesto es un error.
  assert.equal(aplicarCambio({}, { op: 'quitar', tab: 'pagos', bloque: 'datos-fiscales' }, 'formulario-meta', R).ok, false, 'no está puesto');
  // Ya está así: nada que escribir.
  const igual = ok(aplicarCambio({}, { op: 'densidad', densidad: 'normal' }, 'landing', R));
  assert.equal(igual.cambio, false);
});

test('sólo lo cambiado: volver a la plantilla, cambiar de plantilla y deshacer', () => {
  const R = RESPALDO_VACIO;
  const lugarDeNotas = ids(fichaEfectiva('carrito', {}, R).tabs.resumen).indexOf('notas') + 1;
  const quitado = ok(aplicarCambio({}, { op: 'quitar', tab: 'resumen', bloque: 'notas' }, 'carrito', R));
  const devuelto = ok(aplicarCambio(quitado.ficha, { op: 'poner', tab: 'resumen', bloque: 'notas', lugar: lugarDeNotas }, 'carrito', R));
  assert.deepEqual(devuelto.ficha, {}, 'volver a dejarla como la plantilla no deja nada guardado');
  // El panel de avisos manda la lista ENTERA de lo que no avisa: lo que la plantilla apagaba y no está en la
  // lista pasa a avisar; se guarda sólo lo que difiere (el setter ya venía apagado, no se guarda).
  const avisos = ok(aplicarCambio({}, { op: 'avisos', apagados: ['monto', 'setter'] }, 'carrito', R));
  assert.deepEqual(fichaEfectiva('carrito', avisos.ficha, R).apagados, ['monto', 'setter']);
  assert.equal(avisos.ficha.avisos?.setter, undefined);
  assert.equal(avisos.ficha.avisos?.monto, false);
  assert.equal(avisos.ficha.avisos?.comprobante, undefined, 'en el carrito el comprobante ya avisaba');
  const tema = ok(aplicarCambio({}, { op: 'tema', tema: { plantilla: 'editorial' } }, 'carrito', R));
  assert.deepEqual(tema.ficha.estilo, { tema: { ...TEMA_BASE, plantilla: 'editorial' } });
  const base = ok(aplicarCambio(tema.ficha, { op: 'tema', tema: { plantilla: 'mako' } }, 'carrito', R));
  assert.deepEqual(base.ficha, {}, 'el tema base no se guarda');
  const otra = ok(aplicarCambio({ ...quitado.ficha, estilo: { densidad: 'amplia' } }, { op: 'plantilla', plantilla: 'landing' }, 'carrito', R));
  assert.deepEqual(otra.ficha, { plantilla: 'landing', estilo: { densidad: 'amplia' } }, 'otra plantilla arranca de cero; el estilo queda');
  assert.equal(fichaEfectiva('carrito', otra.ficha, R).plantilla, 'landing');
  const auto = ok(aplicarCambio(otra.ficha, { op: 'plantilla', plantilla: null }, 'carrito', R));
  assert.deepEqual(auto.ficha, { estilo: { densidad: 'amplia' } });
  const vuelta = ok(aplicarCambio(quitado.ficha, { op: 'volver' }, 'carrito', R));
  assert.deepEqual(vuelta.ficha, {});
  const deshacer = ok(aplicarCambio(vuelta.ficha, { op: 'restaurar', ficha: quitado.ficha }, 'carrito', R));
  assert.deepEqual(deshacer.ficha, quitado.ficha);
  assert.deepEqual(normalizar({ tabs: { tracking: listaDeEntrada(plantillaFicha('carrito'), 'tracking', R) } }, 'carrito', R), {});
});

test('un cambio que llega de afuera se valida en su forma antes de tocar nada', () => {
  assert.ok('error' in sanearCambio({ op: 'poner', tab: 'tracking', bloque: 'cuotas' }), 'cuotas no va en Tracking');
  assert.ok('error' in sanearCambio({ op: 'ancho', tab: 'pagos', bloque: 'cuotas', ancho: 5 }));
  assert.ok('error' in sanearCambio({ op: 'aviso', paso: 'asistenciaR2', avisa: false }), 'las asistencias siempre avisan');
  assert.ok('error' in sanearCambio({ op: 'borrar-todo' }));
  assert.ok('error' in sanearCambio({ op: 'plantilla', plantilla: 'inventada' }));
  const c = sanearCambio({ op: 'mover', tab: 'pagos', bloque: 'venta', lugar: 1, extra: 'x' }) as CambioFicha;
  assert.deepEqual(c, { op: 'mover', tab: 'pagos', bloque: 'venta', lugar: 1 });
  assert.match(describirCambio(c), /Venta/);
  assert.deepEqual(sanearCambio({ op: 'plantilla', plantilla: null }), { op: 'plantilla', plantilla: null });
});

test('lo privado (el coaching de la llamada) sólo para quien lo puede ver', () => {
  const g: FichaGuardada = { tabs: { reuniones: [{ id: 'reunion-1', ancho: 12, diseno: 'completa' }, { id: 'coaching-de-la-llamada', ancho: 6, diseno: 'puntaje' }] } };
  const f = fichaEfectiva('una-llamada', g, RESPALDO_VACIO);
  assert.deepEqual(bloquesDeTab(f, 'reuniones', { verPrivado: false }).map((x) => x.puesto.id), ['reunion-1']);
  assert.deepEqual(bloquesDeTab(f, 'reuniones', { verPrivado: true }).map((x) => x.puesto.id), ['reunion-1', 'coaching-de-la-llamada']);
});
