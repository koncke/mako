'use client';

// =============================================================================
// OnboardingWizard — el arranque de CUALQUIER cliente, sea la capa que sea
// =============================================================================
// Uno solo. El wizard de 4 pasos que existía antes murió: era otro lenguaje
// (cards colapsables, botón negro, todo junto en una pantalla) y no se parecía a
// nada del resto de la app.
//
// Ahora es UNA PREGUNTA POR PANTALLA sobre la misma tarjeta partida que el
// cliente va a volver a ver en /integraciones y en cada tab que le falte una
// conexión:
//   · IZQUIERDA (negra) — carrusel de marketing mientras no hay nada que mostrar;
//     apenas hay dato real (los facts del ping, o sus propias respuestas), el
//     carrusel se va y quedan LOS DATOS. La promesa se reemplaza por la prueba.
//   · DERECHA — la pregunta, sola.
//
// Las pantallas NO están clavadas: salen de la capa que compró el cliente
// (lib/capas.ts → onboarding). Un Project Manager no conecta nada, así que su
// wizard arranca directo en el brief; uno Completo empieza por Meta.
//
// El estado guarda TODOS los pasos posibles aunque la capa muestre unos pocos:
// así, si el cliente sube de capa, no vuelve a contestar lo que ya contestó.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Archivero } from './Archivero';
import { AvataresView } from './AvataresView';
import { EntregableView } from './EntregableView';
import { PersonaView } from './PersonaView';
import { MatrizView } from './MatrizView';
import { WizardShell, wizardInput } from '../_components/WizardShell';
import { BrandDefs } from '../_components/ServicioVisual';
import { PanelMarketing, type Fact } from '../_components/PanelMarketing';
import { GuardianIcon } from '../plan/board/GuardianIcon';
import { SLIDES, type Slide } from '@/lib/servicio-slides';
import { FASES, faseDef, diagnosticar, VOLUMEN_POR_CANAL, CANALES, type CanalId, type Diagnostico, type Pregunta } from '@/lib/fase-diagnostico';
import { FaseQuiz, FaseResultado, FaseIcono } from './FaseUI';
import ServicioConfigForm from '../integraciones/ServicioConfigForm';
import { RetroReport } from '../experimentos/RetroReport';
import type { RetroReporte, RetroPlanItem, RetroStreamEvent } from '@/lib/retro-reporte';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Tipos del API ─────────────────────────────────────────────────────────────
type Servicio = { key: string; nombre: string; requerido: boolean; conectada: boolean };
type JobState = { status: 'pending' | 'running' | 'done' | 'error' | 'skipped'; detail?: string | null; error?: string | null };
type Extraction = { status: 'idle' | 'running' | 'done' | 'error'; jobs: Record<string, JobState> };
type Paso = 'integraciones' | 'tabs' | 'negocio' | 'archivero' | 'entregable' | 'avatares' | 'persona' | 'angulos' | 'fase' | 'gemini' | 'retro' | 'plan';
// Funnel simple del onboarding (#5): 3 opciones, multi-select, poco texto. El detalle
// de etapas del CRM se ajusta después en Onboarding → Funnel.
const FUNNEL_OPS = [
  { id: 'llamadas', label: 'Agendar llamadas' },
  { id: 'carrito', label: 'Venta por carrito' },
  { id: 'webinar', label: 'Webinar' },
];
type BriefCampo = { key: string; label: string; type: 'text' | 'number' | 'textarea'; placeholder?: string; grupo: string };
type Estado = {
  status: 'pending' | 'in_progress' | 'skipped' | 'done';
  steps: Record<Paso, { done: boolean }>;
  extraction: Extraction;
};
type WizardData = {
  estado: Estado;
  servicios: Servicio[];
  requeridos: string[];
  pasos: Paso[];
  capa: { id: string; nombre: string };
  esAdmin?: boolean;
  geminiConfig?: { configurado: boolean; mask: string };
  brief: BriefCampo[];
  briefAnswers: Record<string, string>;
  fasePreguntas: Pregunta[];
  faseDiag: Diagnostico | null;
  settings: Record<string, string>;
  contacto: { nombre: string; email: string; telefono: string };
  usuario: { nombre: string; email: string };
  funnelTemplates: Array<{ id: string; name: string; description: string; etapas: string[] }>;
};
type RetroRow = { id: number; periodo_desde: string; periodo_hasta: string; reporte: RetroReporte | null };

const JOB_LABELS: Record<string, string> = {
  meta_metrics: 'Métricas de Meta',
  meta_leads: 'Leads de formularios',
  ad_transcripts: 'Transcripción de anuncios',
  script_analyses: 'Análisis de guiones',
  fathom_calls: 'Llamadas de venta',
  vsl_metrics: 'Métricas del VSL',
};

