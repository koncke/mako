import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionarDetalle } from '../lib/detalle-fusion';
import { evaluarDetalle } from '../lib/detalle-contrato';

// ---------------------------------------------------------------------------
// El molde escrito DOS VECES: 37 de 73 tarjetas, y 85% el último día
// ---------------------------------------------------------------------------
// Medido el 11/8/2026 sobre el board real. La causa son dos decisiones que por
// separado están bien: el trabajo del `checklist-coach` es REESCRIBIR el detalle,
// así que su texto nunca conserva el arranque del original — y `fusionarDetalle`,
// al no reconocerlo como la misma cosa, hace lo único que le queda: concatenar.
//
// Y no alcanzaba con pisar. El bloque del coach PIERDE contenido: en la tarea #669
// el original decía «limitar el desarrollo a un porcentaje del Cloud de Mauricio» y
// su versión decía «en la cuenta de Claude de Mauricio» — lo contrario de lo
// acordado. Pisar traía de vuelta el bug viejo (se perdían las palabras del dueño);
// concatenar deja la tarjeta diciendo las dos cosas, y quien la lee de arriba abajo
// hace lo que NO se acordó.
//
// La salida no es elegir entre dos textos malos: si el detalle que ya está cumple
// el contrato, no hay nada que optimizar. Eso se decide con `evaluarDetalle`, y
// estos tests fijan las dos mitades.

test('EL CASO REAL: dos versiones con molde NO se concatenan', () => {
  const delDueno = '**Qué hay que hacer**\nContratar un plan propio de US$200 y limitar el desarrollo de MaKo a un porcentaje del Cloud de Mauricio.\n\n**Por qué**\nEs el riesgo de relación más grande del encargo.';
  const delCoach = '**Qué hay que hacer**\nContratar un plan propio de US$200 en la cuenta de Claude de Mauricio.\n\n**Por qué**\nEvitar sorpresas.';
  // Con el molde ya presente, el detalle del dueño se queda TAL CUAL.
  assert.equal(evaluarDetalle(delDueno).conForma, true, 'el original ya cumple el contrato');
  // Y la prueba de que el bug era real: fusionar los dos da un texto con el molde repetido.
  const fusionado = fusionarDetalle(delDueno, delCoach);
  assert.equal((fusionado.match(/\*\*Qué hay que hacer\*\*/g) ?? []).length, 2, 'esto es lo que se guardaba');
});

test('…pero un COMPLEMENTO sin molde sí se suma', () => {
  // La razón de existir de `fusionarDetalle` sigue viva: una evidencia o una nota
  // que no repite el molde es información nueva y no puede perderse.
  const original = '**Qué hay que hacer**\nConectar Meta.\n\n**Por qué**\nPara medir.';
  const evidencia = 'Cerrada en el commit d4a6958.';
  assert.equal(evaluarDetalle(evidencia).conForma, false, 'una evidencia suelta NO es un detalle completo');
  assert.ok(fusionarDetalle(original, evidencia).includes(evidencia));
  assert.ok(fusionarDetalle(original, evidencia).includes('Conectar Meta'), 'lo del dueño no se pierde');
});
