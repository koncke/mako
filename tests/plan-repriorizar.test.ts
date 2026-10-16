// =============================================================================
// «Re-priorizar todo»: el trabajo en segundo plano del Plan
// =============================================================================
// 16/10/2026, decisión 9 de «hacer el kanban un kanban». El pedido, textual (Martín): «Quiero
// hacerlo "libre", que se creen sin prioridad, y luego de última un botón en los 3 puntos de arriba
// del plan para "re-priorizar" todo, y eso puede correr en segundo plano y no impedir que el usuario
// siga utilizando todo».
//
// Lo que fija, una decisión por bloque:
//   · SÓLO TAREAS DEL PLAN: lo que propuso una Retro y los pasos de un experimento no entran, ni como
//     tarea a puntuar ni como vara contra la que se puntúa.
//   · RESPETA LO FIJADO A MANO (`score_manual`): el número no se toca —en las dos mitades—, aunque la
//     tarea igual sale de la bandeja si está ahí.
//   · UNO A LA VEZ POR TABLERO, garantizado por la base (el índice único de la mig 0297), no por una
//     lectura previa.
//   · TANDAS de 20, una detrás de la otra, con el avance escrito entre una y otra; dos drenajes (el
//     sondeo del tablero y el cron) nunca procesan la misma tanda.
//   · UNA TANDA QUE FALLA se reintenta ENTERA después de esperar, el error queda en la fila, y a la
//     tercera el trabajo se corta sin escribir nada de esa tanda.
//   · La bandeja «Sin proyecto» sale a un proyecto que existe o del catálogo; un nombre inventado no
//     abre nada. Y el historial lleva a MaKo (`ia`) como actor.
//   · El Plan nunca paga IA: el trabajo habla sólo con el Perro de siempre.
//
// Las funciones REALES corren en un node aparte (tests/_plan-repriorizar-hijo.ts, `server-only`)
// contra un PostgREST de mentira; lo único de mentira es el MODELO. Lo puro (qué entra, qué se hace
// con cada tarea, qué pasa cuando una tanda falla, qué se dibuja) se prueba directo.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026): la lista de roturas, con cuántos tests tiró cada una, al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TANDA, MAX_INTENTOS, ESPERA_REINTENTO_MS, esDelPlanCliente, idsDelTrabajo, fijadasFuera, planDeTanda, vara,
  idEntradaRP, textoEntradaRP, conEntrada, trasFalla, lineaDeProgreso, avisoAlTerminar, cambiosParaPantalla, alcanzaElReloj,
  type TareaRP,
} from '../lib/plan-repriorizar-nucleo';
import { DEFS } from '../lib/api-mako/areas/plan.def';
import { conPatchDelServer, type BoardTask } from '../app/plan/board/types';
import { FEATURES_DEL_PLAN } from '../lib/veto-claude';

