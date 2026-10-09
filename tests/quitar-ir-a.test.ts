// =============================================================================
// GO TO desaparece: un «Ir a» pasa a flecha o se saca, y lo que corre es lo mismo (sexta tanda)
// =============================================================================
// Pedido de Martín (09/10/2026, punto 12 de «General»): «"Go to" desaparece directamente... Y si eso
// pasa, y tengo otra automatización que el CRON inicia con esa etiqueta o etapa del kanban, ya solo se
// dispara, no necesito "Go to"».
//
// Medido en producción el mismo día (scripts/quitar-ir-a.mts --simular): #198 (ws1, activa) con dos
// «Sigue en #212» desde el «Sí» de dos condiciones; #221 (ws1, pausada) con un «Ir a» que vuelve a una
// espera de arriba; #222 (archivada) con tres «Sigue en #221». Ninguna inscripción parada en un «Ir a».
//
// Lo que fija este archivo (lib/flujo-legado.ts → `quitarIrA`, `abrirFlujo`):
//   1. un «Ir a» a una tarjeta de la misma automatización pasa a FLECHA y «Probar» recorre lo mismo;
//   2. un «Ir a» a otra automatización se SACA (la otra arranca por su CRON) y el resto corre igual;
//   3. el que retoma desde «Si responde» QUEDA (una flecha correría otra cosa);
//   4. «volver al principio» fija la raíz; una cadena de saltos se sigue hasta el final;
//   5. si sacarlos trae un error de publicar que no estaba, el lienzo abre lo de antes;
//   6. el script de producción es un SIMULACRO por default y escribe con compare-and-set.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie.
//
// Correr: npx tsx --test tests/quitar-ir-a.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quitarIrA, abrirFlujo } from '../lib/flujo-legado';
import { validarGrafo, raizSalida, padresDe, claseDe, ID_INICIO, type PasoGrafo, type RamaCondicion } from '../lib/flujo-grafo';
import { iniciar, siguiente, elegir, type EstadoSim } from '../lib/simulador-grafo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ini = (siguiente: string | null): PasoGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente } as PasoGrafo);
const msg = (id: string, siguiente: string | null = null, paralelos?: string[]): PasoGrafo =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: `hola ${id}`, delay_horas: 0, asunto: null, template_wa: null, siguiente, ...(paralelos ? { paralelos } : {}) } as PasoGrafo);
const esp = (id: string, siguiente: string | null, minutos = 1440): PasoGrafo => ({ id, nodo: 'esperar', espera: { modo: 'tiempo', minutos }, siguiente } as PasoGrafo);
const rama = (id: string, siguiente: string | null): RamaCondicion => ({ id, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente } as RamaCondicion);
const cond = (id: string, ramas: RamaCondicion[], si_no: string | null): PasoGrafo => ({ id, nodo: 'condicion', ramas, si_no } as PasoGrafo);
const irA = (id: string, destino: PasoGrafo['destino']): PasoGrafo => ({ id, nodo: 'ir_a', destino } as PasoGrafo);
const pid = (pasos: readonly PasoGrafo[], id: string) => pasos.find((p) => p.id === id);

/**
 * Lo que «Probar» muestra, sin los saltos: los mensajes, las esperas y las acciones, en orden. `elige`
 * decide cada condición (por su id y por cuántas veces ya se pasó por ella).
 */
function recorrer(pasos: readonly PasoGrafo[], elige: (nodo: string, vez: number) => string, tope = 40): string[] {
  let st: EstadoSim = iniciar(pasos);
  const out: string[] = [];
  const veces = new Map<string, number>();
  for (let k = 0; k < tope; k++) {
    if (st.eligiendo) {
      const n = st.eligiendo.nodo;
      const v = veces.get(n) ?? 0;
      veces.set(n, v + 1);
      st = elegir(st, elige(n, v));
      continue;
    }
    const r = siguiente(pasos, st);
    st = r.estado;
    if (!r.evento) { if (st.eligiendo) continue; break; }
    const e = r.evento;
    if (e.t === 'mensaje' || e.t === 'espera' || e.t === 'accion') out.push(e.nodo);
    if (e.t === 'fin') break;
  }
  return out;
}

// #221: CRON → m1 → esperar 1 día → ¿agendó? «Sí» → m2 · «Si no» → m3 → «Ir a» la espera.
const COMO_221 = [msg('m1', 'e24'), esp('e24', 'k'), cond('k', [rama('kr', 'm2')], 'm3'), msg('m2'), msg('m3', 'j'), irA('j', { nodo: 'e24' }), ini('m1')];

