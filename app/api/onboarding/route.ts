// =============================================================================
// /api/onboarding — backend del wizard del cliente nuevo
// =============================================================================
// A diferencia de /api/metodo (solo super admin), esta ruta la usa el ADMIN DEL
// CLIENTE para configurar SU propio workspace (guard por rol_ws, no por rol de
// app). Reusa las mismas libs (catálogo, credenciales, verificación, funnel).
//
// GET  → estado del wizard + servicios (campos con estado) + settings + templates.
// POST → { action: 'guardar' | 'verificar' | 'config' | 'funnel' | 'objetivos'
//        | 'contacto' | 'paso' , ... }.

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo, OWNER_WS } from '@/lib/workspace';
import { SERVICIOS_METODO, servicioMetodo, ENVS_METODO } from '@/lib/metodo-catalogo';
import { estadoCampo, guardarCredencial, integracionConectada } from '@/lib/credenciales';
import { verificarServicio } from '@/lib/metodo-verificar';
import { getSetting, setSetting } from '@/lib/settings';
import { saveFunnel } from '@/lib/leads';
import { FUNNEL_TEMPLATES } from '@/lib/pipeline';
import { seedNutricionTemplates } from '@/lib/nutricion-templates';
import { getContactoReportes, setContactoReportes } from '@/lib/perfil';
import { getEstadoOnboarding, patchEstadoOnboarding, type OnboardingState } from '@/lib/onboarding-state';

export const dynamic = 'force-dynamic';

// Servicios que el CLIENTE conecta en su wizard. Infra de la agencia (anthropic,
// openai, supabase, google, telegram) NO se le pide al cliente — es global.
// 'email' NO está: con la cuenta única de Resend (Opción A) el cliente no carga
// API key — verifica su dominio desde el mini-onboarding de la tab /email.
const SERVICIOS_CLIENTE = new Set(['meta', 'whatsapp', 'fathom', 'panda', 'youtube', 'calendly']);
/** Core del cliente: sin esto el dashboard no tiene datos → obligatorios. */
const SERVICIOS_REQUERIDOS = ['meta', 'whatsapp'];

// Settings no-secretas que el wizard puede setear (whitelist).
const SETTINGS_WIZARD = new Set([
  'meta_page_id',
  'youtube_vsl_video_id', 'youtube_thanks_video_id', 'youtube_thanks_prep_video_id',
  'panda_vsl_video_ids',
  'objetivo_cierres', 'objetivo_cash_usd',
]);

async function guard(): Promise<{ ws: number } | { error: NextResponse }> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return { error: NextResponse.json({ ok: false, error: 'Solo el admin del cliente puede hacer el onboarding.' }, { status: 403 }) };
  }
  if (ws === OWNER_WS) {
    return { error: NextResponse.json({ ok: false, error: 'El workspace principal no tiene onboarding.' }, { status: 400 }) };
  }
  return { ws };
}

