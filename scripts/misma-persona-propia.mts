// =============================================================================
// misma-persona-propia — a cada automatización que HEREDABA la «Misma persona» del negocio, se la guarda como SUYA
// =============================================================================
// 23/10/2026. Martín: «"Misma persona" apagado por defecto» y «No quiero nada para todas las automatizaciones». El
// Cerebro decidió el alcance: las NUEVAS nacen apagadas (`personaHorasDeLaAutomatizacion`, lib/config-automatizacion.ts:
// sin las suyas, 0 h) y las que EXISTÍAN guardan como suyo lo que heredaban, que es lo que muestran hoy. Así ninguna
// cambia su anti-ban y no queda una herencia escondida.
//
// ⚠️ EL ORDEN: SE CORRE ANTES DEL DEPLOY del commit que cambia `personaHorasDeLaAutomatizacion`. Con el código viejo, lo
// que escribe no cambia nada (guarda el mismo número que heredaba). Si se corre DESPUÉS, las que heredaban pasan el rato
// del medio APAGADAS. Y no se vuelve a correr sobre automatizaciones creadas después del deploy: esas son las NUEVAS, que
// nacen apagadas; por eso `--creadas-antes` es obligatorio (el momento en que se corre, justo antes del deploy).
//
//   node --import tsx scripts/misma-persona-propia.mts --creadas-antes=<ISO>            → SIMULACRO: lee e imprime
//   node --import tsx scripts/misma-persona-propia.mts --creadas-antes=<ISO> --aplicar  → escribe
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id>
//
// Por negocio imprime cuántas toca, y de cada una qué guarda. IDEMPOTENTE: la que ya tiene sus horas en los dos canales no
// se toca (`fijarPersonaPropia` → `cambia: false`), así que una segunda corrida con el mismo corte no escribe nada. Las
// horas del negocio se leen con la MISMA regla que el motor de antes (`limitesVigentes` con `limitesDeFabrica(env)`).
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE: cada lectura y escritura filtra `workspace_id` a mano. La escritura es compare-and-set
// sobre el `value` leído (o un insert si no había fila): si alguien cambió la configuración mientras tanto, no se pisa y se
// dice. Las ARCHIVADAS también: no mandan, pero al desarchivar volverían apagadas sin que nadie lo decida.
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
config({ path: arg('env') ?? '.env.local', quiet: true });
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;
const corte = arg('creadas-antes');
if (!corte || Number.isNaN(Date.parse(corte))) throw new Error('falta --creadas-antes=<ISO>: el momento en que se corre, justo antes del deploy');

const { claveConfigAutomatizacion, sanearConfigAutomatizacion, fijarPersonaPropia } = await import('../lib/config-automatizacion');
const { KEY_LIMITES_ENVIO, limitesDeFabrica, limitesVigentes } = await import('../lib/limites-envio');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasá --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });
const fabrica = limitesDeFabrica(process.env);

let q = db.from('nutricion_secuencias').select('id, workspace_id, nombre, created_at').lt('created_at', new Date(corte).toISOString()).order('workspace_id').order('id');
if (soloWs != null) q = q.eq('workspace_id', soloWs);
const { data: secs, error } = await q.limit(5000);
if (error) throw new Error(`las automatizaciones: ${error.message}`);
const porWs = new Map<number, Array<{ id: number; nombre: string }>>();
for (const s of (secs ?? []) as Array<{ id: number; workspace_id: number; nombre: string }>) {
  const ws = Number(s.workspace_id);
  porWs.set(ws, [...(porWs.get(ws) ?? []), { id: Number(s.id), nombre: s.nombre }]);
}

console.log(`${aplicar ? 'APLICAR' : 'SIMULACRO'} · creadas antes de ${corte} · ${secs?.length ?? 0} automatizaciones en ${porWs.size} negocios\n`);
let tocadas = 0, fallas = 0;
for (const [ws, lista] of porWs) {
  const lim = await db.from('app_settings').select('value').eq('workspace_id', ws).eq('key', KEY_LIMITES_ENVIO).maybeSingle();
  if (lim.error) { console.log(`ws${ws}: NO PUDE LEER sus límites (${lim.error.message}); no toco ninguna`); fallas++; continue; }
  const delNegocio = limitesVigentes(lim.data?.value ?? null, fabrica);
  const claves = lista.map((s) => claveConfigAutomatizacion(s.id));
  const cfg = await db.from('app_settings').select('key, value').eq('workspace_id', ws).in('key', claves);
  if (cfg.error) { console.log(`ws${ws}: NO PUDE LEER sus configuraciones (${cfg.error.message}); no toco ninguna`); fallas++; continue; }
  const crudo = new Map(((cfg.data ?? []) as Array<{ key: string; value: string | null }>).map((r) => [r.key, r.value]));
  const cambios: string[] = [];
  for (const s of lista) {
    const clave = claveConfigAutomatizacion(s.id);
    const previo = crudo.get(clave);
    const r = fijarPersonaPropia(sanearConfigAutomatizacion(previo ?? null), delNegocio);
    if ('error' in r) { cambios.push(`  #${s.id} «${s.nombre}»: NO SE PUEDE: ${r.error}`); fallas++; continue; }
    if (!r.cambia) continue;
    tocadas++;
    let estado = 'simulado';
    if (aplicar) {
      const w = previo === undefined
        ? await db.from('app_settings').insert({ workspace_id: ws, key: clave, value: r.valor, updated_at: new Date().toISOString() }).select('key')
        : await db.from('app_settings').update({ value: r.valor, updated_at: new Date().toISOString() }).eq('workspace_id', ws).eq('key', clave).eq('value', previo as string).select('key');
      if (w.error) { estado = `NO SE ESCRIBIÓ: ${w.error.message}`; fallas++; }
      else if (!(w.data ?? []).length) { estado = 'NO SE ESCRIBIÓ: cambió mientras tanto'; fallas++; }
      else estado = 'escrito';
    }
    cambios.push(`  #${s.id} «${s.nombre}»: WhatsApp ${r.config.personaHoras?.whatsapp} h · email ${r.config.personaHoras?.email} h (${estado})`);
  }
  console.log(`ws${ws}: ${cambios.filter((c) => !c.includes('NO SE PUEDE')).length} de ${lista.length} (negocio: ${delNegocio.wa.personaHoras} h WhatsApp, ${delNegocio.email.personaHoras} h email)`);
  for (const c of cambios) console.log(c);
}
console.log(`\nTotal: ${tocadas} automatizaciones ${aplicar ? 'tocadas' : 'a tocar'} · ${fallas} problemas`);
process.exit(fallas ? 1 : 0);
