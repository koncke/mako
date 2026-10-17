// =============================================================================
// Cerrar una tarea cuando algo YA ESTÁ: en el acto, con la evidencia, sin borrador (17/10/2026)
// =============================================================================
// Martín, 17/10/2026: que marcar resuelta una tarea, cuando algo ya está, sea AUTOMÁTICO siempre. Hasta ese día el
// único camino desde afuera del tablero era `proponer_cierre_tareas`: un borrador en /plan/revisar esperando a
// alguien. El Centro lo proponía y lo aplicaba en dos pasos, y el «Ya está» de un chat no cerraba nada.
// Lo que fija:
//   · `cerrar_tareas_plan` (la API de MaKo) cierra en los DOS tableros, sin borrador, con la evidencia y la ruta en
//     el historial; una que ya estaba hecha es «ya está así», no un error; sin evidencia no cierra.
//   · el «Ya está» de un chat cierra las tarjetas que NOMBRA (#870) o la de su proyecto cuyo título entero aparece;
//     nada por parecido (`tarjetasDelYaEsta`).
// Las funciones reales del servidor corren en tests/_fathom-carga-hijo.ts (modo `cierre`), sin base ni red.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `cerrar_tareas_plan` con confirmación 'pantalla' (el borrador de antes) ...... 1 fallo
//   2. `preparar` sin el «ya estaba hecha» (`yaEstaba`) ............................. 1 fallo
//   3. `cerrarConEvidencia` sin la ruta (`pruebaConRuta` → la prueba sola) ........... 1 fallo
//   4. `cerrarTareaCliente` sin subir el avance a 100 ................................ 1 fallo
//   5. `tarjetasDelYaEsta` aceptando un título de dos palabras ....................... 1 fallo
//   6. `numerosDeTarjeta` tomando «&#39;» como una tarjeta ............................ 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { numerosDeTarjeta, tarjetasDelYaEsta, type TareaPlanP } from '../lib/centro-plan-reglas';
import { pruebaConRuta, TOPE_PRUEBA_CIERRE } from '../lib/cierre-tarjeta';
import { DEFS } from '../lib/api-mako/areas/plan.def';

const t = (num: number, titulo: string, proyecto = 'Feature: Plan'): TareaPlanP => ({ id: `t${num}`, num, titulo, proyecto, prioridad: null } as TareaPlanP);

test('la operación cierra sin borrador: es una acción de chat, no de pantalla', () => {
  const d = DEFS.find((x) => x.id === 'cerrar_tareas_plan');
  assert.ok(d, 'existe en el registro');
  assert.equal((d as { confirmacion?: string }).confirmacion, 'chat', 'sin borrador en /plan/revisar');
  assert.equal((d as { pantalla?: string }).pantalla, undefined);
});

test('el «Ya está» cierra lo que nombra por número, y si no nombra nada, sólo el título entero', () => {
  assert.deepEqual(numerosDeTarjeta('Ya está: #870, #873 y #882. No es &#39; ni /ruta#12'), [870, 873, 882]);
  const abiertas = [t(870, 'Arreglar la asignación de proyectos de Fathom'), t(873, 'Borrar tarjetas con la tecla Delete'), t(880, 'Simplificar los templates de la ficha del lead', 'Feature: CRM')];
  assert.deepEqual(tarjetasDelYaEsta('Ya está #870: las tareas de Fathom van a su tab.', abiertas).map((x) => x.num), [870]);
  // Sin número: el título entero, dentro del proyecto del jefe.
  const delJefe = abiertas.filter((x) => x.proyecto === 'Feature: Plan');
  assert.deepEqual(tarjetasDelYaEsta('Ya está: arreglar la asignación de proyectos de Fathom, se prueba en /plan.', abiertas, delJefe).map((x) => x.num), [870]);
  // Un parecido no alcanza, y un título corto tampoco (cerraría cualquier cosa).
  assert.deepEqual(tarjetasDelYaEsta('Ya está: arreglé la asignación de Fathom.', abiertas, delJefe), []);
  assert.deepEqual(tarjetasDelYaEsta('Ya está: modo oscuro.', [t(883, 'Modo oscuro')], [t(883, 'Modo oscuro')]), []);
});

test('la ruta para revisar sobrevive a una prueba larga', () => {
  const p = pruebaConRuta('x'.repeat(600), '/crm?lead=12');
  assert.ok(p.length <= TOPE_PRUEBA_CIERRE, `largo ${p.length}`);
  assert.ok(p.endsWith('Se revisa en /crm?lead=12'));
});

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_fathom-carga-hijo.ts'), 'cierre'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'test' },
});
type Corrida = { prep: Record<string, unknown>; ej?: Record<string, unknown> };
const r = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  cierreDueno: { corta: Corrida; ya: Corrida; ok: Corrida; fila: { progress: number; estado: string; checklist: Array<{ done: boolean }>; historial: string[] }; borradores: number };
  cierreCliente: { ok: Corrida; fila: { progreso: number; estado: string; historial: string[] }; borradores: number };
};

test('tablero del dueño: cierra en el acto con la evidencia y la ruta, sin borrador', () => {
  assert.match(String(r.cierreDueno.corta.prep.error), /Falta evidencia/);
  assert.equal(r.cierreDueno.ya.prep.yaEstaba, true, 'una que ya estaba hecha es «ya está así»');
  assert.equal(r.cierreDueno.ok.ej?.ok, true, JSON.stringify(r.cierreDueno.ok));
  assert.equal(r.cierreDueno.fila.progress, 100);
  assert.equal(r.cierreDueno.fila.estado, 'hecho');
  assert.ok(r.cierreDueno.fila.checklist.every((c) => c.done), 'la checklist queda tildada');
  assert.match(r.cierreDueno.fila.historial[0], /^MaKo la marcó hecha: Las tareas de una reunión .* · Se revisa en \/plan\?tarea=t870$/);
  assert.equal(r.cierreDueno.borradores, 0, 'ningún borrador en /plan/revisar');
});

test('tablero de un cliente: la misma escritura que el borrador al aplicar un cierre', () => {
  assert.equal(r.cierreCliente.ok.ej?.ok, true, JSON.stringify(r.cierreCliente.ok));
  assert.equal(r.cierreCliente.fila.progreso, 100);
  assert.match(r.cierreCliente.fila.historial[0], /^MaKo la marcó hecha: Contrato enviado/);
  assert.equal(r.cierreCliente.borradores, 0);
});
