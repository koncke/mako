// =============================================================================
// «Personalizar» la ficha: lo que se guarda, lo que se deshace y lo que se ve cuando algo falla
// =============================================================================
// La ficha del funnel guarda sola, en cola, con «Deshacer» (app/crm/lead-view/ficha/guardado-ficha.ts, el motor
// de useFichaDelFunnel). Lo que se fija acá no se ve con un clic: es lo que queda guardado en el funnel de
// TODOS los leads. Se prueba EJECUTANDO el motor contra un server de mentira que aplica los cambios con el
// mismo `aplicarCambio` que el de verdad (lib/ficha/config-server.ts: el parche sobre lo de hoy).
//
// Las cuatro fallas que cazó la revisión del 16/10/2026, cada una con su escenario:
//   1. Deshacer después de cambiar la casa del lead (el desplegable del funnel de la cabecera) mandaba el
//      `antes` del funnel VIEJO al funnel NUEVO: le borraba la ficha a todos los leads del otro funnel.
//   2. Ctrl+Z mientras se guardaba un cambio (el botón sí estaba apagado) deshacía DOS cambios: la pila sólo
//      se llena cuando contesta el server, así que restauraba el `antes` del cambio anterior.
//   3. Deshacer pisaba lo que OTRA persona guardó después: `restaurar` reemplaza la ficha entera. Ahora lleva
//      `esperado` (cómo la dejó el cambio que se deshace) y el motor no restaura si hoy es otra.
//   4. Si guardar fallaba y releer también (sin red, la sesión vencida), la pantalla se quedaba mostrando
//      el cambio que no se guardó. Ahora vuelve a lo último que dijo el server.
//
// Correr: node --import tsx --test tests/ficha-guardado.test.ts
//
// ⚠️ ROJO ANTES DEL ARREGLO: con el motor sacado TAL CUAL del hook (la misma cola y la misma pila), los
//    cinco primeros daban 1/4 (pasaba sólo «dos cambios seguidos»).
// ⚠️ VERIFICADO ROMPIÉNDOLO (16/10/2026, base 6/0), cada rotura restaurada de memoria antes de la siguiente:
//   · deshacer sin mirar el funnel (una pila sola)                                   → 5 / 1 (el 1)
//   · el motor cuenta los pasos todos juntos (el botón prendido en cualquier funnel) → 5 / 1 (el 1)
//   · deshacer mientras guarda, sin el corte                                         → 5 / 1 (el 2)
//   · la pantalla restaura sin `esperado`                                            → 5 / 1 (el 3)
//   · el motor sin mirar `esperado`                                                  → 5 / 1 (el 3)
//   · el saneo se come `esperado`                                                    → 5 / 1 (el 3)
//   · la pila guarda `antes` como `despues`                                          → 3 / 3
//   · sin volver a lo confirmado si releer falla                                     → 5 / 1 (el 4)
//   · `confirmada` sin tomar lo que se ve con la cola vacía                          → 5 / 1 (el 4)
//   · el hook prende Deshacer con los pasos de cualquier funnel                      → 5 / 1 (el 6)
//   · Ctrl+Z con un deshacer propio, sin el motor                                    → 5 / 1 (el 6)
//   · el hook crea un motor nuevo en cada llamada (sin `??=`: una cola por cambio)   → 5 / 1 (el 6)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aplicarCambio, fichaEfectiva, normalizar, sanearCambio, RESPALDO_VACIO, type CambioFicha, type FichaGuardada } from '../lib/ficha/config';
import type { FichaDelFunnel } from '../lib/ficha/config-server';
import { crearGuardado, type EstadoGuardado, type RespuestaGuardar, type RespuestaLeer } from '../app/crm/lead-view/ficha/guardado-ficha';

const R = RESPALDO_VACIO;
const PLANTILLA = 'respaldo' as const;

function fichaDe(id: number, guardada: FichaGuardada): FichaDelFunnel {
  return {
    funnel: { id, nombre: `Funnel ${id}`, esDefault: id === 8 },
    eleccion: { id: PLANTILLA, porque: 'prueba' },
    guardada,
    efectiva: fichaEfectiva(PLANTILLA, guardada, R),
    respaldo: R,
  };
}