const RAIZ = join(__dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');

// ── Lo puro ─────────────────────────────────────────────────────────────────────

const t = (id: string, o: Partial<TareaRP> = {}): TareaRP => ({
  id, titulo: `T ${id}`, proyectos: ['p1'], score: 50, fijada: false, recurrente: false, pendiente: true, delPlan: true, ...o,
});
const bandeja = (id: string) => id === 'pb';

test('sólo tareas del Plan: una Retro, un experimento (por origen o por id) no son del Plan', () => {
  assert.equal(esDelPlanCliente({ origen: 'mako' }), true);
  assert.equal(esDelPlanCliente({ origen: 'manual', retro_id: null, experimento_id: null }), true);
  assert.equal(esDelPlanCliente({ origen: 'retro' }), false);
  assert.equal(esDelPlanCliente({ origen: 'experimento' }), false);
  assert.equal(esDelPlanCliente({ origen: 'mako', retro_id: 5 }), false, 'nacida de una Retro aunque el origen diga otra cosa');
  assert.equal(esDelPlanCliente({ origen: 'manual', experimento_id: 8 }), false);
});

test('la foto: abiertas del Plan, las «Sin priorizar» primero; lo fijado y lo que se repite sólo entran si están en la bandeja', () => {
  const ts = [
    t('a', { score: 30 }), t('libre', { score: 0 }), t('b', { score: 70 }),
    t('cerrada', { pendiente: false }), t('retro', { delPlan: false }),
    t('fija', { fijada: true }), t('fijaEnBandeja', { fijada: true, proyectos: ['pb'] }),
    t('rec', { recurrente: true }), t('recEnBandeja', { recurrente: true, proyectos: [] }),
  ];
  assert.deepEqual(idsDelTrabajo(ts, bandeja), ['libre', 'a', 'b', 'fijaEnBandeja', 'recEnBandeja']);
  assert.equal(fijadasFuera(ts, bandeja), 1, 'la fijada que no tiene nada que hacer se CUENTA como respetada');
});

test('la tanda se decide contra la fila RELEÍDA: lo fijado no se puntúa (pero sale de la bandeja) y lo cerrado en el medio se saltea', () => {
  const ts = [t('a'), t('fija', { fijada: true, proyectos: ['pb'] }), t('rec', { recurrente: true, proyectos: ['pb'] }), t('cerro', { pendiente: false }), t('libreEnBandeja', { score: 0, proyectos: ['pb'] })];
  const p = planDeTanda(['a', 'fija', 'rec', 'cerro', 'borrada', 'libreEnBandeja'], ts, bandeja);
  assert.deepEqual(p.puntuar.map((x) => x.id), ['a', 'libreEnBandeja']);
  assert.deepEqual(p.rutear.map((x) => x.id), ['fija', 'rec', 'libreEnBandeja']);
  assert.deepEqual(p.fijadas.map((x) => x.id), ['fija']);
  assert.deepEqual(p.saltadas, ['cerro', 'borrada']);
});

test('la vara: sin las «Sin priorizar», sin las que se repiten, sin la Retro y sin la tanda', () => {
  const ts = [t('a', { score: 60 }), t('libre', { score: 0 }), t('rec', { recurrente: true }), t('retro', { delPlan: false }), t('enTanda', { score: 40 }), t('cerrada', { pendiente: false })];
  assert.deepEqual(vara(ts, new Set(['enTanda'])).map((x) => x.titulo), ['T a']);
});

test('una tanda que falla espera y se reintenta; a la tercera el trabajo se corta, con el error escrito', () => {
  const ahora = Date.parse('2026-10-16T12:00:00Z');
  const f1 = trasFalla(0, 'gemini: 429', ahora);
  assert.equal(f1.estado, 'corriendo');
  assert.equal(f1.intentos, 1);
  assert.equal(Date.parse(f1.tomadaHasta!) - ahora, ESPERA_REINTENTO_MS[0]);
  const f2 = trasFalla(1, 'gemini: 429', ahora);
  assert.equal(Date.parse(f2.tomadaHasta!) - ahora, ESPERA_REINTENTO_MS[1]);
  const f3 = trasFalla(MAX_INTENTOS - 1, 'gemini: 429', ahora);
  assert.equal(f3.estado, 'error');
  assert.equal(f3.tomadaHasta, null);
  assert.ok(f3.terminado);
  assert.match(f3.error, /429/);
  assert.equal(MAX_INTENTOS, 3);
  // El reloj: una tanda no arranca con menos de lo que tarda (cortada a mitad se repite entera).
  assert.equal(alcanzaElReloj('tareas', ahora + 10_000, ahora), false);
  assert.equal(alcanzaElReloj('tareas', ahora + 200_000, ahora), true);
});

test('el historial: UNA entrada de MaKo por trabajo y tarea, aunque la tanda se repita', () => {
  const e = { id: idEntradaRP(7, '1001'), ts: 2, actor: 'ia' as const, text: textoEntradaRP({ antes: 62, score: 72, razon: 'le gana a X', proyecto: 'Anuncios' }) };
  assert.equal(e.id, 'rp7-1001');
  // Con el número de ANTES: no hay deshacer, y el historial es lo único que deja volver a mano.
  assert.equal(e.text, 'MaKo la pasó a «Anuncios» y la re-priorizó — 62 → 72 (le gana a X)');
  assert.equal(textoEntradaRP({ antes: 0, score: 48 }), 'MaKo la priorizó — score 48', 'una «Sin priorizar» se PRIORIZA');
  const previa = [{ id: 'h1', ts: 1, actor: 'user' as const, text: 'Creó la tarjeta' }];
  const una = conEntrada(previa, e);
  const otraVez = conEntrada(una, { ...e, ts: 3 });
  assert.equal(otraVez.length, 2, 'la segunda pasada REEMPLAZA la entrada, no apila otra');
  assert.equal(otraVez[0].ts, 3);
});

test('lo que se dibuja es corto: la línea y los toasts', () => {
  assert.equal(lineaDeProgreso({ estado: 'corriendo', hechas: 40, total: 185 }), 'Re-priorizando 40/185');
  assert.equal(lineaDeProgreso({ estado: 'hecho', hechas: 185, total: 185 }), null);
  for (const e of [{ estado: 'hecho' as const, total: 185 }, { estado: 'hecho' as const, total: 0 }, { estado: 'error' as const, total: 9 }]) {
    const a = avisoAlTerminar(e)!;
    assert.ok(a.texto.split(/\s+/).length <= 4, `«${a.texto}» tiene más de 4 palabras`);
  }
  assert.equal(avisoAlTerminar({ estado: 'error', total: 9 })!.error, true);
});

test('los cambios para la pantalla: las tareas como GuardPatch, los proyectos sin pisar emoji ni detalle', () => {
  const r = cambiosParaPantalla([{ k: 't', id: '1', score: 50, scoreBase: 50 }, { k: 'p', id: 'p1', score: 80 }]);
  assert.deepEqual(r.tareas, [{ id: '1', score: 50, scoreBase: 50 }]);
  assert.deepEqual(r.proyectos, [{ id: 'p1', score: 80, scoreRazon: '', emoji: '', detalle: '' }]);
});

test('la pantalla pinta lo que escribió el server: el número, la BASE, el proyecto y la entrada (sin duplicarla)', () => {
  const x = {
    id: '1', score: 62, scoreBase: 62, priority: 'media', scoreRazon: 'vieja', labels: ['pb'], checklist: [], detalle: 'algo',
    historial: [{ id: 'h1', ts: 1, actor: 'user', text: 'Creó la tarjeta' }],
  } as unknown as BoardTask;
  const entrada = { id: idEntradaRP(7, '1'), ts: 2, actor: 'ia' as const, text: 'MaKo la re-priorizó — 62 → 48' };
  const una = conPatchDelServer(x, { id: '1', score: 48, scoreBase: 48, scoreRazon: 'nueva', labels: ['p1'], historialEntry: entrada });
  assert.equal(una.score, 48);
  assert.equal(una.scoreBase, 48, 'sin la base, el próximo guardado del dueño le devuelve al reparto el juicio de antes');
  assert.equal(una.priority, 'baja');
  assert.deepEqual(una.labels, ['p1']);
  assert.equal(una.historial.length, 2);
  // La misma entrada otra vez (la tanda se repitió, o el tablero abrió con ella ya en la base).
  const dos = conPatchDelServer(una, { id: '1', historialEntry: { ...entrada, ts: 3 } });
  assert.equal(dos.historial.length, 2, 'dos copias en memoria serían dos copias en el próximo guardado');
  // El reparto sólo mueve el número: la base que ya estaba se queda.
  const reparto = conPatchDelServer(una, { id: '1', score: 30, priority: 'baja' });
  assert.equal(reparto.scoreBase, 48);
});

// ── Lo real, contra la base de mentira ─────────────────────────────────────────────

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_plan-repriorizar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
type Entrada = { id: string; actor: string; text: string };
type TareaFinal = { score: number; scoreManual: boolean; razon: string | null; categorias: number[]; entradas: Entrada[] };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  cliente: {
    r1: { id: number; yaCorria: boolean; total: number; estado: string }; r2: { id: number; yaCorria: boolean };
    foto: string[]; sondeo: { ok: boolean; estado: string; agendadas: number; iaAntesDeCorrer: number };
    llamadas: Array<{ ids: string[]; vara: string[]; varaScores: number[]; hechasAlLlamar: number | null; motivo: string }>;
    rutear: Array<{ titulos: string[]; destinos: string[] }>;
    final: { estado: string; hechas: number; total: number; puntuadas: number; ruteadas: number; fijadas: number; sinPuntuar: number; error: string | null; modelo: string | null; intentos: number; terminado: boolean; actor: string };
    tareas: Record<string, TareaFinal>; categorias: string[];
    cambios: { n: number; ids: string[]; conScore: number; ejemplo: Record<string, unknown> | null };
    desdeFinal: { n: number | null; nCambios: number | null }; ia: string[];
  };
  carrera: { ids: number[]; yaCorria: boolean[]; choques: number; error: string | null; corriendo: number; filas: number };
  fallaUnaVez: {
    p1: { tandas: number; estado: string }; p2: { tandas: number; estado: string }; p3: { tandas: number; estado: string };
    tras1: { estado: string; hechas: number; intentos: number; error: string | null; esperaMs: number | null };
    llamadasTras2: number; mismaTandaReintentada: boolean;
    fin: { estado: string; hechas: number; total: number; intentos: number; error: string | null };
  };
  fallaSiempre: { estados: Array<{ estado: string; intentos: number; hechas: number }>; llamadas: number; error: string | null; terminado: boolean; scoresIntactos: boolean };
  dosDrenajes: { tandas: number[]; llamadas: number; ids: number; distintas: number; estado: string; hechas: number; casPerdidos: number };
  cron: { sinReloj: { corriendo: number; tandas: number }; llamadasSinReloj: number; conReloj: { corriendo: number; tandas: number }; estado: string; hechas: number };
  dueno: {
    total: number; av: { tandas: number; estado: string };
    final: { estado: string; hechas: number; puntuadas: number; ruteadas: number; fijadas: number; error: string | null };
    llamadas: Array<{ n: number; motivo: string; conCapacidades: boolean | undefined; tieneFija: boolean; tieneRec: boolean; tieneCerrada: boolean }>;
    proyectosJuzgados: number;
    rutear: Array<{ titulos: string[]; destinos: string[] }>;
    tfija: { score: number; manual: boolean; entradas: number };
    tbandeja: { labels: string[]; score: number; base: number };
    t1: { score: number; base: number; razon: string; manual: boolean };
    trec: { score: number };
    cambiosP: number; cambiosT: number; cambioT1: Array<{ score: number; scoreBase: number | null }>; ia: string[];
  };
  api: {
    antes: { trabajo: unknown }; prep: { payload?: { tablero: string }; resumen?: string; error?: string };
    ej: { ok: boolean; resumen: string; datos?: { trabajoId: number; total: number } };
    prep2: { error?: string; yaEstaba?: boolean };
    despues: { trabajo: { estado: string; avance: string; total: number; pidio: string } };
    agendadas: number; filas: Array<{ origen: string; actor: string; total: number }>;
  };
  rutaCliente: {
    fijar: number; trasFijar: boolean; guardar: number; trasGuardar: boolean; soltar: number; trasSoltar: boolean;
    arrancar: { status: number; ok: boolean; total: number | null; actor: string | null }; estado: { status: number; estado: string | null }; agendadas: number;
  };
  sinMock: string[];
};

