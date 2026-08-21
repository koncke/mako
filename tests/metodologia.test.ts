// =============================================================================
// La segunda capa: código que mira si el Perro cumplió su propia metodología
// =============================================================================
// El caso que los trajo (2026-08-21). Se shippeó una fórmula que calculaba el score de un
// proyecto como `max(sus tareas) + densidad`. Violaba TRES reglas escritas en el prompt del
// Perro a la vez, los tests de esa fórmula PASABAN, y el tablero quedó peor. Lo vio el
// dueño mirando la pantalla:
//
//   «¿Cómo que "vale lo mismo que su tarea más alta"? Si quisiera hacer eso, ¿para qué me
//    tomé el trabajo de meter IA? […] Justamente está el perro guardián, para asignar
//    prioridades según lo que MUEVE LA AGUJA. Y hay una metodología para eso.»
//
// Lo que se testea acá NO es una fórmula de priorización — no hay fórmula, y esa es la
// lección. Es que la SALIDA del Perro cumpla las reglas que su propio prompt impone.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizar, citasDe, razonCompara, sinEmpates, usaTodoElRango, piramideSana,
  noRankeaPorTamano, auditarSalidaDelPerro, desempatar, escalaEsperada, cuposDeDistribucion, type Puntuado,
} from '../app/plan/board/metodologia';

const P = (id: string, titulo: string, score: number, razon?: string): Puntuado => ({ id, titulo, score, razon });

// ── El formato de la razón ───────────────────────────────────────────────────────────

test('normalizar — saca tildes, mayúsculas y puntuación para poder comparar títulos', () => {
  assert.equal(normalizar('Vender MaKo: Oferta y precios — ¡ÚLTIMO!'), 'vender mako oferta y precios ultimo');
  assert.equal(normalizar('Integración de pagos'), normalizar('integracion de pagos'));
});

test('citasDe — agarra las angulares Y las rectas, que el modelo mezcla', () => {
  assert.deepEqual(citasDe('Le gana a «Cobrar con Stripe» porque…'), ['Cobrar con Stripe']);
  assert.deepEqual(citasDe('Pierde contra "Salir a prospectar" porque…'), ['Salir a prospectar']);
});

test('razonCompara — una razón que compara contra algo REAL del plan pasa', () => {
  const uni = [{ titulo: 'Integrar pasarela de pago' }, { titulo: 'Definir precios' }];
  assert.equal(razonCompara(P('a', 'Definir precios', 90, 'Le gana a «Integrar pasarela de pago» porque cobra antes.'), uni), null);
});

test('razonCompara — CAZA EL TÍTULO ALUCINADO, que es el modo de falla más caro', () => {
  // Una comparación contra algo que no existe se lee igual de convincente que una buena.
  const uni = [{ titulo: 'Definir precios' }];
  const f = razonCompara(P('a', 'Definir precios', 90, 'Le gana a «Conquistar Marte» porque…'), uni);
  assert.ok(f, 'tiene que fallar');
  assert.match(f!.detalle, /no existe en el plan/);
});

test('razonCompara — la paráfrasis del mecanismo NO es una razón', () => {
  // Es literalmente el texto que el dueño rechazó en pantalla.
  const uni = [{ titulo: 'Feature: Cobros y planes' }];
  const f = razonCompara(P('p1', 'Feature: Cobros y planes', 98,
    'Vale lo que su mejor tarea: «Evaluar alternativas de número virtual» (93), con 7 pendientes adentro.'), uni);
  assert.ok(f, 'una razón que describe el mecanismo tiene que fallar');
});

test('razonCompara — compararse con uno mismo no ordena nada', () => {
  const uni = [{ titulo: 'Definir precios' }];
  assert.ok(razonCompara(P('a', 'Definir precios', 90, 'Es clave por «Definir precios».'), uni));
});

test('razonCompara — sin comillas no hay comparación', () => {
  assert.ok(razonCompara(P('a', 'X', 90, 'Es muy importante para el negocio.'), [{ titulo: 'X' }]));
  assert.ok(razonCompara(P('a', 'X', 90, ''), [{ titulo: 'X' }]));
});

test('razonCompara — un título recortado por el modelo sigue contando', () => {
  // Exigir igualdad exacta convertiría una comparación buena en una falla.
  const uni = [{ titulo: 'Reestructurar la oferta principal y definir MaKo como downsell' }];
  assert.equal(razonCompara(P('a', 'Otra', 50, 'Pierde contra «Reestructurar la oferta principal» porque…'), uni), null);
});

// ── Las reglas de distribución ───────────────────────────────────────────────────────

