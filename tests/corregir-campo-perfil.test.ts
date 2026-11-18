// =============================================================================
// O21 · Que MaKo corrija o recuerde un dato del perfil desde el chat (18/11/2026)
// =============================================================================
// Leila, en la llamada del 27/10/2026: «¿cómo te hago recordar que LíderMente es de 7:30 a 9:30?». Hasta este día MaKo sólo
// tenía `guardar_campo_perfil`, que llena HUECOS («ya tiene valor» se rechazaba), y la frase caía en `consultar` (en una
// pregunta no viajan las que escriben) o, en WhatsApp, en una idea para el Plan. Lo que fija este archivo:
//   1. la forma de `corregir_campo_perfil`: chat (la tarjeta o el «sí»), admin, al final del área, por los tres canales, su ruta
//      REST (PUT), en el snapshot de HTTP y entre las escrituras simples del grupo;
//   2. el runner REAL (tests/_corregir-campo-perfil-hijo.ts): un dato de un documento va a lo manual y gana sobre el documento,
//      uno del wizard va a las answers sin tocar lo manual; el resumen dice lo de antes y lo nuevo; vacío, igual o inexistente
//      se rechazan en preparar; si el dato cambió antes del «sí», la propuesta ya no vale y nada se escribe; «no pude leer» deja
//      la pendiente viva; y de punta a punta por WhatsApp (`ejecutarOperacion` + `confirmarPendiente`);
//   3. el clasificador con el TURNO REAL (`clasificarIntencion` + `herramientasDelTurno` en WhatsApp, `herramientasDelChat` en
//      la app): las frases de corregir o recordar traen `corregir_campo_perfil` y `ver_perfil_negocio`; «recordame…», un
//      pendiente, un lead o una reunión no caen en esta regla.
//
// Probado rompiéndolo (18/11/2026, base 9 de 9 en verde, restaurado de memoria): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REGISTRO, porId, type Vista } from '../lib/api-mako/registro';
import { esAccion, type AccionDef } from '../lib/api-mako/tipos';
import { resolverRest } from '../lib/api-mako/rest';
import { ACCIONES_SIMPLES } from '../lib/despacho-grupo';
import { clasificarIntencion, esDatoDelPerfil } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ── 1. La forma ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('1. la forma: chat, admin, reversible, al final del área negocio, por los tres canales, con su PUT y entre las simples del grupo', () => {
  const d = porId('corregir_campo_perfil');
  assert.ok(d && esAccion(d), 'no está en el registro');
  const a = d as AccionDef;
  assert.equal(a.area, 'negocio');
  assert.equal(a.confirmacion, 'chat', 'la persona ve lo de antes y lo nuevo en la tarjeta (o el «sí» de WhatsApp)');
  assert.equal(a.reversible, true);
  assert.equal(a.gating.rolMinimo, 'admin', 'el perfil del negocio lo cambia un admin, como guardar_campo_perfil');
  assert.equal(a.costo, 'gratis');
  assert.deepEqual([...a.canales].sort(), ['app', 'http', 'whatsapp']);
  assert.deepEqual(a.parametros.map((p) => p.nombre), ['key', 'valor']);
  const delArea = REGISTRO.filter((x) => x.area === 'negocio').map((x) => x.id);
  assert.equal(delArea[delArea.length - 1], 'corregir_campo_perfil', 'una operación nueva va AL FINAL de su área (AGENTS.md)');
  assert.ok(!/perfil|archivero/i.test(a.titulo), 'el título no repite las palabras del área');
  const rest = resolverRest('PUT', ['negocio', 'perfil', 'campos', 'oferta_incluye']);
  assert.deepEqual(rest, { operacion: 'corregir_campo_perfil', params: { key: 'oferta_incluye' } }, 'el PUT no resuelve a la corrección');
  assert.deepEqual(resolverRest('PATCH', ['negocio', 'perfil', 'campos', 'oferta_incluye']), { operacion: 'guardar_campo_perfil', params: { key: 'oferta_incluye' } }, 'el PATCH dejó de ser completar un hueco');
  assert.ok(leer('tests/api-mako-http.snapshot.txt').split('\n').includes('corregir_campo_perfil'), 'el snapshot de HTTP no la tiene');
  assert.ok(ACCIONES_SIMPLES.has('corregir_campo_perfil'), 'en el grupo se delegaría al equipo en vez de proponerla con un «sí»');
});

