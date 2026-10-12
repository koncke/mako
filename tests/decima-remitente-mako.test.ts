// =============================================================================
// Décima tanda, EMAIL 1 → undécima tanda: el email de MaKo no MANDA los correos de un cliente, en POSITIVO
// =============================================================================
// Pedido literal de Martín (décima): «No permitas enviar emails con los email de MaKo, ellos deben poner sus
// propios email». Y la decisión 3 de la décima, que lo cerró del todo (undécima): «Quitale a Mauricio que pueda
// mandar email con MaKo. Nadie debería poder.»
//
// La décima lo cortaba en NEGATIVO y sólo SIN `from` (`remitenteDeMakoFrenado`): un `from` explícito se lo
// salteaba, y cada pantalla preguntaba por su cuenta (`remitenteEsDeMako`). La undécima lo da vuelta
// (docs/diseno-undecima-tanda.md §2, decisión 3):
//   · `sendEmail` (lib/resend.ts) deja salir un mail del NEGOCIO sólo con un remitente que pasa
//     `remitenteDelNegocio` (lib/email-remitente.ts); con `from`, sólo uno del mismo dominio (`remitenteDelPaso`);
//     lo que habla MaKo pasa `from: REMITENTE_MAKO` y sale por la key de la plataforma
//     (tests/undecima-email-propio.test.ts);
//   · un paso no lleva NUNCA un email de MaKo (`remitenteDelPaso`), ni el del workspace mismo;
//   · `getEmailFrom` devuelve ese remitente o el sandbox: así el broadcast, «Probar», /integraciones y el motor
//     quedan en positivo preguntando lo de siempre (`remitenteEsSandbox()`), sin una rama «de MaKo» cada uno;
//   · «Tus tareas de la reunión» (lib/reunion-destinatarios.ts) lo firma MaKo: va con `from` explícito;
//   · el MOTOR (lib/nutricion.ts) ya no tiene la rama `remitenteDeMako` (la borró w3-motor-integracion, ola 3): sin
//     remitente propio —el de MaKo de un cliente llega como el sandbox— el paso de email es UN error de configuración
//     con el porqué de la pantalla (`POR_QUE_SIN_EMAIL`), 1 reintento por día.
//
// ── Roturas ── al final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { remitenteDelPaso, esRemitenteDeMako, remitenteDelNegocio, SIN_EMAIL_PROPIO, POR_QUE_SIN_EMAIL } from '../lib/email-remitente';
import { REMITENTE_MAKO } from '../lib/app-url';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario primero y los bloques después (un `/*` adentro de un `//` abriría un bloque).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const WS1 = 'MaKo <equipo@hola-mako.com>';

test('un paso no lleva NUNCA un email de MaKo, ni el del workspace mismo; el del dominio propio sí', () => {
  assert.equal(remitenteDelPaso(WS1, WS1), null, 'con `from` explícito, el ws1 se salteaba el corte de sendEmail');
  assert.equal(remitenteDelPaso('Ventas <ventas@hola-mako.com>', WS1), null);
  assert.equal(remitenteDelPaso(REMITENTE_MAKO, 'Ventas <ventas@valle.mx>'), null);
  assert.equal(remitenteDelPaso('Ventas <ventas@valle.mx>', 'Valle <hola@valle.mx>'), 'Ventas <ventas@valle.mx>', 'el propio sigue saliendo');
});

test('el corte es POSITIVO: el de MaKo no es el remitente de un negocio (salvo la plataforma que lo reclamó)', () => {
  assert.ok(esRemitenteDeMako(REMITENTE_MAKO), 'REMITENTE_MAKO tiene que ser de un dominio de MaKo');
  assert.deepEqual(remitenteDelNegocio({ resendFrom: WS1, resendDominio: null, credFrom: null, keyPropia: false, plataforma: false }), { puede: false, motivo: 'de-mako' }, 'el ws1 de hoy');
  assert.equal(remitenteDelNegocio({ resendFrom: WS1, resendDominio: 'hola-mako.com', credFrom: null, keyPropia: false, plataforma: false }).puede, false, 'ni reclamando el dominio');
  assert.equal(remitenteDelNegocio({ resendFrom: WS1, resendDominio: 'hola-mako.com', credFrom: null, keyPropia: false, plataforma: true }).puede, true, 'la plataforma, si lo reclama');
  assert.ok(SIN_EMAIL_PROPIO.split(/\s+/).length <= 4, 'lo que se lee en un chip es corto');
});

