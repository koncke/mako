// =============================================================================
// El super admin ve de dónde llegó cada cliente, en la tabla de clientes (17/10/2026)
// =============================================================================
// docs/relevo/onboarding.md: «una pantalla del super admin que junte "cómo llegó" de todos los clientes». La respuesta
// se guardaba (`onboarding.encuesta`, al cerrar el arranque) y sólo se leía cliente por cliente (la API de MaKo,
// `ver_estado_onboarding`). Ahora va en la tabla de /classroom/clients (la del super admin) y en su CSV.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): llegadaDe sin el rótulo del interés → 1 fallo; la ruta sin leer la encuesta → 1
// fallo; la tabla sin la columna → 1 fallo. Base: 3 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAVE_ENCUESTA, INTERESES, llegadaDe } from '../lib/onboarding-arranque';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('llegadaDe: lo que guardó el cierre, con el interés por su rótulo; lo roto o vacío es null', () => {
  const [primero] = INTERESES;
  const at = '2026-10-17T12:00:00.000Z';
  assert.deepEqual(llegadaDe(JSON.stringify({ origen: 'Instagram', interes: primero.id, at })), { origen: 'Instagram', interes: primero.label, at, pdfNota: null });
  assert.deepEqual(llegadaDe(JSON.stringify({ origen: 'Por un amigo de Córdoba', interes: null, at: 'no' })), { origen: 'Por un amigo de Córdoba', interes: null, at: null, pdfNota: null });
  // Lo que dijo que estaba mal en el PDF de su oferta también se lee (quinta revisión, 21/10), aunque no haya contestado más.
  assert.deepEqual(llegadaDe(JSON.stringify({ origen: null, interes: null, at, pdfNota: 'El precio es 500' })), { origen: null, interes: null, at, pdfNota: 'El precio es 500' });
  assert.equal(llegadaDe(null), null);
  assert.equal(llegadaDe('no es json'), null);
  assert.equal(llegadaDe(JSON.stringify({ origen: null, interes: null })), null);
  assert.equal(llegadaDe('[1,2]'), null);
});

test('la ruta del super admin lee la encuesta de TODOS los negocios y la pega a cada uno', () => {
  const src = leer('app/api/admin/workspaces/route.ts');
  assert.match(src, /getSupabaseServer\(\)\.from\('app_settings'\)\.select\('workspace_id, value'\)\.eq\('key', CLAVE_ENCUESTA\)/);
  assert.match(src, /llegada: llegada\.get\(w\.id\) \?\? null,/);
  assert.equal(CLAVE_ENCUESTA, 'onboarding.encuesta', 'la misma clave que escribe el cierre');
});

test('la tabla de clientes y su CSV dicen cómo llegó cada uno', () => {
  const src = leer('app/admin/AdminView.tsx');
  assert.match(src, /<th>Llegó por<\/th>/);
  assert.match(src, /\{w\.llegada\?\.origen \?\? '—'\}/);
  assert.match(src, /'Llegó por', 'Quería resolver', 'A corregir en su oferta'\]/);
  assert.match(src, /w\.llegada\?\.pdfNota \?\? ''\]\);/, 'el CSV sin la nota del PDF');
  assert.match(src, /\{w\.llegada\?\.pdfNota && <span title=\{`A corregir en su oferta: \$\{w\.llegada\.pdfNota\}`\}/, 'la tabla sin la nota del PDF');
});
