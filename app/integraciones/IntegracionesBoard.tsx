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
import { useSearchParams } from 'next/navigation';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { SelectorLanding } from './SelectorLanding';
import { AsignarProducto } from './AsignarProducto';
import { guardarGrabacionAction } from './landing-config-actions';
import type { LandingConfig } from '@/lib/landing-config';
import type { ProductoAsignable } from '@/lib/landing-funnel';
import { Button, Switch } from '@/app/_ui';
import { MakoStar } from '../_components/MakoBrand';
import { BrandDefs, SvcIcon } from '../_components/ServicioVisual';
import { Carrusel, EnlaceMaKo } from '../_components/PanelMarketing';
import { SLIDES, type Slide } from '@/lib/servicio-slides';
import type { MetaHealth } from '@/lib/meta-health-ui';
import { procesoLegible, proveedorLegible, modeloLegible, motivoLegible, ordenIA, IA_ORDEN, esIAdePago } from '@/lib/ia-labels';
import type { CuotaProv } from '@/lib/ia-cuotas';
import { TutorialAgente, CODE } from '../_components/TutorialAgente';
import { ModalShell } from '../_components/ModalShell';
import { Dropdown } from '../components/Dropdown';
import ServicioConfigForm, { IconBtn } from './ServicioConfigForm';
import { Icon } from '../_components/icons';
import { getGoogleCalendarStatusAction, disconnectGoogleCalendarAction, type GoogleCalendarStatus } from '@/app/configuraciones/gcal-actions';
import { GCAL_MSG } from '@/app/configuraciones/GoogleCalendarPanel';
import { ProbarTracking } from './ProbarTracking';
import { ROTULO_PIXEL_VIEJO } from '@/lib/pixel-aviso';

const MONO = "'Geist Mono', monospace";

// ── Tipos ──────────────────────────────────────────────────────────────────
// ⚠️ EL TIPO SE IMPORTA, NO SE COPIA. Estaba escrito a mano acá, y por eso al
// sumarle dos campos en el server esta copia se quedó vieja sin que nada fallara
// hasta el typecheck. `import type` lo BORRA en compilación —no queda ni un
// require en el bundle— así que traerlo de un módulo `server-only` es seguro y no
// arrastra nada. Lo que NO se puede es importar de ahí un valor: eso rompe el
// build del cliente, que es exactamente el guard que queremos.
import type { Integracion } from '@/lib/integraciones';
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
  gemini: { cap: 'Gemini free: 250 solicitudes/día · 1M de contexto (no hay tope de tokens/día)' },
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

// ── El filtro de período de «Costo de MaKo» ──────────────────────────────────
// Pedido textual del dueño: «Sería bueno que incluyas un filtro de fecha y poder
// ver el gasto de otros meses también» (08/08/2026). El origen del número CAMBIA
// según el período elegido, y eso importa:
//   · 'actual' → /api/anthropic-usage, que es el mes en curso Y la ventana del
//     saldo cargado. Es el que tiene sentido al lado de los tiles de saldo.
//   · un mes o 'todo' → /api/costos-ia, que lee PAGINADO. El otro trunca en 1000
//     filas sin avisar y subestima el gasto viejo (ver lib/costos-ia.ts).
// No se unifican a propósito: responden preguntas distintas.
const PERIODO_ACTUAL = 'actual';
type ResumenPeriodo = { periodo: string; llamadas: number; tokens: number; costUsd: number; filas: number; porFeature: Array<{ clave: string; llamadas: number; tokens: number; costUsd: number }> };

const rotuloMes = (yyyymm: string) => {
  const [y, m] = yyyymm.split('-');
  const nombre = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(m) - 1];
  return nombre ? `${nombre} ${y}` : yyyymm;
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


/** Cuántas cuentas de un proveedor están sin cuota, cuando NO son todas. 0 = ninguna
 *  o todas (ese caso ya lo dice `agotado`). Es el dato que el total escondía. */
function cuentasSinCuota(c: CuotaProv | null): number {
  if (!c?.cuentas || c.cuentas.length < 2 || c.agotado) return 0;
  return c.cuentas.filter((k) => k.agotado).length;
}

const Spark = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ overflow: 'visible', flex: 'none' }}>
    <path d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z" fill="url(#mkGold)" />
  </svg>
);

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const capMono: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--faint)' };

