// =============================================================================
// El catálogo de bloques de la ficha es el del DOCUMENTO, ni uno más ni uno menos
// =============================================================================
// lib/ficha/catalogo.ts copia las tablas de la §3 de docs/diseno-ficha-bloques.md (lo decidió Martín el
// 14/10/2026: «Si, avanza con todo y pushea»). Dos listas que nadie ata se separan: este test LEE las
// tablas del .md y compara, bloque por bloque, el id, la tab principal, el «también en», los anchos y
// cuántos diseños tiene, y que «Avisa si falta» tenga datos donde el documento dice que avisa.
//
// Correr: npx tsx --test tests/ficha-catalogo.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 6/0), cada rotura restaurada antes de la siguiente:
//   · `cliente-en-cs` con otro id (no está el del documento)              → 4 / 2
//   · `origen` sin «también en» Tracking                                   → 5 / 1
//   · `cohorte` con anchos [3, 4]                                          → 5 / 1
//   · `contacto` con un diseño de menos                                    → 5 / 1
//   · `venta` sin `avisa: ['monto']`                                       → 5 / 1
//   · el ícono de `notas` en 'nota-inventada' (no es del set)              → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOQUES, bloqueDef, bloquesDeLaTab, vaEnTab, TABS_FICHA, type Ancho, type TabBloque } from '../lib/ficha/catalogo';
import { DATOS_AVISABLES } from '../lib/datos-aviso';
import { NOMBRES_ICONO_MENU } from '../app/_ui/iconos-menu';

