// =============================================================================
// /admin/runway — el tablero de decisiones (14/10/2026)
// =============================================================================
// Martín contesta acá las decisiones de todos los chats, muchas veces desde el teléfono.
// Estas guardas fijan lo que no se ve leyendo una pantalla:
//   · lo que se publica es CORTO y no se recorta: un texto largo se rechaza con su motivo;
//   · un link sólo lleva a MaKo o a un origen de la lista, comparado por ORIGEN;
//   · una respuesta tiene que ser una opción de ESA decisión (o «otra» con texto);
//   · los avisos no cuentan como decisiones, y las contestadas no se mezclan;
//   · la tab sigue siendo del super admin (página, acción y teléfono), y el teléfono abre
//     el MISMO tablero en la misma URL;
//   · la tabla nace con RLS y su CHECK de urgencia dice lo mismo que el código.
//
// Probado rompiéndolo (14/10/2026), una rotura por vez sobre una base en verde, restaurando
// de memoria entre una y otra: el resultado de cada rotura va en el comentario de su test.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  sanearPublicada, motivoRespuestaInvalida, repartir, textoDeRespuesta, filaADecision,
  esHrefExterno, esHrefInterno, URGENCIAS, OTRA, TOPES, type Decision,
} from '../app/admin/runway/decisiones';
import { TableroDecisiones } from '../app/admin/runway/Tablero';
import { rutaMovil, rutaEscritorio } from '../lib/movil-rutas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BASE = { ref: 'una-decision', chat: 'Image Editor', pregunta: '¿Va?', opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }] };
const motivo = (x: unknown) => { const r = sanearPublicada(x); return r.ok ? null : r.motivo; };

test('lo que se publica es corto: un texto largo se RECHAZA con su motivo, no se recorta', () => {
  // Rota: sin el tope de la pregunta → 8 pases, 1 fallo.
  assert.equal(motivo(BASE), null);
  assert.match(motivo({ ...BASE, pregunta: 'x'.repeat(TOPES.pregunta + 1) }) ?? '', /pregunta va de 1 a/);
  assert.match(motivo({ ...BASE, opciones: [{ clave: 'A', texto: 'x'.repeat(TOPES.opcion + 1) }] }) ?? '', /opción A/);
  assert.match(motivo({ ...BASE, opciones: ['A', 'B', 'C', 'D', 'A'].map((c) => ({ clave: c, texto: c })) }) ?? '', /como mucho/);
  assert.match(motivo({ ...BASE, opciones: [{ clave: 'A', texto: 'x' }, { clave: 'A', texto: 'y' }] }) ?? '', /repetida/);
  assert.match(motivo({ ...BASE, ref: 'Con Mayúsculas' }) ?? '', /ref inválida/);
  assert.match(motivo({ ...BASE, recomendada: 'C' }) ?? '', /recomienda la opción C/);
  assert.match(motivo({ ...BASE, urgencia: 'urgente' }) ?? '', /urgencia/);
  // Sin opciones se contesta escribiendo: es válido.
  assert.equal(motivo({ ...BASE, opciones: undefined }), null);
});

test('un link lleva a una pantalla de MaKo o a un origen de la lista, comparado por ORIGEN', () => {
  // Rota: `esHrefExterno` con `startsWith('https://claude.ai')` → 8 pases, 1 fallo (el @ y el .evil pasan).
  assert.equal(motivo({ ...BASE, href: '/plan/revisar/abc' }), null);
  assert.equal(motivo({ ...BASE, href: 'https://claude.ai/artifact/X' }), null);
  const conMako = sanearPublicada({ ...BASE, href: 'https://hola-mako.com/plan/revisar/abc' });
  assert.ok(conMako.ok && conMako.d.href === '/plan/revisar/abc', 'un link a hola-mako.com queda como camino interno');
  for (const malo of ['//evil.tld/x', 'https://claude.ai@evil.tld/x', 'https://claude.ai.evil.tld/x', 'http://claude.ai/x', 'javascript:alert(1)', 'https://evil.tld']) {
    assert.ok(motivo({ ...BASE, href: malo }), `pasó ${malo}`);
    assert.equal(esHrefInterno(malo) || esHrefExterno(malo), false, malo);
  }
});

test('una respuesta es una opción de ESA decisión, u «otra» con texto', () => {
  const d = { opciones: BASE.opciones };
  assert.equal(motivoRespuestaInvalida(d, 'A', ''), null);
  assert.equal(motivoRespuestaInvalida(d, 'C', ''), 'Esa opción no existe');
  assert.equal(motivoRespuestaInvalida(d, OTRA, '   '), 'Escribe tu respuesta');
  assert.equal(motivoRespuestaInvalida(d, OTRA, 'Que sí, pero en mayo'), null);
  assert.ok(motivoRespuestaInvalida(d, 'A', 'x'.repeat(TOPES.texto + 1)));
});

const dec = (p: Partial<Decision> & { id: number }): Decision => ({
  ref: `d-${p.id}`, chat: 'Chat', pregunta: `¿Pregunta ${p.id}?`, opciones: BASE.opciones, destraba: null,
  contexto: null, recomendada: null, urgencia: 'criterio', href: null, orden: 100, respuesta: null,
  respuestaTexto: null, respondidaAt: null, recogidaAt: null, creadaAt: '2026-10-14T10:00:00Z', ...p,
});

