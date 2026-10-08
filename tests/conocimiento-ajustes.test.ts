// =============================================================================
// conocimiento-ajustes — lo que el SUPER ADMIN le cambia a un curso de Conocimientos (item 1, D9)
// =============================================================================
// Pedido de Martín (07/10/2026): «En la tab de CONOCIMIENTOS como SuperAdmin debería poder editar
// todo, aplicalo también allí. Claro que los links compartidos y otros usuarios no deben poder editar
// eso.» Lo que se guarda vive en `conocimiento_ajustes` (mig 0221) y se APLICA encima del catálogo.
//
// Lo que se EJECUTA: `aplicarAjustes` (cada campo, lo oculto, el orden, el saneo de lo leído y los
// huérfanos), los planes de los gestos que tocan el orden, y el saneo de lo que se escribe.
// Lo que se LEE del fuente (sin comentarios: los archivos de acá explican en su prosa lo que NO hacen):
// que cada escritura pregunte `getSesionAdmin()` en su primera línea, que la migración no tenga
// `workspace_id` y sí RLS y revoke, y que los links compartidos apliquen los ajustes sin armar edición.
//
// ── Roturas (08/10/2026; scratchpad/cono/romper.mjs, que deshace el reemplazo sobre el disco y exige
// que lo roto sea ÚNICO) ── Sin romper: 17 / 0. Una rotura por vez, cada una tumbó SU test:
//   · `aplicarAjustes` dejando pasar lo oculto sin `conOcultos`             → 16 / 1 «lo oculto»
//   · `filaLeida` sin sanear el valor                                       → 15 / 2 «se sanea» y «el curso»
//     (el segundo cae porque el color deja de volver aclarado: también es saneo)
//   · un destino huérfano (`modulo` de un grupo que ya no existe) aplicado  → 16 / 1 «HUÉRFANO» (tira)
//   · volver al módulo de la ficha ESCRIBIENDO la fila en vez de borrarla   → 16 / 1 «llevar una clase»
//   · `guardarAjustes` con `getSesionAdmin()` en la segunda línea           → 16 / 1 «cada función de datos»
//   · una acción sin `getSesionAdmin()`                                     → 16 / 1 «cada acción»
//   · la tabla con `workspace_id`                                           → 16 / 1 «la migración»
//   · el curso suelto viajando CON lo oculto · CursoCompartido sin `sembrar` · la tab volviendo al
//     `find` crudo                                                          → 16 / 1 cada una, «los links compartidos»
//   · Conocimientos montando el editor sin preguntar `puedeEditar`          → 16 / 1 «quién edita»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Clase, Curso } from '../app/conocimientos/curso';
import {
  SIN_MODULO, TOPE_NOMBRE_MODULO, ajustarFicha, antesDeAlMover, aplicarAjustes, conCambios, esErrorGesto, filaLeida,
  planLlevarClase, planOrdenModulos, queValido, sanearValor, type FilaAjuste,
} from '../lib/conocimiento-ajustes';
import { valorDeLamina } from '../lib/laminas';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas `//` ANTES que los bloques: un `/*` adentro de un comentario de línea se comería el código. */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── El curso de prueba ─────────────────────────────────────────────────────────────
const clase = (n: number, grupo: string | undefined, extra: Partial<Clase> = {}): Clase => ({
  n, grupo, titulo: `Clase ${n}`, cardDesc: '1:00', videoId: `v${n}`, resumen: '', transcripcion: [],
  recursoSlugs: [], herramientas: [], ...extra,
});
const M1 = 'Módulo 1 - Intro';
const M2 = 'Módulo 2 - Base';
const M3 = 'Módulo 3 - Cierre';
const CURSO: Curso = {
  slug: 'demo', categoria: 'Categoría', cardDesc: '6 clases', eyebrow: '', titulo: 'Demo - Autor', tituloCorto: 'Demo',
  subtitulo: '', volumen: '', resumen: 'De qué va', portada: '/cono-portadas/demo.webp',
  clases: [clase(10, M1), clase(11, M1), clase(20, M2), clase(21, M2), clase(22, M2), clase(30, M3)],
  recursos: [],
};
const fila = (objeto: string, objeto_id: string, campo: string, valor: string, curso_slug = 'demo') => ({ curso_slug, objeto, objeto_id, campo, valor });
const ns = (xs: Array<{ n: number }>) => xs.map((x) => x.n);

