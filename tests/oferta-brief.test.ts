// =============================================================================
// La oferta se RESUELVE: el valor vive en un lugar y una columna dice cuál
// =============================================================================
// El mecanismo `desde_brief` (mig 0169) es lo que impide la segunda copia: la
// fila de `ofertas` existe con los 5 campos en NULL y el valor sigue viviendo en
// `app_settings['mako.onboarding.answers']`. Si alguien "completa" esos NULL
// copiando el blob, el día que el dueño edite el brief quedan dos verdades y
// gana la que nadie revisó (AGENTS.md § Una cosa, un lugar).
//
// Y la otra mitad: los rótulos. `perfilNegocioTexto()` emitía el `label` del
// esquema, que es una PREGUNTA, así que a ~20 features les llegaba literal
// «¿Cómo se llama tu oferta?: X». Acá se fija que salgan los rótulos cortos.
//
// ⚠️ PROBADO ROMPIÉNDOLO, con los números:
//  · En `resolverOfertaPrincipal`, haciendo que la rama `desde_brief` devuelva
//    los campos de la FILA (`promesa: fila.promesa ?? ''` en vez del blob):
//    **1 fallo / 8 pases** — cae «desde_brief lee el BLOB…», que es el caso que
//    produce la copia que se queda vieja.
//  · Haciendo que «sin fila» se lea como una fila declarada y vacía —el error de
//    «sin fila no es vacío»—: **2 fallos / 7 pases**.
//  · En `urgenciaVigente`, devolviendo `false` en vez de `null` cuando no hay
//    `urgencia_hasta`: **2 fallos / 7 pases** — es el escalón de «no puedo
//    comprobarlo» vs «venció», y apagaría un ángulo legítimo (los cupos).
//  · Cambiando el rótulo corto `Nombre` por el label-pregunta del formulario:
//    **1 fallo / 8 pases**.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverOfertaPrincipal, ofertaTextoCorto, urgenciaVigente, urgenciaUsable,
  filaAOferta, parseBonos, precioTexto, type Oferta,
} from '../lib/oferta-modelo';

const ANSWERS = {
  oferta_nombre: 'Negocio que Escala',
  oferta_ticket: 'Entre USD 5,000 y USD 10,000',
  oferta_promesa: 'De cuello de botella a dueño que escala',
  oferta_incluye: 'Mentorías · comunidad · plantillas',
  oferta_garantia: '30 días o devolución',
};

const base = (p: Partial<Oferta> = {}): Oferta => ({
  id: 1, nombre: 'Negocio que Escala', precio_usd: null, precio_nota: null,
  promesa: null, incluye: null, garantia: null, bonos: [],
  urgencia_tipo: null, urgencia_dato: null, urgencia_razon: null, urgencia_hasta: null,
  para_quien: null, objeciones: null, prueba: null,
  desde_brief: false, es_principal: true, activa: true, orden: 0, origen: 'manual',
  ...p,
});

test('sin fila, los 5 campos siguen saliendo del brief — que es lo que pasa HOY', () => {
  const r = resolverOfertaPrincipal(null, ANSWERS);
  assert.equal(r.origen, 'sin-fila');
  assert.equal(r.oferta, null);
  assert.equal(r.campos.promesa, 'De cuello de botella a dueño que escala');
  // Mientras nadie declare una oferta, el texto que ven los ~20 prompts es el
  // mismo de siempre. Ese es el contrato de «el producto se ve idéntico».
  assert.equal(r.campos.garantia, '30 días o devolución');
});

test('desde_brief lee el BLOB aunque la fila exista — las columnas quedan en NULL a propósito', () => {
  const r = resolverOfertaPrincipal(base({ desde_brief: true, promesa: null }), ANSWERS);
  assert.equal(r.origen, 'brief');
  assert.equal(r.campos.promesa, 'De cuello de botella a dueño que escala');
  assert.equal(r.campos.precio, 'Entre USD 5,000 y USD 10,000');
});

test('el nombre de la FILA gana sobre el del brief: es NOT NULL y es la llave del único', () => {
  const r = resolverOfertaPrincipal(base({ desde_brief: true, nombre: 'Escala 2.0' }), ANSWERS);
  assert.equal(r.campos.nombre, 'Escala 2.0');
});

