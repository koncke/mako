// =============================================================================
// renombrar-features — los proyectos de producto pasan a llamarse «Feature: X»
// =============================================================================
// Sin --apply solo IMPRIME. Con --apply escribe, y antes deja backup de los nombres
// en app_settings (mako.backup.nombres-proy9).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/renombrar-features.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/renombrar-features.ts --apply
//
// POR QUÉ: pedido del dueño — «revisa los nombres de los proyectos y les cambies el
// nombre a "Feature: NOMBRE" así se entiende bien». En un tablero de 38 proyectos
// mezclados, «Facturación» no dice si es una pantalla que hay que construir o un trámite
// que hay que hacer. Con el prefijo, la familia se lee de un vistazo.
//
// QUÉ NO SE TOCA, y es la otra mitad del pedido («si no debe llevar Feature: no se lo
// pongas»): los transversales (Seguridad, Diseño de la app, Infraestructura, Avisos,
// Legal y fiscal), los de vender («Vender MaKo: …») y lo que está fuera del catálogo.
//
// SEGURO DE CORRER DOS VECES: el destino sale de `canonNombre`, que ya es idempotente
// («Feature: CRM» → «Feature: CRM»), así que la segunda pasada no encuentra nada que hacer.
//
// Las tareas NO se tocan: `plan_tareas.labels` guarda IDS de proyecto, no nombres. Y los
// borradores pendientes que guardaron el nombre viejo siguen funcionando, porque el ruteo
// resuelve por `nucleo()` — «CRM» y «Feature: CRM» son el mismo proyecto.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { setSetting } from '../lib/settings';
import { canonNombre, delCatalogo } from '../lib/plan-proyectos-catalogo';

const APLICAR = process.argv.includes('--apply');
const WS = 9;

type Fila = { id: string; pid: string; name: string };

async function main() {
  await runWithWorkspace(WS, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('plan_proyectos').select('id, pid, name').order('pid');
    if (error) throw new Error(`leer proyectos: ${error.message}`);
    const filas = (data ?? []) as Fila[];

    const cambios = filas
      .map((p) => ({ ...p, nuevo: canonNombre(p.name) }))
      .filter((p) => p.nuevo !== p.name);
    const fuera = filas.filter((p) => !delCatalogo(p.name));

    console.log(`\n  ${filas.length} proyectos · ${cambios.length} a renombrar\n`);
    for (const c of cambios) console.log(`  → ${c.name}  ⇒  ${c.nuevo}`);
    if (fuera.length) console.log(`\n  Fuera del catálogo (NO se tocan): ${fuera.map((f) => f.name).join(', ')}`);

    if (!cambios.length) { console.log('\n  Nada que hacer.'); return; }
    if (!APLICAR) { console.log('\n  (dry-run: corré con --apply para escribir)'); return; }

    // El backup va ANTES de la primera escritura y con los nombres viejos completos:
    // deshacer esto tiene que ser un UPDATE, no una arqueología.
    await setSetting('mako.backup.nombres-proy9', JSON.stringify(filas.map((f) => ({ id: f.id, name: f.name }))));
    console.log('\n  ✓ backup en app_settings → mako.backup.nombres-proy9');

    let ok = 0;
    for (const c of cambios) {
      const { error: e } = await db.from('plan_proyectos').update({ name: c.nuevo }).eq('id', c.id);
      if (e) { console.error(`  ✗ ${c.name}: ${e.message}`); continue; }
      ok++;
    }
    console.log(`  ✓ ${ok}/${cambios.length} renombrados`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
