// =============================================================================
// El CRON con VARIAS etapas (cuarta tanda del Chatbot, punto 14; mig 0230) y su editor (punto 1)
// =============================================================================
// Pedido literal (app/admin/dev/chatbot/bitacora.ts, 9 oct 11:02): «le pedí "Quiero enviar una
// felicitaciones a un alumno que terminó una clase", está bien que el CRON haya seleccionado la opción
// de Entrega en lugar de Adquisición, pero... tal vez yo quiera enviar esa automatización en varias
// etapas, entonces quiero que en el CRON se puedan seleccionar más de 1 etapa, en este caso, la IA
// hubiese seleccionado todas las etapas de entrega». Y el 1: «No me gusta que el editor del CRON como
// muchos otros tengan tanto espacio en blanco y un desplegable chico arriba del todo».
//
// Lo puro se EJECUTA (la regla de cuáles etapas disparan, el match del evento, lo que se cierra al
// dejar una etapa, el desplegable de varios, Crear con IA); lo que es cableado (el motor, la puerta,
// la ruta) se lee del fuente sin comentarios y en LF.
//
// PROBADO ROMPIÉNDOLO: el resultado de cada rotura va al pie del archivo, con números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  etapasDe, normalizarEtapas, secuenciasDeEtapa, secuenciasDeEntrega, secuenciasQueSeCierran,
  TRIGGER_ETAPA, TRIGGER_ENTREGA, TOPE_ETAPAS,
} from '../lib/nutricion-etapa';
import { ambitoDeSecuencia } from '../lib/nutricion-ambito';
import {
  valorDisparo, valoresDisparo, pedidoDisparo, disparoDeValor, valoresTrasTocar, valorDeVarios, kanbanDeValor,
  rotuloDisparo, pasosDisparo, seccionesDisparo, detalleDisparador, fraseEtapas,
} from '../lib/flujo-conversacion';
import {
  deIA, hablaDeAlumno, disparadorDelPedido, disparadoresParaIA, bloqueDisparadores, CREAR_IA_SYSTEM_TEMPLATE, type CtxIA,
} from '../lib/flujo-ia';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función: desde su firma hasta su `}` a columna cero. */
const funcion = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, j);
};
const ids = (r: { id: number }[]) => r.map((x) => x.id).sort((a, b) => a - b);

// ── 1. Cuáles etapas disparan (`etapasDe`) ─────────────────────────────────────────

test('etapasDe: la lista manda si su PRIMERA es `etapa`; si no, `etapa` sola', () => {
  assert.deepEqual(etapasDe({ etapa: 'onb', etapas: ['onb', 'hito1', 'hito2'] }), ['onb', 'hito1', 'hito2']);
  // Lo de siempre: sin lista (las filas de antes, y la 0230 sin aplicar), una sola.
  assert.deepEqual(etapasDe({ etapa: 'agenda' }), ['agenda']);
  assert.deepEqual(etapasDe({ etapa: 'agenda', etapas: null }), ['agenda']);
  assert.deepEqual(etapasDe({ etapa: 'agenda', etapas: [] }), ['agenda']);
  // ⚠️ El escritor VIEJO (la API de MaKo, /email) cambia sólo `etapa`: la lista vieja deja de contar.
  assert.deepEqual(etapasDe({ etapa: 'hito2', etapas: ['onb', 'hito1'] }), ['hito2'], 'una lista vieja siguió mandando después de que un escritor viejo cambiara la etapa');
  // Sin etapa no hay nada que disparar, aunque haya una lista.
  assert.deepEqual(etapasDe({ etapa: '', etapas: ['onb'] }), []);
  assert.deepEqual(etapasDe({ etapa: null }), []);
});

test('normalizarEtapas: sin vacíos, sin repetidas, en su orden y con tope', () => {
  assert.deepEqual(normalizarEtapas([' onb ', '', 'hito1', 'onb', 7, null, 'hito2']), ['onb', 'hito1', 'hito2']);
  assert.deepEqual(normalizarEtapas('onb'), [], 'un string suelto no es una lista');
  assert.equal(normalizarEtapas(Array.from({ length: 50 }, (_, i) => `e${i}`)).length, TOPE_ETAPAS);
});

// ── 2. El evento: cualquiera de sus etapas ────────────────────────────────────────

