'use client';

// =============================================================================
// NuevaCampanaModal — crear una campaña con MaKo, en UN solo pop-up minimalista
// =============================================================================
// Wizard de una pregunta por pantalla (sin formularios densos): creativos →
// inversión (SIEMPRE en USD) → objetivo → estrategia (MaKo mira los creativos con
// OpenAI) → público/destino → MaKo arma → revisión → publicar. Las RESPUESTAS son
// la fuente de verdad; el CampaignSpec se deriva de ellas (MaKo solo escribe el
// copy), así nada se pierde. Se crea en Meta SIEMPRE en PAUSA. El borrador se
// conserva al cerrar.
//
// modo="existente" (botón "Subir creativos a una campaña"): mismo wizard pero los
// anuncios van a una campaña que YA corre — campaña → conjunto → creativos →
// destino → MaKo escribe el copy → revisión → se agregan en PAUSA vía el lote de
// /api/ads-manager/ad-add. La campaña NO se toca (mismo id, público, presupuesto):
// solo se le cuelgan anuncios nuevos al conjunto elegido.
// =============================================================================

import { useEffect, useId, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import type { SenalRecon } from '@/lib/queries';
import { campanasAsignadasAction, asignarCampanaAction, type ProductoNombre } from '../crm/campanas-actions';
import { valorDeProducto, funnelDeValor } from '@/lib/campana-asignar';
import { ganadoresParaReusar } from '@/lib/ganadores-reuso';
import { useGanadoresBloqueados } from './useGanadoresBloqueados';
import { colorDeSemaforo, linkAprobarEnMeta, type MetaHealth, type NodoEstado } from '@/lib/meta-health-ui';
import { TutorialAprobacionMeta } from './TutorialAprobacionMeta';
import { LugarPicker } from './LugarPicker';
import { CrearFormulario } from './CrearFormulario';
import { geoSpecDe, lugarPais, lugaresDesdeDraft, resumenLugares, type LugarMeta } from '@/lib/meta-geo';
import { avisoAgendaSinMedir } from '@/lib/meta-conversiones';
import { instagramsPara, paginasUsables, type Identidad, type InstagramOpcion, type PaginaOpcion } from '@/lib/meta-identidad';
import {
  type CampaignSpec, type AdSpec, type Creative, type Targeting, type Objective, type AudienceRef,
  objetivoDef, CTA_OPCIONES,
} from '@/lib/campaign-types';
import { usdACuenta, esConvertible, MONEDA_META_POR_DEFECTO } from '@/lib/presupuesto-cambio';
import {
  subirCreativo, makeThumb, limiteCreativo, esperarVideoListo, motivoFinEspera, postConTope, esperandoAMeta,
  SIN_RESPUESTA, AVISO_PROCESANDO_RETOMA, AVISO_PROCESANDO_NO_CIERRES, CADA_MS_SIN_LECTURA,
  ANTERIOR_PUBLICADA, ANTERIOR_A_MEDIAS, claveAbierta, anotarClaveAbierta, usarCreativoMako, makeThumbDeUrl,
} from './creativeUpload';
import { MisCreativosMako } from './MisCreativosMako';
import { Icon } from '../_components/icons';
import type { CreativoMako } from '@/lib/creativo-mako';
import { claveAMandar, trasRespuesta, claveIdemGuardada, type ClaveIdem } from '@/lib/meta-idempotencia';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
// Chispa de MaKo (misma que MakoBrand) para el loader animado de "armando"/"publicando".
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

// Inversión en USD; Meta cobra en la MONEDA DE LA CUENTA → hay que convertir.
//
// ⚠️ Esto convertía SIEMPRE a pesos mexicanos, sobre cualquier cuenta. Y el campo
// que viaja (`daily_budget_mxn`) termina en `mxnACentavos` → centavos de la moneda
// de la cuenta, sea cual sea. Sobre una cuenta en USD, "$1/día" salía como 1700
// centavos = US$17/día: 17 veces el presupuesto que el usuario tipeó, en pausa
// pero listo para gastarse al activarla. Medido sobre act_1357728489423123
// (Código Inmobiliario), que cobra en USD.
//
// Solo hay UNA tasa en el código (config.ts) y es la del peso mexicano. Para
// cualquier otra moneda no hay con qué convertir, así que NO se convierte: el
// monto se pide directo en esa moneda y la pantalla lo dice. Inventar una tasa
// sería el mismo bug con otro número.
//
// La tabla de tasas y `usdACuenta` viven en lib/presupuesto-cambio.ts desde el
// 07/10/2026: eran tres copias (este modal, AgregarConjuntoModal y —sin copia, con el
// ×17,30 escrito a mano— la celda de la tabla del Ads Manager).

// ── estilos ──
const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14.5, cursor: 'pointer' };
const pregunta: CSSProperties = { fontSize: 25, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 };
const ayuda: CSSProperties = { fontSize: 14.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5, margin: '10px 0 0', maxWidth: 440 };

type Step = 'campana' | 'conjunto' | 'identidad' | 'creativos' | 'inversion' | 'objetivo' | 'lugar' | 'estrategia' | 'publico' | 'ubicaciones' | 'destino' | 'armando' | 'revision' | 'publicando' | 'listo';
type Estrategia = 'retargeting' | 'frio' | 'intereses';
type AudTipo = 'page' | 'ig' | 'video' | 'pixel';
type AudienceItem = AudienceRef & { count?: number | null };
type Destino = { lead_form_id?: string | null; lead_form_name?: string | null; url?: string; conv?: { pixel_event?: string; custom_conversion_id?: string; label?: string; pixel_id?: string } };
type Analisis = Array<{ descripcion: string; angulo: string }>;
type Uso = { tokens: number; costUsd: number } | null;
// Una conversión personalizada con lo que Meta dice de ella: QUÉ cuenta (su regla, en
// castellano) y si se DISPARÓ en los últimos 30 días. `estado` null = no se pudo leer.
type ConvItem = { id: string; name: string; event?: string; pixel_id?: string; regla?: string | null; ultimaVez?: string | null; estado?: 'activa' | 'inactiva' | 'nunca' | null };

type TrayItem = {
  id: string; kind: 'upload' | 'existing'; media_type?: 'image' | 'video';
  image_hash?: string | null; video_id?: string | null; thumbnail_url?: string | null;
  source_ad_id?: string | null; label: string; processing?: boolean; progress?: number;
  /** Mientras Meta procesa el video: el archivo en el staging, para que el server lo
   *  borre cuando Meta dé su veredicto (GET /api/ads-manager/creative-upload). */
  staging_path?: string | null;
  /** Si es un video que MaKo ya generó (#797): su `ref`, para no elegirlo dos veces. */
  mako_ref?: string | null;
};

const fmtUso = (u: Uso) => (!u ? '' : `✦ ${u.tokens >= 1000 ? `${(u.tokens / 1000).toFixed(1)}k` : u.tokens} tok · $${u.costUsd >= 1 ? u.costUsd.toFixed(2) : u.costUsd.toFixed(3)}`);

// La subida (putWithProgress, makeThumb y el POST a creative-upload) vive en
// ./creativeUpload.ts. Hasta el 07/10/2026 este modal tenía su propia copia, idéntica
// salvo un comentario, y las dos escribían `processing: false` sin mirar a Meta (#59).

// ── Borrador local ──
const DRAFT_KEY = 'mako.nuevaCampana.draft.v2';
type Draft = { step: Step; tray: TrayItem[]; budgetUsd: number | null; objKey: ObjKey | null; lugares: LugarMeta[]; identidad: Identidad | null; estrategia: Estrategia | null; audiencias: AudienceRef[]; placements: string[] | null; destino: Destino; analisis: Analisis; spec: CampaignSpec | null; uso: Uso; idem: ClaveIdem | null };
const draftVacio = (): Draft => ({ step: 'creativos', tray: [], budgetUsd: null, objKey: null, lugares: [], identidad: null, estrategia: null, audiencias: [], placements: null, destino: {}, analisis: [], spec: null, uso: null, idem: null });
function loadDraft(): Draft {
  const vacio = draftVacio();
  if (typeof window === 'undefined') return vacio;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return vacio;
    const d = JSON.parse(raw) as Partial<Draft>;
    const step = d.spec ? 'revision' : (d.step && d.step !== 'armando' && d.step !== 'publicando' && d.step !== 'listo' ? d.step : 'creativos');
    // `paises: ['AR']` es el borrador de antes de que se pudiera elegir cualquier
    // lugar: se convierte en vez de tirarlo, así nadie pierde lo que ya eligió.
    const lugares = lugaresDesdeDraft((d as { lugares?: unknown }).lugares ?? (d as { paises?: unknown }).paises);
    // Un ítem que quedó «procesando» al cerrar: si ya tiene su video en Meta, la espera se
    // retoma al abrir (con la tarjeta en 100, no en «0%»); si se cortó antes —sin video_id—
    // no hay nada que retomar y se descarta. Antes volvía tal cual y la tarjeta quedaba
    // trabada en «N%» con el paso de creativos apagado hasta que alguien la quitara.
    const tray = (Array.isArray(d.tray) ? d.tray : [])
      .filter((t) => !t.processing || !!t.video_id)
      .map((t) => (t.processing ? { ...t, progress: 100 } : t));
    // Un borrador de antes de la clave no la trae: se genera al publicar.
    return { ...vacio, ...d, lugares, step, tray, idem: claveIdemGuardada((d as { idem?: unknown }).idem) };
  } catch { return vacio; }
}

const ESTRATEGIAS: Array<{ value: Estrategia; icon: string; label: string; desc: string }> = [
  { value: 'retargeting', icon: '🔁', label: 'Reenganchar (retargeting)', desc: 'Mostrárselo a gente que YA te vio o interactuó.' },
  { value: 'frio', icon: '❄️', label: 'Llegar a gente nueva', desc: 'Público amplio; Meta optimiza (Advantage+).' },
  { value: 'intereses', icon: '🎯', label: 'Por intereses', desc: 'MaKo elige intereses afines a tu avatar.' },
];
type ObjKey = 'lead_form' | 'lead_web' | 'traffic' | 'sales' | 'awareness';
const OBJ_KEYS: Record<ObjKey, { objective: Objective; optimization: string; needsForm: boolean; needsConv: boolean }> = {
  lead_form: { objective: 'OUTCOME_LEADS', optimization: 'LEAD_GENERATION', needsForm: true, needsConv: false },
  lead_web: { objective: 'OUTCOME_LEADS', optimization: 'OFFSITE_CONVERSIONS', needsForm: false, needsConv: true },
  traffic: { objective: 'OUTCOME_TRAFFIC', optimization: 'LANDING_PAGE_VIEWS', needsForm: false, needsConv: false },
  sales: { objective: 'OUTCOME_SALES', optimization: 'OFFSITE_CONVERSIONS', needsForm: false, needsConv: true },
  awareness: { objective: 'OUTCOME_AWARENESS', optimization: 'REACH', needsForm: false, needsConv: false },
};
const OBJETIVO_UI: Array<{ value: ObjKey; icon: string; label: string; desc: string }> = [
  { value: 'lead_form', icon: '🧲', label: 'Leads con formulario de Facebook', desc: 'Clientes potenciales con el formulario instantáneo DENTRO de Facebook/Instagram.' },
  { value: 'lead_web', icon: '📅', label: 'Leads / agendas en tu web', desc: 'Optimiza por una conversión en tu landing (agenda, registro, lead) con el pixel. Sin formulario de Facebook.' },
  { value: 'traffic', icon: '▶️', label: 'Tráfico a tu VSL / landing', desc: 'Llevar gente a tu página, sin optimizar por conversión.' },
  { value: 'sales', icon: '🛒', label: 'Ventas / compras', desc: 'Optimiza por compras medidas con el pixel.' },
  { value: 'awareness', icon: '📣', label: 'Reconocimiento / alcance', desc: 'Máximo alcance al menor costo.' },
];
// Conversiones estándar para "leads/agendas en tu web" + ventas.
// OJO: el valor es el ENUM de Meta (custom_event_type), no el nombre del evento.
// Redacción en OBJETIVO ("Que agenden"), NO en pasado: acá elegimos qué queremos
// que la gente HAGA, no un público de quienes ya lo hicieron (eso es EVENTOS_PIXEL).
const EVENTOS_CONV: Array<{ value: string; label: string }> = [
  { value: 'LEAD', label: 'Que dejen sus datos (Lead)' },
  { value: 'SCHEDULE', label: 'Que agenden (Schedule)' },
  { value: 'COMPLETE_REGISTRATION', label: 'Que se registren' },
  { value: 'CONTENT_VIEW', label: 'Que vean el contenido / VSL' },
  { value: 'CONTACT', label: 'Que te contacten' },
  { value: 'PURCHASE', label: 'Que compren' },
];
// Nombre del evento del pixel (como lo reporta Meta en /stats) → ENUM de optimización
// (custom_event_type) + etiqueta amigable (en objetivo, "Que…"). Solo mapeamos los
// estándar de conversión.
const STD_EVENTS: Record<string, { enum: string; label: string }> = {
  Lead: { enum: 'LEAD', label: 'Que dejen sus datos (Lead)' },
  Schedule: { enum: 'SCHEDULE', label: 'Que agenden (Schedule)' },
  CompleteRegistration: { enum: 'COMPLETE_REGISTRATION', label: 'Que se registren' },
  ViewContent: { enum: 'CONTENT_VIEW', label: 'Que vean el contenido / VSL' },
  Contact: { enum: 'CONTACT', label: 'Que te contacten' },
  Purchase: { enum: 'PURCHASE', label: 'Que compren' },
  Search: { enum: 'SEARCH', label: 'Que busquen' },
  AddToCart: { enum: 'ADD_TO_CART', label: 'Que agreguen al carrito' },
  InitiateCheckout: { enum: 'INITIATED_CHECKOUT', label: 'Que inicien el checkout' },
  AddPaymentInfo: { enum: 'ADD_PAYMENT_INFO', label: 'Que carguen datos de pago' },
  Subscribe: { enum: 'SUBSCRIBE', label: 'Que se suscriban' },
  StartTrial: { enum: 'START_TRIAL', label: 'Que inicien una prueba' },
  SubmitApplication: { enum: 'SUBMIT_APPLICATION', label: 'Que envíen una solicitud' },
  AddToWishlist: { enum: 'ADD_TO_WISHLIST', label: 'Que agreguen a deseos' },
};

