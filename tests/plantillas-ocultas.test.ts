// =============================================================================
// «Eliminar» un Mensaje de MaKo = OCULTARLO de la lista de ESE negocio, y recuperarlo — novena tanda
// (lib/plantillas-ocultas.ts, lib/plantillas.ts, app/api/admin/plantillas/route.ts)
// =============================================================================
// Martín, 10/10/2026: «No aparecen los 3 puntos para eliminar una automatización de "MaKo en WhatsApp"...
// Las cosas de "MaKo en WhatsApp" deben ser EXACTAMENTE igual al resto». Una automatización eliminada se ARCHIVA
// y se recupera; un mensaje eliminado se OCULTA (sale de la lista, apagado) y se recupera.
//
// ⚠️ DESDE EL 11/10/2026 SÓLO LO HACE /mensajes (la agencia). «MaKo en WhatsApp» son automatizaciones de la tab
// Automations (docs/diseno-mako-en-whatsapp-unificado.md): el negocio ya no oculta ni recupera mensajes, y se
// fueron de acá los tests de su ruta (`/api/perfil/plantillas`: `?ocultos=1`, `ocultar`, `restaurar`) y de la
// galería que los recuperaba. Lo que esa ruta YA NO hace lo fija tests/automations-mako-en-whatsapp.test.ts.
//
// Lo PURO se ejecuta (la regla «oculto ⇒ apagado», quién ve qué). lib/plantillas.ts es `server-only` y lee
// la base: su cableado se fija en el fuente sin comentarios, cada pieza por su bloque.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estaOculta, ocultar, restaurar, conInterruptor, porOculto, queOcultos, PARAM_OCULTOS } from '../lib/plantillas-ocultas';
import type { EntradaStore } from '../lib/plantillas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
/** El bloque de `desde` hasta `hasta` (su cierre real, no un número de caracteres), con su largo acotado. */
function bloque(src: string, desde: string, hasta: string, tope = 4000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${desde}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

// ── 1. La regla: oculto ⇒ apagado (lo puro, ejecutado) ─────────────────────────

test('ocultar pone las DOS marcas juntas y no toca lo demás de la entrada', () => {
  const e: EntradaStore = { texto: 'hola', enabled: true, titulo: 'Mío', canales: { wa: true } };
  const o = ocultar(e);
  assert.equal(o.oculto, true);
  assert.equal(o.enabled, false, 'oculto y prendido: un mensaje que sale y no está en la lista');
  assert.equal(o.texto, 'hola'); assert.equal(o.titulo, 'Mío'); assert.deepEqual(o.canales, { wa: true });
  assert.equal(e.oculto, undefined, 'ocultar mutó la entrada que recibió');
  assert.equal(estaOculta(o), true);
  assert.equal(estaOculta(e), false);
  assert.equal(estaOculta(undefined), false);
});

test('recuperar lo devuelve a la lista PRENDIDO, sin la marca, y conserva lo demás', () => {
  const r = restaurar({ texto: 'hola', enabled: false, oculto: true, borrador: 'b' });
  assert.equal('oculto' in r, false, 'la marca quedó en la entrada (aunque sea undefined)');
  assert.equal(r.enabled, true);
  assert.equal(r.texto, 'hola'); assert.equal(r.borrador, 'b');
});

test('el interruptor: PRENDER uno oculto lo restaura; apagar no toca la marca', () => {
  const oculta: EntradaStore = { enabled: false, oculto: true };
  const prendida = conInterruptor(oculta, true);
  assert.equal(prendida.enabled, true);
  assert.equal(estaOculta(prendida), false, 'prendido y fuera de la lista: el interruptor de /mensajes no haría nada');
  const apagada = conInterruptor(oculta, false);
  assert.equal(apagada.enabled, false);
  assert.equal(estaOculta(apagada), true, 'apagar uno oculto lo devolvió a la lista');
  assert.deepEqual(conInterruptor({ texto: 'x' }, false), { texto: 'x', enabled: false });
  assert.deepEqual(conInterruptor({ texto: 'x' }, true), { texto: 'x', enabled: true });
});

test('quién ve qué: el negocio no ve lo que eliminó, la agencia (y el runtime) ve todo, y «ocultos» son sólo esos', () => {
  assert.equal(queOcultos('cliente', false), 'visibles');
  assert.equal(queOcultos('agencia', false), 'todos');
  assert.equal(queOcultos('cliente', true), 'ocultos');
  assert.equal(queOcultos('agencia', true), 'ocultos');
  const lista = [{ id: 'a', oculto: false }, { id: 'b', oculto: true }, { id: 'c', oculto: false }];
  assert.deepEqual(porOculto(lista, 'visibles').map((x) => x.id), ['a', 'c']);
  assert.deepEqual(porOculto(lista, 'ocultos').map((x) => x.id), ['b']);
  assert.deepEqual(porOculto(lista, 'todos').map((x) => x.id), ['a', 'b', 'c']);
});

// ── 2. El store (lib/plantillas.ts): el cableado, pieza por pieza ──────────────

const STORE = fuente('lib/plantillas.ts');

test('la marca de la BASE de la plataforma no se hereda: es una decisión de cada negocio', () => {
  const par = bloque(STORE, 'async function leerPar(', 'async function leerStore(');
  // Se saca de la entrada de la base, junto al borrador, ANTES de armar lo efectivo.
  assert.match(par, /const \{ oculto: _\w+, borrador: _sinHeredar, \.\.\.heredable \} = baseStore\[id\] \?\? \{\};/);
  assert.ok(par.indexOf('oculto: _') < par.indexOf('efectivo[id] = { ...heredable'));
});

test('oculto ⇒ apagado también al LEER: `estaPrendida` lo pregunta antes que el interruptor', () => {
  const prendida = bloque(STORE, 'function estaPrendida(', 'function customACatalogo(');
  const iOculta = prendida.indexOf('if (estaOculta(e)) return false;');
  assert.ok(iOculta > 0, 'un oculto con `enabled: true` saldría');
  assert.ok(iOculta < prendida.indexOf("typeof e?.enabled === 'boolean'"), 'el interruptor se pregunta antes que la marca');
  // La vista lleva la marca (salvo un fijo, que no se esconde).
  assert.match(bloque(STORE, 'function aVista(', 'function estaPrendida('), /oculto: cat\.porDefecto !== 'siempre' && estaOculta\(e\),/);
});

test('la lista recorta con `queOcultos` (el negocio no ve lo que eliminó) y `getPlantilla` sigue viendo todo', () => {
  const listar = bloque(STORE, 'export async function listarPlantillas(', 'export async function getPlantilla(');
  assert.match(listar, /return porOculto\(\[\.\.\.built, \.\.\.custom\], queOcultos\(agencia \? 'agencia' : 'cliente', opts\.ocultos === true\)\);/);
  // El runtime (`plantillaActiva`, `emitirDelCatalogo`) lee por acá: un oculto tiene que encontrarse, APAGADO.
  assert.match(bloque(STORE, 'export async function getPlantilla(', 'export async function referenciaPlantilla('), /listarPlantillas\(\{ vista: 'agencia' \}\)/);
});

test('las escrituras pasan por las funciones de la regla: ocultar, restaurar y el interruptor', () => {
  const enabled = bloque(STORE, 'export async function setEnabledPlantilla(', 'export async function ocultarPlantilla(');
  assert.match(enabled, /await mutar\(id, \(e\) => conInterruptor\(e, enabled\)\);/);
  const oc = bloque(STORE, 'export async function ocultarPlantilla(', 'export async function restaurarPlantilla(');
  // Un fijo no se oculta: no se apaga, y esconderlo dejaría algo que sale y no se ve.
  assert.match(oc, /if \(CATALOGO_AVISOS\.find\(\(c\) => c\.id === id\)\?\.porDefecto === 'siempre'\) return false;\n\s+await mutar\(id, ocultar\);\n\s+return true;/);
  assert.match(bloque(STORE, 'export async function restaurarPlantilla(', 'export async function setCanalesPlantilla('), /await mutar\(id, restaurar\);/);
});

// ── 3. La ruta de /mensajes: las acciones, detrás de su guard ─────────────────

test('/api/admin/plantillas: el mismo protocolo (paridad), adentro de `enSuStore`, y `borrar` sigue borrando en /mensajes', () => {
  const ruta = fuente('app/api/admin/plantillas/route.ts');
  assert.match(ruta, /return enSuStore\(\(\) => postEnSuStore\(req\)\);/);
  const post = ruta.slice(ruta.indexOf('async function postEnSuStore'));
  assert.match(post, /case 'ocultar': \{\n\s+if \(!b\.id\)[^\n]+\n\s+if \(!\(await ocultarPlantilla\(b\.id\)\)\) return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 400 \}\);/);
  // `restaurar` contesta 400 cuando no escribió (en la BASE de la plataforma: tests/automations-paso-ia-revision.test.ts).
  assert.match(post, /case 'restaurar': \{\n\s+if \(!b\.id\)[^\n]+\n\s+if \(!\(await restaurarPlantilla\(b\.id\)\)\) return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 400 \}\);/);
  assert.match(post, /case 'borrar': \{[^\n]+await borrarPlantilla\(b\.id\)/);
  assert.match(bloque(ruta, 'async function getEnSuStore', 'type Body'), /if \(params\.get\(PARAM_OCULTOS\) === '1'\) return NextResponse\.json\(\{ ok: true, plantillas: await listarPlantillas\(\{ vista: 'agencia', ocultos: true \}\) \}\);/);
});

