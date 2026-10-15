// =============================================================================
// «MaKo en WhatsApp» fuera del horario: una casilla, no una regla escondida (14/10/2026)
// =============================================================================
// docs/diseno-mako-nada-por-detras.md §2.4-h (mako-tarjeta-fuera-de-horario): con horario de oficina, la tarjeta «MaKo
// en WhatsApp» salía igual fuera de horario (undécima tanda, M3 f) y nada en la pantalla lo decía. Ahora es la casilla
// «Los avisos al equipo salen igual» del horario, prendida de fábrica (lo de antes). El carril del recordatorio corre
// igual siempre. Se fija sobre el FUENTE sin comentarios. PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

test('el motor lee la casilla: apagada, fuera del horario corre sólo el carril', () => {
  assert.match(NUTRI, /if \(horario && horario !== 'ilegible' && horario\.avisosAlEquipo === false\) makoFueraDeHorario = false;/);
  assert.match(NUTRI, /tieneCarril\(s\.pasos\) \|\| \(makoFueraDeHorario && s\.pasos\.some\(esTarjetaMako\)\)/, 'la automatización entraba a la corrida igual');
  assert.match(NUTRI, /fueraDeHorario != null && !makoFueraDeHorario\s*\? esHiloDelCarril\(sec\.pasos, i\)\s*: seMueveEnLaCorrida\(/, 'la tarjeta salía igual con la casilla apagada');
  // Sin poder leer el horario, lo de fábrica (salen igual): «no sé» no apaga el aviso de un agendado.
  assert.match(NUTRI, /let makoFueraDeHorario = true;/);
});

test('la casilla está en el panel del horario, con el horario prendido', () => {
  const panel = sinComentarios(leer('app/configuraciones/HorarioEnvioPanel.tsx'));
  assert.match(panel, /checked=\{h\.avisosAlEquipo\}/);
  assert.match(panel, /onChange=\{\(e\) => cambiar\(\{ avisosAlEquipo: e\.target\.checked \}\)\}/);
  assert.match(panel, /Los avisos al equipo salen igual/);
});

// ── ROTURAS (14/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo y tests/horario-envio.test.ts, restaura DE MEMORIA; nunca
// git). Base: 11 / 0. Cada una dio 10 / 1: el saneo con la casilla fija en true · el motor sin leerla · la corrida sin
// mirarla · la tarjeta saliendo igual con la casilla apagada · el panel sin la casilla. Restaurado: 11 / 0.