const FUERA = ['2001', '2002', '2003', '2004', '2005', '2010']; // Retro, experimento, cerrada, no_cumple, fijada, se repite

test('arrancar saca la FOTO: deja afuera la Retro, el experimento, lo cerrado, lo que no cumple, lo fijado y lo que se repite', () => {
  assert.equal(R.cliente.r1.yaCorria, false);
  assert.equal(R.cliente.r1.estado, 'corriendo');
  assert.equal(R.cliente.r1.total, 49, '45 del plan + las cuatro de la bandeja');
  for (const id of FUERA) assert.ok(!R.cliente.foto.includes(id), `${id} no tenía que entrar`);
  for (const id of ['2006', '2007', '2008', '2009']) assert.ok(R.cliente.foto.includes(id), `${id} (bandeja) tenía que entrar`);
  // Las «Sin priorizar» primero: si el trabajo se corta, que se corte con ésas ya puntuadas.
  assert.deepEqual(R.cliente.foto.slice(0, 8), ['1041', '1042', '1043', '1044', '1045', '2007', '2008', '2009']);
  assert.deepEqual(R.sinMock, [], `tablas sin mock: ${R.sinMock.join(', ')}`);
});

test('uno a la vez por tablero: el segundo devuelve el que corre, y la BASE lo garantiza aunque la lectura falle', () => {
  assert.equal(R.cliente.r2.id, R.cliente.r1.id);
  assert.equal(R.cliente.r2.yaCorria, true);
  // La carrera: el segundo leyó «no hay ninguno» y chocó con el índice único (23505).
  assert.equal(R.carrera.choques, 1, 'el segundo insert tenía que chocar con el índice');
  assert.equal(R.carrera.error, null, 'el choque no es un error: es «ya hay uno», y se devuelve ése');
  assert.equal(R.carrera.ids[0], R.carrera.ids[1], 'al que chocó le vuelve el que ya corre');
  assert.deepEqual(R.carrera.yaCorria, [false, true]);
  assert.equal(R.carrera.filas, 1);
});

