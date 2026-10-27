// =============================================================================
// «Reportar a Soporte» desde el portal del ALUMNO: con su token, y le llega al dueño del curso (27/10/2026)
// =============================================================================
// Leandro (llamada del 24/10, 874749710-18): el alumno no tenía cómo reportar. El botón de toda la app pedía la sesión de
// MaKo, el alumno no la tiene (le contestaba «no autenticado») y el 24/10 se lo escondió en el portal. Ahora manda por
// /api/compartido/curso/soporte con el token de su portal, y el ticket es del DUEÑO del curso. Esto fija:
//   1. el botón: en el portal manda a la ruta del alumno y con su token; en la app, a la de siempre y sin token;
//   2. el ticket: dice que lo reportó un alumno y su ficha, con la pantalla del portal SIN el token, y el error en el detalle;
//   3. la pantalla: el token del portal (`c1.<ws>.<lead>.<versión>.<firma>`, con puntos) nunca pasa entero a un ticket;
//   4. el triage: lo de un tercero nunca va solo al arreglo, tampoco con la regla del negocio (Leandro, ws 10);
//   5. la ruta: el token no abre más que el reporte (sólo crea, el dueño sale de la base, el negocio de la firma, con topes);
//   6. el tope del día se le cuenta al alumno, no al dueño.
// Correr: node --import tsx --test tests/curso-soporte-alumno.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUTA_REPORTAR, RUTA_REPORTAR_ALUMNO, claveDelAlumno, rutaDelPortal, rutaSoporte, sanearReporteSoporte, ticketDelAlumno,
} from '../lib/soporte-reporte';
import { clasificar, TOPE_POR_DIA_TERCERO, type EntradaTriage } from '../lib/tickets-reglas';
import { firmarAccesoCurso } from '../lib/curso-acceso';
import { esPublica, esPublicaDeEscritura } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TOKEN = firmarAccesoCurso({ ws: 10, leadId: 2664, version: 3 }, 'secreto-de-prueba')!;

test('1. el botón: en el portal va a la ruta del alumno con SU token; en la app, a la de siempre y sin token', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const antes = { window: g.window, fetch: g.fetch };
  const pedidos: Array<{ url: string; cuerpo: Record<string, unknown> }> = [];
  g.window = { location: { pathname: `/compartido/curso/${TOKEN}`, search: '' }, innerWidth: 390, innerHeight: 800 };
  g.fetch = async (url: string, init: { body: string }) => {
    pedidos.push({ url, cuerpo: JSON.parse(init.body) as Record<string, unknown> });
    return new Response(JSON.stringify({ ok: true, id: 7, yaExistia: false }));
  };
  try {
    const { reportarASoporte } = await import('../app/_ui/ReportarASoporte');
    assert.deepEqual(await reportarASoporte({ error: 'No pudimos guardar tu tarea.', alumno: TOKEN }), { ok: true, id: 7, yaExistia: false });
    assert.equal(pedidos[0].url, RUTA_REPORTAR_ALUMNO);
    assert.equal(pedidos[0].cuerpo.t, TOKEN, 'sin el token la ruta del alumno no sabe de quién es');
    assert.equal(pedidos[0].cuerpo.error, 'No pudimos guardar tu tarea.');
    await reportarASoporte({ error: 'No se pudo guardar.' });
    assert.equal(pedidos[1].url, RUTA_REPORTAR, 'con sesión, la ruta de siempre');
    assert.equal('t' in pedidos[1].cuerpo, false, 'el token del alumno no viaja fuera del portal');
  } finally {
    g.window = antes.window;
    g.fetch = antes.fetch;
  }
  // El que lo dibuja le pasa el token del contexto, y el portal lo pone (la vista previa del equipo, no: tiene sesión).
  const boton = sinComentarios(leer('app/_ui/ReportarASoporte.tsx'));
  assert.match(boton, /const alumno = useContext\(SoporteDelAlumnoCtx\);/);
  assert.match(boton, /reportarASoporte\(\{ error: texto, accion, alumno \}\)/);
  assert.match(leer('app/compartido/curso/[token]/PortalAlumno.tsx'), /<SoporteDelAlumnoCtx\.Provider value=\{vistaPrevia \? null : token\}>/);
});

