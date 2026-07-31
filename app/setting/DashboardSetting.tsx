'use client';

// =============================================================================
// DashboardSetting — métricas del setting con gráficos (tab Dashboard de /setting)
// =============================================================================
// Mismo sistema de charts del repo (recharts, patrón de app/marketing/ad-charts):
// KPIs arriba, serie diaria de envíos/respuestas/aperturas (30 días), y la
// comparativa por jugada. Los datos vienen del GET de jugadas (serie incluida).

import { useMemo, type CSSProperties } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { JugadaDto, Opcion } from './SettingApp';
import type { PuntoSerie } from '@/lib/setting-metricas';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 };

const COLOR_WA = '#1E9E57';      // var(--wa)
const COLOR_EMAIL = '#6A4BD8';   // violeta del sistema de charts
const COLOR_RESP = '#C8870C';    // ámbar del sistema de charts

const pct = (num: number, den: number): string => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');

function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: '14px 18px', minWidth: 150, flex: '1 1 150px' }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function DashboardSetting({ jugadas, serie, etiquetaEtapa }: {
  jugadas: JugadaDto[];
  serie: PuntoSerie[];
  etiquetaEtapa: (key: string) => string;
  objetivos?: Opcion[];
}) {
  const tot = useMemo(() => jugadas.reduce((a, j) => ({
    wa: a.wa + j.metricas.enviadosWa,
    email: a.email + j.metricas.enviadosEmail,
    resp: a.resp + j.metricas.respuestas,
    abiertos: a.abiertos + j.metricas.abiertos,
    clics: a.clics + j.metricas.clics,
    activos: a.activos + j.metricas.inscriptosActivos,
  }), { wa: 0, email: 0, resp: 0, abiertos: 0, clics: 0, activos: 0 }), [jugadas]);
  const enviados = tot.wa + tot.email;

  const serieData = useMemo(() => serie.map((p) => ({
    dia: p.dia.slice(5).replace('-', '/'),
    WhatsApp: p.enviadosWa,
    Email: p.enviadosEmail,
    Respuestas: p.respuestas,
    Aperturas: p.abiertos,
  })), [serie]);

  const porJugada = useMemo(() => [...jugadas]
    .map((j) => ({
      nombre: j.nombre.length > 22 ? `${j.nombre.slice(0, 21)}…` : j.nombre,
      etapa: etiquetaEtapa(j.etapa),
      Enviados: j.metricas.enviadosWa + j.metricas.enviadosEmail,
      Respuestas: j.metricas.respuestas,
      Activos: j.metricas.inscriptosActivos,
    }))
    .sort((a, b) => (b.Enviados + b.Activos) - (a.Enviados + a.Activos))
    .slice(0, 8), [jugadas, etiquetaEtapa]);

  const sinDatos = enviados === 0 && tot.activos === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs — últimos 30 días */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi label="Enviados (30d)" valor={String(enviados)} sub={`${tot.wa} WhatsApp · ${tot.email} email`} />
        <Kpi label="Respuestas" valor={String(tot.resp)} sub={`tasa ${pct(tot.resp, enviados)}`} />
        <Kpi label="Aperturas email" valor={String(tot.abiertos)} sub={`tasa ${pct(tot.abiertos, tot.email)} · ${tot.clics} clics`} />
        <Kpi label="Leads en secuencia" valor={String(tot.activos)} sub={`${jugadas.filter((j) => j.activa).length} de ${jugadas.length} jugadas activas`} />
      </div>

      {sinDatos && (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.6 }}>
          Todavía no hay envíos registrados: los gráficos se llenan solos cuando prendas el <strong style={{ color: 'var(--ink)' }}>Envío real</strong> del canal y el motor empiece a mandar. Mientras, podés dejar las jugadas listas y probadas desde las tabs WhatsApp y Email.
        </div>
      )}

      {/* Serie diaria */}
      <div style={card}>
        <div style={sectLabel}>Actividad diaria · últimos 30 días</div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={serieData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} interval={4} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="WhatsApp" stackId="env" stroke={COLOR_WA} fill={COLOR_WA} fillOpacity={0.25} isAnimationActive={false} />
              <Area type="monotone" dataKey="Email" stackId="env" stroke={COLOR_EMAIL} fill={COLOR_EMAIL} fillOpacity={0.25} isAnimationActive={false} />
              <Area type="monotone" dataKey="Respuestas" stroke={COLOR_RESP} fill={COLOR_RESP} fillOpacity={0.12} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparativa por jugada */}
      <div style={card}>
        <div style={sectLabel}>Por jugada · enviados, respuestas y leads activos</div>
        <div style={{ width: '100%', height: Math.max(200, porJugada.length * 42) }}>
          <ResponsiveContainer>
            <BarChart data={porJugada} layout="vertical" margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="nombre" width={170} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }}
                formatter={(val, name) => [String(val), name as string] as [string, string]}
                labelFormatter={(l, payload) => { const p = (payload as unknown as Array<{ payload?: { etapa?: string } }>)?.[0]?.payload; return p?.etapa ? `${l} · ${p.etapa}` : String(l); }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Enviados" fill={COLOR_EMAIL} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              <Bar dataKey="Respuestas" fill={COLOR_RESP} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              <Bar dataKey="Activos" fill={COLOR_WA} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
