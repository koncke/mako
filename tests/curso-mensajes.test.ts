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
} from '../lib/curso-mensajes-texto';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
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
    if (!faseDeSesion({ fecha, avisoPrevioAt: null, avisoPosteriorAt: null }, AHORA)) continue;
    assert.ok(fecha >= desde && fecha <= hasta, `la sesión a ${h} h tiene mensaje y la lectura no la trae`);
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
  const iCas = cuerpo.indexOf('if (!(await marcar())) return;');
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
  assert.equal((src.match(/getSupabaseServer\(\)/g) ?? []).length, 1, 'una sola lectura cruzada');
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