test('2. el ticket: lo reportó un alumno (su ficha, no su nombre), la pantalla del portal y el error en el DETALLE', () => {
  const r = sanearReporteSoporte({
    error: 'No pudimos guardar tu tarea. Ana López lo vio', accion: 'Enviar', ruta: `/compartido/curso/${TOKEN}?clase=12`,
    hora: '2026-10-27T20:00:00Z', zona: 'America/Mexico_City',
  })!;
  const t = ticketDelAlumno(r, { leadId: 2664, area: null });
  assert.equal(t.titulo, 'Portal del curso: No pudimos guardar tu tarea. «…» lo vio');
  assert.match(t.descripcion, /^Lo reportó tu alumno \(ficha \/crm\/2664\) desde su portal del curso, con «Reportar a Soporte»\.\n/);
  assert.match(t.descripcion, /\nPantalla: el portal del curso \(\/compartido\/curso\/:token\)\n/);
  assert.match(t.descripcion, /\nEl error: No pudimos guardar tu tarea\. «…» lo vio\n/);
  assert.doesNotMatch(JSON.stringify(t), /Ana|López|c1\.10\.2664/, 'un nombre o el token en el ticket');
  assert.equal(t.contexto.error, undefined, 'el error en el contexto lo lee el triage como «lo vio el sistema»');
  assert.deepEqual(t.contexto.chat, { donde: 'portal-alumno' });
  assert.equal(t.contexto.ruta, '/compartido/curso/:token');
  const lider = ticketDelAlumno({ ...r, ruta: '/mi-curso' }, { leadId: 2664, area: 'Ventas' });
  assert.match(lider.descripcion, /^Lo reportó el líder del área de tu alumno \(ficha \/crm\/2664\)/);
  assert.equal(lider.contexto.ruta, '/mi-curso');
});

test('3. el token del portal (con puntos) no pasa entero a la pantalla de un ticket, y la del portal la pone el servidor', () => {
  assert.match(TOKEN, /^c1\.10\.2664\.3\.[\w-]+$/);
  assert.equal(rutaSoporte(`/compartido/curso/${TOKEN}`), '/compartido/curso/:token', 'la credencial del alumno, entera en el ticket');
  assert.equal(rutaSoporte('/automations/campana-de-prueba'), '/automations/campana-de-prueba', 'un slug de palabras sigue sin ser un token');
  assert.equal(rutaDelPortal(`/compartido/curso/${TOKEN}`), '/compartido/curso/:token');
  assert.equal(rutaDelPortal('/mi-curso?clase=3'), '/mi-curso');
  assert.equal(rutaDelPortal('/mi-cursos/otra'), '/compartido/curso/:token', 'lo que no es /mi-curso exacto no es /mi-curso');
  assert.equal(rutaDelPortal(undefined), '/compartido/curso/:token');
});

