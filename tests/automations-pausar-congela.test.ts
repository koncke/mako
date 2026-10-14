// =============================================================================
// «Pausar» CONGELA una automatización: al reactivarla, cada lead sigue en su paso (14/10/2026)
// =============================================================================
// Martín, 14/10/2026, a «"Pausar" hoy TERMINA a los leads que tenía adentro; al reactivarla, nadie sigue»: «Congela y
// sigue donde estaba». Era una regla escondida: el motor sólo leía las automatizaciones prendidas
// (`getSecuenciasActivas`) y a la inscripción de una pausada que le vencía la cerraba por «la secuencia no está»
// ('completada', sin rastro). Ahora (lib/nutricion.ts): `procesarEnvios` y la vista previa no levantan lo de una
// pausada (`idsDePausadas`), y `setSecuenciaActiva(id, true)` pone lo vencido en «ahora» para que salga ya.
// La decisión vive en consultas de `procesarEnvios`, que arrastra todo el runtime de Next: el test mira el fuente.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 la consulta de `procesarEnvios` sin excluir las pausadas                          → 3 / 1
//   R2 `idsDePausadas` con `.eq('activa', true)`                                          → 3 / 1
//   R3 reactivar sin poner lo vencido en «ahora»                                          → 3 / 1
//
// Correr: node --import tsx --test tests/automations-pausar-congela.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const NUTRI = readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const fn = (abre: string): string => {
  const ini = NUTRI.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = NUTRI.indexOf('\n}\n', ini);
  return NUTRI.slice(ini, fin);
};

test('las pausadas son las apagadas sin archivar, y si no se pueden leer la corrida no avanza', () => {
  const f = fn('async function idsDePausadas(');
  assert.match(f, /\.eq\('activa', false\)\.is\('archivada_at', null\)/);
  assert.match(f, /if \(error\) throw new Error/);
});

test('el motor no levanta lo de una pausada (antes la cerraba por «la secuencia no está»)', () => {
  const p = fn('export async function procesarEnvios(');
  const i = p.indexOf('const pausadas = await idsDePausadas(supabase);');
  assert.ok(i > 0, 'procesarEnvios no lee las pausadas');
  assert.ok(i < p.indexOf('while ((!cupoLleno()'), 'se leen antes del bucle');
  assert.match(p, /if \(pausadas\.length\) q = q\.not\('secuencia_id', 'in', `\(\$\{pausadas\.join\(','\)\}\)`\);/);
});

test('la vista previa tampoco las cuenta', () => {
  const v = fn('async function inscripcionesVencidas(');
  assert.match(v, /await idsDePausadas\(supabase\)/);
  assert.match(v, /base\.not\('secuencia_id', 'in'/);
});

test('reactivar: lo que venció durante la pausa sale YA (la columna en «ahora», para el tick)', () => {
  const a = fn('export async function setSecuenciaActiva(');
  assert.match(a, /if \(activa\) \{[\s\S]*\.update\(\{ proximo_envio_at: ahora, updated_at: ahora \}\)[\s\S]*\.eq\('secuencia_id', id\)\.in\('estado', \['activa', 'respondio'\]\)\.lt\('proximo_envio_at', ahora\)/);
});
