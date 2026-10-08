// =============================================================================
// El menú «…» del curso: UNO, con la MISMA forma para un módulo y para una clase (item 15)
// =============================================================================
// Pedido de Martín (08/10/2026, item 15): «los tres puntos al editar un modulo o clase, el desplegable
// es diferente. Debería ser igual. Primero Renombrar, Portada, Mover Antes, Mover Después y ahí un
// divider. Luego la sección de "Público o Privado"… divider. Abajo en el caso de los módulos, ahí la
// sección del kanban… divider. Y abajo en módulo falta la opción de eliminar módulo… No entiendo eso
// de "Por área"».
//
// Lo que se EJECUTA:
//   · `seccionesDelMenu` (app/customer-success/curso/estructura.ts): el orden y las secciones.
//   · los dos menús DIBUJADOS (MenuModulo y MenuClase, renderToStaticMarkup): que lo que sale en
//     pantalla sea ese orden, con una línea entre dos secciones, y sin «Por área».
//   · el acceso Público / Privado (app/customer-success/curso/bloqueo-editor.ts).
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seccionesDelMenu } from '../app/customer-success/curso/estructura';
import { MenuClase, MenuModulo } from '../app/customer-success/curso/MenuCurso';
import { accesoDe, bloqueoPublico, opcionesPrivado, privadoInicial } from '../app/customer-success/curso/bloqueo-editor';
import { ERROR_ENTRADA, type ModuloCurso } from '../lib/curso-modulos';

const ARRIBA = ['renombrar', 'portada', 'mover-antes', 'mover-despues'];

test('el menú de un módulo y el de una clase tienen la MISMA forma: lo de arriba, el acceso, y abajo eliminar', () => {
  assert.deepEqual(seccionesDelMenu('modulo'), [ARRIBA, ['acceso'], ['kanban'], ['eliminar']]);
  assert.deepEqual(seccionesDelMenu('clase'), [ARRIBA, ['acceso'], ['eliminar']]);
  // Lo que no es del kanban es IGUAL en los dos, en el mismo orden: el de la clase es el del módulo
  // sin la sección del kanban.
  assert.deepEqual(seccionesDelMenu('modulo').filter((s) => !s.includes('kanban')), seccionesDelMenu('clase'));
});

// ── Lo que se DIBUJA ─────────────────────────────────────────────────────────

const ctl = { cerrar() {}, ancla: null, renombrar() {} };
const nada = async () => null;
const modulo = (o: Partial<ModuloCurso> = {}): ModuloCurso => ({ clave: 'bienvenida', nombre: 'Bienvenida', vinculado: true, n: 1, bloqueo: null, ...o });
const dibujarModulo = (o: Partial<Parameters<typeof MenuModulo>[0]> = {}) => renderToStaticMarkup(createElement(MenuModulo, {
  modulo: modulo(), entrada: false, clases: [], ctl, ocupado: false, onPortada() {}, onMover: { antes() {}, despues() {} },
  onBloqueo: nada, onKanban() {}, onEliminar() {}, ...o,
}));
const dibujarClase = (o: Partial<Parameters<typeof MenuClase>[0]> = {}) => renderToStaticMarkup(createElement(MenuClase, {
  clase: { id: 7, etapa: 'bienvenida', titulo: 'Las reglas', bloqueo: null }, clases: [], ctl, ocupado: false, onPortada() {},
  onRenombrar: nada, onMover: { antes() {}, despues() {} }, onBloqueo: nada, onEliminar() {}, ...o,
}));

/**
 * Lo que se ve, en orden: el texto de cada renglón del menú, los dos botones del acceso, el interruptor,
 * y «|» por cada línea entre secciones. Se lee del HTML dibujado, no del fuente.
 */
function renglones(html: string): string[] {
  const out: string[] = [];
  const re = /<div class="ugc-menu-sep"><\/div>|<button[^>]*class="(ugc-menu-item[^"]*|cu-menu-switch)"[^>]*>([\s\S]*?)<\/button>|<div class="cu-menu-seg"[^>]*>([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<div class="ugc-menu-sep"')) out.push('|');
    else if (m[3] != null) out.push('Acceso');
    else out.push(m[2].replace(/<[^>]+>/g, '').trim());
  }
  return out;
}

test('el menú de un MÓDULO se dibuja en ese orden, con la línea entre secciones', () => {
  assert.deepEqual(renglones(dibujarModulo()),
    ['Renombrar', 'Portada', 'Mover antes', 'Mover después', '|', 'Acceso', '|', 'Etapa del kanban', '|', 'Eliminar módulo']);
});

