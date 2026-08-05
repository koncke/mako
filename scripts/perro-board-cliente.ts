// =============================================================================
// perro-board-cliente — puntuar las tareas de un cliente que nunca pasaron por él
// =============================================================================
// El seed inserta directo a la tabla con un score de fábrica (85/62/37/12 por
// prioridad) y `score_razon` en null: la tarjeta no puede decir por qué está donde
// está. Medido en ws11: 55 de 56 tareas sin razón. Y las 19 que salieron de su
// reunión entraron sin puntuar.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/perro-board-cliente.ts --ws=11 [--apply] [--tanda=12]
//
// EN TANDAS, y no por costo: `priorizarNuevasCliente` arma la pirámide de referencia
// con las tareas abiertas que NO están en el lote. Si se le manda el tablero entero,
// esa lista queda vacía y el Perro puntúa en el aire — que es exactamente lo que no
// tiene que hacer. Con tandas, cada lote se compara contra el resto del tablero.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { listTareas, listCategorias } from '../lib/todo';
import { priorizarNuevasCliente } from '../lib/todo-guardian';
import { faseNegocioTexto } from '../lib/fase-store';

const APLICAR = process.argv.includes('--apply');
const num = (f: string, d: number) => { const a = process.argv.find((x) => x.startsWith(`--${f}=`)); return a ? Number(a.slice(f.length + 3)) || d : d; };
const WS = num('ws', 11);
const TANDA = num('tanda', 12);

async function main() {
  await runWithWorkspace(WS, async () => {
    const [tareas, cats] = await Promise.all([listTareas(), listCategorias()]);
    const nombre = new Map(cats.map((c) => [c.id, c.nombre]));
    // Las que le faltan: abiertas y sin razón (el score de fábrica no es una opinión).
    const faltan = tareas.filter((t) => t.progreso < 100 && !(t.score_razon ?? '').trim());
    console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  ws ${WS} · ${tareas.length} tareas · ${faltan.length} abiertas sin razón`);
    for (const t of faltan.slice(0, 40)) console.log(`  #${t.id} [${t.score}] ${(nombre.get(t.categorias[0]) ?? '—').padEnd(24).slice(0, 24)} ${t.titulo.slice(0, 52)}`);
    if (!APLICAR || !faltan.length) { console.log('\n(simulación)'); return; }

    const contexto = await faseNegocioTexto().catch(() => '');
    for (let i = 0; i < faltan.length; i += TANDA) {
      const lote = faltan.slice(i, i + TANDA);
      const restantes = faltan.length - i - lote.length;
      console.log(`\n▸ tanda ${Math.floor(i / TANDA) + 1}: ${lote.length} tareas (referencia: ${tareas.length - lote.length} tarjetas del tablero)`);
      const r = await priorizarNuevasCliente(lote.map((t) => t.id), contexto);
      console.log(`  ✓ ${r.n}/${lote.length} puntuadas${restantes ? ` · faltan ${restantes}` : ''}`);
      for (const p of r.patches.slice(0, 40)) console.log(`    #${p.id} → ${p.score ?? '—'} ${String(p.scoreRazon ?? '').slice(0, 90)}`);
    }
    const fin = await listTareas();
    const sin = fin.filter((t) => t.progreso < 100 && !(t.score_razon ?? '').trim());
    console.log(`\nQUEDAN sin razón: ${sin.length}${sin.length ? ' → ' + sin.map((t) => '#' + t.id).join(' ') : ' ✓'}`);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
