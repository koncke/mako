// =============================================================================
// tests/editor-landing-animaciones.test.ts — el catálogo de animaciones (el contrato)
// =============================================================================
// Fija lo que comparten la hoja, el render, el panel, la API y Replicar (lib/editor-landing/animaciones.ts):
//   · cada efecto tiene nombre, grupo y keyframes (una variante por dirección);
//   · «Subir» es EXACTAMENTE la entrada de siempre (una landing que nunca eligió nada no cambia);
//   · el estilo de la landing le llega a las secciones que no eligieron, «ninguna» y el interruptor apagado
//     no animan, y «alterna» va izquierda/derecha;
//   · el saneo tira lo que no está en el catálogo.
//
// ── Roturas (15/10/2026, a mano y restaurado; base en verde: 6 pasan, 0 fallan) ──
//   · «Subir» con translateY(24px) ......................................... 5 / 1
//   · `animacionDeSeccion` sin la rama de «ninguna» ......................... 5 / 1
//   · «alterna» siempre a la izquierda ...................................... 5 / 1
//   · `keyframesAnimaciones` sin las variantes por dirección ................ 5 / 1
// Ampliado el 15/10/2026 (paquete A, el render): `datosDeAnimacion` y `CORTE_CELULAR`. Sus roturas, corridas
// junto con tests/editor-landing-animaciones-render.test.ts, están al final de ese archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORTE_CELULAR, EFECTOS, ESTILOS_PAGINA, ESTILO_DEFAULT, GRUPOS_EFECTO, SIN_ANIMACION, VIDEO_FONDO, datosDeAnimacion,
  animacionCss, animacionDeSeccion, efectoPorId, keyframesAnimaciones, nombreKeyframes,
  sanearAnimacionSeccion, sanearDireccion, sanearEstilo, type DefEfecto,
} from '../lib/editor-landing/animaciones';

test('cada efecto tiene nombre, un grupo que existe y sus keyframes (una variante por dirección)', () => {
  const grupos = new Set<string>(GRUPOS_EFECTO.map((g) => g.id));
  const kf = keyframesAnimaciones();
  const ids = new Set<string>();
  for (const e of EFECTOS as readonly DefEfecto[]) {
    assert.ok(e.nombre.trim(), e.id);
    assert.ok(grupos.has(e.grupo), `${e.id}: grupo ${e.grupo}`);
    assert.ok(!ids.has(e.id), `${e.id} repetido`); ids.add(e.id);
    if (typeof e.desde === 'string') assert.match(kf, new RegExp(`@keyframes gm-e-${e.id} \\{`), e.id);
    else for (const d of e.direcciones ?? []) assert.match(kf, new RegExp(`@keyframes gm-e-${e.id}-${d} \\{`), `${e.id}-${d}`);
    // Nada que mueva el layout: sólo transform, opacity, clip-path y filter.
    const css = typeof e.desde === 'string' ? e.desde : Object.values(e.desde).join(' ');
    for (const prop of css.split(';').map((x) => x.split(':')[0].trim()).filter(Boolean)) {
      assert.ok(['opacity', 'transform', 'clip-path', 'filter'].includes(prop), `${e.id}: ${prop}`);
    }
  }
  for (const s of ESTILOS_PAGINA) assert.ok(efectoPorId(s.efecto), `estilo ${s.id} → ${s.efecto}`);
});

test('«Subir» es exactamente la entrada de siempre (Gamma: 20 px, 1 s, su curva, 80 ms entre bloques)', () => {
  assert.equal(ESTILO_DEFAULT, 'subir');
  const subir = efectoPorId('subir') as DefEfecto;
  assert.equal(subir.desde, 'opacity: 0; transform: translateY(20px);');
  assert.equal(animacionCss('subir', null, 0), 'gm-e-subir 1000ms cubic-bezier(0.22, 1, 0.36, 1) 150ms backwards');
  assert.equal(animacionCss('subir', null, 2), 'gm-e-subir 1000ms cubic-bezier(0.22, 1, 0.36, 1) 310ms backwards');
});

