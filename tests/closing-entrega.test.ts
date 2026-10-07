// =============================================================================
// Las sesiones de ENTREGA se analizan en vez de tirarse (#107)
// =============================================================================
// El Closing Analyst guardaba cada sesión con un cliente que ya compró como
// `status = 'descartada'`, sin transcript o con 1-2 frases. Ahora `lib/closing-entrega.ts`
// la lee con IA gratis y deja resumen, riesgos y próximos pasos en la misma fila.
//
// Tres cosas que este archivo fija, y cada una tiene su porqué caro:
//   1. EL SANEO (se EJECUTA): enums, topes, arrays y la cita verificada contra la
//      grabación. Es lo único que garantiza el contrato que otro grupo ya lee.
//   2. EL DRENAJE NUNCA ESCRIBE `status = 'error'`: `syncClosingCalls` re-analiza esas
//      filas con el analista de VENTA, que es Claude Sonnet PAGO.
//   3. EL PROMPT NO NOMBRA A NADIE: corre para todos los clientes.
//   4. EL RELOJ Y LOS FALLOS QUE NO SON DE NADIE: el tope de salida alcanza para pensar y
//      escribir, cada paso tiene su tope (la plataforma corta a los 300 s), y una sesión que
//      falla sin gastar intento baja en la cola en vez de cortar la corrida cada hora.
// Y de rebote: «analizada» dejó de significar «venta», así que todo lector de
// `closing_analyses` que filtre por ese estado tiene que filtrar también la categoría.
//
// Los guards que leen fuente lo hacen SIN comentarios (las líneas primero, los bloques
// después): los archivos explican en prosa lo que no hacen, y un guard sobre la prosa se
// acusa a sí mismo. PROBADO ROMPIÉNDOLO: ver el pie, con los números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  sanearAnalisisEntrega,
  sanearRiesgos,
  sanearPasos,
  parseAnalisisEntrega,
  verificarCitas,
  analisisDeFila,
  ordenarColaEntrega,
  textoFalloEntrega,
  textoSinReintento,
  intentosDe,
  ajenosDe,
  fallosDe,
  esSinReintento,
  esCortePorTope,
  esFalloSeguroDelProveedor,
  jsonCortado,
  conPlazo,
  clasificarFalloFathom,
  gravedadDe,
  quienDe,
  TOPES_ENTREGA,
  VERSION_ENTREGA,
  MAX_INTENTOS_ENTREGA,
  TOPE_AJENOS_ENTREGA,
  MOTIVO_CORTE,
  ENTREGA_SYSTEM_TEMPLATE,
  ENTREGA_USER_TEMPLATE,
  type AnalisisEntrega,
} from '../lib/closing-entrega-contrato';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { CLAUDE_PERMITIDO } from '../lib/veto-claude';
import { llamadasDe } from '../app/customer-success/ficha-datos';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (AGENTS.md: un «/*» adentro de una abre un bloque)
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. El saneo ──────────────────────────────────────────────────────────────

test('una respuesta buena sale con la forma EXACTA del contrato', () => {
  const a = sanearAnalisisEntrega({
    resumen: '  Se revisó el tablero.  Quedó atrasado el pago.  ',
    riesgos: [
      { riesgo: 'Duda del valor', cita: '«no sé si esto me sirve»', t_seconds: '61.4', gravedad: 'Media' },
      { riesgo: 'Quiere cancelar', cita: 'lo voy a pensar', t_seconds: 300, gravedad: 'ALTA' },
    ],
    proximos_pasos: [{ que: 'Mandar el reporte', quien: 'Equipo' }, { que: 'Cargar las ventas', quien: 'cliente' }],
  });
  assert.ok(a);
  assert.equal(a.resumen, 'Se revisó el tablero. Quedó atrasado el pago.');
  // Los más graves primero, las comillas del modelo afuera, el segundo redondeado.
  assert.deepEqual(a.riesgos, [
    { riesgo: 'Quiere cancelar', cita: 'lo voy a pensar', gravedad: 'alta', t_seconds: 300 },
    { riesgo: 'Duda del valor', cita: 'no sé si esto me sirve', gravedad: 'media', t_seconds: 61 },
  ]);
  assert.deepEqual(a.proximos_pasos, [{ que: 'Mandar el reporte', quien: 'equipo' }, { que: 'Cargar las ventas', quien: 'cliente' }]);
});

test('lo que el modelo escribe fuera de los enums se DESCARTA, no lo decide un default', () => {
  // «Cualquier valor nuevo que un modelo pueda escribir en un campo que el código colapsa con
  // un default es una decisión tomada por el default» (AGENTS.md).
  assert.equal(gravedadDe('crítica'), 'alta');
  assert.equal(gravedadDe('low'), 'baja');
  assert.equal(gravedadDe('urgente'), null);
  assert.equal(quienDe('El cliente'), 'cliente');
  assert.equal(quienDe('ambos'), null);
  assert.deepEqual(sanearRiesgos([{ riesgo: 'x', cita: 'y', gravedad: 'urgente' }, { riesgo: '', gravedad: 'alta' }]), []);
  assert.deepEqual(sanearPasos([{ que: 'Llamar', quien: 'ambos' }, { que: '  ', quien: 'cliente' }]), []);
});

test('los topes: cuántos y cuán largos, y el tope va DESPUÉS de ordenar', () => {
  const muchos = Array.from({ length: 8 }, (_, i) => ({ riesgo: `Riesgo ${i}`, cita: '', gravedad: 'baja' }));
  muchos.push({ riesgo: 'El alto que vino noveno', cita: '', gravedad: 'alta' });
  const rs = sanearRiesgos(muchos);
  assert.equal(rs.length, TOPES_ENTREGA.riesgos);
  assert.equal(rs[0].riesgo, 'El alto que vino noveno', 'cortar antes de ordenar perdía justo el grave');
  assert.equal(sanearPasos(Array.from({ length: 9 }, (_, i) => ({ que: `Paso ${i}`, quien: 'equipo' }))).length, TOPES_ENTREGA.pasos);
  const largo = 'palabra '.repeat(400);
  const a = sanearAnalisisEntrega({ resumen: largo, riesgos: [{ riesgo: largo, cita: largo, gravedad: 'media' }], proximos_pasos: [{ que: largo, quien: 'cliente' }] })!;
  assert.ok(a.resumen.length <= TOPES_ENTREGA.resumen && a.resumen.endsWith('…'), 'el resumen se recorta y lo dice');
  assert.ok(a.riesgos[0].riesgo.length <= TOPES_ENTREGA.riesgo);
  assert.ok(a.riesgos[0].cita.length <= TOPES_ENTREGA.cita);
  assert.ok(a.proximos_pasos[0].que.length <= TOPES_ENTREGA.paso);
});

test('los arrays: lo que no es lista es lista vacía, sin repetidos y sin segundos inventados', () => {
  const a = sanearAnalisisEntrega({ resumen: 'ok', riesgos: 'ninguno', proximos_pasos: null })!;
  assert.deepEqual([a.riesgos, a.proximos_pasos], [[], []]);
  const r = sanearRiesgos([
    { riesgo: 'Atraso', cita: '', gravedad: 'media', t_seconds: -4 },
    { riesgo: 'atraso ', cita: '', gravedad: 'alta' },
    null, 7, 'texto',
  ]);
  assert.deepEqual(r, [{ riesgo: 'Atraso', cita: '', gravedad: 'media' }], 'un segundo negativo no se escribe y el repetido se va');
  // Las claves que el modelo escribe de verdad con otro nombre.
  assert.equal(sanearAnalisisEntrega({ resumen: 'x', pasos: [{ que: 'Y', quien: 'cliente' }] })!.proximos_pasos.length, 1);
});

test('sin resumen no hay análisis: el parse TIRA (y el drenaje lo cuenta como un intento)', () => {
  assert.equal(sanearAnalisisEntrega({ resumen: '   ', riesgos: [] }), null);
  assert.equal(sanearAnalisisEntrega('texto'), null);
  assert.throws(() => parseAnalisisEntrega('{"riesgos": []}'), /resumen/);
  assert.throws(() => parseAnalisisEntrega('no hay json'), /JSON/);
  // Y lo de siempre del JSON de un modelo (cercas, una coma que falta) pasa por json-del-modelo.
  const a = parseAnalisisEntrega('```json\n{"resumen": "Bien" "riesgos": [], "proximos_pasos": [{"que":"Seguir","quien":"equipo"}]}\n```');
  assert.equal(a.resumen, 'Bien');
  assert.equal(a.proximos_pasos.length, 1);
});

// ── La cita, contra la grabación ─────────────────────────────────────────────

const TRANSCRIPT = [
  { timestamp: '00:00:05', text: 'Hola, ¿cómo vas con el tablero?' },
  { timestamp: '00:12:03', text: 'La verdad, no sé si voy a poder seguir pagando' },
  { timestamp: '00:12:09', text: 'el programa este mes.' },
  { timestamp: '01:02:00', text: 'Te mando el reporte el lunes.' },
];
const conRiesgos = (riesgos: AnalisisEntrega['riesgos']): AnalisisEntrega => ({ resumen: 'x', riesgos, proximos_pasos: [] });

test('una cita que ESTÁ en la grabación se queda, y el segundo lo pone el código', () => {
  const v = verificarCitas(conRiesgos([
    // El modelo le erra al segundo y a los acentos: manda lo que dice la grabación.
    { riesgo: 'Pago en duda', cita: 'No se si voy a poder seguir pagando', gravedad: 'alta', t_seconds: 9999 },
  ]), TRANSCRIPT);
  assert.deepEqual(v.riesgos, [{ riesgo: 'Pago en duda', cita: 'No se si voy a poder seguir pagando', gravedad: 'alta', t_seconds: 723 }]);
});

test('una cita que cruza dos líneas de Fathom se encuentra igual', () => {
  const v = verificarCitas(conRiesgos([{ riesgo: 'Pago', cita: 'seguir pagando el programa este mes', gravedad: 'alta' }]), TRANSCRIPT);
  assert.equal(v.riesgos[0].t_seconds, 723, 'el segundo es el de la línea donde EMPIEZA');
});

test('una paráfrasis no se dibuja como cita: el riesgo se queda, sin comillas y sin segundo', () => {
  const v = verificarCitas(conRiesgos([
    { riesgo: 'Pago', cita: 'no tengo plata para el programa', gravedad: 'alta', t_seconds: 723 },
    { riesgo: 'Corta', cita: 'el lunes', gravedad: 'baja', t_seconds: 3720 },
  ]), TRANSCRIPT);
  assert.deepEqual(v.riesgos, [
    { riesgo: 'Pago', cita: '', gravedad: 'alta' },
    { riesgo: 'Corta', cita: '', gravedad: 'baja' },   // más corta que CITA_MINIMA: encontrarla no prueba nada
  ]);
});

// ── Lo que lee la ficha ──────────────────────────────────────────────────────

test('la ficha despliega SÓLO una sesión de entrega analizada (las tres condiciones del contrato)', () => {
  const base = { category: 'entrega_servicio', status: 'analizada', analysis_version: VERSION_ENTREGA, summary: ' Bien. ',
    riesgos: [{ riesgo: 'R', cita: 'c', gravedad: 'media' }, { riesgo: 'mal', gravedad: 'peor' }],
    proximos_pasos: [{ que: 'P', quien: 'equipo' }] };
  assert.deepEqual(analisisDeFila(base), { resumen: 'Bien.', riesgos: [{ riesgo: 'R', cita: 'c', gravedad: 'media' }], pasos: [{ que: 'P', quien: 'equipo' }] },
    'el jsonb se vuelve a sanear al leer');
  assert.equal(analisisDeFila({ ...base, category: 'venta' }), null, 'una venta analizada no es una sesión');
  assert.equal(analisisDeFila({ ...base, status: 'descartada' }), null);
  assert.equal(analisisDeFila({ ...base, analysis_version: 2 }), null, 'la v2 es el resumen de 1-2 frases del Closing Analyst');
  // Y la ficha lo lleva SÓLO en la fila de entrega.
  const l = llamadasDe({
    grabaciones: [
      { title: 'Sesión', call_date: '2026-10-01', started_at: null, duration_min: 60, share_url: 'https://x/1', call_url: null, category: 'entrega_servicio', analisis: analisisDeFila(base) },
      { title: 'Cierre', call_date: '2026-09-01', started_at: null, duration_min: 40, share_url: 'https://x/2', call_url: null, category: 'venta', analisis: analisisDeFila(base) },
    ],
    links: [], fechaJ1: null, fechaJ2: null,
  });
  assert.deepEqual(l.map((x) => [x.titulo, !!x.analisis]), [['Sesión', true], ['Cierre', false]]);
});

// ── La cola y los fallos ─────────────────────────────────────────────────────

test('la cola: lo nuevo primero, lo que falló al final y lo que no se reintenta afuera', () => {
  const f = (recording_id: number, call_date: string | null, error: string | null = null) => ({ recording_id, call_date, started_at: null, error });
  const cola = ordenarColaEntrega([
    f(1, '2026-01-10'),
    f(2, '2026-09-01', textoFalloEntrega(null, 'transcript vacío', 'sesion')),
    f(3, '2026-10-02'),
    f(4, '2026-10-05', textoSinReintento('Fathom 404')),
    f(5, null),
    f(6, '2025-12-01', 'Error guardando análisis (uno viejo del Closing Analyst)'),
    f(7, '2026-10-03', textoFalloEntrega(textoFalloEntrega(null, 'x', 'sesion'), 'x', 'sesion')),
  ]);
  assert.deepEqual(cola.map((x) => x.recording_id), [3, 1, 6, 5, 2, 7]);
});

test('un fallo de la SESIÓN gasta un intento; uno del proveedor no; al tercero, sin reintento', () => {
  const uno = textoFalloEntrega(null, 'transcript vacío', 'sesion');
  assert.equal(intentosDe(uno), 1);
  assert.equal(intentosDe(textoFalloEntrega(uno, 'la IA no contestó: 429', 'proveedor')), 1, 'la cuota de Gemini no es culpa de la sesión');
  let t: string | null = null;
  for (let i = 0; i < MAX_INTENTOS_ENTREGA; i++) t = textoFalloEntrega(t, 'JSON imposible', 'sesion');
  assert.ok(esSinReintento(t), `al intento ${MAX_INTENTOS_ENTREGA} la sesión sale de la cola: «${t}»`);
  assert.ok(esSinReintento(textoSinReintento('Fathom 404')));
  assert.ok(!esSinReintento('Fathom 404 en /recordings/1'), 'un error ajeno no deja una sesión fuera');
});

// ── Los fallos que no son de nadie (revisión del grupo, 06/10) ───────────────

test('un fallo AJENO no gasta intento, suma un ajeno; uno SEGURO del proveedor no suma nada', () => {
  const a1 = textoFalloEntrega(null, 'la IA no contestó: (sin respuesta)', 'ajena');
  assert.deepEqual([intentosDe(a1), ajenosDe(a1)], [0, 1]);
  const a2 = textoFalloEntrega(a1, 'la IA no contestó: 429 quota', 'proveedor');
  assert.deepEqual([intentosDe(a2), ajenosDe(a2)], [0, 1], 'la cuota no le suma nada a la sesión');
  const a3 = textoFalloEntrega(a2, 'transcript vacío', 'sesion');
  assert.deepEqual([intentosDe(a3), ajenosDe(a3), fallosDe(a3)], [1, 1, 2], 'un fallo propio conserva los ajenos');
  // Los textos de antes (sin «ajenos») se leen con cero, y siguen siendo de este análisis.
  assert.equal(ajenosDe('entrega · intento 2 · JSON imposible'), 0);
  assert.equal(fallosDe('entrega · intento 2 · JSON imposible'), 2);
  // Al tope, la sesión sale: es la que falla SOLA, sin otra que haga de testigo.
  let t: string | null = null;
  for (let i = 0; i < TOPE_AJENOS_ENTREGA - 1; i++) t = textoFalloEntrega(t, 'timeout', 'ajena');
  assert.ok(!esSinReintento(t) && ajenosDe(t) === TOPE_AJENOS_ENTREGA - 1);
  t = textoFalloEntrega(t, 'timeout', 'ajena');
  assert.ok(esSinReintento(t), `al ajeno ${TOPE_AJENOS_ENTREGA} sale de la cola: «${t}»`);
  // Y los proveedores nunca la sacan, por más que se repitan.
  let p: string | null = null;
  for (let i = 0; i < 100; i++) p = textoFalloEntrega(p, '429', 'proveedor');
  assert.ok(!esSinReintento(p) && fallosDe(p) === 0);
});

test('⚠️ la sesión que falla sin gastar intento BAJA en la cola: no le quita el turno a las demás', () => {
  // El caso del revisor: una sesión envenenada (la IA contesta vacío siempre) quedaba con
  // intento 0, PRIMERA entre las que fallaron, cortaba la corrida cada hora y las de intento
  // 1-2 no se reintentaban nunca más.
  const f = (recording_id: number, error: string) => ({ recording_id, call_date: '2026-09-01', started_at: null, error });
  let envenenada: string | null = null;
  for (let i = 0; i < 3; i++) envenenada = textoFalloEntrega(envenenada, 'la IA no contestó: (sin respuesta)', 'ajena');
  const cola = ordenarColaEntrega([
    f(1, envenenada!),
    f(2, textoFalloEntrega(null, 'JSON imposible', 'sesion')),
    f(3, textoFalloEntrega(textoFalloEntrega(null, 'x', 'sesion'), 'x', 'sesion')),
    f(4, textoFalloEntrega(null, 'la IA no contestó: 429', 'proveedor')),
  ]);
  assert.deepEqual(cola.map((x) => x.recording_id), [4, 2, 3, 1],
    'la de 3 ajenos va detrás de las de 1 y 2 intentos; la del 429 no se movió de su lugar');
});

test('qué es SEGURO del proveedor: la cuota y la key, con los textos que llegan de verdad', () => {
  // Los de la IA son el mensaje que tira `chatClaude` con los errores de la cascada adentro.
  const ia = (e: string) => `cs-sesion: gemini no contestó y esta feature no se degrada ni se paga (${e}). Se reintenta en la próxima corrida.`;
  for (const m of [
    ia('chatCheap(gemini#1): You exceeded your current quota, please check your plan and billing details.'),
    ia('chatCheap(gemini#1): Resource has been exhausted (e.g. check quota).'),
    ia('chatCheap(gemini#1): API key not valid. Please pass a valid API key.'),
    'Fathom 401 en /recordings/9/transcript: bad key',
    'Fathom sin respuesta en /recordings/9/transcript tras 4 intentos: Fathom 429',
    'FATHOM_API_KEY no configurada',
  ]) assert.ok(esFalloSeguroDelProveedor(m), m);
  for (const m of [
    ia('sin respuesta'),
    ia('chatCheap(gemini#1): This operation was aborted · sin tiempo: el plazo del pedido vence en 9 s'),
    ia('chatCheap(gemini#1): 503 This model is currently experiencing high demand.'),
    'Fathom no contestó en 20 s',
    'Fathom sin respuesta en /recordings/9/transcript tras 4 intentos: Fathom 503',
  ]) assert.ok(!esFalloSeguroDelProveedor(m), `«${m}» es ambiguo, no seguro`);
});

test('medio JSON es un CORTE POR TOPE; un JSON roto pero cerrado no', () => {
  const entero = '{"resumen": "Bien", "riesgos": [{"riesgo": "x", "cita": "y", "gravedad": "alta"}], "proximos_pasos": []}';
  assert.equal(jsonCortado(entero), false);
  // Cortado después de cerrar un riesgo: la última llave del texto NO es la de afuera.
  assert.equal(jsonCortado(entero.slice(0, entero.indexOf('}') + 1)), true);
  assert.equal(jsonCortado(entero.slice(0, 40)), true, 'cortado adentro de un string');
  assert.equal(jsonCortado('```json\n{"resumen": "a'), true, 'con la cerca de markdown adelante');
  // Una llave adentro de un string no cierra nada, ni una comilla escapada abre nada.
  assert.equal(jsonCortado('{"resumen": "usa } y \\" y {", "riesgos": ['), true);
  assert.equal(jsonCortado('{"resumen": "usa } y \\" y {"}'), false);
  // Roto pero cerrado (la coma que falta) es de la sesión, no del tope.
  assert.equal(jsonCortado('{"resumen": "Bien" "riesgos": []}'), false);
  assert.equal(jsonCortado('no hay json'), false, 'sin JSON a la vista no es un corte');
  // Y el parse de un JSON cortado tira (para que el drenaje llegue a preguntar esto).
  assert.throws(() => parseAnalisisEntrega(entero.slice(0, 60)));
});

test('el corte por tope queda ANOTADO: la vuelta siguiente sabe que tiene que ir con más lugar', () => {
  const corte = textoFalloEntrega(null, `${MOTIVO_CORTE}: la respuesta llegó sin cerrar (9000 caracteres con maxTokens 16000)`, 'ajena');
  assert.ok(esCortePorTope(corte), corte);
  assert.equal(intentosDe(corte), 0, 'un corte por tope no es de la sesión');
  // Sólo el ÚLTIMO fallo cuenta: después de otro motivo, ya no.
  assert.ok(!esCortePorTope(textoFalloEntrega(corte, 'Fathom devolvió el transcript vacío', 'sesion')));
  assert.ok(esCortePorTope(textoFalloEntrega(corte, `${MOTIVO_CORTE}: otra vez`, 'sesion')), 'con intento gastado, igual se lee');
  assert.ok(!esCortePorTope(null) && !esCortePorTope('corte por tope: un error de otro lado'));
});

test('conPlazo: lo que contesta a tiempo pasa; lo que no, falla con su nombre', async () => {
  assert.equal(await conPlazo(Promise.resolve(7), 1_000, 'X'), 7);
  await assert.rejects(conPlazo(new Promise(() => {}), 20, 'Fathom'), /^Error: Fathom no contestó en 0 s$/);
  await assert.rejects(conPlazo(Promise.reject(new Error('Fathom 404 en /x')), 1_000, 'Fathom'), /Fathom 404/,
    'el error propio pasa tal cual: lo clasifica `clasificarFalloFathom`');
  // Y el del tope cae como ajeno, que es lo que es: Fathom no dijo nada.
  assert.equal(clasificarFalloFathom('Fathom no contestó en 20 s'), 'del-proveedor');
});

// ── 2. El drenaje nunca escribe status 'error' ──────────────────────────────

const LIB = sinComentarios(leer('lib/closing-entrega.ts'));

test('un 404 de Fathom no se reintenta; la key o un 5xx no son culpa de la sesión', () => {
  // Los textos son los que tira `fathomGet` (lib/fathom-api.ts), tal cual.
  assert.equal(clasificarFalloFathom('Fathom 404 en /recordings/9/transcript: not found'), 'no-existe');
  assert.equal(clasificarFalloFathom('Fathom 403 en /recordings/9/transcript: forbidden'), 'de-la-sesion');
  assert.equal(clasificarFalloFathom('Fathom 401 en /recordings/9/transcript: bad key'), 'del-proveedor');
  assert.equal(clasificarFalloFathom('Fathom sin respuesta en /recordings/9/transcript tras 4 intentos: Fathom 503'), 'del-proveedor');
  assert.equal(clasificarFalloFathom('FATHOM_API_KEY no configurada'), 'del-proveedor');
  // Y el drenaje lo usa: el 404 es el único que deja la sesión fuera de la cola de una vez.
  assert.match(LIB, /if \(tipo === 'no-existe'\) \{\s*await anotarFallo\(id, textoSinReintento\(/);
});

test('EL QUE CUESTA PLATA: el drenaje NUNCA escribe `status = \'error\'`', () => {
  // `syncClosingCalls` (lib/closing.ts) reintenta toda fila en 'error' con el analista de
  // VENTA, que es Claude Sonnet PAGO. Una sesión que falla acá pasaría a pagarse en cada corrida.
  assert.doesNotMatch(LIB, /status\s*:\s*['"`]error/);
  assert.doesNotMatch(LIB, /['"`]error['"`]\s+as\s+const/);
  // Cada `status:` que escribe es el del contrato, y el contrato es «analizada».
  const estados = [...LIB.matchAll(/\bstatus\s*:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(estados, ['ESTADO_ANALIZADA'], `el drenaje escribe estos estados: ${estados.join(' · ')}`);
  assert.match(LIB, /const ESTADO_ANALIZADA = 'analizada';/);
  // El fallo pasa por UNA función, y esa función no toca el estado.
  const ini = LIB.indexOf('async function anotarFallo');
  const cuerpo = LIB.slice(ini, LIB.indexOf('\n}\n', ini));
  assert.ok(ini > 0 && cuerpo.length > 100 && cuerpo.length < 800, `no encontré anotarFallo (${cuerpo.length})`);
  assert.doesNotMatch(cuerpo, /status/);
  assert.match(cuerpo, /\.update\(\{ error: texto, updated_at:/);
  // Y no se cuela por los caminos PAGOS del Closing Analyst, que escriben 'error' ellos.
  assert.doesNotMatch(LIB, /\b(upsertRow|processCandidate|analyzeMeeting|analizarLlamadasDeLead|syncClosingCalls)\b/);
});

test('la IA es la gratis: cs-sesion en Gemini, sin degradarse y sin permiso de pagar Claude', () => {
  const f = CATALOGO_MODELOS.find((x) => x.feature === 'cs-sesion');
  assert.ok(f, 'cs-sesion no está en el catálogo: sin fila, el veto la corta y nada se analiza');
  assert.equal(f.def.provider, 'gemini');
  assert.deepEqual(f.fallback, [], 'sin `fallback: []` un 429 la degradaría a otro modelo');
  assert.ok(!f.pagoPorque, 'una feature gratis no justifica gastos');
  assert.ok(!CLAUDE_PERMITIDO.some((p) => p.feature === 'cs-sesion'), 'cs-sesion tiene permiso de pagar Claude');
  // El tag que se pasa es el del catálogo, y la llamada va por chatClaude (el veto y la cascada).
  assert.match(LIB, /export const FEATURE_ENTREGA = 'cs-sesion';/);
  assert.match(LIB, /await chatClaude\(system, \[\{ role: 'user', content: user \}\], \{\s*feature: FEATURE_ENTREGA,/);
  assert.doesNotMatch(LIB, /\bmodel\s*:\s*['"`]claude/, 'un modelo de Claude forzado saltearía el registro');
});

// ── El tope de salida, el reloj y el testigo (revisión del grupo, 06/10) ─────

/** El tramo de `src` entre dos marcas, que tienen que existir las dos. */
const entre = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
};
/** El valor de `const NOMBRE = 12_000;` en el fuente. */
const constante = (src: string, nombre: string): number => {
  const m = src.match(new RegExp(`const ${nombre} = ([\\d_]+);`));
  assert.ok(m, `no encontré la constante ${nombre}`);
  return Number(m[1].replace(/_/g, ''));
};

