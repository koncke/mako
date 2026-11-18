// =============================================================================
// Guardar MIRANDO: el server deja pasar lo de las hojas y no el contenido (18/11/2026)
// =============================================================================
// Pendiente O10 (2) de docs/pendientes-verificados-17-11.md: el «guardar» de /api/graficos no miraba si el tablero estaba
// en modo vista (el 11/10 la grilla escribió un informe que sólo se miraba; el 16/10, MaKo cambiaba la hoja mirada). Desde
// hoy, con `editando: false`, `guardarTableroSi` compara contra lo guardado con `escrituraMirando`
// (lib/graficos-guardar-mirando.ts). El test EJECUTA esa regla con hojas reales de la galería, saneadas como las sanea el
// server, y la de la pantalla que decide cuándo los guardados vuelven a decir «mirando» (`edicionYaGuardada`).
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez y vuelta atrás:
//   1. `escrituraMirando` sin comparar nada (siempre null) ............................ 1 fallo (lo que se bloquea)
//   2. `CAMBIA_MIRANDO` sin 'controles' (sumar un filtro mirando) ..................... 1 fallo
//   3. sin la excepción de la hoja vacía de un informe en blanco ...................... 1 fallo
//   4. `edicionYaGuardada` sin mirar la gracia ........................................ 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escrituraMirando, NO_SE_CAMBIA_MIRANDO } from '../lib/graficos-guardar-mirando';
import { hojaVacia, nuevoControlVista, sanearTablero, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import { instanciarPlantilla, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { edicionYaGuardada, GRACIA_EDICION_MS } from '../app/dashboard/guardado';

/** Como lo lee y lo escribe el server: saneado, y de vuelta por JSON. */
const comoGuardado = (t: Tablero): Tablero => sanearTablero(JSON.parse(JSON.stringify(sanearTablero(t))))!;
const plantilla = (i: number): Hoja => instanciarPlantilla(PLANTILLAS_HOJA[i % PLANTILLAS_HOJA.length]);
const guardado = (): Tablero => comoGuardado({ v: 3, nombre: 'Dashboard', hojas: [plantilla(0), plantilla(1)], archivadas: [plantilla(2)] });
/** Lo que llega: lo guardado, con un cambio. */
const con = (t: Tablero, fn: (t: Tablero) => Tablero): Tablero => comoGuardado(fn(structuredClone(t)));

test('el saneo es idempotente con todas las plantillas: una hoja que nadie tocó llega igual', () => {
  for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
    const t = comoGuardado({ v: 3, nombre: 'X', hojas: [instanciarPlantilla(p)] });
    assert.equal(escrituraMirando(t, comoGuardado(t)), null, `la plantilla ${p.id} cambia al volver a sanearla`);
  }
});

test('mirando pasan las cosas de las hojas', () => {
  const g = guardado();
  const [a, b] = g.hojas;
  const casos: Array<[string, Tablero]> = [
    ['crear una hoja', con(g, (t) => ({ ...t, hojas: [...t.hojas, plantilla(3)] }))],
    ['archivar una hoja', con(g, (t) => ({ ...t, hojas: [t.hojas[1]], archivadas: [t.hojas[0], ...(t.archivadas ?? [])] }))],
    ['restaurar una archivada', con(g, (t) => ({ ...t, hojas: [...t.hojas, ...(t.archivadas ?? [])], archivadas: [] }))],
    ['borrar de Archivados', con(g, (t) => ({ ...t, archivadas: [] }))],
    ['cambiarlas de orden', con(g, (t) => ({ ...t, hojas: [t.hojas[1], t.hojas[0]] }))],
    ['la cabecera', con(g, (t) => ({ ...t, hojas: t.hojas.map((h) => (h.id === a.id ? { ...h, nombre: 'Otro', emoji: '🔥', subtitulo: 'Un subtítulo' } : h)) }))],
    ['sumar un filtro', con(g, (t) => ({ ...t, hojas: t.hojas.map((h) => (h.id === b.id ? { ...h, controles: [...h.controles, nuevoControlVista('lista', 'producto')!] } : h)) }))],
  ];
  for (const [que, llega] of casos) assert.equal(escrituraMirando(g, llega), null, que);
  // Un informe EN BLANCO: la hoja vacía que viaja por dentro se reemplaza por la primera que se crea.
  const enBlanco = comoGuardado({ v: 3, nombre: 'Dashboard', hojas: [hojaVacia('Página 1')], enBlanco: true });
  assert.equal(escrituraMirando(enBlanco, comoGuardado({ v: 3, nombre: 'Dashboard', hojas: [plantilla(4)] })), null, 'crear la primera de un informe en blanco');
});

test('mirando NO pasa un cambio del contenido de una hoja que ya estaba', () => {
  const g = guardado();
  const [a] = g.hojas;
  const enA = (fn: (h: Hoja) => Hoja) => con(g, (t) => ({ ...t, hojas: t.hojas.map((h) => (h.id === a.id ? fn(h) : h)) }));
  const casos: Array<[string, Tablero]> = [
    // El 11/10/2026: la grilla compactó lo que vino al montar.
    ['mover un componente', enA((h) => ({ ...h, componentes: h.componentes.map((c, i) => (i === 0 ? { ...c, y: c.y + 7 } : c)) }))],
    // El 16/10/2026: MaKo cambiaba la hoja mirada.
    ['quitar un componente', enA((h) => ({ ...h, componentes: h.componentes.slice(1) }))],
    ['cambiar el tema', enA((h) => ({ ...h, tema: { ...h.tema, acento: '#ff0066' } }))],
    ['quitar un filtro que tenía', enA((h) => ({ ...h, controles: h.controles.slice(1) }))],
    ['cambiar un componente de una archivada', con(g, (t) => ({ ...t, archivadas: (t.archivadas ?? []).map((h) => ({ ...h, componentes: h.componentes.slice(1) })) }))],
    ['sacar una hoja sin archivarla', con(g, (t) => ({ ...t, hojas: [t.hojas[1]] }))],
  ];
  assert.ok(a.componentes.length > 1 && a.controles.length > 0, 'la plantilla de prueba tiene qué tocar');
  for (const [que, llega] of casos) assert.equal(escrituraMirando(g, llega), NO_SE_CAMBIA_MIRANDO, que);
});

test('lo cambiado editando sigue yendo como edición hasta quedar guardado (la pantalla)', () => {
  const base = { editando: false, salioHaceMs: GRACIA_EDICION_MS + 1, pendiente: false, confirmado: 'B', actual: 'B' };
  assert.equal(edicionYaGuardada(base), true, 'fuera de la edición, pasada la gracia y todo guardado');
  assert.equal(edicionYaGuardada({ ...base, editando: true }), false, 'editando');
  // Un texto escrito en el lugar se guarda AL SALIR (app/dashboard/Elemento.tsx): un instante después de tocar «Ver».
  assert.equal(edicionYaGuardada({ ...base, salioHaceMs: 300 }), false, 'recién salió de editar');
  assert.equal(edicionYaGuardada({ ...base, pendiente: true }), false, 'algo en la cola');
  assert.equal(edicionYaGuardada({ ...base, actual: 'C' }), false, 'lo de la pantalla no es lo guardado (un guardado que falló)');
});
