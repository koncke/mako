// =============================================================================
// Web Generator: un ícono con un nombre que no está en el catálogo dibuja el NEUTRO (un cuadrado con una diagonal) sin avisar
// =============================================================================
// Medido en el banco (30/10/2026): la «X» de cerrar de Compartir era ese cuadrado. `Ico` lo hace a propósito («nunca un hueco»),
// así que sólo un test puede agarrarlo.
// ⚠️ SÓLO lo que se dibuja con `Ico`. Las pestañas (`icono: '…'` de Publicar y del tema) usan `Icono` de piezas-gma.tsx, otro
// catálogo (TRAZOS): medirlas contra éste hizo «arreglar» cuatro íconos que estaban bien y los rompió (lo agarró la revisión).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { existeIcono } from '../lib/editor-landing/iconos';

const RAIZ = join(import.meta.dirname, '..', 'app', 'web-generator');
// Estos usan los íconos de los menús de la casa (app/_ui/iconos-menu), no los del catálogo de la landing.
const OTRO_CATALOGO = /menu-contextual-/;

function archivos(d: string): string[] {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.tsx?$/.test(n) && !OTRO_CATALOGO.test(n) ? [p] : [];
  });
}

test('todo ícono con nombre fijo del Web Generator está en el catálogo', () => {
  const faltan: string[] = [];
  for (const p of archivos(RAIZ)) {
    const s = readFileSync(p, 'utf8');
    for (const m of s.matchAll(/<Ico\s+n="([^"]+)"|\bicono="([^"]+)"|\batajo\('([a-z0-9-]+)'/g)) {
      const k = m[1] ?? m[2] ?? m[3];
      if (!existeIcono(k)) faltan.push(`${k} (${p.slice(RAIZ.length + 1)})`);
    }
  }
  assert.deepEqual(faltan, []);
});
