// =============================================================================
// «Está en el funnel de» con VARIOS funnels en una sola fila (#894, 17/10/2026)
// =============================================================================
// La tarjeta: «Hoy la condición tiene un solo `valor` (lib/condiciones-catalogo.ts:553; lib/flujo-grafo.ts:215). Con
// varios es «A o B» en una sola fila». La fila guarda TODAS en `valores` y repite la primera en `valor` (lo de antes
// sigue valiendo); se leen siempre con `valoresDeFila`. Lo que fija:
//   · el motor: se cumple con cualquiera; negada, con ninguna; una fila de antes (sólo `valor`) decide igual;
//   · el saneo de lo que se guarda las conserva (si no, el primer guardado volvía «A o B» a «A»), y sólo en la de `varios`;
//   · la tarjeta dice «A» o «B» (negada, «A» ni «B»); sin ninguna, «falta elegir»;
//   · «Crear con IA» mira TODAS, no sólo la primera;
//   · el editor usa el selector de funnels de la casa (`ElegirFunnels`), sin «Todos»: acá vacío es «falta elegir».
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-894.json`; base 5 / 0). Pasan / fallan:
//   1. el `evaluar` vuelve a leer sólo `valor` (`num(f)`)                              -> 3 / 2
//   2. `sanearFila` sin las `valores`                                                 -> 4 / 1
//   3. la tarjeta sin las varias (dice sólo la primera)                               -> 4 / 1
//   4. «Crear con IA» mira sólo `valor`                                               -> 4 / 1
//   5. el editor vuelve al selector de UNA (`SelectorDeLista`)                         -> 4 / 1
//   6. `ElegirFunnels` con `sinTodos` igual ofrece «Todos»                             -> 4 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { valoresDeFila, conValores, textoCondicion, problemaDeFila, type NombresCatalogo } from '../lib/condiciones-catalogo';
import { cumpleFila, claseDe, type FilaCondicion, type HechosLead, type PasoGrafo } from '../lib/flujo-grafo';
import { camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { deIA, validarIA, disparadoresParaIA, LISTA_BLANCA_IA, type CtxIA, type PasoIA } from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { porId } from '../lib/api-mako/registro';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

const H = (...funnels: number[]): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.UTC(2026, 9, 17),
  etapasPorProducto: new Map(funnels.map((f) => [f, 'x'])),
});
const F = (o: Partial<FilaCondicion>): FilaCondicion => ({ campo: 'en_producto', ...o });

test('el motor: «A o B» se cumple con cualquiera, negada con ninguna, y la fila de antes decide igual', () => {
  const ayb = F({ valor: '5', valores: ['5', '7'] });
  assert.equal(cumpleFila(ayb, H(7)), true, 'está en el segundo');
  assert.equal(cumpleFila(ayb, H(5, 9)), true);
  assert.equal(cumpleFila(ayb, H(9)), false);
  assert.equal(cumpleFila({ ...ayb, no: true }, H(7)), false, 'negada: «ni A ni B»');
  assert.equal(cumpleFila({ ...ayb, no: true }, H(9)), true);
  // Una de antes, con `valor` solo.
  assert.equal(cumpleFila(F({ valor: '5' }), H(5)), true);
  assert.equal(cumpleFila(F({ valor: '5' }), H(7)), false);
  // Sin dato del lead, no se sabe: no se cumple, ni negada.
  assert.equal(cumpleFila({ ...ayb, no: true }, { ...H(), etapasPorProducto: undefined }), false);
  // Lo que escribe el editor: la primera en `valor`, todas en `valores` sólo con dos o más.
  assert.deepEqual(conValores(F({}), ['5', '7', '5']), F({ valor: '5', valores: ['5', '7'] }));
  assert.deepEqual(conValores(F({ valor: '5', valores: ['5', '7'] }), ['7']), F({ valor: '7' }));
  assert.deepEqual(conValores(F({ valor: '5' }), []), F({ valor: null }));
  assert.deepEqual(valoresDeFila(F({ valor: 5 })), ['5']);
});

test('el saneo de lo que se guarda CONSERVA las varias (si no, el primer guardado volvía «A o B» a «A»)', () => {
  const p = camposDelFlujo({
    id: 'c', nodo: 'condicion', si_no: null,
    ramas: [{ id: 'r', modo: 'todas', siguiente: null, filas: [
      { campo: 'en_producto', valor: '5', valores: ['5', '7', '5', 9, { x: 1 }] },
      { campo: 'origen', valor: 'meta', valores: ['meta', 'organico'] },
    ] }],
  });
  const [funnels, origen] = p.ramas![0].filas;
  assert.deepEqual(funnels.valores, ['5', '7'], 'sin repetidos y sólo textos');
  assert.equal(funnels.valor, '5');
  assert.equal(origen.valores, undefined, 'una de lista sin `varios` lleva una sola');
  assert.equal(cumpleFila(funnels, H(7)), true, 'después de guardar sigue siendo «A o B»');
});

test('la tarjeta dice «A» o «B» (negada, «ni»), y sin ninguna falta elegir', () => {
  const nombres: NombresCatalogo = (cat, v) => (cat === 'producto' ? ({ '5': 'VSL', '7': 'Renovación' } as Record<string, string>)[v] ?? null : null);
  assert.equal(textoCondicion(F({ valor: '5', valores: ['5', '7'] }), nombres), 'Está en el funnel de «VSL» o «Renovación»');
  assert.equal(textoCondicion(F({ valor: '5', valores: ['5', '7'], no: true }), nombres), 'No está en el funnel de «VSL» ni «Renovación»');
  assert.equal(textoCondicion(F({ valor: '5' }), nombres), 'Está en el funnel de «VSL»');
  assert.match(problemaDeFila(F({ valor: null, valores: [] })) ?? '', /falta elegir/);
  assert.equal(problemaDeFila(F({ valor: '5', valores: ['5', '7'] })), null);
});

const ENTREGA = [{ value: 'onboarding', label: 'Onboarding' }];
const PRODUCTOS = [
  { funnelId: 2, productoId: 10, nombre: 'VSL', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: ENTREGA },
  { funnelId: 26, productoId: 39, nombre: 'Renovación', etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: ENTREGA },
];
const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
const ctx: CtxIA = {
  etiquetas: [], productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [], conectados: { instagram: false, messenger: false, email: false, pagos: false } })),
  audios: [], archivos: [], acciones, links: {},
  catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }),
  pedido: 'Si el lead está en el funnel VSL o en Renovación, salúdalo', perfil: 'Una academia.',
};

test('«Crear con IA» mira TODAS las elegidas, no sólo la primera', () => {
  const d = ctx.disparadores.findIndex((x) => x.value === 'venta:26:nuevo');
  assert.ok(d >= 0);
  const r = deIA({ disparador: `d${d + 1}`, inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'condicion', ramas: [{ si: [{ campo: 'agendo' }], sigue: 't2' }], si_no: 't3' },
    { id: 't2', tipo: 'mensaje', texto: 'Hola {{nombre}}' },
    { id: 't3', tipo: 'mensaje', texto: 'Hola' },
  ] }, ctx, () => 0.5);
  const con = (fila: FilaCondicion) => r.pasos.map((p) => (claseDe(p) === 'condicion' ? { ...p, ramas: p.ramas!.map((x) => ({ ...x, filas: [fila] })) } : p)) as PasoGrafo[] as PasoIA[];
  assert.deepEqual(validarIA(con(F({ valor: '2', valores: ['2', '26'] })), ctx, undefined, r.disparador), []);
  assert.ok(validarIA(con(F({ valor: '2', valores: ['2', '99'] })), ctx, undefined, r.disparador).some((e) => e.includes('«en_producto» usa una opción que no existe')),
    'la segunda no existe');
});

test('el editor elige los funnels con el selector de la casa, sin «Todos» (acá vacío es «falta elegir»)', () => {
  const ed = leer('app/automations/EditorCondicion.tsx');
  const i = ed.indexOf("if (v.t === 'lista' && v.varios && v.catalogo === 'producto') {");
  assert.ok(i > 0, 'sin la rama de varios');
  const rama = ed.slice(i, ed.indexOf("  if (v.t === 'lista') {", i));
  assert.match(rama, /<ElegirFunnels [^\n]* sinTodos /);
  assert.match(rama, /onCambiar=\{\(ids\) => onCambiar\(conValores\(fila, ids\.map\(String\)\), true\)\}/);
  const ef = leer('app/components/ElegirFunnels.tsx');
  assert.match(ef, /\.\.\.\(sinTodos \? \[\] : \[\{ value: '', label: todos \}\]\),/, 'con `sinTodos` no hay renglón «Todos»');
  assert.match(ef, /const varios = valor\.length \? valor\.map\(String\) : sinTodos \? \[\] : \[''\];/);
});
