// =============================================================================
// medir-instagram-de-mako — ¿se puede probar un DM con botones en el Instagram de MaKo? (SÓLO LECTURA, 25/10/2026)
// =============================================================================
// El Cerebro (25/10, con el pedido de Leandro): «No se probó con un DM de verdad. Pruébalo con el Instagram de MaKo (el negocio
// de la plataforma, por su Zernio), nunca primero con el de un cliente». Antes de armar nada, esto mira:
//   1. el negocio de la plataforma (`wsSuperAdmin`) y su fila de Zernio (`zernio_workspace`: el profile y si el webhook entregó);
//   2. las cuentas que Zernio le da a esa key (GET /accounts), SIN reclamarlas: `cuentasConectadas` hace `upsertRouting`,
//      y esto no escribe nada;
//   3. lo que ya llegó por Instagram a su base (`ig_conversaciones`), y sus automatizaciones de Instagram.
//
// Uso (el .env.local del clon es PRODUCCIÓN, sólo se lee):
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/medir-instagram-de-mako.mts [--ws=3]
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb, wsSuperAdmin } = await imp('lib/workspace.ts');
const { cfg, zFetch } = await imp('lib/zernio.ts');
const { createClient } = await import('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ART = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : '—');
// --ws=<n>: otro negocio NUESTRO (el Cliente de Prueba es el 3). Sin eso, el de la plataforma.
const wsArg = process.argv.find((a) => a.startsWith('--ws='));
const ws = wsArg ? Number(wsArg.slice(5)) : await wsSuperAdmin();
const { data: ws0 } = await db.from('workspaces').select('id, nombre').eq('id', ws).maybeSingle();
console.log(`Ahora ${ART(new Date().toISOString())} ART. Plataforma: «${(ws0 as { nombre?: string } | null)?.nombre ?? '?'}» (ws${ws}).`);
const { data: conZ } = await db.from('zernio_workspace').select('workspace_id, profile_id, webhook_ok');
console.log('negocios con fila de Zernio:', JSON.stringify(conZ));
const { data: zw, error: ezw } = await db.from('zernio_workspace').select('*').eq('workspace_id', ws).maybeSingle();
console.log('zernio_workspace:', ezw ? `ERROR ${ezw.message}` : JSON.stringify(zw));

await runWithWorkspace(ws, async () => {
  let c: { apiKey: string; byok: boolean } | null = null;
  try { c = await cfg(ws); console.log(`key de Zernio: ${c!.byok ? 'propia' : 'de la plataforma'}`); }
  catch (e) { console.log(`✖ sin key de Zernio: ${e instanceof Error ? e.message : String(e)}`); }
  if (c) {
    const profileId = (zw as { profile_id?: string | null } | null)?.profile_id ?? null;
    try {
      const q = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
      const r = await zFetch(c.apiKey, `/accounts${q}`) as { accounts?: Array<Record<string, unknown>> };
      const cuentas = (r.accounts ?? []).filter((a) => a.platform === 'instagram' || a.platform === 'facebook');
      console.log(`cuentas en Zernio${profileId ? ` (profile ${profileId})` : ''}: ${cuentas.length}`);
      for (const a of cuentas) console.log(`  · ${a.platform} @${a.username ?? a.displayName ?? '?'} id=${a._id} activa=${a.isActive ?? '?'}`);
    } catch (e) { console.log(`✖ GET /accounts: ${e instanceof Error ? e.message : String(e)}`); }
    try {
      const w = await zFetch(c.apiKey, '/webhooks/settings') as { webhooks?: Array<{ url?: string; events?: string[]; isActive?: boolean }> };
      for (const h of w.webhooks ?? []) console.log(`  webhook ${h.isActive ? 'activo' : 'apagado'} → ${String(h.url ?? '').replace(/[?&]s=[^&]+/, '')} · ${(h.events ?? []).join(', ')}`);
      if (!(w.webhooks ?? []).length) console.log('  ✖ sin webhook: no llega nada');
    } catch (e) { console.log(`✖ GET /webhooks/settings: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const tdb = await getTenantDb();
  const { data: convs, error: ec } = await tdb.from('ig_conversaciones').select('*')
    .order('id', { ascending: false }).limit(8);
  if (ec) console.log(`✖ ig_conversaciones: ${ec.message}`);
  else {
    console.log(`ig_conversaciones (las últimas ${convs?.length ?? 0}):`);
    for (const c2 of (convs ?? []) as Array<Record<string, unknown>>) console.log(`  #${c2.id} ${c2.plataforma ?? c2.canal ?? ''} @${c2.username ?? '?'} lead=${c2.lead_id ?? '—'} cuenta=${c2.zernio_account_id ?? '—'}`);
  }
  const { data: secs } = await tdb.from('nutricion_secuencias').select('id, nombre, activa, archivada_at, trigger_tipo, disparadores').is('archivada_at', null).order('id', { ascending: false }).limit(200);
  const deIg = ((secs ?? []) as Array<Record<string, unknown>>).filter((s) => String(s.trigger_tipo) === 'instagram' || JSON.stringify(s.disparadores ?? '').includes('instagram'));
  console.log(`automatizaciones de Instagram vigentes: ${deIg.length}`);
  for (const s of deIg.slice(0, 10)) console.log(`  #${s.id} «${s.nombre}» ${s.activa ? 'prendida' : 'apagada'}`);
});
