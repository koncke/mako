// =============================================================================
// Los DOS recorridos de la tab Curso: el del curso y el de una clase (items 1, 3 y 19)
// =============================================================================
// Pedido de Martín (08/10/2026): «El tutorial también debe estar al ingresar a editar una clase, allí, al
// ingresar debería saltar otro tutorial» (item 1) y «Revisa que los tutoriales faltó explicar muchas
// cosas» (item 19). Los pasos viven en app/customer-success/curso/recorridos-curso.ts (datos puros) y los
// monta CursoApp con app/_ui/Recorrido.tsx; la lógica del recorrido (saltear lo que no está, dónde va la
// tarjeta, quién ya lo vio) tiene su test en tests/recorrido.test.ts.
//
// ⚠️ UN PASO CUYO OBJETIVO NO EXISTE SE SALTEA EN SILENCIO (lib/recorridos.ts): el recorrido queda más
//    corto y nada lo dice. Por eso acá se busca, en el FUENTE de app/, que cada objetivo sea un
//    `data-recorrido` que alguien pone. Dos tests: los objetivos que pone esta pista (el dibujo y la barra
//    de arriba) y TODOS, incluidos los que ponen el editor de la estructura, la clase y el editor rico.
//
// ── Roturas (08/10/2026, scratchpad/apariencia/romper.mjs: una por vez, restaurada de MEMORIA + md5) ──
// Sin romper, medido con las otras tres pistas todavía trabajando: 7 pass / 1 fail. El rojo es «TODOS
// los pasos…», que nombra los objetivos que ellas no habían puesto todavía (los cuatro del editor de la
// estructura: menu-modulo, barra-modulos, nueva-clase, menu-clase). Con los suyos puestos, medido al
// cierre: 8 / 0 — ése es el chequeo de la integración. Cada rotura tumbó, además de ése, SU test:
//   · el del curso sin el paso «Nueva clase»                → «el del curso explica lo que hay»
//   · un paso en voseo («Hacé clic y pegá el link.»)         → «textos de pantalla»  ⚠️ la primera versión
//     pasaba en VERDE: `marcasDeVoseo` no conoce «hacé» ni «pegá» (tampoco «elegí» ni «volvé»), y por eso
//     se suma la regla de la tilde final
//   · la clave del del curso cambiada (`cs-curso-2`)         → «dos recorridos con su clave»
//   · el «?» sin `objetivo="ayuda"`                          → «los objetivos de esta pista existen»
//   · el título del curso sin `recorrido="titulo"`            → «los objetivos de esta pista existen»
//   · el de la clase sin el `!recorrido.abierto`              → «el de la clase se abre al entrar…»
//   · el «?» que siempre abre el del curso                    → «el de la clase se abre al entrar…»
//   · los controles invisibles durante el recorrido           → «mientras corre un recorrido…»
//
// Y en el navegador (scratchpad/apariencia/banco, la tab ENTERA): el del curso se abrió solo con 8 pasos
// visibles en el índice (marca, vista-alumno, invitar, titulo, portada, nuevo-modulo, modulo, ayuda), al
// entrar a una clase se abrió el de la clase con 11 (los del editor rico que no entran en la barra viven
// en «Más» y se saltean), cada recorte cayó sobre su `data-recorrido`, y el «?» abrió el del lugar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  PASOS_RECORRIDO, PASOS_RECORRIDO_LECCION, RECORRIDO_CURSO, RECORRIDO_LECCION,
} from '../app/customer-success/curso/recorridos-curso';
import { idRecorridoValido } from '../lib/recorridos';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

/**
 * Los objetivos que MARCA el fuente de app/: lo que sigue a cada `data-recorrido`, a cada prop
 * `recorrido=` (el `TextoEditable` del dibujo), a un `recorrido:` de un objeto (los botones del editor
 * rico) y al `objetivo=` del «?» (`BotonRecorrido`). Se mira un
 * trecho y no sólo un string pegado, porque se escriben también con un ternario
 * (`data-recorrido={i === 0 ? 'modulo' : undefined}`). Sin comentarios: el que explica un objetivo no
 * lo pone en la pantalla.
 */
function objetivosMarcados(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!/\.tsx?$/.test(n) || n === 'recorridos-curso.ts') continue;
      const src = sinComentarios(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
      // También `recorrido: 'x'` adentro de un objeto: el editor rico declara sus botones como datos
      // (`{ id: 'imagen', …, recorrido: 'editor-imagen' }`) y el botón lo pasa a `data-recorrido`.
      for (const m of src.matchAll(/(?:data-recorrido|\brecorrido|<BotonRecorrido[^>]*?\bobjetivo)=|\brecorrido:\s*/g)) {
        const trecho = src.slice(m.index! + m[0].length, m.index! + m[0].length + 160);
        // Hasta el final del valor: un string suelto, o la expresión entre llaves.
        const valor = trecho.startsWith('{') ? trecho.slice(0, Math.max(1, trecho.indexOf('}')) + 1) : trecho.split(/\s/)[0];
        for (const q of valor.matchAll(/["']([a-z0-9-]+)["']/g)) {
          const donde = relative(RAIZ, p).replace(/\\/g, '/');
          out.set(q[1], [...(out.get(q[1]) ?? []), donde]);
        }
      }
    }
  };
  recorrer(join(RAIZ, 'app'));
  return out;
}