// ── Sin filas, el curso es el de la ficha ──────────────────────────────────────────
test('sin ajustes, el curso es EXACTAMENTE el de la ficha', () => {
  const c = aplicarAjustes(CURSO, []);
  assert.deepEqual(c.modulos.map((m) => m.key), [M1, M2, M3], 'un módulo por grupo, en el orden en que aparecen');
  assert.deepEqual(c.modulos.map((m) => m.nombre), [M1, M2, M3]);
  assert.deepEqual(ns(c.clases), [10, 11, 20, 21, 22, 30]);
  assert.deepEqual(c.modulos.map((m) => m.nFicha), [1, 2, 3], 'el ordinal del nombre');
  assert.ok(c.modulos.every((m) => m.clasesIntactas));
  assert.equal(c.modulosDeLaFicha, 3);
  assert.equal(c.titulo, 'Demo - Autor');
  assert.equal(c.acento, null);
  assert.equal(c.portada, '/cono-portadas/demo.webp');
  // Las clases sin grupo caen al módulo sintético, con el MISMO nombre que filtra.
  const sinGrupo = aplicarAjustes({ ...CURSO, clases: [clase(1, undefined), clase(2, undefined)] }, []);
  assert.deepEqual(sinGrupo.modulos.map((m) => m.key), [SIN_MODULO]);
});

// ── El curso ────────────────────────────────────────────────────────────────────────
test('el curso: título, resumen, color y portada', () => {
  const c = aplicarAjustes(CURSO, [
    fila('curso', '', 'titulo', 'Otro nombre'),
    fila('curso', '', 'resumen', 'Otra descripción'),
    fila('curso', '', 'acento', '#000080'),
    fila('curso', '', 'portada', 'grad:amanecer'),
  ]);
  assert.equal(c.titulo, 'Otro nombre');
  assert.equal(c.tituloCorto, 'Otro nombre', 'la portada de adentro usa el mismo título elegido');
  assert.equal(c.resumen, 'Otra descripción');
  // Un azul marino se ACLARA hasta que la tinta se lea encima: es fondo de texto oscuro.
  assert.ok(c.acento && c.acento !== '#000080', 'el acento vuelve legible');
  // Un degradado: va como fondo, y la tapa del catálogo NO se dibuja encima.
  assert.equal(c.portadaElegida, 'grad:amanecer');
  assert.equal(c.portada, undefined);
  assert.match(String(c.fondo), /gradient/);
  // Una foto: va donde iba la tapa (la grilla, la vista previa del link).
  const f = ajustarFicha(CURSO, [fila('curso', '', 'portada', 'https://picsum.photos/id/1/800/450')]);
  assert.equal(f.portada, 'https://picsum.photos/id/1/800/450');
});

// ── Un módulo ───────────────────────────────────────────────────────────────────────
test('un módulo: nombre, portada, orden y oculto — y su identidad no cambia', () => {
  const lam = valorDeLamina({ diseno: 'pizarra', a: '#2E4A3B', b: '#F4D35E', texto: '' });
  const c = aplicarAjustes(CURSO, [
    fila('modulo', M2, 'nombre', 'La base'),
    fila('modulo', M2, 'portada', lam),
    fila('modulo', M3, 'orden', '0'),
    fila('modulo', M1, 'orden', '1'),
    fila('modulo', M2, 'orden', '2'),
  ], { conOcultos: true });
  assert.deepEqual(c.modulos.map((m) => m.key), [M3, M1, M2], 'el orden elegido');
  const m2 = c.modulos.find((m) => m.key === M2)!;
  assert.equal(m2.nombre, 'La base');
  assert.equal(m2.key, M2, 'la key sigue siendo el nombre ORIGINAL: los #mod= que circulan siguen andando');
  assert.equal(m2.portadaElegida, lam);
  assert.equal(m2.nFicha, 2, 'el número de la ficha no se mueve con el módulo (es la ruta de su foto)');
  // Anterior / Siguiente siguen el orden nuevo.
  assert.deepEqual(ns(c.clases), [30, 10, 11, 20, 21, 22]);
});

