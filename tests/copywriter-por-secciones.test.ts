// =============================================================================
// Una pieza LARGA del Copywriter se escribe por secciones, cada una con su largo (18/11/2026)
// =============================================================================
// El hueco medido el 18/11 (docs/hallazgos-copywriter.md): «Editar» escribe en UN pedido, y en un pedido entran 2.000 palabras
// (~13 minutos). La «Clase gratuita · 42 min» pide 6.300: salía con 2.000 como mucho y nada lo decía arriba de 1.200.
// lib/copywriter/por-secciones.ts arma el presupuesto de cada sección con la guía de su estructura (lib/vsl-estructuras.ts) y
// alarga las cortas del borrador de a tandas que entran en un pedido. Esto EJECUTA ese armado con un modelo de mentira:
//   1. el presupuesto sale de la guía y suma el largo de la pieza, en las cinco VSL y escalado a la página;
//   2. cada tanda entra en un pedido, en orden, sin partir una sección y sin perder ninguna;
//   3. con un modelo que contesta lo pedido, la pieza queda con su largo: una llamada por tanda, cada sección en su lugar;
//   4. lo que la primera pasada no escribió no se toca, y lo que vuelve más corto o de otra sección no entra;
//   5. sin tiempo, o sin MaKo Tokens, corta en esa tanda y el aviso nombra lo que falta (con el texto del medidor);
//   6. una pieza que entra en un pedido no es larga, y el aviso mide contra el largo REAL;
//   7. la fila de costos dice cuántas llamadas son, con el número que da esta misma cuenta;
//   8. el cableado: «Editar» de la pantalla lo prende y la segunda pasada vieja no corre sobre esa pieza.
//
// Probado rompiéndolo (base 8/0):
//   · `tandasDeSecciones` sin el corte por el tope (todas en una tanda)           → 5/3 (caen el 2, el 5 y el 7);
//   · `escribirPorSecciones` sin el filtro de lo que escribió el borrador         → 7/1 (cae el 4);
//   · `reemplazarSecciones` aceptando una sección más corta                       → 7/1 (cae el 4);
//   · sin el `break` del saldo (sigue pidiendo)                                   → 7/1 (cae el 5);
//   · `avisoDeDuracionPorSecciones` contra el tope de un pedido (Math.min 2.000)  → 7/1 (cae el 6);
//   · `largaPorSecciones` sin `!!p.porSecciones` en lib/copywriter/ia.ts          → 7/1 (cae el 8).
//
// Correr: node --import tsx --test tests/copywriter-por-secciones.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  avisoDeDuracionPorSecciones, escribirPorSecciones, esLargaParaUnPedido, palabrasPorSeccion, PALABRAS_POR_MINUTO,
  presupuestoPorSeccion, segundosDeLaGuia, tandasDeSecciones, UMBRAL_ALARGAR, type SeccionDeTanda,
} from '../lib/copywriter/por-secciones';
import { PALABRAS_POR_PEDIDO } from '../lib/copywriter/ia-reglas';
import { ESTRUCTURAS_VSL_DEFAULT } from '../lib/vsl-estructuras';
import { COSTO_POR_DEFECTO, costoDeFeature } from '../lib/mako-tokens-costos';
import type { BloqueIA, OperacionIA } from '../lib/copywriter/operaciones';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const clase = ESTRUCTURAS_VSL_DEFAULT.find((e) => e.id === 'vsl-clase-educativa')!;
const CLASE_42 = 2_520;

/** Un texto de `n` palabras. */
const palabras = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');
const seccion = (s: string, n: number): OperacionIA => ({ op: 'escribir_seccion', seccion: s, bloques: [{ tipo: 'texto', texto: palabras(n) } as BloqueIA] });
/** El borrador de la primera pasada: la pieza entera, corta (cada sección con `n` palabras). */
const borrador = (etiquetas: readonly string[], n: number): OperacionIA[] => [{ op: 'titulo', texto: 'La clase' }, ...etiquetas.map((e) => seccion(e, n))];
const nunca = () => false;

