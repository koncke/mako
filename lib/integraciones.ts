// =============================================================================
// integraciones — estado de conexión de todos los servicios externos
// =============================================================================
// Chequeo liviano por presencia de env (no hace pings que puedan colgar la
// página). El detalle "en vivo" de Meta (severidad, entrega, recos) viene aparte
// de getMetaHealth y se muestra expandido en /integraciones.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { landingRecibioEventos, LANDING_VENTANA_DIAS } from './landing-token';
import { googleCalendarConectado, googleCalendarDueno } from './google-calendar';
import { capaDef } from './capas';
import { getCapaActual, getWorkspaceActual } from './workspace';
import { getAgenteToken } from './agente-token';
// El super-admin es el único que administra las credenciales de la PLATAFORMA.
import { getSesionAdmin } from './auth';

export type EstadoIntegracion = 'conectada' | 'falta';

export type Integracion = {
  key: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  estado: EstadoIntegracion;
  detalle: string;
  /** true si tiene una vista de detalle propia (hoy: Meta) */
  tieneDetalle?: boolean;
};

// `global: true` = servicio de plataforma de la agencia (no per-cliente): siempre
// disponible para todos los workspaces. El resto se chequea contra las
// credenciales del workspace actual (credWs → dueño usa env, cliente su fila).
/** `soloPlataforma` = es una credencial de LA PLATAFORMA (el repo de la agencia, no el
 *  negocio del cliente). Solo la ve el super-admin. Ver el mismo flag en
 *  lib/metodo-catalogo.ts: los DOS catálogos tienen que declarar lo mismo o la UI de uno
 *  la esconde y la del otro la muestra. */
type Def = { key: string; nombre: string; categoria: string; descripcion: string; envs: string[]; tieneDetalle?: boolean; global?: boolean; soloPlataforma?: boolean };