// ── Una clase ───────────────────────────────────────────────────────────────────────
test('una clase: título, portada, orden y módulo', () => {
  const c = aplicarAjustes(CURSO, [
    fila('clase', '11', 'titulo', 'Bienvenida'),
    fila('clase', '11', 'portada', 'grad:oceano'),
    // La 21 se muda al módulo 1, primera.
    fila('clase', '21', 'modulo', M1),
    fila('clase', '21', 'orden', '0'), fila('clase', '10', 'orden', '1'), fila('clase', '11', 'orden', '2'),
    // Y en el 2, la 22 antes que la 20.
    fila('clase', '22', 'orden', '0'), fila('clase', '20', 'orden', '1'),
  ]);
  const c11 = c.clases.find((x) => x.n === 11)!;
  assert.equal(c11.titulo, 'Bienvenida');
  assert.equal(c11.tituloOriginal, 'Clase 11');
  assert.equal(c11.portadaElegida, 'grad:oceano');
  assert.deepEqual(ns(c.modulos[0].clases), [21, 10, 11]);
  assert.deepEqual(ns(c.modulos[1].clases), [22, 20]);
  assert.equal(c.clases.find((x) => x.n === 21)!.moduloKey, M1);
  assert.equal(c.clases.find((x) => x.n === 21)!.moduloOriginal, M2);
  assert.ok(!c.modulos[0].clasesIntactas && !c.modulos[1].clasesIntactas && c.modulos[2].clasesIntactas);
});

// ── Lo oculto ───────────────────────────────────────────────────────────────────────
// ROTURA: `aplicarAjustes` dejando pasar las ocultas sin `conOcultos` → cae ESTE test.
test('lo oculto lo ve SÓLO el super admin: a nadie más le llega', () => {
  const filas = [fila('modulo', M3, 'oculto', '1'), fila('clase', '20', 'oculta', '1')];
  const publico = aplicarAjustes(CURSO, filas);
  assert.deepEqual(publico.modulos.map((m) => m.key), [M1, M2], 'un módulo oculto no viaja');
  assert.deepEqual(ns(publico.clases), [10, 11, 21, 22], 'ni sus clases, ni una clase oculta');
  assert.ok(publico.clases.every((c) => !c.oculta));

  const admin = aplicarAjustes(CURSO, filas, { conOcultos: true });
  assert.deepEqual(admin.modulos.map((m) => m.key), [M1, M2, M3]);
  assert.equal(admin.modulos[2].oculto, true);
  const c30 = admin.clases.find((c) => c.n === 30)!;
  assert.ok(c30.oculta && !c30.ocultaPropia, 'oculta por su módulo, no por ella');
  const c20 = admin.clases.find((c) => c.n === 20)!;
  assert.ok(c20.oculta && c20.ocultaPropia);

  // Un módulo que se quedó sin clases (se mudaron todas) no se dibuja para quien cursa, y sí para el admin.
  const mudadas = [fila('clase', '30', 'modulo', M1)];
  assert.deepEqual(aplicarAjustes(CURSO, mudadas).modulos.map((m) => m.key), [M1, M2]);
  assert.deepEqual(aplicarAjustes(CURSO, mudadas, { conOcultos: true }).modulos.map((m) => m.key), [M1, M2, M3]);
});

// ── El saneo de lo LEÍDO ────────────────────────────────────────────────────────────
// ROTURA: `filaLeida` sin `sanearValor` (una portada con un origen no aceptado pasa) → cae ESTE test.
test('lo que se LEE se sanea: una fila rota no se aplica, y vuelve lo de la ficha', () => {
  const rotas = [
    fila('curso', '', 'portada', 'javascript:alert(1)'),
    fila('curso', '', 'portada', 'http://inseguro.com/x.jpg'),
    fila('curso', 'algo', 'titulo', 'un curso no tiene id'),
    fila('modulo', M1, 'titulo', 'campo de otro objeto'),
    fila('modulo', M1, 'constructor', 'x'),
    fila('modulo', M1, 'portada', 'lam:pizarra:ZZZZZZ:F4D35E:'),
    fila('modulo', M1, 'orden', 'primero'),
    fila('modulo', M1, 'oculto', '0'),
    fila('clase', '0', 'titulo', 'n inválido'),
    fila('clase', 'abc', 'titulo', 'n inválido'),
    fila('clase', '10', 'titulo', '   '),
    fila('clase', '10', 'titulo', 'de otro curso', 'otro-curso'),
    null, 42, 'texto',
  ];
  const c = aplicarAjustes(CURSO, rotas as unknown[], { conOcultos: true });
  assert.equal(c.portadaElegida, null);
  assert.equal(c.portada, '/cono-portadas/demo.webp');
  assert.equal(c.titulo, 'Demo - Autor');
  assert.equal(c.modulos[0].portadaElegida, null);
  assert.equal(c.modulos[0].oculto, false);
  assert.deepEqual(c.modulos.map((m) => m.key), [M1, M2, M3]);
  assert.equal(c.clases[0].titulo, 'Clase 10');
  // Y lo que SÍ pasa, pasa SANEADO: un título largo se recorta, con tildes contadas como una.
  const largo = 'á'.repeat(TOPE_NOMBRE_MODULO + 50);
  const r = aplicarAjustes(CURSO, [fila('modulo', M1, 'nombre', largo)]);
  assert.equal(Array.from(r.modulos[0].nombre).length, TOPE_NOMBRE_MODULO);
});

