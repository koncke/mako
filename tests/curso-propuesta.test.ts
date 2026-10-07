// =============================================================================
// curso-propuesta — el PASO 5 de #665: la IA reescribe la tarea con lo hablado y el CLIENTE decide
// =============================================================================
// Lo que se EJECUTA: lib/curso-propuesta.ts (la forma de la salida, sobre qué se propone, de qué
// etapas, leer la salida del modelo), lib/curso-portal.ts (qué propuesta viaja a qué navegador) y
// app/customer-success/curso-ficha-lectura.ts (el chip del equipo).
// Lo que se LEE como fuente (sin comentarios): que aprobar sea compare-and-set EN EL WHERE, que
// proponer nunca escriba `valores`, que mandar su versión resuelva la propuesta, que la ruta apruebe
// detrás de todas sus puertas, y que la IA sea la gratis.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  validarPropuesta, candidatasDePropuesta, etapasDePropuesta, instanteDeSesion, leerPropuestas, propuestaDeFila,
  valoresAprobables, mismoInstante, bloqueRespuestas, PROPUESTA_SYSTEM_TEMPLATE, PROPUESTA_USER_TEMPLATE,
  type FilaRespuesta,
} from '../lib/curso-propuesta';
import { armarEtapas, propuestaVista } from '../lib/curso-portal';
import { propuestaDeClase, propuestasPendientes, type ClaseFicha } from '../app/customer-success/curso-ficha-lectura';
import type { Campo, Clase, Progreso, PropuestaIA } from '../lib/curso';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { CLAUDE_PERMITIDO } from '../lib/veto-claude';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
/** El cuerpo de una función, hasta la próxima declaración de primer nivel (no un número de caracteres). */
const cuerpoDe = (src: string, firma: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  const fin = src.slice(ini + firma.length).search(/\n(export |async function |function |const [A-Za-z_]+ = )/);
  return src.slice(ini, fin < 0 ? undefined : ini + firma.length + fin);
};

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: 'Contesta', campos: [], obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'enviada', enviadaAt: '2026-10-01T10:00:00Z', ...o,
});
const ia = (valores: PropuestaIA['valores'], estado: PropuestaIA['estado'] = 'pendiente'): PropuestaIA => ({
  valores, estado, desde: '2026-10-05T12:00:00.000Z', recordingId: 9, resueltaAt: null,
});

const CAMPOS: Campo[] = [
  { id: 'meta', label: 'Tu meta', tipo: 'texto', obligatorio: true },
  { id: 'canal', label: 'Canal', tipo: 'eleccion', opciones: ['Meta', 'Google'] },
  { id: 'dias', label: 'Días', tipo: 'checks', opciones: ['lun', 'mar', 'mie'] },
  { id: 'tabla', label: 'Números', tipo: 'tabla', columnas: ['Qué', 'Cuánto'], filasFijas: ['Ventas', 'Leads'] },
];
const ACTUAL = { meta: 'Vender más', canal: 'Meta', dias: ['lun'], tabla: [['Ventas', '10'], ['Leads', '']] };

// ── 1. La forma de lo que propone ────────────────────────────────────────────

test('la propuesta que cumple la forma se guarda, mezclada con lo que el cliente ya tenía', () => {
  const r = validarPropuesta(CAMPOS, ACTUAL, { meta: 'Vender 20% más en Q4', tabla: [['ventas', '12'], ['x', '300']] });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.valores.meta, 'Vender 20% más en Q4');
  // Lo que no mandó se queda como estaba.
  assert.equal(r.valores.canal, 'Meta');
  assert.deepEqual(r.valores.dias, ['lun']);
  // En una tabla de filas fijas, la etiqueta la pone el FORMULARIO, no el modelo.
  assert.deepEqual(r.valores.tabla, [['Ventas', '12'], ['Leads', '300']]);
});

