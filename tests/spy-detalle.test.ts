// =============================================================================
// El detalle de un competidor: todo lo que publica en un gráfico, sus formatos y «Copiar estructura» (puntos 7 y 9)
// =============================================================================
// Lo que cuida este archivo:
//   1. que cada miniatura caiga donde dice (X = el día en que se publicó, Y = el número en escala logarítmica), sin
//      inventar un número a lo que no lo tiene;
//   2. que el gráfico use «me gusta» donde no hay vistas, y días al aire en los anuncios;
//   3. que «¿Qué formatos le funcionan?» salga de la mediana de cada formato, con dos piezas o más, y que la lectura la
//      escriba el código;
//   4. que el formato que dice la IA se lea por valor o por nombre, y lo que no es ninguno quede vacío;
//   6. que el desplegable ofrezca sólo los gráficos que tienen algo, y la red que le falta; que el filtro de redes no
//      aparezca con una sola; y que con muchas piezas se dibujen las de más arriba y una muestra pareja del resto;
//   5. que «Copiar estructura» cite lo del competidor (una línea suya en MAYÚSCULA no abre una sección del guion) y vaya
//      al tipo de página que corresponde.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada:
//   · `graficoDe` con escala lineal en vez de logarítmica              → 1
//   · `valorDe` que cuenta un contador ausente como 0                 → 1
//   · `metricaDe` que usa siempre las vistas                          → 2
//   · `formatosDe` sin el mínimo de dos piezas                        → 3
//   · `lecturaDeFormatos` que no dice el que queda abajo              → 3
//   · `formatoDe` sin leer el nombre («Antes y después»)              → 4
//   · `textoParaCopiar` sin citar («> ») lo del competidor            → 5
//   · `tipoParaCopiar` que manda un short a 'youtube'                 → 5
//   · `grupoDe` que manda un short a «Contenido largo»               → 6
//   · `muestraDe` sin las de más arriba                              → 6
//   · la ruta de copiar sin preguntar la puerta del Copywriter       → 7
// Correr: node --import tsx --test tests/spy-detalle.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MINIATURAS_POR_GRAFICO, PIEZAS_POR_FORMATO, formatoDe, grupoDe, muestraDe, opcionesDeGrafico, primerGrupo, redesDe, formatosDe, graficoDe, lecturaDeFormatos, metricaDe, numerosDe, puestoDe, textoParaCopiar,
  tipoParaCopiar,
} from '../lib/spy-detalle';
import { bloquesDeTexto } from '../lib/copywriter/texto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const AHORA = Date.parse('2026-11-04T12:00:00Z');

type P = Parameters<typeof graficoDe>[0][number];
let sig = 1;
const pieza = (o: Partial<P> = {}): P => ({
  id: sig++, canal: 'instagram', tipo: 'reel', vistas: null, megusta: null, publicada_en: '2026-10-01T00:00:00Z',
  visto_primera_vez: '2026-10-02T00:00:00Z', dejo_de_verse_en: null, analisis: null, ...o,
});

test('1. cada miniatura cae en su día y en su escala; lo que no tiene número no entra', () => {
  const a = pieza({ vistas: 100, publicada_en: '2026-10-01T00:00:00Z' });
  const b = pieza({ vistas: 10_000, publicada_en: '2026-10-11T00:00:00Z' });
  const c = pieza({ vistas: 1000, publicada_en: '2026-10-31T00:00:00Z' });
  const sinNumero = pieza({ vistas: null, megusta: null });
  const g = graficoDe([a, b, c, sinNumero], AHORA);
  assert.equal(g.metrica, 'vistas');
  assert.equal(g.fuera, 1, 'la que no tiene número no se dibuja en cero');
  const de = (id: number) => g.puntos.find((p) => p.id === id)!;
  assert.equal(de(a.id).x, 0);
  assert.equal(de(c.id).x, 1);
  assert.equal(Math.round(de(b.id).x * 100), 33, 'el 11 cae a un tercio del mes');
  // Escala logarítmica: 100, 1.000 y 10.000 quedan a la misma distancia una de otra.
  assert.equal(de(a.id).y, 0);
  assert.equal(de(b.id).y, 1);
  assert.equal(de(c.id).y, 0.5, 'en escala lineal, 1.000 quedaría pegado al piso');
  assert.deepEqual(g.marcas.map((m) => m.rotulo), ['100', '1k', '10k']);
  assert.equal(puestoDe(b.id, [a, b, c, sinNumero], AHORA), '#1 de 3');
  assert.equal(puestoDe(sinNumero.id, [a, b, c, sinNumero], AHORA), null);
  const n = numerosDe([a, b, c, sinNumero], AHORA);
  assert.deepEqual(n, { piezas: 4, metrica: 'vistas', total: 11_100, mediana: 1000 });
  assert.deepEqual(graficoDe([sinNumero], AHORA).puntos, []);
});