async function serviciosParaWizard() {
  const servicios = SERVICIOS_METODO.filter((s) => SERVICIOS_CLIENTE.has(s.key));
  return Promise.all(servicios.map(async (s) => ({
    key: s.key,
    nombre: s.nombre,
    categoria: s.categoria,
    paraQue: s.paraQue,
    requerido: SERVICIOS_REQUERIDOS.includes(s.key),
    conectada: await integracionConectada(s.key),
    tutorial: s.tutorial,
    campos: await Promise.all(s.campos.map(async (c) => {
      const est = await estadoCampo(c.env);
      return { env: c.env, label: c.label, placeholder: c.placeholder, secreto: c.secreto ?? false, opcional: c.opcional ?? false, nota: c.nota, configurado: est.configurado, mask: est.mask };
    })),
  })));
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  try {
    const sesion = await getUsuarioActual();
    const [estado, servicios, contacto, metaPageId, ytVsl, ytThanks, ytPrep, pandaIds, objCierres, objCash] = await Promise.all([
      getEstadoOnboarding(),
      serviciosParaWizard(),
      getContactoReportes(),
      getSetting('meta_page_id'),
      getSetting('youtube_vsl_video_id'),
      getSetting('youtube_thanks_video_id'),
      getSetting('youtube_thanks_prep_video_id'),
      getSetting('panda_vsl_video_ids'),
      getSetting('objetivo_cierres'),
      getSetting('objetivo_cash_usd'),
    ]);
    return NextResponse.json({
      ok: true,
      estado,
      servicios,
      requeridos: SERVICIOS_REQUERIDOS,
      settings: {
        meta_page_id: metaPageId ?? '',
        youtube_vsl_video_id: ytVsl ?? '',
        youtube_thanks_video_id: ytThanks ?? '',
        youtube_thanks_prep_video_id: ytPrep ?? '',
        panda_vsl_video_ids: pandaIds ?? '',
        objetivo_cierres: objCierres ?? '',
        objetivo_cash_usd: objCash ?? '',
      },
      contacto,
      usuario: { nombre: sesion?.nombre ?? '', email: sesion?.email ?? '' },
      funnelTemplates: FUNNEL_TEMPLATES.map((t) => ({
        id: t.id, name: t.name, description: t.description,
        etapas: t.pipeline.map((s) => s.label ?? s.key),
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = {
  action?: string;
  servicio?: string;
  valores?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  templateId?: string;
  contacto?: { nombre?: string; email?: string; telefono?: string };
  step?: 'integraciones' | 'tabs' | 'negocio' | 'retro';
  done?: boolean;
  retroId?: number | null;
  skip?: boolean;
};

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { ws } = g;

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    switch (body.action) {
      // Guardar credenciales de UN servicio (solo campos del catálogo).
      case 'guardar': {
        const servicio = servicioMetodo(body.servicio ?? '');
        if (!servicio || !SERVICIOS_CLIENTE.has(servicio.key)) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
        const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
        const quien = (await getUsuarioActual())?.email || 'admin-cliente';
        let guardados = 0;
        for (const campo of servicio.campos) {
          const v = valores[campo.env];
          if (typeof v !== 'string' || !v.trim() || !ENVS_METODO.has(campo.env)) continue;
          await guardarCredencial(ws, campo.env, v.trim(), servicio.key, quien);
          guardados++;
        }
        return NextResponse.json({ ok: true, guardados, conectada: await integracionConectada(servicio.key) });
      }

      // Probar conexión (valores enviados pisan a los guardados).
      case 'verificar': {
        const resultado = await verificarServicio(body.servicio ?? '', body.valores ?? {});
        return NextResponse.json(resultado);
      }

      // Settings no-secretas (page id, ids de video, objetivos).
      case 'config': {
        const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
        let seteadas = 0;
        for (const [k, v] of Object.entries(settings)) {
          if (!SETTINGS_WIZARD.has(k) || typeof v !== 'string') continue;
          await setSetting(k, v.trim());
          seteadas++;
        }
        return NextResponse.json({ ok: true, seteadas });
      }

      // Funnel desde plantilla (fuente de verdad de las tabs).
      case 'funnel': {
        const tpl = FUNNEL_TEMPLATES.find((t) => t.id === body.templateId);
        if (!tpl) return NextResponse.json({ ok: false, error: 'plantilla inválida' }, { status: 400 });
        await saveFunnel(tpl.pipeline, []);
        // Red de seguridad: dejar la nutrición seedeada (idempotente) por si el
        // alta no la creó. No pisa lo que el cliente ya tenga.
        try { await seedNutricionTemplates(); } catch (e) { console.error('[onboarding] seed nutrición falló (no fatal):', e); }
        return NextResponse.json({ ok: true });
      }

      // Contacto de reportes (los crons de reportes necesitan destinatario).
      case 'contacto': {
        const c = body.contacto ?? {};
        await setContactoReportes({
          nombre: (c.nombre ?? '').trim() || undefined,
          email: (c.email ?? '').trim() || undefined,
          telefono: (c.telefono ?? '').trim() || undefined,
        });
        return NextResponse.json({ ok: true });
      }

      // Avance del wizard: marcar paso, saltar todo, o completar.
      case 'paso': {
        const quien = (await getUsuarioActual())?.email || 'admin-cliente';
        const estado: OnboardingState = await patchEstadoOnboarding((s) => {
          if (s.status === 'pending') { s.status = 'in_progress'; s.startedAt = s.startedAt ?? new Date().toISOString(); }
          if (body.skip) { s.status = 'skipped'; return; }
          if (body.step) {
            s.step = body.step;
            if (body.done) {
              s.steps[body.step].done = true;
              if (body.step === 'retro') {
                s.steps.retro.retroId = typeof body.retroId === 'number' ? body.retroId : s.steps.retro.retroId ?? null;
                s.status = 'done';
                s.completedAt = new Date().toISOString();
                s.completedBy = quien;
              }
            }
          }
        });
        return NextResponse.json({ ok: true, estado });
      }

      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
