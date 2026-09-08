// Parte la post-agenda de UN workspace en sus dos mitades
// =============================================================================
// `armarSecuenciasDeAudios` solo corre cuando alguien pasa por el resumen del
// onboarding del Chat Agent. Un dueño que ya lo terminó nunca vuelve a pasar por
// ahí, así que su base se queda con la secuencia ÚNICA de post-agenda —la de los
// dos audios excluyentes— mientras el código ya sabe armar las dos.
//
// Eso no rompe nada (la vieja sigue funcionando como siempre), pero deja al
// cliente sin lo que se acaba de arreglar y sin forma de pedirlo.
//
//   npx tsx --conditions=react-server scripts/partir-post-agenda.ts <ws> [--commit]
//
// Sin `--commit` no escribe: dice qué haría. Es el default a propósito — esto
// toca las secuencias que le mandan mensajes a gente real.
//
// ⚠️ VERIFICA EL VALOR CALCULADO, NO LA FILA QUE ESCRIBIÓ. Al final relee las
// secuencias ACTIVAS del workspace y comprueba la propiedad que importa: que no
// queden dos con cohortes de post-agenda solapados. Comprobar el insert es
// comprobar la mitad que no falla.
import { config } from 'dotenv';
import { resolve } from 'node:path';
// ⚠️ ANTES de cualquier import que toque Supabase: los modulos leen process.env
// al cargarse, asi que un dotenv puesto abajo llega tarde y el error que sale
// («NEXT_PUBLIC_SUPABASE_URL no definida») no se parece a la causa.
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { armarSecuenciasDeAudios } from '../lib/secuencias-audios';
import { getSetting } from '../lib/settings';
import { KEY_LINK_VIDEO } from '../lib/audios-paso';
import { FAMILIA_POST_AGENDA } from '../lib/nutricion-familias';

const SOLAPADOS = [...FAMILIA_POST_AGENDA, 'agendado_sin_confirmar'];

type Fila = { id: number; clave: string; nombre: string; trigger_tipo: string; activa: boolean; archivada_at: string | null };

async function foto(): Promise<Fila[]> {
  const db = await getTenantDb();
  const { data } = await db.from('nutricion_secuencias')
    .select('id, clave, nombre, trigger_tipo, activa, archivada_at')
    .in('trigger_tipo', SOLAPADOS);
  return (data ?? []) as Fila[];
}

const pinta = (f: Fila[]) => f.map((s) =>
  `    ${s.archivada_at ? '📦' : s.activa ? '🟢' : '⚪'} ${s.clave.padEnd(34)} ${s.trigger_tipo}`).join('\n') || '    (ninguna)';

async function main() {
  const ws = Number(process.argv[2]);
  const commit = process.argv.includes('--commit');
  if (!Number.isInteger(ws) || ws <= 0) {
    console.error('Uso: partir-post-agenda.ts <workspace_id> [--commit]');
    process.exit(1);
  }

  await runWithWorkspace(ws, async () => {
    console.log(`\nWorkspace ${ws} — ANTES:\n${pinta(await foto())}\n`);

    if (!commit) {
      console.log('  (dry-run: no se escribió nada. Agregá --commit para aplicarlo.)\n');
      return;
    }

    // El link del video viaja al pie de los audios. Se lee de donde vive, no se
    // pasa por parámetro: pasarlo a mano es cómo se pierde en la próxima
    // corrida, cuando la secuencia se reescriba desde el onboarding sin él.
    const linkVideo = await getSetting(KEY_LINK_VIDEO).catch(() => null);
    const armadas = await armarSecuenciasDeAudios(linkVideo);
    for (const a of armadas) console.log(`  ${a.creada ? '＋ creada  ' : '↻ actualizada'} ${a.clave} (${a.audios} pasos)`);

    const despues = await foto();
    console.log(`\nWorkspace ${ws} — DESPUÉS:\n${pinta(despues)}\n`);

    // La propiedad, no la fila: dos secuencias vivas con cohortes de
    // post-agenda solapados son el mismo audio dos veces al mismo teléfono.
    const vivas = despues.filter((s) => s.activa && !s.archivada_at);
    if (vivas.length > 1) {
      console.error(`⛔ QUEDARON ${vivas.length} SECUENCIAS VIVAS CON COHORTES SOLAPADOS:`);
      for (const s of vivas) console.error(`     ${s.clave} → ${s.trigger_tipo}`);
      console.error('   Un lead que agende va a entrar a todas. Revisar a mano ANTES de prenderlas.');
      process.exit(1);
    }
    // Las nuevas nacen PAUSADAS: nada sale hasta que el dueño las prenda.
    console.log('  ✓ Sin cohortes solapados. Las nuevas nacen pausadas: préndelas desde la tab.\n');
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
