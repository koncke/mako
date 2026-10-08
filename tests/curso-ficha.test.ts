// =============================================================================
// curso-ficha — la pestaña «Curso» de la ficha de un cliente en Customer Success
// =============================================================================
// Pedido de Martín (06/10/2026): «Dentro del Detail de los clientes de Mauricio se tiene que
// ver este CURSO». Lo que se EJECUTA acá es la lógica pura de app/customer-success/
// curso-ficha-lectura.ts (cómo se formatea lo que contestó, el resumen por etapa, el % visto
// que no miente, la fecha local → ISO); lo que se LEE del fuente son los dos cableados que el
// typecheck no ve: que la ficha monte la pestaña y que el archivo 'use server' exporte sólo
// funciones async (un `export const` ahí tipa perfecto y tira el build: AGENTS.md).
//
// PROBADO ROMPIÉNDOLO (06/10/2026): baseline 14 pass / 0 fail, y ONCE roturas de a una,
// restauradas de memoria (nunca con git): las once dieron 13 pass / 1 fail, cada una en el test
// que le toca. Con la fila de Avance y la invitación (misma fecha, segunda tanda) el baseline
// pasó a 18 y se sumaron cuatro roturas más. La tabla está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Clase, Campo, Progreso } from '../lib/curso';
import {
  respuestaDe, contestoAlgo, medicionDe, rotuloVisto, estadoDeTarea, resumenDeEtapa, fraseResumen,
  armarProducto, isoDeLocal, avisosDeSesion, ETAPA_HUERFANA, type ClaseFicha,
} from '../app/customer-success/curso-ficha-lectura';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8');
// Las líneas PRIMERO y los bloques después (AGENTS.md: un `/*` dentro de un `//` se come el
// código del medio). Sólo las líneas que ARRANCAN con `//`, para no partir un `https://`.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});
const ficha = (c: Clase, p: Progreso | null = null): ClaseFicha => ({
  id: c.id, etapa: c.etapa, orden: c.orden, titulo: c.titulo, tipo: c.tipo, minutos: c.minutos, tarea: c.tarea,
  campos: c.campos, obligatoria: c.obligatoria, medicion: medicionDe(c), progreso: p,
});

// ── Lo que contestó, formateado según sus campos ──────────────────────────────

test('una tabla con FILAS FIJAS: la primera columna es la del formulario, no la guardada', () => {
  const campo: Campo = { id: 'b4', label: 'Resultado por unidad', tipo: 'tabla', columnas: ['Bloque', 'Cuántas', 'Rango'], filasFijas: ['Las buenas', 'Las medias', 'Las que pierden'] };
  // Guardada con OTRA cosa en la primera celda (o sin nada), y una fila extra al final.
  const [b] = respuestaDe([campo], { b4: [['x', '4', '10-20'], ['', '', ''], ['', '2', 'menos de 5'], ['Otra', '1', '?']] });
  assert.equal(b.tipo, 'tabla');
  if (b.tipo !== 'tabla') return;
  assert.deepEqual(b.columnas, ['Bloque', 'Cuántas', 'Rango']);
  assert.deepEqual(b.filas.map((f) => f[0]), ['Las buenas', 'Las medias', 'Las que pierden', 'Otra'], 'las etiquetas fijas mandan y la extra se conserva');
  assert.deepEqual(b.filas[0], ['Las buenas', '4', '10-20']);
  // Ninguna celda contestada (sólo etiquetas): está vacía, no «contestó rayas».
  const [vacia] = respuestaDe([campo], { b4: [['Las buenas', '', ''], ['Las medias', ' ', '']] });
  assert.equal(vacia.tipo, 'vacio');
});

test('una tabla sin filas fijas tira los renglones vacíos y respeta el ancho de sus columnas', () => {
  const campo: Campo = { id: 'b2', label: 'Venta', tipo: 'tabla', columnas: ['Mes', 'Venta', 'Resultado'] };
  const [b] = respuestaDe([campo], { b2: [['ene', '100'], ['', '', ''], ['feb', '120', '30', 'sobra']] });
  assert.equal(b.tipo, 'tabla');
  if (b.tipo !== 'tabla') return;
  assert.deepEqual(b.filas, [['ene', '100', ''], ['feb', '120', '30']]);
});