test('⚠️ EL TOPE DE SALIDA alcanza para pensar Y escribir, y tras un corte va el doble', () => {
  // Gemini piensa con los mismos tokens que escribe. Con 6.000 y un transcript de ~43k tokens
  // se cortaba justo en las sesiones más largas; plan-fathom ya lo había medido con 4.000.
  assert.ok(constante(LIB, 'MAX_TOKENS') >= 12_000, `MAX_TOKENS = ${constante(LIB, 'MAX_TOKENS')}`);
  assert.ok(constante(LIB, 'MAX_TOKENS_TRAS_CORTE') > constante(LIB, 'MAX_TOKENS'));
  assert.match(LIB, /const maxTokens = esCortePorTope\(f\.error\) \? MAX_TOKENS_TRAS_CORTE : MAX_TOKENS;/);
  const llamada = entre(LIB, 'texto = await chatClaude(', '});');
  assert.match(llamada, /\bmaxTokens,/, 'la llamada no usa el tope elegido');
  // Medio JSON NO es de la sesión mientras el tope pueda ser la causa; con el doble, sí.
  const parse = entre(LIB, 'analisis = verificarCitas(', 'const ahora = new Date()');
  assert.match(parse, /if \(jsonCortado\(texto\)\) \{[\s\S]*?return fallar\(f, motivo, maxTokens >= MAX_TOKENS_TRAS_CORTE \? 'sesion' : 'ajena', false, true\);/);
  const invalida = parse.indexOf("return fallar(f, `respuesta inválida: ${msgDe(e)}`, 'sesion', false, true);");
  assert.ok(invalida > parse.indexOf('jsonCortado(texto)'), 'el corte se pregunta ANTES de contarlo como respuesta inválida');
});

test('⏱ EL RELOJ: una sesión arranca sólo si entra ENTERA, y cada paso tiene su tope', () => {
  const R = sinComentarios(leer('app/api/cron/cs-sesiones-entrega/route.ts'));
  const CW = sinComentarios(leer('lib/cron-workspaces.ts'));
  const AN = sinComentarios(leer('lib/anthropic.ts'));
  const [fathom, preparar, llamada, presupuesto, escribir] =
    ['TOPE_FATHOM_MS', 'MARGEN_PREPARAR_MS', 'LLAMADA_IA_MS', 'PRESUPUESTO_IA_MS', 'MARGEN_ESCRITURA_MS'].map((n) => constante(LIB, n));
  assert.match(LIB, /export const RESERVA_SESION_MS = TOPE_FATHOM_MS \+ MARGEN_PREPARAR_MS \+ LLAMADA_IA_MS \+ MARGEN_ESCRITURA_MS;/);
  const reserva = fathom + preparar + llamada + escribir;
  // UN intento de la IA, entero, con el tope más grande que esto puede pedir: el que le da
  // `chatClaude` a la cascada barata (lib/anthropic.ts).
  const f = AN.match(/Math\.min\((\d+), Math\.max\((\d+), \(opts\.maxTokens \?\? 512\) \* (\d+)\)\)/);
  assert.ok(f, 'cambió la cuenta del timeout de chatClaude: hay que volver a medir LLAMADA_IA_MS');
  const intento = Math.min(Number(f[1]), Math.max(Number(f[2]), constante(LIB, 'MAX_TOKENS_TRAS_CORTE') * Number(f[3])));
  assert.ok(llamada >= intento, `LLAMADA_IA_MS (${llamada}) no cubre un intento entero (${intento})`);
  assert.ok(presupuesto >= llamada, 'el presupuesto de la IA no alcanza ni para un intento');
  // Y la reserva entra en la ronda: si no, el cron no le da el turno a NADIE.
  const techo = Number(R.match(/export const maxDuration = (\d+);/)?.[1]) * 1000 - constante(CW, 'RESERVA_SALIDA_MS');
  assert.match(R, /const MINIMO_UTIL_MS = 5_000 \+ RESERVA_SESION_MS;/);
  assert.ok(5_000 + reserva <= techo, `la reserva (${reserva}) no entra en la ronda (${techo})`);
  // Cada paso, con su tope: Fathom con conPlazo, la IA con un plazo ABSOLUTO que acota la
  // cascada entera (no un intento) y nunca pasa el corte de la corrida.
  assert.match(LIB, /m = await conPlazo\(fetchMeetingContent\(\{ recording_id: id \}\), TOPE_FATHOM_MS, 'Fathom'\);/);
  const ia = entre(LIB, 'texto = await chatClaude(', '});');
  assert.match(ia, /hastaMs: Math\.min\(Date\.now\(\) \+ PRESUPUESTO_IA_MS, ctx\.deadline - MARGEN_ESCRITURA_MS\),/);
  // Y no se degrada de MODELO: `fallback: []` sólo frena el de proveedor.
  assert.match(ia, /sinRespaldoDeModelo: true,/);
});

test('⚠️ EL TESTIGO: sin él, la IA que no contesta es ajena y corta; con él, es de la sesión', () => {
  const catchIA = entre(LIB, 'sinRespaldoDeModelo: true,', 'let analisis');
  const seguro = catchIA.indexOf("if (esFalloSeguroDelProveedor(msg)) return fallar(f, `la IA no contestó: ${msg}`, 'proveedor', true);");
  const testigo = catchIA.indexOf("if (ctx.testigo) return fallar(f, `la IA contestó para otra sesión de esta corrida y no para ésta: ${msg}`, 'sesion', false);");
  const ajena = catchIA.indexOf("return fallar(f, `la IA no contestó: ${msg}`, 'ajena', true);");
  assert.ok(seguro > 0 && testigo > seguro && ajena > testigo, `el orden de las tres ramas cambió (${seguro} · ${testigo} · ${ajena})`);
  // Y el drenaje se lo pasa: la primera sesión que la IA contesta prende el testigo.
  const bucle = entre(LIB, 'let iaViva = false;', 'r.sinTurno = cola.length - tomadas;');
  assert.match(bucle, /await analizarUna\(f, \{ deadline: opts\.deadline, testigo: iaViva \}\);\s*if \(iaContesto\) iaViva = true;/);
  // Fathom: lo seguro del proveedor no suma; lo demás que no es de la sesión, es ajeno.
  assert.match(LIB, /return fallar\(f, `Fathom: \$\{msg\}`, esFalloSeguroDelProveedor\(msg\) \? 'proveedor' : 'ajena', true\);/);
});

test('la cascada respeta el PLAZO del caller y puede no bajar de modelo (lib/ai-cheap.ts)', () => {
  const AC = sinComentarios(leer('lib/ai-cheap.ts'));
  const cascada = entre(AC, 'export async function chatCheapCascade(', '\n}\n');
  // Ningún intento arranca sin plazo para uno entero, y cada uno se acota a lo que queda.
  assert.match(cascada, /for \(let intento = 0; intento <= maxIntentos; intento\+\+\) \{\s*if \(quedan\(\) < MIN_INTENTO_MS\) return sinTiempo\(\);/);
  assert.equal(cascada.split('chatCheap({ ...base, timeoutMs: plazoDeIntento(),').length - 1, 2, 'los dos pedidos de un intento van con el plazo');
  assert.doesNotMatch(cascada, /timeoutMs: opts\.timeoutMs/, 'un intento con el timeout pelado ignora el plazo');
  assert.match(cascada, /if \(quedan\(\) - espera < MIN_INTENTO_MS\) break;\s*await new Promise\(\(r\) => setTimeout\(r, espera\)\);/);
  assert.match(cascada, /modelosAProbar\(prov, opts\.modelos\?\.\[prov\], !opts\.sinRespaldoDeModelo\)/);
  assert.match(entre(AC, 'function modelosAProbar(', '\n}\n'), /if \(!conRespaldo\) return \[pedido\];/);
  // Y chatClaude se los pasa, y con el plazo vencido FALLA: no paga Claude para ganar tiempo.
  const AN = sinComentarios(leer('lib/anthropic.ts'));
  assert.match(AN, /hastaMs: opts\.hastaMs, sinRespaldoDeModelo: opts\.sinRespaldoDeModelo,/);
  const pago = AN.indexOf("modeloOverride = 'claude-sonnet-5';");
  const corte = AN.indexOf('} else if (opts.hastaMs !== undefined && opts.hastaMs - Date.now() < 15_000) {');
  assert.ok(corte > 0 && corte < pago, 'sin el corte por plazo antes del pago, un plazo vencido compra Sonnet');
});

// ── 3. El prompt no nombra a nadie ───────────────────────────────────────────

test('el prompt NO nombra a Mauricio ni a ningún negocio: corre para todos los clientes', () => {
  // El del Closing Analyst arranca «Eres MaKo, analista de cierres de Mauricio Bustos…», y a
  // cualquier otro cliente le leía sus llamadas con el negocio de otro en la cabeza.
  const NOMBRES = /mauricio|bustos|leila|mart[ií]n|koncke|c[oó]digo inmobiliario|elevate|paddock|programa via/i;
  for (const [nombre, t] of [['system', ENTREGA_SYSTEM_TEMPLATE], ['user', ENTREGA_USER_TEMPLATE]] as const) {
    assert.doesNotMatch(t, NOMBRES, `el prompt ${nombre} nombra a alguien`);
    assert.ok(!t.includes('`') && !t.includes('${'), `el prompt ${nombre} trae un backtick o un \${`);
  }
  // Y lo que pide es lo que el saneo sabe leer: los enums y las claves del contrato.
  for (const k of ['"resumen"', '"riesgos"', '"riesgo"', '"cita"', '"t_seconds"', '"gravedad"', '"alta"', '"media"', '"baja"', '"proximos_pasos"', '"que"', '"quien"', '"cliente"', '"equipo"']) {
    assert.ok(ENTREGA_SYSTEM_TEMPLATE.includes(k), `el prompt no pide ${k}`);
  }
});

test('el prompt es EDITABLE: la misma key en el registro y en la llamada', () => {
  const REG = sinComentarios(leer('lib/prompt-registry.ts'));
  for (const key of ['closing.entrega.system', 'closing.entrega.user']) {
    assert.match(REG, new RegExp(`key: '${key.replace(/\./g, '\\.')}'`), `${key} no está en el registro`);
    assert.ok(LIB.includes(`'${key}'`), `${key} no se lee en lib/closing-entrega.ts: editarlo no haría nada`);
  }
  // Los slots del user template, todos con su variable en el registro y en el render.
  for (const slot of ['metadatos', 'cliente', 'resumenFathom', 'transcript']) {
    assert.ok(ENTREGA_USER_TEMPLATE.includes(`{{${slot}}}`), `falta {{${slot}}} en el template`);
    assert.match(LIB, new RegExp(`\\b${slot}\\b[:,]`), `el render no llena {{${slot}}}`);
  }
});

// ── «analizada» dejó de significar «venta» ──────────────────────────────────

test('todo lector de closing_analyses que filtra «analizada» filtra también la categoría', () => {
  // Hasta #107 sólo una venta quedaba 'analizada', y cuatro lectores lo daban por hecho: el
  // apartado de insights de la ficha del CRM, el resumen por WhatsApp, el Insight 360 y la
  // cola que PAGA el análisis de un lead. Sin la categoría, una sesión de entrega analizada
  // salía como una venta vacía y sacaba de esa cola a un lead cuya venta nunca se analizó.
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.tsx?$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files devolvió ${archivos.length}`);
  const malos: string[] = [];
  let vistos = 0;
  for (const f of archivos) {
    const src = sinComentarios(leer(f));
    for (let i = src.indexOf("'closing_analyses'"); i !== -1; i = src.indexOf("'closing_analyses'", i + 1)) {
      const sentencia = src.slice(i, i + 600).split(';')[0];
      if (!/'analizada'/.test(sentencia)) continue;
      vistos++;
      if (!/category/.test(sentencia)) malos.push(`${f}: ${sentencia.slice(0, 90).replace(/\s+/g, ' ')}…`);
    }
  }
  assert.ok(vistos >= 4, `esperaba al menos los 4 lectores conocidos, vi ${vistos}`);
  assert.deepEqual(malos, []);
});

// ── La ficha: sólo tipos del contrato, y el cron ─────────────────────────────

test('el navegador importa SÓLO TIPOS del contrato (trae los prompts)', () => {
  for (const f of ['app/customer-success/ficha-datos.ts', 'app/customer-success/FichaPestanas.tsx', 'app/customer-success/FichaCliente.tsx']) {
    const src = sinComentarios(leer(f));
    const imports = [...src.matchAll(/import\s+(type\s+)?[^;]*?from\s+'@\/lib\/closing-entrega(-contrato)?'/g)];
    for (const m of imports) assert.ok(m[1], `${f} importa un VALOR del contrato: ${m[0].slice(0, 80)}`);
  }
});

test('el cron: ronda horaria por workspace con Fathom, dos sesiones, sin colgar de la key de Claude', () => {
  const R = sinComentarios(leer('app/api/cron/cs-sesiones-entrega/route.ts'));
  assert.match(R, /const denied = checkCronAuth\(request\);\s*if \(denied\) return denied;/);
  assert.match(R, /correrRonda\('fathom', async \(ws, deadline\) => \{\s*const r = await drenarSesionesEntrega\(\{ deadline, max: MAX_SESIONES_POR_CORRIDA \}\);/);
  assert.match(R, /rotacion: 'cs-sesiones-entrega'/);
  assert.doesNotMatch(R, /ANTHROPIC_API_KEY/, 'este análisis no usa Claude: colgarlo de su key deja sin servicio al que no la tiene');
  assert.match(LIB, /export const MAX_SESIONES_POR_CORRIDA = 2;/);
  // El drenaje arranca una sesión SÓLO si entra entera antes del corte.
  assert.match(LIB, /if \(Date\.now\(\) \+ RESERVA_SESION_MS > opts\.deadline\) \{ r\.corto_por = 'tiempo'; break; \}/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026). Baseline: 19 pass / 0 fail. Catorce roturas, de a una y
// restauradas de memoria (nunca con git), y cada una cayó donde le toca — 18/1 salvo la 2:
//    1. anotarFallo con `status: 'error'`             → «EL QUE CUESTA PLATA…»
//    2. gravedad desconocida → 'media' (17/2)          → «…se DESCARTA, no lo decide un default»
//                                                        y «la ficha despliega SÓLO…» (re-saneo)
//    3. el tope de riesgos ANTES de ordenar            → «los topes…»
//    4. la cita no encontrada se queda                 → «una paráfrasis no se dibuja como cita…»
//    5. «…de Mauricio Bustos» en el prompt             → «el prompt NO nombra a Mauricio…»
//    6. insights-llamada sin `.eq('category','venta')` → «todo lector… filtra también la categoría»
//    7. cs-sesion sin `fallback: []`                   → «la IA es la gratis…»
//    8. ficha-datos con `import { type X }` (valor)    → «el navegador importa SÓLO TIPOS…»
//    9. analisisDeFila sin la categoría                → «la ficha despliega SÓLO…»
//   10. la cola sin sacar las «sin reintento»          → «la cola: lo nuevo primero…»
//   11. el cron colgado de ANTHROPIC_API_KEY           → «el cron: ronda horaria…»
//   12. 'closing.entrega.sistema' en la lib            → «el prompt es EDITABLE…»
//   13. la cuota de la IA gasta un intento             → «un fallo de la SESIÓN gasta un intento…»
//   14. un 401 de Fathom (la key) como de la sesión    → «un 404 de Fathom no se reintenta…»
//
// Y la revisión del grupo (06/10/2026: el tope de salida, el reloj y la sesión envenenada).
// Baseline 29 pass / 0 fail; veinticuatro roturas con un arnés que restaura de memoria y se
// niega a escribir si el ancla no aparece una sola vez — 28/1 salvo donde se dice:
//    1. MAX_TOKENS vuelve a 6.000                      → «EL TOPE DE SALIDA…»
//    2. la cola ordena sólo por intentos               → «…BAJA en la cola…»
//    3. un ajeno gasta intento (26/3)                  → «un fallo AJENO…», «…BAJA…», «el corte…ANOTADO»
//    4. sin el tope de ajenos                          → «un fallo AJENO…»
//    5. «quota» deja de ser seguro                     → «qué es SEGURO del proveedor…»
//    6. jsonCortado nunca ve un corte                  → «medio JSON es un CORTE POR TOPE…»
//    7. `if (ctx.testigo)` apagado                     → «EL TESTIGO…»
//    8. la IA sin `hastaMs`                            → «EL RELOJ…»
//    9. `sinRespaldoDeModelo: false` (27/2)            → «EL RELOJ…» y «EL TESTIGO…» (su ancla)
//   10. Fathom sin `conPlazo`                          → «EL RELOJ…»
//   11. LLAMADA_IA_MS en 72 s (menos que un intento)   → «EL RELOJ…»
//   12. TOPE_FATHOM_MS en 170 s (la reserva no entra)  → «EL RELOJ…». Con 150 s queda VERDE, y
//       es correcto: 5 + 150 + 5 + 120 + 5 = 285 s, exactamente el techo de la ronda.
//   13. el corte con el doble no se cuenta             → «EL TOPE DE SALIDA…»
//   14. sin el doble tras un corte                     → «EL TOPE DE SALIDA…»
//   15. el drenaje pasa `testigo: false`               → «EL TESTIGO…»
//   16. esCortePorTope con `includes`                  → «el corte por tope queda ANOTADO…»
//   17. la cascada arranca un intento sin plazo        → «la cascada respeta el PLAZO…»
//   18. un intento con `timeoutMs: opts.timeoutMs`     → «la cascada respeta el PLAZO…»
//   19. la espera ignora el plazo                      → «la cascada respeta el PLAZO…»
//   20. la cascada ignora sinRespaldoDeModelo          → «la cascada respeta el PLAZO…»
//   21. chatClaude no le pasa el plazo a la cascada    → «la cascada respeta el PLAZO…»
//   22. plazo vencido cae a comprar Sonnet             → «la cascada respeta el PLAZO…»
//   23. conPlazo no dice quién no contestó             → «conPlazo…»
//   24. un 503 pasa a ser «seguro del proveedor»       → «qué es SEGURO del proveedor…»
