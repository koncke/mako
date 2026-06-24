'use client';

// =============================================================================
// SaludBoard — banner de cuenta + resumen de entrega + recomendaciones + árbol
// Campaña→Conjunto→Anuncio con estado real de Meta. Client component para los
// filtros (Dropdown), el colapsado del árbol y el botón "Actualizar".
// =============================================================================

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dropdown } from '../../components/Dropdown';
import {
  colorDeSemaforo,
  bgDeSemaforo,
  type MetaHealth,
  type NodoEstado,
  type Reco,
  type Semaforo,
} from '@/lib/meta-health';

const MONO = "'Geist Mono', monospace";

function fmtMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);
}
function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── Pill de estado (color + etiqueta) ──
function Pill({ semaforo, label, small = false }: { semaforo: Semaforo; label: string; small?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
      fontFamily: MONO, fontSize: small ? 11 : 12, fontWeight: 600, letterSpacing: '.02em',
      padding: small ? '3px 9px' : '4px 11px', borderRadius: 999,
      color: colorDeSemaforo(semaforo), background: bgDeSemaforo(semaforo),
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: colorDeSemaforo(semaforo), flex: 'none' }} />
      {label}
    </span>
  );
}

export function SaludBoard({ health }: { health: MetaHealth }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refrescar = () => startTransition(() => router.refresh());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      <BannerCuenta account={health.account} onRefresh={refrescar} pending={pending} fetchedAtISO={health.fetchedAtISO} parcial={health.parcial} />
      <ResumenEntrega resumen={health.resumen} totalAds={health.ads.length} totalAdsets={health.adsets.length} totalCampaigns={health.campaigns.length} />
      <Recomendaciones recos={health.recomendaciones} recosMetaDisponibles={health.recosMetaDisponibles} />
      <ArbolEntrega health={health} />
      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6 }}>
        Estado en vivo de Meta Ads · v25.0. Para el <Link href="/marketing/anuncios" style={{ color: 'var(--accent)' }}>rendimiento por anuncio (agendas/leads/cierres)</Link> mirá Anuncios ganadores.
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — Banner de cuenta
// ─────────────────────────────────────────────────────────────────────────────

