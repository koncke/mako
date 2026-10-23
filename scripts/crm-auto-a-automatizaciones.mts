// =============================================================================
// crm-auto-a-automatizaciones — el CRM automático de cada negocio, a cuatro automatizaciones VISIBLES (b5)
// =============================================================================
// Regla de Martín (14/10/2026): «MaKo no decide nada que no esté en el flujo». El motor del CRM automático
// (lib/crm-auto.ts, cron /api/cron/crm-automatico) movía leads por detrás con cuatro reglas: T1 (reunión pasada sin
// marcar), T2 (lead sin agendar), T3 (nutrición manual vencida) y T6 (No responde / Perdido 30 días). Las cuatro son
// plantillas de Automations desde b5 (lib/plantillas-automatizaciones.ts: «Una Reunión Sin Marcar», «Un Lead No
// Agendó», «Venció la Nutrición Manual», «Un Lead Se Enfrió»). Este script las crea en cada negocio donde el motor
// está PRENDIDO, con las etapas de su CRM.
//
// Tres pasos, cada uno con su bandera:
//   (sin bandera)  SIMULACRO: lee e imprime el antes (lo que el motor hizo en 30 días y haría hoy) y lo que se
//                  crearía. No escribe nada.
//   --aplicar      crea las cuatro PAUSADAS (no le escriben ni mueven a nadie). Deja un respaldo y lo relee.
//   --activar      las prende y apaga el motor del negocio (`crm_auto_enabled = false`, compare-and-set). SÓLO con
//                  el OK de Martín: son clientes reales y cambia qué pasa con sus leads.
//   opciones: --ws=<id> · --respaldo=<carpeta> (default: la carpeta actual)
//
// Correr (desde la raíz del repo):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm-auto-a-automatizaciones.mts
//
// ⚠️ QUÉ NEGOCIOS: los que tienen el motor PRENDIDO de verdad. El setting `crm_auto_enabled` lo dice para un
// cliente; el dueño (ws1) sin setting hereda el env CRM_AUTO_ENABLED de VERCEL, que este script no ve (el .env.local
// no lo trae). Por eso, sin setting, cuenta como prendido el negocio donde el motor movió algún lead en los últimos
// 14 días (lead_audit «CRM automático»): es la evidencia de que corre, no una suposición.
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
const activar = process.argv.includes('--activar');
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;
const carpetaRespaldo = arg('respaldo') ?? '.';

const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');
const { getPipelineStagesDefault } = await imp('lib/funnels.ts');
const { setSecuenciaPasos, setSecuenciaActiva } = await imp('lib/nutricion.ts');
const { guardarDisparadores } = await imp('lib/disparadores-guardar.ts');
const { TriggerInvalidoError } = await imp('lib/setting-secuencias.ts');
const { crearDesdePlantilla } = await imp('lib/plantilla-crear.ts');
const { plantillaPorId } = await imp('lib/plantillas-automatizaciones.ts');
const { problemasDeForma } = await imp('lib/flujo-forma.ts');
const { validarGrafo } = await imp('lib/flujo-grafo.ts');
const { planLeadAuto, AUTO_UMBRALES } = await imp('lib/crm-auto-plan.ts');
const { reunionesDe } = await imp('lib/funnel-etapas.ts');
const { setCrmAuto, crmAutoHabilitado } = await imp('lib/envio-flags.ts');
const { createClient } = await import('@supabase/supabase-js');
const { writeFileSync, readFileSync } = await import('node:fs');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(url, key, { auth: { persistSession: false } });

type Stage = { key: string; label?: string; kind?: string };
type Plan = { plantilla: string; cron: string; destinos?: Record<string, string>; porque: string };

/** Las cuatro, con el CRON y las etapas destino de ESTE embudo (el del negocio: `funnel_id` null = `venta::<etapa>`). */
function planDelNegocio(stages: Stage[]): { planes: Plan[]; faltan: string[] } {
  const hay = new Set(stages.map((s) => s.key));
  const faltan: string[] = [];
  const planes: Plan[] = [];
  const v = (etapas: string[]) => `venta::${etapas.join(',')}`;
  // T2: entra a la primera etapa (la de los leads nuevos: 'lead' en el embudo de fábrica) → No Agenda / Reactivación.
  if (hay.has('lead') && hay.has('nutri') && hay.has('reactivacion')) {
    planes.push({ plantilla: 'lead-no-agendo', cron: v(['lead']), destinos: { no_agenda: v(['nutri']), reactivacion: v(['reactivacion']) }, porque: 'T2' });
  } else faltan.push(`T2 (necesita las etapas lead, nutri y reactivacion; faltan: ${['lead', 'nutri', 'reactivacion'].filter((k) => !hay.has(k)).join(', ')})`);
  // T1: las etapas de reunión del embudo (la 1ª y la 2ª), las MISMAS que `reunionesDe` le asigna a j1/j2.
  const reus = (reunionesDe(stages) as string[]).filter(Boolean);
  if (reus.length) planes.push({ plantilla: 'reunion-sin-marcar', cron: v(reus), porque: 'T1' });
  else faltan.push('T1 (el embudo no tiene etapas de reunión)');
  // T3: la etapa de nutrición manual.
  if (hay.has('manual')) planes.push({ plantilla: 'nutricion-vencida', cron: v(['manual']), porque: 'T3' });
  else faltan.push('T3 (no hay etapa manual)');
  // T6: No responde y Perdido → Reactivación.
  const frios = ['noresp', 'perdido'].filter((k) => hay.has(k));
  if (frios.length && hay.has('reactivacion')) planes.push({ plantilla: 'lead-se-enfrio', cron: v(frios), destinos: { reactivacion: v(['reactivacion']) }, porque: 'T6' });
  else faltan.push('T6 (necesita noresp o perdido, y reactivacion)');
  return { planes, faltan };
}

