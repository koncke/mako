// =============================================================================
// «Reportar a Soporte» en TODO error de la app, y que el reporte lleve sólo lo que pasó (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «en toda la app, SIEMPRE que sale un error, en donde sea, debe aparecer el botón de "Reportar a
// Soporte" y que cuando lo apreten se mande automático un mensaje aquí [la Ticketera] reportando solo lo que pasó». El botón
// es UNO (app/_ui/ReportarASoporte.tsx) y este guardián lo exige:
//   · en cada elemento JSX de app/ con `role="alert"` (o un `role={…}` que puede ser «alert»): `<ReportarASoporte />` como
//     hijo directo (en una lista, en su propio <li>);
//   · en los avisos de error que no son un `role="alert"` del JSX: ErrorState, el Toast con tono `bad`, el toast del
//     teléfono, los `toast.error` del editor de video (sonner) y las dos pantallas de error de Next (sin imports, a mano).
// Y fija la privacidad del reporte (lib/soporte-reporte.ts, app/api/soporte/reportar/route.ts): sin claves, sin datos de
// clientes, de quién es lo dice la SESIÓN.
//
// Correr: node --import tsx --test tests/reportar-a-soporte.test.ts
//
// ⚠️ PROBADO ROMPIENDOLO (23/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  esTextoDeError, rutaSoporte, sanearReporteSoporte, semillaDeRef, sinNombres, sinSecretos, tabDeRuta, ticketDelReporte,
} from '../lib/soporte-reporte';
import { clasificar, sanearContexto } from '../lib/tickets-reglas';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Las pantallas de error de Next no importan nada de la app (si la app está rota, el botón también): lo llevan a mano. */
const A_MANO = new Set(['app/error.tsx', 'app/global-error.tsx']);

