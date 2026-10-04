// ¿La regla nueva cierra la fuga? Se mide contra las filas REALES, aplicando el mismo
// filtro que ahora corre en `sinLoAjenoDelDueno`. SOLO LECTURA.
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

const OWNER = 1;
const AREAS_RESERVADAS = ['ejemplos', 'producto'];
const FUENTES_PRESTABLES = new Set(['manual', 'mako']);

async function main() {
  const { data, error } = await getSupabaseServer().from('mako_knowledge')
    .select('id, workspace_id, titulo, area, fuente, activo, embedding')
    .eq('activo', true).not('embedding', 'is', null);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<Record<string, unknown>>;

  for (const ws of [11, 13, 3, 9]) {
    const visibles = filas.filter((f) => Number(f.workspace_id) === ws || Number(f.workspace_id) === OWNER);
    const enRag = visibles.filter((f) => !AREAS_RESERVADAS.includes(String(f.area)));

    const antes = enRag.filter((f) => Number(f.workspace_id) === OWNER);
    const despues = enRag.filter((f) => Number(f.workspace_id) === OWNER && FUENTES_PRESTABLES.has(String(f.fuente)));
    const cerradas = antes.filter((f) => !FUENTES_PRESTABLES.has(String(f.fuente)));

    console.log(`ws${String(ws).padStart(2)} · del dueño en el RAG general: ${antes.length} → ${despues.length}  (se cerraron ${cerradas.length})`);
    const porArea = new Map<string, number>();
    for (const f of cerradas) porArea.set(String(f.area), (porArea.get(String(f.area)) ?? 0) + 1);
    if (cerradas.length) console.log(`        lo que deja de prestarse: ${[...porArea].map(([a, n]) => `${a}=${n}`).join(' · ')}`);
    // Y lo que SÍ se sigue prestando, para ver que no se rompió el método.
    const porAreaOk = new Map<string, number>();
    for (const f of despues) porAreaOk.set(String(f.area), (porAreaOk.get(String(f.area)) ?? 0) + 1);
    console.log(`        sigue prestándose:          ${[...porAreaOk].map(([a, n]) => `${a}=${n}`).join(' · ') || '(nada)'}`);
  }

  // El super admin pidiendo el área reservada de producto: no se puede romper.
  const producto = filas.filter((f) => String(f.area) === 'producto');
  const prestables = producto.filter((f) => FUENTES_PRESTABLES.has(String(f.fuente)));
  console.log(`\narea 'producto': ${producto.length} filas · ${prestables.length} siguen prestándose desde el ws1 (si fueran 0, se habría roto el conocimiento de producto)`);

  // Y lo que el DUEÑO ve de lo suyo: nunca se filtra.
  const suyas = filas.filter((f) => Number(f.workspace_id) === OWNER);
  console.log(`el ws1 sigue viendo sus ${suyas.length} entradas enteras (el filtro sólo aplica a los demás)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