const TODOS = ambitoDeSecuencia(null, null);
test('el evento de VENTA dispara una secuencia por CUALQUIERA de sus etapas, y sólo por ésas', () => {
  const SECS = [
    { id: 1, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', etapas: ['agenda', 'facturando'], ambito: TODOS },
    { id: 2, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', ambito: TODOS },
    { id: 3, trigger_tipo: TRIGGER_ETAPA, etapa: 'ganado', etapas: ['agenda', 'facturando'], ambito: TODOS }, // lista vieja
  ];
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'agenda', null)), [1, 2]);
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'facturando', null)), [1], 'la segunda etapa de la #1 no la disparó');
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'ganado', null)), [3], 'la #3 dispara por su `etapa`: su lista no coincide');
  assert.deepEqual(secuenciasDeEtapa(SECS, '', null), [], 'sin etapa no se enrola a nadie');
});

test('el evento de la ENTREGA, igual: cualquiera de sus etapas, y con su producto', () => {
  const SECS = [
    { id: 10, trigger_tipo: TRIGGER_ENTREGA, etapa: 'onb', etapas: ['onb', 'hito1', 'hito2'], producto_id: 9 },
    { id: 11, trigger_tipo: TRIGGER_ENTREGA, etapa: 'hito1', producto_id: 9 },
    { id: 12, trigger_tipo: TRIGGER_ETAPA, etapa: 'hito1', etapas: ['hito1'], producto_id: null }, // de VENTA, misma clave
  ];
  assert.deepEqual(ids(secuenciasDeEntrega(SECS, 'hito1', 9)), [10, 11]);
  assert.deepEqual(ids(secuenciasDeEntrega(SECS, 'hito2', 9)), [10]);
  assert.deepEqual(ids(secuenciasDeEntrega(SECS, 'hito2', 4)), [], 'el producto sigue acotando');
});

test('dejar una etapa NO corta una secuencia que también cubre la nueva', () => {
  const SECS = [
    { id: 20, trigger_tipo: TRIGGER_ENTREGA, etapa: 'onb', etapas: ['onb', 'hito1'], producto_id: 9 },
    { id: 21, trigger_tipo: TRIGGER_ENTREGA, etapa: 'onb', producto_id: 9 },
  ];
  // onb → hito1: la #20 cubre las dos y sigue; la #21 era sólo de onb y se cierra.
  assert.deepEqual(ids(secuenciasQueSeCierran(SECS, 'onb', 'hito1', 9)), [21]);
  // onb → hito2: ninguna cubre hito2, se cierran las dos.
  assert.deepEqual(ids(secuenciasQueSeCierran(SECS, 'onb', 'hito2', 9)), [20, 21]);
  // Salir de la entrega (sin destino): se cierra todo lo de la etapa que se deja.
  assert.deepEqual(ids(secuenciasQueSeCierran(SECS, 'onb', null, 9)), [20, 21]);
  assert.deepEqual(secuenciasQueSeCierran(SECS, '', 'hito1', 9), []);
});

// ── 3. El motor: el barrido, la cohorte, el cierre, la lectura sin la 0230 ───────────

