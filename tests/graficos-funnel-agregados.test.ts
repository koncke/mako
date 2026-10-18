// =============================================================================
// Una hoja filtrada por un funnel de AGREGADOS no sale vacía, y el filtro se llama «Funnel» (17/10/2026)
// =============================================================================
// docs/hallazgos-graficos.md → «Lo que quedó sin hacer»: «El filtro "Producto" de los LEADS mira sólo la casa: una hoja
// filtrada por un funnel de agregados ("Renovación") no muestra a sus leads. Contar a un lead en sus dos funnels duplica
// los totales: sin decidir». En el ws1, «Renovación» tiene SÓLO leads agregados: por la casa, su hoja era siempre cero.
//
// LA DECISIÓN (tomada con criterio, sin Martín): el lead lleva dónde MÁS está (`m.producto`) y eso lo mira SÓLO el filtro.
// Filtrar por «Renovación» trae a los que están ahí; agrupar por funnel cuenta a cada lead UNA vez, en su casa. Así ningún
// total se duplica y ninguna hoja filtrada queda vacía. (Los pagos ya iban por el funnel del día: `filasPagos`.)
// Y la dimensión se llama «Funnel», como decidió Martín el 11/10 («Producto» se llama «Funnel»): no había llegado a los gráficos.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `filtrarFilas` mirando sólo `fl.d` (sin `m`) ........................................... 1 fallo
//   2. `filasLeads` sin `funnelsAgregados` ..................................................... 1 fallo
//   3. el campo compartido otra vez «Producto» ................................................. 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filtrarFilas, agregar, type Fila } from '../lib/graficos-agregar';
import { campoDe, fuenteDe, type Grafico } from '../lib/graficos-catalogo';

const lead = (id: number, casa: string, tambien: string[] = []): Fila => ({
  f: '2026-10-10', d: { producto: casa, etapa: 'Nuevo' }, v: { leads: 1 }, r: { lead: String(id) },
  ...(tambien.length ? { m: { producto: tambien } } : {}),
});

test('filtrar por un funnel de agregados trae a los que están ahí, aunque su casa sea otra', () => {
  const filas = [lead(1, 'Ventas', ['Renovación']), lead(2, 'Ventas'), lead(3, 'Mentoría', ['Renovación'])];
  const renov = filtrarFilas(filas, [{ dimension: 'producto', valores: ['Renovación'] }]);
  assert.deepEqual(renov.map((f) => f.r?.lead), ['1', '3'], 'antes: cero (Renovación no es la casa de nadie)');
  // Por la casa, igual que siempre.
  assert.deepEqual(filtrarFilas(filas, [{ dimension: 'producto', valores: ['Ventas'] }]).map((f) => f.r?.lead), ['1', '2']);
  // La búsqueda de texto también lo encuentra.
  assert.deepEqual(filtrarFilas(filas, [{ dimension: 'producto', texto: 'renov' }]).map((f) => f.r?.lead), ['1', '3']);
});

test('agrupar por funnel cuenta a cada lead UNA vez, en su casa: los totales no se duplican', () => {
  const filas = [lead(1, 'Ventas', ['Renovación']), lead(2, 'Ventas'), lead(3, 'Mentoría', ['Renovación'])];
  const g: Grafico = { id: 'g', clase: 'grafico', tipo: 'barras', fuente: 'leads', metricas: ['leads'], dimension: 'producto', fecha: 'creacion', periodo: 'todo', x: 0, y: 0, w: 6, h: 6 } as unknown as Grafico;
  const r = agregar(g, filas, '2026-01-01', '2026-12-31');
  assert.equal(r.totales[0], 3, 'tres leads, no cinco');
  assert.deepEqual(Object.fromEntries(r.filas.map((f) => [f.clave, f.valores[0]])), { Ventas: 2, 'Mentoría': 1 });
});

test('los leads del CRM llevan sus funnels agregados (lead_funnel) en la fila', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8');
  const cuerpo = src.slice(src.indexOf('async function filasLeads'), src.indexOf('async function filasCambios'));
  assert.match(cuerpo, /funnelsAgregados\(/, 'filasLeads dejó de leer los funnels agregados');
  assert.match(cuerpo, /m: \{ producto: tambien \}/);
});

test('la dimensión y el filtro se llaman «Funnel» (el id sigue siendo `producto`: lo guardado no cambia)', () => {
  assert.equal(campoDe('producto')?.nombre, 'Funnel');
  for (const f of ['leads', 'pagos', 'entrega', 'cartera']) {
    const d = fuenteDe(f)?.dimensiones.find((x) => x.id === 'producto');
    assert.equal(d?.nombre, 'Funnel', `en ${f}`);
  }
});

// REVISIÓN DE B5 (17/10/2026), MEDIA (plata): un lead que entra a la hoja de «Renovación» SÓLO por estar agregado traía su
// venta y lo cobrado de la casa (el VSL), y además entraba con las altas y agendas de antes de que se lo agregara. El monto
// cuenta en el funnel donde se vendió (como los pagos y los OKR): por un funnel agregado, en 0 (`Fila.soloCasa`), y el lead
// cuenta ahí sólo desde el día en que se lo agregó.
// PROBADO ROMPIÉNDOLO: `filtrarFilas` sin `soloCasa` → 1 fallo; `filasLeads` sin mirar `desde` → 1 fallo.
test('por un funnel agregado, el lead cuenta pero su venta y lo cobrado NO (son de su casa)', () => {
  const venta: Fila = {
    f: '2026-10-15', d: { producto: 'Negocio que ESCALA' }, v: { leads: 1, cierres: 1, vendido: 3000, cobrado: 1500 },
    r: { lead: '7' }, m: { producto: ['Renovación'] }, soloCasa: ['cierres', 'vendido', 'cobrado'],
  };
  const [porAgregado] = filtrarFilas([venta], [{ dimension: 'producto', valores: ['Renovación'] }]);
  assert.deepEqual(porAgregado.v, { leads: 1, cierres: 0, vendido: 0, cobrado: 0 }, 'se sumó la venta de otro funnel');
  const [porCasa] = filtrarFilas([venta], [{ dimension: 'producto', valores: ['Negocio que ESCALA'] }]);
  assert.deepEqual(porCasa.v, venta.v, 'en su casa la venta cuenta entera');
  assert.equal(filtrarFilas([venta], []).at(0), venta, 'sin filtro, la fila de siempre');
  const src = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8');
  assert.match(src, /a\.desde <= fila/, 'filasLeads cuenta al lead en el funnel agregado aunque se lo agregara después');
});
