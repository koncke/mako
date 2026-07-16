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
import type { MetaHealth } from '@/lib/meta-health-ui';
import { procesoLegible, proveedorLegible, modeloLegible, motivoLegible } from '@/lib/ia-labels';
import { servicioMetodo } from '@/lib/metodo-catalogo';
import ServicioConfigForm from './ServicioConfigForm';

const MONO = "'Geist Mono', monospace";

// ── Tipos ──────────────────────────────────────────────────────────────────
type Integracion = { key: string; nombre: string; categoria: string; descripcion: string; estado: 'conectada' | 'falta'; detalle: string; tieneDetalle?: boolean };
// Incidente con período: startedAt → resolvedAt (null = en curso). Viene del server.
type Incidente = { id: number; service: string; severidad: string; statusLabel: string; disableReason: string | null; entregaFrenada: boolean; detalle: string | null; startedAt: string; resolvedAt: string | null };

type Movimiento = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type ProvSaldo = { provider: string; costMesUsd: number; tokens: number; tokensHoy: number; saldo: { usd: number; setAt: string } | null; restanteUsd: number | null; gratis: boolean };

// Groq es gratis: no se mide en $ sino por tokens/día hacia el límite del plan
// gratuito. Presupuesto diario aproximado (ajustable) para el gauge de "uso de hoy".
const GROQ_LIMITE_DIA_TOKENS = 500_000;
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

