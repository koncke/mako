// =============================================================================
// curso-mensajes — lo que el curso le escribe al cliente y a Mauricio, y CUÁNDO
// =============================================================================
// Ejecuta los textos y las ventanas (lib/curso-mensajes-texto.ts, puro) y fija con guards las dos
// cosas de lib/curso-mensajes.ts (server-only) que no se ven en una pantalla: que el cron MARCA
// con compare-and-set ANTES de mandar, y que vercel.json lo corre.
//
// ⚠️ LOS CLIENTES DE MAURICIO SON MEXICANOS: el detector de voseo de abajo corre sobre los textos
// ARMADOS con datos. El guard del repo (tests/puente-panel-copy.test.ts) barre con `git ls-files`
// y un archivo sin commitear no lo ve; éste sí.
//
// Probado ROMPIÉNDOLO (06/10/2026) sobre lib/ y vercel.json, restaurando de memoria (18 pass sin
// romper; 19 desde que se sumó el motivo por fase, que rompiendo `conMotivoDeFase` para que pise
// la columna entera da 18 / 1):
//   · «Empieza aquí» → «Empezá acá» en la etapa nueva → 16 pass / 2 fail (el voseo y el texto).
//   · `listaPendientes` sin el «y N más» → 16 / 2 (el tope, y el previo que lo muestra).
//   · el previo hasta 26 h antes → 17 / 1 (la ventana del previo).
//   · `cuandoEs` por horas que faltan (`Math.ceil`) en vez del día de calendario → 17 / 1.
//   · `marcar` sin el `.is(columna, null)` → 17 / 1 (el guard del compare-and-set).
//   · la rama del envío apagado llamando a `marcar()` → 17 / 1 (apagado no marca).
//   · vercel.json con otra ruta → 17 / 1.
// Y el primer verde no fue verde: el detector marcó «mandé» (pretérito de 1ª persona, homógrafo
// del imperativo voseado) y el previo decía «a las 10:00 a. m..» — los dos se arreglaron.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  textoLinkCurso, textoEntradaAEtapa, textoPrevioCliente, textoPosteriorCliente,
  textoPrevioDueno, textoPosteriorDueno, tituloAvisoDueno, listaPendientes, primerNombreDe,
  cuandoEs, horaDe, faseDeSesion, ventanaDeSesiones, enHorarioDeMensajes, TOPE_PENDIENTES,
  motivoDeFase, conMotivoDeFase,
  claveAvisoSesion, grabacionesDeLaSesion, compromisosDeGrabaciones, pasosDeGrabacion, ventanaDeGrabacion,
  TOPE_COMPROMISOS, NO_TENIA_PENDIENTES, type CompromisosJunta,
  juntaPendiente, juntaResuelta, claveAvisoJunta, textoJuntaDueno, tituloAvisoJunta,
} from '../lib/curso-mensajes-texto';

const RAIZ = join(import.meta.dirname, '..');
// ⚠️ Normaliza el fin de línea: en un worktree el fuente llega en CRLF y cortar con '\n}\n' no
// encuentra nada (AGENTS.md, «vale igual para los tests que leen fuente»).
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LINK = 'https://hola-mako.com/compartido/curso/c1.1.21.1.FIRMA_abc-123';
const TZ = 'America/Mexico_City';   // UTC-6 todo el año: el test no depende del horario de verano
const H = 3_600_000;
const AHORA = new Date('2026-10-06T16:00:00Z');   // martes 6/10, 10:00 en CDMX

// ── El detector de voseo ─────────────────────────────────────────────────────
// Una palabra que termina en vocal ACENTUADA (+ s) es la forma del voseo («tenés», «avanzá»,
// «podés»); en el tú neutro esa terminación casi no existe fuera de esta lista. Los límites van
// por Unicode y no con `\b`, que en JavaScript es ASCII y no ve el borde después de una «á».
const NEUTRAS = new Set(['más', 'después', 'atrás', 'además', 'demás', 'jamás', 'país', 'interés', 'través', 'estás', 'está',
  'aquí', 'ahí', 'allí', 'acá', 'allá', 'qué', 'sí', 'sé', 'mí', 'tú', 'también', 'quizás', 'adiós', 'mamá', 'papá',
  // ⚠️ El pretérito de 1ª persona se escribe IGUAL que un imperativo voseado («mandé», «escribí»), y
  // MaKo le habla a Mauricio en primera persona. Se exceptúan por NOMBRE, de a uno, los que usa
  // este archivo — nunca la terminación entera, o el detector deja de ver «hacé» y «tené».
  'mandé', 'escribí']);
// El voseo con clítico no lleva tilde («fijate», «avisame»): esos van por nombre.
const CLITICOS = /(?<!\p{L})(fijate|avisame|decime|contame|escribime|mandame|hacelo|completalo|completala|miralo|sos|vos)(?!\p{L})/iu;
function voseo(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/\p{L}+/gu)) {
    const w = m[0].toLowerCase();
    if (/[áéí]s?$/.test(w) && !NEUTRAS.has(w)) out.push(m[0]);
  }
  const c = texto.match(CLITICOS);
  if (c) out.push(c[0]);
  return out;
}

test('el detector caza el voseo (si no, el verde de abajo no dice nada)', () => {
  assert.deepEqual(voseo('Tenés tu link. Avanzá acá y fijate'), ['Tenés', 'Avanzá', 'fijate']);
  assert.deepEqual(voseo('Tienes tu link. Avanza aquí y fíjate. Después, más.'), []);
});

