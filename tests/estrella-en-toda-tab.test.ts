// La estrella flota en toda tab (Martín, 1/11/2026: «Dentro de la misma página, independientemente de qué tab estemos»).
// Probado rompiéndolo:
//   · la barra sin <EstrellaDeLaApp />                     → 1
//   · MakoEnLaTab sin anotarse                             → 2 (dos estrellas en el CRM)
//   · la de la barra sin `deLaApp`                         → 3 (se abre sola en cada tab)
//   · una ruta de la lista que ya no existe                → 4
//   · sacar /offer de la lista                             → 5

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CON_CHAT_A_LA_VISTA, llevaEstrellaDeLaApp } from '../lib/estrella-rutas';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. la monta la barra, para quien puede ver el Ops Center, y fuera del <aside>', () => {
  const barra = leer('app/_components/Sidebar.tsx');
  assert.match(barra, /\{!!rol && arriba\.length > 0 && <EstrellaDeLaApp \/>\}\n\s*<aside data-sidebar/);
});

test('2. la tab que tiene la suya se anota, y la de la barra se retira: nunca dos', () => {
  assert.match(leer('app/_chat/MakoEnLaTab.tsx'), /useEffect\(\(\) => \(deLaApp \? undefined : anotarEstrellaPropia\(\)\), \[deLaApp\]\);/);
  assert.match(leer('app/_chat/EstrellaDeLaApp.tsx'), /if \(hayPropia \|\| !llevaEstrellaDeLaApp\(pathname\)\) return null;/);
});

test('3. la de la barra no se abre sola ni dice su corto, y cambiar de tab la cierra', () => {
  const app = leer('app/_chat/EstrellaDeLaApp.tsx');
  assert.match(app, /<MakoEnLaTab key=\{pathname\} tab=\{tab\} deLaApp \/>/);
  const mako = leer('app/_chat/MakoEnLaTab.tsx');
  assert.match(mako, /useEstrellaCerrada\(tab, !abierto, deLaApp\)/);
  assert.match(mako, /const propio = callada \|\| CON_SU_ARRANQUE\.has\(tab\);/);
});

test('4. cada ruta de la lista existe: una mudanza no deja la excepción colgada', () => {
  for (const r of CON_CHAT_A_LA_VISTA) assert.ok(existsSync(resolve(RAIZ, 'app', `.${r}`)), `${r} no existe`);
});

test('5. con un chat a la vista no hay estrella; en el resto, sí', () => {
  for (const r of ['/second-brain', '/admin/operaciones', '/offer', '/copywriter/12', '/m/crm', '/privacidad', '/planes', '/planes/pro']) assert.equal(llevaEstrellaDeLaApp(r), false, r);
  for (const r of ['/general', '/chats', '/competitor-spy', '/integraciones', '/offering', '/mapa', '/mas']) assert.equal(llevaEstrellaDeLaApp(r), true, r);
});
