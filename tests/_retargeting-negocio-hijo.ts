// =============================================================================
// Hijo de tests/retargeting-negocio.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Las funciones del retargeting que llama el CoPilot (`verRetargeting`, `configurarRetargeting`) con el contexto de OTRO
// negocio: el super admin (su negocio es el 9) mirando a un cliente (el 11) desde `wsDeAdsManager()`. La base, los ajustes y la
// sesión, de mentira (tests/_grupos-ops-arnes.ts); el código, el real.

import { db, decirResultado } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

async function main() {
  db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 11, capa: 'completo', nombre: 'Lidermente', estado: 'activo' });
  const { runWithWorkspace } = await import('../lib/workspace');
  const rt = await import('../lib/retargeting');
  const out: Record<string, unknown> = {};
  out.prender = await runWithWorkspace(9, () => rt.configurarRetargeting(11, true));
  out.filas = db.app_settings.filter((f) => f.key === 'retargeting.config').map((f) => ({ ws: Number(f.workspace_id), value: String(f.value) }));
  out.ver11 = await runWithWorkspace(9, () => rt.verRetargeting(11));
  out.ver9 = await runWithWorkspace(11, () => rt.verRetargeting(9));
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
