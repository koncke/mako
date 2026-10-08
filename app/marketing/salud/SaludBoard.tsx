'use client';

// =============================================================================
// SaludBoard — Estado de Meta (cuenta): banner + resumen de entrega + recos.
// =============================================================================
// La salud a nivel CUENTA. El árbol Campaña→Conjunto→Anuncio vive ahora en el
// navegador Ads Manager (/ads-manager). Acá: estado/pago de la cuenta,
// resumen de entrega, recomendaciones (Meta + MaKo) y "Analizar con MaKo".

import { useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import Link from '@/app/_ui/Link';
import { MakoButton } from '../../_components/ChartIA';
import { colorDeSemaforo, bgDeSemaforo, type MetaHealth, type Reco, type Semaforo } from '@/lib/meta-health-ui';

const MONO = "'Geist Mono', monospace";

/** Un monto en la moneda de la CUENTA de Meta, que no siempre es MXN (ws13, ws14 y ws15
 *  cobran en USD). Antes era `fmtMXN` y le ponía «MXN» al saldo de una cuenta en dólares. */
function fmtCuenta(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${moneda}`;
  }
}
function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function SaludBoard({ health }: { health: MetaHealth }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refrescar = () => startTransition(() => router.refresh());

  const a = health.account;
  const r = health.resumen;
  const ctxCuenta = [
    `Estado de la cuenta publicitaria de Meta. Estado: ${a.statusLabel} (severidad ${a.severidad}).`,
    a.entregaFrenada ? 'La entrega está FRENADA: las campañas figuran activas pero Meta no está entregando.' : '',
    `Saldo adeudado ${fmtCuenta(a.balanceMxn, a.currency)}${a.currency === 'USD' ? '' : ` (~${fmtUSD(a.balanceUsd)})`}. Total gastado histórico ${fmtCuenta(a.amountSpentMxn, a.currency)}. Medio de pago: ${a.fundingCard ?? '—'}.`,
    `Entrega ahora: ${r.activos} anuncios activos, ${r.aprendizaje} conjuntos en aprendizaje, ${r.enRevision} anuncios en revisión, ${r.pausados} pausados, ${r.rechazados} rechazados/con problemas.`,
    health.recomendaciones.length
      ? `Recomendaciones (Meta primero + MaKo):\n${health.recomendaciones.map((x) => `- [${x.prioridad}/${x.fuente}] ${x.titulo}: ${x.detalle}`).join('\n')}`
      : 'Meta no devolvió recomendaciones nativas por API (cuenta restringida / sin ads_management).',
  ].filter(Boolean).join('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <MakoButton chartKey="meta-cuenta" titulo="Estado de la cuenta de Meta" contexto={ctxCuenta} sugerencias={['¿Qué hago primero?', '¿Por qué no está entregando?', '¿Cómo recupero el ritmo?', '¿Qué riesgos ves?']} />
        <Link href="/ads-manager" style={{ marginLeft: 'auto', padding: '9px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>◫ Ads Manager →</Link>
        <button type="button" onClick={refrescar} disabled={pending} style={{ padding: '9px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}>{pending ? 'Actualizando…' : '↻ Actualizar'}</button>
      </div>

      <BannerCuenta account={a} fetchedAtISO={health.fetchedAtISO} parcial={health.parcial} />
      <ResumenEntrega resumen={r} totalAds={health.ads.length} totalAdsets={health.adsets.length} totalCampaigns={health.campaigns.length} />
      <Recomendaciones recos={health.recomendaciones} recosMetaDisponibles={health.recosMetaDisponibles} />

      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6 }}>
        Estado en vivo de Meta Ads · v25.0. El detalle por campaña/conjunto/anuncio vive en <Link href="/ads-manager" style={{ color: 'var(--primary)' }}>Ads Manager</Link>.
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner de cuenta
// ─────────────────────────────────────────────────────────────────────────────

function BannerCuenta({ account, fetchedAtISO, parcial }: { account: MetaHealth['account']; fetchedAtISO: string; parcial: boolean }) {
  const color = colorDeSemaforo(account.severidad);
  const bg = bgDeSemaforo(account.severidad);
  const hora = (() => { try { return new Date(fetchedAtISO).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();

  const stats: Array<{ label: string; value: string; sub?: string; danger?: boolean }> = [
    { label: 'Saldo adeudado', value: fmtCuenta(account.balanceMxn, account.currency), sub: account.balanceMxn > 0 ? (account.currency === 'USD' ? undefined : `≈ ${fmtUSD(account.balanceUsd)}`) : 'sin deuda', danger: account.balanceMxn > 0 && account.severidad !== 'verde' },
    { label: 'Medio de pago', value: account.fundingCard ?? (account.isPrepay ? 'Prepago' : '—'), sub: account.isPrepay ? 'cuenta prepago' : undefined },
    { label: 'Total gastado', value: fmtCuenta(account.amountSpentMxn, account.currency), sub: 'histórico de la cuenta' },
    { label: 'Tope de gasto', value: account.spendCapMxn ? fmtCuenta(account.spendCapMxn, account.currency) : 'sin tope', sub: account.currency },
  ];

  return (
    <section style={{ background: 'var(--surface)', border: `1px solid ${account.severidad === 'verde' ? 'var(--border)' : color}`, borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, flex: 'none', borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: color, boxShadow: account.severidad !== 'verde' ? `0 0 16px ${color}` : 'none' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Cuenta publicitaria</div>
          <h2 style={{ fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', margin: 0, color }}>{account.statusLabel}</h2>
        </div>
      </div>

      {account.entregaFrenada && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--bad)', margin: 0 }}>Las campañas figuran activas, pero la cuenta no está entregando.</p>
          <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '4px 0 0' }}>
            {account.disableReasonLabel ? `Motivo: ${account.disableReasonLabel}. ` : ''}
            Regulariza el pago en el Administrador de Anuncios para reanudar la entrega.
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
        <span>{parcial ? '⚠ Algunos datos de campañas/anuncios no cargaron — reintenta.' : 'Datos completos.'}</span>
        {hora && <span>actualizado {hora}</span>}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen de entrega
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
// Recomendaciones (Meta nativas + sugerencias derivadas MaKo)
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
          ? 'MaKo le pregunta a Meta primero: incluye recomendaciones nativas de Meta y sugerencias derivadas de MaKo.'
          : 'Meta no devolvió recomendaciones por API para esta cuenta (restringida / sin ads_management). Estas las deriva MaKo del estado real de cuenta, aprendizaje y rechazos.'}
      </p>

      {recos.length === 0 ? (
        <div style={{ background: 'var(--good-bg)', border: '1px solid var(--good)', borderRadius: 12, padding: '15px 18px', fontSize: 14, color: 'var(--dim)' }}>
          Sin acciones urgentes — la cuenta entrega y no hay rechazos. Buen momento para empujar volumen.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recos.map((rec, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `4px solid ${colorDeSemaforo(rec.semaforo)}`, borderRadius: 12, padding: '15px 18px' }}>
              <span style={{ flex: 'none', marginTop: 3, width: 11, height: 11, borderRadius: '50%', background: colorDeSemaforo(rec.semaforo) }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{rec.titulo}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: colorDeSemaforo(rec.semaforo), background: bgDeSemaforo(rec.semaforo), padding: '2px 8px', borderRadius: 6 }}>{PRIORIDAD_LABEL[rec.prioridad]}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{rec.fuente === 'meta' ? 'Meta' : 'MaKo'}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{rec.detalle}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
