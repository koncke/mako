// =============================================================================
// /plan del cliente: las lecturas que no dependen una de otra van JUNTAS, y se lee lo MISMO que antes (O27, 18/11/2026)
// =============================================================================
// docs/hallazgos-infra.md anotaba «las pantallas que esperan en serie en el SERVER: /plan (~10 esperas)». Dos pares eran
// independientes y esperaban de a uno: las tareas y los proyectos, y el workspace y los clientes antes de las columnas, la
// tarjeta y el borrador. Se corre la página DE VERDAD (tests/_plan-lecturas-juntas-hijo.ts) con sus bordes de mentira y se mira
// la línea de tiempo de cada lectura: qué arranca antes de que termine qué. Y lo que NO cambia: el conjunto de lecturas, que
// las de después del sembrado se lean después del sembrado, y cómo cae cada una.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, base 4/0; cada rotura a mano en app/plan/page.tsx y vuelta atrás):
//   · las tareas y los proyectos otra vez de a uno (`await listTareas…; await listCategorias()`)   → 3/1 (1)
//   · una lectura del workspace de más, ANTES del sembrado                                          → 1/3 (1, 2 y 4)
//   · una caída de los proyectos tomada como «la base no contesta» (dbDown)                          → 3/1 (3)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

type Corrida = { linea: string[]; sembro: number; autocompleto: number; props: Record<string, unknown> };
type Salida = { normal: Corrida; sinTareas: Corrida; sinCategorias: Corrida; vacio: Corrida };
let cache: Salida | null = null;
const correr = (): Salida => {
  if (!cache) {
    const out = execFileSync(process.execPath, [
      '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_plan-lecturas-juntas-hijo.ts'),
    ], { cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
    cache = JSON.parse(out.trim().split('\n').pop()!) as Salida;
  }
  return cache;
};
/** La posición de un evento en la línea de tiempo (falla si no está: una lectura que no se hizo no es «más rápida»). */
const en = (c: Corrida, ev: string, desde = 0) => {
  const i = c.linea.indexOf(ev, desde);
  assert.ok(i >= 0, `no está «${ev}» en ${JSON.stringify(c.linea)}`);
  return i;
};
/** ¿`a` y `b` corrieron JUNTAS? Cada una arrancó antes de que terminara la otra. */
const juntas = (c: Corrida, a: string, b: string, desde = 0) =>
  en(c, `${a}:inicio`, desde) < en(c, `${b}:fin`, desde) && en(c, `${b}:inicio`, desde) < en(c, `${a}:fin`, desde);

test('1. las tareas y los proyectos se leen JUNTOS, y el workspace y los clientes en la misma espera que las columnas', { timeout: 200_000 }, () => {
  const c = correr().normal;
  assert.ok(juntas(c, 'tareas', 'categorias'), `en serie: ${JSON.stringify(c.linea)}`);
  for (const otra of ['workspace', 'clientes']) assert.ok(juntas(c, otra, 'columnas'), `${otra} espera aparte: ${JSON.stringify(c.linea)}`);
  assert.deepEqual(c.props.tareas, [{ id: 1, titulo: 'Una tarea' }]);
  assert.deepEqual(c.props.categorias, [{ id: 7, nombre: 'Un proyecto' }]);
  assert.equal(c.props.wsId, 10);
  assert.deepEqual(c.props.clientes, [{ leadId: 3, nombre: 'Cliente X' }]);
  assert.equal(c.props.demo, false);
  assert.equal(c.props.vistaInicial, 'tareas');
});

test('2. se lee lo MISMO que antes: ni una lectura de más ni una de menos', { timeout: 200_000 }, () => {
  const c = correr().normal;
  const leidas = c.linea.filter((e) => e.endsWith(':inicio')).map((e) => e.slice(0, -':inicio'.length)).sort();
  assert.deepEqual(leidas, ['arranque', 'categorias', 'clientes', 'columnas', 'perfil', 'rol', 'tareas', 'tarjeta', 'workspace']);
  assert.equal(c.autocompleto, 1, 'con tareas, el cierre por señales corre como siempre');
  assert.equal(c.sembro, 0);
});

test('3. cada lectura cae como antes: sin tareas, el respaldo de la demo; sin proyectos, arrancan vacíos y el tablero sigue', { timeout: 200_000 }, () => {
  const { sinTareas, sinCategorias } = correr();
  assert.equal(sinTareas.props.demo, true, 'sin tareas es «la base no contesta»: en desarrollo, la demo');
  assert.equal(sinTareas.autocompleto + sinTareas.sembro, 0, 'con la base caída no se escribe nada');
  assert.equal(sinCategorias.props.demo, false, 'una caída de los proyectos NO es «la base no contesta»');
  assert.deepEqual(sinCategorias.props.categorias, []);
  assert.deepEqual(sinCategorias.props.tareas, [{ id: 1, titulo: 'Una tarea' }]);
  assert.equal(sinCategorias.sembro, 0, 'con tareas no se siembra aunque los proyectos no se hayan podido leer');
});

test('4. un tablero vacío se siembra y se relee; lo de después se lee DESPUÉS del sembrado, como antes', { timeout: 200_000 }, () => {
  const c = correr().vacio;
  assert.equal(c.sembro, 1);
  const sembrar = en(c, 'sembrar');
  assert.ok(juntas(c, 'tareas', 'categorias', sembrar), 'la relectura del sembrado también va junta');
  for (const despues of ['workspace', 'clientes', 'columnas', 'tarjeta']) {
    assert.ok(en(c, `${despues}:inicio`) > sembrar, `${despues} se leyó ANTES de sembrar: cambió qué se lee`);
  }
});
