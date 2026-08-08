// =============================================================================
// describir-proyectos — que el PERRO escriba el detalle y el score, no nosotros
// =============================================================================
// Un proyecto creado a mano nace con `detalle` vacío y `score` 0. En el camino
// normal eso no pasa: `priorizarNuevasOwner` llama a `describirProyectosNuevos`
// (lib/mako-guardian.ts) y el Perro le pone emoji, detalle CON EL MOLDE
// (MOLDE_PROYECTO: Qué es / Qué ya está / Qué falta / Por qué importa), score,
// impacto y esfuerzo. Pero ese camino solo corre cuando el proyecto nace junto
// con tareas nuevas.
//
// Este script es la puerta para los otros casos: proyectos abiertos a mano, o
// migrados de nombre. NO inventa nada — llama a la MISMA función del Perro.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/describir-proyectos.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/describir-proyectos.ts --aplicar
//
// Las guardas son las de `scripts/barrido-proyectos.ts`, y por el mismo motivo:
//   · no escribe un detalle con menos de dos partes del molde,
//   · no ACORTA uno que ya tenía contenido,
//   · sin --aplicar solo muestra el diff.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { describirProyectosNuevos } from '../lib/mako-guardian';
import { evaluarDetalleProyecto } from '../lib/detalle-contrato';
import { catalogoParaPrompt, delCatalogo } from '../lib/plan-proyectos-catalogo';

const APLICAR = process.argv.includes('--aplicar');
const SOLO = process.argv.find((a) => a.startsWith('--solo='))?.slice(7);

type FilaP = { id: string; name: string; emoji: string; detalle: string; score: number };
type FilaT = { title: string; labels: string[] };

async function main() {
  const wsRow = await runWithWorkspace(1, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('workspaces').select('id').eq('capa', 'superadmin').limit(1).maybeSingle();
    return data as { id: number } | null;
  });
  if (!wsRow) throw new Error('no encontré el workspace super-admin');
  const ws = wsRow.id;

  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data: pData } = await db.from('plan_proyectos').select('id, name, emoji, detalle, score');
    const { data: tData } = await db.from('plan_tareas').select('title, labels').lt('progress', 100);
    const proys = (pData ?? []) as FilaP[];
    const tareas = (tData ?? []) as FilaT[];

    const titulosPor = new Map<string, string[]>();
    for (const t of tareas) for (const l of (t.labels ?? [])) {
      if (!titulosPor.has(l)) titulosPor.set(l, []);
      titulosPor.get(l)!.push(t.title);
    }

    // A describir: los que no tienen el molde O los que están sin puntuar.
    const pendientes = proys.filter((p) => {
      if (SOLO) return p.name === SOLO;
      return !evaluarDetalleProyecto(p.detalle ?? '').conForma || !p.score;
    });
    if (!pendientes.length) { console.log('Nada que describir: todos tienen el molde y score.'); return; }
    console.log(`${pendientes.length} proyectos a describir (de ${proys.length}):`);
    for (const p of pendientes) console.log(`  · ${p.name} (${(titulosPor.get(p.id) ?? []).length} tareas, score ${p.score})`);

    const existentes = proys.filter((p) => !pendientes.includes(p)).map((p) => ({ nombre: p.name, score: p.score }));
    // El «qué entra» del catálogo va como brief: es lo que define el ALCANCE de cada
    // proyecto, y sin eso el Perro describe por el nombre y se pisa con el vecino.
    const brief = catalogoParaPrompt();

    // De a 8: el detalle de un proyecto son ~600 caracteres y con 20 juntos la
    // respuesta se corta a la mitad (el modelo prioriza terminar el JSON).
    const LOTE = 8;
    const out: Array<{ id: string; score: number; emoji: string; detalle: string; razon: string; impacto?: number; esfuerzo?: number }> = [];
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const lote = pendientes.slice(i, i + LOTE);
      const tareasPorProy = lote.map((p) => {
        const t = titulosPor.get(p.id) ?? [];
        const que = delCatalogo(p.name)?.que ?? '';
        return `[${p.id}] ${p.name}${que ? ` — ALCANCE: ${que}` : ''}\n   TAREAS: ${t.join('; ') || '(todavía ninguna)'}`;
      }).join('\n');
      process.stdout.write(`  lote ${Math.floor(i / LOTE) + 1}/${Math.ceil(pendientes.length / LOTE)}… `);
      const r = await describirProyectosNuevos(
        lote.map((p) => ({ id: p.id, nombre: p.name })),
        existentes, tareasPorProy, brief, 'Describir y puntuar proyectos abiertos a mano',
      );
      out.push(...r.proyectos);
      console.log(`${r.proyectos.length} descriptos`);
    }

    let escritos = 0, saltados = 0;
    for (const d of out) {
      const p = proys.find((x) => x.id === d.id);
      if (!p) continue;
      const ev = evaluarDetalleProyecto(d.detalle);
      const viejo = (p.detalle ?? '').trim();
      // Las dos guardas de barrido-proyectos: forma mínima, y no acortar contenido.
      if (!ev.conForma) {
        console.log(`  ✗ ${p.name}: el detalle vino sin forma (${ev.partes.join(', ') || 'ninguna parte'}) — no se escribe`);
        if (!APLICAR) console.log(`     lo que devolvió: «${d.detalle.replace(/\s+/g, ' ').slice(0, 220)}»`);
        saltados++; continue;
      }
      if (viejo.length > 120 && d.detalle.length < viejo.length * 0.8) { console.log(`  ✗ ${p.name}: acortaría de ${viejo.length} a ${d.detalle.length} — no se escribe`); saltados++; continue; }
      console.log(`\n── ${p.emoji} ${p.name}  score ${p.score} → ${d.score}${d.impacto ? `  (impacto ${d.impacto} · esfuerzo ${d.esfuerzo})` : ''}`);
      console.log(d.detalle.split('\n').map((l) => '   ' + l).join('\n'));
      if (d.razon) console.log(`   ↳ ${d.razon}`);
      if (!APLICAR) continue;
      const { error } = await db.from('plan_proyectos').update({
        detalle: d.detalle, score: d.score, emoji: d.emoji || p.emoji,
        ...(d.impacto ? { impacto: d.impacto } : {}), ...(d.esfuerzo ? { esfuerzo: d.esfuerzo } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', p.id);
      if (error) { console.error(`  ✗ ${p.name}: ${error.message}`); saltados++; } else escritos++;
    }
    console.log(APLICAR ? `\n[LISTO: ${escritos} escritos, ${saltados} saltados]` : `\n[DRY-RUN — ${out.length} descriptos, ${saltados} no pasarían las guardas. Agregá --aplicar]`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
