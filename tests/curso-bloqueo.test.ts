// =============================================================================
// curso-bloqueo — cuándo se ABRE un módulo o una clase para UN alumno (D2, 08/10/2026)
// =============================================================================
// Pedido de Martín (07/10/2026, item 8): «la funcionalidad de Skool de poder "bloquear" algunas
// clases, y que se vayan desbloqueando con ciertos requerimientos». Lo que se EJECUTA acá es
// lib/curso-bloqueo.ts entero (puro): el saneo del contrato, los defaults, «completar», las fechas en
// la zona del negocio, el evaluador con sus ocho tipos y el armado que usa el portal (`aperturasDe`).
// La puerta que lo APLICA (lo cerrado no viaja) la prueban tests/curso-portal.test.ts y
// tests/cursos-ugc.test.ts.
//
// Las reglas que más cuestan si se rompen, y por eso cada una tiene su test:
//   · NO PODER LEER ES CERRADO: sin fechas, sin nivel o con una tarea que apunta a la nada, cerrado.
//   · LO ABIERTO A MANO GANA sobre cualquier candado, y una clase no es más abierta que su módulo.
//   · LAS FECHAS SON DEL NEGOCIO: un alumno de Tijuana que entra a las 23:30 entró ESE día.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saneaBloqueo, bloqueoPermitido, bloqueoEfectivo, claseCompleta, contextoDeFechas, sumarDias, diasEntre,
  fraseDeFecha, evaluarBloqueos, aperturasDe, contextoNecesario, rotuloDeBloqueo, estadosDeEtapas,
  MOTIVO_MANUAL, MOTIVO_MAS_ADELANTE, MAX_DIAS_BLOQUEO,
  type Bloqueo, type EntradaBloqueos, type ModuloParaBloqueo, type ClaseParaBloqueo,
} from '../lib/curso-bloqueo';
import { NIVEL_MAX } from '../lib/comunidad-niveles';
import { PCT_VISTO, type Clase, type Progreso } from '../lib/curso';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mod = (clave: string, o: Partial<ModuloParaBloqueo> = {}): ModuloParaBloqueo => ({
  clave, nombre: clave.toUpperCase(), vinculado: false, bloqueo: null, ...o,
});
const cl = (id: number, modulo: string, o: Partial<ClaseParaBloqueo> = {}): ClaseParaBloqueo => ({
  id, modulo, orden: id, titulo: `C${id}`, bloqueo: null, ...o,
});
/** Una entrada con todo abierto por default: sin kanban, fechas de hoy, nivel 1, nada a mano. */
const entrada = (o: Partial<EntradaBloqueos>): EntradaBloqueos => ({
  modulos: [], clases: [], completa: () => false, estadoTarea: () => undefined,
  kanban: { etapas: [], actual: null }, fechas: { hoy: '2026-10-08', inicio: '2026-10-01' }, nivel: 1, desbloqueos: [], ...o,
});
const ap = (r: ReturnType<typeof evaluarBloqueos>, k: string | number) =>
  (typeof k === 'number' ? r.clases.get(k) : r.modulos.get(k));
const abierto = (r: ReturnType<typeof evaluarBloqueos>, k: string | number) => ap(r, k)?.abierta;
const motivo = (r: ReturnType<typeof evaluarBloqueos>, k: string | number) => ap(r, k)?.motivo;

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'a', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});

// ── El contrato: lo que se guarda ────────────────────────────────────────────

