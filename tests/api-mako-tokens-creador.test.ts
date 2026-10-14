// Un token detallado deja de valer cuando quien lo creó deja de administrar el negocio (como
// GitHub). El juicio es puro (lib/api-mako/tokens-creador.ts); el cableado vive en tokens.ts
// (resolverTokenApi → creadorVigente) y en http.ts (el 401 con su texto).
//
// Verificado rompiéndolo (13/10/2026), con la base en verde (8 de 8), cada rotura → 1 fallo y 7 pases:
//   · sacar `if (u.workspace_id === ws) return true;` (cae «el admin del propio negocio»).
//   · sacar el corte `(u.rol_ws ?? 'admin') !== 'admin'` (cae «el que pasó a closer o setter»).
//   · cambiar la llamada a creadorVigente en resolverTokenApi por `false` (cae el cableado).
//   · sacar el 401 de http.ts (cae el cableado de /api/v1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creadorConAcceso, mensajeSinCreador } from '../lib/api-mako/tokens-creador';

const u = (x: Partial<{ rol: string; rol_ws: string | null; workspace_id: number | null; estado: string }>) =>
  ({ rol: 'usuario', rol_ws: 'admin', workspace_id: 9, estado: 'activo', ...x });

test('el admin del propio negocio sigue: con rol_ws admin o sin rol_ws', () => {
  assert.equal(creadorConAcceso(9, u({})), true);
  assert.equal(creadorConAcceso(9, u({ rol_ws: null })), true);
});

test('el admin global de MaKo sigue en cualquier negocio', () => {
  assert.equal(creadorConAcceso(9, u({ rol: 'admin', workspace_id: null, rol_ws: null })), true);
});

test('el que ya no existe, el suspendido y el que pasó a closer o setter, no', () => {
  assert.equal(creadorConAcceso(9, null), false);
  assert.equal(creadorConAcceso(9, u({ estado: 'suspendido' })), false);
  assert.equal(creadorConAcceso(9, u({ rol_ws: 'closer' })), false);
  assert.equal(creadorConAcceso(9, u({ rol_ws: 'setter' })), false);
});

test('el que se mudó a OTRO negocio no sigue en éste', () => {
  assert.equal(creadorConAcceso(9, u({ workspace_id: 12 })), false);
});

test('el admin de una agencia sigue sólo si este negocio está APROBADO en su cartera', () => {
  const agencia = u({ workspace_id: 13 });
  assert.equal(creadorConAcceso(9, agencia, [{ agencia_ws: 13, cliente_ws: 9, estado: 'aprobado' }]), true);
  assert.equal(creadorConAcceso(9, agencia, [{ agencia_ws: 13, cliente_ws: 9, estado: 'revocado' }]), false);
  assert.equal(creadorConAcceso(9, agencia, [{ agencia_ws: 13, cliente_ws: 10, estado: 'aprobado' }]), false);
  assert.equal(creadorConAcceso(9, agencia, []), false);
});

test('el texto del 401 nombra el token y dice dónde se arregla', () => {
  const m = mensajeSinCreador('Mi integración');
  assert.match(m, /«Mi integración»/);
  assert.match(m, /API → Tokens/);
});

const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('cableado: resolverTokenApi revisa al creador y no marca uso de un token sin creador', () => {
  const src = leer('../lib/api-mako/tokens.ts');
  const ini = src.indexOf('export async function resolverTokenApi');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(cuerpo, /creadorVigente\(r\.ws, r\.g\.creadoPor\)/);
  assert.match(cuerpo, /if \(!venc && !sinCreador\) marcarUso/);
  assert.match(src, /r\.vencido \|\| r\.sinCreador/, 'wsPorTokenApi también lo descarta');
});

test('cableado: /api/v1 contesta 401 con el texto propio a un token sin creador', () => {
  const src = leer('../lib/api-mako/http.ts');
  assert.match(src, /r\.clase === 'detallado' && r\.sinCreador\) return errorJson\(401, mensajeSinCreador\(r\.nombre\)\)/);
});
