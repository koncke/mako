// =============================================================================
// curso-por-area — #665: el link de agenda con la etapa completa, la tarea POR ÁREA y el link del
// LÍDER de área (mig 0212)
// =============================================================================
// Lo que se EJECUTA: las reglas puras de lib/curso.ts (áreas, progreso efectivo), lib/curso-portal.ts
// (qué clase se le abre a quién, de qué área es una tarea, qué viaja al navegador), lib/curso-acceso.ts
// (el token `c2.` del líder), lib/servicio-etapas.ts (el link de agenda) y el texto del mail del líder.
// Lo que se LEE como fuente (sin comentarios): que los targets de los upsert de lib/curso-datos.ts
// sean los índices de la 0212, y que las lecturas que dan el acceso DEL CLIENTE filtren `area is null`.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  areasDelCliente, estadoDeAreas, progresoEfectivo, etapaCompleta, nombreDeArea, CAMPO_AREAS,
  type Clase, type Progreso,
} from '../lib/curso';
import { decidirClase, areaDeLaTarea, armarEtapas } from '../lib/curso-portal';
import { firmarAccesoCurso, leerAccesoCurso, firmarAccesoLider, leerAccesoLider, leerTokenPortal } from '../lib/curso-acceso';
import { firmarSesionAlumno, leerSesionAlumno } from '../lib/alumno-sesion';
import { agendaValida, normalizarEtapas } from '../lib/servicio-etapas';
import { textoInvitacionLider } from '../lib/invitacion-aviso';
import { programaNqe, FORMULARIOS_POR_AREA } from '../lib/curso-programa-nqe';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
/** El cuerpo de una función de un fuente, hasta la próxima declaración de primer nivel. */
const cuerpoDe = (src: string, firma: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré «${firma}»`);
  const fin = src.slice(ini + firma.length).search(/\n(export |async function |function |const [A-Za-z_]+ = )/);
  return src.slice(ini, fin < 0 ? undefined : ini + firma.length + fin);
};

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});
const porArea = (filas: Array<[number, string, Partial<Progreso>]>) => {
  const m = new Map<number, Map<string, Progreso>>();
  for (const [id, area, o] of filas) {
    if (!m.has(id)) m.set(id, new Map());
    m.get(id)!.set(area, prog(id, o));
  }
  return m;
};

// ── Las áreas del cliente ─────────────────────────────────────────────────────

test('las áreas salen de la PRIMERA columna de su tabla, en su orden, sin repetir ni vacías', () => {
  const tabla = [['Ventas', 'Ana'], ['  Operación   y logística ', 'Beto'], ['ventas', 'otra vez'], ['', 'nadie'], ['Operacion y logistica', 'x'], ['Finanzas']];
  assert.deepEqual(areasDelCliente([{ claseId: 5, valores: { [CAMPO_AREAS]: tabla } }]), ['Ventas', 'Operación y logística', 'Finanzas']);
  // Otro campo, o la tabla vacía: no hay áreas.
  assert.deepEqual(areasDelCliente([{ claseId: 5, valores: { otra: tabla } }]), []);
  assert.deepEqual(areasDelCliente([]), []);
  // El nombre es una CLAVE: se normaliza igual en todos lados.
  assert.equal(nombreDeArea('  Ventas   y  Mkt '), 'Ventas y Mkt');
  assert.equal(nombreDeArea(42), '');
});

test('el campo de las áreas de la semilla es la tabla de m1c2, con el área en la primera columna', () => {
  const m1c2 = programaNqe().find((c) => c.origen === 'catalogo:m1c2')!;
  const campo = m1c2.campos.find((c) => c.id === CAMPO_AREAS);
  assert.ok(campo, `m1c2 ya no tiene «${CAMPO_AREAS}»: ningún cliente tendría áreas`);
  assert.equal(campo!.tipo, 'tabla');
  assert.equal(campo!.columnas?.[0], 'Área o función');
});

// ── El progreso que cuenta ────────────────────────────────────────────────────

test('una clase por área está enviada sólo cuando la enviaron TODAS sus áreas', () => {
  const areas = ['Ventas', 'Operación'];
  const ids = new Set([7]);
  const una = progresoEfectivo(new Map(), porArea([[7, 'Ventas', { estado: 'enviada', enviadaAt: '2026-10-06T10:00:00Z' }]]), ids, areas);
  assert.equal(una.get(7)?.estado, 'pendiente', 'falta Operación');
  assert.equal(una.get(7)?.enviadaAt, null);
  const todas = progresoEfectivo(new Map(), porArea([
    [7, 'Ventas', { estado: 'aprobada', enviadaAt: '2026-10-06T10:00:00Z' }],
    [7, 'Operación', { estado: 'enviada', enviadaAt: '2026-10-07T10:00:00Z' }],
  ]), ids, areas);
  assert.equal(todas.get(7)?.estado, 'enviada');
  assert.equal(todas.get(7)?.enviadaAt, '2026-10-07T10:00:00Z', 'la fecha es la de la ÚLTIMA área');
  assert.equal(estadoDeAreas(['aprobada', 'aprobada']), 'aprobada');
  assert.equal(estadoDeAreas([]), 'pendiente');
});

test('un área que ya no está en su tabla no cuenta; sin áreas, se contesta una vez como antes', () => {
  const ids = new Set([7]);
  const vieja = porArea([[7, 'Ventas', { estado: 'enviada' }]]);
  // Sin nada en las áreas que cuentan, la clase queda como «nunca tocada» (no está en el mapa).
  assert.equal(progresoEfectivo(new Map(), vieja, ids, ['Comercial']).get(7)?.estado, undefined);
  assert.equal(progresoEfectivo(new Map(), vieja, ids, ['Comercial', 'Ventas']).get(7)?.estado, 'pendiente');
  // Sin áreas declaradas, la fila del cliente manda (también la de una clase por área).
  const propia = new Map([[7, prog(7, { estado: 'enviada', valores: { respuesta: 'hecho' } })]]);
  assert.deepEqual(progresoEfectivo(propia, vieja, ids, []).get(7), propia.get(7));
  // Una clase que NO es por área no se toca aunque tenga filas de área.
  const otra = new Map([[8, prog(8, { estado: 'enviada' })]]);
  assert.equal(progresoEfectivo(otra, porArea([[8, 'Ventas', {}]]), ids, ['Ventas']).get(8)?.estado, 'enviada');
});

test('etapaCompleta con el progreso efectivo: una obligatoria por área exige TODAS las áreas', () => {
  const clases = [clase(1, { obligatoria: true, tarea: 'hazlo', porArea: true })];
  const areas = ['Ventas', 'Operación'];
  const ids = new Set([1]);
  const parcial = progresoEfectivo(new Map(), porArea([[1, 'Ventas', { estado: 'enviada' }]]), ids, areas);
  assert.equal(etapaCompleta(clases, (id) => parcial.get(id)?.estado), false);
  const llena = progresoEfectivo(new Map(), porArea([[1, 'Ventas', { estado: 'enviada' }], [1, 'Operación', { estado: 'enviada' }]]), ids, areas);
  assert.equal(etapaCompleta(clases, (id) => llena.get(id)?.estado), true);
  // La fila vieja del cliente (antes de marcarla por área) no la cierra por su cuenta.
  const conVieja = progresoEfectivo(new Map([[1, prog(1, { estado: 'enviada' })]]), new Map(), ids, areas);
  assert.equal(etapaCompleta(clases, (id) => conVieja.get(id)?.estado), false);
});

// ── Qué se le abre al LÍDER ───────────────────────────────────────────────────

test('el líder sólo abre clases POR ÁREA: cualquier otra es un 404, igual que una ajena', () => {
  const comun = clase(5, { productoId: 7 });
  const deArea = clase(6, { productoId: 7, porArea: true });
  assert.equal(decidirClase(comun, [7], 'actual', true, 'Ventas'), 'no-existe');
  assert.equal(decidirClase(deArea, [7], 'actual', true, 'Ventas'), 'ok');
  assert.equal(decidirClase(deArea, [7], 'bloqueada', true, 'Ventas'), 'bloqueada', 'la etapa manda igual');
  assert.equal(decidirClase(deArea, [8], 'actual', true, 'Ventas'), 'no-existe', 'de otro producto');
  // El cliente abre las dos.
  assert.equal(decidirClase(comun, [7], 'actual', true), 'ok');
  assert.equal(decidirClase(deArea, [7], 'actual', true, null), 'ok');
});

test('de qué área es la tarea: el líder escribe SIEMPRE la suya; el cliente, una de las que declaró', () => {
  const deArea = clase(6, { porArea: true });
  const comun = clase(5);
  const areas = ['Ventas', 'Operación'];
  // Líder: lo que mande el pedido no cuenta.
  assert.equal(areaDeLaTarea(deArea, { area: 'Ventas' }, 'Operación', areas), 'Ventas');
  assert.equal(areaDeLaTarea(comun, { area: 'Ventas' }, '', areas), null, 'un líder no escribe una clase común');
  // Cliente, en una por área.
  assert.equal(areaDeLaTarea(deArea, { area: null }, 'Operación', areas), 'Operación');
  assert.equal(areaDeLaTarea(deArea, { area: null }, 'Inventada', areas), null, 'un área que no declaró');
  assert.equal(areaDeLaTarea(deArea, { area: null }, undefined, areas), null, 'con áreas, la suya sola no');
  assert.equal(areaDeLaTarea(deArea, { area: null }, undefined, []), '', 'sin áreas, se contesta una vez');
  // Cliente, en una común: la suya, y ningún área.
  assert.equal(areaDeLaTarea(comun, { area: null }, undefined, areas), '');
  assert.equal(areaDeLaTarea(comun, { area: null }, 'Ventas', areas), null);
});

test('el portal del líder: sólo sus clases, sólo su área, y nada del cliente ni de otra área', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Dos' }];
  const clases = [
    clase(1, { etapa: 'e1', tarea: 'del dueño', obligatoria: true }),
    clase(2, { etapa: 'e1', tarea: 'por área', porArea: true }),
    clase(3, { etapa: 'e2', tarea: 'sólo del dueño' }),
  ];
  const pa = porArea([[2, 'Ventas', { valores: { respuesta: 'LO-DE-VENTAS' } }], [2, 'Operación', { estado: 'enviada', valores: { respuesta: 'LO-DE-OPERACION' } }]]);
  const progreso = new Map([[1, prog(1, { valores: { respuesta: 'LO-DEL-DUENO' } })], [2, prog(2, { valores: { respuesta: 'VIEJO-DEL-DUENO' } })]]);
  const vista = armarEtapas(etapas, 'e1', clases, progreso, { porArea: pa, areas: ['Ventas', 'Operación'], lider: 'Ventas' });
  assert.deepEqual(vista.map((e) => e.key), ['e1'], 'una etapa sin clases por área no se manda');
  assert.deepEqual(vista[0].clases.map((c) => c.id), [2]);
  assert.deepEqual(vista[0].clases[0].areas?.map((a) => a.area), ['Ventas']);
  assert.equal(vista[0].clases[0].estado, 'pendiente', 'el chip es el de SU área');
  const json = JSON.stringify(vista);
  for (const ajeno of ['LO-DE-OPERACION', 'LO-DEL-DUENO', 'VIEJO-DEL-DUENO', 'del dueño']) {
    assert.ok(!json.includes(ajeno), `al líder le viajó «${ajeno}»`);
  }
  assert.ok(json.includes('LO-DE-VENTAS'));
});

test('el portal del cliente: una tarea por área en las clases por área, y las comunes como siempre', () => {
  const clases = [clase(1, { tarea: 'común' }), clase(2, { tarea: 'por área', porArea: true })];
  const pa = porArea([[2, 'Ventas', { estado: 'enviada' }]]);
  const progreso = progresoEfectivo(new Map(), pa, new Set([2]), ['Ventas', 'Operación']);
  const [e] = armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', clases, progreso, { porArea: pa, areas: ['Ventas', 'Operación'] });
  const [comun, deArea] = e.clases;
  assert.equal(comun.areas, undefined);
  assert.deepEqual(deArea.areas?.map((a) => [a.area, a.estado]), [['Ventas', 'enviada'], ['Operación', 'pendiente']]);
  assert.equal(deArea.estado, 'pendiente', 'el de TODAS');
  assert.deepEqual(deArea.valores, {}, 'con áreas, lo contestado viaja por área');
});

// ── El link de agenda ─────────────────────────────────────────────────────────

const AGENDA = 'https://calendly.com/mauricio/sesion-norte';

test('el link de agenda NO viaja con la etapa incompleta, y sí con la etapa completa', () => {
  const etapas = [{ key: 'e1', label: 'Uno', agendaUrl: AGENDA }, { key: 'e2', label: 'Dos' }];
  const clases = [clase(1, { etapa: 'e1', tarea: 'hazlo', obligatoria: true }), clase(2, { etapa: 'e2', tarea: 'x' })];
  const incompleta = armarEtapas(etapas, 'e1', clases, new Map([[1, prog(1, { estado: 'pendiente' })]]));
  assert.ok(!JSON.stringify(incompleta).includes('calendly'), 'el link viajó antes de completar la etapa');
  assert.ok(!('agendaUrl' in incompleta[0]));
  // La completó (y el paso automático lo pasó a la siguiente): la etapa queda «hecha» con su link.
  const completa = armarEtapas(etapas, 'e2', clases, new Map([[1, prog(1, { estado: 'enviada' })]]));
  assert.equal(completa[0].agendaUrl, AGENDA);
  assert.ok(!('agendaUrl' in completa[1]), 'una etapa sin link no inventa uno');
});

test('el link de agenda: nunca al líder, nunca sin obligatorias, nunca en una etapa bloqueada, nunca sin https', () => {
  const clases = [clase(1, { etapa: 'e1', tarea: 'hazlo', obligatoria: true, porArea: true })];
  const listo = new Map([[1, prog(1, { estado: 'enviada' })]]);
  const deLider = armarEtapas([{ key: 'e1', label: 'Uno', agendaUrl: AGENDA }], 'e1', clases, listo,
    { porArea: porArea([[1, 'Ventas', { estado: 'enviada' }]]), areas: ['Ventas'], lider: 'Ventas' });
  assert.ok(!JSON.stringify(deLider).includes('calendly'), 'al líder le viajó la agenda del cliente');
  const sinObligatorias = armarEtapas([{ key: 'e1', label: 'Uno', agendaUrl: AGENDA }], 'e1', [clase(1, { tarea: 'x' })], listo);
  assert.ok(!('agendaUrl' in sinObligatorias[0]), 'una etapa sin obligatorias no se completa sola');
  const bloqueada = armarEtapas([{ key: 'e0', label: 'Cero' }, { key: 'e1', label: 'Uno', agendaUrl: AGENDA }], 'e0', clases, listo);
  assert.ok(!('agendaUrl' in bloqueada[1]));
  const http = armarEtapas([{ key: 'e1', label: 'Uno', agendaUrl: 'http://calendly.com/x' }], 'e1', clases, listo);
  assert.ok(!('agendaUrl' in http[0]));
});

test('agendaValida: sólo https, sin usuario ni clave adentro, y con tope', () => {
  assert.equal(agendaValida(' https://calendly.com/x/30min '), 'https://calendly.com/x/30min');
  for (const malo of ['http://calendly.com/x', 'javascript:alert(1)', 'calendly.com/x', 'https://u:p@calendly.com/x', 'https://localhost/x', '', 42, `https://calendly.com/${'x'.repeat(600)}`]) {
    assert.equal(agendaValida(malo), null, String(malo).slice(0, 40));
  }
});