test('sinEmpates — es DURA: un empate deja el Objetivo Principal librado al orden de Postgres', () => {
  const f = sinEmpates([P('a', 'A', 98), P('b', 'B', 98), P('c', 'C', 40)]);
  assert.ok(f);
  assert.equal(f!.peso, 'dura');
  assert.deepEqual(f!.ids.sort(), ['a', 'b']);
  assert.equal(sinEmpates([P('a', 'A', 98), P('b', 'B', 97)]), null);
});

test('usaTodoElRango — caza el AMONTONAMIENTO, que un promedio no delata', () => {
  // La falla real: doce proyectos entre 95 y 98.
  const amontonados = Array.from({ length: 12 }, (_, i) => P(`p${i}`, `P${i}`, 98 - (i % 4)));
  const f = usaTodoElRango(amontonados);
  assert.ok(f);
  assert.match(f!.detalle, /tiene que llegar a 89 o menos/);
});

test('usaTodoElRango — un reparto sano no se queja', () => {
  const sano = [98, 87, 74, 61, 52, 40, 31, 22, 9, 3].map((s, i) => P(`p${i}`, `P${i}`, s));
  assert.equal(usaTodoElRango(sano), null);
});

test('usaTodoElRango — con pocos proyectos no opina: el rango no dice nada', () => {
  assert.equal(usaTodoElRango([P('a', 'A', 60), P('b', 'B', 55)]), null);
});

test('usaTodoElRango — EL PISO SALE DE LA CANTIDAD, no de una constante', () => {
  // El ejemplo que dio el dueño mirando su tablero: *«está bien que haya llegado hasta el 30
  // con 71 proyectos; si tuviera 100 debería llegar hasta el 1»*. La versión anterior exigía
  // `min <= 15` para cualquier tablero — marcaba como falla el de 71 que estaba bien, y no
  // habría marcado uno de 100 que se quedara en 20.
  const con71 = Array.from({ length: 71 }, (_, i) => P(`p${i}`, `P${i}`, 100 - i));  // 100…30
  assert.equal(usaTodoElRango(con71), null, 'con 71 proyectos, llegar a 30 es lo máximo que la aritmética permite');

  const con100 = Array.from({ length: 100 }, (_, i) => P(`p${i}`, `P${i}`, 100 - i));  // 100…1
  assert.equal(usaTodoElRango(con100), null, 'con 100 tiene que llegar a 1, y llega');

  // El mismo tablero de 100 pero apretado arriba: ahora SÍ falla.
  const apretado = Array.from({ length: 100 }, (_, i) => P(`p${i}`, `P${i}`, Math.max(20, 100 - i)));
  assert.ok(usaTodoElRango(apretado), 'con 100 proyectos quedarse en 20 es amontonar');
});

test('piramideSana — 60% en Alta es inflar, y se mide ANTES de curvar', () => {
  // Si se midiera después, `curveTaskScores` arregla la forma y tapa el problema real
  // (que el modelo comparó mal).
  const infladas = Array.from({ length: 40 }, (_, i) => P(`t${i}`, `T${i}`, i < 24 ? 90 : 30));
  const f = piramideSana(infladas);
  assert.ok(f);
  assert.match(f!.detalle, /60%/);
});

test('piramideSana — una pirámide de verdad pasa', () => {
  const sanas = Array.from({ length: 100 }, (_, i) => P(`t${i}`, `T${i}`, i < 12 ? 85 : i < 40 ? 60 : 30));
  assert.equal(piramideSana(sanas), null);
});

// ── «El tamaño de un proyecto no es su prioridad» ────────────────────────────────────
// Parece imposible de verificar y no lo es: se mide la correlación de RANGOS entre el score
// y la cantidad de tareas. Con la fórmula que se revirtió daba prácticamente 1.

test('noRankeaPorTamano — CAZA la fórmula que se revirtió: ordenar por cantidad de tareas', () => {
  const porTamano = Array.from({ length: 12 }, (_, i) => ({ ...P(`p${i}`, `P${i}`, 100 - i * 8), nTareas: 30 - i * 2 }));
  const f = noRankeaPorTamano(porTamano);
  assert.ok(f, 'un ranking que copia el tamaño tiene que saltar');
  assert.match(f!.detalle, /Spearman/);
  assert.equal(f!.peso, 'blanda', 'es una señal para mirar, no un veredicto: puede que los grandes SÍ importen');
});

test('noRankeaPorTamano — un juicio que ignora el tamaño no se queja', () => {
  // El proyecto más importante tiene 2 tareas; el que menos importa tiene 30.
  const juzgado = [
    { ...P('a', 'Cobrar', 98), nTareas: 2 }, { ...P('b', 'Prospectar', 90), nTareas: 3 },
    { ...P('c', 'Refactor', 20), nTareas: 30 }, { ...P('d', 'Tablero interno', 12), nTareas: 25 },
    { ...P('e', 'E', 70), nTareas: 8 }, { ...P('f', 'F', 55), nTareas: 4 },
    { ...P('g', 'G', 44), nTareas: 19 }, { ...P('h', 'H', 33), nTareas: 6 },
  ];
  assert.equal(noRankeaPorTamano(juzgado), null);
});

