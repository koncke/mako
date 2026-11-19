// =============================================================================
// recuperar-comentarios — los comentarios de Instagram que el webhook perdió, otra vez por el camino del webhook (ticket #114)
// =============================================================================
// Lo puro (qué se recupera, sin duplicar, los 7 días, los dudosos) vive en lib/recuperar-comentarios-reglas.ts, con test.
// Acá, lo que toca la red:
//   · LEER: la BANDEJA de Zernio (`/inbox/comments?accountId=…` y después `/inbox/comments/{postId}?accountId=…`), con cada
//     clave del negocio y cada cuenta de Instagram. No el historial de entregas del webhook (`/webhooks/logs`): no filtra por
//     fecha, va del más nuevo al más viejo, y con 46.377 entregas leídas no llegó al 14/11 (medido el 18/11).
//   · EJECUTAR: cada comentario se vuelve a pasar por el MISMO camino que el webhook (`eventoSocialDe` → `procesarEventoSocial`
//     → `dispararEventoSocial`), así que el motor manda el privado como respuesta a ESE comentario, dentro de sus 7 días, una
//     vez. Uno por vez y con una pausa: la respuesta privada usa el último comentario guardado de la persona.
// =============================================================================
import 'server-only';
import { clavesZernio, zFetch } from './zernio';
import { getTenantDb } from './workspace';
import { disparaPorEvento } from './disparadores';
import { planDeRecuperacion, type ComentarioLeido, type PlanRecuperacion, type ItemRecuperar, type SecuenciaDeComentario } from './recuperar-comentarios-reglas';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un GET a Zernio que espera y reintenta si Zernio corta por límite (429 «retry after N seconds»). */
async function zGet<T>(apiKey: string, ruta: string): Promise<T> {
  for (let intento = 1; ; intento++) {
    try { return await zFetch<T>(apiKey, ruta); } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const st = (e as { status?: number }).status;
      const seg = Number(/retry after (\d+)/i.exec(m)?.[1] ?? 0);
      if (st === 429 && intento <= 4) { await espera(Math.min((seg || 20) * 1000 + 500, 60_000)); continue; }
      throw e;
    }
  }
}

const fechaZernio = (s: unknown): number => Date.parse(String(s ?? '').replace(/\+0000$/, 'Z'));