test('2. sin vistas, «me gusta»; en los anuncios, los días al aire (sin inventar el fin de uno que sigue)', () => {
  const fotos = [pieza({ tipo: 'publicacion', megusta: 40 }), pieza({ tipo: 'publicacion', megusta: 400 }), pieza({ vistas: 900, megusta: 30 })];
  assert.equal(metricaDe(fotos), 'me gusta', 'la mayoría no publica vistas');
  assert.equal(graficoDe(fotos, AHORA).puntos.length, 3);
  const corre = pieza({ canal: 'anuncios', tipo: 'anuncio', publicada_en: '2026-10-25T12:00:00Z' });
  const termino = pieza({ canal: 'anuncios', tipo: 'anuncio', publicada_en: '2026-09-01T00:00:00Z', dejo_de_verse_en: '2026-09-11T00:00:00Z' });
  assert.equal(metricaDe([corre, termino]), 'días al aire');
  const g = graficoDe([corre, termino], AHORA);
  assert.deepEqual(g.puntos.map((p) => p.valor).sort((x, y) => x - y), [10, 10]);
  assert.equal(numerosDe([corre, termino], AHORA).total, null, 'sumar días al aire no dice nada');
});

test('3. los formatos salen de su mediana contra la de todas, con dos piezas o más; la lectura la escribe el código', () => {
  const f = (formato: string, vistas: number, gancho = '') => pieza({ vistas, analisis: { formato, gancho } });
  const piezas = [
    f('pov', 5000, 'Nadie te dice esto'), f('pov', 3000),
    f('storytime', 2000, 'Me pasó algo'), f('storytime', 1500),
    f('resena', 200), f('resena', 300),
    f('tutorial', 9000), // una sola: no tiene fila
    f('otro', 1000), f('otro', 1000), // «otro» no es un formato que se pueda recomendar
    pieza({ vistas: 1000 }), pieza({ vistas: 1000 }),
  ];
  const filas = formatosDe(piezas, AHORA);
  assert.deepEqual(filas.map((x) => x.formato), ['pov', 'storytime', 'resena']);
  assert.ok(PIEZAS_POR_FORMATO >= 2);
  const pov = filas[0];
  assert.equal(pov.mediana, 4000);
  assert.equal(pov.veces, 4, 'la mediana general es 1.000');
  assert.equal(pov.gancho, 'Nadie te dice esto', 'el gancho de su mejor pieza');
  assert.equal(pov.piezas.length, 2);
  assert.ok(pov.xMediana > filas[2].xMediana);
  assert.equal(lecturaDeFormatos(filas), 'POV y Storytime rinden 4x y 1,8x la mediana; Reseña, 0,3x.');
  assert.equal(lecturaDeFormatos(filas.slice(2).concat(filas.slice(2).map((f) => ({ ...f, formato: 'opinion' as const, rotulo: 'Opinión', veces: 1 })))), 'Reseña rinde 0,3x la mediana.', 'sin ninguno arriba, igual se dice el que queda abajo');
  assert.equal(lecturaDeFormatos(filas.slice(0, 1)), null, 'con un formato solo no hay nada que comparar');
  assert.deepEqual(formatosDe([pieza({ vistas: 10 }), pieza({ vistas: 20 })], AHORA), [], 'sin formatos, la sección no se dibuja');
});

test('4. el formato de la IA se lee por valor o por nombre; lo que no es ninguno queda vacío', () => {
  assert.equal(formatoDe('pov'), 'pov');
  assert.equal(formatoDe('Antes y después'), 'antes-despues');
  assert.equal(formatoDe('  RESEÑA '), 'resena');
  assert.equal(formatoDe('detrás de escena'), 'detras');
  assert.equal(formatoDe('meme'), '');
  assert.equal(formatoDe(3), '');
});