// ── Los huérfanos ───────────────────────────────────────────────────────────────────
test('un ajuste HUÉRFANO (la regeneración renombró el grupo o sacó la clase) se ignora sin romper', () => {
  const filas = [
    fila('modulo', 'Módulo 2 - Viejo nombre', 'nombre', 'X'),
    fila('modulo', 'Módulo 2 - Viejo nombre', 'oculto', '1'),
    fila('modulo', 'Módulo 2 - Viejo nombre', 'orden', '0'),
    fila('clase', '999', 'titulo', 'Una que ya no está'),
    fila('clase', '10', 'modulo', 'Módulo 2 - Viejo nombre'),
  ];
  const c = aplicarAjustes(CURSO, filas, { conOcultos: true });
  assert.deepEqual(c.modulos.map((m) => m.key), [M1, M2, M3]);
  assert.deepEqual(c.modulos.map((m) => m.nombre), [M1, M2, M3]);
  assert.ok(c.modulos.every((m) => !m.oculto));
  assert.equal(c.clases.find((x) => x.n === 10)!.moduloKey, M1, 'un destino que no existe deja la clase donde estaba');
  assert.deepEqual(ns(c.clases), [10, 11, 20, 21, 22, 30]);
});

// ── Los gestos que tocan el orden ───────────────────────────────────────────────────
test('arrastrar un módulo escribe el orden de TODOS; soltarlo donde estaba no escribe nada', () => {
  const c = aplicarAjustes(CURSO, [], { conOcultos: true });
  const plan = planOrdenModulos(c, [M2, M1, M3]);
  assert.ok(!esErrorGesto(plan));
  assert.deepEqual(plan.poner.map((p) => [p.objetoId, p.valor]), [[M2, '0'], [M1, '1'], [M3, '2']]);
  const igual = planOrdenModulos(c, [M1, M2, M3]);
  assert.ok(!esErrorGesto(igual) && igual.poner.length === 0 && igual.quitar.length === 0);
  // Una lista que no es la del curso (otra pestaña, un módulo que ya no está): se rechaza.
  assert.ok(esErrorGesto(planOrdenModulos(c, [M1, M2])));
  assert.ok(esErrorGesto(planOrdenModulos(c, [M1, M1, M2])));
  // Y aplicado, queda.
  const despues = aplicarAjustes(CURSO, conCambios([], 'demo', plan as never));
  assert.deepEqual(despues.modulos.map((m) => m.key), [M2, M1, M3]);
});

test('llevar una clase: en su módulo, a otro, y de vuelta al suyo', () => {
  const c0 = aplicarAjustes(CURSO, [], { conOcultos: true });
  // En su módulo: la 22 antes de la 20.
  const p1 = planLlevarClase(c0, 22, M2, 20);
  assert.ok(!esErrorGesto(p1));
  const f1 = conCambios([], 'demo', p1 as never);
  assert.deepEqual(ns(aplicarAjustes(CURSO, f1).modulos[1].clases), [22, 20, 21]);

  // A otro módulo, al final: escribe su módulo y el orden de los DOS.
  const c1 = aplicarAjustes(CURSO, f1, { conOcultos: true });
  const p2 = planLlevarClase(c1, 20, M3, null);
  assert.ok(!esErrorGesto(p2));
  assert.ok(p2.poner.some((p) => p.objetoId === '20' && p.campo === 'modulo' && p.valor === M3));
  const f2 = conCambios(f1, 'demo', p2 as never);
  const c2 = aplicarAjustes(CURSO, f2, { conOcultos: true });
  assert.deepEqual(ns(c2.modulos[1].clases), [22, 21]);
  assert.deepEqual(ns(c2.modulos[2].clases), [30, 20]);

  // De vuelta al suyo: la fila del módulo se BORRA (es lo de la ficha), no se escribe su grupo.
  const p3 = planLlevarClase(c2, 20, M2, 22);
  assert.ok(!esErrorGesto(p3));
  assert.ok(p3.quitar.some((q) => q.objetoId === '20' && q.campo === 'modulo'));
  assert.ok(!p3.poner.some((p) => p.campo === 'modulo'));
  const c3 = aplicarAjustes(CURSO, conCambios(f2, 'demo', p3 as never));
  assert.deepEqual(ns(c3.modulos[1].clases), [20, 22, 21]);

  // Soltada donde estaba: nada. Y lo que no existe, un error dicho.
  const quieta = planLlevarClase(c0, 21, M2, 22);
  assert.ok(!esErrorGesto(quieta) && quieta.poner.length === 0);
  assert.ok(esErrorGesto(planLlevarClase(c0, 999, M2, null)));
  assert.ok(esErrorGesto(planLlevarClase(c0, 20, 'no existe', null)));
  assert.ok(esErrorGesto(planLlevarClase(c0, 20, M2, 30)), 'antesDe tiene que estar en ese módulo');
});