test('LO QUE NO VALIDA NO SE GUARDA: clave ajena, otro tipo, opción inventada, tabla torcida', () => {
  const no = (raw: unknown, motivo: string, detalle?: string) => {
    const r = validarPropuesta(CAMPOS, ACTUAL, raw);
    assert.equal(r.ok, false, `debió rechazar ${JSON.stringify(raw)}`);
    if (r.ok) return;
    assert.equal(r.motivo, motivo, JSON.stringify(raw));
    if (detalle) assert.equal(r.detalle, detalle);
  };
  no('texto suelto', 'forma');
  no([{ meta: 'x' }], 'forma');
  no({ meta: 'x', presupuesto: '100' }, 'clave-ajena', 'presupuesto');
  no({ meta: ['una', 'lista'] }, 'forma', 'meta');
  no({ canal: 'TikTok' }, 'forma', 'canal');
  no({ dias: ['lun', 'dom'] }, 'forma', 'dias');
  no({ dias: 'lun' }, 'forma', 'dias');
  // Una celda LLENA de más es el modelo corrido de columna; una fija que falta, una tabla rota.
  no({ tabla: [['Ventas', '1', 'extra'], ['Leads', '2']] }, 'forma', 'tabla');
  no({ tabla: [['Ventas', '1']] }, 'forma', 'tabla');
  no({ tabla: [{ a: 1 }] }, 'forma', 'tabla');
});

test('un campo vacío en la propuesta NO borra lo del cliente, y lo que queda igual no es propuesta', () => {
  const r = validarPropuesta(CAMPOS, ACTUAL, { meta: '', canal: '', dias: [], tabla: [['Ventas', '10'], ['Leads', '7']] });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.valores.meta, 'Vender más');
    assert.equal(r.valores.canal, 'Meta');
    assert.deepEqual(r.valores.dias, ['lun']);
  }
  // Sólo espacios y mayúsculas: no cambió nada, no se le pide que apruebe nada.
  const igual = validarPropuesta(CAMPOS, ACTUAL, { meta: '  vender   MÁS ' });
  assert.deepEqual(igual, { ok: false, motivo: 'igual' });
});

test('una respuesta libre (clase sin formulario) se propone en «respuesta», y nada más', () => {
  assert.deepEqual(validarPropuesta([], { respuesta: 'Hola' }, { respuesta: 'Hola, con lo de la llamada' }), { ok: true, valores: { respuesta: 'Hola, con lo de la llamada' } });
  assert.equal(validarPropuesta([], { respuesta: 'Hola' }, { meta: 'x' }).ok, false);
});

test('aprobar exige que lo guardado siga alcanzando para enviar (Mauricio pudo cambiar el formulario)', () => {
  assert.deepEqual(valoresAprobables(CAMPOS, { meta: 'Vender', otra: 'se tira' }), { meta: 'Vender' });
  assert.equal(valoresAprobables(CAMPOS, { canal: 'Meta' }), null, 'sin la obligatoria no se aprueba');
  assert.equal(valoresAprobables(CAMPOS, null), null);
});

// ── 2. Sobre qué se propone ──────────────────────────────────────────────────

const SESION = Date.parse('2026-10-03T15:00:00Z');
const fila = (claseId: number, o: Partial<FilaRespuesta> = {}): FilaRespuesta => ({
  claseId, area: '', estado: 'enviada', enviadaAt: '2026-10-02T10:00:00Z', valores: { respuesta: 'Mi respuesta' }, updatedAt: '2026-10-02T10:00:00Z', ...o,
});

test('NO PROPONE SOBRE CLASES SIN RESPUESTA: sin fila, en borrador, vacía, o sin tarea', () => {
  const clases = [clase(1), clase(2), clase(3), clase(4), clase(5, { tarea: '' }), clase(6)];
  const filas = [
    fila(1),                                                   // enviada antes de la sesión → sí
    // Un borrador no es «lo que contestó» — aunque traiga fecha: lo que lo saca es el ESTADO.
    fila(2, { estado: 'pendiente' }),
    fila(3, { valores: {} }),                                   // enviada y vacía (pedido a mano)
    // la 4 no tiene fila: nunca la tocó
    fila(5),                                                   // la clase no pide nada
    fila(6, { estado: 'aprobada' }),                           // revisada por el equipo → sí
  ];
  const c = candidatasDePropuesta({ clases, filas, areas: [], sesionAt: SESION });
  assert.deepEqual(c.map((x) => x.clase.id), [1, 6]);
  // Y lleva el token del compare-and-set de su fila.
  assert.equal(c[0].updatedAt, '2026-10-02T10:00:00Z');
});

