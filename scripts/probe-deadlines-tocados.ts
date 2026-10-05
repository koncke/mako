/**
 * «Yo había depurado y sacado muchos deadline… me cambiaste todo eso» (04/10/2026).
 * SOLO LECTURA: qué proyectos y tareas tienen deadline hoy, cuándo se tocaron por última
 * vez, y qué dice su historial. Sirve para saber QUÉ cambió y CUÁNDO antes de revertir.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

type Fila = Record<string, unknown>;
const hoy = new Date();
const hace = (iso: unknown) => {
  if (typeof iso !== 'string') return '—';
  const m = Math.round((hoy.getTime() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};

async function main() {
  const sb = getSupabaseServer();

  const { data: proys, error: e1 } = await sb.from('plan_proyectos')
    .select('id, name, deadline, quarter, updated_at, historial')
    .order('updated_at', { ascending: false });
  if (e1) throw new Error('plan_proyectos: ' + e1.message);

  const filas = (proys ?? []) as Fila[];
  console.log(`\n═══ ${filas.length} proyectos · los 25 tocados más recientemente ═══`);
  console.log('deadline  | tocado hace | proyecto');
  for (const p of filas.slice(0, 25)) {
    const d = (p.deadline as string) || '—'.padEnd(10);
    console.log(`${String(d).padEnd(10)}| ${hace(p.updated_at).padStart(7)}     | ${String(p.name).slice(0, 56)}`);
  }

  const conFecha = filas.filter((p) => p.deadline);
  console.log(`\n═══ CON deadline hoy: ${conFecha.length} de ${filas.length} ═══`);
  for (const p of conFecha) console.log(`  ${String(p.deadline).padEnd(12)} ${String(p.name).slice(0, 62)}`);

  // Las últimas entradas de historial que hablan de una FECHA, con su marca de tiempo.
  console.log('\n═══ lo último que el historial dice sobre fechas ═══');
  const eventos: Array<{ ts: string; quien: string; txt: string; nombre: string }> = [];
  for (const p of filas) {
    for (const h of (Array.isArray(p.historial) ? p.historial : []) as Array<Record<string, unknown>>) {
      const txt = String(h.text ?? '');
      if (!/deadline|fecha|vence|Sin deadline/i.test(txt)) continue;
      eventos.push({ ts: String(h.ts ?? ''), quien: String(h.actor ?? '?'), txt, nombre: String(p.name) });
    }
  }
  eventos.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  for (const e of eventos.slice(0, 30)) {
    console.log(`  ${e.ts.slice(0, 16).replace('T', ' ')} · ${e.quien.padEnd(5)} · ${e.txt.slice(0, 44).padEnd(44)} · ${e.nombre.slice(0, 40)}`);
  }

  // Y lo mismo para TAREAS, contando nomás: si el número saltó, se ve acá.
  const { data: tareas, error: e2 } = await sb.from('plan_tareas')
    .select('id, title, deadline, updated_at, progress');
  if (e2) throw new Error('plan_tareas: ' + e2.message);
  const ts = (tareas ?? []) as Fila[];
  const abiertas = ts.filter((t) => Number(t.progress ?? 0) < 100);
  console.log(`\n═══ TAREAS: ${abiertas.filter((t) => t.deadline).length} con deadline de ${abiertas.length} abiertas ═══`);
  const recientes = ts.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 12);
  for (const t of recientes) {
    console.log(`  ${String((t.deadline as string) || '—').padEnd(12)} ${hace(t.updated_at).padStart(7)}  ${String(t.title).slice(0, 56)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
