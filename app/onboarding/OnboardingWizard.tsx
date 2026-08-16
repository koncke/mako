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
import { ProductosView } from './ProductosView';
import { PersonaView } from './PersonaView';
import { PersonalidadView } from './PersonalidadView';
import { MatrizView } from './MatrizView';
import { WizardShell, wizardInput } from '../_components/WizardShell';
import { PanelAgencia } from '../_components/PanelAgencia';
import { BrandDefs } from '../_components/ServicioVisual';
import { PanelMarketing, type Fact } from '../_components/PanelMarketing';
import { GuardianIcon } from '../plan/board/GuardianIcon';
import { SLIDES, type Slide } from '@/lib/servicio-slides';
import { FASES, faseDef, diagnosticar, VOLUMEN_POR_CANAL, CANALES, type CanalId, type Diagnostico, type Pregunta } from '@/lib/fase-diagnostico';
import { FaseQuiz, FaseResultado, FaseIcono } from './FaseUI';
import ServicioConfigForm from '../integraciones/ServicioConfigForm';
import { RetroReport } from '../experimentos/RetroReport';
import type { RetroReporte, RetroPlanItem, RetroStreamEvent } from '@/lib/retro-reporte';
import { Dropdown } from '../components/Dropdown';
import { PAISES, PAIS_DEFAULT, flagUrl } from '@/lib/paises';
import { esPostergable, type PasoOnboarding } from '@/lib/capas';
import { Bienvenida } from './Bienvenida';
import type { Cerebro } from '@/lib/cerebro-modelo';
import type { OnboardingStatus, PasoState } from '@/lib/onboarding-contrato';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Tipos del API ─────────────────────────────────────────────────────────────
type Servicio = { key: string; nombre: string; requerido: boolean; conectada: boolean };
type JobState = { status: 'pending' | 'running' | 'done' | 'error' | 'skipped'; detail?: string | null; error?: string | null };
type Extraction = { status: 'idle' | 'running' | 'done' | 'error'; jobs: Record<string, JobState> };
// El union sale del catálogo (lib/capas.ts, datos puros sin server-only), no se
// recopia acá: era una de las cuatro listas paralelas que dejaron nacer roto el
// paso `productos`.
type Paso = PasoOnboarding;
type BriefCampo = { key: string; label: string; type: 'text' | 'number' | 'textarea'; placeholder?: string; grupo: string };
// El estado de cada paso sale del CONTRATO, no se recopia acá. Ya se pagó una vez que
// esta forma viviera en cuatro lugares (el paso `productos` nació roto por eso), y esta
// copia se acababa de desfasar otra vez: `postergado` existía en el server, en la base
// y en el endpoint, y acá el paso seguía siendo `{ done: boolean }` — o sea, la
// pantalla que tiene que reaccionar al dato era la única que no sabía que existía.
// `onboarding-contrato.ts` no lleva 'server-only' justamente para poder importarse acá.
type Estado = {
  status: OnboardingStatus;
  steps: Record<Paso, PasoState>;
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
  contacto: { nombre: string; email: string; telefono: string; verificado: boolean };
  usuario: { nombre: string; email: string };
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

// Separa un teléfono guardado (lada+número concatenados, sin separador) en sus
// dos partes para hidratar el selector de país + el input del resto. Heurística:
// la lada más LARGA que matchea primero (evita que "+1" gane sobre "+1809").
function splitTelefono(telefono: string): { lada: string; resto: string } {
  const t = (telefono || '').trim();
  if (!t) return { lada: PAISES.find((p) => p.iso2 === PAIS_DEFAULT)!.dial, resto: '' };
  const candidatos = [...PAISES].sort((a, b) => b.dial.length - a.dial.length);
  const match = candidatos.find((p) => t.startsWith(p.dial));
  return match ? { lada: match.dial, resto: t.slice(match.dial.length) } : { lada: PAISES.find((p) => p.iso2 === PAIS_DEFAULT)!.dial, resto: t.replace(/^\+/, '') };
}

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
export function OnboardingWizard({ cerebro = null }: {
  /** El mapa real del cliente, para la bienvenida. `null` = se entra derecho al wizard. */
  cerebro?: Cerebro | null;
} = {}) {
  const [data, setData] = useState<WizardData | null>(null);
  const [errCarga, setErrCarga] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  // La bienvenida se muestra UNA vez, y el que se acuerda es el server: apretar «Comenzar»
  // postea un avance SIN paso, que es lo único que hace `patchEstadoOnboarding` cuando no
  // le mandan `step` — pasar el estado de 'pending' a 'in_progress'. Con eso un F5 en la
  // pregunta 3 no la vuelve a mostrar, sin inventar una clave nueva ni usar sessionStorage
  // (que además haría diferir el HTML del server del que hidrata el cliente).
  const [bienvenidaVista, setBienvenidaVista] = useState(false);
  const [pending, setPending] = useState(false);
  // MaKo escribiendo el plan de arranque: tarda decenas de segundos y es lo último
  // que pasa antes de entrar, así que el botón tiene que decir qué está haciendo.
  const [armandoPlan, setArmandoPlan] = useState(false);
  // Cambia para remontar el form de credenciales tras copiar la key de Mau.
  const [remonte, setRemonte] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Respuestas en curso
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cierres, setCierres] = useState('');
  const [cash, setCash] = useState('');
  const [geminiConectada, setGeminiConectada] = useState(false); // lo reporta ServicioConfigForm
  const [archiveroListo, setArchiveroListo] = useState(false); // ≥1 doc analizado (lo reporta Archivero)
  // Los pasos self-contained reportan si ya tienen algo generado — sin esto el
  // Siguiente del footer dejaba avanzar aunque el paso estuviera vacío.
  const [entregableListo, setEntregableListo] = useState(false);
  const [productosListo, setProductosListo] = useState(false); // ≥1 producto cargado
  const [avataresListo, setAvataresListo] = useState(false);
  const [personaListo, setPersonaListo] = useState(false);
  const [personalidadListo, setPersonalidadListo] = useState(false);
  const [angulosListo, setAngulosListo] = useState(false);
  const [contacto, setContacto] = useState({ nombre: '', email: '', telefono: '' });
  // Verificación del teléfono de reportes: 'form' → cargando el número; 'codigo' →
  // MaKo ya mandó el código por WhatsApp, esperando que lo cargue; 'listo' → ya
  // verificado (de esta visita o de una anterior). lada/numeroLocal son la UI del
  // teléfono (selector de país + resto del número); contacto.telefono es SIEMPRE
  // la concatenación de ambos (se sincroniza con un effect más abajo).
  const [contactoEtapa, setContactoEtapa] = useState<'form' | 'codigo' | 'listo'>('form');
  const [lada, setLada] = useState(PAISES.find((p) => p.iso2 === PAIS_DEFAULT)!.dial);
  const [numeroLocal, setNumeroLocal] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [reenviando, setReenviando] = useState(false);
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
      setCierres(d.settings.objetivo_cierres ?? '');
      setCash(d.settings.objetivo_cash_usd ?? '');
      setContacto({
        nombre: d.contacto.nombre || d.usuario.nombre,
        email: d.contacto.email || d.usuario.email,
        telefono: d.contacto.telefono,
      });
      const { lada: ladaGuardada, resto } = splitTelefono(d.contacto.telefono);
      setLada(ladaGuardada);
      setNumeroLocal(resto);
      setContactoEtapa(d.contacto.verificado ? 'listo' : 'form');
      setExt(d.estado.extraction);
      setGeminiConectada(Boolean(d.geminiConfig?.configurado));
      setConectadas(Object.fromEntries(d.servicios.map((s) => [s.key, s.conectada])));
      setFaseDiag(d.faseDiag ?? null);
      setFaseResp(d.faseDiag?.respuestas ?? new Array(d.fasePreguntas?.length ?? 6).fill(-1));
      if (d.faseDiag?.canal) setCanal(d.faseDiag.canal);
    } catch (e) {
      setErrCarga(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

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

  // ── Antes que nada, la bienvenida ─────────────────────────────────────────
  // Va ACÁ y no como una pantalla más del wizard, a propósito: no tiene barra de progreso,
  // ni «Atrás», ni paso que cerrar. Meterla adentro de `pantallas` habría obligado a que
  // el WizardShell sepa dibujarse a medias, y eso se filtra a todas las demás pantallas.
  // ⚠️ LA BARRA DE AGENCIA SE DECLARA UNA VEZ Y LA USAN LAS DOS PANTALLAS. Es la única
  // salida del modo agencia —lo dice su propio comentario en ImpersonationBanner— y por
  // eso ninguna pantalla a pantalla completa puede taparla sin volver a dibujarla. La
  // regla de AGENTS.md: «si la única salida vive adentro de una pantalla condicional, no
  // hay salida». Ya pasó una vez con el botón SALIR DE LA VISTA.
  const barraAgencia = data.esAdmin ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap',
      padding: '9px 18px', background: '#14161B', color: '#F3F0E7',
      borderBottom: '1px solid rgba(200,135,12,.4)', overflowX: 'auto',
    }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent-soft)', flex: 'none' }} />
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(243,240,231,.75)', whiteSpace: 'nowrap', flex: 'none' }}>
        Modo agencia · {data.capa.nombre}
      </span>
      <span style={{ flex: 1 }} />
      <PanelAgencia
        cliente={data.capa.nombre}
        onCambio={() => { void cargar(); setRemonte((n) => n + 1); }}
      />
      <button type="button" onClick={async () => { await fetch('/api/admin/impersonate', { method: 'DELETE' }); window.location.href = '/admin'; }}
        style={{
          flex: 'none', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase',
          padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
          background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        Salir de la vista
      </button>
    </div>
  ) : undefined;

  // `&& cerebro`: sin mapa no hay bienvenida. Es la pantalla entera, y una portada con
  // un agujero negro atrás es peor que entrar derecho a la primera pregunta.
  if (!bienvenidaVista && data.estado.status === 'pending' && cerebro) {
    return (
      <Bienvenida
        cerebro={cerebro}
        adminBar={barraAgencia}
        onComenzar={() => {
          setBienvenidaVista(true);
          // Sin `await`: el wizard ya se está dibujando y este POST solo deja la marca.
          // Si falla, lo único que pasa es que la bienvenida vuelve a salir la próxima
          // vez — molesto, nunca bloqueante.
          void post('/api/onboarding', { action: 'paso' });
        }}
      />
    );
  }

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
      pantallas.push({ key: 'contacto', paso, pregunta: '¿A dónde te mando los reportes?', slides: SLIDES_MAKO });
    } else if (paso === 'negocio') {
      for (const c of data.brief) {
        pantallas.push({ key: `brief:${c.key}`, paso, pregunta: c.label, slides: SLIDES_MAKO });
      }
    } else if (paso === 'archivero') {
      pantallas.push({ key: 'archivero', paso, pregunta: 'El Archivero', slides: SLIDES_MAKO });
    } else if (paso === 'productos') {
      pantallas.push({ key: 'productos', paso, pregunta: 'Tus productos', slides: SLIDES_MAKO });
    } else if (paso === 'entregable') {
      pantallas.push({ key: 'entregable', paso, pregunta: 'Tu lead magnet', slides: SLIDES_MAKO });
    } else if (paso === 'avatares') {
      pantallas.push({ key: 'avatares', paso, pregunta: 'Tus avatares', slides: SLIDES_MAKO });
    } else if (paso === 'persona') {
      pantallas.push({ key: 'persona', paso, pregunta: 'La cara de tu marca', slides: SLIDES_MAKO });
    } else if (paso === 'personalidad') {
      pantallas.push({ key: 'personalidad', paso, pregunta: 'Tu personalidad', slides: SLIDES_MAKO });
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

  /**
   * A dónde se sale cuando un POST de 'paso' dejó el onboarding CERRADO.
   *
   * Está afuera de `avanzar` porque lo comparten los dos caminos de salida. Si viviera
   * adentro, postergar el último paso de la capa cerraría el onboarding y mandaría al
   * cliente al dashboard SIN plan — el único caso en que el plan de arranque no se
   * escribe, y justo el del cliente que ya venía teniendo problemas.
   */
  const salidaTrasCerrar = async (estadoStatus?: string): Promise<string> => {
    if (estadoStatus !== 'done') return home;
    // TERMINÓ EL ONBOARDING → MaKo le escribe SU plan. Recién acá están guardados
    // el diagnóstico, el archivero, los avatares, las razones y el lead magnet:
    // es el primer momento en que se puede armar un plan que hable de su negocio
    // y no una lista igual para todos. Si falla, no pasa nada: el cliente entra
    // igual y la primera visita a /plan le siembra el piso de siempre.
    setArmandoPlan(true);
    const r = await post('/api/onboarding/plan-arranque', {}).catch(() => null) as { ok?: boolean; url?: string } | null;
    setArmandoPlan(false);
    return r?.ok && r.url ? r.url : home;
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
      let destino = home;
      if (ultimaDelPaso) {
        // Este POST tiene que COMPLETAR antes de navegar: /plan/revisar/[id] llama a
        // guardOnboarding(), y con el estado todavía en 'in_progress' rebota al wizard.
        const j = await post('/api/onboarding', { action: 'paso', step: p.paso, done: true }) as
          { ok?: boolean; error?: string; estado?: { status?: string } } | null;
        // Si el server no pudo cerrar el paso, NO se avanza. Antes solo se miraba
        // `estado.status`, así que un 500 dejaba el paso sin marcar y el cliente
        // volvía a aterrizar acá para siempre, sin ver un solo error.
        if (!j || j.ok === false) { setError(String(j?.error ?? 'No se pudo guardar el avance. Probá de nuevo.')); return; }
        destino = await salidaTrasCerrar(j.estado?.status);
      }
      if (enUltimo) { window.location.href = destino; return; }
      setIdx((i) => i + 1);
    } finally { setPending(false); }
  };

  /**
   * «Seguí sin esto»: deja el paso PENDIENTE y salta a la próxima sección.
   *
   * Salta la sección ENTERA, no una pantalla: si un paso tiene tres conexiones y el
   * cliente posterga en la segunda, avanzar de a una lo deja en la tercera — o sea, le
   * sigue pidiendo lo mismo que acaba de decir que no puede hacer ahora.
   *
   * Y el que decide si este paso se puede postergar es el SERVER (contra el catálogo de
   * `PASOS_POSTERGABLES`); acá solo se dibuja el botón cuando corresponde. Si el 400
   * llega igual, se muestra y no se avanza.
   */
  const postergar = async () => {
    setError(null);
    setPending(true);
    try {
      const j = await post('/api/onboarding', { action: 'paso', step: p.paso, postergar: true }) as
        { ok?: boolean; error?: string; estado?: { status?: string } } | null;
      if (!j || j.ok === false) { setError(String(j?.error ?? 'No se pudo guardar. Probá de nuevo.')); return; }
      const siguiente = pantallas.findIndex((x, i) => i > idx && x.paso !== p.paso);
      if (siguiente < 0) { window.location.href = await salidaTrasCerrar(j.estado?.status); return; }
      setIdx(siguiente);
    } finally { setPending(false); }
  };

  // ── Retomar donde quedó ───────────────────────────────────────────────────
  // Si el cliente ya cerró unos pasos y vuelve a entrar, arranca en el primero que le
  // falta, no desde cero.
  //
  // ⚠️ SE BUSCA EN `pantallas`, no se CUENTA. La versión vieja tenía una función
  // `cuenta(paso)` que repetía cuántas pantallas produce cada paso — la misma lista de
  // arriba, escrita de nuevo y a mano. Se desfasó exactamente como avisa AGENTS.md: el
  // paso `fase` produce una pantalla extra (la del canal) que `cuenta` no sabía, así
  // que TODO cliente que retomaba aterrizaba una pantalla antes de donde había quedado.
  // Medido acá: con todos los pasos cerrados menos el teléfono, caía en la matriz de
  // anuncios. Preguntándole a la lista de verdad no hay forma de que vuelva a pasar.
  //
  // Un paso POSTERGADO cuenta como cerrado, igual que uno hecho: si no, quien dejó
  // pendiente el teléfono y cerró el navegador vuelve a aterrizar justo en la pantalla
  // que acaba de declinar, y la única salida que encuentra es volver a declinarla.
  if (!retomado.current && pantallas.length > 0) {
    retomado.current = true;
    const falta = pantallas.findIndex((x) => {
      const st = data.estado.steps[x.paso];
      return !st?.done && !st?.postergado;
    });
    // `-1` = no falta ninguno → la ÚLTIMA pantalla. (`p` además clampea con un
    // `Math.min`, así que un índice pasado de rango no rompía; pero apuntar al último
    // acá deja dicho lo que se quiere, en vez de depender de que otro lo corrija.)
    const inicial = falta < 0 ? pantallas.length - 1 : falta;
    if (inicial > 0) setIdx(inicial);
  }

  /** El nombre comercial de un servicio, del catálogo. `p.nombre` solo lo traen las
   *  pantallas de conexión; el resto lo declara por key y se quedaba en `undefined`. */
  const nombreServicio = (key: string) => data.servicios.find((s) => s.key === key)?.nombre ?? key;

  const campoBrief = p.key.startsWith('brief:') ? data.brief.find((c) => c.key === p.key.slice(6)) : null;
  const servicioReq = p.servicio && data.requeridos.includes(p.servicio);
  const esFaseQuiz = p.faseQ != null && p.faseQ >= 0 && p.key !== 'fase:canal';
  // NINGUNA excepción para el super-admin: el onboarding se recorre igual que
  // un cliente real, si no lo que se prueba no es lo que va a ver el cliente. Su
  // único privilegio es traer los datos de Mauricio desde la barra de agencia,
  // que llena el paso de verdad — no lo saltea.
  const puedeAvanzar = servicioReq ? Boolean(conectadas[p.servicio!])
    : esFaseQuiz ? faseResp[p.faseQ!] >= 0
    // Gemini NO tiene excepción de admin (a diferencia de los demás): sin una key que
    // ande de verdad, Entregable/Avatares/Persona/Ángulos van a fallar con "no hay IA"
    // más adelante — mejor frenar acá, con el mensaje claro, que dejar pasar y que
    // truene 3 pantallas después.
    : p.key === 'gemini' ? geminiConectada
    : p.key === 'archivero' ? archiveroListo // ≥1 doc analizado
    // Entregable/Avatares/Persona/Ángulos: TAMPOCO admiten excepción de admin. Martín
    // (probando impersonado) pudo apretar Siguiente sin haber definido el entregable —
    // "NO debería poder avanzar jamás si lo anterior no está listo" (pedido explícito).
    : p.key === 'productos' ? productosListo // ≥1 producto en el catálogo
    : p.key === 'entregable' ? entregableListo
    : p.key === 'avatares' ? avataresListo
    : p.key === 'persona' ? personaListo
    : p.key === 'personalidad' ? personalidadListo // el quiz completo
    : p.key === 'angulos' ? angulosListo
    // Teléfono de reportes: tampoco pasa sin verificar (pedido explícito) — ni
    // el super-admin, para poder probar el flujo real de punta a punta.
    : p.key === 'contacto' ? (contactoEtapa === 'listo' ? true : contactoEtapa === 'form' ? numeroLocal.trim().length >= 6 : codigoInput.trim().length === 6)
    : true;
  // Archivero sin documentos: el botón Siguiente ni aparece — no tiene sentido
  // avanzar sin cargar nada, y eso vale también para el super-admin.
  const hideSiguiente = p.key === 'archivero' && !archiveroListo;

  // Guardar el diagnóstico (recomputado en el server) al terminar las 6 preguntas.
  const guardarFase = async () => {
    const local = diagnosticar(faseResp, canal);
    setFaseDiag(local); // instantáneo, para que el resultado aparezca al toque
    const j = await post('/api/onboarding', { action: 'fase', faseRespuestas: faseResp, canal });
    if (j.ok && j.diagnostico) setFaseDiag(j.diagnostico as Diagnostico);
    return j;
  };

  // Verificación del teléfono de reportes: pide un código nuevo por WhatsApp (NO
  // avanza el wizard — cambia de sub-etapa dentro de la misma pantalla).
  const enviarCodigoContacto = async () => {
    setPending(true); setError(null);
    try {
      const telefono = `${lada}${numeroLocal.replace(/\D/g, '')}`;
      const j = await post('/api/onboarding', { action: 'contacto-enviar-codigo', contacto: { ...contacto, telefono } });
      if (!j.ok) { setError(String(j.error ?? 'No se pudo enviar el código.')); return; }
      setContacto((c) => ({ ...c, telefono }));
      setContactoEtapa(j.yaVerificado ? 'listo' : 'codigo');
      if (!j.yaVerificado) setCodigoInput('');
    } finally { setPending(false); }
  };
  const reenviarCodigo = async () => {
    setReenviando(true); setError(null);
    try {
      const telefono = `${lada}${numeroLocal.replace(/\D/g, '')}`;
      const j = await post('/api/onboarding', { action: 'contacto-enviar-codigo', contacto: { ...contacto, telefono } });
      if (!j.ok) setError(String(j.error ?? 'No se pudo reenviar el código.'));
    } finally { setReenviando(false); }
  };
  const verificarCodigo = async () => {
    const j = await post('/api/onboarding', { action: 'contacto-verificar-codigo', codigo: codigoInput });
    // Sin esto, volver "← Atrás" a esta pantalla después de verificar mostraba
    // de nuevo el input de código (estado local nunca se enteraba del éxito).
    if (j.ok) setContactoEtapa('listo');
    return j;
  };

  // Simular con las llaves de Mauricio: copia sus credenciales al workspace de
  // prueba y arranca la extracción, para ver el WOW real (los facts, el histórico)
  // sin tener que pegar una key. Solo super-admin.

  // "Completar como Mauricio": el workspace de prueba se queda con el MISMO
  // contexto de negocio del dueño y el onboarding cierra — así se prueba una tab
  // sin rehacer el wizard de cero cada vez. No copia contacto ni credenciales
  // (las pruebas tienen que llegarle a quien prueba, no a Mauricio).

  return (
    <>
      <BrandDefs />
      {/* Progreso con el MAPA (`pasos`+`pasoActual`), no con dos números: con
          `total`+`idx` había que repetir acá el `pasos.indexOf(...)` que la pieza
          ya sabe hacer, y una cuenta duplicada es la que se queda vieja. Ojo con
          el grano: el mapa son las SECCIONES y las pantallas son más (varias por
          sección), así que el punto no se mueve dentro de una sección — a
          propósito, y por eso la pieza pinta "faltan pasos" en la última. */}
      <WizardShell
        fullscreen
        bloqueante
        titulo={data.capa.nombre}
        pasos={data.pasos}
        pasoActual={p.paso}
        pregunta={p.pregunta}
        sub={p.sub}
        error={error}
        puedeAvanzar={puedeAvanzar}
        enUltimo={enUltimo}
        confirmLabel={armandoPlan ? 'MaKo está armando tu plan…' : data.pasos.includes('plan') ? 'Crear mi primer proyecto →' : 'Ver mi plan →'}
        siguienteLabel={
          p.key === 'retro' ? 'Seguir sin Retro →'
          : p.faseQ === data.fasePreguntas.length - 1 ? 'Ver mi diagnóstico →'
          : p.key === 'contacto' && contactoEtapa === 'form' ? 'Enviar código →'
          : p.key === 'contacto' && contactoEtapa === 'codigo' ? 'Verificar →'
          : 'Siguiente →'
        }
        hideSiguiente={hideSiguiente}
        pending={pending || armandoPlan}
        atrasLabel="Atrás"
        hideAtras={idx === 0}
        onAtras={() => setIdx((i) => Math.max(0, i - 1))}
        // LA SALIDA. Solo en los pasos que se cierran en un sistema de afuera —la
        // consola de Meta, un WhatsApp que tiene que llegar—: el cliente que se traba
        // ahí no se traba por no querer, se traba porque la pelota no la tiene él, y
        // el wizard es bloqueante. Un cliente real estuvo NUEVE DÍAS sin poder entrar a
        // la app por esto, con todo lo demás ya contestado.
        // «por ahora» no es relleno: dice que la decisión no es definitiva, que es justo
        // lo que frena a alguien de apretar. Lo que deja pendiente le queda anotado en
        // /general hasta que lo resuelva.
        extraFooter={esPostergable(p.paso) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => { if (!pending) void postergar(); }}
            style={{
              border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13,
              cursor: pending ? 'default' : 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
            }}
          >
            {p.servicio ? `Seguir sin ${p.nombre ?? p.servicio} por ahora` : 'Seguir sin verificar el teléfono por ahora'}
          </button>
        ) : undefined}
        onSiguiente={() => {
          if (campoBrief) return avanzar(() => post('/api/onboarding', { action: 'brief', brief: { [campoBrief.key]: answers[campoBrief.key] ?? '' } }));
          // Archivero: si le faltan datos, su "Siguiente" abre las preguntas (consumido)
          // en vez de avanzar a la próxima sección; si no, avanzamos normal.
          if (p.key === 'archivero') { if (archiveroRef.current?.siguiente()) return; return avanzar(); }
          // Pasos self-contained (Entregable, Avatares, Persona, Matriz, Gemini):
          // persisten por su cuenta con sus propios endpoints; acá solo avanzamos.
          if (['productos', 'entregable', 'avatares', 'persona', 'personalidad', 'angulos', 'gemini'].includes(p.key)) return avanzar();
          // Contacto: 'form' manda el código (NO avanza, cambia de sub-etapa);
          // 'codigo' lo verifica y RECIÉN AHÍ avanza; 'listo' es un avance normal.
          if (p.key === 'contacto') {
            if (contactoEtapa === 'form') { void enviarCodigoContacto(); return; }
            if (contactoEtapa === 'codigo') return avanzar(verificarCodigo);
            return avanzar();
          }
          // Última pregunta del diagnóstico: persistir antes de mostrar el resultado.
          if (esFaseQuiz && p.faseQ === data.fasePreguntas.length - 1) return avanzar(guardarFase);
          return avanzar();
        }}
        onConfirmar={() => avanzar()}
        onClose={() => { /* bloqueante */ }}
        adminBar={barraAgencia}
        escenario={
          p.faseQ != null ? (
            <FasePanel modo={p.faseQ >= 0 ? 'quiz' : 'result'} diag={faseDiag} />
          ) : (
            <PanelMarketing
              servicioKey={p.servicio ?? 'landing'}
              nombre={p.nombre ?? 'MaKo'}
              slides={p.slides}
              facts={factsDePantalla()}
              // `nombre` solo lo traen las pantallas `int:*`; la de Retro declara
              // `servicio: 'meta'` sin nombre, así que esto pintaba «✦ CON UNDEFINED
              // CONECTADO» en pantalla, en mayúsculas y arriba de todo. El nombre sale
              // del catálogo de servicios, que es donde vive de verdad.
              eyebrow={p.eyebrow ?? (p.servicio ? `✦ Con ${nombreServicio(p.servicio)} conectado` : '✦ Así trabaja MaKo')}
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
        {p.key === 'archivero' && <Archivero key={`arch-${remonte}`} onEstado={setAnswers} onListo={setArchiveroListo} registro={archiveroRef} />}

        {/* ── Productos/ofertas: MaKo los arma con el brief + El Archivero ── */}
        {p.key === 'productos' && <ProductosView key={`prod-${remonte}`} onListo={setProductosListo} />}

        {/* ── Entregable tangible de la oferta (self-contained) ── */}
        {p.key === 'entregable' && <EntregableView key={`ent-${remonte}`} onListo={setEntregableListo} />}

        {/* ── Avatares: MaKo propone 3 subnichos desde el brief (self-contained) ── */}
        {p.key === 'avatares' && <AvataresView key={`ava-${remonte}`} onListo={setAvataresListo} />}

        {/* ── Persona: la cara de marca (fotos + descripción), self-contained ── */}
        {p.key === 'persona' && <PersonaView key={`per-${remonte}`} onListo={setPersonaListo} />}

        {/* ── Personalidad: el quiz de la voz del creador (humaniza los guiones) ── */}
        {p.key === 'personalidad' && <PersonalidadView key={`pers-${remonte}`} onListo={setPersonalidadListo} />}

        {/* ── La matriz de anuncios (avatar × razón), self-contained ── */}
        {p.key === 'angulos' && <MatrizView key={`ang-${remonte}`} onListo={setAngulosListo} />}

        {/* ── Brief: una pregunta, un campo ── */}
        {campoBrief && (campoBrief.type === 'textarea'
          ? <textarea style={{ ...wizardInput, textAlign: 'left', minHeight: 104, resize: 'vertical', lineHeight: 1.55, paddingTop: 12 }}
              value={answers[campoBrief.key] ?? ''} placeholder={campoBrief.placeholder} autoFocus
              onChange={(e) => setAnswers((a) => ({ ...a, [campoBrief.key]: e.target.value }))} />
          : <input style={wizardInput} value={answers[campoBrief.key] ?? ''} placeholder={campoBrief.placeholder} autoFocus
              onChange={(e) => setAnswers((a) => ({ ...a, [campoBrief.key]: e.target.value }))} />)}

        {/* ── Gemini: la MISMA credencial de /integraciones (ojito · probar · eliminar) ── */}
        {p.key === 'gemini' && (
          <div style={{ textAlign: 'left' }}>
            <ServicioConfigForm key={`gemini-${remonte}`} servicioKey="gemini" onEstado={setGeminiConectada} />
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

        {/* ── Contacto: teléfono con lada + verificación por código de WhatsApp ── */}
        {p.key === 'contacto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contactoEtapa === 'form' && (
              <>
                <div><Label>Nombre</Label><input style={wizardInput} value={contacto.nombre} onChange={(e) => setContacto((c) => ({ ...c, nombre: e.target.value }))} /></div>
                <div><Label>Email</Label><input style={wizardInput} type="email" value={contacto.email} onChange={(e) => setContacto((c) => ({ ...c, email: e.target.value }))} /></div>
                <div>
                  <Label>WhatsApp</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Bandera como IMAGEN vía el prop avatar del Dropdown: los emoji de
                        bandera en Windows se ven como letras ("MX") — bug reportado. */}
                    <Dropdown value={lada} onChange={setLada} width={128} ariaLabel="Código de país"
                      options={PAISES.map((pais) => ({ value: pais.dial, label: pais.dial, sub: pais.nombre, avatar: flagUrl(pais.iso2), avatarCuadrado: true }))} />
                    <input style={{ ...wizardInput, flex: 1 }} value={numeroLocal} placeholder="686 123 4567" inputMode="tel"
                      onChange={(e) => setNumeroLocal(e.target.value.replace(/[^\d\s-]/g, ''))} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6, lineHeight: 1.5 }}>Te mandamos un código por WhatsApp para confirmarlo — MaKo te va a escribir ahí.</div>
                </div>
              </>
            )}
            {contactoEtapa === 'codigo' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 16 }}>
                  Te escribimos por WhatsApp a <b style={{ color: 'var(--ink)' }}>{lada} {numeroLocal}</b> con un código de 6 dígitos. Cargalo acá para confirmar tu número.
                </div>
                <input style={{ ...wizardInput, textAlign: 'center', fontSize: 24, letterSpacing: '0.35em', fontWeight: 700, padding: '14px 12px 14px 24px' }}
                  value={codigoInput} onChange={(e) => setCodigoInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" inputMode="numeric" maxLength={6} autoFocus />
                <div style={{ marginTop: 16, display: 'flex', gap: 18, justifyContent: 'center' }}>
                  <button type="button" onClick={reenviarCodigo} disabled={reenviando} style={linkBtn}>{reenviando ? 'Reenviando…' : 'Reenviar código'}</button>
                  <button type="button" onClick={() => { setContactoEtapa('form'); setCodigoInput(''); }} style={linkBtn}>Cambiar número</button>
                </div>
              </div>
            )}
            {contactoEtapa === 'listo' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--good-bg)', border: '1px solid var(--good)', borderRadius: 12, padding: '13px 15px' }}>
                <span style={{ color: 'var(--good)', fontSize: 16, flex: 'none', marginTop: 1 }}>✓</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Número verificado</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>{lada} {numeroLocal} — MaKo ya te tiene en su grupo de WhatsApp.</div>
                  <button type="button" onClick={() => setContactoEtapa('form')} style={{ ...linkBtn, marginTop: 8 }}>Cambiar número</button>
                </div>
              </div>
            )}
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
function FasePanel({ modo, diag }: { modo: 'quiz' | 'result'; diag: Diagnostico | null }) {
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
  return <FaseLoopAnimado />;
}

