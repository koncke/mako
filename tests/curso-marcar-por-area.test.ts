// =============================================================================
// scripts/curso-marcar-por-area.mjs — su función pura, EJECUTADA contra la semilla de este árbol
// =============================================================================
// El script marca `por_area` en las clases de m6-m9 ya cargadas en el ws1 (#665): el cargador
// saltea las clases que ya existen, así que cambiar la semilla no cambia lo cargado. Lo que decide
// qué marcar es `planPorArea`, y acá se corre sobre lo que quedó CARGADO el 06/10 (todas en false).
//
// El import es DINÁMICO y va después de poner MARCAR_POR_AREA_SOLO_IMPORTAR=1: esa variable es lo
// único que impide que el script corra `main()` (que lee .env.local y abre la base de PRODUCCIÓN).
//
// PROBADO ROMPIÉNDOLO: los números, al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programaNqe } from '../lib/curso-programa-nqe';

process.env.MARCAR_POR_AREA_SOLO_IMPORTAR = '1';

type Fila = { id: number; origen: string | null; titulo: string; por_area: boolean };
type Plan = { marcar: Fila[]; ya: Fila[]; faltan: string[]; ajenas: Fila[]; rechazos: string[] };
type Script = { planPorArea: (filas: Fila[], origenes: string[]) => Plan };
const cargar = async () => (await import('../scripts/curso-marcar-por-area.mjs')) as unknown as Script;

const P = programaNqe();
const ORIGENES = P.filter((c) => c.por_area).map((c) => c.origen);
/** Lo cargado el 06/10: las 107 clases de la semilla, con ids, y ninguna por área. */
const cargado = (): Fila[] => P.map((c, i) => ({ id: 1000 + i, origen: c.origen, titulo: c.titulo, por_area: false }));

test('sobre lo cargado el 06/10 marca EXACTAMENTE los 13 de la semilla, por origen', async () => {
  const { planPorArea } = await cargar();
  const plan = planPorArea(cargado(), ORIGENES);
  assert.equal(ORIGENES.length, 13);
  assert.deepEqual(plan.marcar.map((f) => f.origen).sort(), [...ORIGENES].sort());
  assert.deepEqual([plan.ya, plan.faltan, plan.ajenas, plan.rechazos], [[], [], [], []]);
});

test('correrlo dos veces no hace nada: lo ya marcado se saltea', async () => {
  const { planPorArea } = await cargar();
  const yaMarcado = cargado().map((f) => (ORIGENES.includes(f.origen!) ? { ...f, por_area: true } : f));
  const plan = planPorArea(yaMarcado, ORIGENES);
  assert.equal(plan.marcar.length, 0);
  assert.equal(plan.ya.length, 13);
});

test('una clase borrada se dice y no frena; una marcada a mano no se toca; un origen repetido frena', async () => {
  const { planPorArea } = await cargar();
  const sinUna = cargado().filter((f) => f.origen !== 'catalogo:m8c1');
  const p1 = planPorArea(sinUna, ORIGENES);
  assert.deepEqual(p1.faltan, ['catalogo:m8c1']);
  assert.equal(p1.marcar.length, 12);
  const aMano = cargado().map((f) => (f.origen === 'planilla:6.1' ? { ...f, por_area: true } : f));
  const p2 = planPorArea(aMano, ORIGENES);
  assert.deepEqual(p2.ajenas.map((f) => f.origen), ['planilla:6.1']);
  assert.ok(!p2.marcar.some((f) => f.origen === 'planilla:6.1'));
  const repetida = [...cargado(), { id: 1, origen: 'catalogo:m6c1', titulo: 'copia', por_area: false }];
  assert.equal(planPorArea(repetida, ORIGENES).rechazos.length, 1);
});

// ── Probado ROMPIÉNDOLO (07/10/2026) ──────────────────────────────────────────
// Arnés que rompe una cosa por vez en el script y restaura de MEMORIA. Restaurado: 3 / 0.
//   · re-marca lo ya marcado (sin la salida «ya»)            → 2 / 1 «correrlo dos veces…»
//   · no frena un origen repetido                            → 2 / 1 «una clase borrada…»
//   · toca (no reporta) las marcadas a mano                  → 2 / 1 «una clase borrada…»