test('el menú de una CLASE se dibuja igual, sin la sección del kanban', () => {
  assert.deepEqual(renglones(dibujarClase()),
    ['Renombrar', 'Portada', 'Mover antes', 'Mover después', '|', 'Acceso', '|', 'Eliminar clase']);
});

test('«Por área» salió del menú, y «Mover a» también (una clase se lleva arrastrándola a la barra)', () => {
  for (const html of [dibujarModulo(), dibujarClase()]) {
    assert.doesNotMatch(html, /Por área|Mover a</);
  }
});

test('sin portada (no se pudo leer el estilo) no queda una sección vacía ni una línea de más', () => {
  assert.deepEqual(renglones(dibujarClase({ onPortada: undefined })).slice(0, 5), ['Renombrar', 'Mover antes', 'Mover después', '|', 'Acceso']);
});

test('la ENTRADA del kanban: el interruptor y «Eliminar módulo» se dibujan APAGADOS y dicen por qué', () => {
  const html = dibujarModulo({ entrada: true });
  assert.match(html, /<button[^>]*role="switch"[^>]*aria-checked="true"[^>]*disabled=""/, 'el interruptor de la entrada está prendido y apagado (deshabilitado)');
  assert.match(html, /<button(?=[^>]*disabled="")(?=[^>]*title="Es la entrada del kanban\.")[^>]*>Eliminar módulo<\/button>/);
  assert.ok(html.includes(ERROR_ENTRADA));
  // Un módulo cualquiera, no.
  assert.doesNotMatch(dibujarModulo(), /role="switch"[^>]*disabled=""/);
  // Un suelto: el interruptor apagado (no es una etapa), y se puede prender.
  assert.match(dibujarModulo({ modulo: modulo({ clave: 'm_x', vinculado: false }) }), /role="switch"[^>]*aria-checked="false"/);
});

test('el acceso dibuja Público o Privado según lo guardado, y Privado trae su condición', () => {
  // Un vinculado sin candado espera a su etapa: es PRIVADO, con «Al llegar a su etapa».
  const priv = dibujarModulo();
  assert.match(priv, /aria-pressed="true"[^>]*>Privado</);
  assert.match(priv, /<option value="default" selected="">Al llegar a su etapa<\/option>/);
  // Con «abierto», público y sin condición.
  const pub = dibujarModulo({ modulo: modulo({ bloqueo: { tipo: 'abierto' } }) });
  assert.match(pub, /aria-pressed="true"[^>]*>Público</);
  assert.doesNotMatch(pub, /<select/);
  // Una clase sin candado propio es pública; con uno, privada.
  assert.match(dibujarClase(), /aria-pressed="true"[^>]*>Público</);
  assert.match(dibujarClase({ clase: { id: 7, etapa: 'b', titulo: 'C', bloqueo: { tipo: 'manual' } } }), /<option value="manual" selected="">A mano<\/option>/);
});

// ── El acceso, puro (bloqueo-editor.ts) ──────────────────────────────────────

test('Público y Privado: qué guarda cada uno para cada cosa', () => {
  // Un VINCULADO por default espera a su etapa: público es `abierto` explícito.
  assert.deepEqual(bloqueoPublico('vinculado'), { tipo: 'abierto' });
  assert.equal(bloqueoPublico('suelto'), null);
  assert.equal(bloqueoPublico('clase'), null);
  assert.equal(accesoDe('vinculado', null), 'privado');
  assert.equal(accesoDe('vinculado', { tipo: 'abierto' }), 'publico');
  assert.equal(accesoDe('suelto', null), 'publico');
  assert.equal(accesoDe('clase', { tipo: 'dias', dias: 3 }), 'privado');
  // Privado arranca con lo que no pide datos: lo de siempre del vinculado, «al terminar el anterior» lo demás.
  assert.equal(privadoInicial('vinculado'), null);
  assert.deepEqual(privadoInicial('clase'), { tipo: 'anterior' });
  assert.equal(accesoDe('clase', privadoInicial('clase')), 'privado', 'elegir Privado tiene que quedar Privado');
  assert.equal(accesoDe('vinculado', privadoInicial('vinculado')), 'privado');
  // Las condiciones: nunca «Abierto» (eso es Público), y «Al llegar a su etapa» sólo en un vinculado.
  const v = (o: Parameters<typeof opcionesPrivado>[0]) => opcionesPrivado(o).map((x) => x.valor);
  assert.deepEqual(v('vinculado'), ['default', 'anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual']);
  assert.deepEqual(v('suelto'), ['anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual']);
  assert.deepEqual(v('clase'), v('suelto'));
  assert.equal(opcionesPrivado('vinculado')[0].texto, 'Al llegar a su etapa');
});