test('lib/resend.ts: el corte no depende de que llegue SIN `from`; el payload lleva el remitente decidido', () => {
  const src = sinComentarios(leer('lib/resend.ts'));
  const ini = src.indexOf('export async function sendEmail(');
  const fin = src.indexOf('const res = await fetch(ENDPOINT', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré sendEmail');
  const cuerpo = src.slice(ini, fin);
  assert.doesNotMatch(cuerpo, /if \(!from\) \{/, 'volvió el corte que sólo miraba lo que llegaba sin `from`');
  assert.match(cuerpo, /if \(!v\.puede\) return \{ ok: false, error: SIN_EMAIL_PROPIO \};/);
  assert.match(cuerpo, /params\.from \? remitenteDelPaso\(params\.from, v\.from\) : v\.from/, 'un `from` explícito se salteaba el corte');
  assert.match(cuerpo, /const payload: Record<string, unknown> = \{\n\s+from,\n/, 'el payload volvió a resolver el remitente por su cuenta');
  // «No pude saber si es la plataforma» no es serlo.
  // (El alias `remitenteEsDeMako` que venía después se borró en la ola 4: lo que sigue es `emailConectado`.)
  const plat = src.slice(src.indexOf('async function enLaPlataforma('), src.indexOf('export async function emailConectado('));
  assert.ok(src.indexOf('async function enLaPlataforma(') < src.indexOf('export async function emailConectado('));
  assert.match(plat, /return ws != null && ws === plataforma;/);
  assert.match(plat, /catch \{\n\s+return false;\n\s+\}/, 'si falla la lectura tiene que contestar que NO es la plataforma');
  assert.match(plat, /wsSuperAdmin\(\)/, 'la plataforma es el workspace del super admin, no OWNER_WS');
});

test('lib/resend.ts: el remitente del workspace no sale del env de la plataforma, y «conectado» es el veredicto', () => {
  const src = sinComentarios(leer('lib/resend.ts'));
  const actual = src.slice(src.indexOf('export async function remitenteDelNegocioActual('), src.indexOf('export async function getEmailFrom('));
  assert.match(actual, /credDelCliente\('RESEND_FROM'\)/);
  assert.doesNotMatch(actual, /credWs\(/, 'credWs le presta al ws1 (un cliente) el remitente de la plataforma');
  const from = src.slice(src.indexOf('export async function getEmailFrom('), src.indexOf('export async function resendConfigurado('));
  assert.match(from, /const v = await remitenteDelNegocioActual\(\);/);
  const con = src.slice(src.indexOf('export async function emailConectado('), src.indexOf('export async function correoDeMakoListo('));
  assert.match(con, /return !!key && v\.puede;/);
  assert.doesNotMatch(con, /remitenteEsDeMako/, 'la pregunta negativa volvió');
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
 * LOS MAILS DE UN CLIENTE que salen SIN `from` (con el remitente de su workspace, que tiene que pasar
 * `remitenteDelNegocio`). Todo `sendEmail` sin `from` que no esté acá es un mail que el corte frena sin remitente
 * propio: si lo firma MaKo va con `from: REMITENTE_MAKO`; si es del negocio, se agrega acá con su porqué.
 */
const SIN_FROM_DEL_NEGOCIO: Record<string, number> = {
  'lib/email-marketing.ts': 2, // la prueba de un broadcast y el broadcast (con su preflight)
  'lib/setting-secuencias.ts': 1, // el «Probar» de las secuencias de antes
};

test('barrido: todo `sendEmail` sin `from` es un mail del NEGOCIO, declarado; los de MaKo pasan su remitente', () => {
  const sinFrom: Record<string, number> = {};
  for (const f of [...fuentes('lib'), ...fuentes('app')]) {
    if (f.startsWith('app/admin/dev/')) continue; // las bitácoras citan código en prosa
    const src = sinComentarios(leer(f));
    for (const c of llamadas(src)) if (!/\bfrom\b/.test(c)) sinFrom[f] = (sinFrom[f] ?? 0) + 1;
  }
  assert.deepEqual(sinFrom, SIN_FROM_DEL_NEGOCIO,
    'un `sendEmail` sin `from` nuevo (o uno de la lista que ya no está): si lo firma MaKo, `from: REMITENTE_MAKO`');
  // El barrido encuentra lo que dice encontrar: el motor manda con su `from` condicional.
  assert.ok(llamadas(sinComentarios(leer('lib/nutricion.ts'))).length >= 1, 'el extractor no vio la llamada del motor');
});

test('«Tus tareas de la reunión» lo firma MaKo: va con el remitente de la plataforma explícito', () => {
  const [c] = llamadas(sinComentarios(leer('lib/reunion-destinatarios.ts')));
  assert.ok(c, 'no encontré el envío por email');
  assert.match(c, /from: REMITENTE_MAKO,/);
});

test('el broadcast y «Probar» frenan sin remitente propio con la pregunta de siempre, sin una rama «de MaKo»', () => {
  const em = sinComentarios(leer('lib/email-marketing.ts'));
  const corte = em.indexOf('if (emailOn && (await remitenteEsSandbox())) {');
  assert.ok(corte > 0, 'falta el preflight del remitente en el broadcast');
  assert.ok(corte < em.indexOf('const todos = await leadsDeSegmento('), 'el preflight va antes de leer el segmento (si no, cada destinatario queda como un fallo)');
  assert.match(em.slice(corte, corte + 200), /return vacio\(`\$\{SIN_EMAIL_PROPIO\}\. \$\{POR_QUE_SIN_EMAIL\}`\);/);
  assert.doesNotMatch(em, /remitenteEsDeMako/, 'la pregunta negativa volvió al broadcast');
  const pp = sinComentarios(leer('lib/prueba-paso.ts'));
  assert.match(pp, /if \(mensaje\.canal === 'email' && await remitenteEsSandbox\(\)\) \{\n\s+return \{ ok: false, error: SIN_EMAIL_PROPIO \};/);
  assert.doesNotMatch(pp, /esRemitenteDeMako|AVISO_EMAIL_DE_MAKO|wsSuperAdmin/, 'volvió la rama «de MaKo» de la prueba');
  assert.ok(POR_QUE_SIN_EMAIL.endsWith('.'));
});

test('el motor: sin remitente PROPIO (también el de MaKo de un cliente), el email es un error de configuración (1 por día)', () => {
  // UNDÉCIMA TANDA, la forma POSITIVA (w3-motor-integracion): la pregunta es UNA, `remitenteEsSandbox()` = «no tiene un
  // remitente que pase `remitenteDelNegocio`», y el de MaKo de un cliente llega por ahí (`getEmailFrom` devuelve el
  // sandbox). La rama `remitenteDeMako` de la décima (que preguntaba `remitenteEsDeMako()`, alias que devuelve false)
  // estaba muerta y se borró.
  const src = sinComentarios(leer('lib/nutricion.ts'));
  const ini = src.indexOf('export async function procesarEnvios(');
  assert.ok(ini > 0, 'no encontré procesarEnvios');
  // La pregunta se hace UNA vez por corrida, y es la positiva.
  const todo = src.slice(ini, src.indexOf(']);', ini));
  assert.match(todo, /const \[waOn, emailOn, sandbox, remitente, lineasEvo\] = await Promise\.all\(\[/);
  assert.match(todo, /\n\s+remitenteEsSandbox\(\),\n/);
  assert.doesNotMatch(src, /remitenteEsDeMako|remitenteDeMako/, 'volvió la pregunta negativa al motor');
  // La rama va ANTES de armar el mail: sin ella, `sendEmail` se niega y el fallo es genérico (reintento a las 4 h,
  // una fila 'fallo' por lead cada cuatro horas).
  const email = src.slice(src.indexOf("} else if (emailOn && paso.canal === 'email') {", ini));
  const sandbox = email.indexOf('} else if (sandbox) {');
  const manda = email.indexOf('const r = await sendEmail({');
  assert.ok(sandbox > 0 && manda > sandbox, 'la rama sin remitente propio tiene que ir antes del envío');
  const rama = email.slice(sandbox, email.indexOf('} else {', sandbox));
  assert.match(rama, /estado = 'fallo';/);
  assert.match(rama, /nota = POR_QUE_SIN_EMAIL;/, 'la nota es el porqué que dice la pantalla');
  assert.match(rama, /backoffHoras = 24;/);
  assert.match(rama, /terminal = hayOtrosHilos\(sanearHilos\(insc\.hilos\), insc\.h \?\? null\);/, 'con otros hilos vivos cierra sólo el del email');
  assert.match(src, /import \{[^}]*\bPOR_QUE_SIN_EMAIL\b[^}]*\} from '@\/lib\/email-remitente';/);
});

test('la tarjeta de Email de /integraciones: UNA rama positiva, «conectado» = el veredicto', () => {
  const integ = sinComentarios(leer('lib/integraciones.ts'));
  const i = integ.indexOf("if (d.key === 'email' && !faltan.length && !(await emailConectado().catch(() => false))) {");
  assert.ok(i > 0, 'falta la rama positiva del email en la tarjeta');
  const rama = integ.slice(i, integ.indexOf('}\n', integ.indexOf('...delMetodo(d.key),', i)));
  assert.match(rama, /estado: 'falta' as EstadoIntegracion,\s*detalle: POR_QUE_SIN_EMAIL,/);
  assert.doesNotMatch(integ, /remitenteEsDeMako|remitenteEsSandbox|AVISO_EMAIL_DE_MAKO/, 'volvió una rama negativa');
  assert.equal((integ.match(/d\.key === 'email'/g) ?? []).length, 1, 'una sola rama de email');
});

// ── Roturas ──────────────────────────────────────────────────────────────────────────────────
// Décima (arnés `viejas-roturas.mjs` del scratchpad, base 7/0 y 9/0): R4-R9 contra el corte NEGATIVO, ya
// reemplazado. Undécima (11/10/2026, arnés `romper.mjs` de wf-undecima/w1-email, una por vez, restaurada de
// memoria con md5 igual; este archivo + email-remitente + undecima-email-propio + resend-remitente, base 49/0):
//   R4. `sendEmail` deja pasar el sandbox (vuelve a `getEmailFrom()`) → 47/2 (el corte, acá; y el veredicto)
//   R7. /integraciones vuelve a la rama del sandbox                   → 47/2 (la tarjeta, acá; y resend-remitente)
//   R8. el dominio de MaKo sin exigir la plataforma                    → 45/4 (el corte positivo, acá; y tres en email-remitente)
