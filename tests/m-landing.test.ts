// =============================================================================
// MaKo Mobile — las reglas puras de Landing Generator en el teléfono (app/m/landing/modelo.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · «Publicada» es slug Y foto publicada (la regla del Panel de escritorio): un slug reservado
//     de una landing despublicada NO la vuelve publicada;
//   · una publicada con el sitio apagado es «Pausada» (su dirección no contesta), y un
//     `sitio_activo` que no se pudo leer (null) no la pausa;
//   · los números se escriben con punto de miles y en singular cuando es uno;
//   · el pie: sin cambios el botón se apaga; con el sitio pausado la consecuencia dice que
//     vuelve a estar en línea (publicar.ts escribe `sitio_activo: true`); sin red, apagado;
//   · el id de la URL: sólo dígitos, positivo y seguro (como /landing-generator/<id>).
//
// Verificado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde (4/4), restaurando
// modelo.ts entero después de cada una:
//   · estadoLanding con el slug solo = publicada: 1 fallo, 3 pases.
//   · estadoLanding pausando con sitioActivo null: 1 fallo, 3 pases.
//   · piePublicar sin la consecuencia del sitio pausado: 1 fallo, 3 pases.
//   · lineaNumeros sin punto de miles: 1 fallo, 3 pases.
//   · piePublicar habilitado sin red: 1 fallo, 3 pases.
//   · idDeLanding aceptando el 0 y lo inseguro: 1 fallo, 3 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoLanding, idDeLanding, lineaNumeros, piePublicar, PILDORA_LANDING } from '../app/m/landing/modelo';

test('estadoLanding: publicada = slug y foto; pausada = sitio apagado', () => {
  const pub = { slug: 'clase-gratis', publicadoAt: '2026-10-01T10:00:00Z' };
  assert.equal(estadoLanding(pub, true), 'publicada');
  assert.equal(estadoLanding(pub, null), 'publicada');
  assert.equal(estadoLanding(pub, undefined), 'publicada');
  assert.equal(estadoLanding(pub, false), 'pausada');
  // Despublicada: el slug queda reservado, la foto no.
  assert.equal(estadoLanding({ slug: 'clase-gratis', publicadoAt: null }, true), 'borrador');
  assert.equal(estadoLanding({ slug: null, publicadoAt: null }, null), 'borrador');
  assert.equal(PILDORA_LANDING.publicada.texto, 'Publicada');
  assert.equal(PILDORA_LANDING.borrador.tono, 'neutro');
});

test('lineaNumeros: miles con punto y singular', () => {
  assert.equal(lineaNumeros(1240, 96), '1.240 visitas · 96 leads en 30 días');
  assert.equal(lineaNumeros(1, 1), '1 visita · 1 lead en 30 días');
  assert.equal(lineaNumeros(0, 0), '0 visitas · 0 leads en 30 días');
});

test('piePublicar: apagado sin cambios o sin red; con el sitio pausado lo dice', () => {
  assert.deepEqual(piePublicar({ cambios: false, sitioActivo: true, enLinea: true }), { consecuencia: 'Sin cambios por publicar.', habilitado: false });
  assert.deepEqual(piePublicar({ cambios: true, sitioActivo: true, enLinea: true }), { consecuencia: 'La página publicada cambia al instante.', habilitado: true });
  assert.deepEqual(piePublicar({ cambios: true, sitioActivo: false, enLinea: true }), { consecuencia: 'El sitio vuelve a estar en línea.', habilitado: true });
  assert.equal(piePublicar({ cambios: true, sitioActivo: true, enLinea: false }).habilitado, false);
});

test('idDeLanding: sólo dígitos, positivo y seguro', () => {
  assert.equal(idDeLanding('42'), 42);
  assert.equal(idDeLanding('0'), null);
  assert.equal(idDeLanding('-3'), null);
  assert.equal(idDeLanding('4e2'), null);
  assert.equal(idDeLanding('12abc'), null);
  assert.equal(idDeLanding('9999999999999999'), null);
  assert.equal(idDeLanding(''), null);
});
