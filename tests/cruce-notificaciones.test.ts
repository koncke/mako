import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// =============================================================================
// Nada que salga de MaKo puede llevar el workspace de otro cliente
// =============================================================================
// Pedido de Martín (06/10/2026): «es MUY importante que jamás se choquen las notificaciones
// entre workspace, eso es gravísimo, altera toda la ciberseguridad y datos sensibles de
// clientes». Este guard fija los dos cruces REALES que encontró el relevo de la capa —los
// que mueven estado o identidad de un cliente a otro, no sólo el destino de un link.
//
// Los dos son estructurales: no hacía falta ningún caso de borde para dispararlos.
//
// ⚠️ Se lee el FUENTE sin comentarios, porque la convención de la casa es explicar en el
// comentario lo que se sacó — y entonces un `doesNotMatch` se acusa a sí mismo.
//
// Probado rompiéndolo SIETE veces (06/10/2026), cada una con UN solo test en rojo y el
// motivo nombrando la aserción: (1) el acuse con el `ws` de la instancia, (2) el acuse sin
// su fail-closed, (3) el remitente otra vez por `getEmailFrom()`, (4) el envío fuera del
// workspace de la plataforma, (5) Chatwoot devuelto al inbox `?? '3'`, (6) reusar una
// conversación sin filtrar por inbox, (7) el drenador de corridas devuelto a getTenantDb. ⚠️ La CUARTA pasó en VERDE la primera vez: el `assert.match`
// del `runWithWorkspace` se satisfacía con el del PREFLIGHT de más arriba en el mismo
// archivo. Por eso ahora se exige adentro del bloque de `invitar` — un guard que lee el
// archivo entero encuentra lo que el archivo dice de sí, no lo que hace la función.

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(RAIZ + rel, 'utf8').replace(/\r\n/g, '\n');

