// El CRON «Pagos» (11/10/2026): los eventos de la pasarela (Stripe / Mercado Pago) como disparador de una
// automatización. Martín eligió que sea un BOTÓN PROPIO de la primera pantalla (no un evento adentro de
// «Producto»), con la grilla en 4+3 — eso lo mira tests/editor-disparadores.test.ts.
//
// ROTURAS (11/10/2026, de a una, restauradas de memoria): base 6 pass / 0 fail.
//   · sin TRIGGER_PAGO en CON_SUBTIPO (`higiene` borra el subtipo y nunca dispara)  → 4 / 2
//   · disparaPorEvento('pago') que acepta cualquier subtipo                         → 5 / 1
//   · claseDelTipo sin la rama de pagos (se dibuja como «Producto (de antes)»)      → 5 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EVENTOS_PAGO, TRIGGER_PAGO, TRIGGERS_SOLO_EVENTO, SOLO_DESDE_EL_CRON, borradorDeClase, claseDeDisparador,
  disparaPorEvento, disparadoresDe, eventosDe, esEventoDeAntes, problemaDeDisparador, textoDeDisparador, type Disparador,
} from '../lib/disparadores';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n');
const pago = (subtipo: string | null): Disparador => ({ id: 'd1', trigger_tipo: TRIGGER_PAGO, subtipo });

test('los cuatro eventos de pago, en las palabras del CRON (no las del proveedor)', () => {
  assert.deepEqual(EVENTOS_PAGO.map((e) => e.subtipo), ['aprobado', 'rechazado', 'reembolsado', 'suscripcion_cancelada']);
  for (const e of EVENTOS_PAGO) assert.match(e.subtipo, /^[a-z_]{1,30}$/, 'el subtipo lo sanea /^[a-z_]{1,30}$/');
  assert.equal(eventosDe('pagos'), EVENTOS_PAGO);
});

test('es un CRON de evento: no barre por horario y se elige sólo en el CRON', () => {
  assert.ok(TRIGGERS_SOLO_EVENTO.has(TRIGGER_PAGO));
  assert.ok(SOLO_DESDE_EL_CRON.has(TRIGGER_PAGO));
  assert.equal(problemaDeDisparador({ ...pago('aprobado'), cron: { tipo: 'diario', hora: '09:00' } as never }, { unico: true }), 'Un evento no se repite por horario');
});

test('su clase es «pagos» (no «Producto (de antes)») y el borrador nace sin evento', () => {
  assert.equal(claseDeDisparador(pago('aprobado')), 'pagos');
  assert.equal(esEventoDeAntes(pago('aprobado')), false);
  assert.deepEqual(borradorDeClase('pagos', 'd9', { tipo: 'diario', hora: '09:00' } as never), { id: 'd9', trigger_tipo: TRIGGER_PAGO, subtipo: null });
  assert.equal(problemaDeDisparador(pago(null), { unico: true }), 'Elige el evento');
  assert.equal(textoDeDisparador(pago('reembolsado'), { deSiempre: () => 'NO' }), 'Se devuelve un pago');
});

test('el subtipo SOBREVIVE a la higiene (si no, la automatización se ve armada y no arranca nunca)', () => {
  const [d] = disparadoresDe({ trigger_tipo: TRIGGER_PAGO, etapa: 'manual', disparadores: [pago('rechazado')] });
  assert.equal(d.subtipo, 'rechazado');
});

test('dispara SÓLO con el mismo evento; sin subtipo, nada', () => {
  assert.equal(disparaPorEvento(pago('aprobado'), 'pago', { subtipo: 'aprobado' }), true);
  assert.equal(disparaPorEvento(pago('aprobado'), 'pago', { subtipo: 'rechazado' }), false);
  assert.equal(disparaPorEvento(pago('aprobado'), 'pago', {}), false, 'un aviso que no dice qué pasó no cae en «entonces todos»');
  assert.equal(disparaPorEvento({ id: 'd1', trigger_tipo: 'email_recibido' }, 'pago', { subtipo: 'aprobado' }), false);
  assert.equal(disparaPorEvento({ ...pago('aprobado'), cron: { tipo: 'diario', hora: '09:00' } as never }, 'pago', { subtipo: 'aprobado' }), false, 'un Recurrente nunca responde a un evento');
});

test('la puerta del motor: enrolarPorPago pasa el subtipo por el ctx, sin casts, y el motor mira TRIGGER_PAGO', () => {
  const puerta = leer('../lib/pago-entrante.ts');
  assert.match(puerta, /enrolarPorEvento\(leadId, 'pago', ctx\)/);
  assert.doesNotMatch(puerta, / as (any|never|unknown)\b/, 'el ctx va tipado, no con un cast');
  assert.doesNotMatch(puerta.replace(/\/\/.*$/gm, ''), /lead_nuevo/, 'un lead que entra pagando no es uno «sin agendar»');
  const motor = leer('../lib/nutricion.ts');
  assert.match(motor, /\n\s+pago: \[TRIGGER_PAGO\],/);
});
