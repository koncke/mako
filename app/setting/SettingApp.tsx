'use client';

// =============================================================================
// SettingApp — la tab /setting: simulador de jugadas + dashboard
// =============================================================================
// Tres sub-tabs: WhatsApp (jugadas como CONTACTOS + chat simulado con MaKo-setter,
// réplica del diseño de Plantillas en SuperAdmin), Email (bandeja simulada del
// lead) y Dashboard (KPIs + gráficos recharts). El wizard "Nueva jugada" define
// la estrategia y MaKo redacta; el perfil de cada jugada se edita desde el chat.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '@/app/_components/icons';
import { Dropdown } from '../components/Dropdown';
import { JugadaWizard } from './JugadaWizard';
import { SimuladorWhatsApp, emojiJugada } from './SimuladorWhatsApp';
import { SimuladorEmail } from './SimuladorEmail';
import { DashboardSetting } from './DashboardSetting';
import { AudiosPanel } from './AudiosPanel';
import { OnboardingSetting } from './OnboardingSetting';
import type { Estrategia } from '@/lib/setting-estrategia';
import type { MetricasJugada, PuntoSerie } from '@/lib/setting-metricas';

export type PasoJugada = {
  orden: number; canal: 'email' | 'whatsapp'; delay_horas: number;
  asunto: string | null; preheader?: string | null; cuerpo: string;
  proveedor?: 'oficial' | 'no_oficial'; template_wa: string | null; ancla?: 'reunion';
  tipo?: 'texto' | 'audio'; audio_id?: number | null;
};
export type AudioSetting = { id: number; titulo: string; media_mime: string; duracion_s: number | null; transcript: string | null; url: string | null };
export type JugadaDto = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  activa: boolean; pasos: PasoJugada[]; inscriptos: number; enviados: number;
  estrategia: Estrategia | null; metricas: MetricasJugada;
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

