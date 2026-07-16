// =============================================================================
// metodo-verificar — "Probar conexión" de una integración (lógica compartida)
// =============================================================================
// Hace el request MÁS BARATO que valida las credenciales de un servicio (el
// estilo exacto de auth de cada lib del repo: Meta por query param, Chatwoot
// con header api_access_token, Panda sin prefijo Bearer, etc.). Los valores
// enviados pisan a los guardados/env, así se puede probar ANTES de guardar.
// Timeout 8s por ping. La usan /api/metodo/verificar (super admin) y el wizard
// de onboarding (/api/onboarding, admin-cliente) — el GUARD lo pone cada ruta.

import 'server-only';
import { credWs } from './credenciales';
import { servicioMetodo } from './metodo-catalogo';

type Valores = Record<string, string>;

const timeout = () => AbortSignal.timeout(8000);

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await fetch(url, { ...init, cache: 'no-store', signal: timeout() });
  let body: Record<string, unknown> = {};
  try { body = (await r.json()) as Record<string, unknown>; } catch { /* respuesta no-JSON */ }
  return { status: r.status, body };
}

export type ResultadoVerificacion = { ok: boolean; detalle?: string; error?: string };

// ── un ping barato por servicio, con el estilo de auth real de cada lib ─────
const PINGS: Record<string, (v: Valores) => Promise<ResultadoVerificacion>> = {
  async meta(v) {
    const ver = process.env.META_API_VERSION || 'v24.0';
    const cuenta = v.META_AD_ACCOUNT_ID.startsWith('act_') ? v.META_AD_ACCOUNT_ID : `act_${v.META_AD_ACCOUNT_ID}`;
    const url = new URL(`https://graph.facebook.com/${ver}/${cuenta}`);
    url.searchParams.set('fields', 'name,account_status');
    url.searchParams.set('access_token', v.META_ACCESS_TOKEN);
    const { body } = await fetchJson(url.toString());
    const err = body.error as { code?: number; message?: string } | undefined;
    if (err) {
      if (err.code === 190) return { ok: false, error: 'Token inválido o expirado. Generá uno nuevo de usuario de sistema.' };
      return { ok: false, error: `Meta: ${err.message ?? 'error desconocido'}` };
    }
    return { ok: true, detalle: `Cuenta "${String(body.name ?? cuenta)}" encontrada.` };
  },

  async whatsapp(v) {
    const base = v.CHATWOOT_BASE_URL.replace(/\/$/, '');
    const { status, body } = await fetchJson(`${base}/api/v1/accounts/${v.CHATWOOT_ACCOUNT_ID}/inboxes`, {
      headers: { api_access_token: v.CHATWOOT_API_TOKEN, 'Content-Type': 'application/json' },
    });
    if (status === 401) return { ok: false, error: 'Access token inválido.' };
    if (status === 404) return { ok: false, error: 'Cuenta no encontrada — revisá la URL base y el ID de cuenta.' };
    if (status >= 400) return { ok: false, error: `Chatwoot respondió ${status}.` };
    const inboxes = (body.payload as unknown[] | undefined) ?? [];
    return { ok: true, detalle: `Conectado — ${inboxes.length} bandeja(s) de entrada.` };
  },

  async email(v) {
    const { status, body } = await fetchJson('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${v.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    });
    if (status === 401) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Resend respondió ${status}.` };
    const dominios = (body.data as Array<{ name?: string; status?: string }> | undefined) ?? [];
    const verificados = dominios.filter((d) => d.status === 'verified').map((d) => d.name).filter(Boolean);
    return {
      ok: true,
      detalle: verificados.length
        ? `Key válida — dominio(s) verificado(s): ${verificados.join(', ')}.`
        : 'Key válida, pero sin dominios verificados todavía (los envíos saldrán en modo sandbox).',
    };
  },

  async anthropic(v) {
    const { status } = await fetchJson('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': v.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    });
    if (status === 401) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Anthropic respondió ${status}.` };
    return { ok: true, detalle: 'Key válida — MaKo tiene cerebro.' };
  },

  async openai(v) {
    const { status } = await fetchJson('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${v.OPENAI_API_KEY}` },
    });
    if (status === 401) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `OpenAI respondió ${status}.` };
    return { ok: true, detalle: 'Key válida.' };
  },

  async fathom(v) {
    const { status } = await fetchJson('https://api.fathom.ai/external/v1/meetings?limit=1', {
      headers: { 'X-Api-Key': v.FATHOM_API_KEY, accept: 'application/json' },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida (¿tu plan de Fathom incluye API?).' };
    if (status >= 400) return { ok: false, error: `Fathom respondió ${status}.` };
    return { ok: true, detalle: 'Key válida — llamadas accesibles.' };
  },

  async panda(v) {
    // OJO: Panda lleva la key PELADA en Authorization, sin "Bearer".
    const { status, body } = await fetchJson('https://api-v2.pandavideo.com/videos?limit=1', {
      headers: { Authorization: v.PANDA_API_KEY },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida.' };
    if (status >= 400 || !('videos' in body)) return { ok: false, error: `Panda respondió ${status}.` };
    return { ok: true, detalle: 'Key válida.' };
  },

  async youtube(v) {
    const id = v.YOUTUBE_VSL_VIDEO_ID || 'dQw4w9WgXcQ'; // cualquier video público valida la key
    const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=${encodeURIComponent(id)}&key=${encodeURIComponent(v.YOUTUBE_API_KEY)}`;
    const { status, body } = await fetchJson(url);
    if (status === 400 || status === 403) return { ok: false, error: 'API key inválida o sin la YouTube Data API habilitada.' };
    if (status >= 400) return { ok: false, error: `YouTube respondió ${status}.` };
    const items = (body.items as unknown[] | undefined) ?? [];
    if (v.YOUTUBE_VSL_VIDEO_ID && items.length === 0) {
      return { ok: false, error: 'Key válida, pero el video no se encontró — revisá el ID.' };
    }
    return { ok: true, detalle: 'Key válida.' };
  },

  async calendly(v) {
    const { status, body } = await fetchJson('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${v.CALENDLY_API_TOKEN}`, 'Content-Type': 'application/json' },
    });
    if (status === 401) return { ok: false, error: 'Token inválido.' };
    if (status >= 400) return { ok: false, error: `Calendly respondió ${status}.` };
    const nombre = (body.resource as { name?: string } | undefined)?.name;
    return { ok: true, detalle: nombre ? `Conectado como ${nombre}.` : 'Token válido.' };
  },

  async google() {
    // Las credenciales de OAuth solo se validan con un login real.
    return { ok: true, detalle: 'Guardadas. Se validan al probar "Continuar con Google" en el login.' };
  },
};