// ── Iconos de marca por servicio (color de fondo + símbolo SVG) ──────────────
type IconDef = { sym: string; bg: string; bd?: string };
const ICON: Record<string, IconDef> = {
  meta: { sym: 'ic-meta', bg: '#0866FF' },
  whatsapp: { sym: 'ic-whatsapp', bg: '#25D366' },
  email: { sym: 'ic-resend', bg: '#0A0A0A' },
  anthropic: { sym: 'ic-anthropic', bg: '#CC785C' },
  openai: { sym: 'ic-openai', bg: '#000000' },
  groq: { sym: 'ic-groq', bg: '#F55036' },
  fathom: { sym: 'ic-fathom', bg: '#6151F5' },
  calendly: { sym: 'ic-calendly', bg: '#006BFF' },
  google: { sym: 'ic-google', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  panda: { sym: 'ic-panda', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  youtube: { sym: 'ic-youtube', bg: '#FF0000' },
  supabase: { sym: 'ic-supabase', bg: '#1F2937' },
  landing: { sym: 'ic-landing', bg: '#7C5CFF' },
};
const iconFor = (k: string): IconDef => ICON[k] ?? { sym: 'ic-supabase', bg: '#1F2937' };

function SvcIcon({ k, size = 21, box = 34, radius = 9 }: { k: string; size?: number; box?: number; radius?: number }) {
  const ic = iconFor(k);
  return (
    <span style={{ width: box, height: box, flex: 'none', borderRadius: radius, background: ic.bg, border: ic.bd, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 24 24"><use href={`#${ic.sym}`} /></svg>
    </span>
  );
}

// ── <defs> de todos los símbolos de marca (una sola vez en la página) ─────────
function BrandDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <linearGradient id="mkGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0C60A" /><stop offset="100%" stopColor="#C8870C" /></linearGradient>
      <symbol id="ic-meta" viewBox="0 0 24 24"><g transform="scale(1.5)"><path fill="#fff" fillRule="evenodd" d="M8.217 5.243C9.145 3.988 10.171 3 11.483 3 13.96 3 16 6.153 16.001 9.907c0 2.29-.986 3.725-2.757 3.725-1.543 0-2.395-.866-3.924-3.424l-.667-1.123-.118-.197a55 55 0 0 0-.53-.877l-1.178 2.08c-1.673 2.925-2.615 3.541-3.923 3.541C1.086 13.632 0 12.217 0 9.973 0 6.388 1.995 3 4.598 3q.477-.001.924.122c.31.086.611.22.913.407.577.359 1.154.915 1.782 1.714m1.516 2.224q-.378-.615-.727-1.133L9 6.326c.845-1.305 1.543-1.954 2.372-1.954 1.723 0 3.102 2.537 3.102 5.653 0 1.188-.39 1.877-1.195 1.877-.773 0-1.142-.51-2.61-2.87zM4.846 4.756c.725.1 1.385.634 2.34 2.001A212 212 0 0 0 5.551 9.3c-1.357 2.126-1.826 2.603-2.581 2.603-.777 0-1.24-.682-1.24-1.9 0-2.602 1.298-5.264 2.846-5.264q.137 0 .27.018" /></g></symbol>
      <symbol id="ic-whatsapp" viewBox="0 0 24 24"><path fill="#fff" d="M12 3.8a8.1 8.1 0 0 0-6.94 12.26L4 20.2l4.25-1.1A8.1 8.1 0 1 0 12 3.8zm4.72 11.43c-.2.56-1.17 1.07-1.62 1.11-.44.04-.86.2-2.9-.6-2.45-.97-4-3.46-4.12-3.62-.12-.16-.98-1.3-.98-2.48s.62-1.76.84-2c.22-.24.48-.3.64-.3h.46c.15 0 .35-.06.54.41l.66 1.6c.05.11.09.24.02.38l-.3.46-.32.35c-.1.1-.21.22-.09.43.12.2.54.9 1.16 1.45.8.71 1.47.93 1.68 1.04.2.11.32.09.44-.05l.63-.73c.16-.2.32-.16.54-.08l1.53.72c.22.11.37.16.42.25.06.09.06.53-.14 1.05z" /></symbol>
      <symbol id="ic-resend" viewBox="0 0 24 24"><path fill="#fff" d="M6.5 4.5h6.2c2.6 0 4.4 1.5 4.4 3.9 0 1.7-.9 3-2.4 3.6l3 7.5h-3.4l-2.6-6.8H9.6v6.8H6.5zm3.1 2.6v3.2h2.7c1.1 0 1.8-.6 1.8-1.6s-.7-1.6-1.8-1.6z" /></symbol>
      <symbol id="ic-anthropic" viewBox="0 0 24 24"><path fill="#fff" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.541Zm-.3712 10.2223 2.2914-5.9456 2.2914 5.9456Z" /></symbol>
      <symbol id="ic-openai" viewBox="0 0 24 24"><path fill="#fff" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z" /></symbol>
      <symbol id="ic-groq" viewBox="0 0 24 24"><path fill="#fff" d="M12 3.4a5.9 5.9 0 0 0 0 11.8h1.9v-2.3H12a3.6 3.6 0 1 1 3.6-3.6v5.1c0 1.9-1.6 3.4-3.5 3.4a3.5 3.5 0 0 1-2.5-1l-1.6 1.6a5.8 5.8 0 0 0 4.1 1.7c3.2 0 5.8-2.5 5.8-5.7V9.2A5.9 5.9 0 0 0 12 3.4z" /></symbol>
      <symbol id="ic-fathom" viewBox="0 0 24 24"><path fill="#fff" d="M6.5 4.5h11v2.9H9.7v3.3h6.9v2.9H9.7V19.5H6.5z" /></symbol>
      <symbol id="ic-calendly" viewBox="0 0 24 24"><path fill="#fff" d="M17 3h-1V2h-2v1h-4V2H8v1H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H7V9h10v10zM7 7V5h10v2H7z" /><circle cx="9.5" cy="12.5" r="1.1" fill="#fff" /><circle cx="14.5" cy="12.5" r="1.1" fill="#fff" /><circle cx="9.5" cy="16" r="1.1" fill="#fff" /><circle cx="14.5" cy="16" r="1.1" fill="#fff" /></symbol>
      <symbol id="ic-youtube" viewBox="0 0 24 24"><path fill="#fff" d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3z" /></symbol>
      <symbol id="ic-google" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.63-.06-1.25-.16-1.84H12v3.48h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.97-4.3 2.97-7.16z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.41 13.91a5.99 5.99 0 0 1 0-3.82V7.51H3.07a10 10 0 0 0 0 8.98z" /><path fill="#EA4335" d="M12 6.58c1.47 0 2.79.5 3.83 1.5l2.86-2.87A9.96 9.96 0 0 0 12 2 10 10 0 0 0 3.07 7.51l3.34 2.58C7.2 8.34 9.4 6.58 12 6.58z" /></symbol>
      <symbol id="ic-panda" viewBox="0 0 24 24"><circle cx="6.6" cy="6.8" r="2.7" fill="#161616" /><circle cx="17.4" cy="6.8" r="2.7" fill="#161616" /><circle cx="12" cy="13" r="7.3" fill="#fff" stroke="#161616" strokeWidth="1.4" /><ellipse cx="9" cy="11.9" rx="1.7" ry="2.1" fill="#161616" /><ellipse cx="15" cy="11.9" rx="1.7" ry="2.1" fill="#161616" /><circle cx="12" cy="15.7" r="1.15" fill="#161616" /></symbol>
      <symbol id="ic-supabase" viewBox="0 0 24 24"><path fill="#3ECF8E" d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z" /></symbol>
      {/* Landing: ventana de navegador con el play del VSL adentro. */}
      <symbol id="ic-landing" viewBox="0 0 24 24"><path fill="#fff" d="M4 3.5h16a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V5A1.5 1.5 0 0 1 4 3.5zm0 5V19h16V8.5zm1.6-3.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm2.6 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z" /><path fill="#7C5CFF" d="M10.4 11.3v4.9l4.3-2.45z" /></symbol>
    </defs></svg>
  );
}

const Spark = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ overflow: 'visible', flex: 'none' }}>
    <path d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z" fill="url(#mkGold)" />
  </svg>
);

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const capMono: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)' };

