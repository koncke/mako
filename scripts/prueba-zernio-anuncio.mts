// =============================================================================
// LA PRUEBA QUE DECIDE si se publica por Zernio (23/10/2026)
// =============================================================================
// Pregunta: un anuncio con creativo NUEVO, creado por Zernio en una cuenta de AFUERA (cuyo dueño no tiene
// rol en la app de Meta de Zernio, «Social Media Connector» 712341431446535), ¿pasa? ¿Y qué app firma el
// post que nace? Si pasa y lo firma Zernio, su app opera cuentas ajenas con creativos nuevos.
//
// ⚠️ LO QUE ESTA PRUEBA NO DEMUESTRA: la cuenta elegida por Martín es la del ws1 (Mauricio), cuya app propia
// está PUBLICADA (ahí publicar ya anda 5 de 5). Así que dice si la app de Zernio puede operar una cuenta de
// afuera, no que se salte el 1885183 de una app EN DESARROLLO: eso sólo se ve con Joan (ws13).
//
// ⚠️ TIENE QUE SER UN ALTA REAL, EN PAUSA DE PUNTA A PUNTA: el `validate_only` de Meta NO ve el 1885183
// (medido el 11/09 en ws13). Clave de Zernio de la PLATAFORMA: es una prueba de MaKo, no una operación del
// cliente (OK de Martín por el Cerebro, 23/10). Meta se lee y se BORRA con el token del negocio dueño de la
// cuenta (`--ws`). No toca nada que ya exista en la cuenta: sólo los ids que crea, guardados en ESTADO.
//
// Pasos (NO se corren sin el OK; la conexión la hace Martín en Facebook, botón por botón):
//   node --import tsx scripts/prueba-zernio-anuncio.mts estado      --ws 1 --cuenta act_564003520636790
//   node --import tsx scripts/prueba-zernio-anuncio.mts crear --si  --ws 1 --cuenta act_564003520636790 --pagina 282881742134130
//   node --import tsx scripts/prueba-zernio-anuncio.mts editar --si --ws 1
//   node --import tsx scripts/prueba-zernio-anuncio.mts borrar --si --ws 1
//   node --import tsx scripts/prueba-zernio-anuncio.mts desconectar --si
// (con NODE_OPTIONS="--conditions=react-server", desde el clon que tiene .env.local)
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

config({ path: resolve(process.cwd(), '.env.local') });

const NOMBRE = 'PRUEBA MaKo · Zernio · no activar';
const ESTADO = 'C:/dev/cerebro-herramientas/prueba-zernio-estado.json';
const ZB = 'https://zernio.com/api/v1';
const GRAPH = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v24.0'}`;

const arg = (n: string): string | null => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] ?? null : null; };
const paso = process.argv[2];
const si = process.argv.includes('--si');

const { envCred, credWs } = await import('../lib/credenciales');
const { subcodeDeZernio, idsDelAnuncioCreado } = await import('../lib/zernio-ads-cuerpo');
const clave = await envCred('ZERNIO_API_KEY');
if (!clave) throw new Error('Sin la clave de Zernio de la plataforma');

type Estado = { ws: number; cuenta: string; zernioAccountId: string; campaign?: string; adset?: string; ad?: string; zernioAdId?: string | null; creativos: string[]; posts: string[] };
const leerEstado = (): Estado => JSON.parse(readFileSync(ESTADO, 'utf8')) as Estado;
const guardar = (e: Estado) => writeFileSync(ESTADO, JSON.stringify(e, null, 2));