const AUTO_COLS = 'id, nombre, funnel_id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_manual_deadline, created_at, updated_at, origen_lead';

async function leadsDe(ws: number): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('leads').select(AUTO_COLS).eq('workspace_id', ws).order('id').range(desde, desde + 999);
    if (error) throw new Error(`ws${ws} leads: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

// ── Qué negocios ─────────────────────────────────────────────────────────────────────────────
let qw = db.from('workspaces').select('id, nombre, estado').eq('estado', 'activo').order('id', { ascending: true });
if (soloWs != null) qw = qw.eq('id', soloWs);
const { data: wss, error: ew } = await qw;
if (ew) throw new Error(`workspaces: ${ew.message}`);
const { data: flags, error: ef } = await db.from('app_settings').select('workspace_id, value').eq('key', 'crm_auto_enabled');
if (ef) throw new Error(`crm_auto_enabled: ${ef.message}`);
const flagDe = new Map((flags ?? []).map((f: { workspace_id: number; value: unknown }) => [f.workspace_id, String(f.value).replace(/"/g, '')]));
const hace14 = new Date(Date.now() - 14 * 86_400_000).toISOString();

console.log(`\n══ CRM AUTOMÁTICO → AUTOMATIZACIONES — ${activar ? 'ACTIVANDO' : aplicar ? 'CREANDO (pausadas)' : 'SIMULACRO'} ══`);
for (const w of (wss ?? []) as Array<{ id: number; nombre: string | null }>) {
  const flag = flagDe.get(w.id) ?? null;
  let prendido = flag === 'true';
  let evidencia = flag != null ? `setting = ${flag}` : '';
  if (flag == null) {
    const { count, error } = await db.from('lead_audit').select('id', { count: 'exact', head: true })
      .eq('workspace_id', w.id).eq('campo', 'CRM automático').gt('created_at', hace14);
    if (error) throw new Error(`ws${w.id} lead_audit: ${error.message}`);
    prendido = (count ?? 0) > 0;
    evidencia = `sin setting; ${count ?? 0} movimientos del motor en 14 días`;
  }
  if (!prendido) { if (soloWs != null) console.log(`ws${w.id}: el motor está apagado (${evidencia}): nada`); continue; }

  console.log(`\n── ws${w.id} «${w.nombre ?? ''}» — motor PRENDIDO (${evidencia})`);
  await runWithWorkspace(w.id, async () => {
    const stages = (await getPipelineStagesDefault()) as Stage[];
    const { planes, faltan } = planDelNegocio(stages);
    const nombreEtapa = (k: string) => stages.find((s) => s.key === k)?.label ?? k;

    // EL ANTES: lo que hizo en 30 días y lo que haría hoy, por regla (con los umbrales de fábrica: el negocio no
    // declaró otros; si los declaró, el motor los lee de su funnel y esto lo dice).
    const { data: mov, error: em } = await db.from('lead_audit').select('valor_nuevo')
      .eq('workspace_id', w.id).eq('campo', 'CRM automático').gt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString());
    if (em) throw new Error(`ws${w.id} lead_audit: ${em.message}`);
    const hizo: Record<string, number> = {};
    for (const m of (mov ?? []) as Array<{ valor_nuevo: string | null }>) { const r = /(T\d)/.exec(m.valor_nuevo ?? '')?.[1] ?? '?'; hizo[r] = (hizo[r] ?? 0) + 1; }
    const leads = await leadsDe(w.id);
    const hoy = new Date().toISOString().slice(0, 10);
    const haria: Record<string, number> = {};
    const fueraDelNegocio: Record<string, number> = {};
    for (const l of leads) for (const a of planLeadAuto(l as never, hoy, Date.now(), AUTO_UMBRALES) as Array<{ regla: string }>) {
      haria[a.regla] = (haria[a.regla] ?? 0) + 1;
      if (l.funnel_id != null) fueraDelNegocio[a.regla] = (fueraDelNegocio[a.regla] ?? 0) + 1;
    }
    console.log(`   antes · 30 días: ${JSON.stringify(hizo)} · haría hoy: ${JSON.stringify(haria)} · de esos, leads de OTRO CRM (no los cubre el CRON del negocio): ${JSON.stringify(fueraDelNegocio)}`);
    for (const f of faltan) console.log(`   ⚠ no se crea ${f}`);

    // Las que ya existen (por el prefijo de su clave) no se duplican.
    const { data: vivas, error: ev } = await db.from('nutricion_secuencias').select('id, clave, nombre, activa')
      .eq('workspace_id', w.id).is('archivada_at', null);
    if (ev) throw new Error(`ws${w.id} secuencias: ${ev.message}`);
    const yaDe = (pl: string) => ((vivas ?? []) as Array<{ id: number; clave: string | null; nombre: string; activa: boolean }>).filter((s) => (s.clave ?? '').startsWith(`plantilla-${pl}-`));

    const respaldo: Record<string, unknown> = { ws: w.id, cuando: new Date().toISOString(), crm_auto_enabled: flag, creadas: [] as unknown[] };
    for (const p of planes) {
      const pl = plantillaPorId(p.plantilla);
      if (!pl) throw new Error(`la plantilla ${p.plantilla} no existe`);
      const destinos = p.destinos ? Object.entries(p.destinos).map(([k, v]) => `${k} → «${nombreEtapa(v.split(':')[2])}»`).join(' · ') : '';
      const ya = yaDe(p.plantilla);
      const cron = p.cron.split(':')[2].split(',').map(nombreEtapa).join(' + ');
      console.log(`   ${p.porque} «${pl.nombre}» · CRON: ${cron}${destinos ? ` · ${destinos}` : ''}${ya.length ? ` · YA EXISTE #${ya.map((s) => `${s.id}${s.activa ? ' (activa)' : ''}`).join(', #')}` : ''}`);
      if (activar) {
        for (const s of ya.filter((x) => !x.activa)) { await setSecuenciaActiva(s.id, true); console.log(`     ✓ activada #${s.id}`); }
        continue;
      }
      if (ya.length || !aplicar) continue;
      const r = await crearDesdePlantilla(p.plantilla, {
        db: (await getTenantDb()) as never,
        setPasos: setSecuenciaPasos, setDisparadores: guardarDisparadores,
        motivoDeCron: (e: unknown) => (e instanceof TriggerInvalidoError ? (e as Error).message : null),
      }, { disparador: p.cron, destinos: p.destinos });
      if (r.aviso) throw new Error(`ws${w.id} ${p.plantilla}: ${r.aviso}`);
      // Lo que quedó escrito se RELEE: los pasos válidos y con la forma de hoy, el CRON puesto, pausada.
      const { data: fila, error: er } = await db.from('nutricion_secuencias').select('id, activa, pasos, disparadores, trigger_tipo').eq('id', r.id).eq('workspace_id', w.id).single();
      if (er || !fila) throw new Error(`ws${w.id} #${r.id}: no la pude releer (${er?.message})`);
      const f = fila as { activa: boolean; pasos: unknown[]; disparadores: unknown };
      const errores = validarGrafo(f.pasos as never) as unknown[];
      const forma = problemasDeForma(f.pasos as never) as unknown[];
      if (f.activa || errores.length || forma.length) throw new Error(`ws${w.id} #${r.id}: quedó mal (activa=${f.activa}, errores=${JSON.stringify(errores)}, forma=${JSON.stringify(forma)})`);
      (respaldo.creadas as unknown[]).push({ id: r.id, plantilla: p.plantilla, cron: p.cron, destinos: p.destinos ?? null, disparadores: f.disparadores });
      console.log(`     ✓ creada #${r.id} «${r.nombre}», pausada, releída`);
    }

    if (aplicar && (respaldo.creadas as unknown[]).length) {
      const ruta = `${carpetaRespaldo}/crm-auto-respaldo-ws${w.id}.json`;
      writeFileSync(ruta, JSON.stringify(respaldo, null, 2));
      const releido = JSON.parse(readFileSync(ruta, 'utf8'));
      if (releido.creadas.length !== (respaldo.creadas as unknown[]).length) throw new Error(`ws${w.id}: el respaldo no se releyó igual`);
      console.log(`   respaldo: ${ruta}`);
    }

    // Apagar el motor POR SU PUERTA (`setCrmAuto`, lib/envio-flags.ts) y releerlo: con el setting en false el cron lo
    // reporta 'off' y no toca ningún lead. Las confirmaciones viejas (mako_confirmaciones) quedan: se resuelven en el CRM.
    if (activar) {
      await setCrmAuto(false);
      if (await crmAutoHabilitado()) throw new Error(`ws${w.id}: el motor sigue prendido después de apagarlo`);
      console.log('   ✓ motor del CRM automático APAGADO en este negocio (releído)');
    }
  });
}
console.log('');