test('noRankeaPorTamano — con menos de 8 proyectos la correlación es ruido', () => {
  assert.equal(noRankeaPorTamano([{ ...P('a', 'A', 90), nTareas: 10 }, { ...P('b', 'B', 10), nTareas: 1 }]), null);
});

// ── La pasada completa ───────────────────────────────────────────────────────────────

test('auditar — una salida limpia pasa sin fallas', () => {
  const proyectos = [98, 80, 61, 44, 30, 18, 9, 4].map((s, i) => ({
    ...P(`p${i}`, `Proyecto ${i}`, s, `Le gana a «Proyecto ${(i + 1) % 8}» porque trae plata antes.`),
    nTareas: [3, 19, 2, 25, 4, 30, 1, 8][i],
  }));
  const a = auditarSalidaDelPerro({ proyectos });
  assert.equal(a.ok, true, `no debería fallar: ${a.fallas.map((f) => f.detalle).join(' | ')}`);
  assert.equal(a.fallas.length, 0);
});

test('auditar — `ok` es false SOLO por fallas duras: una salida floja se aplica igual', () => {
  // Negarse a priorizar porque una razón salió floja deja al dueño sin tablero, que es peor.
  const proyectos = [P('a', 'A', 98, 'sin comillas'), P('b', 'B', 60, 'tampoco')];
  const a = auditarSalidaDelPerro({ proyectos });
  assert.equal(a.ok, true, 'las razones flojas no bloquean');
  assert.ok(a.blandas > 0, 'pero no se tragan');
});

test('auditar — el empate SÍ bloquea', () => {
  const proyectos = [P('a', 'A', 98, 'x'), P('b', 'B', 98, 'x')];
  assert.equal(auditarSalidaDelPerro({ proyectos }).ok, false);
});

test('auditar — las razones flojas se reportan AGRUPADAS, no una por una', () => {
  // 40 fallas idénticas no le dicen a nadie más que una que diga «40 de 71».
  const proyectos = Array.from({ length: 40 }, (_, i) => P(`p${i}`, `P${i}`, 100 - i, 'es importante'));
  const a = auditarSalidaDelPerro({ proyectos });
  const deRazon = a.fallas.filter((f) => f.regla.startsWith('La razón'));
  assert.equal(deRazon.length, 1);
  assert.match(deRazon[0].detalle, /40 de 40/);
});

test('auditar — LA RAZÓN DE UN PROYECTO NO COMPARA CONTRA UNA TAREA SUYA', () => {
  // Es el agujero exacto que tuvo la primera versión de este archivo: pasaba
  // `[...proyectos, ...tareas]` como universo de los dos, así que la razón que originó todo
  // el problema —«Vale lo que su mejor tarea: "…"»— PASABA la validación, porque esa tarea
  // existe. Un validador que aprueba justo el caso que vino a cazar es peor que no tenerlo.
  const a = auditarSalidaDelPerro({
    proyectos: [P('p1', 'Feature: Cobros y planes', 98,
      'Vale lo que su mejor tarea: «Integrar pasarela de pago automática con Stripe» (93), con 11 pendientes adentro.')],
    tareas: [P('t1', 'Integrar pasarela de pago automática con Stripe', 93, 'Le gana a «Otra tarea» porque cobra.'),
      P('t2', 'Otra tarea', 40, 'Pierde contra «Integrar pasarela de pago automática con Stripe» porque no cobra.')],
  });
  const deRazon = a.fallas.filter((f) => f.regla.startsWith('La razón'));
  assert.equal(deRazon.length, 1, 'la razón del proyecto tiene que fallar');
  assert.ok(deRazon[0].ids.includes('p1'));
});

test('auditar — sin nTareas no inventa la correlación', () => {
  const proyectos = Array.from({ length: 12 }, (_, i) => P(`p${i}`, `P${i}`, 100 - i * 8));
  const a = auditarSalidaDelPerro({ proyectos });
  assert.equal(a.fallas.some((f) => f.regla.includes('TAMAÑO')), false);
});

// ── Desempatar sin redistribuir ──────────────────────────────────────────────────────

test('desempatar — conserva el juicio: el que no empata NO se mueve', () => {
  // Es la diferencia con `spreadProjScores`, que reparte 100/99/97/96… y convierte el score
  // en la POSICIÓN del ranking. Ahí la razón dice «95 → 34» y el número mostrado es otro.
  const out = desempatar([P('a', 'A', 88), P('b', 'B', 40), P('c', 'C', 12)]);
  assert.deepEqual(out, { a: 88, b: 40, c: 12 });
});

