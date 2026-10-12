// =============================================================================
// «Compartir» del Dashboard — el CABLEADO: que las guardas puras se llamen donde importan
// =============================================================================
// tests/dashboard-compartir.test.ts prueba las funciones (`administraShare`, `puedeVerInforme`, las reglas
// de la vista compartida). Éste prueba que las LLAMEN los que tienen que llamarlas, leyendo el fuente sin
// comentarios (la convención de la casa es citar en el comentario lo que se sacó, y un guard de «esto no
// está» se acusaría a sí mismo). Un guard de cableado contesta «¿está enchufado?», nunca «¿hace lo que
// dice?»: por eso son dos archivos.
//
// Probado ROMPIÉNDOLO (11/10/2026), contra la base en verde (8 pass / 0 fail), restaurado de memoria por un
// arnés que reescribe el original y verifica que quedó idéntico (nunca git):
//   · DELETE revocando con `revocarShare(WS, id)` en vez del workspace del que administra → 7 / 1
//   · el alta del informe con `recursoId: body.recursoId || adm.sub`                     → 7 / 1
//   · el endpoint leyendo `getUsuarioActual()`                                           → 7 / 1
//   · `datosDeBloques(` fuera de `enSuWorkspace`                                         → 7 / 1
//   · la página cortando por branding ANTES de la rama del informe                       → 7 / 1
//   · el informe compartido sin `soloLectura`                                            → 7 / 1
//   · el endpoint sin el tope por token                                                  → 7 / 1
//   · al navegador el informe real (`inicial={tablero}`) en vez del de alias             → 7 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que abre `desde` y termina en su cierre REAL, con su largo afirmado. */
function bloque(src: string, desde: string, hasta: string, tope: number): string {
  const i = src.indexOf(desde);
  assert.ok(i > -1, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > -1, `no encontré el cierre «${hasta}» de «${desde}»`);
  const b = src.slice(i, j);
  assert.ok(b.length <= tope, `el bloque de «${desde}» mide ${b.length} y el tope es ${tope}: está mirando otra cosa`);
  return b;
}

const RUTA = sinComentarios(leer('app/api/compartir/route.ts'));
const ENDPOINT = sinComentarios(leer('app/api/compartido/graficos/route.ts'));
const SERVER = sinComentarios(leer('app/compartido/[token]/informe-compartido.ts'));
const PAGINA = sinComentarios(leer('app/compartido/[token]/page.tsx'));
const VISTA = sinComentarios(leer('app/compartido/[token]/InformeCompartido.tsx'));
const BOTON = sinComentarios(leer('app/dashboard/CompartirInforme.tsx'));

test('/api/compartir: todo lo que recibe un id pregunta DE QUIÉN es antes de tocarlo, y opera en SU workspace', () => {
  // Las funciones de lib/shares.ts filtran sólo por workspace; en un workspace conviven los informes de
  // varias personas. Por eso cada operación corre sobre el workspace del administrador que la fila aceptó.
  for (const op of ['revocarShare', 'revocarInvitado', 'regenerarTokenShare', 'regenerarTokenInvitado', 'leerTokenShare', 'leerTokenInvitado']) {
    assert.match(RUTA, new RegExp(`${op}\\(hallado\\.adm\\.ws`), `${op} no corre sobre el workspace de quien administra la fila`);
    assert.doesNotMatch(RUTA, new RegExp(`${op}\\(WS\\b`), `${op} con el workspace fijo de la plataforma`);
  }
  // Y en cada handler, la pregunta va ANTES de la operación.
  const handlers: Array<[string, string, string[]]> = [
    ['export async function PATCH(', '\n}\n', ['regenerarTokenInvitado(', 'regenerarTokenShare(']],
    ['export async function DELETE(', '\n}\n', ['revocarInvitado(', 'revocarShare(']],
    ['const copiar = req.nextUrl', 'const recurso = req.nextUrl', ['leerTokenInvitado(', 'leerTokenShare(']],
    ['if (body.shareId) {', 'const recurso = String(body.recurso', ['invitar(']],
  ];
  for (const [desde, hasta, ops] of handlers) {
    const b = bloque(RUTA, desde, hasta, 3000);
    const pregunta = Math.min(...['shareAdministrable(', 'invitadoAdministrable('].map((x) => b.indexOf(x)).filter((x) => x > -1));
    assert.ok(Number.isFinite(pregunta), `${desde}: no pregunta de quién es la fila`);
    for (const op of ops) assert.ok(b.indexOf(op) > pregunta, `${desde}: ${op} corre antes de preguntar de quién es la fila`);
  }
});

