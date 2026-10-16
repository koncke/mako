// =============================================================================
// MaKo Mobile — «Curso» (app/m/curso): lo que se rompe sin un error
// =============================================================================
// La pantalla destila app/customer-success/curso (AGENTS.md, «MaKo Mobile (/m)»: mismas vistas, mismo
// orden, mismos rótulos). Esto fija:
//   · cada rótulo que el teléfono repite SIGUE, ENTERO, en su archivo de escritorio (la tabla de orígenes
//     va escrita a mano: una tabla que se recorre a sí misma no ve una fila borrada);
//   · la fila de una clase dice lo MISMO que la tarjeta de escritorio (sus chips, con el candado al final),
//     y lo privado lleva su marca;
//   · Público | Privado guarda lo MISMO que el menú «…» de escritorio (`bloqueoPublico`/`privadoInicial`);
//   · los módulos van en el orden de escritorio, las clases en su `orden` (el fixture llega DESORDENADO) y
//     las huérfanas en «Sin módulo», al final y sin el chip «Obligatoria» (no cierran ninguna etapa);
//   · el avance de una clase cuenta SÓLO a los alumnos del producto, con las reglas del portal
//     (`claseCompleta`, `PCT_VISTO`), y un video que no se mide dice «Sin medir», nunca «0 de N»;
//   · el curso de `?producto=` se valida contra los cursos (un `12abc` no abre nada raro);
//   · la página: su guard, nada del `?ws=`, la action y las reglas de escritorio sin copia en /m;
//   · el CSS de la carpeta (prefijo entero y tokens que existen), los íconos que existen y cero voseo.
// Que la página dibuje adentro de <PantallaM> lo fija tests/movil-refrescar.test.ts; que exista con su
// guard, tests/movil-mas-secciones.test.ts.
//
// Verificado ROMPIÉNDOLO (16/10/2026, base 8 / 0), de a una con un script que muta, corre y devuelve
// el archivo:
//   · R.seAbre = 'Se abre el'                                                         → 7 / 1
//   · segundaDe sin el candado (`partes = c.chips`)                                   → 7 / 1
//   · bloqueoDeAcceso('privado') devolviendo { tipo: 'manual' }                        → 7 / 1
//   · cursoDatos filtrando por etapa sin `porEtapas` (las clases en el orden que llegan) → 7 / 1
//   · avanceDeClase recorriendo `progreso.keys()` (todos los leads, no los alumnos)    → 7 / 1
//   · filasAvance con «0 de N» para un video que no se mide                            → 7 / 1
//   · productoElegido con `parseInt(param)` ('12abc' abría el 12)                       → 7 / 1
//   · CursoM.tsx con su propia `function accesoDe` (una copia en /m)                    → 7 / 1
//   · curso.css con `.m-cu-x` (prefijo abreviado)                                     → 7 / 1
//   · curso.css con `var(--curso-fondo)` (no existe)                                  → 7 / 1
//   · un «Tocá» en un rótulo de CursoM.tsx                                            → 7 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Clase, Progreso } from '../lib/curso';
import { bloqueoPublico, privadoInicial } from '../app/customer-success/curso/bloqueo-editor';
import {
  R, accesoDeClase, avanceDeClase, bloqueoDeAcceso, claseDatos, cursoDatos, filasAvance, iconoDeClase, productoElegido,
  rotuloClases, seAbreDe, segundaDe,
} from '../app/m/curso/modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` dentro de un `//` se comería código). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CARPETA = 'app/m/curso';
const FUENTES = readdirSync(join(RAIZ, CARPETA)).filter((n) => /\.tsx?$/.test(n)).map((n) => `${CARPETA}/${n}`);

/** De qué archivo de escritorio sale cada rótulo de `R`. A MANO: si se agrega uno a R, se agrega acá. */
const ORIGEN: Record<keyof typeof R, string> = {
  curso: 'app/customer-success/curso/CursoApp.tsx',
  cursos: 'app/customer-success/curso/CursoApp.tsx',
  acceso: 'app/customer-success/curso/MenuCurso.tsx',
  publico: 'app/customer-success/curso/MenuCurso.tsx',
  privado: 'app/customer-success/curso/MenuCurso.tsx',
  seAbre: 'app/customer-success/curso/MenuCurso.tsx',
  accesoCambiado: 'app/customer-success/curso/CursoApp.tsx',
  noSeGuardo: 'app/customer-success/curso/CursoApp.tsx',
  sinModulo: 'app/customer-success/curso/modelo-ugc.ts',
  visto: 'app/customer-success/curso/FilaAvance.tsx',
  sinClientes: 'app/customer-success/curso/AvanceCurso.tsx',
  sinAvance: 'app/customer-success/curso/AvanceCurso.tsx',
  sinServicios: 'app/customer-success/curso/CursoApp.tsx',
  irAClientes: 'app/customer-success/curso/CursoApp.tsx',
  sinLeerServicios: 'app/customer-success/curso/CursoApp.tsx',
};