test('el reparto: pendientes por urgencia y en su orden, contestadas aparte (la última primero)', () => {
  // Rota: ordenar por id en vez de por `orden` → 8 pases, 1 fallo.
  const r = repartir([
    dec({ id: 1, urgencia: 'criterio', orden: 50 }),
    dec({ id: 2, urgencia: 'criterio', orden: 10 }),
    dec({ id: 3, urgencia: 'bloquea' }),
    dec({ id: 4, respuesta: 'A', respondidaAt: '2026-10-14T11:00:00Z' }),
    dec({ id: 5, respuesta: 'B', respondidaAt: '2026-10-14T12:00:00Z' }),
    dec({ id: 6, urgencia: 'aviso' }),
  ]);
  assert.deepEqual(r.pendientes.criterio.map((d) => d.id), [2, 1]);
  assert.deepEqual(r.pendientes.bloquea.map((d) => d.id), [3]);
  assert.deepEqual(r.pendientes.aviso.map((d) => d.id), [6]);
  assert.deepEqual(r.contestadas.map((d) => d.id), [5, 4]);
  assert.equal(textoDeRespuesta(dec({ id: 7, respuesta: 'B' })), 'B · No');
  assert.equal(textoDeRespuesta(dec({ id: 8, respuesta: OTRA, respuestaTexto: 'En mayo' })), 'En mayo');
});

test('la fila de la base se lee sin inventar: una urgencia que no existe cae en criterio', () => {
  const d = filaADecision({ id: '9', ref: 'x', chat: 'C', pregunta: '¿?', opciones: [{ clave: 'A', texto: 'Sí' }, { nada: 1 }], urgencia: 'rara', creada_at: '2026-10-14' });
  assert.equal(d.id, 9);
  assert.deepEqual(d.opciones, [{ clave: 'A', texto: 'Sí' }]);
  assert.equal(d.urgencia, 'criterio');
});

test('la tab, la acción y la página del teléfono son del super admin', () => {
  // Rota: sacar el getSesionAdmin de la acción → 8 pases, 1 fallo.
  const accion = sinComentarios(leer('app/admin/runway/acciones.ts'));
  assert.match(accion, /export async function responderDecision\([\s\S]*?\{\s*const admin = await getSesionAdmin\(\);\s*if \(!admin\) return/);
  const page = sinComentarios(leer('app/admin/runway/page.tsx'));
  assert.match(page, /const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\('\/inicio'\);/);
  assert.match(page, /const hoy = hoyAR\(\)/);
  const movil = sinComentarios(leer('app/m/decisiones/page.tsx'));
  assert.match(movil, /const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\(/);
  assert.match(movil, /requireMovil\(/);
  // Y la tabla no entra por el scope de inquilinos: es de la plataforma.
  assert.doesNotMatch(leer('lib/workspace.ts'), /'admin_decisiones'/);
});

test('el teléfono abre el MISMO tablero en la misma URL', () => {
  // Rota: sacar la fila de rutaMovil → 8 pases, 1 fallo (el teléfono vería «se usa en la computadora»).
  assert.equal(rutaMovil('/admin/runway'), '/m/decisiones');
  assert.equal(rutaEscritorio('/m/decisiones'), '/admin/runway');
  assert.equal(rutaMovil('/admin/runway/foto'), null, 'la foto es ancha: se queda en la computadora');
  assert.match(leer('app/m/decisiones/page.tsx'), /<TableroDecisiones /);
});

test('la tabla nace con RLS, sin grants a anon, y su CHECK dice las mismas urgencias que el código', () => {
  // Rota: una urgencia en el código que no está en el CHECK → 8 pases, 1 fallo.
  const sql = sinComentarios(leer('supabase/migrations/0277_admin_decisiones.sql').replace(/--.*$/gm, ''));
  assert.match(sql, /alter table admin_decisiones enable row level security;/);
  assert.match(sql, /revoke all on admin_decisiones from anon, authenticated;/);
  assert.match(sql, /ref\s+text not null unique/);
  const check = /check \(urgencia in \(([^)]*)\)\)/.exec(sql)?.[1] ?? '';
  const enSql = [...check.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(enSql, URGENCIAS.map((u) => u.clave).sort());
});

test('la página dibujada: los avisos no cuentan, la recomendada se marca y un link de afuera abre aparte', () => {
  // Rota: contar los avisos en «Para decidir» → 8 pases, 1 fallo; el link externo sin rel → 8 pases, 1 fallo.
  const responder = async () => ({ error: null, ok: true });
  const html = renderToStaticMarkup(createElement(TableroDecisiones, {
    hoy: '2026-10-14', responder,
    lectura: { ok: true, decisiones: [
      dec({ id: 1, urgencia: 'bloquea', recomendada: 'A', destraba: 'El chat X' }),
      dec({ id: 2, urgencia: 'aviso', opciones: [{ clave: 'A', texto: 'Entendido' }] }),
      dec({ id: 3, href: 'https://claude.ai/artifact/X' }),
      dec({ id: 4, opciones: [] }),
      dec({ id: 5, respuesta: 'A', respondidaAt: '2026-10-14T12:00:00Z' }),
    ] },
  }));
  assert.match(html, /Para decidir<\/p><p class="decisiones-cifra-v">3</, 'cuenta 3: los avisos y las contestadas no');
  assert.match(html, /Para saber/);
  assert.match(html, /decisiones-reco">Recomendada/);
  assert.match(html, /href="https:\/\/claude\.ai\/artifact\/X" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /<textarea name="texto"[^>]*placeholder="Tu respuesta"/, 'sin opciones se contesta escribiendo');
  assert.match(html, /Contestadas <span class="decisiones-grupo-n">1</);
  // Sin la tabla, lo dice: no dibuja un tablero vacío que se lee «no hay nada».
  const falta = renderToStaticMarkup(createElement(TableroDecisiones, { hoy: '2026-10-14', responder, lectura: { ok: false, faltaTabla: true, error: 'x' } }));
  assert.match(falta, /Falta crear la tabla/);
  assert.doesNotMatch(falta, /No hay nada esperando/);
});
