// =============================================================================
// curso-invitar — invitar a un cliente al curso de su servicio
// =============================================================================
// Pedido de Martín (06/10/2026): «Al igual que en la vista de Agencia, se debería poder INVITAR
// al cliente a MaKo para que tenga acceso al curso». Lo que estos tests cuidan no es que el mail
// salga —eso lo decide Resend— sino lo que ya falló en la vista de Agencia sin que nada avisara:
//   · el FALSO ÉXITO: decir «enviada» porque hubo un resultado, y no porque salió;
//   · anotar la invitación en el INTENTO (o en el workspace equivocado);
//   · invitar a un acceso CORTADO (un mail con un link que no abre);
//   · el texto en neutro con TÚ (lo lee un cliente mexicano de otro negocio).
// Lo que se EJECUTA es lo puro (el texto del mail, el aviso, el estado); lo que se LEE del fuente
// son los cableados que el typecheck no ve.
//
// PROBADO ROMPIÉNDOLO (06/10/2026, scratchpad u3-romper.mjs): baseline 8 pass / 0 fail, y NUEVE
// roturas de a una, restauradas de memoria (nunca con git). Cada una dio 7 pass / 1 fail en el
// test que le toca:
//   1. avisoInvitacionCurso con `if (!inv)` en vez de `!inv?.enviado` → «el aviso… NO dice "enviada"»
//   2. estadoDeInvitacion devolviendo «sin-invitar» para `undefined`  → «el estado de la invitación…»
//   3. el mail con «Entrá desde aquí»                                 → «el mail va en neutro con TÚ…»
//   4. invitarAlCursoAction con `if (true)` antes de marcarInvitacion  → «invitarAlCursoAction: corta…»
//   5. invitarAlCursoPorEmail con un `alSalir` que usa getTenantDb      → «el mail del curso NO anota nada…»
//   6. el modal con `setAbierto(false)` antes de mirar `r.enviado`     → «el modal de invitar…»
//   7. app/api/admin/agencia/route.ts con `aviso = inv ?`              → «los avisos de aprobación…»
//   8. app/api/admin/agencia/altas/route.ts con `aviso: invitacion ?`  → el mismo
//   9. invitarAlCursoAction sin `a.revocado` (invita un acceso cortado) → «invitarAlCursoAction: corta…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { textoInvitacionCurso } from '../lib/invitacion-aviso';
import { marcasDeVoseo } from '../lib/puestas-data';
import {
  avisoInvitacionCurso, estadoDeInvitacion, fraseInvitacion, fraseIngresos, type AccesoInvitacion,
} from '../app/customer-success/curso-ficha-lectura';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── El mail ───────────────────────────────────────────────────────────────────

test('el mail: asunto con el programa, de qué negocio es, el link de entrada y la línea de Google', () => {
  const t = textoInvitacionCurso({
    nombre: 'Teresa de Jesus Hernandez', programa: 'Negocio que Escala', negocio: 'Mauricio Bustos',
    enlace: 'https://x.test/api/compartido/curso/entrar?t=c1.1.2.3.firma', entrarConGoogle: 'https://x.test/login',
  });
  assert.equal(t.asunto, 'Tu acceso a Negocio que Escala');
  assert.match(t.cuerpo, /^Hola Teresa,\n/, 'saluda por el primer nombre');
  assert.ok(t.cuerpo.includes('Tu acceso al programa Negocio que Escala de Mauricio Bustos ya está listo.'), t.cuerpo);
  assert.ok(t.cuerpo.includes('https://x.test/api/compartido/curso/entrar?t=c1.1.2.3.firma'), 'falta el link de entrada');
  assert.ok(t.cuerpo.includes('También puedes entrar en https://x.test/login con Google si este correo es de Google.'), t.cuerpo);
  // Sin nombre ni negocio sigue siendo una frase entera, no «Hola undefined» ni «de null».
  const sin = textoInvitacionCurso({ programa: 'NqE', enlace: 'https://e', entrarConGoogle: 'https://l' });
  assert.match(sin.cuerpo, /^Hola,\n/);
  assert.ok(sin.cuerpo.includes('Tu acceso al programa NqE ya está listo.'), sin.cuerpo);
  assert.doesNotMatch(sin.cuerpo + sin.asunto, /undefined|null/);
});

