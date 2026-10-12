// =============================================================================
// Undécima tanda: el email del NEGOCIO sale sólo con SU remitente; lo que habla MaKo, por la cuenta de MaKo
// =============================================================================
// Decisión 3 de la décima, literal de Martín: «Quitale a Mauricio que pueda mandar email con MaKo. Nadie
// debería poder.» = ningún negocio manda a SUS leads con el remitente de MaKo; lo que MaKo le manda al equipo
// del negocio sí sale de MaKo, con el `from` explícito en el código. Diseño: docs/diseno-undecima-tanda.md §2
// (decisión 3) y §9 (22-24). La regla pura (`remitenteDelNegocio`) la fija tests/email-remitente.test.ts; éste
// fija que el CÓDIGO que manda y guarda la use (lib/resend.ts lleva `server-only` y no se importa en un test:
// se lee el fuente sin comentarios).
//
// Lo que fija:
//   · «habla MaKo» se reconoce SÓLO por `from === REMITENTE_MAKO`, y entonces la key es la de la PLATAFORMA,
//     nunca `resendKey()` (que empieza por la del workspace: en ws10/ws11, la cuenta del cliente);
//   · todo lo demás pasa por el veredicto: sin remitente propio no sale (tampoco con el sandbox), y un `from`
//     explícito sólo si es del dominio del negocio (`remitenteDelPaso`): el corte de la décima miraba sólo lo que
//     llegaba SIN `from`;
//   · `getEmailFrom` y `emailConectado` salen del veredicto (así todo el que pregunta `remitenteEsSandbox()` queda
//     en positivo sin tocar sus llamadas);
//   · `guardarCredencial` no guarda un `RESEND_FROM` de MaKo en NINGÚN workspace, y las rutas lo devuelven como un
//     400 (el «simular» del onboarding, que copia las del ws1, lo saltea);
//   · el preflight de «te compartieron» mide la cuenta de MaKo, no el remitente de un negocio;
//   · un barrido: todo `from` que llega a `sendEmail` es `REMITENTE_MAKO` o una variable validada.
//
// ── Roturas ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario primero y los bloques después (un `/*` adentro de un `//` abriría un bloque).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El texto entre dos anclas, con las dos presentes (si falta una, el test lo dice y no mira otra cosa). */
function entre(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

const RESEND = () => sinComentarios(leer('lib/resend.ts'));

test('sendEmail: «habla MaKo» sólo por la constante, y entonces SIEMPRE la key de la plataforma', () => {
  const cuerpo = entre(RESEND(), 'export async function sendEmail(', 'const res = await fetch(ENDPOINT');
  assert.match(cuerpo, /const hablaMako = params\.from === REMITENTE_MAKO;/);
  assert.match(cuerpo, /const key = hablaMako \? await keyDeLaPlataforma\(\) : await resendKey\(\);/,
    'lo que habla MaKo salía por la key del workspace del contexto (la cuenta del cliente en ws10/ws11)');
  assert.equal((cuerpo.match(/resendKey\(\)/g) ?? []).length, 1, '`resendKey()` sólo para lo que habla el negocio');
  assert.equal((cuerpo.match(/hablaMako/g) ?? []).length, 3, 'una sola definición de «habla MaKo», usada para la key y el remitente');
  assert.doesNotMatch(cuerpo, /esRemitenteDeMako|esDominioDeMako|hola-mako/, '«habla MaKo» no se adivina por el dominio: es la constante');
  assert.match(cuerpo, /if \(hablaMako\) from = REMITENTE_MAKO;/);
  // La key de la plataforma es la del entorno de la plataforma, no la del workspace.
  const kp = entre(RESEND(), 'async function keyDeLaPlataforma(', '\n}\n');
  assert.match(kp, /await envCred\('RESEND_API_KEY'\)/);
  assert.doesNotMatch(kp, /credWs|credDelCliente|resendKey/);
});

test('sendEmail: lo del negocio pasa por el veredicto; sin remitente propio no sale, ni con el sandbox', () => {
  const cuerpo = entre(RESEND(), 'export async function sendEmail(', 'const res = await fetch(ENDPOINT');
  const negocio = cuerpo.slice(cuerpo.indexOf('else {'));
  assert.match(negocio, /const v = await remitenteDelNegocioActual\(\);\n\s+if \(!v\.puede\) return \{ ok: false, error: SIN_EMAIL_PROPIO \};/,
    'sin remitente propio el mail del negocio salía igual (con el sandbox o con el de MaKo)');
  assert.match(negocio, /const elegido = params\.from \? remitenteDelPaso\(params\.from, v\.from\) : v\.from;/,
    'sin `from`, el del veredicto; con `from`, sólo uno del dominio del negocio');
  assert.match(negocio, /if \(!elegido\) return \{ ok: false, error: /);
  assert.doesNotMatch(cuerpo, /getEmailFrom\(|SANDBOX_FROM/, 'el envío volvió a resolver el remitente por su cuenta (y el sandbox pasa)');
  assert.match(cuerpo, /const payload: Record<string, unknown> = \{\n\s+from,\n/, 'el payload tiene que llevar el remitente decidido arriba');
});

test('getEmailFrom, emailConectado y remitenteDelNegocioActual salen del MISMO veredicto', () => {
  const src = RESEND();
  const actual = entre(src, 'export async function remitenteDelNegocioActual(', 'export async function getEmailFrom(');
  assert.match(actual, /getSettingEstricto\('resend_from'\)/);
  assert.match(actual, /getSettingEstricto\('resend_domain'\)/);
  assert.match(actual, /credDelCliente\('RESEND_FROM'\)/);
  assert.doesNotMatch(actual, /credWs\(/, '`credWs` le da al ws1 (un cliente) lo del env de la plataforma');
  assert.match(actual, /const keyPropia = !!keyCliente && !\(await esDeLaPlataforma\('RESEND_API_KEY', keyCliente\)\);/,
    'la key del ws1 y la copia del ws4 son de la plataforma: no son cuenta propia');
  assert.match(actual, /return remitenteDelNegocio\(\{ resendFrom, resendDominio, credFrom, keyPropia, plataforma \}\);/);
  assert.match(actual, /catch \(e\) \{[\s\S]*return \{ puede: false, motivo: 'sin-remitente' \};/, 'un error de lectura = no puede');
  const from = entre(src, 'export async function getEmailFrom(', 'export async function resendConfigurado(');
  assert.match(from, /return v\.puede \? v\.from : SANDBOX_FROM;/);
  const con = entre(src, 'export async function emailConectado(', 'export async function correoDeMakoListo(');
  assert.match(con, /return !!key && v\.puede;/);
  // El alias muerto `remitenteEsDeMako` se BORRÓ en la ola 4 (nadie lo preguntaba ya).
  assert.doesNotMatch(src, /remitenteEsDeMako/);
});

test('esDeLaPlataforma mira las DOS copias de la key, y «no pude leer» tira', () => {
  const cred = sinComentarios(leer('lib/credenciales.ts'));
  const fn = entre(cred, 'export async function esDeLaPlataforma(', '\n}\n');
  assert.match(fn, /process\.env\[clave\]/);
  assert.match(fn, /await credWsEstricta\(clave, OWNER_WS\)/, 'la fila del dueño, leída en estricto');
});

test('guardarCredencial: un RESEND_FROM de MaKo no se guarda, en ningún workspace, antes de escribir', () => {
  const cred = sinComentarios(leer('lib/credenciales.ts'));
  const fn = entre(cred, 'export async function guardarCredencial(', 'export async function eliminarCredencial(');
  const guarda = fn.indexOf("if (clave === 'RESEND_FROM') {");
  assert.ok(guarda > 0, 'falta la guarda del remitente de MaKo');
  const bloque = fn.slice(guarda, fn.indexOf('}', guarda) + 1);
  assert.match(bloque, /const problema = problemaDeRemitenteGuardado\(valor\);\n\s+if \(problema\) throw new RemitenteNoPropioError\(clave, problema\);/);
  assert.ok(guarda < fn.indexOf('.upsert('), 'la guarda va antes de escribir');
  // Para TODO workspace: no adentro del `if (ws !== OWNER_WS …)` de la key de plataforma.
  const antes = fn.slice(0, guarda);
  assert.equal((antes.match(/\{/g) ?? []).length - (antes.match(/\}/g) ?? []).length, 1, 'la guarda quedó adentro de otro bloque (¿sólo para algunos workspaces?)');
  // Y el del entorno de la plataforma no se copia al ws1 en el boot (ni a otro por «Datos de Mau»).
  assert.match(entre(cred, 'const NO_MIGRAR_A_WS', ']);'), /'RESEND_FROM'/);
});

test('las rutas que guardan credenciales devuelven el motivo como un 400; «simular» lo saltea', () => {
  const integ = sinComentarios(leer('app/api/integraciones/credencial/route.ts'));
  assert.match(integ, /if \(e instanceof RemitenteNoPropioError\) \{\n\s+await auditarCredencial\(ctx\.ws, env, 'guardar', ctx\.autor, \{ permitido: false, motivo: '[^']+' \}\);\n\s+return NextResponse\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
  const metodo = sinComentarios(leer('app/api/metodo/route.ts'));
  assert.match(metodo, /if \(e instanceof RemitenteNoPropioError\) return NextResponse\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
  const onb = sinComentarios(leer('app/api/onboarding/route.ts'));
  const guardar = entre(onb, "case 'guardar': {", "case 'verificar': {");
  assert.match(guardar, /if \(e instanceof RemitenteNoPropioError\) return NextResponse\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
  const simular = entre(onb, "case 'simular': {", "case 'clonar-dueno': {");
  assert.match(simular, /if \(!\(e instanceof IdentificadorOcupadoError\) && !\(e instanceof RemitenteNoPropioError\)\) throw e;/);
  // Y el ping de /integraciones lo dice ANTES de guardar, con el mismo texto (lib/resend-remitente.ts).
  assert.match(sinComentarios(leer('lib/resend-remitente.ts')), /if \(esDominioDeMako\(dom\)\) return NO_ES_TUYO;/);
  assert.match(sinComentarios(leer('app/api/email/dominio/route.ts')), /import \{ esDominioDeMako, NO_ES_TUYO \} from '@\/lib\/email-remitente';/);
  assert.doesNotMatch(sinComentarios(leer('app/api/email/dominio/route.ts')), /const NO_ES_TUYO =/, 'una sola copia del texto');
});

test('«te compartieron material» (lo firma MaKo): el preflight mide la cuenta de MaKo, no un remitente de negocio', () => {
  const src = sinComentarios(leer('app/api/compartir/route.ts'));
  assert.doesNotMatch(src, /remitenteEsSandbox/, 'preguntaba por el remitente del ws9 y le decía al admin que el mail no llegaba');
  assert.match(src, /const correo = \{ listo: await correoDeMakoListo\(\), remitente: EMAIL_MAKO \};/);
  const fn = entre(RESEND(), 'export async function correoDeMakoListo(', '\n}\n');
  assert.match(fn, /await keyDeLaPlataforma\(\)/);
  assert.match(fn, /EMAIL_MAKO/);
});

/** Los archivos `.ts`/`.tsx` de una carpeta, del DISCO (un guard sobre `git ls-files` no ve lo nuevo). */
function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) out.push(...fuentes(r));
    else if (/\.tsx?$/.test(n)) out.push(r);
  }
  return out;
}

/** El objeto literal que recibe cada `sendEmail({ … })` de un fuente (llaves balanceadas, salteando strings). */
function llamadas(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('sendEmail({');
  while (i >= 0) {
    const ini = i + 'sendEmail('.length;
    let prof = 0;
    let j = ini;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '\'' || c === '"' || c === '`') {
        const q = c;
        for (j++; j < src.length && src[j] !== q; j++) if (src[j] === '\\') j++;
        continue;
      }
      if (c === '{') prof++;
      else if (c === '}' && --prof === 0) break;
    }
    out.push(src.slice(ini, j + 1));
    i = src.indexOf('sendEmail({', j);
  }
  return out;
}

/**
 * LOS `from` QUE LLEGAN A `sendEmail`, por archivo. `REMITENTE_MAKO` es lo que habla MaKo; cualquier otro es una
 * variable que ya pasó por la regla del negocio (y `sendEmail` igual la vuelve a pasar por `remitenteDelPaso`):
 *   · lib/nutricion.ts `fromPaso` = `remitenteDelPaso(paso.remitente, remitente)`;
 *   · lib/prueba-paso.ts `from` = `remitenteDelPaso(p.emisor.remitente, …)`;
 *   · lib/invitaciones.ts `rem.from` = `remitenteDeLaInvitacion` (lib/curso-invitar-canales.ts);
 *   · app/api/compartir/route.ts `from` = `REMITENTE_MAKO`.
 * Un `from` nuevo (o un texto literal) falla acá: si lo firma MaKo, `from: REMITENTE_MAKO`.
 */
const FROM_PERMITIDOS: Record<string, string[]> = {
  'lib/aviso-plan.ts': ['REMITENTE_MAKO'],
  'lib/avisos.ts': ['REMITENTE_MAKO'],
  'lib/canal-vigilante.ts': ['REMITENTE_MAKO'],
  'lib/invitaciones.ts': ['REMITENTE_MAKO', 'rem.from'],
  'lib/notify.ts': ['REMITENTE_MAKO'],
  'lib/nutricion.ts': ['fromPaso'],
  'lib/prueba-paso.ts': ['from'],
  'lib/reunion-destinatarios.ts': ['REMITENTE_MAKO'],
  'app/api/compartir/route.ts': ['from'],
};

test('barrido: todo `from` que llega a `sendEmail` es REMITENTE_MAKO o una variable validada; ninguno es un texto', () => {
  const vistos: Record<string, string[]> = {};
  for (const f of [...fuentes('lib'), ...fuentes('app')]) {
    if (f.startsWith('app/admin/dev/')) continue; // las bitácoras citan código en prosa
    const src = sinComentarios(leer(f));
    for (const c of llamadas(src)) {
      assert.doesNotMatch(c, /\bfrom\s*:\s*['"`]/, `${f}: un \`from\` escrito a mano en un sendEmail`);
      const nombres = [
        ...[...c.matchAll(/\bfrom\s*:\s*([A-Za-z_$][\w$.]*)/g)].map((m) => m[1]),
        ...[...c.matchAll(/[{,]\s*from\s*(?=[,}])/g)].map(() => 'from'),
      ];
      if (nombres.length) vistos[f] = [...new Set([...(vistos[f] ?? []), ...nombres])].sort();
    }
  }
  const esperado = Object.fromEntries(Object.entries(FROM_PERMITIDOS).map(([k, v]) => [k, [...v].sort()]));
  assert.deepEqual(vistos, esperado, 'un `from` nuevo en un sendEmail (o uno de la lista que ya no está)');
  // Las variables validadas, validadas donde nacen.
  assert.match(sinComentarios(leer('lib/nutricion.ts')), /const fromPaso = remitenteDelPaso\(paso\.remitente, remitente\);/);
  assert.match(sinComentarios(leer('lib/prueba-paso.ts')), /const usable = remitenteDelPaso\(p\.emisor\.remitente, await getEmailFrom\(\)\);[\s\S]{0,160}from = usable;/);
  assert.match(sinComentarios(leer('app/api/compartir/route.ts')), /const from = REMITENTE_MAKO;/);
  // La invitación al curso valida el suyo con la MISMA puerta que `sendEmail` (cierre de la ola 1).
  assert.match(sinComentarios(leer('lib/invitaciones.ts')), /invitacionDeVeredicto\(await remitenteDelNegocioActual\(\)\)/);
});

// ── Roturas ──────────────────────────────────────────────────────────────────────────────────
// 11/10/2026, arnés `romper.mjs` del scratchpad (wf-undecima/w1-email): una rotura por vez sobre el archivo real,
// restaurada DE MEMORIA con el md5 verificado, corriendo este archivo + email-remitente + decima-remitente-mako +
// resend-remitente (base 49 pass / 0 fail). Las que caen acá (total de los cuatro, y el test que cae):
//   R3. `hablaMako` con `resendKey()` (la key del workspace)          → 48/1 (la key de la plataforma)
//   R4. `sendEmail` deja pasar el sandbox (vuelve a `getEmailFrom()`) → 47/2 (el veredicto, acá; y el corte de la décima)
//   R5. `guardarCredencial` sin la guarda de RESEND_FROM              → 48/1 (guardarCredencial)
//   R6. «te compartieron» vuelve a `remitenteEsSandbox()`             → 48/1 (el preflight)
//   R9. el ping deja pasar el dominio de MaKo                          → 47/2 (las rutas, acá; y resend-remitente)
//   R10. `keyPropia` sin compararla con la de la plataforma           → 48/1 (el veredicto: la copia del ws4 sería «propia»)
