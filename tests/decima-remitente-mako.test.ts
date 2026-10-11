// =============================================================================
// Décima tanda, EMAIL 1 (segunda pasada, 11/10/2026): el email de MaKo no MANDA los correos de un cliente
// =============================================================================
// Pedido literal de Martín: «No permitas enviar emails con los email de MaKo, ellos deben poner sus propios
// email». La primera pasada cerró lo que se OFRECE —el «De», el emisor de «Probar», la ruta del dominio
// (tests/decima-tanda-whatsapp.test.ts)—. Ésta cierra lo que se MANDA, como pide
// docs/diseno-automations-configuraciones.md §3:
//   · el corte está en `sendEmail` SIN `from` (lib/resend.ts): si el remitente resuelto es de MaKo y el
//     workspace no es la plataforma, no sale («Usa tu propio email»). Por ahí pasan el motor, la prueba,
//     los broadcasts y el «Probar» de antes; los mails de la plataforma pasan `from: REMITENTE_MAKO`;
//   · un paso no lleva NUNCA un email de MaKo (`remitenteDelPaso`), ni el del workspace mismo: con `from`
//     explícito, el ws1 se salteaba el corte;
//   · `getEmailFrom` no le presta al ws1 (`OWNER_WS`, un cliente) el remitente del env de la plataforma;
//   · `emailConectado` da false con un remitente de MaKo ajeno, y el broadcast frena antes de anotar a
//     cada destinatario como un fallo (el reanudable los saltearía para siempre);
//   · «Tus tareas de la reunión» (lib/reunion-destinatarios.ts) lo firma MaKo: va con `from` explícito;
//   · el MOTOR (lib/nutricion.ts) lo trata como el sandbox: un error de configuración con 1 reintento por
//     día, y no un fallo genérico cada 4 h (eso es lo que daba el corte de `sendEmail` solo);
//   · la tarjeta de Email de /integraciones no dice «Conectada» con el email de MaKo (lib/integraciones.ts).
//
// Probado ROMPIÉNDOLO (arnés `viejas-roturas.mjs` del scratchpad, restaurado de memoria con md5 igual), base
// 7/0 y cada rotura sola:
//   R4. `remitenteDelPaso` vuelve a dejar pasar el de MaKo igual al del workspace → 1 fallo acá y 1 en
//       tests/decima-tanda-whatsapp.test.ts (14/2 entre los dos).
//   R5. `sendEmail` sin el corte                                                  → 6/1 (el corte).
//   R6. «Tus tareas de la reunión» sin `from`                                      → 5/2 (el barrido y el
//       del archivo).
// Y con el motor y la tarjeta (arnés `viejas-roturas2.mjs`), base 9/0:
//   R7. sin la rama del motor                                                      → 8/1 (el motor).
//   R8. la corrida sin preguntar `remitenteEsDeMako()`                             → 8/1 (el motor).
//   R9. la tarjeta de /integraciones sin su rama                                   → 8/1 (la tarjeta).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { remitenteDelPaso, remitenteDeMakoFrenado, esRemitenteDeMako, AVISO_EMAIL_DE_MAKO } from '../lib/email-remitente';
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

test('el corte del envío: el de MaKo se frena salvo en la plataforma; el propio y el sandbox no son asunto suyo', () => {
  assert.equal(remitenteDeMakoFrenado(WS1, false), true);
  assert.equal(remitenteDeMakoFrenado('Ventas <ventas@send.hola-mako.com>', false), true, 'un subdominio también');
  assert.equal(remitenteDeMakoFrenado(WS1, true), false, 'la plataforma manda con el suyo');
  assert.equal(remitenteDeMakoFrenado('Valle <hola@valle.mx>', false), false);
  assert.equal(remitenteDeMakoFrenado('onboarding@resend.dev', false), false, 'el sandbox lo frena su propio preflight');
  assert.equal(remitenteDeMakoFrenado('MaKo', false), false, 'uno ilegible no es de MaKo');
  assert.ok(esRemitenteDeMako(REMITENTE_MAKO), 'REMITENTE_MAKO tiene que ser de un dominio de MaKo');
  assert.ok(AVISO_EMAIL_DE_MAKO.split(/\s+/).length <= 4, 'lo que se lee es corto');
});

