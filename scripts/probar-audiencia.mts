// Prueba de punta a punta de la audiencia de prioridad, contra la base REAL.
//
//   node --conditions react-server --import tsx scripts/probar-audiencia.mts [ws] [--aplicar] [--flojo]
//
// Sin `--aplicar` NO escribe scores: llega hasta la propuesta y muestra la cascada que se
// escribiría. Con `--flojo` manda un argumento sin una sola prueba, para verificar que el
// rechazo barato (el que no gasta un token) corta antes de llamar al modelo.
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const aplicar = process.argv.includes('--aplicar');
const flojo = process.argv.includes('--flojo');

const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { proponerReprio, aplicarReprio, deshacerReprio } = await import('../lib/plan-reprio');

const proyectos = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_proyectos').select('id,name,score,score_manual').order('score', { ascending: false });
  return (data ?? []) as Array<{ id: string; name: string; score: number; score_manual: boolean }>;
});
console.log(`\n${proyectos.length} proyectos · rango ${proyectos.at(-1)?.score}–${proyectos[0]?.score} · ${proyectos.filter((p) => p.score_manual).length} con candado`);

// El conejillo: el MÁS BAJO del tablero, que es el peor caso — pedirlo arriba corre a todos.
// Con `--sobre <texto>` y `--a <n>` se elige otro, para probar el camino que ACEPTA.
const sobreI = process.argv.indexOf('--sobre');
const aI = process.argv.indexOf('--a');
const victima = sobreI > 0
  ? proyectos.find((p) => p.name.toLowerCase().includes(process.argv[sobreI + 1].toLowerCase()))!
  : proyectos.at(-1)!;
if (!victima) { console.error('no encontré ese proyecto'); process.exit(1); }
const norte = proyectos[0]!;
const pedido = aI > 0 ? Number(process.argv[aI + 1]) : Math.min(100, norte.score);
console.log(`\nPIDO: «${victima.name}» ${victima.score} → ${pedido}   (el norte de hoy es «${norte.name}» en ${norte.score})`);

const cliente = process.argv.includes('--cliente')
  ? await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data } = await db.from('leads').select('id,nombre').order('updated_at', { ascending: false }).limit(1);
      return (data ?? [])[0] as { id: string; nombre: string } | undefined;
    })
  : undefined;
const pruebas = flojo ? [] : [
  { clase: 'proyecto' as const, ref: norte.id },
  { clase: 'fecha' as const, ref: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) },
  ...(cliente ? [{ clase: 'cliente' as const, ref: String(cliente.id) }] : []),
];
if (cliente) console.log(`   (con el cliente «${cliente.nombre}» como prueba)`);
// El argumento tiene que ir en la MISMA dirección que el pedido: uno que defiende subir
// mientras se pide bajar es un test que mide otra cosa (y el Perro tiene razón en negarlo).
const motivo = flojo
  ? 'Es re importante, hace mucho que está ahí y me tiene cansado.'
  : pedido < victima.score
    ? 'Lo dejamos para más adelante: no hay nadie esperándolo y lo que teníamos comprometido ya se cubrió por otro lado.'
    : 'Un cliente firmó y esto tiene que estar antes de su arranque; hasta que no esté, no le podemos cobrar.';

const t0 = Date.now();
const r = await runWithWorkspace(ws, () => proponerReprio({
  entidad: 'proyecto', itemId: victima.id, scorePedido: pedido, motivo, pruebas, respuestas: [],
}));
console.log(`\n── ${r.estado.toUpperCase()} ── (${((Date.now() - t0) / 1000).toFixed(1)}s · ${r.usage ? `${(r.usage as { outputTokens?: number }).outputTokens ?? '?'} tok out` : 'CERO TOKENS'})`);
if (r.error) console.log(`  error: ${r.error}`);
if (r.falta) console.log(`  falta: ${r.falta}`);
if (r.exigencia) console.log(`  exigencia (${r.exigencia.nivel}): ${r.exigencia.texto}`);
if (r.preguntas?.length) r.preguntas.forEach((q) => console.log(`  ❓ [${q.tipo}] ${q.pregunta}${q.opciones.length ? ` → ${q.opciones.join(' / ')}` : ''}`));
if (r.respuesta) console.log(`  MaKo: ${r.respuesta}`);
if (r.razon) console.log(`  razón: ${r.razon}`);
if (r.repregunta) console.log(`  repregunta: ${r.repregunta}`);
if (r.fallas) console.log(`  ⚠ auditoría: ${r.fallas}`);
if (r.cascada) {
  console.log(`  cascada: ${r.cascada.length} filas se moverían`);
  r.cascada.slice(0, 6).forEach((m) => console.log(`     ${String(m.antes).padStart(3)} → ${String(m.despues).padStart(3)}  ${m.nombre.slice(0, 50)}`));
  if (r.cascada.length > 6) console.log(`     … y ${r.cascada.length - 6} más`);
  const vals = r.cascada.map((m) => m.despues);
  console.log(`  empates en la cascada: ${vals.length - new Set(vals).size} (tiene que ser 0)`);
}

if (!aplicar) { console.log('\n(no se escribió nada · pasá --aplicar para aplicar y deshacer)'); process.exit(0); }
if (r.estado !== 'propuesto' || !r.reprioId) { console.log('\n(no hay nada que aplicar)'); process.exit(0); }

const ap = await runWithWorkspace(ws, () => aplicarReprio(r.reprioId!));
console.log(`\nAPLICADO: ${ap.movidos} filas${ap.error ? ` · ${ap.error}` : ''}`);
const dosVeces = await runWithWorkspace(ws, () => aplicarReprio(r.reprioId!));
console.log(`  idempotencia (2ª vez): ${dosVeces.movidos} filas · ${dosVeces.error ?? 'SIN ERROR ⚠'}`);

const medio = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_proyectos').select('score').order('score', { ascending: false });
  const vals = (data ?? []).map((x: { score: number }) => x.score);
  return { n: vals.length, empates: vals.length - new Set(vals).size, top: vals[0], piso: vals.at(-1) };
});
console.log(`  tablero: ${medio.n} proyectos · ${medio.top}–${medio.piso} · ${medio.empates} empates`);

const un = await runWithWorkspace(ws, () => deshacerReprio(r.reprioId!));
console.log(`\nDESHECHO: ${un.repuestos} repuestos · ${un.conflictos.length} conflictos${un.error ? ` · ${un.error}` : ''}`);
const final = await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const { data } = await db.from('plan_proyectos').select('id,name,score,score_manual').order('score', { ascending: false });
  return (data ?? []) as typeof proyectos;
});
const distintos = final.filter((f) => proyectos.find((p) => p.id === f.id)?.score !== f.score);
console.log(`  ¿volvió todo a como estaba? ${distintos.length === 0 ? 'SÍ' : `NO — ${distintos.length} distintos: ${distintos.slice(0, 5).map((d) => `${d.name.slice(0, 24)} ${proyectos.find((p) => p.id === d.id)?.score}→${d.score}`).join(', ')}`}`);
console.log(`  candados después de deshacer: ${final.filter((p) => p.score_manual).length} (antes ${proyectos.filter((p) => p.score_manual).length})`);
