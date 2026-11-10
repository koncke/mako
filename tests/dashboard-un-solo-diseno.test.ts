// UNA hoja ofrecida es la copia de UN demo: no mezcla tarjetas de varios diseños (10/11/2026).
// Martín, al ver «Velocidad de llamada» (la hoja de los clientes de Código Inmobiliario): «se inventó cosas en lugar de copiar los
// templates que ya estábamos copiando… comparado con los otros dashboards es el más feo de todos… Y que quede como los otros que
// tenemos». La de antes juntaba tarjetas de TRES diseños (Cold Calling, Closing y la tabla de Marketing) y nada lo frenaba: cada
// tarjeta, sola, era una copia; juntas eran una pantalla inventada. Se rehízo como la copia de Tend («Today»), y esto la sostiene:
//   · cada plantilla que se ofrece (las de «Nueva hoja» del Dashboard, las de General y la hoja inicial de una agencia) tiene, a lo
//     sumo, UN diseño: el de la hoja (`Hoja.diseno`) y el de cada bloque (`tipo: 'diseno'`) son el mismo;
//   · y lo mismo en el armado crudo de la plantilla (antes de la migración a bloques), que es donde la de antes metía sus tarjetas.
// Correr: npx tsx --test tests/dashboard-un-solo-diseno.test.ts
//
// ── Probado rompiéndolo (10/11/2026, con copia del archivo y restaurado por hash, nunca con git). Base 3 / 0:
//   · lib/graficos-plantillas.ts con la VELOCIDAD_LLAMADA de antes (la de las tarjetas de tres diseños, la del commit 4e226028)
//                                                                        -> 0 / 3  («el armado junta closing, cold-calling, marketing»)
//   · un bloque de `cold-calling` sumado al armado de la plantilla nueva  -> 0 / 3  («el armado junta cold-calling, velocidad»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esElemento, type Hoja } from '../lib/graficos-catalogo';
import { PLANTILLAS_OFRECIDAS, instanciarPlantilla, tableroInicialDe, HOJA_DE_AGENCIA, type PlantillaHoja } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';

/** Los diseños de una hoja: el suyo y el de cada bloque. */
function disenosDe(h: Pick<Hoja, 'diseno' | 'componentes'>): string[] {
  const ids = new Set<string>();
  if (h.diseno?.id) ids.add(h.diseno.id);
  for (const c of h.componentes) if (esElemento(c) && c.tipo === 'diseno' && c.diseno?.id) ids.add(c.diseno.id);
  return [...ids].sort();
}

/** Lo mismo sobre el armado CRUDO de la plantilla (antes de pasar por el saneo y la migración a bloques). */
function disenosDelArmado(p: PlantillaHoja): string[] {
  const crudo = p.armar((local) => local) as { diseno?: { id?: unknown }; componentes?: Array<{ tipo?: unknown; diseno?: { id?: unknown } }> };
  const ids = new Set<string>();
  if (typeof crudo.diseno?.id === 'string') ids.add(crudo.diseno.id);
  for (const c of crudo.componentes ?? []) if (c.tipo === 'diseno' && typeof c.diseno?.id === 'string') ids.add(c.diseno.id);
  return [...ids].sort();
}

test('ninguna plantilla ofrecida mezcla diseños: la hoja y cada bloque son del mismo', () => {
  const todas = [...PLANTILLAS_OFRECIDAS, ...PLANTILLAS_GENERAL];
  assert.ok(todas.length >= 20, `son ${todas.length}: si son menos, se leyó otra lista`);
  let conDiseno = 0;
  for (const p of todas) {
    const armado = disenosDelArmado(p);
    assert.ok(armado.length <= 1, `${p.id}: el armado junta ${armado.join(', ')}`);
    const h = instanciarPlantilla(p);
    const ds = disenosDe(h);
    assert.ok(ds.length <= 1, `${p.id}: la hoja junta tarjetas de ${ds.join(', ')}`);
    if (ds.length) conDiseno++;
  }
  // El denominador: si ninguna tuviera diseño, la guarda no miró nada.
  assert.ok(conDiseno >= 20, `sólo ${conDiseno} con diseño`);
});

test('la hoja inicial de una agencia (lo que ve primero cada cliente de Código) también es de un solo diseño', () => {
  const agencias = Object.keys(HOJA_DE_AGENCIA).map(Number);
  assert.ok(agencias.length > 0, 'hay al menos una agencia con hoja propia');
  for (const ws of agencias) {
    const hojas = tableroInicialDe([ws]).hojas;
    for (const h of hojas) assert.ok(disenosDe(h).length <= 1, `agencia ${ws}, ${h.plantilla}: junta ${disenosDe(h).join(', ')}`);
  }
});

test('«Velocidad de llamada» es la copia de Tend, y nada más', () => {
  const p = PLANTILLAS_OFRECIDAS.find((x) => x.id === 'velocidad-llamada');
  assert.ok(p, 'se ofrece');
  assert.deepEqual(disenosDe(instanciarPlantilla(p)), ['velocidad']);
  assert.deepEqual(disenosDelArmado(p), ['velocidad']);
});
