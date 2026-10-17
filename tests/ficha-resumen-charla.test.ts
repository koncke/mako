// =============================================================================
// Los siete bloques de la CHARLA del Resumen, que estaban en las plantillas y se salteaban (17/10/2026)
// =============================================================================
// docs/relevo/crm.md §0-Ω9: `charla-whatsapp`, `charla-dm`, `pase-a-humano`, `cambios-de-mako`, `mensaje-listo`,
// `automatizaciones-en-curso` y `lo-que-le-mandamos` no tenían componente. Ahora cada uno lee lo suyo al montarse
// (app/crm/lead-view/ficha/resumen/charla-actions.ts) y SÓLO MUESTRA: mandar, contestar y confirmar siguen en su
// pantalla. Lo que se fija:
//   1. los siete están registrados, con sus reglas (lo que se sabe antes de leer);
//   2. cada lectura exige sesión y lee con el workspace (sin cookie, el ws1 es un cliente);
//   3. ninguno manda nada: ni el archivo de las acciones ni el de los componentes importan un envío.
//
// Verificado rompiéndolo (el archivo da 3 / 0): sacar `charla-dm` del registro → 2 / 1 (el 1); una acción sin
// `conSesion()` → 2 / 1 (el 2); importar `enviarMensaje` en las acciones → 2 / 1 (el 3).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';
import type { CtxFicha } from '../app/crm/lead-view/ficha/tipos';
import type { Lead } from '../lib/leads';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CHARLA = ['charla-whatsapp', 'charla-dm', 'pase-a-humano', 'cambios-de-mako', 'mensaje-listo', 'automatizaciones-en-curso', 'lo-que-le-mandamos'] as const;

test('los siete están registrados, y lo que se sabe antes de leer los calla', () => {
  const registro = leer('app/crm/lead-view/ficha/registro-resumen.tsx');
  for (const id of CHARLA) {
    assert.ok(REGLAS_RESUMEN[id], `«${id}» sin reglas`);
    assert.match(registro, new RegExp(`'${id}': \\{ Componente: \\w+, \\.\\.\\.REGLAS_RESUMEN\\['${id}'\\] \\}`), `«${id}» sin componente`);
  }
  const ctx = (lead: Partial<Lead>) => ({ lead } as unknown as CtxFicha);
  // Sin teléfono no hay WhatsApp; con uno, se lee.
  assert.equal(REGLAS_RESUMEN['charla-whatsapp'].estaVacio(ctx({ telefono: null, telefono_normalizado: null })), true);
  assert.equal(REGLAS_RESUMEN['charla-whatsapp'].estaVacio(ctx({ telefono: '+52 55 1234 5678' })), false);
  // Sin @ ni entrada por redes no hay DM.
  assert.equal(REGLAS_RESUMEN['charla-dm'].estaVacio(ctx({ instagram: null, entrada_social: null })), true);
  assert.equal(REGLAS_RESUMEN['charla-dm'].estaVacio(ctx({ instagram: 'mako.app' })), false);
  // Sin email ni teléfono ninguna automatización le mandó nada.
  assert.equal(REGLAS_RESUMEN['lo-que-le-mandamos'].estaVacio(ctx({ email: null, telefono: null, telefono_normalizado: null })), true);
});

test('cada lectura exige sesión y lee con el workspace', () => {
  const acc = leer('app/crm/lead-view/ficha/resumen/charla-actions.ts');
  assert.match(acc, /^'use server';/);
  const fns = [...acc.matchAll(/export async function (\w+)\(leadId: number\)[^\n]*\{\n\s*if \(!idValido\(leadId\) \|\| !\(await conSesion\(\)\)\) return null;/g)].map((m) => m[1]);
  assert.equal(fns.length, 7, `las siete acciones cortan sin sesión; vi ${fns.join(', ')}`);
  assert.equal((acc.match(/^export async function /gm) ?? []).length, 7, 'una acción nueva sin el corte');
  assert.doesNotMatch(acc, /getSupabaseServer|createClient\(/, 'la lectura tiene que ir por getTenantDb (el workspace del que mira)');
});

test('ninguno manda nada: sólo muestran, y llevan a la pantalla donde se hace', () => {
  for (const f of ['app/crm/lead-view/ficha/resumen/charla-actions.ts', 'app/crm/lead-view/ficha/resumen/charla.tsx']) {
    const src = leer(f);
    assert.doesNotMatch(src, /enviar\w*\(|mandar\w*Action|sendText|evolution|resolverConfirmacionAction|\.insert\(|\.update\(|\.delete\(/i, `${f} escribe o manda algo`);
  }
});