export function NuevaCampanaModal({ senales, campaignCount, health = null, healthError = null, modo = 'nueva', onClose, onPublished }: { senales: SenalRecon[]; campaignCount: number; health?: MetaHealth | null; healthError?: string | null; modo?: 'nueva' | 'existente'; onClose: () => void; onPublished: () => void }) {
  // modo 'existente' arranca SIEMPRE limpio (sin borrador): elegir campaña/conjunto
  // es corto y mezclarlo con el borrador de "Nueva campaña" confundiría.
  const existente = modo === 'existente';
  const [d0] = useState<Draft>(() => (modo === 'existente' ? { ...draftVacio(), step: 'campana' } : loadDraft()));
  const [step, setStep] = useState<Step>(d0.step);
  const [campSel, setCampSel] = useState<NodoEstado | null>(null);
  const [adsetSel, setAdsetSel] = useState<NodoEstado | null>(null);
  // Del conjunto elegido: si pide formulario o URL (GET /api/ads-manager/ad-add).
  const [adsetInfo, setAdsetInfo] = useState<{ needsForm: boolean; optimization_goal: string } | null>(null);
  const [tray, setTray] = useState<TrayItem[]>(d0.tray);
  const [budgetUsd, setBudgetUsd] = useState<number | null>(d0.budgetUsd);
  const [objKey, setObjKey] = useState<ObjKey | null>(d0.objKey);
  // Segmentación geográfica: los lugares que Meta acepta (lib/meta-geo.ts). Vacío =
  // todavía no se eligió — NUNCA "México por defecto", que era el bug. Se precarga
  // el país de la cuenta y el paso 'lugar' deja buscar provincia, ciudad, barrio,
  // código postal o dirección, incluir o excluir.
  const [lugares, setLugares] = useState<LugarMeta[]>(d0.lugares);
  // Lo que Meta contestó al validar esos lugares: false = los rechaza (no avanza).
  const [lugarOk, setLugarOk] = useState<boolean | null>(null);
  const [cuenta, setCuenta] = useState<{ currency: string; country: string | null; name: string } | null>(null);
  const [estrategia, setEstrategia] = useState<Estrategia | null>(d0.estrategia);
  const obj = objKey ? OBJ_KEYS[objKey] : null;
  const [audiencias, setAudiencias] = useState<AudienceRef[]>(d0.audiencias);
  // Ubicaciones: null = automáticas (Advantage+, incluye IG/Threads); array = publisher_platforms manuales.
  const [placements, setPlacements] = useState<string[] | null>(d0.placements);
  const [destino, setDestino] = useState<Destino>(d0.destino);
  const [analisis, setAnalisis] = useState<Analisis>(d0.analisis);
  const [spec, setSpec] = useState<CampaignSpec | null>(d0.spec);
  const [uso, setUso] = useState<Uso>(d0.uso);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ campaign_id: string; ads: number } | null>(null);
  // A qué producto del CRM entran los leads de esta campaña. Opcional y por defecto «sin
  // producto», que es donde caían hasta hoy. La asignación la hace la MISMA acción que usa
  // el CRM, después de que Meta devuelve el id. Una campaña recién creada no tiene leads,
  // así que va con `traer = false`: no hay nada que mover.
  const [productos, setProductos] = useState<ProductoNombre[] | null>(null);
  const [producto, setProducto] = useState('');
  const [avisoProducto, setAvisoProducto] = useState<string | null>(null);
  // Meta puede retener los anuncios recién publicados hasta que un admin los
  // apruebe a mano (ver /api/ads-manager/ad-aprobacion). null = todavía chequeando.
  const [aprobacion, setAprobacion] = useState<{ pendientes: Array<{ id: string; name: string }>; accountId: string | null } | null>(null);
  const trayCounter = useRef(d0.tray.reduce((mx, t) => { const m = /^up-(\d+)$/.exec(t.id); return m ? Math.max(mx, Number(m[1])) : mx; }, 0));
  const adsetReqRef = useRef(0);
  const publishingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // La clave de idempotencia de la publicación (lib/meta-idempotencia.ts). Sale de la
  // FIRMA de lo que se manda: el mismo payload reusa la clave —un reintento después de un
  // 504 no crea otra campaña— y uno distinto (recortado, editado, regenerado) trae otra.
  // En «Nueva campaña» viaja en el borrador; en el modo existente vive mientras el modal.
  // La que quedó SIN RESPUESTA no vive acá: es la «abierta» de creativeUpload.ts, que
  // sobrevive a cerrar el modal y manda sobre esta hasta que el server la cierre.
  const [idem, setIdem] = useState<ClaveIdem | null>(d0.idem ?? null);
  // Los videos que Meta todavía procesa: id del ítem → su espera. Quitar el ítem o cerrar
  // el modal la corta.
  const siguiendo = useRef(new Map<string, AbortController>());
  const quitados = useRef(new Set<string>());
  // Sube cada vez que un video de MaKo falla, y es la `key` del panel: lo vuelve a montar
  // y la lista se pide de nuevo. Acá el panel queda ABIERTO (entran varios), así que sin
  // esto «Esa toma cambió. Vuelve a elegirla.» no tenía salida: la tarjeta seguía con la
  // ref del clip viejo y elegirla otra vez daba el mismo 409 (en los dos modales chicos
  // el panel se cierra al elegir y reabrirlo ya pide la lista).
  const [vueltaMako, setVueltaMako] = useState(0);

  // públicos personalizados (retargeting) + formularios — carga perezosa.
  const [audiencesAll, setAudiencesAll] = useState<AudienceItem[] | null>(null);
  const [leadForms, setLeadForms] = useState<Array<{ id: string; name: string }> | null>(null);
  // Por qué NO se pudieron leer los formularios. Distinto de «la página no tiene».
  const [leadFormsError, setLeadFormsError] = useState<string | null>(null);
  // true = el paso de destino muestra el creador de formularios en vez de la lista.
  const [creandoForm, setCreandoForm] = useState(false);
  // ad_id → por qué NO se puede reusar ese ganador (null = todavía no se preguntó).
  // En ws13 los ganadores activos son de OTRA página, donde la conexión no es
  // anunciante: reusarlos daba 1885499 recién al publicar (lib/meta-publicar-errores.ts).
  const ganadoresBloqueados = useGanadoresBloqueados(senales);
  useEffect(() => {
    let vivo = true;
    campanasAsignadasAction()
      .then((r) => { if (vivo && r.ok) setProductos(r.productos); })
      .catch(() => { /* sin productos no se ofrece: un control que no puede escribir se lee como roto */ });
    return () => { vivo = false; };
  }, []);
  const [convs, setConvs] = useState<Array<ConvItem> | null>(null);
  const [pixels, setPixels] = useState<Array<{ id: string; name: string }> | null>(null);
  // Eventos ACTIVOS del pixel elegido (null = sin cargar). Elegir uno inactivo arruina la entrega.
  const [pixelEvents, setPixelEvents] = useState<string[] | null>(null);
  // Por qué este negocio vende por llamada (null = todavía no se preguntó). Si la
  // consulta falla queda [], y eso NO muestra el aviso: no saber no autoriza a afirmar.
  const [motivosLlamada, setMotivosLlamada] = useState<string[] | null>(null);
  const [creandoPublico, setCreandoPublico] = useState(false);
  // Un pedido a /targeting tiene TRES estados, no dos: `null` = todavía preguntando,
  // `[]` = pregunté y no hay, y DENEGADO = no pude preguntar. Colapsar el tercero en
  // el segundo (`j.ok ? j.items : []`) hacía que el wizard AFIRMARA "No hay pixel en
  // la cuenta" sobre una cuenta con pixeles: el 403 del guard se leía como vacío y
  // mandaba a buscar el problema en Meta, que es el lugar equivocado.
  const [metaDenegado, setMetaDenegado] = useState<string | null>(null);
  // Devuelve null cuando NO se pudo preguntar (y deja el porqué en metaDenegado).
  // Quien lo llama decide qué pintar; lo que no puede es confundirlo con "no hay".
  async function traerTargeting<T>(qs: string, que: string): Promise<T[] | null> {
    // cache:'no-store' clave: sin esto el navegador cachea la 1ra respuesta (vacía)
    // y los públicos nunca aparecen aunque existan en la cuenta.
    try {
      const r = await fetch(`/api/ads-manager/targeting?${qs}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.ok && Array.isArray(j.items)) return j.items as T[];
      setMetaDenegado(`No pude traer ${que}: ${j.error || 'error desconocido'}`);
      return null;
    } catch (e) {
      setMetaDenegado(`No pude traer ${que}: ${String(e)}`);
      return null;
    }
  }
  const cargarPublicos = async () => {
    setAudiencesAll(null);
    setAudiencesAll((await traerTargeting<AudienceItem>('kind=audiences', 'tus públicos')) ?? []);
  };
  useEffect(() => { if (!existente) cargarPublicos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Moneda y país DE LA CUENTA. Los dos se adivinaban antes (MXN y México) y los
  // dos se adivinaban mal en cuanto el cliente no era mexicano.
  useEffect(() => {
    if (existente) return;
    let vivo = true;
    fetch('/api/ads-manager/targeting?kind=cuenta', { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (vivo && j.ok && j.cuenta) setCuenta({ currency: String(j.cuenta.currency ?? MONEDA_META_POR_DEFECTO), country: j.cuenta.country ?? null, name: String(j.cuenta.name ?? '') }); })
      .catch(() => { /* la pantalla de 'lugar' lo dice y el selector sigue estando */ });
    return () => { vivo = false; };
  }, [existente]);
  // Precarga (no decisión): si el borrador no traía país y Meta dice de dónde es la
  // cuenta, arranca por ahí. El usuario lo ve y lo cambia en la misma pantalla.
  useEffect(() => { if (!lugares.length && cuenta?.country) setLugares([lugarPais(cuenta.country)]); }, [cuenta?.country]); // eslint-disable-line react-hooks/exhaustive-deps
  // Con qué página e Instagram se publica (lib/meta-identidad.ts). Sólo se PREGUNTA si
  // la conexión tiene más de una opción; con una, el paso no existe y el spec no lleva
  // identidad: el server publica con la página de la credencial, exactamente como antes.
  const [identidades, setIdentidades] = useState<{ paginas: PaginaOpcion[]; instagramCuenta: InstagramOpcion[]; porDefecto: Identidad | null; preguntar: boolean } | null>(null);
  const [identidad, setIdentidad] = useState<Identidad | null>(d0.identidad ?? null);
  useEffect(() => {
    if (existente) return;
    let vivo = true;
    fetch('/api/ads-manager/targeting?kind=identidades', { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (vivo && j.ok && j.identidades) setIdentidades(j.identidades); })
      .catch(() => { /* sin la lista se publica con la página de la credencial, como antes */ });
    return () => { vivo = false; };
  }, [existente]);
  useEffect(() => {
    if (!identidades?.preguntar) return;
    // Lo que traía el borrador tiene que seguir siendo una opción válida de la conexión.
    const valida = !!identidad && identidades.paginas.some((p) => p.id === identidad.pageId && p.puedeAnunciar);
    if (!valida) { setIdentidad(identidades.porDefecto); if (step === 'creativos') setStep('identidad'); }
  }, [identidades]); // eslint-disable-line react-hooks/exhaustive-deps
  const paginaElegida = identidades?.preguntar ? identidad?.pageId ?? null : null;
  const pideForm = existente ? !!adsetInfo?.needsForm : objKey === 'lead_form';
  // ⚠️ Esto hacía `setLeadForms(it ?? [])`: un rechazo de Meta se convertía en lista
  // vacía y la pantalla afirmaba «No tienes formularios instantáneos». Código
  // Inmobiliario (ws13) tiene cuatro; lo que había era un #190 por pedirlos con el
  // token de usuario. «No pude preguntar» va a su propio estado y se dice.
  useEffect(() => {
    if (!pideForm || leadForms !== null) return;
    fetch(`/api/ads-manager/targeting?kind=leadforms${paginaElegida ? `&page=${paginaElegida}` : ''}`, { cache: 'no-store' }).then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.items)) { setLeadForms(j.items); setLeadFormsError(null); }
        else { setLeadForms([]); setLeadFormsError(String(j.error || 'error desconocido')); }
      })
      .catch((e) => { setLeadForms([]); setLeadFormsError(String(e)); });
  }, [pideForm, leadForms, paginaElegida]);  
  useEffect(() => { if ((objKey === 'lead_web' || objKey === 'sales') && convs === null) traerTargeting<ConvItem>('kind=conversions', 'tus conversiones').then((it) => setConvs(it ?? [])); }, [objKey, convs]);  
  useEffect(() => { if ((objKey === 'lead_web' || objKey === 'sales') && pixels === null) traerTargeting<{ id: string; name: string }>('kind=pixels', 'tus pixeles').then((it) => setPixels(it ?? [])); }, [objKey, pixels]);  
  useEffect(() => {
    if (existente || !obj?.needsConv || motivosLlamada !== null) return;
    fetch('/api/ads-manager/targeting?kind=agenda', { cache: 'no-store' }).then((r) => r.json())
      .then((j) => setMotivosLlamada(j.ok && Array.isArray(j.motivos) ? j.motivos : []))
      .catch(() => setMotivosLlamada([]));
  }, [existente, obj?.needsConv, motivosLlamada]);
  // Si hay UN solo pixel, lo elegimos solos (el usuario igual lo ve, pero no tiene que tocar).
  useEffect(() => { if (obj?.needsConv && pixels && pixels.length === 1 && !destino.conv?.pixel_id) setDestino((d) => ({ ...d, conv: { ...d.conv, pixel_id: pixels[0].id } })); }, [obj?.needsConv, pixels, destino.conv?.pixel_id]);
  // Al elegir un pixel, traemos SUS eventos activos (los que Meta recibe de verdad).
  const pixelSel = destino.conv?.pixel_id ?? '';
  useEffect(() => {
    if (!obj?.needsConv || !pixelSel) { setPixelEvents(null); return; }
    setPixelEvents(null);
    let cancel = false;
    traerTargeting<string>(`kind=pixelevents&pixel=${encodeURIComponent(pixelSel)}`, 'los eventos de tu pixel')
      .then((it) => { if (!cancel) setPixelEvents(it ?? []); });
    return () => { cancel = true; };
  }, [obj?.needsConv, pixelSel]);  

  // guardar borrador (solo "Nueva campaña"; el modo existente no persiste)
  useEffect(() => {
    try {
      if (existente || step === 'listo') return;
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, tray, budgetUsd, objKey, lugares, identidad, estrategia, audiencias, placements, destino, analisis, spec, uso, idem }));
    } catch { /* quota */ }
  }, [step, tray, budgetUsd, objKey, lugares, identidad, estrategia, audiencias, placements, destino, analisis, spec, uso, idem]);

  // Un video que quedó procesándose en el borrador retoma su espera al abrir; y cerrar el
  // modal corta todas (el video sigue en Meta y se retoma la próxima vez).
  useEffect(() => {
    for (const t of d0.tray) if (t.processing && t.video_id) seguirProcesando(t.id, t.video_id, t.staging_path ?? null, t.label);
    const esperas = siguiendo.current;
    return () => { for (const c of esperas.values()) c.abort(); esperas.clear(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const usables = () => tray.filter((t) => !t.processing && (t.image_hash || t.video_id || t.source_ad_id));

  // ── flujo / navegación ──
  // En 'existente', si TODOS los creativos son ganadores reusados no hay destino que
  // pedir (cada ganador viaja con su propio copy y link): el paso desaparece solo.
  const soloGanadores = existente && usables().length > 0 && usables().every((t) => t.kind === 'existing');
  const flow: Step[] = existente
    ? ['campana', 'conjunto', 'creativos', ...(soloGanadores ? [] : ['destino' as Step])]
    : [...(identidades?.preguntar ? ['identidad' as Step] : []), 'creativos', 'inversion', 'objetivo', 'lugar', 'estrategia', ...(estrategia === 'retargeting' ? ['publico' as Step] : []), 'ubicaciones', 'destino'];
  const idx = flow.indexOf(step);
  const puedeAvanzar = (): boolean => {
    switch (step) {
      case 'identidad': return !!identidad;
      case 'campana': return !!campSel;
      case 'conjunto': return !!adsetSel;
      // Con una subida a medias NO se avanza: armar() usa solo los creativos listos
      // y el que se está subiendo se caería en silencio.
      case 'creativos': return usables().length > 0 && !tray.some((t) => t.processing) && (!existente || !!adsetInfo);
      case 'inversion': return !!budgetUsd && budgetUsd > 0;
      case 'objetivo': return !!objKey;
      // Sin un lugar incluido no se avanza: Meta EXIGE geo_locations y hasta ahora
      // ese hueco lo tapaba un 'MX' cableado. Y si Meta ya dijo que la combinación
      // no va (lugares que se pisan, radio inválido), tampoco: enterarse acá es
      // gratis, enterarse al publicar deja una campaña a medio crear. `null`
      // (midiendo, o no se pudo preguntar) NO bloquea.
      case 'lugar': return lugares.some((l) => !l.excluir) && lugarOk !== false;
      case 'estrategia': return !!estrategia;
      case 'publico': return audiencias.length > 0;
      case 'ubicaciones': return placements === null || placements.length > 0;
      case 'destino':
        // Un post reusado conserva su botón original y no lleva el formulario: en un
        // conjunto de formulario Meta lo rechaza (1487888, reproducido el 2026-09-11).
        if (pideForm && usables().some((t) => t.kind === 'existing')) return false;
        if (existente) return adsetInfo ? (adsetInfo.needsForm ? !!destino.lead_form_id : !!destino.url?.trim()) : false;
        if (obj?.needsForm) return !!destino.lead_form_id;
        if (obj?.needsConv) return !!destino.url?.trim() && !!destino.conv?.pixel_id && !!(destino.conv?.pixel_event || destino.conv?.custom_conversion_id);
        return !!destino.url?.trim();
      default: return false;
    }
  };
  const avanzar = () => {
    if (!puedeAvanzar()) return;
    if (idx === flow.length - 1) return armar();
    const next = flow[idx + 1];
    if (next) setStep(next);
  };
  const retroceder = () => { if (step === 'revision') { setStep(flow[flow.length - 1]); return; } if (idx > 0) setStep(flow[idx - 1]); else onClose(); };

  // ── elegir campaña / conjunto (modo existente) ──
  // Archivadas/borradas afuera: Meta rechaza crear anuncios ahí.
  const elegible = (n: NodoEstado) => n.effectiveStatus !== 'ARCHIVED' && n.effectiveStatus !== 'DELETED';
  const conjuntosDe = (campId: string | null): NodoEstado[] => (health?.adsets ?? []).filter((a) => a.parentId === campId && elegible(a));
  function elegirCampana(c: NodoEstado) {
    setCampSel(c); setAdsetSel(null); setAdsetInfo(null); setErr(null);
    setStep('conjunto');
  }
  function elegirConjunto(a: NodoEstado) {
    setAdsetSel(a); setAdsetInfo(null); setErr(null);
    // Se avanza ya; el needsForm llega en el fondo (recién hace falta en "destino").
    // El token descarta respuestas viejas si el usuario vuelve atrás y re-elige rápido.
    const req = ++adsetReqRef.current;
    fetch(`/api/ads-manager/ad-add?adset_id=${encodeURIComponent(a.id)}`, { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (adsetReqRef.current !== req) return; if (j.ok) setAdsetInfo({ needsForm: !!j.adset.needsForm, optimization_goal: String(j.adset.optimization_goal ?? '') }); else setErr(`No pude leer el conjunto: ${j.error || 'error'}. Toca ← Atrás y vuelve a elegirlo para reintentar.`); })
      .catch((e) => { if (adsetReqRef.current === req) setErr(`No pude leer el conjunto: ${String(e)}. Toca ← Atrás y vuelve a elegirlo para reintentar.`); });
    setStep('creativos');
  }

  // ── subir creativo ──
  // Dos puertas —un archivo del disco o un video que MaKo ya generó (tarea #797)— y la
  // MISMA espera a Meta. El de MaKo nace en 100 (no hay subida que mostrar) y su miniatura
  // es una data: hecha acá o ninguna, nunca la url del .mp4: ésa viajaría a Meta como
  // image_url y rechazaría el creativo. El borrador lo guarda como a cualquier otro, y
  // loadDraft descarta el que se cortó antes de tener video_id.
  async function subir(f: { file: File } | { mako: CreativoMako }) {
    // El tope se mira ANTES de agregar la tarjeta: una que aparece y desaparece se lee
    // como una subida que falló.
    if ('file' in f) {
      const tope = limiteCreativo(f.file);
      if (tope) { setErr(tope); return; }
    }
    // El mismo video dos veces son dos videos en la biblioteca de la cuenta (Meta no
    // deduplica por url) y dos anuncios iguales. Igual que agregarGanador.
    if ('mako' in f && tray.some((t) => t.mako_ref === f.mako.ref)) return;
    const nombre = 'file' in f ? f.file.name : f.mako.titulo;
    const id = `up-${++trayCounter.current}`;
    const pend: TrayItem = {
      id, kind: 'upload', media_type: 'file' in f ? (f.file.type.startsWith('video') ? 'video' : 'image') : f.mako.media_type,
      label: nombre, processing: true, progress: 'file' in f ? 0 : 100, thumbnail_url: null, mako_ref: 'mako' in f ? f.mako.ref : null,
    };
    setTray((t) => [...t, pend]);
    ('file' in f ? makeThumb(f.file) : makeThumbDeUrl(f.mako.url)).then((dt) => { if (dt) setTray((t) => t.map((x) => x.id === id ? { ...x, thumbnail_url: x.thumbnail_url ?? dt } : x)); });
    try {
      const r = 'mako' in f
        ? await usarCreativoMako(f.mako.ref)
        : await subirCreativo(f.file, (pct) => setTray((t) => t.map((x) => x.id === id ? { ...x, progress: pct } : x)));
      if (quitados.current.has(id)) return;
      // `processing` es lo que dijo Meta, NUNCA un false escrito a mano (tarea #59). Y
      // mientras Meta procesa, progress queda en 100: con undefined la tarjeta dice «0%».
      setTray((t) => t.map((x) => x.id === id ? { ...x, media_type: r.media_type, image_hash: r.image_hash, video_id: r.video_id, thumbnail_url: x.thumbnail_url ?? r.thumbnail_url, processing: r.processing, progress: r.processing ? 100 : undefined, staging_path: r.processing ? r.path : null } : x));
      if (r.processing && r.video_id) seguirProcesando(id, r.video_id, r.path, nombre);
    } catch (e) {
      if (quitados.current.has(id)) return;
      setErr(e instanceof Error ? e.message : String(e)); setTray((t) => t.filter((x) => x.id !== id));
      if ('mako' in f) setVueltaMako((n) => n + 1);
    }
  }
  // Pregunta a Meta hasta que el video esté listo. Un video procesándose no es usable
  // (usables() lo deja afuera) y el paso de creativos no avanza mientras haya uno.
  function seguirProcesando(id: string, videoId: string, path: string | null, nombre: string, cadaMs?: number) {
    if (siguiendo.current.has(id)) return;
    const ctl = new AbortController();
    siguiendo.current.set(id, ctl);
    esperarVideoListo(videoId, path, { signal: ctl.signal, cadaMs }).then((fin) => {
      if (siguiendo.current.get(id) === ctl) siguiendo.current.delete(id);
      if (fin === 'cancelado' || quitados.current.has(id)) return;
      const sinLectura = motivoFinEspera('sin_lectura', nombre);
      if (fin === 'ready') {
        setTray((t) => t.map((x) => x.id === id ? { ...x, processing: false, progress: undefined, staging_path: null } : x));
        setErr((e) => (e === sinLectura ? null : e));
        return;
      }
      // «No pude leer» no es un veredicto de Meta: el ítem se queda y se sigue preguntando.
      if (fin === 'sin_lectura') { setErr(sinLectura); seguirProcesando(id, videoId, path, nombre, CADA_MS_SIN_LECTURA); return; }
      setTray((t) => t.filter((x) => x.id !== id));
      setErr(motivoFinEspera(fin, nombre));
    });
  }
  function agregarGanador(s: SenalRecon) {
    if (ganadoresBloqueados?.[s.ad_id]) return;
    if (tray.some((t) => t.source_ad_id === s.ad_id)) return;
    setTray((t) => [...t, { id: `win-${s.ad_id}`, kind: 'existing', source_ad_id: s.ad_id, thumbnail_url: s.ad_thumbnail_url, label: s.ad_name }]);
  }
  const quitar = (id: string) => {
    quitados.current.add(id);
    siguiendo.current.get(id)?.abort();
    siguiendo.current.delete(id);
    setTray((t) => t.filter((x) => x.id !== id));
  };

  // ── crear un público personalizado sin salir de la app ──
  async function crearPublico(tipo: AudTipo, dias: number, evento?: string) {
    setCreandoPublico(true); setErr(null);
    try {
      const r = await fetch('/api/ads-manager/audience-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, dias, evento }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo crear el público');
      const a = j.audience as AudienceRef;
      setAudiencesAll((prev) => [a, ...(prev ?? [])]);
      setAudiencias((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (/terms of service|customaudiences\/app\/tos/i.test(msg)) {
        const url = (msg.match(/https?:\/\/\S+/) || [''])[0];
        msg = `Falta aceptar UNA vez los Términos de Públicos Personalizados de Meta (un clic; después funcionan todos): ${url}`;
      }
      setErr(msg);
    }
    finally { setCreandoPublico(false); }
  }

  // ── MaKo arma la campaña (o los anuncios nuevos) a partir de las respuestas ──
  async function armar() {
    setStep('armando'); setErr(null);
    try {
      // 1) MaKo mira los creativos (solo los que tienen miniatura dataURL).
      let an = analisis;
      const paraVer = usables().filter((t) => t.thumbnail_url?.startsWith('data:')).map((t) => ({ thumbnail: t.thumbnail_url, media_type: t.media_type }));
      if (paraVer.length) {
        try { const ar = await fetch('/api/ads-manager/analyze-creatives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creatives: paraVer }) }); const aj = await ar.json(); if (aj.ok && Array.isArray(aj.items)) { an = aj.items; setAnalisis(an); } } catch { /* best-effort */ }
      }
      // 2) MaKo escribe el copy alineado al objetivo + estrategia (si hace falta:
      //    los ganadores reusados viajan con su propio copy).
      let makoSpec: CampaignSpec | null = null;
      if (!existente || usables().some((t) => t.kind === 'upload')) {
        const r = await fetch('/api/ads-manager/campaign-suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'suggest', prompt: existente ? promptExistente(an) : promptDeRespuestas(an) }) });
        const j = await r.json();
        if (j.uso) setUso(j.uso);
        makoSpec = j.ok ? j.spec : null;
      }
      // 3) construir el spec determinístico (respuestas = verdad; copy de MaKo).
      setSpec(existente ? construirSpecExistente(makoSpec) : construirSpec(makoSpec));
      setStep('revision');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setStep(flow[flow.length - 1]); }
  }

  // `an[k]` está indexado por paraVer (sólo los que tienen miniatura data:, armar()), NO
  // por usables(). ⚠️ promptDeRespuestas indexaba an[i] sobre usables(): un creativo sin
  // miniatura data: —un ganador, o un video de MaKo cuyo frame no se pudo dibujar— corría
  // todas las descripciones siguientes al anuncio equivocado. Cada creativo se mapea a SU
  // análisis por posición en ese subconjunto. Un video de MaKo sin análisis se describe
  // con el título de su anuncio, que es mejor que «sin descripción» (tarea #797).
  function analisisDe(t: TrayItem, an: Analisis): { descripcion: string; angulo: string } {
    const conVer = usables().filter((x) => x.thumbnail_url?.startsWith('data:'));
    const k = conVer.indexOf(t);
    const a = k >= 0 ? an[k] : undefined;
    return { descripcion: a?.descripcion || (t.mako_ref ? `video hecho con MaKo, «${t.label}»` : '(sin descripción)'), angulo: a?.angulo ?? '' };
  }

  function promptDeRespuestas(an: Analisis): string {
    const objLabel = OBJETIVO_UI.find((o) => o.value === objKey)?.label ?? objKey;
    const estrLabel = ESTRATEGIAS.find((e) => e.value === estrategia)?.label ?? estrategia;
    const u = usables();
    const desc = u.map((t, i) => { const a = analisisDe(t, an); return `Creativo ${i + 1} (${t.media_type ?? 'archivo'}${t.kind === 'existing' ? ', ganador' : ''}): ${a.descripcion}${a.angulo ? ` [ángulo: ${a.angulo}]` : ''}`; }).join('\n');
    return `El usuario ya decidió estos parámetros (NO los cambies, respétalos):
- Objetivo: ${objLabel}
- Estrategia/audiencia: ${estrLabel}
- Inversión: ${budgetUsd} USD/día
- Creativos (${u.length}):
${desc}

Tu tarea PRINCIPAL: escribe el COPY de UN anuncio por cada creativo (texto principal potente, título corto y CTA), en la voz de la marca, alineado al objetivo y la estrategia, usando la descripción de cada creativo. Devuelve el JSON de la campaña con un conjunto y un anuncio por creativo (en el mismo orden de los creativos).`;
  }

  // Prompt del modo existente: la campaña ya está definida; MaKo SOLO escribe copy.
  // Se describen ÚNICAMENTE los creativos subidos (los ganadores reusan su propio
  // post), así el orden de los copies devueltos calza 1 a 1 con los subidos.
  function promptExistente(an: Analisis): string {
    // an[i] está indexado por paraVer (solo miniaturas data:): analisisDe mapea cada
    // subido a SU análisis, para no cruzar descripciones.
    const u = usables().filter((t) => t.kind === 'upload');
    const desc = u.map((t, i) => { const a = analisisDe(t, an); return `Creativo ${i + 1} (${t.media_type ?? 'archivo'}): ${a.descripcion}${a.angulo ? ` [ángulo: ${a.angulo}]` : ''}`; }).join('\n');
    return `El usuario va a AGREGAR anuncios nuevos a una campaña que YA existe y corre en Meta. NO propongas cambios de campaña, conjunto, presupuesto ni público: todo eso ya está definido y no se toca.
- Campaña: ${campSel?.name ?? '—'}
- Conjunto destino: ${adsetSel?.name ?? '—'}${adsetInfo?.optimization_goal ? ` (optimiza por ${adsetInfo.optimization_goal})` : ''}
- Creativos nuevos (${u.length}):
${desc}

Tu tarea PRINCIPAL: escribe el COPY de UN anuncio por cada creativo (texto principal potente, título corto y CTA), en la voz de la marca, coherente con esa campaña, usando la descripción de cada creativo. Devuelve el JSON de la campaña con un conjunto y un anuncio por creativo (en el mismo orden de los creativos).`;
  }

  function construirSpec(mako: CampaignSpec | null): CampaignSpec {
    const k = objKey ?? 'lead_form';
    const conf = OBJ_KEYS[k];
    const objective = conf.objective;
    const def = objetivoDef(objective);
    const copies = mako ? mako.adsets.flatMap((s) => s.ads).map((a) => a.creative) : [];
    const u = usables();
    // Los lugares salen del paso 'lugar'. Estaba cableado a ['MX'] en las TRES ramas:
    // eligieras lo que eligieras, la campaña se entregaba en México.
    const { geo_locations, excluded_geo_locations } = geoSpecDe(lugares);
    const targeting: Targeting = estrategia === 'retargeting'
      ? { geo_locations, custom_audiences: audiencias.map((x) => ({ id: x.id, name: x.name })), advantage_audience: 0 }
      : estrategia === 'intereses'
        // Si MaKo encontró intereses → afinamos (adv 0). Si no encontró ninguno, NO
        // mandamos un público vacío con Advantage+ apagado (entrega peor): dejamos que
        // Meta optimice el amplio (adv 1).
        ? { geo_locations, advantage_audience: mako?.adsets?.[0]?.targeting?.flexible_spec?.some((g) => g.interests?.length) ? 0 : 1, flexible_spec: mako?.adsets?.[0]?.targeting?.flexible_spec }
        : { geo_locations, advantage_audience: 1 };
    if (excluded_geo_locations) targeting.excluded_geo_locations = excluded_geo_locations;
    // Ubicaciones: null = automáticas (Advantage+, todas). Array = manuales.
    if (placements && placements.length) targeting.publisher_platforms = placements;
    const ads: AdSpec[] = u.map((t, i) => {
      const cp = copies[i] ?? copies[0] ?? ({} as Creative);
      const creative: Creative = {
        source: t.kind === 'existing' ? 'existing' : 'upload',
        source_ad_id: t.kind === 'existing' ? t.source_ad_id ?? null : null,
        media_type: t.media_type, image_hash: t.image_hash ?? null, video_id: t.video_id ?? null, thumbnail_url: t.thumbnail_url ?? null,
        primary_text: cp.primary_text ?? '', headline: cp.headline ?? '', description: cp.description ?? '',
        cta_type: cp.cta_type ?? (conf.needsForm ? 'SIGN_UP' : 'LEARN_MORE'),
      };
      if (conf.needsForm) { creative.lead_form_id = destino.lead_form_id ?? null; creative.lead_form_name = destino.lead_form_name ?? null; }
      else creative.destination_url = destino.url ?? '';
      return { name: `Anuncio ${i + 1}`, creative };
    });
    const estrTag = estrategia === 'retargeting' ? 'Retargeting' : estrategia === 'intereses' ? 'Intereses' : 'Adquisición';
    const base: CampaignSpec = {
      name: mako?.name || `${estrTag} — ${OBJETIVO_UI.find((o) => o.value === k)?.label ?? ''}`.trim(),
      objective, special_ad_categories: [], budget_level: 'campaign', daily_budget_mxn: usdACuenta(budgetUsd ?? 0, monedaCuenta),
      adsets: [{ name: `${estrTag}`, daily_budget_mxn: null, optimization_goal: conf.optimization, billing_event: def.billing_event, bid_strategy: 'LOWEST_COST_WITHOUT_CAP', targeting, ads, conversion: conf.optimization === 'OFFSITE_CONVERSIONS' ? { pixel_event: destino.conv?.pixel_event, custom_conversion_id: destino.conv?.custom_conversion_id, pixel_id: destino.conv?.pixel_id } : undefined }],
      rationale: mako?.rationale ?? '',
    };
    // Nomenclatura SIEMPRE (001 / 001.01 / 001.01.a), sin botón.
    const conNombres = aplicarNomenclatura(base, campaignCount + 1);
    return identidades?.preguntar && identidad ? { ...conNombres, identidad } : conNombres;
  }

  // Spec del modo existente: pseudo-CampaignSpec SOLO para revisar/publicar los
  // anuncios nuevos (la campaña y el conjunto reales no se tocan). Los nombres
  // siguen la nomenclatura del conjunto (001.01.c, .d, …) continuando la letra
  // del MÁXIMO anuncio existente, igual que el "+ anuncio" de la tabla.
  function construirSpecExistente(mako: CampaignSpec | null): CampaignSpec {
    const copies = mako ? mako.adsets.flatMap((s) => s.ads).map((a) => a.creative) : [];
    const u = usables();
    const needsForm = !!adsetInfo?.needsForm;
    const code = (adsetSel?.name ?? '').split(/\s+/)[0] || '000';
    let prox = proximaLetra((health?.ads ?? []).filter((a) => a.parentId === adsetSel?.id));
    // Solo los subidos llevan copy de MaKo (los ganadores reusan su propio post).
    let ci = 0;
    const ads: AdSpec[] = u.map((t) => {
      const esGanador = t.kind === 'existing';
      const cp = esGanador ? ({} as Creative) : (copies[ci] ?? copies[0] ?? ({} as Creative));
      if (!esGanador) ci++;
      const creative: Creative = {
        source: esGanador ? 'existing' : 'upload',
        source_ad_id: esGanador ? t.source_ad_id ?? null : null,
        media_type: t.media_type, image_hash: t.image_hash ?? null, video_id: t.video_id ?? null, thumbnail_url: t.thumbnail_url ?? null,
        primary_text: cp.primary_text ?? '', headline: cp.headline ?? '', description: cp.description ?? '',
        cta_type: cp.cta_type ?? (needsForm ? 'SIGN_UP' : 'LEARN_MORE'),
      };
      if (needsForm) { creative.lead_form_id = destino.lead_form_id ?? null; creative.lead_form_name = destino.lead_form_name ?? null; }
      else creative.destination_url = destino.url ?? '';
      return { name: `${code}.${letra(prox++)} Anuncio`, creative };
    });
    return {
      name: campSel?.name ?? '', objective: 'OUTCOME_LEADS', special_ad_categories: [], budget_level: 'campaign', daily_budget_mxn: null,
      adsets: [{ name: adsetSel?.name ?? '', daily_budget_mxn: null, optimization_goal: adsetInfo?.optimization_goal ?? '', billing_event: 'IMPRESSIONS', targeting: {}, ads }],
      rationale: mako?.rationale ?? '',
    };
  }

  // Tras publicar: ¿Meta retuvo los anuncios esperando aprobación manual? El issue
  // puede tardar unos segundos en aparecer, así que reintentamos un par de veces.
  // Best-effort puro: si falla, la pantalla de éxito queda como estaba.
  async function chequearAprobacion(adIds: string[], nombreCampana: string) {
    const ids = (adIds ?? []).filter(Boolean);
    if (ids.length === 0) return;
    const qsCamp = nombreCampana ? `&campana=${encodeURIComponent(nombreCampana)}` : '';
    for (let intento = 0; intento < 3; intento++) {
      await new Promise((r) => setTimeout(r, intento === 0 ? 1200 : 3000));
      try {
        const r = await fetch(`/api/ads-manager/ad-aprobacion?ids=${encodeURIComponent(ids.join(','))}${qsCamp}`, { cache: 'no-store' });
        const j = await r.json();
        if (!j.ok) return;
        if (j.pendientes?.length) { setAprobacion({ pendientes: j.pendientes, accountId: j.accountId ?? null }); return; }
      } catch { return; }
    }
  }

  // ── publicar ──
  async function publicar() {
    if (!spec || publishingRef.current) return;
    publishingRef.current = true;
    setErr(null); setStep('publicando');
    try {
      if (existente) {
        // Anuncios nuevos al conjunto elegido (lote de ad-add). La campaña no se toca.
        const adsSpec = spec.adsets[0]?.ads ?? [];
        const ads = adsSpec.map((ad) => ({
          name: ad.name,
          // El ganador reusado viaja mínimo (source + source_ad_id), igual que el "+ anuncio" de la tabla.
          creative: ad.creative.source === 'existing' ? ({ source: 'existing', source_ad_id: ad.creative.source_ad_id ?? null } as Creative) : ad.creative,
        }));
        // La clave sale del lote que se manda: después de un parcial el spec se RECORTA
        // (más abajo) y el próximo clic trae otra clave. Con la misma, el server contestaría
        // «creados N» desde la fila vieja y se recortarían N anuncios que nunca se crearon.
        // ⚠️ Salvo que la anterior haya quedado sin respuesta: ésa queda ABIERTA y se manda
        // aunque el lote haya cambiado (lib/meta-idempotencia.ts → claveAMandar). Vive fuera
        // del modal porque este modo arranca limpio cada vez que se abre.
        const destino = `ad-add-lote:${adsetSel?.id ?? ''}`;
        const { mandada, firma } = claveAMandar(claveAbierta(destino), idem, { adset_id: adsetSel?.id ?? null, ads });
        // Sin JSON (timeout de la plataforma a mitad de lote): no sabemos cuántos entraron,
        // pero el server sí. El mismo clic con la misma clave contesta cuántos entraron.
        const j = await postConTope('/api/ads-manager/ad-add', { adset_id: adsetSel?.id, campaign_id: campSel?.id ?? null, campaign_name: campSel?.name ?? null, campaign_objective: campSel?.objective ?? null, adset_name: adsetSel?.name ?? null, ads, prompt: promptExistente(analisis), uso, idem_key: mandada.clave });
        const t = trasRespuesta(j, mandada, firma);
        anotarClaveAbierta(destino, t.abierta); setIdem(t.previa);
        if (!j) throw new Error(SIN_RESPUESTA);
        // La respuesta habla del lote de ANTES: su `created` no es de éste y no se recorta.
        if (t.deAntes) { onPublished(); throw new Error(j.ok ? ANTERIOR_PUBLICADA : ANTERIOR_A_MEDIAS); }
        if (!j.ok) {
          const base = String(j.error || 'No se pudieron agregar los anuncios');
          const creados = Number(j.created ?? 0);
          if (creados > 0) {
            // Sacamos del spec los que SÍ entraron: reintentar agrega solo los que faltan.
            // Y refrescamos la tabla ya, así un "Regenerar" ve los anuncios recién creados
            // (si no, recalcularía las mismas letras sobre el health viejo).
            setSpec({ ...spec, adsets: spec.adsets.map((a, i) => (i === 0 ? { ...a, ads: a.ads.slice(creados) } : a)) });
            onPublished();
            throw new Error(`${base} — Los primeros ${creados} de ${ads.length} SÍ se crearon (en pausa). Quedaron ${ads.length - creados} aquí: reinténtalo y se agregan solo esos.`);
          }
          throw new Error(base);
        }
        setResult({ campaign_id: campSel?.id ?? '', ads: (j.ad_ids ?? []).length });
        onPublished(); // refresca la tabla YA: si cierran con ✕, los anuncios (y sus letras) igual aparecen
        setStep('listo');
        chequearAprobacion(j.ad_ids ?? [], campSel?.name ?? '');
        return;
      }
      // La clave viaja en el borrador: si la respuesta se pierde (504, pestaña cerrada) y se
      // reabre en «revisión», el mismo spec trae la misma clave y el server contesta la
      // campaña que ya creó. Editar o regenerar el spec es otra publicación: otra clave.
      // ⚠️ Salvo después de una respuesta perdida: esa clave queda ABIERTA y se manda aunque
      // se haya corregido una palabra (lib/meta-idempotencia.ts → claveAMandar). Antes la
      // edición acuñaba otra y el server creaba una SEGUNDA campaña con la primera en Meta.
      const destino = 'campaign-create';
      const { mandada, firma } = claveAMandar(claveAbierta(destino), idem, { spec });
      const j = await postConTope('/api/ads-manager/campaign-create', { spec, prompt: promptDeRespuestas(analisis), uso, idem_key: mandada.clave });
      const t = trasRespuesta(j, mandada, firma);
      anotarClaveAbierta(destino, t.abierta); setIdem(t.previa);
      if (!j) throw new Error(SIN_RESPUESTA);
      // La campaña que el server devuelve es la de ANTES de la edición: no se pinta como el
      // éxito de lo que está en pantalla. El borrador se queda, y el próximo clic lo publica.
      if (t.deAntes) { onPublished(); throw new Error(j.ok ? ANTERIOR_PUBLICADA : ANTERIOR_A_MEDIAS); }
      if (!j.ok) throw new Error(j.error || 'No se pudo publicar');
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
      setResult({ campaign_id: String(j.campaign_id ?? ''), ads: (j.ad_ids ?? []).length });
      if (producto) {
        const a = await asignarCampanaAction(funnelDeValor(producto), { tipo: 'campana', id: String(j.campaign_id), nombre: spec.name }, false).catch(() => null);
        if (!a?.ok) setAvisoProducto('No quedó asignada al funnel: hazlo desde la tabla.');
      }
      setStep('listo');
      chequearAprobacion(j.ad_ids ?? [], spec.name ?? '');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setStep('revision'); }
    finally { publishingRef.current = false; }
  }

  // ── resumen vivo (chips) ──
  // La moneda REAL de la cuenta. `cuenta` (Graph, fresco) manda; el semáforo ya
  // cargado es el respaldo; USD el último, porque 1:1 subestima y nunca multiplica.
  const monedaCuenta = cuenta?.currency ?? health?.account?.currency ?? MONEDA_META_POR_DEFECTO;

  const resumen: string[] = [];
  if (existente && campSel) resumen.push(`📂 ${campSel.name}`);
  if (existente && adsetSel) resumen.push(`👥 ${adsetSel.name}`);
  if (usables().length) resumen.push(`${usables().length} creativo${usables().length === 1 ? '' : 's'}`);
  if (budgetUsd) resumen.push(`$${budgetUsd}/día`);
  if (objKey) resumen.push(OBJETIVO_UI.find((o) => o.value === objKey)?.label ?? '');
  // Solo en su paso. Pedido explícito: el lugar colgando del pie en TODAS las
  // pantallas (con un 📍) distraía de la pregunta de cada una.
  if (step === 'lugar' && lugares.length) resumen.push(resumenLugares(lugares));
  if (estrategia) resumen.push(ESTRATEGIAS.find((e) => e.value === estrategia)?.label ?? '');
  if (placements && placements.length) resumen.push(`Ubicaciones: ${placements.length}`);

  const enWizard = step === 'campana' || step === 'conjunto' || step === 'identidad' || step === 'creativos' || step === 'inversion' || step === 'objetivo' || step === 'lugar' || step === 'estrategia' || step === 'publico' || step === 'ubicaciones' || step === 'destino';
  const pideConv = !existente && !!obj?.needsConv;

  // Click en el fondo: nunca mientras MaKo arma/publica (hay un request en vuelo), y
  // en modo existente solo donde no hay nada que perder (no persiste borrador).
  const cierraPorFondo = step !== 'armando' && step !== 'publicando' && (!existente || step === 'campana' || step === 'listo');
  return (
    <div onClick={cierraPorFondo ? onClose : undefined} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: step === 'revision' ? 640 : 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        {/* barra superior minimalista: marca + progreso + cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord>
          </div>
          {enWizard && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {flow.map((s, i) => <span key={s} style={{ width: i === idx ? 22 : 7, height: 7, borderRadius: 999, background: i <= idx ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          <button aria-label="Cerrar" onClick={onClose} style={{ marginLeft: enWizard ? 0 : 'auto', width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {step === 'campana' && (
            <Paso titulo="¿A qué campaña le sumamos anuncios?" sub="La campaña queda como está (mismo público, presupuesto y configuración): solo se le agregan anuncios nuevos, en pausa.">
              {!health && healthError ? (
                <p style={{ fontSize: 13.5, color: 'var(--bad)', textAlign: 'center', margin: 0, lineHeight: 1.5, maxWidth: 420 }}>No se pudo leer el estado de Meta: {healthError}. Cierra el pop-up, toca «↻ Actualizar estado» y vuelve a intentar.</p>
              ) : (
                <ListaEntidades items={health ? health.campaigns.filter(elegible) : null} sel={campSel?.id ?? null} onPick={elegirCampana}
                  cargando="Cargando las campañas de tu cuenta de Meta…" vacio="No hay campañas en la cuenta. Créala con «Nueva campaña»."
                  extra={(c) => { const n = conjuntosDe(c.id).length; return `${n} conjunto${n === 1 ? '' : 's'}`; }} />
              )}
            </Paso>
          )}

          {step === 'conjunto' && (
            <Paso titulo="¿En qué conjunto van?" sub="Los anuncios nuevos heredan el público, la optimización y el destino de conversión de ese conjunto.">
              <ListaEntidades items={campSel ? conjuntosDe(campSel.id) : []} sel={adsetSel?.id ?? null} onPick={elegirConjunto}
                cargando="Cargando…" vacio="Esta campaña no tiene conjuntos. Agrégale uno primero con «+ conjunto» en la tabla."
                extra={(a) => { const n = (health?.ads ?? []).filter((x) => x.parentId === a.id).length; return `${n} anuncio${n === 1 ? '' : 's'}`; }} />
            </Paso>
          )}

          {step === 'creativos' && (
            <Paso titulo="¿Qué vas a promocionar?" sub="Sube tus imágenes o videos, o reusa un anuncio que ya te funciona. Puedes cargar varios.">
              <CreativosPicker tray={tray} onQuitar={quitar} senales={senales} onGanador={agregarGanador} fileRef={fileRef} bloqueados={ganadoresBloqueados ?? {}}
                onMako={(c) => subir({ mako: c })} vueltaMako={vueltaMako}
                aviso={existente ? AVISO_PROCESANDO_NO_CIERRES : AVISO_PROCESANDO_RETOMA} />
            </Paso>
          )}

          {step === 'identidad' && identidades && (
            <Paso titulo="¿Con qué página publicas?" sub="Tu conexión de Meta tiene más de una. El anuncio sale a nombre de la que elijas.">
              <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {paginasUsables(identidades.paginas).map((p) => {
                  const on = identidad?.pageId === p.id;
                  const igs = instagramsPara(p, identidades.instagramCuenta);
                  return (
                    <button key={p.id} type="button"
                      onClick={() => {
                        // Otra página = otros formularios: el elegido de la anterior no sirve.
                        if (identidad?.pageId !== p.id) { setLeadForms(null); setLeadFormsError(null); setDestino((d) => ({ ...d, lead_form_id: null, lead_form_name: null })); }
                        setIdentidad({ pageId: p.id, instagramId: igs[0]?.id ?? null });
                      }}
                      style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.08)' : 'var(--surface)', cursor: 'pointer', fontFamily: SANS }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{p.nombre}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>Facebook{igs.length ? ` · Instagram @${igs[0].username ?? igs[0].id}` : ' · sin Instagram'}</div>
                    </button>
                  );
                })}
                {(() => {
                  const elegida = identidades.paginas.find((x) => x.id === identidad?.pageId) ?? null;
                  const igs = instagramsPara(elegida, identidades.instagramCuenta);
                  if (!identidad || igs.length < 2) return null;
                  const chip = (on: boolean) => ({ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' });
                  return (
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                      {igs.map((ig) => <button key={ig.id} type="button" onClick={() => setIdentidad({ ...identidad, instagramId: ig.id })} style={chip(identidad.instagramId === ig.id)}>Instagram @{ig.username ?? ig.id}</button>)}
                      <button type="button" onClick={() => setIdentidad({ ...identidad, instagramId: null })} style={chip(identidad.instagramId === null)}>Solo Facebook</button>
                    </div>
                  );
                })()}
              </div>
            </Paso>
          )}

          {step === 'inversion' && (
            <Paso titulo="¿Cuánto quieres invertir por día?" sub={monedaCuenta === 'USD' ? 'En dólares, que es la moneda de tu cuenta de Meta.' : `En dólares. Tu cuenta de Meta cobra en ${monedaCuenta}.`}>
              <Inversion value={budgetUsd} onChange={setBudgetUsd} currency={monedaCuenta} />
            </Paso>
          )}

          {step === 'objetivo' && (
            <Paso titulo="¿Qué buscas con esta campaña?">
              <Opciones items={OBJETIVO_UI} value={objKey} onPick={(v) => { setObjKey(v as ObjKey); setDestino({}); setStep(flow[flow.indexOf('objetivo') + 1]); }} />
            </Paso>
          )}

          {step === 'lugar' && (
            <Paso titulo="¿Dónde está la gente que quieres alcanzar?" sub="País, provincia, ciudad, barrio, código postal o dirección.">
              <LugarPicker lugares={lugares} setLugares={setLugares} sugerido={cuenta?.country ?? null} onValidez={setLugarOk} />
            </Paso>
          )}

          {step === 'estrategia' && (
            <Paso titulo="¿Qué quieres hacer con estos creativos?" sub={analisisResumen(analisis)}>
              <Opciones items={ESTRATEGIAS} value={estrategia} onPick={(v) => { setEstrategia(v as Estrategia); const f: Step[] = [...(identidades?.preguntar ? ['identidad' as Step] : []), 'creativos', 'inversion', 'objetivo', 'lugar', 'estrategia', ...((v as Estrategia) === 'retargeting' ? ['publico' as Step] : []), 'ubicaciones', 'destino']; setStep(f[f.indexOf('estrategia') + 1]); }} />
            </Paso>
          )}

          {step === 'publico' && (
            <Paso titulo="¿A qué público lo mostramos?" sub="Tus públicos personalizados (video viewers, visitantes, leads abiertos…). MaKo no los inventa.">
              <PublicoPicker audiencesAll={audiencesAll} audiencias={audiencias} setAudiencias={setAudiencias} onCrear={crearPublico} creando={creandoPublico} onRefresh={cargarPublicos} />
            </Paso>
          )}

          {step === 'ubicaciones' && (
            <Paso titulo="¿Dónde se muestra?" sub="Las automáticas (Advantage+) reparten en Facebook, Instagram y Threads donde mejor rinde. Es lo recomendado.">
              <UbicacionesPicker placements={placements} setPlacements={setPlacements} />
            </Paso>
          )}

          {step === 'destino' && existente && !adsetInfo && (
            <Paso titulo="Leyendo el conjunto…" sub="Un segundo: vemos si el conjunto pide formulario instantáneo o URL de destino." />
          )}

          {step === 'destino' && !(existente && !adsetInfo) && (
            <Paso titulo={pideForm ? (creandoForm ? 'Crea tu formulario instantáneo' : '¿Qué formulario instantáneo usas?') : pideConv ? '¿Dónde captas la conversión?' : '¿A qué página llevamos a la gente?'}
              sub={pideForm ? (creandoForm ? 'Queda en tu página de Facebook, listo para este anuncio.' : 'Elige uno de tu página, o crea uno nuevo aquí mismo.') : pideConv ? 'Tu landing/VSL + por qué conversión del pixel optimizamos (tu agenda, lead, registro…).' : existente ? 'La URL de destino de los anuncios nuevos (tu VSL o landing).' : 'La URL de tu VSL o landing.'}>
              {pideForm ? (creandoForm ? (
                <CrearFormulario
                  pageId={paginaElegida}
                  onCancelar={() => setCreandoForm(false)}
                  onCreado={(f) => {
                    // Queda ELEGIDO para este anuncio: crear y después buscarlo en la lista
                    // sería pedirle a la persona el mismo paso dos veces.
                    setLeadForms((l) => [f, ...(l ?? [])]);
                    setLeadFormsError(null);
                    setDestino((d) => ({ ...d, lead_form_id: f.id, lead_form_name: f.name }));
                    setCreandoForm(false);
                  }} />
              ) : (
                <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <Dropdown value={destino.lead_form_id ?? ''} placeholder={leadForms === null ? 'Cargando formularios…' : leadFormsError ? 'No pude leer tus formularios' : leadForms.length ? 'Elige un formulario…' : 'No tienes formularios instantáneos'}
                    options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => setDestino((d) => ({ ...d, lead_form_id: v, lead_form_name: leadForms?.find((f) => f.id === v)?.name ?? null }))} width="100%" />
                  <button type="button" onClick={() => setCreandoForm(true)} style={{ ...btnGhost, padding: '10px 16px', fontSize: 14, color: 'var(--primary-strong)', fontWeight: 600 }}>+ Crear un formulario nuevo</button>
                  {usables().some((t) => t.kind === 'existing') && (
                    <p style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Un ganador reusado conserva su botón original y no puede llevar tu formulario: Meta lo rechaza. Vuelve a <b>Creativos</b>, quítalo y sube el creativo.</p>
                  )}
                  {leadFormsError && (
                    <p style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>{linkify(leadFormsError)}</p>
                  )}
                  {leadForms !== null && leadForms.length === 0 && !leadFormsError && (
                    existente
                      ? <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>El conjunto optimiza por formulario instantáneo y tu página no tiene ninguno. Crea uno aquí mismo, o elige otro conjunto.</p>
                      : <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Tu página no tiene formularios instantáneos. Crea uno aquí mismo, o toca <b>← Atrás</b> y elige <b>“Leads / agendas en tu web”</b> para captar el lead en tu landing.</p>
                  )}
                </div>
              )) : (
                <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <input value={destino.url ?? ''} onChange={(e) => setDestino((d) => ({ ...d, url: e.target.value }))} placeholder="https://tu-landing/vsl" autoFocus
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 13, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, outline: 'none', textAlign: 'center' }} />
                  {pideConv && (
                    <ConversionPicker pixels={pixels} convs={convs} pixelEvents={pixelEvents} destino={destino} setDestino={setDestino} denegado={metaDenegado} motivosLlamada={motivosLlamada} />
                  )}
                </div>
              )}
            </Paso>
          )}

          {step === 'armando' && (
            <MakoLoading pasos={existente
              ? ['Mirando tus creativos…', 'Leyendo la campaña elegida…', 'Escribiendo el copy de cada anuncio…']
              : ['Mirando tus creativos…', 'Entendiendo tu objetivo y estrategia…', 'Escribiendo el copy de cada anuncio…', 'Armando la estructura de la campaña…']} />
          )}

          {step === 'revision' && spec && (
            <>
              <Revision spec={spec} budgetUsd={budgetUsd} tray={tray} setSpec={setSpec} fijo={existente} />
              {!existente && productos && (
                <div style={{ padding: '0 26px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>Sus leads entran en</span>
                  <Dropdown
                    value={producto}
                    options={[{ value: '', label: 'Sin funnel' }, ...productos.map((p) => ({ value: valorDeProducto(p.id), label: p.nombre }))]}
                    onChange={setProducto}
                    width={230}
                  />
                </div>
              )}
            </>
          )}

          {step === 'publicando' && (
            <MakoLoading pasos={existente
              ? ['Subiendo los anuncios al conjunto…', 'Aplicando UTMs…', 'Publicando en Meta, en pausa…']
              : ['Creando la campaña…', 'Configurando el conjunto de anuncios…', obj?.needsConv ? 'Conectando el pixel y la conversión…' : estrategia === 'retargeting' ? 'Cargando tu público…' : 'Configurando el público…', 'Subiendo los anuncios y aplicando UTMs…', 'Publicando en Meta, en pausa…']} />
          )}

          {step === 'listo' && result && (
            <div style={{ padding: '52px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>✓</div>
              <h3 style={pregunta}>{existente ? 'Anuncios agregados en pausa' : 'Campaña creada en pausa'}</h3>
              <p style={ayuda}>
                {existente
                  ? <>Se {result.ads === 1 ? 'agregó' : 'agregaron'} {result.ads} anuncio{result.ads === 1 ? '' : 's'} a <b>{campSel?.name ?? 'la campaña'}</b>, en <b>PAUSA</b>. La campaña quedó tal cual estaba; activa los anuncios con el toggle de la tabla cuando quieras.</>
                  : <>Se creó con {result.ads} anuncio{result.ads === 1 ? '' : 's'}, todo en <b>PAUSA</b>. Actívala con el toggle de la tabla cuando quieras.</>}
              </p>
              {aprobacion && aprobacion.pendientes.length > 0 && (
                // Sin esto la app canta "listo" y el anuncio nunca entrega: Meta lo
                // retiene hasta que un admin lo aprueba a mano, y su mail dice
                // "no tenés que hacer nada" justo a la persona que tiene que actuar.
                <div style={{ width: '100%', maxWidth: 460, background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 14, padding: '14px 16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>⚠ Meta pide que los apruebes</div>
                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>
                    Por seguridad, Meta retuvo {aprobacion.pendientes.length === 1 ? 'este anuncio' : `${aprobacion.pendientes.length} de estos anuncios`} hasta que un admin de la cuenta {aprobacion.pendientes.length === 1 ? 'lo apruebe' : 'los apruebe'} a mano. Si la cuenta es tuya, ese admin eres tú: apruébalos en Ads Manager y recién ahí van a entregar. No se puede hacer desde aquí porque Meta no lo permite por API.
                  </p>
                  <a href={linkAprobarEnMeta(aprobacion.accountId, aprobacion.pendientes[0]?.id)} target="_blank" rel="noopener noreferrer"
                    style={{ ...btnDark, background: 'var(--warn-fill)', color: '#fff', fontSize: 14, padding: '10px 18px', alignSelf: 'flex-start', textDecoration: 'none' }}>
                    Aprobar en Meta ↗
                  </a>
                  <p style={{ fontSize: 12, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>Te lo mandé también por WhatsApp con el link, por si lo apruebas más tarde.</p>
                  <TutorialAprobacionMeta />
                </div>
              )}
              {avisoProducto && <p style={{ fontSize: 13, color: 'var(--warn-fill)', margin: 0 }}>{avisoProducto}</p>}
              <button onClick={() => { if (!existente) onPublished(); onClose(); }} style={btnDark}>Ver en la tabla</button>
            </div>
          )}
        </div>

        {/* pie: navegación + resumen vivo */}
        {(enWizard || step === 'revision') && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            {resumen.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '10px 20px 0', justifyContent: 'center' }}>
                {resumen.map((c, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{i > 0 ? '·' : ''} {c}</span>)}
              </div>
            )}
            {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', padding: '8px 20px 0', lineHeight: 1.5 }}>{linkify(err)}</div>}
            {/* El paso 'destino' ya lo dice adentro (ConversionPicker), y repetirlo ahí abajo
                fue justamente lo que hizo leer un error de PÚBLICOS bajo una pantalla de PIXEL. */}
            {metaDenegado && step !== 'destino' && <div style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', padding: '8px 20px 0', lineHeight: 1.5 }}>{linkify(metaDenegado)}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px' }}>
              <button onClick={retroceder} style={btnGhost}>← {idx <= 0 && enWizard ? 'Cancelar' : 'Atrás'}</button>
              {step === 'revision' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {uso && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{fmtUso(uso)}</span>}
                  <button onClick={armar} style={btnGhost}>↻ Regenerar</button>
                  <button onClick={publicar} style={{ ...btnDark, background: 'var(--good)' }}>{existente ? 'Agregar en pausa' : 'Publicar en pausa'}</button>
                </div>
              ) : (
                step !== 'objetivo' && step !== 'estrategia' && step !== 'campana' && step !== 'conjunto' && <button onClick={avanzar} disabled={!puedeAvanzar()} style={{ ...btnDark, opacity: puedeAvanzar() ? 1 : 0.4, cursor: puedeAvanzar() ? 'pointer' : 'not-allowed' }}>Siguiente →</button>
              )}
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" style={{ display: 'none' }}
          onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => subir({ file: f })); e.target.value = ''; }} />
      </div>
    </div>
  );
}

// ── wrapper de cada paso (centrado, aireado) ──
function Paso({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div style={{ padding: '34px 30px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={pregunta}>{titulo}</h2>
        {sub && <p style={ayuda}>{sub}</p>}
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>{children}</div>
    </div>
  );
}

// ── opciones tipo tarjeta (objetivo / estrategia) ──
function Opciones<T extends string>({ items, value, onPick }: { items: Array<{ value: T; icon: string; label: string; desc: string }>; value: T | null; onPick: (v: T) => void }) {
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => {
        const on = value === it.value;
        return (
          <button key={it.value} type="button" onClick={() => onPick(it.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <span style={{ fontSize: 24, flex: 'none' }}>{it.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{it.label}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 1 }}>{it.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── lista de campañas / conjuntos existentes (modo "agregar a campaña") ──
function ListaEntidades({ items, sel, onPick, extra, cargando, vacio }: { items: NodoEstado[] | null; sel: string | null; onPick: (n: NodoEstado) => void; extra: (n: NodoEstado) => string; cargando: string; vacio: string }) {
  if (items === null) return <p style={{ fontSize: 14, color: 'var(--dim)', textAlign: 'center', margin: 0 }}>{cargando}</p>;
  if (items.length === 0) return <p style={{ fontSize: 14, color: 'var(--dim)', textAlign: 'center', margin: 0, lineHeight: 1.5, maxWidth: 400 }}>{vacio}</p>;
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto', paddingRight: 2 }}>
      {items.map((n) => {
        const on = sel === n.id;
        return (
          <button key={n.id} type="button" onClick={() => onPick(n)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '13px 15px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: colorDeSemaforo(n.semaforo), flex: 'none' }} title={n.statusLabel} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1 }}>{n.statusLabel} · {extra(n)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── inversión (USD, convertida a la moneda de la cuenta) ──
function Inversion({ value, onChange, currency }: { value: number | null; onChange: (v: number | null) => void; currency: string }) {
  const convertible = esConvertible(currency);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--border-strong)', borderRadius: 16, padding: '14px 22px', background: 'var(--surface-2)' }}>
        <span style={{ fontSize: 30, fontWeight: 600, color: 'var(--dim)' }}>$</span>
        <input value={value ?? ''} inputMode="numeric" autoFocus onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); onChange(n > 0 ? n : null); }}
          placeholder="50" style={{ width: 130, border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 40, fontWeight: 700, outline: 'none', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ fontSize: 16, color: 'var(--dim)', fontWeight: 500 }}>USD/día</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[20, 50, 100, 200].map((v) => <button key={v} type="button" onClick={() => onChange(v)} style={{ padding: '8px 16px', borderRadius: 999, border: `1px solid ${value === v ? 'var(--primary)' : 'var(--border-strong)'}`, background: value === v ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: value === v ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>${v}</button>)}
      </div>
      {value ? (
        currency === 'USD'
          ? <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>Tu cuenta de Meta cobra en USD: son ${value.toLocaleString('es-MX')} USD/día tal cual.</span>
          : convertible
            ? <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>≈ ${usdACuenta(value, currency).toLocaleString('es-MX')} {currency}/día en tu cuenta</span>
            // Sin tasa para esa moneda no se inventa una: se dice que el número va tal
            // cual. Antes se multiplicaba por el dólar-peso pasara lo que pasara.
            : <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--warn)' }}>Tu cuenta cobra en {currency}: el monto se envía como {value.toLocaleString('es-MX')} {currency}/día, sin convertir.</span>
      ) : null}
    </div>
  );
}

// ── creativos ──
function CreativosPicker({ tray, onQuitar, senales, onGanador, onMako, vueltaMako, fileRef, bloqueados, aviso }: { tray: TrayItem[]; onQuitar: (id: string) => void; senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; onMako: (c: CreativoMako) => void; vueltaMako: number; fileRef: React.RefObject<HTMLInputElement | null>; bloqueados: Record<string, string>; aviso: string }) {
  const [verGanadores, setVerGanadores] = useState(false);
  // Los videos que MaKo ya generó (tarea #797). El panel queda abierto: acá entran varios.
  const [verMako, setVerMako] = useState(false);
  const makoElegidos = tray.map((t) => t.mako_ref).filter((r): r is string => !!r);
  // Los que se pueden reusar van PRIMERO (lib/ganadores-reuso.ts): en ws13 los que más
  // gastaron son de otra página y tapaban a los únicos publicables.
  const ganadores = ganadoresParaReusar(senales, bloqueados);
  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {tray.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {tray.map((t) => (
            <div key={t.id} style={{ position: 'relative', width: 78, height: 104, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', flex: 'none' }} title={t.label}>
              {t.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: t.processing ? 0.7 : 1 }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>{t.media_type === 'video' ? '🎬' : '🖼️'}</div>}
              {t.processing && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(18,21,27,.62)', padding: '4px 5px 5px' }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(243,245,248,.25)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${t.progress ?? 0}%`, background: 'var(--primary)', transition: 'width .2s' }} /></div>
                  <div style={{ fontSize: 8.5, color: '#F3F5F8', fontFamily: MONO, textAlign: 'center', marginTop: 2 }}>{(t.progress ?? 0) < 100 ? `${t.progress ?? 0}%` : 'Procesando'}</div>
                </div>
              )}
              {t.kind === 'existing' && <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '0 4px' }}>★</span>}
              <button type="button" aria-label="Quitar" onClick={() => onQuitar(t.id)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 6, border: 'none', background: 'rgba(18,21,27,.7)', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {tray.some(esperandoAMeta) && <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0, lineHeight: 1.5, maxWidth: 420 }}>{aviso}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" onClick={() => fileRef.current?.click()} style={btnDark}>⬆ Subir creativo</button>
        <button type="button" onClick={() => { setVerMako((v) => !v); setVerGanadores(false); }} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="videogen" size={15} /> Mis creativos</button>
        <button type="button" onClick={() => { setVerGanadores((v) => !v); setVerMako(false); }} style={btnGhost}>★ Usar un ganador</button>
      </div>
      {verMako && (
        <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <MisCreativosMako key={vueltaMako} onElegir={onMako} elegidos={makoElegidos} />
        </div>
      )}
      {verGanadores && (
        <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {ganadores.length === 0 ? <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', margin: 0 }}>Sin anuncios con creativo para reusar.</p> : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxHeight: 200, overflowY: 'auto' }}>
              {ganadores.map((s) => (
                <button key={s.ad_id} type="button" disabled={!!bloqueados[s.ad_id]} onClick={() => onGanador(s)} title={bloqueados[s.ad_id] ? `${s.ad_name} — ${bloqueados[s.ad_id]}` : `${s.ad_name} · ${s.leads} leads`} style={{ position: 'relative', width: 56, height: 74, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', cursor: bloqueados[s.ad_id] ? 'not-allowed' : 'pointer', padding: 0, flex: 'none', opacity: bloqueados[s.ad_id] ? 0.35 : 1 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.ad_thumbnail_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, fontFamily: MONO, background: 'rgba(18,21,27,.7)', color: '#fff', padding: '1px 2px' }}>{s.leads}L</span>
                </button>
              ))}
            </div>
          )}
          {ganadores.some((s) => bloqueados[s.ad_id]) && (
            <p style={{ fontSize: 12, color: 'var(--dim)', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.45 }}>Los apagados son de otra página de Facebook: tu conexión de Meta no es anunciante en ella, y Meta no deja publicarlos.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── público (retargeting) — elegir uno existente o CREAR uno sin entrar a Meta ──
const EVENTOS_PIXEL = [
  { value: 'PageView', label: 'Visitó la página' },
  { value: 'ViewContent', label: 'Vio el contenido / VSL' },
  { value: 'Lead', label: 'Dejó sus datos (Lead)' },
  { value: 'CompleteRegistration', label: 'Se registró' },
  { value: 'Schedule', label: 'Agendó' },
  { value: 'InitiateCheckout', label: 'Inició checkout' },
  { value: 'Purchase', label: 'Compró' },
  { value: '__custom__', label: 'Otro evento (escribir)…' },
];

function PublicoPicker({ audiencesAll, audiencias, setAudiencias, onCrear, creando, onRefresh }: { audiencesAll: AudienceItem[] | null; audiencias: AudienceRef[]; setAudiencias: (a: AudienceRef[]) => void; onCrear: (tipo: AudTipo, dias: number, evento?: string) => void; creando: boolean; onRefresh: () => void }) {
  const [dias, setDias] = useState(180);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [evento, setEvento] = useState('PageView');
  const [eventoCustom, setEventoCustom] = useState('');
  const countById = new Map((audiencesAll ?? []).map((a) => [a.id, a.count ?? null] as const));
  const fmtC = (c: number | null | undefined) => (c == null ? '' : ` · ~${c.toLocaleString('es-MX')}`);
  const opts = (audiencesAll ?? []).filter((a) => !audiencias.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: `${a.name ?? a.id}${fmtC(a.count)}` }));
  const chipDia = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 12, cursor: 'pointer' });
  const TIPO_OPCIONES = [
    { value: 'page', label: 'Interactuaron con tu Facebook (anuncios, posts, videos)' },
    { value: 'video', label: 'Vieron tus videos / anuncios en video' },
    { value: 'ig', label: 'Interactuaron con tu Instagram' },
    { value: 'pixel', label: 'Visitaron tu web / landing' },
  ];
  // Advertencia de tamaño: retargeting con público chico no entrega bien.
  const counts = audiencias.map((a) => countById.get(a.id)).filter((c): c is number => typeof c === 'number');
  const maxCount = counts.length ? Math.max(...counts) : null;
  const chico = audiencias.length > 0 && counts.length === audiencias.length && maxCount != null && maxCount < 1000;
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%' }}>
        <Dropdown value="" placeholder={audiencesAll === null ? 'Cargando públicos…' : audiencesAll.length ? 'Elige un público (puedes sumar varios)…' : 'No tienes públicos todavía'} resetAfterSelect
          options={opts} onChange={(v) => { const a = (audiencesAll ?? []).find((x) => x.id === v); if (a) setAudiencias([...audiencias, { id: a.id, name: a.name }]); }} width="100%" />
        <button type="button" onClick={onRefresh} title="Recargar públicos" style={{ ...btnGhost, padding: '0 13px', flex: 'none' }}>↻</button>
      </div>
      {audiencias.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {audiencias.map((a) => { const c = countById.get(a.id); return <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)' }}>{a.name ?? a.id}{c != null ? <span style={{ color: 'var(--faint)', fontFamily: MONO, fontSize: 11 }}>~{c.toLocaleString('es-MX')}</span> : null}<button type="button" onClick={() => setAudiencias(audiencias.filter((x) => x.id !== a.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 13, padding: 0 }}>✕</button></span>; })}
        </div>
      )}
      {chico && <div style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', lineHeight: 1.45 }}>⚠ Público chico (~{maxCount?.toLocaleString('es-MX')} personas). Por debajo de ~1.000 Meta puede no entregar bien: suma otro público o amplía la ventana de días.</div>}
      {audiencias.length > 1 && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>Se combinan (cualquiera de los {audiencias.length}).</span>}

      {/* crear público sin entrar a Meta — desplegable + ventana + crear */}
      <div style={{ width: '100%', borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0 }}>¿No está el que quieres? Crea uno aquí, sin entrar a Meta. Puedes crear varios y se combinan.</p>
        <Dropdown value={nuevoTipo} placeholder="¿Qué público quieres crear?" options={TIPO_OPCIONES} onChange={setNuevoTipo} width="100%" />
        {nuevoTipo === 'pixel' && (
          <>
            <Dropdown value={evento} options={EVENTOS_PIXEL} onChange={setEvento} width="100%" />
            {evento === '__custom__' && <input value={eventoCustom} onChange={(e) => setEventoCustom(e.target.value)} placeholder="Nombre EXACTO del evento del pixel (ej. AgendoLlamada)" style={{ width: '100%', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />}
          </>
        )}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[30, 90, 180, 365].map((dd) => <button key={dd} type="button" onClick={() => setDias(dd)} style={chipDia(dias === dd)}>{dd} días</button>)}
        </div>
        <button type="button" disabled={creando || !nuevoTipo || (nuevoTipo === 'pixel' && evento === '__custom__' && !eventoCustom.trim())}
          onClick={() => onCrear(nuevoTipo as AudTipo, dias, nuevoTipo === 'pixel' ? (evento === '__custom__' ? eventoCustom.trim() : evento) : undefined)}
          style={{ ...btnDark, fontSize: 13.5, padding: '10px 18px', opacity: creando || !nuevoTipo ? 0.4 : 1, cursor: creando || !nuevoTipo ? 'not-allowed' : 'pointer' }}>
          {creando ? 'Creando en Meta…' : '+ Crear público'}
        </button>
      </div>
    </div>
  );
}

// ── ubicaciones (placements): automáticas (Advantage+, incluye IG/Threads) o manuales ──
const PLACEMENT_OPCIONES = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'audience_network', label: 'Audience Network' },
  { value: 'messenger', label: 'Messenger' },
];
function UbicacionesPicker({ placements, setPlacements }: { placements: string[] | null; setPlacements: (p: string[] | null) => void }) {
  const auto = placements === null;
  const sel = placements ?? [];
  const toggle = (v: string) => setPlacements(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  const card = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' });
  const chip = (on: boolean): CSSProperties => ({ padding: '7px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' });
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={() => setPlacements(null)} style={card(auto)}>
          <span style={{ fontSize: 24, flex: 'none' }}>✨</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Automáticas (Advantage+)</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 1 }}>Meta reparte donde mejor rinde: Facebook, Instagram, <b>Threads</b>, Reels, Stories… Recomendado.</span>
          </span>
        </button>
        <button type="button" onClick={() => setPlacements(sel.length ? sel : ['facebook', 'instagram'])} style={card(!auto)}>
          <span style={{ fontSize: 24, flex: 'none' }}>🎛️</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Elegir manualmente</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 1 }}>Tú decides en qué plataformas se muestra.</span>
          </span>
        </button>
      </div>
      {!auto && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PLACEMENT_OPCIONES.map((p) => { const on = sel.includes(p.value); return <button key={p.value} type="button" onClick={() => toggle(p.value)} style={chip(on)}>{on ? '✓ ' : ''}{p.label}</button>; })}
          </div>
          {sel.length === 0 && <span style={{ fontSize: 12, color: 'var(--warn)' }}>Elige al menos una plataforma.</span>}
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.5 }}>Threads viaja con la identidad de Instagram: para incluirlo, conviene dejar <b>Automáticas</b>.</span>
        </>
      )}
    </div>
  );
}

