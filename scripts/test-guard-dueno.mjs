// =============================================================================
// test-guard-dueno — quién puede mover plata en Meta (tarea #167)
// =============================================================================
//   node scripts/test-guard-dueno.mjs
//
// No toca la base ni la red. Replica la lógica de esDuenoAdmin() (lib/workspace.ts)
// contra las 4 combinaciones que importan, para fijar que un closer del workspace
// principal NO pase.
//
// Se replica en vez de importar porque lib/workspace.ts trae 'server-only' y
// next/headers: no se puede cargar fuera de Next. Si cambiás esDuenoAdmin,
// actualizá esta copia — el test es un candado sobre la REGLA, no sobre el import.

import { strict as assert } from 'node:assert';

const OWNER_WS = 1;

// Espejo de esDuenoAdmin(): admin de agencia, o admin del workspace principal.
function esDuenoAdmin({ esAdminAgencia, wsActual, rolWs }) {
  if (esAdminAgencia) return true;
  return wsActual === OWNER_WS && rolWs === 'admin';
}

let n = 0;
const ok = (t) => { n++; console.log(`  ✓ ${t}`); };

// EL BUG QUE ESTO CIERRA: antes el guard era solo `wsActual === OWNER_WS`.
const guardViejo = ({ wsActual }) => wsActual === OWNER_WS;

{
  const closerDeLaCasa = { esAdminAgencia: false, wsActual: 1, rolWs: 'closer' };
  assert.equal(guardViejo(closerDeLaCasa), true);
  assert.equal(esDuenoAdmin(closerDeLaCasa), false);
  ok('un CLOSER del workspace principal ya NO puede borrar campañas (antes sí)');
}
{
  const setterDeLaCasa = { esAdminAgencia: false, wsActual: 1, rolWs: 'setter' };
  assert.equal(esDuenoAdmin(setterDeLaCasa), false);
  ok('un SETTER del workspace principal tampoco');
}
{
  const adminDeLaCasa = { esAdminAgencia: false, wsActual: 1, rolWs: 'admin' };
  assert.equal(esDuenoAdmin(adminDeLaCasa), true);
  ok('el ADMIN del workspace principal sí puede (no lo rompimos)');
}
{
  const agencia = { esAdminAgencia: true, wsActual: null, rolWs: null };
  assert.equal(esDuenoAdmin(agencia), true);
  ok('el admin de la agencia puede, aunque no impersone');
}
{
  const clienteAjeno = { esAdminAgencia: false, wsActual: 7, rolWs: 'admin' };
  assert.equal(esDuenoAdmin(clienteAjeno), false);
  ok('el admin de OTRO workspace no puede tocar la cuenta de Meta de la agencia');
}
{
  // rol_ws null = admin por backfill (convención de getRolWsEfectivo). Ojo: acá NO
  // aplica, porque getRolWsEfectivo ya resuelve el null antes de llegar al guard.
  const sinRol = { esAdminAgencia: false, wsActual: 1, rolWs: null };
  assert.equal(esDuenoAdmin(sinRol), false);
  ok('sin rol resuelto, no pasa (fail-closed)');
}

console.log(`\n${n}/${n} OK — tarea #167`);