// ── 2. El runner real ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Prep = { payload?: Record<string, unknown>; resumen?: string; error?: string; yaEstaba?: boolean; falla?: boolean; disponibles?: string[]; faltan?: string[] };
type Ejec = { ok: boolean; resumen: string } | null;
type Salida = {
  documento: { prep: Prep; falta: unknown; ejec: Ejec; manual: Record<string, string>; answers: Record<string, string> };
  wizard: { prep: Prep; ejec: Ejec; manual: Record<string, string>; answers: Record<string, string> };
  rechazos: { vacio: Prep; igual: Prep; mayuscula: boolean; noExiste: Prep; sinValor: Prep; answers: Record<string, string>; manual: Record<string, string> };
  cambio: { falta: unknown; ejec: Ejec; manual: Record<string, string> };
  caida: { falta: unknown; prepCaido: Prep };
  whatsapp: { propuesta: { ok: boolean; tipo?: string }; pendiente: Array<{ tipo: string; estado: string; payload: Record<string, unknown>; resumen: string }>; si: { ok?: boolean; error?: string }; estados: string[]; manual: Record<string, string> };
  red: string[];
};
let salida: Salida | null = null;
const correr = (): Salida => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_corregir-campo-perfil-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  })) as Salida;
  return salida;
};

test('2. un dato que salió de un documento: va a lo manual (gana sobre el documento) y el brief no pierde lo del wizard', () => {
  const { documento: d, red } = correr();
  assert.deepEqual(d.prep.payload, { campo_id: 'oferta_incluye', dato: '¿Qué incluye? (entregables)', antes: 'Clases en vivo los martes', valor: 'Clases en vivo de 7:30 a 9:30' });
  assert.match(String(d.prep.resumen), /hoy dice «Clases en vivo los martes» y queda «Clases en vivo de 7:30 a 9:30»/, 'el resumen no dice lo de antes y lo nuevo');
  assert.equal(d.falta, null);
  assert.equal(d.ejec?.ok, true, JSON.stringify(d.ejec));
  assert.match(String(d.ejec?.resumen), /Antes decía «Clases en vivo los martes»/, 'lo de antes no queda dicho para volver atrás');
  assert.deepEqual(d.manual, { oferta_incluye: 'Clases en vivo de 7:30 a 9:30' });
  assert.equal(d.answers.oferta_incluye, 'Clases en vivo de 7:30 a 9:30');
  assert.equal(d.answers.negocio_objetivo, 'Cerrar 10 clientes', 'el recálculo del brief borró lo que guardó el wizard');
  assert.equal(d.answers.marca_tono, 'Cercano');
  assert.deepEqual(red, [], 'algo salió a la red');
});

test('3. un dato del wizard va directo a las answers, sin pasar por lo manual', () => {
  const { wizard: w } = correr();
  assert.equal(w.ejec?.ok, true, JSON.stringify(w.ejec));
  assert.equal(w.answers.negocio_objetivo, 'Cerrar 20 clientes');
  assert.deepEqual(w.manual, {}, 'lo manual ganaría para siempre en computeEffective y la próxima corrección del wizard se perdería');
  assert.equal(w.answers.oferta_incluye, 'Clases en vivo los martes', 'tocó otro dato');
});

