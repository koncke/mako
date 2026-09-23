// =============================================================================
// checklists-a-bullets — mudar lo que había en las checklists al detalle
// =============================================================================
// Las checklists salieron del producto el 22/09/2026: «que no existan checklists, quitan
// mucho tiempo, son incómodas e imprácticas. De última un bullet point». La UI ya no las
// dibuja, así que lo que quedó escrito adentro sería información INVISIBLE en la base —
// que es la peor forma de perderla: sigue ahí y nadie la ve.
//
// Esto la baja al `detalle` como viñetas, con la misma función que usa el Perro
// (`pasosComoBullets`), y vacía la columna. Los ítems que estaban TILDADOS viajan con un
// ✓ adelante: si no, se pierde qué estaba hecho.
//
//   npx tsx --conditions=react-server scripts/checklists-a-bullets.mts --dry
//   npx tsx --conditions=react-server scripts/checklists-a-bullets.mts
//
// ⚠️ Toca los DOS tableros: `plan_tareas` (el del dueño, ws9) y `experimento_tareas` (el
// de los clientes, todos los workspaces). Los dos dibujan con el mismo BoardShell, así que
// los dos se quedaron sin la vista de la checklist el mismo día.
// =============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });

const dry = process.argv.includes('--dry');

const { pasosComoBullets } = await import('../lib/detalle-fusion');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(url, key, { auth: { persistSession: false } });

type Item = { text?: unknown; done?: unknown };
const textoDe = (c: Item): string => {
  const t = String(c?.text ?? '').trim();
  return t ? (c?.done ? `✓ ${t}` : t) : '';
};

async function migrar(tabla: 'plan_tareas' | 'experimento_tareas', campoTitulo: string): Promise<void> {
  // Paginado a mano: el techo de 1000 filas de PostgREST no da error, devuelve 1000
  // (AGENTS.md). Con 334 tareas hoy no se nota, y el día que se note no avisa.
  const filas: Array<Record<string, unknown>> = [];
  for (let desde = 0; ; desde += 500) {
    // El select va como string suelto y el cliente sin tipar: con el cliente tipado, un
    // `select` armado con template literal no compila (el tipo del select es literal).
    const cliente = db as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> } } } };
    const { data, error } = await cliente.from(tabla).select(`id, ${campoTitulo}, detalle, checklist, workspace_id`).order('id').range(desde, desde + 499);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }

  // RESPALDO ANTES DE ESCRIBIR, y de las dos columnas que se tocan. Vaciar `checklist`
  // no se puede deshacer desde la app, y el respaldo de Supabase es diario: entre el
  // backup de anoche y este script está justo el trabajo del día.
  if (!dry) {
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir('backups', { recursive: true });
    const ruta = `backups/checklists-${tabla}-${new Date().toISOString().slice(0, 10)}.json`;
    await writeFile(ruta, JSON.stringify(filas.filter((f) => Array.isArray(f.checklist) && (f.checklist as unknown[]).length), null, 1), 'utf8');
    console.log(`respaldo: ${ruta}`);
  }

  let tocadas = 0;
  let items = 0;
  for (const f of filas) {
    const cl = Array.isArray(f.checklist) ? (f.checklist as Item[]) : [];
    if (!cl.length) continue;
    const pasos = cl.map(textoDe).filter(Boolean);
    const detalle = pasosComoBullets(String(f.detalle ?? ''), pasos);
    tocadas++;
    items += pasos.length;
    if (dry) {
      if (tocadas <= 3) console.log(`\n── ${tabla} ${String(f[campoTitulo]).slice(0, 50)} (ws ${f.workspace_id})\n${detalle.slice(0, 600)}\n`);
      continue;
    }
    const { error } = await db.from(tabla).update({ detalle: detalle.slice(0, 6000), checklist: [] }).eq('id', f.id);
    if (error) console.error(`  ✖ ${tabla} ${String(f.id)}: ${error.message}`);
  }
  console.log(`${tabla}: ${filas.length} filas · ${tocadas} con checklist · ${items} ítems ${dry ? 'que se mudarían' : 'mudados al detalle'}`);
}

await migrar('plan_tareas', 'title');
await migrar('experimento_tareas', 'titulo');
console.log(dry ? '\n(--dry: no se escribió nada)' : '\nListo.');
