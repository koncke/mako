// =============================================================================
// Una página pública no ejecuta server actions: sólo se lee
// =============================================================================
// Medido el 06/10/2026 en local: un POST SIN cookie y SIN Origin a `/login` con el header
// `next-action` de `listConfirmacionesAction` contestó 200 con las confirmaciones pendientes del
// CRM del ws1 (nombres de leads, cambios y el `revert`). Lo mismo por `/privacidad`, `/terminos`
// y `/vsl`. Next reenvía la acción a cualquier worker que la tenga, así que por esa puerta
// entraba cualquier server action de la app, contra el workspace del dueño. Después del arreglo:
// 405 en las seis páginas públicas, con el header y por formulario multipart.
//
// Probado ROMPIÉNDOLO (06/10/2026):
//   · `esPublicaSoloLeer` devolviendo sólo `esPublicaSoloLectura` (la regla vieja)
//     → 1 fallo («las páginas públicas sólo se leen»).
//   · el proxy volviendo a `esPublicaSoloLectura` en la rama pública → 1 fallo (el guard del fuente).
//   · sacando el `haySesion()` de `resolverConfirmacionAction` → 1 fallo.
//   · (11/10/2026) sacando `'/pagar'` de PUBLICOS → 1 fallo, 3 pases (las páginas del comprador
//     dejan de ser públicas). Restaurado: 4 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las páginas públicas sólo se leen', () => {
  // /reembolsos y las del comprador de un link de pago (/pagar/<token> y su retorno) entraron el
  // 11/10/2026: son páginas, así que un POST ahí tiene que dar 405 como en las demás.
  for (const p of ['/login', '/privacidad', '/terminos', '/vsl', '/vsl/estrategia', '/vsl-assets/x.html', '/compartido/abc', '/compartido/curso/c1.1.1.1.x', '/reembolsos', '/pagar/AbCdEfGhIjKlMnOpQrStUvWxYz012345', '/pagar/AbCdEfGhIjKlMnOpQrStUvWxYz012345/listo']) {
    assert.ok(esPublica(p), `${p} debería ser pública`);
    assert.equal(esPublicaSoloLeer(p), true, `${p} es una página pública: no puede aceptar POST (ejecutaría server actions sin sesión)`);
  }
});

test('las APIs públicas que escriben siguen escribiendo', () => {
  for (const p of ['/api/track/vsl', '/api/webhooks/meta-leads', '/api/compartido/curso/tarea', '/api/compartido/curso/progreso', '/api/agente/lead', '/api/pagar/email']) {
    assert.equal(esPublicaSoloLeer(p), false, `${p} recibe POST sin sesión por diseño`);
  }
  // Y las de sólo lectura siguen siéndolo.
  assert.equal(esPublicaSoloLeer('/api/compartido/archivo'), true);
});

test('el proxy usa esPublicaSoloLeer en la rama pública', () => {
  const src = sinComentarios(leer('proxy.ts'));
  const ini = src.indexOf('if (esPublica(pathname))');
  assert.ok(ini > 0, 'no encontré la rama de las rutas públicas');
  const rama = src.slice(ini, src.indexOf('return seguir(req);', ini));
  assert.match(rama, /esPublicaSoloLeer\(pathname\)/, 'la rama pública tiene que cortar todo método que no sea leer en una PÁGINA pública');
  assert.match(rama, /\['GET', 'HEAD', 'OPTIONS'\]/);
});

// Desde el 13/10/2026 «A revisar» monta las de los datos sin marcar (ignorar un dato, qué avisa).
// Probado rompiéndolo: sin `haySesion()` en ignorarDatoAction, 1 fallo.
test('las acciones de «A revisar» (datos sin marcar) exigen sesión adentro', () => {
  const src = sinComentarios(leer('app/crm/datos-sin-marcar-actions.ts'));
  for (const fn of ['ignorarDatoAction', 'avisosDatosAction', 'guardarAvisosDatosAction']) {
    const ini = src.indexOf(`export async function ${fn}`);
    assert.ok(ini >= 0, `no encontré ${fn}`);
    const fin = src.indexOf('\nexport ', ini + 10);
    const cuerpo = src.slice(ini, fin < 0 ? undefined : fin);
    assert.match(cuerpo, /haySesion\(\)/, `${fn} tiene que cortar sin sesión: la monta el layout y su id viaja en todas las páginas`);
  }
});

test('las acciones del layout (confirmaciones de MaKo) exigen sesión adentro', () => {
  const src = sinComentarios(leer('app/crm/mako-confirm-actions.ts'));
  for (const fn of ['listConfirmacionesAction', 'resolverConfirmacionAction']) {
    const ini = src.indexOf(`export async function ${fn}`);
    assert.ok(ini >= 0, `no encontré ${fn}`);
    const fin = src.indexOf('\nexport ', ini + 10);
    const cuerpo = src.slice(ini, fin < 0 ? undefined : fin);
    assert.match(cuerpo, /haySesion\(\)/, `${fn} tiene que cortar sin sesión: la monta el layout y su id viaja en todas las páginas`);
  }
});