test('el link de agenda sobrevive al saneo de las etapas (el data se guarda ENTERO), y uno roto se cae', () => {
  const [a, b] = normalizarEtapas([
    { key: 'uno', label: 'Uno', tone: 'info', dot: '#000', agendaUrl: AGENDA },
    { key: 'dos', label: 'Dos', tone: 'info', dot: '#000', agendaUrl: 'javascript:alert(1)' },
  ])!;
  assert.equal(a.agendaUrl, AGENDA);
  assert.ok(!('agendaUrl' in b));
});

// ── El token del líder ────────────────────────────────────────────────────────

const S = 'secreto-de-prueba-del-lider';

test('el token del líder: ida y vuelta con su prefijo, y no se puede torcer', () => {
  const t = firmarAccesoLider({ ws: 1, leadId: 42, acceso: 9, version: 2 }, S)!;
  assert.match(t, /^c2\.1\.42\.9\.2\./);
  assert.deepEqual(leerAccesoLider(t, S), { ws: 1, leadId: 42, acceso: 9, version: 2 });
  const ult = t.slice(-1) === 'A' ? 'B' : 'A';
  assert.equal(leerAccesoLider(t.slice(0, -1) + ult, S), null);
  assert.equal(leerAccesoLider(t, 'otro'), null);
  assert.equal(leerAccesoLider(t.replace(/^c2\.1\./, 'c2.9.'), S), null, 'el mismo acceso en otro workspace');
  assert.equal(leerAccesoLider(t.replace(/^c2\.1\.42\.9\./, 'c2.1.42.10.'), S), null, 'otra fila de acceso');
  assert.equal(firmarAccesoLider({ ws: 1, leadId: 42, acceso: 9, version: 1 }, ''), null);
});

