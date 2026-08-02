// =============================================================================
// API: secuencias de setting (tab /setting)
// =============================================================================
// GET  → { secuencias, rolAdmin, objetivos, etapas, leadMagnets } — admin y setter
//        del workspace (setter solo lectura; el POST se lo niega).
// POST → admin-only:
//        { action:'crear', etapa, nombre }                → secuencia nueva (wizard paso 1)
//        { action:'sugerir-gancho'|'sugerir-preguntas', objetivo, etapa } → { sugerencias }
//        { action:'guardar-estrategia', secuenciaId, estrategia }         → { ok }
//        { action:'probar', secuenciaId }                 → prueba en vivo al admin
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import {
  getSettingData, guardarEstrategia, crearSecuenciaDesdeEtapa, probarSecuencia,
  muestraParaCriterio, muestraATexto,
  SETTING_GANCHO_TEMPLATE, SETTING_PREGUNTAS_TEMPLATE, SETTING_CRITERIO_TEMPLATE,
} from '@/lib/setting-secuencias';
import { parseEstrategia, parseCriterio, OBJETIVOS } from '@/lib/setting-estrategia';
import { chatCheap } from '@/lib/ai-cheap';
import { chatClaude } from '@/lib/anthropic';
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
    // Admin de agencia sin impersonar: no hay workspace del que leer secuencias.
    return Response.json({ ok: false, error: 'Entrá al workspace de un cliente (impersonando) para ver su Setting.' }, { status: 400 });
  }
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) {
    return Response.json({ ok: false, error: 'Sin acceso a Setting en este workspace.' }, { status: 403 });
  }
  try {
    const [{ secuencias, serie }, funnel, leadMagnets, wsRow] = await Promise.all([
      getSettingData(),
      getFunnel().catch(() => null),
      getEntregables().catch(() => []),
      getWorkspace(ws).catch(() => null),
    ]);
    // Etapas elegibles para colgar una secuencia de mensajes: nutrición + pipeline (sin salidas).
    const etapas = (funnel?.stages ?? [])
      .filter((s) => (s.band ?? 'pipeline') !== 'salidas')
      .map((s) => ({ value: s.key, label: s.label }));
    return Response.json({
      ok: true, secuencias, serie, rolAdmin: rol === 'admin', objetivos: OBJETIVOS, etapas,
      leadMagnets: leadMagnets.map((l) => ({ id: l.id, nombre: l.nombre })),
      negocio: wsRow?.nombre ?? '',
    });
  } catch (e) {
    console.error(`[api:setting/secuencias GET] ${msg(e)}`);
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
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede editar secuencias.' }, { status: 403 });
  }
  let body: { action?: string; secuenciaId?: unknown; estrategia?: unknown; objetivo?: unknown; etapa?: unknown; nombre?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'crear') {
      const etapa = String(body.etapa ?? '').trim();
      const nombre = String(body.nombre ?? '').trim();
      if (!etapa || !nombre) return Response.json({ ok: false, error: 'Faltan la etapa y el nombre de la secuencia de mensajes.' }, { status: 400 });
      const id = await crearSecuenciaDesdeEtapa(etapa, nombre);
      return Response.json({ ok: true, secuenciaId: id });
    }
    if (body.action === 'sugerir-criterio') {
      // MaKo deduce el criterio de calificación de los leads YA evaluados del
      // CRM (respuestas del formulario + calificado + cierres). Propuesta para
      // que el dueño corrija, no verdad revelada.
      const filas = await muestraParaCriterio();
      const perfil = await perfilNegocioTexto().catch(() => '');
      const user = await renderPrompt('setting.criterio', SETTING_CRITERIO_TEMPLATE, {
        perfil: perfil || '(sin perfil cargado)',
        datos: muestraATexto(filas),
      });
      // Deducir un patrón de datos reales es ANÁLISIS → Claude, no la IA barata
      // (Groq tampoco valida este JSON). Parseo tolerante: si viene con prosa
      // alrededor, igual rescatamos el objeto.
      const raw = await chatClaude(
        'Sos MaKo. Devolvés EXCLUSIVAMENTE un objeto JSON {"califica":[...],"descalifica":[...]} con strings en español. Sin markdown ni texto alrededor.',
        [{ role: 'user', content: user }],
        { effort: 'medium', maxTokens: 900, feature: 'setting-criterio' },
      );
      let criterio = { califica: [] as string[], descalifica: [] as string[] };
      try {
        const limpio = raw.replace(/```(?:json)?/gi, '').trim();
        const ini = limpio.indexOf('{');
        const fin = limpio.lastIndexOf('}');
        if (ini >= 0 && fin > ini) criterio = parseCriterio(JSON.parse(limpio.slice(ini, fin + 1)));
      } catch { /* sin criterio: la UI lo dice */ }
      return Response.json({ ok: true, criterio, muestra: filas.length });
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
    console.error(`[api:setting/secuencias POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
