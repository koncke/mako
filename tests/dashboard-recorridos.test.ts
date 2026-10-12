// =============================================================================
// Los DOS recorridos de la tab Dashboard: el de mirar y el de editar (punto 20)
// =============================================================================
// Pedido de Martín (11/10/2026): «Haz el tutorial de como utilizar esta tab de "Dashboard" tal como lo
// tenemos en el tutorial de "CURSO", que sea como un recorrido.» Los pasos viven en
// app/dashboard/recorridos-dashboard.ts (datos puros) y los monta app/dashboard/EditorInforme.tsx con
// app/_ui/Recorrido.tsx. El molde es tests/curso-recorridos.test.ts.
//
// ⚠️ UN PASO CUYO OBJETIVO NO EXISTE SE SALTEA EN SILENCIO (lib/recorridos.ts): el recorrido queda más
//    corto y nada lo dice. Por eso acá se busca, en el FUENTE de app/, que cada objetivo sea un
//    `data-recorrido` que alguien pone — y con el prefijo `dash-`, porque el DOM es uno solo y `ayuda` ya
//    es de la tab Curso (su test exige que sólo CursoApp lo ponga).
// ⚠️ Y mientras corre, los atajos del editor se apagan: el recorrido sólo frena Escape y Tab, y debajo del
//    velo Supr borraba el componente elegido y Ctrl+Z deshacía sin que se viera.
// Correr: npx tsx --test tests/dashboard-recorridos.test.ts
//
// ── Roturas (11/10/2026, scratchpad/romper-pantalla.mjs: una por vez, restaurada de MEMORIA + md5, nunca
//    con git). Base: 7 pasan / 0 fallan. Cada rotura tumbó SU test (pasan / fallan):
//   · un paso en voseo («Elegí el tipo…»)              -> 6 / 1  «textos de pantalla…»
//   · la clave cambiada (`dashboard-2`)                 -> 6 / 1  «dos recorridos con su clave…»
//   · sin el paso de «Insertar»                         -> 6 / 1  «el de mirar explica… y el de editar…»
//   · el botón «Estilo» sin su data-recorrido           -> 6 / 1  «TODOS los pasos señalan…»
//   · el ⋮ de la hoja sin su data-recorrido             -> 6 / 1  el mismo
//   · el «?» con el `ayuda` de la tab Curso             -> 5 / 2  «TODOS…» y «el de mirar se abre mirando…»
//   · los dos recorridos que pueden abrirse juntos      -> 6 / 1  «el de mirar se abre mirando…»
//   · el «?» que siempre abre el de mirar               -> 6 / 1  el mismo
//   · Ctrl+Z activo debajo del velo                     -> 6 / 1  «mientras corre un recorrido, Ctrl+Z…»
//   · Suprimir activo debajo del velo                   -> 6 / 1  el mismo
//   · el chat de MaKo invisible durante el recorrido    -> 6 / 1  «…lo que aparece al pasar el cursor se ve»
//
// ── Y la tanda de la TOPBAR (11/10/2026, scratchpad/romper-topbar.mjs, mismo método). Base: 7 / 0:
//   · la guía preguntándole al server en un link        -> 6 / 1  «el de mirar se abre mirando… y en un link no hay guía»
//   · un paso que señala algo adentro del ⋮ (Exportar)  -> 5 / 2  «el de mirar explica la topbar…» y «TODOS los pasos…»
//   · el chat de MaKo sin la clase `.lk-mako`            -> 6 / 1  «…lo que aparece al pasar el cursor se ve»
//
// ── Y la tanda v5, paquete «La edición» (12/10/2026, scratchpad p5/romper.mjs, mismo método). Base: 7 / 0; al
//    final, 7 / 0:
//   · el pop-up abierto que no cuenta como capa           -> 6 / 1  «el de mirar se abre mirando…»
//   · dash-mako anclado al primer gráfico a secas          -> 6 / 1  «…lo que aparece al pasar el cursor se ve»
//   · `primerConMako` sin mirar `c.mako !== false`         -> 6 / 1  el mismo

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  PASOS_DASHBOARD, PASOS_DASHBOARD_EDICION, RECORRIDO_DASHBOARD, RECORRIDO_DASHBOARD_EDICION,
} from '../app/dashboard/recorridos-dashboard';
import { RECORRIDO_CURSO, RECORRIDO_LECCION } from '../app/customer-success/curso/recorridos-curso';
import { idRecorridoValido } from '../lib/recorridos';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Los objetivos que MARCA el fuente de app/ (el mismo extractor que el test de la tab Curso): lo que sigue
 * a cada `data-recorrido=` y al `objetivo=` del «?», un string suelto o adentro de un ternario.
 */
