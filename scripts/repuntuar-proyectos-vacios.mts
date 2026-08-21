// Le devuelve el score al Perro para los proyectos SIN tareas abiertas.
//
// Por qué existe: una versión anterior de `recurvarProyectosOwner` los mandaba a 1 ("un
// proyecto vacío es una intención, no una prioridad"). El dueño lo rechazó con el argumento
// correcto — «si se creó un proyecto es por algo; lo que se debe hacer es cargarle tareas» —
// y para entonces el score original ya estaba pisado. No hay de dónde recuperarlo: se lo
// vuelve a pedir al Perro, que es de quien tiene que salir.
//
// Uso: node --conditions react-server --import tsx scripts/repuntuar-proyectos-vacios.mts [ws] [--aplicar]
import { config } from 'dotenv';
config({ path: '.env.local' });
const ws = Number(process.argv[2] || 9);
const aplicar = process.argv.includes('--aplicar');
const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { describirProyectosNuevos } = await import('../lib/mako-guardian');
const { faseNegocioTexto } = await import('../lib/fase-store');

await runWithWorkspace(ws, async () => {
  const db = await getTenantDb();
  const [tRes, pRes] = await Promise.all([
    db.from('plan_tareas').select('progress, labels'),
    db.from('plan_proyectos').select('id, name, score, detalle, historial'),
  ]);
  const conTrabajo = new Set<string>();
  for (const r of (tRes.data ?? []) as Array<{ progress: number; labels: string[] }>) {
    if ((r.progress ?? 0) >= 100) continue;
    for (const l of r.labels ?? []) conTrabajo.add(l);
  }
  const proyectos = (pRes.data ?? []) as Array<{ id: string; name: string; score: number; detalle: string; historial: unknown[] }>;
  const vacios = proyectos.filter((p) => !conTrabajo.has(p.id));
  const conTareas = proyectos.filter((p) => conTrabajo.has(p.id)).map((p) => ({ nombre: p.name, score: p.score }));

  console.log(`\n${vacios.length} proyectos sin tareas abiertas:`);
  vacios.forEach((p) => console.log(`  [${String(p.score).padStart(3)}]  ${p.name}`));
  if (!vacios.length) return;

  const norte = await faseNegocioTexto().catch(() => '');
  const { proyectos: out } = await describirProyectosNuevos(
    vacios.map((p) => ({ id: p.id, nombre: p.name })),
    conTareas,
    vacios.map((p) => `[${p.id}] ${p.name}\n  (todavía sin tareas cargadas)${p.detalle ? `\n  ${p.detalle.slice(0, 300)}` : ''}`).join('\n\n'),
    norte,
    'Repuntuar proyectos sin tareas',
  );

  console.log(`\nel Perro devolvió ${out.length}:`);
  for (const o of out) {
    const p = vacios.find((v) => v.id === o.id);
    console.log(`  ${String(p?.score ?? '?').padStart(3)} → ${String(o.score).padStart(3)}  ${p?.name}\n        ${o.razon.slice(0, 140)}`);
  }
  if (!aplicar) { console.log('\n(dry run · pasá --aplicar para escribir)'); return; }

  for (const o of out) {
    const p = vacios.find((v) => v.id === o.id); if (!p) continue;
    const hist = [{ id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ts: Date.now(), actor: 'ia', text: `MaKo lo repriorizó — ${o.score} (${o.razon.slice(0, 160)})` }, ...(p.historial ?? [])].slice(0, 40);
    await db.from('plan_proyectos').update({ score: o.score, score_razon: o.razon, impacto: o.impacto ?? null, esfuerzo: o.esfuerzo ?? null, historial: hist, updated_at: new Date().toISOString() }).eq('id', p.id);
  }
  console.log(`\n✓ escritos ${out.length}`);
});
process.exit(0);