test('saneaBloqueo: los ocho tipos válidos pasan, y el objeto se arma de cero', () => {
  const validos: Bloqueo[] = [
    { tipo: 'abierto' }, { tipo: 'etapa' }, { tipo: 'anterior' }, { tipo: 'dias', dias: 7 }, { tipo: 'dias', dias: 0 },
    { tipo: 'fecha', fecha: '2026-10-12' }, { tipo: 'tarea', claseId: 5 }, { tipo: 'tarea', claseId: 5, aprobada: true },
    { tipo: 'nivel', nivel: 3 }, { tipo: 'manual' },
  ];
  for (const b of validos) assert.deepEqual(saneaBloqueo(b), b, JSON.stringify(b));
  // Lo que no se nombró no viaja (ni un campo de más, ni un `__proto__` del jsonb).
  const sucio = saneaBloqueo(JSON.parse('{"tipo":"abierto","extra":1,"__proto__":{"tipo":"manual"}}'));
  assert.deepEqual(sucio, { tipo: 'abierto' });
  assert.equal(Object.getPrototypeOf(sucio), Object.prototype);
  assert.deepEqual(saneaBloqueo({ tipo: 'tarea', claseId: 5, aprobada: 'sí' }), { tipo: 'tarea', claseId: 5 }, '«aprobada» sólo con true');
});

test('saneaBloqueo: lo mal formado vuelve null (el default), NUNCA «abierto»', () => {
  const malos: unknown[] = [
    null, undefined, 'abierto', 7, [], [{ tipo: 'abierto' }], {}, { tipo: 'otro' },
    { tipo: 'dias' }, { tipo: 'dias', dias: 1.5 }, { tipo: 'dias', dias: -1 }, { tipo: 'dias', dias: MAX_DIAS_BLOQUEO + 1 }, { tipo: 'dias', dias: '7' },
    { tipo: 'fecha', fecha: '2026-02-30' }, { tipo: 'fecha', fecha: '12/10/2026' }, { tipo: 'fecha', fecha: '1999-01-01' }, { tipo: 'fecha' },
    { tipo: 'tarea', claseId: 0 }, { tipo: 'tarea', claseId: '5' }, { tipo: 'tarea' },
    { tipo: 'nivel', nivel: 0 }, { tipo: 'nivel', nivel: NIVEL_MAX + 1 }, { tipo: 'nivel', nivel: 2.5 },
  ];
  for (const m of malos) assert.equal(saneaBloqueo(m), null, JSON.stringify(m));
  // null y no «abierto»: para un vinculado, el default es esperar su etapa.
  assert.deepEqual(bloqueoEfectivo('vinculado', saneaBloqueo({ tipo: 'roto' })), { tipo: 'etapa' });
});

test('bloqueoPermitido: «etapa» es sólo de un vinculado, y una tarea no se espera a sí misma', () => {
  assert.equal(bloqueoPermitido('vinculado', { tipo: 'etapa' }), null);
  assert.equal(bloqueoPermitido('suelto', { tipo: 'etapa' }), 'Un módulo suelto no es una etapa.');
  assert.equal(bloqueoPermitido('clase', { tipo: 'etapa' }), 'La clase ya sigue a su módulo.');
  assert.equal(bloqueoPermitido('clase', { tipo: 'tarea', claseId: 4 }, { claseId: 4 }), 'Una clase no puede esperarse a sí misma.');
  assert.equal(bloqueoPermitido('clase', { tipo: 'tarea', claseId: 3 }, { claseId: 4 }), null);
  assert.equal(bloqueoPermitido('suelto', null), null, 'null es volver al default');
});

test('bloqueoEfectivo: vinculado espera su etapa, suelto abierto; un «etapa» en un suelto no cuenta', () => {
  assert.deepEqual(bloqueoEfectivo('vinculado', null), { tipo: 'etapa' });
  assert.deepEqual(bloqueoEfectivo('suelto', null), { tipo: 'abierto' });
  assert.deepEqual(bloqueoEfectivo('suelto', { tipo: 'etapa' }), { tipo: 'abierto' });
  assert.deepEqual(bloqueoEfectivo('vinculado', { tipo: 'abierto' }), { tipo: 'abierto' });
});

// ── Completar una clase ──────────────────────────────────────────────────────