test('4. preparar rechaza un campo vacío (es de guardar_campo_perfil), «ya dice eso», uno que no existe y sin valor; no escribe nada', () => {
  const { rechazos: r } = correr();
  assert.match(String(r.vacio.error), /está vacío[\s\S]*guardar_campo_perfil/);
  assert.equal(r.vacio.payload, undefined);
  assert.equal(r.igual.yaEstaba, true, 'el mismo texto con otros espacios no es una corrección: yaEstaba');
  assert.equal(r.mayuscula, true, 'una mayúscula distinta SÍ es una corrección');
  assert.match(String(r.noExiste.error), /no es un campo del perfil/);
  assert.ok(r.noExiste.disponibles?.includes('oferta_incluye'), 'no devuelve las claves válidas');
  assert.deepEqual(r.sinValor.faltan, ['valor']);
  assert.equal(r.answers.oferta_garantia, undefined, 'la garantía del OTRO negocio se coló en éste');
  assert.deepEqual(r.manual, {});
});

test('5. si el dato cambió antes del «sí», la propuesta ya no vale (se cierra) y ejecutar no escribe', () => {
  const { cambio: c } = correr();
  assert.ok(c.falta && typeof c.falta === 'object' && /cambió desde que lo propuse[\s\S]*Clases grabadas/.test(String((c.falta as { yaNoVale?: string }).yaNoVale)),
    `faltaParaConfirmar no la cerró: ${JSON.stringify(c.falta)}`);
  assert.equal(c.ejec?.ok, false);
  assert.deepEqual(c.manual, { oferta_incluye: 'Clases grabadas' }, 'pisó la corrección que llegó en el medio');
});

test('6. «no pude leer» la base al confirmar deja la pendiente viva (un texto, no un cierre), y preparar no tira', () => {
  const { caida: k } = correr();
  assert.equal(typeof k.falta, 'string', `con la base caída la cerró: ${JSON.stringify(k.falta)}`);
  assert.match(String(k.falta), /No pude leer el perfil/);
  assert.equal(k.prepCaido.falla, true, 'una lectura que no anduvo es una falla nuestra, no una regla');
});

test('7. de punta a punta por WhatsApp: queda pendiente con lo de antes y el «sí» la aplica', () => {
  const { whatsapp: w } = correr();
  assert.equal(w.propuesta.tipo, 'pendiente', JSON.stringify(w.propuesta));
  assert.equal(w.pendiente[0]?.tipo, 'corregir_campo_perfil');
  assert.equal(w.pendiente[0]?.payload.antes, 'Clases en vivo los martes', 'lo que vio la persona no viaja en la pendiente');
  assert.equal(w.si.ok, true, JSON.stringify(w.si));
  assert.deepEqual(w.estados, ['ejecutada']);
  assert.equal(w.manual.oferta_incluye, 'Clases en vivo de 7:30 a 9:30');
});

// ── 3. El clasificador, con el turno real ──────────────────────────────────────────────────────────────────────────────────

function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })) as string[];
}
let deSiempre: Array<{ name: string }> | null = null;
const DE_SIEMPRE = () => (deSiempre ??= nombresDeSiempre().map((name) => ({ name })));
const vistaWa: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
const vistaApp: Vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null };
const turnoWa = (t: string) => {
  const v = clasificarIntencion(t);
  return { v, nombres: herramientasDelTurno({ veredicto: v, texto: t, agendaAbierta: false, deSiempre: DE_SIEMPRE(), vista: vistaWa, hayPendientes: false }).tools.map((x) => x.name) };
};
const turnoApp = (t: string) => {
  const v = clasificarIntencion(t, { canal: 'app' });
  return { v, nombres: herramientasDelChat({ veredicto: v, texto: t, agendaAbierta: false, deSiempre: DE_SIEMPRE(), vista: vistaApp, hayPendientes: false }).tools.map((x) => x.name) };
};

