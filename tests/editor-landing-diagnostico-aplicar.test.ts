// =============================================================================
// «Aplicar», «Aplicar todos», «Deshacer» y «Preguntar a MaKo» del Diagnóstico (tanda 6, decisión c)
// =============================================================================
// Decisión de Martín (14/10/2026), textual del relevo: «"Aplicar" de cada comentario del Diagnóstico = un
// clic, con la versión guardada antes y "Deshacer"; más "Aplicar todos" (de a una sección, un solo
// Deshacer) y "Preguntar a MaKo" (el chat de MaKo al costado con el comentario). En una landing externa,
// "Aplicar" lleva a replicar primero y los comentarios pasan a la copia.»
//
// Lo puro vive en lib/editor-landing/diagnostico.ts (la instrucción, los grupos, la pila de Deshacer, el
// contexto del chat y el script que abre un desplegable antes de ir a una cita); el server en
// lib/editor-landing/diagnostico-aplicar.ts (server-only: se lee su fuente); la pantalla en
// app/landing-generator/diagnostico/*; la API en lib/api-mako/areas/landing.*.
//
// PROBADO ROMPIÉNDOLO (14/10/2026): los números al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  JS_ABRIR_PARA_VER, MOTIVO_ANTES_DE_APLICAR, SCRIPT_DIAGNOSTICO, TOPES_DIAGNOSTICO,
  claveChatDeComentario, contextoDeComentario, docAplicado, gruposParaAplicar, idsParaAplicar, instruccionDeSugerencia,
  instruccionDeSugerencias, pilaTrasAplicar, pilaTrasDeshacer, sePuedeDeshacer, type Aplicacion, type Sugerencia,
} from '../lib/editor-landing/diagnostico';
import { porId } from '../lib/api-mako/registro';
import { esAccion, esLectura } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';
import { comentariosParaApi, diagnosticoParaApi } from '../lib/api-mako/areas/landing-editor.helpers';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Sin el `.replace(/\{\s*\}/g, '')` de otros tests: borraría los `: {}` del código de verdad.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const PANEL = 'app/landing-generator/diagnostico/PanelDiagnostico.tsx';
const COMENTARIO = 'app/landing-generator/diagnostico/Comentario.tsx';
const RECORRIDO = 'app/landing-generator/diagnostico/RecorridoDiagnostico.tsx';
const SERVER = 'lib/editor-landing/diagnostico-aplicar.ts';
const RUTA = 'app/api/landing-generator/diagnostico/aplicar/route.ts';

const hallazgo = (titulo: string, extra: Partial<Sugerencia['hallazgo']> = {}): Sugerencia['hallazgo'] => ({
  titulo, severidad: 'media', seccion: '', cita: `cita de ${titulo}`, por_que: `porque ${titulo}`, arreglo: `arregla ${titulo}`, ...extra,
});
const sug = (id: number, seccionId: string | null, estado: Sugerencia['estado'] = 'pendiente', h = hallazgo(`h${id}`)): Sugerencia => ({
  id, hallazgo: h, cita: h.cita, seccionId, estado, creado: `2026-10-14T10:00:0${id % 10}Z`, actualizado: '2026-10-14T10:00:00Z',
});

// ── La instrucción ───────────────────────────────────────────────────────────

test('un comentario: la instrucción de siempre; varios de la misma sección van numerados en UN pedido', () => {
  const uno = instruccionDeSugerencias([hallazgo('No hay prueba', { cita: 'Somos los mejores', arreglo: 'Agrega un testimonio real.' })]);
  assert.match(uno, /^Aplica esta sugerencia a la sección: Agrega un testimonio real\./);
  assert.equal(uno, instruccionDeSugerencia(hallazgo('No hay prueba', { cita: 'Somos los mejores', arreglo: 'Agrega un testimonio real.' })), 'la de uno es la misma');
  const varios = instruccionDeSugerencias([hallazgo('A'), hallazgo('B'), hallazgo('C')]);
  assert.match(varios, /^Aplica estas 3 sugerencias a la sección, todas en el mismo cambio:/);
  for (const t of ['A', 'B', 'C']) assert.ok(varios.includes(`arregla ${t}`) && varios.includes(`«cita de ${t}»`), t);
  assert.match(varios, /^1\. arregla A$/m);
  assert.match(varios, /^3\. arregla C$/m);
});