const DEFS: Def[] = [
  { key: 'meta', nombre: 'Meta Ads', categoria: 'Publicidad', descripcion: 'Campañas, insights y estado de la cuenta publicitaria.', envs: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], tieneDetalle: true },
  { key: 'whatsapp', nombre: 'WhatsApp (Chatwoot)', categoria: 'Mensajería', descripcion: 'Inbox de WhatsApp, plantillas y envíos de nutrición.', envs: ['CHATWOOT_BASE_URL', 'CHATWOOT_ACCOUNT_ID', 'CHATWOOT_API_TOKEN'] },
  { key: 'email', nombre: 'Email (Resend)', categoria: 'Mensajería', descripcion: 'Envío de emails de nutrición y reportes.', envs: ['RESEND_API_KEY'] },
  // IA = BYOK por cliente (ya NO global): cada workspace usa su propia key y su
  // gasto corre contra su cuenta. Para el dueño, credWs cae al env de respaldo.
  { key: 'anthropic', nombre: 'MaKo IA (Anthropic)', categoria: 'Inteligencia', descripcion: 'El cerebro de MaKo: análisis, chats y sugerencias.', envs: ['ANTHROPIC_API_KEY'] },
  { key: 'openai', nombre: 'OpenAI', categoria: 'Inteligencia', descripcion: 'Transcripción y tareas simples de IA.', envs: ['OPENAI_API_KEY'] },
  { key: 'groq', nombre: 'Groq', categoria: 'Inteligencia', descripcion: 'IA rápida y gratis para tareas simples y transcripción.', envs: ['GROQ_API_KEY'] },
  { key: 'gemini', nombre: 'Google Gemini', categoria: 'Inteligencia', descripcion: 'IA de Google con 1M de contexto (BYOK por cliente).', envs: ['GEMINI_API_KEY'] },
  { key: 'cerebras', nombre: 'Cerebras', categoria: 'Inteligencia', descripcion: 'IA gratis y MUY rápida (Llama en su chip). Rota cuando Gemini se queda sin cuota.', envs: ['CEREBRAS_API_KEY'] },
  { key: 'mistral', nombre: 'Mistral AI', categoria: 'Inteligencia', descripcion: 'IA europea con free tier, otra gratis para rotar sin gastar.', envs: ['MISTRAL_API_KEY'] },
  { key: 'openrouter', nombre: 'OpenRouter', categoria: 'Inteligencia', descripcion: 'Una key para decenas de modelos, varios gratis (sufijo ":free").', envs: ['OPENROUTER_API_KEY'] },
  { key: 'elevenlabs', nombre: 'ElevenLabs', categoria: 'IA Generativa', descripcion: 'Voz por IA: locuciones y audio generativo con tu propia key.', envs: ['ELEVENLABS_API_KEY'] },
  // OJO: esta lista y la de lib/metodo-catalogo.ts tienen que coincidir EXACTO en los
  // `env`. Si no, credWs() devuelve null en silencio y la integración se ve cargada pero
  // no funciona — es el error clásico que la skill add-provider-integration advierte.
  { key: 'github', nombre: 'GitHub', categoria: 'Desarrollo', descripcion: 'Lee los commits de main para proponer cerrar las tareas de desarrollo ya hechas.', envs: ['GITHUB_TOKEN', 'GITHUB_REPO'], soloPlataforma: true },
  { key: 'fathom', nombre: 'Fathom', categoria: 'Reuniones', descripcion: 'Grabaciones y transcripciones de llamadas (Closing).', envs: ['FATHOM_API_KEY'] },
  { key: 'calendly', nombre: 'Calendly', categoria: 'Reuniones', descripcion: 'Agenda de reuniones (R1/R2) y asistencia.', envs: ['CALENDLY_API_TOKEN'] },
  // Google Calendar: no se mide por env — GOOGLE_CLIENT_ID/SECRET son la app
  // OAuth de la agencia (siempre puesta), así que chequearlos diría "conectada"
  // para todos sin que nadie haya autorizado su agenda. Se mide por señal REAL
  // (ver estadoGoogleCalendar), como la landing.
  { key: 'google', nombre: 'Google Calendar', categoria: 'Reuniones', descripcion: 'Cruza las reuniones de tu agenda para detectar juntas automáticamente.', envs: [] },
  { key: 'panda', nombre: 'Panda Video', categoria: 'Datos', descripcion: 'Métricas de reproducción del VSL.', envs: ['PANDA_API_KEY'] },
  { key: 'youtube', nombre: 'YouTube', categoria: 'Datos', descripcion: 'Views del VSL alojado en YouTube.', envs: ['YOUTUBE_API_KEY'] },
  // Supabase NO va acá: es la infra de la plataforma, no una integración que el
  // cliente conecte (y su credencial no puede vivir dentro de la propia base).
  // Landing: no se mide por env ni por credencial — se mide por señal REAL (ver
  // estadoLanding). El usuario no pega credenciales: copia un <script> con su
  // token y lo pega donde tenga la landing (Lovable, Framer, Webflow, WP…).
  { key: 'landing', nombre: 'Landing / VSL', categoria: 'Datos', descripcion: 'Mide visitas y retención del VSL desde tu landing, esté donde esté.', envs: [] },
  // Agente (Claude Code): como la landing, no se configura con una API key — se
  // instala una skill del lado del usuario y se conecta con un token. Su estado se
  // mide por señal REAL (¿generó el token?), no por env (ver estadoAgente).
  { key: 'agente', nombre: 'Claude Code', categoria: 'Agentes', descripcion: 'Tu agente de código lee tu plan y te propone tareas — las prioriza el Perro Guardián.', envs: [] },
];

const envGlobalReal = (k: string) => Boolean(process.env[k] && String(process.env[k]).trim());

// Landing: no hay env que chequear. La señal HONESTA de "conectada" es que hayan
// llegado eventos RECIENTES: el token se autogenera para todos al abrir
// /integraciones, así que "tiene token" no probaría nada, y "alguna vez llegó algo"
// tampoco — el snippet vive en una propiedad de un tercero (Lovable) y puede dejar
// de mandar sin que nadie se entere. Por eso la ventana de LANDING_VENTANA_DIAS.
async function estadoLanding(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  const activa = await landingRecibioEventos();
  return activa
    ? { estado: 'conectada', detalle: 'Recibiendo eventos de tu landing.' }
    : {
        estado: 'falta',
        // El copy distingue los dos casos, porque la acción es distinta: si nunca
        // llegó nada hay que pegar el código; si dejó de llegar, hay que ir a ver
        // qué se rompió (típico: el snippet quedó con una URL vieja al mudar el
        // dominio — se copia congelado y no se entera de nada).
        detalle: `Sin eventos en los últimos ${LANDING_VENTANA_DIAS} días. Si ya pegaste el código, revisá que el snippet siga apuntando acá.`,
      };
}

