// =============================================================================
// API: jugadas de setting (tab /setting)
// =============================================================================
// GET  → { jugadas, rolAdmin, objetivos, etapas, leadMagnets } — admin y setter
//        del workspace (setter solo lectura; el POST se lo niega).
// POST → admin-only:
//        { action:'crear', etapa, nombre }                → secuencia nueva (wizard paso 1)
//        { action:'sugerir-gancho'|'sugerir-preguntas', objetivo, etapa } → { sugerencias }
//        { action:'guardar-estrategia', secuenciaId, estrategia }         → { ok }
//        { action:'probar', secuenciaId }                 → prueba en vivo al admin
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import {
  getJugadas, guardarEstrategia, crearSecuenciaJugada, probarSecuencia,
  SETTING_GANCHO_TEMPLATE, SETTING_PREGUNTAS_TEMPLATE,
} from '@/lib/setting-jugadas';
import { parseEstrategia, OBJETIVOS } from '@/lib/setting-estrategia';
import { chatCheap } from '@/lib/ai-cheap';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getFunnel } from '@/lib/leads';
import { getEntregables } from '@/lib/entregable';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null && rol === 'admin') {
    // Admin de agencia sin impersonar: no hay workspace del que leer jugadas.
    return Response.json({ ok: false, error: 'Entrá al workspace de un cliente (impersonando) para ver su Setting.' }, { status: 400 });
  }
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) {
    return Response.json({ ok: false, error: 'Sin acceso a Setting en este workspace.' }, { status: 403 });
  }
  try {
    const [jugadas, funnel, leadMagnets] = await Promise.all([
      getJugadas(),
      getFunnel().catch(() => null),
      getEntregables().catch(() => []),
    ]);
    // Etapas elegibles para colgar una jugada: nutrición + pipeline (sin salidas).
    const etapas = (funnel?.stages ?? [])
      .filter((s) => (s.band ?? 'pipeline') !== 'salidas')
      .map((s) => ({ value: s.key, label: s.label }));
    return Response.json({
      ok: true, jugadas, rolAdmin: rol === 'admin', objetivos: OBJETIVOS, etapas,
      leadMagnets: leadMagnets.map((l) => ({ id: l.id, nombre: l.nombre })),
    });
  } catch (e) {
    console.error(`[api:setting/jugadas GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

async function sugerir(template: string, key: string, objetivo: string, etapa: string): Promise<string[]> {
  const perfil = await perfilNegocioTexto().catch(() => '');
  const user = await renderPrompt(key, template, {
    objetivo: objetivo || '(sin objetivo)', etapa: etapa || '(sin etapa)', perfil: perfil || '(sin perfil cargado)',
  });
  const raw = await chatCheap({
    system: 'Sos MaKo. Devolvé EXCLUSIVAMENTE un objeto JSON {"sugerencias": [...strings]} en el español neutro del negocio. Sin markdown ni texto alrededor.',
    user, json: true, feature: 'setting-sugerencias', maxTokens: 600,
  });
  try {
    const o = JSON.parse(raw.replace(/```(?:json)?/gi, '').trim()) as { sugerencias?: unknown };
    const arr = Array.isArray(o?.sugerencias) ? o.sugerencias : (Array.isArray(o) ? (o as unknown[]) : []);
    return arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 5);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede editar jugadas.' }, { status: 403 });
  }
  let body: { action?: string; secuenciaId?: unknown; estrategia?: unknown; objetivo?: unknown; etapa?: unknown; nombre?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'crear') {
      const etapa = String(body.etapa ?? '').trim();
      const nombre = String(body.nombre ?? '').trim();
      if (!etapa || !nombre) return Response.json({ ok: false, error: 'Faltan la etapa y el nombre de la jugada.' }, { status: 400 });
      const id = await crearSecuenciaJugada(etapa, nombre);
      return Response.json({ ok: true, secuenciaId: id });
    }
    if (body.action === 'sugerir-gancho' || body.action === 'sugerir-preguntas') {
      const [tpl, key] = body.action === 'sugerir-gancho'
        ? [SETTING_GANCHO_TEMPLATE, 'setting.gancho']
        : [SETTING_PREGUNTAS_TEMPLATE, 'setting.preguntas'];
      const sugerencias = await sugerir(tpl, key, String(body.objetivo ?? ''), String(body.etapa ?? ''));
      return Response.json({ ok: true, sugerencias });
    }
    if (body.action === 'guardar-estrategia') {
      const id = Number(body.secuenciaId);
      const est = parseEstrategia(body.estrategia);
      if (!Number.isFinite(id) || !est) return Response.json({ ok: false, error: 'estrategia inválida' }, { status: 400 });
      await guardarEstrategia(id, est);
      return Response.json({ ok: true });
    }
    if (body.action === 'probar') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      const r = await probarSecuencia(id);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, enviadosWa: r.enviadosWa, enviadosEmail: r.enviadosEmail, avisos: r.avisos });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:setting/jugadas POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
