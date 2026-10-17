// =============================================================================
// curso-invitar — invitar a un cliente al curso, sus permisos y su entrada con el email
// =============================================================================
// Pedido de Martín (06/10/2026): «Al igual que en la vista de Agencia, se debería poder INVITAR
// al cliente a MaKo para que tenga acceso al curso». Y el 07/10/2026 (items 9 y 4 del curso tipo
// Skool): invitar desde la tarjeta del kanban y desde el editor, sin sesión desde el CRM
// (`invitarAlCursoSinSesion`), los PERMISOS por alumno (`curso_accesos.alcance`, mig 0219), la
// entrada con el email en /login, y la vista Avance en Clientes.
//
// Lo que estos tests cuidan no es que el mail salga —eso lo decide Resend— sino lo que ya falló o
// puede fallar sin que nada avise:
//   · el FALSO ÉXITO: decir «enviada» porque hubo un resultado, y no porque salió;
//   · anotar la invitación en el INTENTO (o en el workspace equivocado);
//   · invitar a un acceso CORTADO (un mail con un link que no abre);
//   · DOS mails por el mismo «pasó a Ganado» (la invitación sin sesión es idempotente y RECLAMA);
//   · un permiso que se lee del prototipo (`'constructor'` en vez de un id de producto);
//   · la tarjeta sin las acciones del curso porque el workspace no es agencia;
//   · la ruta del link mágico contestando distinto si el email existe;
//   · el texto en neutro con TÚ (lo lee un cliente mexicano de otro negocio).
// Lo que se EJECUTA es lo puro y la invitación con una base SIMULADA (en un proceso hijo con la
// condición `react-server`: lib/curso-invitar.ts tiene `server-only`); lo que se LEE del fuente son
// los cableados que el typecheck no ve.
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
// (Desde el 07/10/2026 la invitación vive en lib/curso-invitar.ts y la action la envuelve: las
// roturas 4 y 9 se rehicieron sobre el núcleo, ver abajo.)
//
// PROBADO ROMPIÉNDOLO OTRA VEZ (07/10/2026, scratchpad/pista-invitar/romper.mjs, que guarda cada
// archivo en memoria, lo rompe, corre ESTE archivo y lo reescribe — nunca `git checkout`; después
// se comparó cada archivo contra su respaldo byte a byte). Todo en su lugar: 27 pass / 0 fail.
// Cada rotura, de a una:
//   10. `moduloPermitido` con `k in alcance.modulos` en vez de hasOwnProperty → 26 / 1 «el alcance se mira con hasOwnProperty…»
//   11. `saneaAlcance` aceptando cualquier clave (sin `esIdProducto`)          → 26 / 1 «saneaAlcance: sólo…»
//   12. `saneaAlcance` colapsando la lista vacía a «todos»                     → 26 / 1 «lista vacía es "ninguno"…»
//   13. el núcleo sin `if (!reenviar && previo?.invitacionEnviadaAt)`          → 26 / 1 «sin sesión es IDEMPOTENTE…»
//   14. el núcleo sin el reclamo (`d.reclamar`)                                → 25 / 2 «sin sesión es IDEMPOTENTE…» y «el núcleo…»
//   15. el núcleo marcando ANTES de mandar                                     → 24 / 3 «el núcleo…», «el orden…» y «el contrato…»
//   16. el núcleo sin `previo?.revocado`                                       → 25 / 2 «cortado gana…» y «el núcleo…»
//   17. `aContrato` con el mail caído como `ok: true`                          → 26 / 1 «el contrato…»
//   18. la tarjeta con las opciones del curso adentro de `conCuentas ? … : []` → 26 / 1 «la tarjeta ofrece el curso SIN conCuentas…»
//   19. `opcionesDeCursoEnTarjeta` ofreciendo invitar a un cortado             → 26 / 1 «las opciones del curso…»
//   20. `pedirLinkDeEntrada` llamando a `mandar` antes de contestar            → 26 / 1 «el link mágico no revela…»
//   21. `pedirLinkDeEntrada` contestando 429 si el tope por EMAIL se pasó      → 26 / 1 «el link mágico: los topes»
//   22. `leerLinkAlumno` sin mirar el vencimiento                              → 26 / 1 «el link de entrada…»
//   23. `/api/alumno/link` fuera de PUBLICOS                                   → 26 / 1 «las rutas del alumno…»
//   24. `accesosDeClientes` sin `invitacion_enviada_at`                        → 26 / 1 «la lectura de accesos…»
//   25. `invitarClientesAction` sin la puerta                                  → 26 / 1 «invitar-actions…»
//   26. el modal cerrándose ANTES de mirar `r.enviado`                         → 26 / 1 «el modal de invitar…»
//
// LA REVISIÓN ADVERSARIAL (08/10/2026, scratchpad/revision-invitar/romper.mjs, mismo método: en
// memoria, sin git, ancla con el fin de línea de CADA archivo, y respaldo comparado byte a byte).
// Con todo en su lugar: 29 pass / 0 fail. Cada rotura, de a una, dio 28 / 1 en el test indicado:
//   27. `cambiarModulos` validando el alcance ENTERO (lo de antes)             → «guardar los permisos de UN producto…»
//   28. la action leyendo las etapas tolerantes (sin `estricto: true`)         → el mismo
//   29. el alta de cero sin sacarlo de los otros productos                     → «invitar-actions…»
//   30. el alta de cero invitando aunque quedó en otro producto                → «invitar-actions…»
//   31. `agarrar` sin el corte de `data-nodrag`                                → «la tarjeta ofrece el curso SIN conCuentas…»
//   32. el envoltorio sin anotar dónde nació el gesto                          → el mismo
//   33. vuelve el `onDragStart` muerto del menú                                → el mismo
//   34. la tarjeta ofreciendo «Invitar al curso» sobre «no lo sé»               → «las opciones del curso…»
//   35. `no-ganado` diciendo otra vez «no es de este workspace»                → «cada motivo se le dice…»
//   36. `usarLeadId` tratado siempre como cliente nuevo                        → «invitar-actions…»
//
// A UN CURSO (09/10/2026, puntos 6 y 7 del audio de la noche; scratchpad fb-acceso/romper.mjs, mismo
// método). Con todo en su lugar: 30 pass / 0 fail. «a UN curso: el mail nombra sólo ése…» cae con:
// «ya invitado» sin producto, marcar sin el producto, `invitadoAlProducto` sin mirar el producto, y el
// núcleo sin el error de «no es cliente de ese producto» (29 / 1 cada una). Las demás roturas de esa
// tanda, en tests/curso-invitar-reglas.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { textoInvitacionCurso, textoLinkAlumno } from '../lib/invitacion-aviso';
import { marcasDeVoseo } from '../lib/puestas-data';
import {
  avisoInvitacionCurso, estadoDeInvitacion, fraseInvitacion, fraseIngresos, accesoDeFila, clientesSinInvitar,
  opcionesDeCursoEnTarjeta, modulosElegidos, type AccesoInvitacion,
} from '../app/customer-success/curso-ficha-lectura';
import { saneaAlcance, moduloPermitido, productoRestringido, conModulos, alcanceValido, cambiarModulos, type AlcanceCurso } from '../lib/curso-alcance';
import { firmarLinkAlumno, leerLinkAlumno, firmarSesionAlumno, urlDeLinkAlumno, LINK_ALUMNO_MINUTOS } from '../lib/alumno-sesion';
import { firmarAccesoCurso, leerAccesoCurso } from '../lib/curso-acceso';
import { pedirLinkDeEntrada, RESPUESTA_LINK, type DepsPedirLink } from '../app/api/alumno/pedir-link';
import { esPublica, esPublicaSoloLeer, esPublicaDeEscritura } from '../lib/rutas-publicas';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función, desde su firma hasta el inicio de la siguiente declaración de nivel 0. */
const bloque = (src: string, firma: string, hasta: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no está: ${firma}`);
  const fin = src.indexOf(hasta, ini + firma.length);
  assert.ok(fin > ini, `no encontré el final de ${firma}`);
  return src.slice(ini, fin);
};

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
  // El del link de entrada por email, con las mismas reglas.
  const l = textoLinkAlumno({ enlace: 'https://x/login?entrar=am1.x', minutos: 15, negocio: 'Mauricio Bustos' });
  const todoL = `${l.asunto}\n${l.preheader}\n${l.cuerpo}`;
  assert.deepEqual(marcasDeVoseo(todoL), [], 'el mail del link vosea');
  assert.doesNotMatch(todoL, /MaKo|portal|token|workspace|undefined|null/i);
  assert.ok(l.cuerpo.includes('https://x/login?entrar=am1.x'), 'falta el link');
  assert.ok(l.cuerpo.includes('15 minutos') && /una sola vez/.test(l.cuerpo), 'no dice cuánto vale ni que sirve una vez');
  assert.ok(l.cuerpo.includes('Si no lo pediste, ignora este correo.'), 'quien no lo pidió tiene que poder leerlo sin alarma');
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

// ── La lectura de accesos trae la invitación (la tabla Avance y la tarjeta) ──────

test('la lectura de accesos trae el email y la invitación, y una fila invitada dice «Invitado» (no «Invitar»)', () => {
  // Hasta el 07/10/2026 `accesosDeClientes` no traía ni el email ni `invitacion_enviada_at`, y la
  // tabla Avance ofrecía «Invitar» —nunca «Reenviar»— a gente ya invitada, con el modal vacío.
  const admin = sinComentarios(leer('lib/curso-admin.ts'));
  const fn = bloque(admin, 'export async function accesosDeClientes(', '\n}\n');
  // `, productos` (mig 0232) es opcional en el patrón: con ella la lista de un curso deja de dar por
  // invitado a quien sólo lo está a OTRO curso (`accesoEnProducto`, lib/curso-invitar-reglas.ts).
  assert.match(fn, /\.select\('lead_id, revocado_at, ingresos, ultimo_ingreso_at, email, invitacion_enviada_at(, productos)?'\)/);
  assert.match(fn, /invitacionEnviadaAt: f\.invitacion_enviada_at \?\? null/);
  assert.match(fn, /\.is\('area', null\)/, 'el acceso DEL CLIENTE, no el de un líder');
  // La traducción de la fila (una sola, para la celda, la tarjeta y el editor).
  const invitado = accesoDeFila({ estado: 'activo', ingresos: 0, ultimoIngresoAt: null, email: 'a@b.mx', invitacionEnviadaAt: '2026-10-07T12:00:00Z' });
  assert.equal(estadoDeInvitacion(invitado).tipo, 'invitado');
  assert.equal(estadoDeInvitacion(accesoDeFila({ estado: 'activo', ingresos: 0, ultimoIngresoAt: null, email: null, invitacionEnviadaAt: null })).tipo, 'sin-invitar');
  assert.equal(estadoDeInvitacion(accesoDeFila({ estado: 'sin-link', ingresos: 0, ultimoIngresoAt: null })).tipo, 'sin-invitar');
  assert.equal(accesoDeFila(null), null, 'sin leer no es «sin invitar»');
  // Y la página de Clientes le pasa el email del CRM a la fila (con él se prellena el modal).
  const page = sinComentarios(leer('app/customer-success/page.tsx'));
  assert.match(page, /email: c\.email \?\? null, etapa, \.\.\.a, acceso: accesoDe\(c\.leadId\)/);
});

test('«Clientes sin invitar»: sólo los que de verdad no lo están, con el email del CRM', () => {
  const f = (leadId: number, acceso: Parameters<typeof accesoDeFila>[0], email: string | null = null) =>
    ({ leadId, nombre: `C${leadId}`, empresa: null, email, acceso });
  const lista = clientesSinInvitar([
    f(1, { estado: 'sin-link', ingresos: 0, ultimoIngresoAt: null }, 'uno@x.mx'),
    f(2, { estado: 'activo', ingresos: 0, ultimoIngresoAt: null, email: 'dos@x.mx', invitacionEnviadaAt: '2026-10-07T00:00:00Z' }),
    f(3, { estado: 'cortado', ingresos: 0, ultimoIngresoAt: null, email: null, invitacionEnviadaAt: null }),
    f(4, null),
    f(5, { estado: 'activo', ingresos: 0, ultimoIngresoAt: null }),
    f(6, { estado: 'activo', ingresos: 0, ultimoIngresoAt: null, email: 'previo@x.mx', invitacionEnviadaAt: null }),
  ]);
  assert.deepEqual(lista.map((c) => c.leadId), [1, 6], 'ni el invitado, ni el cortado, ni el que no se pudo leer, ni el «no sé»');
  assert.equal(lista[0].email, 'uno@x.mx', 'el email del CRM');
  assert.equal(lista[1].email, 'previo@x.mx', 'sin email del CRM, el de un intento anterior');
});

// ── La invitación: una sola, con dos puertas ──────────────────────────────────

const ACC = sinComentarios(leer('app/customer-success/curso-ficha-actions.ts'));
const INVITAR_ACC = (() => {
  const ini = ACC.indexOf('export async function invitarAlCursoAction(');
  return ACC.slice(ini, ACC.indexOf('export async function', ini + 10));
})();
const NUCLEO_SRC = sinComentarios(leer('lib/curso-invitar.ts'));
const NUCLEO = bloque(NUCLEO_SRC, 'export async function invitarAlCurso(', 'export async function invitarAlCursoSinSesion(');

test('invitarAlCursoAction es el ENVOLTORIO de su puerta: valida el email y llama al núcleo con reenviar', () => {
  assert.ok(INVITAR_ACC.length > 300, 'no encontré la action');
  assert.match(INVITAR_ACC, /const p = await puerta\(leadId\);\s*if \(!p\.ok\) return p;/);
  assert.match(INVITAR_ACC, /emailUtilizable\(correo\)/, 'el email no se valida');
  assert.match(INVITAR_ACC, /invitarAlCurso\(\{ ws, leadId, email: correo, autor: await autorActual\(\), reenviar: true \}\)/);
  // Y el aviso sale de `enviado`, con la función que lo mira.
  assert.match(INVITAR_ACC, /aviso: avisoInvitacionCurso\(\{ enviado: r\.enviado, error: r\.fallo \?\? undefined \}, r\.anotado\)/);
  // ⛔ El link ya no se arma a mano: lo arma `linkDeEntradaAlumno` (estaba sin uso, con un TODO).
  assert.doesNotMatch(ACC + NUCLEO_SRC, /linkApp\('\/api\/compartido\/curso\/entrar/, 'el link de entrada volvió a armarse a mano');
  assert.match(NUCLEO_SRC, /alumno\.linkDeEntradaAlumno\(leadId, ws, autor\)/);
});

test('el núcleo: corta lo cortado ANTES de mandar, manda el link de entrada, y anota SÓLO si salió', () => {
  const i = (s: string) => { const n = NUCLEO.indexOf(s); assert.ok(n >= 0, `falta «${s}»`); return n; };
  assert.ok(i('previo?.revocado') < i('d.mandar('), 'el corte se mira después de mandar');
  assert.ok(i('d.linkDeEntrada(') < i('d.mandar('));
  assert.ok(i('if (!inv.enviado)') < i('d.marcar('), 'la invitación se anota sin saber si salió');
  assert.ok(i('d.mandar(') < i('d.marcar('));
  // Sin sesión, reclama ANTES de mandar.
  assert.ok(i('d.reclamar(') < i('d.mandar('));
  // El workspace se pinnea primero, y la capa es la de SU fila (no `getCapaActual`, cacheada por request).
  assert.ok(i('d.enWorkspace(p.ws') < i('d.capaConCs('));
  assert.doesNotMatch(NUCLEO_SRC, /getCapaActual/);
  assert.match(NUCLEO_SRC, /capas\.tabEnCapa\('customer-success', capas\.capaDef\(w\.capa\)\.id\)/);
  // ⛔ Nunca una cuenta.
  assert.doesNotMatch(NUCLEO_SRC, /crearUsuario|invitarPorEmail\(|mako_session|from\('usuarios'\)/);
});

/** Corre `invitarAlCurso` con una base SIMULADA en un proceso hijo (`server-only` bajo `react-server`). */
type Caso = { r: { tipo: string; motivo?: string; enviado?: boolean; anotado?: boolean; fallo?: string | null; error?: string; via?: string }; contrato: Record<string, unknown>; log: string[] };
/** Los casos y, aparte, cómo se le dice cada motivo a una persona (`TEXTO_NO_INVITA`, del mismo módulo). */
type Corrida = { casos: Record<string, Caso>; textos: Record<string, string> };
function correrNucleo(): Corrida {
  const archivo = JSON.stringify(pathToFileURL(join(RAIZ, 'lib/curso-invitar.ts')).href);
  // ⚠️ SIN BACKTICKS adentro: este código va en un template literal.
  const codigo = `
    const { invitarAlCurso, aContrato, TEXTO_NO_INVITA } = await import(${archivo});
    const salida = {};
    function deps(o) {
      const log = [];
      const d = { dentro: false };
      Object.assign(d, {
        enWorkspace: async (ws, fn) => { log.push('ws:' + ws); d.dentro = true; try { return await fn(); } finally { d.dentro = false; } },
        capaConCs: async () => { log.push('capa'); return o.capa !== false; },
        lead: async () => { log.push('lead'); return 'lead' in o ? o.lead : { nombre: 'Ana Pérez', email: 'ana@x.mx', ganado: true }; },
        acceso: async () => {
          log.push('acceso');
          // La SEGUNDA lectura puede contestar otra cosa: lo cortaron entre la primera y el link.
          if ('accesoDespues' in o && log.filter((x) => x === 'acceso').length > 1) return o.accesoDespues;
          return 'acceso' in o ? o.acceso : null;
        },
        // Por producto (09/10/2026): con qué producto se pidió, y null = no es cliente de ése.
        cursos: async (l, p) => {
          log.push('cursos');
          if (p != null) log.push('cursosDe:' + p);
          if (p != null && 'cursosDelProducto' in o) return o.cursosDelProducto;
          return o.cursos || ['Negocio que Escala'];
        },
        linkDeEntrada: async () => { log.push('link'); return 'link' in o ? o.link : 'https://x/api/compartido/curso/entrar?t=c1.9.21.1.f'; },
        reclamar: async (l, p) => { log.push('reclamar'); if (p != null) log.push('reclamarDe:' + p); return o.reclamar !== false; },
        soltar: async () => { log.push('soltar'); },
        negocio: async () => 'Mauricio Bustos',
        entrarConGoogle: () => 'https://x/login',
        mandar: async (m) => { log.push('mandar:' + m.email + ':' + m.enlace + ':' + (d.dentro ? 'dentro' : 'fuera')); log.push('programa:' + m.programa); return o.mandar || { enviado: true, enlace: m.enlace }; },
        marcar: async (id, e, a, p) => { log.push('marcar:' + e); if (p != null) log.push('marcarDe:' + p); },
        guardarEmailDelLead: async (id, e) => { log.push('guardarEmail:' + e); },
      });
      return { d, log };
    }
    async function caso(nombre, p, o) {
      const { d, log } = deps(o || {});
      const r = await invitarAlCurso(Object.assign({ ws: 9, leadId: 21, autor: 'MaKo' }, p), d);
      salida[nombre] = { r, contrato: aContrato(r), log };
    }
    await caso('feliz', {}, {});
    await caso('yaInvitado', {}, { acceso: { revocado: false, invitacionEnviadaAt: '2026-10-07T00:00:00Z' } });
    await caso('reclamoPerdido', {}, { reclamar: false });
    // ya-entro (08/10/2026): tiene acceso, nunca se le mandó el mail y ya entró con un link copiado. Rompiéndolo
    // (sin la línea del motivo en lib/curso-invitar.ts): 28 / 1. Restaurado: 29 / 0.
    await caso('yaEntro', {}, { acceso: { revocado: false, invitacionEnviadaAt: null, ingresos: 3 } });
    await caso('reenviarInvitado', { reenviar: true }, { acceso: { revocado: false, invitacionEnviadaAt: '2026-10-07T00:00:00Z' } });
    await caso('cortadoEInvitado', { reenviar: true }, { acceso: { revocado: true, invitacionEnviadaAt: '2026-10-07T00:00:00Z' } });
    await caso('noGanado', {}, { lead: { nombre: 'X', email: 'x@x.mx', ganado: false } });
    await caso('noExiste', {}, { lead: null });
    await caso('sinCapa', {}, { capa: false });
    await caso('sinClases', {}, { cursos: [] });
    await caso('sinEmail', {}, { lead: { nombre: 'X', email: null, ganado: true } });
    await caso('emailPedidoMalo', { email: 'no-es-un-email' }, {});
    await caso('emailPedido', { email: '  Otra@X.MX ' }, { lead: { nombre: 'X', email: null, ganado: true } });
    await caso('mailCaido', {}, { mandar: { enviado: false, error: 'remitente de prueba', enlace: 'e' } });
    await caso('cortadoAlArmar', {}, { link: null, accesoDespues: { revocado: true, invitacionEnviadaAt: null } });
    await caso('sinSecreto', {}, { link: null });
    // A UN CURSO (puntos 6 y 7 del audio del 08/10/2026 a la noche).
    await caso('aFiesta', { productoId: 39 }, { cursosDelProducto: ['Fiesta Music'] });
    await caso('invitadoAOtro', { productoId: 39 }, { cursosDelProducto: ['Fiesta Music'], acceso: { revocado: false, invitacionEnviadaAt: '2026-10-09T01:50:20Z', productos: [10], ingresos: 1 } });
    await caso('invitadoAEste', { productoId: 39 }, { acceso: { revocado: false, invitacionEnviadaAt: '2026-10-09T01:50:20Z', productos: [39] } });
    await caso('invitadoATodos', { productoId: 39 }, { acceso: { revocado: false, invitacionEnviadaAt: '2026-10-09T01:50:20Z', productos: null } });
    await caso('entroAOtro', { productoId: 39 }, { cursosDelProducto: ['Fiesta Music'], acceso: { revocado: false, invitacionEnviadaAt: null, productos: [10], ingresos: 3 } });
    await caso('noEsSuyo', { productoId: 77 }, { cursosDelProducto: null });
    await caso('productoMalo', { productoId: -1 }, {});
    await caso('caidoPorMako', { productoId: 39 }, { cursosDelProducto: ['Fiesta Music'], mandar: { enviado: false, error: 'RESEND_API_KEY no configurada', enlace: 'e', remitente: 'mako' } });
    console.log(JSON.stringify({ casos: salida, textos: TEXTO_NO_INVITA }));
  `;
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  return JSON.parse(linea) as Corrida;
}

let NUC: Corrida | null = null;
const corrida = () => (NUC ??= correrNucleo());
const nuc = () => corrida().casos;

test('sin sesión es IDEMPOTENTE: ya invitado no manda, y el reclamo perdido tampoco', { timeout: 180_000 }, () => {
  const s = nuc();
  assert.deepEqual(s.yaInvitado.contrato, { ok: true, enviado: false, motivo: 'ya-invitado' });
  assert.ok(!s.yaInvitado.log.some((x) => x.startsWith('mandar')), 'mandó un segundo mail a alguien ya invitado');
  assert.ok(!s.yaInvitado.log.includes('link'), 'creó el acceso para nada');
  // Otro disparo del mismo «pasó a Ganado» lo está mandando: éste no manda.
  assert.deepEqual(s.reclamoPerdido.contrato, { ok: true, enviado: false, motivo: 'ya-invitado' });
  assert.deepEqual(s.yaEntro.contrato, { ok: true, enviado: false, motivo: 'ya-entro' });
  assert.ok(!s.yaEntro.log.some((x) => x.startsWith('mandar')), 'le mandó «te invitamos» a alguien que ya usa el curso');
  assert.ok(!s.reclamoPerdido.log.some((x) => x.startsWith('mandar')), 'sin reclamo salen dos mails');
  // Con sesión («Reenviar invitación») sí manda, y no reclama.
  assert.equal(s.reenviarInvitado.r.tipo, 'mandado');
  assert.ok(!s.reenviarInvitado.log.includes('reclamar'));
});

test('cortado gana, y cada motivo es el suyo', { timeout: 180_000 }, () => {
  const s = nuc();
  assert.deepEqual(s.cortadoEInvitado.r, { tipo: 'no', motivo: 'cortado' }, 'un acceso cortado no se invita ni reenviando');
  assert.ok(!s.cortadoEInvitado.log.some((x) => x.startsWith('mandar')));
  assert.deepEqual(s.noGanado.contrato, { ok: true, enviado: false, motivo: 'no-ganado' });
  assert.deepEqual(s.sinClases.contrato, { ok: true, enviado: false, motivo: 'sin-clases' });
  assert.deepEqual(s.sinEmail.contrato, { ok: true, enviado: false, motivo: 'sin-email' });
  assert.equal(s.noExiste.contrato.ok, false);
  assert.equal(s.emailPedidoMalo.contrato.ok, false, 'un email pedido que no sirve es un error, no cae al del CRM');
  // Sin la capa de Customer Success, no se lee ni el lead.
  assert.equal(s.sinCapa.contrato.ok, false);
  assert.ok(!s.sinCapa.log.includes('lead'), 'leyó el lead de un workspace sin la tab');
  // Lo cortaron entre la lectura y el link: es «cortado», no un error genérico. Y sin link por otra
  // razón (sin secreto para firmar), es un error que se dice — nunca un mail sin link.
  assert.deepEqual(s.cortadoAlArmar.contrato, { ok: true, enviado: false, motivo: 'cortado' });
  assert.deepEqual(s.sinSecreto.contrato, { ok: false, error: 'No pude armar su link.' });
  assert.ok(!s.sinSecreto.log.some((x) => x.startsWith('mandar')));
});

test('el orden: el workspace pinneado, el mail adentro de él, y anotar DESPUÉS de que salió', { timeout: 180_000 }, () => {
  const s = nuc();
  const log = s.feliz.log;
  assert.equal(log[0], 'ws:9', 'lo primero es pinnear el workspace de la invitación');
  const m = log.findIndex((x) => x.startsWith('mandar:'));
  assert.ok(m > 0 && log[m].endsWith(':dentro'), 'el mail salió afuera del workspace pinneado');
  assert.ok(log[m].includes('https://x/api/compartido/curso/entrar?t=c1.9.21.1.f'), 'el mail no lleva el link de entrada');
  assert.ok(log.indexOf('reclamar') < m && m < log.indexOf('marcar:ana@x.mx'), 'reclamar → mandar → marcar');
  assert.deepEqual(s.feliz.contrato, { ok: true, enviado: true });
  // Sin email en el CRM: se usa el pedido (normalizado) y se le guarda al lead.
  assert.ok(s.emailPedido.log.some((x) => x.startsWith('mandar:otra@x.mx:')));
  assert.ok(s.emailPedido.log.includes('guardarEmail:otra@x.mx'));
  assert.ok(!s.feliz.log.some((x) => x.startsWith('guardarEmail')), 'pisó el email que el lead ya tenía');
});

test('el contrato: un mail caído es un FALLO (ok: false), suelta el reclamo y no anota nada', { timeout: 180_000 }, () => {
  const s = nuc();
  assert.deepEqual(s.mailCaido.contrato, { ok: false, error: 'No salió el correo: remitente de prueba' });
  assert.ok(s.mailCaido.log.includes('soltar'), 'el reclamo quedó tomado: el próximo intento esperaría 5 minutos');
  assert.ok(!s.mailCaido.log.some((x) => x.startsWith('marcar')), 'anotó una invitación que no salió');
  // Y en todo `ok: true` sin enviar hay un motivo.
  for (const [n, c] of Object.entries(s)) {
    if (c.contrato.ok === true && c.contrato.enviado === false) assert.ok(c.contrato.motivo, `${n}: ok sin enviar y sin motivo`);
  }
});

test('cada motivo se le dice a una persona sin afirmar de más, y en neutro', { timeout: 180_000 }, () => {
  // Revisión del 08/10/2026: `no-ganado` decía «Ese cliente no es de este workspace» sobre un lead
  // que SÍ es de este workspace y dejó de estar en Ganado (lo de otro workspace ni llega: es un
  // error). Mandaba a buscarlo en otra cuenta. Lo ejecuta el hijo: el módulo es `server-only`.
  const t = corrida().textos;
  assert.deepEqual(Object.keys(t).sort(), ['cortado', 'no-ganado', 'sin-clases', 'sin-email', 'ya-entro', 'ya-invitado']);
  assert.doesNotMatch(t['no-ganado'], /workspace|cuenta/i, 'afirma que es de otro workspace');
  assert.deepEqual(marcasDeVoseo(Object.values(t).join('\n')), [], 'un motivo vosea');
});

test('a UN curso: el mail nombra sólo ése, «ya invitado» es por producto, y el producto llega al reclamo y a la lista', { timeout: 180_000 }, () => {
  // Puntos 6 y 7 del audio del 08/10/2026 a la noche: «Tu acceso al programa de Service Delivery Ops y
  // Fiesta Music» y «tengo acceso a los dos cursos, cuando sólo le había invitado al curso de Fiesta Music».
  const s = nuc();
  const f = s.aFiesta.log;
  assert.ok(f.includes('cursosDe:39'), 'los cursos del mail no se pidieron por el producto');
  assert.ok(f.includes('programa:Fiesta Music'), `el mail nombra otra cosa: ${f.find((x) => x.startsWith('programa:'))}`);
  assert.ok(f.includes('reclamarDe:39'), 'el reclamo sin sesión no es por producto');
  assert.ok(f.includes('marcarDe:39'), 'la invitación no le abre ese curso a su acceso');
  assert.deepEqual(s.aFiesta.contrato, { ok: true, enviado: true });
  // Invitado a OTRO curso (o ya entró a otro): éste se invita igual.
  assert.equal(s.invitadoAOtro.r.tipo, 'mandado', 'el invitado a Service Delivery figuraba invitado a Fiesta Music');
  assert.equal(s.entroAOtro.r.tipo, 'mandado');
  // Invitado a ÉSTE, o a todos (lo de antes): ya está.
  assert.deepEqual(s.invitadoAEste.contrato, { ok: true, enviado: false, motivo: 'ya-invitado' });
  assert.deepEqual(s.invitadoATodos.contrato, { ok: true, enviado: false, motivo: 'ya-invitado' });
  // Un producto del que no es cliente es un ERROR, no un mail; y uno inválido ni se mira.
  assert.deepEqual(s.noEsSuyo.contrato, { ok: false, error: 'No es cliente de ese producto.' });
  assert.ok(!s.noEsSuyo.log.some((x) => x.startsWith('mandar')));
  assert.equal(s.productoMalo.contrato.ok, false);
  assert.ok(!s.productoMalo.log.includes('lead'), 'leyó el lead con un producto inválido');
  // Sin producto, como siempre: ni el reclamo ni la lista se tocan por producto.
  assert.ok(!s.feliz.log.some((x) => x.startsWith('reclamarDe:') || x.startsWith('marcarDe:') || x.startsWith('cursosDe:')));
  // Un correo que no salió dice POR DÓNDE iba: la pantalla dice de quién fue (lib/curso-invitar-reglas.ts).
  assert.equal(s.caidoPorMako.r.via, 'mako');
  assert.ok(!s.caidoPorMako.log.some((x) => x.startsWith('marcar')), 'un intento que no salió le abrió el curso');
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
  const mandar = bloque(src, 'async function mandar(', 'return createPortal(');
  const noSalio = mandar.indexOf('if (!r.enviado)');
  assert.ok(noSalio > 0 && noSalio < mandar.indexOf('onCerrar()'), 'el modal se cierra antes de saber si el mail salió');
  // Y el botón y la tarjeta montan EL MISMO modal (con dos, uno se queda sin el «sólo si salió»).
  assert.match(src, /\{abierto && <ModalInvitar \{\.\.\.props\}/);
  assert.match(sinComentarios(leer('app/customer-success/ClienteCard.tsx')), /<ModalInvitar leadId=\{c\.leadId\}/);
});

test('los avisos de aprobación de agencia miran `enviado`, no que haya un resultado', () => {
  // `invitarPorEmail` devuelve SIEMPRE un objeto: `inv ? ok : warn` dice «Se le mandó el
  // acceso» sobre un mail que no salió. Lo encontró el relevo del 06/10/2026.
  // Desde el 17/10/2026 el aviso vive en lib/agencia-habilitar.ts: lo usan la firma del super admin y el PAGO del primer
  // mes de un cliente de agencia (#866), y los dos tienen que decir lo mismo.
  assert.match(sinComentarios(leer('app/api/admin/agencia/route.ts')), /const aviso = estado === 'aprobado' \? await avisarClienteAprobado\(clienteWs\) : null;/);
  const agencia = sinComentarios(leer('lib/agencia-habilitar.ts'));
  assert.match(agencia, /return inv\.enviado\s*\?/);
  // El `?` de un ternario, no el `?.` del encadenado opcional.
  assert.doesNotMatch(agencia, /return inv\s*\?(?!\.)/);
  const altas = sinComentarios(leer('app/api/admin/agencia/altas/route.ts'));
  assert.match(altas, /aviso: invitacion\?\.enviado\s*\?/);
  assert.doesNotMatch(altas, /aviso: invitacion\s*\?(?!\.)/);
});

// ── Los permisos (mig 0219) ───────────────────────────────────────────────────

test('saneaAlcance: sólo { modulos: { <id de producto>: claves } }, todo lo demás es «ve todo»', () => {
  for (const x of [null, undefined, 0, 'x', [], {}, { modulos: null }, { modulos: [] }, { modulos: 'a' }, { modulos: {} }, { modulos: { abc: ['x'] } }]) {
    assert.equal(saneaAlcance(x), null, JSON.stringify(x));
  }
  assert.deepEqual(saneaAlcance({ modulos: { 7: ['a', 'a', ' b ', 5, '', null, 'c'] }, otra: 1 }), { modulos: { 7: ['a', 'b', 'c'] } });
  // Las claves de un id raro no son productos: ni `01`, ni `1e3`, ni negativos.
  assert.equal(saneaAlcance({ modulos: { '01': ['a'], '1e3': ['a'], '-2': ['a'] } }), null);
  // ⚠️ `__proto__` y `constructor` de un JSON son claves PROPIAS de verdad: se descartan.
  const malo = JSON.parse('{"modulos":{"__proto__":["a"],"constructor":["b"],"9":["x"]}}');
  const s = saneaAlcance(malo);
  assert.deepEqual(s, { modulos: { 9: ['x'] } });
  assert.equal(Object.getPrototypeOf(s!.modulos), Object.prototype, 'el __proto__ del jsonb terminó siendo el prototipo');
  // Un control de caracteres en una clave no viaja.
  assert.deepEqual(saneaAlcance({ modulos: { 3: ['ok', 'a\u0000b'] } }), { modulos: { 3: ['ok'] } });
});

test('el alcance se mira con hasOwnProperty: un id que es un nombre del prototipo no da vuelta la regla', () => {
  // Sin entrada para el producto = ve TODO. Con `k in obj` o `obj[k]`, `'constructor'` y `'toString'`
  // encuentran la función del prototipo, no es un array, y la regla contesta «no» sin que falle nada.
  const a: AlcanceCurso = { modulos: { 7: ['bienvenida'] } };
  for (const p of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.equal(moduloPermitido(a, p, 'bienvenida'), true, p);
    assert.equal(productoRestringido(a, p), false, p);
  }
  assert.equal(moduloPermitido(a, 7, 'bienvenida'), true);
  assert.equal(moduloPermitido(a, '7', 'diagnostico'), false, 'restringido: sólo lo listado');
  assert.equal(moduloPermitido(a, 8, 'lo-que-sea'), true, 'otro producto sin entrada ve todo');
  assert.equal(moduloPermitido(null, 7, 'x'), true, 'sin alcance ve todo');
});

test('lista vacía es «ninguno», y «todos» se guarda SACANDO la entrada', () => {
  const vacia = saneaAlcance({ modulos: { 3: [] } });
  assert.deepEqual(vacia, { modulos: { 3: [] } }, 'la lista vacía colapsó a «todos»');
  assert.equal(moduloPermitido(vacia, 3, 'a'), false);
  assert.equal(productoRestringido(vacia, 3), true);
  // conModulos: toca UN producto y deja los otros.
  const dos = conModulos({ modulos: { 3: ['a'] } }, 5, ['x', 'y']);
  assert.deepEqual(dos, { modulos: { 3: ['a'], 5: ['x', 'y'] } });
  assert.deepEqual(conModulos(dos, 5, null), { modulos: { 3: ['a'] } }, '«Todos los módulos» saca la entrada');
  assert.equal(conModulos({ modulos: { 3: ['a'] } }, 3, null), null, 'sin restricciones vuelve a null');
  // alcanceValido: lo que llega del navegador no se cree.
  const v = alcanceValido({ modulos: { 3: ['a', 'inventada'], 99: ['x'] } }, new Map([[3, ['a', 'b']]]));
  assert.deepEqual(v, { modulos: { 3: ['a'] } }, 'claves que no existen o un producto que no es suyo');
  // La ficha tilda con la MISMA regla que el portal.
  const mods = [{ key: 'a', label: 'A', clases: 1 }, { key: 'b', label: 'B', clases: 0 }];
  assert.equal(modulosElegidos(null, 3, mods), null, 'sin alcance = «Todos los módulos»');
  assert.deepEqual(modulosElegidos({ modulos: { 3: ['b'] } }, 3, mods), ['b']);
});

test('guardar los permisos de UN producto no toca los de los otros (y nunca los abre)', () => {
  // Revisión del 08/10/2026: la action pasaba el alcance ENTERO por `alcanceValido` contra los
  // productos que HOY tienen curso. Un producto restringido que se quedó sin clases un rato (o del que
  // lo sacaron) perdía su entrada al tocar OTRO — y «sin entrada» es «ve todo».
  const antes: AlcanceCurso = { modulos: { 3: ['a'], 7: [] } };
  // Se toca el 5 (con sus módulos de hoy): el 3 y el 7 quedan como estaban aunque no se diga nada de ellos.
  assert.deepEqual(cambiarModulos(antes, 5, ['x', 'inventada', ' x '], ['x', 'y']), { modulos: { 3: ['a'], 7: [], 5: ['x'] } });
  assert.deepEqual(cambiarModulos(antes, 3, null, []), { modulos: { 7: [] } }, '«Todos los módulos» saca SÓLO la entrada de ese producto');
  assert.deepEqual(cambiarModulos(antes, 3, [], ['a']), { modulos: { 3: [], 7: [] } }, 'cero tildados es «ninguno»');
  assert.deepEqual(cambiarModulos(null, 5, ['inventada'], ['x']), { modulos: { 5: [] } }, 'una clave que no existe no abre nada');
  // La action guarda con esta función y lee los MÓDULOS ESTRICTOS (la lectura de la ficha cae a las
  // etapas de fábrica con el catálogo caído: sirve para dibujar, no para decidir qué claves existen).
  // Desde el 08/10/2026 (D1) son los módulos del curso —las etapas que son módulo y los sueltos—, no
  // las etapas del kanban: un suelto también se puede permitir o esconder.
  const accion = bloque(ACC, 'export async function guardarAlcanceCursoAction(', 'export async function');
  assert.match(accion, /const cur = await modulosDelCurso\(productoId, \{ estricta: true \}\);\s*if \(!cur\) return \{ ok: false/);
  assert.match(accion, /existen = cur\.modulos\.map\(\(m\) => m\.clave\);/);
  assert.doesNotMatch(accion, /entregasDeProductos\(|modulosDelCurso\(productoId\)/, 'la lectura que cae al default no decide qué claves existen');
  assert.match(accion, /guardarAlcance\(leadId, cambiarModulos\(actual, productoId, claves, existen\)/);
  assert.doesNotMatch(accion, /alcanceValido\(/, 'volvió a validar el alcance ENTERO');
});

test('el alcance viaja en la MISMA lectura que decide si el link abre (resolverAcceso y el del líder)', () => {
  const datos = sinComentarios(leer('lib/curso-datos.ts'));
  const r = bloque(datos, 'export async function resolverAcceso(', 'export type AccesoPortal');
  assert.match(r, /\.select\('version, revocado_at, alcance'\)\.eq\('lead_id', a\.leadId\)\.is\('area', null\)/);
  assert.match(r, /return \{ \.\.\.a, alcance: saneaAlcance\(f\.alcance\) \};/);
  const p = bloque(datos, 'export async function resolverAccesoPortal(', 'export async function contarIngreso(');
  // El del líder es el del CLIENTE: se lee de la fila del cliente.
  assert.match(p, /\.select\('revocado_at, alcance'\)\.eq\('lead_id', lider\.leadId\)\.is\('area', null\)/);
  assert.match(p, /alcance: saneaAlcance\(cliente\?\.alcance\)/);
  // La migración: idempotente, con su orden de despliegue escrito y sin abrirle nada al navegador.
  const mig = leer('supabase/migrations/0219_curso_accesos_alcance.sql');
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  assert.match(mig, /alter table curso_accesos add column if not exists alcance jsonb;/);
  assert.match(mig, /revoke all on curso_accesos from anon, authenticated;/);
  assert.match(mig, /alter table curso_accesos enable row level security;/);
});

// ── La tarjeta del kanban ofrece el curso SIN depender de que sea agencia ───────

test('las opciones del curso: invitar / reenviar / permisos, y nunca invitar a ciegas ni a un cortado', () => {
  const ops = (a: AccesoInvitacion | null, permisos = true) => opcionesDeCursoEnTarjeta({ acceso: a }, permisos).map((o) => o.label);
  assert.deepEqual(ops(acc({ existe: false })), ['Invitar al curso', 'Permisos del curso']);
  assert.deepEqual(ops(acc({ invitacionEnviadaAt: '2026-10-07T00:00:00Z' })), ['Reenviar invitación', 'Permisos del curso']);
  assert.deepEqual(ops(acc({ revocado: true })), ['Permisos del curso'], 'a un cortado no se lo invita (rebota)');
  assert.deepEqual(ops(null), ['Permisos del curso'], 'sin leer su acceso no se invita a ciegas');
  // Revisión del 08/10/2026: leído pero SIN la invitación («no lo sé») ofrecía «Invitar al curso».
  assert.deepEqual(ops(acc({})), ['Permisos del curso'], 'sin saber si ya se lo invitó, tampoco');
  assert.deepEqual(opcionesDeCursoEnTarjeta(null, true), [], 'sin curso, nada del curso');
});

test('la tarjeta ofrece el curso SIN conCuentas: la fila y el menú existen sin ser agencia', () => {
  const card = sinComentarios(leer('app/customer-success/ClienteCard.tsx'));
  // Las opciones del curso entran por la función pura, AFUERA de cualquier `conCuentas`.
  const ops = bloque(card, 'const opciones: Array<{ value: string; label: string }> = [', '];');
  assert.match(ops, /^const opciones[^\n]*\n\s*\.\.\.opcionesDeCursoEnTarjeta\(curso, Boolean\(onPermisos\)\),/);
  // La fila de acciones existe si hay opciones, y el menú no cuelga de `conCuentas`.
  assert.match(card, /acciones=\{conCuentas \|\| accionExtra \|\| opciones\.length > 0 \?/);
  assert.match(card, /\{opciones\.length > 0 && \(\s*<span/);
  assert.doesNotMatch(card, /conCuentas && opciones\.length > 0/, 'el menú volvió a ser sólo de agencias');
  // El arrastre: el menú se marca `data-nodrag` y lo que cancela el gesto es `agarrar`.
  // ⚠️ Revisión del 08/10/2026: acá se exigía un `onDragStart` en el envoltorio del menú, y ese
  // handler no corre NUNCA — el `dragstart` sale del nodo ARRASTRABLE (el envoltorio de la tarjeta
  // en el kanban), no de un hijo. El test fijaba código muerto. Lo que cancela es el kanban, con el
  // nodo donde nació el `pointerdown` (anotado EN CAPTURA, antes del `stopPropagation` del menú).
  assert.match(card, /<span style=\{\{ display: 'contents' \}\} data-nodrag\s/);
  assert.match(card, /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/);
  assert.doesNotMatch(card, /onDragStart=/, 'volvió el onDragStart que no corre nunca');
  // Las opciones hacen lo que dicen.
  assert.match(card, /if \(v === 'curso-invitar'\) \{ setAviso\(null\); setInvitando\(true\); return; \}/);
  assert.match(card, /if \(v === 'curso-permisos'\) \{ onPermisos\?\.\(\); return; \}/);
  // Y el call site existe: el kanban las pasa, y la pantalla abre la ficha en la pestaña Curso.
  const kanban = sinComentarios(leer('app/customer-success/KanbanEntrega.tsx'));
  assert.match(kanban, /onPointerDownCapture=\{\(ev\) => \{ origenGesto\.current = ev\.target as Element; \}\}\s*onDragStart=\{\(ev\) => agarrar\(ev, c\.leadId\)\}/);
  const agarrar = bloque(kanban, 'function agarrar(', 'function soltarGesto(');
  const corta = agarrar.indexOf("origen.closest('[data-nodrag]')) { e.preventDefault(); return; }");
  assert.ok(corta > 0 && corta < agarrar.indexOf('montarCopia('), 'agarrar no cancela un gesto que nació en el menú (o lo cancela tarde)');
  assert.match(agarrar, /origen && e\.currentTarget\.contains\(origen\) && origen\.closest/, 'un pointerdown de OTRA tarjeta frenaría éste');
  assert.match(kanban, /curso=\{cursoDe\?\.\(c\.leadId\) \?\? null\}/);
  assert.match(kanban, /onPermisos=\{onPermisos \? \(\) => onPermisos\(c\.leadId\) : undefined\}/);
  const app = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  assert.match(app, /cursoDe=\{cursoDe\}/);
  assert.match(app, /onPermisos=\{\(leadId\) => \{ setAbrirEn\('curso'\); setAbiertoId\(leadId\); \}\}/);
  // Y «Permisos del curso» tiene dónde caer: la ficha guarda el alcance con su action.
  assert.match(sinComentarios(leer('app/customer-success/FichaCurso.tsx')), /guardarAlcanceCursoAction\(leadId, productoId, claves\)/);
});

test('la vista Avance vive en Clientes: el toggle la ofrece y la pantalla la dibuja', () => {
  const barra = sinComentarios(leer('app/customer-success/BarraClientes.tsx'));
  assert.match(barra, /export type VistaClientes = 'tarjetas' \| 'tabla' \| 'kanban' \| 'avance';/);
  assert.match(barra, /const ORDEN_VISTAS: readonly VistaClientes\[\] = \['kanban', 'tarjetas', 'tabla', 'avance'\];/);
  const app = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  assert.match(app, /\.\.\.\(hayAvance \? \['avance' as const\] : \[\]\)/);
  assert.match(app, /enAvance && servicio \? \(\s*<AvanceDelServicio /);
  // El ícono existe en el catálogo compartido (un ícono inventado dibuja un punto).
  assert.match(sinComentarios(leer('app/_ui/iconos-vista.tsx')), /\n\s*avance: \{\s*titulo: 'Ver el avance del curso',/);
});

// ── invitar-actions.ts: la puerta y nada más que funciones async ────────────────

test('invitar-actions: «use server», SÓLO funciones async, y cada una abre con la puerta', () => {
  const ruta = 'app/customer-success/curso/invitar-actions.ts';
  const sf = ts.createSourceFile(ruta, leer(ruta), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const plano = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ').trim();
  const mods = (n: ts.Node) => ts.getModifiers(n as ts.HasModifiers) ?? [];
  const tiene = (n: ts.Node, k: ts.SyntaxKind) => mods(n).some((m) => m.kind === k);
  assert.match(plano(sf.statements[0]), /^'use server';$/);
  const exportados = sf.statements.filter((s) => tiene(s, ts.SyntaxKind.ExportKeyword) || ts.isExportAssignment(s) || ts.isExportDeclaration(s));
  const malos = exportados.filter((s) => !(ts.isFunctionDeclaration(s) && tiene(s, ts.SyntaxKind.AsyncKeyword))).map(plano);
  assert.deepEqual(malos, [], 'un export que no es una función async tira el build');
  assert.ok(exportados.length >= 2, 'faltan las dos actions');
  const GATE = 'const no = await puedeUsarCs(); if (no) return { ok: false, error: no };';
  for (const f of exportados as ts.FunctionDeclaration[]) {
    const abre = (f.body?.statements.slice(0, 2) ?? []).map(plano).join(' ');
    assert.equal(abre, GATE, `${f.name?.text} no abre con la puerta`);
  }
  // Las dos usan LA invitación (no una copia) y sin «reenviar»: idempotentes. Desde el 08/10/2026 con
  // sus `canales` («También por WhatsApp», item 21): el patrón los acepta al final, saneados en el server.
  const src = sinComentarios(leer(ruta));
  // Desde el 09/10/2026 con su `productoId` (puntos 6 y 7 del audio de la noche): el mail nombra sólo ese
  // curso y el acceso abre ése (tests/curso-invitar-reglas.test.ts).
  assert.equal((src.match(/invitarAlCurso\(\{ ws, leadId, email: correo, autor, reenviar: false(, canales(: canalesDeInvitacion\(datos\.canales\))?)?, productoId \}\)/g) ?? []).length, 2);
  assert.doesNotMatch(src, /invitarAlCursoPorEmail|marcarInvitacion|crearUsuario/);
  // El alta de cero pasa por la MISMA alta de la cartera, y entra al kanban por el choke point.
  assert.match(src, /crearClienteAction\(\{/);
  assert.match(src, /moverClienteDeEtapa\(\{ leadId, productoId, etapa: null, por: autor \}\)/);
  // ⚠️ Revisión del 08/10/2026: y SÓLO en este producto. Nace en el embudo principal, así que su
  // casa es el producto principal: invitado desde el curso de OTRO quedaba en los dos kanbans. Se lo
  // saca de los otros con la misma «Quitar de este producto», y si no se pudo NO se lo invita. Desde el
  // 09/10/2026 la pregunta es la del KANBAN (`productosDelCliente`): `productosDelAlumno` pasó a ser
  // «qué cursos VE» (mig 0232) y a alguien todavía no invitado le diría que no es de ningún producto.
  const nuevo = bloque(src, 'export async function invitarNuevoAlumnoAction(', 'async function conEstado(');
  assert.match(nuevo, /if \(enKanban && nuevoCliente\) \{\s*for \(const otro of \(await productosDelCliente\(leadId\)\)\.productos\.filter\(\(x\) => x !== productoId\)\) \{\s*const q = await quitarDeProductoAction\(leadId, otro\);\s*if \(!q\.ok\) \{ soloAca = false;/);
  const sinOtro = nuevo.indexOf('!soloAca');
  assert.ok(sinOtro > 0 && sinOtro < nuevo.indexOf('invitarAlCurso('), 'invita sin saber si quedó sólo en este producto');
  // Uno que YA era cliente sigue en lo suyo: sólo se lo saca de otros si esta action lo hizo cliente.
  assert.match(nuevo, /nuevoCliente = \(data as \{ estado_lead: string \| null \}\)\.estado_lead !== 'ganado';/);
  // El componente del editor tiene su call site para las dos.
  const comp = sinComentarios(leer('app/customer-success/curso/InvitarAlumnos.tsx'));
  assert.match(comp, /invitarClientesAction\(/);
  assert.match(comp, /invitarNuevoAlumnoAction\(/);
});

// ── Entrar con el email: el link mágico ─────────────────────────────────────────

const S = 'secreto-de-prueba-del-link-0123456789';
const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);
const NONCE = 'AbCdEfGhIjKlMnOpQrStUvWx';

test('el link de entrada: firma propia, vence a los 15 minutos y no se confunde con otros tokens', () => {
  const t = firmarLinkAlumno({ ws: 1, leadId: 21, version: 3 }, NONCE, S, T0)!;
  assert.match(t, /^am1\.1\.21\.3\.\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(leerLinkAlumno(t, S, T0 + 60_000), { ws: 1, leadId: 21, version: 3, nonce: NONCE, exp: Math.floor(T0 / 1000) + LINK_ALUMNO_MINUTOS * 60 });
  assert.equal(leerLinkAlumno(t, S, T0 + LINK_ALUMNO_MINUTOS * 60_000 + 1), null, 'no venció');
  assert.equal(leerLinkAlumno(t, 'otro-secreto', T0), null, 'otra firma abrió');
  assert.equal(leerLinkAlumno(t.replace('.21.', '.22.'), S, T0), null, 'otro lead con la misma firma');
  assert.equal(leerLinkAlumno(t.slice(0, -3), S, T0), null, 'firma recortada');
  assert.equal(firmarLinkAlumno({ ws: 1, leadId: 21, version: 3 }, 'con.punto.adentro123', S, T0), null, 'un nonce con punto partiría el token');
  // Ni la cookie del alumno ni el link del curso sirven como éste, ni al revés.
  assert.equal(leerLinkAlumno(firmarSesionAlumno({ ws: 1, leadId: 21, version: 3 }, S, T0), S, T0), null);
  assert.equal(leerLinkAlumno(firmarAccesoCurso({ ws: 1, leadId: 21, version: 3 }, S), S, T0), null);
  assert.equal(leerAccesoCurso(t, S), null, 'el link de entrada abrió el portal como un c1.');
  // El link va a /login (un botón lo termina), nunca a la ruta que lo gasta.
  assert.match(urlDeLinkAlumno(t), /\/login\?entrar=am1\./);
});

test('el link mágico no revela si el email existe: misma respuesta, y la búsqueda va DESPUÉS de contestar', () => {
  const correr = (existe: boolean, ip = '1.1.1.1') => {
    const programados: Array<() => Promise<void>> = [];
    const mandados: string[] = [];
    const deps: DepsPedirLink = {
      programar: (fn) => { programados.push(fn); },
      // Lo que haría la base: con el email invitado, manda; si no, nada. La respuesta no puede depender de esto.
      mandar: async (email) => { if (existe) mandados.push(email); },
      limite: () => true,
    };
    const r = pedirLinkDeEntrada({ ip, email: '  Ana@X.mx ' }, deps);
    return { r, programados, mandados };
  };
  const si = correr(true);
  const no = correr(false);
  assert.deepEqual(si.r, no.r, 'la respuesta cambia según el email exista');
  assert.deepEqual(si.r, { status: 200, body: RESPUESTA_LINK });
  assert.equal(si.mandados.length, 0, 'buscó y mandó ANTES de contestar: el tiempo delataría si existe');
  assert.equal(si.programados.length, 1);
  return si.programados[0]().then(() => assert.deepEqual(si.mandados, ['ana@x.mx'], 'el trabajo programado no manda al email normalizado'));
});

test('el link mágico: los topes', () => {
  const base = (limite: DepsPedirLink['limite']) => {
    const programados: Array<() => Promise<void>> = [];
    const r = pedirLinkDeEntrada({ ip: '2.2.2.2', email: 'ana@x.mx' }, { programar: (fn) => { programados.push(fn); }, mandar: async () => {}, limite });
    return { r, programados };
  };
  // Por IP: 429 (no depende de la base).
  assert.equal(base((k) => !k.startsWith('alumno-link:ip:')).r.status, 429);
  // Por email: contesta IGUAL que el éxito, y no programa nada (decir «ya te mandamos varios» también cuenta algo).
  const porEmail = base((k) => !k.startsWith('alumno-link:email:'));
  assert.deepEqual(porEmail.r, { status: 200, body: RESPUESTA_LINK });
  assert.equal(porEmail.programados.length, 0);
  // Un email que no sirve: 400, sin tocar nada.
  const malo = pedirLinkDeEntrada({ ip: '3.3.3.3', email: 'no-es' }, { programar: () => assert.fail('programó'), mandar: async () => {}, limite: () => true });
  assert.equal(malo.status, 400);
  assert.equal(pedirLinkDeEntrada({ ip: '3.3.3.3', email: { email: 'a@b.mx' } }, { programar: () => assert.fail('programó'), mandar: async () => {}, limite: () => true }).status, 400);
});

test('las rutas del alumno: públicas (se autentican solas), con POST, y sin leer ninguna cookie', () => {
  for (const r of ['/api/alumno/link', '/api/alumno/entrar']) {
    assert.equal(esPublica(r), true, `${r}: sin estar en PUBLICOS el proxy la corta con 401 antes de correr`);
    assert.equal(esPublicaSoloLeer(r), false, `${r}: es un POST`);
    assert.equal(esPublicaDeEscritura(r), false, 'no es de /api/compartido');
  }
  // Exactas: la carpeta no hereda.
  assert.equal(esPublica('/api/alumno'), false);
  assert.equal(esPublica('/api/alumno/otra'), false);
  for (const r of ['app/api/alumno/link/route.ts', 'app/api/alumno/entrar/route.ts']) {
    const src = sinComentarios(leer(r));
    assert.doesNotMatch(src, /cookies\(|mako_session|getUsuarioActual|crearUsuario|from\('usuarios'\)/, `${r} lee una cookie o crea una cuenta`);
    assert.doesNotMatch(src, /export (const|function) (?!POST|dynamic|revalidate)/, `${r} exporta algo que no es de una ruta`);
  }
  // El pedido CONTESTA sin esperar: el trabajo va por `after`.
  assert.match(sinComentarios(leer('app/api/alumno/link/route.ts')), /programar: \(trabajo\) => \{\s*try \{ after\(trabajo\); \}/);
  // Entrar: 303 (el navegador sigue con un GET), gasta el nonce y pone LA cookie del alumno.
  const entrar = sinComentarios(leer('app/api/alumno/entrar/route.ts'));
  assert.match(entrar, /status: 303/);
  assert.match(entrar, /entrarConLinkDeEmail\(token\)/);
  assert.match(entrar, /ponerCookieAlumno\(res, acceso\)/);
  // Y lo que gasta el link: un solo uso, con el nonce en el WHERE.
  const datos = sinComentarios(leer('lib/curso-datos.ts'));
  const consumir = bloque(datos, 'export async function consumirLinkMagico(', '\n}\n');
  assert.match(consumir, /\.eq\('link_magico_nonce', nonce\)/);
  assert.match(consumir, /\.update\(\{ link_magico_nonce: null \}\)/);
  // La búsqueda por email es LA del login con Google (usuarios gana, sólo invitaciones que salieron).
  const acceso = sinComentarios(leer('lib/alumno-acceso.ts'));
  assert.match(bloque(acceso, 'export async function mandarLinkDeEntrada(', '\n}\n'), /await accesoInvitadoPorEmail\(email\)/);
  // /login dibuja el botón (no gasta nada al abrirse).
  const login = sinComentarios(leer('app/login/page.tsx'));
  assert.match(login, /leerLinkAlumno\(tokenAlumno\)/);
  assert.doesNotMatch(login, /entrarConLinkDeEmail|consumirLinkMagico/, 'abrir /login gasta el link (lo gastaría un escáner de correo)');
  assert.match(sinComentarios(leer('app/login/EntrarAlumno.tsx')), /<form method="post" action="\/api\/alumno\/entrar">/);
});
