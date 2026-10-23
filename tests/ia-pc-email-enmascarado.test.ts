// =============================================================================
// El email de Claude de la computadora de OTRA persona va enmascarado (22/10/2026)
// =============================================================================
// Decisión del Cerebro: el admin de un negocio ve de cada computadora de su equipo el nombre, de quién es, si está en línea,
// el plan y el % de uso (lo necesita para manejar la capacidad). El email de su cuenta de Claude va enmascarado
// (m***@gmail.com), salvo para el dueño de esa computadora y para el super admin. Lo que fija este test:
//   1. cómo se enmascara, y que lo demás de la cuenta (plan, % de uso) va igual;
//   2. que se hace en el SERVIDOR (GET /api/ia-pc/estado, que leen la computadora y el teléfono): el email ajeno ni llega
//      al navegador; entero sólo para el dueño y para el super admin (la puerta de SuperAdmin, `puedeOperar`), y si no se
//      puede saber, enmascarado.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cuentasParaVer, enmascararEmail } from '../lib/ia-pc-reglas';

const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ruta = () => sinComentarios(readFileSync(new URL('../app/api/ia-pc/estado/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));

test('1. el email se enmascara (m***@gmail.com) y lo demás de la cuenta va igual', () => {
  assert.equal(enmascararEmail('martin@gmail.com'), 'm***@gmail.com');
  assert.equal(enmascararEmail('a.b+x@empresa.com.ar'), 'a***@empresa.com.ar');
  assert.equal(enmascararEmail('sin-arroba'), '***');
  assert.equal(enmascararEmail('@raro.com'), '***');
  const cuentas = [{ proveedor: 'claude' as const, email: 'mauricio@negocio.com', plan: 'Max', usado5h: 40, usadoSemana: 12 }, { proveedor: 'claude' as const }];
  assert.deepEqual(cuentasParaVer(cuentas, false), [{ proveedor: 'claude', email: 'm***@negocio.com', plan: 'Max', usado5h: 40, usadoSemana: 12 }, { proveedor: 'claude' }]);
  assert.deepEqual(cuentasParaVer(cuentas, true), cuentas, 'el dueño (o el super admin) ve su email entero');
  assert.equal(cuentas[0].email, 'mauricio@negocio.com', 'enmascarar no cambia la cuenta de origen');
});

test('2. en el servidor: entero sólo para el dueño de la PC y para el super admin; si no se sabe, enmascarado', () => {
  const r = ruta();
  assert.match(r, /cuentas: cuentasParaVer\(d\.cuentas, d\.esMia \|\| superAdmin\),/, 'la ruta manda el email ajeno sin enmascarar');
  assert.doesNotMatch(r, /cuentas: d\.cuentas/, 'las cuentas salen tal cual');
  // El super admin, con la MISMA puerta que SuperAdmin (lib/operaciones-reglas.ts); un error, enmascarado.
  assert.match(r, /puedeOperar\(await getSesionAdmin\(\), await wsSuperAdmin\(\)\)\)\(\)\.catch\(\(\) => false\)/);
  assert.doesNotMatch(r, /rol === 'admin'[^\n]*superAdmin|superAdmin = esAdmin;/, 'ser admin del negocio no es ser super admin');
});
