// =============================================================================
// ig-datos — lecturas y helpers server-side de la tab Instagram
// =============================================================================
// Todo lo por-cliente va por getTenantDb() (scoping automático por workspace);
// lo único que toca el cliente crudo es el storage del bucket 'ig-media', que NO
// se scopea solo: el path SIEMPRE va prefijado `<ws>/…` y acá se VERIFICA ese
// prefijo antes de firmar o aceptar un path (guard en positivo: solo los paths
// del workspace actual, nunca "cualquiera menos los ajenos").
//
// Las llamadas a Zernio van por lib/zernio.ts, que ya aísla por profile.

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { listAccounts, zernioConfigurado, type ZernioAccount } from '@/lib/zernio';

export const BUCKET_IG = 'ig-media';

/** Clave en app_settings del toggle de respuesta automática del chatbot de DMs.
 *  'true' = el borrador que redacta MaKo se ENVÍA solo; cualquier otra cosa (o
 *  ausencia) = el borrador espera el clic de un humano. Fail-closed a propósito.
 *  La constante VIVE en lib/ig-chatbot.ts (el que la lee para decidir el envío):
 *  acá solo se re-exporta — una cosa, un lugar. */
export { KEY_IG_AUTO_RESPUESTA } from '@/lib/ig-chatbot';

// ── Tipos de lectura ─────────────────────────────────────────────────────────

export type MediaLocal = { path: string; mime: string; nombre?: string };

export type PublicacionIg = {
  id: number;
  tipo: 'feed' | 'reel' | 'story' | 'carrusel';
  caption: string | null;
  media: MediaLocal[];
  estado: 'borrador' | 'programado' | 'publicando' | 'publicado' | 'parcial' | 'error';
  programadoAt: string | null;
  publicadoAt: string | null;
  zernioPostId: string | null;
  error: string | null;
  createdAt: string;
};

export type ConversacionIg = {
  id: number;
  zernioConversationId: string;
  zernioAccountId: string | null;
  username: string | null;
  leadId: number | null;
  ultimoMensajeAt: string | null;
  /** Fin de la ventana de 24h de Meta (desde el último mensaje ENTRANTE). */
  ventanaExpiraAt: string | null;
  ultimoTexto: string | null;
  borradoresPendientes: number;
};

export type MensajeIg = {
  id: number;
  conversacionId: number;
  direccion: 'entrante' | 'saliente';
  estado: 'recibido' | 'borrador' | 'enviado' | 'error';
  texto: string | null;
  adjuntos: Array<{ type?: string; url?: string; refreshUrl?: string | null; filename?: string }>;
  error: string | null;
  createdAt: string;
};

export type EstadoConexionIg = {
  /** Hay key de Zernio utilizable (propia o de plataforma). */
  configurado: boolean;
  /** La cuenta de Instagram conectada del workspace (la primera, si hay). */
  cuenta: { id: string; username: string; displayName?: string } | null;
  /** Error legible si la consulta a Zernio falló (no se traga en silencio). */
  error: string | null;
};

// ── Conexión ─────────────────────────────────────────────────────────────────

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Estado de conexión del canal para el workspace `ws` (sin tirar). */
export async function estadoConexionIg(ws: number): Promise<EstadoConexionIg> {
  const configurado = await zernioConfigurado(ws);
  if (!configurado) return { configurado: false, cuenta: null, error: null };
  try {
    const cuentas: ZernioAccount[] = await listAccounts(ws, { platform: 'instagram' });
    const viva = cuentas.find((c) => c.isActive !== false) ?? cuentas[0] ?? null;
    return {
      configurado: true,
      cuenta: viva ? { id: viva._id, username: viva.username, displayName: viva.displayName } : null,
      error: null,
    };
  } catch (e) {
    return { configurado: true, cuenta: null, error: msg(e) };
  }
}

// ── Publicaciones ────────────────────────────────────────────────────────────

type FilaPost = {
  id: number; tipo: string; caption: string | null; media: unknown; estado: string;
  programado_at: string | null; publicado_at: string | null; zernio_post_id: string | null;
  error: string | null; created_at: string;
};

const aPublicacion = (r: FilaPost): PublicacionIg => ({
  id: r.id,
  tipo: (r.tipo as PublicacionIg['tipo']) ?? 'feed',
  caption: r.caption,
  media: Array.isArray(r.media) ? (r.media as MediaLocal[]) : [],
  estado: (r.estado as PublicacionIg['estado']) ?? 'borrador',
  programadoAt: r.programado_at,
  publicadoAt: r.publicado_at,
  zernioPostId: r.zernio_post_id,
  error: r.error,
  createdAt: r.created_at,
});