test('el mail va en neutro con TÚ y sin jerga: lo lee un cliente mexicano de otro negocio', () => {
  const t = textoInvitacionCurso({ nombre: 'Ana', programa: 'Negocio que Escala', negocio: 'Mauricio Bustos', enlace: 'https://e', entrarConGoogle: 'https://l' });
  const todo = `${t.asunto}\n${t.preheader}\n${t.cuerpo}`;
  assert.deepEqual(marcasDeVoseo(todo), [], 'el mail vosea');
  assert.match(todo, /\bEntra\b/);
  assert.match(todo, /\bpuedes\b/);
  // Quien lo lee no sabe qué es MaKo, ni un «portal», ni un «token».
  assert.doesNotMatch(todo, /MaKo|portal|token|workspace/i);
});

// ── El aviso: sale de `enviado`, nunca de que haya un resultado ───────────────

test('el aviso de invitar NO dice «enviada» si el mail no salió', () => {
  const no = avisoInvitacionCurso({ enviado: false, error: 'remitente de prueba' }, false);
  assert.equal(no.tono, 'warn');
  assert.ok(no.texto.includes('remitente de prueba'), 'no dice por qué no salió');
  assert.doesNotMatch(no.texto, /enviada/i);
  assert.equal(avisoInvitacionCurso(null, false).tono, 'warn', 'sin resultado tampoco es un éxito');
  // Salió pero no quedó anotado: la ficha va a seguir diciendo «Sin invitar», y hay que decirlo
  // o alguien lo reenvía y le llegan dos.
  assert.equal(avisoInvitacionCurso({ enviado: true }, false).tono, 'warn');
  assert.deepEqual(avisoInvitacionCurso({ enviado: true }, true), { tono: 'ok', texto: 'Invitación enviada.' });
});

// ── El estado: una frase, y «no lo sé» no es «nunca» ──────────────────────────

const acc = (o: Partial<AccesoInvitacion> = {}): AccesoInvitacion => ({ existe: true, revocado: false, ingresos: 0, ultimoIngresoAt: null, ...o });

test('el estado de la invitación: cortado gana, sin fila es «Sin invitar», y undefined NO es «Sin invitar»', () => {
  assert.deepEqual(estadoDeInvitacion(acc({ revocado: true, invitacionEnviadaAt: '2026-10-06T12:00:00Z' })), { tipo: 'cortado' });
  assert.deepEqual(estadoDeInvitacion(acc({ existe: false })), { tipo: 'sin-invitar' });
  assert.deepEqual(estadoDeInvitacion(acc({ invitacionEnviadaAt: null })), { tipo: 'sin-invitar' });
  assert.deepEqual(estadoDeInvitacion(acc({ invitacionEnviadaAt: '2026-10-06T12:00:00Z', email: 'a@b.mx' })),
    { tipo: 'invitado', email: 'a@b.mx', enviadaAt: '2026-10-06T12:00:00Z' });
  // La fila de la tabla que no trajo la invitación: no se afirma nada.
  assert.deepEqual(estadoDeInvitacion(acc({})), { tipo: 'no-se' });
  assert.deepEqual(estadoDeInvitacion(null), { tipo: 'no-se' });
  assert.equal(fraseInvitacion({ tipo: 'no-se' }), '');
  assert.equal(fraseInvitacion({ tipo: 'sin-invitar' }), 'Sin invitar');
  assert.equal(fraseInvitacion({ tipo: 'cortado' }), 'Acceso cortado');
  assert.match(fraseInvitacion({ tipo: 'invitado', email: 'a@b.mx', enviadaAt: '2026-10-06T18:00:00Z' }), /^Invitado a a@b\.mx · \d{1,2} oct/);
  assert.equal(fraseIngresos({ ingresos: 0, ultimoIngresoAt: null }), 'Todavía no entró');
  assert.match(fraseIngresos({ ingresos: 2, ultimoIngresoAt: '2026-10-06T18:00:00Z' }), /^Entró 2 veces · última /);
});

// ── Los cableados que el typecheck no ve ──────────────────────────────────────

const ACC = sinComentarios(leer('app/customer-success/curso-ficha-actions.ts'));
const INVITAR_ACC = (() => {
  const ini = ACC.indexOf('export async function invitarAlCursoAction(');
  return ACC.slice(ini, ACC.indexOf('export async function', ini + 10));
})();

