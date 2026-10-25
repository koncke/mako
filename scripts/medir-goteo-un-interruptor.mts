// =============================================================================
// medir-goteo-un-interruptor — qué goteo tiene guardado cada automatización, antes de juntarlos en uno (SÓLO LECTURA)
// =============================================================================
// Martín, 24/10/2026 23:00 (f21 de la llamada con Leandro): «Uno solo: un solo interruptor de goteo (y uno de tope por día)
// que valga para todos los canales». Hasta ese día había dos: `goteo` (WhatsApp) y `goteoEmail` (23/10). Al leer, el de
// WhatsApp pasa a ser el de todos y, si no hay, el del email (lib/config-automatizacion.ts, `sanearConfigAutomatizacion`).
// Esto cuenta, por negocio, cuántas tienen cada uno, cuáles tienen los dos DISTINTOS (ahí el del email se deja de aplicar) y
// si están prendidas. Las automatizaciones se leen en la base de cada negocio (`runWithWorkspace` + `getTenantDb`).
//
// Uso (el .env.local del clon es PRODUCCIÓN, sólo se lee):
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/medir-goteo-un-interruptor.mts
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');
const { CLAVE_PREFIJO, secuenciaDeClave } = await imp('lib/config-automatizacion.ts');
const { createClient } = await import('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const chk = <T,>(r: { data: T | null; error: { message: string } | null }, q: string): T => { if (r.error) throw new Error(`${q}: ${r.error.message}`); return r.data as T; };
type G = { minutos?: unknown; dia?: unknown } | undefined;
const txt = (g: G) => (g ? `${g.minutos != null ? `cada ${g.minutos} min` : ''}${g.minutos != null && g.dia != null ? ', ' : ''}${g.dia != null ? `${g.dia}/día` : ''}` || 'vacío' : '—');
const igual = (a: G, b: G) => (a?.minutos ?? null) === (b?.minutos ?? null) && (a?.dia ?? null) === (b?.dia ?? null);

const filas = chk(await db.from('app_settings').select('workspace_id, key, value').like('key', `${CLAVE_PREFIJO}%`).limit(5000), 'app_settings') as Array<{ workspace_id: number; key: string; value: unknown }>;
const wss = chk(await db.from('workspaces').select('id, nombre').order('id'), 'workspaces') as Array<{ id: number; nombre: string | null }>;
const nombre = new Map(wss.map((w) => [w.id, w.nombre ?? `#${w.id}`]));
const porWs = new Map<number, Array<{ id: number; goteo: G; goteoEmail: G }>>();
for (const f of filas) {
  const id = secuenciaDeClave(f.key);
  if (id == null) continue;
  let v: unknown = f.value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { continue; } }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, G>;
  if (!o.goteo && !o.goteoEmail) continue;
  const l = porWs.get(f.workspace_id) ?? [];
  l.push({ id, goteo: o.goteo, goteoEmail: o.goteoEmail });
  porWs.set(f.workspace_id, l);
}
console.log(`Ahora ${new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} ART. Configuraciones con goteo: ${[...porWs.values()].flat().length} en ${porWs.size} negocios.`);
let distintas = 0;
let soloEmail = 0;
for (const [ws, lista] of [...porWs].sort((a, b) => a[0] - b[0])) {
  const estado = new Map<number, string>();
  await runWithWorkspace(ws, async () => {
    try {
      const tdb = await getTenantDb();
      const secs = chk(await tdb.from('nutricion_secuencias').select('id, nombre, activa, archivada_at').in('id', lista.map((x) => x.id)), 'secuencias') as Array<{ id: number; nombre: string | null; activa: boolean | null; archivada_at: string | null }>;
      for (const s of secs) estado.set(s.id, `«${s.nombre ?? ''}» ${s.archivada_at ? 'ARCHIVADA' : s.activa ? 'prendida' : 'apagada'}`);
    } catch (e) { console.log(`  (no pude leer las automatizaciones de ${nombre.get(ws)}: ${e instanceof Error ? e.message : String(e)})`); }
  });
  console.log(`\n${nombre.get(ws)} (ws${ws}): ${lista.length}`);
  for (const x of lista) {
    const marca = x.goteo && x.goteoEmail && !igual(x.goteo, x.goteoEmail) ? '  ⚠ DISTINTOS: queda el de WhatsApp' : !x.goteo && x.goteoEmail ? '  ← sólo email: pasa a valer para todos' : '';
    if (marca.includes('DISTINTOS')) distintas += 1;
    if (marca.includes('sólo email')) soloEmail += 1;
    console.log(`  #${x.id} ${estado.get(x.id) ?? '(no está en su base)'} · WhatsApp ${txt(x.goteo)} · email ${txt(x.goteoEmail)}${marca}`);
  }
}
console.log(`\nCon los dos distintos: ${distintas}. Sólo con el del email: ${soloEmail}.`);