test('⚠️ #221: el «Ir a» que vuelve a la espera pasa a ser una FLECHA, y «Probar» recorre lo mismo', () => {
  const r = quitarIrA(COMO_221);
  assert.equal(r.convertida, true);
  assert.deepEqual(r.cambios.map((c) => [c.id, c.como]), [['j', 'flecha']]);
  assert.equal(pid(r.pasos, 'j'), undefined, 'el «Ir a» ya no está');
  assert.equal(pid(r.pasos, 'm3')!.siguiente, 'e24');
  assert.equal(padresDe(r.pasos, 'e24').length, 2, 'la espera tiene dos padres: m1 y m3');
  assert.deepEqual(r.erroresNuevos, []);
  assert.deepEqual(validarGrafo(r.pasos), []);
  // Dos vueltas por el «Si no» y después el «Sí»: lo mismo antes y después.
  const pol = (_n: string, vez: number) => (vez < 2 ? 'si_no' : 'kr');
  const antes = recorrer(COMO_221, pol);
  assert.deepEqual(antes, ['m1', 'e24', 'm3', 'e24', 'm3', 'e24', 'm2']);
  assert.deepEqual(recorrer(r.pasos, pol), antes);
});

// #198: CRON → ¿agendó? «Sí» → «Sigue en #212» · «Si no» → m1 → esperar → ¿agendó? «Sí» → «Sigue en #212» · «Si no» → m2.
const COMO_198 = [
  cond('k1', [rama('k1r', 'j1')], 'm1'), irA('j1', { secuencia_id: 212 }), msg('m1', 'e'), esp('e', 'k2'),
  cond('k2', [rama('k2r', 'j2')], 'm2'), irA('j2', { secuencia_id: 212 }), msg('m2'), ini('k1'),
];

test('⚠️ #198: «Sigue en #212» se SACA (la arranca su CRON) y la salida queda vacía donde estaba', () => {
  const r = quitarIrA(COMO_198, { nombreDeSecuencia: (id) => (id === 212 ? 'Agendó después de tu bienvenida' : null) });
  assert.deepEqual(r.cambios.map((c) => [c.id, c.como]), [['j1', 'quitado'], ['j2', 'quitado']]);
  assert.equal(pid(r.pasos, 'k1')!.ramas![0].siguiente, null);
  assert.equal(pid(r.pasos, 'k2')!.ramas![0].siguiente, null);
  assert.ok(r.notas.includes('«Sigue en «Agendó después de tu bienvenida»» se sacó: esa automatización arranca por su propio CRON'));
  assert.deepEqual(r.erroresNuevos, []);
  assert.ok(!r.pasos.some((p) => claseDe(p) === 'ir_a'));
  // Lo que se le manda al lead no cambia por ningún camino.
  for (const pol of [() => 'si_no', (n: string) => (n === 'k1' ? 'si_no' : 'k2r'), (n: string) => (n === 'k1' ? 'k1r' : 'si_no')]) {
    assert.deepEqual(recorrer(r.pasos, pol), recorrer(COMO_198, pol));
  }
});

test('⚠️ el «Ir a» de «Si responde» que RETOMA la salida queda (una flecha correría otra cosa)', () => {
  const resp = { id: 'R', nodo: 'respuesta', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'precio', siguiente: 'ia' }], si_no: null } as PasoGrafo;
  const pasos = [msg('m1', 'e'), esp('e', 'm2'), msg('m2'), resp, msg('ia', 'jr'), irA('jr', { nodo: 'm2' }), ini('m1')];
  const r = quitarIrA(pasos);
  assert.deepEqual(r.cambios.map((c) => [c.id, c.como]), [['jr', 'queda']]);
  assert.equal(r.convertida, false);
  assert.ok(pid(r.pasos, 'jr'), 'el motor lo sigue corriendo');
});

test('«volver al principio» con un «Ir a», sin CRON en el dato: queda la flecha y la raíz se fija', () => {
  const pasos = [msg('m1', 'e'), esp('e', 'j'), irA('j', { nodo: 'm1' })];
  const r = quitarIrA(pasos);
  assert.equal(pid(r.pasos, 'e')!.siguiente, 'm1');
  assert.equal(raizSalida(r.pasos), 'm1');
  assert.ok(pid(r.pasos, ID_INICIO), 'se fijó el CRON');
  assert.deepEqual(r.erroresNuevos, []);
});