test('el barrido arma la cohorte con TODAS sus etapas (la unión) en venta y en entrega', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  assert.equal([...src.matchAll(/leadsDeCohorte\(sec\.trigger_tipo, etapasDe\(sec\),/g)].length, 2, 'el plan y el commit');
  const entrega = src.slice(src.indexOf('  if (triggerTipo === TRIGGER_ENTREGA) {'), src.indexOf('\n  return cohorteDeTrigger('));
  assert.match(entrega, /for \(const key of keys\) for \(const id of await clientesEnEtapaDeEntrega\(prod, key\)\) out\.add\(id\);/, 'la cohorte de la entrega mira una sola etapa');
  const venta = src.slice(src.indexOf("  if (triggerTipo === 'etapa_actual') {"), src.indexOf("\n  if (triggerTipo === 'instant_form_sin_agenda')"));
  assert.match(venta, /const keys = listaDeEtapas\(etapa\);/);
  assert.match(venta, /\.filter\(\(l\) => keys\.includes\(pipelineStageOf\(/, 'la cohorte de venta mira una sola etapa');
});

test('⚠️ no se duplica: quien ya tiene fila de la secuencia no se vuelve a inscribir al pasar por otra de sus etapas', () => {
  // Medido el 09/10/2026 (lib/nutricion.ts): la inscripción es única por (lead, secuencia) y una
  // secuencia de etapa no REUSA filas (`reusaInscripciones` es sólo de la familia que prepara una
  // reunión). El barrido deja afuera a quien tiene fila (`aInscribir`) y el evento la saltea.
  const src = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(src, /const reusaInscripciones = \(s: Pick<Secuencia, 'trigger_tipo' \| 'pasos'>\): boolean =>\n {2}preparaUnaReunion\(s\.trigger_tipo\) && s\.pasos\.length > 0;/);
  const alta = funcion(src, 'async function aInscribir(');
  assert.match(alta, /const pendientes = candidatos\.filter\(\(id\) => !conFila\.has\(id\)\);/);
  const evento = funcion(src, 'export async function enrolarPorEvento(');
  assert.match(evento, /if \(previa\) \{\n\s*const r = reusables\.get\(previa\.id\);\n\s*if \(!r\) continue;/);
});

test('el cierre de la entrega lleva la etapa NUEVA', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(funcion(src, 'export async function cerrarEntregaDeEtapa('), /secuenciasQueSeCierran\(await getSecuenciasActivas\(\), key, etapaHacia, productoId\)/);
});

test('⚠️ el motor lee `etapas` y, sin la 0230, vuelve a pedir sin ella (sólo con la COLUMNA que falta)', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  const lee = funcion(src, 'async function leerFilasDeSecuencias(');
  assert.match(lee, /const conEtapas = await pedir\(`\$\{COLS_SECUENCIA\}, \$\{COL_ETAPAS\}`\);/);
  assert.match(lee, /if \(!esColumnaInexistente\(conEtapas\.error\)\) throw new Error/, 'cualquier error se tragaba como si faltara la columna');
  assert.match(lee, /const sin = await pedir\(COLS_SECUENCIA\);/);
  // Y las dos lecturas la sanean.
  assert.equal([...src.matchAll(/etapas: normalizarEtapas\(r\.etapas \?\? null\),/g)].length, 2);
  // El conteo por etapa del editor de Customer Success cuenta una secuencia de varias en CADA una.
  const cuenta = funcion(src, 'export async function secuenciasPorEtapaDeEntrega(');
  assert.match(cuenta, /for \(const key of etapasDe\(r\)\) out\[key\] = \(out\[key\] \?\? 0\) \+ 1;/);
  assert.match(cuenta, /if \(error && esColumnaInexistente\(error\)\) \(\{ data, error \} = await pedir\('etapa'\)\);/);
});

// ── 4. La puerta: guardar una o varias, del mismo kanban ─────────────────────────────

test('la puerta valida CADA etapa en su kanban y escribe `etapa` = la primera y `etapas` = la lista', () => {
  const src = sinComentarios(leer('lib/setting-secuencias.ts'));
  for (const f of ['export async function setDisparadorEtapa(', 'export async function setDisparadorEntrega(']) {
    const cuerpo = funcion(src, f);
    assert.match(cuerpo, /for \(const key of keys\) \{/, `${f} valida una sola etapa`);
    assert.match(cuerpo, /await escribirDisparador\(secuenciaId, \{/);
  }
  const esc = funcion(src, 'async function escribirDisparador(');
  assert.match(esc, /const conEtapa = keys\.length \? \{ etapa: keys\[0\] \} : \{\};/);
  assert.match(esc, /etapas: keys\.length > 1 \? \[\.\.\.keys\] : null/);
  // Sin la 0230: con varias NO se guarda la primera en silencio; con una, como siempre.
  assert.match(esc, /if \(keys\.length > 1\) throw new TriggerInvalidoError\('Aún no se pueden varias etapas\.'\);/);
  assert.match(esc, /if \(!esColumnaInexistente\(error\)\) throw new Error/);
  // Los demás disparadores LIMPIAN la lista (`keys` vacío).
  assert.match(funcion(src, 'export async function setTriggerSecuencia('), /await escribirDisparador\(secuenciaId, \{ trigger_tipo: tipo, etiqueta_id: etiquetaId, \.\.\.\(tocaEmbudo \? \{ funnel_id: funnelId \} : \{\}\), producto_id: null \}, \[\], 'setTriggerSecuencia'\);/);
  // La ruta pasa la lista.
  assert.match(sinComentarios(leer('app/api/chat-agent/secuencias/route.ts')), /etapas: Array\.isArray\(body\.etapas\) \? body\.etapas\.map\(\(x\) => String\(x \?\? ''\)\) : null,/);
});

test('la migración 0230: aditiva, ANTES del deploy y sin backfill', () => {
  const mig = leer('supabase/migrations/0230_secuencia_etapas.sql');
  assert.match(mig, /add column if not exists etapas text\[\]/);
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY/);
  assert.doesNotMatch(mig.replace(/^--.*$/gm, ''), /\bupdate\b/i, 'un backfill inventaría una segunda copia de `etapa`');
});

// ── 5. El desplegable del CRON: varias dentro de un kanban ───────────────────────────

const PRODUCTOS = [
  { funnelId: 5, productoId: 9, nombre: 'Curso', etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'onb', label: 'Bienvenida' }, { value: 'm1', label: 'Módulo 1' }, { value: 'm2', label: 'Módulo 2' }, { value: 'fin', label: 'Graduado' }] },
  { funnelId: 6, productoId: 12, nombre: 'Mentoría', etapas: [{ value: 'nuevo', label: 'Nuevo' }], etapasEntrega: [{ value: 'kick', label: 'Kickoff' }] },
];
const op = { disparadores: [], productos: PRODUCTOS, etiquetas: [{ id: 3, nombre: 'Cualificado' }], actual: { trigger_tipo: 'manual' }, textoActual: 'A mano' };

test('el valor junta las etapas de un kanban y el pedido las manda (una sola, EXACTO el de siempre)', () => {
  const varias = { trigger_tipo: 'entrega_actual', etapa: 'onb', etapas: ['onb', 'm1'], producto_id: 9 };
  assert.equal(valorDisparo(varias), 'entrega:9:onb,m1');
  assert.deepEqual(valoresDisparo(varias), ['entrega:9:onb', 'entrega:9:m1']);
  assert.deepEqual(pedidoDisparo('entrega:9:onb,m1', 7), { action: 'trigger', id: 7, trigger_tipo: 'entrega_actual', etapa: 'onb', etapas: ['onb', 'm1'], producto_id: 9 });
  assert.deepEqual(pedidoDisparo('venta:5:agendado', 7), { action: 'trigger', id: 7, trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 }, 'una sola etapa no lleva `etapas`');
  assert.deepEqual(disparoDeValor('venta:5:nuevo,agendado', { trigger_tipo: 'manual' }).etapas, ['nuevo', 'agendado']);
  assert.equal(disparoDeValor('venta:5:nuevo', { trigger_tipo: 'manual' }).etapas, null);
  assert.equal(kanbanDeValor('entrega:9:onb'), 'entrega:9');
  assert.equal(kanbanDeValor('etiqueta:3'), null);
});

test('tocar: en el mismo kanban se suma y se saca (la última no), otro kanban o una etiqueta reemplazan', () => {
  assert.deepEqual(valoresTrasTocar(['entrega:9:onb'], 'entrega:9:m1'), ['entrega:9:onb', 'entrega:9:m1']);
  assert.deepEqual(valoresTrasTocar(['entrega:9:onb', 'entrega:9:m1'], 'entrega:9:onb'), ['entrega:9:m1']);
  assert.deepEqual(valoresTrasTocar(['entrega:9:onb'], 'entrega:9:onb'), ['entrega:9:onb'], 'la última se apagó: un CRON sin etapa no dispara nunca');
  // ⚠️ Mezclar NO: la adquisición del mismo producto, otro producto o una etiqueta reemplazan.
  assert.deepEqual(valoresTrasTocar(['entrega:9:onb', 'entrega:9:m1'], 'venta:5:nuevo'), ['venta:5:nuevo']);
  assert.deepEqual(valoresTrasTocar(['entrega:9:onb'], 'entrega:12:kick'), ['entrega:12:kick']);
  assert.deepEqual(valoresTrasTocar(['entrega:9:onb'], 'etiqueta:3'), ['etiqueta:3']);
  assert.deepEqual(valoresTrasTocar(['trigger:manual'], 'venta:5:nuevo'), ['venta:5:nuevo']);
  assert.equal(valorDeVarios(['entrega:9:onb', 'entrega:9:m1']), 'entrega:9:onb,m1');
});

test('el botón dice CUÁLES, o «Cualquier etapa…» si son todas (y el producto adelante con varios)', () => {
  const secs = pasosDisparo(op);
  assert.equal(rotuloDisparo(secs, 'entrega:9:onb', 'x'), 'Curso · Llega a «Bienvenida»');
  assert.equal(rotuloDisparo(secs, 'entrega:9:onb,m1', 'x'), 'Curso · Llega a «Bienvenida» o «Módulo 1»');
  assert.equal(rotuloDisparo(secs, 'entrega:9:onb,m1,m2', 'x'), 'Curso · Llega a «Bienvenida», «Módulo 1» y 1 más');
  assert.equal(rotuloDisparo(secs, 'entrega:9:onb,m1,m2,fin', 'x'), 'Curso · Cualquier etapa de la entrega');
  // Una etapa que ya no está en la lista (la borraron del kanban): lo dice como lo dice la tarjeta.
  assert.equal(rotuloDisparo(secs, 'entrega:9:onb,borrada', 'Lo puesto'), 'Lo puesto');
  // Y la tarjeta CRON, con los nombres.
  assert.equal(detalleDisparador({ trigger_tipo: 'entrega_actual', etapa: 'onb', nombresEtapas: ['Bienvenida', 'Módulo 1'] }), 'Llega a «Bienvenida» o «Módulo 1»');
  assert.equal(detalleDisparador({ trigger_tipo: 'etapa_actual', etapa: 'a', nombresEtapas: ['A', 'B', 'C'], todas: true }), 'Cualquier etapa de la venta');
  assert.equal(detalleDisparador({ trigger_tipo: 'etapa_actual', etapa: 'a', nombreEtapa: 'A', nombresEtapas: ['A'] }), 'Llega a «A»');
  assert.equal(fraseEtapas(['A', 'B', 'C', 'D'], false, 'entrega'), 'Llega a «A», «B» y 2 más');
});

test('el CRON elige VARIAS en el desplegable de la casa, guarda una vez con respiro, y su editor tiene rótulo y campo grande (punto 1)', () => {
  const perfil = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  assert.match(perfil, /varios=\{valoresDisparo\(disparo\)\} minimo=\{1\}/);
  assert.match(perfil, /onChange=\{tocarDisparo\}/);
  assert.match(perfil, /const valor = valorDeVarios\(valoresTrasTocar\(valoresDisparo\(disparo\), tocado\)\);/);
  assert.match(perfil, /setTimeout\(\(\) => \{ disparoPendiente\.current = null; void mandarDisparo\(body, nuevo\); \}, RESPIRO_DISPARO_MS\)/);
  // El editor: el rótulo arriba y el selector de ancho completo con el alto de un campo.
  assert.match(perfil, /<CampoCron rotulo="Cuándo arranca">/);
  assert.match(perfil, /\{cron && !eligiendo && <CampoCron rotulo="A quién">\{desplegableDisparo\}<\/CampoCron>\}/);
  assert.match(perfil, /const BOTON_CAMPO_CRON: CSSProperties = \{ minHeight: 44,/);
  assert.match(perfil, /search width="100%"/);
});

// ── 6. Crear con IA: varias claves, y el alumno va por TODAS las de la entrega ──────────

const ctxIA = (pedido?: string): CtxIA => ({
  etiquetas: [{ id: 3, nombre: 'Cualificado' }],
  productos: PRODUCTOS,
  disparadores: disparadoresParaIA(seccionesDisparo(op)),
  audios: [], archivos: [], acciones: [], links: {},
  ...(pedido ? { pedido } : {}),
});
const flujo = (disparador: unknown) => ({ disparador, inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}' }] });
const rnd = () => { let k = 0; return () => ((k++ * 0.137) % 1); };
const claveDe = (ctx: CtxIA, valor: string) => `d${ctx.disparadores.findIndex((d) => d.value === valor) + 1}`;

test('hablaDeAlumno: el alumno, el que terminó una clase o un módulo, los clientes del curso — y NO la venta', () => {
  for (const si of [
    'Quiero enviar una felicitaciones a un alumno que terminó una clase',
    'Felicitar a los estudiantes cuando completan el primer módulo',
    'Cuando acaba una lección, mandale un audio',
    'Un recordatorio para los clientes del curso',
    'Felicitar a quien terminó el curso',
  ]) assert.equal(hablaDeAlumno(si), true, si);
  for (const no of [
    'Recuperar a quien dejó sus datos para el curso y no agendó',
    'Cuando un cliente agenda, confirmale la llamada',
    'Los que no terminaron el formulario del curso',
    'Bienvenida a los leads nuevos',
  ]) assert.equal(hablaDeAlumno(no), false, no);
});

test('⚠️ el pedido de Martín: «un alumno que terminó una clase» → TODAS las etapas de la entrega de ese producto', () => {
  const ctx = ctxIA('Quiero enviar una felicitaciones a un alumno que terminó una clase');
  // El modelo eligió UNA etapa de la entrega (lo que hizo en producción): la segunda capa completa.
  assert.equal(deIA(flujo(claveDe(ctx, 'entrega:9:m1')), ctx, rnd()).disparador, 'entrega:9:onb,m1,m2,fin');
  // Eligió la ADQUISICIÓN del mismo producto: va a su entrega.
  assert.equal(deIA(flujo(claveDe(ctx, 'venta:5:agendado')), ctx, rnd()).disparador, 'entrega:9:onb,m1,m2,fin');
  // Una etiqueta es un disparador explícito: se respeta.
  assert.equal(deIA(flujo(claveDe(ctx, 'etiqueta:3')), ctx, rnd()).disparador, 'etiqueta:3');
  // Sin pista del producto y con DOS con entrega, no se adivina: queda lo del modelo.
  assert.equal(disparadorDelPedido(null, ctx), null);
  // Con el producto nombrado en el pedido, ése.
  assert.equal(disparadorDelPedido(null, { ...ctx, pedido: 'Felicitar al alumno de la Mentoría que terminó un módulo' }), 'entrega:12:kick');
  // Y si el pedido NO habla de un alumno, nada cambia.
  const venta = ctxIA('Recuperar a quien dejó sus datos y no agendó');
  assert.equal(deIA(flujo(claveDe(venta, 'venta:5:nuevo')), venta, rnd()).disparador, 'venta:5:nuevo');
});

test('el modelo puede pedir VARIAS claves; las de otro kanban se sacan con su aviso', () => {
  const ctx = ctxIA();
  const r = deIA(flujo([claveDe(ctx, 'venta:5:nuevo'), claveDe(ctx, 'venta:5:agendado')]), ctx, rnd());
  assert.equal(r.disparador, 'venta:5:nuevo,agendado');
  assert.deepEqual(r.avisos, []);
  const m = deIA(flujo([claveDe(ctx, 'venta:5:nuevo'), claveDe(ctx, 'entrega:9:onb')]), ctx, rnd());
  assert.equal(m.disparador, 'venta:5:nuevo', 'mezcló la adquisición con la entrega: no se puede guardar');
  assert.ok(m.avisos.some((a) => /un solo kanban/.test(a)), m.avisos.join(' | '));
  // Una sola clave, como siempre.
  assert.equal(deIA(flujo(claveDe(ctx, 'entrega:12:kick')), ctx, rnd()).disparador, 'entrega:12:kick');
});

test('el prompt dice la regla (la primera capa) y la ruta le pasa el pedido y las etapas a la puerta', () => {
  assert.match(CREAR_IA_SYSTEM_TEMPLATE, /una lista de claves de la MISMA línea/);
  assert.match(CREAR_IA_SYSTEM_TEMPLATE, /Si el pedido habla de un alumno .* van TODAS las claves de «Entrega» de ese producto/);
  // El bloque DISPARADORES sigue diciendo qué es cada línea (Etapa / Entrega por producto).
  assert.match(bloqueDisparadores(ctxIA().disparadores), /- Entrega · Curso \(llega a\): d\d+ Bienvenida · d\d+ Módulo 1/);
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  assert.match(ruta, /numerosPermitidos: numerosEn\(`\$\{perfil\}\\n\$\{pedido\}`\),\n\s*pedido,/);
  assert.match(ruta, /etapas: Array\.isArray\(pedidoTrigger\.etapas\) \? \(pedidoTrigger\.etapas as unknown\[\]\)\.map\(String\) : null,/);
});

// PROBADO ROMPIÉNDOLO (09/10/2026, cuarta tanda): baseline 17 pass / 0 fail. Una rotura por vez,
// restaurada de memoria:
//   (los números van en el commit de los tests, debajo)
