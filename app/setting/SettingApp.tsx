'use client';

// =============================================================================
// SettingApp — vista Jugadas de la tab /setting
// =============================================================================
// Cada secuencia de nutrición es una JUGADA: estrategia (objetivo + gancho +
// preguntas de cualificación) + métricas de los últimos 30 días. El wizard
// (JugadaWizard) define la estrategia, MaKo redacta, se prueba en vivo y
// aprobar la activa. Setter = solo lectura (rolAdmin viene del GET).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '@/app/_components/icons';
import { Dropdown } from '../components/Dropdown';
import { JugadaWizard } from './JugadaWizard';
import { SimuladorWhatsApp } from './SimuladorWhatsApp';
import { SimuladorEmail } from './SimuladorEmail';
import type { Estrategia, Objetivo } from '@/lib/setting-estrategia';
import type { MetricasJugada } from '@/lib/setting-metricas';

export type PasoJugada = {
  orden: number; canal: 'email' | 'whatsapp'; delay_horas: number;
  asunto: string | null; preheader?: string | null; cuerpo: string;
  proveedor?: 'oficial' | 'no_oficial'; template_wa: string | null; ancla?: 'reunion';
};
export type JugadaDto = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  activa: boolean; pasos: PasoJugada[]; inscriptos: number; enviados: number;
  estrategia: Estrategia | null; metricas: MetricasJugada;
};
export type Opcion = { value: string; label: string };

const OBJETIVO_LABEL: Record<Objetivo, string> = {
  agendar: 'Agendar', reactivar: 'Reactivar', cualificar: 'Cualificar', confirmar_pago: 'Confirmar pago',
};

// Etiquetas de etapa: legacy del seed + stage keys del funnel derivado. Para
// etapas custom, el GET trae las labels reales del funnel del workspace.
const ETAPA_LABEL: Record<string, string> = {
  nutri: 'No Agenda', postagenda: 'Post-agenda', noshow: 'No Show', nopaga: 'No Paga', manual: 'Manual',
  noshow_r1: 'No Show R1', noshow_r2: 'No Show R2', noshow_r3: 'No Show R3',
  nocompro: 'No Compró', nutridiaria: 'Nutrición diaria', reactivacion: 'Reactivación',
  reunion_excepcional: 'Reunión excepcional',
};

const chip = (bg: string, color: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
  background: bg, color, fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap',
});
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' };