/** El server: `funnels.data.ficha` por funnel, y el parche sobre lo de hoy, como cambiarFichaDeFunnel. */
function servidor(inicial: Record<number, FichaGuardada>) {
  const db = new Map<number, FichaGuardada>(Object.entries(inicial).map(([k, v]) => [Number(k), v]));
  let caido = false;
  let puerta: Promise<void> | null = null;
  return {
    db,
    caer: () => { caido = true; },
    /** Los guardados quedan esperando hasta `soltar()`. */
    pausar(): () => void {
      let soltar!: () => void;
      puerta = new Promise<void>((r) => { soltar = r; });
      return () => { puerta = null; soltar(); };
    },
    async guardar(id: number, raw: CambioFicha): Promise<RespuestaGuardar> {
      if (puerta) await puerta;
      if (caido) throw new Error('Failed to fetch');
      const c = sanearCambio(raw);
      if ('error' in c) return { ok: false, error: c.error };
      const antes = normalizar(db.get(id) ?? {}, PLANTILLA, R);
      const r = aplicarCambio(antes, c, PLANTILLA, R);
      if (!r.ok) return r;
      if (r.cambio) db.set(id, r.ficha);
      return { ok: true, ficha: fichaDe(id, db.get(id) ?? {}), antes, cambio: r.cambio };
    },
    async leer(id: number): Promise<RespuestaLeer> {
      if (caido) throw new Error('Failed to fetch');
      return { ok: true, ficha: fichaDe(id, db.get(id) ?? {}) };
    },
  };
}

/** Una pantalla con «Personalizar» abierto: la ficha que trajo el server (`base`) y lo de esta sesión. */
function pantalla(sv: ReturnType<typeof servidor>, funnelId: number) {
  let base: FichaDelFunnel = fichaDe(funnelId, sv.db.get(funnelId) ?? {});
  let local: FichaDelFunnel | null = null;
  const ver = (): FichaDelFunnel => (local && local.funnel.id === base.funnel.id ? local : base);
  const errores: string[] = [];
  let estado: EstadoGuardado = { guardando: false, pasos: {} };
  const g = crearGuardado({
    verActual: ver,
    poner: (f) => { local = f; },
    guardar: (id, c) => sv.guardar(id, c),
    leer: (id) => sv.leer(id),
    onGuardado: () => {},
    onError: (m) => { errores.push(m); },
    onEstado: (e) => { estado = e; },
  });
  return {
    g, ver, errores,
    /** Lo que dibuja el botón Deshacer (useFichaDelFunnel: `estado.pasos[actual.funnel.id]`). */
    pasosDeLoQueSeVe: () => estado.pasos[ver().funnel.id] ?? 0,
    /** La casa del lead cambió: la ficha relee y trae la del otro funnel. */
    cambiarCasa: (id: number) => { base = fichaDe(id, sv.db.get(id) ?? {}); },
  };
}

const compacta: CambioFicha = { op: 'densidad', densidad: 'compacta' };
const editorial: CambioFicha = { op: 'tema', tema: { plantilla: 'editorial' } };
const amplia: CambioFicha = { op: 'densidad', densidad: 'amplia' };

test('dos cambios seguidos se guardan los dos, y Deshacer vuelve de a uno, en orden', async () => {
  const sv = servidor({ 8: {} });
  const p = pantalla(sv, 8);
  p.g.cambiar(compacta);
  p.g.cambiar(editorial);
  await p.g.terminar();
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta');
  assert.equal(sv.db.get(8)?.estilo?.tema?.plantilla, 'editorial');
  assert.deepEqual(p.ver().guardada, sv.db.get(8), 'la pantalla termina con lo del server');
  p.g.deshacer();
  await p.g.terminar();
  assert.equal(sv.db.get(8)?.estilo?.tema, undefined, 'el primer Deshacer saca el último cambio');
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta', '…y sólo ése');
  p.g.deshacer();
  await p.g.terminar();
  assert.deepEqual(sv.db.get(8) ?? {}, {});
  assert.deepEqual(p.errores, []);
});

test('1. Deshacer después de cambiar la casa del lead no toca la ficha del otro funnel', async () => {
  const del30: FichaGuardada = { estilo: { densidad: 'amplia' } };
  const sv = servidor({ 8: {}, 30: del30 });
  const p = pantalla(sv, 8);
  p.g.cambiar(compacta);
  await p.g.terminar();
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta');
  // Desde la cabecera, el lead pasa al funnel 30: la ficha que se ve es la del 30.
  p.cambiarCasa(30);
  p.g.deshacer();
  await p.g.terminar();
  assert.deepEqual(sv.db.get(30), del30, 'Deshacer le pisó la ficha al funnel 30 con el «antes» del 8');
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta', 'el 8 no se tocó: no es la ficha que se ve');
  // Ni lo intenta: en el 30 no hay nada que deshacer (si lo intentara, el `esperado` lo frena con un error).
  assert.deepEqual(p.errores, [], 'Deshacer probó con el paso del otro funnel');
  assert.equal(p.pasosDeLoQueSeVe(), 0, 'el botón Deshacer queda prendido en el funnel 30');
  p.cambiarCasa(8);
  assert.equal(p.pasosDeLoQueSeVe(), 1, 'de vuelta en el 8, su paso sigue ahí');
});

