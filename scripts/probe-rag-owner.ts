// ¿Qué le presta el workspace 1 (Mauricio, un CLIENTE) al RAG de todos los demás?
// `wsParaRag` devuelve [ws, OWNER_WS], así que todo lo que viva en el ws1 es material
// de few-shot para cualquier cliente. SOLO LECTURA.
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

async function main() {
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('mako_knowledge')
    .select('id, workspace_id, titulo, categoria, curso, autor, area, fuente, activo, estado, cuerpo, created_at')
    .order('workspace_id', { ascending: true });
  if (error) throw new Error('mako_knowledge: ' + error.message);
  const filas = (data ?? []) as Array<Record<string, unknown>>;
  console.log('filas totales: ' + filas.length + '\n');

  const porWs = new Map<number, Array<Record<string, unknown>>>();
  for (const f of filas) {
    const w = Number(f.workspace_id);
    porWs.set(w, [...(porWs.get(w) ?? []), f]);
  }
  console.log('ws · filas · activas+indexadas (lo que el RAG puede servir)');
  for (const [w, fs] of [...porWs.entries()].sort((a, b) => a[0] - b[0])) {
    const servibles = fs.filter((f) => f.activo && f.estado === 'indexado');
    const areas = [...new Set(fs.map((f) => String(f.area)))].sort();
    console.log(`  ${String(w).padStart(3)}  ${String(fs.length).padStart(4)}   ${String(servibles.length).padStart(4)}   áreas: ${areas.join(', ')}`);
  }

  const ws1 = (porWs.get(1) ?? []).filter((f) => f.activo && f.estado === 'indexado');
  console.log(`\n═══ LO QUE EL ws1 (Mauricio) LE PRESTA A TODOS: ${ws1.length} entradas servibles ═══\n`);
  const porArea = new Map<string, Array<Record<string, unknown>>>();
  for (const f of ws1) porArea.set(String(f.area), [...(porArea.get(String(f.area)) ?? []), f]);
  for (const [a, fs] of porArea) {
    console.log(`── área "${a}" · ${fs.length} entradas · cursos: ${[...new Set(fs.map((f) => String(f.curso ?? '—')))].join(' | ')}`);
    for (const f of fs.slice(0, 14)) {
      console.log(`     #${f.id} [${String(f.autor ?? '—')}/${String(f.fuente ?? '—')}] ${String(f.titulo).slice(0, 72)}`);
    }
    if (fs.length > 14) console.log(`     … y ${fs.length - 14} más`);
  }

  // ¿Cuántas de esas entradas son material de MAURICIO (su negocio) y no método de la
  // plataforma? El proxy honesto: las que NO vienen de un curso curado.
  const sinCurso = ws1.filter((f) => !f.curso);
  console.log(`\nentradas del ws1 SIN curso curado (o sea, cargadas sueltas): ${sinCurso.length}`);
  for (const f of sinCurso.slice(0, 10)) {
    console.log(`  #${f.id} área=${f.area} autor=${f.autor} · ${String(f.titulo).slice(0, 60)}`);
    console.log(`      ${String(f.cuerpo).replace(/\s+/g, ' ').slice(0, 160)}…`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
