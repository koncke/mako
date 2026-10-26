// =============================================================================
// probar-recomendaciones.mts — el motor de MaKo recomienda contra los negocios reales, SIN IA y SIN ESCRIBIR (26/10/2026)
// =============================================================================
// Uso:  node --conditions=react-server --env-file=<.env.local> --import tsx scripts/probar-recomendaciones.mts [ws ...] [--json salida.json]
//
// Corre `senalesDelNegocio` (lo que se mide) y la elección sin IA (`elegirSinIA`, con la memoria de cada negocio) para cada
// pantalla. Imprime TODAS las señales con su valor, su umbral y su muestra —también las que no se sostienen—, porque eso es lo
// que hace falta para medir los umbrales contra los datos reales (AGENTS.md: «Un umbral es un proxy, y el proxy hay que MEDIRLO»).
//
// SÓLO LEE: no llama a `recomendacionesDe` (que con `alDespues` pediría la redacción de la IA y la guardaría), ni a
// `decidirRecomendacion`. Lo que lee es lo mismo que lee la pantalla. Sin argumentos, todos los negocios activos.
// ⚠️ Los `dato` pueden traer el texto de un motivo de pérdida que escribió el equipo: la salida es para mirarla acá, no se pega
// en docs/ ni en un test (AGENTS.md: «Nada de datos reales de clientes ni de terceros en tests/, docs/ y AGENTS.md»).
// =============================================================================

import { writeFileSync } from 'node:fs';
import { getSupabaseServer } from '../lib/supabase';
import { runWithWorkspace } from '../lib/workspace';
import { leerMemoriaDelNegocio, senalesDelNegocio } from '../lib/recomendaciones';
import { SUPERFICIES, claveDe, elegirSinIA, sostiene, type Superficie } from '../lib/recomendaciones-reglas';

const args = process.argv.slice(2);
const iJson = args.indexOf('--json');
const salidaJson = iJson >= 0 ? args[iJson + 1] : null;
const pedidos = args.filter((a, i) => /^\d+$/.test(a) && i !== iJson + 1).map(Number);

const { data: wss, error } = await getSupabaseServer().from('workspaces').select('id, nombre, estado').order('id');
if (error) throw new Error(`no pude leer los negocios: ${error.message}`);
const elegidos = (wss ?? []).filter((w) => (pedidos.length ? pedidos.includes(Number(w.id)) : w.estado === 'activo'));

const ahora = new Date();
const todo: unknown[] = [];
for (const w of elegidos) {
  const ws = Number(w.id);
  console.log(`\n══ ws ${ws} · ${w.nombre} ════════════════════════════════════════`);
  await runWithWorkspace(ws, async () => {
    const memoria = await leerMemoriaDelNegocio();
    for (const sup of SUPERFICIES as readonly Superficie[]) {
      const l = await senalesDelNegocio(sup, ahora);
      const recs = memoria ? elegirSinIA(l.senales, memoria.m, sup, ahora) : [];
      console.log(`\n· ${sup}: ${recs.length} recomendación(es)${l.fallas.length ? ` · NO PUDE LEER: ${l.fallas.map((f) => `${f.fuente} (${f.motivo})`).join('; ')}` : ''}`);
      for (const s of l.senales) {
        const v = Math.round(s.valor * 1000) / 1000;
        console.log(`   ${sostiene(s) ? '✓' : '·'} ${claveDe(s).padEnd(44)} valor ${String(v).padStart(7)} ${s.sentido === 'mayor' ? '≥' : '≤'} ${s.umbral} · n ${s.n}/${s.nMinimo}`);
      }
      for (const r of recs) console.log(`   → ${r.hacer}\n     porque: ${r.porque.join(' · ')}`);
      for (const n of l.notas) console.log(`   nota: ${n}`);
      todo.push({ ws, superficie: sup, senales: l.senales.map((s) => ({ clave: claveDe(s), valor: s.valor, umbral: s.umbral, n: s.n, nMinimo: s.nMinimo, sostiene: sostiene(s) })), recomendaciones: recs.length, fallas: l.fallas });
    }
  });
}
if (salidaJson) { writeFileSync(salidaJson, JSON.stringify(todo, null, 2)); console.log(`\nDetalle en ${salidaJson}`); }
