// =============================================================================
// «✦ Armar» y «✦ Otro con MaKo» de un AI Step, y las piezas puras de su editor (undécima tanda, w2-aistep-editor)
// =============================================================================
// Martín (11/10/2026, puntos 11-13): UN AI Step por objetivo con sus escenarios adentro; «No pongas tanto input de texto
// en AI Step... solo el primero donde le pides a la IA o grabas audio... El resto con desplegables»; «Libertad» es un
// desplegable de tres y «Lo demás», de dos. El diseño, en docs/diseno-undecima-tanda.md §2 y §6.
//
// Lo que se EJECUTA acá (todo puro, lib/ai-step-armar.ts):
//   · `repararArmado`, la segunda capa del armado (AGENTS.md: «una regla en un prompt no es una regla»): títulos únicos
//     (contra los que ya están en «✦ Otro con MaKo», y entre sí), «cuándo» obligatorio, sin respuesta → «Sólo te
//     avisa», plata → nunca «Sola», «Lo demás» nunca «Sola», tope 10 (y 1 con «✦ Otro con MaKo»);
//   · lo que el editor escribe con eso: `casosDelArmado`, `conEscenario` (antes de «Lo demás»), `conLoDemas`
//     («Sólo te avisa» = sin el caso; «Para aprobar» = el caso `cualquiera` con la guía de MaKo), el catálogo sin los
//     que ya están, y los ids que no chocan. Lo armado PUBLICA (con objetivo): `validarGrafo` no frena nada;
//   · el pedido (objetivo, negocio, los que ya están, los nombres del catálogo) y la ruta (`existentes` sólo en 'uno').
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  repararArmado, pedidoDeArmado, casosDelArmado, casoDeArmado, conEscenario, sinEscenario, conLoDemas, libertadDeLoDemas,
  conLibertadDe, generadorDeIds, escenariosParaSumar, distintivoDeTipico, libertadPosible, nombresDelCatalogo,
  ARMAR_AI_STEP_SYSTEM_TEMPLATE, GUIA_LO_DEMAS, TOPE_CUANDO, type ArmadoAIStep,
} from '../lib/ai-step-armar';
import {
  type PasoGrafo, type CasoRespuesta,
  validarGrafo, normalizar, nodoPorId, escenariosDeRespuesta, TOPE_ESCENARIOS_AI_STEP, TOPE_TITULO_CASO, TOPE_RESPONDER, ROTULO_LO_DEMAS,
} from '../lib/flujo-grafo';
import { libertadDeCaso } from '../lib/ai-step-libertad';
import { ESCENARIOS_TIPICOS, escenarioPorId } from '../lib/ai-step-escenarios';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const rndDe = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };
const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const esc = (titulo: string, o: Record<string, unknown> = {}) => ({ titulo, cuando: `cuando ${titulo}`, responder: `Responde ${titulo}`, libertad: 'aprueba', ...o });
/** Un flujo con su salida (m1) y el AI Step R con los casos que se le pasen. */
const conIA = (casos: CasoRespuesta[], o: Partial<PasoGrafo> = {}): PasoGrafo[] => [
  msg({ id: 'm1', siguiente: null }),
  { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, casos, si_no: null, objetivo: 'Que agende una llamada', ...o },
];

// ── repararArmado ────────────────────────────────────────────────────────────────

test('repararArmado: títulos ÚNICOS (entre sí, contra los que ya están y nunca «Lo demás»): el repetido se DESCARTA', () => {
  const a = repararArmado({
    escenarios: [esc('Pregunta el precio'), esc('pregunta  el PRECIO'), esc('Confirma', { libertad: 'sola' }), esc('Lo demás'), esc('Quiere cambiar el día')],
    lo_demas: 'avisa',
  });
  assert.ok(a);
  assert.deepEqual(a.escenarios.map((e) => e.titulo), ['Pregunta el precio', 'Confirma', 'Quiere cambiar el día']);
  // «✦ Otro con MaKo»: el que ya está no vuelve (ni con otras mayúsculas), y sale UNO.
  const uno = repararArmado({ escenarios: [esc('Confirma'), esc('No le interesa'), esc('Quiere agendar')] }, { existentes: ['confirma'], modo: 'uno' });
  assert.deepEqual(uno?.escenarios.map((e) => e.titulo), ['No le interesa']);
  // Con «✦ Armar» lo que ya está NO se descarta: lo armado lo reemplaza (la pantalla pregunta «¿Reemplazo?»).
  assert.deepEqual(repararArmado({ escenarios: [esc('Confirma')] }, { modo: 'todo' })?.escenarios.map((e) => e.titulo), ['Confirma']);
});