test('el sondeo del tablero contesta ANTES de trabajar y empuja la tanda siguiente en after()', () => {
  assert.equal(R.cliente.sondeo.ok, true);
  assert.equal(R.cliente.sondeo.estado, 'corriendo');
  assert.equal(R.cliente.sondeo.agendadas, 1);
  assert.equal(R.cliente.sondeo.iaAntesDeCorrer, 0, 'el Perro no corre adentro del pedido');
  // Y la ruta del tablero (/api/todo) de verdad: arranca y deja la tanda en after().
  assert.equal(R.rutaCliente.arrancar.status, 200);
  assert.equal(R.rutaCliente.arrancar.total, 3);
  assert.equal(R.rutaCliente.arrancar.actor, 'Martín', 'el actor es quien tocó el botón');
  assert.equal(R.rutaCliente.estado.estado, 'corriendo');
  assert.ok(R.rutaCliente.agendadas >= 1);
});

test('TANDAS de 20, una detrás de la otra, con el avance escrito entre una y otra', () => {
  const ns = R.cliente.llamadas.map((l) => l.ids.length);
  assert.deepEqual(ns, [20, 20, 8], 'la fijada de la bandeja sólo se rutea: 49 en la foto, 48 al Perro');
  for (const n of ns) assert.ok(n <= TANDA);
  assert.deepEqual(R.cliente.llamadas.map((l) => l.hechasAlLlamar), [0, 20, 40], 'cada tanda arranca con el avance de la anterior ya escrito');
  for (const l of R.cliente.llamadas) assert.equal(l.motivo, 'Re-priorizar todo (cliente)');
});