test('si no entra en el tope, se cae el «por qué» antes que un comentario', () => {
  const largo = 'x'.repeat(1_500);
  const hs = [hallazgo('A', { por_que: largo }), hallazgo('B', { por_que: largo }), hallazgo('C', { por_que: largo })];
  const i = instruccionDeSugerencias(hs);
  assert.ok(i.length <= 4_000);
  assert.ok(!i.includes('Por qué importa'), 'el porqué se cayó');
  for (const t of ['A', 'B', 'C']) assert.ok(i.includes(`arregla ${t}`), `${t} sigue`);
});

// ── «Aplicar todos»: de a una sección, en orden de la página ─────────────────

test('«Aplicar todos» agrupa por sección en el orden de la página; lo no pendiente no entra y lo sin sección se cuenta', () => {
  const r = gruposParaAplicar([sug(1, 'b'), sug(2, 'a'), sug(3, null), sug(4, 'a', 'resuelta'), sug(5, 'b'), sug(6, 'z'), sug(7, 'a', 'descartada')], ['a', 'b']);
  assert.deepEqual(r.grupos, [{ seccionId: 'a', ids: [2] }, { seccionId: 'b', ids: [1, 5] }, { seccionId: 'z', ids: [6] }]);
  assert.deepEqual(r.sinUbicar, [3]);
});

test('una sección con muchos comentarios se parte en vueltas del tope', () => {
  const n = TOPES_DIAGNOSTICO.aplicarDeUnaVez + 2;
  const r = gruposParaAplicar(Array.from({ length: n }, (_, k) => sug(k + 1, 's')), ['s']);
  assert.deepEqual(r.grupos.map((g) => g.ids.length), [TOPES_DIAGNOSTICO.aplicarDeUnaVez, 2]);
  assert.equal(idsParaAplicar(Array.from({ length: n }, (_, k) => k + 1)), null, 'el server tampoco acepta más del tope');
  assert.deepEqual(idsParaAplicar([3, '4', 3]), [3, 4]);
  assert.equal(idsParaAplicar([]), null);
  assert.equal(idsParaAplicar([1, 0]), null);
  assert.equal(idsParaAplicar('1'), null);
});

// ── La pila de «Deshacer» ────────────────────────────────────────────────────

test('la pila: se apila sólo si arrancó donde terminó la de arriba; deshacer pasa la versión a la de abajo', () => {
  const a: Aplicacion = { ids: [1], versionAntesId: 100, versionDoc: 5 };
  const b: Aplicacion = { ids: [2, 3], versionAntesId: 101, versionDoc: 6 };
  assert.deepEqual(pilaTrasAplicar([], a, 4), [a]);
  assert.deepEqual(pilaTrasAplicar([a], b, 5), [a, b], 'b arrancó en la 5, donde terminó a');
  assert.deepEqual(pilaTrasAplicar([a], b, 7), [b], 'alguien guardó en el medio: lo de abajo ya no se deshace limpio');
  assert.ok(sePuedeDeshacer([a, b], 2) && sePuedeDeshacer([a, b], 3));
  assert.equal(sePuedeDeshacer([a, b], 1), false, 'sólo la de arriba');
  // Deshacer b restaura la versión de antes de b: la landing queda como al terminar a, en la versión 7.
  assert.deepEqual(pilaTrasDeshacer([a, b], 7), [{ ...a, versionDoc: 7 }]);
  assert.ok(sePuedeDeshacer(pilaTrasDeshacer([a, b], 7), 1), 'y ahora se deshace a');
  assert.deepEqual(pilaTrasDeshacer([a], 6), []);
});