const doc = readFileSync(new URL('../docs/diseno-ficha-bloques.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

type FilaDoc = { id: string; tab: TabBloque; tambien: TabBloque[]; anchos: Ancho[]; disenos: number; avisa: boolean };

const TAB_DE_SECCION: Record<string, TabBloque> = {
  Resumen: 'resumen', Reuniones: 'reuniones', Tracking: 'tracking', Pagos: 'pagos', 'Customer Success': 'cs-resumen',
};
const TAB_DE_TEXTO: Record<string, TabBloque[]> = {
  Resumen: ['resumen'], Reuniones: ['reuniones'], Tracking: ['tracking'], Pagos: ['pagos'],
  'CS · Resumen': ['cs-resumen'], 'CS · Pagos': ['cs-pagos'], CS: ['cs-resumen', 'cs-pagos'],
};
const ANCHO_DE: Record<string, Ancho> = { '¼': 3, '⅓': 4, '½': 6, completo: 12 };

/** Las filas de las tablas de la §3, con la tab de su sección. */
function filasDelDocumento(): FilaDoc[] {
  const ini = doc.indexOf('## 3. Catálogo de bloques');
  const fin = doc.indexOf('## 4. Plantillas');
  assert.ok(ini > 0 && fin > ini, 'no encontré la §3 del documento');
  const filas: FilaDoc[] = [];
  let tab: TabBloque | null = null;
  for (const linea of doc.slice(ini, fin).split('\n')) {
    const sec = /^### (.+)$/.exec(linea);
    if (sec) { tab = TAB_DE_SECCION[sec[1].trim()] ?? null; continue; }
    if (!linea.startsWith('| `') || !tab) continue;
    const celdas = linea.split('|').map((c) => c.trim());
    const id = /`([a-z0-9-]+)`/.exec(celdas[1])![1];
    const tambienTxt = /también en (.+)$/.exec(celdas[1])?.[1] ?? '';
    const tambien = tambienTxt ? tambienTxt.split(' y ').flatMap((t) => { const x = TAB_DE_TEXTO[t.trim()]; assert.ok(x, `«también en ${t}» no lo entiendo`); return x; }) : [];
    const anchos = celdas[4].split(' · ').map((a) => { const x = ANCHO_DE[a.trim()]; assert.ok(x, `ancho «${a}» de ${id}`); return x; });
    // Los ejemplos entre comillas con un «·» adentro («3 visitas · Monterrey, MX») no son otro diseño, y la
    // botonera de `contacto` nombra sus tres botones con «·».
    const disenosTxt = celdas[5].replace(/«[^»]*·[^»]*»/g, '').replace(' Llamar · WhatsApp · Email', '');
    const avisaTxt = celdas[6];
    filas.push({ id, tab, tambien, anchos, disenos: disenosTxt.split(' · ').length, avisa: !/^(—|No\b)/.test(avisaTxt) });
  }
  return filas;
}

const FILAS = filasDelDocumento();

test('el catálogo tiene EXACTAMENTE los bloques del documento, en su orden', () => {
  assert.equal(FILAS.length, 56, `el documento cambió: ahora tiene ${FILAS.length} bloques`);
  assert.deepEqual(BLOQUES.map((b) => b.id), FILAS.map((f) => f.id));
});

test('cada bloque en su tab, con su «también en», sus anchos y sus diseños', () => {
  for (const f of FILAS) {
    const b = bloqueDef(f.id)!;
    assert.equal(b.tab, f.tab, `${f.id}: tab principal`);
    assert.deepEqual([...b.tambienEn].sort(), [...f.tambien].sort(), `${f.id}: también en`);
    assert.deepEqual([...b.anchos], f.anchos, `${f.id}: anchos`);
    assert.ok(b.anchos.includes(b.ancho), `${f.id}: entra con un ancho que no acepta`);
    assert.equal(b.disenos.length, f.disenos, `${f.id}: diseños`);
    assert.equal(new Set(b.disenos.map((d) => d.id)).size, b.disenos.length, `${f.id}: diseños repetidos`);
    assert.equal(b.avisa.length > 0, f.avisa, `${f.id}: «Avisa si falta»`);
  }
});

test('lo que avisa es un dato sin marcar de verdad, y cada dato tiene dónde completarse', () => {
  const avisables = new Set<string>(DATOS_AVISABLES.map((d) => d.id));
  for (const b of BLOQUES) for (const paso of b.avisa) assert.ok(avisables.has(paso), `${b.id}: «${paso}» no es un dato que avise (lib/datos-aviso.ts)`);
  for (const d of DATOS_AVISABLES) assert.ok(BLOQUES.some((b) => b.avisa.includes(d.id)), `«${d.label}» no se completa en ningún bloque`);
});

test('los íconos son del set de la casa, y sólo contacto no se quita', () => {
  const set = new Set<string>(NOMBRES_ICONO_MENU);
  for (const b of BLOQUES) assert.ok(set.has(b.icono), `${b.id}: el ícono «${b.icono}» no es de app/_ui/iconos-menu.tsx`);
  assert.deepEqual(BLOQUES.filter((b) => !b.quitable).map((b) => b.id), ['contacto']);
  assert.deepEqual(BLOQUES.filter((b) => b.varias).map((b) => b.id), ['respuesta-destacada'], '«Se pueden poner varias» sólo la respuesta destacada');
  assert.deepEqual(BLOQUES.filter((b) => b.privado).map((b) => b.id), ['coaching-de-la-llamada'], 'decisión 5');
});

test('el menú de cada tab: primero los suyos, después los de «también en»', () => {
  for (const tab of TABS_FICHA) {
    const l = bloquesDeLaTab(tab);
    assert.ok(l.every((b) => vaEnTab(b, tab)));
    const primerAjeno = l.findIndex((b) => b.tab !== tab);
    if (primerAjeno >= 0) assert.ok(l.slice(primerAjeno).every((b) => b.tab !== tab), `${tab}: los de «también en» van al final`);
  }
  assert.ok(bloquesDeLaTab('pagos').some((b) => b.id === 'ingreso-estimado'));
  assert.ok(!bloquesDeLaTab('tracking').some((b) => b.id === 'cuotas'));
});

test('los títulos son cortos (el texto que se dibuja es corto)', () => {
  for (const b of BLOQUES) {
    assert.ok(b.titulo.length <= 28, `${b.id}: «${b.titulo}»`);
    for (const d of b.disenos) assert.ok(d.nombre.length <= 26, `${b.id}: diseño «${d.nombre}»`);
  }
});