test('lib/resend.ts: `sendEmail` SIN `from` frena el email de MaKo antes de llamar a Resend; con `from`, no mira', () => {
  const src = sinComentarios(leer('lib/resend.ts'));
  const ini = src.indexOf('export async function sendEmail(');
  const fin = src.indexOf('const res = await fetch(ENDPOINT', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré sendEmail');
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /let from = params\.from;\n\s+if \(!from\) \{\n\s+from = await getEmailFrom\(\);\n\s+if \(esRemitenteDeMako\(from\) && remitenteDeMakoFrenado\(from, await enLaPlataforma\(\)\)\) return \{ ok: false, error: AVISO_EMAIL_DE_MAKO \};\n\s+\}/,
    'el corte se fue (o pasó a mirar también el `from` explícito, que es el de los mails de la plataforma)');
  assert.match(cuerpo, /const payload: Record<string, unknown> = \{\n\s+from,\n/, 'el payload volvió a resolver el remitente por su cuenta');
  // «No pude saber si es la plataforma» no es serlo.
  const plat = src.slice(src.indexOf('async function enLaPlataforma('), src.indexOf('export async function remitenteEsDeMako('));
  assert.match(plat, /return ws != null && ws === plataforma;/);
  assert.match(plat, /catch \{\n\s+return false;\n\s+\}/, 'si falla la lectura tiene que contestar que NO es la plataforma');
  assert.match(plat, /wsSuperAdmin\(\)/, 'la plataforma es el workspace del super admin, no OWNER_WS');
});

test('lib/resend.ts: el remitente del workspace no sale del env de la plataforma, y «conectado» lo mira', () => {
  const src = sinComentarios(leer('lib/resend.ts'));
  const from = src.slice(src.indexOf('export async function getEmailFrom('), src.indexOf('export async function resendConfigurado('));
  assert.match(from, /credDelCliente\('RESEND_FROM'\)/);
  assert.doesNotMatch(from, /credWs\(/, 'credWs le presta al ws1 (un cliente) el remitente de la plataforma');
  const con = src.slice(src.indexOf('export async function emailConectado('), src.indexOf('export function displayNameDe('));
  assert.match(con, /remitenteEsDeMako\(\)/);
  assert.match(con, /return !!key && !sandbox && !deMako;/);
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
 * LOS MAILS DE UN CLIENTE que salen SIN `from` (con el remitente de su workspace, y por eso pasan por el
 * corte). Todo `sendEmail` sin `from` que no esté acá es un mail que el corte frena en el ws1: si lo firma MaKo
 * va con `from: REMITENTE_MAKO`; si es del negocio, se agrega acá con su porqué.
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

test('el broadcast frena ANTES de anotar destinatarios; la prueba de la plataforma no se queda sin remitente', () => {
  const em = sinComentarios(leer('lib/email-marketing.ts'));
  const corte = em.indexOf('if (emailOn && (await remitenteEsDeMako())) {');
  assert.ok(corte > 0, 'falta el preflight del email de MaKo en el broadcast');
  assert.ok(corte < em.indexOf('const todos = await leadsDeSegmento('), 'el preflight va antes de leer el segmento');
  const pp = sinComentarios(leer('lib/prueba-paso.ts'));
  assert.match(pp, /if \(mensaje\.canal === 'email' && p\.emisor\?\.remitente && !esRemitenteDeMako\(p\.emisor\.remitente\)\) \{/,
    'sin la excepción, la plataforma eligiendo el suyo recibe «ya no es de tu negocio»');
});

test('el motor: con el email de MaKo, el paso de email es un error de configuración (1 por día), no un fallo cada 4 h', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  const ini = src.indexOf('export async function procesarEnvios(');
  assert.ok(ini > 0, 'no encontré procesarEnvios');
  // La pregunta se hace UNA vez por corrida, con la de la plataforma adentro (`remitenteEsDeMako`, lib/resend.ts).
  const todo = src.slice(ini, src.indexOf(']);', ini));
  assert.match(todo, /const \[waOn, emailOn, sandbox, remitente, lineasEvo, remitenteDeMako\] = await Promise\.all\(\[/);
  assert.match(todo, /\n\s+remitenteEsDeMako\(\),\n/);
  // La rama va DESPUÉS del sandbox y ANTES de armar el mail: sin ella, `sendEmail` se niega y el fallo es
  // genérico (reintento a las 4 h, una fila 'fallo' por lead cada cuatro horas).
  const email = src.slice(src.indexOf("} else if (emailOn && paso.canal === 'email') {", ini));
  const sandbox = email.indexOf('} else if (sandbox) {');
  const deMako = email.indexOf('} else if (remitenteDeMako) {');
  const manda = email.indexOf('const r = await sendEmail({');
  assert.ok(sandbox > 0 && deMako > sandbox && manda > deMako, 'la rama del email de MaKo tiene que ir entre la del sandbox y el envío');
  const rama = email.slice(deMako, email.indexOf('} else {', deMako));
  assert.match(rama, /estado = 'fallo';/);
  assert.match(rama, /nota = 'remitente de MaKo: conecta tu email';/);
  assert.match(rama, /backoffHoras = 24;/);
  assert.match(rama, /terminal = hayOtrosHilos\(sanearHilos\(insc\.hilos\), insc\.h \?\? null\);/, 'con otros hilos vivos cierra sólo el del email');
});

test('la tarjeta de Email de /integraciones no dice «Conectada» con el email de MaKo', () => {
  const integ = sinComentarios(leer('lib/integraciones.ts'));
  const i = integ.indexOf("if (d.key === 'email' && !faltan.length && await remitenteEsDeMako().catch(() => false)) {");
  assert.ok(i > 0, 'falta la rama del email de MaKo en la tarjeta');
  const rama = integ.slice(i, integ.indexOf('}\n', integ.indexOf('...delMetodo(d.key),', i)));
  assert.match(rama, /estado: 'falta' as EstadoIntegracion,\s*detalle: `\$\{AVISO_EMAIL_DE_MAKO\}\.`/);
});
