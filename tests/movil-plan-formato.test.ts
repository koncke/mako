// /m/plan — cómo se dice el plazo de una tarea, y que la pantalla no vuelva a
// contar «hoy» con el reloj del teléfono.
//
// Verificado rompiéndolo (11/10/2026, base en verde: 6 pass), una rotura a la vez:
//   · `dias <= 6` → `dias <= 7` en textoVence: 1 fallo, 5 pases.
//   · quitar `if (dias === -1) return 'venció ayer'`: 2 fallos, 4 pases.
//   · `diaUTC(hoy) ?? Date.now()` (el reloj del teléfono en formato.ts): 1 fallo.
//   · `fecha={new Date().toISOString()…}` en page.tsx: 1 fallo, 5 pases.
//   · sacar el filtro de duplicados (`vistos.has`) de ListaPlan: 1 fallo, 5 pases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoVence, contar, TONO_BANDA } from '../app/m/plan/formato';

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('textoVence: pasado, hoy y la semana en palabras', () => {
  const hoy = '2026-10-11'; // domingo
  assert.equal(textoVence('2026-10-09', hoy), 'venció hace 2 días');
  assert.equal(textoVence('2026-10-10', hoy), 'venció ayer');
  assert.equal(textoVence('2026-10-11', hoy), 'vence hoy');
  assert.equal(textoVence('2026-10-12', hoy), 'vence mañana');
  assert.equal(textoVence('2026-10-14', hoy), 'vence el miércoles');
  assert.equal(textoVence('2026-10-17', hoy), 'vence el sábado');
  assert.equal(textoVence('2026-10-18', hoy), 'vence el 18 de octubre');
});

test('textoVence: sin fecha o con basura no inventa un plazo', () => {
  assert.equal(textoVence(null, '2026-10-11'), null);
  assert.equal(textoVence('', '2026-10-11'), null);
  assert.equal(textoVence('mañana', '2026-10-11'), null);
});

test('textoVence: cruza el cambio de horario sin correr el día', () => {
  // 8/3/2026 es el salto de horario en EE. UU. (la zona por defecto es Tijuana).
  assert.equal(textoVence('2026-03-09', '2026-03-08'), 'vence mañana');
  assert.equal(textoVence('2026-03-07', '2026-03-08'), 'venció ayer');
});

test('contar y tono de la banda', () => {
  assert.equal(contar(1, 'proyecto atrasado', 'proyectos atrasados'), '1 proyecto atrasado');
  assert.equal(contar(3, 'proyecto atrasado', 'proyectos atrasados'), '3 proyectos atrasados');
  // El verde dice «completado»: una tarea abierta nunca va en good.
  assert.ok(!Object.values(TONO_BANDA).includes('good'));
});

test('el plazo se cuenta contra la fecha del negocio, nunca el reloj del teléfono', () => {
  const formato = sinComentarios(leer('../app/m/plan/formato.ts'));
  assert.match(formato, /Date\.UTC\(/);
  assert.doesNotMatch(formato, /new Date\(\)|Date\.now\(/);
  const lista = sinComentarios(leer('../app/m/plan/ListaPlan.tsx'));
  assert.doesNotMatch(lista, /new Date\(\)|Date\.now\(/);
  const page = sinComentarios(leer('../app/m/plan/page.tsx'));
  assert.match(page, /fecha=\{plan\.fecha\}/);
});

test('una tarea no sale dos veces en la pantalla (semana trae las de prioridades)', () => {
  const lista = sinComentarios(leer('../app/m/plan/ListaPlan.tsx'));
  assert.match(lista, /if \(vistos\.has\(it\.id\)\) return false;/);
});
