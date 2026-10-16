// =============================================================================
// «PROBAR» APAGADO MIENTRAS FALTE ALGO, CON EL PORQUÉ (16/10/2026)
// =============================================================================
// Feedback de Martín del 16/10 (por Cerebro, bug A3), textual: «tengo una automatización con solo un CRON sin completar
// nada y me deja apretar el botón probar... No debería...». El botón queda apagado y al lado dice por qué, en 3-4 palabras
// («Completa el disparador»). Con una tarjeta a medias, tocar ese porqué lleva a la tarjeta (lo mismo que Publicar).
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-a.mjs; base 3 pass / 0 fail, 3 roturas, todas atajadas). El
// resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motivoParaNoProbar, cronSinElegir } from '../lib/flujo-conversacion';
import type { PasoGrafo } from '../lib/flujo-grafo';

const MENSAJE = { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: null } as PasoGrafo;

// rotura 1 (sin disparador también se deja probar): 2 pass / 1 fail, cae éste.
test('el porqué: primero el disparador, después alguna tarjeta, después lo que frena Publicar', () => {
  assert.equal(motivoParaNoProbar({ cronSinElegir: true, pasos: [], frena: false }), 'Completa el disparador');
  assert.equal(motivoParaNoProbar({ cronSinElegir: true, pasos: [MENSAJE], frena: true }), 'Completa el disparador');
  assert.equal(motivoParaNoProbar({ cronSinElegir: false, pasos: [], frena: false }), 'Agrega un mensaje');
  assert.equal(motivoParaNoProbar({ cronSinElegir: false, pasos: [{ id: '__inicio', nodo: 'inicio' } as PasoGrafo], frena: false }), 'Agrega un mensaje');
  assert.equal(motivoParaNoProbar({ cronSinElegir: false, pasos: [MENSAJE], frena: true }), 'Completa una tarjeta');
  assert.equal(motivoParaNoProbar({ cronSinElegir: false, pasos: [MENSAJE], frena: false }), null);
  for (const t of ['Completa el disparador', 'Agrega un mensaje', 'Completa una tarjeta']) assert.ok(t.split(' ').length <= 4, t);
});

// rotura 2 (un CRON «manual» cuenta como elegido): 2 pass / 1 fail, cae éste.
test('el CRON sin elegir: ninguno, o todos «Elige qué la dispara»; un horario o una etapa ya es elegido', () => {
  assert.equal(cronSinElegir([]), true);
  assert.equal(cronSinElegir([{ trigger_tipo: 'manual', cron: null }]), true);
  assert.equal(cronSinElegir([{ trigger_tipo: 'manual', cron: { cada: 'dia' } }]), false);
  assert.equal(cronSinElegir([{ trigger_tipo: 'etapa_actual' }]), false);
  assert.equal(cronSinElegir([{ trigger_tipo: 'manual' }, { trigger_tipo: 'etapa_actual' }]), false);
});

// rotura 3 (el botón vuelve a estar encendido sin nada): 2 pass / 1 fail, cae éste.
test('la pantalla: el botón apagado con el porqué al lado, y el porqué de una tarjeta lleva a ella', () => {
  const perfil = readFileSync(new URL('../app/automations/SecuenciaPerfil.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(perfil, /const sinProbar = motivoParaNoProbar\(\{ cronSinElegir: cronSinElegir\(crons\.lista\), pasos, frena: !!frenoAhora \}\);/);
  assert.match(perfil, /\) : sinProbar \? \(\n\s+<button disabled aria-disabled title=\{sinProbar\} style=\{\{ \.\.\.estiloProbar, opacity: 0\.45, cursor: 'not-allowed' \}\}>▶ Probar<\/button>/);
  assert.match(perfil, /data-sin-probar onClick=\{\(\) => \{ if \(frenoAhora\) frenar\(frenoAhora\.error, frenoAhora\.tarjeta\); \}\}/);
});
