'use client';

// =============================================================================
// ChatAgentApp — la tab /setting: simulador de secuencias de mensajes + dashboard
// =============================================================================
// Tres sub-tabs: WhatsApp (secuencias como CONTACTOS + chat simulado con MaKo-setter,
// réplica del diseño de Plantillas en SuperAdmin), Email (bandeja simulada del
// lead) y Dashboard (KPIs + gráficos recharts). El wizard "Nueva secuencia de mensajes" define
// la estrategia y MaKo redacta; el perfil de cada secuencia de mensajes se edita desde el chat.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '@/app/_components/icons';
import { Dropdown } from '../components/Dropdown';
import { SecuenciaWizard } from './SecuenciaWizard';
import { SimuladorWhatsApp, emojiSecuencia } from './SimuladorWhatsApp';
import { SimuladorEmail } from './SimuladorEmail';
import { DashboardChatAgent } from './DashboardChatAgent';
import { AudiosPanel } from './AudiosPanel';
import { OnboardingChatAgent } from './OnboardingChatAgent';
import { DatosDeMau } from '@/app/_components/DatosDeMau';
import type { Estrategia } from '@/lib/setting-estrategia';
import type { MetricasSecuencia, PuntoSerie } from '@/lib/setting-metricas';

export type PasoSecuenciaDto = {
  orden: number; canal: 'email' | 'whatsapp'; delay_horas: number;
  asunto: string | null; preheader?: string | null; cuerpo: string;
  proveedor?: 'oficial' | 'no_oficial'; template_wa: string | null; ancla?: 'reunion';
  tipo?: 'texto' | 'audio'; audio_id?: number | null;
};
export type AudioSetting = { id: number; titulo: string; media_mime: string; duracion_s: number | null; transcript: string | null; url: string | null };
export type SecuenciaDto = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  activa: boolean; pasos: PasoSecuenciaDto[]; inscriptos: number; enviados: number;
  estrategia: Estrategia | null; metricas: MetricasSecuencia;
};
export type Opcion = { value: string; label: string };

// Etiquetas de etapa: legacy del seed + stage keys derivadas; para etapas custom
// el GET trae las labels reales del funnel del workspace (prevalecen).
const ETAPA_LABEL: Record<string, string> = {
  nutri: 'No Agenda', postagenda: 'Post-agenda', noshow: 'No Show', nopaga: 'No Paga', manual: 'Manual',
  noshow_r1: 'No Show R1', noshow_r2: 'No Show R2', noshow_r3: 'No Show R3',
  nocompro: 'No Compró', nutridiaria: 'Nutrición diaria', reactivacion: 'Reactivación',
  reunion_excepcional: 'Reunión excepcional',
};

const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer' };

