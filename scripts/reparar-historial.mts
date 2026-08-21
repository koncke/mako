// Repara el historial de plan_tareas / plan_proyectos: `ts` como string ISO → epoch, y
// `actor: 'MaKo'` → 'ia'. Ver el porqué en `sanearHist` (app/plan/board/types.ts).
// Uso: node --conditions react-server --import tsx scripts/reparar-historial.mts [ws] [--aplicar]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const aplicar = process.argv.includes('--aplicar');
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { sanearHist } = await import('../app/plan/board/types');

await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  for (const tabla of ['plan_tareas', 'plan_proyectos']) {
    const { data, error } = await db.from(tabla).select('id, historial');
    if (error) { console.error(`${tabla}: ${error.message}`); continue; }
    let tocadas = 0, entradas = 0;
    for (const r of (data ?? []) as Array<{ id: string; historial: unknown }>) {
      const antes = (Array.isArray(r.historial) ? r.historial : []) as Array<Record<string, unknown>>;
      // ⚠️ NO se compara el JSON entero: `sanearHist` reconstruye el objeto, así que el ORDEN
      // de las claves cambia siempre y 640 de 698 filas parecían tener algo roto. Se compara
      // lo que de verdad importa — el valor de los dos campos que estaban mal.
      const malas = antes.filter((h) => typeof h?.ts !== 'number' || !['user', 'ia', 'code'].includes(String(h?.actor))).length;
      if (!malas) continue;
      const despues = sanearHist(antes);
      tocadas++; entradas += malas;
      if (aplicar) await db.from(tabla).update({ historial: despues }).eq('id', r.id);
    }
    console.log(`${tabla.padEnd(16)} ${tocadas} filas · ${entradas} entradas arregladas${aplicar ? ' ✓' : ' (dry run)'}`);
  }
});
process.exit(0);
