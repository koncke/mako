// =============================================================================
// /api/crm/etiquetas — las etiquetas del CRM para las pantallas (mig 0224)
// =============================================================================
// GET                     → { ok, etiquetas: [{ id, nombre, color, emoji, funnel_id, etapa_key,
//                              wa_instance, wa_label_id, orden, archivada_at }] }
//     ?archivadas=1       → también las archivadas
//     ?leadId=N           → + delLead: las que tiene ese lead (con puesta_at y puesta_por)
//     ?crud=1             → + leads (cuántos tiene cada una), whatsapp (las del celular para
//                              mapear) y productos (con sus etapas, para vincular)
//     ?uso=ID             → { ok, uso }: quién apunta a esa etiqueta, antes de archivarla
// POST { action, … }
//     'crear'      { nombre, color?, emoji?, vinculo?: { funnelId, etapaKey } | null, waLabelId? } → { ok, etiqueta, aviso }
//     'editar'     { id, nombre?, color?, emoji?, vinculo?, waLabelId? }                      → { ok, etiqueta }
//     'archivar'   { id, archivar? }                                                          → { ok, etiqueta, uso }
//     'poner'      { leadId, etiquetaId }                                                     → { ok, yaEstaba, movio, sync }
//     'sacar'      { leadId, etiquetaId }                                                     → { ok, yaEstaba, sync }
//     'poner_lote' { leadIds, etiquetaId }                                                    → { ok, cambiados, yaEstaban, sinSincronizar }
//     'sacar_lote' { leadIds, etiquetaId }  (el Deshacer del lote)
//
// El contrato mínimo que usa el lienzo de /chatbot (parte L): GET {etiquetas} y
// POST {action:'crear', nombre, color?} → {etiqueta}. Ver docs/chatbot-flujo-ramas-diseno.md §3.
//
// ⚠️ EL CRUD ES DEL ADMIN; poner y sacar, de cualquiera con sesión en el CRM (como el resto de
// las escrituras de la ficha). El server lo decide: esconder el botón no protege nada.
//
// ⚠️ LA SESIÓN SE CHEQUEA ACÁ y no sólo en el gate de proxy.ts: sin AUTH_SECRET el gate queda
// inactivo (local) y `getWorkspaceActual()` sin cookie cae al ws 1, que es un cliente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { listarFunnels } from '@/lib/funnels';
import { etapasDeProducto } from '@/lib/lead-funnel';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import {
  listarEtiquetas, etiquetasDeLead, conteoPorEtiqueta, catalogoWhatsApp, usoDeEtiqueta,
  crearEtiqueta, editarEtiqueta, archivarEtiqueta, ponerEtiqueta, sacarEtiqueta,
  ponerEtiquetaLote, sacarEtiquetaLote, esEtiquetaError, type EntradaEtiqueta,
} from '@/lib/etiquetas';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const malo = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
const idOk = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
/** El tope de un lote, el mismo de las otras acciones en lote del CRM (app/crm/actions.ts). */
const TOPE_LOTE = 200;

async function sesion(): Promise<{ ws: number } | Response> {
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return malo('No autorizado', 401);
  return { ws };
}

const fallo = (e: unknown, donde: string) => {
  if (esEtiquetaError(e)) return malo(e.message);
  console.error(`[api:crm/etiquetas ${donde}] ${msg(e)}`);
  return malo(msg(e), 500);
};

export async function GET(req: NextRequest) {
  const s = await sesion();
  if (s instanceof Response) return s;
  const q = req.nextUrl.searchParams;
  try {
    const uso = Number(q.get('uso'));
    if (Number.isInteger(uso) && uso > 0) return Response.json({ ok: true, uso: await usoDeEtiqueta(uso) });

    const etiquetas = await listarEtiquetas({ incluirArchivadas: q.get('archivadas') === '1' });
    const out: Record<string, unknown> = { ok: true, etiquetas };
    const leadId = Number(q.get('leadId'));
    if (Number.isInteger(leadId) && leadId > 0) out.delLead = await etiquetasDeLead(leadId);
    if (q.get('crud') === '1') {
      const [conteo, whatsapp, funnels] = await Promise.all([
        conteoPorEtiqueta().then((m) => Object.fromEntries(m)).catch(() => null),
        // Sin WhatsApp no oficial conectado la lista viene vacía: el CRUD lo dice en una línea.
        catalogoWhatsApp().catch(() => []),
        listarFunnels(),
      ]);
      out.leads = conteo;
      out.whatsapp = whatsapp;
      out.productos = await Promise.all(funnels.map(async (f) => ({
        id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault,
        etapas: (await etapasDeProducto(f.id)).map((e) => ({ key: e.key, label: e.label, dot: e.dot ?? null })),
      })));
    }
    return Response.json(out);
  } catch (e) {
    return fallo(e, 'GET');
  }
}