test('1. el presupuesto sale de la guía de su estructura y suma el largo de la pieza (las cinco VSL)', () => {
  assert.equal(ESTRUCTURAS_VSL_DEFAULT.length, 5, 'el denominador: las cinco VSL de lib/vsl-estructuras.ts');
  for (const e of ESTRUCTURAS_VSL_DEFAULT) {
    // Todas dicen los minutos de cada bloque: si una deja de decirlo, el reparto cae a partes iguales sin que nadie lo vea.
    for (const et of e.etiquetas) assert.ok(segundosDeLaGuia(e.guia, et), `${e.id}: la guía no dice los minutos de ${et}`);
    const p = presupuestoPorSeccion(e, e.minutos * 60);
    assert.deepEqual(p.map((x) => x.seccion), e.etiquetas, `${e.id}: una entrada por sección, en orden`);
    const suma = p.reduce((a, x) => a + x.palabras, 0);
    assert.ok(Math.abs(suma - e.minutos * PALABRAS_POR_MINUTO) <= e.etiquetas.length, `${e.id}: suma ${suma} y pide ${e.minutos * PALABRAS_POR_MINUTO}`);
  }
  // La clase de 42 minutos, con los números de su guía: LEAD (0-2 min) son 300 palabras, CLAVE UNO (7-15 min) 1.200.
  const p = new Map(presupuestoPorSeccion(clase, CLASE_42).map((x) => [x.seccion, x.palabras]));
  assert.equal(p.get('LEAD'), 300);
  assert.equal(p.get('CLAVE UNO'), 1_200);
  assert.equal(p.get('OFERTA'), 750);
  // Escalado a la página: la misma estructura en una página de 21 minutos reparte la mitad.
  assert.equal(new Map(presupuestoPorSeccion(clase, CLASE_42 / 2).map((x) => [x.seccion, x.palabras])).get('CLAVE UNO'), 600);
  // Las otras formas de la casa: «(1:30-3:00)» de YouTube y «(30-40 segundos)» de los reels.
  assert.equal(segundosDeLaGuia('BLOQUE UNO (1:30-3:00): una idea.', 'BLOQUE UNO'), 90);
  assert.equal(segundosDeLaGuia('HISTORIA (30-40 segundos): el desarrollo.', 'HISTORIA'), 35);
  assert.equal(segundosDeLaGuia('CTA (5 segundos): una acción.', 'CTA'), 5);
  assert.equal(segundosDeLaGuia('CTA MEDIO (cerca del minuto 3): un lead magnet.', 'CTA'), null, '«CTA» no es «CTA MEDIO»');
  // Una guía que no dice los minutos de un bloque le da el promedio de los otros, no cero.
  const sinUno = presupuestoPorSeccion({ etiquetas: ['A', 'B', 'C'], guia: 'A (0-2 min): x.\nB: y.\nC (2-4 min): z.' }, 600);
  assert.deepEqual(sinUno.map((x) => x.palabras), [500, 500, 500]);
});

test('2. cada tanda entra en un pedido, en orden, sin partir una sección y sin perder ninguna', () => {
  const p = presupuestoPorSeccion(clase, CLASE_42);
  const tandas = tandasDeSecciones(p);
  assert.ok(tandas.length >= 4, `la clase de 42 minutos no entra en menos de 4 tandas (dio ${tandas.length})`);
  for (const t of tandas) assert.ok(t.reduce((a, s) => a + s.palabras, 0) <= PALABRAS_POR_PEDIDO, `una tanda pasa del tope: ${t.map((s) => s.seccion).join(', ')}`);
  assert.deepEqual(tandas.flat().map((s) => s.seccion), clase.etiquetas, 'todas, una vez, en orden');
  // Una sección que sola llega al tope va sola.
  assert.deepEqual(tandasDeSecciones([{ seccion: 'A', palabras: 2_000 }, { seccion: 'B', palabras: 10 }]).map((t) => t.map((s) => s.seccion)), [['A'], ['B']]);
});

test('3. con un modelo que contesta lo pedido, la pieza queda con su largo: una llamada por tanda, cada sección en su lugar', async () => {
  const presupuesto = presupuestoPorSeccion(clase, CLASE_42);
  const pedidos: string[][] = [];
  const mensajes: string[] = [];
  const r = await escribirPorSecciones({
    ops: borrador(clase.etiquetas, 120),
    presupuesto, segundos: CLASE_42,
    pedir: async (mensaje, tanda) => { mensajes.push(mensaje); pedidos.push(tanda.map((s) => s.seccion)); return tanda.map((s) => seccion(s.seccion, s.palabras)); },
    quedaTiempo: () => true, esSinSaldo: nunca,
  });
  assert.equal(r.llamadas, tandasDeSecciones(presupuesto).length);
  assert.equal(r.corte, null);
  assert.deepEqual(r.faltan, []);
  assert.deepEqual(r.alargadas, clase.etiquetas);
  assert.deepEqual(pedidos.flat(), clase.etiquetas, 'cada sección corta se pidió una vez, en orden');
  // El pedido nombra la sección, sus palabras y lo que tiene hoy.
  assert.match(mensajes[0], /- LEAD: unas 300 palabras \(ahora tiene 120\)\./);
  assert.match(mensajes[0], /La pieza dura 42 minutos/);
  // Las secciones nuevas quedaron en el LUGAR de las del borrador: el título primero y las secciones en su orden, una vez cada una.
  assert.deepEqual(r.ops.map((o) => (o.op === 'escribir_seccion' ? o.seccion : o.op)), ['titulo', ...clase.etiquetas]);
  const finales = palabrasPorSeccion(r.ops);
  for (const s of presupuesto) assert.equal(finales.get(s.seccion), s.palabras, `${s.seccion} no quedó con su largo`);
});

