// El explorador de carruseles que funcionan (lib/carruseles/explorar.ts): de dónde salen, su outlier, la búsqueda, los
// filtros, el orden, los guardados y el paso en que está. Corre el código; nada de leer el fuente.
//
// Probado rompiéndolo (4/11/2026), base 11/0:
//   · el outlier calculado con la mediana de TODAS las publicaciones juntas (no por cuenta) → 1 rojo (el de «es el de Spy»);
//   · `coincide` con `some` en vez de `every` → 1 rojo (todas las palabras);
//   · `conImagenes` por defecto en true → 2 rojos (lo que se sabe que es una foto suelta no es un carrusel, y la URL inicial);
//   · `ordenarCarruseles` sin mandar al final lo que no tiene número → 1 rojo (no se afirma un cero);
//   · `conGuardado` que repite al guardar dos veces → 1 rojo (idempotente).
// Y la biblioteca de ejemplos (4/11/2026), base 11/0:
//   · el filtro «De dónde» que no mira el origen → 1 rojo;
//   · `sanearGuardados` que tira los ids en negativo (los de la biblioteca) → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTROS_INICIALES, carruselesDe, coincide, conGuardado, creadoresDe, filtrarCarruseles, filtrosDeQuery, nombreDeBusqueda,
  ordenarCarruseles, pasoDelExplorador, queryDeFiltros, sanearBusquedas, sanearGuardados, tendenciasDeLaSemana,
  type Carrusel, type PiezaParaCarrusel,
} from '../lib/carruseles/explorar';
import { vecesSuMediana } from '../lib/spy-detalle';

const AHORA = Date.parse('2026-11-04T12:00:00Z');
const dia = (d: number) => new Date(AHORA - d * 86_400_000).toISOString().slice(0, 10);

let n = 0;
const pieza = (p: Partial<PiezaParaCarrusel>): PiezaParaCarrusel => ({
  id: ++n, competidor_id: 1, canal: 'instagram', tipo: 'publicacion', url: `https://www.instagram.com/p/x${n}/`, texto: null,
  analisis: null, vistas: null, megusta: 100, comentarios: 5, publicada_en: dia(20), visto_primera_vez: new Date(AHORA - 86_400_000).toISOString(),
  dejo_de_verse_en: null, miniatura: null, medio: 'carrusel', laminas: 7, ...p,
});

const COMP = [
  { id: 1, nombre: 'Estudio Lumen', instagram: 'estudio.lumen', avatar: null },
  { id: 2, nombre: 'Café Brasa', instagram: 'cafebrasa', avatar: 'https://x.test/a.webp' },
];