test('SÓLO TAREAS DEL PLAN: ninguna llamada al Perro ve la Retro ni un experimento, ni como tarea ni como vara', () => {
  for (const l of R.cliente.llamadas) {
    for (const id of FUERA) assert.ok(!l.ids.includes(id), `${id} llegó al Perro`);
    assert.ok(!l.vara.includes('Retro: subir el precio'), 'la Retro entró a la vara');
    assert.ok(!l.vara.includes('Paso del experimento'), 'el experimento entró a la vara');
    assert.ok(l.varaScores.every((s) => s > 0), 'una «Sin priorizar» entró a la vara (un fondo falso)');
  }
  for (const id of ['2001', '2002', '2003', '2004', '2010']) {
    assert.deepEqual(R.cliente.tareas[id].entradas, [], `${id} no tenía que tocarse`);
  }
  assert.equal(R.cliente.tareas['2001'].score, 60);
  assert.equal(R.cliente.tareas['2002'].score, 55);
});

test('RESPETA LO FIJADO A MANO, en las dos mitades (y la fijada igual sale de la bandeja)', () => {
  const f = R.cliente.tareas['2005'];
  assert.equal(f.score, 88);
  assert.equal(f.scoreManual, true);
  assert.deepEqual(f.entradas, []);
  const fb = R.cliente.tareas['2006'];
  assert.equal(fb.score, 77, 'el número fijado no se toca');
  assert.equal(fb.scoreManual, true, 'y el candado sigue puesto');
  assert.deepEqual(fb.categorias, [77], 'pero sale de la bandeja');
  assert.equal(fb.entradas.length, 1);
  assert.doesNotMatch(fb.entradas[0].text, /prioriz/, 'el historial no puede decir que la (re)priorizó');
  assert.equal(R.cliente.final.fijadas, 2, 'las dos fijadas, contadas');
  // El dueño.
  assert.equal(R.dueno.tfija.score, 95);
  assert.equal(R.dueno.tfija.manual, true);
  assert.equal(R.dueno.tfija.entradas, 0);
  assert.ok(R.dueno.llamadas.every((l) => !l.tieneFija && !l.tieneRec && !l.tieneCerrada));
  assert.equal(R.dueno.final.fijadas, 1);
  // Y una corrida NO pone candados (AGENTS.md → «score_manual no lo pone una corrida»).
  assert.equal(R.dueno.t1.manual, false);
  assert.equal(R.cliente.tareas['1001'].scoreManual, false);
});

test('la bandeja «Sin proyecto» sale a un proyecto que existe o del catálogo; un nombre inventado no abre nada', () => {
  assert.deepEqual(R.cliente.tareas['2007'].categorias, [77], 'a «Anuncios», que existe');
  assert.ok(R.cliente.categorias.includes('Contenido orgánico'), 'el área del catálogo se crea');
  assert.notDeepEqual(R.cliente.tareas['2008'].categorias, [78], '«Grabar tres reels» salió de la bandeja');
  assert.deepEqual(R.cliente.tareas['2009'].categorias, [78], 'el webinar: el modelo propuso un proyecto inventado → se queda en la bandeja');
  assert.ok(!R.cliente.categorias.includes('Webinar Inventado'));
  assert.equal(R.cliente.final.ruteadas, 3);
  for (const r of R.cliente.rutear) assert.ok(!r.destinos.includes('Sin proyecto'), 'la bandeja no es un destino');
  assert.deepEqual(R.dueno.tbandeja.labels, ['pcrm'], 'en el dueño, al proyecto que existe');
  assert.deepEqual(R.dueno.rutear.map((r) => r.titulos), [['Arreglar el filtro del CRM']], 'en el dueño sólo se rutea lo de la bandeja');
  for (const r of R.dueno.rutear) {
    assert.ok(!r.destinos.includes('Sin proyecto'), 'la bandeja no es un destino (dueño)');
    assert.deepEqual(r.destinos.slice().sort(), ['Dashboard', 'Feature: CRM'], 'lista CERRADA: los proyectos que existen');
  }
});