test('sólo lo ENVIADO ANTES de la sesión: lo que mandó después no se pudo hablar en ella', () => {
  const filas = [fila(1, { enviadaAt: '2026-10-03T16:00:00Z' }), fila(2, { enviadaAt: '2026-10-03T14:59:00Z' })];
  assert.deepEqual(candidatasDePropuesta({ clases: [clase(1), clase(2)], filas, areas: [], sesionAt: SESION }).map((x) => x.clase.id), [2]);
  // Sin fecha de la sesión no se propone nada.
  assert.deepEqual(candidatasDePropuesta({ clases: [clase(2)], filas, areas: [], sesionAt: NaN }), []);
  assert.equal(instanteDeSesion('2026-10-03T15:00:00Z', null), SESION);
  assert.equal(instanteDeSesion(null, '2026-10-03'), Date.parse('2026-10-03T23:59:59Z'));
  assert.ok(Number.isNaN(instanteDeSesion(null, null)));
});

test('una clase POR ÁREA: una por cada área declarada HOY; sin áreas, la del cliente', () => {
  const c = clase(7, { porArea: true });
  const filas = [fila(7, { area: 'Ventas' }), fila(7, { area: 'Vieja' }), fila(7, { area: 'Operación', estado: 'pendiente', enviadaAt: null }), fila(7)];
  assert.deepEqual(candidatasDePropuesta({ clases: [c], filas, areas: ['Ventas', 'Operación'], sesionAt: SESION }).map((x) => x.area), ['Ventas']);
  assert.deepEqual(candidatasDePropuesta({ clases: [c], filas, areas: [], sesionAt: SESION }).map((x) => x.area), ['']);
  // El tope.
  const muchas = Array.from({ length: 20 }, (_, i) => clase(100 + i));
  assert.equal(candidatasDePropuesta({ clases: muchas, filas: muchas.map((x) => fila(x.id)), areas: [], sesionAt: SESION, tope: 5 }).length, 5);
});

test('⚠️ LAS ETAPAS: la ANTERIOR y la actual — la llamada se agenda con la etapa completa', () => {
  // Completar la etapa pasa al cliente a la siguiente en el acto: en la llamada, su «actual» es la
  // nueva (vacía) y lo que se habla es lo de la que cerró. Con sólo la actual no se proponía nunca.
  assert.deepEqual(etapasDePropuesta(['a', 'b', 'c'], 'b'), ['a', 'b']);
  assert.deepEqual(etapasDePropuesta(['a', 'b', 'c'], 'a'), ['a']);
  assert.deepEqual(etapasDePropuesta(['a', 'b', 'c'], null), ['a']);
  assert.deepEqual(etapasDePropuesta(['a', 'b', 'c'], 'borrada'), ['a']);
  assert.deepEqual(etapasDePropuesta([], 'a'), []);
});

// ── 3. Lo que devuelve el modelo ─────────────────────────────────────────────

test('leer la salida: la lista es obligatoria, las entradas se sanean y la repetida no pisa', () => {
  const t = '```json\n{"propuestas":[{"clase":7,"area":"  Ventas ","valores":{"a":"1"}},{"clase":"7","area":"Ventas","valores":{"a":"2"}},{"clase":0,"valores":{}},{"clase":8,"area":3,"valores":{}},{"clase":9,"valores":{"b":"x"}}]}\n```';
  assert.deepEqual(leerPropuestas(t), [
    { clase: 7, area: 'Ventas', valores: { a: '1' } },
    { clase: 9, area: '', valores: { b: 'x' } },
  ]);
  assert.deepEqual(leerPropuestas('{"propuestas":[]}'), []);
  assert.throws(() => leerPropuestas('{"otra":1}'), /lista de propuestas/);
  assert.throws(() => leerPropuestas('no hay json'));
});

test('lo que se le pasa al modelo: cada respuesta con su clase, su área y su formulario', () => {
  const c = clase(7, { titulo: 'Palancas', campos: CAMPOS.slice(0, 2), porArea: true });
  const b = bloqueRespuestas([{ clase: c, area: 'Ventas', valores: { meta: 'X' }, updatedAt: 'u' }]);
  assert.match(b, /clase: 7 · area: "Ventas"/);
  assert.match(b, /"opciones":\["Meta","Google"\]/);
  assert.match(b, /Lo que contestó: \{"meta":"X"\}/);
});

// ── 4. Qué viaja a qué navegador ─────────────────────────────────────────────