/** Las frases de corregir o recordar, en tuteo y voseo (la de Leila, textual, primero). */
const CORRIGE: readonly string[] = [
  '¿cómo te hago recordar que LíderMente es de 7:30 a 9:30?',
  'cómo te hago recordar que mi programa dura 3 meses',
  'en realidad mi precio es 3000 dólares',
  'corregí mi horario: atiendo de 9 a 18',
  'corrige mi horario: atiendo de 9 a 18',
  'recordá que la garantía es de 30 días',
  'recuerda que la garantía es de 30 días',
  'acordate que mi cliente ideal son dueños de inmobiliarias',
  'acuérdate que mi cliente ideal son dueños de inmobiliarias',
  'quiero que recuerdes que mi oferta se llama Sprint',
  'el precio de mi oferta está mal, es 2000',
  'tené en cuenta que la mentoría incluye 4 llamadas',
];

test('8. las frases de corregir o recordar un dato llegan con corregir_campo_perfil y ver_perfil_negocio, en WhatsApp y en la app', () => {
  const faltan: string[] = [];
  for (const t of CORRIGE) {
    for (const [canal, r] of [['WA', turnoWa(t)], ['app', turnoApp(t)]] as const) {
      if (r.v.intencion !== 'actuar' || !r.nombres.includes('corregir_campo_perfil') || !r.nombres.includes('ver_perfil_negocio')) {
        faltan.push(`${canal} «${t}» → ${r.v.intencion} (${r.v.porque}): corregir ${r.nombres.includes('corregir_campo_perfil')}, ver ${r.nombres.includes('ver_perfil_negocio')}`);
      }
    }
  }
  assert.deepEqual(faltan, []);
});

test('9. lo que no es un dato del perfil no cae en esta regla: «recordame…», un pendiente, un lead, una reunión, una landing', () => {
  const NO: readonly string[] = [
    'recordame llamar a Juan mañana',
    'acordate que tengo que llamar al contador',
    'corregí el teléfono de Juan a 5512345678',
    'en realidad la reunión con Ana es el viernes',
    'recuerda que mañana tengo reunión con Ana',
    'corregí el título de la landing del webinar',
    'en realidad no sé qué hacer',
    'el lead de Ana está mal cargado, corregí su email',
  ];
  const caen = NO.filter((t) => esDatoDelPerfil(norm(t)));
  assert.deepEqual(caen, [], 'el detector toma por un dato del perfil lo que no lo es');
  for (const t of NO) {
    for (const r of [turnoWa(t), turnoApp(t)]) assert.notEqual(r.v.porque, 'corrige o le pide a MaKo que recuerde un dato del perfil del negocio', `«${t}» → ${r.v.porque}`);
  }
  // Y «recordame» sigue siendo una tarea del Plan, como siempre.
  assert.equal(turnoWa('recordame llamar a Juan mañana').v.intencion, 'capturar');
});

// PROBADO ROMPIÉNDOLO (18/11/2026, base 9 de 9 en verde, una rotura por vez, restaurado de memoria):
//   · corregir_campo_perfil fuera de ACCIONES_SIMPLES                                                    → 1 fallo (el 1)
//   · corregirCampoPerfil que manda TODO a lo manual (sin la puerta del wizard)                          → 1 fallo (el 3)
//   · corregirCampoPerfil con saveAnswers(computeEffective(...)) en vez de persistirBrief                → 1 fallo (el 2)
//   · faltaParaConfirmar que no compara con `antes` (devuelve null)                                      → 1 fallo (el 5)
//   · corregirCampoPerfil sin el compare-and-set                                                         → 1 fallo (el 5)
//   · faltaParaConfirmar sin el try (la lectura caída tira: el hijo revienta)                            → 6 fallos (del 2 al 7)
//   · preparar que acepta un campo vacío                                                                → 1 fallo (el 4)
//   · la rama `esDatoDelPerfil` sacada de clasificarIntencion                                            → 1 fallo (el 8)
//   · NO_ES_DEL_PERFIL vacío (el pendiente y la reunión caen en la regla)                                → 1 fallo (el 9)
// Y en tests/clase-del-grupo.test.ts (el 12, la entrada real del grupo): sin la simple → 1 fallo; sin la rama → 1 fallo.