function archivosTsx(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivosTsx(p, out);
    else if (p.endsWith('.tsx')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const esAlerta = (a: ts.JsxAttributeLike): boolean => {
  if (!ts.isJsxAttribute(a) || a.name.getText() !== 'role' || !a.initializer) return false;
  const i = a.initializer;
  if (ts.isStringLiteral(i)) return i.text === 'alert';
  return ts.isJsxExpression(i) && !!i.expression && /['"]alert['"]/.test(i.expression.getText());
};
const esBoton = (c: ts.Node) => ts.isJsxSelfClosingElement(c) && c.tagName.getText() === 'ReportarASoporte';

/** Los avisos de error del JSX que NO llevan el botón como hijo directo: «archivo:línea <tag>». */
function avisosSinBoton(archivo: string, src: string): string[] {
  const sf = ts.createSourceFile(archivo, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const malos: string[] = [];
  const visitar = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.attributes.properties.some(esAlerta)) {
      const tag = n.tagName.getText();
      const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      const hijos = ts.isJsxOpeningElement(n) ? (n.parent as ts.JsxElement).children : null;
      const tiene = !!hijos && /^[a-z]/.test(tag) && (hijos.some(esBoton)
        || (/^(ul|ol)$/.test(tag) && hijos.some((c) => ts.isJsxElement(c) && c.openingElement.tagName.getText() === 'li' && c.children.some(esBoton))));
      if (!tiene) malos.push(`${archivo}:${linea} <${tag}>`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return malos;
}

test('todo aviso de error del JSX (role="alert") lleva «Reportar a Soporte» como hijo directo', () => {
  const malos: string[] = [];
  let avisos = 0;
  for (const f of archivosTsx('app')) {
    if (A_MANO.has(f)) continue;
    const src = leer(f);
    if (!src.includes('alert')) continue;
    avisos += (src.match(/role=(?:"alert"|\{[^}]*['"]alert['"])/g) ?? []).length;
    malos.push(...avisosSinBoton(f, src));
  }
  assert.ok(avisos > 200, `el barrido no está leyendo los avisos (encontró ${avisos})`);
  assert.deepEqual(malos, [], `Avisos de error sin el botón. Ponle <ReportarASoporte /> como último hijo (en una lista, <li><ReportarASoporte /></li>):\n${malos.join('\n')}`);
});

test('los avisos de error compartidos que no son un role="alert" del JSX también lo llevan', () => {
  const estados = sinComentarios(leer('app/_ui/Estados.tsx'));
  assert.match(estados, /className=\{`mk-state[^`]*`\} role=\{tono === 'bad' \? 'alert' : 'status'\}>/, 'ErrorState (el Marco con tono bad)');
  const toast = sinComentarios(leer('app/_ui/Toast.tsx'));
  assert.match(toast, /role=\{error \? 'alert' : 'status'\}/, 'el Toast con tono bad es un aviso');
  assert.match(toast, /toast\.tono === 'bad' \? Math\.max\(ms, 8000\)/, 'y se queda lo que hace falta para tocar el botón');
  const shell = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  assert.match(shell, /error: opciones\?\.error \?\? esTextoDeError\(mensaje\)/, 'el toast del teléfono reconoce un error por su frase');
  assert.match(shell, /role=\{toast\.error \? 'alert' : 'status'\}/);
  const sonner = leer('app/video-editor/_opencut/components/ui/sonner.tsx');
  assert.match(sonner, /toast\.error = Object\.assign\(conSoporte/, 'los toast.error del editor de video salen con la acción');
  assert.match(sonner, /label: ROTULO_REPORTAR/);
  for (const f of A_MANO) {
    const src = leer(f);
    assert.match(src, /'Reportar a Soporte'/, `${f}: la pantalla de error sin el botón`);
    assert.match(src, /fetch\('\/api\/soporte\/reportar'/, `${f}: el botón no manda nada`);
    assert.doesNotMatch(src, /^import .*@\//m, `${f}: una pantalla de error no importa nada de la app`);
  }
});

test('el editor de video no se salta el envoltorio: todos los toast de sonner salen del mismo módulo, que carga el editor', () => {
  // El envoltorio cambia `toast.error` del objeto de sonner, que es UNO: vale para todos los que lo importan, siempre que el
  // módulo del Toaster se haya cargado antes (lo montan las dos raíces del editor).
  for (const f of ['app/video-editor/VideoEditorCliente.tsx', 'app/m/video-editor/EditorVideoM.tsx']) {
    assert.match(leer(f), /import \{ Toaster \} from '[^']*_opencut\/components\/ui\/sonner';/, `${f}: sin el Toaster del editor`);
  }
});

// ── La privacidad del reporte ────────────────────────────────────────────────────────────────────────────────────────
test('sin claves: JWT, claves de API, Bearer, token=…, la query de un link y los hashes largos', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  const t = sinSecretos(`fallo ${jwt} con Bearer abc.def y token=xyz123 y sk-ant-api03-AbCdEfGhIjKlMnOp y AIzaSyD-abcdefghijklmnop en https://graph.facebook.com/v19/me?access_token=EAAB123&x=1 hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`);
  for (const secreto of ['eyJhbGci', 'abc.def', 'xyz123', 'sk-ant', 'AIzaSy', 'EAAB123', 'access_token=', '9f86d081884c']) {
    assert.ok(!t.includes(secreto), `quedó «${secreto}» en: ${t}`);
  }
  assert.match(t, /https:\/\/graph\.facebook\.com\/v19\/me/, 'el link queda, sin su query');
  // Los que pasaban en la revisión de privacidad (23/10/2026): cabeceras, `_secret`/`_token` con prefijo, «password es …».
  const u = sinSecretos('Authorization: Basic dXNlcjpwYXNz · Authorization: Token abc123def · client_secret=GOCSPX-abc · auth_token=zz9 · session_token: qq8 · la password es hunter2 · la contraseña es tigre77 · EAABsbCS1iHgBAKZBxyz123 · ya29.a0AfH6SMBxyz');
  for (const secreto of ['dXNlcjpwYXNz', 'abc123def', 'GOCSPX', 'zz9', 'qq8', 'hunter2', 'tigre77', 'EAABsbCS', 'a0AfH6']) {
    assert.ok(!u.includes(secreto), `quedó «${secreto}» en: ${u}`);
  }
});

test('sin nombres propios: lo que va con mayúscula y no es de MaKo puede ser un lead', () => {
  assert.equal(sinNombres('No pude mover a Roberto Pérez a la etapa siguiente'), 'No pude mover a «…» a la etapa siguiente');
  assert.equal(sinNombres('Ana López dijo que no'), '«…» dijo que no', 'también al empezar la frase, si la sigue otra');
  assert.equal(sinNombres('No pude conectar con Google Calendar. La IA de Meta no contestó'), 'No pude conectar con Google Calendar. La IA de Meta no contestó');
  assert.equal(sinNombres('CRM: No pude guardar el lead'), 'CRM: No pude guardar el lead');
  assert.equal(sinNombres('El «…» no se guardó'), 'El «…» no se guardó');
});

test('la pantalla sin los tokens del camino ni los números que pueden ser un teléfono o un código', () => {
  assert.equal(rutaSoporte('/pagar/AbCdEf1234567890xyz'), '/pagar/:token');
  assert.equal(rutaSoporte('/l/vista/ana@cliente.com'), '/l/vista/:token');
  assert.equal(rutaSoporte('/crm/123?tel=5491155551234&code=123456&ws=3&etapa=nueva'), '/crm/123?tel=…&code=…&ws=3&etapa=…');
  assert.equal(rutaSoporte('/automations/campana-de-prueba'), '/automations/campana-de-prueba', 'un slug de palabras no es un token');
});

test('sin datos de clientes: emails, teléfonos y lo citado; la pantalla sin los valores de su query; el workspace no viaja', () => {
  const r = sanearReporteSoporte({
    error: 'No pude mandarle el mensaje a «Ana López» (ana@cliente.com, +54 9 11 5555-1234)',
    accion: 'Mandar a Ana López', ruta: '/crm/123?buscar=ana%40cliente.com&ws=3', hora: '2026-10-23T14:05:00.000Z',
    zona: 'America/Argentina/Buenos_Aires', pantalla: '1440x900', idioma: 'es-AR', navegador: 'Chrome',
    ws: 99, workspace: 99, email: 'otro@negocio.com',
  });
  assert.ok(r);
  assert.ok(!/ana@|5555|Ana López|López/.test(JSON.stringify(r)), JSON.stringify(r));
  assert.equal(r.ruta, '/crm/123?buscar=…&ws=3');
  assert.equal(r.accion, 'Mandar a «…»');
  assert.ok(!('ws' in r) && !('workspace' in r) && !('email' in r), 'de quién es lo dice la sesión, no el cuerpo');
  assert.equal(sanearReporteSoporte({ error: '   ' }), null, 'sin un error no hay reporte');
  assert.equal(sanearReporteSoporte({ error: 'x', zona: '"><script>' })?.zona, undefined);
  assert.equal(r.navegador, undefined, 'un «navegador» que no tiene la forma de uno no viaja');
  assert.equal(sanearReporteSoporte({ error: 'x', navegador: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36' })?.navegador,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36');
});

test('el ticket dice dónde y qué; el error va en el DETALLE, no en el contexto que el triage lee como lo que vio el sistema', () => {
  const r = sanearReporteSoporte({ error: 'No pude guardar el lead.', accion: 'Guardar', ruta: '/crm', hora: '2026-10-23T14:05:00.000Z', zona: 'UTC' })!;
  const t = ticketDelReporte(r);
  assert.equal(tabDeRuta('/crm'), 'CRM');
  assert.equal(t.titulo, 'CRM: No pude guardar el lead');
  assert.match(t.descripcion, /Lo reporté con el botón «Reportar a Soporte»\.\nPantalla: CRM \(\/crm\)\nLo que hacía: Guardar\nEl error: No pude guardar el lead\./);
  assert.deepEqual(t.contexto.chat, { donde: 'reportar-a-soporte' });
  // La revisión de privacidad (23/10/2026): el texto lo puede mandar cualquiera con sesión. En `contexto.error` el triage lo
  // tomaba como «el sistema lo vio fallar» → bug evidente → arreglo automático, con texto del cliente camino al Cerebro.
  assert.ok(!('error' in t.contexto) && !('herramienta' in t.contexto), JSON.stringify(t.contexto));
  const triage = clasificar({ tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: t.titulo, descripcion: t.descripcion, contexto: sanearContexto(t.contexto) });
  assert.equal(triage.autoArreglo, false, 'un reporte del botón lo decide Martín');
});

test('el mismo error el mismo día es el mismo ticket; otro día, otro', () => {
  const r = sanearReporteSoporte({ error: 'No pude guardar', ruta: '/crm/123' })!;
  const r2 = sanearReporteSoporte({ error: 'No pude guardar', ruta: '/crm/456' })!;
  const hoy = new Date('2026-10-23T10:00:00Z');
  assert.equal(semillaDeRef(3, 'a@b.com', r, hoy), semillaDeRef(3, 'A@B.com', r2, hoy), 'dos leads distintos son la misma pantalla');
  assert.notEqual(semillaDeRef(3, 'a@b.com', r, hoy), semillaDeRef(3, 'a@b.com', r, new Date('2026-10-24T10:00:00Z')));
  assert.notEqual(semillaDeRef(3, 'a@b.com', r, hoy), semillaDeRef(4, 'a@b.com', r, hoy), 'otro negocio, otro ticket');
});

test('la ruta: del mismo origen, con sesión, con tope, y de quién es sale SÓLO de la sesión', () => {
  const ruta = sinComentarios(leer('app/api/soporte/reportar/route.ts'));
  assert.match(ruta, /new URL\(origen\)\.host === req\.headers\.get\('host'\)/);
  assert.match(ruta, /const s = await getUsuarioActual\(\);\s*const ws = await getWorkspaceActual\(\);/);
  assert.match(ruta, /if \(texto\.length > TOPE_BYTES\)/);
  assert.match(ruta, /identidad: await identidadDe\(ws, email, s\.nombre \?\? ''\)/);
  assert.doesNotMatch(ruta, /cuerpo\s*(as [^;]*)?\)?\.(ws|workspace|email|usuario)/, 'el cuerpo no elige de quién es');
  assert.match(ruta, /tipo: 'bug', declaradoPor: 'persona'/);
});

test('un toast del teléfono es un error por su frase', () => {
  for (const f of ['No se pudo guardar', 'No pude borrar el lead', 'No salió', 'Falló el envío', 'Error al cargar']) assert.ok(esTextoDeError(f), f);
  for (const f of ['Completada', 'Nota guardada', 'Ticket #12 enviado', 'Notas']) assert.ok(!esTextoDeError(f), f);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 11/0, de a una; cada una → 10/1):
//   · un aviso suelto (app/automations/ChatMako.tsx) sin el botón            → el barrido de los role="alert"
//   · la cinta roja (Banner) sin el botón                                    → el barrido (su role es dinámico)
//   · el Toast con tono bad como `role="status"`                             → los avisos compartidos
//   · el toast.error del editor de video sin la acción                       → los avisos compartidos
//   · app/error.tsx sin el botón                                             → los avisos compartidos
//   · el toast del teléfono sin reconocer la frase de error                  → los avisos compartidos
//   · `sinSecretos` sin sacar los JWT                                        → sin claves
//   · `limpio` sin `sinNombres`                                              → sin datos de clientes
//   · la ruta con los tokens del camino                                      → la pantalla sin tokens
//   · el error otra vez en `contexto.error`                                  → el error va en el DETALLE (autoArreglo)
//   · la ruta tomando el workspace del cuerpo                                → de quién es sale SÓLO de la sesión