test('invitarAlCursoAction: corta lo cortado, manda el link vigente y anota SÓLO si salió', () => {
  const i = (s: string) => { const n = INVITAR_ACC.indexOf(s); assert.ok(n >= 0, `falta «${s}»`); return n; };
  assert.ok(INVITAR_ACC.length > 500, 'no encontré la action');
  assert.match(INVITAR_ACC, /emailUtilizable\(correo\)/, 'el email no se valida');
  // Un acceso cortado no se invita (y se mira ANTES de mandar).
  assert.ok(i('a.revocado') < i('invitarAlCursoPorEmail('), 'el corte se mira después de mandar');
  // El link es el de ENTRADA, firmado con la versión VIGENTE que se acaba de leer.
  assert.match(INVITAR_ACC, /firmarAccesoCurso\(\{ ws, leadId, version: a\.version \}\)/);
  // (O `urlDeEntrada(token)` de lib/alumno-sesion.ts, que arma el mismo link: es la unificación
  // que quedó pendiente al cerrar la tanda.)
  assert.match(INVITAR_ACC, /linkApp\('\/api\/compartido\/curso\/entrar\?t=' \+ token, null\)|urlDeEntrada\(token\)/);
  // Se anota adentro del `if (inv.enviado)`, y después del envío.
  assert.match(INVITAR_ACC, /if \(inv\.enviado\) \{\s*try \{\s*await marcarInvitacion\(/, 'la invitación se anota sin saber si salió');
  assert.ok(i('invitarAlCursoPorEmail(') < i('marcarInvitacion('));
  // Y el aviso sale de `inv`, con la función que mira `enviado`.
  assert.match(INVITAR_ACC, /aviso: avisoInvitacionCurso\(inv, anotado\)/);
});

test('el mail del curso NO anota nada: correría en el workspace de la plataforma', () => {
  const inv = sinComentarios(leer('lib/invitaciones.ts'));
  const ini = inv.indexOf('export async function invitarAlCursoPorEmail(');
  assert.ok(ini > 0, 'no está invitarAlCursoPorEmail');
  const cuerpo = inv.slice(ini);
  assert.match(cuerpo, /enviarDePlataforma\(/, 'el curso dejó de usar el núcleo (y su corte del sandbox)');
  assert.doesNotMatch(cuerpo, /marcarInvitacion|getTenantDb|curso_accesos/, 'el mail del curso volvió a anotar adentro del workspace de la plataforma');
  // El núcleo: el corte del remitente de prueba ANTES de mandar, y el envío en la plataforma.
  const nucleo = inv.slice(inv.indexOf('async function enviarDePlataforma('), inv.indexOf('export async function invitarPorEmail('));
  assert.ok(nucleo.indexOf('resend\\.dev') > 0 && nucleo.indexOf('resend\\.dev') < nucleo.indexOf('await sendEmail('));
  assert.match(nucleo, /runWithWorkspace\(await wsSuperAdmin\(\)/);
});

test('el modal de invitar: portal al body, email obligatorio, y NO se cierra si el mail no salió', () => {
  const src = sinComentarios(leer('app/customer-success/curso/InvitarAlCurso.tsx'));
  assert.match(src, /createPortal\(\s*<Modal/);
  assert.match(src, /document\.body,?\s*\)/);
  assert.match(src, /\banidada\b/);
  assert.match(src, /disabled=\{!sirve\}/, 'el botón de mandar no espera un email que sirva');
  assert.match(src, /const sirve = emailUtilizable\(correo\)/);
  const mandar = src.slice(src.indexOf('async function mandar('), src.indexOf('return (', src.indexOf('async function mandar(')));
  const noSalio = mandar.indexOf('if (!r.enviado)');
  assert.ok(noSalio > 0 && noSalio < mandar.indexOf('setAbierto(false)'), 'el modal se cierra antes de saber si el mail salió');
});

test('los avisos de aprobación de agencia miran `enviado`, no que haya un resultado', () => {
  // `invitarPorEmail` devuelve SIEMPRE un objeto: `inv ? ok : warn` dice «Se le mandó el
  // acceso» sobre un mail que no salió. Lo encontró el relevo del 06/10/2026.
  const agencia = sinComentarios(leer('app/api/admin/agencia/route.ts'));
  assert.match(agencia, /aviso = inv\.enviado\s*\?/);
  // El `?` de un ternario, no el `?.` del encadenado opcional.
  assert.doesNotMatch(agencia, /aviso = inv\s*\?(?!\.)/);
  const altas = sinComentarios(leer('app/api/admin/agencia/altas/route.ts'));
  assert.match(altas, /aviso: invitacion\?\.enviado\s*\?/);
  assert.doesNotMatch(altas, /aviso: invitacion\s*\?(?!\.)/);
});