test('4. lo que el borrador no escribió no se toca, y lo que vuelve más corto o de otra sección no entra', async () => {
  const presupuesto = presupuestoPorSeccion(clase, CLASE_42);
  // El borrador escribió todo menos CLAVE DOS (puede ser lo que la persona ya tenía) y dejó OFERTA ya larga.
  const ops = borrador(clase.etiquetas.filter((e) => e !== 'CLAVE DOS'), 100).map((o) => (o.op === 'escribir_seccion' && o.seccion === 'OFERTA' ? seccion('OFERTA', 700) : o));
  const pedidas: string[] = [];
  const r = await escribirPorSecciones({
    ops, presupuesto, segundos: CLASE_42,
    pedir: async (_m, tanda) => {
      pedidas.push(...tanda.map((s) => s.seccion));
      // El modelo devuelve la tanda, más CLAVE DOS (no pedida), y LEAD más corta que el borrador.
      return [...tanda.map((s) => seccion(s.seccion, s.seccion === 'LEAD' ? 50 : s.palabras)), seccion('CLAVE DOS', 1_200)];
    },
    quedaTiempo: () => true, esSinSaldo: nunca,
  });
  assert.ok(!pedidas.includes('CLAVE DOS'), 'no se pide lo que el borrador no escribió');
  assert.ok(!pedidas.includes('OFERTA'), `OFERTA ya tenía el ${Math.round(UMBRAL_ALARGAR * 100)} % de lo suyo`);
  assert.ok(!r.ops.some((o) => o.op === 'escribir_seccion' && o.seccion === 'CLAVE DOS'), 'lo que no se pidió no entra');
  assert.equal(palabrasPorSeccion(r.ops).get('LEAD'), 100, 'una sección que vuelve más corta no reemplaza la del borrador');
  assert.ok(r.faltan.includes('LEAD'), 'y sigue en lo que falta');
});

test('5. sin tiempo, o sin MaKo Tokens, corta en esa tanda y lo dice', async () => {
  const presupuesto = presupuestoPorSeccion(clase, CLASE_42);
  // Sin tiempo después de la primera tanda.
  let llamadas = 0;
  const sinTiempo = await escribirPorSecciones({
    ops: borrador(clase.etiquetas, 100), presupuesto, segundos: CLASE_42,
    pedir: async (_m, tanda) => { llamadas += 1; return tanda.map((s) => seccion(s.seccion, s.palabras)); },
    quedaTiempo: () => llamadas < 1, esSinSaldo: nunca,
  });
  assert.equal(sinTiempo.corte, 'tiempo');
  assert.equal(sinTiempo.llamadas, 1);
  assert.ok(sinTiempo.faltan.includes('CTA') && !sinTiempo.faltan.includes('LEAD'), sinTiempo.faltan.join(', '));
  // Sin saldo en la segunda: corta ahí (no pide la tercera) y devuelve el texto del medidor.
  class SinSaldo extends Error {}
  const pedidas: number[] = [];
  const sinSaldo = await escribirPorSecciones({
    ops: borrador(clase.etiquetas, 100), presupuesto, segundos: CLASE_42,
    pedir: async (_m, tanda) => {
      pedidas.push(tanda.length);
      if (pedidas.length === 2) throw new SinSaldo('Te quedaste sin MaKo Tokens: esto cuesta 6 y tienes 2.');
      return tanda.map((s) => seccion(s.seccion, s.palabras));
    },
    quedaTiempo: () => true, esSinSaldo: (e) => e instanceof SinSaldo,
  });
  assert.equal(sinSaldo.corte, 'saldo');
  assert.equal(pedidas.length, 2, 'sin saldo no hay otra llamada que lo arregle');
  assert.equal(sinSaldo.motivo, 'Te quedaste sin MaKo Tokens: esto cuesta 6 y tienes 2.');
  assert.ok(sinSaldo.alargadas.includes('LEAD'), 'lo de la primera tanda queda');
  // Una falla del proveedor también corta, sin texto propio (el aviso de duración dice lo que falta).
  const falla = await escribirPorSecciones({
    ops: borrador(clase.etiquetas, 100), presupuesto, segundos: CLASE_42,
    pedir: async () => { throw new Error('HTTP 503'); }, quedaTiempo: () => true, esSinSaldo: nunca,
  });
  assert.equal(falla.corte, 'falla');
  assert.equal(falla.motivo, null);
  assert.equal(falla.faltan.length, clase.etiquetas.length);
});