test('5. «Copiar estructura» cita lo del competidor y va al tipo de página que corresponde', () => {
  const t = textoParaCopiar({ nombre: 'Den Borgg' }, {
    canal: 'instagram', tipo: 'reel', url: 'https://www.instagram.com/reel/abc/', titulo: null,
    texto: 'GANCHO\nAprende esto hoy', vistas: 1200, megusta: 80,
    analisis: { gancho: 'Nadie te dice esto', angulo: 'urgencia', formato: 'pov' },
  });
  assert.match(t, /^## Copiado de Den Borgg/);
  assert.match(t, /- Formato: POV/);
  assert.match(t, /> GANCHO/);
  const bloques = bloquesDeTexto(t);
  // «GANCHO» es un renglón corto en MAYÚSCULA: sin la cita, abriría una sección del guion con el texto de otro.
  assert.ok(!bloques.some((b) => b.type !== 'heading' && JSON.stringify(b).includes('"GANCHO"') && b.type !== 'blockquote'), 'lo del competidor va citado');
  assert.ok(bloques.some((b) => b.type === 'blockquote'));
  const sinLeer = textoParaCopiar({ nombre: 'X' }, { canal: 'youtube', tipo: 'video', url: null, titulo: 'Título', texto: null, vistas: null, megusta: null, analisis: null });
  assert.match(sinLeer, /pídele a MaKo que la lea/);
  assert.equal(tipoParaCopiar({ canal: 'anuncios', tipo: 'anuncio', duracion: null }), 'ad');
  assert.equal(tipoParaCopiar({ canal: 'youtube', tipo: 'video', duracion: 'PT45S' }), 'reel', 'un short es un reel');
  assert.equal(tipoParaCopiar({ canal: 'youtube', tipo: 'video', duracion: 'PT12M3S' }), 'youtube');
  assert.equal(tipoParaCopiar({ canal: 'instagram', tipo: 'reel', duracion: null }), 'reel');
  assert.equal(tipoParaCopiar({ canal: 'instagram', tipo: 'publicacion', duracion: null }), 'post');
});

test('6. qué se grafica: sólo los gráficos con algo, la red que falta, el filtro de redes y la muestra', () => {
  const reel = { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null };
  const short = { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT50S' };
  const largo = { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT14M' };
  const foto = { canal: 'instagram' as const, tipo: 'publicacion' as const, duracion: null };
  assert.equal(grupoDe(reel), 'corto');
  assert.equal(grupoDe(short), 'corto', 'un short es contenido corto, como un reel');
  assert.equal(grupoDe(largo), 'largo');
  assert.equal(grupoDe(foto), 'imagenes');
  assert.equal(grupoDe({ canal: 'landing', tipo: 'pagina', duracion: null } as never), 'web');
  assert.deepEqual(opcionesDeGrafico([reel, short, largo], { instagram: 'x', youtube_id: 'UC1' }).map((o) => o.label), ['Contenido corto · 2', 'Contenido largo · 1']);
  assert.deepEqual(opcionesDeGrafico([largo], { instagram: null, youtube_id: 'UC1' }).map((o) => o.value), ['largo', 'agregar-instagram']);
  assert.equal(primerGrupo([largo, foto]), 'largo');
  assert.equal(primerGrupo([]), null);
  assert.deepEqual(redesDe([reel, short, reel]), [{ red: 'todo', n: 3 }, { red: 'instagram', n: 2 }, { red: 'youtube', n: 1 }]);
  assert.deepEqual(redesDe([reel, reel]), [], 'con una sola red no hay filtro');
  const puntos = Array.from({ length: 1000 }, (_, i) => ({ x: i / 999, valor: (i * 7919) % 1000 }));
  const m = muestraDe(puntos);
  assert.equal(m.length, MINIATURAS_POR_GRAFICO);
  assert.ok(m.some((p) => p.valor === 999), 'la de más vistas siempre se ve');
  assert.ok(m.some((p) => p.x < 0.1) && m.some((p) => p.x > 0.9), 'y el resto, parejo en el tiempo');
  assert.equal(muestraDe(puntos.slice(0, 10)).length, 10);
});

test('7. «Copiar estructura» pregunta la puerta del Copywriter ANTES de crear la página', () => {
  const ruta = readFileSync(fileURLToPath(new URL('../app/api/competitor-spy/copiar/route.ts', import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  const puerta = ruta.indexOf("if (!(await esAdminDeTab('copywriter')) || !(await veCopywriter()))");
  const crea = ruta.indexOf('await crear(');
  assert.ok(puerta > 0, 'la puerta del Copywriter');
  assert.ok(crea > 0, 'la creación de la página');
  assert.ok(puerta < crea, 'una ruta de Spy no abre una tab que a quien mira no le corresponde');
  assert.match(ruta, /if \(pieza\.canal === 'landing'\) return no\(400/, 'una web va al Web Generator');
  assert.match(ruta, /const leida = await leerPieza\(id\);\n\s*if \(!leida\) return no\(404/, 'sólo lo que se pudo leer, de este negocio');
});