// ── El «Deshacer» de la estructura (item 18) ──────────────────────────────────
// «Te falta el botón de arrepentimiento para muchas acciones, el de 5 segundos de "Deshacer"». Cada
// gesto deja su aviso de 3-4 palabras, y DESHACER ESCRIBE EN EL SERVER por el mismo camino (AGENTS.md:
// revertir sólo la pantalla miente hasta el próximo F5). Se lee del fuente de la tab: el aviso y QUÉ
// llama su «Deshacer».

test('cada gesto de la estructura ofrece «Deshacer», y deshacer vuelve a escribir en el server', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const app = readFileSync(join(__dirname, '..', 'app/customer-success/curso/CursoApp.tsx'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const esperados: Array<[string, RegExp]> = [
    ['arrastrar / mover un módulo', /show\('Módulo movido', \(\) => \{ void ordenarModulos\(previas, false\); \}\)/],
    ['arrastrar una clase', /show\('Clase movida', \(\) => \{ void devolverClase\(claseId, lugar\); \}\)/],
    ['mover una clase antes / después', /show\('Clase movida', \(\) => \{ void devolverClase\(c\.id, lugar\); \}\)/],
    ['el acceso', /show\('Acceso cambiado', \(\) => \{ void candado\(objetivo, previo, false\); \}\)/],
    ['renombrar', /if \(deshacer\) show\('Nombre cambiado', deshacer\);/],
    ['la portada', /show\('Portada cambiada', \(\) => \{ void guardarAjuste\(ajuste, antes\); \}\)/],
    ['eliminar una clase', /show\('Clase borrada', \(\) => \{ void devolverClases\(c\.productoId, \[c\.id\]\); \}\)/],
    ['eliminar un módulo', /show\('Módulo eliminado', \(\) => \{ void devolverModulo\(pid, \{/],
    ['quitar la etapa del kanban', /show\('Etapa quitada', \(\) => \{ void kanban\(ahora, true, \{ devolver: \{ etapa: q\.etapa, indice: q\.indice \}, deshaciendo: true \}\); \}\)/],
    ['crear la etapa del kanban', /show\('Etapa creada', \(\) => \{ void kanban\(ahora, false, \{ deshaciendo: true \}\); \}\)/],
  ];
  for (const [que, re] of esperados) assert.match(app, re, `${que}: sin su «Deshacer»`);
  // Deshacer ESCRIBE: cada «devolver» llama a la action del server, no sólo al estado de la pantalla.
  assert.match(app, /const devolverClase = async[\s\S]{0,200}await moverClaseAAction\(claseId, lugar\.clave, lugar\.antesDe\)/);
  assert.match(app, /const devolverClases = async[\s\S]{0,200}await restaurarClasesAction\(pid, ids\)/);
  assert.match(app, /const devolverModulo = async[\s\S]{0,300}await restaurarModuloAction\(pid, datos\)/);
  // Con clientes mudados NO se ofrece: la etapa no se recrea con ellos adentro.
  assert.match(app, /if \(r\.movidos > 0\) show\('Módulo eliminado'\);/);
  assert.match(app, /if \(q && q\.movidos === 0 && ahora\)[^\n]*\n\s*else show\('Etapa quitada'\);/);
  // Y el texto del aviso es corto (AGENTS.md: un toast son 3-4 palabras).
  for (const m of app.matchAll(/show\('([^']+)', \(\) =>/g)) {
    assert.ok(m[1].split(/\s+/).length <= 4, `«${m[1]}» es largo para un aviso`);
  }
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Una rotura por vez sobre el archivo real, restaurada DESHACIENDO EL REEMPLAZO sobre lo que había en
// disco (otras pistas editaban CursoApp en paralelo), scratchpad/estructura/romper.mjs. Sin romper: 9/0.
//   · la clase sin la línea antes del acceso                                    → 6 / 3
//   · el kanban antes que el acceso · vuelve «Por área» a la clase              → 7 / 2 cada una
//   · la entrada del kanban se puede apagar · público de un vinculado = null ·
//     Privado de una clase arranca público · Privado ofrece «Abierto»           → 8 / 1 cada una
//   · el acceso sin «Deshacer» · la clase borrada vuelve SÓLO en pantalla ·
//     «Deshacer» con clientes mudados · un aviso de 7 palabras                  → 8 / 1 cada una
//   · una sección vacía deja su línea (`.filter((s) => s.length > 0)` fuera)    → 9 / 0, VERDE a
//     propósito: hoy ninguna sección puede quedar vacía (arriba siempre están «Mover antes / después»);
//     el filtro es la red para la próxima sección opcional, y no hay cómo dibujarla sin inventarla.
