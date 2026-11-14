// =============================================================================
// Classroom en MaKo Esencial: UN curso, y la comunidad de los alumnos es de Pro (14/11/2026)
// =============================================================================
// Martín: «no pusiste nada de la parte de Classroom, la parte de comunidad… seas más limitado en el de 47». La tabla ya lo
// decía (lib/topes-plan.ts: 'classroom.cursos' 1 en Esencial, sin tope en Pro; 'comunidad' en `FUNCIONES_SOLO_PRO`); esto fija
// que el CÓDIGO lo cumpla:
//   1. QUÉ ES UN CURSO (no hay tabla `cursos`): un programa de Classroom con al menos una clase viva. Lo crean la primera
//      clase de un programa vacío y duplicar uno con clases (lib/tope-cursos-reglas.ts, puro).
//   2. Las puertas que crean un curso preguntan el tope ANTES de escribir: la pantalla y la API, al crear la clase y al
//      duplicar. Y son las ÚNICAS que insertan en `curso_clases` (una puerta nueva sin tope da rojo acá).
//   3. La comunidad: la pantalla del negocio (escritorio y teléfono) muestra el candado; crear un post o un evento lo frena
//      el server (`publicarPost`, `guardarEvento` sin id: por ahí pasan las acciones del equipo, la ruta del alumno, la tarea
//      «Publicar en la comunidad» y la API); el portal del alumno no ofrece la entrada. SIEMPRE por el plan del NEGOCIO
//      dueño (`esEsencialDe(ws)`), nunca la sesión. Los comentarios de una clase quedan: son del curso.
//
// PROBADO ROMPIÉNDOLO (14/11/2026, una rotura por vez y restaurada): ver el pie del archivo.
// Correr: node --import tsx --test tests/classroom-topes-esencial.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TOPES, textoSoloPro, textoTope } from '../lib/topes-plan';
import { creaUnCurso, topeParaCursoNuevo } from '../lib/tope-cursos-reglas';
import { TEXTO_COMUNIDAD_CERRADA_ALUMNO, TEXTO_COMUNIDAD_SOLO_PRO_TELEFONO, textoCandadoComunidad } from '../lib/comunidad-solo-pro';
import { ofreceComunidad } from '../app/compartido/curso/[token]/modelo-ugc';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** El cuerpo de una función (hasta la siguiente declaración de nivel superior). */
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?(?:async )?function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