test('el token del líder NO sirve como el del cliente ni como su cookie, y al revés', () => {
  const lider = firmarAccesoLider({ ws: 1, leadId: 42, acceso: 9, version: 1 }, S)!;
  const cliente = firmarAccesoCurso({ ws: 1, leadId: 42, version: 1 }, S)!;
  const cookie = firmarSesionAlumno({ ws: 1, leadId: 42, version: 1 }, S)!;
  // Lo que da la cookie del CLIENTE (la entrada del mail, /mi-curso) no lee un c2.
  assert.equal(leerAccesoCurso(lider, S), null);
  assert.equal(leerSesionAlumno(lider, S), null);
  // Y el lector del líder no lee ni el link del cliente ni su cookie.
  assert.equal(leerAccesoLider(cliente, S), null);
  assert.equal(leerAccesoLider(cookie, S), null);
  // La cookie del alumno firma CUATRO números (ws, lead, versión, vencimiento), igual que el c2.
  // (ws, lead, acceso, versión): sin un namespace propio, su firma serviría para armar un c2. a
  // mano con los mismos números. Con el suyo, no.
  const [, cw, cl, cv, cexp, cfirma] = firmarSesionAlumno({ ws: 1, leadId: 42, version: 9 }, S)!.split('.');
  assert.equal(leerAccesoLider(`c2.${cw}.${cl}.${cv}.${cexp}.${cfirma}`, S), null, 'la firma de la cookie sirvió como la de un líder');
  // El portal lee los dos, y dice cuál es cuál.
  assert.deepEqual(leerTokenPortal(cliente, S), { ws: 1, leadId: 42, version: 1, acceso: null });
  assert.deepEqual(leerTokenPortal(lider, S), { ws: 1, leadId: 42, version: 1, acceso: 9 });
  assert.equal(leerTokenPortal(cookie, S), null, 'la cookie no abre el portal por la URL');
});