test('4. lo de un tercero nunca va solo al arreglo, tampoco con la regla de Leandro', () => {
  const e: EntradaTriage = { tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: 'Portal del curso: dejó de andar el video', descripcion: 'Antes andaba y dejó de andar.', contexto: { ruta: '/compartido/curso/:token' } };
  // Control: el mismo texto de alguien del negocio sí va (es una regresión descrita, y además está la regla).
  assert.equal(clasificar(e, { aprobadoPorRegla: 'Leandro' }).autoArreglo, true);
  assert.equal(clasificar(e).autoArreglo, true);
  for (const opts of [{ deTercero: true }, { deTercero: true, aprobadoPorRegla: 'Leandro' }]) {
    const t = clasificar(e, opts);
    assert.equal(t.autoArreglo, false, JSON.stringify(opts));
    assert.equal(t.regla, undefined, 'la marca de la regla en un ticket de un tercero');
    assert.match(t.porque.join(' '), /Lo reportó alguien de afuera del negocio/);
  }
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  assert.match(db, /clasificar\([^;]*deTercero: !!tercero, aprobadoPorRegla: reglaDelNegocio\(n\.identidad\.ws\)\?\.nombre \?\? null/);
});

test('5. la ruta: el token sólo CREA el reporte; el negocio sale de la firma, el dueño de la base, y con topes', () => {
  const src = sinComentarios(leer('app/api/compartido/curso/soporte/route.ts'));
  assert.deepEqual([...src.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]), ['POST']);
  // Lo único de tickets que toca es crear uno: ni leer los del dueño, ni comentar, ni decidir.
  assert.match(src, /import \{ crearTicket, identidadDe \} from '@\/lib\/tickets-db';/);
  assert.doesNotMatch(src, /misTickets|miTicket|comentarComoCliente|bandeja|ticketEntero|decidir|getSupabaseServer|getTenantDb/);
  // El tope por IP y el Origin, antes de leer el cuerpo; el del alumno, después de saber quién es.
  const i = (s: string) => src.indexOf(s);
  assert.ok(i('rateLimit(`curso-soporte:ip:') > 0 && i('rateLimit(`curso-soporte:ip:') < i('leerJsonTopeado('), 'el tope por IP va antes de leer');
  assert.ok(i("new URL(origen).host === req.headers.get('host')") > 0 && i("new URL(origen).host") < i('leerJsonTopeado('), 'sin mirar el Origin');
  assert.ok(i('rateLimit(`curso-soporte:lead:${acceso.ws}:${acceso.leadId}`') > i('resolverAccesoPortal('));
  // El dueño y la clave del alumno salen del ACCESO resuelto; del cuerpo sólo se lee el token y lo que sanea el reporte.
  assert.match(src, /identidad: await identidadDe\(acceso\.ws, dueno\)/);
  assert.match(src, /const dueno = await emailDuenoWorkspace\(acceso\.ws\);/);
  assert.match(src, /const clave = claveDelAlumno\(acceso\.ws, acceso\.leadId\);/);
  assert.match(src, /tipo: 'bug', declaradoPor: 'persona',/);
  assert.match(src, /ref, tercero: \{ clave \},/);
  assert.match(src, /const ref = `\$\{clave\}:\$\{createHash/, 'la ref empieza con la clave: con ella se cuenta el tope del alumno');
  assert.deepEqual([...new Set([...src.matchAll(/\bb\.(\w+)/g)].map((m) => m[1]))], ['t'], 'del cuerpo se elige algo más que el token');
  assert.match(src, /return json\(\{ ok: true, id: creado\.id, yaExistia: creado\.yaExistia \}\);/);
  assert.equal(claveDelAlumno(10, 2664), 'alumno:10:2664');
  // Pública de escritura, EXACTA (nada colgado abajo hereda el permiso).
  assert.equal(esPublica('/api/compartido/curso/soporte'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/curso/soporte'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/curso/soporte/otra'), false);
});

test('6. el tope del día de un tercero se le cuenta a él (por su ref), no al dueño a quien le llega', () => {
  assert.equal(TOPE_POR_DIA_TERCERO, 3);
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  const crear = db.slice(db.indexOf('export async function crearTicket('), db.indexOf('export type Lectura<'));
  assert.match(crear, /const tercero = n\.tercero \? `\$\{n\.tercero\.clave\}:` : null;/);
  assert.match(crear, /if \(tercero && !n\.ref\?\.startsWith\(tercero\)\) return \{ ok: false/, 'una ref que no es suya se contaría a otro');
  assert.match(crear, /await \(tercero \? delDia\.like\('ref', `\$\{tercero\}%`\) : delDia\.eq\('usuario_email', n\.identidad\.email\)\)/);
  assert.match(crear, /const tope = tercero \? TOPE_POR_DIA_TERCERO : TOPE_POR_DIA;/);
});

// ROTURAS (27/10/2026, una por vez y restaurada; base 6 / 0):
//   · el botón manda a RUTA_REPORTAR también en el portal (`alumno ? RUTA_REPORTAR_ALUMNO : …` → `RUTA_REPORTAR`) → 5 / 1 (cae 1)
//   · el portal vuelve a no pasar el token (`value={null}`) → 5 / 1 (cae 1)
//   · `rutaSoporte` sin el punto en la lista del token → 5 / 1 (cae 3)
//   · el triage sin la salida de `deTercero` → 5 / 1 (cae 4)
//   · la ruta toma el dueño del cuerpo (`identidadDe(acceso.ws, String(b.email))`) → 5 / 1 (cae 5)
//   · el tope del tercero contado por el email del dueño (sin el `like`) → 5 / 1 (cae 6)