test('repararArmado: «cuándo» obligatorio, sin nombre no sirve, y sin nada que sirva devuelve null', () => {
  const a = repararArmado({ escenarios: [esc('Sin cuándo', { cuando: '  ' }), esc('', {}), esc('Bueno')] });
  assert.deepEqual(a?.escenarios.map((e) => e.titulo), ['Bueno']);
  assert.equal(repararArmado({ escenarios: [esc('Sin cuándo', { cuando: '' })] }), null);
  assert.equal(repararArmado({ escenarios: 'no es una lista' }), null);
  assert.equal(repararArmado({}), null);
});

test('repararArmado: sin respuesta → «Sólo te avisa»; con PLATA nunca «Sola» (baja a «Para aprobar»); lo desconocido → «Para aprobar»', () => {
  const a = repararArmado({
    escenarios: [
      esc('Pregunta el precio', { cuando: 'pregunta cuánto cuesta', responder: 'Dile que lo ven en la llamada', libertad: 'sola' }),
      esc('Formas de pago', { cuando: 'pregunta cómo pagar', responder: 'Dile que se lo confirmas', libertad: 'sola' }),
      esc('Confirma', { cuando: 'dice que sí', responder: 'Agradece', libertad: 'sola' }),
      esc('Se queja', { responder: '', libertad: 'sola' }),
      esc('Rara', { libertad: 'cualquier cosa' }),
    ],
  });
  assert.deepEqual(a?.escenarios.map((e) => [e.titulo, e.libertad]), [
    ['Pregunta el precio', 'aprueba'], ['Formas de pago', 'aprueba'], ['Confirma', 'sola'], ['Se queja', 'avisa'], ['Rara', 'aprueba'],
  ]);
  // La misma regla que el desplegable y Publicar (`libertadesPermitidas`): `libertadPosible`.
  assert.equal(libertadPosible({ titulo: 'Descuento', cuando: 'pide un descuento', responder: 'Lo vemos' }, 'sola'), 'aprueba');
  assert.equal(libertadPosible({ titulo: 'x', cuando: 'y', responder: '' }, 'aprueba'), 'avisa');
});

test('repararArmado: «Lo demás» nunca «Sola» (baja a «Para aprobar»), y el default es «Sólo te avisa»', () => {
  const lo = (v: unknown) => repararArmado({ escenarios: [esc('Confirma')], lo_demas: v })?.lo_demas;
  assert.equal(lo('sola'), 'aprueba');
  assert.equal(lo('aprueba'), 'aprueba');
  assert.equal(lo('avisa'), 'avisa');
  assert.equal(lo(undefined), 'avisa');
});

test('repararArmado: tope de 10 escenarios (1 con «✦ Otro con MaKo», y ninguno si ya hay 10) y los topes de cada texto', () => {
  const doce = Array.from({ length: 12 }, (_, i) => esc(`Escenario ${i + 1}`));
  assert.equal(repararArmado({ escenarios: doce })?.escenarios.length, TOPE_ESCENARIOS_AI_STEP);
  assert.equal(repararArmado({ escenarios: doce }, { modo: 'uno' })?.escenarios.length, 1);
  const diez = Array.from({ length: 10 }, (_, i) => `Ya ${i}`);
  assert.equal(repararArmado({ escenarios: [esc('Otro')] }, { existentes: diez, modo: 'uno' }), null);
  const largo = repararArmado({ escenarios: [esc('t'.repeat(80), { cuando: 'c'.repeat(900), responder: 'r'.repeat(TOPE_RESPONDER + 50) })] })!.escenarios[0];
  assert.equal(largo.titulo.length, TOPE_TITULO_CASO);
  assert.equal(largo.cuando.length, TOPE_CUANDO);
  assert.equal(largo.responder.length, TOPE_RESPONDER);
});

// ── Lo que el editor escribe ─────────────────────────────────────────────────────

