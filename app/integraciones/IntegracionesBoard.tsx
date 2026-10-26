'use client';

// =============================================================================
// IntegracionesBoard — las integraciones del negocio + Costo de MaKo + detalle en modales
// =============================================================================
// LA ESTRUCTURA DE VERCEL MARKETPLACE (24/10/2026). Martín: «hay tanta pero tanta info que se complica muchísimo para el
// usuario... Piensa en como hacerlo o investiga como lo hacen otras apps». El Cerebro abrió vercel.com/marketplace en el
// navegador (y se volvió a relevar el 24/10: la página en vivo y su documentación). Lo que se copió, la ESTRUCTURA:
//   · UNA fila de controles arriba —el tipo (acá, el estado), la categoría y la búsqueda («/» la enfoca)—, no diez secciones
//     apiladas: las categorías son un FILTRO;
//   · pocas secciones con nombre y criterio: «Conectadas» (lo que la persona viene a mirar, con su estado) y «Sin conectar»
//     (el catálogo), que muestra doce y cierra con «Mostrar más integraciones»;
//   · cada tarjeta mínima: el logo, la categoría en una píldora, el nombre y UNA línea (la `descripcion` del catálogo); en
//     las conectadas, su estado. La configuración vive en el modal de cada una (`ServicioModal`), que no cambió.
// Lo que NO se copió: el carrusel de destacadas (acá la única destacada es «Tus cuentas de IA», arriba, en page.tsx) y la
// tarjeta «Request an integration» (AGENTS.md: un pedido no se resuelve con un formulario propio, va por la Ticketera).
// Se fueron el medidor «N / M conectados» y «Requiere tu atención», que repetía arriba hasta quince tarjetas de la grilla:
// el problema de una conectada se lee en SU tarjeta, y el filtro «Con problemas» las junta. «Costo de MaKo» y el
// «Historial de problemas» quedan abajo, plegados con su dato a la vista (no son el catálogo).
// Antes (julio, un Claude Design de Martín): medidor, «Requiere tu atención», «Servicios» por categoría, «Costo de MaKo» e
// «Historial de problemas», todo desplegado. Todo alimentado con data REAL:
//   · integraciones (estado conectada/falta) — getIntegraciones()
//   · health (detalle en vivo de Meta) — getMetaHealth()
//   · historial (estados negativos de Meta) — getHistorialMeta()
//   · usage (/api/anthropic-usage) — gasto de IA por proveedor/proceso/operación
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { volverDeLaPestana } from '@/lib/integracion-en-tab';
import { esPasarela } from '@/lib/cobros-tipos';
import { DEFS, ordenCategoria } from '@/lib/integraciones-catalogo';
import { useConectarIntegracion } from '@/app/_components/ConectarIntegracion';
import { SelectorLanding } from './SelectorLanding';
import { AsignarProducto } from './AsignarProducto';
import type { RechazoGracias } from '@/lib/landing-gracias-reglas';
import type { LandingConfig } from '@/lib/landing-config';
import type { ProductoAsignable } from '@/lib/landing-funnel';
import { Button } from '@/app/_ui';
import { MakoStar } from '../_components/MakoBrand';
import { BrandDefs, SvcIcon } from '../_components/ServicioVisual';
import { Carrusel, EnlaceMaKo } from '../_components/PanelMarketing';
import { SLIDES, type Slide } from '@/lib/servicio-slides';
import type { MetaHealth } from '@/lib/meta-health-ui';
import { AVISO_FALTAN_PERMISOS_META, FALTAN_PERMISOS_META } from '@/lib/meta-permisos';
import { procesoLegible, proveedorLegible, modeloLegible, motivoLegible, ordenIA, IA_ORDEN, esIAdePago } from '@/lib/ia-labels';
import type { CuotaProv } from '@/lib/ia-cuotas';
import { TutorialAgente, CODE } from '../_components/TutorialAgente';
import type { TokenAgenteVisible } from '@/lib/agente-token-nucleo';
import { ModalShell } from '../_components/ModalShell';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import ServicioConfigForm, { IconBtn } from './ServicioConfigForm';
import { Icon } from '../_components/icons';
import { getGoogleCalendarStatusAction, disconnectGoogleCalendarAction, type GoogleCalendarStatus } from '@/app/configuraciones/gcal-actions';
import { GCAL_MSG } from '@/app/configuraciones/GoogleCalendarPanel';
import { ProbarTracking } from './ProbarTracking';
import { ROTULO_PIXEL_VIEJO } from '@/lib/pixel-aviso';
import { motivoDelAviso, type EstadoAvisoCalendly } from '@/lib/calendly-aviso-reglas';
import { ARCHIVO_PIXEL, pixelComoArchivo } from '@/lib/pixel-archivo';
import { POR_QUE_IA_DE_MAKO, POR_QUE_LA_CONFIGURA_MAKO } from '@/lib/ia-keys';

const MONO = "'Geist Mono', monospace";

// ── Tipos ──────────────────────────────────────────────────────────────────
// ⚠️ EL TIPO SE IMPORTA, NO SE COPIA. Estaba escrito a mano acá, y por eso al
// sumarle dos campos en el server esta copia se quedó vieja sin que nada fallara
// hasta el typecheck. `import type` lo BORRA en compilación —no queda ni un
// require en el bundle— así que traerlo de un módulo `server-only` es seguro y no
// arrastra nada. Lo que NO se puede es importar de ahí un valor: eso rompe el
// build del cliente, que es exactamente el guard que queremos.
import type { Integracion } from '@/lib/integraciones';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
// Incidente con período: startedAt → resolvedAt (null = en curso). Viene del server.
type Incidente = { id: number; service: string; severidad: string; statusLabel: string; disableReason: string | null; entregaFrenada: boolean; detalle: string | null; startedAt: string; resolvedAt: string | null };

type Movimiento = { at: string; feature: string; motivo: string | null; model: string | null; provider: string; tokens: number; costUsd: number };
type Saldo = { usd: number; setAt: string; cargas?: Array<{ usd: number; at: string }> };
type ProvSaldo = { provider: string; costMesUsd: number; tokens: number; tokensHoy: number; saldo: Saldo | null; restanteUsd: number | null; gratis: boolean };

