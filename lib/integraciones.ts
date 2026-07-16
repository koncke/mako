// =============================================================================
// integraciones — estado de conexión de todos los servicios externos
// =============================================================================
// Chequeo liviano por presencia de env (no hace pings que puedan colgar la
// página). El detalle "en vivo" de Meta (severidad, entrega, recos) viene aparte
// de getMetaHealth y se muestra expandido en /integraciones.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { landingRecibioEventos } from './landing-token';

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
type Def = { key: string; nombre: string; categoria: string; descripcion: string; envs: string[]; tieneDetalle?: boolean; global?: boolean };

const DEFS: Def[] = [
  { key: 'meta', nombre: 'Meta Ads', categoria: 'Publicidad', descripcion: 'Campañas, insights y estado de la cuenta publicitaria.', envs: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], tieneDetalle: true },
  { key: 'whatsapp', nombre: 'WhatsApp (Chatwoot)', categoria: 'Mensajería', descripcion: 'Inbox de WhatsApp, plantillas y envíos de nutrición.', envs: ['CHATWOOT_BASE_URL', 'CHATWOOT_ACCOUNT_ID', 'CHATWOOT_API_TOKEN'] },
  { key: 'email', nombre: 'Email (Resend)', categoria: 'Mensajería', descripcion: 'Envío de emails de nutrición y reportes.', envs: ['RESEND_API_KEY'] },
  { key: 'anthropic', nombre: 'MaKo IA (Anthropic)', categoria: 'Inteligencia', descripcion: 'El cerebro de MaKo: análisis, chats y sugerencias.', envs: ['ANTHROPIC_API_KEY'], global: true },
  { key: 'openai', nombre: 'OpenAI', categoria: 'Inteligencia', descripcion: 'Transcripción y tareas simples de IA.', envs: ['OPENAI_API_KEY'], global: true },
  { key: 'groq', nombre: 'Groq', categoria: 'Inteligencia', descripcion: 'IA rápida y gratis para tareas simples y transcripción.', envs: ['GROQ_API_KEY'], global: true },
  { key: 'fathom', nombre: 'Fathom', categoria: 'Reuniones', descripcion: 'Grabaciones y transcripciones de llamadas (Closing).', envs: ['FATHOM_API_KEY'] },
  { key: 'calendly', nombre: 'Calendly', categoria: 'Reuniones', descripcion: 'Agenda de reuniones (R1/R2) y asistencia.', envs: ['CALENDLY_API_TOKEN'] },
  { key: 'google', nombre: 'Google (Calendar / Login)', categoria: 'Datos', descripcion: 'Agenda y login con Google.', envs: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], global: true },
  { key: 'panda', nombre: 'Panda Video', categoria: 'Datos', descripcion: 'Métricas de reproducción del VSL.', envs: ['PANDA_API_KEY'] },
  { key: 'youtube', nombre: 'YouTube', categoria: 'Datos', descripcion: 'Views del VSL alojado en YouTube.', envs: ['YOUTUBE_API_KEY'] },
  { key: 'supabase', nombre: 'Base de datos (Supabase)', categoria: 'Datos', descripcion: 'Almacena leads, métricas y configuración.', envs: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], global: true },
  // Landing: no se mide por env ni por credencial — se mide por señal REAL (ver
  // estadoLanding). El usuario no pega credenciales: copia un <script> con su
  // token y lo pega donde tenga la landing (Lovable, Framer, Webflow, WP…).
  { key: 'landing', nombre: 'Landing / VSL', categoria: 'Datos', descripcion: 'Mide visitas y retención del VSL desde tu landing, esté donde esté.', envs: [] },
];

const envGlobalReal = (k: string) => Boolean(process.env[k] && String(process.env[k]).trim());

// Landing: no hay env que chequear. La señal HONESTA de "conectada" es que YA
// hayan llegado eventos de esa landing: el token se autogenera para todos al
// abrir /integraciones, así que "tiene token" no probaría nada. Un pageview
// recibido sí prueba que el código está pegado y que el ruteo funciona.
async function estadoLanding(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  const activa = await landingRecibioEventos();
  return activa
    ? { estado: 'conectada', detalle: 'Recibiendo eventos de tu landing.' }
    : { estado: 'falta', detalle: 'Pegá el código en tu landing para empezar a medir.' };
}

export async function getIntegraciones(): Promise<Integracion[]> {
  return Promise.all(DEFS.map(async (d) => {
    if (d.key === 'landing') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoLanding()) };
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