// ── La base y el código dicen lo mismo ────────────────────────────────────────

const MIG = sinComentarios(readFileSync(join(RAIZ, 'supabase/migrations/0212_curso_por_area.sql'), 'utf8')).replace(/^\s*--.*$/gm, '');
const DATOS = leer('lib/curso-datos.ts');

test('los targets de los upsert son los índices COMPLETOS de la 0212, letra por letra', () => {
  assert.match(MIG, /create unique index if not exists curso_progreso_area_uk on curso_progreso \(workspace_id, lead_id, clase_id, area\);/);
  assert.match(MIG, /create unique index if not exists curso_accesos_area_uk on curso_accesos \(workspace_id, lead_id, area\) nulls not distinct;/);
  assert.match(MIG, /drop index if exists curso_progreso_uk;/);
  assert.match(MIG, /drop index if exists curso_accesos_uk;/);
  // Un índice PARCIAL no sirve de target de ON CONFLICT desde PostgREST.
  for (const l of MIG.split('\n').filter((x) => /create unique index/i.test(x))) assert.doesNotMatch(l, /\bwhere\b/i, l);
  // Y el código usa exactamente esas columnas, y ninguna de las viejas.
  assert.match(DATOS, /const CONFLICTO_PROGRESO = 'workspace_id,lead_id,clase_id,area';/);
  assert.match(DATOS, /const CONFLICTO_ACCESO = 'workspace_id,lead_id,area';/);
  const targets = [...DATOS.matchAll(/onConflict:\s*([^,}\s]+)/g)].map((m) => m[1]);
  assert.ok(targets.length >= 3, `encontré ${targets.length} upsert`);
  for (const t of targets) assert.ok(t === 'CONFLICTO_PROGRESO' || t === 'CONFLICTO_ACCESO', `un upsert con target ${t}`);
});

