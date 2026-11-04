// =============================================================================
// La lista de grupos de una agencia parada en la cuenta de un cliente (ticket #55, 4/11/2026)
// =============================================================================
// El administrador de una agencia, adentro de la cuenta de un cliente, veía en la lista los grupos de todos sus otros clientes. Lo que se
// decidió: en la pestaña de un cliente, sólo el grupo de ese cliente; en la de su negocio, el suyo, sus invitaciones y su cartera, como antes
// (para que el equipo de la agencia pueda estar pendiente). La puerta (`accesoAlGrupo`) no cambia: la lista filtra.
// El hijo corre la RUTA REAL de la lista: tests/_grupos-ops-lista-cartera-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  if (fallo) throw fallo;
  try {
    const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupos-ops-lista-cartera-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
    return corrida;
  } catch (e) { fallo = e; throw e; }
}
const orden = (xs: number[]) => [...xs].sort((a, b) => a - b);

test('la agencia, parada en la cuenta de un cliente: sólo el grupo de ese cliente', () => {
  assert.deepEqual(R().agenciaEnElCliente, [15], 'ni los otros clientes de la cartera, ni su negocio, ni sus invitaciones');
});

test('la agencia, en su propio negocio: el suyo, su cartera aprobada y sus invitaciones, como antes', () => {
  assert.deepEqual(orden(R().agenciaEnSuNegocio), [13, 15, 16, 30]);
  assert.deepEqual(orden(R().agenciaSinPestana), [13, 15, 16, 30], 'sin pestaña puesta, su sesión dice su negocio');
});

test('en la pestaña de un cliente que ya no es de su cartera, no ve nada: la puerta dice que no', () => {
  assert.deepEqual(R().agenciaEnUnRevocado, []);
});

test('un cliente común: el suyo y sus invitaciones, nunca la agencia ni los otros clientes', () => {
  assert.deepEqual(orden(R().clienteEnSuNegocio), [15, 30]);
});

test('la puerta no cambió: la agencia abre igual otro grupo de su cartera, y el cliente no', () => {
  assert.equal(R().puertaOtroDeLaCartera, 200);
  assert.equal(R().puertaClienteAOtro, 404);
});

// PROBADO ROMPIÉNDOLO (4/11/2026), base 5/0:
// - sin el corte por la pestaña en `gruposDeLaPersona` (lib/grupo-puerta.ts): rojos el 1 y el 3 (veía toda su cartera) → 3/2.
// - sumando la pestaña a los candidatos en vez de cortar: rojos el 1 y el 3 → 3/2.
// - cortando en cualquier pestaña, también en la de su negocio: rojos el 2 y el 4 → 3/2.
// - devolviendo la pestaña sin preguntarle a la puerta: rojo el 3 → 4/1.