// Animación en LOOP, autónoma — NO depende de qué pregunta esté respondiendo el
// usuario (antes saltaba de contenido al llegar a la pregunta de canal, que no
// tenía faseQ; ahora ni siquiera hace falta esa dependencia: el panel es el MISMO
// en las 6 preguntas, solo recorre las 5 fases por su cuenta). Pedido de Martín:
// "eliminar todo el resto de la banda negra" — queda solo el título y el loop.
function FaseLoopAnimado() {
  const [activo, setActivo] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActivo((a) => (a + 1) % FASES.length), 2800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 26, minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 22 }}>✦ Diagnóstico del negocio</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FASES.map((f, i) => {
          const on = i === activo;
          return (
            <div key={f.id} style={{
              borderRadius: 12, padding: on ? '12px 14px' : '9px 14px',
              background: on ? `${f.color}22` : 'transparent',
              border: `1px solid ${on ? `${f.color}50` : 'transparent'}`,
              transition: 'background .5s ease, border-color .5s ease, padding .4s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{
                  flex: 'none', width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? f.color : 'rgba(255,255,255,.08)', color: on ? '#171511' : f.color, transition: 'all .5s ease',
                }}><FaseIcono id={f.id} size={17} /></span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--on-sidebar)' }}>Fase {f.id} · {f.nombre}</div>
              </div>
              <div style={{
                maxHeight: on ? 30 : 0, opacity: on ? 1 : 0, overflow: 'hidden',
                transition: 'max-height .4s ease, opacity .3s ease', paddingLeft: 43,
              }}>
                <div style={{ fontSize: 12, color: 'var(--sidebar-text)', lineHeight: 1.4, marginTop: 6 }}>{f.subtitulo}</div>
              </div>
            </div>
          );
        })}
      </div>
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
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };

const Label = ({ children }: { children: ReactNode }) => (
  <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 5, display: 'block', textAlign: 'left' }}>{children}</label>
);

const Centro = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 14 }}>{children}</div>
);

export { JOB_LABELS };
