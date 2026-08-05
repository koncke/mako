// La detección de "el lead insiste con lo mismo".
//
// Se probó pedírselo al modelo en el prompt («cerrá a la tercera repetición») y
// siguió rebatiendo las cuatro: un modelo no lleva la cuenta. Por eso esto es
// determinista y del lado del servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insisteConLoMismo, parecido } from '../lib/conversacion-repeticion';

test('la misma objeción dicha de tres formas SÍ cuenta como insistir', () => {
  // El caso real que reportó el dueño.
  assert.equal(insisteConLoMismo(['esta muy caro', 'igual me parece caro', 'sigue caro']), true);
});

test('dos veces todavía NO: rebatir dos veces es legítimo', () => {
  assert.equal(insisteConLoMismo(['esta muy caro', 'me parece caro']), false);
});

test('una conversación que avanza no se marca como repetida', () => {
  assert.equal(
    insisteConLoMismo(['cuanto cuesta', 'somos 30 personas', 'dale, el jueves me sirve']),
    false,
  );
});

test('A-B-A todavía NO es insistir: la objeción apareció dos veces', () => {
  assert.equal(
    insisteConLoMismo(['el precio es alto', 'y cuanto dura el programa', 'igual el precio me parece alto']),
    false,
  );
});

test('A-B-A-A sí: la tercera aparición cierra, aunque no sean seguidas', () => {
  // No se exige que las repeticiones sean consecutivas: objetar el precio,
  // preguntar otra cosa y volver al precio es insistir igual.
  assert.equal(
    insisteConLoMismo(['el precio es alto', 'y cuanto dura el programa', 'igual el precio me parece alto', 'el precio sigue alto']),
    true,
  );
});

test('mensajes vacíos no inventan una repetición', () => {
  assert.equal(insisteConLoMismo(['', '  ', '']), false);
});

test('parecido: mismas palabras clave aunque cambie el resto', () => {
  assert.ok(parecido('esta muy caro', 'me parece carisimo') < 1);
  assert.ok(parecido('el precio es alto', 'el precio sigue alto') >= 0.34);
  assert.equal(parecido('cuanto cuesta', 'somos treinta personas'), 0);
});