test('checks es una lista; un texto donde iba una lista se muestra igual, no se pierde', () => {
  const campos: Campo[] = [
    { id: 'pierde', label: '¿Qué las hace perder?', tipo: 'checks', opciones: ['Renta', 'Nómina'] },
    { id: 'otro', label: 'Otro', tipo: 'checks' },
  ];
  const [a, b] = respuestaDe(campos, { pierde: ['Renta', ' ', 'Nómina'], otro: 'escrito a mano' });
  assert.deepEqual(a, { id: 'pierde', label: '¿Qué las hace perder?', tipo: 'lista', items: ['Renta', 'Nómina'] });
  assert.deepEqual(b, { id: 'otro', label: 'Otro', tipo: 'texto', texto: 'escrito a mano' });
});

test('la respuesta libre, lo vacío y lo que ya no tiene campo', () => {
  assert.deepEqual(respuestaDe([], { respuesta: '  mi respuesta ' }), [{ id: 'respuesta', label: 'Respuesta', tipo: 'texto', texto: 'mi respuesta' }]);
  assert.equal(contestoAlgo(respuestaDe([], {})), false, 'sin respuesta no «contestó algo»');
  const campos: Campo[] = [{ id: 'a', label: 'A', tipo: 'texto' }];
  const bs = respuestaDe(campos, { b: 'quedó de un formulario viejo' });
  assert.equal(contestoAlgo(bs), true);
  // El campo actual sin contestar va como vacío; la clave huérfana NO se tira.
  assert.deepEqual(bs.map((x) => `${x.id}:${x.tipo}`), ['a:vacio', 'b:texto']);
});

// ── El % visto no miente ──────────────────────────────────────────────────────

