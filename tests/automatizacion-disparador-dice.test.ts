// =============================================================================
// Lo que dice una automatización contra la etapa que la dispara (30/10/2026)
// =============================================================================
// El caso real: la #264 de Código Inmobiliario, «Nueva automatización», con un aviso que dice «Nuevo agendado» y dispara en Lead y
// en Agenda. Y las que NO tienen que avisar: las automatizaciones activas medidas el 30/10 («Un Lead Entró», «Un Lead Agendó Llamada»).
//
// Correr: node --import tsx --test tests/automatizacion-disparador-dice.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (ver docs/hallazgos-chatbot.md, «MaKo no les escribió a sus leads»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avisoDisparadorQueNoDice, disparadorQueNoDice } from '../lib/automatizacion-disparador-dice';

const etapas = [{ value: 'lead', label: 'Lead entrante' }, { value: 'agenda', label: 'Agenda R1' }, { value: 'ganado', label: 'Ganado' }, { value: 'noresp', label: 'No responde' }];
const aviso = (mensaje: string) => ({ accion: { operacion: 'avisar_al_equipo', params: { mensaje } } });

test('1. la #264: el nombre no dice nada, y su aviso dice «agendado» y dispara también en Lead', () => {
  const d = disparadorQueNoDice({ nombre: 'Nueva automatización', pasos: [aviso('🎯 *Nuevo agendado*: {{nombre}}\nTeléfono: {{telefono}}')], disparan: ['lead', 'agenda'], etapas });
  assert.deepEqual(d, { fuente: 'aviso', dice: 'Nuevo agendado', otras: ['Lead entrante'], ademas: true });
  assert.equal(avisoDisparadorQueNoDice(d!), 'Tu aviso dice «Nuevo agendado» y se dispara también en «Lead entrante»: tu equipo lo recibe con esos leads.');
});

test('2. por el nombre: dice una etapa y dispara en otra', () => {
  const d = disparadorQueNoDice({ nombre: 'Un Lead Agendó Llamada', pasos: [], disparan: ['ganado'], etapas });
  assert.deepEqual(d, { fuente: 'nombre', dice: 'Un Lead Agendó Llamada', otras: ['Ganado'], ademas: false });
  assert.equal(avisoDisparadorQueNoDice(d!), 'Se llama «Un Lead Agendó Llamada» y se dispara en «Ganado».');
});

test('3. coherentes o sin saber: no se dice nada', () => {
  // Las activas medidas el 30/10.
  assert.equal(disparadorQueNoDice({ nombre: 'Un Lead Entró', pasos: [], disparan: ['lead'], etapas }), null, '«lead» no es evidencia');
  assert.equal(disparadorQueNoDice({ nombre: 'Un Lead Agendó Llamada', pasos: [], disparan: ['agenda'], etapas }), null);
  assert.equal(disparadorQueNoDice({ nombre: 'Aviso de un lead caliente', pasos: [], disparan: ['agenda'], etapas }), null, '«lead» no nombra una etapa');
  assert.equal(disparadorQueNoDice({ nombre: 'Sprint · apertura', pasos: [], disparan: ['st0'], etapas }), null, 'una etapa que no conoce');
  assert.equal(disparadorQueNoDice({ nombre: 'Nueva automatización', pasos: [], disparan: ['lead', 'agenda'], etapas }), null, 'no dice nada de ninguna etapa');
  // Un mensaje AL LEAD que invita a agendar, en Lead, es lo correcto: no se lee.
  assert.equal(disparadorQueNoDice({ nombre: 'Bienvenida', pasos: [{ accion: null }, { accion: { operacion: 'crear_tarea', params: { mensaje: 'Agenda tu llamada' } } }], disparan: ['lead'], etapas }), null);
  // Sin disparador por etapa no hay contra qué comparar.
  assert.equal(disparadorQueNoDice({ nombre: 'Agendados', pasos: [], disparan: [], etapas }), null);
  // Dice las dos: coherente.
  assert.equal(disparadorQueNoDice({ nombre: 'Agenda y ganado', pasos: [], disparan: ['agenda', 'ganado'], etapas }), null);
});

test('4. el nombre manda sobre el aviso, y sólo cuenta el primer renglón', () => {
  assert.equal(disparadorQueNoDice({ nombre: 'Agenda', pasos: [aviso('Ganado')], disparan: ['agenda'], etapas }), null);
  assert.equal(disparadorQueNoDice({ nombre: 'Aviso', pasos: [aviso('Llegó alguien\nDespués agenda')], disparan: ['lead'], etapas }), null);
});

test('5. la pantalla lo dibuja, sin tocar nada por detrás', () => {
  const s = readFileSync('app/automations/SecuenciaPerfil.tsx', 'utf8').replace(/\r\n/g, '\n');
  assert.match(s, /disparadorQueNoDice\(\{ nombre, pasos, disparan:/);
  assert.match(s, /data-disparador-dice=""/);
  assert.match(s, /setCronAbierto\(crons\.primero\?\.id \?\? 'nuevo'\);[^\n]*\}\}[^\n]*>Cambiar disparador</);
  assert.match(s, /onClick=\{\(\) => setEditandoNombre\(true\)\}[^\n]*>Cambiar nombre</);
  assert.match(s, /disparadorDice && yaVistoDisparador !== firmaDisparador && \(/, '«Está bien así» no se recuerda');
});