// Todos los textos, con datos de muestra que ejercen cada rama.
const PEND = ['Tu PAS', 'Tus valores', 'Tu visión a 3 años', 'Tu meta del año', 'Tus palancas'];
const TEXTOS_CLIENTE = [
  textoLinkCurso({ nombre: 'Ana Ruiz', link: LINK }),
  textoLinkCurso({ nombre: null, link: LINK }),
  textoEntradaAEtapa({ nombre: 'Ana', anterior: 'Contexto', nueva: 'Norte', clases: 4, link: LINK }),
  textoEntradaAEtapa({ nombre: 'Ana', anterior: null, nueva: 'Bienvenida', clases: 1, link: LINK }),
  textoPrevioCliente({ nombre: 'Ana', cuando: 'mañana', hora: '10:00 a. m.', etapa: 'Norte', pendientes: PEND, link: LINK }),
  textoPrevioCliente({ nombre: 'Ana', cuando: 'mañana', hora: '10:00 a. m.', etapa: 'Norte', pendientes: [], link: LINK }),
  textoPrevioCliente({ nombre: 'Ana', cuando: 'hoy', hora: '4:30 p. m.', etapa: 'Norte', pendientes: null, link: LINK }),
  textoPosteriorCliente({ nombre: 'Ana', etapa: 'Norte', pendientes: PEND.slice(0, 2), link: LINK })!,
];
const TEXTOS_DUENO = [
  textoPrevioDueno({ cliente: 'Ana Ruiz', cuando: 'mañana', hora: '10:00 a. m.', etapa: 'Norte', pendientes: PEND, noLlego: null }),
  textoPrevioDueno({ cliente: 'Ana Ruiz', cuando: 'mañana', hora: '10:00 a. m.', etapa: 'Norte', pendientes: [], noLlego: 'envío de WhatsApp apagado' }),
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: ['Tu meta'], noLlego: null }),
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: null, noLlego: 'sin teléfono' }),
  tituloAvisoDueno('previo', 'Ana Ruiz'),
  tituloAvisoDueno('posterior', 'Ana Ruiz'),
];

test('ningún texto le habla de VOS (ni al cliente ni a Mauricio)', () => {
  for (const t of [...TEXTOS_CLIENTE, ...TEXTOS_DUENO]) assert.deepEqual(voseo(t), [], `voseo en: ${t}`);
});

test('todo mensaje al cliente lleva SU link, entero (lo escribe el código, no un modelo)', () => {
  for (const t of TEXTOS_CLIENTE) assert.ok(t.includes(LINK), `sin el link: ${t}`);
});

test('ningún aviso a Mauricio lleva el link personal del cliente (va a un grupo)', () => {
  for (const t of TEXTOS_DUENO) assert.ok(!t.includes(LINK), `el link del cliente en el aviso al dueño: ${t}`);
});

test('el saludo usa el PRIMER nombre, y sin nombre queda «Hola,»', () => {
  assert.equal(primerNombreDe('  Ana  Ruiz '), 'Ana');
  assert.equal(primerNombreDe(null), '');
  assert.match(TEXTOS_CLIENTE[0], /^Hola Ana, este es tu acceso al programa:\n/);
  assert.match(TEXTOS_CLIENTE[1], /^Hola, este es tu acceso/);
});

test('etapa nueva: «terminaste» sólo con etapa anterior, y la cuenta de clases en singular/plural', () => {
  assert.match(TEXTOS_CLIENTE[2], /terminaste \*Contexto\*\. Ya tienes abierta \*Norte\*: 4 clases\./);
  assert.match(TEXTOS_CLIENTE[2], /\nEmpieza aquí: https:/);
  assert.doesNotMatch(TEXTOS_CLIENTE[3], /terminaste/);
  assert.match(TEXTOS_CLIENTE[3], /^Hola Ana, ya tienes abierta \*Bienvenida\*: 1 clase\./);
});

test('pendientes: hasta 3 títulos y «y N más»; con exactamente 3 no hay «más»', () => {
  assert.equal(TOPE_PENDIENTES, 3);
  const l = listaPendientes(PEND);
  assert.equal(l, '· Tu PAS\n· Tus valores\n· Tu visión a 3 años\n· y 2 más');
  assert.doesNotMatch(listaPendientes(PEND.slice(0, 3)), /más/);
  // Un título largo se corta a un renglón: no se come el mensaje.
  const largo = listaPendientes(['x'.repeat(200)]);
  assert.ok(largo.length <= 2 + 80 && largo.endsWith('…'), largo);
});

test('previo: con pendientes los lista; sin pendientes «vas al día»; sin clases no dice ninguna de las dos', () => {
  assert.match(TEXTOS_CLIENTE[4], /te recuerdo tu sesión mañana a las 10:00 a\. m\.\nDe \*Norte\* te queda pendiente:\n· Tu PAS/);
  assert.match(TEXTOS_CLIENTE[4], /· y 2 más/);
  assert.match(TEXTOS_CLIENTE[5], /Vas al día con \*Norte\*\./);
  assert.doesNotMatch(TEXTOS_CLIENTE[5], /pendiente/);
  assert.doesNotMatch(TEXTOS_CLIENTE[6], /pendiente|al día/);
});

test('posterior: SIN pendientes no se manda (null), y con pendientes no promete «hoy»', () => {
  assert.equal(textoPosteriorCliente({ nombre: 'S', etapa: 'Norte', pendientes: [], link: LINK }), null);
  assert.equal(textoPosteriorCliente({ nombre: 'S', etapa: 'Norte', pendientes: null, link: LINK }), null);
  // Fuera de horario sale a la mañana siguiente: «la sesión de hoy» mentiría.
  assert.doesNotMatch(TEXTOS_CLIENTE[7], /hoy/);
});

test('a Mauricio: el resumen, y si al cliente NO le llegó, el porqué', () => {
  assert.match(TEXTOS_DUENO[0], /^Mañana a las 10:00 a\. m\. tienes sesión con \*Ana Ruiz\*: 5 tareas pendientes de \*Norte\*:\n/);
  assert.match(TEXTOS_DUENO[0], /\nYa le mandé el recordatorio\.$/);
  assert.match(TEXTOS_DUENO[1], /va al día con \*Norte\*\.\nNo le escribí: envío de WhatsApp apagado\.$/);
  assert.match(TEXTOS_DUENO[2], /1 tarea pendiente de \*Norte\*/);
  assert.match(TEXTOS_DUENO[2], /Ya le mandé sus pendientes\.$/);
  assert.match(TEXTOS_DUENO[3], /No le escribí: sin teléfono\.$/);
});

// ── Cuándo ───────────────────────────────────────────────────────────────────

