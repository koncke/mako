// =============================================================================
// recordatorio-a-automatizacion — el recordatorio de la reunión de cada negocio, a una automatización más
// =============================================================================
// Decisión de Martín (10/10/2026), a la pregunta de qué hacer con el recordatorio de la reunión (le faltaban el
// ✦, mover tarjetas, «Acomodar» y «Probar»): «Mudarlo al motor». El porqué de la forma, en
// lib/recordatorio-automatizacion.ts: la automatización vive como cualquier otra y la manda el MISMO emisor de
// siempre (`toquesDelNegocio`, lib/reunion-recordatorio.ts), así que la mudanza no cambia qué sale ni cuándo.
//
// Por cada negocio ACTIVO que todavía no tiene una automatización con el CRON del recordatorio, y que tiene algo
// PROPIO que mudar (prendida, o con textos o números suyos; lo de fábrica apagado no se crea: ver abajo):
//   1. lee su configuración de antes (`chatbot.recordatorio_reunion`; sin fila = la de fábrica, apagada);
//   2. arma los pasos con los MISMOS toques (`pasosDeLaConfig`) y comprueba que el emisor los lea igual;
//   3. crea la automatización «Recordatorio de la reunión», PRENDIDA sólo si la de antes lo estaba;
//   4. si la de antes estaba prendida, la APAGA (conserva los textos): con la fila, el emisor ya no la mira, y
//      apagada no revive si alguien archiva la automatización.
// Un negocio que ya tiene la automatización se saltea: correrlo dos veces no duplica nada.
//
//   npx tsx scripts/recordatorio-a-automatizacion.mts               → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/recordatorio-a-automatizacion.mts --aplicar     → escribe
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id>
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE: cada lectura y escritura filtra `workspace_id` a mano. Y el apagado de la
// configuración de antes es compare-and-set sobre su valor: si alguien la cambió en el medio, no se pisa.
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
config({ path: arg('env') ?? '.env.local' });
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;

const { TRIGGER_RECORDATORIO, NOMBRE_RECORDATORIO_AUTOMATIZACION, pasosDeLaConfig, toquesDeLaAutomatizacion } = await import('../lib/recordatorio-automatizacion');
const { KEY_RECORDATORIO, TOQUES, configDeRecordatorio, serializarConfig } = await import('../lib/recordatorio-lead');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasá --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

let qw = db.from('workspaces').select('id, nombre, estado').eq('estado', 'activo').order('id', { ascending: true });
if (soloWs != null) qw = qw.eq('id', soloWs);
const { data: wss, error: ew } = await qw;
if (ew) throw new Error(`workspaces: ${ew.message}`);

console.log(`\n══ RECORDATORIO → AUTOMATIZACIÓN — ${aplicar ? 'APLICANDO' : 'SIMULACRO'} ══`);
let creadas = 0, apagadas = 0, salteadas = 0;
for (const w of (wss ?? []) as Array<{ id: number; nombre: string | null }>) {
  const { data: ya, error: ey } = await db.from('nutricion_secuencias').select('id, activa')
    .eq('workspace_id', w.id).eq('trigger_tipo', TRIGGER_RECORDATORIO).is('archivada_at', null);
  if (ey) throw new Error(`ws${w.id}: ${ey.message}`);
  if ((ya ?? []).length) { console.log(`ws${w.id}: ya tiene la automatización (#${ya!.map((x) => x.id).join(', #')}): nada`); salteadas++; continue; }

  const { data: fila, error: es } = await db.from('app_settings').select('value')
    .eq('workspace_id', w.id).eq('key', KEY_RECORDATORIO).maybeSingle();
  if (es) throw new Error(`ws${w.id}: ${es.message}`);
  const raw = (fila?.value as string | undefined) ?? null;
  const cfg = configDeRecordatorio(raw);
  // ⛔ SIN NADA PROPIO QUE MUDAR, NO SE CREA (decisión de Martín, 10/10/2026 a la noche: «Ningún negocio tiene que
  // arrancar con ninguna automatización creada, para eso ya tenemos los templates»). Apagada y con los textos y
  // números de fábrica es la plantilla de la galería (`recordatorio-reunion`): el negocio que la quiera la elige.
  // La primera corrida (10/10 ~14:26) las creó igual en 9 negocios; se archivaron (#229-#237) y esto no las recrea.
  if (!cfg.activo && !cfg.propios.length && !Object.keys(cfg.lineas).length) {
    console.log(`ws${w.id}: nada propio que mudar (la de fábrica, apagada): no se crea, está en la galería`);
    salteadas++;
    continue;
  }
  const pasos = pasosDeLaConfig(cfg);
  const r = toquesDeLaAutomatizacion(pasos);
  if (r.problema) throw new Error(`ws${w.id}: los pasos no se leen (${r.problema})`);
  // Lo que el emisor va a leer de la fila tiene que ser lo que leía de la configuración.
  const igual = TOQUES.every((m, i) => r.toques[i]?.min === m && r.toques[i]?.texto === cfg.textos[m] && r.toques[i]?.linea === (cfg.lineas[m] ?? null));
  if (!igual || r.toques.length !== TOQUES.length) throw new Error(`ws${w.id}: los toques de la fila no son los de la configuración`);

  console.log(`ws${w.id} «${w.nombre ?? ''}»: crea «${NOMBRE_RECORDATORIO_AUTOMATIZACION}» ${cfg.activo ? 'PRENDIDA' : 'pausada'}`
    + ` · textos propios: ${cfg.propios.length ? cfg.propios.join(', ') : 'ninguno'} · números: ${Object.keys(cfg.lineas).length ? JSON.stringify(cfg.lineas) : 'los de por default'}`
    + (cfg.activo ? ' · y apaga la configuración de antes' : ''));
  if (!aplicar) continue;

  const { data: nueva, error: ei } = await db.from('nutricion_secuencias').insert({
    workspace_id: w.id, clave: 'recordatorio-de-la-reunion', nombre: NOMBRE_RECORDATORIO_AUTOMATIZACION,
    etapa: 'manual', trigger_tipo: TRIGGER_RECORDATORIO, activa: cfg.activo, pasos, emoji: '⏰',
  }).select('id').single();
  if (ei) throw new Error(`ws${w.id}: no se creó (${ei.message})`);
  creadas++;
  console.log(`  ✓ creada #${(nueva as { id: number }).id}`);

  if (cfg.activo && raw != null) {
    const apagado = serializarConfig({ activo: false, textos: cfg.textos, lineas: cfg.lineas });
    const { data: u, error: eu } = await db.from('app_settings').update({ value: apagado })
      .eq('workspace_id', w.id).eq('key', KEY_RECORDATORIO).eq('value', raw).select('workspace_id');
    if (eu) throw new Error(`ws${w.id}: no se apagó la configuración de antes (${eu.message})`);
    if (!(u ?? []).length) console.log('  ⚠ la configuración de antes cambió en el medio: no se tocó (el emisor ya lee la fila)');
    else { apagadas++; console.log('  ✓ configuración de antes apagada (los textos quedan como respaldo)'); }
  }
}
console.log(`\n${aplicar ? '' : '(simulacro) '}creadas: ${creadas} · configuraciones apagadas: ${apagadas} · ya estaban: ${salteadas}`);