test('el pedido de los ocultos: la ruta de /mensajes lee `PARAM_OCULTOS` de lib/plantillas-ocultas.ts', () => {
  // Vivía en lib/chatbot-mensajes-mako.ts, que se borró el 11/10/2026 con la lista vieja de /automations.
  assert.equal(PARAM_OCULTOS, 'ocultos');
  assert.match(fuente('app/api/admin/plantillas/route.ts'), /import \{ PARAM_OCULTOS \} from '@\/lib\/plantillas-ocultas';/);
  // Y la ruta del NEGOCIO ya no lo lee: el negocio no oculta nada.
  assert.doesNotMatch(fuente('app/api/perfil/plantillas/route.ts'), /PARAM_OCULTOS/);
});

// ROTURAS (10/10/2026), una por vez, con un arnés (scratchpad `ocultos-romper.mjs`) que rompe, corre ESTE
// archivo y el de la lista vieja, y restaura DE MEMORIA (nunca con git checkout) verificando con md5 que cada
// archivo volviera idéntico. Las que siguen vigentes (pass / fail sobre los 30 de entonces):
//   · R1 `ocultar` sin apagar: 29 / 1 · R2 `restaurar` deja la marca: 28 / 2 · R3 prender no restaura: 29 / 1
//   · R4 el cliente ve todo: 29 / 1 · R5 el recorte al revés: 29 / 1 · R6 la base hereda la marca: 29 / 1
//   · R7 `estaPrendida` sin la marca: 29 / 1 · R8 la lista sin recortar: 29 / 1 · R9 el interruptor sin
//     `conInterruptor`: 29 / 1 · R10 se oculta un fijo: 29 / 1 · R11 la vista sin la marca: 29 / 1
//   · R15 admin sin `ocultar`: 29 / 1 · R16 admin: los ocultos sin la vista de la agencia: 29 / 1
// (R12-R14 y R17-R22 eran de la ruta del negocio y de la galería, que se fueron el 11/10/2026.)