// Orden de categorías del diseño.
const CAT_ORDER = ['Publicidad', 'Mensajería', 'Inteligencia', 'Reuniones', 'Datos'];

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
export function IntegracionesBoard({ integraciones, health, metaError, incidentes, snippetLanding }: {
  integraciones: Integracion[];
  health: MetaHealth | null;
  metaError: string | null;
  incidentes: Incidente[];
  /** <script> con el token del workspace, listo para copiar. null = admin sin impersonar. */
  snippetLanding?: string | null;
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
    .map((cat) => ({ cat, items: integraciones.filter((i) => i.categoria === cat) }))
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
        {porCategoria.map((g) => (
          <div key={g.cat} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 24, alignItems: 'center', padding: '18px 0', borderTop: '1px solid var(--surface-2)' }}>
            <div style={capMono}>{g.cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
              {g.items.map((i) => (
                <button key={i.key} type="button" onClick={() => setModal({ t: 'svc', key: i.key })} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px' }}>
                  <SvcIcon k={i.key} />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nombre}</span>
                  <span style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: dotColor(sevOf(i)) }} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ═══ COSTO DE MAKO ═══ */}
      <CostoMaKo usage={usage} onVerOps={() => setModal({ t: 'hist' })} onCargarSaldo={cargar} onOpenService={(key) => setModal({ t: 'svc', key })} />

      {/* ═══ HISTORIAL DE PROBLEMAS ═══ */}
      <ProblemasHistorial incidentes={incidentes} nombreDe={(s) => svcByKey(s)?.nombre ?? s} />

      {/* ═══ MODALES ═══ */}
      {modal?.t === 'svc' && svcByKey(modal.key) && (
        <ServicioModal
          i={svcByKey(modal.key)!}
          sev={sevOf(svcByKey(modal.key)!)}
          health={health} metaError={metaError} usage={usage}
          snippetLanding={snippetLanding}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.t === 'hist' && usage && (
        <OperacionesModal usage={usage} onClose={() => setModal(null)} />
      )}
    </main>
  );
}

// ── Costo de MaKo ─────────────────────────────────────────────────────────────
function CostoMaKo({ usage, onVerOps, onCargarSaldo, onOpenService }: { usage: Resumen | null; onVerOps: () => void; onCargarSaldo: () => void; onOpenService: (key: string) => void }) {
  const provs = usage?.porProveedor ?? [];
  const feats = (usage?.porFeature ?? []).slice(0, 8);
  const maxFeat = Math.max(1, ...feats.map((f) => f.costUsd));
  const [editProv, setEditProv] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async (provider: string) => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try {
      const j = await (await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v, provider }) })).json();
      if (j?.ok) { setEditProv(null); setInput(''); onCargarSaldo(); }
    } finally { setSaving(false); }
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

      {/* Tiles por proveedor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 11, marginBottom: 26 }}>
        {provs.map((p) => {
          const low = p.restanteUsd !== null && p.restanteUsd <= 5;
          const pct = Math.min(100, Math.max(2, (p.tokensHoy / GROQ_LIMITE_DIA_TOKENS) * 100));
          const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
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
                // Groq no se mide en $: es gratis, limitado por tokens/día del plan.
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 7 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>uso de hoy</span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{fmtTok(p.tokensHoy)}<span style={{ color: 'var(--faint)' }}> / {fmtTok(GROQ_LIMITE_DIA_TOKENS)}</span></span>
                  </div>
                  <div style={{ height: 7, borderRadius: 5, background: 'var(--border)' }}><div style={{ height: 7, width: `${pct}%`, borderRadius: 5, background: '#F55036' }} /></div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>tokens · el límite del plan gratis reinicia cada día</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 21, letterSpacing: '-0.02em', color: p.restanteUsd === null ? 'var(--faint)' : low ? 'var(--warn)' : 'var(--ink)' }}>{p.restanteUsd === null ? 'sin saldo' : usd(p.restanteUsd)}</span>
                    {p.restanteUsd !== null && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>restante</span>}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: low ? 'var(--warn)' : 'var(--faint)', marginTop: 5 }}>gastó {usd(p.costMesUsd)} este mes</div>
                  {editProv === p.provider ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 9 }} onClick={stop}>
                      <input value={input} onClick={stop} onChange={(e) => setInput(e.target.value)} inputMode="decimal" autoFocus placeholder={p.saldo ? String(p.saldo.usd) : 'Saldo USD'} style={{ flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 12.5, outline: 'none' }} />
                      <button onClick={(e) => { stop(e); guardar(p.provider); }} disabled={saving || !input.trim()} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', background: saving || !input.trim() ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontSize: 12.5, fontWeight: 600, cursor: saving || !input.trim() ? 'default' : 'pointer' }}>{saving ? '…' : 'OK'}</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { stop(e); setEditProv(p.provider); setInput(''); }} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>{p.saldo ? 'editar saldo' : 'cargar saldo'}</button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Gasto por proceso */}
      {feats.length > 0 && (
        <>
          <div style={{ ...capMono, fontSize: 10, letterSpacing: '.13em', marginBottom: 13 }}>Gasto por proceso</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {feats.map((f) => (
              <div key={f.feature} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,190px) 1fr 52px', alignItems: 'center', gap: 13 }}>
                <span style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{procesoLegible(f.feature)}</span>
                <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2)' }}><div style={{ height: 8, width: `${Math.max(3, (f.costUsd / maxFeat) * 100)}%`, borderRadius: 6, background: 'linear-gradient(90deg,#C8870C,#F0C60A)' }} /></div>
                <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: f.costUsd > 0 ? 'var(--ink)' : 'var(--dim)' }}>{usd(f.costUsd)}</span>
              </div>
            ))}
          </div>
        </>
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
function ModalShell({ w, label, onClose, children }: { w: number; label: string; onClose: () => void; children: ReactNode }) {
  // Bloquea el scroll del fondo mientras el modal está abierto (como el diseño).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,22,27,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'mkFade .16s ease' }}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} style={{ width: w, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', animation: 'mkPop .2s cubic-bezier(.2,.7,.3,1)' }}>
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

// ── Modal de servicio ─────────────────────────────────────────────────────────
function ServicioModal({ i, sev, health, metaError, usage, snippetLanding, onClose }: {
  i: Integracion; sev: 'good' | 'warn' | 'bad'; health: MetaHealth | null; metaError: string | null; usage: Resumen | null; snippetLanding?: string | null; onClose: () => void;
}) {
  const chip = sev === 'good' ? { bg: 'var(--good-bg)', fg: 'var(--good)', word: 'Conectada' }
    : sev === 'warn' ? { bg: 'var(--warn-bg)', fg: 'var(--warn)', word: 'Por configurar' }
    : { bg: 'var(--bad-bg)', fg: 'var(--bad)', word: 'Requiere atención' };

  // BYOK: si el servicio está en el catálogo de /metodo y NO es soloServidor,
  // embebemos el form de pegar/guardar/probar (reemplaza la lista de envs crudos).
  // Los servicios sin catálogo (p.ej. la landing) quedan informativos.
  const catalogo = servicioMetodo(i.key);
  const mostrarForm = !!catalogo && !catalogo.soloServidor;

  // Facts + acciones por servicio.
  let mako = false;
  let line = i.descripcion;
  let facts: Array<{ k: string; v: string; c: string }> = [];
  const actions: Array<{ label: string; href?: string; primary?: boolean; sameTab?: boolean }> = [];
  const faltan = i.estado === 'falta' ? i.detalle.replace(/^Falta configurar:\s*/, '') : '';

  if (i.key === 'meta' && health) {
    mako = true;
    const a = health.account;
    line = a.entregaFrenada
      ? 'La cuenta no entrega hasta que regularices el pago en el Administrador de Anuncios.'
      : (a.disableReasonLabel || a.statusLabel || 'Estado de la cuenta publicitaria.');
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
    line = metaError ? `No se pudo leer el estado de Meta: ${metaError}` : i.descripcion;
  } else if (i.key === 'anthropic' || i.key === 'openai') {
    mako = i.key === 'anthropic';
    const prov = usage?.porProveedor?.find((p) => p.provider === i.key);
    if (prov) {
      facts = [
        { k: 'Restante', v: prov.restanteUsd === null ? 'sin saldo' : usd(prov.restanteUsd), c: prov.restanteUsd !== null && prov.restanteUsd <= 5 ? 'var(--warn)' : 'var(--ink)' },
        { k: 'Gasto del mes', v: usd(prov.costMesUsd), c: 'var(--ink)' },
      ];
    }
    line = i.key === 'anthropic' ? 'El motor de casi todo lo que hace MaKo: análisis, chats y sugerencias.' : 'Transcripción de llamadas y tareas simples de IA.';
    actions.push({ label: i.key === 'anthropic' ? 'Ver saldo de Claude ↗' : 'Cargar saldo en OpenAI ↗', href: i.key === 'anthropic' ? 'https://console.anthropic.com/settings/billing' : 'https://platform.openai.com/settings/organization/billing', primary: i.key === 'openai' });
  } else if (i.key === 'groq') {
    const prov = usage?.porProveedor?.find((p) => p.provider === 'groq');
    if (prov) {
      facts = [
        { k: 'Uso de hoy', v: `${fmtTok(prov.tokensHoy)} tok`, c: 'var(--ink)' },
        { k: 'Tokens del mes', v: `${fmtTok(prov.tokens)} tok`, c: 'var(--ink)' },
      ];
    }
    line = 'IA rápida y gratis (Groq) para tareas simples y transcripción. No se mide en dinero: está limitada por tokens/día del plan gratuito.';
  } else if (i.key === 'google') {
    // El OAuth de Google Calendar es un redirect en la MISMA pestaña.
    actions.push({ label: 'Conectar Google Calendar', href: '/api/integraciones/google-calendar', primary: true, sameTab: true });
  }
  // La landing se queda con su descripción del catálogo: el estado en vivo
  // ("recibiendo eventos" / "todavía no llegó nada") lo dice el botón Verificar,
  // no un párrafo que repita lo mismo.

  // La landing no se configura con credenciales: se configura copiando un código.
  const esLanding = i.key === 'landing';

  return (
    <ModalShell w={500} label={i.nombre} onClose={onClose}>
      <div style={{ padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 11 }}>
          <SvcIcon k={i.key} box={44} radius={12} size={25} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.014em', margin: 0, color: 'var(--ink)' }}>{i.nombre}</h3>
            <div style={{ ...capMono, fontSize: 10.5, letterSpacing: '.06em', marginTop: 3 }}>{i.categoria}</div>
          </div>
          <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: chip.bg, color: chip.fg }}>{chip.word}</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* La descripción es una línea SUTIL bajo el título, no un apartado con caja. */}
        {line && (
          <p style={{ display: 'flex', alignItems: 'flex-start', gap: 7, margin: '0 0 16px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
            {mako && <span style={{ flex: 'none', marginTop: 2 }}><Spark size={12} /></span>}
            <span>{line}</span>
          </p>
        )}

        {facts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 15 }}>
            {facts.map((f) => (
              <div key={f.k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px' }}>
                <div style={{ ...capMono, fontSize: 9.5, letterSpacing: '.09em', marginBottom: 6 }}>{f.k}</div>
                <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: f.c }}>{f.v}</div>
              </div>
            ))}
          </div>
        )}

        {esLanding ? (
          <div style={{ marginBottom: 15 }}>
            <CodigoLanding snippet={snippetLanding ?? null} />
          </div>
        ) : mostrarForm ? (
          <div style={{ marginBottom: 15 }}>
            <ServicioConfigForm servicioKey={i.key} />
          </div>
        ) : i.estado === 'falta' && (
          <div style={{ marginBottom: 15 }}>
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

        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            {actions.map((a) => (
              <a key={a.label} href={a.href} target={a.sameTab ? undefined : '_blank'} rel={a.sameTab ? undefined : 'noopener noreferrer'} style={{ border: `1px solid ${a.primary ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 10, background: a.primary ? 'var(--primary)' : 'var(--surface)', color: a.primary ? '#fff' : 'var(--dim)', fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13.5, padding: '10px 15px', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }}>{a.label}</a>
            ))}
          </div>
        )}
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
    const set = new Set<string>();
    for (const o of all) { const l = modeloLegible(o.model); if (l !== '—') set.add(l); }
    return [...set];
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
    { key: 'prov', label: 'IA', cur: fProv, set: setFProv, opts: [['todos', 'Todas'], ['anthropic', 'Claude'], ['openai', 'OpenAI'], ['groq', 'Groq']] as [string, string][] },
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