let sec = 0;
/** Una clase de la base, con lo mínimo. `orden` y `etapa` deciden dónde va. */
function clase(p: Partial<Clase> & { id: number }): Clase {
  sec += 1;
  return {
    productoId: 7, etapa: 'onboarding', orden: sec, titulo: `Clase ${p.id}`, descripcion: '', tipo: 'clase', minutos: null,
    videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, bloqueo: null,
    ...p,
  };
}
const YOUTUBE = { videoTipo: 'youtube' as const, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
const DRIVE = { videoTipo: 'drive' as const, videoUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view' };
function prog(claseId: number, p: Partial<Progreso>): Progreso {
  return { claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...p };
}

test('cada rótulo que el teléfono repite sigue, ENTERO, en su archivo de escritorio', () => {
  assert.deepEqual(Object.keys(ORIGEN).sort(), Object.keys(R).sort(), 'R y la tabla de orígenes no nombran lo mismo');
  for (const [k, archivo] of Object.entries(ORIGEN) as [keyof typeof R, string][]) {
    const t = escapar(R[k]);
    // Delimitado: entre comillas, o como texto de JSX (`>…<`, o `>… {` antes de una expresión).
    const entero = new RegExp(`['"\`]${t}['"\`]|>\\s*${t}\\s*[<{]`);
    assert.match(leer(archivo), entero, `«${R[k]}» (R.${k}) ya no está entero en ${archivo}`);
  }
});

test('la fila de una clase: los chips de la tarjeta de escritorio, el candado al final, y su baldosa', () => {
  const titulos = (id: number) => (id === 41 ? 'El embudo' : null);
  const conTarea = claseDatos(clase({ id: 1, tarea: 'Contesta', obligatoria: true, minutos: 12 }), true);
  assert.equal(segundaDe(conTarea, titulos), 'Sin video · Tarea · Obligatoria');
  assert.equal(iconoDeClase(conTarea), 'notepencil');
  // En un módulo suelto la marca no cierra nada: sin «Obligatoria» (chipsDelEditor).
  assert.equal(segundaDe(claseDatos(clase({ id: 2, tarea: 'Contesta', obligatoria: true }), false), titulos), 'Sin video · Tarea');

  const privada = claseDatos(clase({ id: 3, ...YOUTUBE, bloqueo: { tipo: 'tarea', claseId: 41 } }), true);
  assert.equal(segundaDe(privada, titulos), 'Al terminar «El embudo»');
  assert.equal(iconoDeClase(privada), 'eye-off');
  const sinMedir = claseDatos(clase({ id: 4, ...DRIVE }), true);
  assert.equal(segundaDe(sinMedir, titulos), 'Sin medir');
  assert.equal(iconoDeClase(sinMedir), 'play');
  assert.equal(segundaDe(claseDatos(clase({ id: 5, ...YOUTUBE }), true), titulos), undefined);
  assert.deepEqual([0, 1, 3].map(rotuloClases), ['Sin clases', '1 clase', '3 clases']);
});

test('Público | Privado guarda lo mismo que el menú «…» de escritorio, y «Se abre» lo dice', () => {
  assert.deepEqual(bloqueoDeAcceso('publico'), bloqueoPublico('clase'));
  assert.deepEqual(bloqueoDeAcceso('privado'), privadoInicial('clase'));
  assert.deepEqual(bloqueoDeAcceso('privado'), { tipo: 'anterior' });
  assert.equal(accesoDeClase({ bloqueo: null }), 'publico');
  assert.equal(accesoDeClase({ bloqueo: { tipo: 'abierto' } }), 'publico');
  assert.equal(accesoDeClase({ bloqueo: { tipo: 'manual' } }), 'privado');
  const sinTitulo = () => null;
  assert.equal(seAbreDe({ bloqueo: null }, sinTitulo), null);
  assert.equal(seAbreDe({ bloqueo: { tipo: 'manual' } }, sinTitulo), 'A mano');
  assert.equal(seAbreDe({ bloqueo: { tipo: 'dias', dias: 7 } }, sinTitulo), '7 días después de entrar');
});

test('los módulos en su orden, las clases en su `orden`, y las huérfanas en «Sin módulo» al final', () => {
  // DESORDENADO a propósito: con las clases en el orden en que llegan, este test tiene que fallar.
  const clases = [
    clase({ id: 13, etapa: 'primeras', orden: 2 }),
    clase({ id: 11, etapa: 'onboarding', orden: 1, tarea: 'x', obligatoria: true }),
    clase({ id: 99, etapa: 'borrada', orden: 0, tarea: 'x', obligatoria: true }),
    clase({ id: 12, etapa: 'primeras', orden: 1 }),
    clase({ id: 10, etapa: 'onboarding', orden: 0 }),
  ];
  const c = cursoDatos({
    productoId: 7, nombre: 'Programa', errorClases: false, alumnos: null, progreso: null, clases,
    modulos: [{ clave: 'onboarding', nombre: 'Onboarding', vinculado: true }, { clave: 'primeras', nombre: 'Primeras clases', vinculado: false }],
  });
  assert.deepEqual(c.modulos.map((m) => [m.nombre, m.clases.map((x) => x.id)]), [
    ['Onboarding', [10, 11]], ['Primeras clases', [12, 13]], [R.sinModulo, [99]],
  ]);
  assert.equal(c.modulos[2].sinModulo, true);
  assert.deepEqual(c.modulos[0].clases[1].chips, ['Sin video', 'Tarea', 'Obligatoria']);
  assert.deepEqual(c.modulos[2].clases[0].chips, ['Sin video', 'Tarea'], 'una huérfana no cierra ninguna etapa');
  assert.equal(c.avance, null, 'sin el avance leído no hay números (no es «nadie empezó»)');
});

test('el avance de una clase: sólo los alumnos del producto, con las reglas del portal', () => {
  const conTarea = clase({ id: 20, tarea: 'Contesta', ...YOUTUBE });
  const sinTarea = clase({ id: 21, ...YOUTUBE });
  const drive = clase({ id: 22, ...DRIVE });
  const progreso = new Map<number, Map<number, Progreso>>([
    [1, new Map([[20, prog(20, { estado: 'enviada', pct: 40 })], [21, prog(21, { pct: 95 })], [22, prog(22, { hechaAt: '2026-10-10T10:00:00Z' })]])],
    [2, new Map([[20, prog(20, { estado: 'aprobada', pct: 92 })], [21, prog(21, { hechaAt: '2026-10-11T10:00:00Z', pct: 10 })]])],
    [3, new Map([[20, prog(20, { estado: 'pendiente', pct: 100 })]])],
    // El 4 no es alumno de este producto: no cuenta aunque haya hecho todo.
    [4, new Map([[20, prog(20, { estado: 'enviada', pct: 100 })], [21, prog(21, { pct: 100 })], [22, prog(22, { hechaAt: '2026-10-12T10:00:00Z' })]])],
  ]);
  const alumnos = [1, 2, 3];
  assert.deepEqual(avanceDeClase(conTarea, alumnos, progreso), { terminadas: 2, vistos: 2 });
  assert.deepEqual(avanceDeClase(sinTarea, alumnos, progreso), { terminadas: 2, vistos: 1 });
  assert.deepEqual(avanceDeClase(drive, alumnos, progreso), { terminadas: 1, vistos: null });

  const c = cursoDatos({
    productoId: 7, nombre: 'Programa', errorClases: false, alumnos, progreso, clases: [conTarea, drive],
    modulos: [{ clave: 'onboarding', nombre: 'Onboarding', vinculado: true }],
  });
  const [a, d] = c.modulos[0].clases.slice().sort((x, y) => x.id - y.id);
  assert.deepEqual(filasAvance(a, c.avance), [{ k: 'Terminada', v: '2 de 3' }, { k: R.visto, v: '2 de 3' }]);
  assert.deepEqual(filasAvance(d, c.avance), [{ k: 'Terminada', v: '1 de 3' }, { k: R.visto, v: 'Sin medir' }]);
  assert.deepEqual(filasAvance(claseDatos(clase({ id: 23, tarea: 'x' }), true), c.avance), [{ k: 'Terminada', v: '0 de 3' }]);
  assert.equal(filasAvance(a, null), 'error');
  assert.equal(filasAvance(a, { alumnos: 0, porClase: {} }), 'vacio');
});

test('el curso de `?producto=`: uno de éstos, o el primero', () => {
  const cursos = [{ productoId: 7 }, { productoId: 12 }];
  assert.equal(productoElegido(cursos, '12'), 12);
  assert.equal(productoElegido(cursos, '12abc'), 7);
  assert.equal(productoElegido(cursos, '99'), 7, 'un producto que no es de esta cartera no abre nada');
  assert.equal(productoElegido(cursos, null), 7);
  assert.equal(productoElegido([], '7'), null);
});

test('la página: su guard, nada del ?ws=, y la action y las reglas de escritorio sin copia en /m', () => {
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /requireMovil\(\{ navKey: 'cs-curso' \}\)/);
  const pantalla = sinComentarios(leer(`${CARPETA}/CursoM.tsx`));
  assert.match(pantalla, /import \{ guardarBloqueoAction \} from '@\/app\/customer-success\/curso\/modulos-actions'/);
  const datos = sinComentarios(leer(`${CARPETA}/datos.ts`));
  for (const f of ['carteraEnEntrega()', 'clasesDelProducto(', 'progresoDeClientes(', 'derivarModulos(', 'esDelProducto(', 'nombresDeCursos(ids, { conTitulo: true })']) {
    assert.ok(datos.includes(f), `datos.ts ya no lee con ${f} (la lectura de escritorio)`);
  }
  for (const f of FUENTES) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /\bsp\.ws\b|get\('ws'\)|searchParams\.ws\b/, `${f} lee el workspace de la URL`);
    assert.doesNotMatch(src, /function (chipsDelEditor|chipDeBloqueo|accesoDe|bloqueoPublico|privadoInicial|porEtapas|claseCompleta|rotuloDeBloqueo)\b/,
      `${f} tiene su copia de una regla de escritorio`);
  }
});