// Orden de categorías del diseño.
// El ORDEN de las filas de «Servicios». Ojo: también hace de whitelist — `porCategoria`
// mapea sobre esta lista, así que una categoría que no esté acá NO se pinta aunque tenga
// integraciones. GitHub quedó invisible por eso: existía, pasaba todos los filtros, y
// 'Desarrollo' no estaba en la lista.
const CAT_ORDER = ['Publicidad', 'Mensajería', 'Inteligencia', 'IA Generativa', 'Agentes', 'Reuniones', 'Contenido', 'Datos', 'Desarrollo'];

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
export function IntegracionesBoard({ integraciones, health, metaError, incidentes, snippetLanding, landingVieja = false, cuotas = [], agenteToken, appUrl, pixel }: {
  integraciones: Integracion[];
  health: MetaHealth | null;
  metaError: string | null;
  incidentes: Incidente[];
  /** <script> con el token del workspace, listo para copiar. null = admin sin impersonar. */
  snippetLanding?: string | null;
  /** El código pegado en su página es de una versión vieja (lo sabe el beacon). */
  landingVieja?: boolean;
  /** Cuota gratis consumida hoy por cada IA barata (gauge "cuánto queda"). */
  cuotas?: CuotaProv[];
  /** Token del agente externo (Claude Code). null = todavía no acuñó ninguno. */
  agenteToken?: string | null;
  /** URL absoluta de la app, para embeberla en la skill que se copia. */
  appUrl?: string;
  /**
   * Lo que el Pixel necesita para pintar sus pasos 1 y 2 en el PRIMER frame,
   * resuelto en el server (`page.tsx`). Antes lo pedían los pasos con server
   * actions, en serie. `null` en cualquiera de los dos = no se pudo leer.
   */
  pixel?: DatosPixel;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<Resumen | null>(null);
  const [modal, setModal] = useState<{ t: 'svc'; key: string } | { t: 'hist' } | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/anthropic-usage')).json(); if (j?.ok) setUsage(j as Resumen); } catch { /* offline */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // ── Deep-link: ?abrir=<servicio> ──────────────────────────────────────────
  // Un aviso de WhatsApp que manda a /integraciones deja a la persona frente a
  // veinte tarjetas con la instrucción implícita de «buscá la tuya». El destino
  // de un aviso es el LUGAR donde se resuelve, así que el link abre el modal del
  // servicio y scrollea hasta su tarjeta.
  //
  // Se limpia el parámetro después (router.replace, sin scroll): si queda pegado,
  // un F5 o el botón de atrás vuelven a abrir el modal que la persona ya cerró.
  // Va con el router de app/_ui/Link para no perder el ?ws= del super admin.
  const abrir = searchParams.get('abrir');
  const yaAbierto = useRef(false);
  useEffect(() => {
    // ⚠️ Sin parámetro se REARMA (06/10/2026). La ref se ponía en true la primera vez
    // y no volvía nunca, así que estando ya en /integraciones un segundo
    // `?abrir=landing` —el aviso fijo «Actualiza el Pixel» de la esquina— no abría
    // nada: un botón que no hace nada. El `replace` de abajo borra el parámetro, y
    // ese render vuelve a dejar la puerta abierta para el próximo.
    if (!abrir) { yaAbierto.current = false; return; }
    if (yaAbierto.current) return;
    if (!integraciones.some((i) => i.key === abrir) && !SYNTHETIC[abrir]) return;
    yaAbierto.current = true;
    setModal({ t: 'svc', key: abrir });
    // El scroll va detrás del render del modal: la tarjeta tiene que existir en
    // el DOM para que scrollIntoView tenga a dónde ir.
    requestAnimationFrame(() => {
      document.getElementById(`svc-${abrir}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    const q = new URLSearchParams(searchParams.toString());
    q.delete('abrir');
    router.replace(`/integraciones${q.size ? `?${q}` : ''}`, { scroll: false });
  }, [abrir, integraciones, router, searchParams]);

  // ── Google Calendar: "hay token" NO es "está conectado" ────────────────────
  // El server solo sabe que existe un refresh_token. Si ese token es de los VIEJOS
  // (se emitió cuando pedíamos únicamente `calendar.readonly`) la agenda se lee,
  // pero «Reagendar» del CRM no mueve un solo evento. Pintado en verde, eso es una
  // mentira: el dueño lo dijo tal cual — «necesitaba más permisos, en ese caso debe
  // aparecer como DESCONECTADO».
  //
  // El permiso real solo lo sabe Google (hay que refrescar el token para leer sus
  // scopes), así que se pregunta UNA vez al abrir la pantalla — nunca por tile.
  const googleConToken = integraciones.some((i) => i.key === 'google' && i.estado === 'conectada');
  const [gcal, setGcal] = useState<GoogleCalendarStatus | null>(null);
  useEffect(() => {
    if (!googleConToken) { setGcal(null); return; }
    let vivo = true;
    getGoogleCalendarStatusAction().then((s) => { if (vivo) setGcal(s); }).catch(() => { /* sin respuesta = no degradamos el estado */ });
    return () => { vivo = false; };
  }, [googleConToken]);

  // Hay agenda, pero el permiso no alcanza para lo que se prometió → NO conectada.
  // `puede` en false = esta sesión no administra la agenda: desde ahí no sabemos
  // nada del permiso y no vamos a degradar el estado por ignorancia.
  const gcalIncompleta = !!gcal?.puede && gcal.conectado && !gcal.puedeMover;

  // Hay token guardado —`gcal` solo se pide cuando el server dice 'conectada'— y
  // Google LO RECHAZA. El tile lo pintaba VERDE: `googleCalendarConectado()` mide
  // "el token descifra", no "Google lo acepta", y esas dos cosas se separan cada
  // vez que se revoca el acceso, se rota la contraseña de la cuenta o —el caso que
  // viene— caduca a los 7 días, que es lo que le pasa a una app OAuth que sigue en
  // modo Testing. Sin esto la agenda queda «Cruzando las reuniones de …» para
  // siempre, sin cruzar ninguna y sin una sola pista de por qué.
  const gcalRechazada = !!gcal?.puede && !gcal.conectado;

  // Cómo salió el último paso por Google. El callback del OAuth vuelve SIEMPRE acá
  // con ?gcal=…, y hasta ahora nadie leía ese parámetro en esta pantalla: si el
  // re-consent fallaba (Google no reemitió el refresh_token, o saltó el CSRF), la
  // pantalla se recargaba idéntica y el usuario apretaba "Conectar" en loop.
  const gcalMsg = GCAL_MSG[searchParams.get('gcal') ?? ''] ?? null;

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

  // ── ?servicio=<key> → abre ESE servicio ───────────────────────────────────
  // Es el ancla del estado «falta un dato» más común del producto: `tab-activacion.ts`
  // tiene ocho tabs con su `servicio` escrito a mano («sin Calendly las reuniones
  // no entran»), y hasta ahora el link dejaba al usuario delante de una grilla de
  // veintipico de tarjetas buscando cuál era. «Linkear en vez de dibujar» sin
  // ancla por entidad es dejar a alguien en la recepción.
  //
  // Se valida contra la lista real: una key que no existe NO abre nada, en vez de
  // abrir un modal vacío. Y se consume el parámetro igual que `?ops=1`, para que
  // volver a tocar el mismo link reabra el modal aunque lo hayas cerrado.
  useEffect(() => {
    const key = searchParams.get('servicio');
    if (!key) return;
    if (!integraciones.some((i) => i.key === key)) { router.replace('/integraciones', { scroll: false }); return; }
    setModal({ t: 'svc', key });
    router.replace('/integraciones', { scroll: false });
  }, [searchParams, router, integraciones]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const metaSev = health?.account.severidad ?? null;
  const total = integraciones.length;

  // Severidad efectiva de un servicio: Meta usa su semáforo en vivo (o 'bad' si el
  // token está presente pero la lectura en vivo falló); Google, su PERMISO real; el
  // resto, conectada (verde) vs falta de config (ámbar "Por configurar", NO rojo:
  // todavía no es un incidente).
  const sevOf = (i: Integracion): 'good' | 'warn' | 'bad' => {
    if (i.key === 'meta') {
      if (metaSev) return metaSev === 'verde' ? 'good' : metaSev === 'ambar' ? 'warn' : 'bad';
      if (metaError) return 'bad';
    }
    // Verde SOLO con el permiso completo. Media conexión se ve igual que ninguna:
    // así el contador "N/M conectados", el medidor y el punto del tile dicen lo
    // mismo que el modal, en vez de dejarlo en una nota al pie que nadie abre.
    if (i.key === 'google' && (gcalIncompleta || gcalRechazada)) return 'warn';
    // Mismo criterio para la landing: el código pegado en su página es de una
    // versión vieja. El tracking anda —los eventos llegan— pero hay algo que
    // hacer, y el verde no sabe decir eso. Degradar a ámbar es el precedente de
    // Google, y se elige por lo mismo: que el contador, el medidor, el punto y el
    // chip digan todos lo mismo, en vez de esconderlo en una nota que nadie abre.
    if (i.key === 'landing' && landingVieja) return 'warn';
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
  const atencion: Array<{ i: Integracion; sev: 'warn' | 'bad'; motivo: string; accion?: string }> = [];
  for (const i of integraciones) {
    const s = sevOf(i);
    if (s === 'good') continue;
    // El agente (Claude Code) es OPCIONAL y se instala del lado del usuario: mientras
    // no tenga token queda "Por configurar" en la grilla (honesto), pero no es un
    // pendiente que haya que resolver → no lo empujamos a "Requiere tu atención"
    // (sería ruido para un cliente que ni programa).
    if (i.key === 'agente') continue;
    let motivo = i.estado === 'falta' ? i.detalle : 'Requiere atención';
    let accion: string | undefined;
    if (i.key === 'meta') {
      motivo = health
        ? (health.account.entregaFrenada ? 'Entrega frenada' : (health.account.disableReasonLabel || health.account.statusLabel || 'Requiere atención'))
        : 'No se pudo leer el estado de Meta';
    } else if (i.key === 'google' && gcalIncompleta) {
      // El motivo dice QUÉ falta (no "Requiere atención", que no orienta a nadie) y
      // el botón dice el verbo que resuelve: volver a pasar por el consentimiento.
      motivo = 'Falta permiso para mover reuniones';
      accion = 'Conectar';
    } else if (i.key === 'google' && gcalRechazada) {
      // Distinto de «falta permiso»: acá el token ya no sirve para NADA. El verbo
      // es el mismo (volver a pasar por Google), pero el motivo tiene que decir la
      // verdad o el usuario busca el permiso que no es.
      motivo = 'Google ya no acepta la agenda — hay que reconectarla';
      accion = 'Conectar';
    }
    atencion.push({ i, sev: s === 'bad' ? 'bad' : 'warn', motivo, accion });
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


      {/* Resultado del OAuth de Google (?gcal=…). Va arriba de todo porque es la
          respuesta a lo último que hizo el usuario antes de volver a esta pantalla. */}
      {/* El "conectado ✓" se calla si el permiso igual quedó a medias (se destildó la
          casilla de escritura en la pantalla de Google): festejar ahí sería el mismo
          verde mentiroso que estamos sacando. La tarjeta de "Falta permiso" lo cuenta. */}
      {gcalMsg && !(gcalMsg.kind === 'ok' && gcalIncompleta) && (
        <div role="status" style={{ marginTop: 22, borderRadius: 12, padding: '12px 17px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, background: gcalMsg.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: gcalMsg.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>
          {gcalMsg.txt}
        </div>
      )}

      {/* ═══ REQUIERE ATENCIÓN ═══ */}
      {atencion.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <Spark />
            <h2 style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Requiere tu atención</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 21, height: 21, padding: '0 7px', borderRadius: 999, background: 'var(--bad-bg)', color: 'var(--bad)', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{atencion.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
            {atencion.map(({ i, sev, motivo, accion }) => (
              <div key={i.key} style={{ ...card, borderLeft: `4px solid ${sev === 'bad' ? 'var(--bad)' : 'var(--warn-fill)'}`, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <SvcIcon k={i.key} box={44} radius={12} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: sev === 'bad' ? 'var(--bad)' : 'var(--warn)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{motivo}</div>
                  <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{i.nombre}</div>
                </div>
                <button type="button" onClick={() => setModal({ t: 'svc', key: i.key })} style={{ flex: 'none', border: sev === 'bad' ? 0 : '1px solid var(--border-strong)', borderRadius: 10, background: sev === 'bad' ? 'var(--primary)' : 'var(--surface)', color: sev === 'bad' ? '#fff' : 'var(--ink)', fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13.5, padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{accion ?? (sev === 'bad' ? 'Resolver' : 'Configurar')}</button>
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
            <button key={i.key} id={`svc-${i.key}`} type="button" onClick={() => setModal({ t: 'svc', key: i.key })} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px' }}>
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
          // El chip repite la palabra del estado. Con permiso incompleto, "Por
          // configurar" (lo que diría el ámbar por defecto) manda al usuario a
          // buscar una credencial que no existe: acá lo que falta es un permiso.
          chipWord={modal.key === 'google' && gcalIncompleta ? 'Falta permiso'
            : modal.key === 'landing' && landingVieja ? ROTULO_PIXEL_VIEJO
            : undefined}
          gcal={gcal}
          health={health} metaError={metaError} usage={usage}
          cuota={cuotas.find((c) => c.provider === modal.key) ?? null}
          snippetLanding={snippetLanding}
          pixel={pixel}
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
  // ── El filtro de período ────────────────────────────────────────────────────
  // `meses` vacío = el selector no se dibuja. Pasa en dos casos y los dos son
  // correctos: la sesión no es de la agencia (el endpoint contesta 403) o no hay
  // un solo registro de gasto todavía.
  const [meses, setMeses] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState<string>(PERIODO_ACTUAL);
  const [per, setPer] = useState<ResumenPeriodo | null>(null);
  const [cargandoPer, setCargandoPer] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const j = await (await fetch('/api/costos-ia?meses=1')).json();
        if (vivo && j?.ok) setMeses(j.mesesDisponibles ?? []);
      } catch { /* offline o sin permiso: sin selector */ }
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (periodo === PERIODO_ACTUAL) { setPer(null); return; }
    let vivo = true;
    setCargandoPer(true);
    (async () => {
      try {
        const j = await (await fetch(`/api/costos-ia?periodo=${encodeURIComponent(periodo)}`)).json();
        // Un fetch fallido NO deja el número anterior en pantalla: eso mostraría
        // el gasto de julio bajo el rótulo de junio, que es peor que no mostrar nada.
        if (vivo) setPer(j?.ok ? (j as ResumenPeriodo) : null);
      } catch { if (vivo) setPer(null); }
      if (vivo) setCargandoPer(false);
    })();
    return () => { vivo = false; };
  }, [periodo]);

  const opcionesPeriodo = [
    { value: PERIODO_ACTUAL, label: 'Este mes', sub: 'Lo que se descuenta del saldo cargado' },
    ...meses.map((m) => ({ value: m, label: rotuloMes(m) })),
    { value: 'todo', label: 'Todo el histórico', sub: `${meses.length} ${meses.length === 1 ? 'mes' : 'meses'} con datos` },
  ];
  const filtrado = periodo !== PERIODO_ACTUAL;
  const rotuloPeriodo = periodo === PERIODO_ACTUAL ? 'este mes' : periodo === 'todo' ? 'todo el histórico' : rotuloMes(periodo);

  const provsBase = usage?.porProveedor ?? [];
  const provs: ProvSaldo[] = [
    ...provsBase,
    ...cuotas.filter((c) => !provsBase.some((p) => p.provider === c.provider))
      .map((c): ProvSaldo => ({ provider: c.provider, costMesUsd: 0, tokens: 0, tokensHoy: c.tokens, saldo: null, restanteUsd: null, gratis: true })),
  ].sort((a, b) => ordenIA(a.provider) - ordenIA(b.provider)); // pago (Claude/OpenAI/Gemini) arriba, gratis abajo
  // Las gráficas por proceso siguen al período elegido; los tiles de arriba NO
  // (son saldo y cuota de HOY, no del período). Está rotulado abajo, porque un
  // número filtrado al lado de uno que no lo está es una trampa de lectura.
  const featsFuente = filtrado
    ? (per?.porFeature ?? []).map((c) => ({ feature: c.clave, costUsd: c.costUsd, tokens: c.tokens }))
    : (usage?.porFeature ?? []);
  const feats = featsFuente.slice(0, 8);
  const maxFeat = Math.max(1, ...feats.map((f) => f.costUsd));
  // Para la gráfica de TOKENS: el top-8 por tokens (puede diferir del top por $ —
  // un proceso en IA gratis consume muchos tokens y $0). Así ambas cuentan algo real.
  const featsTok = featsFuente.slice().sort((a, b) => b.tokens - a.tokens).slice(0, 8);
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
              {/* El rótulo dice el estado que MANDA. Con varias cuentas, el total no
                  alcanza: «te queda el 68%» y «la cuenta que atiende todo está al
                  96%» son la misma cifra y consejos opuestos. */}
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                {cv?.agotado ? 'sin cuota hoy'
                  : cuentasSinCuota(cuota) ? `${cuentasSinCuota(cuota)} de ${cuota!.cuentas!.length} cuentas sin cuota`
                  : 'cuánto queda hoy'}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{cv ? <>{cv.usados}<span style={{ color: 'var(--faint)' }}> / {cv.limite} {cv.unidad}</span></> : <>{fmtTok(p.tokensHoy)}<span style={{ color: 'var(--faint)' }}> tok</span></>}</span>
            </div>
            {cv && <div style={{ height: 7, borderRadius: 5, background: 'var(--border)', overflow: 'hidden' }}><div style={{ height: 7, width: `${cv.pct}%`, borderRadius: 5, background: cv.agotado ? 'var(--warn-fill)' : '#F55036' }} /></div>}
            {/* El REPARTO, que es lo que el total esconde. Una fila por cuenta, con
                su propio tope: son tanques separados, no un tanque grande. */}
            {cuota?.cuentas && cuota.cuentas.length > 1 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {cuota.cuentas.map((k) => {
                  // El REAL para el texto; el de la barra lleva un mínimo visible.
                  // No es lo mismo: con el mínimo metido en los dos, una cuenta sin
                  // usar decía «2%» — un número inventado, en el panel que acabamos
                  // de arreglar justamente por decir números que no eran.
                  const real = Math.min(100, Math.round(k.pct * 100));
                  const ancho = Math.max(real, k.pct > 0 ? 2 : 0);
                  return (
                    <div key={k.cuenta} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)', flex: 'none' }}>cuenta {k.cuenta}</span>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: 3, width: `${ancho}%`, background: k.agotado ? 'var(--warn-fill)' : '#F55036' }} />
                      </div>
                      {/* ⚠️ EL REBOTE MANDA SOBRE EL PORCENTAJE, y por eso se dibuja en
                          vez de él. El % sale de un tope que ponemos nosotros; «rebotó»
                          es el proveedor contestando que ya no hay. El de Gemini estuvo
                          1440 veces mal durante meses: el panel decía «te sobra» mientras
                          todas las llamadas volvían con 429, y no había dónde verlo. */}
                      <span style={{ fontFamily: MONO, fontSize: 10, color: k.rebotes > 0 || k.agotado ? 'var(--warn)' : 'var(--faint)', flex: 'none' }}>
                        {k.rebotes > 0 ? `rebotó ${k.rebotes}×` : k.agotado ? 'sin cuota' : `${real}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
          <button onClick={(e) => { stop(e); onOpenService(p.provider); }} style={{ marginTop: 9, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', textAlign: 'left' }}>¿Cargaste créditos? Regístralos →</button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          {meses.length > 0 && (
            <Dropdown
              value={periodo}
              options={opcionesPeriodo}
              onChange={setPeriodo}
              ariaLabel="Período del gasto"
              width={188}
              align="right"
            />
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ ...capMono, fontSize: 10.5, letterSpacing: '.1em' }}>{rotuloPeriodo}</span>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 29, letterSpacing: '-0.02em', color: cargandoPer ? 'var(--faint)' : 'var(--ink)' }}>
              {cargandoPer ? '···' : filtrado && !per ? '—' : usd(filtrado ? (per?.costUsd ?? 0) : (usage?.gastadoMesUsd ?? 0))}
            </span>
          </div>
        </div>
      </div>

      {/* El período elegido NO mueve los tiles de abajo, y decirlo es parte del
          dato: un saldo restante de hoy al lado de un gasto de junio, sin
          aclaración, se lee como si fueran la misma ventana. */}
      {filtrado && per && (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: -8, marginBottom: 18 }}>
          {per.llamadas.toLocaleString('es-MX')} llamadas · {fmtTok(per.tokens)} tokens, leídas {per.filas.toLocaleString('es-MX')} filas sin truncar.
          {' '}<strong style={{ color: 'var(--ink)' }}>Los tiles de saldo y cuota de aquí abajo son de hoy</strong>, no del período: el saldo es un estado, no un acumulado.
        </div>
      )}

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
        <div style={{ color: 'var(--dim)', fontSize: 13.5, padding: '14px 0' }}>Todo en orden. Aquí van a quedar los incidentes de cada servicio con su período: desde cuándo empezó el problema hasta que se resolvió.</div>
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
  { paso: 'Copia el código de aquí arriba.' },
  {
    paso: 'Abre tu página y pégalo justo antes de </body>, en todas las páginas que quieras medir.',
    plataformas: [
      ['Lovable, Claude Code, o cualquier editor web por prompt', 'pídele "pega este script antes del </body>".'],
      ['Framer', 'Settings → Custom Code → End of <body>.'],
      ['Webflow', 'Project Settings → Custom Code → Footer Code.'],
      ['WordPress', 'un plugin de "insert headers and footers" (footer).'],
      ['HTML plano', 'antes del </body>.'],
    ],
  },
  { paso: 'Publica los cambios y entra a tu página una vez. En cuanto llegue la primera visita, esta integración se pone en verde.' },
  {
    // El mismo script hace las dos cosas: sin esto, quien tiene formulario cree
    // que le falta pegar algo más — y no hay nada más que pegar.
    //
    // ⚠️ Y YA NO HAY NINGUNA CASILLA QUE MARCAR. Este paso mandaba a «Funnel → De
    // dónde entran tus leads», y desde el 04/10/2026 pegar el Pixel ES declarar la
    // entrada (app/api/track/optin/route.ts). Dejar la instrucción manda a hacer un
    // trámite que no cambia nada, en una pantalla que además se retiró.
    paso: 'Si tu página tiene un formulario, el mismo Pixel ya lo captura: quien lo complete ingresa solo a tu CRM.',
  },
];

// ── Resaltador de código mínimo, propio (sin dependencias) ───────────────────
// Un scanner de UNA pasada sobre el <script>: tags, atributos, strings,
// comentarios, palabras clave y números; todo lo demás cae al color base. No es
// un parser de JS y no pretende serlo — alcanza para que el bloque se reconozca
// como CÓDIGO al toque. Va sobre el oscuro nativo del repo (el de la sidebar),
// que ya convive con el resto de la UI clara.

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



/**
 * Un paso de la instalación del Pixel. El número NO es decoración: es lo que
 * dice que hay un orden y que este es el que corresponde.
 *
 * Antes eran tres bloques uno abajo del otro sin nada que los separara, y el
 * primero —que es OPCIONAL— se leía como parte del segundo. La línea de arriba y
 * el aire son lo que hace que se vea que el anterior terminó.
 */
// ⚠️ EL AIRE ENTRE PASOS ES LO QUE LOS HACE PASOS. Reportado dos veces por el
// dueño («separa muy bien los 3 pasos», y después «siguen muy juntos, sobre todo
// el del código»). Con 20 px de separación y una línea al ras, cuatro secciones
// se leían como una sola lista larga: el número perdía sentido, porque nada decía
// dónde terminaba uno y empezaba el siguiente.
//
// Lo que cambió, y son tres cosas a la vez porque una sola no alcanzaba:
//   · el doble de aire ARRIBA de la línea que abajo — el espacio pertenece al
//     paso que termina, no al que arranca, y esa asimetría es lo que agrupa;
//   · el número en un círculo lleno y no en uno hueco, que se lee como rótulo de
//     sección y no como viñeta de lista;
//   · el título del paso más grande que el contenido, con su propio aire.
function Paso({ n, titulo, sep = true, children }: { n: number; titulo?: string; sep?: boolean; children: React.ReactNode }) {
  return (
    <section style={{ paddingTop: sep ? 26 : 0, marginTop: sep ? 30 : 0, borderTop: sep ? '1px solid var(--border)' : 'none' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span aria-hidden style={{
          flex: 'none', width: 26, height: 26, borderRadius: 999, marginTop: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--ink)', border: '1px solid var(--ink)',
          fontSize: 12.5, fontWeight: 700, color: 'var(--surface)',
        }}>{n}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {titulo && <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--ink)', marginBottom: 13, lineHeight: 1.35, paddingTop: 2 }}>{titulo}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}

/** Las páginas y los productos del Pixel, tal como los resuelve el server. */
type DatosPixel = { landings: LandingConfig[] | null; productos: ProductoAsignable[] | null; grabando: boolean | null };


function CodigoLanding({ snippet, pixel, elegida, onElegir }: {
  snippet: string | null;
  pixel?: DatosPixel;
  /** La landing elegida vive en el MODAL, no acá: el paso 4 se renderiza fuera
   *  de este componente y necesita la misma respuesta. */
  elegida: string | null; onElegir: (u: string | null) => void;
}) {
  const routerLanding = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [codigoAbierto, setCodigoAbierto] = useState(false);
  const [errorCopia, setErrorCopia] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; text: string } | null>(null);
  // ⚠️ LAS PÁGINAS VIVEN ACÁ, y no en cada paso. Las lee el paso 1 (para elegir) y
  // el paso 2 (para saber qué productos tiene la elegida), y las escriben los dos.
  // Con una copia en cada uno, guardar en el paso 2 dejaba al 1 con la vieja —y
  // eran además DOS lecturas de lo mismo en la cola serial de las server actions.
  // Arranca con lo que resolvió el server: el primer frame ya trae todo.
  const [landings, setLandings] = useState<LandingConfig[]>(pixel?.landings ?? []);
  // La grabación de las visitas, del NEGOCIO (no de la página). Arranca con lo que
  // leyó el server; `null` = no se pudo leer, y entonces no se dibuja un interruptor
  // que afirme «apagada».
  const [grabando, setGrabando] = useState<boolean | null>(pixel?.grabando ?? null);
  const [guardandoGrabacion, setGuardandoGrabacion] = useState(false);
  const [errGrabacion, setErrGrabacion] = useState<string | null>(null);
  const cambiarGrabacion = async (v: boolean) => {
    if (guardandoGrabacion) return;
    setGuardandoGrabacion(true); setErrGrabacion(null);
    const antes = grabando;
    setGrabando(v);   // optimista: el interruptor responde al toque
    const r = await guardarGrabacionAction(v).catch(() => null);
    setGuardandoGrabacion(false);
    if (!r || !r.ok) { setGrabando(antes); setErrGrabacion(r && !r.ok ? r.error : 'No se pudo guardar.'); return; }
    setGrabando(r.activo);
  };
  // ⚠️ EL CÓDIGO ES UNO SOLO PARA TODAS LAS PÁGINAS. Hasta el 06/10/2026 se pedía
  // uno por página porque cada una podía llevar su propio proyecto de Clarity
  // adentro; sin Clarity, es el que resuelve el server y no hay nada que pedir.
  const codigo = snippet;
  const tokens = useMemo(() => (codigo ? resaltar(codigo) : []), [codigo]);

  // "Verificar" = el "Probar conexión" de la landing. No hay API ajena contra la
  // cual probar: la única prueba honesta es que ya hayan llegado eventos.
  const verificar = async () => {
    setVerificando(true); setEstado(null);
    try {
      const j = await (await fetch('/api/integraciones/landing/estado')).json();
      if (j?.ok) {
        setEstado(j.recibio
          // Con el código viejo NO se contesta que sí. «Recibiendo eventos» era
          // verdad y era engañoso a la vez: el botón que la persona aprieta para
          // saber si está todo bien decía que sí sobre un snippet al que le falta
          // la mitad. Se responde lo que hay que hacer, no lo que llega.
          ? j.codigoViejo
            ? { ok: false, text: 'Llegan eventos, pero el código instalado es de una versión anterior. Copia el de arriba y reemplázalo en tu página.' }
            : { ok: true, text: `Recibiendo eventos${j.ultima ? ` (última hace ${fmtDuracion(j.ultima, new Date().toISOString())})` : ''}.` }
          : { ok: false, text: 'Aún no llega ningún evento. Instala el Pixel de MaKo en tu página y recárgala.' });
      } else {
        setEstado({ ok: false, text: j?.error === 'solo admin' ? 'Necesitas ser admin para verificar esta integración.' : (j?.error ?? 'No se pudo verificar.') });
      }
    } catch { setEstado({ ok: false, text: 'No se pudo verificar. Revisa tu conexión y prueba de nuevo.' }); }
    finally { setVerificando(false); }
  };

  const copiar = async () => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
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
        Entra a un cliente para ver su Pixel de MaKo.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <h4 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.3, margin: 0 }}>
        Instala el Pixel de MaKo en tu página
      </h4>

      {/* ⚠️ LA GRABACIÓN DE LAS VISITAS VA ARRIBA DE LOS PASOS, no adentro de uno: es
          del NEGOCIO y no de la página que se elige en el paso 1, así que puesta en un
          paso se leería como «grabar esta página». Reemplaza a «conectar Clarity»
          (06/10/2026): sin este interruptor ningún negocio podía tener grabaciones.
          Sin rótulo de ayuda, por la regla del texto corto: dónde se miran lo enseña
          la prueba, que tiene el botón «Ver la grabación». */}
      {grabando === null ? (
        <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>No pude leer si la grabación está prendida.</div>
      ) : (
        <div>
          <Switch checked={grabando} onChange={(v) => { void cambiarGrabacion(v); }} disabled={guardandoGrabacion} label="Grabar las visitas" />
          {errGrabacion && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--bad)' }}>{errGrabacion}</div>}
        </div>
      )}

      {/* ⚠️ CUATRO PASOS, SEPARADOS DE VERDAD. Antes eran tres bloques uno abajo del
          otro sin nada que dijera que eran pasos distintos, y el primero —que es
          OPCIONAL— se leía como parte del segundo. Cada uno lleva su número, una
          línea que lo separa del anterior y aire suficiente para que se vea que
          terminó. El número no es decoración: es lo que dice que hay un orden y
          que este es el que corresponde. */}
      {/* ⚠️ ELEGIR LA LANDING ES EL PASO 1, y no es un reordenamiento cosmético:
          gobierna todo lo que viene después. Qué productos vende, si el Pixel
          está al día y qué pasos tiene la prueba son DISTINTOS en cada página. Mientras se elegía al final, la pantalla
          afirmaba cosas sobre «tu página» sin saber cuál — y con dos publicadas,
          la mitad de esas afirmaciones eran falsas. */}
      <Paso n={1} titulo="¿Cuál de tus páginas?" sep={false}>
        <SelectorLanding elegida={elegida} onElegir={onElegir} landings={landings} onLandings={setLandings} />
      </Paso>

      {/* Los pasos que dependen de la elección no se dibujan hasta que hay una.
          Mostrar un código que todavía no sabe de qué página es sería ofrecer
          para copiar algo que puede estar mal.

          ⚠️ Y van con `key={elegida}`: al cambiar de landing los pasos se MONTAN
          DE NUEVO en vez de conservar su estado. Sin eso quedaba a la vista la
          configuración de la anterior —un formulario recuerda lo que tenía— y la
          persona la leía como si fuera de la página que acaba de elegir.
          Un loader habría tapado el síntoma; lo que hacía falta es tirar el
          estado viejo, que además es instantáneo. */}
      {/* Mientras no haya página elegida, el espacio se sostiene igual. Con
          elección, el contenido real entra derecho y no se ve un parpadeo. */}
      {/* ⚠️ ACÁ HABÍA UN ESQUELETO («Buscando tus páginas…») mientras el paso 1
          resolvía la lista con una server action. Desde el 06/10/2026 la lista
          baja resuelta del server, así que no hay nada que esperar: un indicador
          de carga sobre algo que no está cargando es una promesa falsa. */}

      {elegida && (
      <div key={elegida}>
      {/* ⚠️ EL PRODUCTO ES EL PASO 2, y lo pidió Martín así el 06/10/2026: «tiene
          que ser otro paso en la configuración del pixel asignar PRODUCTO, ponlo
          como segundo paso». Va ANTES del código y el orden no es estético: a qué
          CRM entran los leads es la decisión que define para qué sirve el Pixel en
          esta página, y colgada al pie del paso 1 —donde vivía— se leía como un
          detalle opcional. El código que se copia no depende de esto, así que
          mover el paso no puede dejar a nadie con un snippet viejo. */}
      <Paso n={2} titulo="¿Qué producto vende?">
        <AsignarProducto elegida={elegida} productos={pixel?.productos ?? null}
          landings={landings} onLandings={setLandings} />
      </Paso>

      <Paso n={3} titulo="Copia el código y pégalo en tu página">

      {/* LA MISMA BARRA que una credencial, pero oscura y con el código adentro.
          Antes eran tres piezas sueltas —un bloque de código, dos botones y un
          «Ver el código»— que no se parecían a nada del resto de la pantalla.
          Acá el esqueleto es el de `.mk-key-row`: el contenido a la izquierda,
          las acciones adentro al final, y el mismo alto cerrada que cualquier
          otra fila. */}
      <div className={`mk-key-row mk-key-row--code${codigoAbierto ? ' is-abierta' : ''}`}>
        {/* El wrapper existe para colgarle el «…» del plegado: adentro del <pre>
            (que tiene overflow) un pseudo-elemento absoluto se recorta. */}
        <div className="mk-key-codewrap">
          <pre className="mk-key-code">
            <code style={{ fontFamily: MONO }}>
              {tokens.map((tk, n) => <span key={n} style={{ color: tk.c }}>{tk.t}</span>)}
            </code>
          </pre>
        </div>
        <IconBtn
          name="chevron"
          title={codigoAbierto ? 'Plegar el código' : 'Ver el código entero'}
          tone={codigoAbierto ? 'primary' : 'dim'}
          onClick={() => setCodigoAbierto((o) => !o)}
        />
        {/* Copiar funciona PLEGADO: la acción no depende de ver el contenido —
            nadie lee el snippet, lo que hace es copiarlo y pegarlo. */}
        <IconBtn name={copiado ? 'check' : 'copy'} title={copiado ? '¡Copiado!' : 'Copiar el código'} tone={copiado ? 'good' : 'dim'} onClick={copiar} />
        {/* ⚠️ EL BOTÓN DE VERIFICAR SE FUE DE ACÁ, al lado del desplegable de
            páginas. Es la misma distancia física y una pregunta distinta: acá
            contestaba por el workspace entero —«¿llegó algún evento alguna
            vez?»— y allá contesta por LA PÁGINA elegida, que es la que se está
            por probar. Un cliente con dos landings publicadas tenía una sola
            respuesta para las dos, y la respuesta era del que hubiera mandado el
            último evento. Un botón junto al código pregunta por el código;
            junto a la página, pregunta por la página. */}
        {/* La ayuda es el CUARTO botón de la barra, no una fila aparte debajo:
            en la barra de una credencial el «?» vive adentro, al lado de su
            campo, y despliega los pasos abajo. Es el mismo gesto —pedir ayuda
            sobre esto que tengo acá— y tiene que estar en el mismo lugar. */}
        <IconBtn name="help" title={abierto ? 'Ocultar la ayuda' : '¿Dónde lo pego?'} tone={abierto ? 'primary' : 'dim'} onClick={() => setAbierto((o) => !o)} />
      </div>
      {errorCopia && <span style={{ fontSize: 12.5, color: 'var(--warn)', fontWeight: 500 }}>No pudimos copiarlo solos — ábrelo con la flecha, selecciónalo y cópialo a mano.</span>}

      {estado && (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: estado.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>
          {estado.ok ? '✓' : '✗'} {estado.text}
        </div>
      )}

      {/* Los pasos, cuando se aprieta el «?» de la barra. Mismo tratamiento que
          el «¿Cómo consigo esta key?» de una credencial: azul suave, debajo de
          su propia barra, y sin cabecera propia — el rótulo ya lo dio el botón
          que lo abrió. */}
      {abierto && (
        <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', borderRadius: 12, overflow: 'hidden', animation: 'mkFade .18s ease' }}>
          <div style={{ padding: '13px 14px' }}>
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
        </div>
      )}
      </Paso>
      </div>
      )}
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
        <button onClick={() => { setEditing(true); setInput(''); }} style={{ border: '1px solid var(--primary)', borderRadius: 9, background: 'var(--surface)', color: 'var(--primary)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer' }}>{saldo ? 'Actualizar saldo' : (gemini ? 'Registrar créditos' : 'Pon tu saldo')}</button>
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

function ServicioModal({ i, sev, chipWord, gcal, health, metaError, usage, cuota, snippetLanding, pixel, agenteToken, appUrl, onClose, onCambio, onRefetchUsage }: {
  i: Integracion; sev: 'good' | 'warn' | 'bad';
  /** Reemplaza la palabra del chip cuando el estado tiene un nombre propio ("Falta permiso"). */
  chipWord?: string;
  /** Permiso real de la agenda de Google (lo pide el board una vez, ver arriba). */
  gcal: GoogleCalendarStatus | null;
  health: MetaHealth | null; metaError: string | null; usage: Resumen | null; cuota: CuotaProv | null; snippetLanding?: string | null; pixel?: DatosPixel; agenteToken?: string | null; appUrl?: string; onClose: () => void; onCambio: () => void; onRefetchUsage: () => void;
}) {
  // El workspace de la pestaña, para que el OAuth de Google sepa a QUIÉN le está
  // conectando la agenda: es un redirect de página entera y el `?ws=` no viaja solo.
  const wsPestana = useWs();
  // Hay token guardado y Google lo rechaza (ver el porqué en el board): acá se
  // recalcula porque el modal ya recibe `gcal` y pasarlo como prop sería el mismo
  // dato en dos lugares.
  const gcalRechazada = !!gcal?.puede && !gcal.conectado;
  const [desconectando, setDesconectando] = useState(false);
  // La landing que gobierna los pasos 2, 3 y 4 del Pixel.
  //
  // ⚠️ CON UNA SOLA PÁGINA, ARRANCA ELEGIDA. El paso 1 la elegía solo en un efecto,
  // o sea DESPUÉS del primer pintado: el modal abría con los pasos 2 a 4 ausentes y
  // aparecían un instante después. Como las páginas ya bajan resueltas del server,
  // se puede saber en el primer render — y entonces el modal se pinta entero de una.
  const [landingModal, setLandingModal] = useState<string | null>(
    pixel?.landings?.length === 1 ? pixel.landings[0].url : null,
  );
  const base = sev === 'good' ? { bg: 'var(--good-bg)', fg: 'var(--good)', word: 'Conectada' }
    : sev === 'warn' ? { bg: 'var(--warn-bg)', fg: 'var(--warn)', word: 'Por configurar' }
    : { bg: 'var(--bad-bg)', fg: 'var(--bad)', word: 'Requiere atención' };
  const chip = { ...base, word: chipWord ?? base.word };

  // BYOK: si el servicio está en el catálogo de /metodo y NO es soloServidor,
  // embebemos el form de pegar/guardar/probar (reemplaza la lista de envs crudos).
  // Los servicios sin catálogo (p.ej. la landing) quedan informativos.
  // ⚠️ ESTOS DOS DATOS VIENEN DEL SERVER, y no es un detalle de estilo. Acá se
  // hacía `servicioMetodo(i.key)`, y este archivo es `'use client'`: eso arrastraba
  // lib/metodo-catalogo.ts ENTERO al bundle del navegador —145 KB con los
  // tutoriales de las 20 integraciones, los nombres de todas las envs y el copy
  // interno de la agencia, incluida la entrada de GitHub, que es de plataforma—.
  // De todo eso se usaban DOS campos. Ahora los resuelve lib/integraciones.ts, que
  // es server-only, y viajan dentro de cada `Integracion`.
  const mostrarForm = i.soloServidor === false;

  // El carrusel manda la copy. Si un servicio todavía no tiene slides propias,
  // cae al `paraQue` del catálogo — nunca inventamos una promesa para llenar.
  const slides: Slide[] = SLIDES[i.key] ?? (i.paraQue ? [{ t: `Qué hace ${i.nombre}`, d: i.paraQue }] : []);

  // Estado EN VIVO (no descripción): solo Meta tiene algo que decir acá.
  let alerta: string | null = null;
  let facts: Array<{ k: string; v: string; c: string }> = [];
  const actions: Array<{ label: string; href?: string; primary?: boolean; sameTab?: boolean; onClick?: () => void }> = [];
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
    // El OAuth de Google Calendar es un redirect en la MISMA pestaña, y sirve tanto
    // para conectar como para re-autorizar (la ruta manda prompt=consent +
    // include_granted_scopes, así que reemite el refresh_token sumando lo que falta
    // sin perder lo ya otorgado).
    //
    // "Reconectar" solo cuando la conexión está COMPLETA: con el permiso a medias, el
    // verbo tiene que ser el mismo que vería alguien sin agenda —«Conectar»— porque el
    // estado que mostramos también es el mismo (no conectada).
    //
    // El `?ws=` va explícito: es un <a> de página entera, y el paso 1 resuelve el
    // workspace destino del request. Sin esto, la agencia parada adentro de un
    // cliente le conectaba la agenda a su PROPIO workspace, sin ningún error.
    const completa = !!gcal?.conectado && gcal.puedeMover;
    actions.push({ label: completa ? 'Reconectar Google Calendar' : 'Conectar Google Calendar', href: conWs('/api/integraciones/google-calendar', wsPestana), primary: true, sameTab: true });
    // LA SALIDA. `disconnectGoogleCalendarAction` existía desde el día uno y su
    // único caller era GoogleCalendarPanel, que no está montado en ninguna página:
    // o sea que no había forma de soltar una agenda. Mientras conectar era
    // owner-only eso era un detalle; abierto a los clientes es el arreglo de
    // "quedó conectada la cuenta de Google equivocada", que es el error más
    // probable del flujo (Google consiente por CUENTA, no por workspace).
    if (gcal?.conectado || gcalRechazada) {
      actions.push({
        label: desconectando ? 'Quitando…' : 'Quitar esta agenda',
        onClick: () => {
          if (desconectando) return;
          setDesconectando(true);
          disconnectGoogleCalendarAction().then(onCambio).finally(() => setDesconectando(false));
        },
      });
    }
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

          {i.key === 'google' && <PermisoGoogleCalendar conectada={i.estado === 'conectada'} estado={gcal} />}

          {esAgente ? (
            <TutorialAgente tokenInicial={agenteToken ?? null} appUrl={appUrl ?? ''} />
          ) : esLanding ? (
            <>
              <CodigoLanding snippet={snippetLanding ?? null} pixel={pixel}
                elegida={landingModal} onElegir={setLandingModal} />
              {/* ⚠️ EL PASO 4 NO EXISTE HASTA QUE HAY LANDING ELEGIDA. Mientras
                  el estado vivía adentro de CodigoLanding —y el paso 4 se
                  renderiza afuera— no había forma de pasárselo, así que volvía a
                  preguntar cuál probar: la misma pregunta dos veces, y con dos
                  respuestas que podían diferir. */}
              {landingModal && (
                <Paso n={4} key={landingModal} titulo="Comprueba que está funcionando">
                  <ProbarTracking landingFija={landingModal} />
                </Paso>
              )}
            </>
          ) : mostrarForm ? (
            // onEstado avisa cuando el servicio pasó a conectado (o dejó de estarlo):
            // sin esto el chip de acá arriba, el tile y el contador se quedaban en
            // "Por configurar" después de guardar, hasta que apretaras F5.
            <ServicioConfigForm servicioKey={i.key} onEstado={onCambio} />
          ) : i.estado === 'falta' && i.key !== 'google' && (
            // Google no lleva credenciales que copiar: se conecta por OAuth y su
            // estado lo cuenta PermisoGoogleCalendar. Sin esta excepción, el chip
            // de "falta configurar" mostraba la frase del detalle como si fuera
            // el nombre de una variable de entorno.
            <div>
              <div style={{ ...capMono, fontSize: 10, letterSpacing: '.08em', marginBottom: 7 }}>Falta configurar</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {faltan.split(',').map((v) => v.trim()).filter(Boolean).map((v) => (
                  <code key={v} style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px' }}>{v}</code>
                ))}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
                Carga {faltan.includes(',') ? 'estas credenciales' : 'esta credencial'} desde aquí y quedará conectado.
              </p>
            </div>
          )}
          </div>

          {/* Footer fijo: las acciones no se van con el scroll. */}
          {actions.length > 0 && (
            <div style={{ flex: 'none', display: 'flex', gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--border)', padding: '16px 26px 22px' }}>
              {actions.map((a) => {
                // Mismo aspecto para las dos etiquetas. Un <button> NO hereda la
                // tipografía ni es `display:block`, así que la hoja va explícita:
                // cambiar de etiqueta arrastra estilos que el diff no muestra.
                const estilo: CSSProperties = { border: `1px solid ${a.primary ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 10, background: a.primary ? 'var(--primary)' : 'var(--surface)', color: a.primary ? '#fff' : 'var(--dim)', fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13.5, padding: '10px 15px', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block', textAlign: 'center' };
                // Una acción que EJECUTA algo es un botón, no un enlace: un <a>
                // sin href no recibe foco ni responde al teclado.
                return a.onClick
                  ? <button key={a.label} type="button" onClick={a.onClick} style={estilo}>{a.label}</button>
                  : <a key={a.label} href={a.href} target={a.sameTab ? undefined : '_blank'} rel={a.sameTab ? undefined : 'noopener noreferrer'} style={estilo}>{a.label}</a>;
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * Qué permiso tiene HOY la agenda de Google, dentro del modal del servicio.
 *
 * Existe porque "conectada" dejó de ser una sola cosa: los refresh_token que se
 * emitieron cuando solo pedíamos `calendar.readonly` siguen siendo de lectura, y
 * desde afuera se ven idénticos a uno nuevo.
 *
 * Ya NO hace el fetch: el estado lo pide el board una sola vez al abrir la pantalla
 * (ver `gcal` allá arriba). Tenía que subir, porque de este permiso depende el punto
 * del tile, el contador de conectados y el chip — no solo este párrafo. Mientras el
 * chequeo vivió acá adentro, la tarjeta quedaba verde en la grilla y la verdad
 * aparecía recién al abrir el modal.
 */
function PermisoGoogleCalendar({ conectada, estado }: { conectada: boolean; estado: GoogleCalendarStatus | null }) {
  if (!conectada) {
    return (
      <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
        Conecta tu agenda para que las reuniones se detecten solas y para que, al reagendar desde el CRM, el evento se mueva y el invitado reciba el aviso.
      </p>
    );
  }
  // `puede` en false = esta sesión no administra la agenda: no tiene sentido
  // mostrarle un permiso que no puede cambiar.
  if (!estado || !estado.puede) return null;

  if (estado.puedeMover) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 15, padding: '11px 13px', borderRadius: 11, background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 12.5, lineHeight: 1.5 }}>
        <span>Permiso completo{estado.email ? ` sobre la agenda de ${estado.email}` : ''}: al reagendar una reunión desde el CRM, el evento se mueve y el invitado recibe el aviso.</span>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 15, padding: '12px 14px', borderRadius: 11, background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', marginBottom: 4 }}>Faltan permisos para mover reuniones</div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
        La agenda{estado.email ? ` de ${estado.email}` : ''} se autorizó cuando solo pedíamos leerla: tus reuniones se detectan, pero «Reagendar»
        actualiza el CRM y no mueve el evento ni le avisa al invitado. Por eso figura como <b>no conectada</b>.
        Toca «Conectar Google Calendar» aquí abajo y Google te va a pedir el permiso que falta.
      </p>
    </div>
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