test('claseCompleta: con tarea, enviarla; sin tarea, el tilde o el video visto (sólo si se puede medir)', () => {
  const conTarea = clase(1, { tarea: 'Hazlo' });
  assert.equal(claseCompleta(conTarea, prog(1, { estado: 'enviada' })), true);
  assert.equal(claseCompleta(conTarea, prog(1, { estado: 'aprobada' })), true);
  assert.equal(claseCompleta(conTarea, prog(1, { estado: 'pendiente', hechaAt: 'x', pct: 100 })), false, 'una con tarea no se completa con el tilde');
  assert.equal(claseCompleta(conTarea, null), false);
  const yt = clase(2, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/abc' });
  assert.equal(claseCompleta(yt, prog(2, { pct: PCT_VISTO })), true);
  assert.equal(claseCompleta(yt, prog(2, { pct: PCT_VISTO - 1 })), false);
  assert.equal(claseCompleta(yt, prog(2, { hechaAt: '2026-10-08T00:00:00Z' })), true, 'el tilde completa');
  const loom = clase(3, { videoTipo: 'loom', videoUrl: 'https://www.loom.com/share/abc' });
  assert.equal(claseCompleta(loom, prog(3, { pct: 100 })), false, '«no sé cuánto vio» no es «lo vio»');
  assert.equal(claseCompleta(loom, prog(3, { hechaAt: 'x' })), true);
  assert.equal(claseCompleta(clase(4), undefined), false);
});

// ── Las fechas, en la zona del negocio ───────────────────────────────────────

test('contextoDeFechas: Tijuana a las 23:30 del 30/09 es el 30/09 (en UTC ya sería el 01/10)', () => {
  const entro = '2026-10-01T06:30:00Z'; // 23:30 PDT (UTC-7) del 30/09
  const c = contextoDeFechas(new Date('2026-10-01T06:59:00Z'), entro, 'America/Tijuana');
  assert.deepEqual(c, { hoy: '2026-09-30', inicio: '2026-09-30' });
  // `dias: 1` sobre ese inicio: cerrado hasta la medianoche DE TIJUANA, no hasta la de UTC.
  const dias1 = (ahora: string) => evaluarBloqueos(entrada({
    modulos: [mod('a', { bloqueo: { tipo: 'dias', dias: 1 } })],
    fechas: contextoDeFechas(new Date(ahora), entro, 'America/Tijuana'),
  }));
  assert.equal(abierto(dias1('2026-10-01T06:59:00Z'), 'a'), false);
  assert.equal(motivo(dias1('2026-10-01T06:59:00Z'), 'a'), 'Se abre mañana');
  assert.equal(abierto(dias1('2026-10-01T07:00:00Z'), 'a'), true, 'medianoche del 01/10 en Tijuana');
  // Una zona que no existe no inventa fechas: sin contexto (y lo que depende queda cerrado).
  assert.equal(contextoDeFechas(new Date(), entro, 'Marte/Olympus'), null);
  assert.deepEqual(contextoDeFechas(new Date('2026-10-01T12:00:00Z'), 'no-es-fecha', 'UTC'), { hoy: '2026-10-01', inicio: null });
});

test('sumarDias / diasEntre / fraseDeFecha: días de calendario, sin horas; el año sólo si no es el de hoy', () => {
  assert.equal(sumarDias('2026-02-27', 3), '2026-03-02');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(diasEntre('2026-03-07', '2026-03-09'), 2, 'cruza el cambio de horario de EE.UU. sin perder un día');
  assert.equal(diasEntre('2026-10-09', '2026-10-08'), -1);
  assert.equal(fraseDeFecha('2026-10-12', '2026-10-08'), '12 de octubre');
  assert.equal(fraseDeFecha('2027-01-03', '2026-10-08'), '3 de enero de 2027');
  assert.equal(fraseDeFecha('2026-10-12'), '12 de octubre de 2026', 'sin hoy, con año: no se adivina');
});

// ── El evaluador: tipo por tipo ──────────────────────────────────────────────

test('fecha: se abre a la medianoche del negocio del día elegido; sin fechas, cerrado', () => {
  const m = [mod('a', { bloqueo: { tipo: 'fecha', fecha: '2026-10-12' } })];
  const antes = evaluarBloqueos(entrada({ modulos: m, fechas: { hoy: '2026-10-11', inicio: null } }));
  assert.equal(abierto(antes, 'a'), false);
  assert.equal(motivo(antes, 'a'), 'Se abre el 12 de octubre');
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: m, fechas: { hoy: '2026-10-12', inicio: null } })), 'a'), true);
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: m, fechas: { hoy: '2027-01-01', inicio: null } })), 'a'), true);
  const sin = evaluarBloqueos(entrada({ modulos: m, fechas: null }));
  assert.equal(abierto(sin, 'a'), false, 'no poder leer la fecha es cerrado');
  assert.equal(motivo(sin, 'a'), 'Se abre el 12 de octubre de 2026');
});