// Carrusel de las pantallas que NO son de un servicio (el brief, el funnel, el
// cierre). Misma regla dura que lib/servicio-slides.ts: solo lo que la app HACE.
const SLIDES_MAKO: Slide[] = [
  // lib/mako-context.ts — el perfil del negocio entra en cada respuesta
  { t: 'MaKo trabaja con TU negocio', d: 'Lo que contestás acá entra en cada análisis y cada respuesta: deja de darte consejos de manual y te habla de lo tuyo.' },
  // lib/mako-guardian.ts — puntúa 1-100 comparando contra todo el backlog
  { t: 'Prioriza y te lo discute', d: 'El Perro Guardián compara cada tarea contra todo el resto, le pone un puntaje con su razón, y si no estás de acuerdo se lo debatís.' },
  // lib/retro-pipeline.ts — 8 fases sobre todas las áreas conectadas
  { t: 'Una Retro que mira todo', d: 'Cruza ads, leads, llamadas y plata en un solo informe, y cuando aceptás una idea te la crea de verdad en tu plan.' },
];

const SLIDES_FUNNEL: Slide[] = [
  // lib/pipeline.ts FUNNEL_TEMPLATES + funnel_config por workspace
  { t: 'Tu proceso, no el nuestro', d: 'Elegís cómo vendés y el CRM, las métricas y los tableros se acomodan a tus etapas — no al revés.' },
  // lib/stage-requirements.ts — cada etapa exige sus datos
  { t: 'Cada etapa pide lo suyo', d: 'Movés un lead y el asistente te pide justo lo que falta para esa etapa: el closer, la grabación, el motivo o las cuotas.' },
];