test('cuandoEs: el DÍA de calendario del negocio, no las horas que faltan', () => {
  assert.equal(cuandoEs(new Date('2026-10-07T16:00:00Z'), AHORA, TZ), 'mañana');
  assert.equal(cuandoEs(new Date('2026-10-06T22:30:00Z'), AHORA, TZ), 'hoy');
  assert.equal(cuandoEs(new Date('2026-10-09T18:00:00Z'), AHORA, TZ), 'el viernes 9');
  // 23:30 del martes → la 1:00 del miércoles: faltan 90 minutos y es «mañana».
  assert.equal(cuandoEs(new Date('2026-10-07T07:00:00Z'), new Date('2026-10-07T05:30:00Z'), TZ), 'mañana');
  // 9:00 del martes → las 8:00 del miércoles: faltan 23 h y es «mañana», no «hoy».
  assert.equal(cuandoEs(new Date('2026-10-07T14:00:00Z'), new Date('2026-10-06T15:00:00Z'), TZ), 'mañana');
});

test('horaDe: como se dice en México', () => {
  assert.equal(horaDe(new Date('2026-10-07T16:00:00Z'), TZ), '10:00 a. m.');
  assert.equal(horaDe(new Date('2026-10-06T22:30:00Z'), TZ), '4:30 p. m.');
  assert.equal(horaDe(new Date('2026-10-09T18:00:00Z'), TZ), '12:00 p. m.');
  assert.equal(horaDe(new Date('2026-10-07T06:00:00Z'), TZ), '12:00 a. m.');
});

test('horario de mensajes: de 9 a 21 del negocio', () => {
  assert.equal(enHorarioDeMensajes(new Date('2026-10-06T14:59:00Z'), TZ), false);   // 8:59
  assert.equal(enHorarioDeMensajes(new Date('2026-10-06T15:00:00Z'), TZ), true);    // 9:00
  assert.equal(enHorarioDeMensajes(new Date('2026-10-07T02:59:00Z'), TZ), true);    // 20:59
  assert.equal(enHorarioDeMensajes(new Date('2026-10-07T03:00:00Z'), TZ), false);   // 21:00
});

test('faseDeSesion: el previo hasta 24 h antes (no a minutos), el posterior de 2 a 48 h después', () => {
  const s = (horas: number, marcas: { p?: string; q?: string } = {}) => ({
    fecha: new Date(AHORA.getTime() + horas * H).toISOString(), avisoPrevioAt: marcas.p ?? null, avisoPosteriorAt: marcas.q ?? null,
  });
  assert.equal(faseDeSesion(s(23), AHORA), 'previo');
  assert.equal(faseDeSesion(s(24), AHORA), 'previo');
  assert.equal(faseDeSesion(s(25), AHORA), null);
  assert.equal(faseDeSesion(s(0.5), AHORA), null);
  assert.equal(faseDeSesion(s(23, { p: 'x' }), AHORA), null);
  assert.equal(faseDeSesion(s(-3), AHORA), 'posterior');
  assert.equal(faseDeSesion(s(-3, { q: 'x' }), AHORA), null);
  assert.equal(faseDeSesion(s(-1), AHORA), null);
  assert.equal(faseDeSesion(s(-50), AHORA), null);
  assert.equal(faseDeSesion({ fecha: 'no es fecha', avisoPrevioAt: null, avisoPosteriorAt: null }, AHORA), null);
});

test('la lectura del cron cubre TODA sesión a la que le toca algo', () => {
  const { desde, hasta } = ventanaDeSesiones(AHORA);
  for (let h = -60; h <= 30; h += 0.25) {
    const fecha = new Date(AHORA.getTime() + h * H).toISOString();
    const toca = faseDeSesion({ fecha, avisoPrevioAt: null, avisoPosteriorAt: null }, AHORA)
      // La junta abierta de una sesión ya avisada también es «le toca algo».
      || juntaPendiente({ fecha, avisoPosteriorAt: 'x', avisoJuntaAt: null }, AHORA);
    if (!toca) continue;
    assert.ok(fecha >= desde && fecha <= hasta, `la sesión a ${h} h tiene algo pendiente y la lectura no la trae`);
  }
});

test('el motivo de cada fase vive en su renglón: anotar una no borra la otra', () => {
  let m = conMotivoDeFase(null, 'previo', 'sin teléfono');
  assert.equal(m, 'Antes: sin teléfono');
  m = conMotivoDeFase(m, 'posterior', 'al día, no se le escribió');
  assert.equal(m, 'Antes: sin teléfono · Después: al día, no se le escribió');
  assert.equal(motivoDeFase(m, 'previo'), 'sin teléfono');
  assert.equal(motivoDeFase(m, 'posterior'), 'al día, no se le escribió');
  // El envío salió: se saca SÓLO el de esa fase.
  assert.equal(conMotivoDeFase(m, 'previo', null), 'Después: al día, no se le escribió');
  assert.equal(conMotivoDeFase('Antes: x', 'previo', null), null);
  // Un error de proveedor con el separador adentro no parte la columna.
  const raro = conMotivoDeFase(null, 'previo', 'Evolution 400 · instancia caída');
  assert.equal(motivoDeFase(raro, 'previo'), 'Evolution 400, instancia caída');
  assert.equal(motivoDeFase(raro, 'posterior'), null);
});

// ── El cron: la marca y el registro ──────────────────────────────────────────