test('dias: N días después de su inicio; sin inicio, «más adelante» (no se inventa un número)', () => {
  const m = (dias: number) => [mod('a', { bloqueo: { tipo: 'dias', dias } })];
  const r = (dias: number, hoy: string, inicio: string | null) => evaluarBloqueos(entrada({ modulos: m(dias), fechas: { hoy, inicio } }));
  assert.equal(motivo(r(7, '2026-10-05', '2026-10-01'), 'a'), 'Se abre en 3 días');
  assert.equal(abierto(r(7, '2026-10-08', '2026-10-01'), 'a'), true, 'el día justo');
  assert.equal(abierto(r(0, '2026-10-01', '2026-10-01'), 'a'), true, 'dias 0 = desde el primer día');
  assert.equal(abierto(r(0, '2026-10-01', null), 'a'), false);
  assert.equal(motivo(r(0, '2026-10-01', null), 'a'), MOTIVO_MAS_ADELANTE);
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: m(1), fechas: null })), 'a'), MOTIVO_MAS_ADELANTE);
});

test('nivel: se abre al llegar; sin poder leer el nivel, cerrado', () => {
  const m = [mod('a', { bloqueo: { tipo: 'nivel', nivel: 3 } })];
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: m, nivel: 3 })), 'a'), true);
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: m, nivel: 7 })), 'a'), true);
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: m, nivel: 2 })), 'a'), 'Se abre en el nivel 3');
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: m, nivel: null })), 'a'), false, 'nivel ilegible = cerrado');
});

test('manual: cerrado hasta que el equipo lo abre; lo abierto a mano GANA sobre cualquier candado', () => {
  const candados: Bloqueo[] = [{ tipo: 'manual' }, { tipo: 'fecha', fecha: '2099-01-01' }, { tipo: 'nivel', nivel: NIVEL_MAX }, { tipo: 'etapa' }];
  for (const b of candados) {
    const modulos = [mod('a', { vinculado: b.tipo === 'etapa', bloqueo: b })];
    const kanban = { etapas: [{ key: 'z', label: 'Z' }, { key: 'a', label: 'A' }], actual: 'z' };
    const cerrado = evaluarBloqueos(entrada({ modulos, kanban, nivel: 1 }));
    assert.equal(abierto(cerrado, 'a'), false, JSON.stringify(b));
    const aMano = evaluarBloqueos(entrada({ modulos, kanban, nivel: 1, desbloqueos: [{ objeto: 'modulo', clave: 'a' }] }));
    assert.deepEqual(ap(aMano, 'a'), { abierta: true, motivo: null, manual: true }, JSON.stringify(b));
  }
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: [mod('a', { bloqueo: { tipo: 'manual' } })] })), 'a'), MOTIVO_MANUAL);
});