test('⚠️ EL PORTAL NO MUESTRA PROPUESTAS DE OTRA ÁREA NI DE OTRO: al líder, sólo la de la suya', () => {
  const c = clase(7, { porArea: true, campos: [] });
  const porArea = new Map([[7, new Map([
    ['Ventas', prog(7, { valores: { respuesta: 'v' }, ia: ia({ respuesta: 'PROPUESTA-VENTAS' }) })],
    ['Operación', prog(7, { valores: { respuesta: 'o' }, ia: ia({ respuesta: 'PROPUESTA-OPERACION' }) })],
  ])]]);
  // La fila DEL CLIENTE de esa clase con una propuesta de antes de declarar áreas: tampoco es del líder.
  const progreso = new Map([[7, prog(7, { ia: ia({ respuesta: 'PROPUESTA-DEL-CLIENTE' }) })]]);
  const lider = JSON.stringify(armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', [c], progreso, { porArea, areas: ['Ventas', 'Operación'], lider: 'Ventas' }));
  assert.match(lider, /PROPUESTA-VENTAS/);
  assert.doesNotMatch(lider, /PROPUESTA-OPERACION/);
  assert.doesNotMatch(lider, /PROPUESTA-DEL-CLIENTE/);
  // Al cliente, cada propuesta en SU área, y ninguna suelta en la clase.
  const [e] = armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', [c], progreso, { porArea, areas: ['Ventas', 'Operación'] });
  const vista = e.clases[0];
  assert.equal(vista.ia, undefined);
  assert.deepEqual(vista.areas?.map((a) => a.ia?.valores.respuesta), ['PROPUESTA-VENTAS', 'PROPUESTA-OPERACION']);
});

test('sólo viaja una propuesta PENDIENTE, y sin de qué grabación salió', () => {
  const c = clase(1);
  const viaja = (p: Progreso) => armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', [c], new Map([[1, p]]))[0].clases[0];
  assert.deepEqual(viaja(prog(1, { ia: ia({ respuesta: 'x' }) })).ia, { valores: { respuesta: 'x' }, desde: '2026-10-05T12:00:00.000Z' });
  assert.equal(viaja(prog(1, { ia: ia({ respuesta: 'x' }, 'aprobada') })).ia, undefined);
  assert.equal(viaja(prog(1, { ia: ia({ respuesta: 'x' }, 'corregida') })).ia, undefined);
  assert.equal(viaja(prog(1, { ia: null })).ia, undefined);
  assert.equal(propuestaVista(undefined), undefined);
  // Y lo que NO tiene propuesta sigue con su lista blanca de siempre (tests/curso-portal.test.ts).
  assert.ok(!('ia' in viaja(prog(1))));
});

test('la propuesta se lee a la defensiva: un jsonb o un estado que no cierran no se dibujan', () => {
  assert.deepEqual(propuestaDeFila({ valores_ia: { a: '1' }, ia_estado: 'pendiente', ia_propuesta_at: 'T', ia_recording_id: '9', ia_resuelta_at: null }),
    { valores: { a: '1' }, estado: 'pendiente', desde: 'T', recordingId: 9, resueltaAt: null });
  assert.equal(propuestaDeFila({ valores_ia: { a: '1' }, ia_estado: 'otra', ia_propuesta_at: 'T' }), null);
  assert.equal(propuestaDeFila({ valores_ia: ['a'], ia_estado: 'pendiente', ia_propuesta_at: 'T' }), null);
  assert.equal(propuestaDeFila({ valores_ia: null, ia_estado: null, ia_propuesta_at: null }), null);
  // El token se compara por INSTANTE: PostgREST lo devuelve con +00:00 y microsegundos.
  assert.equal(mismoInstante('2026-10-05T12:00:00.123+00:00', '2026-10-05T12:00:00.123Z'), true);
  assert.equal(mismoInstante('2026-10-05T12:00:00.123+00:00', '2026-10-05T12:00:01.123Z'), false);
  assert.equal(mismoInstante('basura', 'basura'), false);
});

test('el equipo ve en la ficha qué propuestas esperan y cuáles aprobó', () => {
  const cf = (o: Partial<ClaseFicha>): ClaseFicha => ({
    id: 1, etapa: 'e1', orden: 1, titulo: 'C', tipo: 'clase', minutos: null, tarea: 'x', campos: [], obligatoria: false,
    medicion: 'sin-video', progreso: null, ...o,
  });
  assert.equal(propuestaDeClase(cf({ progreso: prog(1, { ia: ia({}, 'aprobada') }) })), 'aprobada');
  assert.equal(propuestaDeClase(cf({ progreso: prog(1) })), null);
  // Por área: una pendiente gana.
  const porArea = [
    { area: 'A', progreso: prog(1, { ia: ia({}, 'aprobada') }), vigente: true },
    { area: 'B', progreso: prog(1, { ia: ia({}, 'pendiente') }), vigente: true },
  ];
  assert.equal(propuestaDeClase(cf({ porArea })), 'pendiente');
  assert.equal(propuestasPendientes([cf({ porArea }), cf({ progreso: prog(1, { ia: ia({}, 'corregida') }) })]), 1);
});

// ── 5. Las escrituras (fuente sin comentarios) ───────────────────────────────

const DATOS = leer('lib/curso-datos.ts');

test('⚠️ APROBAR ES COMPARE-AND-SET EN EL WHERE: pendiente, la misma que vio, de ESE cliente y área', () => {
  const f = cuerpoDe(DATOS, 'export async function aprobarPropuestaIA(');
  const update = f.slice(f.indexOf('.update('), f.indexOf('.select(', f.indexOf('.update(')));
  assert.ok(update.length > 50, 'no encontré el update de aprobarPropuestaIA');
  for (const filtro of [".eq('lead_id', leadId)", ".eq('clase_id', clase.id)", ".eq('area', area)", ".eq('ia_estado', 'pendiente')", ".eq('ia_propuesta_at', p.ia_propuesta_at)"]) {
    assert.ok(update.includes(filtro), `el update de aprobar no filtra ${filtro}: dos pedidos o una propuesta nueva lo pisarían`);
  }
  // Y lo que pidió el navegador se compara con lo leído ANTES de escribir.
  assert.match(f, /if \(!p \|\| p\.ia_estado !== 'pendiente' \|\| !p\.ia_propuesta_at \|\| !mismoInstante\(p\.ia_propuesta_at, desde\)\) return null;/);
  // El resultado sale de las filas que tocó el update: sin fila, no se aprobó nada.
  assert.match(f, /return fila \? aProgreso\(fila\) : null;/);
});

test('⚠️ PROPONER NUNCA ESCRIBE `valores`, y lo hace con compare-and-set sobre la respuesta que leyó', () => {
  const f = cuerpoDe(DATOS, 'export async function guardarPropuestaIA(');
  const objeto = f.slice(f.indexOf('.update({'), f.indexOf('})', f.indexOf('.update({')));
  assert.match(objeto, /valores_ia: valores/);
  // `valores` como CLAVE, también en forma corta (`{ valores, … }`): la primera versión de este guard
  // buscaba sólo `valores:` y dio VERDE sobre `.update({ valores, valores_ia: valores, … })`.
  assert.doesNotMatch(objeto, /[{,]\s*valores\s*[:,}]/, 'proponer escribe `valores`: le pisa lo que contestó');
  assert.match(f, /\.eq\('updated_at', baseUpdatedAt\)/);
  assert.match(f, /\.in\('estado', \['enviada', 'aprobada'\]\)/);
});

test('mandar SU versión resuelve la propuesta pendiente (la «corrigió»)', () => {
  const f = cuerpoDe(DATOS, 'export async function guardarTarea(');
  assert.match(f, /if \(pasaAEnviada\) \{\s*const \{ error: errIa \} = await db\.from\('curso_progreso'\)\s*\.update\(\{ ia_estado: 'corregida', ia_resuelta_at: ahora \}\)\s*\.eq\('lead_id', leadId\)\.eq\('clase_id', clase\.id\)\.eq\('area', area\)\s*\.eq\('ia_estado', 'pendiente'\);/);
});

test('la ruta aprueba DETRÁS de todas sus puertas, con el lead y el área del ACCESO', () => {
  const src = leer('app/api/compartido/curso/tarea/route.ts');
  const iAprobar = src.indexOf('aprobarPropuestaIA(');
  assert.ok(iAprobar > 0);
  for (const antes of ['resolverAccesoPortal(', 'claseDelAlumno(', 'tieneTarea(', 'areaDeLaTarea(', 'if (area == null) return NO();']) {
    const i = src.indexOf(antes);
    assert.ok(i > 0 && i < iAprobar, `${antes} tiene que correr antes de aprobar`);
  }
  assert.ok(iAprobar < src.indexOf('guardarTarea('), 'aprobar no pasa por guardar');
  assert.match(src, /aprobarPropuestaIA\(acceso\.leadId, r\.clase, area, b\.aprobar\)/);
  assert.match(src, /if \(!aprobada\) return Response\.json\(\{ ok: false, error: 'ya no está' \}, \{ status: 409/);
});

test('el portal y la ficha leen la propuesta con el lead de la firma (avanceDelCliente)', () => {
  const f = cuerpoDe(DATOS, 'export async function avanceDelCliente(');
  assert.match(f, /\.select\(COLS_PROGRESO_IA\)\.eq\('lead_id', leadId\)/);
  assert.match(DATOS, /const COLS_PROGRESO_IA = `\$\{COLS_PROGRESO\}, valores_ia, ia_estado, ia_recording_id, ia_propuesta_at, ia_resuelta_at`;/);
});

// ── 6. La IA, gratis; el disparo, sin mensajes ───────────────────────────────

const IA = leer('lib/curso-propuesta-ia.ts');

test('la IA es la gratis: cs-propuesta-curso en Gemini, sin degradarse y sin permiso de pagar Claude', () => {
  const f = CATALOGO_MODELOS.find((x) => x.feature === 'cs-propuesta-curso');
  assert.ok(f, 'cs-propuesta-curso no está en el catálogo: el veto la cortaría muda');
  assert.equal(f!.def.provider, 'gemini');
  assert.deepEqual(f!.fallback, []);
  assert.ok(!f!.pagoPorque);
  assert.ok(!CLAUDE_PERMITIDO.some((p) => p.feature === 'cs-propuesta-curso'));
  assert.match(IA, /export const FEATURE_PROPUESTA = 'cs-propuesta-curso';/);
  const llamada = IA.slice(IA.indexOf('await chatClaude('), IA.indexOf('});', IA.indexOf('await chatClaude(')));
  assert.match(llamada, /feature: FEATURE_PROPUESTA,/);
  assert.match(llamada, /sinRespaldoDeModelo: true,/);
  assert.match(llamada, /hastaMs: Math\.min\(Date\.now\(\) \+ PRESUPUESTO_IA_MS, deadline - MARGEN_ESCRITURA_MS\),/);
  assert.doesNotMatch(IA, /\bmodel\s*:\s*['"`]claude/);
});

test('el disparo no le escribe a nadie y marca la sesión ANTES de llamar a la IA', () => {
  assert.doesNotMatch(IA, /evolution|enviarWhatsapp|mandarWhatsapp|sendEmail|emitirAviso|curso-mensajes|curso-avance/i);
  const pasada = cuerpoDe(IA, 'export async function proponerPendientes(');
  const marca = pasada.indexOf("await marcar(s.recording_id, 'en curso')");
  const propone = pasada.indexOf('await proponerSobre(');
  assert.ok(marca > 0 && propone > marca, 'la sesión se marca (compare-and-set) antes de pedirle a la IA');
  assert.match(cuerpoDe(IA, 'async function marcar('), /\.is\('curso_propuesta_at', null\)/);
  // Y el análisis no se entera de un fallo de la pasada: lib/closing-entrega.ts la envuelve.
  const CE = leer('lib/closing-entrega.ts');
  assert.match(cuerpoDe(CE, 'async function pasadaDePropuestas('), /try \{\s*return await proponerPendientes\(\{ deadline, cache \}\);\s*\} catch/);
});

test('el prompt es EDITABLE, no nombra a nadie y pide lo que el código sabe leer', () => {
  const REG = leer('lib/prompt-registry.ts');
  for (const key of ['curso.propuesta.system', 'curso.propuesta.user']) {
    assert.match(REG, new RegExp(`key: '${key.replace(/\./g, '\\.')}'`), `${key} no está en el registro`);
    assert.ok(IA.includes(`'${key}'`), `${key} no se lee en lib/curso-propuesta-ia.ts`);
  }
  for (const slot of ['metadatos', 'resumen', 'respuestas', 'transcript']) {
    assert.ok(PROPUESTA_USER_TEMPLATE.includes(`{{${slot}}}`), `falta {{${slot}}}`);
    assert.match(IA, new RegExp(`\\b${slot}\\b[:,]`), `el render no llena {{${slot}}}`);
  }
  const NOMBRES = /mauricio|bustos|leila|mart[ií]n|koncke|c[oó]digo inmobiliario|elevate/i;
  for (const t of [PROPUESTA_SYSTEM_TEMPLATE, PROPUESTA_USER_TEMPLATE]) {
    assert.doesNotMatch(t, NOMBRES);
    assert.ok(!t.includes('`') && !t.includes('${'));
  }
  for (const k of ['"propuestas"', '"clase"', '"area"', '"valores"']) assert.ok(PROPUESTA_SYSTEM_TEMPLATE.includes(k), `el prompt no pide ${k}`);
});

test('el navegador importa SÓLO TIPOS de lib/curso-propuesta (trae los prompts)', () => {
  const archivos: string[] = [];
  const bajar = (d: string) => {
    for (const e of readdirSync(join(RAIZ, d), { withFileTypes: true })) {
      const r = `${d}/${e.name}`;
      if (e.isDirectory()) bajar(r);
      else if (/\.tsx?$/.test(e.name)) archivos.push(r);
    }
  };
  bajar('app');
  let vistos = 0;
  for (const f of archivos) {
    const src = leer(f);
    if (!/^\s*['"]use client['"]/.test(src)) continue;
    vistos++;
    for (const m of src.matchAll(/import\s+(type\s+)?[^;]*?from\s+['"]@\/lib\/curso-propuesta(-ia)?['"]/g)) {
      assert.ok(m[1], `${f} importa un VALOR de lib/curso-propuesta`);
    }
  }
  assert.ok(vistos > 50, `barrí ${vistos} componentes de cliente`);
});

// PROBADO ROMPIÉNDOLO (07/10/2026, scratchpad/propuesta-roturas.mjs: rompe una cosa por vez y
// restaura de MEMORIA, nunca con git). Con todo en su lugar: 24 pass / 0 fail. Diecinueve roturas,
// y cada una tumba SU test (23 / 1, salvo la 1):
//    1. una clave que el formulario no tiene, aceptada (22 / 2)   → «LO QUE NO VALIDA…» y «respuesta libre»
//    2. una elección sin mirar sus opciones                      → «LO QUE NO VALIDA…»
//    3. un campo vacío de la IA borra lo del cliente              → «un campo vacío NO borra…»
//    4. proponer sobre un borrador (sin mirar el estado)          → «NO PROPONE SOBRE CLASES SIN RESPUESTA»
//    5. proponer sobre lo enviado DESPUÉS de la sesión            → «sólo lo ENVIADO ANTES…»
//    6. sólo la etapa actual                                      → «LAS ETAPAS…»
//    7. lo que quedó igual cuenta como propuesta                  → «un campo vacío NO borra… y lo igual…»
//    8. una entrada repetida del modelo pisa a la primera         → «leer la salida…»
//    9. aprobar sin el compare-and-set en el WHERE                → «APROBAR ES COMPARE-AND-SET…»
//   10. proponer escribe `valores` en forma corta                 → «PROPONER NUNCA ESCRIBE…» (dio VERDE con
//       la primera versión del guard, que buscaba sólo `valores:`; ver el comentario de ese test)
//   11. proponer sin el compare-and-set sobre `updated_at`        → «PROPONER NUNCA ESCRIBE…»
//   12. mandar su versión no resuelve la propuesta                → «mandar SU versión…»
//   13. la propuesta de la fila del CLIENTE viaja al líder        → «EL PORTAL NO MUESTRA…»
//   14. la propuesta de OTRA área viaja al líder                  → «EL PORTAL NO MUESTRA…»
//   15. viaja una propuesta ya aprobada                           → «sólo viaja una PENDIENTE…»
//   16. la ruta aprueba el área que manda el pedido               → «la ruta aprueba DETRÁS…»
//   17. marcar la sesión sin compare-and-set                      → «el disparo no le escribe a nadie…»
//   18. la feature sin `fallback: []`                             → «la IA es la gratis…»
//   19. la ficha prefiere «aprobada» a «pendiente»                → «el equipo ve en la ficha…»
// Restaurado: 24 / 0.
