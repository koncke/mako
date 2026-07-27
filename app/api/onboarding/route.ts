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
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getWorkspaceActual, getWorkspace, getRolWsEfectivo, OWNER_WS } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { setNumeroDuenoYSync } from '@/lib/mako-grupo';
import { SERVICIOS_METODO, servicioMetodo, ENVS_METODO } from '@/lib/metodo-catalogo';
import { credWs, estadoCampo, guardarCredencial, IdentificadorOcupadoError, integracionConectada } from '@/lib/credenciales';
import { verificarServicio } from '@/lib/metodo-verificar';
import { getSetting, setSetting } from '@/lib/settings';
import { saveFunnel } from '@/lib/leads';
import { FUNNEL_TEMPLATES } from '@/lib/pipeline';
import { seedNutricionTemplates } from '@/lib/nutricion-templates';
import { getContactoReportes, setContactoReportes } from '@/lib/perfil';
import { getAnswers, getSchema, saveAnswers } from '@/lib/onboarding';
import { PREGUNTAS, CANALES, type CanalId } from '@/lib/fase-diagnostico';
import { getDiagnosticoFase, setDiagnosticoFase } from '@/lib/fase-store';
import { getEstadoOnboarding, pasosDeCapaActual, patchEstadoOnboarding, type OnboardingState } from '@/lib/onboarding-state';

export const dynamic = 'force-dynamic';

// Servicios que el CLIENTE conecta en su wizard. Infra de la agencia (anthropic,
// openai, supabase, google) NO se le pide al cliente — es global.
// 'email' NO está: con la cuenta única de Resend (Opción A) el cliente no carga
// API key — verifica su dominio desde el mini-onboarding de la tab /email.
const SERVICIOS_CLIENTE = new Set(['meta', 'whatsapp', 'fathom', 'panda', 'youtube', 'calendly']);
// Qué integraciones son OBLIGATORIAS ya no es una constante: sale de la capa
// del cliente (lib/capas.ts → integracionesRequeridas). Una capa sin ads ni CRM
// no tiene nada que conectar.

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