test('el historial lleva a MaKo como actor, con una entrada por tarea; y los cambios viajan a la pantalla', () => {
  const id = R.cliente.r1.id;
  const e = R.cliente.tareas['1001'].entradas;
  assert.equal(e.length, 1);
  assert.equal(e[0].actor, 'ia');
  assert.equal(e[0].id, `rp${id}-1001`);
  assert.match(e[0].text, /^MaKo la re-priorizó — 11 → \d+/, 'con el número de antes (la 1001 tenía 11)');
  assert.match(R.cliente.tareas['2007'].entradas[0].text, /pasó a «Anuncios» y la priorizó — score \d+/, 'una libre se PRIORIZA');
  assert.equal(R.cliente.cambios.n, 49, '48 puntuadas + la fijada que salió de la bandeja');
  assert.equal(R.cliente.cambios.conScore, 48);
  assert.ok(R.cliente.cambios.ejemplo?.historialEntry, 'el cambio lleva la entrada: si no, el próximo guardado la borra');
  assert.equal(R.cliente.desdeFinal.n, 0, 'pedido desde el final, no vuelve a mandar nada');
  assert.equal(R.cliente.desdeFinal.nCambios, 49);
});

test('al terminar: hecho, con los números, y sin hablar con ningún proveedor por fuera del Perro', () => {
  const f = R.cliente.final;
  assert.equal(f.estado, 'hecho');
  assert.equal(f.hechas, 49);
  assert.equal(f.total, 49);
  assert.equal(f.puntuadas, 48);
  assert.equal(f.sinPuntuar, 0);
  assert.equal(f.error, null);
  assert.equal(f.intentos, 0);
  assert.equal(f.terminado, true);
  assert.equal(f.modelo, 'gemini-de-mentira', 'el modelo que contestó queda escrito (si bajó de modelo, se ve)');
  assert.equal(f.actor, 'Ana');
  assert.deepEqual(R.cliente.ia, []);
  assert.deepEqual(R.dueno.ia, []);
});

test('UNA TANDA QUE FALLA se reintenta ESA tanda, después de esperar, y el error queda en la fila', () => {
  const x = R.fallaUnaVez;
  assert.deepEqual(x.p1, { tandas: 1, estado: 'corriendo' }, 'la primera sale, la segunda falla y el drenaje se corta');
  assert.equal(x.tras1.hechas, 20, 'lo de la tanda que falló NO cuenta como hecho');
  assert.equal(x.tras1.intentos, 1);
  assert.match(x.tras1.error ?? '', /^Tanda 2: .*429/);
  assert.ok((x.tras1.esperaMs ?? 0) > 15_000, 'espera antes de reintentar (la cuota es por minuto)');
  assert.deepEqual(x.p2, { tandas: 0, estado: 'corriendo' }, 'mientras espera, nadie la toma');
  assert.equal(x.llamadasTras2, 2);
  assert.equal(x.mismaTandaReintentada, true, 'se reintenta la MISMA tanda, no la siguiente');
  assert.equal(x.fin.estado, 'hecho');
  assert.equal(x.fin.hechas, 45);
  assert.equal(x.fin.intentos, 0);
  assert.match(x.fin.error ?? '', /Tanda 2/, '«falló y se recuperó» no se borra: es el último error');
});

test('si el Perro no contesta nunca, a la tercera el trabajo se corta y no escribe nada', () => {
  const x = R.fallaSiempre;
  assert.deepEqual(x.estados.map((e) => e.estado), ['corriendo', 'corriendo', 'error', 'error']);
  assert.deepEqual(x.estados.map((e) => e.intentos), [1, 2, 3, 3]);
  assert.equal(x.llamadas, 3, 'cortado, no vuelve a quemar cuota');
  assert.ok(x.estados.every((e) => e.hechas === 0));
  assert.equal(x.terminado, true);
  assert.match(x.error ?? '', /Tanda 1/);
  assert.equal(x.scoresIntactos, true);
});

test('dos drenajes a la vez (el sondeo y el cron) nunca procesan la misma tanda', () => {
  const x = R.dosDrenajes;
  assert.equal(x.llamadas, 3);
  assert.equal(x.ids, 45);
  assert.equal(x.distintas, 45, 'una tarea puntuada dos veces');
  assert.ok(x.casPerdidos >= 1, 'el compare-and-set tenía que frenar al segundo');
  assert.equal(x.estado, 'hecho');
  assert.equal(x.hechas, 45);
});

