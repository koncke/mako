// =============================================================================
// «Eliminar» un Mensaje de MaKo = OCULTARLO de la lista de ESE negocio, y recuperarlo — novena tanda
// (lib/plantillas-ocultas.ts, lib/plantillas.ts, app/api/perfil/plantillas/route.ts,
// app/api/admin/plantillas/route.ts, lib/chatbot-mensajes-mako.ts, app/automations/ChatAgentApp.tsx,
// app/automations/GaleriaPlantillas.tsx)
// =============================================================================
// Martín, 10/10/2026: «No aparecen los 3 puntos para eliminar una automatización de "MaKo en WhatsApp"...
// Las cosas de "MaKo en WhatsApp" deben ser EXACTAMENTE igual al resto». Y del «Reporte semanal»: «yo lo
// elimino cuando agregues los tres puntos». Una automatización eliminada se ARCHIVA y se recupera; un mensaje
// eliminado se OCULTA (sale de la lista de este negocio, apagado) y se recupera desde «Nueva automatización».
//
// Lo PURO se ejecuta (la regla «oculto ⇒ apagado», quién ve qué). lib/plantillas.ts es `server-only` y lee
// la base: su cableado se fija en el fuente sin comentarios, cada pieza por su bloque. La galería se dibuja.
// El «⋯» de la fila y su confirmación, en tests/chatbot-mensajes-mako.test.ts.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estaOculta, ocultar, restaurar, conInterruptor, porOculto, queOcultos } from '../lib/plantillas-ocultas';
import { ENDPOINT_MENSAJES_MAKO, ENDPOINT_MENSAJES_OCULTOS, PARAM_OCULTOS, emojiDeMensaje } from '../lib/chatbot-mensajes-mako';
import { GaleriaPlantillas, ROTULO_OCULTOS, LINEA_OCULTO } from '../app/automations/GaleriaPlantillas';
import type { EntradaStore, PlantillaVista } from '../lib/plantillas';

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

// ── 3. Las rutas: las acciones nuevas, detrás de los mismos guards ─────────────

test('/api/perfil/plantillas: ocultar y restaurar detrás del guard de admin Y del de los avisos del super admin', () => {
  const ruta = fuente('app/api/perfil/plantillas/route.ts');
  const post = ruta.slice(ruta.indexOf('export async function POST'));
  const iGuardAdmin = post.indexOf('const no = await denegado();');
  const iGuardSuper = post.indexOf('await soloDelSuperAdmin(b.id)');
  const iSwitch = post.indexOf('switch (b.action)');
  assert.ok(iGuardAdmin > 0 && iGuardAdmin < iGuardSuper && iGuardSuper < iSwitch, 'los guards no van antes del switch');
  const casos = bloque(post, "      case 'borrar':", "      case 'probar':", 1500);
  // Del lado del negocio nada destruye: el tacho de la bandeja de correo (`borrar`) también oculta.
  assert.match(casos, /case 'borrar':\n\s+case 'ocultar':\n\s+if \(!b\.id\) return faltaId\(\);\n\s+if \(!\(await ocultarPlantilla\(b\.id\)\)\) return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 400 \}\);/);
  assert.match(casos, /case 'restaurar':\n\s+if \(!b\.id\) return faltaId\(\);\n\s+await restaurarPlantilla\(b\.id\);/);
  assert.doesNotMatch(ruta, /borrarPlantilla/, 'el cliente volvió a poder borrar de verdad');
});

test('/api/perfil/plantillas: el GET de los ocultos es la vista del CLIENTE (lo que su lista podía mostrar), detrás del guard', () => {
  const get = bloque(fuente('app/api/perfil/plantillas/route.ts'), 'export async function GET', 'export async function POST');
  const iGuard = get.indexOf('if (no) return no;');
  const iOcultos = get.indexOf('params.get(PARAM_OCULTOS)');
  assert.ok(iGuard > 0 && iOcultos > iGuard, 'los ocultos se leen sin el guard de admin');
  assert.ok(iOcultos > get.indexOf('if (ajeno) return ajeno;'), 'los ocultos se leen antes del guard del super admin');
  assert.match(get, /if \(params\.get\(PARAM_OCULTOS\) === '1'\) return NextResponse\.json\(\{ ok: true, plantillas: await listarPlantillas\(\{ ocultos: true \}\) \}\);/);
});

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

test('el pedido de los ocultos: /automations lo arma y las dos rutas lo leen con la MISMA constante', () => {
  const u = new URL(ENDPOINT_MENSAJES_OCULTOS, 'https://app.local');
  assert.equal(u.pathname, ENDPOINT_MENSAJES_MAKO);
  assert.equal(u.searchParams.get(PARAM_OCULTOS), '1');
  for (const r of ['app/api/perfil/plantillas/route.ts', 'app/api/admin/plantillas/route.ts']) {
    assert.match(fuente(r), /import \{ PARAM_OCULTOS \} from '@\/lib\/chatbot-mensajes-mako';/, `${r} no lee la constante`);
  }
  assert.match(fuente('app/automations/ChatAgentApp.tsx'), /const r = await fetch\(ENDPOINT_MENSAJES_OCULTOS, \{ cache: 'no-store' \}\);/);
});

// ── 4. Recuperar: la galería de «Nueva automatización» ─────────────────────────

