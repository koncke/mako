#!/usr/bin/env node
// =============================================================================
// metodo-a-mako — marca como MÉTODO de la plataforma (`fuente = 'mako'`) un curso cargado a mano
// =============================================================================
// Desde el 17/10/2026 el RAG de un negocio sólo toma prestado de otros workspaces lo que tiene
// `fuente = 'mako'` (lib/rag-prestamo.ts): lo cargado a mano es del negocio que lo cargó. En el ws1
// había 13 entradas `manual`: 6 del negocio de Mauricio (su avatar, su CPM, su VSL) y las 7 del curso
// «Levanta Muertos», método de la agencia que se cargó a mano en el ws1 cuando el ws1 era «la casa».
// Este script re-marca un CURSO entero de un workspace, nombrado explícitamente. Nunca «todos».
//
// Uso (con las variables de Supabase en el entorno):
//   node scripts/metodo-a-mako.mjs --ws 1 --curso "Levanta Muertos"            → en SECO: lista qué cambiaría
//   node scripts/metodo-a-mako.mjs --ws 1 --curso "Levanta Muertos" --aplicar  → lo cambia
// Para volver atrás: el mismo pedido con --a manual.
//
// Es compatible con el código de antes y el de después: antes se prestaban `manual` y `mako`, así que
// re-marcar un curso de método no cambia lo que veía nadie hasta el deploy.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const ws = Number(val('--ws'));
const curso = val('--curso');
const a = val('--a') ?? 'mako';
const aplicar = args.includes('--aplicar');
const de = a === 'mako' ? 'manual' : 'mako';

if (!Number.isInteger(ws) || ws <= 0 || !curso || !['mako', 'manual'].includes(a)) {
  console.error('Uso: node scripts/metodo-a-mako.mjs --ws <id> --curso "<nombre exacto>" [--a mako|manual] [--aplicar]');
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.'); process.exit(2); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb.from('mako_knowledge').select('id, titulo, fuente')
  .eq('workspace_id', ws).eq('curso', curso).eq('fuente', de).order('id');
if (error) { console.error(`No pude leer: ${error.message}`); process.exit(1); }
console.log(`${data.length} entradas de «${curso}» en el ws ${ws} con fuente '${de}' → '${a}'${aplicar ? '' : ' (EN SECO: no cambio nada)'}`);
for (const f of data) console.log(`  #${f.id} ${f.titulo}`);
if (!aplicar || !data.length) process.exit(0);

const ids = data.map((f) => f.id);
const up = await sb.from('mako_knowledge').update({ fuente: a, updated_at: new Date().toISOString() })
  .eq('workspace_id', ws).eq('curso', curso).eq('fuente', de).in('id', ids).select('id');
if (up.error) { console.error(`No pude cambiar: ${up.error.message}`); process.exit(1); }
console.log(`Listo: ${up.data.length} de ${ids.length} re-marcadas.`);