async function z(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const r = await fetch(ZB + path, { ...init, headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }, signal: AbortSignal.timeout(120_000) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function meta(ws: number, path: string, params: Record<string, string> = {}, method = 'GET', tokenClave = 'META_ACCESS_TOKEN'): Promise<any> {
  const t = await credWs(tokenClave, ws);
  const u = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', t ?? '');
  return fetch(u, { method }).then((r) => r.json()).catch((e) => ({ error: { message: String(e) } }));
}

/** La conexión metaads (con la clave de la plataforma) que administra la cuenta. */
async function conexion(cuenta: string): Promise<{ id: string; info: any } | null> {
  const a = await z('/accounts');
  for (const c of (a.body?.accounts ?? []).filter((x: any) => x.platform === 'metaads')) {
    const l = await z(`/ads/accounts?accountId=${c._id}&adAccountId=${cuenta}`);
    const info = (l.body?.accounts ?? []).find((x: any) => x.id === cuenta);
    if (info) return { id: c._id, info };
  }
  return null;
}

/** Qué app firmó el post de un anuncio, leído en Meta. */
async function appDelPost(ws: number, adId: string): Promise<{ creativo: string | null; post: string | null; app: string }> {
  const ad = await meta(ws, adId, { fields: 'creative{id,effective_object_story_id,object_story_id}' });
  const creativo = ad?.creative?.id ?? null;
  const post = ad?.creative?.effective_object_story_id ?? ad?.creative?.object_story_id ?? null;
  if (!post) return { creativo, post, app: `sin post (${JSON.stringify(ad?.error ?? ad).slice(0, 200)})` };
  const p = await meta(ws, post, { fields: 'application{id,name},is_published' }, 'GET', 'META_PAGE_ACCESS_TOKEN');
  const app = p?.application ? `${p.application.name} (${p.application.id})` : `no lo dice (${JSON.stringify(p?.error ?? p).slice(0, 200)})`;
  return { creativo, post, app };
}

if (paso === 'estado') {
  const cuenta = arg('cuenta'); if (!cuenta) throw new Error('--cuenta');
  const c = await conexion(cuenta);
  console.log(c ? `Conectada en Zernio: ${c.id} → ${cuenta} · moneda ${c.info.currency} · mínimo diario ${c.info.minimumDailyBudget} · facturación ${c.info.billingStatus} · seleccionable ${c.info.selectable}${c.info.unusableReason ? ' · ' + c.info.unusableReason : ''}` : 'Sin conexión de anuncios que vea esa cuenta (falta el OAuth de Facebook).');
} else if (paso === 'crear' && si) {
  const ws = Number(arg('ws')); const cuenta = arg('cuenta'); const pagina = arg('pagina');
  if (!ws || !cuenta || !pagina) throw new Error('--ws --cuenta --pagina');
  if (existsSync(ESTADO)) throw new Error(`Ya hay una prueba en ${ESTADO}: borrala antes de crear otra.`);
  const c = await conexion(cuenta); if (!c) throw new Error('Sin conexión de anuncios');
  const presupuesto = Math.max(1, Math.ceil(Number(c.info.minimumDailyBudget) || 1));
  const r = await z('/ads/create', {
    method: 'POST',
    headers: { 'Idempotency-Key': `mako-prueba-zernio-${cuenta}-${new Date().toISOString().slice(0, 10)}` },
    body: JSON.stringify({
      accountId: c.id, adAccountId: cuenta, name: NOMBRE, campaignName: NOMBRE, adSetName: NOMBRE,
      goal: 'traffic', status: 'PAUSED', campaignStatus: 'PAUSED', adSetStatus: 'PAUSED', adStatus: 'PAUSED',
      budgetAmount: presupuesto, budgetType: 'daily', countries: ['MX'],
      headline: 'MaKo', body: 'Prueba de publicación por Zernio (en pausa, no se entrega).',
      callToAction: 'LEARN_MORE', linkUrl: 'https://hola-mako.com/', imageUrl: 'https://hola-mako.com/og-mako.jpg', pageId: pagina,
    }),
  });
  if (r.status >= 400 || r.body?.success === false) {
    const sub = subcodeDeZernio(r.body);
    console.log(`NO PASÓ (HTTP ${r.status}, subcode de Meta ${sub ?? '—'}).`, JSON.stringify(r.body, null, 2).slice(0, 2500));
    // Lo que Zernio alcanzó a crear, para borrarlo igual.
    const creados = r.body?.details?.createdObjects;
    if (creados) console.log('Creado a medias (BORRAR):', JSON.stringify(creados));
  } else {
    const { adId, zernioId } = idsDelAnuncioCreado(r.body);
    const ad = await meta(ws, adId, { fields: 'campaign_id,adset_id,effective_status,configured_status' });
    const e: Estado = { ws, cuenta, zernioAccountId: c.id, ad: adId, zernioAdId: zernioId, campaign: ad.campaign_id, adset: ad.adset_id, creativos: [], posts: [] };
    const firma = await appDelPost(ws, adId);
    if (firma.creativo) e.creativos.push(firma.creativo);
    if (firma.post) e.posts.push(firma.post);
    guardar(e);
    console.log(`PASÓ: campaña ${e.campaign} · conjunto ${e.adset} · anuncio ${adId} (${ad.configured_status}/${ad.effective_status}) · presupuesto ${presupuesto} ${c.info.currency}/día`);
    console.log(`El post ${firma.post} lo firma: ${firma.app}`);
  }
} else if (paso === 'editar' && si) {
  const e = leerEstado();
  const r = await z(`/ads/${e.ad}`, { method: 'PUT', body: JSON.stringify({ creative: { body: 'Prueba EDITADA por Zernio (en pausa, no se entrega).' } }) });
  if (r.status >= 400 || r.body?.success === false) {
    console.log(`EDITAR NO PASÓ (HTTP ${r.status}, subcode ${subcodeDeZernio(r.body) ?? '—'}).`, JSON.stringify(r.body, null, 2).slice(0, 2000));
  } else {
    const firma = await appDelPost(e.ws, e.ad!);
    if (firma.creativo && !e.creativos.includes(firma.creativo)) e.creativos.push(firma.creativo);
    if (firma.post && !e.posts.includes(firma.post)) e.posts.push(firma.post);
    guardar(e);
    console.log(`EDITAR PASÓ: creativo ahora ${firma.creativo}, post ${firma.post}, lo firma ${firma.app}`);
  }
} else if (paso === 'borrar' && si) {
  const e = leerEstado();
  const res: string[] = [];
  // La campaña arrastra conjunto y anuncio; creativos y posts van aparte.
  for (const id of [e.campaign, ...e.creativos].filter(Boolean) as string[]) res.push(`${id}: ${JSON.stringify(await meta(e.ws, id, {}, 'DELETE'))}`);
  for (const p of e.posts) res.push(`post ${p}: ${JSON.stringify(await meta(e.ws, p, {}, 'DELETE', 'META_PAGE_ACCESS_TOKEN'))}`);
  console.log(res.join('\n'));
  console.log('Confirmación en Meta:');
  for (const id of [e.campaign, e.adset, e.ad, ...e.creativos].filter(Boolean) as string[]) {
    const g = await meta(e.ws, id, { fields: 'id,effective_status,status' });
    console.log(`  ${id}: ${g.error ? `no está (${g.error.code})` : `${g.effective_status ?? g.status ?? 'existe'}`}`);
  }
  for (const p of e.posts) { const g = await meta(e.ws, p, { fields: 'id' }, 'GET', 'META_PAGE_ACCESS_TOKEN'); console.log(`  post ${p}: ${g.error ? `no está (${g.error.code})` : 'SIGUE'}`); }
} else if (paso === 'desconectar' && si) {
  const e = existsSync(ESTADO) ? leerEstado() : null;
  const id = e?.zernioAccountId ?? arg('cuenta-zernio');
  if (!id) throw new Error('--cuenta-zernio');
  const r = await z(`/accounts/${id}`, { method: 'DELETE' });
  const a = await z('/accounts');
  console.log(`DELETE /accounts/${id}: HTTP ${r.status}. Quedan metaads: ${(a.body?.accounts ?? []).filter((x: any) => x.platform === 'metaads').length}`);
} else {
  console.log('Uso: estado | crear --si | editar --si | borrar --si | desconectar --si   (ver la cabecera)');
}
