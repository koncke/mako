// =============================================================================
// El chat de MaKo en la app y el teléfono tampoco «putea suave» (17/10/2026)
// =============================================================================
// docs/relevo/mako-en-whatsapp.md §3: «La persona de MaKo "putea suave" (lib/mako-persona.ts) en todo lo que pasa por
// `buildSystemPrompt`. El doer lo corta; el chat de la app y del teléfono del cliente (lib/mako-turno-app.ts) no se
// revisó». Ese chat lo usan los clientes y su equipo: lleva la MISMA voz (en el system) y el MISMO corte antes de guardar
// (`sanearSalida`, lib/doer-salida.ts), que saca la oración y no la respuesta entera.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. turnoApp sin `sanearSalida` .................................................... 1 fallo
//   2. VOZ_APP sin «SIN groserías» .................................................... 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearSalida } from '../lib/doer-salida';

const src = readFileSync(join(__dirname, '..', 'lib', 'mako-turno-app.ts'), 'utf8').replace(/\r\n/g, '\n');

test('el corte saca la oración grosera y deja el resto', () => {
  const s = sanearSalida('Listo, ya moví a Ana a Agendado. Esa campaña era una cagada igual.', { corrioHerramientas: true });
  assert.deepEqual(s.groserias, ['cagada']);
  assert.equal(s.texto, 'Listo, ya moví a Ana a Agendado.');
});

test('el chat de la app pasa su respuesta por el corte y pide la voz sin groserías', () => {
  const salida = src.slice(src.indexOf('// ── Lo que sale ──'));
  assert.ok(salida.indexOf('sanearSalida(respuesta, { corrioHerramientas: true })') > 0, 'turnoApp no corta las groserías');
  // Desde el 20/10/2026 el guardado lleva también lo que dibujaron las lecturas (la 2.27): se busca el comienzo de la llamada.
  const guardar = salida.indexOf("await appendMessage(s.id, 'assistant', respuesta");
  assert.ok(guardar > 0, 'no encontré dónde se guarda la respuesta');
  assert.ok(salida.indexOf('sanearSalida(') < guardar, 'se corta ANTES de guardar');
  const voz = src.slice(src.indexOf('const VOZ_APP'), src.indexOf('const TOOLS_APP'));
  assert.match(voz, /SIN groserías ni lunfardo/);
});
