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
// Probado rompiéndolo CUATRO veces (06/10/2026), 2 pasan / 1 falla cada una y el motivo
// nombra la aserción: (1) el acuse con el `ws` de la instancia, (2) el acuse sin su
// fail-closed, (3) el remitente otra vez por `getEmailFrom()`, (4) el envío fuera del
// workspace de la plataforma. ⚠️ La CUARTA pasó en VERDE la primera vez: el `assert.match`
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