// Límite del plan GRATIS por proveedor (para el gauge de "uso de hoy"). NO es el mismo
// para todos: Groq topea por TOKENS/día; Gemini Flash NO tiene tope diario de tokens
// sino 250 SOLICITUDES/día + 250k tokens/MINUTO + 1M de contexto. Por eso Gemini se
// muestra sin denominador de tokens inventado (antes copiaba el 500k de Groq → mal).
// IA16 (23/10/2026): sin Cerebras, Mistral ni OpenRouter (IA8 los sacó el 22/10), y Groq sólo pasa a texto las notas de voz.
const LIMITE_FREE: Record<string, { tokensDia?: number; cap: string }> = {
  groq: { tokensDia: 500_000, cap: 'tokens · sólo notas de voz · reinicia cada día' },
  gemini: { cap: 'Gemini free: 250 solicitudes/día · 1M de contexto (no hay tope de tokens/día)' },
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
type ResumenPeriodo = { periodo: string; llamadas: number; tokens: number; costUsd: number; filas: number; porFeature: Array<{ clave: string; llamadas: number; tokens: number; costUsd: number }>; delNegocio?: { llamadas: number; costUsd: number }; delCredito?: { llamadas: number; costUsd: number } };

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

// El ORDEN de las categorías (en el desplegable y dentro de cada sección) es el de lib/integraciones-catalogo.ts, el mismo que
// usa el teléfono. Hasta el 24/10/2026 vivía acá como `CAT_ORDER` y hacía de LISTA BLANCA (GitHub y Whop quedaron invisibles):
// ya no filtra.

// ── La fila de controles (24/10/2026, Vercel Marketplace: «All types», «All categories» y la búsqueda) ──
const TODAS = 'todas';
type FiltroEstado = typeof TODAS | 'conectadas' | 'sin-conectar' | 'problemas';
const ESTADOS_FILTRO: DropdownOption[] = [
  { value: TODAS, label: 'Todos los estados', icono: 'filtro' },
  { value: 'conectadas', label: 'Conectadas', icono: 'check' },
  { value: 'sin-conectar', label: 'Sin conectar', icono: 'agregar' },
  { value: 'problemas', label: 'Con problemas', icono: 'avisar' },
];
// El ícono de cada categoría en su desplegable (AGENTS.md: un tipo de cosa lleva su ícono). Una que no esté acá va con la
// etiqueta: no es un registro más para quien agrega una integración.
const ICONO_CATEGORIA: Record<string, string> = {
  Publicidad: 'anuncio', Mensajería: 'enviar', Pagos: 'dinero', Inteligencia: 'mako', 'IA Generativa': 'imagen',
  Agentes: 'computadora', Reuniones: 'calendario', Contenido: 'curso', Datos: 'grafico', Desarrollo: 'llave',
};
/** Cuántas de «Sin conectar» se ven antes de «Mostrar más integraciones» (Vercel muestra doce: tres filas de cuatro). */
const TOPE_CATALOGO = 12;
/** Para buscar sin que importen las tildes ni las mayúsculas («mensajeria» encuentra «Mensajería»). */
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Servicios sintéticos: no están en el catálogo de integraciones pero tienen modal
// propio (Groq es gratis y aparece en Costo de MaKo → su tile abre este modal).
const SYNTHETIC: Record<string, Integracion> = {
  groq: { key: 'groq', nombre: 'Groq API', categoria: 'Inteligencia', descripcion: 'IA rápida y gratuita para tareas simples y transcripción. Limitada por rate (tokens/día del plan gratis), no por saldo.', estado: 'conectada', detalle: '' },
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
export function IntegracionesBoard({ integraciones, sinTarjeta = [], health, metaError, incidentes, snippetLanding, cargadorLanding, landingVieja = false, avisoCalendly = null, cuotas = [], agenteActual, appUrl, pixel, embebido = false }: {
  integraciones: Integracion[];
  /** Las que no son tarjetas de la grilla (`oculto`: las cuatro IA y Google Calendar), con su estado real. No se dibujan:
   *  están para que su modal se abra desde «Costo de MaKo» con el saldo y el refresco de la página (25/10/2026). */
  sinTarjeta?: Integracion[];
  health: MetaHealth | null;
  metaError: string | null;
  /** `null` = no se pudieron leer (no es «no hubo»). */
  incidentes: Incidente[] | null;
  /** <script> con el token del workspace, listo para copiar. null = admin sin impersonar. */
  snippetLanding?: string | null;
  /** La línea del cargador del Pixel (lib/pixel-cargador.ts). null = admin sin impersonar. */
  cargadorLanding?: string | null;
  /** El código pegado en su página es de una versión vieja (lo sabe el beacon). */
  landingVieja?: boolean;
  /** ¿Entran a MaKo las reservas nuevas de su Calendly? (lib/calendly-aviso.ts). null = sin Calendly o no se pudo leer. */
  avisoCalendly?: EstadoAvisoCalendly | null;
  /** Cuota gratis consumida hoy por cada IA barata (gauge "cuánto queda"). */
  cuotas?: CuotaProv[];
  /** Token del agente externo (Claude Code): sólo su pista y su alcance —el token no está
   *  guardado desde el 09/10/2026—. null = todavía no acuñó ninguno. */
  agenteActual?: TokenAgenteVisible | null;
  /** URL absoluta de la app, para embeberla en la skill que se copia. */
  appUrl?: string;
  /**
   * Lo que el Pixel necesita para pintar sus pasos 1 y 2 en el PRIMER frame,
   * resuelto en el server (`page.tsx`). Antes lo pedían los pasos con server
   * actions, en serie. `null` en cualquiera de los dos = no se pudo leer.
   */
  pixel?: DatosPixel;
  /**
   * Adentro de «Configuración del negocio» (15/10/2026): el título y el `<main>` los pone el molde de
   * ajustes (app/_ui/Ajustes.tsx). Queda el contador de conectados, que es un dato y no un título.
   */
  embebido?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<Resumen | null>(null);
  const [modal, setModal] = useState<{ t: 'svc'; key: string } | { t: 'hist' } | null>(null);
  // Las que NO tienen tarjeta en la grilla (`oculto`: las cuatro IA, que viven en «Tus cuentas de IA», y Google Calendar,
  // que se conecta desde Calendario) siguen abriéndose con su link: el MISMO modal que usan las demás pestañas.
  const { abrir: abrirSuelta, modal: modalSuelto } = useConectarIntegracion();
  // La fila de controles (24/10/2026). Vive en la pantalla: no viaja en la URL (nadie la comparte).
  const [estadoF, setEstadoF] = useState<string>(TODAS);
  const [catF, setCatF] = useState<string>(TODAS);
  const [q, setQ] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const buscarRef = useRef<HTMLInputElement>(null);
  // La tarjeta que pidió un link (`?abrir=`): tiene que estar en el DOM para el scroll, aunque caiga en lo que «Mostrar
  // más» pliega. `vez` reabre el scroll si el mismo link se toca de nuevo.
  const [pedida, setPedida] = useState<{ key: string; vez: number } | null>(null);
  // `?ops=1` abre «Costo de MaKo», que va plegado: cada vez suma uno y el plegado se abre.
  const [abrirCosto, setAbrirCosto] = useState(0);

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
    // `?abrir=<key>` es contrato (avisos, la API de MaKo, MaKo en WhatsApp): una integración sin tarjeta (`oculto`) no
    // puede quedar en un link que no hace nada (25/10/2026, al sacar las IA y Google Calendar de la grilla).
    // Groq tenía un modal sintético (SYNTHETIC): ahora está en el catálogo, y el suelto trae su estado real.
    const enGrilla = integraciones.some((i) => i.key === abrir);
    const oculta = !enGrilla && DEFS.some((d) => d.key === abrir && d.oculto);
    if (!enGrilla && !oculta && !SYNTHETIC[abrir]) return;
    yaAbierto.current = true;
    if (oculta) abrirSuelta(abrir);
    else setModal({ t: 'svc', key: abrir });
    // Que la tarjeta se vea (24/10/2026): sin filtros que la escondan, y fuera de lo que pliega «Mostrar más». El scroll va
    // en su efecto, detrás del render que la pone en el DOM.
    setQ(''); setCatF(TODAS); setEstadoF(TODAS);
    setPedida((p) => ({ key: abrir, vez: (p?.vez ?? 0) + 1 }));
    const q = new URLSearchParams(searchParams.toString());
    q.delete('abrir');
    router.replace(`/integraciones${q.size ? `?${q}` : ''}`, { scroll: false });
  }, [abrir, integraciones, router, searchParams, abrirSuelta]);

  // ── Google Calendar: "hay token" NO es "está conectado" ────────────────────
  // El server solo sabe que existe un refresh_token. Si ese token es de los VIEJOS
  // (se emitió cuando pedíamos únicamente `calendar.readonly`) la agenda se lee,
  // pero «Reagendar» del CRM no mueve un solo evento. Pintado en verde, eso es una
  // mentira: el dueño lo dijo tal cual — «necesitaba más permisos, en ese caso debe
  // aparecer como DESCONECTADO».
  //
  // El permiso real solo lo sabe Google (hay que refrescar el token para leer sus
  // scopes), así que se pregunta UNA vez al abrir la pantalla — nunca por tile.
  // ⚠️ Google Calendar ya no es una tarjeta (25/10/2026): su estado viene en `sinTarjeta`. Mirando sólo la grilla, `gcal`
  // no se pedía nunca, `gcalIncompleta` daba siempre false y una vuelta `?gcal=ok` con la casilla de escritura destildada
  // en la pantalla de Google festejaba «Ya se usa ... para mover reuniones», que no pasa.
  const googleConToken = [...integraciones, ...sinTarjeta].some((i) => i.key === 'google' && i.estado === 'conectada');
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
  // Con token y el permiso todavía sin leer, el «conectado» espera (25/10/2026): si no, se lee un instante (hasta que
  // Google contesta) aunque después resulte a medias.
  const gcalSinLeer = googleConToken && gcal === null;

  // ⚠️ Y SI FALLÓ, EL BOTÓN TIENE QUE ESTAR (25/10/2026). Google Calendar ya no es una tarjeta: se conecta en el modal
  // suelto (`?abrir=google`, el link que manda MaKo). Si el OAuth volvía con un error, la franja de abajo pedía «Vuelve a
  // apretar "Conectar Google Calendar"» y en la pantalla no había ni tarjeta ni modal con ese botón. Se reabre el suelto
  // UNA vez por resultado (la ref), que dice adentro qué pasó y trae el botón; la franja queda, como antes.
  // Y un «ok» con el permiso a medias (destildó la casilla de escritura) también: la franja se calla y no hay tarjeta que
  // diga lo que falta; lo dice el modal («Faltan permisos para mover reuniones») y trae el botón. Sin el motivo «ok», que
  // adentro festejaría lo mismo.
  const gcalParam = searchParams.get('gcal');
  const gcalReabierto = useRef<string | null>(null);
  useEffect(() => {
    if (!gcalParam) { gcalReabierto.current = null; return; }
    if (gcalReabierto.current === gcalParam) return;
    if (integraciones.some((i) => i.key === 'google')) return;
    const fallo = GCAL_MSG[gcalParam]?.kind === 'err';
    if (!fallo && !(gcalParam === 'ok' && gcalIncompleta)) return;
    gcalReabierto.current = gcalParam;
    abrirSuelta('google', fallo ? gcalParam : null);
  }, [gcalParam, integraciones, abrirSuelta, gcalIncompleta]);

  // El toast global (y el chip de la sidebar) linkean con ?ops=1 → abrimos el
  // historial de operaciones. Consumimos el flag al instante (router.replace) para
  // que un segundo click del toast (mismo ?ops=1) vuelva a ser un cambio '' → 'ops=1'
  // y reabra el modal aunque lo hayas cerrado con Escape.
  useEffect(() => {
    if (searchParams.get('ops') === '1') {
      setModal({ t: 'hist' });
      setAbrirCosto((n) => n + 1);
      router.replace('/integraciones#saldo-ia', { scroll: false });
    }
  }, [searchParams, router]);

  // El scroll del deep-link va detrás del render que pone la tarjeta en el DOM (desplegada si hacía falta): scrollIntoView
  // necesita a dónde ir.
  useEffect(() => {
    if (!pedida) return;
    const t = requestAnimationFrame(() => {
      document.getElementById(`svc-${pedida.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(t);
  }, [pedida]);

  // «/» enfoca la búsqueda, como en Vercel Marketplace; no mientras se escribe en otro campo ni con un modal abierto.
  const hayModal = modal != null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || hayModal) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      e.preventDefault();
      buscarRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hayModal]);

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

  // Severidad efectiva de un servicio: Meta usa su semáforo en vivo (o 'bad' si el
  // token está presente pero la lectura en vivo falló); Google, su PERMISO real; el
  // resto, conectada (verde) vs falta de config (ámbar "Por configurar", NO rojo:
  // todavía no es un incidente).
  const faltaAvisoCalendly = motivoDelAviso(avisoCalendly);
  const sevOf = (i: Integracion): 'good' | 'warn' | 'bad' => {
    if (i.key === 'meta') {
      if (metaSev) return metaSev === 'verde' ? 'good' : metaSev === 'ambar' ? 'warn' : 'bad';
      if (metaError) return 'bad';
    }
    // Verde SOLO con el permiso completo. Media conexión no es verde: así la tarjeta
    // (su estado, y el filtro «Con problemas») dice lo mismo que el modal, en vez
    // de dejarlo en una nota al pie que nadie abre.
    if (i.key === 'google' && (gcalIncompleta || gcalRechazada)) return 'warn';
    // Mismo criterio para la landing: el código pegado en su página es de una
    // versión vieja. El tracking anda —los eventos llegan— pero hay algo que
    // hacer, y el verde no sabe decir eso. Degradar a ámbar es el precedente de
    // Google, y se elige por lo mismo: que la tarjeta, su punto y el chip del
    // modal digan todos lo mismo, en vez de esconderlo en una nota que nadie abre.
    if (i.key === 'landing' && landingVieja) return 'warn';
    // Y Calendly con el token y el R1 pero sin el aviso que trae las reservas nuevas (23/10/2026): lee la agenda y no
    // recibe nada. El mismo ámbar, por lo mismo: el verde no sabe decir «conectada, pero no entra ninguna reserva».
    if (i.key === 'calendly' && i.estado === 'conectada' && faltaAvisoCalendly) return 'warn';
    return i.estado === 'conectada' ? 'good' : 'warn';
  };
  const dotColor = (s: 'good' | 'warn' | 'bad') => (s === 'good' ? 'var(--good)' : s === 'warn' ? 'var(--warn-fill)' : 'var(--bad)');
  // ⚠️ LAS PASARELAS DE PAGO SON OPCIONALES Y ALTERNATIVAS (Stripe O Mercado Pago, y la mayoría
  // de los negocios cobra por fuera). Sin configurar no son un pendiente: contarlas en el medidor
  // le bajaba el «N/M conectados» a TODOS los clientes el día que aparecieron, y pedirlas en
  // «Requiere tu atención» empujaba a conectar las dos. Conectadas sí suman. A medias (la clave
  // puesta y el aviso sin registrar) tampoco se cuentan acá: eso se ve y se arregla adentro del
  // modal, que es donde está la persona cuando pasa (lib/cobros-conexion.ts lo dice al guardar).
  // La grilla las sigue mostrando «Por configurar», que es la verdad.
  // Y las del Leads Scraper (Hotmart, Skool y Apify; 14 y 15/10/2026), por lo mismo: la mayoría de
  // los negocios no vende por Hotmart, no tiene un Skool ni sale a buscar prospectos.
  // Y las IA que configura el equipo de MaKo (el workspace del entorno, lib/ia-keys.ts → `veredictoDeIA`): no son un
  // pendiente de la persona, y pedírselas en «Requiere tu atención» la empujaría a pegar una key que no debe.
  // Y un grabador que HOY no se conecta (Loom sin API; Read AI y Meet, sin su inicio de sesión: `sinConexion`): no hay nada
  // que la persona pueda hacer para conectarlo, así que no es un pendiente.
  const opcionalSinConectar = (i: Integracion) => (esPasarela(i.key) && sevOf(i) !== 'good')
    || i.detalle === POR_QUE_LA_CONFIGURA_MAKO || !!i.sinConexion;
  // Resuelve un servicio por key incluyendo entradas sintéticas (Groq tiene tile en
  // Costo de MaKo pero no está en el catálogo de integraciones → su modal usa esto).
  // ⚠️ Y las que no son tarjetas (`sinTarjeta`, 25/10/2026): desde que las IA dejaron la grilla, la caja de Claude, OpenAI
  // o Gemini y «¿Cargaste créditos? Regístralos →» llamaban a `setModal` con una key que acá no estaba, y no se abría NADA.
  const svcByKey = (key: string): Integracion | null => integraciones.find((x) => x.key === key)
    ?? sinTarjeta.find((x) => x.key === key) ?? SYNTHETIC[key] ?? null;

  // ── Conectadas y sin conectar (24/10/2026) ──
  // Una IA que configura el equipo de MaKo no le pide nada al negocio: va con las conectadas, con su leyenda.
  const delEquipoMaKo = (i: Integracion) => i.detalle === POR_QUE_LA_CONFIGURA_MAKO;
  const estaConectada = (i: Integracion) => i.estado === 'conectada' || delEquipoMaKo(i);
  // Lo que le pasa a una conectada que no está bien, corto y EN SU TARJETA (antes, otra tarjeta en «Requiere tu atención»,
  // arriba, repitiendo la grilla). Una sin conectar no lleva motivo: está en «Sin conectar», y el modal dice qué falta —nunca
  // el nombre de una variable, como «Falta configurar: RESEND_API_KEY»—.
  // (Sin useMemo: el React Compiler memoiza; el useMemo manual con el closure sevOf le impedía optimizar.)
  const motivoDe = (i: Integracion): string | null => {
    // La clave que pegó es la de MaKo (`veredictoDeIA` → copia): está sin conectar, pero hay algo que hacer y se dice en SU
    // tarjeta. Antes lo decía «Requiere tu atención»; sin eso, quedaba muda en «Sin conectar» (revisión del 24/10/2026).
    if (i.detalle === POR_QUE_IA_DE_MAKO) return POR_QUE_IA_DE_MAKO;
    if (!estaConectada(i) || delEquipoMaKo(i) || sevOf(i) === 'good') return null;
    let motivo = 'Requiere atención';
    if (i.key === 'meta') {
      motivo = health
        ? (health.account.entregaFrenada ? 'Entrega frenada' : (health.account.disableReasonLabel || health.account.statusLabel || 'Requiere atención'))
        : metaError === FALTAN_PERMISOS_META ? FALTAN_PERMISOS_META : 'No se pudo leer el estado de Meta';
    } else if (i.key === 'google' && gcalIncompleta) {
      // El motivo dice QUÉ falta (no "Requiere atención", que no orienta a nadie).
      motivo = 'Falta permiso para mover reuniones';
    } else if (i.key === 'google' && gcalRechazada) {
      // Distinto de «falta permiso»: acá el token ya no sirve para NADA.
      motivo = 'Google ya no acepta la agenda: hay que reconectarla';
    } else if (i.key === 'landing' && landingVieja) {
      motivo = ROTULO_PIXEL_VIEJO;
    } else if (i.key === 'calendly' && i.estado === 'conectada' && faltaAvisoCalendly) {
      motivo = faltaAvisoCalendly.motivo;
    }
    return motivo;
  };

  // ── La fila de controles: qué se ve ──
  // Las categorías del desplegable salen de las integraciones que esta persona ve (nunca de una lista aparte).
  const opcionesCategoria: DropdownOption[] = [
    { value: TODAS, label: 'Todas las categorías', icono: 'etiqueta' },
    ...[...new Set(integraciones.map((i) => i.categoria))]
      .sort((a, b) => ordenCategoria(a) - ordenCategoria(b) || a.localeCompare(b, 'es'))
      .map((c) => ({ value: c, label: c, icono: ICONO_CATEGORIA[c] ?? 'etiqueta' })),
  ];
  const texto = sinTildes(q.trim());
  const filtrando = texto !== '' || catF !== TODAS || estadoF !== TODAS;
  const filtroEstado = estadoF as FiltroEstado;
  const pasa = (i: Integracion) => (catF === TODAS || i.categoria === catF)
    && (filtroEstado === TODAS
      || (filtroEstado === 'conectadas' && estaConectada(i))
      || (filtroEstado === 'sin-conectar' && !estaConectada(i))
      || (filtroEstado === 'problemas' && motivoDe(i) != null))
    && (!texto || sinTildes(`${i.nombre} ${i.categoria} ${i.descripcion}`).includes(texto));
  // Dentro de cada sección, el orden de las categorías y, en Inteligencia, primero las de pago (ordenIA); a igualdad, el del
  // catálogo (`sort` es estable).
  const enOrden = (a: Integracion, b: Integracion) => ordenCategoria(a.categoria) - ordenCategoria(b.categoria) || ordenIA(a.key) - ordenIA(b.key);
  // Las conectadas con un problema van primero: rojo, después ámbar.
  const rango = (i: Integracion) => (motivoDe(i) == null ? 2 : sevOf(i) === 'bad' ? 0 : 1);
  const conectadasVis = integraciones.filter((i) => estaConectada(i) && pasa(i)).sort((a, b) => rango(a) - rango(b) || enOrden(a, b));
  // Las que tienen algo que hacer (la clave de MaKo pegada) van primero; las opcionales (las pasarelas y las del Leads
  // Scraper, `opcionalSinConectar`), al final del catálogo.
  const sinConectarVis = integraciones.filter((i) => !estaConectada(i) && pasa(i))
    .sort((a, b) => rango(a) - rango(b) || Number(opcionalSinConectar(a)) - Number(opcionalSinConectar(b)) || enOrden(a, b));
  // «Mostrar más» SE CALCULA (AGENTS.md): con un filtro o una búsqueda se ve todo lo que pasa, y lo que pidió un link también.
  const pedidaOculta = pedida != null && sinConectarVis.slice(TOPE_CATALOGO).some((i) => i.key === pedida.key);
  const catalogo = verTodas || filtrando || pedidaOculta ? sinConectarVis : sinConectarVis.slice(0, TOPE_CATALOGO);
  const ocultas = sinConectarVis.length - catalogo.length;
  const limpiar = () => { setQ(''); setCatF(TODAS); setEstadoF(TODAS); };

  // La tarjeta (Vercel: el logo, la categoría en una píldora, el nombre y una línea). Toda la tarjeta abre su modal.
  const tarjeta = (i: Integracion) => {
    const conectada = estaConectada(i);
    const equipo = delEquipoMaKo(i);
    const motivo = motivoDe(i);
    const sev = motivo ? sevOf(i) : 'good';
    return (
      // Sin conectar, más apagada (25/10/2026, Martín: «para que se diferencien»): app/globals.css, `[data-sin-conectar]`.
      <button key={i.key} id={`svc-${i.key}`} type="button" className="int-tarjeta" data-sin-conectar={conectada || motivo ? undefined : ''}
        onClick={() => setModal({ t: 'svc', key: i.key })}>
        <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <SvcIcon k={i.key} box={36} radius={10} size={21} />
          <span className="int-pildora">{i.categoria}</span>
        </span>
        {/* El nombre ENTERO, en dos renglones si hace falta (21/10/2026): con «…» se leía «Instagram y Mess…». */}
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', lineHeight: 1.25, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{i.nombre}</span>
        <span className="int-tarjeta__linea">{i.descripcion}</span>
        {(conectada || motivo) && (
          // El motivo se lee ENTERO (21/10/2026): con «…» se cortaba también a 1280 de ventana.
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 'auto', paddingTop: 2, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: equipo ? 'var(--dim)' : sev === 'bad' ? 'var(--bad)' : sev === 'warn' ? 'var(--warn)' : 'var(--good)', overflowWrap: 'anywhere' }}>
            <span aria-hidden style={{ width: 8, height: 8, flex: 'none', marginTop: 4, borderRadius: '50%', background: equipo ? 'var(--faint)' : dotColor(sev) }} />
            {equipo ? POR_QUE_LA_CONFIGURA_MAKO : motivo ?? 'Conectada'}
          </span>
        )}
      </button>
    );
  };
  // `min(…, 100%)`: en una columna más angosta que el mínimo, una tarjeta de ancho entero en vez de desbordar.
  const grilla = (items: Integracion[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(236px,100%),1fr))', gap: 12 }}>{items.map(tarjeta)}</div>
  );
  const tituloSeccion = (id: string, titulo: string, n: number) => (
    <h2 id={id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 0 12px', fontWeight: 600, fontSize: 17, letterSpacing: '-0.012em', color: 'var(--ink)' }}>
      {titulo}<span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: 'var(--faint)' }}>{n}</span>
    </h2>
  );
  // Embebido no puede ser otro `<main>`: la página ya tiene uno (el del molde de ajustes).
  const Raiz = embebido ? 'div' : 'main';

  return (
    <Raiz style={embebido ? { minWidth: 0 } : { flex: 1, minWidth: 0, padding: '30px 42px 90px' }}>
      <BrandDefs />

      {/* ═══ LA FILA DE CONTROLES (Vercel Marketplace: el tipo, la categoría y la búsqueda, en una fila) ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Dropdown value={estadoF} options={ESTADOS_FILTRO} onChange={setEstadoF} ariaLabel="Estado de las integraciones" width={190} />
        <Dropdown value={catF} options={opcionesCategoria} onChange={setCatF} ariaLabel="Categoría" width={214} />
        <label className="int-buscar">
          <Icon name="search" size={16} />
          <input ref={buscarRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar una integración"
            onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); } }} />
          {q
            ? <button type="button" className="int-buscar__tecla" onClick={() => { setQ(''); buscarRef.current?.focus(); }} aria-label="Borrar la búsqueda">Esc</button>
            : <kbd className="int-buscar__tecla" aria-hidden>/</kbd>}
        </label>
      </div>

      {/* Resultado del OAuth de Google (?gcal=…). Va arriba de todo porque es la
          respuesta a lo último que hizo el usuario antes de volver a esta pantalla. */}
      {/* El "conectado ✓" se calla si el permiso igual quedó a medias (se destildó la
          casilla de escritura en la pantalla de Google): festejar ahí sería el mismo
          verde mentiroso que estamos sacando. Lo que falta lo cuenta el modal de Google, que se reabre (25/10/2026: ya no
          hay tarjeta). Y espera a saber el permiso (`gcalSinLeer`). */}
      {gcalMsg && !(gcalMsg.kind === 'ok' && (gcalIncompleta || gcalSinLeer)) && (
        <div role="status" style={{ marginTop: 18, borderRadius: 12, padding: '12px 17px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, background: gcalMsg.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: gcalMsg.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>
          {gcalMsg.txt}
        </div>
      )}

      {/* ═══ CONECTADAS ═══ */}
      {conectadasVis.length > 0 && (
        <section aria-labelledby="int-conectadas" style={{ marginTop: 26 }}>
          {tituloSeccion('int-conectadas', 'Conectadas', conectadasVis.length)}
          {grilla(conectadasVis)}
        </section>
      )}

      {/* ═══ SIN CONECTAR (el catálogo) ═══ */}
      {sinConectarVis.length > 0 && (
        <section aria-labelledby="int-sin-conectar" style={{ marginTop: 30 }}>
          {tituloSeccion('int-sin-conectar', 'Sin conectar', sinConectarVis.length)}
          {grilla(catalogo)}
          {ocultas > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <button type="button" className="int-mas" onClick={() => setVerTodas(true)}>Mostrar más integraciones</button>
            </div>
          )}
        </section>
      )}

      {filtrando && !conectadasVis.length && !sinConectarVis.length && (
        <p style={{ margin: '28px 0 0', fontSize: 14, color: 'var(--dim)' }}>
          {texto ? `Ninguna integración con «${q.trim()}».` : 'Ninguna integración con estos filtros.'}{' '}
          <button type="button" className="int-enlace" onClick={limpiar}>Ver todas</button>
        </p>
      )}

      {/* ═══ COSTO DE MAKO ═══ */}
      <CostoMaKo usage={usage} cuotas={cuotas} abrir={abrirCosto} onVerOps={() => setModal({ t: 'hist' })} onOpenService={(key) => setModal({ t: 'svc', key })} />

      {/* ═══ HISTORIAL DE PROBLEMAS ═══ */}
      <ProblemasHistorial incidentes={incidentes} nombreDe={(s) => svcByKey(s)?.nombre ?? s} />

      {/* ═══ MODALES ═══ */}
      {modalSuelto}
      {modal?.t === 'svc' && svcByKey(modal.key) && (
        <ServicioModal
          i={svcByKey(modal.key)!}
          sev={sevOf(svcByKey(modal.key)!)}
          // El chip repite la palabra del estado. Con permiso incompleto, "Por
          // configurar" (lo que diría el ámbar por defecto) manda al usuario a
          // buscar una credencial que no existe: acá lo que falta es un permiso.
          chipWord={svcByKey(modal.key)?.sinConexion ? svcByKey(modal.key)!.sinConexion!.chip
            : modal.key === 'google' && gcalIncompleta ? 'Falta permiso'
            : modal.key === 'landing' && landingVieja ? ROTULO_PIXEL_VIEJO
            : modal.key === 'calendly' && faltaAvisoCalendly ? faltaAvisoCalendly.chip
            : undefined}
          gcal={gcal}
          health={health} metaError={metaError} usage={usage}
          cuota={cuotas.find((c) => c.provider === modal.key) ?? null}
          snippetLanding={snippetLanding}
          cargadorLanding={cargadorLanding}
          pixel={pixel}
          agenteActual={agenteActual ?? null}
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
    </Raiz>
  );
}

// ── Costo de MaKo ─────────────────────────────────────────────────────────────
function CostoMaKo({ usage, cuotas, abrir = 0, onVerOps, onOpenService }: { usage: Resumen | null; cuotas: CuotaProv[]; abrir?: number; onVerOps: () => void; onOpenService: (key: string) => void }) {
  // PLEGADO (24/10/2026): no es el catálogo. A la vista, el gasto del mes; se abre al tocarlo, con el link del chip «Saldo
  // de IA» (#saldo-ia) o con ?ops=1 (`abrir` sube).
  const plegable = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mirar = () => {
      if (window.location.hash !== '#saldo-ia' || !plegable.current) return;
      plegable.current.open = true;
      plegable.current.scrollIntoView({ block: 'start' });
    };
    mirar();
    window.addEventListener('hashchange', mirar);
    return () => window.removeEventListener('hashchange', mirar);
  }, []);
  useEffect(() => { if (abrir > 0 && plegable.current) plegable.current.open = true; }, [abrir]);
  // Un tile por proveedor que consumió algo + uno por cada IA gratis que el negocio CARGÓ aunque todavía no la haya
  // usado (item "cargalos como otro contenedor"). Una que no cargó ya no tiene caja (IA16, 23/10/2026): la plataforma
  // no presta IA, y una caja «gratis» sin su clave se leía como que MaKo se la da (`soloCargadas`, page.tsx).
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
    <details ref={plegable} id="saldo-ia" className="int-plegable" style={{ ...card, marginTop: 34, scrollMarginTop: 20 }}>
      {/* Adentro del <summary>, sólo texto en línea y la grilla en un <span> (WebKit ≤ 16 no deja que un <summary> sea grilla). */}
      <summary>
        <span className="int-plegable__caja">
          <MakoStar size={16} color="var(--accent)" />
          <span className="int-plegable__titulo">Costo de MaKo</span>
          <span className="int-plegable__dato">{usage ? `${usd(usage.gastadoMesUsd ?? 0)} este mes` : '···'}</span>
          <span className="int-flecha" aria-hidden />
        </span>
      </summary>
      <div style={{ padding: '2px 30px 26px' }}>
      {meses.length > 0 && (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
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
      )}

      {/* El período elegido NO mueve los tiles de abajo, y decirlo es parte del
          dato: un saldo restante de hoy al lado de un gasto de junio, sin
          aclaración, se lee como si fueran la misma ventana. */}
      {filtrado && per && (
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: -8, marginBottom: 18 }}>
          {per.llamadas.toLocaleString('es-MX')} llamadas · {fmtTok(per.tokens)} tokens, leídas {per.filas.toLocaleString('es-MX')} filas sin truncar.
          {/* Lo pagado con la clave de Claude de un negocio (lib/veto-claude.ts) está en las llamadas
              y NO en el total: esa plata es suya. Se nombra para que el total no parezca incompleto. */}
          {per.delNegocio && per.delNegocio.llamadas > 0 && (
            <> {per.delNegocio.llamadas.toLocaleString('es-MX')} las pagó un negocio con su clave de Claude ({usd(per.delNegocio.costUsd)}): no son gasto de MaKo.</>
          )}
          {per.delCredito && per.delCredito.llamadas > 0 && (
            <> {per.delCredito.llamadas.toLocaleString('es-MX')} salieron del crédito de los planes Max ({usd(per.delCredito.costUsd)}), que ya está pago.</>
          )}
          {' '}<strong style={{ color: 'var(--ink)' }}>Los tiles de saldo y cuota de aquí abajo son de hoy</strong>, no del período: el saldo es un estado, no un acumulado.
        </div>
      )}

      {/* Tiles por proveedor — arriba las de pago, abajo las gratis (dos filas
          separadas para que no queden todos juntos y OpenRouter suelto). */}
      <div style={{ ...capMono, fontSize: 9.5, letterSpacing: '.11em', color: 'var(--faint)', marginBottom: 9 }}>Consumen dinero</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 11, marginBottom: 18 }}>
        {provsPago.map(renderTile)}
      </div>
      {/* «Sin costo», no «Gratis · rotan sin costo» (22/10/2026: nada de «gratis», y Groq ya no rota: sólo pasa a texto las notas de voz). */}
      <div style={{ ...capMono, fontSize: 9.5, letterSpacing: '.11em', color: 'var(--faint)', marginBottom: 9 }}>Sin costo</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 11, marginBottom: 26 }}>
        {provsGratis.map(renderTile)}
      </div>

      {/* Por proceso — dos gráficas: DINERO (izq) y TOKENS (der). El dinero solo lo
          mueven Claude/OpenAI; los tokens los mueven TODAS (útil para ver qué proceso
          consume aunque sea en una IA gratis). En pantallas angostas se apilan. */}
      {feats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: 26, marginBottom: 4 }}>
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
      </div>
    </details>
  );
}

// ── Historial de problemas (incidentes con inicio → fin) ──────────────────────
function ProblemasHistorial({ incidentes: leidos, nombreDe }: { incidentes: Incidente[] | null; nombreDe: (service: string) => string }) {
  // «No pude leer» NO es «Todo en orden» (17/10/2026): con la lectura caída, se dice eso y no se cuenta ningún activo.
  const incidentes = leidos ?? [];
  const activos = incidentes.filter((x) => x.resolvedAt === null).length;
  // PLEGADO (24/10/2026), como «Costo de MaKo»: a la vista, cuántos están en curso (o que no se pudo leer).
  return (
    <details className="int-plegable" style={{ ...card, marginTop: 14 }}>
      <summary>
        <span className="int-plegable__caja">
          <span className="int-plegable__titulo">Historial de problemas</span>
          <span className="int-plegable__dato" style={leidos === null || activos ? { color: 'var(--warn)' } : undefined}>
            {leidos === null ? 'No pude leerlo' : `${activos} ${activos === 1 ? 'activo' : 'activos'}`}
          </span>
          <span className="int-flecha" aria-hidden />
        </span>
      </summary>
      <div style={{ padding: '0 30px 12px' }}>
      {leidos === null ? (
        <div style={{ color: 'var(--warn)', fontSize: 13.5, padding: '14px 0' }}>No pude leer el historial de problemas. Recarga en un rato.</div>
      ) : incidentes.length === 0 ? (
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
      </div>
    </details>
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
// ⚠️ DESDE EL 09/10/2026 LO QUE SE PEGA ES LA LÍNEA DEL CARGADOR (lib/pixel-cargador.ts),
// no las ~2.226 líneas del código: sirve siempre el Pixel del día, así que nadie vuelve a
// pegar nada cuando sale una versión. El código entero queda como alternativa («Código
// completo») para quien no puede cargar un script externo.
const DONDE_PEGAR: PasoPegar[] = [
  { paso: 'Copia la línea de aquí arriba. Con ella, cada mejora del Pixel te llega sola.' },
  {
    // ⚠️ «EN LUGAR DEL CÓDIGO VIEJO»: quien ya tenía el código pegado y suma la línea sin
    // sacarlo deja DOS Pixeles corriendo (el snippet no se protege de correr dos veces), y
    // cada visita se cuenta doble. Si la copia vieja es de la 22, ningún aviso lo dice: para
    // `versionEnHtml` eso es «al día» (gana la más vieja, y la 22 no es vieja).
    paso: 'Abre tu página y pégala justo antes de </body>, en todas las páginas que quieras medir. Si ya tenías el código del Pixel, bórralo.',
    plataformas: [
      ['Lovable, Claude Code, o cualquier editor web por prompt', 'pídele "pega este script antes del </body>".'],
      ['Framer', 'Settings → Custom Code → End of <body>.'],
      ['Webflow', 'Project Settings → Custom Code → Footer Code.'],
      ['WordPress', 'un plugin de "insert headers and footers" (footer).'],
      ['HTML plano', 'antes del </body>.'],
      // ⚠️ El caso de los clientes de Código Inmobiliario (08/10/2026): su editor con IA
      // les TAPA partes del código con ******** y lo rechaza, o lo tienen en un .js
      // propio. El archivo se pone en la carpeta sin pasar por el chat (lib/pixel-archivo.ts).
      // Con la línea del cargador ese caso casi no aparece (no hay nada que tapar), y el
      // camino sigue para quien no puede cargar un script de otro dominio.
      [`Si tu editor tapa algo con ******** o no acepta un script externo`, `abre «Código completo» y descárgalo: guárdalo en public/ y, antes del </body>, carga <script src="/${ARCHIVO_PIXEL}"></script>.`],
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
type DatosPixel = {
  landings: LandingConfig[] | null;
  productos: ProductoAsignable[] | null;
  /** Visitas a una página de gracias que no movieron a nadie (lib/landing-gracias.ts). */
  gracias?: RechazoGracias[] | null;
};


function CodigoLanding({ snippet, cargador, pixel, elegida, onElegir }: {
  snippet: string | null;
  /** La línea del cargador (`<script src=".../m.js?id=…" defer>`). Es lo PRIMERO que se
   *  ofrece; `snippet` queda como alternativa. null = el server no la armó. */
  cargador?: string | null;
  pixel?: DatosPixel;
  /** La landing elegida vive en el MODAL, no acá: el paso 4 se renderiza fuera
   *  de este componente y necesita la misma respuesta. */
  elegida: string | null; onElegir: (u: string | null) => void;
}) {
  const routerLanding = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [lineaCopiada, setLineaCopiada] = useState(false);
  // El código entero es la ALTERNATIVA: plegado hasta que alguien lo pide. Sin línea del
  // cargador (no debería pasar) se muestra de entrada, porque es lo único que hay.
  const [completoAbierto, setCompletoAbierto] = useState(!cargador);
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
  // ⚠️ EL CÓDIGO ES UNO SOLO PARA TODAS LAS PÁGINAS. Hasta el 06/10/2026 se pedía
  // uno por página porque cada una podía llevar su propio proyecto de Clarity
  // adentro; sin Clarity, es el que resuelve el server y no hay nada que pedir.
  const codigo = snippet;
  const tokens = useMemo(() => (codigo ? resaltar(codigo) : []), [codigo]);
  const tokensLinea = useMemo(() => (cargador ? resaltar(cargador) : []), [cargador]);

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
            ? { ok: false, text: 'Llegan eventos, pero el código instalado es de una versión anterior. Pon la línea de arriba en lugar del código viejo.' }
            : { ok: true, text: `Recibiendo eventos${j.ultima ? ` (última hace ${fmtDuracion(j.ultima, new Date().toISOString())})` : ''}.` }
          : { ok: false, text: 'Aún no llega ningún evento. Instala el Pixel de MaKo en tu página y recárgala.' });
      } else {
        setEstado({ ok: false, text: j?.error === 'solo admin' ? 'Necesitas ser admin para verificar esta integración.' : (j?.error ?? 'No se pudo verificar.') });
      }
    } catch { setEstado({ ok: false, text: 'No se pudo verificar. Revisa tu conexión y prueba de nuevo.' }); }
    finally { setVerificando(false); }
  };

  // El mismo código como ARCHIVO, para quien no lo puede pegar: su editor con IA lo
  // tapa con ********, o lo tiene en un .js propio (lib/pixel-archivo.ts). `null`
  // si el snippet no tiene la forma esperada, y entonces el botón no se dibuja.
  const archivo = useMemo(() => (codigo ? pixelComoArchivo(codigo) : null), [codigo]);
  const descargar = () => {
    if (!archivo) return;
    const url = URL.createObjectURL(new Blob([archivo], { type: 'text/javascript' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = ARCHIVO_PIXEL;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copiarLinea = async () => {
    if (!cargador) return;
    try {
      await navigator.clipboard.writeText(cargador);
      setErrorCopia(false);
      setLineaCopiada(true);
      setTimeout(() => setLineaCopiada(false), 1800);
    } catch {
      setErrorCopia(true);
    }
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

      {/* ⚠️ ACÁ ESTABA EL INTERRUPTOR «Grabar las visitas», y se fue el 06/10/2026 por
          pedido textual: «elimina lo de "Grabar las visitas" eso por default debe estar
          siempre activado». La grabación ya no tiene apagador (lib/replay-contrato.ts). */}

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
      <Paso n={2} titulo="¿A qué funnel entran sus leads?">
        <AsignarProducto elegida={elegida} productos={pixel?.productos ?? null}
          landings={landings} onLandings={setLandings} rechazos={pixel?.gracias ?? []} />
      </Paso>

      <Paso n={3} titulo={cargador ? 'Copia esta línea y pégala en tu página' : 'Copia el código y pégalo en tu página'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ⚠️ LO PRIMERO ES LA LÍNEA DEL CARGADOR (09/10/2026, decisión de Martín). Una línea
          que sirve el Pixel del día desde el server: nadie pega 2.226 líneas, nadie vuelve a
          pegar nada cuando sale una versión, y no hay nada que un editor con IA pueda tapar
          con ********. Es la MISMA barra oscura que el código, sin el plegado: una línea
          entra entera. El código completo queda abajo, como alternativa. */}
      {cargador && (
        <div className="mk-key-row mk-key-row--code">
          <div className="mk-key-codewrap">
            {/* Entera, envolviendo: es una sola línea y se tiene que poder leer (el «…» del
                plegado escondería justo el token). */}
            <pre className="mk-key-code" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 'none', padding: '9px 0' }}>
              <code style={{ fontFamily: MONO }}>
                {tokensLinea.map((tk, n) => <span key={n} style={{ color: tk.c }}>{tk.t}</span>)}
              </code>
            </pre>
          </div>
          <IconBtn name={lineaCopiada ? 'check' : 'copy'} title={lineaCopiada ? '¡Copiado!' : 'Copiar la línea'} tone={lineaCopiada ? 'good' : 'dim'} onClick={copiarLinea} />
          <IconBtn name="help" title={abierto ? 'Ocultar la ayuda' : '¿Dónde la pego?'} tone={abierto ? 'primary' : 'dim'} onClick={() => setAbierto((o) => !o)} />
        </div>
      )}

      {/* La alternativa, para quien no puede cargar un script de otro dominio (o tiene el
          Pixel en un .js propio). Un rótulo y no un párrafo: el porqué está acá. */}
      {cargador && (
        <button type="button" onClick={() => setCompletoAbierto((o) => !o)} aria-expanded={completoAbierto}
          title="Para quien no puede cargar un script externo"
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, border: 0, background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>
          <span aria-hidden style={{ display: 'inline-block', transition: 'transform .15s ease', transform: completoAbierto ? 'rotate(90deg)' : 'none' }}>›</span>
          Código completo
        </button>
      )}

      {completoAbierto && (
      <>
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
        {archivo && <IconBtn name="descargar" title={`Descargar como ${ARCHIVO_PIXEL}`} tone="dim" onClick={descargar} />}
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
        {!cargador && <IconBtn name="help" title={abierto ? 'Ocultar la ayuda' : '¿Dónde lo pego?'} tone={abierto ? 'primary' : 'dim'} onClick={() => setAbierto((o) => !o)} />}
      </div>
      </>
      )}
      {errorCopia && <span style={{ fontSize: 12.5, color: 'var(--warn)', fontWeight: 500 }}>No pudimos copiarlo solos: selecciónalo y cópialo a mano.</span>}
      </div>

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
  // ⚠️ Un rechazo se DICE (auditoría de seguridad, 14/10/2026): la ruta pasó a contestar 403 a quien no es
  // admin y al saldo de Claude de un cliente, y sin esto el botón no hacía nada.
  const [fallo, setFallo] = useState<string | null>(null);
  const guardar = async () => {
    const v = Number(input);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    setFallo(null);
    try {
      // SINCRONIZA: pone el saldo ACTUAL (lo que ves en la consola). Reemplaza y resetea
      // el baseline → el restante = ese número y baja con el gasto nuevo.
      const res = await fetch('/api/anthropic-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saldoUsd: v, provider }) });
      const j = await res.json().catch(() => null);
      if (j?.ok) { setEditing(false); setInput(''); onGuardado(); }
      else setFallo(res.status === 403 ? 'Sólo lo cambia un admin' : 'No se guardó');
    } catch {
      setFallo('No se guardó');
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
          <button onClick={() => { setEditing(false); setInput(''); setFallo(null); }} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
        </div>
      ) : (
        <button onClick={() => { setEditing(true); setInput(''); setFallo(null); }} style={{ border: '1px solid var(--primary)', borderRadius: 9, background: 'var(--surface)', color: 'var(--primary)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer' }}>{saldo ? 'Actualizar saldo' : (gemini ? 'Registrar créditos' : 'Pon tu saldo')}</button>
      )}
      {fallo && <div role="alert" style={{ marginTop: 7, fontSize: 12, color: 'var(--bad)' }}>{fallo}<ReportarASoporte /></div>}
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

// ⚠️ EXPORTADO (decimotercera tanda, punto 5: «No crees un nuevo modal de conectar la API, reutiliza exactamente el mismo
// que ya tenemos en integraciones»): Automations lo abre para Zernio sin cambiar de pestaña (`ServicioSuelto`,
// ./ServicioSuelto.tsx, cargado a demanda). Un segundo modal para lo mismo es el que deja de decir lo mismo.
export function ServicioModal({ i, sev, chipWord, gcal, health, metaError, usage, cuota, snippetLanding, cargadorLanding, pixel, agenteActual, appUrl, aviso, onClose, onCambio, onRefetchUsage }: {
  i: Integracion; sev: 'good' | 'warn' | 'bad';
  /** Cómo salió el último intento por OAuth, cuando el modal se abre en otra tab (`ServicioSuelto`): ahí no está el
   *  cartel de arriba de /integraciones, así que lo dice el modal. */
  aviso?: { kind: 'ok' | 'err'; txt: string } | null;
  /** Reemplaza la palabra del chip cuando el estado tiene un nombre propio ("Falta permiso"). */
  chipWord?: string;
  /** Permiso real de la agenda de Google (lo pide el board una vez, ver arriba). */
  gcal: GoogleCalendarStatus | null;
  health: MetaHealth | null; metaError: string | null; usage: Resumen | null; cuota: CuotaProv | null; snippetLanding?: string | null; cargadorLanding?: string | null; pixel?: DatosPixel; agenteActual?: TokenAgenteVisible | null; appUrl?: string; onClose: () => void; onCambio: () => void; onRefetchUsage: () => void;
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

  // Estado EN VIVO (no descripción): Meta, y la IA cuya key guardada es la de MaKo (el campo se ve lleno y no es suya:
  // tickets #5 y #6, lib/ia-keys.ts → `veredictoDeIA`).
  let alerta: string | null = i.detalle === POR_QUE_IA_DE_MAKO || i.detalle === POR_QUE_LA_CONFIGURA_MAKO ? i.detalle : i.sinConexion?.texto ?? null;
  // La del workspace del entorno no se pega (`soloServidor`, sin formulario) y tampoco lleva la lista de lo que falta.
  const delEquipo = i.detalle === POR_QUE_LA_CONFIGURA_MAKO;
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
    alerta = metaError === FALTAN_PERMISOS_META ? AVISO_FALTAN_PERMISOS_META
      : metaError ? `No se pudo leer el estado de Meta: ${metaError}` : null;
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
    //
    // ⚠️ Y LLEVA LA PANTALLA A LA QUE VOLVER (14/10/2026, igual que «Conectar con Meta» en ServicioConfigForm): este
    // modal se abre en cualquier tab (`ServicioSuelto`), y el callback volvía siempre a /integraciones — conectar desde
    // el Calendario te sacaba del Calendario. Martín: «para una integración jamás se debe salir de la tab».
    const completa = !!gcal?.conectado && gcal.puedeMover;
    actions.push({
      label: completa ? 'Reconectar Google Calendar' : 'Conectar Google Calendar', primary: true,
      onClick: () => {
        const volver = volverDeLaPestana(window.location.pathname, window.location.search);
        window.location.href = conWs(`/api/integraciones/google-calendar?volver=${encodeURIComponent(volver)}`, wsPestana);
      },
    });
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
          {aviso && (
            <div role="status" style={{ marginBottom: 15, padding: '11px 13px', borderRadius: 11, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, background: aviso.kind === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: aviso.kind === 'ok' ? 'var(--good)' : 'var(--bad)' }}>
              {aviso.txt}
            </div>
          )}
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
            <TutorialAgente actual={agenteActual ?? null} appUrl={appUrl ?? ''} />
          ) : esLanding ? (
            <>
              <CodigoLanding snippet={snippetLanding ?? null} cargador={cargadorLanding ?? null} pixel={pixel}
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
          ) : i.estado === 'falta' && i.key !== 'google' && !delEquipo && !i.sinConexion && (
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
        {/* 25/10/2026 (revisión del tren): no se inventa la causa. Pasa al conectar con la casilla de editar eventos sin
            tildar, o con una agenda que se autorizó cuando sólo pedíamos leerla. */}
        Google autorizó la agenda{estado.email ? ` de ${estado.email}` : ''} sin el permiso para editar eventos: tus reuniones se detectan, pero
        «Reagendar» actualiza el CRM y no mueve el evento ni le avisa al invitado. Por eso figura como <b>no conectada</b>.
        Toca «Conectar Google Calendar» aquí abajo y, en la pantalla de Google, deja marcada la casilla para ver y editar tus eventos.
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