/** Las líneas primero (un `//` puede abrir un `/*` que se cierra páginas abajo). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El bloque entre dos anclas, con su cierre REAL y no un recorte por caracteres. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré el arranque del bloque: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre del bloque: ${hasta}`);
  return src.slice(i, j);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. El acuse de recibo del webhook
// ─────────────────────────────────────────────────────────────────────────────
// `groupsIgnore: true` es el default de toda instancia de cliente, así que los grupos se
// habilitan SÓLO en la línea de voz de MaKo — y esa línea está mapeada al dueño. Con el
// `ws` de `wsDeInstancia`, TODO «ok» de TODO grupo de TODOS los workspaces cerraba las
// insistencias del ws1 y marcaba SUS corridas de flujo: el trabajo de un cliente apagaba
// el seguimiento de otro, sin un solo error y para los 10 workspaces.
//
// Probado rompiéndolo (06/10/2026): volviendo `wsGrupo` a `ws` en las tres llamadas, caen
// 2 de las 4 aserciones de este test (2 pasan / 1 falla sobre el archivo).
test('el acuse de recibo resuelve el workspace por el GRUPO, nunca por la instancia', () => {
  const src = sinComentarios(leer('app/api/webhooks/evolution/route.ts'));
  // Arranca donde el acuse agrupa por jid y termina en SU `catch`, que es el cierre real de
  // ese `after`. No se recorta por caracteres —eso miraría la función de al lado— y el
  // ancla no puede ser `for (const m of grupos) {`: ese texto también está adentro del
  // bloque, así que el recorte quedaba en una línea y el test pasaba a verde por nada.
  const acuse = bloque(src, 'const porJid = new Map', "catch (e) { console.error('[webhook:evolution] acuse:'");

  assert.match(acuse, /wsDeGrupoJid\(jid\)/, 'el acuse tiene que resolver el workspace por el jid del grupo');
  assert.match(acuse, /if \(wsGrupo == null\) continue;/, 'fail-closed: un grupo sin dueño reconocido no acusa nada');
  for (const fn of ['acusesDe', 'cerrarPorAcuse', 'marcarRespondieron']) {
    assert.match(acuse, new RegExp(`${fn}\\(wsGrupo\\)`), `${fn} tiene que recibir el ws del GRUPO`);
    assert.doesNotMatch(acuse, new RegExp(`${fn}\\(ws\\)`), `${fn} está usando el ws de la instancia, que para los grupos es siempre el dueño`);
  }
});

test('wsDeGrupoJid se exporta, así que el acuse y el doer contestan lo MISMO', () => {
  // Dos implementaciones de «de quién es este grupo» divergen en cuanto una crece; la del
  // doer ya tenía los tres casos (grupo de cliente, grupo del super admin, allowlist).
  assert.match(leer('lib/mako-doer-in.ts'), /export async function wsDeGrupoJid\(/);
  assert.match(leer('app/api/webhooks/evolution/route.ts'), /wsDeGrupoJid \} from '@\/lib\/mako-doer-in'|wsDeGrupoJid,/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El mail de la plataforma
// ─────────────────────────────────────────────────────────────────────────────
// `getEmailFrom()` lee el `resend_from` del workspace EN CURSO, y en esta ruta el workspace
// en curso es el CLIENTE que el super admin tiene abierto en la pestaña. Medido contra
// producción: el ws11 tiene cargadas su `RESEND_API_KEY` y su `RESEND_FROM`, así que un mail
// de MaKo podía salir firmado por ese negocio y por SU cuenta de Resend. Sale un mail válido
// las dos veces — por eso no lo ve nadie.
//
// Probado rompiéndolo (06/10/2026): devolviendo `const from = await getEmailFrom()`, falla
// la primera aserción (2 pasan / 1 falla).
test('el mail de «te compartieron material» lo firma la PLATAFORMA, no el cliente de la pestaña', () => {
  const src = sinComentarios(leer('app/api/compartir/route.ts'));

  assert.doesNotMatch(src, /getEmailFrom/, 'el remitente no puede salir del workspace en curso: ése es el cliente que el admin tiene abierto');
  assert.match(src, /const from = REMITENTE_MAKO;/, 'el remitente es la constante de la plataforma, explícita');

  // ⚠️ EL `runWithWorkspace` SE EXIGE ADENTRO DE `invitar`, no en el archivo. Probado
  // rompiéndolo: sacándolo de ahí, un `assert.match` sobre el fuente entero seguía en VERDE
  // porque el PREFLIGHT de más arriba también lo usa — el guard que lee el archivo completo
  // encuentra lo que el archivo dice de sí, no lo que hace la función que importa.
  const envio = bloque(src, 'async function invitar(', 'async function invitarComoMaKo(');
  assert.match(envio, /return runWithWorkspace\(await wsSuperAdmin\(\), \(\) => invitarComoMaKo\(/,
    'el envío corre en el workspace de la plataforma, que es donde la key de Resend cae a la del env');

  // ⚠️ Y el preflight mide LO QUE SE VA A USAR. Preguntar `remitenteEsSandbox()` sobre el
  // workspace en curso es verificar otra cosa y creerse cubierto.
  const pre = bloque(src, 'const correo = await runWithWorkspace', 'return NextResponse.json({ ok: true, shares: conInvitados, correo })');
  assert.match(pre, /resendConfigurado\(\)/, 'el preflight sigue mirando si hay key');
  assert.match(pre, /remitente: EMAIL_MAKO/, 'lo que la pantalla muestra como remitente es el de la plataforma');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Por qué línea de Chatwoot sale un mensaje
// ─────────────────────────────────────────────────────────────────────────────
// Dos defectos en el mismo camino, y los dos deciden la LÍNEA: `cfg()` caía al inbox `3`
// cuando el workspace no lo declaraba, y `crearOReusarConversacion` reusaba cualquier
// conversación abierta del contacto sin mirar de qué bandeja era. Escribir ahí manda el
// mensaje por donde el negocio no lo eligió, y el envío vuelve «ok» igual.
test('Chatwoot no tiene inbox por default, y reusar una conversación mira que sea de ESE inbox', () => {
  const src = sinComentarios(leer('lib/chatwoot.ts'));
  assert.doesNotMatch(src, /\?\?\s*'3'/, 'volvió el inbox por default: un número cableado decide por qué WhatsApp sale el mensaje');
  assert.match(src, /function inboxWA\(c: Cfg\): number \{/, 'el inbox se lee por un lector que falla con su motivo');
  assert.doesNotMatch(src.replace(/function inboxWA[\s\S]*?\n\}/, ''), /\bc\.inbox\b/,
    'alguien lee `c.inbox` directo: con el inbox sin declarar sale `null` en una URL en vez de un error que diga qué falta');

  const reuso = bloque(src, 'async function crearOReusarConversacion(', 'return crearConversacion(c, contactId);');
  assert.match(reuso, /\.filter\(\(x\) => x\.inboxId === inbox\)/, 'reusar tiene que elegir SÓLO entre las conversaciones de este inbox');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El drenador de corridas de flujo
// ─────────────────────────────────────────────────────────────────────────────
// Un cron corre sin sesión, el workspace cae al dueño, y `flujo_corridas` está en
// TENANT_TABLES: con `getTenantDb()` el drenador sólo veía las corridas del ws1, así que el
// Delay y el Condicional de los demás clientes no despertaban nunca. La lectura de
// DESCUBRIMIENTO va cruda, y lo que toca datos corre en el workspace de cada fila.
test('el drenador de corridas descubre las de TODOS los workspaces y ejecuta cada una en el suyo', () => {
  const src = sinComentarios(leer('lib/flujo-corridas.ts'));
  const vencidas = bloque(src, 'export async function corridasVencidas(', '\n}\n');
  assert.match(vencidas, /const db = getSupabaseServer\(\);/, 'el descubrimiento tiene que ser cross-workspace');
  assert.doesNotMatch(vencidas, /getTenantDb\(\)/, 'con getTenantDb el cron sólo ve las corridas del dueño');
  assert.match(vencidas, /ws: \(f as Fila\)\.workspace_id/, 'cada corrida tiene que llevar SU workspace');

  // ⚠️ La otra mitad, sin la cual leer crudo SÍ sería un cruce: que cada corrida se ejecute
  // adentro de su propio workspace.
  const retomar = bloque(sinComentarios(leer('lib/flujos.ts')), 'export async function retomarCorrida(', 'catch (e)');
  assert.match(retomar, /runWithWorkspace\(ws, \(\) => listarFlujosActivos\(\)\)/);
  assert.match(retomar, /runWithWorkspace\(ws, \(\) => ejecutarPasos\(/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. De quién heredan los mensajes los clientes
// ─────────────────────────────────────────────────────────────────────────────
// El store de plantillas se hereda campo por campo, y la base era `OWNER_WS` — el ws1, que
// es MAURICIO, un cliente. Medido contra producción el 06/10/2026: siete workspaces sin
// store propio heredaban un `reporte-semanal` cuyo texto traía sus números reales («$640 ·
// 92 leads · CPL $6,9 · 4 cierres») y que el editor de cada uno dibuja como ejemplo.
//
// Probado rompiéndolo: devolviendo `leerStoreDe(OWNER_WS)` como base, este test cae
// nombrando la herencia de un cliente.
test('los clientes heredan los mensajes de la PLATAFORMA, nunca de otro cliente', () => {
  const src = sinComentarios(leer('lib/plantillas.ts'));
  const par = bloque(src, 'async function leerPar(', 'async function leerStore(');
  assert.match(par, /wsSuperAdmin\(\)/, 'la base de la herencia tiene que ser el workspace de la plataforma');
  assert.match(par, /leerStoreDe\(base\)/, 'se hereda del store de la base resuelta, no de un número');
  assert.doesNotMatch(par, /OWNER_WS/, 'la base volvió a ser el ws1, que es un CLIENTE: sus textos le llegan a todos los demás');
  // Y el borrador sigue sin heredarse (lo fija también tests/flujo-aviso.test.ts).
  assert.match(par, /borrador: _sinHeredar/, 'el borrador de la base no se hereda nunca');

  // «No pude resolver el workspace» no es «el del dueño» en ninguna escritura del store.
  assert.doesNotMatch(src, /getWorkspaceActual\(\)\)\s*\?\?\s*OWNER_WS/, 'un workspace sin resolver cae al ws1 y escribe sobre un cliente que nadie estaba mirando');
});