// ── revisión minimalista — los textos se editan EN LÍNEA (tocás y escribís) ──
// fijo=true (agregar a campaña existente): el nombre de la campaña NO se edita
// (es la campaña real de Meta, no se toca) y no hay chip de presupuesto.
function Revision({ spec, budgetUsd, tray, setSpec, fijo = false }: { spec: CampaignSpec; budgetUsd: number | null; tray: TrayItem[]; setSpec: (s: CampaignSpec) => void; fijo?: boolean }) {
  const opt = spec.adsets[0]?.optimization_goal;
  const objLabel = opt === 'LEAD_GENERATION' ? 'Leads (formulario FB)' : opt === 'OFFSITE_CONVERSIONS' ? 'Leads / ventas en tu web' : opt === 'LANDING_PAGE_VIEWS' ? 'Tráfico a la landing' : opt === 'REACH' ? 'Reconocimiento' : (fijo ? opt || '' : spec.objective);
  const patchCreative = (ai: number, di: number, patch: Partial<Creative>) => setSpec({ ...spec, adsets: spec.adsets.map((a, i) => (i === ai ? { ...a, ads: a.ads.map((ad, j) => (j === di ? { ...ad, creative: { ...ad.creative, ...patch } } : ad)) } : a)) });
  const [verPorque, setVerPorque] = useState(false);
  const chips = [...(objLabel ? [`🎯 ${objLabel}`] : []), ...(budgetUsd != null ? [`💰 $${budgetUsd}/día`] : []), ...spec.adsets.map((a) => `👥 ${a.name}`)];
  return (
    <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
        {fijo ? (
          <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600, color: 'var(--ink)', padding: '2px 0' }}>{spec.name}</div>
        ) : (
          <input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} style={{ width: '100%', border: 'none', borderBottom: '1px solid transparent', background: 'transparent', textAlign: 'center', fontFamily: SANS, fontSize: 20, fontWeight: 600, color: 'var(--ink)', outline: 'none', padding: '2px 0' }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }} onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }} />
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          {chips.map((c, i) => (
            <span key={i} style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 11px' }}>{c}</span>
          ))}
        </div>
        {fijo && <p style={{ fontSize: 12, color: 'var(--faint)', margin: '8px 0 0' }}>Anuncios nuevos para esta campaña. Su configuración no se toca.</p>}
      </div>
      {spec.rationale && (
        <div style={{ textAlign: 'center' }}>
          <button type="button" onClick={() => setVerPorque((v) => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.05em', padding: 2 }}>
            {verPorque ? '▴ Ocultar' : '▾ ¿Por qué MaKo lo armó así?'}
          </button>
          {verPorque && <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: '6px 0 0', textAlign: 'center' }}>{spec.rationale}</p>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spec.adsets.map((adset, ai) => adset.ads.map((ad, di) => {
          const key = `${ai}-${di}`;
          const t = ad.creative.source === 'existing' ? tray.find((x) => x.source_ad_id === ad.creative.source_ad_id) : tray.find((x) => (ad.creative.image_hash && x.image_hash === ad.creative.image_hash) || (ad.creative.video_id && x.video_id === ad.creative.video_id));
          const thumb = t?.thumbnail_url ?? ad.creative.thumbnail_url ?? null;
          return (
            <div key={key} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ width: 64, flex: 'none', aspectRatio: '9 / 16', maxHeight: 110, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 18 }}>{ad.creative.media_type === 'video' ? '🎬' : '🖼️'}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ad.creative.source === 'existing' ? (
                  // El ganador reusa su post tal cual (Meta ignora cualquier copy nuevo):
                  // no mostramos campos editables que después se descartarían en silencio.
                  <p style={{ fontSize: 12.5, color: 'var(--dim)', margin: '4px 0 0', padding: '0 7px', lineHeight: 1.5 }}>★ Reusa el anuncio ganador tal cual: su copy y su destino originales.</p>
                ) : (
                  <>
                    <InlineCopy value={ad.creative.primary_text ?? ''} onChange={(v) => patchCreative(ai, di, { primary_text: v })} placeholder="Escribe el texto del anuncio…" multiline fontSize={13.5} />
                    <InlineCopy value={ad.creative.headline ?? ''} onChange={(v) => patchCreative(ai, di, { headline: v })} placeholder="Título (opcional)" fontSize={12.5} bold />
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4, padding: '0 7px' }}>▸ {CTA_OPCIONES.find((o) => o.value === (ad.creative.cta_type ?? 'LEARN_MORE'))?.label}{ad.creative.destination_url ? ` · ${ad.creative.destination_url}` : ad.creative.lead_form_name ? ` · ${ad.creative.lead_form_name}` : ''}</div>
                  </>
                )}
              </div>
            </div>
          );
        }))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Toca cualquier texto para editarlo. Se crea en <b>pausa</b>: la activas cuando quieras.</p>
    </div>
  );
}