test('desempatar — la DISTANCIA entre proyectos sigue significando algo', () => {
  // Con un reparto lineal, 97 y 12 quedan en posiciones contiguas y se pierde que uno vale
  // ocho veces lo que el otro.
  const out = desempatar([P('a', 'A', 97), P('b', 'B', 12)]);
  assert.equal(out.a - out.b, 85);
});

test('desempatar — el empate se resuelve con el MÍNIMO movimiento', () => {
  const out = desempatar([P('a', 'A', 90), P('b', 'B', 90), P('c', 'C', 90)]);
  assert.deepEqual(new Set(Object.values(out)).size, 3);
  assert.deepEqual(Object.values(out).sort((x, y) => y - x), [90, 89, 88]);
});

test('desempatar — su salida SIEMPRE pasa `sinEmpates`, que es la regla dura', () => {
  const items = Array.from({ length: 40 }, (_, i) => P(`p${i}`, `P${i}`, 50));
  const out = desempatar(items);
  const puntuados = items.map((i) => ({ ...i, score: out[i.id] }));
  assert.equal(sinEmpates(puntuados), null);
});

test('desempatar — es estable: la misma entrada da siempre lo mismo', () => {
  const items = [P('a', 'A', 70), P('b', 'B', 70), P('c', 'C', 70)];
  assert.deepEqual(desempatar(items), desempatar(items.slice()));
});

// ── La escala se abre tanto como cosas haya ──────────────────────────────────────────

test('escalaEsperada — es LITERAL el ejemplo que dio el dueño', () => {
  // *«Está bien que ahora haya llegado hasta el 30 en el menor de los proyectos, porque yo
  // tengo 71 proyectos. Pero si tuviera 100, debería llegar hasta el 1.»*
  assert.equal(escalaEsperada(71, 'proyecto').piso, 30);
  assert.equal(escalaEsperada(100, 'proyecto').piso, 1);
  assert.equal(escalaEsperada(150, 'proyecto').piso, 1, 'no baja de 1 aunque haya más');
});

test('escalaEsperada — sale de juntar dos reglas que YA estaban escritas', () => {
  // «el norte va en 95-100» + «PROHIBIDO empatar» ⟹ con n valores distintos y el techo en
  // 100, el más bajo no puede estar arriba de 101-n. No es un umbral inventado: es la
  // aritmética de las dos reglas.
  for (const n of [5, 12, 40, 71, 99]) {
    assert.equal(escalaEsperada(n, 'proyecto').piso, 101 - n);
  }
});

test('escalaEsperada — con POCOS no exige un fondo que no existe', () => {
  // Con 6 proyectos, pedirle al último que baje a 10 sería inventar una jerarquía.
  assert.equal(escalaEsperada(6, 'proyecto').piso, 95);
});

test('cuposDeDistribucion — habla en NÚMEROS, no en porcentajes', () => {
  // Un modelo respeta «de estos 71, el más bajo va en 30 o menos» mucho mejor que «usá toda
  // la escala»: el porcentaje lo tiene que traducir él mientras hace otras diez cosas.
  const c = cuposDeDistribucion(71, 'proyecto');
  assert.equal(c.piso, 30);
  assert.match(c.texto, /71 proyectos/);
  assert.match(c.texto, /30 o menos/);
});

test('cuposDeDistribucion — a los PROYECTOS no se les pone cupo de Alta, y es a propósito', () => {
  // Con 71 proyectos sin empatar y un rango de 70, los valores 81-100 se ocupan sí o sí:
  // exigir «solo 11 arriba de 80» sería pedir algo imposible de cumplir. Una alarma que
  // siempre suena es una alarma apagada. El 15% es disciplina de TAREAS, que sí empatan.
  assert.equal(cuposDeDistribucion(71, 'proyecto').maxArriba, null);
  assert.equal(cuposDeDistribucion(200, 'tarea').maxArriba, 30);
});

test('cuposDeDistribucion — con pocas TAREAS le dice explícitamente que no fuerce el fondo', () => {
  const pocas = cuposDeDistribucion(12, 'tarea');
  assert.match(pocas.texto, /NO fuerces el fondo/);
  const muchas = cuposDeDistribucion(550, 'tarea');
  assert.match(muchas.texto, /"A futuro"/);
});

test('piramideSana — el cupo se calcula sobre CUÁNTAS hay', () => {
  const cien = Array.from({ length: 100 }, (_, i) => P(`t${i}`, `T${i}`, i < 20 ? 90 : 30));
  const f = piramideSana(cien);
  assert.ok(f, '20 de 100 en Alta pasa el cupo de 15');
  assert.match(f!.detalle, /el cupo con 100 tareas es 15/);
});