test('el cron drena aunque nadie mire, y sin reloj no arranca una tanda', () => {
  assert.deepEqual(R.cron.sinReloj, { corriendo: 1, tandas: 0 });
  assert.equal(R.cron.llamadasSinReloj, 0);
  assert.equal(R.cron.conReloj.tandas, 2);
  assert.equal(R.cron.estado, 'hecho');
  assert.equal(R.cron.hechas, 25);
  const cron = (JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons.find((c) => c.path === '/api/cron/plan-repriorizar');
  assert.equal(cron?.schedule, '* * * * *', 'el cron que termina el trabajo con la pestaña cerrada');
});

test('el dueño: el Perro sin capacidades, después el reparto y los proyectos; la base del juicio viaja a la pantalla', () => {
  const d = R.dueno;
  assert.equal(d.total, 26);
  assert.deepEqual(d.llamadas.map((l) => l.n), [20, 6]);
  for (const l of d.llamadas) { assert.equal(l.motivo, 'Re-priorizar todo'); assert.equal(l.conCapacidades, false); }
  assert.equal(d.final.estado, 'hecho');
  assert.equal(d.final.puntuadas, 26);
  assert.equal(d.final.ruteadas, 1);
  assert.equal(d.proyectosJuzgados, 1, 'los proyectos se re-juzgan una vez, al final');
  assert.equal(d.cambiosP, 3, 'y su número viaja a la pantalla');
  // El juicio queda en `score_base`; el reparto del cierre mueve `score` alrededor de él.
  assert.equal(d.t1.base, 41);
  assert.notEqual(d.t1.score, d.t1.base, 'el reparto (25 compiten) tenía que curvar');
  assert.deepEqual(d.cambioT1[0], { score: 41, scoreBase: 41 }, 'la tanda manda el juicio Y la base');
  assert.equal(d.cambioT1.at(-1)?.score, d.t1.score, 'el cierre manda el número del reparto');
  assert.equal(d.trec.score, 70, 'lo que se repite no se toca');
});

test('la API de MaKo: proponer cuenta, ejecutar arranca, el segundo dice que ya corre, y la lectura da el avance', () => {
  const a = R.api;
  assert.equal(a.antes.trabajo, null);
  assert.equal(a.prep.payload?.tablero, 'cliente');
  assert.match(a.prep.resumen ?? '', /12 tareas abiertas/);
  assert.equal(a.ej.ok, true);
  assert.equal(a.ej.datos?.total, 12, 'una acción que crea algo devuelve su id (AGENTS.md)');
  assert.ok(a.ej.datos?.trabajoId);
  assert.equal(a.prep2.yaEstaba, true, 'uno a la vez también por la API');
  assert.equal(a.despues.trabajo.estado, 'corriendo');
  assert.equal(a.despues.trabajo.avance, '0/12');
  assert.match(a.despues.trabajo.pidio, /MaKo \(WhatsApp\)/);
  assert.equal(a.filas[0].origen, 'api');
  assert.equal(a.agendadas, 0, 'la API no empuja tandas con un reloj que no conoce: las levanta el cron');

  const def = (id: string) => DEFS.find((d) => d.id === id)!;
  const rp = def('repriorizar_plan');
  assert.ok(rp, 'falta repriorizar_plan en el registro');
  assert.equal(rp.tipo, 'accion');
  assert.ok(!rp.canales.includes('http'), 'arrancar llama al Perro: no sale por HTTP');
  assert.equal(rp.gating?.rolMinimo, 'admin');
  assert.equal(rp.costo, 'ia');
  const ver = def('ver_repriorizacion_plan');
  assert.ok(ver);
  assert.equal(ver.tipo, 'lectura');
  assert.ok(ver.canales.includes('http'));
  assert.equal(ver.costo, 'gratis');
});

test('el candado del cliente: el slider lo pone, el guardado de la tarjeta NO lo abre, y la llave lo saca', () => {
  const x = R.rutaCliente;
  assert.equal(x.fijar, 200);
  assert.equal(x.trasFijar, true, 'la puerta (/api/todo `editar`) tiene que dejar pasar `score_manual`');
  assert.equal(x.guardar, 200);
  assert.equal(x.trasGuardar, true, 'un guardado sin el campo no puede abrir el candado');
  assert.equal(x.trasSoltar, false);
  // Y los dos tableros mandan lo que les toca (lo dice el fuente: es la mitad del navegador).
  const tb = leer('app', 'plan', 'TodoBoard.tsx');
  assert.match(tb, /score_razon: 'La fijaste a mano', score_manual: true/);
  assert.match(tb, /prioridadAlPerro: async[\s\S]{0,200}score_manual: false/);
  assert.doesNotMatch(tb.slice(tb.indexOf('const editPatch'), tb.indexOf('const catsNum')), /score_manual/, '`editPatch` no manda el candado');
});

test('el Plan nunca paga IA: el trabajo habla sólo con el Perro de siempre, que es una función del Plan', () => {
  assert.ok(FEATURES_DEL_PLAN.includes('mako-guardian'), 'puntuarNuevas va por mako-guardian, que el veto no deja pagar');
  const src = leer('lib', 'plan-repriorizar.ts');
  for (const prohibido of [/from '@\/lib\/anthropic'/, /from '@\/lib\/ai-cheap'/, /chatClaude/, /chatCheap/]) {
    assert.doesNotMatch(src, prohibido, `lib/plan-repriorizar.ts no habla con un modelo directo (${prohibido})`);
  }
});

test('los dos tableros reales traen la capacidad, la demo no, y el menú sólo la dibuja si está', () => {
  assert.match(leer('app', 'plan', 'board', 'repo-plan.ts'), /repriorizar: \{/);
  const tb = leer('app', 'plan', 'TodoBoard.tsx');
  assert.match(tb, /\.\.\.\(demo \? \{\} : \{\s*repriorizar: \{/);
  const shell = leer('app', 'plan', 'board', 'BoardShell.tsx');
  assert.match(shell, /\.\.\.\(rpUI\.disponible \? \[\{ key: 'repriorizar'/);
  assert.match(shell, /label: 'Re-priorizar todo'/);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (16/10/2026), contra una base en verde (27 de 27). Veintinueve roturas,
// veintinueve cazadas; cada una restaurada de memoria. Fallos / pases de 27:
//   esDelPlanCliente sólo mira el origen (no `retro_id` / `experimento_id`) ........ 6 / 21
//   la foto mete lo fijado a mano ..................................................... 5 / 22
//   la tanda le pide el número a lo fijado ............................................. 2 / 25
//   la vara con las «Sin priorizar» ..................................................... 1 / 26
//   la vara con la Retro ................................................................ 2 / 25
//   tandas de 40 ......................................................................... 5 / 22
//   las «Sin priorizar» no van primero en la foto ....................................... 3 / 24
//   reintenta sin esperar (sin `tomada_hasta`) ........................................... 2 / 25
//   nunca se corta (MAX_INTENTOS 99) ..................................................... 2 / 25
//   la tanda que falló cuenta como hecha ................................................. 2 / 25
//   tomar la tanda sin compare-and-set (sin `vuelta`) .................................... 1 / 26
//   el choque con el índice único tira en vez de devolver el que corre .................. 1 / 26
//   el sondeo no empuja la tanda en `after()` ............................................ 6 / 21
//   un nombre inventado por el modelo abre un proyecto (cliente) ........................ 1 / 26
//   la bandeja es destino del ruteo (dueño) .............................................. 1 / 26
//   el historial dice que fue la persona (`user`) ........................................ 1 / 26
//   la entrada del historial no es determinista .......................................... 1 / 26
//   escribir ignora lo fijado si el modelo lo devuelve (la SEGUNDA capa) ................ 3 / 24
//   el dueño sin el reparto al final ..................................................... 1 / 26
//   el dueño no escribe `score_base` ...................................................... 1 / 26
//   el cambio del dueño sin `scoreBase` ................................................... 1 / 26
//   el cambio del cliente sin la entrada de historial .................................... 1 / 26
//   la puerta /api/todo no deja pasar `score_manual` ..................................... 1 / 26
//   `editarTarea` no escribe `score_manual` ............................................... 1 / 26
//   `repriorizar_plan` sale por HTTP ...................................................... 1 / 26
//   la API no frena el segundo «Re-priorizar» ............................................ 1 / 26
//   el historial sin el número de antes .................................................. 1 / 26
//   la pantalla no deduplica la entrada (`conPatchDelServer`) ............................ 1 / 26
//   la pantalla no toma la base (`conPatchDelServer`) .................................... 1 / 26
// La segunda capa (escribir ignora lo fijado) daba 0 / 27 hasta que el modelo de mentira empezó a
// «colar» ids que no se le preguntaron: una capa que ninguna entrada dispara no está probada.
// =============================================================================