test('salen sólo las publicaciones de Instagram vivas que no son video, con su creador y su link', () => {
  const ps = [
    pieza({ megusta: 100 }), pieza({ megusta: 200 }), pieza({ megusta: 400, texto: '5 errores al pedir café' }),
    pieza({ tipo: 'reel' }), pieza({ medio: 'video' }), pieza({ dejo_de_verse_en: dia(1) }),
    pieza({ canal: 'youtube', tipo: 'video' }), pieza({ competidor_id: 99 }),
  ];
  const cs = carruselesDe(ps, COMP, AHORA);
  assert.equal(cs.length, 3);
  assert.equal(cs[0].creador.usuario, 'estudio.lumen');
  assert.match(cs[0].url ?? '', /^https:\/\/www\.instagram\.com\/p\//);
  assert.equal(cs[2].formato, 'lista', 'el formato sale del texto cuando la IA no lo dijo («5 errores»)');
});

test('el outlier es el de Spy: por CUENTA y contra su mediana, no contra todas juntas', () => {
  const a = [pieza({ competidor_id: 1, megusta: 100 }), pieza({ competidor_id: 1, megusta: 100 }), pieza({ competidor_id: 1, megusta: 500 })];
  const b = [pieza({ competidor_id: 2, megusta: 10_000 }), pieza({ competidor_id: 2, megusta: 10_000 }), pieza({ competidor_id: 2, megusta: 20_000 })];
  const cs = carruselesDe([...a, ...b], COMP, AHORA);
  const de = (id: number) => cs.find((c) => c.id === id)!.outlier;
  assert.equal(de(a[2].id), 5, '500 contra una mediana de 100');
  assert.equal(de(b[2].id), 2, '20.000 contra una mediana de 10.000: la cuenta grande no pisa a la chica');
  assert.equal(de(a[2].id), vecesSuMediana(a[2].id, a.map((p) => ({ ...p, tipo: 'publicacion' as const, canal: 'instagram' as const, duracion: null })), AHORA));
  const dos = carruselesDe([pieza({ competidor_id: 1 }), pieza({ competidor_id: 1 })], COMP, AHORA);
  assert.ok(dos.every((c) => c.outlier === null), 'con menos de 3 piezas con número no hay mediana que diga algo');
});

const c = (p: Partial<Carrusel>): Carrusel => ({
  id: ++n, competidorId: 1, creador: { nombre: 'Estudio Lumen', usuario: 'estudio.lumen', foto: null }, url: null, miniatura: null,
  texto: null, gancho: null, tipoGancho: null, cierre: null, formato: '', medio: 'carrusel', laminas: 6, megusta: 100, comentarios: 10, publicada: dia(3), traida: dia(2), outlier: 1, origen: 'cuentas', ...p,
});

test('la búsqueda: con @ es por creador; sin @, TODAS las palabras, sin tildes', () => {
  const x = c({ texto: 'Tres errores al diseñar tu café', gancho: '¿Tu menú espanta clientes?' });
  assert.equal(coincide(x, '@lumen'), true);
  assert.equal(coincide(x, '@brasa'), false);
  assert.equal(coincide(x, 'disenar cafe'), true);
  assert.equal(coincide(x, 'menu clientes'), true);
  assert.equal(coincide(x, 'café pizza'), false, 'todas las palabras, no alguna');
  assert.equal(coincide(x, ''), true);
});

test('los filtros: piso de outlier, sin imágenes sueltas por defecto, esta semana, guardados y largo', () => {
  const todos = [
    c({ outlier: 4, laminas: 8 }), c({ outlier: 0.5, laminas: 3 }), c({ outlier: null }),
    c({ medio: 'imagen', laminas: null, outlier: 9 }), c({ medio: null, laminas: null, outlier: 2 }), c({ publicada: dia(30), outlier: 7 }),
  ];
  const ids = (xs: Carrusel[]) => xs.map((x) => x.id);
  const con = (f: Partial<typeof FILTROS_INICIALES>, g: number[] = []) => filtrarCarruseles(todos, { ...FILTROS_INICIALES, ...f }, new Set(g), AHORA);
  assert.ok(!ids(con({})).includes(todos[3].id), 'una foto suelta (se sabe) no es un carrusel');
  assert.ok(ids(con({})).includes(todos[4].id), 'lo que no se sabe si es carrusel se muestra');
  assert.ok(ids(con({ conImagenes: true })).includes(todos[3].id));
  assert.deepEqual(ids(con({ outlierMin: 2 })), [todos[5].id, todos[0].id, todos[4].id]);
  assert.ok(!ids(con({ vista: 'semana' })).includes(todos[5].id), 'esta semana = publicado en los últimos 7 días');
  assert.deepEqual(ids(con({ vista: 'guardados' }, [todos[1].id])), [todos[1].id]);
  assert.deepEqual(ids(con({ largo: 'largos' })), [todos[0].id], 'sin láminas sabidas no entra a un filtro de largo');
  const ej = c({ origen: 'biblioteca', outlier: null });
  const mix = [todos[0], ej];
  const deDonde = (origen: typeof FILTROS_INICIALES.origen) => ids(filtrarCarruseles(mix, { ...FILTROS_INICIALES, origen }, new Set(), AHORA));
  assert.deepEqual(deDonde('todos'), [todos[0].id, ej.id], 'por defecto, lo de las cuentas Y la biblioteca');
  assert.deepEqual(deDonde('cuentas'), [todos[0].id]);
  assert.deepEqual(deDonde('biblioteca'), [ej.id]);
});

test('el orden: lo que no tiene el número va al final, nunca como un cero; «Más viejos» al revés', () => {
  const xs = [c({ outlier: null, publicada: dia(1) }), c({ outlier: 3 }), c({ outlier: 8 })];
  assert.deepEqual(ordenarCarruseles(xs, 'outlier').map((x) => x.outlier), [8, 3, null]);
  const fechas = [c({ publicada: dia(10) }), c({ publicada: dia(1) }), c({ publicada: null })];
  assert.deepEqual(ordenarCarruseles(fechas, 'viejos').map((x) => x.publicada), [dia(10), dia(1), null]);
  assert.deepEqual(ordenarCarruseles(fechas, 'nuevos').map((x) => x.publicada), [dia(1), dia(10), null]);
  const inter = [c({ megusta: null, comentarios: null }), c({ megusta: 50, comentarios: 1 }), c({ megusta: 9, comentarios: 300 })];
  assert.deepEqual(ordenarCarruseles(inter, 'interaccion').map((x) => x.comentarios), [300, 1, null]);
});

test('las tendencias de la semana: lo de los últimos 7 días por outlier, con tope', () => {
  const xs = [c({ outlier: 2 }), c({ outlier: 6 }), c({ outlier: 9, publicada: dia(12) }), c({ outlier: 4 })];
  assert.deepEqual(tendenciasDeLaSemana(xs, 2, AHORA).map((x) => x.outlier), [6, 4]);
});

test('los filtros viajan en la URL y vuelven iguales; lo que no se entiende vuelve al inicial', () => {
  const f = { ...FILTROS_INICIALES, q: '@lumen', creadores: [3, -4], origen: 'biblioteca' as const, outlierMin: 2, periodo: '30' as const, largo: 'medios' as const, formato: 'tutorial' as const, conImagenes: true, orden: 'nuevos' as const, vista: 'semana' as const };
  const q = queryDeFiltros(f);
  assert.deepEqual(filtrosDeQuery(new URLSearchParams(q)), f);
  assert.equal(queryDeFiltros(FILTROS_INICIALES), 'ver=carruseles');
  assert.deepEqual(filtrosDeQuery(new URLSearchParams('min=7&orden=raro&vista=x&periodo=2&de=a,-1,5&formato=inventado')),
    { ...FILTROS_INICIALES, creadores: [-1, 5] }, 'un creador en negativo es de la biblioteca; el cero y lo que no es número, no');
  assert.deepEqual(filtrosDeQuery({ q: ['tips'], min: '3' }), { ...FILTROS_INICIALES, q: 'tips', outlierMin: 3 });
});

test('guardar es idempotente, sacar también; lo roto de la base se descarta', () => {
  const t = '2026-11-04T10:00:00.000Z';
  const a = conGuardado([], 10, true, t);
  assert.equal(a.ya, false);
  const b = conGuardado(a.lista, 10, true, t);
  assert.equal(b.ya, true);
  assert.equal(b.lista.length, 1, 'guardar dos veces no lo repite');
  assert.equal(conGuardado(b.lista, 10, false, t).lista.length, 0);
  assert.equal(conGuardado([], 10, false, t).ya, true);
  assert.deepEqual(sanearGuardados('[{"id":1,"en":"x"},{"id":2,"en":"2026-11-01T00:00:00Z"},{"id":2,"en":"2026-11-02T00:00:00Z"},{"id":-3,"en":"2026-11-01T00:00:00Z"},{"id":0,"en":"2026-11-01T00:00:00Z"}]'),
    [{ id: 2, en: '2026-11-01T00:00:00Z' }, { id: -3, en: '2026-11-01T00:00:00Z' }], 'en negativo, uno de la biblioteca; el cero no es ninguno');
  assert.deepEqual(sanearGuardados('no es json'), []);
});

test('las búsquedas guardadas se re-sanean al leer y tienen un nombre que se entiende', () => {
  const b = sanearBusquedas(JSON.stringify([
    { id: 'b-abc1', nombre: '  Tips  de café ', query: 'ver=carruseles&q=cafe&min=99', en: '2026-11-01T00:00:00Z' },
    { id: 'MAL!', nombre: 'x', query: '', en: '2026-11-01T00:00:00Z' },
  ]));
  assert.deepEqual(b, [{ id: 'b-abc1', nombre: 'Tips de café', query: 'ver=carruseles&q=cafe', en: '2026-11-01T00:00:00Z' }]);
  assert.equal(nombreDeBusqueda({ ...FILTROS_INICIALES, q: 'menú', outlierMin: 2, formato: 'lista', vista: 'semana' }, []), 'menú · Esta semana · 2×+ · Lista o tips');
  assert.equal(nombreDeBusqueda({ ...FILTROS_INICIALES, creadores: [2] }, [{ id: 2, nombre: 'Café Brasa' }]), 'Café Brasa');
});

test('el paso dice qué falta y a dónde ir, sin afirmar un cero', () => {
  assert.equal(pasoDelExplorador({ competidores: 0, conInstagram: 0, carruseles: 0 }).paso, 'sin-cuentas');
  assert.equal(pasoDelExplorador({ competidores: 3, conInstagram: 0, carruseles: 0 }).paso, 'sin-instagram');
  assert.equal(pasoDelExplorador({ competidores: 3, conInstagram: 2, carruseles: 0 }).paso, 'sin-carruseles');
  const listo = pasoDelExplorador({ competidores: 3, conInstagram: 2, carruseles: 40 });
  assert.equal(listo.paso, 'listo');
  assert.equal(listo.accion, null);
  assert.equal(pasoDelExplorador({ competidores: 0, conInstagram: 0, carruseles: 0 }).accion?.ruta, '/competitor-spy');
});

test('los creadores, del que más tiene al que menos', () => {
  const xs = [c({ competidorId: 2, creador: { nombre: 'Café Brasa', usuario: 'cafebrasa', foto: null } }), c({}), c({})];
  assert.deepEqual(creadoresDe(xs).map((x) => [x.id, x.n]), [[1, 2], [2, 1]]);
});
