// =============================================================================
// sembrar-knowledge — carga en `mako_knowledge` las fichas destiladas de los cursos, por módulo (C3, 18/11/2026)
// =============================================================================
// Las fichas viven versionadas en lib/knowledge-siembra/ (una lista por módulo de lib/knowledge-modulos.ts, más las
// plantillas de guion del pedido 3.2 del 30/10). Esto las escribe en el workspace de la PLATAFORMA (`wsSuperAdmin()`, capa
// superadmin) con `fuente: 'mako'`, que es lo único que el RAG le PRESTA a los demás negocios (lib/rag-prestamo.ts). No va
// al ws1: el ws1 es un cliente (Mauricio) y lo nuevo de MaKo no se guarda en la cuenta de un cliente.
//
// Desde la PC del Cerebro (lee y escribe la base de PRODUCCIÓN):
//
//   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/sembrar-knowledge.mts
//
// Sin flags SÓLO LEE y muestra el plan (qué crearía, qué ya está, qué está distinto). Con `--aplicar` crea lo que falta, y
// SÓLO con el sí de Martín: cambia lo que MaKo le contesta a todos los negocios en las tabs de cada módulo.
//
//   … scripts/sembrar-knowledge.mts --aplicar                 crea lo que falta (lo que ya está, no lo toca)
//   … scripts/sembrar-knowledge.mts --aplicar --actualizar    además reescribe las que cambiaron en el repo
//   … scripts/sembrar-knowledge.mts --modulo anuncios         sólo un módulo (se combina con los de arriba)
//
// ⚠️ Idempotente: la clave es el curso del módulo («Knowledge · <Módulo>») + el título, sin tildes ni mayúsculas
//    (lib/knowledge-siembra/plan.ts, con test). Correrla dos veces no duplica nada.
// ⚠️ Una fila con la misma clave que NO es `fuente: 'mako'` (la cargó alguien a mano desde Classroom › Methodology) no se
//    toca ni se duplica: se informa.
// ⚠️ Cada ficha se crea con `createKnowledge` (lib/mako-knowledge.ts) adentro del workspace de la plataforma, que la embebe
//    con la Gemini de la plataforma (`deMako`). Si el embedding falla, la ficha queda igual (estado `error` o `pendiente`):
//    `metodologiaDeArea` la lee sin vector mientras el módulo entre entero en el prompt, y el goteo la vuelve a embeber.
// ⚠️ El curso viejo «Buenas prácticas para construir una App» (scripts/seed-curso-producto.mjs) NO se siembra desde acá: su
//    primera lección enseña el onboarding que se retiró el 01/11/2026. El módulo `app` lleva las reglas de hoy.
// =============================================================================

import { getSupabaseServer } from '../lib/supabase';
import { runWithWorkspace, wsSuperAdmin } from '../lib/workspace';
import { createKnowledge, updateKnowledge } from '../lib/mako-knowledge';
import { MODULOS_KNOWLEDGE, moduloDeKey } from '../lib/knowledge-modulos';
import { FICHAS_POR_MODULO, cursoDeModulo } from '../lib/knowledge-siembra';
import { planDeSiembra, type FilaExistente } from '../lib/knowledge-siembra/plan';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const aplicar = process.argv.includes('--aplicar');
const actualizar = process.argv.includes('--actualizar');
const soloModulo = arg('--modulo');
if (soloModulo && !moduloDeKey(soloModulo)) {
  console.error(`✗ «${soloModulo}» no es un módulo. Los que hay: ${MODULOS_KNOWLEDGE.map((m) => m.key).join(', ')}`);
  process.exit(2);
}
if (actualizar && !aplicar) console.log('(--actualizar sin --aplicar: sólo muestro qué reescribiría)');

const modulos = MODULOS_KNOWLEDGE.filter((m) => !soloModulo || m.key === soloModulo);
const plataforma = await wsSuperAdmin();
const db = getSupabaseServer();
const cursos = modulos.map((m) => cursoDeModulo(m.nombre));

// Lo que ya hay en la plataforma de estos cursos. Son decenas de filas (una por ficha), lejos del techo de 1000 de PostgREST;
// igual se comprueba, porque un techo que corta en silencio haría que la siembra duplique lo que no vio.
const { data, error } = await db
  .from('mako_knowledge')
  .select('id, curso, titulo, cuerpo, area, fuente, activo')
  .eq('workspace_id', plataforma)
  .in('curso', cursos)
  .order('id')
  .limit(1000);
if (error) { console.error(`✗ No pude leer lo que ya hay en mako_knowledge: ${error.message}`); process.exit(1); }
const existentes = (data ?? []) as FilaExistente[];
if (existentes.length >= 1000) { console.error('✗ Leí 1000 filas: es el techo de PostgREST y la lectura puede estar cortada. Paro.'); process.exit(1); }

console.log(`Plataforma: workspace ${plataforma} · ya hay ${existentes.length} fichas de Knowledge ahí.\n`);

let creadas = 0, reescritas = 0, fallas = 0;
for (const m of modulos) {
  const fichas = FICHAS_POR_MODULO[m.key] ?? [];
  const plan = planDeSiembra(existentes, fichas, { actualizar });
  const chars = fichas.reduce((s, f) => s + f.titulo.length + f.cuerpo.length, 0);
  console.log(`■ ${m.nombre} (área ${m.area}) · ${fichas.length} fichas, ${chars} caracteres`);
  console.log(`  crear ${plan.crear.length} · iguales ${plan.iguales} · distintas ${plan.distintas.length}${actualizar ? ' (se reescriben)' : ' (no se tocan sin --actualizar)'} · ajenas ${plan.ajenas.length}`);
  for (const f of plan.crear) console.log(`    + ${f.titulo}`);
  for (const d of plan.distintas) console.log(`    ≠ #${d.id} ${d.titulo}`);
  for (const a of plan.ajenas) console.log(`    ! #${a.id} ${a.titulo} (fuente ${a.fuente}: la cargó alguien a mano, no la toco)`);
  if (!aplicar) continue;
  await runWithWorkspace(plataforma, async () => {
    for (const f of plan.crear) {
      try {
        const r = await createKnowledge(f);
        creadas++;
        console.log(`    ✓ creada #${r?.id ?? '?'} ${f.titulo}${r && r.estado !== 'indexado' ? ` (embedding: ${r.estado}${r.error ? `, ${r.error}` : ''})` : ''}`);
      } catch (e) { fallas++; console.error(`    ✗ ${f.titulo}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    for (const u of plan.actualizar) {
      try {
        await updateKnowledge(u.id, { cuerpo: u.fila.cuerpo, categoria: u.fila.categoria, area: u.fila.area, activo: true });
        reescritas++;
        console.log(`    ✓ reescrita #${u.id} ${u.fila.titulo}`);
      } catch (e) { fallas++; console.error(`    ✗ #${u.id} ${u.fila.titulo}: ${e instanceof Error ? e.message : String(e)}`); }
    }
  });
}

if (!aplicar) {
  console.log('\nSólo leí. Con --aplicar (y el sí de Martín) creo lo que falta.');
  process.exit(0);
}
console.log(`\nListo: ${creadas} creadas, ${reescritas} reescritas, ${fallas} con error.`);
console.log('Para verlo: Classroom › Methodology muestra cuántas fichas tiene cada módulo y cuántas se prestan.');
process.exit(fallas ? 1 : 0);