test('↑ / ↓ de una clase: a quién queda pegada, y no en las puntas', () => {
  const c = aplicarAjustes(CURSO, [], { conOcultos: true });
  assert.equal(antesDeAlMover(c, 21, 'arriba'), 20);
  assert.equal(antesDeAlMover(c, 20, 'abajo'), 22, 'bajar la 20 es quedar antes de la 22');
  assert.equal(antesDeAlMover(c, 21, 'abajo'), null, 'bajar la anteúltima es ir al final');
  assert.equal(antesDeAlMover(c, 20, 'arriba'), undefined);
  assert.equal(antesDeAlMover(c, 22, 'abajo'), undefined);
});

// ── Lo que se ESCRIBE ───────────────────────────────────────────────────────────────
test('qué se puede ajustar, y qué vale cada cosa', () => {
  assert.ok(queValido({ objeto: 'curso', objetoId: '', campo: 'titulo' }));
  assert.equal(queValido({ objeto: 'curso', objetoId: 'x', campo: 'titulo' }), null);
  assert.equal(queValido({ objeto: 'modulo', objetoId: M1, campo: 'titulo' }), null, 'un módulo no tiene «titulo»: tiene nombre');
  assert.equal(queValido({ objeto: 'clase', objetoId: '12', campo: 'nombre' }), null);
  assert.equal(queValido({ objeto: 'grupo', objetoId: '', campo: 'titulo' }), null);
  assert.equal(queValido({ objeto: 'modulo', objetoId: '__proto__', campo: 'constructor' }), null);
  // La identidad de un módulo es TEXTO LIBRE: 91 caracteres con tildes (el grupo más largo del catálogo).
  const largo = 'Módulo 6 - Semana 6 - Plan de Contenidos + Content Series + Tendencias + Community Building';
  assert.ok(queValido({ objeto: 'modulo', objetoId: largo, campo: 'orden' }));
  assert.equal(queValido({ objeto: 'modulo', objetoId: 'con\nsalto', campo: 'orden' }), null);

  const q = (objeto: 'curso' | 'modulo' | 'clase', campo: string) => queValido({ objeto, objetoId: objeto === 'curso' ? '' : objeto === 'clase' ? '1' : M1, campo })!;
  assert.equal(sanearValor(q('curso', 'acento'), '#CDF13B'), null, 'el lima de la casa es el default: elegirlo es borrar la fila');
  assert.equal(sanearValor(q('curso', 'portada'), valorDeLamina({ diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: '' })), null,
    'la portada del curso no acepta láminas: no tiene número');
  assert.match(String(sanearValor(q('modulo', 'portada'), 'lam:nota:ffe66d:e4572e:Hola')), /^lam:nota:FFE66D:E4572E:Hola$/, 'la lámina, canónica');
  assert.equal(sanearValor(q('modulo', 'orden'), 3), '3');
  assert.equal(sanearValor(q('modulo', 'orden'), -1), null);
  assert.equal(sanearValor(q('modulo', 'oculto'), true), '1');
  assert.equal(sanearValor(q('modulo', 'oculto'), false), null, 'mostrar es borrar la fila');
  assert.equal(sanearValor(q('clase', 'titulo'), '  Uno\n dos  '), 'Uno dos');
  assert.equal(sanearValor(q('clase', 'titulo'), ''), null);

  assert.equal(filaLeida({ curso_slug: '', objeto: 'curso', objeto_id: '', campo: 'titulo', valor: 'x' }), null);
});

test('conCambios: pone y saca sin duplicar, y sólo en ese curso', () => {
  const base: FilaAjuste[] = [
    { curso_slug: 'demo', objeto: 'curso', objeto_id: '', campo: 'titulo', valor: 'A' },
    { curso_slug: 'otro', objeto: 'curso', objeto_id: '', campo: 'titulo', valor: 'B' },
  ];
  const r = conCambios(base, 'demo', {
    poner: [{ objeto: 'curso', objetoId: '', campo: 'titulo', valor: 'C' }],
    quitar: [{ objeto: 'curso', objetoId: '', campo: 'resumen' }],
  });
  assert.deepEqual(r.filter((f) => f.curso_slug === 'demo').map((f) => f.valor), ['C']);
  assert.deepEqual(r.filter((f) => f.curso_slug === 'otro').map((f) => f.valor), ['B']);
});

