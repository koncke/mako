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
import { MakoLogo, MakoStar } from '../_components/MakoBrand';
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
// REGLA: acá solo van logos OFICIALES, copiados tal cual de la fuente de la marca
// (ver BrandDefs). Si no conseguimos el vector oficial de un servicio, NO se
// dibuja uno "parecido": va un letter-mark (la inicial en Geist sobre el color de
// marca real). Un logo inventado es peor que una inicial honesta.
type IconDef = { sym?: string; letter?: string; bg: string; bd?: string; fg?: string };
const ICON: Record<string, IconDef> = {
  meta: { sym: 'ic-meta', bg: '#0866FF' },
  whatsapp: { sym: 'ic-whatsapp', bg: '#25D366' },
  email: { sym: 'ic-resend', bg: '#000000' },      // Resend brand: negro
  anthropic: { sym: 'ic-anthropic', bg: '#CC785C' },
  openai: { sym: 'ic-openai', bg: '#000000' },
  groq: { sym: 'ic-groq', bg: '#F55036' },
  fathom: { sym: 'ic-fathom', bg: '#000000' },     // fathom.video: mark celeste sobre negro
  calendly: { sym: 'ic-calendly', bg: '#006BFF' },
  google: { sym: 'ic-google', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Panda: su logo es oscuro sobre claro y trae blancos macizos → tile blanco con
  // borde (igual que google). Con un bg de color el logo se rompe.
  panda: { sym: 'ic-panda', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  youtube: { sym: 'ic-youtube', bg: '#FF0000' },
  supabase: { sym: 'ic-supabase', bg: '#1F2937' },
  landing: { sym: 'ic-landing', bg: '#7C5CFF' },
};
const iconFor = (k: string): IconDef => ICON[k] ?? { sym: 'ic-supabase', bg: '#1F2937' };

function SvcIcon({ k, size = 21, box = 34, radius = 9 }: { k: string; size?: number; box?: number; radius?: number }) {
  const ic = iconFor(k);
  return (
    // Decorativo: el nombre del servicio SIEMPRE va al lado. Sin esto, el
    // letter-mark se lee doble ("P Panda Video").
    <span aria-hidden style={{ width: box, height: box, flex: 'none', borderRadius: radius, background: ic.bg, border: ic.bd, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {ic.letter
        ? <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, fontSize: Math.round(box * 0.46), lineHeight: 1, letterSpacing: '-0.03em', color: ic.fg ?? '#fff' }}>{ic.letter}</span>
        : <svg width={size} height={size} viewBox="0 0 24 24"><use href={`#${ic.sym}`} /></svg>}
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
      {/* Resend — logo oficial (simple-icons `resend`, fuente https://resend.com/brand). */}
      <symbol id="ic-resend" viewBox="0 0 24 24"><path fill="#fff" d="M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z" /></symbol>
      <symbol id="ic-anthropic" viewBox="0 0 24 24"><path fill="#fff" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.541Zm-.3712 10.2223 2.2914-5.9456 2.2914 5.9456Z" /></symbol>
      <symbol id="ic-openai" viewBox="0 0 24 24"><path fill="#fff" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z" /></symbol>
      <symbol id="ic-groq" viewBox="0 0 24 24"><path fill="#fff" d="M12 3.4a5.9 5.9 0 0 0 0 11.8h1.9v-2.3H12a3.6 3.6 0 1 1 3.6-3.6v5.1c0 1.9-1.6 3.4-3.5 3.4a3.5 3.5 0 0 1-2.5-1l-1.6 1.6a5.8 5.8 0 0 0 4.1 1.7c3.2 0 5.8-2.5 5.8-5.7V9.2A5.9 5.9 0 0 0 12 3.4z" /></symbol>
      {/* Fathom (fathom.video, el grabador de reuniones) — mark oficial, extraído de su
          propio wordmark: cdn.prod.website-files.com/…/68e7961f4ff1cd5e326512f7_logo-wordmark-new.svg
          Verificado contra su favicon (mark #00BEFF/#007299 sobre negro).
          OJO: el "Fathom" de simple-icons es Fathom Analytics (usefathom.com), OTRA empresa.
          El mark vive en x 141.42→165.88, y 0→24.95 del wordmark → lo encuadramos a 24×24. */}
      <symbol id="ic-fathom" viewBox="0 0 24 24">
        <g transform="translate(.24 0) scale(.962) translate(-141.42 .043)">
          <path fill="#007299" d="M141.836 16.4481V21.3875C141.836 22.6831 142.645 23.8563 143.861 24.2456C145.927 24.9052 147.825 23.3578 147.825 21.3606V19.501L141.836 16.4481Z" />
          <path fill="#00BEFF" d="M162.465 15.4261C162.015 15.4261 161.559 15.3237 161.128 15.1055L143.553 6.19528C142.097 5.45682 141.42 3.67948 142.099 2.17906C142.807 0.60815 144.65 -0.0430392 146.16 0.722275L163.733 9.63081C165.207 10.3777 165.882 12.249 165.144 13.7444C164.619 14.8101 163.562 15.4261 162.462 15.4261H162.465Z" />
          <path fill="#00BEFF" d="M153.644 19.9273C153.194 19.9273 152.737 19.8249 152.307 19.6068L143.553 15.1693C142.097 14.4308 141.42 12.6535 142.099 11.153C142.807 9.58214 144.65 8.93095 146.162 9.69626L154.913 14.1321C156.387 14.8789 157.062 16.7502 156.324 18.2456C155.799 19.3114 154.742 19.9273 153.642 19.9273H153.644Z" />
        </g>
      </symbol>
      {/* Calendly — logo oficial (simple-icons `calendly`, fuente https://calendly.com/newsroom). */}
      <symbol id="ic-calendly" viewBox="0 0 24 24"><path fill="#fff" d="M19.655 14.262c.281 0 .557.023.828.064 0 .005-.005.01-.005.014-.105.267-.234.534-.381.786l-1.219 2.106c-1.112 1.936-3.177 3.127-5.411 3.127h-2.432c-2.23 0-4.294-1.191-5.412-3.127l-1.218-2.106a6.251 6.251 0 0 1 0-6.252l1.218-2.106C6.736 4.832 8.8 3.641 11.035 3.641h2.432c2.23 0 4.294 1.191 5.411 3.127l1.219 2.106c.147.252.271.519.381.786 0 .004.005.009.005.014-.267.041-.543.064-.828.064-1.816 0-2.501-.607-3.291-1.306-.764-.676-1.711-1.517-3.44-1.517h-1.029c-1.251 0-2.387.455-3.2 1.278-.796.805-1.233 1.904-1.233 3.099v1.411c0 1.196.437 2.295 1.233 3.099.813.823 1.949 1.278 3.2 1.278h1.034c1.729 0 2.676-.841 3.439-1.517.791-.703 1.471-1.306 3.287-1.301Zm.005-3.237c.399 0 .794-.036 1.179-.11-.002-.004-.002-.01-.002-.014-.073-.414-.193-.823-.349-1.218.731-.12 1.407-.396 1.986-.819 0-.004-.005-.013-.005-.018-.331-1.085-.832-2.101-1.489-3.03-.649-.915-1.435-1.719-2.331-2.395-1.867-1.398-4.088-2.138-6.428-2.138-1.448 0-2.855.28-4.175.841-1.273.543-2.423 1.315-3.407 2.299S2.878 6.552 2.341 7.83c-.557 1.324-.842 2.726-.842 4.175 0 1.448.281 2.855.842 4.174.542 1.274 1.314 2.423 2.298 3.407s2.129 1.761 3.407 2.299c1.324.556 2.727.841 4.175.841 2.34 0 4.561-.74 6.428-2.137a10.815 10.815 0 0 0 2.331-2.396c.652-.929 1.158-1.949 1.489-3.03 0-.004.005-.014.005-.018-.579-.423-1.255-.699-1.986-.819.161-.395.276-.804.349-1.218.005-.009.005-.014.005-.023.869.166 1.692.506 2.404 1.035.685.505.552 1.075.446 1.416C22.184 20.437 17.619 24 12.221 24c-6.625 0-12-5.375-12-12s5.37-12 12-12c5.398 0 9.963 3.563 11.471 8.464.106.341.239.915-.446 1.421-.717.529-1.535.873-2.404 1.034.128.716.128 1.45 0 2.166-.387-.074-.782-.11-1.182-.11-4.184 0-3.968 2.823-6.736 2.823h-1.029c-1.899 0-3.15-1.357-3.15-3.095v-1.411c0-1.738 1.251-3.094 3.15-3.094h1.034c2.768 0 2.552 2.823 6.731 2.827Z" /></symbol>
      <symbol id="ic-youtube" viewBox="0 0 24 24"><path fill="#fff" d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3z" /></symbol>
      <symbol id="ic-google" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.63-.06-1.25-.16-1.84H12v3.48h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.97-4.3 2.97-7.16z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.41 13.91a5.99 5.99 0 0 1 0-3.82V7.51H3.07a10 10 0 0 0 0 8.98z" /><path fill="#EA4335" d="M12 6.58c1.47 0 2.79.5 3.83 1.5l2.86-2.87A9.96 9.96 0 0 0 12 2 10 10 0 0 0 3.07 7.51l3.34 2.58C7.2 8.34 9.4 6.58 12 6.58z" /></symbol>
      {/* Panda Video — logo OFICIAL. Salió del SVG inline de su sitio: es un sitio
          Framer y el logo vive dentro del sprite #svg-templates, no como archivo
          suelto (ojo: los .svg de framerusercontent son un PNG envuelto en <image>,
          no son vectores). Se le sacó el wordmark "pandavideo" y quedó la marca; el
          viewBox es su bbox real medida con getBBox, no estimada.
          OJO: los paths BLANCOS son rellenos macizos (tapan por debajo de las orejas
          y del triángulo), así que este logo NECESITA fondo claro — por eso ICON.panda
          va con bg blanco + borde, como google. Sobre un tile de color se rompe.
          Su color de marca es #232536 (no #2F2F2F): verificado decodificando la
          paleta PLTE de su favicon oficial. */}
      <symbol id="ic-panda" viewBox="-0.3 0.1 38.45 38.45"><path d="M15.7855 4.28538L15.7844 4.28463L15.7813 4.28268C13.3171 2.65747 10.3959 2.67473 8.0982 3.78454C5.79881 4.89514 4 7.17406 4 10.1354V28.8665C4 31.8281 5.79908 34.1058 8.09847 35.2158C10.3873 36.3208 13.2947 36.3419 15.7529 34.7381L30.7398 25.9877L30.7472 25.9833L30.7541 25.9788L30.7736 25.9658C35.0748 23.1343 35.0754 17.0928 30.7757 14.2603L30.7734 14.2588L15.7855 4.28538Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M16.1641 1.69433L16.1807 1.70428L16.2022 1.71864L32.7824 12.416L32.9208 12.5006L32.9362 12.5159C38.4804 16.1868 38.4332 23.923 32.7945 27.5246L32.7918 27.5263L32.7688 27.5411L32.7316 27.5648L32.6862 27.5908L16.1129 36.973C12.9239 38.9741 9.17164 38.935 6.22709 37.5568C3.25831 36.1672 0.822266 33.2498 0.822266 29.3778V9.25698C0.822266 5.38547 3.25764 2.4668 6.22651 1.07646C9.18676 -0.309869 12.964 -0.342469 16.1641 1.69433ZM14.5666 4.2337C12.3105 2.79099 9.62402 2.79804 7.49884 3.7933C5.37272 4.78897 3.82227 6.7663 3.82227 9.25698V29.3778C3.82227 31.8684 5.37264 33.8444 7.49886 34.8397C9.61595 35.8306 12.2905 35.8412 14.5414 34.4173L14.5724 34.3977L31.1797 24.9962C34.9001 22.6198 35.0153 17.7207 31.5259 15.1879H31.3655L31.0389 14.8613L14.585 4.24542L14.5666 4.2337Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M7.01009 2.7532C9.45819 1.60668 12.5673 1.59083 15.1875 3.2663L15.1909 3.2684L31.7976 13.9829L31.7997 13.9843C36.3476 16.8891 36.3469 23.0617 31.7976 25.9655L31.776 25.9793L15.1644 35.3833C12.5492 37.0413 9.45119 37.0223 7.01029 35.88C4.56059 34.7334 2.67139 32.3965 2.67139 29.3778V9.2571C2.67139 6.2385 4.56039 3.9004 7.01009 2.7532ZM7.83069 4.537C5.92749 5.4283 4.62049 7.1501 4.62049 9.2571V29.3778C4.62049 31.4846 5.92719 33.2051 7.83049 34.0959C9.73539 34.9876 12.1366 34.989 14.1447 33.7071L14.1665 33.6933L30.7767 24.2902C34.096 22.1529 34.089 17.7726 30.7557 15.6449L30.7515 15.6423L14.1441 4.9274L14.1425 4.9263C12.135 3.6435 9.73499 3.6452 7.83069 4.537Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M12.339 14.7021C14.1568 14.7021 15.6258 16.1893 15.6258 18.0183C15.6258 21.2603 13.0269 23.8827 9.81379 23.8775H3.17139V14.7021H12.339ZM11.4523 20.4355C10.3942 20.5818 9.41949 19.8354 9.27449 18.7679C9.12949 17.7002 9.86919 16.7168 10.9274 16.5705C11.9855 16.424 12.9602 17.1706 13.1053 18.2383C13.2503 19.3058 12.5105 20.2892 11.4523 20.4355Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M24.8926 14.7021C23.0798 14.7021 21.6108 16.1893 21.6108 18.0183C21.6108 21.2603 24.2099 23.8827 27.413 23.8775H32.3456C32.8812 23.8775 33.3922 23.6646 33.7704 23.2828C34.1489 22.906 34.36 22.3904 34.36 21.8503V17.9689C34.36 17.1062 34.0211 16.2735 33.412 15.6589C32.8074 15.0442 31.982 14.7021 31.1224 14.7021H24.8926ZM25.313 20.2742C26.3711 20.4205 27.3457 19.6744 27.4908 18.6067C27.6367 17.5324 26.897 16.5487 25.8379 16.4093C24.7797 16.263 23.8051 17.0093 23.6601 18.077C23.5151 19.1447 24.2548 20.128 25.313 20.2742Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M13.4985 8.766C14.0001 8.4776 14.2887 7.9208 14.2292 7.338C14.1697 6.7553 13.7798 6.2671 13.2287 6.0856C11.7669 5.6041 10.1814 5.7284 8.81227 6.4299C7.44307 7.1313 6.40657 8.3543 5.93087 9.8245L5.69297 10.5596C5.50697 11.1345 5.69727 11.7604 6.17187 12.1305C6.64647 12.5006 7.29297 12.531 7.80057 12.208C9.19797 11.3073 10.5073 10.4715 10.5073 10.4715C10.5073 10.4715 12.0138 9.6171 13.4985 8.766Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M19.7902 23.4977C19.7902 23.3008 19.7123 23.1139 19.5775 22.9753C19.4397 22.837 19.2537 22.7593 19.0589 22.7593C18.5822 22.7593 17.9586 22.7593 17.4821 22.7593C17.287 22.7593 17.1013 22.837 16.9635 22.9753C16.8254 23.1139 16.7505 23.3008 16.7505 23.4977C16.7505 23.6919 16.8285 23.8815 16.9635 24.0201C17.1013 24.1584 17.287 24.2361 17.4821 24.2361C17.9586 24.2361 18.5822 24.2361 19.0589 24.2361C19.2537 24.2361 19.4397 24.1584 19.5775 24.0201C19.7123 23.8815 19.7902 23.6945 19.7902 23.4977Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M16.8182 22.8305C16.9942 22.6539 17.232 22.5542 17.4821 22.5542H19.0589C19.3086 22.5542 19.5468 22.6539 19.7228 22.8305L19.7245 22.8323C19.8959 23.0085 19.9953 23.2465 19.9953 23.4977C19.9953 23.7488 19.8959 23.9868 19.7245 24.163L19.7228 24.1648C19.5468 24.3415 19.3086 24.4411 19.0589 24.4411H17.4821C17.232 24.4411 16.9942 24.3414 16.8182 24.1648L16.8166 24.1632C16.6447 23.9867 16.5454 23.7459 16.5454 23.4977C16.5454 23.2484 16.6406 23.0089 16.8182 22.8305ZM17.4821 22.9643C17.3419 22.9643 17.2084 23.02 17.1088 23.12C17.0102 23.2189 16.9556 23.3532 16.9556 23.4977C16.9556 23.6375 17.012 23.7755 17.1096 23.8762C17.2091 23.9756 17.3423 24.031 17.4821 24.031H19.0589C19.1984 24.031 19.3319 23.9756 19.4314 23.8762C19.529 23.7753 19.5851 23.6398 19.5851 23.4977C19.5851 23.3555 19.529 23.22 19.4314 23.1191C19.3319 23.0197 19.1984 22.9643 19.0589 22.9643H17.4821Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M14.1666 25.8098C14.1666 25.8098 14.6248 26.3471 15.3458 26.6664C15.7853 26.8611 16.3134 26.976 16.8923 26.8822C17.6251 26.7626 18.153 26.4293 18.5229 25.9928C18.9204 25.5212 19.1323 24.9157 19.1623 24.2775C19.1856 23.7823 18.8066 23.3598 18.3157 23.3364C17.825 23.3128 17.4065 23.6954 17.3832 24.193C17.3716 24.4252 17.3134 24.6553 17.1667 24.8266C17.0436 24.9719 16.8553 25.0658 16.6111 25.1058C16.4063 25.1386 16.2203 25.0894 16.0643 25.019C15.7296 24.871 15.5108 24.6269 15.5108 24.6269C15.1876 24.2539 14.6248 24.2141 14.2526 24.5403C13.8805 24.8664 13.8433 25.4365 14.1666 25.8098Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M21.0334 24.6269C21.0334 24.6269 20.8171 24.871 20.4799 25.019C20.3241 25.0871 20.1379 25.1386 19.9333 25.1058C19.6891 25.0658 19.5006 24.9719 19.3775 24.8266C19.2308 24.6529 19.1729 24.4252 19.1612 24.193C19.1379 23.6978 18.7192 23.3128 18.2285 23.3364C17.7378 23.3598 17.3586 23.7823 17.3819 24.2775C17.4122 24.9157 17.6217 25.5212 18.0216 25.9928C18.3891 26.4293 18.9194 26.7626 19.6519 26.8822C20.231 26.976 20.759 26.8611 21.1987 26.6664C21.9219 26.3472 22.3779 25.8098 22.3779 25.8098C22.7012 25.4365 22.6639 24.8664 22.2917 24.5403C21.9195 24.2141 21.3567 24.2539 21.0334 24.6269Z" fill="#232536" /><path d="M28 4C26.5 4 24 4.5 22.5 6.5L30 12.5C30.8333 13.1667 32.9802 14.5198 34 13.5C35 12.5 35.3438 11.3751 35 10C34 6 30.5 4 28 4Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M25.373 8.76318C24.873 8.47948 24.589 7.92118 24.6439 7.33988C24.7003 6.76338 25.0901 6.27518 25.6411 6.09368C27.1029 5.61218 28.6978 5.73348 30.0686 6.43968C31.4392 7.14578 32.4804 8.36718 32.9575 9.84218L33.1924 10.5679C33.3784 11.1428 33.188 11.7686 32.7134 12.1388C32.239 12.5089 31.5923 12.5393 31.0847 12.2163C29.6874 11.3156 28.3783 10.4797 28.3783 10.4797C28.3783 10.4797 26.8625 9.61278 25.373 8.76318Z" fill="#232536" /></symbol>
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
type Slide = { t: string; d: string };
const SLIDES: Record<string, Slide[]> = {
  meta: [
    // lib/meta-ads.ts (fetchMetaInsights, level=ad) + app/api/cron/meta-daily
    { t: 'Cada anuncio, todos los días', d: 'Gasto, CTR, CPC, leads y retención por cuartiles de cada anuncio. Entra solo, todos los días.' },
    // lib/meta-health.ts (semáforo + recomendaciones fuente:'mako')
    { t: 'El semáforo de la cuenta', d: 'Si Meta te frenó la entrega, te rechazó un anuncio o algo quedó en aprendizaje, lo ves acá — y MaKo te dice qué tocar.' },
    // app/api/webhooks/meta-leads + lib/meta-leads.ts (poll de respaldo)
    { t: 'Los leads entran solos', d: 'Cada Lead Ad cae en el CRM en el momento, con su hilo de WhatsApp ya abierto.' },
    // lib/meta-capi.ts, disparado desde lib/leads.ts y el webhook de Calendly
    { t: 'Meta se entera de lo que cierra', d: 'Cuando un lead califica o agenda, le devolvemos el evento por CAPI para que optimice con datos reales, no con clicks.' },
  ],
  whatsapp: [
    // app/whatsapp/WhatsAppApp.tsx + lib/chatwoot.ts
    { t: 'El inbox, acá adentro', d: 'Leé y contestá WhatsApp sin salir de MaKo: un hilo por lead, con adjuntos.' },
    // lib/template-validator.ts + lib/meta-templates.ts (explicarRechazo)
    { t: 'Plantillas que no te rechazan', d: 'MaKo las valida contra las reglas de Meta antes de mandarlas. Si igual te rechazan, te explica por qué en español.' },
    // lib/nutricion.ts (ventana horaria, tope diario, 1 msg/lead cada 20h)
    { t: 'Nutrición que cuida tu número', d: 'Ventana horaria, tope diario y un mensaje por lead cada 20 horas. Nada de ráfagas.' },
    // app/api/webhooks/chatwoot → lib/nutricion.ts (pausarPorRespuesta)
    { t: 'Contesta el lead, se corta sola', d: 'En cuanto responde, la secuencia se pausa: nunca le escribís encima a alguien que ya está hablando.' },
  ],
  email: [
    // lib/nutricion.ts (mismo motor que WhatsApp, canal email)
    { t: 'Secuencias que salen solas', d: 'El mismo motor de nutrición, por mail: pasos, variables y horarios.' },
    // lib/email-marketing.ts (enviarBroadcast, prueba, programados)
    { t: 'Broadcasts a un segmento', d: 'Borrador, envío de prueba y programado. Sin pegar direcciones a mano.' },
    // lib/resend.ts (createResendDomain/verifyResendDomain) + DominioSetup
    { t: 'Tu dominio, verificado desde acá', d: 'MaKo te da los registros DNS y chequea solo hasta que quede verificado. Sin dominio propio no sale nada.' },
    // app/api/webhooks/resend (aperturas/clicks/rebotes + supresión)
    { t: 'Quién abrió y quién clickeó', d: 'Aperturas, clicks y rebotes por paso. El que rebota duro se suprime solo y la baja es de un click.' },
  ],
  anthropic: [
    { t: 'El motor de MaKo', d: 'Claude es quien analiza, sugiere y escribe. Sin esta llave, MaKo no piensa.' },
    // lib/closing.ts (SPIN, objeciones, recomendaciones)
    { t: 'Analiza tus llamadas', d: 'El Closing Analyst puntúa cada llamada de venta por SPIN, marca las objeciones y te deja recomendaciones.' },
    // lib/model-registry.ts (modeloDeFeature, editable en /modelos-ia)
    { t: 'Vos elegís el modelo', d: 'Opus para el análisis pesado, Sonnet para lo conversacional. Se cambia por tarea, sin tocar código.' },
    // recordUsage → /api/anthropic-usage (Costo de MaKo)
    { t: 'Cada peso, a la vista', d: 'Qué proceso gastó cuánto, con qué modelo y cuándo. Sin sorpresas a fin de mes.' },
  ],
  openai: [
    // lib/transcribe.ts (whisper-1 + gpt-4o-mini) → alimenta lib/script-analyst.ts
    { t: 'Escucha tus creativos', d: 'Transcribe el video de cada anuncio y lo parte en secciones. Eso es lo que después lee el Script Analyst.' },
    // lib/transcribe.ts (transcribeMediaBuffer) → /conocimiento
    { t: 'Tus clases, en texto', d: 'Subís la grabación de un curso y queda como conocimiento consultable de MaKo.' },
    // lib/ai-cheap.ts: provDe('groq') ?? provDe('openai')
    { t: 'El suplente de lo barato', d: 'Cuando no hay Groq, las tareas simples caen acá en vez de gastar Claude.' },
  ],
  groq: [
    // lib/ai-cheap.ts (Groq gana si hay llave) + lib/model-registry.ts
    { t: 'IA gratis para lo simple', d: 'Clasificar, extraer, titular. MaKo la prefiere sobre OpenAI cuando hay llave.' },
    // lib/mako-doer-in.ts → transcribirAudio (whisper-large-v3-turbo)
    { t: 'Tus notas de voz, en texto', d: 'Le mandás un audio a "Hola MaKo" por WhatsApp y lo entiende.' },
    { t: 'Se mide en tokens, no en plata', d: 'El plan gratis limita por tokens/día y reinicia cada día. No hay saldo que se vacíe.' },
  ],
  fathom: [
    // lib/closing.ts (triage barato → Claude: venta vs entrega, SPIN, objeciones)
    { t: 'Cada llamada, puntuada', d: 'El Closing Analyst separa venta de entrega, puntúa por SPIN y marca las objeciones que aparecieron.' },
    // app/closing/ClosingBrowser.tsx (iframe + transcript con deep-link al segundo)
    { t: 'El video y el transcript, juntos', d: 'Player embebido y transcript clickeable: tocás una línea y el video salta a ese segundo.' },
    // app/api/webhooks/fathom (inviteeSpoke → asistencia real) + lib/fathom-auto.ts
    { t: 'La reunión se marca sola', d: 'Llega la grabación y el lead avanza: R1 o R2, y la asistencia se confirma según si el lead realmente habló.' },
    // lib/closing.ts (reviseAnalysis / reviseWithMako, con edit_history)
    { t: 'La última palabra es tuya', d: 'Corregís un puntaje a mano o le pedís a MaKo que re-analice con tu nota. Queda el historial.' },
  ],
  calendly: [
    // app/api/webhooks/calendly (respuestas por frase, UTMs, visitor_id de la landing)
    { t: 'La agenda se vuelve lead', d: 'Cada reserva entra al CRM con sus respuestas de calificación, sus UTMs y hasta el visitante anónimo que venía de la landing.' },
    // route.ts: una J2 NUNCA crea lead; sin match → enqueueJ2SinMatch (revisión)
    { t: 'R1 y R2, cada una en su lugar', d: 'Una R2 nunca crea un lead nuevo: se pega a la ficha que ya existe. Si no matchea, va a revisión en vez de duplicar.' },
    // junta_1_at (ISO con hora) → lib/crm-auto.ts T1 (respeta la decisión humana)
    { t: 'El No Show se detecta solo', d: 'Guardamos la hora exacta: si la reunión pasó y no hubo grabación, queda marcada — salvo que un humano ya lo haya decidido.' },
    // lib/meta-capi.ts (Schedule, event_id determinístico para dedup con el píxel)
    { t: 'Meta se entera del agendado', d: 'Cada reserva dispara un evento Schedule por CAPI, deduplicado contra el píxel del navegador.' },
  ],
  panda: [
    // app/api/cron/panda-daily → marketing_metrics_daily (plataforma='panda')
    { t: 'Los plays del VSL, al día', d: 'Reproducciones y espectadores únicos, todos los días, sin tocar nada.' },
    // lib/queries.ts (cuadrosVsl: retención media + tiempo promedio)
    { t: 'Hasta dónde llegan', d: 'Retención media y tiempo promedio de visualización, al lado del resto del funnel.' },
    // app/marketing/page.tsx (KPI "Costo / VSL View")
    { t: 'Cuánto te cuesta un view', d: 'El gasto de ads dividido por los views del VSL, como una métrica más del tablero.' },
  ],
  youtube: [
    // lib/queries.ts: "YouTube aporta la historia, Panda el presente"
    { t: 'La historia del VSL', d: 'Si tu VSL vivió en YouTube, sus views se unifican con los de Panda en una sola serie.' },
    // OJO: la API key sola solo trae el título; las views diarias necesitan OAuth
    // (lib/youtube-analytics.ts). Lo decimos en vez de prometer de más.
    { t: 'Views diarias del canal', d: 'Con el OAuth cargado, MaKo trae las views día por día. Con la API key sola alcanza para el título del video.' },
  ],
  google: [
    { t: 'Entrar con Google', d: 'El botón "Continuar con Google" del login. Si algo falla, la contraseña sigue andando.' },
    // lib/auto-reuniones.ts:83 → buscarEventosGoogle (SOLO lectura)
    { t: 'Calendar como tercera fuente', d: 'Al buscar las reuniones de un lead, MaKo también mira Google Calendar — además de Calendly y Fathom. Solo lee: no agenda ni toca nada.' },
  ],
  landing: [
    // app/api/webhooks/calendly: utm_term transporta el UUID anónimo (nqe_visitor_id)
    { t: 'El anónimo se vuelve lead', d: 'La landing le pone un ID a cada visita. Cuando esa persona agenda, MaKo ata la reserva con todo lo que hizo antes.' },
    // lib/integraciones.ts: la única integración cuyo estado son eventos REALES
    { t: 'La única que se prueba de verdad', d: 'Las demás se ven "conectadas" porque hay credencial. Esta se pone en verde solo cuando llega un evento real.' },
  ],
};

// ── MaKo ⇄ servicio ───────────────────────────────────────────────────────────
// Cabecera del aside negro: el logo de MaKo, el del servicio, y en el medio dos
// líneas punteadas marchando en sentidos opuestos — los datos van y vienen.
// Son DOS líneas y no una sola oscilando: una que va y vuelve se lee como algo
// dudando; dos en paralelo se leen como un intercambio.
// Cada línea está dibujada HACIA su flecha, así el mismo dashoffset negativo
// (mkMarcha, globals.css) mueve la de arriba hacia el servicio y la de abajo
// hacia MaKo. El desfase de la de vuelta evita que marchen en espejo perfecto.
function EnlaceMaKo({ k, nombre }: { k: string; nombre: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22 }}
      role="img" aria-label={`MaKo intercambia datos con ${nombre}`}>
      <MakoLogo size={40} />
      {/* Tramo corto y de ancho FIJO: los dos logos tienen que leerse como un par,
          no como dos cosas lejanas unidas por un cable. Por eso no va flex:1. */}
      <svg viewBox="0 0 96 34" width="96" height="34" style={{ flex: 'none' }} aria-hidden focusable="false">
        <path className="mk-enlace-linea" d="M3 12 H83" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M92 12 l-8 -4.5 v9 z" fill="var(--accent)" />
        <path className="mk-enlace-linea" style={{ animationDelay: '-.45s' }} d="M93 24 H13" stroke="var(--sidebar-text)" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M4 24 l8 -4.5 v9 z" fill="var(--sidebar-text)" />
      </svg>
      <SvcIcon k={k} box={40} radius={11} size={23} />
    </div>
  );
}

// `arriba` va DENTRO del bloque centrado, no antes: así el enlace MaKo⇄servicio
// queda a media altura del panel junto al texto que acompaña, en vez de pegado
// al techo. Queda fuera del div con key={n} para que no se re-monte (y vuelva a
// hacer el fade) en cada slide.
function Carrusel({ slides, arriba }: { slides: Slide[]; arriba?: ReactNode }) {
  const [n, setN] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = slides.length;

  // Autoavance suave; se frena si el mouse está encima o si tocaste un punto.
  useEffect(() => {
    if (pausa || total < 2) return;
    const id = setTimeout(() => setN((v) => (v + 1) % total), 5200);
    return () => clearTimeout(id);
  }, [n, pausa, total]);

  const s = slides[Math.min(n, total - 1)];
  if (!s) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      {/* Vive en el aside NEGRO: los colores son los del sidebar, no los del tema claro. */}
      {/* El min-height va en .mk-svc-carrusel (globals.css), no acá: inline le
          ganaría al min-height:0 del modo apilado y lo volvería letra muerta. */}
      <div className="mk-svc-carrusel" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {arriba}
        {/* key={n} → se remonta y vuelve a correr el fade en cada slide */}
        <div key={n} style={{ animation: 'mkFade .5s ease' }}>
          <h4 style={{ margin: 0, fontWeight: 600, fontSize: 17, letterSpacing: '-0.018em', lineHeight: 1.25, color: 'var(--on-sidebar)' }}>{s.t}</h4>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--sidebar-text)', lineHeight: 1.55 }}>{s.d}</p>
        </div>
      </div>
      {total > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {slides.map((sl, k) => (
            <button key={sl.t} type="button" title={sl.t} aria-label={sl.t} aria-current={k === n}
              onClick={() => { setN(k); setPausa(true); }}
              style={{ flex: 1, height: 3, padding: 0, border: 0, borderRadius: 999, cursor: 'pointer', background: k === n ? 'var(--accent)' : 'rgba(255,255,255,.2)', transition: 'background .25s ease' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal de servicio ─────────────────────────────────────────────────────────
// Dos columnas: izquierda (negra) el carrusel de qué vas a poder hacer; derecha
// toda la configuración —incluido el aviso de seguridad, que vive dentro del
// form—. Alto fijo y scroll adentro. En angosto apilan (ver .mk-svc-modal en
// globals.css).
function ServicioModal({ i, sev, health, metaError, usage, snippetLanding, onClose, onCambio }: {
  i: Integracion; sev: 'good' | 'warn' | 'bad'; health: MetaHealth | null; metaError: string | null; usage: Resumen | null; snippetLanding?: string | null; onClose: () => void; onCambio: () => void;
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
  } else if (i.key === 'anthropic' || i.key === 'openai') {
    const prov = usage?.porProveedor?.find((p) => p.provider === i.key);
    if (prov) {
      facts = [
        { k: 'Restante', v: prov.restanteUsd === null ? 'sin saldo' : usd(prov.restanteUsd), c: prov.restanteUsd !== null && prov.restanteUsd <= 5 ? 'var(--warn)' : 'var(--ink)' },
        { k: 'Gasto del mes', v: usd(prov.costMesUsd), c: 'var(--ink)' },
      ];
    }
    actions.push({ label: i.key === 'anthropic' ? 'Ver saldo de Claude ↗' : 'Cargar saldo en OpenAI ↗', href: i.key === 'anthropic' ? 'https://console.anthropic.com/settings/billing' : 'https://platform.openai.com/settings/organization/billing', primary: i.key === 'openai' });
  } else if (i.key === 'groq') {
    const prov = usage?.porProveedor?.find((p) => p.provider === 'groq');
    if (prov) {
      facts = [
        { k: 'Uso de hoy', v: `${fmtTok(prov.tokensHoy)} tok`, c: 'var(--ink)' },
        { k: 'Tokens del mes', v: `${fmtTok(prov.tokens)} tok`, c: 'var(--ink)' },
      ];
    }
  } else if (i.key === 'google') {
    // El OAuth de Google Calendar es un redirect en la MISMA pestaña.
    actions.push({ label: 'Conectar Google Calendar', href: '/api/integraciones/google-calendar', primary: true, sameTab: true });
  }

  // La landing no se configura con credenciales: se configura copiando un código.
  const esLanding = i.key === 'landing';

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

          {esLanding ? (
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