test('etapa: el vinculado se abre al LLEGAR a su etapa (hecha o actual); el motivo nombra la etapa de antes del kanban', () => {
  // «Onboarding» no es módulo (no tiene clases) y es la que hay que terminar para llegar a «Arranque».
  const kanban = { etapas: [{ key: 'onb', label: 'Onboarding' }, { key: 'arr', label: 'Arranque' }, { key: 'rit', label: 'Ritmo' }], actual: 'onb' };
  const modulos = [mod('arr', { vinculado: true }), mod('rit', { vinculado: true })];
  const r = evaluarBloqueos(entrada({ modulos, kanban }));
  assert.equal(motivo(r, 'arr'), 'Se abre al terminar «Onboarding»');
  assert.equal(motivo(r, 'rit'), 'Se abre al terminar «Arranque»');
  const enRitmo = evaluarBloqueos(entrada({ modulos, kanban: { ...kanban, actual: 'rit' } }));
  assert.equal(abierto(enRitmo, 'arr'), true, 'lo de atrás queda abierto');
  assert.equal(abierto(enRitmo, 'rit'), true);
  // Sin fila (o con una etapa que ya no existe) está en la PRIMERA, como el kanban.
  assert.deepEqual(estadosDeEtapas(['onb', 'arr'], 'borrada'), { onb: 'actual', arr: 'bloqueada' });
});

test('anterior (módulo): al completar TODAS las clases del anterior; uno vacío está completo; uno no permitido no cuenta', () => {
  const modulos = [mod('a'), mod('vacio'), mod('b', { bloqueo: { tipo: 'anterior' } }), mod('c', { bloqueo: { tipo: 'anterior' } })];
  const clases = [cl(1, 'a'), cl(2, 'a'), cl(3, 'b')];
  const r = (hechas: number[], permitido?: (k: string) => boolean) => evaluarBloqueos(entrada({ modulos, clases, completa: (id) => hechas.includes(id), permitido }));
  // «b» espera a «vacio» (su anterior), que está completo por vacío: abierto.
  assert.equal(abierto(r([]), 'b'), true, 'un módulo vacío está completo (si no, lo de después quedaría cerrado para siempre)');
  assert.equal(motivo(r([]), 'c'), 'Se abre al terminar «B»');
  assert.equal(abierto(r([3]), 'c'), true);
  // Sin el «vacio» en sus permisos, el anterior de «b» es «a».
  const sinVacio = (k: string) => k !== 'vacio';
  assert.equal(motivo(r([1], sinVacio), 'b'), 'Se abre al terminar «A»');
  assert.equal(abierto(r([1, 2], sinVacio), 'b'), true);
  // El primero del curso con «anterior» no espera a nadie.
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: [mod('a', { bloqueo: { tipo: 'anterior' } })] })), 'a'), true);
});

test('un módulo que sus PERMISOS no le dan: cerrado y SIN motivo (no se le muestra), y sus clases también', () => {
  const r = evaluarBloqueos(entrada({ modulos: [mod('a'), mod('z')], clases: [cl(1, 'z')], permitido: (k) => k !== 'z' }));
  assert.deepEqual(ap(r, 'z'), { abierta: false, motivo: null });
  assert.equal(abierto(r, 1), false);
  // Ni abierto a mano: los permisos van primero.
  const aMano = evaluarBloqueos(entrada({ modulos: [mod('z')], permitido: () => false, desbloqueos: [{ objeto: 'modulo', clave: 'z' }] }));
  assert.equal(abierto(aMano, 'z'), false);
});

// ── Las clases ───────────────────────────────────────────────────────────────

test('una clase sin candado HEREDA: abierta en un módulo abierto, cerrada (con el motivo del módulo) en uno cerrado', () => {
  const modulos = [mod('a'), mod('b', { bloqueo: { tipo: 'fecha', fecha: '2026-12-01' } })];
  const r = evaluarBloqueos(entrada({ modulos, clases: [cl(1, 'a'), cl(2, 'b')] }));
  assert.equal(abierto(r, 1), true);
  assert.deepEqual(ap(r, 2), { abierta: false, motivo: 'Se abre el 1 de diciembre' });
  // Una clase con «etapa» guardado (no se puede guardar, pero un jsonb editado a mano sí) hereda igual.
  assert.equal(abierto(evaluarBloqueos(entrada({ modulos: [mod('a')], clases: [cl(1, 'a', { bloqueo: { tipo: 'etapa' } })] })), 1), true);
});

