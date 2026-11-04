// =============================================================================
// medir-aviso-cuenta-frenada — ¿el aviso de «cuenta de anuncios frenada» le llega al grupo de MaKo del cliente? (SÓLO LECTURA)
// =============================================================================
// Martín, 24/10/2026 (20 puntos, #4): «"Su cuenta de anuncios frenada por falta de pago", para esto tenemos las
// notificaciones de advertencia al grupo de mako». El camino (sin mandar nada de prueba a un cliente real):
//   1. el cron /api/cron/alerta-critica (cada 10 min, vercel.json) recorre los negocios y, por cada incidente de Meta ABIERTO,
//      CONFIRMADO y con la entrega frenada o rojo (`esCritico`, lib/alerta-critica.ts), emite el evento de la plataforma
//      `meta_cuenta_frenada` cada hora;
//   2. lo corren las automatizaciones de SuperAdmin de ese evento (`emitirPorEvento`, lib/aviso-evento.ts), con el techo
//      «Aviso número ≤ 3»; su tarjeta de MaKo sale al grupo «MaKo <> cliente» de ESE negocio (`negocioWs`);
//   3. cada aviso deja su fila en `notificaciones` (base principal) con lo que pasó al salir (`payload.salida`), y la marca
//      de la insistencia (`mako.alerta.insistencia.<incidente>`) cuenta los que LLEGARON.
// Este script mira las tres cosas por negocio. Cada negocio en SU base (`runWithWorkspace` + `getTenantDb`).
//
// Uso (el .env.local del clon es PRODUCCIÓN, sólo se lee):
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/medir-aviso-cuenta-frenada.mts [--dias=14]
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb, wsSuperAdmin } = await imp('lib/workspace.ts');
const { getSetting } = await imp('lib/settings.ts');
const { grupoJidEstricto } = await imp('lib/mako-grupo.ts');
const { eventoDeFila } = await imp('lib/aviso-evento.ts');
const { TRIGGER_AVISO_MAKO } = await imp('lib/disparadores.ts');
const { createClient } = await import('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DIAS = Number((process.argv.find((a) => a.startsWith('--dias=')) ?? '--dias=14').slice(7));
const DESDE = new Date(Date.now() - DIAS * 86_400_000).toISOString();
const ART = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : '—');
const chk = <T,>(r: { data: T | null; error: { message: string } | null }, q: string): T => { if (r.error) throw new Error(`${q}: ${r.error.message}`); return r.data as T; };

// 2. Las automatizaciones de la plataforma de este evento.
const wsPlat = await wsSuperAdmin();
const filas = chk(await db.from('nutricion_secuencias').select('id, nombre, activa, pasos, trigger_tipo, disparadores, archivada_at')
  .eq('workspace_id', wsPlat).eq('trigger_tipo', TRIGGER_AVISO_MAKO), 'filas de la plataforma') as Array<{ id: number; nombre: string | null; activa: boolean | null; pasos: unknown; trigger_tipo: string; disparadores?: unknown; archivada_at: string | null }>;
const deEste = filas.filter((f) => ['meta_cuenta_frenada', 'meta_cuenta_recuperada', 'meta_cuenta_frenada_agencia', 'meta_cuenta_recuperada_agencia'].includes(String(eventoDeFila(f))));
console.log(`Ahora ${ART(new Date().toISOString())} ART. Plataforma: ws${wsPlat}. Mirando ${DIAS} días.`);
console.log(`Automatizaciones de la plataforma para la cuenta frenada / recuperada:`);
for (const f of deEste) {
  const pasos = (Array.isArray(f.pasos) ? f.pasos : []) as Array<Record<string, unknown>>;
  const tarjetas = pasos.map((p) => String(p.nodo ?? (p.accion as { operacion?: string } | undefined)?.operacion ?? p.tipo ?? p.canal ?? '?')).join(' → ');
  console.log(`  #${f.id} «${f.nombre}» · ${eventoDeFila(f)} · ${f.archivada_at ? 'ARCHIVADA' : f.activa ? 'prendida' : 'APAGADA'} · ${tarjetas}`);
}
if (!deEste.length) console.log('  ✖ NINGUNA: el evento no sale (sin camino viejo desde el 16/10).');

// 1 y 3. Por negocio: los incidentes de Meta, la insistencia, el grupo y lo que salió.
const wss = chk(await db.from('workspaces').select('id, nombre').order('id'), 'workspaces') as Array<{ id: number; nombre: string | null }>;
const notifs = chk(await db.from('notificaciones').select('id, workspace_id, tipo, titulo, created_at, payload')
  .in('tipo', ['meta-cuenta-frenada', 'meta-cuenta-recuperada', 'meta-cuenta-frenada-agencia', 'meta-cuenta-recuperada-agencia']).gte('created_at', DESDE).order('created_at').limit(2000), 'notificaciones') as Array<{ id: number; workspace_id: number; tipo: string; titulo: string | null; created_at: string; payload: Record<string, unknown> | null }>;
for (const w of wss) {
  await runWithWorkspace(w.id, async () => {
    let incs: Array<{ id: number; service: string; severidad: string; status_label: string | null; disable_reason: string | null; entrega_frenada: boolean; confirmado: boolean; started_at: string; resolved_at: string | null }> = [];
    try {
      const tdb = await getTenantDb();
      incs = chk(await tdb.from('service_incidents').select('id, service, severidad, status_label, disable_reason, entrega_frenada, confirmado, started_at, resolved_at')
        .eq('service', 'meta').or(`resolved_at.is.null,resolved_at.gte.${DESDE}`).order('started_at'), 'incidentes') as typeof incs;
    } catch (e) { console.log(`\nws${w.id} «${w.nombre}»: no pude leer sus incidentes — ${e instanceof Error ? e.message : String(e)}`); return; }
    const suyas = notifs.filter((n) => n.workspace_id === w.id);
    if (!incs.length && !suyas.length) return;
    let grupo: string | null = null;
    try { grupo = await grupoJidEstricto(w.id); } catch (e) { grupo = `no pude leerlo: ${e instanceof Error ? e.message : String(e)}`; }
    console.log(`\nws${w.id} «${w.nombre}» · grupo de MaKo: ${grupo ?? '✖ NO TIENE'}`);
    for (const i of incs) {
      const critico = i.confirmado && (i.entrega_frenada || i.severidad === 'rojo');
      const marca = await getSetting(`mako.alerta.insistencia.${i.id}`).catch(() => null);
      console.log(`  incidente ${i.id}: ${i.status_label ?? '—'}${i.disable_reason ? ` (${i.disable_reason})` : ''} · ${i.severidad}${i.entrega_frenada ? ' · entrega frenada' : ''}${i.confirmado ? ' · confirmado' : ' · SIN confirmar'} · desde ${ART(i.started_at)}${i.resolved_at ? ` · resuelto ${ART(i.resolved_at)}` : ' · ABIERTO'} · ${critico ? 'se avisa' : 'no se avisa'} · insistencia: ${marca || '—'}`);
    }
    for (const n of suyas) {
      const s = (n.payload?.salida ?? null) as Record<string, unknown> | null;
      console.log(`  ${ART(n.created_at)} ${n.tipo} «${(n.titulo ?? '').slice(0, 50)}» · salida: ${s ? JSON.stringify(s).slice(0, 160) : '—'}`);
    }
  });
}