test('el cron MARCA con compare-and-set ANTES de mandar, y con el envío apagado NO marca', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const ini = src.indexOf('async function procesarSesion');
  const fin = src.indexOf('async function procesarWorkspace');
  assert.ok(ini > 0 && fin > ini, 'no encontré procesarSesion');
  const cuerpo = src.slice(ini, fin);
  // La marca: update … where id = X and <columna> is null, y se LEE si devolvió fila.
  const iMarcar = cuerpo.indexOf('const marcar');
  const marcar = cuerpo.slice(iMarcar, cuerpo.indexOf('};', iMarcar));
  assert.match(marcar, /\.update\(\{ \[columna\]:/, 'la marca escribe la columna de la fase');
  assert.match(marcar, /\.is\(columna, null\)/, 'sin `.is(columna, null)` dos corridas mandan dos veces');
  assert.match(marcar, /\.select\(/, 'sin `.select` no se sabe si la marca agarró la fila');
  // Se manda sólo si la marca devolvió fila, y DESPUÉS.
  const iCas = cuerpo.indexOf('if (!(await marcar(juntaResuelta(compromisos)))) return;');
  const iMandar = cuerpo.indexOf('mandar(d, f.lead_id');
  assert.ok(iCas > 0 && iMandar > iCas, 'el envío al cliente tiene que ir después del compare-and-set');
  // Apagado: se anota y se avisa a Mauricio, pero la sesión NO se marca (no salió nada).
  const iApagado = cuerpo.indexOf('if (!ctx.envioOn)');
  const apagado = cuerpo.slice(iApagado, cuerpo.indexOf('return;', iApagado));
  assert.ok(iApagado > 0, 'falta la rama del envío apagado');
  assert.doesNotMatch(apagado, /marcar\(/, 'con el envío apagado la sesión no se marca: diría que salió');
  assert.match(apagado, /anotar\(MOTIVO_APAGADO\)/);
});

test('el cron lee sin inquilino SÓLO para saber a quién visitar, y procesa adentro del workspace', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  // Dos lecturas cruzadas, UNA POR CRON y cada una adentro del suyo: la de las llamadas y la del
  // recordatorio de clases (#780, que tiene sus guards en tests/curso-recordatorio.test.ts).
  // Cualquier otra lectura sin inquilino es un cliente leyendo filas de otro. Probado rompiéndolo
  // (07/10/2026): una tercera `getSupabaseServer()` adentro del negocio → este test cae (59/1).
  assert.equal((src.match(/getSupabaseServer\(\)/g) ?? []).length, 2, 'una lectura cruzada por cron, y ninguna más');
  const iSesiones = src.indexOf('export async function correrAvisosDeSesiones');
  const iRecordatorio = src.indexOf('export async function correrRecordatoriosDeClases');
  const cruzadas = [...src.matchAll(/getSupabaseServer\(\)/g)].map((m) => m.index ?? -1);
  assert.ok(iSesiones > 0 && iRecordatorio > 0, 'no encontré los dos crons');
  assert.ok(cruzadas.every((i) => (i > iSesiones && i < src.indexOf('\n}\n', iSesiones)) || (i > iRecordatorio && i < src.indexOf('\n}\n', iRecordatorio))),
    'una lectura sin inquilino fuera de las dos funciones del cron');
  assert.match(src, /runWithWorkspace\(ws, \(\) => procesarWorkspace\(/);
  // El interruptor del negocio se mira antes de crear el acceso del cliente.
  const ini = src.indexOf('async function destinoDe');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  const iFlag = cuerpo.indexOf('envioWhatsappHabilitado()');
  const iLink = cuerpo.indexOf('linkDeAcceso(');
  assert.ok(iFlag > 0 && iLink > iFlag, 'el envío apagado se mira ANTES de linkDeAcceso, que crea el acceso');
});

test('vercel.json corre el cron cada hora, y la ruta usa la auth de cron de la casa', () => {
  const v = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  const cron = v.crons.find((c) => c.path === '/api/cron/curso-sesiones');
  assert.ok(cron, 'el cron de las sesiones no está en vercel.json: los avisos no salen nunca');
  assert.match(cron!.schedule, /^\d{1,2} \* \* \* \*$/, `schedule «${cron!.schedule}»: tiene que ser cada hora`);
  const ruta = 'app/api/cron/curso-sesiones/route.ts';
  assert.ok(existsSync(join(RAIZ, ruta)), 'falta la ruta del cron');
  const src = sinComentarios(leer(ruta));
  assert.match(src, /checkCronAuth\(req\)/);
  assert.match(src, /correrAvisosDeSesiones\(/);
});

// ── El dedup del aviso al dueño depende del RESULTADO (06/10/2026) ───────────
// Con la clave `sesion:<id>` a secas y 72 h de dedup, el «No le escribí: envío apagado» que se
// repite cada hora mientras la sesión espera dejaba DEDUPLICADO el «Ya le mandé…» de cuando el
// negocio prendía el envío: Mauricio daba por no recordado a alguien a quien sí se le escribió.

/** El dedup de `emitirAviso` (lib/avisos.ts → `salioReciente`), reducido a lo que importa acá. */
function despachador() {
  const salieron = new Set<string>();
  return (clave: string): boolean => { if (salieron.has(clave)) return false; salieron.add(clave); return true; };
}

test('el aviso «no le llegó (envío apagado)» no se come al corregido de la misma sesión', () => {
  const sale = despachador();
  assert.equal(sale(claveAvisoSesion(7, 'envío de WhatsApp apagado')), true, 'la primera hora sale');
  assert.equal(sale(claveAvisoSesion(7, 'envío de WhatsApp apagado')), false, 'la hora siguiente, el mismo resultado no se repite');
  assert.equal(sale(claveAvisoSesion(7, null)), true, 'cuando se prende y le llega, el aviso corregido SALE');
  assert.equal(sale(claveAvisoSesion(7, null)), false);
  // Y cada sesión tiene su clave: el aviso de un cliente no se come el de otro.
  assert.equal(sale(claveAvisoSesion(8, null)), true);
});

test('«sin teléfono» espera sin repetirse cada hora, y el arreglo se avisa', () => {
  const sale = despachador();
  assert.equal(sale(claveAvisoSesion(7, 'sin teléfono')), true);
  assert.equal(sale(claveAvisoSesion(7, 'sin teléfono')), false);
  assert.equal(sale(claveAvisoSesion(7, null)), true, 'le cargaron el teléfono y ya le llegó');
});

test('los compromisos entran a la clave como «los tiene / no»: un error y un vacío no alternan', () => {
  const leida: CompromisosJunta = { estado: 'leida', pasos: [{ que: 'Mandar el PAS', quien: 'cliente' }] };
  const vacia: CompromisosJunta = { estado: 'leida', pasos: [] };
  assert.equal(claveAvisoSesion(7, 'sin teléfono', { estado: 'error' }), claveAvisoSesion(7, 'sin teléfono', { estado: 'sin-grabacion' }));
  assert.equal(claveAvisoSesion(7, 'sin teléfono', vacia), claveAvisoSesion(7, 'sin teléfono', { estado: 'sin-grabacion' }));
  assert.notEqual(claveAvisoSesion(7, 'sin teléfono', leida), claveAvisoSesion(7, 'sin teléfono', { estado: 'sin-grabacion' }),
    'si la grabación se analiza mientras la sesión espera, los compromisos le llegan una vez');
});

test('el aviso al dueño usa la clave POR RESULTADO, y no la vieja por sesión', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  assert.match(src, /dedupKey: claveAvisoSesion\(f\.id, noLlego, compromisos\)/);
  assert.doesNotMatch(src, /dedupKey: `sesion:\$\{f\.id\}`/);
});

// ── Lo que se sabe SIN mandar se mira ANTES de marcar (06/10/2026) ───────────
// Sin teléfono, contacto bloqueado y acceso cortado los contesta `destinoDe`, que sólo lee. Se
// miraban DESPUÉS de marcar: la sesión quedaba cerrada para siempre por algo que se arregla
// cargando un dato, sin que hubiera existido ningún riesgo de mandar dos veces.

test('el cron mira el destino ANTES del compare-and-set, y si no hay a quién, NO marca', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const cuerpo = src.slice(src.indexOf('async function procesarSesion'), src.indexOf('async function procesarWorkspace'));
  const iDestino = cuerpo.indexOf('await destinoDe(f.lead_id, { envioOn: true })');
  const iCas = cuerpo.indexOf('if (!(await marcar(juntaResuelta(compromisos)))) return;');
  assert.ok(iDestino > 0 && iCas > iDestino, 'el destino se lee antes de marcar: si no, «sin teléfono» cierra la sesión para siempre');
  const iNo = cuerpo.indexOf('if (!d.ok) {', iDestino);
  assert.ok(iNo > iDestino && iNo < iCas, 'falta la rama de «no hay a quién» entre el destino y la marca');
  const rama = cuerpo.slice(iNo, cuerpo.indexOf('return;', iNo));
  assert.doesNotMatch(rama, /marcar\(/, 'sin teléfono no se marca: la sesión espera a que se arregle');
  assert.match(rama, /anotar\(d\.motivo\)/, 'el motivo queda escrito para que la ficha lo diga');
  assert.match(rama, /avisarAlDueno\(ctx, f, fase, c, d\.motivo/, 'a Mauricio se le avisa (una vez por motivo)');
  // Y lo que falla DESPUÉS de marcar sigue sin reintentarse: no se manda dos veces.
  const despues = cuerpo.slice(iCas);
  assert.match(despues, /noLlego = 'falló el envío';/);
  assert.doesNotMatch(despues, /\.update\(\{ \[columna\]: null/, 'nadie desmarca una sesión ya procesada');
});

// ── Los compromisos de la junta, en el aviso POSTERIOR AL DUEÑO (opción a, 06/10/2026) ──

const H_ = 3_600_000;
const SES_10 = { id: 1, fecha: '2026-10-07T16:00:00Z' };   // miércoles 10:00 CDMX
const SES_15 = { id: 2, fecha: '2026-10-07T21:00:00Z' };   // el mismo día, 15:00
const SES_LUNES = { id: 3, fecha: '2026-10-12T16:00:00Z' }; // otra semana
const grab = (iso: string, que: string) => ({ startedAt: iso, pasos: [{ que, quien: 'cliente' }] });
const G_10 = grab('2026-10-07T16:04:00Z', 'Mandar el PAS');
const G_15 = grab('2026-10-07T21:10:00Z', 'Subir el tablero');

test('dos sesiones del mismo lead: cada una se queda con SU grabación', () => {
  const sesiones = [SES_10, SES_15, SES_LUNES];
  const todas = [G_10, G_15];
  assert.deepEqual(grabacionesDeLaSesion(SES_10, sesiones, todas), [G_10]);
  assert.deepEqual(grabacionesDeLaSesion(SES_15, sesiones, todas), [G_15],
    'la de las 15:10 también cae en la ventana de las 10 (+6 h): va a la más cercana');
  assert.deepEqual(grabacionesDeLaSesion(SES_LUNES, sesiones, todas), [], 'la de otra semana no tiene grabación');
});

test('la sesión que no se grabó no se queda con los compromisos de la de al lado', () => {
  // La de las 10 no se grabó: la grabación de las 15:10 está en su ventana, pero es de la de las 15.
  assert.deepEqual(grabacionesDeLaSesion(SES_10, [SES_10, SES_15], [G_15]), []);
  // Sin la sesión de las 15 anotada, la de las 10 sí la reclama: es la única que la tiene en su ventana.
  assert.deepEqual(grabacionesDeLaSesion(SES_10, [SES_10], [G_15]), [G_15]);
  // Fuera de la ventana (2 h antes, 6 h después) no es de nadie.
  assert.deepEqual(grabacionesDeLaSesion(SES_10, [SES_10], [grab(new Date(Date.parse(SES_10.fecha) - 2.5 * H_).toISOString(), 'x')]), []);
  assert.deepEqual(grabacionesDeLaSesion(SES_10, [SES_10], [grab(new Date(Date.parse(SES_10.fecha) + 6.5 * H_).toISOString(), 'x')]), []);
});

test('la ventana que se le pide a la base cubre toda grabación que el cruce puede aceptar', () => {
  const v = ventanaDeGrabacion(SES_10.fecha)!;
  for (let h = -3; h <= 7; h += 0.25) {
    const iso = new Date(Date.parse(SES_10.fecha) + h * H_).toISOString();
    if (!grabacionesDeLaSesion(SES_10, [SES_10], [grab(iso, 'x')]).length) continue;
    assert.ok(iso >= v.desde && iso <= v.hasta, `la grabación a ${h} h la acepta el cruce y la consulta no la trae`);
  }
  assert.equal(ventanaDeGrabacion('no es fecha'), null);
});

test('los pasos se sanean contra el contrato, y se juntan sin repetirse', () => {
  assert.deepEqual(pasosDeGrabacion([
    { que: '  Mandar   el PAS ', quien: 'cliente' }, { que: '', quien: 'equipo' }, { quien: 'equipo' },
    { que: 'Revisar su tablero', quien: 'equipo' }, { que: 'Algo', quien: 'mauricio' }, null, 'texto suelto',
  ]), [
    { que: 'Mandar el PAS', quien: 'cliente' }, { que: 'Revisar su tablero', quien: 'equipo' }, { que: 'Algo', quien: null },
  ]);
  assert.deepEqual(pasosDeGrabacion(null), []);
  assert.deepEqual(pasosDeGrabacion({ que: 'no es lista' }), []);
  // Dos grabaciones de la misma junta (se cortó la llamada): un paso repetido sale una vez.
  const c = compromisosDeGrabaciones([grab('2026-10-07T16:40:00Z', 'Mandar el PAS'), G_10]);
  assert.deepEqual(c, { estado: 'leida', pasos: [{ que: 'Mandar el PAS', quien: 'cliente' }] });
  assert.deepEqual(compromisosDeGrabaciones([]), { estado: 'sin-grabacion' });
});

const C_LEIDA: CompromisosJunta = { estado: 'leida', pasos: [
  { que: 'Mandar el PAS', quien: 'cliente' }, { que: 'Revisar su tablero', quien: 'equipo' }, { que: 'Agendar la próxima', quien: null },
] };
const TEXTOS_JUNTA = [
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: ['Tu meta'], noLlego: null, compromisos: C_LEIDA }),
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: [], noLlego: NO_TENIA_PENDIENTES, compromisos: C_LEIDA }),
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: ['Tu meta'], noLlego: null, compromisos: { estado: 'sin-grabacion' } }),
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: ['Tu meta'], noLlego: 'sin teléfono', compromisos: { estado: 'error' } }),
  textoPosteriorDueno({ cliente: 'Ana Ruiz', etapa: 'Norte', pendientes: ['Tu meta'], noLlego: null, compromisos: { estado: 'leida', pasos: [] } }),
];