// Texto editable en línea: parece texto, al tocarlo se vuelve editable (sin "modo edición").
function InlineCopy({ value, onChange, placeholder, multiline, fontSize, bold }: { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; fontSize: number; bold?: boolean }) {
  const base: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize, fontWeight: bold ? 600 : 400, lineHeight: 1.45, padding: '5px 7px', outline: 'none', transition: 'border-color .12s, background .12s' };
  const onFocus = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)'; };
  const onBlur = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; };
  if (multiline) {
    return <textarea value={value} placeholder={placeholder} rows={1} onFocus={onFocus} onBlur={onBlur}
      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
      onChange={(e) => { onChange(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
      style={{ ...base, resize: 'none', overflow: 'hidden' }} />;
  }
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} style={base} />;
}

// ── helpers ──
// Convierte URLs del texto de error en un link clickable (ej. la ToS de Públicos).
function linkify(text: string): ReactNode {
  return text.split(/(https?:\/\/\S+)/g).map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>abrir en Meta ↗</a>
    : p);
}

// Etiqueta amigable a partir del ENUM de optimización (custom_event_type).
function labelDeEnum(enumValue: string): string | undefined {
  const std = Object.values(STD_EVENTS).find((s) => s.enum === enumValue);
  return std?.label ?? EVENTOS_CONV.find((e) => e.value === enumValue)?.label;
}

