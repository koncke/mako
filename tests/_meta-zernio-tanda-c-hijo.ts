// =============================================================================
// Hijo de tests/meta-zernio-tanda-c.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// O8 (18/11/2026): corre de verdad (`server-only`, `--conditions=react-server`) las lecturas de Meta que pasaron a ir por la
// Zernio del negocio, sobre el PostgREST de mentira, un Zernio de mentira y una Graph API de mentira. Tres negocios:
//   · ws3: Meta por Zernio y SIN token → todo por Zernio, ningún pedido a graph.facebook.com;
//   · ws4: Meta por Zernio CON el token de antes, y Zernio caído → se lee por el token de respaldo;
//   · ws13: sólo el token (no conectó Zernio) → por la Graph API, como siempre.
// Imprime qué devolvió cada lectura y a dónde salió.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.META_API_VERSION = 'v21.0';

const pg = crearPostgrest({ tablas: ['credenciales', 'workspaces', 'app_settings', 'webhook_routing', 'zernio_workspace'] });
let red: string[] = [];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  const key = (new Headers(init.headers).get('authorization') ?? '').replace(/^Bearer /, '');
  if (u.host === 'zernio.com') {
    const ruta = u.pathname.replace(/^\/api\/v1/, '');
    red.push(`zernio ${ruta}`);
    if (key === 'sk_zernio_ws4') return json({ error: 'Zernio caído' }, 503);
    if (ruta === '/ads/instagram-accounts') {
      return json({
        accounts: [{ igUserId: '9000', username: 'cuenta_publicitaria', source: 'ad_account' }],
        // La del negocio NO va primera: el Instagram es el de SU página, no el de la primera que lista Zernio.
        pages: [{ pageId: '222', name: 'Otra página', instagramBusinessAccount: { igUserId: '7222', username: 'otra' } }, { pageId: '111', name: 'Página del negocio', instagramBusinessAccount: { igUserId: '7111', username: 'negocio' } }],
      });
    }
    if (ruta === '/ads/700/media') return json({ media: [{ type: 'video', url: 'https://video.fbcdn.test/700.mp4', videoId: '55', length: 30 }] });
    if (ruta === '/ads/701/media') return json({ media: [{ type: 'image', url: 'https://img.fbcdn.test/701.jpg' }] });
    // Los anuncios: el 800 es un post de la página 111 (la de la conexión), el 801 de la 333 (ajena), el 802 no trae post.
    const ad = /^\/ads\/(\d+)$/.exec(ruta)?.[1];
    if (ad === '800') return json({ ad: { name: 'Ganador propio', platformStatus: 'ACTIVE', creative: { effectiveObjectStoryId: '111_5' } } });
    if (ad === '801') return json({ ad: { name: 'Ganador ajeno', platformStatus: 'ACTIVE', creative: { effectiveObjectStoryId: '333_9' } } });
    if (ad === '802') return json({ ad: { name: 'Sin post', platformStatus: 'PAUSED', creative: {} } });
    // El 900 espera la aprobación manual (su revisión trae el 2446984); el 901 entrega; el 902 no existe.
    if (ad === '900') return json({ ad: { name: 'Esperando', platformAdAccountId: 'act_333', platformStatus: 'WITH_ISSUES', creative: null } });
    if (ruta === '/ads/900/review') return json({ review: { issues: [{ error_code: 2446984, mid: 'm-900' }] } });
    if (ad === '901') return json({ ad: { name: 'Entrega', platformAdAccountId: 'act_333', platformStatus: 'ACTIVE', creative: null } });
    return json({ error: `sin mock: ${ruta}` }, 404);
  }
  if (u.host === 'graph.facebook.com') {
    red.push(`graph ${u.pathname} token=${u.searchParams.get('access_token')}`);
    if (u.pathname.endsWith('/700')) return json({ creative: { video_id: '55' } });
    if (u.pathname.endsWith('/55')) return json({ embed_html: '<iframe src="https://www.facebook.com/plugins/video.php?href=x"></iframe>', permalink_url: '/negocio/videos/55/' });
    if (u.pathname.endsWith('/111')) return json({ instagram_business_account: { id: '7111' } });
    return json({ error: { message: 'graph de mentira' } });
  }
  red.push(`otro ${u.host}${u.pathname}`);
  return json({ error: 'red de mentira' }, 500);
}) as typeof fetch;

async function main() {
  const { cifrarSecreto } = await import('../lib/credenciales');
  const { runWithWorkspace } = await import('../lib/workspace');
  const { videoDeAnuncio } = await import('../lib/anuncio-video-leer');
  const M = await import('../lib/meta-ads-create');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 3, capa: 'cliente', nombre: 'Por Zernio' }, { id: 4, capa: 'cliente', nombre: 'Con respaldo' }, { id: 13, capa: 'cliente', nombre: 'Sólo token' });
  const cred = (ws: number, clave: string, valor: string, servicio: string) => pg.db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrarSecreto(valor, ws, clave), servicio });
  for (const ws of [3, 4]) {
    cred(ws, 'ZERNIO_API_KEY', `sk_zernio_ws${ws}`, 'zernio');
    cred(ws, 'META_ZERNIO_CUENTA', `zacc_${ws}`, 'zernio');
    cred(ws, 'META_AD_ACCOUNT_ID', 'act_333', 'meta');
    cred(ws, 'META_PAGE_ID', '111', 'meta');
  }
  cred(4, 'META_ACCESS_TOKEN', 'tok_ws4', 'meta');
  cred(13, 'META_ACCESS_TOKEN', 'tok_ws13', 'meta');
  cred(13, 'META_AD_ACCOUNT_ID', 'act_1313', 'meta');
  cred(13, 'META_PAGE_ID', '111', 'meta');

  const correr = async (ws: number, fn: () => Promise<unknown>) => {
    red = [];
    const r = await runWithWorkspace(ws, fn).then((v) => ({ ok: v }), (e) => ({ tira: e instanceof Error ? e.message : String(e) }));
    return { ...r, red };
  };
  const out: Record<string, unknown> = {};
  for (const ws of [3, 4, 13]) {
    out[`ws${ws}`] = {
      video: await correr(ws, () => videoDeAnuncio('700')),
      imagen: await correr(ws, () => videoDeAnuncio('701')),
      ig: await correr(ws, () => M.getInstagramActorId()),
      ganadores: await correr(ws, () => M.paginasDeGanadores(['800', '801', '802'])),
      aprobacion: await correr(ws, () => M.getAdsAprobacionPendiente(['900', '901', '902'])),
    };
  }
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