test('a Mauricio: los compromisos de la junta, con quién los tiene; y si no hay grabación, lo dice', () => {
  assert.match(TEXTOS_JUNTA[0], /Ya le mandé sus pendientes\.\nDe la junta:\n· Cliente: Mandar el PAS\n· Equipo: Revisar su tablero\n· Agendar la próxima$/);
  assert.match(TEXTOS_JUNTA[1], /va al día con \*Norte\*\.\nNo le escribí: no tenía pendientes\.\nDe la junta:\n/);
  assert.match(TEXTOS_JUNTA[2], /\nSin grabación analizada todavía\.$/, 'sin grabación el aviso sale igual y lo dice en una frase');
  assert.match(TEXTOS_JUNTA[3], /\nNo pude leer la grabación\.$/, '«no pude leer» y «no hay» se dicen distinto');
  assert.match(TEXTOS_JUNTA[4], /\nLa grabación no dejó próximos pasos\.$/);
  // Sin el dato (el previo, o un llamador viejo) no se agrega nada.
  assert.doesNotMatch(textoPosteriorDueno({ cliente: 'Ana', etapa: 'Norte', pendientes: ['x'], noLlego: null }), /junta|grabación/);
  // El tope: los que no entran van como «y N más».
  const muchos = textoPosteriorDueno({ cliente: 'Ana', etapa: 'Norte', pendientes: ['x'], noLlego: null,
    compromisos: { estado: 'leida', pasos: Array.from({ length: TOPE_COMPROMISOS + 2 }, (_, i) => ({ que: `Paso ${i}`, quien: 'equipo' as const })) } });
  assert.match(muchos, /· y 2 más$/);
  for (const t of TEXTOS_JUNTA) assert.deepEqual(voseo(t), [], `voseo en: ${t}`);
});