test('una clase abierta a mano en un módulo CERRADO sigue cerrada: lo que se abre a mano es el módulo', () => {
  const modulos = [mod('b', { bloqueo: { tipo: 'manual' } })];
  const r = evaluarBloqueos(entrada({ modulos, clases: [cl(2, 'b')], desbloqueos: [{ objeto: 'clase', clave: '2' }] }));
  assert.deepEqual(ap(r, 2), { abierta: false, motivo: MOTIVO_MANUAL });
  // En uno abierto, la mano le gana a su candado.
  const r2 = evaluarBloqueos(entrada({ modulos: [mod('a')], clases: [cl(2, 'a', { bloqueo: { tipo: 'manual' } })], desbloqueos: [{ objeto: 'clase', clave: '2' }] }));
  assert.deepEqual(ap(r2, 2), { abierta: true, motivo: null, manual: true });
});

test('anterior (clase): la anterior en el ORDEN DEL CURSO, aunque sea de otro módulo', () => {
  const modulos = [mod('a'), mod('b')];
  const clases = [cl(2, 'a', { orden: 2, titulo: 'Última de A' }), cl(1, 'a', { orden: 1 }), cl(3, 'b', { orden: 1, bloqueo: { tipo: 'anterior' } })];
  const r = (hechas: number[]) => evaluarBloqueos(entrada({ modulos, clases, completa: (id) => hechas.includes(id) }));
  assert.equal(motivo(r([1]), 3), 'Se abre al terminar «Última de A»');
  assert.equal(abierto(r([2]), 3), true);
});

test('tarea: espera a OTRA clase; con «aprobada», a que la revisen; si la clase ya no existe, cerrada (la abre el equipo)', () => {
  const modulos = [mod('a')];
  const base = [cl(1, 'a', { titulo: 'Tu diagnóstico' })];
  const r = (b: Bloqueo, o: Partial<EntradaBloqueos> = {}) => evaluarBloqueos(entrada({ modulos, clases: [...base, cl(2, 'a', { bloqueo: b })], ...o }));
  assert.equal(motivo(r({ tipo: 'tarea', claseId: 1 }), 2), 'Se abre al terminar «Tu diagnóstico»');
  assert.equal(abierto(r({ tipo: 'tarea', claseId: 1 }, { completa: (id) => id === 1 }), 2), true);
  const rev = { tipo: 'tarea', claseId: 1, aprobada: true } as const;
  assert.equal(motivo(r(rev, { completa: () => true, estadoTarea: () => 'enviada' }), 2), 'Se abre cuando revisen «Tu diagnóstico»');
  assert.equal(abierto(r(rev, { estadoTarea: (id) => (id === 1 ? 'aprobada' : undefined) }), 2), true);
  assert.deepEqual(ap(r({ tipo: 'tarea', claseId: 99 }), 2), { abierta: false, motivo: MOTIVO_MANUAL }, 'un candado roto no abre');
});