test('una cadena de saltos se sigue hasta el final; un salto a una tarjeta que no existe se saca', () => {
  // El segundo salto ANTES en el array: siguiendo de a uno, «a» quedaría apuntando a «j2», que se saca.
  const cadena = [msg('a', 'j1'), irA('j2', { nodo: 'b' }), irA('j1', { nodo: 'j2' }), msg('b'), ini('a')];
  const r = quitarIrA(cadena);
  assert.equal(pid(r.pasos, 'a')!.siguiente, 'b');
  assert.ok(!r.pasos.some((p) => claseDe(p) === 'ir_a'));
  const roto = quitarIrA([msg('a', 'j'), irA('j', { nodo: 'zz' }), ini('a')]);
  assert.equal(pid(roto.pasos, 'a')!.siguiente, null);
  assert.equal(roto.cambios[0].como, 'quitado');
  // `solo`: el botón del editor convierte UNO.
  const dos = [msg('a', 'j1'), irA('j1', { nodo: 'b' }), msg('b', 'j2'), irA('j2', { secuencia_id: 9 }), ini('a')];
  const uno = quitarIrA(dos, { solo: 'j1' });
  assert.ok(pid(uno.pasos, 'j2') && !pid(uno.pasos, 'j1'));
});

test('⚠️ el lienzo abre SIN «Ir a»; lo de antes sólo vuelve si se podía publicar y convertido no', () => {
  const ok = abrirFlujo(COMO_221, null);
  assert.equal(ok.convertida, true);
  assert.equal(ok.limpiarEstrategia, false, 'sacar un salto no toca la estrategia');
  assert.ok(!pid(ok.pasos, 'j'));
  // Una que ya NO se podía publicar (reparte dentro de un bucle de «Ir a») se abre convertida igual: el
  // error cambia de texto (ya no hay «Ir a» que nombrar) y por eso cuenta como «nuevo» para el script,
  // que no la escribe; el lienzo la muestra sin GO TO y Publicar dice lo que falta.
  const reparte = [msg('m1', 'e', ['x']), msg('x'), esp('e', 'j'), irA('j', { nodo: 'm1' }), ini('m1')];
  assert.ok(validarGrafo(reparte).length > 0);
  const r = quitarIrA(reparte);
  assert.ok(r.erroresNuevos.length > 0, 'el script no escribe una que no queda igual de publicable');
  const abierto = abrirFlujo(reparte, null);
  assert.equal(abierto.convertida, true);
  assert.ok(!abierto.pasos.some((p) => claseDe(p) === 'ir_a'));
  // La red: el fuente sólo vuelve a lo de antes cuando lo de antes se podía publicar.
  const src = sinComentarios(leer('lib/flujo-legado.ts'));
  assert.match(src, /const sePodia = s\.erroresNuevos\.length > 0 && validarGrafo\(r\.pasos\)\.length === 0;/);
});

test('⚠️ el script de producción es un SIMULACRO por default y escribe con compare-and-set', () => {
  const src = sinComentarios(leer('scripts/quitar-ir-a.mts'));
  assert.match(src, /const aplicar = process\.argv\.includes\('--aplicar'\);/);
  assert.match(src, /if \(!aplicar\) \{ console\.log\(''\); continue; \}/, 'sin --aplicar no se llega a escribir');
  assert.match(src, /upd = s\.updated_at \? upd\.eq\('updated_at', s\.updated_at\) : upd\.is\('updated_at', null\);/);
  assert.match(src, /if \(r\.erroresNuevos\.length\) \{/);
  assert.match(src, /if \(paradas\.length\) \{ console\.log\('  ✖ NO SE ESCRIBE/);
  assert.doesNotMatch(src, /estrategia:/, 'no toca la estrategia');
  assert.match(src, /\.eq\('id', s\.id\)\.eq\('workspace_id', s\.workspace_id\)/, 'la service role filtra el negocio a mano');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA (arnés en el scratchpad, tolera CRLF). Base: 7 / 0. Pasan / fallan:
//   Q1. el «Ir a» de «Si responde» pasa a flecha                                       → 6 / 1
//   Q2. un «Ir a» a una tarjeta se saca en vez de pasar a flecha                       → 3 / 4
//   Q3. sin fijar la raíz cuando un salto vuelve a la primera                          → 6 / 1
//   Q4. la cadena de saltos sin seguir hasta el final                                  → 6 / 1
//   Q5. `abrirFlujo` vuelve a lo de antes con cualquier error nuevo                    → 6 / 1
//   Q6. «Sigue en otra automatización» no se saca                                      → 6 / 1
//   Q7. el script escribe por default                                                  → 6 / 1
//   Q8. el script escribe sin compare-and-set                                          → 6 / 1
