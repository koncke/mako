// Lo que decide si el motor intenta mandar por el WhatsApp no oficial
// =============================================================================
// Decidía la FILA (`evolution_instancias.estado`), que miente en las dos
// direcciones. Ahora decide la sonda viva y la fila queda de respaldo. El
// porqué, en lib/nutricion-canal.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalNoOficial } from '../lib/nutricion-canal';

test('la sonda VIVA le gana a una fila que dice desconectado', () => {
  // El caso caro: un registro viejo apagando un canal que anda, para siempre.
  const r = canalNoOficial('vivo', 'desconectado');
  assert.equal(r.listo, true);
  assert.equal(r.fuente, 'sonda');
});

test('la sonda MUERTA le gana a una fila que dice conectado', () => {
  // mako_superadmin, medido el 08/09/2026: `open` en la fila, «Connection Closed» en la operación.
  const r = canalNoOficial('muerto', 'conectado');
  assert.equal(r.listo, false);
  assert.equal(r.fuente, 'sonda');
  assert.match(r.motivo ?? '', /volver a vincular/, 'el fallo tiene que decir qué hacer');
});

test('sin respuesta de la sonda, decide la fila — y lo dice', () => {
  assert.equal(canalNoOficial('sin_respuesta', 'conectado').listo, true);
  const r = canalNoOficial('sin_respuesta', 'desconectado');
  assert.equal(r.listo, false);
  assert.equal(r.fuente, 'fila');
  assert.match(r.motivo ?? '', /no se pudo comprobar/, '«no pude preguntar» no puede leerse como un hecho medido');
});

test('sin instancia no hay a quién sondear', () => {
  assert.equal(canalNoOficial(null, undefined).listo, false);
});

// Probado rompiéndolo (17/09/2026) con la regla vieja —`listo = estadoFila ===
// 'conectado'`, ignorando la sonda—: 2 fallos, 2 pases. Caen «la sonda VIVA le
// gana…» y «la sonda MUERTA le gana…», que son exactamente las dos mentiras de la fila.
