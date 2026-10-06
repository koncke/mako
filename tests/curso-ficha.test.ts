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
// que le toca. La tabla está al final del archivo.

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
  assert.deepEqual(r1, { clases: 2, tareas: 2, enviadas: 1, revisadas: 0, completa: true });
  assert.equal(fraseResumen(r1), '1/2 tareas');
  // Envió TODO pero ninguna es obligatoria: no se completa sola (lib/curso.ts).
  const r2 = resumenDeEtapa([ficha(clase(3, { tarea: 'z' }), prog(3, { estado: 'aprobada' }))]);
  assert.equal(r2.completa, false);
  assert.equal(r2.revisadas, 1);
  assert.equal(fraseResumen(r2), '1/1 tarea');
  assert.equal(fraseResumen(resumenDeEtapa([ficha(clase(4))])), 'Sin tareas');
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
const ACC_CRUDO = leer('app/customer-success/curso-ficha-actions.ts');
const ACC = sinComentarios(ACC_CRUDO);

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
  for (const n of nombres) {
    const ini = ACC.indexOf(`export async function ${n}(`);
    const fin = ACC.indexOf('export async function', ini + 10);
    const cuerpo = ACC.slice(ini, fin < 0 ? undefined : fin);
    assert.match(cuerpo, /const p = await puerta\(leadId\);\s*if \(!p\.ok\) return p;/, `${n} no pregunta la puerta`);
    // Una capacidad sin call site es una salida huérfana (AGENTS.md).
    assert.ok(new RegExp(`\\b${n}\\(`).test(CURSO), `${n} no la llama nadie en FichaCurso`);
  }
  // La puerta: sesión, capa y cliente GANADO de este workspace, en positivo.
  const puertaSrc = ACC.slice(ACC.indexOf('async function puerta('), ACC.indexOf('async function accesoActual('));
  assert.match(puertaSrc, /getRolWsEfectivo\(\)\) == null/);
  assert.match(puertaSrc, /tabEnCapa\('customer-success', await getCapaActual\(\)\)/);
  assert.match(puertaSrc, /\.eq\('id', leadId\)\.eq\('estado_lead', 'ganado'\)/);
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
