// =============================================================================
// Skool por Zapier: quién pidió entrar y qué contestó (lib/skool-evento.ts)
// =============================================================================
// La forma la decide el Zap, no Skool (ver el encabezado del módulo): por eso se prueban las tres
// formas en que puede llegar —los campos crudos del trigger, los mapeados a mano, y un formulario—.
// Los nombres crudos del trigger de Skool en Zapier NO están medidos: el caso «crudo» de abajo es
// una forma plausible, no una captura. El primer aviso real se compara contra esto.
//
// Probado rompiéndolo (14/10/2026), una rotura por vez y restaurando desde memoria:
//   · `primero` sin `valida` → 5 pasan / 1 falla (email_verified tapa al email);
//   · «nombre» de vuelta en ES_NOMBRE → 5 / 1 (nombre + apellido);
//   · cualquier clave como respuesta → 3 / 3 (los ids, los links y los nombres entran como respuestas).
// Restaurado: 6 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerEventoSkool, lineaDelHistorialSkool, respuestasEnUnaLinea, type EventoSkool } from '../lib/skool-evento';

const ok = (r: ReturnType<typeof leerEventoSkool>): EventoSkool => {
  assert.ok(!('ignorado' in r), `se ignoró: ${'ignorado' in r ? r.ignorado : ''}`);
  return r as EventoSkool;
};

test('los campos crudos del trigger: email, nombre partido y pares pregunta/respuesta', () => {
  const e = ok(leerEventoSkool({
    id: 'mem_123', group_name: 'Comunidad Exemplo', email_verified: 'true',
    'Email': 'ana@example.com', 'First Name': 'Ana', 'Last Name': 'Pérez',
    question_1: '¿A qué te dedicas?', answer_1: 'Inmobiliaria en Tijuana',
    question_2: '¿Cuánto facturas al mes?', answer_2: 'US$10.000',
    profile_url: 'https://www.skool.com/@ana-perez-1234', created_at: '2026-10-14T12:00:00Z',
  }));
  assert.equal(e.tipo, 'solicitud');
  assert.deepEqual(e.contacto, { nombre: 'Ana Pérez', email: 'ana@example.com', telefono: null });
  assert.equal(e.comunidad, 'Comunidad Exemplo');
  assert.deepEqual(e.respuestas, [
    { pregunta: '¿A qué te dedicas?', respuesta: 'Inmobiliaria en Tijuana' },
    { pregunta: '¿Cuánto facturas al mes?', respuesta: 'US$10.000' },
  ], 'ni el id, ni el link del perfil, ni la fecha son respuestas');
  assert.equal(lineaDelHistorialSkool(e), 'Pidió entrar a tu comunidad de Skool «Comunidad Exemplo»');
});

test('los campos mapeados a mano en el Zap, con una lista de respuestas y el evento de pago', () => {
  const e = ok(leerEventoSkool({
    evento: 'New Paid Member', nombre: 'Luis', apellido: 'Gómez', telefono: '+52 664 123 4567',
    respuestas: [{ pregunta: '¿Qué buscas?', respuesta: 'Escalar mi agencia' }, 'Un texto suelto'],
  }));
  assert.equal(e.tipo, 'pago');
  assert.deepEqual(e.contacto, { nombre: 'Luis Gómez', email: null, telefono: '+52 664 123 4567' });
  assert.deepEqual(e.respuestas, [
    { pregunta: '¿Qué buscas?', respuesta: 'Escalar mi agencia' },
    { pregunta: 'Pregunta 2', respuesta: 'Un texto suelto' },
  ]);
  assert.equal(lineaDelHistorialSkool(e), 'Entró pagando a tu comunidad de Skool');
});

test('una clave que dice «answer» es una respuesta, con su clave como pregunta', () => {
  const e = ok(leerEventoSkool({ email: 'x@example.com', 'Answer - What is your business?': 'Coaching' }));
  assert.deepEqual(e.respuestas, [{ pregunta: 'Answer - What is your business?', respuesta: 'Coaching' }]);
});

test('lo que Zapier anida en `data` se lee igual', () => {
  const e = ok(leerEventoSkool({ data: { email: 'y@example.com', name: 'Yanina' } }));
  assert.deepEqual(e.contacto, { nombre: 'Yanina', email: 'y@example.com', telefono: null });
});

test('sin email ni teléfono no hay a quién sumar, y se dice', () => {
  for (const c of [{ name: 'Sin contacto' }, { email: 'no-es-email', phone: '123' }, null, [], 'x']) {
    const r = leerEventoSkool(c);
    assert.ok('ignorado' in r, `no se ignoró ${JSON.stringify(c)}`);
  }
});

test('las respuestas en una línea, para un lead que ya existía', () => {
  assert.equal(respuestasEnUnaLinea([]), null);
  assert.equal(
    respuestasEnUnaLinea([{ pregunta: 'P1', respuesta: 'R1' }, { pregunta: 'P2', respuesta: 'R2' }]),
    'Respuestas de Skool: P1: R1 · P2: R2',
  );
});
