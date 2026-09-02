/**
 * Guarda o restaura TODO lo que el recorrido del onboarding de /video-generator
 * escribe en el ws1.
 *
 * ⚠️ ws1 es MAURICIO, un cliente real, y verificar no puede dejar rastro en sus
 * datos. La primera versión de esto guardaba SÓLO `onboarding.tab.video-generator`
 * —el progreso— y eso no alcanzó ni una vuelta: cada paso llama a su propia
 * action, así que el «Siguiente» del paso del acento le guardó a Mauricio, que
 * vive en Baja California, el acento ARGENTINO que la detección por zona horaria
 * había elegido mirando MI máquina. Sin error y sin síntoma: la pantalla mostraba
 * un acento perfectamente válido.
 *
 * La regla que queda: la copia de seguridad no se hace por el estado que uno está
 * mirando, sino por TODO lo que las acciones del recorrido pueden tocar.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const CLAVES = ['onboarding.tab.video-generator', 'video.voz'];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

if (process.argv[2] === 'guardar') {
  const out: Record<string, string | null> = {};
  for (const k of CLAVES) {
    const r = await db.from('app_settings').select('value').eq('workspace_id', 1).eq('key', k).maybeSingle();
    if (r.error) { console.error(`${k}: ${r.error.message}`); process.exit(1); }
    out[k] = (r.data?.value as string | undefined) ?? null;
    console.log(`  ${k}: ${out[k] ? (out[k] as string).slice(0, 90) : '(no existe)'}`);
  }
  writeFileSync('_ws1.bak', JSON.stringify(out), 'utf8');
} else {
  const prev = JSON.parse(readFileSync('_ws1.bak', 'utf8')) as Record<string, string | null>;
  for (const k of CLAVES) {
    const v = prev[k];
    // Si la clave no existía antes, el recorrido la creó: se borra, no se deja
    // una fila inventada.
    const r = v === null
      ? await db.from('app_settings').delete().eq('workspace_id', 1).eq('key', k)
      : await db.from('app_settings').update({ value: v }).eq('workspace_id', 1).eq('key', k);
    if (r.error) { console.error(`${k}: ${r.error.message}`); process.exit(1); }
    console.log(`  ${k} ← ${v ? v.slice(0, 90) : '(borrada)'}`);
  }
}