test('el CSS de la carpeta, los íconos y el copy', () => {
  const css = sinComentarios(leer(`${CARPETA}/curso.css`));
  const primitivas = leer('app/m/m.css') + leer('app/_ui/ui.css');
  const clases = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  assert.ok(clases.size >= 6, 'no se leyó ninguna clase');
  for (const c of clases) {
    if (c.startsWith('m-curso-')) continue;
    assert.match(primitivas, new RegExp(`\\.${escapar(c)}(?![\\w-])`), `.${c}: ni lleva .m-curso- ni es una primitiva`);
  }
  const globales = leer('app/globals.css');
  const tokens = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  assert.ok(tokens.size >= 4, 'no se leyó ningún token');
  for (const t of tokens) assert.match(globales, new RegExp(`--${escapar(t)}\\s*:`), `var(--${t}) no existe en app/globals.css`);

  const iconos = leer('app/_components/icons.tsx');
  const todas = FUENTES.map((f) => sinComentarios(leer(f))).join('\n');
  const usados = new Set([
    ...[...todas.matchAll(/<Icon name="([\w-]+)"/g)].map((m) => m[1]),
    ...['eye-off', 'play', 'notepencil'],
  ]);
  for (const n of usados) assert.match(iconos, new RegExp(`^\\s*'?${escapar(n)}'?\\s*:`, 'm'), `<Icon name="${n}"> no existe: dibuja un punto`);
  // Lo que devuelve iconoDeClase está en la lista de arriba (si se suma uno, se suma ahí).
  assert.match(sinComentarios(leer(`${CARPETA}/modelo.ts`)), /'eye-off' \| 'play' \| 'notepencil'/);

  // Español neutro con tú: ningún voseo en lo que se dibuja.
  const VOSEO = /(?<![\wáéíóúñ])(tocá|mirá|tenés|podés|querés|elegí|escribí|hacé|andá|fijate|contá|probá|abrí|sabés|decí|poné|usá|guardá)(?![\wáéíóúñ])/i;
  for (const f of FUENTES) {
    for (const m of sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|>([^<>{}\n]+)</g)) {
      const t = m[1] ?? m[2] ?? m[3] ?? '';
      assert.doesNotMatch(t, VOSEO, `${f}: voseo en «${t.trim()}»`);
    }
  }
});