test('lo que da el acceso DEL CLIENTE filtra `area is null`: un líder nunca sale con su cookie', () => {
  assert.match(cuerpoDe(DATOS, 'export async function resolverAcceso('), /from\('curso_accesos'\)[^;]*\.is\('area', null\)/);
  assert.match(cuerpoDe(leer('lib/alumno-acceso.ts'), 'export async function accesoInvitadoPorEmail('), /\.is\('area', null\)/);
  assert.match(cuerpoDe(leer('lib/curso-admin.ts'), 'export async function accesosDeClientes('), /\.is\('area', null\)/);
  const onb = cuerpoDe(leer('app/customer-success/curso/onboarding-sync.ts'), 'export async function senalesDelPortal(');
  assert.equal((onb.match(/\.is\('area', null\)/g) ?? []).length, 2, 'los dos conteos son de CLIENTES');
  // Y el líder resuelve por SU fila, con área, del lead del token.
  const lider = cuerpoDe(DATOS, 'export async function resolverAccesoPortal(');
  assert.match(lider, /\.eq\('id', lider\.acceso\)\.eq\('lead_id', lider\.leadId\)\.not\('area', 'is', null\)/);
  assert.match(lider, /f\.version !== lider\.version/);
});

test('el líder nunca recibe una cuenta: ni usuarios, ni sesión, ni la cookie del alumno', () => {
  const acc = leer('app/customer-success/curso-ficha-actions.ts');
  const lideres = acc.slice(acc.indexOf('export async function invitarLiderAction('), acc.indexOf('const TOLERANCIA_PASADO_MS'));
  assert.ok(lideres.length > 500, 'no encontré las actions de los líderes');
  assert.doesNotMatch(lideres, /crearUsuario|invitarPorEmail\(|ponerCookieAlumno|urlDeEntrada|firmarSesion|mako_session/);
  assert.match(lideres, /invitarLiderPorEmail\(/);
  assert.doesNotMatch(cuerpoDe(DATOS, 'export async function linkDeAccesoLider('), /usuarios|firmarSesion|firmarAccesoCurso/);
});

// ── Cortar al cliente corta a su gente, también a la que llegue DESPUÉS ──────────
// `revocarAcceso(lead)` sólo alcanza a los líderes que existen al cortar. Sin estas tres puertas, un
// «Copiar link» de un área después de cortar a un cliente (porque dejó de pagar) creaba un acceso
// NUEVO y sano, y ese líder entraba al portal a escribir tareas de un cliente cortado.

test('el portal no abre el link de un líder si el acceso DEL CLIENTE está cortado', () => {
  const lider = cuerpoDe(DATOS, 'export async function resolverAccesoPortal(');
  // Lee la fila del cliente (la de `area` null) del MISMO lead del token, en cada pedido…
  // (Desde el 07/10/2026 esa misma lectura trae además el ALCANCE del cliente, mig 0219: los permisos
  // del líder son los del cliente. Lo fija tests/curso-invitar.test.ts.)
  assert.match(lider, /from\('curso_accesos'\)\.select\('revocado_at(, alcance)?'\)\.eq\('lead_id', lider\.leadId\)\.is\('area', null\)/);
  // …un error de esa lectura tira (no es «no está cortado»)…
  assert.match(lider, /if \(e1 \|\| e2 \|\| e3\) throw/);
  // …y cortado no abre.
  assert.match(lider, /if \(cliente\?\.revocado_at\) return null;/);
});

test('ninguna action CREA ni HABILITA un líder de un cliente cortado; cortarlo sí se puede', () => {
  const acc = leer('app/customer-success/curso-ficha-actions.ts');
  // La pregunta es por la fila DEL CLIENTE (`accesoDe` sin área) y su `revocado`.
  assert.match(cuerpoDe(acc, 'async function clienteCortado('), /return \(await accesoDe\(leadId\)\)\?\.revocado === true;/);
  // Antes de la escritura que crea el acceso del líder, no después.
  for (const f of ['export async function invitarLiderAction(', 'export async function linkDeLiderAction(']) {
    const c = cuerpoDe(acc, f);
    const chequeo = c.indexOf('if (await clienteCortado(leadId)) return { ok: false, error: CLIENTE_CORTADO };');
    assert.ok(chequeo >= 0, `${f} no mira si el cliente está cortado`);
    assert.ok(chequeo < c.indexOf('linkDeAccesoLider('), `${f} crea el acceso ANTES de mirar al cliente`);
  }
  const cambiar = cuerpoDe(acc, 'export async function cambiarLiderAction(');
  const chequeo = cambiar.indexOf('if (await clienteCortado(leadId)) return { ok: false, error: CLIENTE_CORTADO };');
  assert.ok(chequeo >= 0 && chequeo < cambiar.indexOf('reactivarAcceso('), 'habilitar un líder no mira al cliente');
  // Cortar un líder no pasa por esa puerta: se corta siempre.
  assert.match(cambiar, /if \(cual === 'cortar'\) await revocarAcceso\(leadId, nombre\);/);
  assert.ok(cambiar.indexOf('revocarAcceso(') < chequeo, 'cortar un líder pasa por la puerta del cliente');
});

test('con el cliente cortado, la ficha no ofrece «Copiar link» ni «Volver a habilitar» a un líder', () => {
  const lid = cuerpoDe(leer('app/customer-success/FichaCurso.tsx'), 'function Lideres(');
  assert.match(lid, /const clienteCortado = curso\.acceso\?\.revocado === true;/);
  assert.match(lid, /!clienteCortado && \(\s*<Button[\s\S]{0,300}?Volver a habilitar/);
  assert.match(lid, /!clienteCortado && \(\s*<Button[\s\S]{0,300}?Copiar link/);
  // Los dos botones salen UNA vez cada uno: no hay una copia sin la guarda.
  assert.equal((lid.match(/Copiar link/g) ?? []).length, 1);
  assert.equal((lid.match(/Volver a habilitar/g) ?? []).length, 1);
});

// ── La semilla y el mail ──────────────────────────────────────────────────────

test('la semilla marca por área los 13 formularios de m6-m9, y ningún video', () => {
  const P = programaNqe();
  const marcadas = P.filter((c) => c.por_area).map((c) => c.origen.replace('catalogo:', '')).sort();
  const m6a9 = P.filter((c) => /^catalogo:m[6-9]c\d+$/.test(c.origen)).map((c) => c.origen.replace('catalogo:', '')).sort();
  assert.equal(m6a9.length, 13);
  assert.deepEqual(marcadas, m6a9);
  assert.deepEqual([...FORMULARIOS_POR_AREA].sort(), m6a9);
  assert.ok(!P.some((c) => c.por_area && c.tipo !== 'formulario'));
});

test('el mail del líder: su área, su link, y SIN la línea de Google', () => {
  const t = textoInvitacionLider({ area: 'Ventas', programa: 'Negocio que Escala', negocio: 'Mauricio', enlace: 'https://x.mx/compartido/curso/c2.1.2.3.4.f' });
  assert.equal(t.asunto, 'Tus tareas de Ventas');
  assert.match(t.cuerpo, /tareas de Ventas en el programa Negocio que Escala de Mauricio/);
  assert.ok(t.cuerpo.includes('https://x.mx/compartido/curso/c2.1.2.3.4.f'));
  assert.doesNotMatch(t.cuerpo, /google|login/i, 'el líder no entra con Google');
});

// ── Probado ROMPIÉNDOLO (07/10/2026) ──────────────────────────────────────────
// Arnés que rompe UNA regla por vez y restaura de MEMORIA (nunca con git), corriendo este archivo
// entero (20 tests). Restaurado: 20 pass / 0 fail. Cada rotura, y lo que cae:
//   · `progresoEfectivo` ignora las áreas                      → 17 / 3 (enviada con TODAS, el área
//                                                                vieja, etapaCompleta por área)
//   · `areasDelCliente` sin des-duplicar                        → 19 / 1 «las áreas salen de…»
//   · `decidirClase` sin la regla del líder                     → 19 / 1 «el líder sólo abre…»
//   · `areaDeLaTarea`: el líder escribe el área que pide        → 19 / 1 «de qué área es la tarea»
//   · `armarEtapas`: el líder recibe todas las clases           → 19 / 1 «el portal del líder»
//   · `armarEtapas`: la agenda sin `etapaCompleta`              → 18 / 2 (las dos de la agenda)
//   · `armarEtapas`: la agenda le viaja al líder                → 19 / 1 «nunca al líder…»
//   · `normalizarEtapas` pierde `agendaUrl`                     → 19 / 1 «sobrevive al saneo»
//   · `agendaValida` acepta http                                → 18 / 2
//   · la firma del líder con el namespace de la cookie          → 19 / 1 «no sirve como…»
//   · `leerTokenPortal` toma al líder por el cliente            → 19 / 1 «no sirve como…»
//   · `resolverAccesoPortal` sin exigir área en la fila         → 19 / 1 «filtra area is null»
//   · `CONFLICTO_PROGRESO` con el target viejo                  → 19 / 1 «los targets…»
//   · la 0212 con un índice PARCIAL                             → 19 / 1 «los targets…»
//   · `resolverAcceso` sin `area is null`                       → 19 / 1 «filtra area is null»
//   · el login con Google sin `area is null`                    → 19 / 1 «filtra area is null»
//   · la semilla sin m8c1 por área                              → 19 / 1 «la semilla marca…»
//   · el mail del líder ofreciendo Google                       → 19 / 1 «el mail del líder»
// ⚠️ Dos roturas de la primera tanda dieron VERDE y se cambiaron: «la firma del líder con el
// namespace del CLIENTE» (el c1. firma tres números y el c2. cuatro: nunca chocan, el que comparte
// la forma es la COOKIE) y «leerAccesoCurso acepta seis partes» (la firma igual no cierra: la
// propiedad la sostiene la firma, no el conteo). Un test verde sobre una rotura que no rompe nada
// no prueba nada.
//
// Los tres de «cortar al cliente corta a su gente» (07/10/2026, el archivo ya con 23 tests; mismo
// arnés, restaurado: 23 pass / 0 fail). Cada rotura cae 22 / 1 en el test de su capa:
//   · `resolverAccesoPortal` sin `if (cliente?.revocado_at) return null`   → «el portal no abre…»
//   · la fila del cliente leída con otra área (no `is('area', null)`)     → «el portal no abre…»
//   · el error de esa lectura tragado (`e1 || e2` sin `e3`)               → «el portal no abre…»
//   · `clienteCortado` devuelve siempre false                             → «ninguna action…»
//   · `linkDeLiderAction` sin el chequeo                                  → «ninguna action…»
//   · `invitarLiderAction` chequea DESPUÉS de `linkDeAccesoLider`         → «ninguna action…»
//   · `cambiarLiderAction('habilitar')` sin el chequeo                    → «ninguna action…»
//   · el chequeo antes del `if`, o sea que CORTAR un líder también frena  → «ninguna action…»
//   · la ficha con `clienteCortado = false`                               → «la ficha no ofrece…»
//   · «Copiar link» sin la guarda                                         → «la ficha no ofrece…»
//   · «Volver a habilitar» sin la guarda                                  → «la ficha no ofrece…»