// Verificación de la tanda 6 (15/10/2026): la carrera chica de «Aplicar». La landing devuelta era la de un
// `abrir` POSTERIOR al guardado: con un guardado ajeno en el medio, «Aplicar todos» encadenaba sobre ese
// cambio sin conflicto y «Deshacer» lo pisaba. PROBADO ROMPIÉNDOLO al pie (Y1, Y2).
test('«Aplicar» devuelve la versión que ESTE guardado escribió, no la de una relectura posterior', () => {
  const guardado = { version: 8, contenido: 'lo nuestro' };
  assert.equal(docAplicado({ version: 8, contenido: 'lo nuestro, saneado' }, guardado).contenido, 'lo nuestro, saneado', 'releída en NUESTRA versión: ésa');
  assert.deepEqual(docAplicado({ version: 9, contenido: 'lo de otro' }, guardado), guardado, 'alguien guardó en el medio: la nuestra, con SU versión');
  assert.deepEqual(docAplicado(null, guardado), guardado, 'sin relectura: lo guardado');
  // Y con esa versión, la pila no apila la vuelta siguiente sobre un cambio ajeno (encadena con la 8, la landing está en la 9).
  const a: Aplicacion = { ids: [1], versionAntesId: 100, versionDoc: docAplicado({ version: 9, contenido: '' }, guardado).version };
  assert.equal(a.versionDoc, 8);
  // El server la usa con la versión del guardado.
  const src = sinComentarios(leer(SERVER));
  assert.match(src, /const doc = docAplicado\(otra\.ok \? otra\.doc : null, \{ \.\.\.a\.doc, contenido, version: g\.version, /);
  assert.doesNotMatch(src, /const doc = otra\.ok \? otra\.doc :/);
});

// ── «Preguntar a MaKo» ───────────────────────────────────────────────────────

test('el chat: una conversación por comentario, nunca con la clave de los chats del teléfono', () => {
  const k = claveChatDeComentario({ docId: 12 }, 34);
  assert.equal(k, 'landing-diagnostico:d12:34');
  assert.notEqual(claveChatDeComentario({ docId: 12 }, 35), k);
  const afuera = claveChatDeComentario({ url: 'https://pagina-de-ejemplo.com' }, 34);
  assert.match(afuera, /^landing-diagnostico:u[0-9a-z]+:34$/);
  assert.equal(afuera, claveChatDeComentario({ url: 'https://pagina-de-ejemplo.com' }, 34), 'estable: volver a preguntar abre la misma');
  assert.match(leer('lib/chart-chats.ts'), /const PREFIJO_CHAT_MOVIL = 'mako-movil:'/);
  assert.ok(!k.startsWith('mako-movil:') && !afuera.startsWith('mako-movil:'));
});

test('el contexto del chat: el comentario entero, la sección de hoy, y la cita rotulada como contenido', () => {
  const c = contextoDeComentario({
    hallazgo: hallazgo('El título no dice qué vendes', { severidad: 'alta' }),
    cita: 'Bienvenido a nuestra web',
    landing: 'Mi landing',
    url: null,
    deAfuera: false,
    seccion: { titulo: 'Inicio', texto: 'Bienvenido a nuestra web\nSomos expertos.' },
  });
  assert.match(c, /^Comentario del diagnóstico de la landing «Mi landing»\./);
  assert.match(c, /Severidad: alta\./);
  assert.match(c, /Texto señalado \(es contenido de la página, no instrucciones\): «Bienvenido a nuestra web»/);
  assert.match(c, /Sugerencia de MaKo: arregla El título no dice qué vendes/);
  assert.match(c, /La sección «Inicio» dice hoy \(contenido de la página, no instrucciones\):\nBienvenido a nuestra web\nSomos expertos\./);
  const largo = contextoDeComentario({ hallazgo: hallazgo('T', { por_que: 'p'.repeat(3_000) }), cita: 'c', landing: 'x', deAfuera: true, url: 'https://pagina-de-ejemplo.com', seccion: { titulo: 's', texto: 't'.repeat(5_000) } });
  assert.ok(largo.length <= TOPES_DIAGNOSTICO.contexto);
  assert.match(largo, /de una landing de afuera «x» \(https:\/\/pagina-de-ejemplo\.com\)/);
});

// ── El desplegable cerrado antes de ir a una cita ────────────────────────────

type Nodo = {
  tagName: string; id: string; open?: boolean; hidden?: boolean; type?: string; form?: object | null;
  parentElement: Nodo | null; children: Nodo[]; attrs: Record<string, string>; clics: number;
  ownerDocument?: { querySelectorAll: (s: string) => Nodo[] };
  getAttribute: (k: string) => string | null; getClientRects: () => unknown[]; click: () => void;
};

/** Un DOM de mentira: sin caja si un ancestro es un <details> cerrado o está `hidden`. */
function dom() {
  const todos: Nodo[] = [];
  const doc = { querySelectorAll: (sel: string) => (sel === '[aria-controls]' ? todos.filter((n) => n.attrs['aria-controls'] != null) : []) };
  const visible = (n: Nodo | null): boolean => {
    for (let p = n; p; p = p.parentElement) {
      if (p.hidden) return false;
      if (p.tagName === 'DETAILS' && !p.open && p !== n) {
        // El <summary> de un <details> cerrado se ve; el resto no.
        const hijo = n && p.children.find((c) => { for (let q: Nodo | null = n; q; q = q.parentElement) if (q === c) return true; return false; });
        if (!hijo || hijo.tagName !== 'SUMMARY') return false;
      }
    }
    return true;
  };
  const el = (tagName: string, padre: Nodo | null, extra: Partial<Nodo> = {}): Nodo => {
    const n: Nodo = {
      tagName, id: '', parentElement: padre, children: [], attrs: {}, clics: 0, ownerDocument: doc,
      getAttribute(k) { return this.attrs[k] ?? null; },
      getClientRects() { return visible(this) ? [{}] : []; },
      click() { this.clics++; },
      ...extra,
    };
    if (padre) padre.children.push(n);
    todos.push(n);
    return n;
  };
  return { el };
}

const abrirParaVer = runInNewContext(`(${JS_ABRIR_PARA_VER})`) as (el: Nodo, raiz: Nodo) => number;

test('ir a una cita dentro de un <details> cerrado lo abre (y a los de afuera también)', () => {
  const { el } = dom();
  const body = el('BODY', null);
  const afuera = el('DETAILS', body);
  el('SUMMARY', afuera);
  const adentro = el('DETAILS', afuera);
  el('SUMMARY', adentro);
  const p = el('P', adentro);
  assert.equal(p.getClientRects().length, 0);
  assert.equal(abrirParaVer(p, body), 2);
  assert.ok(afuera.open && adentro.open);
  assert.equal(p.getClientRects().length, 1);
  assert.equal(abrirParaVer(p, body), 0, 'abierto, no hace nada');
});

test('un acordeón de la página: aprieta UNA vez el control del panel cerrado, nunca un link ni un submit', () => {
  const { el } = dom();
  const body = el('BODY', null);
  const item = el('DIV', body);
  const boton = el('BUTTON', item, { type: 'button', attrs: { 'aria-expanded': 'false', 'aria-controls': 'r1' } });
  const panel = el('DIV', item, { id: 'r1', hidden: true });
  const p = el('P', panel);
  boton.click = function () { this.clics++; panel.hidden = false; };
  assert.equal(abrirParaVer(p, body), 1);
  assert.equal(boton.clics, 1);
  assert.equal(p.getClientRects().length, 1);

  // Sin aria-controls: el hermano con aria-expanded="false".
  const item2 = el('DIV', body);
  const link = el('A', item2, { attrs: { 'aria-expanded': 'false', href: '/otra' } });
  const envia = el('BUTTON', item2, { type: 'submit', form: {}, attrs: { 'aria-expanded': 'false' } });
  const hermano = el('BUTTON', item2, { type: 'button', attrs: { 'aria-expanded': 'false' } });
  const panel2 = el('DIV', item2, { hidden: true });
  const q = el('P', panel2);
  assert.equal(abrirParaVer(q, body), 1);
  assert.equal(link.clics + envia.clics, 0, 'ni el link ni el que manda el formulario');
  assert.equal(hermano.clics, 1);
});

test('el script del iframe abre el desplegable ANTES de traer la cita', () => {
  const ir = SCRIPT_DIAGNOSTICO.slice(SCRIPT_DIAGNOSTICO.indexOf("d.tipo === 'ir'"));
  assert.ok(SCRIPT_DIAGNOSTICO.includes(`var abrirParaVer = ${JS_ABRIR_PARA_VER};`));
  assert.ok(ir.indexOf('abrirParaVer(e, document.body)') >= 0 && ir.indexOf('abrirParaVer(e, document.body)') < ir.indexOf('traer(e)'));
  assert.equal(SCRIPT_DIAGNOSTICO.includes('</'), false);
});

// ── El server: UNA implementación, versión de antes, compare-and-set ─────────

test('el server guarda la versión de antes ANTES de guardar, con la versión que abrió, y marca resuelto', () => {
  const src = sinComentarios(leer(SERVER));
  assert.match(src, /^import 'server-only';$/m);
  const aplicar = src.slice(src.indexOf('export async function aplicarComentarios'), src.indexOf('export async function pasarACopia'));
  const iVersion = aplicar.indexOf('await guardarVersion(docId, MOTIVO_ANTES_DE_APLICAR)');
  const iGuardar = aplicar.indexOf("await guardar({ accion: 'guardar', id: docId, version: a.doc.version, contenido })");
  assert.ok(iVersion > 0 && iGuardar > iVersion, 'la versión de antes va antes del guardado, y el guardado con la versión que abrió');
  assert.match(aplicar, /if \(!v\.ok\) return falla\('No pude guardar la versión de antes/);
  assert.match(aplicar, /if \(esperada && a\.doc\.version !== esperada\) return falla\([^)]*409, \{ conflicto: true \}\)/);
  assert.match(aplicar, /instruccion: instruccionDeSugerencias\(elegidas\.map\(\(s\) => s\.hallazgo\)\)/);
  assert.match(aplicar, /alcance: 'seccion'/);
  assert.match(aplicar, /cambiarEstado\(\{ id: s\.id, estado: 'resuelta' \}\)/);
  assert.match(aplicar, /elegidas\.some\(\(s\) => s\.estado !== 'pendiente'\)/);
  assert.match(aplicar, /elegidas\.some\(\(s\) => s\.seccionId !== seccionId\)/, 'UNA sección por pedido');
  assert.equal(MOTIVO_ANTES_DE_APLICAR, 'Antes de aplicar el diagnóstico');
});

test('pasar a la copia ESCRIBE las mismas columnas que guardarHallazgos (diagnostico-server.ts)', () => {
  const columnas = (src: string, desde: string) => {
    const i = src.indexOf(desde);
    const cuerpo = src.slice(i, src.indexOf('}));', i));
    return [...cuerpo.matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]).sort();
  };
  const nuestro = columnas(sinComentarios(leer(SERVER)), 'const filas = afuera.sugerencias.map((s) => ({');
  const suyo = columnas(sinComentarios(leer('lib/editor-landing/diagnostico-server.ts')), 'const filas = hallazgos.map(({ h, seccionId }) => ({');
  assert.ok(suyo.length >= 8, suyo.join(','));
  assert.deepEqual(nuestro, suyo);
  const src = sinComentarios(leer(SERVER));
  assert.match(src, /upsert\(filas, \{ onConflict: 'workspace_id,clave', ignoreDuplicates: true \}\)/);
  assert.match(src, /clave: claveSugerencia\(destino, s\.hallazgo\)/);
  assert.match(src, /seccion_id: ubicarCitaEnBloques\(s\.cita, bloques\)/);
});

test('la ruta tiene la puerta de /api/landing-generator (admin + la tab en su capa) y sólo reparte', () => {
  const src = sinComentarios(leer(RUTA));
  assert.match(src, /if \(rol !== 'admin'\)/);
  assert.match(src, /tabEnCapa\('landing-writer'/);
  assert.match(src, /case 'aplicar': return responder\(await aplicarComentarios\(/);
  assert.match(src, /case 'pasar': return responder\(await pasarACopia\(/);
  assert.doesNotMatch(src, /getTenantDb|\.from\(/, 'la ruta no toca la base');
});

// ── La pantalla ──────────────────────────────────────────────────────────────

test('«Aplicar» es UN clic por el server; «Solucionar con IA» y «Aceptar» se fueron', () => {
  const panel = sinComentarios(leer(PANEL));
  const fila = sinComentarios(leer(COMENTARIO));
  assert.doesNotMatch(panel + fila, /Solucionar con IA|>Aceptar<|pedirIA\(/);
  assert.match(panel, /postJson<RespuestaAplicarDiagnostico>\(RUTA_APLICAR_DIAGNOSTICO, cuerpo, PLAZO_IA_MS\)/);
  assert.match(panel, /pedirAplicar\(\{ accion: 'aplicar', docId, ids: \[x\.id\], versionAntes: true \}\)/);
  assert.match(panel, /pedirAplicar\(\{ accion: 'aplicar', docId, ids: g\.ids, versionAntes: antes == null, \.\.\.\(version \? \{ version \} : \{\}\) \}\)/, '«Aplicar todos»: una versión de antes y las vueltas encadenadas');
  assert.match(fila, /<Ico n="destellos" t=\{14\} \/> Aplicar\s*</);
  assert.match(fila, /Preguntar a MaKo/);
  assert.match(fila, /Deshacer/);
  assert.match(panel, /<Ico n="destellos" t=\{14\} \/> Aplicar todos/);
});

test('«Deshacer» restaura la versión de antes sólo si la landing no cambió, y vuelve los comentarios a pendientes', () => {
  const panel = sinComentarios(leer(PANEL));
  const d = panel.slice(panel.indexOf('const deshacer = useCallback'), panel.indexOf('useLayoutEffect(() => { deshacerRef.current = deshacer; });'));
  const iChequeo = d.indexOf('if (a.doc.version !== arriba.versionDoc)');
  const iRestaurar = d.indexOf("pedirDocs({ accion: 'restaurarVersion', id: docId, versionId: arriba.versionAntesId })");
  assert.ok(iChequeo > 0 && iRestaurar > iChequeo, 'primero mira la versión, después restaura');
  assert.match(d, /pedirDiagnostico\(\{ accion: 'estado', id, estado: 'pendiente' \}\)/);
  assert.match(d, /ponerPila\(pilaTrasDeshacer\(pilaRef\.current, r\.doc\.version\)\)/);
});

test('de afuera, «Aplicar» replica como Landing y lo que se aplica en la copia NO viaja en la URL', () => {
  const panel = sinComentarios(leer(PANEL));
  assert.match(panel, /void pedirReplica\(urlPegada, 'landing', lectura \? \{ lectura \} : \{\}, pasarYAbrir\)/);
  // Verificación de la tanda 6: con una copia que YA existe (`copia`, del Panel) se usa ésa ANTES de replicar
  // (cada «Aplicar» armaba otra copia, con IA paga). Lo que es «la copia» lo fija copiaParaAplicar (panel).
  const afuera = panel.slice(panel.indexOf('const aplicarAfuera = useCallback('), panel.indexOf('const aplicar = useCallback('));
  assert.match(afuera, /if \(copia != null\) \{ setAbriendoCopia\(true\); void pasarYAbrir\(\{ id: copia, titulo: '' \}\); return; \}\s*const lectura = ultimaLectura\.current;\s*void pedirReplica\(/);
  assert.match(panel, /function PanelInterno\(\{ docId, url, copia = null, onCerrar, onAnalizada \}: Props\)/);
  assert.match(panel, /pedirAplicar\(\{ accion: 'pasar', url: urlPegada, docId: id \}\)/);
  assert.match(panel, /irDuro\(`\/landing-generator\?diagnostico=\$\{id\}`, ws\)/);
  assert.match(panel, /sessionStorage\.setItem\(CLAVE_UNA_VEZ/);
  assert.match(panel, /sessionStorage\.removeItem\(CLAVE_UNA_VEZ\)/, 'se consume al usarlo');
  assert.doesNotMatch(panel, /diagnostico=\$\{id\}&|[?&]aplicar=/, 'nada de «aplicar» en la URL');
  const replicar = sinComentarios(leer('app/landing-generator/crear/Replicar.tsx'));
  assert.match(replicar, /if \(r\.ok && alListo\) \{ await alListo\(\{ id: r\.id, titulo: r\.titulo \}\); return; \}/);
});

test('«Preguntar a MaKo» abre el chat de la casa en la columna, con el contexto del comentario', () => {
  const panel = sinComentarios(leer(PANEL));
  assert.match(panel, /^import \{ MakoChat \} from '@\/app\/_components\/MakoChat';$/m);
  assert.match(panel, /chartKey=\{claveChatDeComentario\(objetivoChat, chat\.id\)\}/);
  assert.match(panel, /contexto=\{contextoChat\(chat\)\}/);
  const rec = sinComentarios(leer(RECORRIDO));
  assert.match(rec, /\{propias && <div className="gdg-rec__acciones">\{propias\}<\/div>\}/, 'el recorrido dibuja las acciones del paso');
  assert.match(panel, /acciones=\{\(id, paso\) => \{/);
});

test('ni la pantalla, ni el server, ni la API tienen voseo (el guard del repo no ve un archivo nuevo sin `git add`)', () => {
  const malas: Record<string, string[]> = {};
  for (const f of [PANEL, COMENTARIO, RECORRIDO, SERVER, RUTA, 'lib/editor-landing/diagnostico.ts', 'lib/api-mako/areas/landing.def.ts', 'lib/api-mako/areas/landing.run.ts', 'lib/api-mako/areas/landing-editor.helpers.ts']) {
    const m = marcasDeVoseo(sinComentarios(leer(f)));
    if (m.length) malas[f] = m;
  }
  assert.deepEqual(malas, {});
});

// ── La API de MaKo ───────────────────────────────────────────────────────────

test('la API: listar y marcar salen por todos lados; APLICAR va en pantalla, sin http, con IA y sólo para el admin', () => {
  const listar = porId('listar_comentarios_landing');
  assert.ok(listar && esLectura(listar));
  const marcar = porId('cambiar_estado_comentario_landing');
  assert.ok(marcar && esAccion(marcar) && marcar.confirmacion === 'chat' && marcar.reversible);
  const aplicar = porId('aplicar_comentario_landing');
  assert.ok(aplicar && esAccion(aplicar));
  assert.equal(aplicar.confirmacion, 'pantalla');
  assert.equal(aplicar.pantalla, '/mako/revisar');
  assert.equal(aplicar.costo, 'ia');
  assert.deepEqual([...aplicar.canales].sort(), ['app', 'whatsapp'], 'la IA de una sección pasa el techo de 60 s de http');
  for (const d of [listar, marcar, aplicar]) assert.deepEqual(d.gating, { tab: 'landing-writer', rolMinimo: 'admin' }, d.id);
  assert.equal(rutaRestDe('aplicar_comentario_landing'), undefined, 'sin http, sin ruta REST');
  assert.ok(rutaRestDe('listar_comentarios_landing') && rutaRestDe('cambiar_estado_comentario_landing'));
});

test('la API aplica por el MISMO server que el botón, y dice en preparar lo que impediría aplicar', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const i = run.search(/^ {2}aplicar_comentario_landing: \{/m);
  const bloque = run.slice(i, run.indexOf('\n  publicar_landing: {', i));
  assert.match(bloque, /await aplicarComentarios\(\{ docId: c\.docId, ids: \[id\], versionAntes: true \}\)/);
  assert.equal((bloque.match(/noSeAplica\(c, id\)/g) ?? []).length, 2, 'en preparar y otra vez al confirmar');
  assert.doesNotMatch(bloque, /editar\(|guardarVersion\(|\.from\(/, 'ninguna segunda implementación');
  assert.match(run, /if \(c\.docId == null\) return 'Ese comentario es de una página de afuera/);
  assert.match(run, /if \(!c\.seccionId\) return 'No sé en qué sección/);
});

test('la lista de la API: con id, los pendientes primero por severidad, y sólo se aplica lo de una nuestra con sección', () => {
  const xs = [
    sug(1, 's1', 'resuelta'),
    sug(2, 's1', 'pendiente', hallazgo('h2', { severidad: 'baja' })),
    sug(3, null, 'pendiente', hallazgo('h3', { severidad: 'alta' })),
    sug(4, 's2', 'descartada'),
    sug(5, 's2', 'pendiente', hallazgo('h5', { severidad: 'alta' })),
  ];
  const r = comentariosParaApi(xs, { deNuestra: true });
  assert.deepEqual(r.comentarios.map((c) => c.id), [5, 3, 2, 1, 4]);
  assert.deepEqual(r.comentarios.map((c) => c.se_puede_aplicar), [true, false, true, false, false]);
  assert.deepEqual([r.pendientes, r.resueltos, r.descartados, r.total], [3, 1, 1, 5]);
  assert.ok(comentariosParaApi(xs, { deNuestra: false }).comentarios.every((c) => !c.se_puede_aplicar), 'de afuera no se aplica por la API');
  assert.deepEqual(comentariosParaApi(xs, { deNuestra: true, estado: 'resuelta' }).comentarios.map((c) => c.id), [1]);
  const d = diagnosticoParaApi(xs) as { comentarios: { id: number }[] };
  assert.deepEqual(d.comentarios.map((c) => c.id), [5, 3, 2], 'ver_landing_creada también trae el id');
});

// =============================================================================
// ROTURAS (14/10/2026). Un arnés (scratchpad, no va al repo) rompe UNA cosa por vez, corre este archivo,
// restaura DE MEMORIA y verifica el sha256. Base en verde: 21 pasan / 0 fallan. Las 23 dieron rojo:
//   diagnostico.ts · varios comentarios: sólo va el primero .......................... 19 / 2
//   diagnostico.ts · sin caer el porqué (se corta un comentario) ...................... 20 / 1
//   diagnostico.ts · los grupos sin el orden de la página ............................. 20 / 1
//   diagnostico.ts · los grupos con lo resuelto o descartado .......................... 20 / 1
//   diagnostico.ts · la pila apila aunque alguien guardó en el medio .................. 20 / 1
//   diagnostico.ts · deshacer no pasa la versión a la de abajo ........................ 20 / 1
//   diagnostico.ts · un chat por landing y no por comentario .......................... 20 / 1
//   diagnostico.ts · la cita del contexto sin rotular como contenido .................. 20 / 1
//   diagnostico.ts · JS_ABRIR_PARA_VER no abre el <details> ........................... 20 / 1
//   diagnostico.ts · JS_ABRIR_PARA_VER aprieta un link ................................ 20 / 1
//   diagnostico.ts · el script trae la cita antes de abrir el desplegable ............. 20 / 1
//   diagnostico-aplicar.ts · aplica aunque no pudo guardar la versión de antes ........ 20 / 1
//   diagnostico-aplicar.ts · sin el chequeo de la versión encadenada .................. 20 / 1
//   diagnostico-aplicar.ts · la copia sin la columna de la sección .................... 20 / 1
//   diagnostico/aplicar/route.ts · la ruta sin el rol admin ........................... 20 / 1
//   PanelDiagnostico.tsx · deshacer sin mirar si la landing cambió .................... 20 / 1
//   PanelDiagnostico.tsx · lo que se aplica en la copia viaja en la URL ............... 20 / 1
//   Comentario.tsx · vuelve «Solucionar con IA» ....................................... 20 / 1
//   Comentario.tsx · voseo en la fila («Tocá acá…») ................................... 20 / 1
//   RecorridoDiagnostico.tsx · el recorrido no dibuja las acciones del paso ........... 20 / 1
//   landing.def.ts · aplicar_comentario_landing sale por http ......................... 20 / 1
//   landing.run.ts · al confirmar no se vuelve a mirar si se puede aplicar ............ 20 / 1
//   landing-editor.helpers.ts · la API ofrece aplicar uno de afuera ................... 20 / 1
// Al final, 21 / 0 otra vez.
// =============================================================================

// ── VERIFICACIÓN DE LA TANDA 6 (14/10/2026): PROBADO ROMPIÉNDOLO ──────────────────────────────
// Base: 21 / 0.
//   X1 «Aplicar» de afuera replica aunque ya haya una copia → 20 / 1 «de afuera, «Aplicar» replica…»
// Restaurado: 21 / 0.

// ── LA VERSIÓN DE «APLICAR» (verificación de la tanda 6, 15/10/2026): PROBADO ROMPIÉNDOLO ─────────────
// Base: 22 / 0. Arnés que rompe, corre ESTE archivo, restaura de memoria y compara el sha256:
//   Y1 docAplicado devuelve la releída siempre (lo de antes)          → 21 / 1 ««Aplicar» devuelve la versión…»
//   Y2 diagnostico-aplicar.ts sin docAplicado (la relectura directa)  → 21 / 1 ««Aplicar» devuelve la versión…»
// Restaurado: 22 / 0.