test('2. Ctrl+Z mientras se guarda un cambio no deshace dos', async () => {
  const sv = servidor({ 8: {} });
  const p = pantalla(sv, 8);
  p.g.cambiar(compacta);
  await p.g.terminar();
  const soltar = sv.pausar();
  p.g.cambiar(editorial);
  // El teclado no mira el botón (que está apagado mientras guarda): llama a deshacer igual.
  p.g.deshacer();
  soltar();
  await p.g.terminar();
  assert.equal(sv.db.get(8)?.estilo?.tema?.plantilla, 'editorial', 'el cambio que se estaba guardando se perdió');
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta', 'se deshizo también el cambio anterior');
  assert.deepEqual(p.errores, [], 'el Ctrl+Z de mientras guarda dijo que otra persona cambió la ficha');
  // Y después del guardado, Deshacer saca el último, no el anterior.
  p.g.deshacer();
  await p.g.terminar();
  assert.equal(sv.db.get(8)?.estilo?.tema, undefined);
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta');
});

test('3. Deshacer no pisa lo que otra persona guardó después', async () => {
  const sv = servidor({ 8: {} });
  const yo = pantalla(sv, 8);
  const otra = pantalla(sv, 8);
  yo.g.cambiar(compacta);
  await yo.g.terminar();
  otra.g.cambiar(editorial);
  await otra.g.terminar();
  yo.g.deshacer();
  await yo.g.terminar();
  assert.equal(sv.db.get(8)?.estilo?.tema?.plantilla, 'editorial', 'Deshacer borró el cambio de la otra persona');
  assert.equal(yo.errores.length, 1, 'no se avisó que no se deshizo');
  assert.deepEqual(yo.ver().guardada, sv.db.get(8), 'la pantalla no muestra lo que quedó guardado');

  // El motor, solo: `esperado` es cómo dejó la ficha el cambio que se deshace.
  const hoy: FichaGuardada = { estilo: { densidad: 'compacta', tema: { plantilla: 'editorial', acento: null, fuente: null } } };
  const c = sanearCambio({ op: 'restaurar', ficha: {}, esperado: { estilo: { densidad: 'compacta' } } });
  assert.ok(!('error' in c) && c.op === 'restaurar' && c.esperado, 'el saneo se come el `esperado`');
  assert.equal(aplicarCambio(hoy, c, PLANTILLA, R).ok, false);
  const igual = sanearCambio({ op: 'restaurar', ficha: {}, esperado: hoy });
  assert.ok(!('error' in igual));
  assert.deepEqual(aplicarCambio(hoy, igual, PLANTILLA, R), { ok: true, ficha: {}, cambio: true });
});

test('4. si guardar y releer fallan, la pantalla vuelve a lo que está guardado', async () => {
  const sv = servidor({ 8: { estilo: { densidad: 'compacta' } } });
  const p = pantalla(sv, 8);
  sv.caer();
  p.g.cambiar(amplia);
  await p.g.terminar();
  assert.equal(p.errores.length, 1);
  assert.equal(sv.db.get(8)?.estilo?.densidad, 'compacta');
  assert.equal(p.ver().guardada.estilo?.densidad, 'compacta', 'la pantalla dice «amplia» y no se guardó');
});

test('la pantalla usa ESTE motor: el botón Deshacer mira la ficha que se ve, y el hook no tiene otra cola', () => {
  const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hook = leer('app/crm/lead-view/ficha/useFichaDelFunnel.ts');
  assert.match(hook, /g\.current \?\?= crearGuardado\(\{/);
  assert.match(hook, /const puedeDeshacer = !!actual && \(estado\.pasos\[actual\.funnel\.id\] \?\? 0\) > 0;/, 'el botón Deshacer cuenta los pasos de todos los funnels');
  assert.doesNotMatch(hook, /\bcola\b|\bpila\b|aplicarCambio/, 'el hook volvió a tener su propia cola o su propio deshacer');
  const ficha = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  assert.match(ficha, /e\.key\.toLowerCase\(\) === 'z'\) \{ e\.preventDefault\(\); ff\.deshacer\(\); return; \}/, 'Ctrl+Z no pasa por el deshacer del motor');
});
