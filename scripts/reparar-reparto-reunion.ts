// =============================================================================
// Devolverle a cada tarea el dueño que la extracción YA había resuelto bien
// =============================================================================
// El gate de `reunion-auto.ts` borraba `esDeOtro` junto con `duenoEmail` cuando la
// persona no estaba en el workspace (ver lib/reunion-reparto.ts para la historia). Los
// borradores que se armaron con ese código quedaron con TODAS las tareas como propias.
//
// NO HAY QUE RE-EXTRAER, y eso es lo mejor de este arreglo: el dato bueno existe. Cada
// corrida guarda su resultado crudo en `app_settings` bajo `mako.fathom.cache.<id>`,
// escrito segundos ANTES del borrador y antes del gate. Ahí están `esDeOtro` y el email,
// correctos. Re-extraer costaría plata de IA, tiraría la revisión que el dueño ya hizo, y
// habría que soltar tres candados para llegar al mismo resultado.
//
// SEGURO DE CORRER DOS VECES: sin `--aplicar` no escribe. Y el UPDATE lleva
// `.eq('estado','pendiente')`, así que si el dueño la aplicó mientras tanto no toca nada.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-reparto-reunion.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reparar-reparto-reunion.ts --aplicar
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

const APLICAR = process.argv.includes('--aplicar');

/**
 * Título → clave de comparación.
 *
 * ⚠️ VA `corregirMarca` EN LOS DOS LADOS. El título de la propuesta ya pasó por ahí y el
 * del cache no, así que sin esto las tres tareas que decían «Maco» no matcheaban — y una
 * de ellas era de Mauricio. Un arreglo que se pierde el 4% de las filas por una
 * normalización de menos no es un arreglo: es un arreglo con un agujero del tamaño justo
 * para que nadie lo note.
 */