export function ChatAgentApp() {
  const [secuencias, setSecuencias] = useState<SecuenciaDto[] | null>(null);
  const [serie, setSerie] = useState<PuntoSerie[]>([]);
  const [rolAdmin, setRolAdmin] = useState(false);
  const [objetivos, setObjetivos] = useState<Opcion[]>([]);
  const [etapas, setEtapas] = useState<Opcion[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<Array<{ id: string; nombre: string }>>([]);
  const [negocio, setNegocio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'whatsapp' | 'email' | 'audios' | 'dashboard'>('whatsapp');
  const [audios, setAudios] = useState<AudioSetting[]>([]);
  const [emailSecuenciaId, setEmailSecuenciaId] = useState<number | null>(null);
  // Wizard: null = cerrado; 'nueva' = secuencia nueva; number = definir sobre esa secuencia.
  const [wizard, setWizard] = useState<null | 'nueva' | number>(null);
  // Onboarding de la tab (regla: toda tab tiene onboarding). null = todavía no
  // sabemos; true = arranca en el recorrido; false = la tab normal.
  const [enOnboarding, setEnOnboarding] = useState<boolean | null>(null);
  // Qué recorrido eligió arrancar. Si nunca configuró NADA, primero se le
  // pregunta en vez de meterlo de prepo en los 11 pasos: el que solo quiere
  // WhatsApp no tiene por qué pasar por el email.
  const [plan, setPlan] = useState<'setting' | 'whatsapp' | 'email' | null>(null);
  const [preguntarPlan, setPreguntarPlan] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/chat-agent/secuencias', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'No se pudieron cargar las secuencias de mensajes.'); setSecuencias([]); return; }
      const lista = j.secuencias as SecuenciaDto[];
      setSecuencias(lista); setSerie(j.serie ?? []); setRolAdmin(Boolean(j.rolAdmin));
      setObjetivos(j.objetivos ?? []); setEtapas(j.etapas ?? []); setLeadMagnets(j.leadMagnets ?? []);
      setNegocio(j.negocio ?? '');
      setEmailSecuenciaId((prev) => (prev != null && lista.some((x) => x.id === prev) ? prev : (lista.find((x) => x.pasos.some((p) => p.canal === 'email'))?.id ?? lista[0]?.id ?? null)));
      setError(null);
    } catch {
      setError('Sin conexión — recargá la página.'); setSecuencias([]);
    }
    // Biblioteca de audios (admin-only: el 403 del setter deja la lista vacía).
    try {
      const ra = await fetch('/api/chat-agent/audios', { cache: 'no-store' });
      const ja = await ra.json();
      if (ja.ok) setAudios(ja.audios ?? []);
    } catch { /* sin audios */ }
    // ¿La tab arranca en su onboarding? (403 del setter → la ve normal)
    try {
      const ro = await fetch('/api/chat-agent/onboarding?tab=setting', { cache: 'no-store' });
      const jo = await ro.json();
      const falta = jo.ok ? jo.estado?.status !== 'done' : false;
      setEnOnboarding(falta);
      // Arrancar de cero = ni un paso hecho en todo el recorrido. Ahí se
      // pregunta. Si ya venía a mitad de camino, se sigue donde quedó.
      const pasos = (jo?.estado?.steps ?? {}) as Record<string, { done?: boolean }>;
      const ningunoHecho = Object.values(pasos).every((x) => !x?.done);
      setPreguntarPlan(falta && ningunoHecho);
    } catch { setEnOnboarding(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const etiquetaEtapa = useCallback(
    (key: string) => etapas.find((e) => e.value === key)?.label ?? ETAPA_LABEL[key] ?? key,
    [etapas],
  );
  const emailSecuencia = (secuencias ?? []).find((j) => j.id === emailSecuenciaId) ?? null;

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { ...tabActive, fontWeight: 500, background: 'transparent', color: 'var(--dim)' };

  // Mientras no sabemos si va el onboarding o la tab, NO se pinta ninguna de
  // las dos: mostrar la tab y reemplazarla medio segundo después por el wizard
  // es un flash que hace sentir la app rota.
  // OJO con `height: '100vh'` en este main: es hijo de una columna flex, y
  // `flex: 1` implica `flex-basis: 0%`, que ANULA el height. El main colapsa a
  // la altura del spinner y el `alignItems: center` no tiene nada que centrar →
  // loader diminuto pegado al techo. Va `minHeight`, que sí manda.
  if (enOnboarding === null) {
    return (
      <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
        <span style={{ fontSize: 14, color: 'var(--dim)' }}>Abriendo tu Chat Agent…</span>
      </main>
    );
  }

  // El onboarding cubre la tab (mismo chrome que el global, pero embebido: el
  // sidebar sigue visible). Al terminarlo —o al elegir "lo configuro después"—
  // se entra a la vista normal.
  if (enOnboarding && preguntarPlan && plan === null) {
    return <ElegirRecorrido onElegir={(k) => { setPlan(k); setPreguntarPlan(false); }} onSaltar={() => setEnOnboarding(false)} />;
  }

  if (enOnboarding) {
    return (
      <OnboardingChatAgent
        tab={plan ?? 'setting'}
        onListo={() => { setEnOnboarding(false); setPlan(null); void load(); }}
      />
    );
  }

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '30px 36px 40px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 7px', color: 'var(--ink)' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="tag" size={34} /></span>
            Chat Agent
          </h1>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>
            Tus <strong style={{ color: 'var(--ink)' }}>secuencias</strong>: probalas como el lead, chateá con MaKo-setter y mirá cómo rinden.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setVista('whatsapp')} style={vista === 'whatsapp' ? tabActive : tabIdle}>WhatsApp</button>
            <button onClick={() => setVista('email')} style={vista === 'email' ? tabActive : tabIdle}>Email</button>
            {rolAdmin && <button onClick={() => setVista('audios')} style={vista === 'audios' ? tabActive : tabIdle}>🎙 Audios</button>}
            <button onClick={() => setVista('dashboard')} style={vista === 'dashboard' ? tabActive : tabIdle}>Dashboard</button>
          </div>
          {rolAdmin && vista !== 'whatsapp' && (
            <button onClick={() => setWizard('nueva')} style={btnDark}>+ Nueva secuencia de mensajes</button>
          )}
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, color: 'var(--bad)', fontSize: '13.5px' }}>{error}</div>
      )}

      {secuencias === null && !error && <div style={{ color: 'var(--dim)', fontSize: '14px' }}>Cargando secuencias…</div>}

      {secuencias !== null && secuencias.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: '28px 24px', color: 'var(--dim)', fontSize: '14px' }}>
          Todavía no hay secuencias en este workspace.{rolAdmin ? ' Arrancá con «+ Nueva secuencia de mensajes».' : ''}
          {rolAdmin && <div style={{ marginTop: 14 }}><button onClick={() => setWizard('nueva')} style={btnDark}>+ Nueva secuencia de mensajes</button></div>}
          <DatosDeMau ambito="setting" onListo={() => void load()} />
        </div>
      )}

      {/* La biblioteca de audios no depende de que existan secuencias. */}
      {vista === 'audios' && rolAdmin && <AudiosPanel audios={audios} onCambio={() => void load()} />}

      {secuencias !== null && secuencias.length > 0 && (
        <>
          {vista === 'whatsapp' && (
            <SimuladorWhatsApp
              secuencias={secuencias} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa}
              negocio={negocio} rolAdmin={rolAdmin} audios={audios}
              onWizard={(id) => setWizard(id)} onReload={() => void load()}
            />
          )}

          {vista === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--faint)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Secuencia de mensajes</span>
                <Dropdown
                  value={emailSecuenciaId != null ? String(emailSecuenciaId) : ''}
                  onChange={(v) => setEmailSecuenciaId(Number(v))}
                  width="340px"
                  ariaLabel="Elegir secuencia"
                  options={secuencias.map((j) => ({ value: String(j.id), label: `${emojiSecuencia(j)} ${j.nombre} · ${etiquetaEtapa(j.etapa)}` }))}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <SimuladorEmail secuencia={emailSecuencia} nombreNegocio={negocio} />
              </div>
            </div>
          )}

          {vista === 'dashboard' && (
            <DashboardChatAgent secuencias={secuencias} serie={serie} etiquetaEtapa={etiquetaEtapa} />
          )}
        </>
      )}

      {wizard !== null && (
        <SecuenciaWizard
          secuenciaId={wizard === 'nueva' ? null : wizard}
          secuencias={secuencias ?? []}
          objetivos={objetivos}
          etapas={etapas}
          leadMagnets={leadMagnets}
          onClose={() => setWizard(null)}
          onDone={() => { setWizard(null); void load(); }}
        />
      )}
    </main>
  );
}