type Cuerpo = {
  action?: unknown; id?: unknown; leadId?: unknown; leadIds?: unknown; etiquetaId?: unknown; archivar?: unknown;
  nombre?: unknown; color?: unknown; emoji?: unknown; vinculo?: unknown; waLabelId?: unknown;
};

/** El vínculo tal como viene del navegador: `null` lo saca, `undefined` no lo toca. */
function vinculoDe(v: unknown): EntradaEtiqueta['vinculo'] {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const o = v as { funnelId?: unknown; etapaKey?: unknown };
  const etapaKey = typeof o?.etapaKey === 'string' ? o.etapaKey : '';
  if (!etapaKey.trim()) return null;
  const f = Number(o.funnelId);
  return { funnelId: o.funnelId == null || !Number.isInteger(f) || f <= 0 ? null : f, etapaKey };
}

function entradaDe(b: Cuerpo): EntradaEtiqueta {
  const e: EntradaEtiqueta = {};
  if (b.nombre !== undefined) e.nombre = b.nombre;
  if (b.color !== undefined) e.color = b.color;
  if (b.emoji !== undefined) e.emoji = b.emoji;
  if (b.vinculo !== undefined) e.vinculo = vinculoDe(b.vinculo);
  if (b.waLabelId !== undefined) e.waLabelId = typeof b.waLabelId === 'string' && b.waLabelId.trim() ? b.waLabelId.trim() : null;
  return e;
}

export async function POST(req: NextRequest) {
  const s = await sesion();
  if (s instanceof Response) return s;
  let b: Cuerpo;
  try { b = await req.json(); } catch { return malo('body inválido'); }
  const action = typeof b.action === 'string' ? b.action : '';

  // ── El CRUD: sólo el admin del workspace ──
  if (action === 'crear' || action === 'editar' || action === 'archivar') {
    if ((await getRolWsEfectivo()) !== 'admin') return malo('Solo el admin edita las etiquetas.', 403);
    try {
      if (action === 'crear') {
        const r = await crearEtiqueta(entradaDe(b));
        return Response.json({ ok: true, etiqueta: r.etiqueta });
      }
      const id = idOk(b.id);
      if (id == null) return malo('Falta el id de la etiqueta.');
      if (action === 'editar') return Response.json({ ok: true, etiqueta: await editarEtiqueta(id, entradaDe(b)) });
      const r = await archivarEtiqueta(id, b.archivar !== false);
      return Response.json({ ok: true, etiqueta: r.etiqueta, uso: r.uso });
    } catch (e) {
      return fallo(e, action);
    }
  }

  // ── Poner y sacar: cualquiera del CRM ──
  const etiquetaId = idOk(b.etiquetaId);
  if (etiquetaId == null) return malo('Falta la etiqueta.');
  try {
    if (action === 'poner' || action === 'sacar') {
      const leadId = idOk(b.leadId);
      if (leadId == null) return malo('Falta el lead.');
      const r = action === 'poner' ? await ponerEtiqueta(leadId, etiquetaId) : await sacarEtiqueta(leadId, etiquetaId);
      if (!r.ok) return malo(r.error);
      return Response.json({ ...r, ok: true });
    }
    if (action === 'poner_lote' || action === 'sacar_lote') {
      const ids = Array.isArray(b.leadIds) ? [...new Set(b.leadIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
      if (!ids.length) return malo('No hay leads.');
      if (ids.length > TOPE_LOTE) return malo(`Hasta ${TOPE_LOTE} leads por vez.`);
      const r = action === 'poner_lote' ? await ponerEtiquetaLote(ids, etiquetaId) : await sacarEtiquetaLote(ids, etiquetaId);
      if (!r.ok) return malo(r.error);
      return Response.json({ ...r, ok: true });
    }
    return malo('Acción desconocida.');
  } catch (e) {
    return fallo(e, action);
  }
}