const clave = (s: string, corregir: (t: string) => string): string =>
  corregir(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function main() {
  const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
  const { getSetting } = await import('../lib/settings');
  const { emailsConCuenta, repartoDeTarea, resumenDelReparto } = await import('../lib/reunion-reparto');
  const { listarUsuarios } = await import('../lib/usuarios');
  const { corregirMarca } = await import('../lib/mako-gramatica');

  const conCuenta = emailsConCuenta(await listarUsuarios().catch(() => []));
  console.log(`\nemails con cuenta en la app: ${conCuenta.size}`);

  const db0 = await (async () => null)(); void db0;
  // Los borradores de reunión que siguen pendientes, en cualquier workspace.
  const { getSupabaseServer } = await import('../lib/supabase');
  const admin = getSupabaseServer();
  const { data: props } = await admin.from('plan_propuestas')
    .select('id, workspace_id, ref, fuente_titulo, tareas, resumen')
    .eq('estado', 'pendiente').eq('origen', 'fathom');

  for (const p of (props ?? []) as Array<{ id: string; workspace_id: string; ref: string | null; fuente_titulo: string | null; tareas: unknown; resumen: string | null }>) {
    const ts = (p.tareas ?? []) as Array<Record<string, unknown>>;
    const rid = String(p.ref ?? '').replace(/^fathom:/, '');
    if (!rid || !ts.length) continue;
    // ¿Ya está bien? Si alguna trae `esDeOtro`, este borrador no pasó por el gate roto.
    if (ts.some((t) => t.esDeOtro)) { console.log(`\n· ${p.id} (ws ${p.workspace_id}) «${p.fuente_titulo}» — ya tiene reparto, se saltea`); continue; }

    await runWithWorkspace(Number(p.workspace_id), async () => {
      const crudo = await getSetting(`mako.fathom.cache.${rid}`);
      if (!crudo) { console.log(`\n· ${p.id} (ws ${p.workspace_id}) «${p.fuente_titulo}» — SIN cache, no se puede reparar sin re-extraer`); return; }
      let cache: Array<Record<string, unknown>> = [];
      try {
        const j = JSON.parse(crudo) as Record<string, unknown>;
        cache = (Array.isArray(j.tareas) ? j.tareas : Array.isArray(j) ? j : []) as Array<Record<string, unknown>>;
      } catch { console.log(`\n· ${p.id} — cache ilegible`); return; }

      const porTitulo = new Map(cache.map((c) => [clave(String(c.titulo ?? ''), corregirMarca), c]));
      // ⛔ SI EL CACHE NO ES DE ESTA CORRIDA, NO SE TOCA NADA. Pasa de verdad: un
      // «Volver a analizar» pisa el cache y deja adentro OTRAS tareas de la misma
      // reunión, con otra redacción. Ahí no hay forma de saber qué fila del cache
      // corresponde a qué fila del borrador, y emparejar «la más parecida» le pondría a
      // una tarea el dueño de otra — un error peor que el que vinimos a arreglar.
      const matchean = ts.filter((t) => porTitulo.has(clave(String(t.titulo ?? ''), corregirMarca))).length;
      if (matchean < ts.length * 0.8) {
        console.log(`\n· ${p.id} (ws ${p.workspace_id}) «${p.fuente_titulo}»`);
        console.log(`    ⛔ el cache guardado NO es el de este borrador (matchean ${matchean}/${ts.length}): se saltea.`);
        console.log('       Probablemente se re-analizó la reunión y el cache quedó pisado. Para repararla hay que re-extraer.');
        return;
      }
      let tocadas = 0, sinMatch = 0;
      const nuevas = ts.map((t) => {
        const c = porTitulo.get(clave(String(t.titulo ?? ''), corregirMarca));
        if (!c) { sinMatch++; return t; }
        const r = repartoDeTarea(
          { dueño: String(c.dueño ?? c.dueno ?? ''), dueñoEmail: String(c.dueñoEmail ?? c.duenoEmail ?? ''), esDeOtro: !!c.esDeOtro },
          conCuenta,
        );
        if (!r.esDeOtro) return { ...t, ...r };
        tocadas++;
        // Una tarea de OTRO no puede conservar la revisión que el dueño hizo creyéndola
        // propia: `incluir` y `enriquece` se los puso el cruce anti-duplicados corriendo
        // sobre 37 candidatas cuando eran 11. Se limpian solo en las que cambian de mano.
        const { incluir: _i, enriquece: _e, ampliar: _a, ...resto } = t;
        return { ...resto, ...r };
      });

      const mias = nuevas.filter((t) => !t.esDeOtro).length;
      console.log(`\n· ${p.id} (ws ${p.workspace_id}) «${p.fuente_titulo}»`);
      console.log(`    ${ts.length} tareas → ${tocadas} pasan a ser de otra persona, ${mias} quedan tuyas${sinMatch ? `, ${sinMatch} sin match en el cache` : ''}`);
      const porDueño = new Map<string, number>();
      for (const t of nuevas) if (t.esDeOtro) porDueño.set(String(t.dueno ?? '?'), (porDueño.get(String(t.dueno ?? '?')) ?? 0) + 1);
      for (const [d, n] of porDueño) console.log(`      ${String(n).padStart(3)} → ${d}`);
      if (!tocadas) return;
      const resumen = `MaKo leyó tu reunión${p.fuente_titulo ? ` «${p.fuente_titulo}»` : ''} y sacó ${resumenDelReparto(nuevas as never)}.`;
      console.log(`    resumen: ${resumen}`);
      if (!APLICAR) return;
      const db = await getTenantDb();
      // `cruzado_at: null` a propósito: el cruce anti-duplicados se rehace al abrir el
      // modal, pero ahora sobre las candidatas TUYAS y no sobre las 37.
      const { error } = await db.from('plan_propuestas')
        .update({ tareas: nuevas, resumen, cruzado_at: null })
        .eq('id', p.id).eq('estado', 'pendiente');
      console.log(error ? `    ✗ ${error.message}` : `    ✓ reparada`);
    });
  }
  if (!APLICAR) console.log('\n(dry run — con --aplicar se ejecuta)\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