test('un motivo no NOMBRA lo que quien mira no ve: un módulo fuera de sus permisos, o lo que no le toca al líder', () => {
  // `tarea` que espera una clase de «z», un módulo que sus permisos no le dan: no la puede completar
  // (las rutas le contestan 404). Antes el motivo decía «Se abre al terminar «Secreta»».
  const sinZ = (k: string) => k !== 'z';
  const r = evaluarBloqueos(entrada({
    modulos: [mod('a'), mod('z'), mod('b')],
    clases: [cl(9, 'z', { titulo: 'Secreta' }), cl(2, 'b', { bloqueo: { tipo: 'tarea', claseId: 9 } })],
    permitido: sinZ,
  }));
  assert.deepEqual(ap(r, 2), { abierta: false, motivo: MOTIVO_MANUAL });
  // `etapa`: la de antes en el kanban es un módulo que no le permiten → «más adelante», sin su nombre.
  const kanban = { etapas: [{ key: 'a', label: 'A' }, { key: 'z', label: 'Escondido' }, { key: 'c', label: 'C' }], actual: 'a' };
  const vinc = [mod('a', { vinculado: true }), mod('z', { vinculado: true }), mod('c', { vinculado: true })];
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: vinc, kanban, permitido: sinZ })), 'c'), MOTIVO_MAS_ADELANTE);
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: vinc, kanban })), 'c'), 'Se abre al terminar «Escondido»', 'con permiso, sí se nombra');
  // El LÍDER (`nombrable`): ni la clase anterior, ni la tarea esperada, ni el módulo anterior que no le
  // tocan se le nombran. Sin `nombrable`, los mismos motivos SÍ nombran (es el cliente, que las ve).
  const lider = { clase: (id: number) => id !== 1, modulo: (k: string) => k !== 'a' };
  const clases = [cl(1, 'a', { titulo: 'Del dueño' }), cl(3, 'b', { orden: 1, bloqueo: { tipo: 'anterior' } }), cl(4, 'b', { orden: 2, bloqueo: { tipo: 'tarea', claseId: 1 } })];
  const conCandado = [mod('a', { nombre: 'Números' }), mod('b', { bloqueo: { tipo: 'anterior' } })];
  const sinCandado = [mod('a', { nombre: 'Números' }), mod('b')];
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: conCandado, clases, nombrable: lider })), 'b'), MOTIVO_MAS_ADELANTE);
  assert.equal(motivo(evaluarBloqueos(entrada({ modulos: conCandado, clases })), 'b'), 'Se abre al terminar «Números»');
  const rl = evaluarBloqueos(entrada({ modulos: sinCandado, clases, nombrable: lider }));
  assert.deepEqual([motivo(rl, 3), motivo(rl, 4)], [MOTIVO_MAS_ADELANTE, MOTIVO_MAS_ADELANTE]);
  const rc = evaluarBloqueos(entrada({ modulos: sinCandado, clases }));
  assert.deepEqual([motivo(rc, 3), motivo(rc, 4)], ['Se abre al terminar «Del dueño»', 'Se abre al terminar «Del dueño»']);
  // Lo que decide abrir no cambia: sólo la frase.
  const hecha = evaluarBloqueos(entrada({ modulos: sinCandado, clases, nombrable: lider, completa: (id) => id === 1 }));
  assert.deepEqual([abierto(hecha, 3), abierto(hecha, 4)], [true, true]);
});

test('una clase cuyo módulo ya no existe no se abre (y no dice nada)', () => {
  const r = evaluarBloqueos(entrada({ modulos: [mod('a')], clases: [cl(9, 'borrado')] }));
  assert.deepEqual(ap(r, 9), { abierta: false, motivo: null });
});

test('los motivos son CORTOS: un nombre largo se corta', () => {
  const largo = 'Un nombre de módulo larguísimo que ocupa dos renglones enteros';
  const r = evaluarBloqueos(entrada({ modulos: [mod('a', { nombre: largo }), mod('b', { bloqueo: { tipo: 'anterior' } })], clases: [cl(1, 'a')] }));
  const m = motivo(r, 'b')!;
  assert.ok(m.length <= 'Se abre al terminar «»'.length + 40, m);
  assert.ok(m.endsWith('…»'), m);
});

// ── El armado del portal y lo que se lee ─────────────────────────────────────

test('aperturasDe: el tilde de una clase sin tarea completa y abre la que espera a «la anterior»', () => {
  const p = (progreso: Map<number, Progreso>) => aperturasDe({
    modulos: [mod('a')], etapas: [], actual: null,
    clases: [clase(1), clase(2, { bloqueo: { tipo: 'anterior' } })],
    progreso, contexto: { fechas: null, nivel: null, desbloqueos: [] },
  });
  assert.equal(p(new Map()).clases.get(2)?.abierta, false);
  assert.equal(p(new Map([[1, prog(1, { hechaAt: '2026-10-08T12:00:00Z' })]])).clases.get(2)?.abierta, true);
  // Sin contexto (el default), lo que depende de fechas queda cerrado.
  const sinCtx = aperturasDe({ modulos: [mod('a', { bloqueo: { tipo: 'dias', dias: 0 } })], etapas: [], actual: null, clases: [], progreso: new Map() });
  assert.equal(sinCtx.modulos.get('a')?.abierta, false);
});