// ── Quién escribe ───────────────────────────────────────────────────────────────────
/** El cuerpo de cada `export async function` de un fuente, por nombre. */
function funciones(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /export async function (\w+)/g;
  const idx = [...src.matchAll(re)];
  idx.forEach((m, i) => {
    const fin = i + 1 < idx.length ? idx[i + 1].index! : src.length;
    out.set(m[1], src.slice(m.index!, fin));
  });
  return out;
}
/** La primera sentencia del cuerpo de una función (lo que sigue a la llave que abre el cuerpo). */
function primeraSentencia(cuerpo: string): string {
  const abre = cuerpo.indexOf('{', cuerpo.indexOf(')'));
  return cuerpo.slice(abre + 1).trim().split('\n')[0].trim();
}

// ROTURA: `guardarAjustes` sin el `getSesionAdmin()` de su primera línea → cae ESTE test.
test('cada función de datos que ESCRIBE pregunta getSesionAdmin() en su primera línea', () => {
  const src = sinComentarios(leer('lib/conocimiento-ajustes-datos.ts'));
  const fs = funciones(src);
  const escriben = [...fs].filter(([, c]) => /\.(upsert|insert|update|delete)\(/.test(c));
  assert.ok(escriben.length >= 1, 'no encontré ninguna función que escriba: el guard no está mirando nada');
  for (const [nombre, cuerpo] of escriben) {
    assert.match(primeraSentencia(cuerpo), /^const (\w+) = await getSesionAdmin\(\);$/, `${nombre}: la primera línea tiene que ser getSesionAdmin()`);
    assert.match(cuerpo, /if \(!\w+\) throw/, `${nombre}: sin super admin, no escribe`);
  }
  // Y la tabla es de la plataforma: no pasa por getTenantDb.
  assert.doesNotMatch(src, /getTenantDb/);
});

// ⚠️ BORRAR ES «VOLVER A LA FICHA» DE UN AJUSTE, y la clave son CUATRO columnas. Sin el `curso_slug`
//    en el filtro, «Nombre original» de un módulo o «Mostrar» de una clase borraba la misma fila de
//    TODOS los cursos (`curso / '' / titulo` es la misma clave en los 132): un clic deshacía el título
//    elegido de cada curso del catálogo, sin un error. Lo mismo el `onConflict` del upsert: con menos
//    columnas, un ajuste pisaría el de otro objeto.
// ROTURAS (08/10/2026, revisión final; scratchpad/rev-cono/romper.mjs): sin `.eq('curso_slug', slug)`
//    en el borrado → 18 / 1; el upsert con `onConflict: 'curso_slug,objeto,campo'` → 18 / 1. Sin romper: 19 / 0.
test('guardar borra y pisa por la clave ENTERA (curso, objeto, id y campo), nunca de más', () => {
  const src = sinComentarios(leer('lib/conocimiento-ajustes-datos.ts'));
  const guardar = funciones(src).get('guardarAjustes') ?? '';
  assert.ok(guardar.length > 0, 'no encontré guardarAjustes');
  const borrado = guardar.slice(guardar.indexOf('.delete()'), guardar.indexOf(';', guardar.indexOf('.delete()')));
  assert.ok(borrado.length > 0, 'no encontré el borrado: el guard no está mirando nada');
  for (const col of ['curso_slug', 'objeto', 'objeto_id', 'campo']) {
    assert.match(borrado, new RegExp(`\\.eq\\('${col}', `), `el borrado no filtra por ${col}: borraría ese ajuste en más de un lugar`);
  }
  assert.match(guardar, /onConflict: 'curso_slug,objeto,objeto_id,campo'/, 'el upsert pisa por la clave única entera (la de la mig 0221)');
});

// ROTURA: una acción sin el `getSesionAdmin()` de su primera línea → cae ESTE test.
test('cada acción del super admin pregunta getSesionAdmin() en su primera línea', () => {
  const crudo = leer('app/conocimientos/ajustes-actions.ts');
  assert.match(crudo.trimStart(), /^'use server';/);
  const fs = funciones(sinComentarios(crudo));
  assert.ok(fs.size >= 3, `esperaba las tres acciones y encontré ${fs.size}`);
  for (const [nombre, cuerpo] of fs) {
    assert.equal(primeraSentencia(cuerpo), 'const admin = await getSesionAdmin();', `${nombre}: la primera línea tiene que ser getSesionAdmin()`);
    assert.match(cuerpo, /if \(!admin\) return \{ ok: false/, `${nombre}: sin super admin, contesta que no`);
  }
});

test('la migración: sin workspace_id, con RLS, revoke y la clave única', () => {
  const nombre = readdirSync(join(RAIZ, 'supabase/migrations')).find((f) => /^0221_conocimiento_ajustes\.sql$/.test(f));
  assert.ok(nombre, 'falta supabase/migrations/0221_conocimiento_ajustes.sql');
  const sql = leer(`supabase/migrations/${nombre}`);
  const codigo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const tabla = codigo.slice(codigo.indexOf('create table'), codigo.indexOf(');', codigo.indexOf('create table')));
  assert.doesNotMatch(tabla, /workspace_id/, 'es de la PLATAFORMA: con workspace_id iría a TENANT_TABLES y el link compartido leería otro inquilino');
  assert.match(codigo, /enable row level security/);
  assert.match(codigo, /revoke all on conocimiento_ajustes from anon, authenticated/);
  assert.match(codigo, /unique index if not exists \w+ on conocimiento_ajustes \(curso_slug, objeto, objeto_id, campo\)/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  // Los campos de la base y los del código son los mismos.
  const campos = /campo in \(([^)]+)\)/.exec(codigo)![1].match(/'(\w+)'/g)!.map((x) => x.replace(/'/g, '')).sort();
  assert.deepEqual(campos, ['acento', 'modulo', 'nombre', 'oculta', 'oculto', 'orden', 'portada', 'resumen', 'titulo']);
});

// ── Los links compartidos: ven los ajustes y NO editan ──────────────────────────────
// ROTURAS: CursoCompartido sin `sembrar` · PortalCompartido volviendo al `find` crudo · la página
// pasándole el curso SIN ajustar a CursoCompartido · `conOcultos` en un link compartido.
test('los links compartidos aplican los ajustes, sin lo oculto y sin armar edición', () => {
  const pagina = sinComentarios(leer('app/compartido/[token]/page.tsx'));
  // Un curso suelto: se ajusta en el SERVER, sin lo oculto, y eso es lo que viaja.
  assert.match(pagina, /<CursoCompartido curso=\{aplicarAjustes\(base, filas\)\}/, 'el curso suelto viaja ya ajustado');
  // La tab: las filas viajan y se aplican allá.
  assert.match(pagina, /<PortalCompartido [^>]*ajustes=\{ajustes\}/);
  // La lectura es ESTRICTA (decide qué se oculta): si falla, el curso no se abre.
  assert.match(pagina, /catch \{ return <NoAbrio \/>; \}/);

  const publicos = ['app/compartido/[token]/CursoCompartido.tsx', 'app/compartido/[token]/PortalCompartido.tsx', 'app/compartido/[token]/page.tsx'];
  for (const p of publicos) {
    const src = sinComentarios(leer(p));
    assert.doesNotMatch(src, /conOcultos/, `${p}: a un tercero no le llega lo oculto`);
    assert.doesNotMatch(src, /\bedicion=/, `${p}: un link compartido no edita`);
    assert.doesNotMatch(src, /EditorConocimientos|ajustes-actions|getSesionAdmin/, `${p}: nada de lo que edita`);
  }
  const portal = sinComentarios(leer('app/compartido/[token]/PortalCompartido.tsx'));
  assert.match(portal, /aplicarAjustes\(base, ajustes\)/);
  assert.match(portal, /buscarCompartible\(pos\.curso\)/, 'salta los slugs reemplazados, como el admin');
  assert.doesNotMatch(portal, /CURSOS_COMPARTIBLES\.find/);
  const uno = sinComentarios(leer('app/compartido/[token]/CursoCompartido.tsx'));
  assert.match(uno, /useEffect\(\(\) => \{ sembrar\(\{\}\); \}, \[\]\);/, 'sin sembrar, un F5 abre el índice');
});

// ── Lo oculto no viaja en el BUNDLE de un link de UN curso ──────────────────────────
// Turbopack arma UN juego de chunks para todos los componentes cliente de una página (medido en el
// build del 08/10/2026: CursoCompartido, Galeria, AnalisisCompartido y PortalCompartido colgaban de
// los mismos 8 chunks, uno de 3,9 MB con el catálogo). El curso suelto viajaba ajustado en las props
// y el catálogo CRUDO al lado, con lo oculto adentro. La tab va perezosa
// (app/compartido/[token]/PortalCompartidoPerezoso.tsx) y esto recorre el grafo ESTÁTICO de cada
// componente cliente que la página importa: ninguno puede llegar al catálogo. Un `import()` dinámico
// no se sigue: es justamente lo que lo saca del chunk de la página.
//
// ROTURAS (08/10/2026, revisión final; scratchpad/rev-cono/romper.mjs, que restaura desde memoria): la
// página importando `./PortalCompartido` directo → 17 / 1; el perezoso con un `import` estático en vez
// de `dynamic` → 17 / 1 («PortalCompartidoPerezoso.tsx → PortalCompartido.tsx → catalogo.ts»);
// CursoConocimientos importando `CURSOS_TODOS` → 17 / 1, por la rama de CursoCompartido. Sin romper: 18 / 0.
const CATALOGO = 'app/conocimientos/catalogo.ts';
/** El archivo al que resuelve un import (relativo o `@/`), o null si es un paquete. */
function resolver(desde: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = join(desde, '..', spec).replace(/\\/g, '/');
  else return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    try { readFileSync(join(RAIZ, base + ext)); if (/\.tsx?$/.test(base + ext)) return base + ext; } catch { /* sigue */ }
  }
  return null;
}
/** Los imports ESTÁTICOS que traen valores (sin `import type`, sin `import()`), resueltos a archivos del repo. */
function importsDeValor(archivo: string): string[] {
  const src = sinComentarios(leer(archivo));
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?'([^']+)'/gm)) {
    const r = resolver(archivo, m[2]);
    if (r) out.push(r);
  }
  return out;
}
/** Desde `inicio`, el camino de imports estáticos hasta `meta`, o null si no se llega. */
function caminoHasta(inicio: string, meta: string): string[] | null {
  const vistos = new Set<string>();
  const pila: string[][] = [[inicio]];
  while (pila.length) {
    const camino = pila.pop()!;
    const actual = camino[camino.length - 1];
    if (actual === meta) return camino;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    for (const sig of importsDeValor(actual)) pila.push([...camino, sig]);
  }
  return null;
}
test('el link de UN curso no baja el catálogo: nada del grafo cliente de la página llega a él', () => {
  const pagina = 'app/compartido/[token]/page.tsx';
  const clientes = importsDeValor(pagina).filter((f) => /^\s*'use client'/.test(leer(f).replace(/^﻿/, '')));
  assert.ok(clientes.some((f) => f.endsWith('/CursoCompartido.tsx')), `no encontré CursoCompartido entre los importados: ${clientes.join(', ')}`);
  assert.ok(clientes.some((f) => f.endsWith('/PortalCompartidoPerezoso.tsx')), 'la tab tiene que entrar por el perezoso');
  for (const c of clientes) {
    const camino = caminoHasta(c, CATALOGO);
    assert.equal(camino, null, `el catálogo viaja en el chunk de la página: ${camino?.join(' → ')}`);
  }
  // Y el perezoso de verdad lo es: `dynamic` sobre la tab, no un import estático.
  const perezoso = sinComentarios(leer('app/compartido/[token]/PortalCompartidoPerezoso.tsx'));
  assert.match(perezoso, /dynamic\(\(\) => import\('\.\/PortalCompartido'\)\)/);
  // El guard mira algo: la tab, recorrida igual, SÍ llega al catálogo.
  assert.ok(caminoHasta('app/compartido/[token]/PortalCompartido.tsx', CATALOGO), 'el recorrido no ve el import del catálogo: el guard no está mirando nada');
});

// ROTURA: Conocimientos montando el editor sin preguntar `puedeEditar` → cae ESTE test.
test('quién edita lo decide el SERVER, y el editor lo monta una sola pantalla', () => {
  const pagina = sinComentarios(leer('app/conocimientos/page.tsx'));
  assert.match(pagina, /const admin = await getSesionAdmin\(\);/);
  assert.match(pagina, /puedeEditar=\{!!admin\}/);
  const cono = sinComentarios(leer('app/conocimientos/Conocimientos.tsx'));
  assert.match(cono, /puedeEditar && !errorAjustes \? \(\s*<EditorConocimientos/, 'el editor, sólo si el server dijo que se puede');
  // Nadie más lo importa: el código de editar no llega a otra pantalla.
  const quienes: string[] = [];
  const barrer = (dir: string) => {
    for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const r = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') barrer(r); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      if (/from '[^']*EditorConocimientos'/.test(sinComentarios(leer(r)))) quienes.push(r);
    }
  };
  barrer('app');
  assert.deepEqual(quienes, ['app/conocimientos/Conocimientos.tsx']);
});