function BannerCuenta({ account, onRefresh, pending, fetchedAtISO, parcial }: {
  account: MetaHealth['account']; onRefresh: () => void; pending: boolean; fetchedAtISO: string; parcial: boolean;
}) {
  const color = colorDeSemaforo(account.severidad);
  const bg = bgDeSemaforo(account.severidad);
  const hora = (() => { try { return new Date(fetchedAtISO).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();

  const stats: Array<{ label: string; value: string; sub?: string; danger?: boolean }> = [
    { label: 'Saldo adeudado', value: fmtMXN(account.balanceMxn), sub: account.balanceMxn > 0 ? `≈ ${fmtUSD(account.balanceUsd)}` : 'sin deuda', danger: account.balanceMxn > 0 && account.severidad !== 'verde' },
    { label: 'Medio de pago', value: account.fundingCard ?? (account.isPrepay ? 'Prepago' : '—'), sub: account.isPrepay ? 'cuenta prepago' : undefined },
    { label: 'Total gastado', value: fmtMXN(account.amountSpentMxn), sub: 'histórico de la cuenta' },
    { label: 'Tope de gasto', value: account.spendCapMxn ? fmtMXN(account.spendCapMxn) : 'sin tope', sub: account.currency },
  ];

  return (
    <section style={{ background: 'var(--surface)', border: `1px solid ${account.severidad === 'verde' ? 'var(--border)' : color}`, borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{ width: 52, height: 52, flex: 'none', borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: color, boxShadow: account.severidad !== 'verde' ? `0 0 16px ${color}` : 'none' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Cuenta publicitaria</div>
            <h2 style={{ fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', margin: 0, color }}>{account.statusLabel}</h2>
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={pending}
          style={{ flex: 'none', padding: '9px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Actualizando…' : '↻ Actualizar'}
        </button>
      </div>

      {account.entregaFrenada && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--bad)', margin: 0 }}>Las campañas figuran activas, pero la cuenta no está entregando.</p>
          <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '4px 0 0' }}>
            {account.disableReasonLabel ? `Motivo: ${account.disableReasonLabel}. ` : ''}
            Regularizá el pago en el Administrador de Anuncios para reanudar la entrega.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', color: s.danger ? 'var(--bad)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>{s.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flexWrap: 'wrap' }}>
        <span>{parcial ? '⚠ Algunos datos de campañas/anuncios no cargaron — reintentá.' : 'Datos completos.'}</span>
        {hora && <span>actualizado {hora}</span>}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — Resumen de entrega
// ─────────────────────────────────────────────────────────────────────────────

function ResumenEntrega({ resumen, totalAds, totalAdsets, totalCampaigns }: {
  resumen: MetaHealth['resumen']; totalAds: number; totalAdsets: number; totalCampaigns: number;
}) {
  const cards: Array<{ label: string; n: number; semaforo: Semaforo }> = [
    { label: 'Anuncios activos', n: resumen.activos, semaforo: 'verde' },
    { label: 'Conjuntos en aprendizaje', n: resumen.aprendizaje, semaforo: 'ambar' },
    { label: 'Anuncios en revisión', n: resumen.enRevision, semaforo: 'ambar' },
    { label: 'Anuncios pausados', n: resumen.pausados, semaforo: 'gris' },
    { label: 'Rechazados / con problemas', n: resumen.rechazados, semaforo: 'rojo' },
  ];
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Resumen de entrega</h2>
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>{totalCampaigns} campañas · {totalAdsets} conjuntos · {totalAds} anuncios</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: `3px solid ${colorDeSemaforo(c.semaforo)}`, borderRadius: 14, padding: '18px 18px' }}>
            <div style={{ fontWeight: 600, fontSize: 34, letterSpacing: '-0.03em', color: c.n > 0 ? colorDeSemaforo(c.semaforo) : 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{c.n}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 10 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — Recomendaciones (Meta nativas + sugerencias derivadas MaKo)
// ─────────────────────────────────────────────────────────────────────────────

const PRIORIDAD_LABEL: Record<Reco['prioridad'], string> = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

function Recomendaciones({ recos, recosMetaDisponibles }: { recos: Reco[]; recosMetaDisponibles: boolean }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Recomendaciones</h2>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{recos.length} para decidir</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '0 0 18px' }}>
        {recosMetaDisponibles
          ? 'Incluye recomendaciones de Meta y sugerencias derivadas de MaKo.'
          : 'Meta no expone su Opportunity Score por API para esta cuenta. Estas sugerencias las deriva MaKo del estado real de cuenta, aprendizaje y rechazos.'}
      </p>

      {recos.length === 0 ? (
        <div style={{ background: 'var(--good-bg)', border: '1px solid var(--good)', borderRadius: 12, padding: '15px 18px', fontSize: 14, color: 'var(--dim)' }}>
          Sin acciones urgentes — la cuenta entrega y no hay rechazos. Buen momento para empujar volumen.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recos.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `4px solid ${colorDeSemaforo(r.semaforo)}`, borderRadius: 12, padding: '15px 18px' }}>
              <span style={{ flex: 'none', marginTop: 3, width: 11, height: 11, borderRadius: '50%', background: colorDeSemaforo(r.semaforo) }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: colorDeSemaforo(r.semaforo), background: bgDeSemaforo(r.semaforo), padding: '2px 8px', borderRadius: 6 }}>{PRIORIDAD_LABEL[r.prioridad]}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.fuente === 'meta' ? 'Meta' : 'MaKo'}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{r.detalle}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 — Árbol Campaña → Conjunto → Anuncio
// ─────────────────────────────────────────────────────────────────────────────

type EstadoFiltro = 'all' | 'verde' | 'ambar' | 'gris' | 'rojo';
const ESTADO_OPCIONES = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'rojo', label: 'Rechazados / con problemas', color: 'var(--bad)' },
  { value: 'ambar', label: 'En revisión / aprendizaje', color: 'var(--warn-fill)' },
  { value: 'verde', label: 'Activos', color: 'var(--good)' },
  { value: 'gris', label: 'Pausados', color: 'var(--dim)' },
];

function ArbolEntrega({ health }: { health: MetaHealth }) {
  const [campana, setCampana] = useState('all');
  const [estado, setEstado] = useState<EstadoFiltro>('all');

  // Índices jerárquicos.
  const adsetsByCampaign = useMemo(() => {
    const m = new Map<string, NodoEstado[]>();
    for (const a of health.adsets) {
      const k = a.parentId ?? 'sin-campana';
      const arr = m.get(k);
      if (arr) arr.push(a); else m.set(k, [a]);
    }
    return m;
  }, [health.adsets]);
  const adsByAdset = useMemo(() => {
    const m = new Map<string, NodoEstado[]>();
    for (const a of health.ads) {
      const k = a.parentId ?? 'sin-conjunto';
      const arr = m.get(k);
      if (arr) arr.push(a); else m.set(k, [a]);
    }
    return m;
  }, [health.ads]);

  const opcionesCampana = useMemo(() => [
    { value: 'all', label: 'Todas las campañas' },
    ...health.campaigns.map((c) => ({ value: c.id, label: c.name, color: colorDeSemaforo(c.semaforo) })),
  ], [health.campaigns]);

  const matchEstado = (n: NodoEstado) => estado === 'all' || n.semaforo === estado;
  const campañasVisibles = health.campaigns.filter((c) => campana === 'all' || c.id === campana);

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Campañas, conjuntos y anuncios</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Dropdown value={campana} options={opcionesCampana} onChange={setCampana} ariaLabel="Filtrar por campaña" width={240} />
          <Dropdown value={estado} options={ESTADO_OPCIONES} onChange={(v) => setEstado(v as EstadoFiltro)} ariaLabel="Filtrar por estado" width={230} />
        </div>
      </div>

      {campañasVisibles.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>No hay campañas en la cuenta.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {campañasVisibles.map((c) => (
            <CampanaRow
              key={c.id}
              campana={c}
              adsets={adsetsByCampaign.get(c.id) ?? []}
              adsByAdset={adsByAdset}
              matchEstado={matchEstado}
              estadoActivo={estado !== 'all'}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CampanaRow({ campana, adsets, adsByAdset, matchEstado, estadoActivo }: {
  campana: NodoEstado; adsets: NodoEstado[]; adsByAdset: Map<string, NodoEstado[]>;
  matchEstado: (n: NodoEstado) => boolean; estadoActivo: boolean;
}) {
  // Con filtro de estado: solo mostrar conjuntos que tengan algún anuncio que matchee.
  const adsetsFiltrados = estadoActivo
    ? adsets.filter((as) => (adsByAdset.get(as.id) ?? []).some(matchEstado))
    : adsets;
  // Auto-abrir si la campaña tiene problemas (rojo) o si hay filtro activo.
  const tieneProblema = adsets.some((as) => (adsByAdset.get(as.id) ?? []).some((ad) => ad.semaforo === 'rojo')) || campana.semaforo === 'rojo';
  const [open, setOpen] = useState(tieneProblema || estadoActivo);
  if (estadoActivo && adsetsFiltrados.length === 0) return null;

  const totalAds = adsets.reduce((s, as) => s + (adsByAdset.get(as.id)?.length ?? 0), 0);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface-2)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 12, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campana.name}</span>
          <span style={{ display: 'block', fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{adsets.length} conjunto{adsets.length === 1 ? '' : 's'} · {totalAds} anuncio{totalAds === 1 ? '' : 's'}</span>
        </span>
        <Pill semaforo={campana.semaforo} label={campana.statusLabel} />
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {adsetsFiltrados.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--faint)', margin: '4px 0' }}>Esta campaña no tiene conjuntos.</p>
          ) : (
            adsetsFiltrados.map((as) => (
              <AdsetRow key={as.id} adset={as} ads={adsByAdset.get(as.id) ?? []} matchEstado={matchEstado} estadoActivo={estadoActivo} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdsetRow({ adset, ads, matchEstado, estadoActivo }: {
  adset: NodoEstado; ads: NodoEstado[]; matchEstado: (n: NodoEstado) => boolean; estadoActivo: boolean;
}) {
  const adsFiltrados = estadoActivo ? ads.filter(matchEstado) : ads;
  const tieneProblema = ads.some((ad) => ad.semaforo === 'rojo');
  const [open, setOpen] = useState(tieneProblema || estadoActivo);
  if (estadoActivo && adsFiltrados.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.name}</span>
          <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{ads.length} anuncio{ads.length === 1 ? '' : 's'}</span>
        </span>
        {adset.learning && <Pill semaforo={adset.learning.semaforo} label={adset.learning.label} small />}
        <Pill semaforo={adset.semaforo} label={adset.statusLabel} small />
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {adsFiltrados.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '4px 0' }}>Sin anuncios.</p>
          ) : (
            adsFiltrados.map((ad) => <AdRow key={ad.id} ad={ad} />)
          )}
        </div>
      )}
    </div>
  );
}

function AdRow({ ad }: { ad: NodoEstado }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</span>
        <Pill semaforo={ad.semaforo} label={ad.statusLabel} small />
      </div>
      {ad.issues && ad.issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 2 }}>
          {ad.issues.map((iss, i) => (
            <span key={i} style={{ fontSize: 12, color: 'var(--bad)' }}>
              ⚠ {iss.resumen}{iss.mensaje ? ` — ${iss.mensaje}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