const OCULTOS: Pick<PlantillaVista, 'id' | 'titulo' | 'categoria'>[] = [
  { id: 'reporte-semanal', titulo: 'Reporte semanal', categoria: 'reporte' },
  { id: 'custom-1-abc', titulo: 'Recordar la renovación', categoria: 'aviso' },
];
const galeria = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(GaleriaPlantillas, {
  productos: [], onCerrar: () => {}, onEmpezar: () => {}, onCreada: () => {}, ...extra,
} as Parameters<typeof GaleriaPlantillas>[0]));

test('la galería dibuja «Mensajes de MaKo» con una tarjeta por cada eliminado (emoji, nombre y cómo se recupera)', () => {
  const html = galeria({ ocultos: OCULTOS, onRestaurar: async () => null });
  const iSeccion = html.indexOf('data-galeria-ocultos');
  assert.ok(iSeccion > 0, 'no está la sección');
  assert.ok(html.indexOf(`>${ROTULO_OCULTOS}</div>`, iSeccion) > iSeccion, 'la sección sin su rótulo');
  for (const o of OCULTOS) {
    const tarjeta = html.match(new RegExp(`<button[^>]*data-oculto="${o.id}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? '';
    assert.ok(tarjeta, `«${o.titulo}» sin tarjeta`);
    assert.ok(tarjeta.includes(emojiDeMensaje(o)) && tarjeta.includes(`>${o.titulo}<`) && tarjeta.includes(LINEA_OCULTO), `la tarjeta de «${o.titulo}» está incompleta`);
    assert.doesNotMatch(tarjeta, /disabled/, `«${o.titulo}» no se puede tocar`);
  }
  // Va al pie, después de las plantillas: es lo menos frecuente del modal.
  assert.ok(iSeccion > html.lastIndexOf('data-plantilla='), 'la sección no va al pie');
});

test('sin ninguno eliminado (o sin quién lo recupere) la sección no se dibuja', () => {
  assert.doesNotMatch(galeria({ ocultos: [], onRestaurar: async () => null }), /data-galeria-ocultos|data-oculto=/);
  assert.doesNotMatch(galeria(), /data-galeria-ocultos/);
  assert.doesNotMatch(galeria({ ocultos: OCULTOS }), /data-galeria-ocultos/, 'una tarjeta que al tocarla no haría nada');
});

test('/automations le pasa los ocultos a la galería, y recuperar relee la lista ANTES de abrir el lienzo', () => {
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.match(app, /ocultos=\{ocultos \?\? \[\]\} onRestaurar=\{restaurarMensaje\} \/>/);
  assert.match(app, /useEffect\(\(\) => \{ if \(rolAdmin\) void cargarOcultos\(\); \}, \[rolAdmin, cargarOcultos\]\);/);
  assert.match(app, /onOcultosCambio=\{\(\) => void cargarOcultos\(\)\}/);
  const rest = bloque(app, 'const restaurarMensaje = async', '\n  };\n', 1500);
  assert.match(rest, /body: JSON\.stringify\(\{ action: 'restaurar', id \}\)/);
  // `abrirAviso` sólo abre un mensaje que esté entre los que la lista ya trae: primero se relee.
  const iRelee = rest.indexOf('await Promise.all([cargarAvisos(), cargarOcultos()]);');
  assert.ok(iRelee > 0 && iRelee < rest.indexOf('setAbrirAviso({ id });'), 'el lienzo se pide abrir antes de que la lista lo traiga');
  assert.ok(rest.indexOf('setGaleria(false);') > iRelee);
});

// ROTURAS (10/10/2026), una por vez, con un arnés (scratchpad `ocultos-romper.mjs`) que rompe, corre ESTE
// archivo y tests/chatbot-mensajes-mako.test.ts (30 tests entre los dos), y restaura DE MEMORIA (nunca con
// git checkout) verificando con md5 que cada archivo volviera idéntico. Base: 30 pass / 0 fail; al final, igual.
// Las de este archivo (pass / fail):
//   · R1 `ocultar` sin apagar: 29 / 1 · R2 `restaurar` deja la marca: 28 / 2 · R3 prender no restaura: 29 / 1
//   · R4 el cliente ve todo: 29 / 1 · R5 el recorte al revés: 29 / 1 · R6 la base hereda la marca: 29 / 1
//   · R7 `estaPrendida` sin la marca: 29 / 1 · R8 la lista sin recortar: 29 / 1 · R9 el interruptor sin
//     `conInterruptor`: 29 / 1 · R10 se oculta un fijo: 29 / 1 · R11 la vista sin la marca: 29 / 1
//   · R12 perfil sin `restaurar`: 29 / 1 · R13 perfil: `borrar` vuelve a borrar de verdad: 29 / 1 · R14 perfil:
//     los ocultos con la vista de la agencia: 29 / 1 · R15 admin sin `ocultar`: 29 / 1 · R16 admin: los ocultos
//     sin la vista de la agencia: 29 / 1 · R17 /automations arma el pedido a mano: 29 / 1
//   · R18 recuperar abre el lienzo antes de releer la lista: 29 / 1 · R19 la galería sin los ocultos: 29 / 1
//   · R20 la sección sin quién recupere: 29 / 1 · R21 la sección aunque no haya ninguno: 29 / 1 · R22 la
//     tarjeta apagada: 29 / 1
// Las del «⋯» (R23-R34), al pie de tests/chatbot-mensajes-mako.test.ts.
