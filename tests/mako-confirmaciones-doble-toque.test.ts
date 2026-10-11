// =============================================================================
// mako-confirmaciones — dos toques sobre el mismo cambio del CRM automático aplican UNA vez
// =============================================================================
// `resolverConfirmacion` (lib/mako-confirmaciones.ts) leía el estado y cerraba AL FINAL,
// sin compare-and-set: dos toques seguidos (el celular, dos pestañas, un reintento) leían
// los dos «pendiente» y revertían el lead —o lo movían de etapa— dos veces. Ahora reclama
// primero con `.eq('estado', 'pendiente')`, como `reclamarPendiente`.
//
// No se lee el fuente: se EJECUTA la función de verdad, en un hijo con
// `--conditions=react-server` (es `server-only`), contra una base FALSA — un servidor HTTP
// que habla lo mínimo de PostgREST, con el compare-and-set de un UPDATE real (atómico: el
// filtro y la escritura pasan en el mismo tick). `NEXT_PUBLIC_SUPABASE_URL` apunta ahí, así
// que el cliente de supabase-js, el scoping por workspace y la función son los de producción.
//
// Verificado ROMPIÉNDOLO (11/10/2026) con un arnés que restaura de memoria, con la base en
// 1 pase / 0 fallos (un test, tres escenarios):
//   · sacando el `.eq('estado', 'pendiente')` del reclamo → 1 fallo: «2 !== 1» (el doble
//     «Deshacer» revirtió el lead dos veces).
//   · volviendo a la función de HEAD (aplicar y cerrar al final, sin reclamo) → 1 fallo: «2 !== 1».
//   · sin soltar el reclamo cuando lo que se aplica falla → 1 fallo: queda «confirmado» un
//     movimiento que no se hizo, y ya no se puede reintentar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const RAIZ = join(__dirname, '..');
const correr = promisify(execFile);

// El hijo: levanta la base falsa, apunta supabase-js a ella e importa la función real.
const HIJO = String.raw`
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tablas = {
  mako_confirmaciones: [
    { id: 1, workspace_id: 1, lead_id: 50, lead_nombre: 'Ana', regla: 'T1', tipo: 'reunion_check', clave: 'T1:j1', titulo: 'No Show R1 de Ana', detalle: null,
      aplicado: true, cambios: [], revert: { pipeline_stage: 'agendado' }, opciones: null, estado: 'pendiente', created_at: '2026-10-11T00:00:00Z' },
    { id: 2, workspace_id: 1, lead_id: 50, lead_nombre: 'Ana', regla: 'T1', tipo: 'reunion_check', clave: 'T1:j2', titulo: 'No Show R2 de Ana', detalle: null,
      aplicado: true, cambios: [], revert: { pipeline_stage: 'agendado_r2' }, opciones: null, estado: 'pendiente', created_at: '2026-10-11T00:00:00Z' },
    { id: 3, workspace_id: 1, lead_id: 999, lead_nombre: 'Nadie', regla: 'T6', tipo: 'reactivacion', clave: 'T6', titulo: 'Reactivar', detalle: null,
      aplicado: false, cambios: [], revert: null, opciones: [{ key: 'perdido', label: 'Marcar Perdido', stage: 'perdido' }], estado: 'pendiente', created_at: '2026-10-11T00:00:00Z' },
  ],
  leads: [{ id: 50, workspace_id: 1, nombre: 'Ana', pipeline_stage: 'no_show', fathom_links: [] }],
  lead_audit: [],
};
const escrituras = [];

const cumple = (fila, k, v) => {
  const [op, ...resto] = v.split('.'); const val = resto.join('.');
  const x = fila[k];
  if (op === 'eq') return String(x) === val;
  if (op === 'neq') return String(x) !== val;
  if (op === 'is') return val === 'null' ? x == null : String(x) === val;
  if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').includes(String(x));
  return true;
};
const NO_FILTRO = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);

const server = http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    const tabla = u.pathname.replace(/^\/rest\/v1\//, '');
    const filas = (tablas[tabla] ??= []);
    const filtros = [...u.searchParams].filter(([k]) => !NO_FILTRO.has(k));
    const match = filas.filter((f) => filtros.every(([k, v]) => cumple(f, k, v)));
    const devuelve = (req.headers.prefer ?? '').includes('return=representation');
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.setHeader('content-range', '0-' + Math.max(0, match.length - 1) + '/' + match.length);
      res.end(req.method === 'HEAD' ? '' : JSON.stringify(match));
      return;
    }
    if (req.method === 'PATCH') {
      const patch = JSON.parse(cuerpo || '{}');
      for (const f of match) Object.assign(f, patch);
      escrituras.push({ tabla, metodo: 'PATCH', filtros: Object.fromEntries(filtros), patch, filas: match.length });
      res.statusCode = devuelve ? 200 : 204;
      res.end(devuelve ? JSON.stringify(match) : '');
      return;
    }
    if (req.method === 'POST') {
      const nuevas = [].concat(JSON.parse(cuerpo || '[]'));
      for (const n of nuevas) filas.push({ id: filas.length + 1000, ...n });
      escrituras.push({ tabla, metodo: 'POST', filas: nuevas.length, cuerpo: nuevas });
      res.statusCode = 201;
      res.end(devuelve ? JSON.stringify(nuevas) : '');
      return;
    }
    res.statusCode = 405; res.end('{}');
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:' + server.address().port;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'falsa';

const imp = (p) => import(pathToFileURL(path.join(process.cwd(), p)).href);
const { runWithWorkspace } = await imp('lib/workspace.ts');
const { resolverConfirmacion } = await imp('lib/mako-confirmaciones.ts');
const estado = (id) => tablas.mako_confirmaciones.find((c) => c.id === id).estado;
const reverts = (lead, etapa) => escrituras.filter((e) => e.tabla === 'leads' && e.metodo === 'PATCH' && e.patch.pipeline_stage === etapa).length;
const notas = (id) => escrituras.filter((e) => e.tabla === 'lead_audit' && e.cuerpo.some((x) => String(x.valor_nuevo).includes(id))).length;

const salida = {};
await runWithWorkspace(1, async () => {
  // A) Dos «Deshacer el cambio» a la vez sobre la misma confirmación.
  const a = await Promise.allSettled([resolverConfirmacion(1, 'rechazar', 'toque-1'), resolverConfirmacion(1, 'rechazar', 'toque-2')]);
  salida.a = { reverts: reverts(50, 'agendado'), notas: notas('rechazado'), estado: estado(1), rechazos: a.filter((r) => r.status === 'rejected').length };
  // B) «Dejar el cambio» y «Deshacer el cambio» a la vez: gana UNO, y el otro no aplica nada.
  const b = await Promise.allSettled([resolverConfirmacion(2, 'confirmar', 'toque-1'), resolverConfirmacion(2, 'rechazar', 'toque-2')]);
  salida.b = { reverts: reverts(50, 'agendado_r2'), estado: estado(2), rechazos: b.filter((r) => r.status === 'rejected').length,
    coherente: estado(2) === 'rechazado' ? reverts(50, 'agendado_r2') === 1 : reverts(50, 'agendado_r2') === 0 };
  // C) Una opción cuyo movimiento falla (el lead no existe): el reclamo se SUELTA.
  let error = null;
  try { await resolverConfirmacion(3, 'op:perdido', 'toque-1'); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  salida.c = { error, estado: estado(3) };
});
// Sin server.close(): cerrar el socket y salir en el mismo tick tira una aserción de libuv
// en Windows (UV_HANDLE_CLOSING). Se sale directo; el padre igual lee la salida.
console.log('JSON' + JSON.stringify(salida));
process.exit(0);
`;

