// =============================================================================
// «Sola» se puede elegir en CUALQUIER escenario con respuesta, con su aviso (punto 1 del feedback del 13/10/2026)
// =============================================================================
// Martín, reunión del 13/10 (Fathom 858927676 @13:22): «la IA no permite configurar "hacer todo sola" en ciertos
// escenarios». Era una regla escondida: con plata o en «Lo demás», nunca «Sola» (el desplegable no la ofrecía, Publicar
// la frenaba, `juntarPasosIA` la bajaba y el motor frenaba el texto con plata). Martín, 14/10: «Todas configurables, y
// también más visibles, ya sea con un aviso o advertencia». Ahora:
//   · la persona elige (`libertadesPermitidas`), y el editor avisa (`avisoDeLibertad`);
//   · lo que arma la IA por su cuenta sigue prudente (`libertadesDeFabrica`, `libertadPosible`), y el conversor de lo
//     de antes también (contesta igual que antes de convertir);
//   · el motor no frena el precio en un escenario DE PLATA puesto en «Sola» (`puedeContestarSolo`); en uno que no es de
//     plata, una respuesta que se pone a hablar de precios la sigue viendo una persona.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `libertadesPermitidas` con la regla vieja (sin «Sola» con plata)                   → 3 / 1
//   R2 `libertadPosible` con la regla permisiva (la IA elige «Sola» con plata)            → 3 / 1
//   R3 `puedeContestarSolo` sin mirar si el escenario es de plata                          → 3 / 1
//
// Correr: node --import tsx --test tests/automations-sola-con-plata.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libertadesPermitidas, libertadesDeFabrica, avisoDeLibertad } from '../lib/ai-step-libertad';
import { libertadPosible, OPCIONES_LO_DEMAS } from '../lib/ai-step-armar';
import { puedeContestarSolo } from '../lib/setter-conversacion';

const PRECIO = { titulo: 'Pregunta el precio', cuando: 'quiere saber cuánto cuesta', responder: 'Dile el precio del plan' };

test('la persona puede elegir «Sola» con plata y en «Lo demás», y el editor lo avisa', () => {
  assert.ok(libertadesPermitidas(PRECIO).includes('sola'));
  assert.ok(libertadesPermitidas({ titulo: 'Lo demás', cuando: '', responder: 'x', cualquiera: true }).includes('sola'));
  assert.ok(OPCIONES_LO_DEMAS.some((o) => o.value === 'sola' && !o.disabled));
  assert.equal(avisoDeLibertad(PRECIO, 'sola'), 'Contesta sola aunque hable de precios.');
});

test('sin respuesta, sólo «Sólo te avisa» (no hay qué mandar)', () => {
  assert.deepEqual(libertadesPermitidas({ titulo: 'Se queja', cuando: 'x', responder: '' }), ['avisa']);
});

test('lo que arma la IA por su cuenta sigue prudente: con plata, nunca «Sola»', () => {
  assert.ok(!libertadesDeFabrica(PRECIO).includes('sola'));
  assert.equal(libertadPosible(PRECIO, 'sola'), 'aprueba');
  assert.equal(libertadPosible({ titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece' }, 'sola'), 'sola');
});

test('el motor: un escenario DE PLATA en «Sola» contesta el precio; uno que no es de plata, no', () => {
  const base = { cierre: null, envioHabilitado: true, automaticasUltimas24h: 0, horaLocal: 12, bloqueado: false, enHorario: true } as const;
  const deplata = puedeContestarSolo({ ...base, escenario: { titulo: PRECIO.titulo, cuando: PRECIO.cuando, comoResponder: PRECIO.responder, contestaSolo: true }, texto: 'El plan cuesta 500 dólares al mes.' });
  assert.deepEqual(deplata, { ok: true });
  const otro = puedeContestarSolo({ ...base, escenario: { titulo: 'Confirma', cuando: 'dice que sí', comoResponder: 'Agradece', contestaSolo: true }, texto: 'Gracias. El plan cuesta 500 dólares.' });
  assert.deepEqual(otro, { ok: false, motivo: 'habla de precio o de un número' });
});