// ── conversión: PRIMERO el pixel, DESPUÉS el evento (solo los ACTIVOS de ese pixel) ──
// Optimizar por un evento inactivo arruina la entrega → solo se ofrecen los que el
// pixel recibe de verdad. Y las conversiones personalizadas se miden IGUAL: acá decía
// «tus conversiones personalizadas, que ya son activas», y cada una salía con el
// rótulo fijo «Conversión que ya mides» sin haber mirado nada. En ws13, «AGENDA» se
// leía como la medición de las agendas y cuenta VISITAS a una URL con «/gracias»,
// «name» o «email»; el pixel no había recibido un solo `Schedule` (lib/meta-conversiones.ts).
function ConversionPicker({ pixels, convs, pixelEvents, destino, setDestino, denegado, motivosLlamada }: {
  pixels: Array<{ id: string; name: string }> | null;
  convs: ConvItem[] | null;
  pixelEvents: string[] | null;
  destino: Destino;
  setDestino: Dispatch<SetStateAction<Destino>>;
  /** Por qué NO se pudo leer la cuenta de Meta (403 del guard, red, etc.). Distinto de "no hay". */
  denegado: string | null;
  /** Por qué MaKo cree que el negocio vende por llamada. Vacío o null = no lo afirma. */
  motivosLlamada: string[] | null;
}) {
  const pixelId = destino.conv?.pixel_id ?? '';
  const setPixel = (v: string) => setDestino((d) => ({ ...d, conv: { pixel_id: v } })); // cambiar de pixel resetea el evento
  const setEvento = (v: string) => setDestino((d) => {
    if (v.startsWith('cc:')) { const id = v.slice(3); const c = (convs ?? []).find((x) => x.id === id); return { ...d, conv: { pixel_id: d.conv?.pixel_id, custom_conversion_id: id, label: c?.name } }; }
    return { ...d, conv: { pixel_id: d.conv?.pixel_id, pixel_event: v, label: labelDeEnum(v) } };
  });
  const detectados = !!pixelEvents && pixelEvents.length > 0;
  // ENUMs de Meta que el pixel recibió de verdad (mapeados desde el nombre del evento).
  const activosSet = new Set((pixelEvents ?? []).map((n) => STD_EVENTS[n]?.enum).filter((e): e is string => !!e));
  // Meta manda "2026-09-11T19:29:01+0000", sin los dos puntos del huso.
  const fechaCorta = (iso: string) => {
    const d = new Date(iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : iso;
  };
  // Solo las conversiones del pixel elegido (si no, se mezclan las de todos). Fail-open:
  // si a alguna no le pudimos resolver el pixel, la dejamos para no perder una válida.
  const delPixel = (convs ?? []).filter((c) => !c.pixel_id || c.pixel_id === pixelId);
  // El rótulo dice QUÉ cuenta y CUÁNDO se disparó — lo que Meta contestó, no una
  // promesa. Las que no se dispararon en 30 días van en gris, como los eventos.
  const opcionDe = (c: ConvItem): { value: string; label: string; sub: string; disabled?: boolean } => {
    const base = { value: `cc:${c.id}`, label: `Tu conversión: ${c.name}` };
    const que = c.regla ?? 'Regla propia de tu cuenta';
    if (c.estado === 'activa') return { ...base, sub: c.ultimaVez ? `${que} · última: ${fechaCorta(c.ultimaVez)}` : que };
    if (c.estado === 'inactiva') return { ...base, sub: `Inactiva — sin datos en 30 días · ${que}`, disabled: true };
    if (c.estado === 'nunca') return { ...base, sub: `Nunca registró una conversión · ${que}`, disabled: true };
    return { ...base, sub: `${que} · verifica que esté activa` };
  };
  const customVivas = delPixel.filter((c) => c.estado !== 'inactiva' && c.estado !== 'nunca').map(opcionDe);
  const customMuertas = delPixel.filter((c) => c.estado === 'inactiva' || c.estado === 'nunca').map(opcionDe);
  // Con detección: mostramos TODOS los eventos estándar como Meta (Active vs Inactive).
  // Activos arriba y habilitados; inactivos abajo, en gris y DESHABILITADOS, para que el
  // usuario VEA por qué no son opción y no elija uno muerto. Sin detección: todos
  // seleccionables con la advertencia.
  let eventOpts: Array<{ value: string; label: string; sub?: string; disabled?: boolean }>;
  if (detectados) {
    const activos = EVENTOS_CONV.filter((e) => activosSet.has(e.value)).map((e) => ({ value: e.value, label: e.label, sub: '✓ Activo en tu pixel' }));
    const inactivos = EVENTOS_CONV.filter((e) => !activosSet.has(e.value)).map((e) => ({ value: e.value, label: e.label, sub: 'Inactivo — sin datos en 30 días', disabled: true }));
    eventOpts = [...activos, ...customVivas, ...inactivos, ...customMuertas];
  } else {
    eventOpts = [...EVENTOS_CONV.map((e) => ({ value: e.value, label: e.label, sub: 'Verifica que esté activo' })), ...customVivas, ...customMuertas];
  }
  // El error que Martín pidió que se diga con todas las letras: vende por llamada y el
  // pixel no mide la agenda. Solo con el pixel LEÍDO (la función se abstiene si no).
  const aviso = pixelId && pixelEvents !== null ? avisoAgendaSinMedir(motivosLlamada ?? [], pixelEvents) : null;
  const eventValue = destino.conv?.custom_conversion_id ? `cc:${destino.conv.custom_conversion_id}` : (destino.conv?.pixel_event ?? '');
  // "No pude preguntar" (denegado) NO es "pregunté y no hay". Si se mezclan, la
  // pantalla afirma un hecho falso sobre la cuenta de Meta del usuario.
  const sinPixeles = pixels !== null && pixels.length === 0 && !denegado;
  const nota = denegado
    ? <span style={{ color: 'var(--bad)' }}>{denegado}</span>
    : !pixelId
    ? <>Primero elige el <b>pixel</b>; después te muestro <b>sus</b> eventos.</>
    : pixelEvents === null
      ? <>Buscando los eventos <b>activos</b> de tu pixel…</>
      : detectados
        ? <>Los <b>activos</b> (✓) son los que tu pixel recibió en los últimos 30 días. Los <b>inactivos</b> van en gris y no se pueden elegir: Meta no podría optimizar por ellos.</>
        : <>No pudimos detectar los eventos activos. Elige una conversión personalizada o un evento estándar que sepas <b>activo</b> en tu pixel.</>;
  return (
    <>
      <Dropdown value={pixelId}
        placeholder={pixels === null ? 'Cargando tu pixel…' : denegado ? 'No pude leer los pixeles de tu cuenta' : sinPixeles ? 'No hay pixel en la cuenta' : 'Elige tu pixel (dataset)…'}
        options={(pixels ?? []).map((p) => ({ value: p.id, label: p.name }))} onChange={setPixel} width="100%" />
      {aviso && (
        <div style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad)' }}>⚠ {aviso.titulo}</div>
          <p style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>{aviso.detalle}</p>
          <a href={`https://eventsmanager.facebook.com/events_manager2/list/dataset/${pixelId}/overview`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12.5, color: 'var(--primary-strong)', fontWeight: 600, textDecoration: 'none' }}>Abrir tu pixel en el Administrador de eventos ↗</a>
        </div>
      )}
      {pixelId && (
        <Dropdown value={eventValue} disabled={pixelEvents === null}
          placeholder={pixelEvents === null ? 'Buscando eventos activos…' : 'Elige la conversión a optimizar…'}
          options={eventOpts} onChange={setEvento} width="100%" />
      )}
      <p style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>{nota}</p>
    </>
  );
}