const ARMADO: ArmadoAIStep = {
  escenarios: [
    { titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece en una línea', libertad: 'sola' },
    { titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta', responder: 'Se ve en la reunión', libertad: 'aprueba' },
    { titulo: 'Se queja', cuando: 'está molesto', responder: '', libertad: 'avisa' },
  ],
  lo_demas: 'aprueba',
};

test('casosDelArmado: ids nuevos, la libertad escrita por `camposDeLibertad`, «Lo demás» al final con la guía de MaKo, y PUBLICA', () => {
  const casos = casosDelArmado(ARMADO, generadorDeIds(conIA([]), rndDe()));
  assert.equal(new Set(casos.map((c) => c.id)).size, casos.length, 'ids repetidos');
  assert.ok(casos.every((c) => /^[A-Za-z0-9_-]+$/.test(c.id)), 'un id que el saneo no acepta');
  assert.deepEqual(casos.map((c) => ({ t: c.titulo, l: libertadDeCaso(c), sola: c.sola, nc: c.no_contesta, cq: c.cualquiera })), [
    { t: 'Confirma', l: 'sola', sola: true, nc: undefined, cq: undefined },
    { t: 'Pregunta el precio', l: 'aprueba', sola: undefined, nc: undefined, cq: undefined },
    { t: 'Se queja', l: 'avisa', sola: undefined, nc: true, cq: undefined },
    { t: ROTULO_LO_DEMAS, l: 'aprueba', sola: undefined, nc: undefined, cq: true },
  ]);
  assert.equal(casos.at(-1)!.responder, GUIA_LO_DEMAS);
  // Con el objetivo, la tarjeta armada se publica tal cual; y lo que ve el clasificador son los tres escenarios.
  const pasos = normalizar(conIA(casos));
  assert.deepEqual(validarGrafo(pasos), []);
  assert.deepEqual(escenariosDeRespuesta(pasos).map((e) => e.titulo), ['Confirma', 'Pregunta el precio', 'Se queja']);
  // «Lo demás: Sólo te avisa» es SIN el caso.
  assert.ok(!casosDelArmado({ ...ARMADO, lo_demas: 'avisa' }, generadorDeIds([], rndDe())).some((c) => c.cualquiera));
  // Un armado con una libertad que no puede tener (llegó por fuera de `repararArmado`) se escribe con la que sí.
  assert.equal(libertadDeCaso(casoDeArmado({ titulo: 'Precio', cuando: 'cuánto cuesta', responder: 'En la llamada', libertad: 'sola' }, 'x1')), 'aprueba');
});

test('sumar, quitar y cambiar la libertad: antes de «Lo demás», y sólo lo que el escenario puede tener', () => {
  const base = casosDelArmado(ARMADO, generadorDeIds([], rndDe()));
  const nuevo: CasoRespuesta = { id: 'nuevo', titulo: 'No puede ahora', cuando: 'no tiene tiempo', siguiente: null, responder: 'Dile que no hay apuro', sola: true };
  const mas = conEscenario(base, nuevo);
  assert.deepEqual(mas.map((c) => c.titulo), ['Confirma', 'Pregunta el precio', 'Se queja', 'No puede ahora', ROTULO_LO_DEMAS]);
  assert.deepEqual(conEscenario(base.filter((c) => !c.cualquiera), nuevo).at(-1)!.id, 'nuevo');
  assert.deepEqual(sinEscenario(mas, 'nuevo').map((c) => c.titulo), base.map((c) => c.titulo));
  const precio = base[1].id;
  assert.equal(conLibertadDe(base, precio, 'sola'), base, 'la plata salió sola');
  assert.equal(libertadDeCaso(conLibertadDe(base, precio, 'avisa').find((c) => c.id === precio)), 'avisa');
  // «Sólo te avisa» CONSERVA lo que contestaba (vuelve a contestar igual).
  const ida = conLibertadDe(base, precio, 'avisa');
  assert.equal(ida.find((c) => c.id === precio)!.responder, 'Se ve en la reunión');
  assert.equal(libertadDeCaso(conLibertadDe(ida, precio, 'aprueba').find((c) => c.id === precio)), 'aprueba');
});

test('«Lo demás»: «Sólo te avisa» = sin el caso; «Para aprobar» = el caso `cualquiera` con su respuesta o la guía de MaKo; nunca «Sola»', () => {
  const sin = conLoDemas([{ id: 'a', titulo: 'A', cuando: 'x', siguiente: null, responder: 'r' }], 'aprueba', 'ld');
  assert.equal(libertadDeLoDemas(sin), 'aprueba');
  assert.deepEqual(sin.at(-1), { id: 'ld', titulo: ROTULO_LO_DEMAS, cuando: '', siguiente: null, cualquiera: true, responder: GUIA_LO_DEMAS });
  assert.equal(libertadDeLoDemas(conLoDemas(sin, 'avisa', 'otro')), 'avisa');
  assert.ok(!conLoDemas(sin, 'avisa', 'otro').some((c) => c.cualquiera));
  // Uno de antes que sólo avisaba y guardaba su respuesta: «Para aprobar» la usa (no la pisa con la guía).
  const deAntes = conLoDemas([{ id: 'q', titulo: 'Cualquier respuesta', cuando: '', siguiente: null, cualquiera: true, responder: 'La de antes', no_contesta: true }], 'aprueba', 'nuevo');
  assert.deepEqual(deAntes, [{ id: 'q', titulo: 'Cualquier respuesta', cuando: '', siguiente: null, cualquiera: true, responder: 'La de antes' }]);
  // Nunca «Sola»: ni el tipo lo deja ni Publicar.
  assert.deepEqual(validarGrafo(normalizar(conIA(sin))), []);
  assert.ok(validarGrafo(normalizar(conIA([{ ...sin[1], sola: true }]))).some((e) => e.includes('no puede salir sola')));
});

test('el catálogo para sumar: sin los que ya están (por nombre), y los dos «Pregunta el precio» se distinguen por su respuesta', () => {
  const ya: CasoRespuesta[] = [{ id: 'a', titulo: 'confirma', cuando: 'x', siguiente: null }];
  const ofrecidos = escenariosParaSumar(ya).map((e) => e.id);
  assert.ok(!ofrecidos.includes('confirma'));
  assert.equal(ofrecidos.length, ESCENARIOS_TIPICOS.length - 1);
  // Con «Pregunta el precio» puesto, se van las DOS entradas de ese nombre (dos iguales no se publican).
  const conPrecio = escenariosParaSumar([{ id: 'p', titulo: 'Pregunta el precio', cuando: 'x', siguiente: null }]).map((e) => e.id);
  assert.ok(!conPrecio.includes('precio-llamada') && !conPrecio.includes('precio-reunion'));
  const llamada = distintivoDeTipico(escenarioPorId('precio-llamada')!);
  const reunion = distintivoDeTipico(escenarioPorId('precio-reunion')!);
  assert.ok(llamada && reunion && llamada !== reunion, `«${llamada}» / «${reunion}»`);
  assert.equal(distintivoDeTipico(escenarioPorId('confirma')!), undefined);
});

test('los ids nuevos no chocan con ninguna tarjeta, rama ni caso del flujo, ni entre sí', () => {
  const pasos = conIA([{ id: 'n000001', titulo: 'A', cuando: 'x', siguiente: null }]);
  // Un `rnd` que repite: el generador igual da ids distintos.
  const gen = generadorDeIds(pasos, () => 0);
  const ids = Array.from({ length: 5 }, () => gen());
  assert.equal(new Set(ids).size, 5);
  for (const id of ids) assert.ok(!['m1', 'R', 'n000001'].includes(id) && /^[A-Za-z0-9_-]+$/.test(id), id);
});

// ── El pedido y la ruta ──────────────────────────────────────────────────────────

test('el pedido lleva el objetivo, los escenarios que ya están, los nombres del catálogo y qué se pide; el prompt, el contrato y de TÚ', () => {
  const todo = pedidoDeArmado({ objetivo: 'Que agende una llamada', perfil: 'Una academia', modo: 'todo', yaEstan: [{ titulo: 'Confirma', cuando: 'dice que sí' }] });
  assert.match(todo, /<objetivo>Que agende una llamada<\/objetivo>/);
  assert.match(todo, /<negocio>Una academia<\/negocio>/);
  assert.match(todo, /ESCENARIOS QUE YA TIENE \(los reemplazas: conserva los que sirvan\):\n- «Confirma»: dice que sí/);
  for (const t of nombresDelCatalogo()) assert.ok(todo.includes(`«${t}»`), t);
  assert.match(todo, /PIDE: de 2 a 6 escenarios y "lo_demas"\./);
  const uno = pedidoDeArmado({ objetivo: 'x', modo: 'uno', yaEstan: [{ titulo: 'Confirma' }] });
  assert.match(uno, /ESCENARIOS QUE YA TIENE \(no repitas ninguno\):\n- «Confirma»/);
  assert.match(uno, /PIDE: UN escenario nuevo\./);
  assert.match(ARMAR_AI_STEP_SYSTEM_TEMPLATE, /\{"escenarios":\[\{"titulo":"…","cuando":"…","responder":"…","libertad":"aprueba"\}\],"lo_demas":"avisa"\}/);
  assert.match(ARMAR_AI_STEP_SYSTEM_TEMPLATE, /\{\{medio\}\}/);
  assert.deepEqual(marcasDeVoseo(ARMAR_AI_STEP_SYSTEM_TEMPLATE), []);
  assert.deepEqual(marcasDeVoseo(GUIA_LO_DEMAS), []);
});

test('la ruta: el mismo prompt editable, la reparación como `validar` de la cascada y `existentes` SÓLO con «✦ Otro con MaKo»', () => {
  const ruta = sinComentarios(leer('app/api/automations/ai-step/armar/route.ts'));
  assert.match(ruta, /renderPrompt\('automations\.ai_step\.armar', ARMAR_AI_STEP_SYSTEM_TEMPLATE,/);
  assert.match(ruta, /const existentes = modo === 'uno' \? yaEstan\.map\(\(e\) => e\.titulo\) : \[\];/);
  assert.match(ruta, /validar: \(t\) => \{ try \{ return repararArmado\(parseJsonObject\(t\), \{ existentes, modo \}\) != null; \}/);
  assert.match(ruta, /const armado = repararArmado\(parseJsonObject\(crudo\), \{ existentes, modo \}\);/);
  assert.match(ruta, /provs: CASCADA_DOCS/);
  assert.match(ruta, /rol !== 'admin'/);
  // El editor manda los escenarios que ya están y aplica lo armado por las piezas de acá.
  const editor = sinComentarios(leer('app/automations/EditorPasoIA.tsx'));
  assert.match(editor, /body: JSON\.stringify\(\{ objetivo: obj, medio, modo, escenarios: escenarios\.map\(\(c\) => \(\{ titulo: c\.titulo, cuando: c\.cuando \}\)\) \}\)/);
  assert.match(editor, /setCasos\(casosDelArmado\(a, ids\(\)\)\);/);
  assert.match(editor, /if \(escenarios\.length\) setPropuesta\(a\); else aplicar\(a\);/);
});

// ── ROTURAS (11/10/2026, w2-aistep-editor) ───────────────────────────────────────
// Arnés wf-undecima/w2-aistep-editor/roturas.cjs: rompe UNA pieza por vez con un reemplazo exacto, corre los SEIS
// archivos del paquete (éste, ai-step-ensayo, automations-paso-ia, automations-paso-ia-revision, flujo-ia y
// flujo-ia-arreglos: 100 tests), restaura DE MEMORIA (nunca con git) y verifica byte a byte. Base 100 / 0, al final
// igual. «N / 100» = tests en rojo entre los seis; todas cazadas:
//   A1 `libertadPosible` deja «Sola» con plata (lo pedido gana)          → 2 / 100 (plata nunca sola · casosDelArmado)
//   A2 `repararArmado` no descarta títulos repetidos                      → 1 / 100
//   A3 `repararArmado` acepta un escenario sin «cuándo»                   → 1 / 100
//   A4 «Lo demás» del armado puede salir sola                             → 1 / 100
//   A5 sin el tope de 10                                                  → 1 / 100
//   A6 `conEscenario` suma DESPUÉS de «Lo demás»                          → 1 / 100
//   A7 «Lo demás: Sólo te avisa» deja el caso `cualquiera`                → 1 / 100
//   A8 `conLibertadDe` escribe una libertad que no puede tener            → 2 / 100 (éste y automations-paso-ia)
