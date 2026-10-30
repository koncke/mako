// =============================================================================
// Hijo de tests/zernio-leads-barrido.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El M3 de la revisión de privacidad (29/10/2026) con la carga REAL (`cargarLeadDeZernio` → `upsertLeadFromMeta`): Ana llenó el
// formulario A y el B, y el webhook dejó UNA ficha con el id de B. Antes, cada barrido «cargaba» A (no estaba por id), lo fusionaba
// por teléfono y le pisaba el `meta_lead_id` y la campaña, con otra conversión y otro aviso; la vez siguiente, B. Tres pasadas.
// Molde: la prueba de la revisión (C:/dev/revisiones/2910-rev-zernio-pruebas/_rev-leads-real-hijo.ts), con la cuenta en cada lead y
// una persona nueva que SÍ tiene que entrar.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

const pg = crearPostgrest({
  tablas: ['credenciales', 'app_settings', 'workspaces', 'webhook_routing', 'zernio_workspace', 'leads', 'leads_papelera', 'lead_audit',
    'campana_funnel', 'funnels', 'workspace_members', 'usuarios', 'notificaciones', 'avisos', 'avisos_dedup', 'lead_funnel', 'automatizaciones'],
  defaults: (t, f) => (t === 'leads' && f.id == null ? { ...f, id: 100 + pg.db.leads.length } : { ...f }),
});
const db = pg.db;
const red: string[] = [];
let leadsDe: Record<string, unknown[]> = {};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    const key = (new Headers(init.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    if (ruta === '/profiles') return json(200, { profiles: [{ _id: `prof_${key}`, name: 'Default', isDefault: true }] });
    if (ruta === '/accounts') {
      return json(200, { accounts: [{ _id: 'acc_fb_1', platform: 'facebook', username: 'p', isActive: true, profileId: u.searchParams.get('profileId') }] });
    }
    if (ruta === '/ads/leads') return json(200, { leads: leadsDe[key] ?? [], pagination: { hasMore: false } });
    return json(404, { error: 'sin mock' });
  }
  red.push(`${u.host}${u.pathname}`);
  return json(500, { error: 'red de mentira' });
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';

const AHORA = new Date('2026-10-29T18:00:00Z');
const lead = (id: string, nombre: string, tel: string) => ({
  leadgenId: id, formId: 'f1', accountId: 'acc_fb_1', adId: '1', adsetId: '2', campaignId: '3', createdTime: new Date(AHORA.getTime() - 3600_000).toISOString(),
  fieldData: [{ name: 'full_name', values: [nombre] }, { name: 'phone_number', values: [tel] }],
});

async function main() {
  const { cifrar } = await import('../lib/cripto-credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { barrerLeadsDeZernio } = await import('../lib/zernio-leads-barrido');
  db.workspaces.push({ id: 3, nombre: 'Prueba', capa: 'cliente' }, { id: 9, nombre: 'MaKo', capa: 'superadmin' });
  db.credenciales.push({ workspace_id: 3, clave: 'ZERNIO_API_KEY', valor_enc: cifrar('sk_propia', 3, 'ZERNIO_API_KEY'), servicio: 'zernio' });
  db.leads.push({
    id: 1, workspace_id: 3, meta_lead_id: '90000000000002', telefono: '+5491100000099', telefono_normalizado: '5491100000099', nombre: 'Ana Perez',
    email: null, meta_ad_name: 'Anuncio de octubre', meta_campaign_name: 'Campaña X',
  });
  leadsDe = {
    sk_propia: [
      lead('90000000000001', 'Ana Perez', '+5491100000099'), lead('90000000000002', 'Ana Perez', '+5491100000099'),
      lead('90000000000003', 'Beto Nuevo', '+5491100000077'),
    ],
  };
  const conv: string[] = [];
  const vueltas: unknown[] = [];
  const alNacer = async (_w: number, c: { conversion: boolean }, l: { leadgenId: string }) => { if (c.conversion) conv.push(l.leadgenId); };
  for (let i = 0; i < 3; i++) {
    const r = await runWithWorkspace(3, () => barrerLeadsDeZernio(3, 1, AHORA, { alNacer } as never));
    const f = db.leads.find((x) => x.id === 1) as Record<string, unknown>;
    vueltas.push({ r, meta_lead_id: f.meta_lead_id, meta_ad_name: f.meta_ad_name ?? null, meta_campaign_name: f.meta_campaign_name ?? null });
  }
  const out = { vueltas, conv, fichas: db.leads.length, red };
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`, () => process.exit(0));
}

void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e) })}`, () => process.exit(0)); });

export {};