test('los compromisos NUNCA viajan al cliente', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const cuerpo = src.slice(src.indexOf('async function procesarSesion'), src.indexOf('async function procesarWorkspace'));
  const iCli = cuerpo.indexOf('textoPosteriorCliente(');
  const llamada = cuerpo.slice(iCli, cuerpo.indexOf(')', cuerpo.indexOf('}', iCli)));
  assert.ok(iCli > 0, 'no encontré el texto al cliente');
  assert.doesNotMatch(llamada, /compromisos/, 'los compromisos los redactó un modelo: van SÓLO al dueño');
  const fn = leer('lib/curso-mensajes-texto.ts');
  const firma = fn.slice(fn.indexOf('export function textoPosteriorCliente('), fn.indexOf('): string | null {', fn.indexOf('export function textoPosteriorCliente(')));
  assert.doesNotMatch(firma, /compromisos/, 'el texto del cliente no tiene por dónde recibirlos');
  // Y la lectura de la grabación es la del contrato: mismo lead, entrega, versión 3 en adelante.
  assert.match(src, /\.eq\('lead_id', f\.lead_id\)\.eq\('category', 'entrega_servicio'\)\.gte\('analysis_version', 3\)/);
  assert.match(src, /grabacionesDeLaSesion\(\{ id: f\.id, fecha: f\.fecha \}, sesiones, grabaciones\)/);
});