test('/api/compartir: el informe se comparte desde la SESIÓN; lo que mande el cliente como id no se usa', () => {
  const post = bloque(RUTA, 'export async function POST(', '\nexport async function DELETE(', 9000);
  const alta = bloque(post, 'if (recurso === RECURSO_INFORME) {', 'if (!admins.plataforma) return SOLO_ADMIN();', 2500);
  assert.match(alta, /ws: adm\.ws, recurso: RECURSO_INFORME, alcance: 'item', recursoId: adm\.sub/, 'el share del informe nace con el ws y la persona de la sesión');
  assert.doesNotMatch(alta, /body\.recursoId|body\.alcance|body\.ws\b|body\.sub\b/, 'el alta del informe lee un id del cliente');
  const get = bloque(RUTA, 'export async function GET(', '\nasync function responderLista(', 6000);
  const lista = bloque(get, 'if (recurso === RECURSO_INFORME) {', 'if (!admins.plataforma) return SOLO_ADMIN();', 1500);
  assert.match(lista, /listarShares\(adm\.ws, RECURSO_INFORME, adm\.sub\)/, 'la lista del informe es la de esta persona en este workspace');
  assert.match(lista, /administraShare\(adm,/, 'y pasa por la misma pregunta que las acciones');
  // La puerta: admin del workspace, con la tab Dashboard en su capa.
  const puerta = bloque(RUTA, 'async function administradores(', '\n}\n', 1200);
  assert.match(puerta, /tabEnCapa\('graphics', capa\)/);
  assert.match(puerta, /puedeCompartirInforme\(quien\)/);
});

test('el endpoint del link no lee sesión, ni cookie, ni un workspace del pedido', () => {
  assert.doesNotMatch(ENDPOINT, /getUsuarioActual|getSesionAdmin|getRolWsEfectivo|getWorkspaceActual|cookies\(|headers\(\)/,
    'una ruta en PUBLICOS no puede leer la cookie: el early-return del proxy se saltea el chequeo de Origin');
  assert.doesNotMatch(ENDPOINT, /body\.(grafico|bloque|campo|fuentes|ws|sub|workspace)\b/, 'el endpoint usa lo que el cuerpo dice del componente');
  // La fila VIVA en cada pedido, y el detalle cerrado.
  const post = bloque(ENDPOINT, 'export async function POST(', '\n}\n', 4000);
  assert.match(post, /const informe = await accesoAInforme\(token\);/);
  assert.match(post, /accion === 'detalle'\) return responder\(\{ error: DETALLE_NO_SE_COMPARTE \}, 403\)/);
  // Los topes: por IP antes de leer el cuerpo, y por token.
  assert.ok(post.indexOf('compartido-graficos:ip:') > -1 && post.indexOf('compartido-graficos:ip:') < post.indexOf('leerJsonTopeado('), 'el tope por IP va antes de leer nada');
  assert.match(post, /rateLimit\(`compartido-graficos:t:\$\{huella\}`/, 'falta el tope por token');
});

test('todo lo que el link lee corre en el workspace DEL SHARE', () => {
  for (const lector of ['datosDeGraficos(', 'datosDeBloques(', 'valoresDeCampo(', 'leerTableroVersionado(']) {
    let desde = 0;
    let vistos = 0;
    for (let i = SERVER.indexOf(lector, desde); i > -1; i = SERVER.indexOf(lector, desde)) {
      vistos += 1;
      const antes = SERVER.slice(Math.max(0, i - 80), i);
      assert.match(antes, /enSuWorkspace\(a, \(\) =>\s*$/, `${lector} fuera de enSuWorkspace: sin cookie lee el ws 1`);
      desde = i + lector.length;
    }
    assert.ok(vistos > 0, `no encontré ${lector}`);
  }
  assert.match(SERVER, /const enSuWorkspace = <T,>\(a: AccesoInforme, fn: \(\) => Promise<T>\): Promise<T> => runWithWorkspace\(a\.ws, fn\);/);
  assert.match(SERVER, /ws: Number\(acceso\.share\.workspace_id\)/, 'el workspace sale de la FILA del share');
  assert.match(SERVER, /if \(!puedeVerInforme\(acceso\.share, sub\)\) return null;/);
});

test('la página: el informe entra por su puerta ANTES de la galería, y se monta en sólo lectura', () => {
  const rama = PAGINA.indexOf('if (acceso.share.recurso === RECURSO_INFORME) {');
  const branding = PAGINA.indexOf("if (acceso.share.recurso !== 'branding') notFound();");
  assert.ok(rama > -1 && branding > rama, 'la rama del informe tiene que ir antes del corte de branding');
  assert.match(bloque(PAGINA, 'if (acceso.share.recurso === RECURSO_INFORME) {', 'return <InformeCompartido', 600), /const informe = informeDeAcceso\(acceso\);\s*if \(!informe\) notFound\(\);/);
  const editor = bloque(VISTA, '<EditorInforme', '/>', 600);
  assert.match(editor, /\ssoloLectura\b/, 'sin soloLectura, un autoguardado con la sesión de quien mira le pisaría SU informe');
  assert.match(editor, /compartido=\{\{ token \}\}/);
  // Al navegador va el informe con los controles de personas en alias; los datos, del real.
  assert.match(editor, /inicial=\{inicial\}/);
  assert.match(VISTA, /const inicial = tableroParaLink\(tablero\);/);
  assert.match(VISTA, /datosInicialesDeHoja\(informe, hoja, hoy\)/);
  assert.ok(VISTA.indexOf('registrarVisita(') < VISTA.indexOf('leerInformeCompartido('), 'la visita se cuenta antes de leer');
});

test('el botón es el MISMO Compartir de Conocimientos, con el recurso del informe y la hoja abierta', () => {
  assert.match(BOTON, /<Compartir\s+recurso=\{RECURSO_INFORME\}/);
  assert.match(BOTON, /parametros=\{\{ hoja: hojaId \}\}/);
  assert.match(BOTON, /export function BotonCompartir\(\{ hojaId, titulo, compacto \}: \{ hojaId: string; titulo: string; compacto\?: boolean \}\)/,
    'la firma del contrato con la topbar (hojaId, titulo) no se cambia');
  assert.doesNotMatch(BOTON, /createPortal|className="cmp-ov"/, 'un modal propio sería la copia que se queda vieja');
});

test('Compartir sin `parametros` pide exactamente lo de siempre', () => {
  const C = sinComentarios(leer('app/conocimientos/Compartir.tsx'));
  assert.match(C, /parametros\?: Record<string, string>;/, '`parametros` es opcional');
  assert.match(C, /const extra = parametros \? new URLSearchParams\(parametros\)\.toString\(\) : '';/);
  assert.match(C, /const conExtra = \(q: string\) => \(extra \? `\$\{q\}&\$\{extra\}` : q\);/, 'sin parametros la query queda igual');
  // En los cuerpos va PRIMERO: no puede pisar el recurso ni el share.
  assert.match(C, /JSON\.stringify\(\{ \.\.\.parametros, recurso, recursoId,/);
  assert.match(C, /JSON\.stringify\(\{ \.\.\.parametros, shareId,/);
});

test('la ruta del link está EXACTA en las públicas que aceptan POST', async () => {
  const { esPublica, esPublicaDeEscritura, esPublicaSoloLectura } = await import('../lib/rutas-publicas');
  assert.equal(esPublicaDeEscritura('/api/compartido/graficos'), true);
  assert.equal(esPublica('/api/compartido/graficos'), true, 'sin esto el middleware pide sesión y el 405 ni se evalúa');
  assert.equal(esPublicaDeEscritura('/api/compartido/graficos/x'), false, 'exacta, no por prefijo');
  assert.equal(esPublicaSoloLectura('/api/compartido/graficos/x'), true);
});