/** Los comentarios de Instagram del negocio entre `desdeMs` y `hastaMs`, de todas sus claves y cuentas. */
export async function comentariosDelPeriodo(ws: number, desdeMs: number, hastaMs: number): Promise<ComentarioLeido[]> {
  const out: ComentarioLeido[] = [];
  for (const k of await clavesZernio(ws, { fresca: true })) {
    const cuentas = await zGet<{ accounts?: Array<{ _id: string; platform?: string }> }>(k.apiKey, '/accounts?platform=instagram');
    for (const a of (cuentas.accounts ?? []).filter((x) => x.platform === 'instagram')) {
      const posts: Array<{ id: string; createdTime?: string }> = [];
      let cursor: string | null = null;
      for (let pg = 0; pg < 5; pg++) {
        const r: { data?: Array<{ id: string; createdTime?: string }>; pagination?: { hasMore?: boolean; nextCursor?: string } } =
          await zGet(k.apiKey, `/inbox/comments?accountId=${encodeURIComponent(a._id)}&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        posts.push(...(r.data ?? []));
        cursor = r.pagination?.nextCursor ?? null;
        if (!r.pagination?.hasMore || !cursor) break;
      }
      for (const p of posts) {
        let cur: string | null = null;
        for (let pg = 0; pg < 5; pg++) {
          const r: { data?: Array<{ id: string; message?: string; createdTime?: string; from?: { id?: string; username?: string; isOwner?: boolean } }>; pagination?: { hasMore?: boolean; nextCursor?: string } } =
            await zGet(k.apiKey, `/inbox/comments/${encodeURIComponent(p.id)}?accountId=${encodeURIComponent(a._id)}&limit=100${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`);
          for (const c of r.data ?? []) {
            const t = fechaZernio(c.createdTime);
            if (!(t >= desdeMs && t <= hastaMs) || !c.id || !c.from?.id) continue;
            out.push({ comentarioId: c.id, texto: c.message ?? '', autorId: String(c.from.id), usuario: c.from.username ?? null, propio: c.from.isOwner === true, postId: p.id, cuentaId: a._id, atMs: t });
          }
          cur = r.pagination?.nextCursor ?? null;
          if (!r.pagination?.hasMore || !cur) break;
        }
      }
    }
  }
  return out;
}

/** El plan: qué comentario va a qué automatización de comentario del negocio, sin duplicar y salteando a quien ya la tiene. */
export async function planDelPeriodo(ws: number, desdeMs: number, hastaMs: number, ahoraMs = Date.now()): Promise<PlanRecuperacion> {
  const db = await getTenantDb();
  const s = await db.from('nutricion_secuencias').select('id, nombre, activa, archivada_at, disparadores').eq('workspace_id', ws).is('archivada_at', null);
  if (s.error) throw new Error(`nutricion_secuencias: ${s.error.message}`);
  type Fila = { id: number; nombre: string; activa: boolean; disparadores: Array<Record<string, unknown>> | null };
  const secuencias: SecuenciaDeComentario[] = ((s.data ?? []) as Fila[])
    .filter((f) => f.activa)
    .map((f) => ({ id: f.id, nombre: f.nombre, disparadores: (f.disparadores ?? []).filter((d) => d.trigger_tipo === 'instagram' && d.subtipo === 'comentario') }))
    .filter((f) => f.disparadores.length);
  const comentarios = await comentariosDelPeriodo(ws, desdeMs, hastaMs);
  const autores = [...new Set(comentarios.map((c) => c.autorId))];
  const conv = autores.length ? await db.from('ig_conversaciones').select('igsid, lead_id').eq('workspace_id', ws).in('igsid', autores) : { data: [], error: null };
  if (conv.error) throw new Error(`ig_conversaciones: ${conv.error.message}`);
  const leadDe = new Map<string, number>(((conv.data ?? []) as Array<{ igsid: string; lead_id: number | null }>).filter((c) => c.lead_id != null).map((c) => [String(c.igsid), Number(c.lead_id)]));
  const leads = [...new Set(leadDe.values())];
  const ins = leads.length ? await db.from('nutricion_inscripciones').select('lead_id, secuencia_id').in('lead_id', leads) : { data: [], error: null };
  if (ins.error) throw new Error(`nutricion_inscripciones: ${ins.error.message}`);
  const tiene = new Set(((ins.data ?? []) as Array<{ lead_id: number; secuencia_id: number }>).map((i) => `${i.lead_id}:${i.secuencia_id}`));
  return planDeRecuperacion(comentarios, secuencias, {
    ahoraMs,
    dispara: (d, texto, postId) => disparaPorEvento(d as Parameters<typeof disparaPorEvento>[0], 'instagram', { subtipo: 'comentario', texto, publicacion: postId }),
    yaLaTiene: (autorId, sec) => { const l = leadDe.get(autorId); return l != null && tiene.has(`${l}:${sec}`); },
  });
}

/** Vuelve a pasar UN comentario por el camino del webhook. Devuelve en cuántas automatizaciones entró. */
export async function recuperarComentario(it: ItemRecuperar): Promise<{ ok: boolean; automatizaciones: number; error?: string }> {
  const { eventoSocialDe } = await import('./canal-social');
  const { procesarEventoSocial, dispararEventoSocial } = await import('./zernio-entrante');
  const body = {
    event: 'comment.received',
    comment: { id: it.comentarioId, platformPostId: it.postId, platform: 'instagram', text: it.texto, author: { id: it.autorId, username: it.usuario, isOwnAccount: false }, createdAt: new Date(it.atMs).toISOString(), isReply: false },
    post: { platformPostId: it.postId },
    account: { id: it.cuentaId, accountId: it.cuentaId, platform: 'instagram' },
    recuperado: 'ticket-114',
  };
  const ev = eventoSocialDe(body);
  if ('ignorar' in ev) return { ok: false, automatizaciones: 0, error: ev.ignorar };
  const r = await procesarEventoSocial(ev.evento, body);
  if (r.leadId == null || !r.disparar) return { ok: false, automatizaciones: 0, error: 'no quedó un lead para disparar' };
  const n = await dispararEventoSocial(r.leadId, ev.evento.canal, ev.evento.subtipo, ev.evento.texto, ev.evento.postId);
  return { ok: true, automatizaciones: n };
}

/** Recupera la lista, de a uno y con pausa. Nunca tira: cada comentario dice cómo salió. */
export async function recuperarComentarios(items: readonly ItemRecuperar[], ahoraMs = Date.now()): Promise<Array<{ usuario: string | null; comentarioId: string; ok: boolean; automatizaciones: number; error?: string }>> {
  const out = [];
  for (const it of items) {
    if (ahoraMs >= it.venceMs) { out.push({ usuario: it.usuario, comentarioId: it.comentarioId, ok: false, automatizaciones: 0, error: 'pasaron los 7 días de Meta' }); continue; }
    try { out.push({ usuario: it.usuario, comentarioId: it.comentarioId, ...(await recuperarComentario(it)) }); }
    catch (e) { out.push({ usuario: it.usuario, comentarioId: it.comentarioId, ok: false, automatizaciones: 0, error: e instanceof Error ? e.message.slice(0, 200) : String(e) }); }
    await espera(1500);
  }
  return out;
}