// ── loader de MaKo con pasos que cambian (armando / publicando) ──
function MakoLoading({ pasos }: { pasos: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (pasos.length <= 1) return; const id = setInterval(() => setI((p) => (p + 1 < pasos.length ? p + 1 : p)), 1700); return () => clearInterval(id); }, [pasos.length]);
  const uid = `mkld${useId().replace(/[:]/g, '')}`;
  const cur = Math.min(i, pasos.length - 1);
  const css = `
    .${uid}-spark { transform-box: fill-box; transform-origin: center; animation: ${uid}-pulse 1.5s ease-in-out infinite; }
    @keyframes ${uid}-pulse { 0%,100% { transform: scale(.9); opacity: .85; } 50% { transform: scale(1.12); opacity: 1; } }
    .${uid}-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ${uid}-sonar 1.8s ease-out infinite; }
    .${uid}-ring2 { animation-delay: .9s; }
    @keyframes ${uid}-sonar { 0% { transform: scale(.5); opacity: .5; } 100% { transform: scale(2.3); opacity: 0; } }
    .${uid}-txt { animation: ${uid}-tin .4s ease; }
    @keyframes ${uid}-tin { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  `;
  return (
    <div style={{ padding: '60px 30px 66px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <svg width={66} height={66} viewBox="-33 -33 66 66" role="img" aria-label="MaKo trabajando">
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F6D365" /><stop offset="100%" stopColor="#EF9F27" /></linearGradient>
        </defs>
        <circle className={`${uid}-ring`} r="13" fill="none" stroke="#EF9F27" strokeWidth="1.5" strokeOpacity=".5" />
        <circle className={`${uid}-ring ${uid}-ring2`} r="13" fill="none" stroke="#F6D365" strokeWidth="1.5" strokeOpacity=".45" />
        <g transform="scale(1.5)"><path className={`${uid}-spark`} d={SPARK} fill={`url(#${uid}-g)`} /></g>
      </svg>
      <h3 key={cur} className={`${uid}-txt`} style={{ ...pregunta, fontSize: 21, minHeight: 26 }}>{pasos[cur]}</h3>
      <div style={{ display: 'flex', gap: 6 }}>
        {pasos.map((_, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: 999, background: k <= cur ? 'var(--primary)' : 'var(--border-strong)', transition: 'background .3s' }} />)}
      </div>
    </div>
  );
}