// Google Calendar: tampoco hay env que chequear (la app OAuth es de la agencia y
// está siempre configurada). La señal HONESTA de "conectada" es que exista el
// refresh token de ESTE workspace: prueba que alguien entró con Google y
// autorizó su agenda. Nunca lanza: es una tarjeta, no puede tumbar la página.
// Decimos DE QUIÉN es la agenda porque el workspace puede tener varias cuentas y
// el token es uno solo: sin el email, nadie podría saber cuál quedó conectada.
async function estadoGoogleCalendar(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  try {
    if (await googleCalendarConectado()) {
      const dueno = await googleCalendarDueno();
      return { estado: 'conectada', detalle: dueno ? `Cruzando las reuniones de ${dueno}.` : 'Conectada — cruzando tus reuniones.' };
    }
  } catch (e) {
    console.error(`[integraciones] chequeo de Google Calendar falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { estado: 'falta', detalle: 'Entrá con Google para conectar tu agenda.' };
}

// Agente (Claude Code): no hay env ni credencial cifrada que chequear (la skill
// vive en la máquina del usuario). La señal HONESTA de "conectada" es que ya haya
// acuñado su token — el paso que enlaza su agente con este workspace. Sin token
// todavía no se conectó: queda "por configurar" (ámbar, nunca rojo), como la
// landing antes del primer evento. Nunca lanza: es una tarjeta, no puede tumbar la
// página.
async function estadoAgente(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  try {
    const ws = await getWorkspaceActual();
    if (ws != null && (await getAgenteToken(ws))) {
      return { estado: 'conectada', detalle: 'Token generado — tu agente puede leer tu plan y proponerte tareas.' };
    }
  } catch (e) {
    console.error(`[integraciones] chequeo del agente falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { estado: 'falta', detalle: 'Generá tu token e instalá la skill en tu Claude Code.' };
}

export async function getIntegraciones(): Promise<Integracion[]> {
  // La CAPA decide qué categorías ve este workspace: al super-admin no le sirve
  // Publicidad/Mensajería/Datos (no corre ads ni mide su propio VSL) y mostrárselas
  // es una lista de rojos de un negocio que no tiene. null = ve todas.
  const cap = capaDef(await getCapaActual());
  const cats = cap.categoriasIntegraciones;
  const ocultas = new Set(cap.integracionesOcultas ?? []);
  // Y el SUPER-ADMIN decide qué se ve de la plataforma. Una credencial como el token
  // del repo no es del negocio de nadie: mostrársela a un cliente es pedirle que
  // administre algo que no es suyo, y encima un campo secreto que no puede llenar.
  const esSuper = !!(await getSesionAdmin().catch(() => null));
  const defs = (cats == null ? DEFS : DEFS.filter((d) => cats.includes(d.categoria)))
    .filter((d) => !ocultas.has(d.key))
    .filter((d) => esSuper || !d.soloPlataforma);
  return Promise.all(defs.map(async (d) => {
    if (d.key === 'landing') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoLanding()) };
    }
    if (d.key === 'google') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoGoogleCalendar()) };
    }
    if (d.key === 'agente') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoAgente()) };
    }
    // Servicios de plataforma: se evalúan contra el env global (agencia).
    // Per-cliente: contra las credenciales del workspace actual.
    const faltan: string[] = [];
    for (const k of d.envs) {
      const ok = d.global ? envGlobalReal(k) : Boolean(await credWs(k));
      if (!ok) faltan.push(k);
    }
    return {
      key: d.key,
      nombre: d.nombre,
      categoria: d.categoria,
      descripcion: d.descripcion,
      estado: (faltan.length ? 'falta' : 'conectada') as EstadoIntegracion,
      detalle: faltan.length ? `Falta configurar: ${faltan.join(', ')}` : 'Conectada y operativa.',
      tieneDetalle: d.tieneDetalle,
    };
  }));
}