/**
 * Verifica un servicio con los valores enviados (pisan a los guardados/env del
 * WORKSPACE actual — credWs resuelve por sesión/impersonación). Nunca lanza.
 */
export async function verificarServicio(
  servicioKey: string,
  enviados: Record<string, unknown> = {},
): Promise<ResultadoVerificacion> {
  const servicio = servicioMetodo(servicioKey);
  const ping = servicio ? PINGS[servicio.key] : undefined;
  if (!servicio || !ping) return { ok: false, error: 'servicio inválido' };

  // Valor efectivo por campo: lo enviado > lo guardado/env. Registramos si el
  // request definió el HOST del ping y si algún secreto vino de storage: probar
  // un host provisto por el request con secretos guardados exfiltraría esos
  // secretos a un destino arbitrario (SSRF + robo de token).
  const valores: Valores = {};
  const faltan: string[] = [];
  let hostDelRequest = false;
  let secretoDeStorage = false;
  for (const campo of servicio.campos) {
    const enviado = enviados[campo.env];
    const usoEnviado = typeof enviado === 'string' && !!enviado.trim();
    const v = usoEnviado ? (enviado as string).trim() : (await credWs(campo.env)) ?? '';
    if (v) valores[campo.env] = v;
    else if (!campo.opcional) faltan.push(campo.label);
    if (usoEnviado && campo.host) hostDelRequest = true;
    if (!usoEnviado && campo.secreto && v) secretoDeStorage = true;
  }
  if (hostDelRequest && secretoDeStorage) {
    return { ok: false, error: 'Para probar con una URL nueva, completá también las credenciales secretas de este servicio.' };
  }
  if (faltan.length) {
    return { ok: false, error: `Falta completar: ${faltan.join(', ')}.` };
  }

  try {
    return await ping(valores);
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError'
      ? 'El servicio no respondió a tiempo (8s) — revisá la URL o probá de nuevo.'
      : String(e instanceof Error ? e.message : e);
    return { ok: false, error: msg };
  }
}