async function serviciosParaWizard(requeridos: string[]) {
  const servicios = SERVICIOS_METODO.filter((s) => SERVICIOS_CLIENTE.has(s.key));
  return Promise.all(servicios.map(async (s) => ({
    key: s.key,
    nombre: s.nombre,
    categoria: s.categoria,
    paraQue: s.paraQue,
    requerido: requeridos.includes(s.key),
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
    const capa = capaDef(await getCapaActual());
    const [estado, servicios, contacto, schema, briefAnswers, metaPageId, ytVsl, ytThanks, ytPrep, pandaIds, objCierres, objCash] = await Promise.all([
      getEstadoOnboarding(),
      serviciosParaWizard(capa.integracionesRequeridas),
      getContactoReportes(),
      getSchema(),
      getAnswers(),
      getSetting('meta_page_id'),
      getSetting('youtube_vsl_video_id'),
      getSetting('youtube_thanks_video_id'),
      getSetting('youtube_thanks_prep_video_id'),
      getSetting('panda_vsl_video_ids'),
      getSetting('objetivo_cierres'),
      getSetting('objetivo_cash_usd'),
    ]);
    // El esquema es editable, así que se filtra por key de grupo (no por índice).
    const brief = capa.briefGrupos == null ? schema : schema.filter((g) => capa.briefGrupos!.includes(g.key));
    return NextResponse.json({
      ok: true,
      estado,
      servicios,
      // Los pasos y los servicios obligatorios salen de la CAPA, no de una
      // constante: un cliente de Project Manager no conecta nada, así que su
      // wizard no tiene ni paso de integraciones.
      pasos: capa.onboarding,
      capa: { id: capa.id, nombre: capa.nombre },
      requeridos: capa.integracionesRequeridas,
      // ¿Quien mira es el super-admin de la agencia (impersonando un cliente de
      // prueba)? El wizard le muestra atajos: saltar sin conectar, usar las
      // llaves de Mauricio para simular, y salir de la vista.
      esAdmin: Boolean(await getSesionAdmin()),
      // El brief se pregunta de a UNA por pantalla, así que viaja aplanado y ya
      // filtrado por la capa: el wizard no tiene que saber de grupos.
      brief: brief.flatMap((g) => g.fields.map((f) => ({
        key: f.key, label: f.label, type: f.type, placeholder: f.placeholder, grupo: g.label,
      }))),
      briefAnswers,
      // Diagnóstico de fase (el "Norte" del negocio): las 6 preguntas + el
      // resultado guardado, si el cliente ya lo respondió.
      fasePreguntas: PREGUNTAS,
      faseDiag: await getDiagnosticoFase(),
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
  brief?: Record<string, unknown>;
  faseRespuestas?: number[];
  canal?: string;
  geminiKey?: string;
  funnelTipos?: string[];
  step?: 'integraciones' | 'tabs' | 'negocio' | 'archivero' | 'fase' | 'gemini' | 'retro' | 'plan';
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

      // Token de Gemini (paso obligatorio del onboarding): la IA GRATIS que mueve El
      // Archivero y el resto de la IA del onboarding. Se verifica con un GET liviano
      // antes de guardarla (una key rota no sirve de nada más adelante).
      case 'gemini': {
        const key = typeof body.geminiKey === 'string' ? body.geminiKey.trim() : '';
        if (!key) return NextResponse.json({ ok: false, error: 'Pegá tu API key de Gemini.' }, { status: 400 });
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
          if (!r.ok) { const j = await r.json().catch(() => ({})); return NextResponse.json({ ok: false, error: `La key no funciona: ${j?.error?.message || `HTTP ${r.status}`}` }, { status: 400 }); }
        } catch (e) { return NextResponse.json({ ok: false, error: `No pude verificar la key: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 }); }
        const quien = (await getUsuarioActual())?.email || 'admin-cliente';
        await guardarCredencial(ws, 'GEMINI_API_KEY', key, 'gemini', quien);
        return NextResponse.json({ ok: true });
      }

      // Funnel SIMPLE del onboarding (#5): guardamos los tipos elegidos (multi) y
      // aplicamos un pipeline por default para que el CRM tenga etapas; el detalle
      // fino se ajusta después en Onboarding → Funnel.
      case 'funnel-simple': {
        const tipos = Array.isArray(body.funnelTipos) ? body.funnelTipos.filter((t): t is string => typeof t === 'string') : [];
        await setSetting('onboarding.funnel_tipos', JSON.stringify(tipos));
        const tpl = FUNNEL_TEMPLATES[0];
        if (tpl) {
          try { await saveFunnel(tpl.pipeline, []); } catch (e) { console.error('[onboarding] funnel default falló (no fatal):', e); }
          try { await seedNutricionTemplates(); } catch (e) { console.error('[onboarding] seed nutrición falló (no fatal):', e); }
        }
        return NextResponse.json({ ok: true });
      }

      // Brief del negocio: el wizard lo manda de a una respuesta por pantalla,
      // así que esto MERGEA sobre lo guardado en vez de pisar el objeto entero
      // (si pisara, volver Atrás y avanzar borraría lo ya contestado).
      case 'brief': {
        const patch = body.brief && typeof body.brief === 'object' ? body.brief : {};
        const limpio: Record<string, string> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (typeof v === 'string') limpio[k] = v.trim();
        }
        const previas = await getAnswers();
        await saveAnswers({ ...previas, ...limpio });
        return NextResponse.json({ ok: true });
      }

      // Diagnóstico de fase: guarda las 6 respuestas y devuelve el diagnóstico
      // recomputado en el server (no se confía del cliente).
      case 'fase': {
        const resp = Array.isArray(body.faseRespuestas) ? body.faseRespuestas.map((n) => Number(n) | 0) : [];
        if (resp.length !== PREGUNTAS.length) {
          return NextResponse.json({ ok: false, error: 'Faltan respuestas del diagnóstico.' }, { status: 400 });
        }
        const canal = CANALES.some((c) => c.id === body.canal) ? (body.canal as CanalId) : undefined;
        const diagnostico = await setDiagnosticoFase(resp, canal);
        // Pre-sembrar el canal como funnel: la fase va ANTES del paso "cómo vendés",
        // así ese paso ya llega marcado con el canal primario (el cliente puede sumar más).
        if (canal) { try { await setSetting('onboarding.funnel_tipos', JSON.stringify([canal])); } catch { /* no fatal */ } }
        return NextResponse.json({ ok: true, diagnostico });
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

      // Contacto de reportes (los crons de reportes necesitan destinatario). Este
      // teléfono ES el "número del dueño": al cargarlo, MaKo deja listo el grupo
      // "MaKo <> {cliente}" con ese número + bienvenida (best-effort, no bloquea).
      case 'contacto': {
        const c = body.contacto ?? {};
        const telefono = (c.telefono ?? '').trim();
        await setContactoReportes({
          nombre: (c.nombre ?? '').trim() || undefined,
          email: (c.email ?? '').trim() || undefined,
          telefono: telefono || undefined,
        });
        if (telefono) {
          try {
            const wsRow = await getWorkspace(ws);
            await setNumeroDuenoYSync(ws, telefono, wsRow?.nombre ?? 'tu negocio');
          } catch (e) {
            console.error('[onboarding] no se pudo sincronizar el grupo de MaKo (no fatal):', e);
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Avance del wizard: marcar paso, saltar todo, o completar.
      case 'paso': {
        const quien = (await getUsuarioActual())?.email || 'admin-cliente';
        // El onboarding se da por terminado al cerrar el ÚLTIMO paso DE SU CAPA,
        // no al cerrar 'retro'. Clavarlo a 'retro' dejaba a cualquier capa que no
        // termine ahí (ej. Project Manager, que cierra en 'plan') en in_progress
        // para siempre → guardOnboarding la rebotaba al wizard en loop.
        const pasos = await pasosDeCapaActual();
        const ultimo = pasos[pasos.length - 1];
        const estado: OnboardingState = await patchEstadoOnboarding((s) => {
          if (s.status === 'pending') { s.status = 'in_progress'; s.startedAt = s.startedAt ?? new Date().toISOString(); }
          if (body.skip) { s.status = 'skipped'; return; }
          if (body.step) {
            s.step = body.step;
            if (body.done) {
              s.steps[body.step].done = true;
              if (body.step === 'retro') {
                s.steps.retro.retroId = typeof body.retroId === 'number' ? body.retroId : s.steps.retro.retroId ?? null;
              }
              if (body.step === ultimo) {
                s.status = 'done';
                s.completedAt = new Date().toISOString();
                s.completedBy = quien;
              }
            }
          }
        });
        return NextResponse.json({ ok: true, estado });
      }

      // Simular: copiar las credenciales de Mauricio (ws1) al workspace de
      // prueba, para recorrer el onboarding con datos reales sin cargar una key.
      // SOLO super-admin de la agencia — un cliente no puede robarle las llaves
      // al dueño. Se salta las credenciales de ruteo (page id, event types): las
      // reclama ws1 y el reclamo ahora falla cerrado (tarea 162), así que
      // copiarlas tiraría; el sim no las necesita.
      case 'simular': {
        if (!(await getSesionAdmin())) {
          return NextResponse.json({ ok: false, error: 'Solo la agencia puede simular.' }, { status: 403 });
        }
        const quien = (await getUsuarioActual())?.email || 'simulacion';
        const conectados: string[] = [];
        for (const s of SERVICIOS_METODO) {
          if (!SERVICIOS_CLIENTE.has(s.key)) continue;
          let algo = false;
          for (const campo of s.campos) {
            const valor = await credWs(campo.env, OWNER_WS);
            if (!valor) continue;
            try {
              await guardarCredencial(ws, campo.env, valor, s.key, quien);
              algo = true;
            } catch (e) {
              // Credencial de ruteo ya reclamada por ws1 → se salta, no es fatal.
              if (!(e instanceof IdentificadorOcupadoError)) throw e;
            }
          }
          if (algo && (await integracionConectada(s.key))) conectados.push(s.key);
        }
        return NextResponse.json({ ok: true, conectados });
      }

      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