async function post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    return await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Una pantalla del wizard. `paso` es el paso del ESTADO que cierra (varias
// pantallas pueden cerrar el mismo: las 3 del brief cierran 'negocio').
type Pantalla = {
  key: string;
  paso: Paso;
  pregunta: string;
  sub?: string;
  /** Slides del aside negro mientras no haya dato real. */
  slides: Slide[];
  /** Servicio (para el ícono del enlace MaKo⇄X y el nombre del eyebrow). */
  servicio?: string;
  nombre?: string;
  eyebrow?: string;
  /** Diagnóstico de fase: índice de pregunta (0-5), o -1 = pantalla de resultado. */
  faseQ?: number;
};

// =============================================================================
export function OnboardingWizard() {
  const [data, setData] = useState<WizardData | null>(null);
  const [errCarga, setErrCarga] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Respuestas en curso
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tpl, setTpl] = useState('highticket');
  const [cierres, setCierres] = useState('');
  const [cash, setCash] = useState('');
  const [geminiConectada, setGeminiConectada] = useState(false); // lo reporta ServicioConfigForm
  const [archiveroListo, setArchiveroListo] = useState(false); // ≥1 doc analizado (lo reporta Archivero)
  const [funnelTipos, setFunnelTipos] = useState<string[]>([]);
  const [contacto, setContacto] = useState({ nombre: '', email: '', telefono: '' });
  // Diagnóstico de fase: respuesta por pregunta (-1 = sin responder) + resultado.
  const [faseResp, setFaseResp] = useState<number[]>([]);
  const [faseDiag, setFaseDiag] = useState<Diagnostico | null>(null);
  // Canal de venta: adapta la pregunta de volumen (llamadas/carrito/webinar).
  const [canal, setCanal] = useState<CanalId>('llamadas');

  // Facts por servicio: lo que devolvió el ping al probar la credencial.
  const [facts, setFacts] = useState<Record<string, Fact[]>>({});
  const [conectadas, setConectadas] = useState<Record<string, boolean>>({});
  const [ext, setExt] = useState<Extraction | null>(null);
  const [retro, setRetro] = useState<RetroRow | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const tickeando = useRef(false);
  const retomado = useRef(false);
  // El Archivero registra acá su handler de "Siguiente": si faltan datos, abre las
  // preguntas en vez de avanzar (así completar lo pendiente no queda escondido).
  const archiveroRef = useRef<{ siguiente: () => boolean } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding')).json();
      if (!j.ok) { setErrCarga(j.error ?? 'No se pudo cargar el onboarding.'); return; }
      const d = j as unknown as WizardData;
      setData(d);
      setAnswers(d.briefAnswers ?? {});
      setTpl(d.funnelTemplates[0]?.id ?? 'highticket');
      setCierres(d.settings.objetivo_cierres ?? '');
      setCash(d.settings.objetivo_cash_usd ?? '');
      setContacto({
        nombre: d.contacto.nombre || d.usuario.nombre,
        email: d.contacto.email || d.usuario.email,
        telefono: d.contacto.telefono,
      });
      setExt(d.estado.extraction);
      setGeminiConectada(Boolean(d.geminiConfig?.configurado));
      setConectadas(Object.fromEntries(d.servicios.map((s) => [s.key, s.conectada])));
      setFaseDiag(d.faseDiag ?? null);
      setFaseResp(d.faseDiag?.respuestas ?? new Array(d.fasePreguntas?.length ?? 6).fill(-1));
      if (d.faseDiag?.canal) { setCanal(d.faseDiag.canal); setFunnelTipos((t) => (t.length ? t : [d.faseDiag!.canal!])); }
    } catch (e) {
      setErrCarga(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Retomar donde quedó: si el cliente ya cerró unos pasos (conectó Meta, cargó
  // el brief) y vuelve a entrar, arranca en el primer paso incompleto, no desde
  // cero. Corre una sola vez, cuando llegan los datos.
  useEffect(() => {
    if (!data || retomado.current) return;
    retomado.current = true;
    const cuenta = (paso: Paso): number =>
      paso === 'integraciones' ? data.requeridos.length
      : paso === 'tabs' ? 2
      : paso === 'negocio' ? data.brief.length
      : paso === 'fase' ? data.fasePreguntas.length + 1
      : 1;
    let acc = 0;
    for (const paso of data.pasos) {
      if (!data.estado.steps[paso]?.done) break;
      acc += cuenta(paso);
    }
    if (acc > 0) setIdx(acc);
  }, [data]);

  // ── Extracción: arranca al verificar Meta y sigue en background ────────────
  const loopTicks = useCallback(async () => {
    if (tickeando.current) return;
    tickeando.current = true;
    try {
      for (let i = 0; i < 200; i++) {
        const t0 = Date.now();
        const j = await post('/api/onboarding/extraccion', { action: 'tick' });
        if (!j.ok) break;
        const e = j.extraction as Extraction;
        setExt(e);
        if (e.status !== 'running') break;
        if (Date.now() - t0 < 5_000) await new Promise((r) => setTimeout(r, 15_000));
      }
    } finally { tickeando.current = false; }
  }, []);

  const arrancarExtraccion = useCallback(async () => {
    const j = await post('/api/onboarding/extraccion', { action: 'start' });
    if (j.ok) {
      setExt(j.extraction as Extraction);
      if ((j.extraction as Extraction).status === 'running') loopTicks();
    }
  }, [loopTicks]);

  useEffect(() => { if (data?.estado.extraction.status === 'running') loopTicks(); }, [data, loopTicks]);

  if (errCarga) return <Centro><span style={{ color: 'var(--bad)', fontWeight: 600 }}>{errCarga}</span></Centro>;
  if (!data) return <Centro><span style={{ fontFamily: MONO, color: 'var(--faint)' }}>Cargando tu onboarding…</span></Centro>;

  // ── Las pantallas salen de la CAPA ────────────────────────────────────────
  const pantallas: Pantalla[] = [];
  for (const paso of data.pasos) {
    if (paso === 'integraciones') {
      for (const key of data.requeridos) {
        const s = data.servicios.find((x) => x.key === key);
        if (!s) continue;
        pantallas.push({
          key: `int:${key}`, paso, servicio: key, nombre: s.nombre,
          pregunta: `Conectá ${s.nombre}`,
          slides: SLIDES[key] ?? SLIDES_MAKO,
        });
      }
    } else if (paso === 'tabs') {
      pantallas.push({ key: 'funnel', paso, pregunta: '¿Cómo vendés?', slides: SLIDES_FUNNEL });
      pantallas.push({ key: 'contacto', paso, pregunta: '¿A dónde te mando los reportes?', slides: SLIDES_MAKO });
    } else if (paso === 'negocio') {
      for (const c of data.brief) {
        pantallas.push({ key: `brief:${c.key}`, paso, pregunta: c.label, slides: SLIDES_MAKO });
      }
    } else if (paso === 'archivero') {
      pantallas.push({ key: 'archivero', paso, pregunta: 'El Archivero', slides: SLIDES_MAKO });
    } else if (paso === 'entregable') {
      pantallas.push({ key: 'entregable', paso, pregunta: 'Tu entregable tangible', slides: SLIDES_MAKO });
    } else if (paso === 'avatares') {
      pantallas.push({ key: 'avatares', paso, pregunta: 'Tus avatares', slides: SLIDES_MAKO });
    } else if (paso === 'persona') {
      pantallas.push({ key: 'persona', paso, pregunta: 'La cara de tu marca', slides: SLIDES_MAKO });
    } else if (paso === 'angulos') {
      pantallas.push({ key: 'angulos', paso, pregunta: 'Tu matriz de anuncios', slides: SLIDES_MAKO });
    } else if (paso === 'gemini') {
      pantallas.push({ key: 'gemini', paso, pregunta: 'Conecta la IA de MaKo', slides: SLIDES_MAKO });
    } else if (paso === 'fase') {
      // Una pantalla por pregunta + la del diagnóstico. Antes de la de VOLUMEN va una
      // pregunta propia de canal ("¿con cuál identificás tu funnel?"): define la métrica
      // de volumen y adapta su enunciado (llamadas/conversaciones/carrito/webinar).
      data.fasePreguntas.forEach((q, i) => {
        // faseQ:i para que la banda negra muestre el MISMO panel "Tu diagnóstico"
        // que el resto del quiz (si no, cae al carrusel de marketing genérico y
        // "cambia" lo que se ve por una sola pantalla, algo que Martín reportó).
        // esFaseQuiz de abajo excluye esta key a propósito: canal NO es una de las
        // fasePreguntas (no tiene FaseQuiz ni cuenta para puedeAvanzar por faseResp).
        if (q.id === 'volumen') pantallas.push({ key: 'fase:canal', paso, faseQ: i, pregunta: '¿Con cuál de estos identificas tu funnel?', slides: SLIDES_MAKO });
        pantallas.push({ key: `fase:${i}`, paso, faseQ: i, pregunta: q.id === 'volumen' ? VOLUMEN_POR_CANAL[canal].texto : q.texto, slides: SLIDES_MAKO });
      });
      pantallas.push({ key: 'fase:result', paso, faseQ: -1, pregunta: 'Tu diagnóstico', slides: SLIDES_MAKO });
    } else if (paso === 'retro') {
      pantallas.push({ key: 'retro', paso, pregunta: 'Tu primera Retro', slides: SLIDES['meta'] ?? SLIDES_MAKO, servicio: 'meta' });
    } else if (paso === 'plan') {
      pantallas.push({ key: 'plan', paso, pregunta: 'Tu plan lo cuida el Perro Guardián', slides: SLIDES_MAKO });
    }
  }

  const p = pantallas[Math.min(idx, pantallas.length - 1)];
  if (!p) return <Centro><span style={{ color: 'var(--dim)' }}>Tu arranque ya está completo.</span></Centro>;
  const enUltimo = idx === pantallas.length - 1;
  const home = data.pasos.includes('integraciones') ? '/general' : '/plan';

  // Reporte de Retro: se come la pantalla entera (es un informe, no una pregunta).
  if (retro?.reporte) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', overflowY: 'auto', fontFamily: SANS, padding: '28px 24px 60px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>Tu primera Retro</h2>
            <button style={btnPrimary} onClick={() => { window.location.href = home; }}>Ir a mi dashboard →</button>
          </div>
          <RetroReport reporte={retro.reporte} periodo={`${retro.periodo_desde} – ${retro.periodo_hasta}`} alcance="todo el negocio"
            busyPlanId={busyPlan}
            onPlan={async (item: RetroPlanItem, op, motivo) => {
              setBusyPlan(item.id);
              try {
                const j = await post('/api/retro', { action: 'plan', id: retro.id, itemId: item.id, op, motivo });
                if (j.ok && j.reporte) setRetro((r) => (r ? { ...r, reporte: j.reporte as RetroReporte } : r));
              } finally { setBusyPlan(null); }
            }} />
        </div>
      </div>
    );
  }

  // ── El aside negro: facts si hay, si no el carrusel ────────────────────────
  const factsDePantalla = (): Fact[] | undefined => {
    if (p.servicio && facts[p.servicio]?.length) return facts[p.servicio];
    // Las pantallas del brief muestran lo que ya sabe MaKo del negocio. El Archivero
    // NO alimenta el panel negro: su insight va en la parte blanca (pedido de Martín).
    if (p.paso === 'negocio' || p.paso === 'plan') {
      const f = data.brief.filter((c) => (answers[c.key] ?? '').trim()).map((c) => ({ k: c.label, v: answers[c.key] }));
      return f.length ? f.slice(0, 8) : undefined;
    }
    if (p.key === 'metas' || p.key === 'contacto') {
      const f: Fact[] = [];
      if (cierres.trim()) f.push({ k: 'Tu meta de cierres', v: cierres });
      if (cash.trim()) f.push({ k: 'Tu meta de cash', v: `USD ${cash}` });
      return f.length ? f : undefined;
    }
    return undefined;
  };

  const avanzar = async (guardar?: () => Promise<Record<string, unknown> | null>) => {
    setError(null);
    setPending(true);
    try {
      if (guardar) {
        const j = await guardar();
        if (j && j.ok === false) { setError(String(j.error ?? 'No se pudo guardar.')); return; }
      }
      // Cerrar el paso cuando esta es la última pantalla que le pertenece.
      const ultimaDelPaso = pantallas.filter((x) => x.paso === p.paso).slice(-1)[0]?.key === p.key;
      if (ultimaDelPaso) await post('/api/onboarding', { action: 'paso', step: p.paso, done: true });
      if (enUltimo) { window.location.href = home; return; }
      setIdx((i) => i + 1);
    } finally { setPending(false); }
  };

  const campoBrief = p.key.startsWith('brief:') ? data.brief.find((c) => c.key === p.key.slice(6)) : null;
  const servicioReq = p.servicio && data.requeridos.includes(p.servicio);
  const esFaseQuiz = p.faseQ != null && p.faseQ >= 0 && p.key !== 'fase:canal';
  // El super-admin (impersonando un cliente de prueba) puede adelantar sin
  // conectar: está recorriendo el flujo, no dando de alta un cliente real.
  const puedeAvanzar = servicioReq ? (Boolean(conectadas[p.servicio!]) || Boolean(data.esAdmin))
    : esFaseQuiz ? faseResp[p.faseQ!] >= 0
    // Gemini NO tiene excepción de admin (a diferencia de los demás): sin una key que
    // ande de verdad, Entregable/Avatares/Persona/Ángulos van a fallar con "no hay IA"
    // más adelante — mejor frenar acá, con el mensaje claro, que dejar pasar y que
    // truene 3 pantallas después.
    : p.key === 'gemini' ? geminiConectada
    : p.key === 'archivero' ? (archiveroListo || Boolean(data.esAdmin)) // ≥1 doc analizado
    : true;
  // Archivero sin documentos: el botón Siguiente ni aparece (no tiene sentido avanzar
  // sin cargar nada). El super-admin queda exento para poder recorrer el flujo.
  const hideSiguiente = p.key === 'archivero' && !archiveroListo && !data.esAdmin;

  // Guardar el diagnóstico (recomputado en el server) al terminar las 6 preguntas.
  const guardarFase = async () => {
    const local = diagnosticar(faseResp, canal);
    setFaseDiag(local); // instantáneo, para que el resultado aparezca al toque
    const j = await post('/api/onboarding', { action: 'fase', faseRespuestas: faseResp, canal });
    if (j.ok && j.diagnostico) setFaseDiag(j.diagnostico as Diagnostico);
    setFunnelTipos((t) => (t.length ? t : [canal])); // el canal pre-marca "cómo vendés"
    return j;
  };

  // Simular con las llaves de Mauricio: copia sus credenciales al workspace de
  // prueba y arranca la extracción, para ver el WOW real (los facts, el histórico)
  // sin tener que pegar una key. Solo super-admin.
  const simular = async () => {
    setPending(true);
    try {
      const j = await post('/api/onboarding', { action: 'simular' });
      if (!j.ok) { setError(String(j.error ?? 'No se pudo simular.')); return; }
      const con = (j.conectados as string[]) ?? [];
      setConectadas((c) => ({ ...c, ...Object.fromEntries(con.map((k) => [k, true])) }));
      if (con.includes('meta')) arrancarExtraccion();
      await cargar(); // refresca facts/estado de servicios
    } finally { setPending(false); }
  };

  return (
    <>
      <BrandDefs />
      <WizardShell
        fullscreen
        bloqueante
        titulo={data.capa.nombre}
        total={data.pasos.length}
        idx={Math.max(0, data.pasos.indexOf(p.paso))}
        pregunta={p.pregunta}
        sub={p.sub}
        error={error}
        puedeAvanzar={puedeAvanzar}
        enUltimo={enUltimo}
        confirmLabel={data.pasos.includes('plan') ? 'Crear mi primer proyecto →' : 'Ir a mi dashboard →'}
        siguienteLabel={p.key === 'retro' ? 'Seguir sin Retro →' : p.faseQ === data.fasePreguntas.length - 1 ? 'Ver mi diagnóstico →' : 'Siguiente →'}
        hideSiguiente={hideSiguiente}
        pending={pending}
        atrasLabel="Atrás"
        hideAtras={idx === 0}
        onAtras={() => setIdx((i) => Math.max(0, i - 1))}
        onSiguiente={() => {
          if (campoBrief) return avanzar(() => post('/api/onboarding', { action: 'brief', brief: { [campoBrief.key]: answers[campoBrief.key] ?? '' } }));
          // Archivero: si le faltan datos, su "Siguiente" abre las preguntas (consumido)
          // en vez de avanzar a la próxima sección; si no, avanzamos normal.
          if (p.key === 'archivero') { if (archiveroRef.current?.siguiente()) return; return avanzar(); }
          // Pasos self-contained (Entregable, Avatares, Persona, Matriz, Gemini):
          // persisten por su cuenta con sus propios endpoints; acá solo avanzamos.
          if (['entregable', 'avatares', 'persona', 'angulos', 'gemini'].includes(p.key)) return avanzar();
          if (p.key === 'funnel') return avanzar(() => post('/api/onboarding', { action: 'funnel-simple', funnelTipos }));
          if (p.key === 'contacto') return avanzar(() => post('/api/onboarding', { action: 'contacto', contacto }));
          // Última pregunta del diagnóstico: persistir antes de mostrar el resultado.
          if (esFaseQuiz && p.faseQ === data.fasePreguntas.length - 1) return avanzar(guardarFase);
          return avanzar();
        }}
        onConfirmar={() => avanzar()}
        onClose={() => { /* bloqueante */ }}
        adminBar={data.esAdmin ? (
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 8px 8px 16px' }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5C4A17' }}>
              Modo agencia · estás viendo el onboarding de {data.capa.nombre}
            </span>
            {p.servicio && servicioReq && !conectadas[p.servicio] && (
              <button type="button" onClick={simular} disabled={pending}
                style={{ marginLeft: 'auto', padding: '7px 13px', borderRadius: 9, border: 'none', background: '#171511', color: '#F3F0E7', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                ✦ Usar las llaves de Mauricio
              </button>
            )}
            <button type="button" onClick={async () => { await fetch('/api/admin/impersonate', { method: 'DELETE' }); window.location.href = '/admin'; }}
              style={{ marginLeft: p.servicio && servicioReq && !conectadas[p.servicio] ? 0 : 'auto', padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
              Salir de la vista
            </button>
          </div>
        ) : undefined}
        escenario={
          p.faseQ != null ? (
            <FasePanel modo={p.faseQ >= 0 ? 'quiz' : 'result'} qIdx={p.faseQ} total={data.fasePreguntas.length} diag={faseDiag} />
          ) : (
            <PanelMarketing
              servicioKey={p.servicio ?? 'landing'}
              nombre={p.nombre ?? 'MaKo'}
              slides={p.slides}
              facts={factsDePantalla()}
              eyebrow={p.eyebrow ?? (p.servicio ? `✦ Con ${p.nombre} conectado` : '✦ Así trabaja MaKo')}
            />
          )
        }
      >
        {/* ── Servicio: el mismo form de /integraciones, sin reinventar nada ── */}
        {p.servicio && servicioReq && (
          <div style={{ textAlign: 'left' }}>
            <ServicioConfigForm
              servicioKey={p.servicio}
              onFacts={(f) => setFacts((x) => ({ ...x, [p.servicio!]: f }))}
              onEstado={(ok) => {
                setConectadas((c) => ({ ...c, [p.servicio!]: ok }));
                if (ok && p.servicio === 'meta') arrancarExtraccion();
              }}
            />
            {!conectadas[p.servicio] && (
              <div style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 12 }}>Conectala para seguir.</div>
            )}
          </div>
        )}

        {/* ── El Archivero: tirá tus docs, MaKo arma el perfil (self-contained) ── */}
        {p.key === 'archivero' && <Archivero onEstado={setAnswers} onListo={setArchiveroListo} registro={archiveroRef} />}

        {/* ── Entregable tangible de la oferta (self-contained) ── */}
        {p.key === 'entregable' && <EntregableView />}

        {/* ── Avatares: MaKo propone 3 subnichos desde el brief (self-contained) ── */}
        {p.key === 'avatares' && <AvataresView />}

        {/* ── Persona: la cara de marca (fotos + descripción), self-contained ── */}
        {p.key === 'persona' && <PersonaView />}

        {/* ── La matriz de anuncios (avatar × razón), self-contained ── */}
        {p.key === 'angulos' && <MatrizView />}

        {/* ── Brief: una pregunta, un campo ── */}
        {campoBrief && (campoBrief.type === 'textarea'
          ? <textarea style={{ ...wizardInput, textAlign: 'left', minHeight: 104, resize: 'vertical', lineHeight: 1.55, paddingTop: 12 }}
              value={answers[campoBrief.key] ?? ''} placeholder={campoBrief.placeholder} autoFocus
              onChange={(e) => setAnswers((a) => ({ ...a, [campoBrief.key]: e.target.value }))} />
          : <input style={wizardInput} value={answers[campoBrief.key] ?? ''} placeholder={campoBrief.placeholder} autoFocus
              onChange={(e) => setAnswers((a) => ({ ...a, [campoBrief.key]: e.target.value }))} />)}

        {/* ── Funnel: 3 opciones, multi-select, poco texto (#5) ── */}
        {p.key === 'funnel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FUNNEL_OPS.map((o) => {
              const on = funnelTipos.includes(o.id);
              return (
                <button key={o.id} type="button" onClick={() => setFunnelTipos((s) => (on ? s.filter((x) => x !== o.id) : [...s, o.id]))}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: SANS, padding: '14px 16px', borderRadius: 12, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flex: 'none', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{on ? '✓' : ''}</span>
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Gemini: la MISMA credencial de /integraciones (ojito · probar · eliminar) ── */}
        {p.key === 'gemini' && (
          <div style={{ textAlign: 'left' }}>
            <ServicioConfigForm servicioKey="gemini" onEstado={setGeminiConectada} />
            {geminiConectada ? (
              // Confirmación clara de que quedó cargada y funciona.
              <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--good-bg)', border: '1px solid var(--good)', borderRadius: 12, padding: '12px 14px' }}>
                <span style={{ color: 'var(--good)', fontSize: 16, flex: 'none', marginTop: 1 }}>✓</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Tu IA quedó conectada y funcionando</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>MaKo ya puede leer tus documentos, armar tu perfil y hacer todo el análisis del onboarding.</div>
                </div>
              </div>
            ) : (
              // ¿Por qué la necesito? — contextualiza (es gratis). Desaparece al conectar.
              <div style={{ marginTop: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>¿Por qué debes colocar tu API de Gemini?</div>
                <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>Es la IA de Google —<b style={{ color: 'var(--ink)' }}>gratis</b>— que mueve todo tu onboarding: lee los documentos que subes, arma tu perfil, propone tus avatares y escribe tus anuncios. La sacas en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>aistudio.google.com/apikey</a> en un minuto; sin ella, MaKo no puede analizar nada de tu negocio.</div>
              </div>
            )}
          </div>
        )}

        {/* ── Contacto ── */}
        {p.key === 'contacto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><Label>Nombre</Label><input style={wizardInput} value={contacto.nombre} onChange={(e) => setContacto((c) => ({ ...c, nombre: e.target.value }))} /></div>
            <div><Label>Email</Label><input style={wizardInput} type="email" value={contacto.email} onChange={(e) => setContacto((c) => ({ ...c, email: e.target.value }))} /></div>
            <div><Label>WhatsApp</Label><input style={wizardInput} value={contacto.telefono} onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value }))} placeholder="+52 1 686…" /></div>
          </div>
        )}

        {/* ── Canal / funnel: su propia pregunta; define y adapta la de volumen ── */}
        {p.key === 'fase:canal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {CANALES.map((c) => {
              const on = canal === c.id;
              return (
                <button key={c.id} type="button" onClick={() => setCanal(c.id)}
                  style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, padding: '13px 15px', borderRadius: 12, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <span style={{ flex: 'none', width: 16, height: 16, borderRadius: '50%', marginTop: 2, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{c.label}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{c.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Diagnóstico de fase: quiz (una pregunta, 5 opciones) ── */}
        {esFaseQuiz && (() => {
          const q = data.fasePreguntas[p.faseQ!];
          const esVolumen = q.id === 'volumen';
          return (
            <FaseQuiz
              emoji={q.emoji}
              opciones={esVolumen ? VOLUMEN_POR_CANAL[canal].opciones : q.opciones}
              value={faseResp[p.faseQ!]}
              onPick={(i) => setFaseResp((r) => { const c = [...r]; c[p.faseQ!] = i; return c; })}
            />
          );
        })()}
        {p.key === 'fase:result' && faseDiag && <FaseResultado diag={faseDiag} />}

        {/* ── Retro ── */}
        {p.key === 'retro' && <PantallaRetro ext={ext} onListo={setRetro} />}

        {/* ── Cierre del Guardián ── */}
        {p.key === 'plan' && <CierreGuardian />}
      </WizardShell>
    </>
  );
}

// =============================================================================
function PantallaRetro({ ext, onListo }: { ext: Extraction | null; onListo: (r: RetroRow) => void }) {
  const [gen, setGen] = useState(false);
  const [pasos, setPasos] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const listo = ext?.jobs?.meta_metrics?.status === 'done';
  const corriendo = ext?.status === 'running';

  const generar = async () => {
    setGen(true); setErr(null); setPasos([]);
    try {
      const res = await fetch('/api/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', historico: true }) });
      if (!res.ok || !res.body) { setErr(`No se pudo generar (${res.status}).`); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          let ev: RetroStreamEvent;
          try { ev = JSON.parse(line) as RetroStreamEvent; } catch { continue; }
          if (ev.t === 'step') setPasos((l) => [...l.slice(-6), ev.label]);
          else if (ev.t === 'done') {
            const r = ev.retro as unknown as RetroRow;
            await post('/api/onboarding', { action: 'paso', step: 'retro', done: true, retroId: r?.id ?? null });
            if (r?.reporte) onListo(r);
          } else if (ev.t === 'error') setErr(ev.error);
        }
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setGen(false); }
  };

  return (
    <div>
      {corriendo && !listo && (
        <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.55 }}>
          Todavía estoy leyendo tu histórico (lo ves al costado). Cuando terminen las métricas de Meta, la Retro se habilita.
        </p>
      )}
      {gen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, textAlign: 'left' }}>
          {pasos.map((s, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 11.5, color: i === pasos.length - 1 ? 'var(--ink)' : 'var(--faint)' }}>· {s}</div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>Tarda unos minutos: estoy leyendo TODO tu histórico.</div>
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>{err}</div>}
      <button style={{ ...btnPrimary, opacity: gen || !listo ? 0.4 : 1 }} disabled={gen || !listo} onClick={generar}>
        {gen ? 'Generando…' : '✦ Generar mi primera Retro'}
      </button>
    </div>
  );
}