export async function listarPublicaciones(): Promise<PublicacionIg[]> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('contenido_posts')
    .select('id, tipo, caption, media, estado, programado_at, publicado_at, zernio_post_id, error, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`contenido_posts: ${error.message}`);
  return ((data ?? []) as FilaPost[]).map(aPublicacion);
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export async function listarConversaciones(): Promise<ConversacionIg[]> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_conversaciones')
    .select('id, zernio_conversation_id, zernio_account_id, username, lead_id, ultimo_mensaje_at, ventana_expira_at')
    .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(`ig_conversaciones: ${error.message}`);
  const convs = (data ?? []) as Array<{
    id: number; zernio_conversation_id: string; zernio_account_id: string | null;
    username: string | null; lead_id: number | null; ultimo_mensaje_at: string | null;
    ventana_expira_at: string | null;
  }>;
  if (!convs.length) return [];

  // El último texto y los borradores pendientes, en dos consultas acotadas (no
  // una por conversación). El límite alcanza: 100 conversaciones × mensajes
  // recientes; para la vista previa solo importa el más nuevo de cada una.
  const ids = convs.map((c) => c.id);
  const { data: msjs, error: errM } = await db
    .from('ig_mensajes')
    .select('conversacion_id, texto, estado, created_at')
    .in('conversacion_id', ids)
    .order('created_at', { ascending: false })
    .limit(600);
  if (errM) throw new Error(`ig_mensajes: ${errM.message}`);

  const ultimo = new Map<number, string | null>();
  const borradores = new Map<number, number>();
  for (const m of (msjs ?? []) as Array<{ conversacion_id: number; texto: string | null; estado: string }>) {
    if (m.estado === 'borrador') {
      borradores.set(m.conversacion_id, (borradores.get(m.conversacion_id) ?? 0) + 1);
      continue; // el borrador no es "el último mensaje": todavía no salió
    }
    if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m.texto);
  }

  return convs.map((c) => ({
    id: c.id,
    zernioConversationId: c.zernio_conversation_id,
    zernioAccountId: c.zernio_account_id,
    username: c.username,
    leadId: c.lead_id,
    ultimoMensajeAt: c.ultimo_mensaje_at,
    ventanaExpiraAt: c.ventana_expira_at,
    ultimoTexto: ultimo.get(c.id) ?? null,
    borradoresPendientes: borradores.get(c.id) ?? 0,
  }));
}

export async function listarMensajes(conversacionId: number): Promise<MensajeIg[]> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .select('id, conversacion_id, direccion, estado, texto, adjuntos, error, created_at')
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  return ((data ?? []) as Array<{
    id: number; conversacion_id: number; direccion: string; estado: string; texto: string | null;
    adjuntos: unknown; error: string | null; created_at: string;
  }>).map((m) => ({
    id: m.id,
    conversacionId: m.conversacion_id,
    direccion: m.direccion as MensajeIg['direccion'],
    estado: m.estado as MensajeIg['estado'],
    texto: m.texto,
    adjuntos: Array.isArray(m.adjuntos) ? (m.adjuntos as MensajeIg['adjuntos']) : [],
    error: m.error,
    createdAt: m.created_at,
  }));
}

// ── Storage (bucket privado 'ig-media') ──────────────────────────────────────

/**
 * Guard EN POSITIVO del path de storage: solo se aceptan paths del workspace
 * actual (`<ws>/…`). Un path de otro prefijo —venga de donde venga— se rechaza.
 */
export function pathDelWorkspace(ws: number, path: string): boolean {
  return path.startsWith(`${ws}/`) && !path.includes('..');
}

/**
 * URL firmada de un media del bucket para pasársela a Zernio.
 * `expiraSeg` la fija el caller: para un post programado tiene que sobrevivir
 * hasta `programado_at` + margen — una URL corta muere antes de que Zernio la
 * lea (gotcha del contrato).
 */
export async function firmarMedia(ws: number, path: string, expiraSeg: number): Promise<string> {
  if (!pathDelWorkspace(ws, path)) throw new Error('Path de media fuera del workspace.');
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_IG).createSignedUrl(path, expiraSeg);
  if (error || !data?.signedUrl) throw new Error(`No se pudo firmar el media: ${error?.message ?? 'sin URL'}`);
  return data.signedUrl;
}

/** URL firmada corta para PREVISUALIZAR un media en la UI (5 min). */
export async function firmarPreview(ws: number, path: string): Promise<string | null> {
  try {
    return await firmarMedia(ws, path, 300);
  } catch {
    return null;
  }
}