/** Los que pone ESTA pista: el dibujo del curso (marca, portada, títulos, módulos) y la barra de arriba. */
const DE_LA_APARIENCIA = ['marca', 'vista-alumno', 'invitar', 'ayuda', 'titulo', 'portada', 'nuevo-modulo', 'modulo'];

// ── Los datos ────────────────────────────────────────────────────────────────

test('dos recorridos con su clave: el del curso conserva la suya, el de la clase es otro', () => {
  assert.equal(RECORRIDO_CURSO, 'cs-curso', 'la clave de «ya lo vio» no se cambia: quien lo vio lo volvería a ver');
  assert.ok(idRecorridoValido(RECORRIDO_LECCION), `«${RECORRIDO_LECCION}» no es una clave de recorrido`);
  assert.notEqual(RECORRIDO_LECCION, RECORRIDO_CURSO);
});

test('el del curso explica lo que hay: la marca, la barra de arriba, los módulos, sus menús, la barra lateral y las clases', () => {
  const o = PASOS_RECORRIDO.map((p) => p.objetivo);
  for (const x of ['marca', 'vista-alumno', 'invitar', 'titulo', 'portada', 'nuevo-modulo', 'modulo', 'menu-modulo', 'barra-modulos', 'nueva-clase', 'menu-clase', 'ayuda']) {
    assert.ok(o.includes(x), `al recorrido del curso le falta «${x}»`);
  }
  // La marca cuenta el color Y la fuente (item 3: se eligen ahí).
  assert.match(PASOS_RECORRIDO.find((p) => p.objetivo === 'marca')!.texto, /color.*fuente/);
});

test('el de la clase explica la clase: título, video, disposición, descripción y su barra, la tarea y sus campos', () => {
  const o = PASOS_RECORRIDO_LECCION.map((p) => p.objetivo);
  for (const x of ['leccion-titulo', 'leccion-video', 'leccion-disposicion', 'leccion-descripcion', 'editor-barra', 'editor-imagen',
    'editor-tabla', 'editor-adjuntar', 'editor-mas', 'leccion-tarea', 'leccion-nuevo-campo', 'leccion-campo', 'leccion-obligatoria', 'menu-clase', 'ayuda']) {
    assert.ok(o.includes(x), `al recorrido de la clase le falta «${x}»`);
  }
  // El orden de la pantalla, de arriba abajo: la descripción antes que la tarea, y su barra entre las dos.
  assert.ok(o.indexOf('leccion-descripcion') < o.indexOf('editor-barra') && o.indexOf('editor-barra') < o.indexOf('leccion-tarea'));
});

test('textos de pantalla: cortos, de TÚ, sin pasos repetidos, y los dos terminan en el «?»', () => {
  for (const [nombre, pasos] of [['curso', PASOS_RECORRIDO], ['clase', PASOS_RECORRIDO_LECCION]] as const) {
    const o = pasos.map((p) => p.objetivo);
    assert.equal(new Set(o).size, o.length, `el recorrido de ${nombre} repite un paso`);
    assert.equal(o.at(-1), 'ayuda', `el de ${nombre} no termina en el «?» (cómo volver a verlo es lo que queda)`);
    for (const p of pasos) {
      assert.ok(p.titulo.length <= 28, `título largo: «${p.titulo}»`);
      assert.ok(p.texto.length <= 80, `texto largo (${p.texto.length}): «${p.texto}»`);
      assert.ok((p.texto.match(/[.!?](\s|$)/g) ?? []).length <= 2, `más de dos frases: «${p.texto}»`);
      assert.match(p.texto, /^[A-ZÁÉÍÓÚÑ¿¡]/, `arranca en minúscula: «${p.texto}»`);
      assert.deepEqual(marcasDeVoseo(`${p.titulo} ${p.texto}`), [], `voseo en «${p.titulo}: ${p.texto}»`);
      // ⚠️ `marcasDeVoseo` NO ve «hacé», «pegá», «elegí» ni «volvé» (medido el 08/10/2026: sólo conoce los
      //    verbos de su lista), y son justo los de un recorrido. Un imperativo de TÚ nunca termina en vocal
      //    con tilde («Haz», «Pega», «Elige», «Vuelve»), así que una palabra que termina así y no es de las
      //    de siempre es voseo. Los límites por Unicode: `\b` es ASCII (AGENTS.md).
      const tildeFinal = [...`${p.titulo} ${p.texto}`.matchAll(/(?<!\p{L})\p{L}*[áéí](?!\p{L})/gu)].map((m) => m[0].toLowerCase())
        .filter((w) => !['aquí', 'ahí', 'allí', 'acá', 'allá', 'está', 'más', 'sí', 'qué', 'también', 'después', 'así', 'aún'].includes(w));
      assert.deepEqual(tildeFinal, [], `voseo en «${p.titulo}: ${p.texto}»`);
    }
  }
});