test('dos toques sobre el mismo cambio del CRM: se aplica UNA vez, y lo que falla vuelve a pendiente', { timeout: 200_000 }, async () => {
  // Un código de salida distinto de 0 no es el veredicto: el veredicto es la línea JSON.
  const { stdout, stderr } = await correr(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', HIJO], {
    cwd: RAIZ, encoding: 'utf8', timeout: 190_000, maxBuffer: 20 * 1024 * 1024,
  }).catch((e: { stdout?: string; stderr?: string }) => ({ stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }));
  const linea = stdout.split('\n').find((l) => l.startsWith('JSON'));
  assert.ok(linea, `el hijo no devolvió el resultado:\n${stdout.slice(-2000)}\n${stderr.slice(-2000)}`);
  const r = JSON.parse(linea.slice(4)) as {
    a: { reverts: number; notas: number; estado: string; rechazos: number };
    b: { reverts: number; estado: string; rechazos: number; coherente: boolean };
    c: { error: string | null; estado: string };
  };

  // A) el lead se revierte UNA vez y el historial lleva UNA nota.
  assert.equal(r.a.reverts, 1, 'el doble «Deshacer» revirtió el lead dos veces');
  assert.equal(r.a.notas, 1, 'el doble «Deshacer» dejó dos notas en el historial');
  assert.equal(r.a.estado, 'rechazado');
  assert.equal(r.a.rechazos, 0, 'el segundo toque no es un error: ya estaba resuelta');

  // B) dos decisiones distintas a la vez: queda la del que ganó, y es coherente con el lead.
  assert.ok(r.b.estado === 'confirmado' || r.b.estado === 'rechazado', r.b.estado);
  assert.ok(r.b.coherente, `quedó «${r.b.estado}» con ${r.b.reverts} reverts`);

  // C) un movimiento que no se pudo hacer no deja la confirmación cerrada: se puede reintentar.
  assert.ok(r.c.error, 'el movimiento tenía que fallar (el lead no existe)');
  assert.equal(r.c.estado, 'pendiente', 'lo que no se aplicó tiene que volver a pendiente');
});