function analisisResumen(an: Analisis): string | undefined {
  const con = an.filter((x) => x.angulo || x.descripcion);
  if (!con.length) return 'MaKo mira tus creativos para sugerirte mejor.';
  const angulos = [...new Set(con.map((x) => x.angulo).filter(Boolean))].slice(0, 3);
  return angulos.length ? `MaKo vio tus creativos (${angulos.join(', ')}). Elige la estrategia.` : undefined;
}

function pad(n: number, w: number): string { return String(Math.max(0, Math.floor(n))).padStart(w, '0'); }
function letra(n: number): string { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
// Próxima letra de anuncio dentro de un conjunto: continúa desde el MÁXIMO sufijo
// letra existente (001.01.c → d), igual que el "+ anuncio" de la tabla (espeja
// nextSuffix de CampanasBrowser para no colisionar tras borrar un anuncio).
const letraANum = (s: string): number => { let n = 0; for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96); return n; };
function proximaLetra(kids: Array<{ name: string }>): number {
  let max = 0;
  for (const k of kids) {
    const seg = k.name.split(/\s+/)[0].split('.').pop() ?? '';
    // Solo sufijos de 1-2 letras (a…zz): un anuncio llamado "Nuevo anuncio" creado a
    // mano no cuenta como código, si no letraANum('nuevo') dispara letras basura.
    if (/^[a-z]{1,2}$/i.test(seg)) max = Math.max(max, letraANum(seg));
  }
  return max + 1;
}
const stripNomenCode = (name: string): string => name.replace(/^\s*[0-9]+(?:\.[0-9]+)*(?:\.[a-zA-Z]+)?\s*[.\-)·]?\s*/, '').trim();
function aplicarNomenclatura(spec: CampaignSpec, nextNumber: number): CampaignSpec {
  const nnn = pad(nextNumber, 3);
  return {
    ...spec,
    name: `${nnn}. ${stripNomenCode(spec.name)}`.trim(),
    adsets: spec.adsets.map((a, i) => {
      const code = `${nnn}.${pad(i + 1, 2)}`;
      return { ...a, name: `${code} ${stripNomenCode(a.name)}`.trim(), ads: a.ads.map((ad, j) => ({ ...ad, name: `${code}.${letra(j + 1)} ${stripNomenCode(ad.name)}`.trim() })) };
    }),
  };
}
