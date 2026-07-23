'use client';

// =============================================================================
// IntegracionesBoard — estado de servicios + Costo de MaKo + detalle en modales
// =============================================================================
// Rediseño (Claude Design "Integraciones MaKo"): header con medidor de salud,
// "Requiere tu atención", "Servicios" agrupados por categoría, "Costo de MaKo"
// (proveedores + gasto por proceso + modal de operaciones filtrable) e
// "Historial de problemas". Todo alimentado con data REAL:
//   · integraciones (estado conectada/falta) — getIntegraciones()
//   · health (detalle en vivo de Meta) — getMetaHealth()
//   · historial (estados negativos de Meta) — getHistorialMeta()
//   · usage (/api/anthropic-usage) — gasto de IA por proveedor/proceso/operación
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MakoStar } from '../_components/MakoBrand';
import { BrandDefs, SvcIcon } from '../_components/ServicioVisual';
import { Carrusel, EnlaceMaKo } from '../_components/PanelMarketing';
import { SLIDES, type Slide } from '@/lib/servicio-slides';
import type { MetaHealth } from '@/lib/meta-health-ui';
import { procesoLegible, proveedorLegible, modeloLegible, motivoLegible, ordenIA, IA_ORDEN, esIAdePago } from '@/lib/ia-labels';
import type { CuotaProv } from '@/lib/ia-cuotas';
import { servicioMetodo } from '@/lib/metodo-catalogo';
import { agenteSkillMarkdown, AGENTE_SKILL_PATH } from '@/lib/agente-skill';
import ServicioConfigForm from './ServicioConfigForm';

const MONO = "'Geist Mono', monospace";

// ── Tipos ──────────────────────────────────────────────────────────────────
type Integracion = { key: string; nombre: string; categoria: string; descripcion: string; estado: 'conectada' | 'falta'; detalle: string; tieneDetalle?: boolean };
// Incidente con período: startedAt → resolvedAt (null = en curso). Viene del server.
type Incidente = { id: number; service: string; severidad: string; statusLabel: string; disableReason: string | null; entregaFrenada: boolean; detalle: string | null; startedAt: string; resolvedAt: string | null };

type Movimiento = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type Saldo = { usd: number; setAt: string; cargas?: Array<{ usd: number; at: string }> };
type ProvSaldo = { provider: string; costMesUsd: number; tokens: number; tokensHoy: number; saldo: Saldo | null; restanteUsd: number | null; gratis: boolean };

// Límite del plan GRATIS por proveedor (para el gauge de "uso de hoy"). NO es el mismo
// para todos: Groq topea por TOKENS/día; Gemini Flash NO tiene tope diario de tokens
// sino 250 SOLICITUDES/día + 250k tokens/MINUTO + 1M de contexto. Por eso Gemini se
// muestra sin denominador de tokens inventado (antes copiaba el 500k de Groq → mal).
const LIMITE_FREE: Record<string, { tokensDia?: number; cap: string }> = {
  groq: { tokensDia: 500_000, cap: 'tokens · el plan gratis reinicia cada día' },
  gemini: { cap: 'Gemini free: 250 solicitudes/día · 250k tokens/día · 1M de contexto' },
  cerebras: { cap: 'Cerebras free: gratis, limitado por rate (pedidos/min), no por dinero' },
  mistral: { cap: 'Mistral free tier (plan Experiment): limitado por rate, sin cargo' },
  openrouter: { cap: 'OpenRouter: los modelos ":free" no cobran (rate diario)' },
};
type Resumen = {
  saldo: { usd: number; setAt: string } | null;
  gastadoMesUsd: number;
  restanteUsd: number | null;
  porFeature?: Array<{ feature: string; costUsd: number; tokens: number }>;
  porProveedor?: ProvSaldo[];
  historial?: Movimiento[];
};

