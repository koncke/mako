// La MECÁNICA de la cascada, sin el modelo en el medio: aplicar y deshacer.
//
//   node --conditions react-server --import tsx scripts/probar-cascada.mts [ws] [--escribir]
//
// El Perro es duro —y está bien que lo sea—, así que hacerlo ceder para probar la escritura
// es pedirle que mienta. Acá se arma la fila `plan_reprios` a mano con el mismo
// `fijarYDesempatar` que usa el camino real, y se ejercita lo que sigue: que aplicar escriba
// lo que dijo que iba a escribir, que aplicar DOS VECES no escriba dos veces, que deshacer
// devuelva todo, y que el candado quede como estaba.
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const escribir = process.argv.includes('--escribir');

const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { fijarYDesempatar, sinEmpates, mismoOrdenRelativo } = await import('../app/plan/board/metodologia');
const { aplicarReprio, deshacerReprio } = await import('../lib/plan-reprio');

type P = { id: string; name: string; score: number; score_manual: boolean };
const leer = () => runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_proyectos').select('id,name,score,score_manual').order('score', { ascending: false });
  return (data ?? []) as P[];
});

const antes = await leer();
const items = antes.map((p) => ({ id: p.id, titulo: p.name, score: p.score }));
const victima = antes.at(-1)!;
const destino = antes[Math.floor(antes.length / 3)].score; // al tercio de arriba

const despues = fijarYDesempatar(items, { [victima.id]: destino });
const movidos = items.filter((i) => despues[i.id] !== i.score);
console.log(`\n${antes.length} proyectos · «${victima.name}» ${victima.score} → ${destino}`);
console.log(`  se mueven ${movidos.length} filas`);
console.log(`  empates: ${sinEmpates(items.map((i) => ({ ...i, score: despues[i.id] }))) ? '⛔ HAY' : '0 ✓'}`);
console.log(`  reordena a otros: ${mismoOrdenRelativo(items, despues, victima.id) ? '⛔ SÍ' : 'no ✓'}`);
console.log(`  los 4 de arriba del hueco: ${movidos.slice(0, 4).map((m) => `${m.titulo.slice(0, 20)} ${m.score}→${despues[m.id]}`).join(' · ')}`);

if (!escribir) { console.log('\n(no se escribió nada · pasá --escribir para aplicar y deshacer de verdad)'); process.exit(0); }

const ripple = Object.fromEntries(movidos.map((m) => [m.id, {
  nombre: m.titulo, antes: m.score, despues: despues[m.id],
  manualAntes: !!antes.find((a) => a.id === m.id)?.score_manual,
}]));
const reprioId = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data, error } = await db.from('plan_reprios').insert({
    tablero: 'plan', entidad: 'proyecto', item_id: victima.id, item_nombre: victima.name,
    score_antes: victima.score, score_pedido: destino, motivo: '(prueba de mecánica, scripts/probar-cascada.mts)',
    veredicto: 'acepta', score_final: destino, razon: 'prueba', respuesta: 'prueba',
    estado: 'propuesto', movidos: movidos.length, ripple,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return String(data.id);
});

const ap = await runWithWorkspace(ws, () => aplicarReprio(reprioId));
console.log(`\nAPLICADO: ${ap.movidos} filas${ap.error ? ` · ${ap.error}` : ''}`);
const dos = await runWithWorkspace(ws, () => aplicarReprio(reprioId));
console.log(`  2ª vez: ${dos.movidos} filas · ${dos.error ?? '⛔ SIN ERROR — no es idempotente'}`);

const medio = await leer();
const malos = movidos.filter((m) => medio.find((x) => x.id === m.id)?.score !== despues[m.id]);
console.log(`  ¿quedó lo que dijo? ${malos.length === 0 ? 'SÍ ✓' : `NO ⛔ — ${malos.length} distintos`}`);
console.log(`  empates en la base: ${medio.length - new Set(medio.map((m) => m.score)).size}`);
console.log(`  candados: ${medio.filter((m) => m.score_manual).length} (el debatido tiene que ser el único nuevo)`);
console.log(`  ¿el debatido quedó con candado? ${medio.find((m) => m.id === victima.id)?.score_manual ? 'SÍ ✓' : 'NO ⛔'}`);
console.log(`  ¿algún arrastrado quedó con candado? ${movidos.filter((m) => m.id !== victima.id).some((m) => medio.find((x) => x.id === m.id)?.score_manual) ? 'SÍ ⛔' : 'no ✓'}`);

const un = await runWithWorkspace(ws, () => deshacerReprio(reprioId));
console.log(`\nDESHECHO: ${un.repuestos} repuestos · ${un.conflictos.length} conflictos${un.error ? ` · ${un.error}` : ''}`);
const unDos = await runWithWorkspace(ws, () => deshacerReprio(reprioId));
console.log(`  2ª vez: ${unDos.repuestos} · ${unDos.error ?? '⛔ SIN ERROR — no es idempotente'}`);

const fin = await leer();
const distintos = fin.filter((f) => antes.find((p) => p.id === f.id)?.score !== f.score);
console.log(`  ¿volvió TODO a como estaba? ${distintos.length === 0 ? 'SÍ ✓' : `NO ⛔ — ${distintos.slice(0, 5).map((d) => `${d.name.slice(0, 22)} ${antes.find((p) => p.id === d.id)?.score}→${d.score}`).join(', ')}`}`);
console.log(`  candados al final: ${fin.filter((f) => f.score_manual).length} (antes eran ${antes.filter((a) => a.score_manual).length})`);