test('sin pendientes, el posterior le llega a Mauricio SÓLO si la junta dejó compromisos', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const ini = src.indexOf("if (fase === 'posterior' && !c.pendientes?.length) {");
  const rama = src.slice(ini, src.indexOf('return;', ini));
  assert.ok(ini > 0, 'falta la rama del posterior sin pendientes');
  assert.match(rama, /if \(compromisos\?\.estado === 'leida' && compromisos\.pasos\.length\) await avisarAlDueno\(/);
  // Y nunca al cliente: en esa rama no hay envío.
  assert.doesNotMatch(rama, /mandar\(/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026, la tanda del dedup, el reintento y la junta). Baseline del
// archivo: 31 pass / 0 fail. Cada rotura de a una, restaurada de memoria en un `finally`:
//   1. la `dedupKey` vieja (`sesion:<id>`) en el aviso → 30/1: «usa la clave POR RESULTADO».
//   2. `claveAvisoSesion` sin el resultado → 29/2: el apagado que se come al corregido, y «sin teléfono».
//   3. `claveAvisoSesion` sin los compromisos → 30/1.
//   4. marcar ANTES de leer el destino (el orden viejo) → 30/1: «el cron mira el destino ANTES…».
//   5. la rama de «sin teléfono» llamando a `marcar()` → 30/1: el mismo.
//   6. cada grabación a TODAS las sesiones con ella en su ventana (sin «la más cercana») → 29/2:
//      «dos sesiones del mismo lead» y «la sesión que no se grabó…».
//   7. la ventana de después en 8 h → 30/1: «la sesión que no se grabó…» (la de +6,5 h entra).
//   8. `quien` sin sanear → 30/1.   9. los pasos repetidos sin juntar → 30/1.
//   10. los compromisos pasados al texto del CLIENTE → 30/1: «NUNCA viajan al cliente».
//   11. «Sin grabación analizada» que no se dice → 30/1.
//   12. el posterior sin pendientes avisando siempre → 30/1.
//   13. la lectura con `analysis_version` 2 → 30/1: «NUNCA viajan al cliente» (fija también la consulta).

// ── La JUNTA se marca APARTE: la grabación que llega TARDE (revisión del grupo, 06/10/2026) ──
// Los compromisos se leían una sola vez, en la corrida que abre el posterior, y la sesión se
// marcaba ahí mismo. La grabación de una sesión de entrega entra por closing-sync («30 14-23 * *
// *» UTC) y después espera su análisis: una sesión de las 16:30 de CDMX terminaba después del
// último sync del día, el posterior salía «sin grabación» y los compromisos no llegaban nunca.

const FECHA_TARDE = '2026-10-06T22:30:00Z';   // 16:30 CDMX: termina después del último sync
const SES_TARDE = { id: 40, fecha: FECHA_TARDE };
const G_TARDE = grab('2026-10-06T22:33:00Z', 'Mandar el PAS');
const en = (horas: number) => new Date(Date.parse(FECHA_TARDE) + horas * H);

test('la junta sigue ABIERTA después del posterior, mientras dure la ventana, y sólo si el posterior ya salió', () => {
  const s = (marcas: { q?: string | null; j?: string | null }) => ({ fecha: FECHA_TARDE, avisoPosteriorAt: marcas.q ?? null, avisoJuntaAt: marcas.j ?? null });
  assert.equal(juntaPendiente(s({ q: 'x' }), en(3)), true, 'posterior avisado, junta abierta: se vuelve a mirar');
  assert.equal(juntaPendiente(s({ q: 'x' }), en(47)), true);
  assert.equal(juntaPendiente(s({ q: 'x' }), en(49)), false, 'pasada la ventana del posterior no se espera más');
  assert.equal(juntaPendiente(s({ q: 'x', j: 'y' }), en(3)), false, 'la junta ya resuelta no se vuelve a avisar');
  assert.equal(juntaPendiente(s({}), en(3)), false, 'mientras el posterior no sale, su propio aviso lleva la junta');
  assert.equal(juntaPendiente({ fecha: 'no es fecha', avisoPosteriorAt: 'x', avisoJuntaAt: null }, en(3)), false);
});

test('sólo una grabación LEÍDA cierra la junta: «sin grabación» y «no pude leer» la dejan abierta', () => {
  assert.equal(juntaResuelta({ estado: 'leida', pasos: [{ que: 'x', quien: null }] }), true);
  assert.equal(juntaResuelta({ estado: 'leida', pasos: [] }), true, 'se analizó y no dejó pasos también es una respuesta');
  assert.equal(juntaResuelta({ estado: 'sin-grabacion' }), false);
  assert.equal(juntaResuelta({ estado: 'error' }), false);
  assert.equal(juntaResuelta(null), false);
});

test('una grabación que aparece DESPUÉS de la primera corrida le llega a Mauricio en la siguiente', () => {
  const sale = despachador();
  let marcas = { avisoPosteriorAt: null as string | null, avisoJuntaAt: null as string | null };
  // Corrida 1 (00:25 UTC, +2 h): toca el posterior, la grabación todavía no está.
  assert.equal(faseDeSesion({ fecha: FECHA_TARDE, avisoPrevioAt: 'x', avisoPosteriorAt: null }, en(2.1)), 'posterior');
  const c1 = compromisosDeGrabaciones(grabacionesDeLaSesion(SES_TARDE, [SES_TARDE], []));
  assert.equal(sale(claveAvisoSesion(SES_TARDE.id, null, c1)), true, 'el posterior sale (sin junta)');
  assert.match(textoPosteriorDueno({ cliente: 'Ana', etapa: 'Norte', pendientes: ['x'], noLlego: null, compromisos: c1 }), /Sin grabación analizada todavía\.$/);
  marcas = { avisoPosteriorAt: 'marcado', avisoJuntaAt: juntaResuelta(c1) ? 'marcado' : null };
  // Corrida 2 (14:25 UTC del día siguiente, +16 h): el sync ya la trajo y está analizada.
  assert.equal(faseDeSesion({ fecha: FECHA_TARDE, avisoPrevioAt: 'x', avisoPosteriorAt: marcas.avisoPosteriorAt }, en(16)), null);
  assert.equal(juntaPendiente({ fecha: FECHA_TARDE, ...marcas }, en(16)), true, 'la junta quedó abierta: esta corrida la vuelve a buscar');
  const c2 = compromisosDeGrabaciones(grabacionesDeLaSesion(SES_TARDE, [SES_TARDE], [G_TARDE]));
  assert.ok(juntaResuelta(c2) && c2.pasos.length === 1);
  assert.equal(sale(claveAvisoJunta(SES_TARDE.id)), true, 'el posterior que salió sin junta no la deduplica');
  assert.match(textoJuntaDueno({ cliente: 'Ana Ruiz', pasos: juntaResuelta(c2) ? c2.pasos : [] }), /^De la sesión con \*Ana Ruiz\*:\n· Cliente: Mandar el PAS$/);
  marcas = { ...marcas, avisoJuntaAt: 'marcado' };
  // Corrida 3: ya no hay nada que hacer con esta sesión.
  assert.equal(juntaPendiente({ fecha: FECHA_TARDE, ...marcas }, en(17)), false);
  assert.equal(sale(claveAvisoJunta(SES_TARDE.id)), false, 'y si dos corridas pisan, la red del dedup la frena');
});

test('la clave de la junta tardía no choca con ninguna del posterior', () => {
  const leida: CompromisosJunta = { estado: 'leida', pasos: [{ que: 'x', quien: null }] };
  for (const noLlego of [null, 'sin teléfono', 'envío de WhatsApp apagado', NO_TENIA_PENDIENTES]) {
    for (const c of [null, leida, { estado: 'sin-grabacion' } as CompromisosJunta]) {
      assert.notEqual(claveAvisoJunta(7), claveAvisoSesion(7, noLlego, c));
    }
  }
  assert.notEqual(claveAvisoJunta(7), claveAvisoJunta(8));
});

test('el aviso de la junta tardía: corto, sin voseo, sin el link del cliente, con el tope de siempre', () => {
  const t = textoJuntaDueno({ cliente: 'Ana Ruiz', pasos: C_LEIDA.estado === 'leida' ? C_LEIDA.pasos : [] });
  assert.equal(t, 'De la sesión con *Ana Ruiz*:\n· Cliente: Mandar el PAS\n· Equipo: Revisar su tablero\n· Agendar la próxima');
  assert.equal(tituloAvisoJunta('Ana Ruiz'), 'Junta con Ana Ruiz');
  const muchos = textoJuntaDueno({ cliente: 'Ana', pasos: Array.from({ length: TOPE_COMPROMISOS + 1 }, (_, i) => ({ que: `Paso ${i}`, quien: 'equipo' as const })) });
  assert.match(muchos, /· y 1 más$/);
  for (const x of [t, tituloAvisoJunta('Ana Ruiz'), muchos]) {
    assert.deepEqual(voseo(x), [], `voseo en: ${x}`);
    assert.ok(!x.includes(LINK));
  }
});

test('el cron: la marca del posterior cierra la junta SÓLO con la grabación leída, y la junta abierta se reintenta', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const cuerpo = src.slice(src.indexOf('async function procesarSesion'), src.indexOf('async function procesarWorkspace'));
  const iMarcar = cuerpo.indexOf('const marcar');
  const marcar = cuerpo.slice(iMarcar, cuerpo.indexOf('};', iMarcar));
  assert.match(marcar, /cierraJunta && fase === 'posterior' && ctx\.conJunta \? \{ aviso_junta_at: ahora \} : \{\}/,
    'la junta se escribe con el posterior sólo cuando el aviso de ahora la lleva');
  // Las dos ramas que marcan el posterior le pasan si la junta quedó resuelta (no `true` a ciegas).
  assert.match(cuerpo, /if \(await marcar\(juntaResuelta\(compromisos\)\)\) \{/, 'el posterior sin pendientes');
  assert.match(cuerpo, /if \(!\(await marcar\(juntaResuelta\(compromisos\)\)\)\) return;/, 'el posterior con envío');
  // El cron trae la junta abierta y la manda a procesarJunta.
  const correr = src.slice(src.indexOf('export async function correrAvisosDeSesiones'));
  assert.match(correr, /'aviso_previo_at\.is\.null,aviso_posterior_at\.is\.null,aviso_junta_at\.is\.null'/);
  assert.match(correr, /juntaPendiente\(\{ fecha: f\.fecha, avisoPosteriorAt: f\.aviso_posterior_at, avisoJuntaAt: f\.aviso_junta_at \?\? null \}, ahora\)/);
  assert.match(src, /if \(paso === 'junta'\) await procesarJunta\(ctx, f\);/);
});

test('sin la mig 0210 el cron NO se cae: lee con las columnas viejas y la junta no se escribe', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const correr = src.slice(src.indexOf('export async function correrAvisosDeSesiones'));
  assert.match(correr, /if \(error && faltaLaMarcaDeJunta\(error\)\) \{[\s\S]*?leerSesiones\(COLS_SESION_SIN_JUNTA, 'aviso_previo_at\.is\.null,aviso_posterior_at\.is\.null'\)/,
    'una columna que falta rechaza la consulta entera: sin respaldo, nadie recibe ni el previo ni el posterior');
  assert.match(correr, /const conJunta = !res\.sinMarcaDeJunta;/);
  assert.match(correr, /conJunta && juntaPendiente\(/, 'sin la columna no hay junta que reintentar');
  const mig = leer('supabase/migrations/0210_curso_sesion_junta.sql');
  assert.match(mig, /add column if not exists aviso_junta_at timestamptz;/);
  assert.match(mig, /ORDEN DE DESPLIEGUE/);
});

test('la junta tardía: compare-and-set ANTES de avisar, sólo a Mauricio, y sin grabación NO marca', () => {
  const src = sinComentarios(leer('lib/curso-mensajes.ts'));
  const ini = src.indexOf('async function procesarJunta');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(ini > 0, 'falta procesarJunta');
  const iEspera = cuerpo.indexOf('if (!juntaResuelta(compromisos)) {');
  const iCas = cuerpo.indexOf(".is('aviso_junta_at', null)");
  const iAviso = cuerpo.indexOf('emitirAviso(');
  assert.ok(iEspera > 0 && iCas > iEspera && iAviso > iCas, 'primero se mira la grabación, después se marca, después se avisa');
  assert.doesNotMatch(cuerpo.slice(iEspera, cuerpo.indexOf('}', iEspera)), /update\(/, 'sin grabación no se marca: la próxima corrida vuelve a mirar');
  assert.match(cuerpo, /dedupKey: claveAvisoJunta\(f\.id\)/);
  assert.match(cuerpo, /tipo: TIPO_AVISO\.posterior/, 'el mismo interruptor que el posterior');
  assert.doesNotMatch(cuerpo, /mandar\(|textoPosteriorCliente|destinoDe\(/, 'los compromisos NUNCA viajan al cliente');
});

// PROBADO ROMPIÉNDOLO (06/10/2026, la junta aparte). Baseline del archivo: 39 pass / 0 fail. Cada
// rotura de a una, restaurada de memoria en un `finally` (md5 de los cuatro fuentes igual antes y
// después):
//   1. `juntaPendiente` sin mirar `avisoJuntaAt` → 37/2: «sigue ABIERTA…» y «aparece DESPUÉS…».
//   2. `juntaPendiente` sin esperar al posterior → 38/1: «sigue ABIERTA…».
//   3. la ventana de la junta 24 h más larga que la del posterior → 37/2: «la lectura del cron
//      cubre TODA sesión…» (la lectura no la trae) y «sigue ABIERTA…».
//   4. `juntaResuelta` con cualquier estado → 37/2: «sólo una grabación LEÍDA…» y «aparece DESPUÉS…».
//   5. `claveAvisoJunta` igual a la del posterior sin junta → 37/2: el dedup se la come.
//   6. «Sin grabación analizada.» sin «todavía» → 37/2.
//   7. el posterior cerrando la junta SIEMPRE (`marcar(true)`, lo de antes) → 36/3.
//   8. la lectura del cron sin `aviso_junta_at.is.null` → 38/1.
//   9. sin el respaldo de la columna faltante → 38/1: «sin la mig 0210 el cron NO se cae».
//   10. `procesarJunta` sin compare-and-set → 38/1.   11. `procesarJunta` leyendo el destino del
//       cliente → 38/1.   12. el cron sin despachar `'junta'` → 38/1.