test('«sin medir» y «sin video» nunca se pintan como 0%', () => {
  const drive = clase(1, { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/abc/view' });
  assert.equal(medicionDe(drive), 'sin-medir');
  assert.equal(rotuloVisto(medicionDe(drive), null).texto, 'Sin medir');
  assert.equal(rotuloVisto(medicionDe(clase(2)), null).texto, 'Sin video');
  const yt = clase(3, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/abc123' });
  assert.equal(medicionDe(yt), 'medible');
  assert.equal(rotuloVisto('medible', null).texto, 'Sin abrir');
  // Le dio play pero el reproductor no mandó la duración: `pct` es 0 y NO es «0%».
  assert.equal(rotuloVisto('medible', prog(3, { vistoAt: '2026-10-06T10:00:00Z', segundosMax: 30 })).texto, 'Sin medir');
  assert.deepEqual(rotuloVisto('medible', prog(3, { vistoAt: 'x', segundosMax: 45, duracionSeg: 100, pct: 45 })), { texto: '45%', tono: 'dim' });
  assert.equal(rotuloVisto('medible', prog(3, { vistoAt: 'x', segundosMax: 95, duracionSeg: 100, pct: 95 })).tono, 'good');
  // Un subido se mide; un subido sin archivo todavía no tiene video.
  assert.equal(medicionDe(clase(4, { videoTipo: 'archivo', videoPath: 'ws1/c4.mp4' })), 'medible');
  assert.equal(medicionDe(clase(5, { videoTipo: 'archivo' })), 'sin-video');
});

test('el estado de la tarea: sin tarea no hay estado; sin progreso, pendiente', () => {
  assert.equal(estadoDeTarea(clase(1), null), null);
  assert.equal(estadoDeTarea(clase(2, { tarea: 'Llena esto' }), null), 'pendiente');
  assert.equal(estadoDeTarea(clase(3, { tarea: 'x' }), prog(3, { estado: 'aprobada' })), 'aprobada');
});

// ── El resumen por etapa y el recorrido ───────────────────────────────────────

test('«Completa» es la regla que mueve al cliente: todas las OBLIGATORIAS enviadas', () => {
  const a = clase(1, { tarea: 'x', obligatoria: true });
  const b = clase(2, { tarea: 'y' });
  const r1 = resumenDeEtapa([ficha(a, prog(1, { estado: 'enviada' })), ficha(b)]);
  assert.deepEqual(r1, { clases: 2, tareas: 2, enviadas: 1, completa: true });
  assert.equal(fraseResumen(r1), '1/2 tareas');
  // Envió TODO pero ninguna es obligatoria: no se completa sola (lib/curso.ts). Y una revisada
  // cuenta como enviada (se envió antes de que alguien la revise).
  const r2 = resumenDeEtapa([ficha(clase(3, { tarea: 'z' }), prog(3, { estado: 'aprobada' }))]);
  assert.equal(r2.completa, false);
  assert.equal(r2.enviadas, 1);
  assert.equal(fraseResumen(r2), '1/1 tarea');
  assert.equal(fraseResumen(resumenDeEtapa([ficha(clase(4))])), 'Sin tareas');
});

// ── La fila de Avance de la ficha (pedido del 06/10: «el Avance… en el detail de cada cliente») ──

test('la fila de Avance de la ficha sale de avanceDeCliente: «listo» es la regla que mueve, no «envió todo»', () => {
  const etapas = [{ key: 'e1', label: 'Bienvenida', color: '#123456' }, { key: 'e2', label: 'Contexto' }];
  const clases = [
    // e1: una obligatoria enviada y una normal sin enviar → COMPLETA con 1/2.
    clase(1, { etapa: 'e1', tarea: 'x', obligatoria: true }), clase(2, { etapa: 'e1', tarea: 'y' }),
    // e2: las dos enviadas pero ninguna obligatoria → NO completa con 2/2.
    clase(3, { etapa: 'e2', tarea: 'z' }), clase(4, { etapa: 'e2', tarea: 'w' }),
    // SU etapa es e2: un video medible visto al 40% y otro sin abrir → 20, no 40. El de e1, visto
    // entero, no entra (el % es el de SU etapa: la etapa NO es la primera, a propósito).
    clase(5, { etapa: 'e2', videoTipo: 'youtube', videoUrl: 'https://youtu.be/abc' }),
    clase(6, { etapa: 'e2', videoTipo: 'youtube', videoUrl: 'https://youtu.be/def' }),
    clase(7, { etapa: 'e1', videoTipo: 'youtube', videoUrl: 'https://youtu.be/ghi' }),
  ];
  const progreso = new Map([
    [1, prog(1, { estado: 'enviada' })], [3, prog(3, { estado: 'enviada' })], [4, prog(4, { estado: 'aprobada' })],
    [5, prog(5, { pct: 40, segundosMax: 40, duracionSeg: 100, vistoAt: 'x' })],
    [7, prog(7, { pct: 100, segundosMax: 100, duracionSeg: 100, vistoAt: 'x' })],
  ]);
  const p = armarProducto({ productoId: 1, nombre: 'NqE', etapas, clases, progreso, etapaActual: 'e2' });
  assert.ok(p);
  if (!p) return;
  assert.deepEqual(p.avance.etapas, [{ key: 'e1', label: 'Bienvenida', color: '#123456' }, { key: 'e2', label: 'Contexto', color: 'var(--faint)' }]);
  assert.equal(p.avance.fila.etapa, 'e2');
  assert.deepEqual(p.avance.fila.porEtapa.e1, { total: 2, enviadas: 1, completa: true });
  assert.deepEqual(p.avance.fila.porEtapa.e2, { total: 2, enviadas: 2, completa: false });
  assert.equal(p.avance.fila.pctVisto, 20, 'el % es de los medibles de SU etapa, y uno sin abrir cuenta 0');
  // El resumen de cada etapa de la lista de abajo dice lo mismo que la fila de arriba.
  assert.equal(p.etapas[0].resumen.completa, p.avance.fila.porEtapa.e1.completa);
  assert.equal(p.etapas[1].resumen.completa, p.avance.fila.porEtapa.e2.completa);
});

test('el curso de un producto: TODAS las etapas en el orden de la entrega, la actual marcada', () => {
  const etapas = [{ key: 'bienvenida', label: 'Bienvenida' }, { key: 'contexto', label: 'Contexto' }, { key: 'norte', label: 'Norte' }];
  const clases = [
    clase(10, { etapa: 'norte', orden: 2 }), clase(11, { etapa: 'bienvenida', orden: 1 }),
    clase(12, { etapa: 'norte', orden: 1 }), clase(13, { etapa: 'borrada', orden: 1 }),
  ];
  const p = armarProducto({ productoId: 1, nombre: 'NqE', etapas, clases, progreso: new Map([[11, prog(11, { estado: 'enviada' })]]), etapaActual: 'contexto' });
  assert.ok(p);
  if (!p) return;
  assert.deepEqual(p.etapas.map((e) => e.key), ['bienvenida', 'contexto', 'norte', ETAPA_HUERFANA], 'en orden, con la vacía y las sueltas al final');
  assert.deepEqual(p.etapas.map((e) => e.actual), [false, true, false, false]);
  assert.deepEqual(p.etapas[2].clases.map((c) => c.id), [12, 10], 'las clases van por su orden');
  assert.deepEqual(p.etapas[3].clases.map((c) => c.id), [13], 'las de una etapa borrada no se pierden');
  assert.equal(p.etapas[0].clases[0].progreso?.estado, 'enviada');
  // Sin clases el producto no se muestra.
  assert.equal(armarProducto({ productoId: 2, nombre: 'x', etapas, clases: [], progreso: new Map(), etapaActual: null }), null);
});

test('un cliente en una etapa BORRADA: ninguna es la «Actual», y la fila de Avance lo dice', () => {
  // El caso medido en el ws1 (06/10/2026): su fila dice «onboarding», el producto ya no la tiene.
  // `etapaActualDe` contesta la PRIMERA (la regla del portal y del paso automático) y la ficha
  // marcaba «Actual» Bienvenida, mientras la cabecera de la MISMA ficha decía «Etapa borrada».
  const etapas = [{ key: 'bienvenida', label: 'Bienvenida' }, { key: 'contexto', label: 'Contexto' }];
  const clases = [
    clase(21, { etapa: 'bienvenida', videoTipo: 'youtube', videoUrl: 'https://youtu.be/a' }),
    clase(22, { etapa: 'contexto' }),
  ];
  const progreso = new Map([[21, prog(21, { pct: 50, segundosMax: 50, duracionSeg: 100, vistoAt: 'x' })]]);
  const base = { productoId: 1, nombre: 'NqE', etapas, clases, progreso, etapaActual: 'bienvenida' };

  const p = armarProducto({ ...base, etapaBorrada: 'onboarding' });
  assert.ok(p);
  if (!p) return;
  assert.deepEqual(p.etapas.map((e) => e.actual), [false, false], 'la ficha marca una etapa que la cabecera dice que no es la suya');
  assert.equal(p.etapaActual, null);
  assert.equal(p.etapaBorrada, 'onboarding');
  assert.equal(p.avance.fila.etapa, null, 'la fila de Avance pintaba Bienvenida');
  assert.equal(p.avance.fila.etapaBorrada, true, 'la celda tiene que poder decir «Etapa borrada», no «—»');
  assert.equal(p.avance.fila.pctVisto, null, 'sin etapa no hay «cuánto vio de SU etapa»');

  // Y sin etapa borrada, lo de siempre: la primera marcada y la celda sin el aviso.
  const q = armarProducto({ ...base, etapaBorrada: null });
  assert.ok(q);
  if (!q) return;
  assert.deepEqual(q.etapas.map((e) => e.actual), [true, false]);
  assert.equal(q.avance.fila.etapaBorrada, false);
  assert.equal(q.etapaBorrada, null);
});

// ── Las llamadas ──────────────────────────────────────────────────────────────

test('el datetime-local se pasa a ISO como hora LOCAL de quien la escribe', () => {
  // ⚠️ CON LA ZONA FIJADA: en una máquina en UTC, leerlo como UTC (el bug) da el mismo
  // resultado que leerlo como local, y el test pasaría en verde sobre el bug. Node respeta el
  // cambio de `TZ` en caliente. Ciudad de México es UTC-6 todo el año (sin horario de verano
  // desde 2022): las 10:30 de allá son las 16:30 UTC.
  const antes = process.env.TZ;
  process.env.TZ = 'America/Mexico_City';
  try {
    assert.equal(isoDeLocal('2026-10-12T10:30'), '2026-10-12T16:30:00.000Z');
  } finally {
    if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
  }
  assert.equal(isoDeLocal('2026-10-12T10:30'), new Date(2026, 9, 12, 10, 30).toISOString());
  assert.equal(isoDeLocal(''), null);
  assert.equal(isoDeLocal('2026-10-12'), null, 'una fecha sola no es una hora de llamada');
  assert.equal(isoDeLocal('mañana a las 10'), null);
});

test('los avisos de una llamada: el previo de una que ya pasó «no salió», el posterior espera', () => {
  const ahora = Date.parse('2026-10-06T12:00:00Z');
  const pasada = { fecha: '2026-10-05T12:00:00Z', avisoPrevioAt: null, avisoPosteriorAt: null };
  assert.deepEqual(avisosDeSesion(pasada, ahora).map((a) => a.estado), ['no-salio', 'pendiente']);
  const futura = { fecha: '2026-10-08T12:00:00Z', avisoPrevioAt: '2026-10-06T11:00:00Z', avisoPosteriorAt: null };
  assert.deepEqual(avisosDeSesion(futura, ahora).map((a) => a.estado), ['enviado', 'pendiente']);
});

// La marca la escribe el cron ANTES de mandar: con un motivo anotado para esa fase, NO salió.
// Probado rompiéndolo (06/10/2026): leyendo sólo la marca (`marca ? 'enviado'`), 1 fallo acá.
test('un aviso marcado con su motivo («sin teléfono») no se pinta «enviado»', () => {
  const ahora = Date.parse('2026-10-06T12:00:00Z');
  const s = {
    fecha: '2026-10-05T12:00:00Z', avisoPrevioAt: '2026-10-04T12:00:00Z', avisoPosteriorAt: '2026-10-05T15:00:00Z',
    avisoMotivo: 'Antes: sin teléfono',
  };
  assert.deepEqual(avisosDeSesion(s, ahora).map((a) => a.estado), ['no-salio', 'enviado']);
});

// ── Los cableados que el typecheck no ve ──────────────────────────────────────

const FICHA = sinComentarios(leer('app/customer-success/FichaCliente.tsx'));
const CURSO = sinComentarios(leer('app/customer-success/FichaCurso.tsx'));
// El modal de invitar vive aparte porque lo usan la ficha Y la tabla Avance: sus actions tienen
// su call site ahí, no en FichaCurso.
const INVITAR = sinComentarios(leer('app/customer-success/curso/InvitarAlCurso.tsx'));
const FILA = sinComentarios(leer('app/customer-success/curso/FilaAvance.tsx'));
const TABLA = sinComentarios(leer('app/customer-success/curso/AvanceCurso.tsx'));
const LECTURA = sinComentarios(leer('app/customer-success/curso-ficha-lectura.ts'));
const ACC_CRUDO = leer('app/customer-success/curso-ficha-actions.ts');
const ACC = sinComentarios(ACC_CRUDO);

/** El cuerpo de una función exportada del archivo de actions, hasta la siguiente. */
const cuerpoDe = (n: string) => {
  const ini = ACC.indexOf(`export async function ${n}(`);
  assert.ok(ini >= 0, `no está ${n}`);
  const fin = ACC.indexOf('export async function', ini + 10);
  return ACC.slice(ini, fin < 0 ? undefined : fin);
};

test('la ficha MONTA la pestaña Curso: la tab, su panel y el componente', () => {
  assert.match(FICHA, /\{ id: 'prioridades', label: 'Tareas' \},\s*\{ id: 'curso', label: 'Curso' \},/, 'la tab «Curso», después de Tareas');
  assert.match(FICHA, /import \{ FichaCurso \} from '\.\/FichaCurso';/);
  assert.match(FICHA, /<Panel id="curso" activa=\{activa\} abiertas=\{abiertas\}>\s*<FichaCurso leadId=\{c\.leadId\} entrega=\{entrega\} \/>/,
    'el panel de la tab monta FichaCurso con su cliente y la entrega (de la que sale la firma que hace releer)');
});

test('curso-ficha-actions.ts es `use server` y SÓLO exporta funciones async', () => {
  assert.match(ACC.trimStart(), /^'use server';/);
  const exports = ACC.split('\n').filter((l) => /^export\b/.test(l));
  assert.ok(exports.length >= 7, `esperaba las siete actions, hay ${exports.length} exports`);
  const malos = exports.filter((l) => !/^export async function \w+\(/.test(l));
  assert.deepEqual(malos, [], 'un export que no es una función async tira el build');
});

test('cada action pasa por la PUERTA antes de hacer nada, y cada una tiene su call site', () => {
  const nombres = [...ACC.matchAll(/^export async function (\w+)\(/gm)].map((m) => m[1]);
  assert.ok(nombres.includes('invitarAlCursoAction') && nombres.includes('linkDelCursoAction'), 'faltan las actions de invitar y de copiar el link');
  for (const n of nombres) {
    assert.match(cuerpoDe(n), /const p = await puerta\(leadId\);\s*if \(!p\.ok\) return p;/, `${n} no pregunta la puerta`);
    // Una capacidad sin call site es una salida huérfana (AGENTS.md).
    assert.ok(new RegExp(`\\b${n}\\(`).test(CURSO + INVITAR), `${n} no la llama nadie en FichaCurso ni en InvitarAlCurso`);
  }
  // La puerta: cliente GANADO de este workspace, en positivo. La sesión y la capa son la regla
  // compartida (`puedeUsarCs`, app/customer-success/puerta.ts), y que la puerta abra con ella lo
  // fija tests/cs-acciones-puerta.test.ts — no se repite acá (06/10/2026).
  const puertaSrc = ACC.slice(ACC.indexOf('async function puerta('), ACC.indexOf('async function accesoActual('));
  assert.match(puertaSrc, /await puedeUsarCs\(\)/);
  assert.match(puertaSrc, /\.eq\('id', leadId\)\.eq\('estado_lead', 'ganado'\)/);
});

test('ABRIR la ficha no crea el acceso: sólo invitar, copiar y mandar lo crean', () => {
  // Hasta el 06/10 `cursoDeClienteAction` llamaba a `linkDeAcceso`, que hace upsert de la fila:
  // mirar la pestaña le daba acceso a alguien, y «Sin invitar» no se podía distinguir de
  // «alguien abrió su ficha».
  assert.doesNotMatch(cuerpoDe('cursoDeClienteAction'), /linkDeAcceso\(/, 'abrir la pestaña volvió a crear el acceso');
  const accesoActual = ACC.slice(ACC.indexOf('async function accesoActual('), ACC.indexOf('async function cursosDelCliente('));
  assert.ok(accesoActual.length > 0 && accesoActual.length < 1500, 'no encontré accesoActual/aFicha');
  assert.doesNotMatch(accesoActual, /linkDeAcceso\(/, 'leer el acceso no puede escribirlo');
  assert.match(accesoActual, /firmarAccesoCurso\(/, 'el link se FIRMA al leer, no se crea');
  assert.match(cuerpoDe('linkDelCursoAction'), /linkDeAcceso\(/);
  // Desde el 07/10/2026 invitar es UN núcleo (lib/curso-invitar.ts, el mismo que usa el CRM sin
  // sesión) y la action lo envuelve: el acceso lo crea `linkDeEntradaAlumno`, que llama a
  // `linkDeAcceso`. Lo fija tests/curso-invitar.test.ts.
  assert.match(cuerpoDe('invitarAlCursoAction'), /invitarAlCurso\(\{/);
  assert.match(sinComentarios(leer('lib/alumno-acceso.ts')), /export async function linkDeEntradaAlumno\([^)]*\)[^{]*\{\s*if \(!\(await linkDeAcceso\(/);
  // Y guardar PERMISOS también crea la fila (el alcance vive ahí, mig 0219): es una acción, no mirar.
  assert.doesNotMatch(cuerpoDe('cursoDeClienteAction'), /guardarAlcance\(/, 'abrir la pestaña escribe el alcance');
});

test('la ficha y la tabla dibujan la MISMA fila de Avance, y «listo» es `completa`', () => {
  // Las celdas viven en FilaAvance.tsx y las montan las dos pantallas.
  for (const [nombre, src] of [['FichaCurso', CURSO], ['AvanceCurso', TABLA]] as const) {
    assert.match(src, /<CabezaAvance etapas=\{etapas\} \/>/, `${nombre} no usa la cabecera compartida`);
    assert.match(src, /<CeldasAvance etapas=\{etapas\} fila=\{/, `${nombre} no usa las celdas compartidas`);
  }
  assert.match(FILA, /\$\{c\.completa \? ' is-listo' : ''\}/, 'el verde de una etapa dejó de ser la regla que mueve al cliente');
  assert.doesNotMatch(FILA + TABLA, /enviadas >= c\.total/, 'volvió el «listo = envió todo»');
  // Los rótulos son los de lib/curso.ts, no una copia de la ficha.
  assert.doesNotMatch(LECTURA, /ROTULO_TAREA\s*[:=]/, 'la ficha volvió a tener su propio rótulo de tarea');
  // (Desde el paso 5 de #665 la misma línea trae también `ROTULO_PROPUESTA`: lo que se fija es que
  // el rótulo SALGA de lib/curso, no la lista exacta de lo que se importa. Probado rompiéndolo el
  // 07/10/2026: la ficha con su propio `const ROTULO_TAREA` y sin importarlo → 19 / 1; restaurado 20 / 0.)
  assert.match(CURSO, /import \{[^}]*\bROTULO_TAREA\b[^}]*\} from '@\/lib\/curso';/);
  assert.doesNotMatch(LECTURA, /'Sin medir'/, '«Sin medir» se escribe con ROTULO_SIN_MEDIR');
  // La tabla tiene la columna «Acceso» con su celda.
  assert.match(TABLA, /<th>Acceso<\/th>/);
  assert.match(TABLA, /<CeldaAcceso leadId=\{f\.leadId\}/);
});

test('la etapa BORRADA viaja de la base a la celda: la action la pide, la fila la pinta', () => {
  // Tres piezas, y sin cualquiera la ficha vuelve a marcar la primera etapa sobre un huérfano:
  // la action pide `ubicacionEnEntregaDe` (no `etapaActualDe`, que contesta «la primera»),
  // le pasa `borrada` a `armarProducto`, y la celda dice «Etapa borrada».
  const pc = ACC.slice(ACC.indexOf('async function productosConCurso('), ACC.indexOf('export async function cursoDeClienteAction('));
  assert.ok(pc.length > 200 && pc.length < 2500, `el recorte mide ${pc.length}: está mirando otra cosa`);
  assert.match(pc, /ubicacionEnEntregaDe\(leadId, c\.productoId, ids\)/);
  assert.doesNotMatch(pc, /etapaActualDe\(/, 'la ficha volvió a la regla del portal: marca la primera etapa sobre un huérfano');
  assert.match(pc, /etapaActual: actuales\[i\]\.etapa,\s*etapaBorrada: actuales\[i\]\.borrada,/);
  assert.match(FILA, /fila\.etapaBorrada \? <span className="av-mal">Etapa borrada<\/span>/, 'la celda no dice «Etapa borrada»');
  // Y UNA regla: `etapaActualDe` (portal, mensajes, paso automático) es `ubicacionEnEntregaDe`
  // menos el dato de la etapa borrada. Si fueran dos implementaciones, divergirían.
  const DATOS = sinComentarios(leer('lib/curso-datos.ts').replace(/\r\n/g, '\n'));
  assert.match(DATOS, /export async function etapaActualDe\([^)]*\): Promise<string \| null> \{\s*return \(await ubicacionEnEntregaDe\(leadId, productoId, productosYaLeidos\)\)\.etapa;\s*\}/);
  // «Borrada» sólo con el catálogo LEÍDO: con la lectura caída, cualquier clave declarada «no
  // está» en las etapas de fábrica, y la ficha acusaría una etapa borrada que no lo está.
  assert.match(DATOS, /borrada: fila && leida \? fila\.etapa : null/);
});

test('la fecha de la llamada sale del navegador YA en ISO, y vuelve a mostrarse en local', () => {
  assert.match(CURSO, /const iso = isoDeLocal\(cuando\);/);
  assert.match(CURSO, /agendarLlamadaCursoAction\(leadId, iso, /, 'se manda el ISO, nunca el valor crudo del input');
  assert.match(CURSO, /type="datetime-local"/);
  assert.match(CURSO, /fechaHoraLocal\(s\.fecha\)/, 'la lista la muestra en la hora de quien mira');
});

// ── Las roturas (06/10/2026), cada una restaurada de memoria ───────────────────
// Baseline: 14 pass / 0 fail. Cada fila dio 13 pass / 1 fail, en el test nombrado:
//   1. tablaDe sin `f[0] = etiqueta` (manda lo guardado)          → «una tabla con FILAS FIJAS…»
//   2. rotuloVisto sin la guarda de `duracionSeg` (pinta «0%»)     → «"sin medir" y "sin video"…»
//   3. resumenDeEtapa con `completa: enviadas === tareas`          → «"Completa" es la regla…»
//   4. armarProducto sin el grupo de las clases sueltas            → «el curso de un producto…»
//   5. isoDeLocal con `new Date(v + 'Z')` (lo lee como UTC)        → «el datetime-local…», también
//      corriendo con TZ=UTC (por eso el test fija Ciudad de México: sin eso, en UTC daba verde)
//   6. FichaCliente con el panel en `id="curso-ROTO"`              → «la ficha MONTA la pestaña Curso…»
//   7. curso-ficha-actions con `export const TOLERANCIA_PASADO_MS` → «…SÓLO exporta funciones async»
//   8. borrarLlamadaCursoAction sin la puerta                      → «cada action pasa por la PUERTA…»
//   9. FichaCurso sin llamar a `mandarLinkCursoAction`             → el mismo («no la llama nadie»)
//  10. FichaCurso mandando `cuando` (el valor crudo) y no `iso`    → «la fecha de la llamada sale…»
//  11. medicionDe con `v.hay ? 'medible'` (ignora si se mide)      → «"sin medir" y "sin video"…»
// Segunda tanda (baseline 18 pass / 0 fail; scratchpad u3-romper.mjs):
//  12. cursoDeClienteAction con `linkDeAcceso(leadId, ws)` al abrir → 17/1 «ABRIR la ficha no crea…»
//  13. FilaAvance con `c.enviadas >= c.total ? ' is-listo'`          → 17/1 «la ficha y la tabla dibujan la MISMA fila…»
//  14. resumenDeEtapa con `completa: k.enviadas === k.tareas`         → 16/2 «"Completa" es la regla…» y «la fila de Avance…»
//  15. armarProducto midiendo el visto de `keys[0]` y no de su etapa → 17/1 «la fila de Avance…» (con la etapa actual
//      en la PRIMERA, esta rotura daba 18/0: por eso el test pone al cliente en la segunda)
// Tercera tanda, la etapa BORRADA (06/10/2026). Corridos juntos con cs-mover-etapa, cs-acciones-puerta,
// cs-deshacer-reloj y nutricion-etapa: baseline 61 pass / 0 fail.
//  16. armarProducto con `const actual = p.etapaActual` (ignora la borrada) → 60/1 «un cliente en una etapa BORRADA…»
//  17. la fila de Avance sin `etapaBorrada`                                → 60/1 el mismo
//  18. productosConCurso con `etapaActualDe` y no `ubicacionEnEntregaDe`     → 60/1 «la etapa BORRADA viaja…»
//  19. FilaAvance sin la rama «Etapa borrada» (vuelve a «—»)               → 60/1 el mismo
//  20. `borrada: fila?.etapa ?? null` (acusa aunque el catálogo no se leyó) → 60/1 el mismo
//  Y la puerta de la ficha con la sesión y la capa a mano (sin `puedeUsarCs`) → 59/2: el de «cada action pasa por la
//  PUERTA…» de acá y el de tests/cs-acciones-puerta.test.ts.
