// =============================================================================
// Re-rutear las tareas de los proyectos que nacieron por el agujero del 11-12/8
// =============================================================================
// Cinco proyectos se crearon saltando al Perro: el «no» del ruteador se caía y
// `plan-board` los creaba con el nombre crudo que había escrito MaKo (el detalle está
// en docs/hallazgos-plan.md → «El "no" del Perro entraba por la puerta de atrás»).
//
// Este script NO decide a mano dónde va cada tarea: se las vuelve a dar al Perro, con
// el catálogo cerrado y sin los cinco proyectos inventados en la lista de destinos. Es
// la limpieza Y la prueba de que el arreglo funciona sobre el caso que lo motivó.
//
// SEGURO DE CORRER DOS VECES: sin `--aplicar` no escribe nada. Y aplicado, las tareas
// ya quedan en proyectos del catálogo, así que la segunda corrida no encuentra nada.
//
//   npx tsx scripts/rerutear-proyectos-inventados.ts            → dry run
//   npx tsx scripts/rerutear-proyectos-inventados.ts --aplicar  → mueve y borra
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

const APLICAR = process.argv.includes('--aplicar');

async function main() {
  const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
  const { asignarTareasAProyectos } = await import('../lib/mako-guardian');
  const { CATALOGO_PROYECTOS, delCatalogo, nucleo } = await import('../lib/plan-proyectos-catalogo');

  // ws 9 = super admin, que es donde vive el tablero del dueño.
  await runWithWorkspace(9, async () => {
    const db = await getTenantDb();
    const { data: proyRows } = await db.from('plan_proyectos').select('id, pid, name, historial');
    const { data: tareaRows } = await db.from('plan_tareas').select('id, num, title, detalle, labels, historial');
    const proyectos = (proyRows ?? []) as Array<{ id: string; pid: string; name: string; historial: unknown }>;
    const tareas = (tareaRows ?? []) as Array<{ id: string; num: number; title: string; detalle: string; labels: unknown; historial: unknown }>;

    // LA FIRMA DEL AGUJERO. Un proyecto nacido sin catálogo ni aval del Perro lleva
    // exactamente «Creó el proyecto — <origen>» en su historial: es la tercera rama de
    // `porQueNacio`, la que ya no existe. Se detectan por eso y no por una lista escrita
    // a mano, así que si quedó alguno más de antes, también cae acá.
    const huerfanos = proyectos.filter((p) => {
      if (delCatalogo(p.name)) return false;
      const h = (p.historial ?? []) as Array<{ text?: string }>;
      return h.some((x) => /^Creó el proyecto — /.test(String(x.text ?? '')));
    });
    if (!huerfanos.length) { console.log('No quedan proyectos con la firma del agujero. Nada que hacer.'); return; }

    console.log(`\nPROYECTOS SIN AVAL (${huerfanos.length}):`);
    const idsHuerfanos = new Set(huerfanos.map((p) => p.id));
    const aRutear = tareas.filter((t) => (t.labels as string[] ?? []).some((l) => idsHuerfanos.has(l)));
    for (const p of huerfanos) {
      const n = aRutear.filter((t) => (t.labels as string[]).includes(p.id)).length;
      console.log(`  ${p.pid.padEnd(5)} ${p.name.padEnd(34)} ${n} tarea(s)`);
    }
    if (!aRutear.length) {
      console.log('\nNinguno tiene tareas: solo hay que borrarlos.');
    } else {
      console.log(`\nRUTEANDO ${aRutear.length} tarea(s) con el Perro, contra la lista cerrada…\n`);
    }

    // Los destinos: los proyectos del tablero que SÍ valen, más el catálogo. Los cinco
    // huérfanos quedan fuera a propósito — si estuvieran, el Perro los podría elegir.
    const validos = proyectos.filter((p) => !idsHuerfanos.has(p.id));
    const yaEnTablero = new Set(validos.map((p) => nucleo(p.name)));
    const destinos = [
      ...validos.map((p) => ({ nombre: p.name, que: delCatalogo(p.name)?.que ?? '' })),
      ...CATALOGO_PROYECTOS.filter((c) => !yaEnTablero.has(nucleo(c.nombre))).map((c) => ({ nombre: c.nombre, que: c.que })),
    ];

    const r = aRutear.length
      ? await asignarTareasAProyectos(
          aRutear.map((t) => ({ titulo: t.title, detalle: t.detalle })),
          destinos,
          'Re-rutear tareas de proyectos inventados',
        )
      : { asign: [] as Array<{ i: number; destino: string; razon: string }> };

    const porNombre = new Map(validos.map((p) => [nucleo(p.name), p]));
    const movidas: Array<{ t: typeof aRutear[0]; destinoId: string; destinoNombre: string; razon: string }> = [];
    const sinDestino: typeof aRutear = [];
    for (let i = 0; i < aRutear.length; i++) {
      const a = r.asign.find((x) => x.i === i);
      const dest = a ? porNombre.get(nucleo(a.destino)) : undefined;
      if (!a || !dest) { sinDestino.push(aRutear[i]); continue; }
      movidas.push({ t: aRutear[i], destinoId: dest.id, destinoNombre: dest.name, razon: a.razon });
    }

    for (const m of movidas) console.log(`  #${m.t.num} ${m.t.title.slice(0, 56).padEnd(58)} → ${m.destinoNombre}   (${m.razon})`);
    for (const t of sinDestino) console.log(`  #${t.num} ${t.title.slice(0, 56).padEnd(58)} → SIN DESTINO (queda como está)`);

    console.log(`\nSe borran ${huerfanos.length} proyecto(s): ${huerfanos.map((p) => p.name).join(' · ')}`);
    if (!APLICAR) { console.log('\n(dry run — con --aplicar se ejecuta)'); return; }
    // Un proyecto con tareas que no se pudieron mover NO se borra: se quedaría sin
    // ningún lugar y la tarea desaparecería del tablero agrupado por proyecto.
    const conHuerfanas = new Set(sinDestino.flatMap((t) => (t.labels as string[]).filter((l) => idsHuerfanos.has(l))));

    const ahora = Date.now();
    for (const m of movidas) {
      const labels = [...new Set([...(m.t.labels as string[]).filter((l) => !idsHuerfanos.has(l)), m.destinoId])];
      const hist = [
        { id: `h${ahora}${m.t.num}`, ts: ahora, actor: 'ia',
          text: `El Perro la re-ruteó a «${m.destinoNombre}»: ${m.razon}. Estaba en un proyecto que se creó sin su aval (bug del 11-12/8).`.slice(0, 300) },
        ...((m.t.historial ?? []) as unknown[]),
      ].slice(0, 40);
      const { error } = await db.from('plan_tareas').update({ labels, historial: hist, updated_at: new Date().toISOString() }).eq('id', m.t.id);
      if (error) { console.error(`  ✗ #${m.t.num}: ${error.message}`); continue; }
      console.log(`  ✓ #${m.t.num} → ${m.destinoNombre}`);
    }
    for (const p of huerfanos) {
      if (conHuerfanas.has(p.id)) { console.log(`  · ${p.name}: NO se borra, quedó con tareas sin destino`); continue; }
      const { error } = await db.from('plan_proyectos').delete().eq('id', p.id);
      console.log(error ? `  ✗ ${p.name}: ${error.message}` : `  ✓ borrado ${p.name}`);
    }
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