function objetivosMarcados(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!/\.tsx?$/.test(n) || /^recorridos?-/.test(n)) continue;
      const src = sinComentarios(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
      for (const m of src.matchAll(/(?:data-recorrido|\brecorrido|<BotonRecorrido[^>]*?\bobjetivo)=|\brecorrido:\s*/g)) {
        const trecho = src.slice(m.index! + m[0].length, m.index! + m[0].length + 160);
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

// ── Los datos ────────────────────────────────────────────────────────────────

test('dos recorridos con su clave fija, válida y propia', () => {
  assert.equal(RECORRIDO_DASHBOARD, 'dashboard', 'la clave de «ya lo vio» no se cambia: quien lo vio lo volvería a ver');
  assert.equal(RECORRIDO_DASHBOARD_EDICION, 'dashboard-edicion');
  for (const id of [RECORRIDO_DASHBOARD, RECORRIDO_DASHBOARD_EDICION]) assert.ok(idRecorridoValido(id), `«${id}» no es una clave de recorrido`);
  assert.notEqual(RECORRIDO_DASHBOARD, RECORRIDO_DASHBOARD_EDICION);
  assert.ok(![RECORRIDO_CURSO, RECORRIDO_LECCION].includes(RECORRIDO_DASHBOARD));
});

// Desde la tanda de la topbar (11/10/2026) no hay pestañas ni botones sueltos de AI Analyst, Exportar y
// «?»: las hojas son el ▾ del título y lo demás vive en el ⋮. Un paso no puede señalar algo que está
// ADENTRO de un menú cerrado (se saltearía siempre), así que esos pasos se fueron y el ⋮ es el último.
test('el de mirar explica la topbar y el de editar la barra de edición, cada uno en su orden', () => {
  const ver = PASOS_DASHBOARD.map((p) => p.objetivo);
  for (const x of ['dash-titulo', 'dash-hojas', 'dash-controles', 'dash-grafico', 'dash-mako', 'dash-editar', 'dash-ayuda']) {
    assert.ok(ver.includes(x), `al recorrido de mirar le falta «${x}»`);
  }
  // Lo que vive adentro de un menú cerrado no se puede señalar.
  for (const x of ['dash-menu-hoja', 'dash-nueva-hoja', 'dash-analista', 'dash-exportar']) assert.ok(!ver.includes(x), `«${x}» está adentro de un menú cerrado: se saltearía siempre`);
  // De izquierda a derecha y de arriba abajo: el título, sus hojas, los filtros, un gráfico.
  assert.ok(ver.indexOf('dash-titulo') < ver.indexOf('dash-hojas') && ver.indexOf('dash-hojas') < ver.indexOf('dash-controles') && ver.indexOf('dash-controles') < ver.indexOf('dash-grafico'));
  const edi = PASOS_DASHBOARD_EDICION.map((p) => p.objetivo);
  for (const x of ['dash-deshacer', 'dash-datos', 'dash-anadir-grafico', 'dash-insertar', 'dash-estilo', 'dash-filtro', 'dash-componente', 'dash-ver', 'dash-ayuda']) {
    assert.ok(edi.includes(x), `al recorrido de editar le falta «${x}»`);
  }
  // La barra de edición en el orden de Looker: deshacer, datos, gráfico, insertar, estilo.
  const orden = ['dash-deshacer', 'dash-datos', 'dash-anadir-grafico', 'dash-insertar', 'dash-estilo'].map((x) => edi.indexOf(x));
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, `la barra de edición fuera de orden: ${orden.join(', ')}`);
  // Lo de editar no se muestra mirando (se saltearía igual, pero el de mirar quedaría pidiendo cosas que no hay).
  for (const x of ['dash-estilo', 'dash-insertar', 'dash-deshacer', 'dash-filtro']) assert.ok(!ver.includes(x), `«${x}» sólo existe editando`);
});

test('textos de pantalla: cortos, de TÚ, sin pasos repetidos, prefijo dash- y los dos terminan en el «?»', () => {
  for (const [nombre, pasos] of [['mirar', PASOS_DASHBOARD], ['editar', PASOS_DASHBOARD_EDICION]] as const) {
    const o = pasos.map((p) => p.objetivo);
    assert.equal(new Set(o).size, o.length, `el recorrido de ${nombre} repite un paso`);
    assert.equal(o.at(-1), 'dash-ayuda', `el de ${nombre} no termina en el «?» (cómo volver a verlo es lo que queda)`);
    for (const p of pasos) {
      assert.match(p.objetivo, /^dash-[a-z0-9-]+$/, `«${p.objetivo}» sin el prefijo de la tab`);
      assert.ok(p.titulo.length <= 28, `título largo: «${p.titulo}»`);
      assert.ok(p.texto.length <= 80, `texto largo (${p.texto.length}): «${p.texto}»`);
      assert.ok((p.texto.match(/[.!?](\s|$)/g) ?? []).length <= 2, `más de dos frases: «${p.texto}»`);
      assert.match(p.texto, /^[A-ZÁÉÍÓÚÑ¿¡]/, `arranca en minúscula: «${p.texto}»`);
      assert.deepEqual(marcasDeVoseo(`${p.titulo} ${p.texto}`), [], `voseo en «${p.titulo}: ${p.texto}»`);
      // `marcasDeVoseo` no conoce «hacé», «pegá», «elegí» ni «volvé» (medido el 08/10/2026 en la tab Curso):
      // un imperativo de TÚ nunca termina en vocal con tilde. Los límites por Unicode (`\b` es ASCII).
      const tildeFinal = [...`${p.titulo} ${p.texto}`.matchAll(/(?<!\p{L})\p{L}*[áéí](?!\p{L})/gu)].map((m) => m[0].toLowerCase())
        .filter((w) => !['aquí', 'ahí', 'allí', 'acá', 'allá', 'está', 'más', 'sí', 'qué', 'también', 'después', 'así', 'aún'].includes(w));
      assert.deepEqual(tildeFinal, [], `voseo en «${p.titulo}: ${p.texto}»`);
    }
  }
});

// ── Que cada paso señale algo que existe ─────────────────────────────────────

test('TODOS los pasos señalan un data-recorrido que alguien pone en app/dashboard (si no, se saltean en silencio)', () => {
  const marcados = objetivosMarcados();
  const todos = [...new Set([...PASOS_DASHBOARD, ...PASOS_DASHBOARD_EDICION].map((p) => p.objetivo))];
  const faltan = todos.filter((x) => !marcados.has(x));
  assert.deepEqual(faltan, [], `pasos que se saltearían en silencio: ${faltan.join(', ')}`);
  for (const x of todos) {
    for (const donde of marcados.get(x)!) assert.match(donde, /^app\/dashboard\//, `«${x}» lo pone ${donde}: una marca dash- fuera del Dashboard`);
  }
  // Y nadie del Dashboard usa el «ayuda» de la tab Curso.
  assert.ok(!(marcados.get('ayuda') ?? []).some((d) => d.startsWith('app/dashboard/')), 'el Dashboard puso «ayuda»: rompe el test de la tab Curso');
});

// ── Cuál se abre dónde, y los atajos ─────────────────────────────────────────

const EDITOR = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));