// ── Helpers de formato ───────────────────────────────────────────────────────
const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 3 : 4)}`);
const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const mxn = (n: number) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// De la cuota GRATIS de hoy, elige la métrica que MANDA (la de mayor % consumido:
// pedidos/día o tokens/día) y la deja lista para el gauge "cuánto queda". Así cada
// proveedor muestra su tope real (Gemini por pedidos, Groq por tokens, etc.).
function cuotaVista(c: CuotaProv): { usados: string; limite: string; pct: number; unidad: string; agotado: boolean } {
  const rT = c.tokensDia ? c.tokens / c.tokensDia : 0;
  const rR = c.rpd ? c.requests / c.rpd : 0;
  const pct = Math.min(100, Math.max(2, Math.round(c.pct * 100)));
  if (c.tokensDia != null && rT >= rR) return { usados: fmtTok(c.tokens), limite: fmtTok(c.tokensDia), pct, unidad: 'tok', agotado: c.agotado };
  if (c.rpd != null) return { usados: String(c.requests), limite: String(c.rpd), pct, unidad: 'pedidos', agotado: c.agotado };
  return { usados: fmtTok(c.tokens), limite: '—', pct: 2, unidad: 'tok', agotado: c.agotado };
}


const Spark = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ overflow: 'visible', flex: 'none' }}>
    <path d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z" fill="url(#mkGold)" />
  </svg>
);

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const capMono: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)' };

// Orden de categorías del diseño.
const CAT_ORDER = ['Publicidad', 'Mensajería', 'Inteligencia', 'IA Generativa', 'Agentes', 'Reuniones', 'Datos'];

// Servicios sintéticos: no están en el catálogo de integraciones pero tienen modal
// propio (Groq es gratis y aparece en Costo de MaKo → su tile abre este modal).
const SYNTHETIC: Record<string, Integracion> = {
  groq: { key: 'groq', nombre: 'Groq', categoria: 'Inteligencia', descripcion: 'IA rápida y gratuita para tareas simples y transcripción. Limitada por rate (tokens/día del plan gratis), no por saldo.', estado: 'conectada', detalle: '' },
};

// Duración legible de un incidente (inicio → fin).
function fmtDuracion(desde: string, hasta: string): string {
  const ms = new Date(hasta).getTime() - new Date(desde).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24), hr = h % 24;
  return hr ? `${d} d ${hr} h` : `${d} d`;
}

// ── Board ─────────────────────────────────────────────────────────────────────
export function IntegracionesBoard({ integraciones, health, metaError, incidentes, snippetLanding, cuotas = [], agenteToken, appUrl }: {
  integraciones: Integracion[];
  health: MetaHealth | null;
  metaError: string | null;
  incidentes: Incidente[];
  /** <script> con el token del workspace, listo para copiar. null = admin sin impersonar. */
  snippetLanding?: string | null;
  /** Cuota gratis consumida hoy por cada IA barata (gauge "cuánto queda"). */
  cuotas?: CuotaProv[];
  /** Token del agente externo (Claude Code). null = todavía no acuñó ninguno. */
  agenteToken?: string | null;
  /** URL absoluta de la app, para embeberla en la skill que se copia. */
  appUrl?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<Resumen | null>(null);
  const [modal, setModal] = useState<{ t: 'svc'; key: string } | { t: 'hist' } | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/anthropic-usage')).json(); if (j?.ok) setUsage(j as Resumen); } catch { /* offline */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // El toast global (y el chip de la sidebar) linkean con ?ops=1 → abrimos el
  // historial de operaciones. Consumimos el flag al instante (router.replace) para
  // que un segundo click del toast (mismo ?ops=1) vuelva a ser un cambio '' → 'ops=1'
  // y reabra el modal aunque lo hayas cerrado con Escape.
  useEffect(() => {
    if (searchParams.get('ops') === '1') {
      setModal({ t: 'hist' });
      router.replace('/integraciones#saldo-ia', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const metaSev = health?.account.severidad ?? null;
  const total = integraciones.length;

  // Severidad efectiva de un servicio: Meta usa su semáforo en vivo (o 'bad' si el
  // token está presente pero la lectura en vivo falló); el resto, conectada (verde)
  // vs falta de config (ámbar "Por configurar", NO rojo: todavía no es un incidente).
  const sevOf = (i: Integracion): 'good' | 'warn' | 'bad' => {
    if (i.key === 'meta') {
      if (metaSev) return metaSev === 'verde' ? 'good' : metaSev === 'ambar' ? 'warn' : 'bad';
      if (metaError) return 'bad';
    }
    return i.estado === 'conectada' ? 'good' : 'warn';
  };
  const dotColor = (s: 'good' | 'warn' | 'bad') => (s === 'good' ? 'var(--good)' : s === 'warn' ? 'var(--warn-fill)' : 'var(--bad)');
  const conectadas = integraciones.filter((i) => sevOf(i) === 'good').length;
  // Resuelve un servicio por key incluyendo entradas sintéticas (Groq tiene tile en
  // Costo de MaKo pero no está en el catálogo de integraciones → su modal usa esto).
  const svcByKey = (key: string): Integracion | null => integraciones.find((x) => x.key === key) ?? SYNTHETIC[key] ?? null;

  // ── Requiere atención: servicios en falta + Meta si no está verde ──
  // (Sin useMemo: el React Compiler memoiza; el useMemo manual con el closure
  // sevOf le impedía optimizar.)
  const atencion: Array<{ i: Integracion; sev: 'warn' | 'bad'; motivo: string }> = [];
  for (const i of integraciones) {
    const s = sevOf(i);
    if (s === 'good') continue;
    // El agente (Claude Code) es OPCIONAL y se instala del lado del usuario: mientras
    // no tenga token queda "Por configurar" en la grilla (honesto), pero no es un
    // pendiente que haya que resolver → no lo empujamos a "Requiere tu atención"
    // (sería ruido para un cliente que ni programa).
    if (i.key === 'agente') continue;
    let motivo = i.estado === 'falta' ? i.detalle : 'Requiere atención';
    if (i.key === 'meta') {
      motivo = health
        ? (health.account.entregaFrenada ? 'Entrega frenada' : (health.account.disableReasonLabel || health.account.statusLabel || 'Requiere atención'))
        : 'No se pudo leer el estado de Meta';
    }
    atencion.push({ i, sev: s === 'bad' ? 'bad' : 'warn', motivo });
  }

  // ── Servicios por categoría ──
  const porCategoria = CAT_ORDER
    // En Inteligencia el orden manda: primero las de pago (Claude/OpenAI/Gemini),
    // después las gratis. ordenIA() da 99 a las no-IA → el resto queda como estaba.
    .map((cat) => ({ cat, items: integraciones.filter((i) => i.categoria === cat).slice().sort((a, b) => ordenIA(a.key) - ordenIA(b.key)) }))
    .filter((g) => g.items.length > 0);

  // Medidor: una barra por servicio, verde las conectadas, roja/ámbar el resto.
  const bars = integraciones.map((i) => dotColor(sevOf(i)));

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '30px 42px 90px' }}>
      <BrandDefs />

      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v4M15 2v4" /><path d="M6.5 6h11v4a5.5 5.5 0 0 1-11 0z" /><path d="M12 15.5V22" /></svg>
          </div>
          <div>
            <div style={{ ...capMono, fontSize: 10.5, letterSpacing: '.14em', marginBottom: 6 }}>Configuración</div>
            <h1 style={{ fontWeight: 700, fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Integraciones</h1>
          </div>
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '12px 18px' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {bars.map((c, idx) => <span key={idx} style={{ width: 6, height: 16, borderRadius: 3, background: c }} />)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{conectadas}<span style={{ color: 'var(--faint)', fontSize: 14 }}> / {total}</span></span>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>conectados</span>
          </div>
        </div>
      </div>

      {/* ═══ REQUIERE ATENCIÓN ═══ */}
      {atencion.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <Spark />
            <h2 style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Requiere tu atención</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 21, height: 21, padding: '0 7px', borderRadius: 999, background: 'var(--bad-bg)', color: 'var(--bad)', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{atencion.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
            {atencion.map(({ i, sev, motivo }) => (
              <div key={i.key} style={{ ...card, borderLeft: `4px solid ${sev === 'bad' ? 'var(--bad)' : 'var(--warn-fill)'}`, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <SvcIcon k={i.key} box={44} radius={12} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: sev === 'bad' ? 'var(--bad)' : 'var(--warn)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{motivo}</div>
                  <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{i.nombre}</div>
                </div>
                <button type="button" onClick={() => setModal({ t: 'svc', key: i.key })} style={{ flex: 'none', border: sev === 'bad' ? 0 : '1px solid var(--border-strong)', borderRadius: 10, background: sev === 'bad' ? 'var(--primary)' : 'var(--surface)', color: sev === 'bad' ? '#fff' : 'var(--ink)', fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13.5, padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{sev === 'bad' ? 'Resolver' : 'Configurar'}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ SERVICIOS ═══ */}
      <section style={{ ...card, marginTop: 32, padding: '8px 30px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '18px 0 16px' }}>
          <h2 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.017em', margin: 0, color: 'var(--ink)' }}>Servicios</h2>
          <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
            {([['var(--good)', 'Conectado'], ['var(--warn-fill)', 'Por configurar'], ['var(--bad)', 'Atención']] as const).map(([c, l]) => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dim)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</span>
            ))}
          </div>
        </div>
        {porCategoria.map((g) => {
          const svcBtn = (i: Integracion) => (
            <button key={i.key} type="button" onClick={() => setModal({ t: 'svc', key: i.key })} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px' }}>
              <SvcIcon k={i.key} />
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nombre}</span>
              <span style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: dotColor(sevOf(i)) }} />
            </button>
          );
          const grid = (items: Integracion[]) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>{items.map(svcBtn)}</div>;
          // En Inteligencia partimos en dos filas: primero las de pago, después las gratis.
          const esIA = g.cat === 'Inteligencia';
          const pago = esIA ? g.items.filter((i) => esIAdePago(i.key)) : g.items;
          const gratis = esIA ? g.items.filter((i) => !esIAdePago(i.key)) : [];
          return (
            <div key={g.cat} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 24, alignItems: esIA ? 'start' : 'center', padding: '18px 0', borderTop: '1px solid var(--surface-2)' }}>
              <div style={{ ...capMono, marginTop: esIA ? 3 : 0 }}>{g.cat}</div>
              {esIA ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ ...capMono, fontSize: 9, letterSpacing: '.11em', color: 'var(--faint)', marginBottom: 7 }}>De pago</div>
                    {grid(pago)}
                  </div>
                  <div>
                    <div style={{ ...capMono, fontSize: 9, letterSpacing: '.11em', color: 'var(--faint)', marginBottom: 7 }}>Gratis · rotan sin costo</div>
                    {grid(gratis)}
                  </div>
                </div>
              ) : grid(g.items)}
            </div>
          );
        })}
      </section>

      {/* ═══ COSTO DE MAKO ═══ */}
      <CostoMaKo usage={usage} cuotas={cuotas} onVerOps={() => setModal({ t: 'hist' })} onOpenService={(key) => setModal({ t: 'svc', key })} />

      {/* ═══ HISTORIAL DE PROBLEMAS ═══ */}
      <ProblemasHistorial incidentes={incidentes} nombreDe={(s) => svcByKey(s)?.nombre ?? s} />

      {/* ═══ MODALES ═══ */}
      {modal?.t === 'svc' && svcByKey(modal.key) && (
        <ServicioModal
          i={svcByKey(modal.key)!}
          sev={sevOf(svcByKey(modal.key)!)}
          health={health} metaError={metaError} usage={usage}
          cuota={cuotas.find((c) => c.provider === modal.key) ?? null}
          snippetLanding={snippetLanding}
          agenteToken={agenteToken ?? null}
          appUrl={appUrl ?? ''}
          onClose={() => setModal(null)}
          // Al guardar saldo/créditos: refetch del uso (client) + refresh del server
          // (para que las cuotas de Gemini pago se recalculen). Gemini free→pago se ve al toque.
          onRefetchUsage={() => { cargar(); router.refresh(); }}
          // `integraciones` viene del server component: al guardar/quitar una
          // credencial hay que pedirle el estado de nuevo, si no el board sigue
          // mostrando lo de antes. El modal no se cierra: `modal` guarda la key.
          onCambio={() => router.refresh()}
        />
      )}
      {modal?.t === 'hist' && usage && (
        <OperacionesModal usage={usage} onClose={() => setModal(null)} />
      )}
    </main>
  );
}

// ── Costo de MaKo ─────────────────────────────────────────────────────────────
function CostoMaKo({ usage, cuotas, onVerOps, onOpenService }: { usage: Resumen | null; cuotas: CuotaProv[]; onVerOps: () => void; onOpenService: (key: string) => void }) {
  // Un tile por proveedor que consumió algo + uno por CADA IA gratis registrada aunque
  // todavía no se haya usado (item "cargalos como otro contenedor"): esos salen del
  // catálogo de cuotas con uso 0, así Cerebras/Mistral/OpenRouter siempre tienen su caja.
  const provsBase = usage?.porProveedor ?? [];
  const provs: ProvSaldo[] = [
    ...provsBase,
    ...cuotas.filter((c) => !provsBase.some((p) => p.provider === c.provider))
      .map((c): ProvSaldo => ({ provider: c.provider, costMesUsd: 0, tokens: 0, tokensHoy: c.tokens, saldo: null, restanteUsd: null, gratis: true })),
  ].sort((a, b) => ordenIA(a.provider) - ordenIA(b.provider)); // pago (Claude/OpenAI/Gemini) arriba, gratis abajo
  const feats = (usage?.porFeature ?? []).slice(0, 8);
  const maxFeat = Math.max(1, ...feats.map((f) => f.costUsd));
  // Para la gráfica de TOKENS: el top-8 por tokens (puede diferir del top por $ —
  // un proceso en IA gratis consume muchos tokens y $0). Así ambas cuentan algo real.
  const featsTok = (usage?.porFeature ?? []).slice().sort((a, b) => b.tokens - a.tokens).slice(0, 8);
  const maxTok = Math.max(1, ...featsTok.map((f) => f.tokens));
  // Arriba las que consumen dinero (Claude/OpenAI/Gemini), abajo las gratis. El
  // saldo/créditos ya NO se edita inline en el tile: se hace en el detalle (abrí el tile).
  const provsPago = provs.filter((p) => esIAdePago(p.provider));
  const provsGratis = provs.filter((p) => !esIAdePago(p.provider));

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const renderTile = (p: ProvSaldo) => {
    const low = p.restanteUsd !== null && p.restanteUsd <= 5;
    const lim = LIMITE_FREE[p.provider] ?? { cap: 'plan gratis' };
    // Cuota gratis de hoy (pedidos o tokens según el tope real): gauge "cuánto queda".
    const cuota = cuotas.find((x) => x.provider === p.provider) ?? null;
    const cv = cuota ? cuotaVista(cuota) : null;
    return (
      <div key={p.provider} role="button" tabIndex={0} title={`Ver detalle de ${proveedorLegible(p.provider)}`}
        onClick={() => onOpenService(p.provider)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenService(p.provider); } }}
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 17px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
          <SvcIcon k={p.provider} box={26} radius={8} size={16} />
          <span style={{ ...capMono, fontSize: 11, letterSpacing: '.06em' }}>{proveedorLegible(p.provider)}</span>
          {p.gratis
            ? <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, fontWeight: 600, color: 'var(--good)', background: 'var(--good-bg)', padding: '2px 8px', borderRadius: 6 }}>gratis</span>
            : <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: low ? 'var(--warn-fill)' : 'var(--good)' }} />}
        </div>
        {p.gratis ? (
          // Gratis: se mide por CUOTA de hoy (Groq por tokens/día, el resto por pedidos/día).
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 7 }}>
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{cv?.agotado ? 'sin cuota hoy' : 'cuánto queda hoy'}</span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{cv ? <>{cv.usados}<span style={{ color: 'var(--faint)' }}> / {cv.limite} {cv.unidad}</span></> : <>{fmtTok(p.tokensHoy)}<span style={{ color: 'var(--faint)' }}> tok</span></>}</span>
            </div>
            {cv && <div style={{ height: 7, borderRadius: 5, background: 'var(--border)' }}><div style={{ height: 7, width: `${cv.pct}%`, borderRadius: 5, background: cv.agotado ? 'var(--warn-fill)' : '#F55036' }} /></div>}
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>{lim.cap}</div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 21, letterSpacing: '-0.02em', color: p.restanteUsd === null ? 'var(--faint)' : low ? 'var(--warn)' : 'var(--ink)' }}>{p.restanteUsd === null ? 'sin saldo' : usd(p.restanteUsd)}</span>
              {p.restanteUsd !== null && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>restante</span>}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: low ? 'var(--warn)' : 'var(--faint)', marginTop: 5 }}>gastó {usd(p.costMesUsd)} este mes</div>
          </>
        )}
        {/* Las 3 de pago (Claude/OpenAI/Gemini) llevan el MISMO link, que abre el
            detalle para cargar/editar el saldo ahí (no inline). */}
        {esIAdePago(p.provider) && (
          <button onClick={(e) => { stop(e); onOpenService(p.provider); }} style={{ marginTop: 9, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', textAlign: 'left' }}>¿Cargaste créditos? Registralos →</button>
        )}
      </div>
    );
  };

  return (
    <section id="saldo-ia" style={{ ...card, marginTop: 20, padding: '26px 30px', scrollMarginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <MakoStar size={16} color="var(--accent)" />
          <h2 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.017em', margin: 0, color: 'var(--ink)' }}>Costo de MaKo</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span style={{ ...capMono, fontSize: 10.5, letterSpacing: '.1em' }}>este mes</span>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 29, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{usd(usage?.gastadoMesUsd ?? 0)}</span>
        </div>
      </div>

      {/* Tiles por proveedor — arriba las de pago, abajo las gratis (dos filas
          separadas para que no queden todos juntos y OpenRouter suelto). */}
      <div style={{ ...capMono, fontSize: 9.5, letterSpacing: '.11em', color: 'var(--faint)', marginBottom: 9 }}>Consumen dinero</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 11, marginBottom: 18 }}>
        {provsPago.map(renderTile)}
      </div>
      <div style={{ ...capMono, fontSize: 9.5, letterSpacing: '.11em', color: 'var(--faint)', marginBottom: 9 }}>Gratis · rotan sin costo</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 11, marginBottom: 26 }}>
        {provsGratis.map(renderTile)}
      </div>

      {/* Por proceso — dos gráficas: DINERO (izq) y TOKENS (der). El dinero solo lo
          mueven Claude/OpenAI; los tokens los mueven TODAS (útil para ver qué proceso
          consume aunque sea en una IA gratis). En pantallas angostas se apilan. */}
      {feats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 26, marginBottom: 4 }}>
          <div>
            <div style={{ ...capMono, fontSize: 10, letterSpacing: '.13em', marginBottom: 13 }}>Gasto por proceso · dinero</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {feats.map((f) => (
                <div key={f.feature} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,150px) 1fr 52px', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{procesoLegible(f.feature)}</span>
                  <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2)' }}><div style={{ height: 8, width: `${Math.max(3, (f.costUsd / maxFeat) * 100)}%`, borderRadius: 6, background: 'linear-gradient(90deg,#C8870C,#F0C60A)' }} /></div>
                  <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: f.costUsd > 0 ? 'var(--ink)' : 'var(--dim)' }}>{usd(f.costUsd)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...capMono, fontSize: 10, letterSpacing: '.13em', marginBottom: 13 }}>Consumo por proceso · tokens</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {featsTok.map((f) => (
                <div key={f.feature} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,150px) 1fr 52px', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{procesoLegible(f.feature)}</span>
                  <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2)' }}><div style={{ height: 8, width: `${Math.max(3, (f.tokens / maxTok) * 100)}%`, borderRadius: 6, background: 'linear-gradient(90deg,#2D6CDF,#5FA8FF)' }} /></div>
                  <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: f.tokens > 0 ? 'var(--ink)' : 'var(--dim)' }}>{fmtTok(f.tokens)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 15 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{usage?.historial?.length ?? 0} operaciones recientes</span>
        <button type="button" onClick={onVerOps} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 14px' }}>Ver todas las operaciones →</button>
      </div>
    </section>
  );
}

// ── Historial de problemas (incidentes con inicio → fin) ──────────────────────
function ProblemasHistorial({ incidentes, nombreDe }: { incidentes: Incidente[]; nombreDe: (service: string) => string }) {
  const activos = incidentes.filter((x) => x.resolvedAt === null).length;
  return (
    <section style={{ ...card, marginTop: 20, padding: '22px 30px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, marginBottom: 6 }}>
        <h2 style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.014em', margin: 0, color: 'var(--ink)' }}>Historial de problemas</h2>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{activos} {activos === 1 ? 'activo' : 'activos'}</span>
      </div>
      {incidentes.length === 0 ? (
        <div style={{ color: 'var(--dim)', fontSize: 13.5, padding: '14px 0' }}>Todo en orden. Acá van a quedar los incidentes de cada servicio con su período: desde cuándo empezó el problema hasta que se resolvió.</div>
      ) : (
        incidentes.map((it, idx) => {
          const activo = it.resolvedAt === null;
          const st = activo
            ? (it.severidad === 'rojo' ? { bg: 'var(--bad-bg)', fg: 'var(--bad)' } : { bg: 'var(--warn-bg)', fg: 'var(--warn)' })
            : { bg: 'var(--surface-2)', fg: 'var(--dim)' };
          const label = `${it.entregaFrenada ? 'Entrega frenada' : it.statusLabel}${it.disableReason ? ` · ${it.disableReason}` : ''}`;
          // Período: "DD/MM HH:MM → DD/MM HH:MM · duró X" (resuelto) o
          // "desde DD/MM HH:MM · en curso" (activo).
          const periodo = activo
            ? `desde ${fmtHora(it.startedAt)} · en curso`
            : `${fmtHora(it.startedAt)} → ${fmtHora(it.resolvedAt as string)} · duró ${fmtDuracion(it.startedAt, it.resolvedAt as string)}`;
          return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderTop: idx === 0 ? 'none' : '1px solid var(--surface-2)' }}>
              <SvcIcon k={it.service} box={30} radius={8} size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{nombreDe(it.service)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
              </div>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{periodo}</span>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{activo ? 'En curso' : 'Resuelto'}</span>
            </div>
          );
        })
      )}
    </section>
  );
}

// ── Shell de modal ────────────────────────────────────────────────────────────
// `h` (opcional) fija el alto: el modal deja de crecer con el contenido y pasa a
// scrollear adentro. Va con overflow:hidden para que el contenido no se escape
// por las esquinas redondeadas. Sin `h` el modal se comporta como siempre (lo
// usa OperacionesModal) y el que scrollea es el overlay.
function ModalShell({ w, h, label, onClose, children }: { w: number; h?: number | string; label: string; onClose: () => void; children: ReactNode }) {
  // Bloquea el scroll del fondo mientras el modal está abierto (como el diseño).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,22,27,.5)', display: 'flex', alignItems: h ? 'center' : 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'mkFade .16s ease' }}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} style={{ width: w, maxWidth: '100%', height: h, overflow: h ? 'hidden' : undefined, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', animation: 'mkPop .2s cubic-bezier(.2,.7,.3,1)' }}>
        {children}
      </div>
    </div>
  );
}
const closeBtn: CSSProperties = { flex: 'none', width: 30, height: 30, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer', lineHeight: 1 };

// ── Landing: código copiable en vez de form de credenciales ───────────────────
// La landing del cliente puede estar en cualquier lado (Lovable, Framer, Webflow,
// WordPress, HTML plano). No le pedimos credenciales de nada: le damos SU
// <script> con su token embebido y que lo pegue. Mismo estilo minimalista que el
// wizard de ServicioConfigForm (una instrucción + un bloque + el desplegable).
// Los pasos son una secuencia; las plataformas son ALTERNATIVAS del paso 2 (una
// línea por plataforma, no una oración corrida con todas adentro).
type PasoPegar = { paso: string; plataformas?: Array<[string, string]> };
const DONDE_PEGAR: PasoPegar[] = [
  { paso: 'Copiá el código de acá arriba.' },
  {
    paso: 'Abrí tu landing y pegalo justo antes de </body>, en todas las páginas que quieras medir.',
    plataformas: [
      ['Lovable, Claude Code, o cualquier editor web por prompt', 'pedile "pegá este script antes del </body>".'],
      ['Framer', 'Settings → Custom Code → End of <body>.'],
      ['Webflow', 'Project Settings → Custom Code → Footer Code.'],
      ['WordPress', 'un plugin de "insert headers and footers" (footer).'],
      ['HTML plano', 'antes del </body>.'],
    ],
  },
  { paso: 'Publicá los cambios y entrá a tu landing una vez. En cuanto llegue la primera visita, esta integración se pone en verde.' },
];

// ── Resaltador de código mínimo, propio (sin dependencias) ───────────────────
// Un scanner de UNA pasada sobre el <script>: tags, atributos, strings,
// comentarios, palabras clave y números; todo lo demás cae al color base. No es
// un parser de JS y no pretende serlo — alcanza para que el bloque se reconozca
// como CÓDIGO al toque. Va sobre el oscuro nativo del repo (el de la sidebar),
// que ya convive con el resto de la UI clara.
const CODE = {
  bg: 'var(--sidebar)',
  bd: 'var(--sidebar-2)',
  base: 'var(--on-sidebar)',
  com: 'var(--sidebar-text)',
  num: 'var(--accent-soft)',
  tag: '#7EE787',
  attr: '#9DBBF5',
  str: '#A5D6FF',
  kw: '#FF9492',
};

const RE_CODE = new RegExp([
  '(<\\/?[A-Za-z][\\w-]*)',                                  // 1 apertura de tag: <script, </script
  '(\\/?>)',                                                 // 2 cierre de tag (solo cuenta dentro de un tag)
  '(\\/\\/[^\\n]*)',                                         // 3 comentario de línea
  '(\'(?:[^\'\\\\\\n]|\\\\.)*\'|"(?:[^"\\\\\\n]|\\\\.)*")',  // 4 string
  '\\b(var|function|return|if|else|for|while|new|try|catch|typeof|instanceof|void|true|false|null)\\b', // 5 palabra clave
  '\\b(\\d+(?:\\.\\d+)?)\\b',                                // 6 número
  '([A-Za-z_$][\\w$]*)',                                     // 7 identificador (dentro de un tag = atributo)
].join('|'), 'g');

function resaltar(code: string): Array<{ t: string; c: string }> {
  const out: Array<{ t: string; c: string }> = [];
  const push = (t: string, c: string) => { if (t) out.push({ t, c }); };
  let last = 0;
  let enTag = false; // dentro de <script …> los identificadores son atributos
  RE_CODE.lastIndex = 0;
  for (let m = RE_CODE.exec(code); m; m = RE_CODE.exec(code)) {
    push(code.slice(last, m.index), CODE.base); // espacios y puntuación
    if (m[1]) { enTag = true; push(m[1], CODE.tag); }
    // Un '>' suelto es una comparación (h >= 5), no el cierre de un tag.
    else if (m[2]) { if (enTag) { enTag = false; push(m[2], CODE.tag); } else push(m[2], CODE.base); }
    else if (m[3]) push(m[3], CODE.com);
    else if (m[4]) push(m[4], CODE.str);
    else if (m[5]) push(m[5], enTag ? CODE.attr : CODE.kw);
    else if (m[6]) push(m[6], CODE.num);
    else push(m[7], enTag ? CODE.attr : CODE.base);
    last = m.index + m[0].length;
  }
  push(code.slice(last), CODE.base);
  return out;
}

// ── Tutorial del agente (Claude Code) — vive DENTRO del modal ────────────────
// El "cómo instalar" de la integración `agente`. Igual que CodigoLanding: no hay
// API key que pegar — se genera un token, se copia una skill y listo. La skill le
// enseña al agente a NO crear tareas: deja un borrador con preguntas y el Perro
// Guardián puntúa al aplicar (mismo camino que MaKo por WhatsApp).
function TutorialAgente({ tokenInicial, appUrl }: { tokenInicial: string | null; appUrl: string }) {
  const [token, setToken] = useState<string | null>(tokenInicial);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<'skill' | 'token' | 'ruta' | null>(null);
  const [verSkill, setVerSkill] = useState(false);

  const skill = useMemo(() => agenteSkillMarkdown(appUrl, token ?? ''), [appUrl, token]);
  const listo = !!token;

  const generar = async () => {
    setGenerando(true); setError(null);
    try {
      const j = await (await fetch('/api/agente/token', { method: 'POST' })).json();
      if (j?.ok) { setToken(j.token as string); setVerSkill(true); }
      else setError(j?.error === 'sin workspace (entrá como un cliente)' ? 'Entrá a un cliente para generar su token.' : (j?.error ?? 'No se pudo generar.'));
    } catch { setError('No se pudo generar. Revisá tu conexión.'); }
    finally { setGenerando(false); }
  };

  const copiar = async (que: 'skill' | 'token' | 'ruta', texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(que); setTimeout(() => setCopiado(null), 1800); }
    catch { setError('No pudimos copiarlo solos — seleccionalo y copialo a mano.'); }
  };

  const btnPrimario: CSSProperties = { padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const btnSecundario: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const codeInline: CSSProperties = { fontFamily: MONO, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', color: 'var(--ink)' };

  const paso = (n: number, titulo: ReactNode, cuerpo: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 999, background: 'var(--ink)', color: 'var(--surface)', fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 7, lineHeight: 1.35 }}>{titulo}</div>
        {cuerpo}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
        ¿Programás con <strong style={{ color: 'var(--ink)' }}>Claude Code</strong>? Instalá esta skill (3 pasos, sin API key) y tu agente
        va a <strong style={{ color: 'var(--ink)' }}>mirar tu plan</strong> antes de arrancar y a <strong style={{ color: 'var(--ink)' }}>proponerte tareas</strong>.
        Nunca las crea solo: deja un borrador que revisás vos y que prioriza el Perro Guardián.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
        {/* PASO 1 — token */}
        {paso(1, 'Generá tu token de conexión', listo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ fontFamily: MONO, fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--dim)', userSelect: 'all', wordBreak: 'break-all', flex: '1 1 200px', minWidth: 0 }}>{token}</code>
              <button type="button" style={btnSecundario} onClick={() => copiar('token', token!)}>{copiado === 'token' ? '¡Copiado!' : 'Copiar'}</button>
              <button type="button" style={{ ...btnSecundario, color: 'var(--faint)' }} onClick={generar} disabled={generando} title="Genera uno nuevo e invalida el anterior">{generando ? 'Rotando…' : 'Rotar'}</button>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Es una credencial: identifica tu espacio. No la subas a un repo público. Si la rotás, la anterior deja de funcionar.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" style={btnPrimario} onClick={generar} disabled={generando}>{generando ? 'Generando…' : 'Generar token'}</button>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>Un click. Queda guardado y se embebe en la skill del paso 2.</span>
          </div>
        ))}

        {/* PASO 2 — instalar la skill */}
        {paso(2, 'Instalá la skill en tu proyecto', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
              Creá el archivo <button type="button" onClick={() => copiar('ruta', AGENTE_SKILL_PATH)} style={{ ...codeInline, cursor: 'pointer' }} title="Copiar ruta">{copiado === 'ruta' ? '¡copiada!' : AGENTE_SKILL_PATH}</button> en tu proyecto y pegá la skill adentro.
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button type="button" style={listo ? btnPrimario : { ...btnPrimario, opacity: 0.45, cursor: 'not-allowed' }} disabled={!listo} onClick={() => copiar('skill', skill)}>
                {copiado === 'skill' ? '¡Skill copiada!' : 'Copiar skill'}
              </button>
              <button type="button" style={btnSecundario} onClick={() => setVerSkill((v) => !v)}>{verSkill ? 'Ocultar' : 'Ver la skill'}</button>
            </div>
            {!listo && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Generá el token primero: viene embebido en el archivo.</span>}
            {verSkill && (
              <pre style={{ margin: 0, minWidth: 0, background: CODE.bg, border: `1px solid ${CODE.bd}`, borderRadius: 12, padding: '12px 14px', maxHeight: 220, overflow: 'auto', fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--dim)', userSelect: 'all' }}>{skill}</pre>
            )}
          </div>
        ))}

        {/* PASO 3 — usarlo */}
        {paso(3, 'Pedíselo a tu agente', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            <div>Escribile, por ejemplo:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13 }}>“Mirá mi plan antes de arrancar con esto.”</span>
              <span style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13 }}>“Anotá esto en mi plan.”</span>
            </div>
            <div>Te devuelve un <strong style={{ color: 'var(--ink)' }}>link a un borrador</strong>. Lo abrís, respondés las preguntas y el Perro le pone la prioridad. Recién ahí entra al tablero.</div>
          </div>
        ))}
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--warn)', fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

function CodigoLanding({ snippet }: { snippet: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const [errorCopia, setErrorCopia] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; text: string } | null>(null);
  const tokens = useMemo(() => (snippet ? resaltar(snippet) : []), [snippet]);

  // "Verificar" = el "Probar conexión" de la landing. No hay API ajena contra la
  // cual probar: la única prueba honesta es que ya hayan llegado eventos.
  const verificar = async () => {
    setVerificando(true); setEstado(null);
    try {
      const j = await (await fetch('/api/integraciones/landing/estado')).json();
      if (j?.ok) {
        setEstado(j.recibio
          ? { ok: true, text: `Recibiendo eventos${j.ultima ? ` (última hace ${fmtDuracion(j.ultima, new Date().toISOString())})` : ''}.` }
          : { ok: false, text: 'Todavía no llegó ningún evento — pegá el código en tu landing y recargala.' });
      } else {
        setEstado({ ok: false, text: j?.error === 'solo admin' ? 'Necesitás ser admin para verificar esta integración.' : (j?.error ?? 'No se pudo verificar.') });
      }
    } catch { setEstado({ ok: false, text: 'No se pudo verificar. Revisá tu conexión y probá de nuevo.' }); }
    finally { setVerificando(false); }
  };

  const copiar = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setErrorCopia(false);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): que lo copie a mano.
      setErrorCopia(true);
    }
  };

  if (!snippet) {
    return (
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
        Entrá a un cliente para ver su código de landing.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <h4 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.3, margin: 0 }}>
        Pegá este código en tu landing
      </h4>

      <pre style={{ margin: 0, minWidth: 0, background: CODE.bg, border: `1px solid ${CODE.bd}`, borderRadius: 12, padding: '13px 15px', maxHeight: 210, overflow: 'auto', fontFamily: MONO, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre', userSelect: 'all' }}>
        <code style={{ fontFamily: MONO }}>
          {tokens.map((tk, n) => <span key={n} style={{ color: tk.c }}>{tk.t}</span>)}
        </code>
      </pre>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" onClick={copiar}
          style={{ padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {copiado ? '¡Copiado!' : 'Copiar código'}
        </button>
        <button type="button" onClick={verificar} disabled={verificando}
          style={{ padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: verificando ? 'default' : 'pointer', opacity: verificando ? 0.6 : 1 }}>
          {verificando ? 'Verificando…' : 'Verificar'}
        </button>
        {errorCopia && <span style={{ fontSize: 12.5, color: 'var(--warn)', fontWeight: 500 }}>No pudimos copiarlo solos — seleccionalo y copialo a mano.</span>}
      </div>

      {estado && (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: estado.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>
          {estado.ok ? '✓' : '✗'} {estado.text}
        </div>
      )}

      {/* ¿Dónde lo pego? — mismo desplegable que "¿Cómo consigo esto?" del wizard */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <button type="button" onClick={() => setAbierto((o) => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
          ¿Dónde lo pego?
          <span style={{ color: 'var(--faint)', fontSize: 11 }}>{abierto ? '▲' : '▼'}</span>
        </button>
        {abierto && (
          <div style={{ padding: '2px 14px 14px' }}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {DONDE_PEGAR.map((p, n) => (
                <li key={n} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)' }}>{n + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p.paso}</span>
                    {p.plataformas && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                        {p.plataformas.map(([donde, como]) => (
                          <div key={donde} style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{donde}:</span> {como}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Carrusel del modal: qué vas a poder hacer con ESTA integración ────────────
// REGLA DURA: cada slide describe algo que la app HACE HOY. Nada de features
// planeadas. Al lado de cada una va el código que la respalda — si mañana se
// borra ese código, se borra la slide.


// ── Modal de servicio ─────────────────────────────────────────────────────────
// Dos columnas: izquierda (negra) el carrusel de qué vas a poder hacer; derecha
// toda la configuración —incluido el aviso de seguridad, que vive dentro del
// form—. Alto fijo y scroll adentro. En angosto apilan (ver .mk-svc-modal en
// globals.css).
// Dónde se cargan los créditos de cada IA de pago (para el botón de acceso directo).
const BILLING_URL: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/billing',
  openai: 'https://platform.openai.com/settings/organization/billing',
  gemini: 'https://aistudio.google.com/app/plan_information',
};

// Editor de saldo / créditos DENTRO del detalle de una IA de pago. Es ADITIVO: cada
// carga SUMA al total y queda en el histórico; el input arranca VACÍO (no repite el
// último monto). Para Gemini, cargar el primer crédito lo pasa de free tier a pago.
function SaldoEditor({ provider, gemini, saldo, restante, gastoMes, onGuardado }: { provider: string; gemini: boolean; saldo: Saldo | null; restante: number | null; gastoMes: number; onGuardado: () => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try {
      // SINCRONIZA: pone el saldo ACTUAL (lo que ves en la consola). Reemplaza y resetea
      // el baseline → el restante = ese número y baja con el gasto nuevo.
      const j = await (await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v, provider }) })).json();
      if (j?.ok) { setEditing(false); setInput(''); onGuardado(); }
    } finally { setSaving(false); }
  };
  const cargas = (saldo?.cargas ?? []).slice().reverse(); // más recientes primero
  const url = BILLING_URL[provider];
  return (
    <div style={{ marginBottom: 16, padding: '14px 15px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <span style={{ ...capMono, fontSize: 9.5, letterSpacing: '.09em' }}>{gemini ? 'Créditos de Gemini' : 'Saldo'}</span>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Cargar créditos ↗</a>}
      </div>
      {saldo ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: restante !== null && restante <= 5 ? 'var(--warn)' : 'var(--ink)' }}>{gemini ? '≈' : ''}{restante !== null ? usd(restante) : usd(saldo.usd)}</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>restante</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', marginLeft: 'auto' }}>sincronizado {fmtHora(saldo.setAt)}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginBottom: 10 }}>gastó {gemini ? '≈' : ''}{usd(gastoMes)} este mes{gemini ? ' · estimado, el real está en Google ↗' : ''}</div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 10 }}>{gemini ? 'Sin créditos registrados — Gemini corre en free tier.' : 'Sin saldo registrado.'}</div>
      )}
      {editing ? (
        <div style={{ display: 'flex', gap: 7 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" autoFocus placeholder="Saldo actual, de la consola (USD)" style={{ flex: 1, minWidth: 0, padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 13, outline: 'none' }} />
          <button onClick={guardar} disabled={saving || !input.trim()} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: saving || !input.trim() ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: saving || !input.trim() ? 'default' : 'pointer' }}>{saving ? '…' : 'Guardar'}</button>
          <button onClick={() => { setEditing(false); setInput(''); }} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => { setEditing(true); setInput(''); }} style={{ border: '1px solid var(--primary)', borderRadius: 9, background: 'var(--surface)', color: 'var(--primary)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer' }}>{saldo ? 'Actualizar saldo' : (gemini ? 'Registrar créditos' : 'Poné tu saldo')}</button>
      )}
      {cargas.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ ...capMono, fontSize: 9, letterSpacing: '.09em', color: 'var(--faint)', marginBottom: 7 }}>Sincronizaciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {cargas.map((c, k) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--ink)' }}>{usd(c.usd)}</span>
                <span style={{ fontFamily: MONO, color: 'var(--faint)' }}>{fmtHora(c.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServicioModal({ i, sev, health, metaError, usage, cuota, snippetLanding, agenteToken, appUrl, onClose, onCambio, onRefetchUsage }: {
  i: Integracion; sev: 'good' | 'warn' | 'bad'; health: MetaHealth | null; metaError: string | null; usage: Resumen | null; cuota: CuotaProv | null; snippetLanding?: string | null; agenteToken?: string | null; appUrl?: string; onClose: () => void; onCambio: () => void; onRefetchUsage: () => void;
}) {
  const chip = sev === 'good' ? { bg: 'var(--good-bg)', fg: 'var(--good)', word: 'Conectada' }
    : sev === 'warn' ? { bg: 'var(--warn-bg)', fg: 'var(--warn)', word: 'Por configurar' }
    : { bg: 'var(--bad-bg)', fg: 'var(--bad)', word: 'Requiere atención' };

  // BYOK: si el servicio está en el catálogo de /metodo y NO es soloServidor,
  // embebemos el form de pegar/guardar/probar (reemplaza la lista de envs crudos).
  // Los servicios sin catálogo (p.ej. la landing) quedan informativos.
  const catalogo = servicioMetodo(i.key);
  const mostrarForm = !!catalogo && !catalogo.soloServidor;

  // El carrusel manda la copy. Si un servicio todavía no tiene slides propias,
  // cae al `paraQue` del catálogo — nunca inventamos una promesa para llenar.
  const slides: Slide[] = SLIDES[i.key] ?? (catalogo?.paraQue ? [{ t: `Qué hace ${i.nombre}`, d: catalogo.paraQue }] : []);

  // Estado EN VIVO (no descripción): solo Meta tiene algo que decir acá.
  let alerta: string | null = null;
  let facts: Array<{ k: string; v: string; c: string }> = [];
  const actions: Array<{ label: string; href?: string; primary?: boolean; sameTab?: boolean }> = [];
  const faltan = i.estado === 'falta' ? i.detalle.replace(/^Falta configurar:\s*/, '') : '';

  if (i.key === 'meta' && health) {
    const a = health.account;
    alerta = a.entregaFrenada
      ? 'La cuenta no entrega hasta que regularices el pago en el Administrador de Anuncios.'
      : (a.disableReasonLabel || a.statusLabel || null);
    facts = [
      // OJO: en Meta balanceMxn > 0 = dinero ADEUDADO (no saldo disponible);
      // ver lib/meta-health.ts. Positivo → "Adeudado" en rojo.
      { k: a.balanceMxn > 0 ? 'Adeudado' : 'Saldo', v: mxn(Math.abs(a.balanceMxn)), c: a.balanceMxn > 0 ? 'var(--bad)' : 'var(--ink)' },
      { k: 'Medio de pago', v: a.fundingCard ? `*${a.fundingCard}` : '—', c: 'var(--ink)' },
      { k: 'Total gastado', v: mxn(a.amountSpentMxn), c: 'var(--ink)' },
      { k: 'Tope', v: a.spendCapMxn ? mxn(a.spendCapMxn) : 'Sin tope', c: 'var(--ink)' },
    ];
    actions.push({ label: 'Abrir Ads Manager ↗', href: 'https://adsmanager.facebook.com', primary: true });
  } else if (i.key === 'meta') {
    alerta = metaError ? `No se pudo leer el estado de Meta: ${metaError}` : null;
  } else if (i.key === 'anthropic' || i.key === 'openai' || (i.key === 'gemini' && !!usage?.porProveedor?.find((p) => p.provider === 'gemini' && !p.gratis))) {
    // Proveedor de PAGO (Claude, OpenAI, o Gemini con créditos): TODO lo de saldo/gasto
    // y el acceso a facturación vive en el SaldoEditor de abajo (restante, cargado,
    // gasto del mes, histórico, botón "Cargar créditos ↗"). Este branch solo evita que
    // Gemini-pago caiga al gauge de cuota gratis; no pinta facts ni acciones acá.
  } else if (cuota) {
    // IA GRATIS (Groq/Gemini/Cerebras/Mistral/OpenRouter): su tope no es dinero sino
    // CUOTA de hoy. Mostramos la métrica que manda (pedidos o tokens/día) + el consumo
    // del mes. Es el "cuánto queda" que antes solo tenía Groq → ahora todos.
    const cv = cuotaVista(cuota);
    const prov = usage?.porProveedor?.find((p) => p.provider === i.key);
    facts = [
      { k: cv.agotado ? 'Sin cuota hoy' : 'Cuánto queda hoy', v: `${cv.usados} / ${cv.limite} ${cv.unidad}`, c: cv.agotado ? 'var(--warn)' : 'var(--ink)' },
      { k: 'Consumo del mes', v: `${fmtTok(prov?.tokens ?? 0)} tok`, c: 'var(--ink)' },
    ];
  } else if (i.key === 'google') {
    // El OAuth de Google Calendar es un redirect en la MISMA pestaña.
    actions.push({ label: 'Conectar Google Calendar', href: '/api/integraciones/google-calendar', primary: true, sameTab: true });
  }

  // La landing no se configura con credenciales: se configura copiando un código.
  const esLanding = i.key === 'landing';
  // El agente tampoco: token + skill del lado del usuario. Mismo molde que la landing.
  const esAgente = i.key === 'agente';

  return (
    // Alto FIJO e igual para todos los servicios (el de 1 sola key y el de 6):
    // lo que sobra scrollea adentro, en vez de que el modal salte de tamaño.
    <ModalShell w={940} h="min(720px, calc(100dvh - 96px))" label={i.nombre} onClose={onClose}>
      <div className="mk-svc-modal">
        {/* ═══ IZQUIERDA (negra) · qué vas a poder hacer ═══ */}
        <aside className="mk-svc-aside" style={{ display: 'flex', flexDirection: 'column', padding: '26px 24px', minWidth: 0, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <MakoStar size={14} color="var(--accent)" />
            <span style={{ ...capMono, fontSize: 10, letterSpacing: '.12em', color: 'var(--sidebar-text)' }}>Con {i.nombre} conectado</span>
          </div>

          <Carrusel slides={slides} arriba={<EnlaceMaKo k={i.key} nombre={i.nombre} />} />
        </aside>

        {/* ═══ DERECHA · toda la configuración ═══
            Header y acciones quedan fijos; scrollea SOLO el medio. Si el header no
            estuviera pinado, el ✕ de cerrar se iría con el scroll. */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '22px 26px 16px' }}>
            <SvcIcon k={i.key} box={44} radius={12} size={25} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.014em', margin: 0, color: 'var(--ink)' }}>{i.nombre}</h3>
              <div style={{ ...capMono, fontSize: 10.5, letterSpacing: '.06em', marginTop: 3 }}>{i.categoria}</div>
            </div>
            <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: chip.bg, color: chip.fg }}>{chip.word}</span>
            <button onClick={onClose} style={closeBtn} title="Cerrar" aria-label="Cerrar">✕</button>
          </div>

          {/* ── El ÚNICO scroller ── */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 26px 22px' }}>
          {/* Estado en vivo de Meta: es una alerta, no una descripción. */}
          {alerta && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 15, padding: '11px 13px', borderRadius: 11, background: sev === 'good' ? 'var(--surface-2)' : sev === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)', color: sev === 'good' ? 'var(--dim)' : sev === 'warn' ? 'var(--warn)' : 'var(--bad)', fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ flex: 'none', marginTop: 2 }}><Spark size={12} /></span>
              <span>{alerta}</span>
            </div>
          )}

          {facts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
              {facts.map((f) => (
                <div key={f.k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px', minWidth: 0 }}>
                  <div style={{ ...capMono, fontSize: 9.5, letterSpacing: '.09em', marginBottom: 6 }}>{f.k}</div>
                  <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: f.c, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Saldo / créditos: solo para las IA de pago (Claude, OpenAI, Gemini). Acá
              se carga/edita — ya NO en el tile. Para Gemini es lo que lo pasa a tier pago.
              Claude es la key COMPARTIDA de la agencia (siempre conectada); OpenAI/Gemini
              son BYOK → el editor solo aparece si ESTE workspace tiene la key conectada. Si
              no, es de otro workspace (p.ej. Gemini de Martín en el espacio de Mauricio) y no
              debe mostrar saldo ni cargas acá. */}
          {(i.key === 'anthropic' || ((i.key === 'openai' || i.key === 'gemini') && i.estado === 'conectada')) && (
            <SaldoEditor provider={i.key} gemini={i.key === 'gemini'} saldo={usage?.porProveedor?.find((p) => p.provider === i.key)?.saldo ?? null} restante={usage?.porProveedor?.find((p) => p.provider === i.key)?.restanteUsd ?? null} gastoMes={usage?.porProveedor?.find((p) => p.provider === i.key)?.costMesUsd ?? 0} onGuardado={onRefetchUsage} />
          )}

          {esAgente ? (
            <TutorialAgente tokenInicial={agenteToken ?? null} appUrl={appUrl ?? ''} />
          ) : esLanding ? (
            <CodigoLanding snippet={snippetLanding ?? null} />
          ) : mostrarForm ? (
            // onEstado avisa cuando el servicio pasó a conectado (o dejó de estarlo):
            // sin esto el chip de acá arriba, el tile y el contador se quedaban en
            // "Por configurar" después de guardar, hasta que apretaras F5.
            <ServicioConfigForm servicioKey={i.key} onEstado={onCambio} />
          ) : i.estado === 'falta' && (
            <div>
              <div style={{ ...capMono, fontSize: 10, letterSpacing: '.08em', marginBottom: 7 }}>Falta configurar</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {faltan.split(',').map((v) => v.trim()).filter(Boolean).map((v) => (
                  <code key={v} style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px' }}>{v}</code>
                ))}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
                Cargá {faltan.includes(',') ? 'estas credenciales' : 'esta credencial'} desde acá y quedará conectado.
              </p>
            </div>
          )}
          </div>

          {/* Footer fijo: las acciones no se van con el scroll. */}
          {actions.length > 0 && (
            <div style={{ flex: 'none', display: 'flex', gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--border)', padding: '16px 26px 22px' }}>
              {actions.map((a) => (
                <a key={a.label} href={a.href} target={a.sameTab ? undefined : '_blank'} rel={a.sameTab ? undefined : 'noopener noreferrer'} style={{ border: `1px solid ${a.primary ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 10, background: a.primary ? 'var(--primary)' : 'var(--surface)', color: a.primary ? '#fff' : 'var(--dim)', fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13.5, padding: '10px 15px', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }}>{a.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Modal de operaciones de IA (filtro + orden + lista) ───────────────────────
function OperacionesModal({ usage, onClose }: { usage: Resumen; onClose: () => void }) {
  const all = useMemo(() => usage.historial ?? [], [usage.historial]);
  const [fProv, setFProv] = useState('todos');
  const [fModelo, setFModelo] = useState('todos');
  const [fMes, setFMes] = useState('todos');
  const [fFeat, setFFeat] = useState('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'caro' | 'barato'>('fecha');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const modelos = useMemo(() => {
    // Sembramos con los modelos QUE USAMOS (así los nuevos aparecen en el filtro
    // aunque todavía no tengan operaciones) + los que ya salieron en el historial.
    const set = new Set<string>(['Opus 4.8', 'GPT-4o mini', 'Gemini Flash', 'Groq OSS 20B', 'Llama 3.3 70B', 'Mistral Small', 'Whisper (Groq)']);
    for (const o of all) { const l = modeloLegible(o.model); if (l !== '—') set.add(l); }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [all]);
  const features = useMemo(() => {
    const set = new Set<string>();
    for (const o of all) set.add(o.feature);
    return [...set].map((f) => [f, procesoLegible(f)] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);
  const meses = useMemo(() => {
    const M = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const map = new Map<string, string>();
    for (const o of all) { const k = o.at.slice(0, 7); if (k.length === 7 && !map.has(k)) { const [y, m] = k.split('-'); map.set(k, `${M[Number(m) - 1] ?? m} ${y}`); } }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)) as [string, string][];
  }, [all]);

  const ops = useMemo(() => {
    let r = all.slice();
    if (fProv !== 'todos') r = r.filter((o) => o.provider === fProv);
    if (fModelo !== 'todos') r = r.filter((o) => modeloLegible(o.model) === fModelo);
    if (fMes !== 'todos') r = r.filter((o) => o.at.slice(0, 7) === fMes);
    if (fFeat !== 'todos') r = r.filter((o) => o.feature === fFeat);
    if (sortBy === 'caro') r.sort((a, b) => b.costUsd - a.costUsd);
    else if (sortBy === 'barato') r.sort((a, b) => a.costUsd - b.costUsd);
    else r.sort((a, b) => (a.at < b.at ? 1 : -1));
    return r;
  }, [all, fProv, fModelo, fMes, fFeat, sortBy]);

  const groups = [
    { key: 'prov', label: 'IA', cur: fProv, set: setFProv, opts: [['todos', 'Todas'], ...IA_ORDEN.map((p) => [p, proveedorLegible(p)] as [string, string])] },
    { key: 'modelo', label: 'Modelo', cur: fModelo, set: setFModelo, opts: [['todos', 'Todos'], ...modelos.map((m) => [m, m] as [string, string])] },
    { key: 'mes', label: 'Mes', cur: fMes, set: setFMes, opts: [['todos', 'Todos'], ...meses] },
    { key: 'op', label: 'Operación', cur: fFeat, set: setFFeat, opts: [['todos', 'Todas'], ...features] },
  ];
  const curLabel = (g: (typeof groups)[number]) => (g.opts.find((o) => o[0] === g.cur)?.[1] ?? 'Todas');
  const activeChips = groups.filter((g) => g.cur !== 'todos').map((g) => ({ key: g.key, label: `${g.label}: ${curLabel(g)}`, clear: () => g.set('todos') }));
  const nFilters = activeChips.length;
  const clearAll = () => { setFProv('todos'); setFModelo('todos'); setFMes('todos'); setFFeat('todos'); setFilterTab(null); };
  const sortDefs = [['fecha', 'Más recientes'], ['caro', 'Más caro'], ['barato', 'Más barato']] as [string, string][];
  const sortLabel = sortDefs.find((x) => x[0] === sortBy)?.[1] ?? 'Más recientes';

  const sum = ops.reduce((t, o) => t + o.costUsd, 0);

  // Estilos de los popovers de filtro/orden (a la manera del diseño).
  const pill = (active: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${active ? 'var(--primary-bg)' : 'var(--border-strong)'}`, borderRadius: 10, background: active ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, fontWeight: 600, padding: '9px 14px', cursor: 'pointer' });
  const pop = (w: number): CSSProperties => ({ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 30, width: w, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 13, boxShadow: '0 16px 40px rgba(20,22,27,.18)', padding: 8, maxHeight: 340, overflow: 'hidden auto' });
  const optBtn = (sel: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 0, background: sel ? 'var(--primary-bg)' : 'transparent', borderRadius: 8, padding: '8px 11px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: sel ? 600 : 500, color: sel ? 'var(--primary)' : 'var(--ink)' });
  const dot = (sel: boolean): CSSProperties => ({ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: sel ? 'var(--primary)' : 'var(--border-strong)' });

  // Cerrar los popovers al hacer click afuera.
  useEffect(() => {
    if (!filterOpen && !sortOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (filterRef.current?.contains(t) || sortRef.current?.contains(t)) return;
      setFilterOpen(false); setSortOpen(false); setFilterTab(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen, sortOpen]);

  return (
    <ModalShell w={680} label="Operaciones de IA" onClose={onClose}>
      <div style={{ padding: '22px 26px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.014em', margin: 0, color: 'var(--ink)' }}>Operaciones de IA</h3>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{ops.length} operaciones · {usd(sum)} en total</div>
          </div>
          <button onClick={onClose} style={{ ...closeBtn, marginLeft: 'auto', width: 32, height: 32, borderRadius: 9 }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: nFilters > 0 ? 12 : 14 }}>
          {/* Filtros (popover con grupos colapsables) */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button type="button" onClick={() => { setFilterOpen((v) => !v); setSortOpen(false); }} style={pill(nFilters > 0)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
              Filtros
              {nFilters > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{nFilters}</span>}
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>{filterOpen ? '▴' : '▾'}</span>
            </button>
            {filterOpen && (
              <div style={pop(300)}>
                {groups.map((g) => (
                  <div key={g.key} style={{ borderRadius: 9, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setFilterTab((t) => (t === g.key ? null : g.key))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: 0, background: filterTab === g.key ? 'var(--surface-2)' : 'transparent', borderRadius: 9, padding: '11px 12px', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{g.label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: g.cur !== 'todos' ? 'var(--primary)' : 'var(--faint)' }}>{curLabel(g)}</span>
                        <span style={{ color: 'var(--faint)', fontSize: 10 }}>{filterTab === g.key ? '▴' : '▾'}</span>
                      </span>
                    </button>
                    {filterTab === g.key && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 4px 8px' }}>
                        {g.opts.map(([v, l]) => (
                          <button key={v} type="button" onClick={() => { g.set(v); setFilterTab(null); }} style={optBtn(v === g.cur)}><span style={dot(v === g.cur)} />{l}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ordenar (popover propio) */}
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button type="button" onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); }} style={pill(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 20l3-3" /></svg>
              {sortLabel}
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>{sortOpen ? '▴' : '▾'}</span>
            </button>
            {sortOpen && (
              <div style={pop(190)}>
                {sortDefs.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => { setSortBy(v as 'fecha' | 'caro' | 'barato'); setSortOpen(false); }} style={optBtn(v === sortBy)}><span style={dot(v === sortBy)} />{l}</button>
                ))}
              </div>
            )}
          </div>

          {nFilters > 0 && <button type="button" onClick={clearAll} style={{ border: 0, background: 'none', color: 'var(--primary)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 6 }}>Limpiar</button>}
        </div>

        {/* Chips de filtros activos */}
        {nFilters > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
            {activeChips.map((ch) => (
              <button key={ch.key} type="button" onClick={ch.clear} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--primary-bg)', borderRadius: 999, background: 'var(--primary-bg)', color: 'var(--primary)', fontFamily: "'Geist', sans-serif", fontSize: 12, fontWeight: 600, padding: '5px 11px', cursor: 'pointer' }}>{ch.label}<span style={{ fontSize: 13, lineHeight: 1 }}>✕</span></button>
            ))}
          </div>
        )}

        <div style={{ maxHeight: 'calc(100vh - 320px)', minHeight: 180, overflow: 'hidden auto' }}>
          {ops.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 14, padding: '40px 0' }}>Sin operaciones para este filtro.</div>
          ) : ops.map((o, idx) => {
            const motivo = motivoLegible(o.motivo);
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0', borderTop: idx === 0 ? 'none' : '1px solid var(--surface-2)' }}>
                <SvcIcon k={o.provider} box={32} radius={9} size={19} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{procesoLegible(o.feature)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 6 }}>{proveedorLegible(o.provider)} · {modeloLegible(o.model)}</span>
                  </div>
                  {motivo && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{motivo}</div>}
                  <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{fmtHora(o.at)}{o.tokens > 0 ? ` · ${fmtTok(o.tokens)} tok` : ''}</div>
                </div>
                <span style={{ flex: 'none', fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: o.costUsd === 0 ? 'var(--faint)' : 'var(--ink)' }}>{o.costUsd === 0 ? 'gratis' : usd(o.costUsd)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}