export function SettingApp() {
  const [jugadas, setJugadas] = useState<JugadaDto[] | null>(null);
  const [serie, setSerie] = useState<PuntoSerie[]>([]);
  const [rolAdmin, setRolAdmin] = useState(false);
  const [objetivos, setObjetivos] = useState<Opcion[]>([]);
  const [etapas, setEtapas] = useState<Opcion[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<Array<{ id: string; nombre: string }>>([]);
  const [negocio, setNegocio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'whatsapp' | 'email' | 'audios' | 'dashboard'>('whatsapp');
  const [audios, setAudios] = useState<AudioSetting[]>([]);
  const [emailJugadaId, setEmailJugadaId] = useState<number | null>(null);
  // Wizard: null = cerrado; 'nueva' = jugada nueva; number = definir sobre esa secuencia.
  const [wizard, setWizard] = useState<null | 'nueva' | number>(null);
  // Onboarding de la tab (regla: toda tab tiene onboarding). null = todavía no
  // sabemos; true = arranca en el recorrido; false = la tab normal.
  const [enOnboarding, setEnOnboarding] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/setting/jugadas', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'No se pudieron cargar las jugadas.'); setJugadas([]); return; }
      const lista = j.jugadas as JugadaDto[];
      setJugadas(lista); setSerie(j.serie ?? []); setRolAdmin(Boolean(j.rolAdmin));
      setObjetivos(j.objetivos ?? []); setEtapas(j.etapas ?? []); setLeadMagnets(j.leadMagnets ?? []);
      setNegocio(j.negocio ?? '');
      setEmailJugadaId((prev) => (prev != null && lista.some((x) => x.id === prev) ? prev : (lista.find((x) => x.pasos.some((p) => p.canal === 'email'))?.id ?? lista[0]?.id ?? null)));
      setError(null);
    } catch {
      setError('Sin conexión — recargá la página.'); setJugadas([]);
    }
    // Biblioteca de audios (admin-only: el 403 del setter deja la lista vacía).
    try {
      const ra = await fetch('/api/setting/audios', { cache: 'no-store' });
      const ja = await ra.json();
      if (ja.ok) setAudios(ja.audios ?? []);
    } catch { /* sin audios */ }
    // ¿La tab arranca en su onboarding? (403 del setter → la ve normal)
    try {
      const ro = await fetch('/api/setting/onboarding', { cache: 'no-store' });
      const jo = await ro.json();
      setEnOnboarding(jo.ok ? jo.estado?.status !== 'done' : false);
    } catch { setEnOnboarding(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const etiquetaEtapa = useCallback(
    (key: string) => etapas.find((e) => e.value === key)?.label ?? ETAPA_LABEL[key] ?? key,
    [etapas],
  );
  const emailJugada = (jugadas ?? []).find((j) => j.id === emailJugadaId) ?? null;

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { ...tabActive, fontWeight: 500, background: 'transparent', color: 'var(--dim)' };

  // Mientras no sabemos si va el onboarding o la tab, NO se pinta ninguna de
  // las dos: mostrar la tab y reemplazarla medio segundo después por el wizard
  // es un flash que hace sentir la app rota.
  if (enOnboarding === null) {
    return (
      <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      </main>
    );
  }

  // El onboarding cubre la tab (mismo chrome que el global, pero embebido: el
  // sidebar sigue visible). Al terminarlo —o al elegir "lo configuro después"—
  // se entra a la vista normal.
  if (enOnboarding) {
    return <OnboardingSetting onListo={() => { setEnOnboarding(false); void load(); }} />;
  }

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '30px 36px 40px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 7px', color: 'var(--ink)' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="tag" size={34} /></span>
            Setting
          </h1>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>
            Tus <strong style={{ color: 'var(--ink)' }}>jugadas</strong>: probalas como el lead, chateá con MaKo-setter y mirá cómo rinden.
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
            <button onClick={() => setWizard('nueva')} style={btnDark}>+ Nueva jugada</button>
          )}
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, color: 'var(--bad)', fontSize: '13.5px' }}>{error}</div>
      )}

      {jugadas === null && !error && <div style={{ color: 'var(--dim)', fontSize: '14px' }}>Cargando jugadas…</div>}

      {jugadas !== null && jugadas.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: '28px 24px', color: 'var(--dim)', fontSize: '14px' }}>
          Todavía no hay secuencias en este workspace.{rolAdmin ? ' Arrancá con «+ Nueva jugada».' : ''}
          {rolAdmin && <div style={{ marginTop: 14 }}><button onClick={() => setWizard('nueva')} style={btnDark}>+ Nueva jugada</button></div>}
        </div>
      )}

      {/* La biblioteca de audios no depende de que existan jugadas. */}
      {vista === 'audios' && rolAdmin && <AudiosPanel audios={audios} onCambio={() => void load()} />}

      {jugadas !== null && jugadas.length > 0 && (
        <>
          {vista === 'whatsapp' && (
            <SimuladorWhatsApp
              jugadas={jugadas} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa}
              negocio={negocio} rolAdmin={rolAdmin} audios={audios}
              onWizard={(id) => setWizard(id)} onReload={() => void load()}
            />
          )}

          {vista === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--faint)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Jugada</span>
                <Dropdown
                  value={emailJugadaId != null ? String(emailJugadaId) : ''}
                  onChange={(v) => setEmailJugadaId(Number(v))}
                  width="340px"
                  ariaLabel="Elegir jugada"
                  options={jugadas.map((j) => ({ value: String(j.id), label: `${emojiJugada(j)} ${j.nombre} · ${etiquetaEtapa(j.etapa)}` }))}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <SimuladorEmail jugada={emailJugada} nombreNegocio={negocio} />
              </div>
            </div>
          )}

          {vista === 'dashboard' && (
            <DashboardSetting jugadas={jugadas} serie={serie} etiquetaEtapa={etiquetaEtapa} />
          )}
        </>
      )}

      {wizard !== null && (
        <JugadaWizard
          secuenciaId={wizard === 'nueva' ? null : wizard}
          jugadas={jugadas ?? []}
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