/** El runner `id` de un área de la API (desde `  id: {` hasta el próximo runner de dos espacios). */
function runner(rel: string, id: string): string {
  const src = fuente(rel);
  const i = src.indexOf(`\n  ${id}: {`);
  assert.ok(i >= 0, `no encontré el runner ${id} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.slice(3).search(/\n {2}[a-z_]+: \{/);
  return fin > 0 ? resto.slice(0, fin + 3) : resto;
}

/** Todos los .ts/.tsx de una carpeta (sin node_modules). */
function codigo(dir: string): string[] {
  const out: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.tsx?$/.test(n)) out.push(relative(RAIZ, p).replace(/\\/g, '/'));
    }
  };
  andar(join(RAIZ, dir));
  return out;
}

// ── 1. La regla pura ───────────────────────────────────────────────────────────────────────────────────────────────

test('1. la tabla: Esencial un curso, Pro sin tope', () => {
  assert.equal(TOPES.completo['classroom.cursos'], 1);
  assert.equal(TOPES.agencia['classroom.cursos'], null);
});

test('2. qué crea un curso: la primera clase de un programa vacío, o duplicar uno con clases', () => {
  assert.equal(creaUnCurso('clase', false), true, 'la primera clase de un programa vacío');
  assert.equal(creaUnCurso('clase', true), false, 'una clase más en el curso que ya existe');
  assert.equal(creaUnCurso('duplicar', true), true, 'la copia de un curso es otro curso');
  assert.equal(creaUnCurso('duplicar', false), false, 'la copia de un programa vacío nace vacía');
});

test('3. el tope: frena SÓLO el segundo curso del Esencial, nunca lo que ya tiene, y nunca al Pro', () => {
  const tope = { ok: false, tope: 1, texto: textoTope(1) };
  // El primer curso, siempre.
  assert.deepEqual(topeParaCursoNuevo({ esencial: true, como: 'clase', programaConClases: false, otrosCursos: 0 }), { ok: true });
  // El segundo: el texto del tope (con «Pasa a MaKo Pro»).
  assert.deepEqual(topeParaCursoNuevo({ esencial: true, como: 'clase', programaConClases: false, otrosCursos: 1 }), tope);
  // Duplicar el único curso que tiene = el segundo.
  assert.deepEqual(topeParaCursoNuevo({ esencial: true, como: 'duplicar', programaConClases: true, otrosCursos: 0 }), tope);
  // Duplicar un programa vacío no crea un curso.
  assert.deepEqual(topeParaCursoNuevo({ esencial: true, como: 'duplicar', programaConClases: false, otrosCursos: 5 }), { ok: true });
  // Quien ya tenía tres cursos (de antes del tope) sigue armando los tres: una clase en un curso que existe no se frena.
  assert.deepEqual(topeParaCursoNuevo({ esencial: true, como: 'clase', programaConClases: true, otrosCursos: 2 }), { ok: true });
  // El Pro (y el ws1, la plataforma, los acuerdos a mano: `esEncial` false), nunca.
  assert.deepEqual(topeParaCursoNuevo({ esencial: false, como: 'clase', programaConClases: false, otrosCursos: 9 }), { ok: true });
  assert.deepEqual(topeParaCursoNuevo({ esencial: false, como: 'duplicar', programaConClases: true, otrosCursos: 9 }), { ok: true });
  assert.match(textoTope(1), /tope de tu plan \(1\)\. Pasa a MaKo Pro/);
});

// ── 2. Con la base, y las puertas ─────────────────────────────────────────────────────────────────────────────────

test('4. lib/tope-cursos.ts: el plan del negocio, clases VIVAS, los programas que Classroom muestra, y ante la duda pasa', () => {
  const src = fuente('lib/tope-cursos.ts');
  assert.match(src, /if \(!\(await esEsencialDe\(ws\)\)\) return null;/, 'el plan del negocio (sin lib/cobros en el grafo), lo primero');
  assert.match(src, /from\('curso_clases'\)\.select\('id'\)\.eq\('producto_id', productoId\)\.is\('borrada_at', null\)\.limit\(1\)/,
    'un curso es un programa con al menos una clase VIVA: las de la papelera no cuentan');
  assert.match(src, /if \(!creaUnCurso\(como, programaConClases\)\) return null;/, 'sin curso nuevo no se cuenta nada');
  assert.match(src, /\(await productosDeLaEntrega\(\)\)\.map\(\(p\) => p\.id\)\.filter\(\(id\) => id !== productoId\)/,
    'los OTROS programas que Classroom muestra (uno eliminado en el CRM ya no cuenta)');
  assert.match(src, /\} catch \(e\) \{\n[^\n]*sin tope[^\n]*\n {4}return null;/, 'si algo no se puede leer, pasa');
  assert.doesNotMatch(src, /esEsencialDeLaSesion/, 'decide el negocio que se le pasa, no la sesión (la API no tiene)');
});

test('5. las puertas que crean un curso preguntan el tope ANTES de escribir (la pantalla y la API)', () => {
  // La pantalla: «+ Clase».
  const crear = cuerpo('app/customer-success/curso/modulos-actions.ts', 'crearClaseAction');
  assert.match(crear, /const tope = ws == null \? null : await frenoAlCrearClase\(ws, Number\(productoId\)\);\n\s*if \(tope\) return \{ ok: false, error: tope\.texto, pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \};\n\s*return await crearClase\(/,
    'crearClaseAction: el tope, y recién después crearClase');
  // La pantalla: «Duplicar».
  const dup = cuerpo('app/customer-success/actions.ts', 'duplicarServicioAction');
  assert.ok(dup.indexOf('frenoAlDuplicar(ws, Number(productoId))') > 0 && dup.indexOf('frenoAlDuplicar(') < dup.indexOf('duplicarPrograma('),
    'duplicarServicioAction: el tope antes de duplicar');
  assert.match(dup, /if \(tope\) return \{ ok: false, error: tope\.texto, pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \};/);
  // La API: al proponer Y al confirmar (entre los dos pudo nacer otro curso).
  const RUN = 'lib/api-mako/areas/curso.run.ts';
  const clase = runner(RUN, 'crear_clase_curso');
  assert.match(clase, /preparar: revisando\(async \(input, ctx\) => \{[\s\S]*const tope = await frenoAlCrearClase\(ctx\.ws, productoId\);\n\s*if \(tope\) return \{ error: tope\.texto \};/);
  assert.match(clase, /ejecutar: sinLanzar\('crear la clase', async \(p, ctx\) => \{[\s\S]*const tope = await frenoAlCrearClase\(ctx\.ws, productoId\);\n\s*if \(tope\) return \{ ok: false, resumen: tope\.texto \};\n\s*const r = await crearClase\(/);
  const dupApi = runner(RUN, 'duplicar_curso');
  assert.match(dupApi, /preparar: revisando\(async \(input, ctx\) => \{[\s\S]*const tope = await frenoAlDuplicar\(ctx\.ws, productoId!\);\n\s*if \(tope\) return \{ error: tope\.texto \};/);
  assert.match(dupApi, /const tope = await frenoAlDuplicar\(ctx\.ws, Number\(p\.productoId\)\);\n\s*if \(tope\) return \{ ok: false, resumen: tope\.texto \};\n\s*const r = await duplicarPrograma\(/);
});

test('6. son las ÚNICAS puertas: nadie más inserta clases, ni llama a crearClase o duplicarPrograma sin el tope', () => {
  const archivos = [...codigo('app'), ...codigo('lib')];
  // Quién INSERTA en curso_clases (un `.insert(` en la misma cadena que `from('curso_clases')`).
  const insertan = archivos.filter((rel) => /from\('curso_clases'\)\s*\.insert\(/.test(fuente(rel))).sort();
  assert.deepEqual(insertan, ['lib/curso-admin.ts', 'lib/curso-duplicar.ts'],
    'una puerta nueva que crea clases pasa por lib/tope-cursos.ts (y se suma acá con su porqué)');
  const admin = fuente('lib/curso-admin.ts');
  assert.equal((admin.match(/from\('curso_clases'\)\s*\.insert\(/g) ?? []).length, 2, 'crearClase y guardarClase, nada más');
  // Quién llama a las funciones que insertan.
  const llaman = (fn: string) => archivos.filter((rel) => new RegExp(`(?<![\\w.])${fn}\\(`).test(fuente(rel).replace(new RegExp(`function ${fn}\\(`, 'g'), '')));
  assert.deepEqual(llaman('crearClase').sort(), ['app/customer-success/curso/modulos-actions.ts', 'lib/api-mako/areas/curso.run.ts']);
  assert.deepEqual(llaman('duplicarPrograma').sort(), ['app/customer-success/actions.ts', 'lib/api-mako/areas/curso.run.ts']);
  // `guardarClase` (la del editor viejo) no la llama nadie: si vuelve a tener un llamador, ése necesita el tope.
  assert.deepEqual(llaman('guardarClase'), [], 'guardarClase inserta clases: un llamador nuevo pasa por frenoAlCrearClase');
});

test('7. la pantalla: el tope no es un error rojo, es el plan, con «Pasar a Pro»', () => {
  const app = fuente('app/customer-success/curso/CursoApp.tsx');
  assert.match(app, /if \(!r\.ok && 'pasarAPro' in r && r\.pasarAPro\) \{ show\(<TextoConPasarAPro texto=\{r\.error\} \/>, undefined, 'warn'\); return; \}/);
  const shell = fuente('app/classroom/ClientsShell.tsx');
  assert.match(shell, /if \(!r\.ok && 'pasarAPro' in r && r\.pasarAPro\) \{ show\(<TextoConPasarAPro texto=\{r\.error\} \/>, undefined, 'warn'\); return; \}/);
  const cartel = fuente('app/_components/CartelSoloPro.tsx');
  assert.equal((cartel.match(/<CtaPasarAPro>/g) ?? []).length, 2, 'los dos «Pasar a Pro» van por CtaPasarAPro (el cliente de una agencia no compra)');
  assert.match(cartel, /esTelefono\(navigator\.userAgent\)/, 'el teléfono no vende (T5): sin link');
  assert.match(cartel, /href=\{RUTA_CAMBIAR_PLAN\}/);
});

// ── 3. La comunidad ───────────────────────────────────────────────────────────────────────────────────────────────

test('8. los textos: el equipo lee el candado de Pro; el alumno, que no está abierta; el teléfono no vende', () => {
  assert.equal(textoCandadoComunidad(true), textoSoloPro('comunidad'));
  assert.equal(textoSoloPro('comunidad'), 'La comunidad de tus alumnos es de MaKo Pro. Pasa a Pro para usarlo.');
  assert.equal(textoCandadoComunidad(false), TEXTO_COMUNIDAD_CERRADA_ALUMNO);
  assert.doesNotMatch(TEXTO_COMUNIDAD_CERRADA_ALUMNO, /Pro|plan/, 'el plan no es del alumno: no se le vende');
  assert.ok(textoSoloPro('comunidad').startsWith(TEXTO_COMUNIDAD_SOLO_PRO_TELEFONO), 'el del teléfono es el mismo, sin vender');
  assert.doesNotMatch(TEXTO_COMUNIDAD_SOLO_PRO_TELEFONO, /Pasa a Pro/);
});

test('9. crear un post y crear un evento: el candado en el server, por el plan del negocio dueño (nunca la sesión)', () => {
  const datos = fuente('lib/comunidad-datos.ts');
  assert.match(cuerpo('lib/comunidad-datos.ts', 'candadoDeComunidad'), /return \(await esEsencialDe\(a\.ws\)\) \? textoCandadoComunidad\(a\.equipo\) : null;/,
    'el negocio dueño de la comunidad (`a.ws`): el alumno no tiene sesión de MaKo');
  assert.doesNotMatch(datos, /esEsencialDeLaSesion/, 'lib/comunidad-datos.ts lo usa también la ruta del alumno: nunca la sesión');
  assert.match(cuerpo('lib/comunidad-datos.ts', 'publicarPost'), /^export async function publicarPost[^\n]*\n {2}try \{\n[^\n]*\n {4}const candado = await candadoDeComunidad\(a\);\n {4}if \(candado\) return \{ ok: false, error: candado \};/,
    'publicarPost: lo primero (por ahí pasan el equipo, el alumno, la tarea «Publicar» y la API)');
  const evento = cuerpo('lib/comunidad-calendario.ts', 'guardarEvento');
  assert.match(evento, /if \(!id\) \{\n\s*const candado = await candadoDeComunidad\(a\);\n\s*if \(candado\) return \{ ok: false, error: candado \};\n\s*\}/,
    'un evento NUEVO; editar uno que existe no se frena');
  // Los comentarios de una clase son del CURSO (Classroom es de los dos planes): no pasan por el candado.
  for (const fn of ['comentarEnClase', 'hiloDeClase', 'comentar']) assert.doesNotMatch(cuerpo('lib/comunidad-datos.ts', fn), /candadoDeComunidad/, fn);
  // La API dice el candado ANTES de proponer.
  const RUN = 'lib/api-mako/areas/comunidad.run.ts';
  for (const id of ['publicar_post_comunidad', 'crear_evento_comunidad']) {
    assert.match(runner(RUN, id), /const candado = await candadoDeComunidad\(\{ ws: ctx\.ws, equipo: true \}\);\n\s*if \(candado\) return \{ error: candado \};/, id);
  }
});

test('10. la pantalla del negocio: el candado EN LUGAR de la comunidad, antes de leer nada (escritorio y teléfono)', () => {
  const p = cuerpo('app/customer-success/comunidad/pantalla.tsx', 'PantallaComunidad');
  assert.match(p, /await requireCapa\('customer-success'\);\n[\s\S]*?if \(await esEsencialDeLaSesion\(\)\) return <CartelSoloPro texto=\{textoSoloPro\('comunidad'\)\} \/>;\n {2}const sp = await searchParams;/);
  const m = fuente('app/m/comunidad/page.tsx');
  assert.ok(m.indexOf('if (await esEsencialDeLaSesion())') > 0 && m.indexOf('if (await esEsencialDeLaSesion())') < m.indexOf('await leerComunidad('),
    'el teléfono, antes de leer la comunidad');
  assert.match(m, /<VacioM frase=\{TEXTO_COMUNIDAD_SOLO_PRO_TELEFONO\} \/>/);
});

test('11. el portal del alumno: sin la entrada «Comunidad» si el NEGOCIO paga Esencial; los comentarios de clase siguen', () => {
  assert.equal(ofreceComunidad({ vistaPrevia: false, area: null }), true, 'sin decir el plan, se ofrece (ante la duda)');
  assert.equal(ofreceComunidad({ vistaPrevia: false, area: null, delPlan: true }), true);
  assert.equal(ofreceComunidad({ vistaPrevia: false, area: null, delPlan: false }), false);
  // Las dos puertas del alumno lo deciden con la FIRMA (el negocio), no con nada del alumno.
  const token = fuente('app/compartido/curso/[token]/page.tsx');
  assert.match(token, /const esencial = esEsencialDe\(firma\.ws\);/);
  assert.match(token, /<PortalAlumno token=\{token\} vista=\{r\.vista\} comunidad=\{!\(await esencial\)\} \/>/);
  const mio = fuente('app/mi-curso/page.tsx');
  assert.match(mio, /const esencial = esEsencialDe\(firma\.ws\);/);
  assert.match(mio, /<PortalAlumno token=\{token\} vista=\{r\.vista\} comunidad=\{!\(await esencial\)\} \/>/);
  const portal = fuente('app/compartido/curso/[token]/PortalAlumno.tsx');
  assert.match(portal, /const conComunidad = ofreceComunidad\(\{ vistaPrevia, area: vista\.area, delPlan: comunidad \}\);/);
  // Los comentarios de cada clase no dependen de la comunidad del plan.
  assert.match(portal, /const conComentarios = \(claseId: number\) => !lider && comentariosDeClase\(producto\.estilo, claseId\);/);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/11/2026; una rotura por vez, restaurada con el archivo de antes y comparada; base 11/0, 9 de 9):
//   · crearClaseAction sin el tope (la línea `if (tope) return …` borrada)                  → 5
//   · `duplicar_curso` sin el tope al confirmar                                            → 5
//   · un `.insert(` nuevo en curso_clases desde otro archivo (lib/tope-cursos.ts)          → 6
//   · la regla contando la clase en un curso que ya existe como curso nuevo                → 2 y 3
//   · lib/tope-cursos.ts contando también las clases de la papelera                        → 4
//   · publicarPost sin `candadoDeComunidad`                                                → 9
//   · `candadoDeComunidad` con `esEsencialDeLaSesion()` (la sesión, no el negocio)         → 9
//   · la pantalla de la comunidad sin el candado                                           → 10
//   · `ofreceComunidad` sin mirar `delPlan`                                                → 11
// =============================================================================