test('el estilo de la landing llega a lo que no eligió; «ninguna» y el interruptor apagado no animan', () => {
  const pag = { animaciones: true, estiloAnimacion: 'aparecer' };
  assert.equal(animacionDeSeccion({}, pag, 0).efecto, 'aparecer');
  assert.equal(animacionDeSeccion({}, pag, 0).propio, false);
  assert.equal(animacionDeSeccion({ animacion: 'iris' }, pag, 0).efecto, 'iris');
  assert.equal(animacionDeSeccion({ animacion: 'iris' }, pag, 0).propio, true);
  assert.equal(animacionDeSeccion({ animacion: SIN_ANIMACION }, pag, 0).efecto, null);
  assert.equal(animacionDeSeccion({ animacion: 'iris' }, { ...pag, animaciones: false }, 0).efecto, null);
  // Sin estilo guardado (una landing de antes): el de siempre.
  assert.equal(animacionDeSeccion({}, { animaciones: true }, 3).efecto, 'subir');
  // Un estilo que no existe cae al de siempre; un efecto que no existe, al estilo.
  assert.equal(animacionDeSeccion({ animacion: 'inventado' }, { animaciones: true, estiloAnimacion: 'tampoco' }, 0).efecto, 'subir');
});

test('«alterna» va izquierda/derecha; la dirección de una sección vale sólo si su efecto la ofrece', () => {
  const pag = { animaciones: true, estiloAnimacion: 'deslizar' };
  assert.deepEqual([0, 1, 2, 3].map((i) => animacionDeSeccion({}, pag, i).direccion), ['izquierda', 'derecha', 'izquierda', 'derecha']);
  assert.equal(animacionDeSeccion({ animacion: 'barrido', animacionDireccion: 'abajo' }, pag, 0).direccion, 'abajo');
  assert.equal(animacionDeSeccion({ animacion: 'barrido', animacionDireccion: 'diagonal' }, pag, 0).direccion, 'izquierda');
  assert.equal(sanearDireccion('arriba', 'iris'), null);
  assert.equal(nombreKeyframes('deslizar', 'derecha'), 'gm-e-deslizar-derecha');
  assert.equal(nombreKeyframes('deslizar', null), 'gm-e-deslizar-izquierda');
  assert.equal(nombreKeyframes('iris', 'arriba'), 'gm-e-iris');
});

test('el saneo tira lo que no está en el catálogo', () => {
  assert.equal(sanearAnimacionSeccion('subir'), 'subir');
  assert.equal(sanearAnimacionSeccion(SIN_ANIMACION), SIN_ANIMACION);
  assert.equal(sanearAnimacionSeccion('fade'), null);
  assert.equal(sanearAnimacionSeccion(42), null);
  assert.equal(sanearEstilo('palabras'), 'palabras');
  assert.equal(sanearEstilo('rise'), 'subir');
});

test('el video de fondo tiene su lugar y hoy NO se ofrece', () => {
  assert.equal(VIDEO_FONDO.disponible, false);
  assert.ok(VIDEO_FONDO.motivo.length <= 110, 'el motivo es una frase');
});

// Ampliado el 15/10/2026 con el render (paquete A): los data-* de la sección salen de UNA función.
test('los data-* de la sección: el efecto o «ninguna», la dirección sólo si el efecto la ofrece, el texto sólo del estilo', () => {
  const pag = { animaciones: true, estiloAnimacion: 'palabras' };
  assert.deepEqual(datosDeAnimacion(animacionDeSeccion({}, pag, 0)), { 'data-anim': 'desvanecer', 'data-anim-texto': 'palabra' });
  assert.deepEqual(datosDeAnimacion(animacionDeSeccion({ animacion: 'barrido', animacionDireccion: 'arriba' }, pag, 0)), { 'data-anim': 'barrido', 'data-anim-dir': 'arriba' });
  assert.deepEqual(datosDeAnimacion(animacionDeSeccion({ animacion: 'iris', animacionDireccion: 'arriba' }, pag, 0)), { 'data-anim': 'iris' });
  assert.deepEqual(datosDeAnimacion(animacionDeSeccion({ animacion: SIN_ANIMACION }, pag, 0)), { 'data-anim': 'ninguna' });
  // El interruptor apagado no pone nada (tampoco «ninguna»): la sección queda como el HTML de antes del catálogo.
  assert.deepEqual(datosDeAnimacion(animacionDeSeccion({ animacion: SIN_ANIMACION }, { ...pag, animaciones: false }, 0)), {});
  assert.deepEqual(datosDeAnimacion(null), {});
  assert.equal(CORTE_CELULAR, '(max-width: 768px)', 'el corte del bloque 17 de la hoja');
});
