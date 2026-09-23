import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionarDetalle, pasosComoBullets } from '../lib/detalle-fusion';
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

// ---------------------------------------------------------------------------
// Los pasos, ahora VIÑETAS del detalle (22/09/2026)
// ---------------------------------------------------------------------------
// Las checklists salieron del producto y los pasos bajaron al detalle. Lo que hay que
// cuidar es que no lo ensucien: la mitad de las checklists del tablero eran un resumen
// de la propia descripción (medido: 1285 ítems en 291 tareas del plan del dueño).
//
// ⚠️ PROBADO ROMPIÉNDOLO, con los números: sacando el `prosa.includes(k)` quedan 6 pases
// y 1 fallo, y el que falla es «un paso que la prosa YA DICE no se repite» — o sea que es
// el único que mide eso. Bajando el piso de 12 caracteres a 0, otra vez 6 y 1, y el que
// cae es «un paso corto NO se pierde»: «Probar» matchea adentro de «probar el flujo».

test('los pasos entran como viñetas y respetan lo que ya estaba', () => {
  const d = 'Mover el email a cuenta propia por cliente.';
  const r = pasosComoBullets(d, ['Cargar la cuenta de Resend', 'Probar un envío']);
  assert.ok(r.startsWith(d), 'la descripción no se toca');
  assert.ok(r.includes('- Cargar la cuenta de Resend'));
  assert.ok(r.includes('- Probar un envío'));
});

test('van adentro de «Detalles concretos» cuando el contrato está escrito', () => {
  const d = '**Qué hay que hacer**\nConectar Meta.\n\n**Detalles concretos**\n- Pedirle el acceso al cliente\n\n**Listo cuando**\nEntra el primer lead.';
  const r = pasosComoBullets(d, ['Verificar el dominio en Meta']);
  const iPaso = r.indexOf('- Verificar el dominio en Meta');
  const iListo = r.indexOf('**Listo cuando**');
  assert.ok(iPaso > 0 && iPaso < iListo, 'el paso va en su sección, no colgado al final');
});

test('un paso que la prosa YA DICE no se repite', () => {
  const d = 'Dar acceso a la cuenta publicitaria para que MaKo lea campañas, gasto y métricas.';
  const r = pasosComoBullets(d, ['Dar acceso a la cuenta publicitaria', 'Conectar el pixel']);
  assert.equal(r.includes('- Dar acceso a la cuenta publicitaria'), false, 'ya estaba dicho');
  assert.ok(r.includes('- Conectar el pixel'), 'lo que NO estaba, sí entra');
});

test('un paso corto NO se pierde por aparecer adentro de una palabra', () => {
  const d = 'Hay que probar el flujo entero antes de prenderlo.';
  const r = pasosComoBullets(d, ['Probar']);
  assert.ok(r.includes('- Probar'), 'seis caracteres no alcanzan para decidir que ya estaba');
});

test('sin pasos, el detalle vuelve igual', () => {
  assert.equal(pasosComoBullets('Nada que agregar.', []), 'Nada que agregar.');
  assert.equal(pasosComoBullets('', ['Un paso']), '- Un paso');
});