test('6. una pieza que entra en un pedido no es larga, y el aviso mide contra el largo REAL', async () => {
  assert.equal(esLargaParaUnPedido(600), false, 'la VSL de 10 minutos entra en un pedido');
  assert.equal(esLargaParaUnPedido(800), false, '800 s son justo 2.000 palabras');
  assert.equal(esLargaParaUnPedido(CLASE_42), true);
  assert.equal(esLargaParaUnPedido(null), false);
  // 1.300 palabras en la clase de 42 minutos: antes no había aviso (medía contra el tope de 2.000).
  assert.equal(avisoDeDuracionPorSecciones(1_300, CLASE_42, ['CLAVE DOS', 'CLAVE TRES']), 'Dura unos 9 minutos dichos y la pieza es de 42: pídele a MaKo que alargue «Clave dos» y «Clave tres».');
  assert.equal(avisoDeDuracionPorSecciones(1_300, CLASE_42, []), 'Dura unos 9 minutos dichos y la pieza es de 42: pídele a MaKo que la complete.');
  assert.equal(avisoDeDuracionPorSecciones(6_000, CLASE_42, []), null);
  assert.equal(avisoDeDuracionPorSecciones(1_000, CLASE_42, ['LEAD', 'PROMESA', 'QUIEN SOY', 'CTA', 'OFERTA']), 'Dura unos 7 minutos dichos y la pieza es de 42: pídele a MaKo que alargue «Lead», «Promesa», «Quién soy» y 2 secciones más.');
  // Sin estructura larga no hay tandas: el borrador queda como vino.
  const r = await escribirPorSecciones({ ops: borrador(['LEAD', 'CTA'], 100), presupuesto: [], segundos: 600, pedir: async () => { throw new Error('no se llama'); }, quedaTiempo: () => true, esSinSaldo: nunca });
  assert.equal(r.llamadas, 0);
});

test('7. la fila de costos dice cuántas llamadas son, con el número que da esta misma cuenta', () => {
  const tandas = tandasDeSecciones(presupuestoPorSeccion(clase, CLASE_42)).length;
  const fila = costoDeFeature('copywriter-ia');
  assert.notEqual(fila, COSTO_POR_DEFECTO, 'copywriter-ia tiene su fila propia');
  assert.match(fila.porque, new RegExp(`la clase de 42 minutos son unas ${1 + tandas}\\b`), `el borrador más ${tandas} tandas`);
  assert.match(fila.porque, /cada una cobrada aparte/);
});

test('8. el cableado: «Editar» de la pantalla lo prende y la segunda pasada vieja no corre sobre esa pieza', () => {
  const ia = sinComentarios(leer('lib/copywriter/ia.ts'));
  assert.match(ia, /const largaPorSecciones = !!p\.porSecciones && !original && !!estructuraUsada && m\.entera && esLargaParaUnPedido\(segundosDe\(m\)\);/);
  assert.match(ia, /const f1 = largaPorSecciones \? \{ largo: false, capitulos: false, corta: false, ingles: false \} : fallas\(m\);/);
  assert.match(ia, /return salidaVacia\(x\) \? \[\] : procesar\(x\)\.ops;/, 'cada tanda se sanea como la primera pasada');
  assert.match(ia, /esSinSaldo: esSinSaldoDeMt,/);
  assert.match(ia, /\? avisoDeDuracionPorSecciones\(m\.escritas, segundosDe\(m\) \?\? 0, porSecciones\.faltan\)/);
  assert.match(sinComentarios(leer('app/api/copywriter/ia/route.ts')), /adaptar: b\.accion === 'adaptar', porSecciones: true \}/);
  // La API de MaKo no lo prende: por HTTP corta a los 60 s.
  assert.doesNotMatch(sinComentarios(leer('lib/api-mako/areas/copywriter.run.ts')), /porSecciones/);
});
