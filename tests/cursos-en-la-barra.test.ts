// =============================================================================
// «No encuentro la sección de curso» (25/10/2026, la llamada con Leandro, f31)
// =============================================================================
// Leandro buscó el curso en Web Generator y en Offer antes de dar con Clients: «Yo pensé que Clients era algo más CRM».
// Classroom y Community son sub-tabs de Clients sin fila propia (nav.ts → SIN_FILA), y la barra no se las pasaba al
// buscador: «curso» y «comunidad» tenían alias, pero apuntaban a keys que no estaban en la lista y no encontraban nada.
// Esto fija:
//   1. la fila Clients dice lo que hay adentro («Clientes, cursos y comunidad») y nombra sus pantallas de adentro;
//   2. el buscador, con la lista armada como la arma la barra, lleva «curso», «cursos», «clases» y «comunidad» ahí;
//   3. la barra pinta la línea de abajo y le pasa al buscador lo de adentro de cada tab.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 3/0): la barra sin `t.adentro` en el buscador → 1 rojo (3); el buscador sin leer
// la `bajada` → 1 rojo (2); la fila sin `adentro` → 2 rojos (1 y 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, SIN_FILA, type NavItem } from '../app/_components/nav';
import { buscarDestinos, type Destino } from '../lib/buscador-nav';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const clients = FAMILIAS.flatMap((f) => f.bloques.flat()).find((t) => t.key === 'customer-success');

test('1. la fila Classroom (era Clients, 25/10/2026) dice que adentro están el curso, la comunidad y los clientes', () => {
  assert.ok(clients, 'falta la fila Clients');
  assert.match(clients.bajada ?? '', /curso/i);
  assert.match(clients.bajada ?? '', /clientes/i);
  assert.match(clients.bajada ?? '', /comunidad/i);
  assert.deepEqual(clients.adentro, ['cs-curso', 'cs-comunidad']);
  for (const k of clients.adentro ?? []) assert.ok(SIN_FILA.some((x) => x.key === k), `«${k}» no está en SIN_FILA`);
});

test('2. el buscador lleva «curso», «cursos», «clases» y «comunidad» a Classroom y Community, dentro de la tab Classroom', () => {
  // La lista como la arma la barra (Sidebar.tsx → BuscadorNav): cada tab, sus secciones y lo de adentro.
  const destinos: Destino[] = FAMILIAS.flatMap((f) => f.bloques.flat()).flatMap((t) => [
    { item: t, donde: null },
    ...(t.secciones ?? []).map((s) => ({ item: s, donde: t.label })),
    ...(t.adentro ?? []).map((k) => SIN_FILA.find((x) => x.key === k)).filter((x): x is NavItem => !!x).map((item) => ({ item, donde: t.label })),
  ]);
  for (const [q, key] of [['curso', 'cs-curso'], ['cursos', 'cs-curso'], ['Clases', 'cs-curso'], ['comunidad', 'cs-comunidad']] as const) {
    const r = buscarDestinos(q, destinos);
    assert.equal(r[0]?.item.key, key, `«${q}» no lleva a ${key}`);
    assert.equal(r[0]?.donde, 'Classroom', `«${q}»: falta «Classroom» al lado`);
  }
  // «classroom» encuentra primero la TAB, que desde el 25/10/2026 se llama así; abre el curso, igual que su sub-tab.
  const classroom = buscarDestinos('classroom', destinos);
  assert.equal(classroom[0]?.item.key, 'customer-success');
  assert.equal(classroom[0]?.item.href, '/classroom', '«classroom» no abre el curso');
  // La tab y su curso son desde el 25/10/2026 el MISMO lugar (/classroom): el buscador lo muestra una vez, no dos.
  assert.equal(buscarDestinos('curso', destinos).filter((d) => d.item.href === '/classroom').length, 1, '«curso»: el curso, una sola vez');
});

test('3. la barra pinta la línea de abajo y le pasa al buscador lo de adentro de cada tab', () => {
  const sb = leer('app/_components/Sidebar.tsx');
  assert.match(sb, /<span className="mk-navrow__bajada">\{item\.bajada\}<\/span>/);
  assert.match(sb, /\.\.\.\(t\.adentro \?\? \[\]\)\.map\(\(k\) => SIN_FILA\.find\(\(x\) => x\.key === k\)\)\.filter\(\(x\): x is NavItem => !!x && puedeVer\(x\)\)/);
  assert.match(leer('app/_ui/ui.css'), /\.mk-navrow__bajada \{/);
});