test('declarada, un campo vacío NO cae al brief: «no lo cargaron» no es «lo dice el brief»', () => {
  const r = resolverOfertaPrincipal(base({ promesa: 'Otra promesa', garantia: null }), ANSWERS);
  assert.equal(r.origen, 'declarado');
  assert.equal(r.campos.promesa, 'Otra promesa');
  // Si esto cayera al brief, una oferta nueva heredaría la garantía de la
  // principal y ningún prompt podría distinguirlas.
  assert.equal(r.campos.garantia, '');
});

test('el precio declarado se PRESENTA: la nota le gana al número', () => {
  assert.equal(precioTexto(base({ precio_usd: 5000, precio_nota: '2 pagos de 2.500' })), '2 pagos de 2.500');
  assert.equal(precioTexto(base({ precio_usd: 5000 })), 'USD 5,000');
  assert.equal(precioTexto(base()), '');
});

test('los rótulos del texto para prompts son CORTOS, no las preguntas del formulario', () => {
  const t = ofertaTextoCorto(resolverOfertaPrincipal(null, ANSWERS).campos);
  assert.match(t, /^Nombre: Negocio que Escala · Precio: /);
  assert.match(t, /Garantía: 30 días o devolución$/);
  assert.ok(!t.includes('¿'), `el texto sigue llevando una pregunta adentro: ${t}`);
});

test('urgencia: «no puedo comprobarlo» (null) no es «venció» (false)', () => {
  const hoy = new Date('2026-09-26T12:00:00Z');
  // Cupos: lo declara una persona y el sistema no lo puede verificar.
  assert.equal(urgenciaVigente(base({ urgencia_tipo: 'cupos', urgencia_dato: '6 lugares' }), hoy), null);
  assert.equal(urgenciaVigente(base({ urgencia_tipo: 'fecha', urgencia_hasta: '2026-10-12' }), hoy), true);
  assert.equal(urgenciaVigente(base({ urgencia_tipo: 'fecha', urgencia_hasta: '2026-09-01' }), hoy), false);
  // Sin urgencia declarada no hay nada que contestar.
  assert.equal(urgenciaVigente(base(), hoy), null);
});

test('un ángulo de urgencia se apaga SOLO cuando se pudo probar que venció', () => {
  const hoy = new Date('2026-09-26T12:00:00Z');
  assert.equal(urgenciaUsable(base({ urgencia_tipo: 'cupos', urgencia_dato: '6 lugares' }), hoy), true);
  assert.equal(urgenciaUsable(base({ urgencia_tipo: 'fecha', urgencia_dato: 'cierra', urgencia_hasta: '2026-09-01' }), hoy), false);
  // Un tipo sin dato concreto no es una urgencia: es un adjetivo.
  assert.equal(urgenciaUsable(base({ urgencia_tipo: 'cupos' }), hoy), false);
});

test('la fila cruda se sanea: un tipo de urgencia inventado y un bono sin nombre se caen', () => {
  const o = filaAOferta({
    id: '4', nombre: '  Oferta  ', urgencia_tipo: 'vibra', urgencia_hasta: '2026-10-12T00:00:00.000Z',
    bonos: [{ nombre: 'Auditoría', valor_usd: '500', porque: 'quita el miedo' }, { porque: 'nada' }],
    desde_brief: 'si', activa: false,
  });
  assert.equal(o.nombre, 'Oferta');
  assert.equal(o.urgencia_tipo, null, 'un tipo fuera del enum no puede entrar: decide si un ángulo se usa');
  assert.equal(o.urgencia_hasta, '2026-10-12');
  assert.deepEqual(o.bonos, [{ nombre: 'Auditoría', valor_usd: 500, porque: 'quita el miedo' }]);
  assert.equal(o.desde_brief, false, 'sólo el booleano true cuenta: un string truthy diría que el valor vive en otro lado');
  assert.equal(o.activa, false);
  assert.deepEqual(parseBonos('no es un array'), []);
});