test('el de mirar se abre mirando, el de editar al editar, nunca los dos juntos, la guía del ⋮ abre la del lugar, y en un link no hay guía', () => {
  assert.match(EDITOR, /const recorrido = useRecorrido\(RECORRIDO_DASHBOARD, \{ autoabrir: conGuia && !editando && !capaAbierta, soloLocal: !conGuia \}\);/);
  assert.match(EDITOR, /const recorridoEdicion = useRecorrido\(RECORRIDO_DASHBOARD_EDICION, \{ autoabrir: conGuia && editando && !recorrido\.abierto && !capaAbierta, soloLocal: !conGuia \}\);/);
  // En un link compartido no hay sesión ni guía (`soloLocal`: no le pregunta nada a /api/recorridos).
  assert.match(EDITOR, /const conGuia = !compartido;/);
  // No se abre solo con un menú o un modal abierto: los flotantes del editor (z 580) quedan arriba del velo.
  // Desde v5 también son capas un pop-up abierto mirando (punto 7) y el modal de Compartir (va en el ⋮).
  assert.match(EDITOR, /const capaAbierta = !!menu \|\| modalDatos \|\| nuevaHoja \|\| analista \|\| !!detalle \|\| llamada != null \|\| !!popup \|\| compartir;/);
  // El «?» se fue al ⋮ (punto 4): la opción abre la guía del lugar, y el ⋮ es el último paso de las dos.
  assert.match(EDITOR, /\{conGuia && \([\s\S]{0,200}onClick=\{\(\) => \{ setMenu\(null\); \(editando \? recorridoEdicion\.reabrir : recorrido\.reabrir\)\(\); \}\}/);
  assert.match(EDITOR, /className="lk-pill lk-pill--icono lk-mas" data-recorrido="dash-ayuda"/);
  assert.match(EDITOR, /<Recorrido id=\{RECORRIDO_DASHBOARD\} pasos=\{PASOS_DASHBOARD\} abierto=\{recorrido\.abierto\} onCerrar=\{recorrido\.onCerrar\} \/>/);
  assert.match(EDITOR, /<Recorrido id=\{RECORRIDO_DASHBOARD_EDICION\} pasos=\{PASOS_DASHBOARD_EDICION\} abierto=\{recorridoEdicion\.abierto\} onCerrar=\{recorridoEdicion\.onCerrar\} \/>/);
});

test('mientras corre un recorrido, Ctrl+Z y Suprimir no tocan el informe', () => {
  assert.match(EDITOR, /const enRecorrido = recorrido\.abierto \|\| recorridoEdicion\.abierto;/);
  assert.match(EDITOR, /\{ activa: editando && !enRecorrido \}\);/, 'Ctrl+Z deshace debajo del velo');
  const teclado = EDITOR.slice(EDITOR.indexOf('const k = (e: KeyboardEvent) => {'), EDITOR.indexOf("document.addEventListener('keydown', k);"));
  assert.ok(teclado.length > 0 && teclado.length < 400, `el recorte mide ${teclado.length}`);
  assert.match(teclado, /^const k = \(e: KeyboardEvent\) => \{\n\s*if \(enRecorrido \|\| enUnTexto\(\) \|\| capaAbierta\) return;/, 'Suprimir borra debajo del velo');
});

test('mientras corre un recorrido, lo que aparece al pasar el cursor se ve (si no, el recorte señala la nada)', async () => {
  const { CSS } = await import('../app/dashboard/editor-css');
  assert.match(CSS, /\.lk:is\(body:has\(> \.mk-rec\) \*\) \.react-grid-item > \.react-resizable-handle, \.lk:is\(body:has\(> \.mk-rec\) \*\) \.lk-hoja-mas, \.lk:is\(body:has\(> \.mk-rec\) \*\) \.lk-mako \{ opacity: 1; \}/);
  // La regla mira `.lk-mako`: el chat de MaKo de cada gráfico sigue envuelto en esa clase (con el botón chico).
  // Desde v5 el botón se apaga por gráfico (punto 15: `mako: false`): el paso se ancla al primer gráfico que
  // LO TIENE. Anclado al primero a secas, con ése apagado el paso se salteaba en silencio.
  assert.match(EDITOR, /<span className="lk-mako" data-recorrido=\{c\.id === primerConMako \? 'dash-mako' : undefined\}>\s*<ChatMakoGrafico /);
  const primero = EDITOR.match(/const primerConMako = [^\n]*/)?.[0] ?? '';
  assert.match(primero, /c\.mako !== false/, 'el paso se ancla a un gráfico con el botón apagado');
  assert.match(primero, /datos\[c\.id\]\?\.resultado/, 'el botón sólo se dibuja con datos: anclado a uno sin datos, el paso apunta a la nada');
  // Y el recorrido sigue montándose en el body como `.mk-rec`, que es lo que esa regla mira.
  const rec = sinComentarios(leer('app/_ui/Recorrido.tsx'));
  assert.match(rec, /<div className="mk-rec" data-recorrido-capa=\{id\}/);
});