/**
 * Primera pantalla del Chat Agent cuando no hay NADA configurado: en vez de
 * empujar los 11 pasos, se pregunta por dónde arrancar. Cada opción es un
 * recorrido real (lib/tab-onboarding-state.ts) y comparten los pasos, así que
 * elegir "solo WhatsApp" hoy y "todo" mañana no repite lo ya hecho.
 */
function ElegirRecorrido({ onElegir, onSaltar }: {
  onElegir: (k: 'setting' | 'whatsapp' | 'email') => void;
  onSaltar: () => void;
}) {
  const OPCIONES: Array<{ k: 'setting' | 'whatsapp' | 'email'; icono: string; titulo: string; sub: string; detalle: string }> = [
    { k: 'setting', icono: '✦', titulo: 'Todo', sub: 'Recorrido completo', detalle: 'Los dos métodos de WhatsApp, el email, tu forma de escribir, tus audios y las secuencias de mensajes.' },
    { k: 'whatsapp', icono: '💬', titulo: 'Solo WhatsApp', sub: 'Conectar y verificar el canal', detalle: 'Tu número de empresa, la verificación de entrega y el canal oficial si lo necesitas.' },
    { k: 'email', icono: '✉️', titulo: 'Solo Email', sub: 'Conectar y verificar la bandeja', detalle: 'Tu dominio verificado y un correo de prueba a tu bandeja.' },
  ];
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>✦ Chat Agent</div>
        <h1 style={{ fontWeight: 700, fontSize: 30, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 8px' }}>¿Por dónde arrancamos?</h1>
        <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 26px', lineHeight: 1.55 }}>Puedes configurarlo todo de una vez o avanzar canal por canal. Lo que completes ahora no se vuelve a pedir.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPCIONES.map((o) => (
            <button key={o.k} type="button" onClick={() => onElegir(o.k)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>
              <span aria-hidden style={{ flex: 'none', width: 40, height: 40, borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{o.icono}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{o.titulo}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{o.sub}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>{o.detalle}</span>
              </span>
              <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 15 }}>→</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onSaltar}
          style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>
          Configurar más tarde
        </button>
      </div>
    </main>
  );
}