// CanalSelector, FaseQuiz y FaseResultado se movieron a ./FaseUI (compartidos con
// la tab "Diagnóstico" del hub). Acá queda solo FasePanel, que es del wizard.

// El aside negro del diagnóstico: durante el quiz muestra la escalera de fases;
// en el resultado, la fase diagnosticada grande.
function FasePanel({ modo, qIdx, total, diag }: { modo: 'quiz' | 'result'; qIdx: number; total: number; diag: Diagnostico | null }) {
  if (modo === 'result' && diag) {
    const f = faseDef(diag.fase);
    return (
      <div className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 26, minWidth: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 16 }}>✦ Tu diagnóstico</div>
        <div style={{ color: f.color, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><FaseIcono id={f.id} size={46} /></div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', color: 'var(--sidebar-text)' }}>FASE {f.id}</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--on-sidebar)', margin: '2px 0 2px' }}>{f.nombre}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-sidebar)', opacity: 0.85 }}>{f.subtitulo}</div>
      </div>
    );
  }
  return (
    <div className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', padding: 26, minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>✦ Tu diagnóstico</div>
      <div style={{ fontSize: 13, color: 'var(--sidebar-text)', lineHeight: 1.55, marginBottom: 18 }}>
        Seis preguntas rápidas sobre tu situación real. Al final sé en qué fase estás y qué tienes que priorizar — todos los negocios comparten los mismos problemas según su etapa.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FASES.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i === Math.min(qIdx, 4) ? 1 : 0.45 }}>
            <span style={{ flex: 'none', color: f.color, display: 'inline-flex' }}><FaseIcono id={f.id} size={18} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-sidebar)' }}>Fase {f.id} · {f.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--sidebar-text)' }}>Cuello: {f.cuelloLabel}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 16, fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{qIdx + 1} / {total}</div>
    </div>
  );
}

function CierreGuardian() {
  const puntos: Array<[string, string]> = [
    ['Vos cargás, él prioriza', 'Compara cada tarea contra todo el resto y le pone un puntaje con su razón.'],
    ['Un solo objetivo a la vez', 'El proyecto más importante manda. Los demás no se cuelan en Alta salvo una emergencia real.'],
    ['Te lo discute', 'Si creés que se equivocó, se lo debatís. Te va a pedir argumentos — y tiene la última palabra.'],
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><GuardianIcon size={60} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left' }}>
        {puntos.map(([t, d]) => (
          <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--good)', fontSize: 15, lineHeight: 1.4, flex: 'none' }}>✓</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t}</div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnPrimary: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };

const Label = ({ children }: { children: ReactNode }) => (
  <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 5, display: 'block', textAlign: 'left' }}>{children}</label>
);

const Centro = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 14 }}>{children}</div>
);

export { JOB_LABELS };