test('contextoNecesario: sólo se paga lo que algún candado usa', () => {
  assert.deepEqual(contextoNecesario([null, { tipo: 'anterior' }, { tipo: 'etapa' }]), { fechas: false, inicio: false, nivel: false });
  assert.deepEqual(contextoNecesario([{ tipo: 'fecha', fecha: '2026-10-12' }]), { fechas: true, inicio: false, nivel: false });
  assert.deepEqual(contextoNecesario([{ tipo: 'dias', dias: 3 }, { tipo: 'nivel', nivel: 2 }]), { fechas: true, inicio: true, nivel: true });
});

test('rotuloDeBloqueo: lo que lee quien arma el curso', () => {
  assert.equal(rotuloDeBloqueo({ tipo: 'dias', dias: 0 }), 'Desde el primer día');
  assert.equal(rotuloDeBloqueo({ tipo: 'dias', dias: 1 }), '1 día después de entrar');
  assert.equal(rotuloDeBloqueo({ tipo: 'dias', dias: 7 }), '7 días después de entrar');
  assert.equal(rotuloDeBloqueo({ tipo: 'tarea', claseId: 3, aprobada: true }, () => 'Tu pitch'), 'Al revisar «Tu pitch»');
  assert.equal(rotuloDeBloqueo({ tipo: 'tarea', claseId: 3 }, () => null), 'Su clase ya no existe');
  assert.equal(rotuloDeBloqueo({ tipo: 'fecha', fecha: '2026-10-12' }), 'El 12 de octubre de 2026');
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Arnés que rompe UNA regla por vez sobre lib/curso-bloqueo.ts y restaura de MEMORIA (nunca con git),
// comparando el texto exacto (scratchpad/nucleo/romper.mjs). Sin romper: 23 pass / 0 fail. Cada
// rotura dio 22 / 1, y el que cayó fue SU test:
//   · un tipo desconocido vuelve «abierto» en vez de null          → «lo mal formado vuelve null»
//   · `saneaBloqueo` copia el objeto entero                         → «los ocho tipos… se arma de cero»
//   · «fecha» sin fechas, abierto                                   → «fecha: … sin fechas, cerrado»
//   · el nivel ilegible abre                                        → «nivel: … sin poder leer, cerrado»
//   · lo abierto a mano no gana sobre el candado del módulo         → «manual: … GANA»
//   · una clase abierta a mano adentro de un módulo cerrado        → «… en un módulo CERRADO sigue cerrada»
//   · una `tarea` que apunta a una clase borrada abre               → «tarea: … si la clase ya no existe»
//   · un módulo vacío NO está completo                              → «anterior (módulo)»
//   · un módulo no permitido cuenta como «el anterior»             → «anterior (módulo)»
//   · «la clase anterior» no cruza de módulo                        → «anterior (clase)»
//   · las fechas en UTC y no en la zona del negocio                 → «Tijuana a las 23:30…»
//   · un video que no se mide se completa con el %                  → «claseCompleta»
// REVISIÓN del 08/10/2026 (scratchpad/rev-nucleo/romper-final.mjs, restaurado de memoria y comparado
// byte a byte). Sin romper: 24 pass / 0 fail. Cada rotura dio 23 / 1, en «un motivo no NOMBRA…»:
//   · una `tarea` que espera una clase de un módulo no permitido la nombra (sin el MOTIVO_MANUAL)
//   · `nombraModulo` sin mirar `nombrable` · `nombraClase` sin mirar `nombrable`
//   · el motivo de `etapa` nombrando la etapa de antes aunque sea un módulo no permitido
// Y una «clase de un módulo cerrado se abre» (rotura de la revisión sobre la regla de antes) → 21 / 3.