// ── Que cada paso señale algo que existe ─────────────────────────────────────

test('los objetivos de esta pista existen en el fuente (el dibujo y la barra de arriba)', () => {
  const marcados = objetivosMarcados();
  for (const x of DE_LA_APARIENCIA) assert.ok(marcados.has(x), `nadie pone data-recorrido="${x}"`);
  // El «?» se marca a sí mismo: `BotonRecorrido` pasa `objetivo` como `data-recorrido`.
  assert.match(sinComentarios(leer('app/_ui/Recorrido.tsx')), /\{\.\.\.\(objetivo \? \{ 'data-recorrido': objetivo \} : \{\}\)\}/);
  assert.deepEqual(marcados.get('ayuda'), ['app/customer-success/curso/CursoApp.tsx']);
});

test('TODOS los pasos de los dos recorridos señalan un data-recorrido que alguien pone (integración de las pistas)', () => {
  const marcados = objetivosMarcados();
  const faltan = [...new Set([...PASOS_RECORRIDO, ...PASOS_RECORRIDO_LECCION].map((p) => p.objetivo))].filter((x) => !marcados.has(x));
  assert.deepEqual(faltan, [], `pasos que se saltearían en silencio: ${faltan.join(', ')}`);
});

// ── Cuál se abre dónde ───────────────────────────────────────────────────────

test('el de la clase se abre al entrar a una, el del curso afuera, nunca los dos juntos, y el «?» abre el del lugar', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /const enClase = pos\.clase != null && clases\.some\(\(c\) => c\.id === pos\.clase && c\.productoId === productoId\);/,
    '«adentro de una clase» tiene que ser una clase de ESTE curso');
  assert.match(app, /const recorrido = useRecorrido\(RECORRIDO_CURSO, \{ autoabrir: puedeEditar && !enClase \}\);/);
  assert.match(app, /const recorridoClase = useRecorrido\(RECORRIDO_LECCION, \{ autoabrir: puedeEditar && enClase && !recorrido\.abierto \}\);/);
  assert.match(app, /<Recorrido id=\{RECORRIDO_LECCION\} pasos=\{PASOS_RECORRIDO_LECCION\} abierto=\{recorridoClase\.abierto\} onCerrar=\{recorridoClase\.onCerrar\} \/>/);
  const barra = bloque(app, 'const barraDeArriba = (', 'const cambiarAspecto');
  assert.match(barra, /onClick=\{enClase \? recorridoClase\.reabrir : recorrido\.reabrir\}/);
  // Sólo para quien arma el curso: el «?» y los dos recorridos van detrás de `puedeEditar`.
  assert.match(barra, /\{puedeEditar && \(\s*<BotonRecorrido/);
  assert.equal((app.match(/\{puedeEditar && <Recorrido id=/g) ?? []).length, 2);
});

test('mientras corre un recorrido, los controles que aparecen al pasar el cursor se ven (si no, el recorte señala la nada)', () => {
  const css = leer('app/_cursos/estilos.ts').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.ahdoc\.ahdoc--ugc:is\(body:has\(> \.mk-rec\) \*\) \.ugc \.ugc-editable-ctrls,\s*\.ahdoc\.ahdoc--ugc:is\(body:has\(> \.mk-rec\) \*\) \.ugc \.ugc-portada-btn \{ opacity: 1; \}/);
  // Y el recorrido sigue montándose en el body como `.mk-rec`, que es lo que esa regla mira.
  const rec = sinComentarios(leer('app/_ui/Recorrido.tsx'));
  assert.match(rec, /<div className="mk-rec" data-recorrido-capa=\{id\}/);
  assert.match(rec, /document\.body,\s*\);/);
});

// Revisión final (08/10/2026). En el teléfono el interruptor «Texto al costado / abajo» se esconde
// (app/_cursos/estilos.ts), pero su CAJA (`.cu-papel-dispo`, que lleva el `data-recorrido`) quedaba: vacía,
// de alto cero, el recorrido la contaba como presente (`getClientRects`) y el paso «Dónde va el texto»
// señalaba la nada. Medido en el banco a 390 px (scratchpad/revision/sonda-recorrido.mts): con la caja
// visible, 11 pasos con ése adentro; escondida, 10 y se saltea.
// Roto: la regla del teléfono sin la caja (`.cu-papel-dispo-X`) → 8 / 1, este test; restaurado 9 / 0.
test('en el teléfono la caja del interruptor de la disposición se esconde con él (si no, el recorrido señala una caja vacía)', () => {
  const css = leer('app/_cursos/estilos.ts').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.ahdoc\.ahdoc--ugc \.ugc \.ugc-dispo \{ display: none; \}/);
  const le = leer('app/customer-success/curso/LeccionEditable.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(le, /<div className="cu-papel-dispo" data-recorrido="leccion-disposicion">/);
  assert.match(le, /@media \(max-width: 760px\) \{ \.ahdoc\.ahdoc--ugc \.ugc \.cu-papel-dispo \{ display: none; \} \}/);
});