function Metrica({ label, valor }: { label: string; valor: number }) {
  return (
    <div style={{ minWidth: 74 }}>
      <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: '10.5px', color: 'var(--faint)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export function SettingApp() {
  const [jugadas, setJugadas] = useState<JugadaDto[] | null>(null);
  const [rolAdmin, setRolAdmin] = useState(false);
  const [objetivos, setObjetivos] = useState<Opcion[]>([]);
  const [etapas, setEtapas] = useState<Opcion[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<Array<{ id: string; nombre: string }>>([]);
  const [negocio, setNegocio] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Sub-tabs: los dos simuladores + el dashboard de métricas.
  const [vista, setVista] = useState<'whatsapp' | 'email' | 'dashboard'>('whatsapp');
  const [selJugadaId, setSelJugadaId] = useState<number | null>(null);
  // Wizard: null = cerrado; 'nueva' = jugada nueva; number = definir sobre esa secuencia.
  const [wizard, setWizard] = useState<null | 'nueva' | number>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/setting/jugadas', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'No se pudieron cargar las jugadas.'); setJugadas([]); return; }
      setJugadas(j.jugadas); setRolAdmin(Boolean(j.rolAdmin));
      setObjetivos(j.objetivos ?? []); setEtapas(j.etapas ?? []); setLeadMagnets(j.leadMagnets ?? []);
      setNegocio(j.negocio ?? '');
      setSelJugadaId((prev) => (prev != null && (j.jugadas as JugadaDto[]).some((x) => x.id === prev) ? prev : ((j.jugadas as JugadaDto[])[0]?.id ?? null)));
      setError(null);
    } catch {
      setError('Sin conexión — recargá la página.'); setJugadas([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const etiquetaEtapa = (key: string) => etapas.find((e) => e.value === key)?.label ?? ETAPA_LABEL[key] ?? key;
  const jugadaSel = (jugadas ?? []).find((j) => j.id === selJugadaId) ?? null;

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { ...tabActive, fontWeight: 500, background: 'transparent', color: 'var(--dim)' };

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '30px 36px 40px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 7px', color: 'var(--ink)' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="tag" size={34} /></span>
            Setting
          </h1>
          <div style={{ fontSize: '14.5px', color: 'var(--dim)' }}>
            Tus <strong style={{ color: 'var(--ink)' }}>jugadas</strong>: probalas en vivo, chateá como el lead y mirá cómo rinden.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, gap: 4 }}>
            <button onClick={() => setVista('whatsapp')} style={vista === 'whatsapp' ? tabActive : tabIdle}>WhatsApp</button>
            <button onClick={() => setVista('email')} style={vista === 'email' ? tabActive : tabIdle}>Email</button>
            <button onClick={() => setVista('dashboard')} style={vista === 'dashboard' ? tabActive : tabIdle}>Dashboard</button>
          </div>
          {rolAdmin && (
            <button onClick={() => setWizard('nueva')} style={btnDark}>+ Nueva jugada</button>
          )}
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, color: 'var(--bad)', fontSize: '13.5px' }}>{error}</div>
      )}

      {jugadas === null && <div style={{ color: 'var(--dim)', fontSize: '14px' }}>Cargando jugadas…</div>}

      {jugadas !== null && jugadas.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: '28px 24px', color: 'var(--dim)', fontSize: '14px', marginBottom: 14 }}>
          Todavía no hay secuencias en este workspace.{rolAdmin ? ' Arrancá con «+ Nueva jugada».' : ''}
        </div>
      )}

      {/* ── Simuladores (WhatsApp / Email): selector de jugada + vista ── */}
      {(vista === 'whatsapp' || vista === 'email') && jugadas !== null && jugadas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--faint)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Jugada</span>
            <Dropdown
              value={selJugadaId != null ? String(selJugadaId) : ''}
              onChange={(v) => setSelJugadaId(Number(v))}
              width="320px"
              ariaLabel="Elegir jugada"
              options={jugadas.map((j) => ({ value: String(j.id), label: `${j.nombre} · ${etiquetaEtapa(j.etapa)}` }))}
            />
            {jugadaSel && !jugadaSel.estrategia && rolAdmin && (
              <button onClick={() => setWizard(jugadaSel.id)} style={btnGhost}>⚑ Definir jugada</button>
            )}
            {jugadaSel?.estrategia && (
              <span style={{ fontSize: '12.5px', color: 'var(--dim)' }}>
                <strong style={{ color: 'var(--ink)' }}>{OBJETIVO_LABEL[jugadaSel.estrategia.objetivo]}</strong>
                {jugadaSel.estrategia.gancho ? <> · {jugadaSel.estrategia.gancho}</> : null}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
            {vista === 'whatsapp'
              ? <SimuladorWhatsApp jugada={jugadaSel} nombreNegocio={negocio} />
              : <SimuladorEmail jugada={jugadaSel} nombreNegocio={negocio} />}
          </div>
        </div>
      )}

      {/* ── Dashboard: la vista de jugadas + métricas ── */}
      <div style={{ display: vista === 'dashboard' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        {(jugadas ?? []).map((j) => (
          <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>{j.nombre}</span>
                <span style={chip('var(--surface-2)', 'var(--dim)')}>{etiquetaEtapa(j.etapa)}</span>
                <span style={j.activa ? chip('var(--good-bg)', 'var(--good)') : chip('var(--surface-2)', 'var(--faint)')}>{j.activa ? 'activa' : 'pausada'}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: '12.5px', color: 'var(--dim)' }}>
                {j.estrategia ? (
                  <>
                    <strong style={{ color: 'var(--ink)' }}>{OBJETIVO_LABEL[j.estrategia.objetivo]}</strong>
                    {j.estrategia.gancho ? <> · gancho: {j.estrategia.gancho}</> : null}
                    {j.estrategia.preguntas.length ? <> · {j.estrategia.preguntas.length} preguntas de cualificación</> : null}
                    {j.estrategia.probada_at ? <> · probada ✓</> : null}
                  </>
                ) : (
                  <span style={{ color: 'var(--faint)' }}>Sin jugada definida — {j.pasos.length} pasos sueltos</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Metrica label="Env. WA" valor={j.metricas.enviadosWa} />
              <Metrica label="Env. email" valor={j.metricas.enviadosEmail} />
              <Metrica label="Respuestas" valor={j.metricas.respuestas} />
              <Metrica label="Aperturas" valor={j.metricas.abiertos} />
              <Metrica label="Clics" valor={j.metricas.clics} />
              <Metrica label="Activos" valor={j.metricas.inscriptosActivos} />
            </div>
            {rolAdmin && (
              <button onClick={() => setWizard(j.id)} style={btnGhost}>
                {j.estrategia ? '✎ Editar jugada' : '⚑ Definir jugada'}
              </button>
            )}
          </div>
        ))}
      </div>

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
