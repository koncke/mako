// =============================================================================
// metodo-verificar — "Probar conexión" de una integración (lógica compartida)
// =============================================================================
// Hace el request MÁS BARATO que valida las credenciales de un servicio (el
// estilo exacto de auth de cada lib del repo: Meta por query param, Panda sin
// prefijo Bearer, etc.). Los valores
// enviados pisan a los guardados/env, así se puede probar ANTES de guardar.
// Timeout 8s por ping. La usan /api/metodo/verificar (super admin) y el wizard
// de onboarding (/api/onboarding, admin-cliente) — el GUARD lo pone cada ruta.

import 'server-only';
import { CALCOM_API, calcomHeaders } from './calcom';
import { errorDeMercadoPago, errorDeStripe, factsDeMercadoPago, factsDeStripe, factsDeCreem } from './cobros-conexion';
import { credWs } from './credenciales';
import { leerCuentaMp } from './mercadopago-api';
import { leerCuentaStripe } from './stripe-api';
import { probarClaveCreem } from './creem-api';
import { claveBaseDe } from './ia-keys';
import { servicioMetodo } from './metodo-catalogo';
import { normalizarCuentaMeta } from './meta-cuenta-id';
import { esKeySoloEnvio, KEY_SOLO_ENVIO_TUYA } from './resend-errores';
import { problemaDelRemitente } from './resend-remitente';
import { CLAVES_ZERNIO, slotDeClaveZernio } from './zernio-redes';

type Valores = Record<string, string>;

const timeout = () => AbortSignal.timeout(8000);

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await fetch(url, { ...init, cache: 'no-store', signal: timeout() });
  let body: Record<string, unknown> = {};
  try { body = (await r.json()) as Record<string, unknown>; } catch { /* respuesta no-JSON */ }
  return { status: r.status, body };
}

/**
 * `facts` = los datos REALES que el ping ya trajo, estructurados en vez de
 * interpolados en el string de `detalle`. Son la prueba de que quedó bien
 * conectado: un "ok ✓" no prueba nada, pero "Última llamada: Discovery con Juan"
 * hace que el cliente reconozca SU cuenta. Los pinta el aside negro
 * (PanelMarketing), que al recibirlos reemplaza el carrusel de marketing.
 *
 * Es aditivo: quien solo lee `detalle` no se entera.
 */
export type Fact = { k: string; v: string; c?: string };
export type ResultadoVerificacion = { ok: boolean; detalle?: string; error?: string; facts?: Fact[] };

/** Fecha corta y humana para los facts ("hace 2 días"). */
function haceCuanto(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const dias = Math.floor((Date.now() - t) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`;
}

// ── un ping barato por servicio, con el estilo de auth real de cada lib ─────
const PINGS: Record<string, (v: Valores) => Promise<ResultadoVerificacion>> = {
  async meta(v) {
    // Conectado por Zernio (25/10/2026) y sin token: se prueba por ahí (lib/meta-conexion-zernio.ts).
    if (!v.META_ACCESS_TOKEN && v.META_ZERNIO_CUENTA) {
      const { pingMetaPorZernio } = await import('./meta-conexion-zernio');
      return pingMetaPorZernio(v);
    }
    const ver = process.env.META_API_VERSION || 'v24.0';
    // ⚠️ Normaliza IGUAL que el guardado (lib/meta-cuenta-id.ts), y esa igualdad
    // es el punto: cuando cada lado normalizaba por su cuenta, este ping daba
    // verde sobre `act_123…` mientras la base se quedaba con `123…`.
    const cuenta = normalizarCuentaMeta(v.META_AD_ACCOUNT_ID);
    const url = new URL(`https://graph.facebook.com/${ver}/${cuenta}`);
    url.searchParams.set('fields', 'name,account_status');
    url.searchParams.set('access_token', v.META_ACCESS_TOKEN);
    const { body } = await fetchJson(url.toString());
    const err = body.error as { code?: number; message?: string } | undefined;
    if (err) {
      if (err.code === 190) return { ok: false, error: 'Token inválido o expirado. Genera uno nuevo de usuario de sistema.' };
      return { ok: false, error: `Meta: ${err.message ?? 'error desconocido'}` };
    }
    // account_status 1 = activa; 3 = con restricción de pago (lib/meta-health).
    const activa = Number(body.account_status) === 1;
    const facts: Fact[] = [
      { k: 'Tu cuenta de ads', v: String(body.name ?? cuenta) },
      { k: 'Estado', v: activa ? 'Activa' : 'Con restricción', c: activa ? 'var(--good)' : 'var(--warn)' },
    ];

    // Los campos OPCIONALES también se prueban de verdad. Antes solo se pingueaba
    // la cuenta publicitaria: un token de página o un píxel mal pegados quedaban en
    // verde y explotaban después — el de la página explota DENTRO del webhook, que
    // igual devuelve 200, así que Meta no reintenta y el lead se pierde en silencio.
    const avisos: string[] = [];

    if (v.META_PAGE_ID) {
      // El token de página (si lo hay) es el que tiene que poder leer la página.
      const tokenPagina = v.META_PAGE_ACCESS_TOKEN || v.META_ACCESS_TOKEN;
      const u = new URL(`https://graph.facebook.com/${ver}/${v.META_PAGE_ID}`);
      u.searchParams.set('fields', 'name');
      u.searchParams.set('access_token', tokenPagina);
      const r = await fetchJson(u.toString());
      const e = r.body.error as { message?: string } | undefined;
      if (e) avisos.push(`la página (${v.META_PAGE_ID}) no responde: ${e.message ?? 'error'}`);
      else facts.push({ k: 'Tu página', v: String(r.body.name ?? v.META_PAGE_ID) });
    }

    if (v.META_PIXEL_ID) {
      const pixel = async (token: string) => {
        const u = new URL(`https://graph.facebook.com/${ver}/${v.META_PIXEL_ID}`);
        u.searchParams.set('fields', 'name,last_fired_time');
        u.searchParams.set('access_token', token);
        const r = await fetchJson(u.toString());
        return { r, e: r.body.error as { message?: string } | undefined };
      };
      // Se prueba con el token que CAPI va a usar de verdad: el propio si lo
      // cargaron, si no el principal (lib/meta-capi.ts hace el mismo fallback).
      const propio = v.META_CAPI_TOKEN && v.META_CAPI_TOKEN !== v.META_ACCESS_TOKEN;
      let { r, e } = await pixel(v.META_CAPI_TOKEN || v.META_ACCESS_TOKEN);
      if (e && propio) {
        // El token de CAPI cargado a mano no llega al píxel. Si el principal SÍ,
        // el arreglo es de un clic — decirlo, en vez de dejar un error críptico.
        const alt = await pixel(v.META_ACCESS_TOKEN);
        if (!alt.e) {
          avisos.push('el token de Conversions API que cargaste no llega a tu píxel; quítalo y MaKo usa el token principal, que sí funciona');
          ({ r, e } = alt);
        }
      }
      if (e) avisos.push(`el píxel (${v.META_PIXEL_ID}) no responde con ese token: ${e.message ?? 'error'}`);
      else {
        facts.push({ k: 'Tu píxel', v: String(r.body.name ?? v.META_PIXEL_ID) });
        const ult = haceCuanto(r.body.last_fired_time as string | undefined);
        if (ult) facts.push({ k: 'Último evento del píxel', v: ult });
      }
    }

    // Un campo opcional roto NO tumba la conexión (ads sigue andando), pero se
    // dice fuerte: el silencio es justo lo que hacía que se perdieran leads.
    return {
      ok: true,
      detalle: avisos.length
        ? `Cuenta "${String(body.name ?? cuenta)}" conectada, pero ${avisos.join(' y ')}.`
        : `Cuenta "${String(body.name ?? cuenta)}" encontrada.`,
      facts,
    };
  },

  async email(v) {
    const { status, body } = await fetchJson('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${v.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    });
    // Una key de SÓLO ENVÍO no es inválida (#875): manda, pero no deja ver ni verificar el dominio del remitente, y
    // sin eso cada envío desde un dominio sin verificar fallaría callado. Se dice cuál crear.
    if (status === 401 && esKeySoloEnvio(body)) return { ok: false, error: KEY_SOLO_ENVIO_TUYA };
    if (status === 401) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Resend respondió ${status}.` };
    const dominios = (body.data as Array<{ name?: string; status?: string }> | undefined) ?? [];
    // El remitente se juzga contra ESTA cuenta (la key de este ping), antes de guardar: un dominio
    // que no está o no verificó hace fallar cada envío después, sin que la pantalla lo diga.
    const problema = problemaDelRemitente(v.RESEND_FROM, dominios);
    if (problema) return { ok: false, error: problema };
    const verificados = dominios.filter((d) => d.status === 'verified').map((d) => d.name).filter(Boolean);
    return {
      ok: true,
      detalle: verificados.length
        ? `Key válida — dominio(s) verificado(s): ${verificados.join(', ')}.`
        : 'Key válida, pero sin dominios verificados todavía (los envíos saldrán en modo sandbox).',
      facts: verificados.length
        ? [{ k: 'Tu dominio verificado', v: verificados.join(', '), c: 'var(--good)' }]
        : [{ k: 'Dominios verificados', v: 'Ninguno todavía', c: 'var(--warn)' },
           { k: 'Mientras tanto', v: 'Los envíos salen en modo sandbox' }],
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

  async groq(v) {
    // Groq es OpenAI-compatible: /openai/v1/models con Bearer.
    const { status } = await fetchJson('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${v.GROQ_API_KEY}` },
    });
    if (status === 401) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Groq respondió ${status}.` };
    return { ok: true, detalle: 'Key válida.' };
  },

  async gemini(v) {
    // Gemini expone un endpoint OpenAI-compatible: /openai/models con Bearer.
    const { status } = await fetchJson('https://generativelanguage.googleapis.com/v1beta/openai/models', {
      headers: { Authorization: `Bearer ${v.GEMINI_API_KEY}` },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Gemini respondió ${status}.` };
    return { ok: true, detalle: 'Key válida — MaKo puede usar Gemini Flash.' };
  },

  // IA8 (22/10/2026): sin Cerebras, Mistral ni OpenRouter: se sacaron del producto (docs/hallazgos-ia.md).

  // Apple no tiene un «¿anda esta clave?» sin mandar un aviso de verdad: se mira lo que se puede sin tocar a nadie, campo por
  // campo (se guardan de a uno): los dos ids y que la .p8 sea una clave privada. La prueba real es «Probar avisos» en un iPhone.
  async 'apple-push'(v) {
    const id = /^[A-Z0-9]{10}$/;
    const keyId = (v.APNS_KEY_ID ?? '').trim();
    const teamId = (v.APNS_TEAM_ID ?? '').trim();
    const p8 = (v.APNS_P8 ?? '').trim();
    if (!keyId && !teamId && !p8) return { ok: false, error: 'Falta la clave de Apple Push.' };
    if (keyId && !id.test(keyId)) return { ok: false, error: 'El Key ID son 10 letras y números.' };
    if (teamId && !id.test(teamId)) return { ok: false, error: 'El Team ID son 10 letras y números.' };
    if (p8) {
      const { clavesApnsDe } = await import('./push-apns-reglas');
      const { createPrivateKey } = await import('node:crypto');
      const c = clavesApnsDe({ keyId: keyId || 'AAAAAAAAAA', teamId: teamId || 'AAAAAAAAAA', p8 });
      try {
        if (!c) throw new Error('sin clave');
        createPrivateKey(c.p8);
      } catch {
        return { ok: false, error: 'No pude leer la clave .p8. Pega el archivo entero.' };
      }
    }
    return { ok: true, detalle: 'El formato está bien. Se comprueba de verdad con el primer aviso.' };
  },
  // El vigía de las aprobaciones (lib/vigia-aprobaciones-fuentes.ts): con las tres claves, la misma lectura que hace cada hora.
  // Un 403 es la clave sin acceso a la app (el rol), no una clave rota: se dice cuál de las dos.
  async 'app-store-connect'(v) {
    const issuerId = (v.ASC_ISSUER_ID ?? '').trim();
    const keyId = (v.ASC_KEY_ID ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(issuerId)) return { ok: false, error: 'El Issuer ID es el código largo con guiones.' };
    if (!/^[A-Z0-9]{10}$/.test(keyId)) return { ok: false, error: 'El Key ID son 10 letras y números.' };
    const { pemPkcs8 } = await import('./push-apns-reglas');
    const { jwtAsc } = await import('./vigia-aprobaciones-fuentes');
    const { APPLE_ID_APP } = await import('./vigia-aprobaciones');
    const p8 = pemPkcs8(v.ASC_P8);
    let jwt: string;
    try {
      if (!p8) throw new Error('sin clave');
      jwt = jwtAsc({ issuerId, keyId, p8 }, Date.now());
    } catch {
      return { ok: false, error: 'No pude leer la clave .p8. Pega el archivo entero.' };
    }
    const { status, body } = await fetchJson(`https://api.appstoreconnect.apple.com/v1/apps/${APPLE_ID_APP}?fields[apps]=name,bundleId`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (status === 401) return { ok: false, error: 'Apple no aceptó la clave: revisa el Issuer ID, el Key ID y que la clave no esté revocada.' };
    if (status === 403) return { ok: false, error: 'La clave no tiene acceso a la app de MaKo: dale el acceso «Developer».' };
    if (status === 404) return { ok: false, error: 'Apple no encuentra la app de MaKo con esta clave: ¿es del equipo de la cuenta de Apple de MaKo?' };
    if (status >= 400) return { ok: false, error: `App Store Connect respondió ${status}.` };
    const nombre = String(((body.data as { attributes?: { name?: unknown } } | undefined)?.attributes?.name) ?? '');
    return { ok: true, facts: nombre ? [{ k: 'App', v: nombre, c: 'ok' as const }] : [] };
  },
  async 'tiendas-google'(v) {
    const crudo = (v.TIENDAS_GOOGLE_CUENTA_SERVICIO ?? '').trim();
    let sa: { client_email: string; private_key: string; private_key_id?: string; token_uri?: string };
    try {
      const j = JSON.parse(crudo) as Record<string, unknown>;
      if (typeof j.client_email !== 'string' || typeof j.private_key !== 'string') throw new Error('incompleta');
      sa = {
        client_email: j.client_email, private_key: j.private_key,
        private_key_id: typeof j.private_key_id === 'string' ? j.private_key_id : undefined,
        token_uri: typeof j.token_uri === 'string' ? j.token_uri : undefined,
      };
    } catch {
      return { ok: false, error: 'No es el archivo .json de una cuenta de servicio. Pégalo entero, con las llaves.' };
    }
    const { jwtCuentaServicio } = await import('./vigia-aprobaciones-fuentes');
    let jwt: string;
    try { jwt = jwtCuentaServicio(sa, Date.now()); } catch { return { ok: false, error: 'No pude leer la clave privada del archivo .json.' }; }
    const r = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString(),
      cache: 'no-store', signal: timeout(),
    });
    if (!r.ok) return { ok: false, error: `Google no aceptó la cuenta de servicio (${r.status}): ¿la clave está activa?` };
    return {
      ok: true,
      facts: [{ k: 'Cuenta', v: sa.client_email, c: 'ok' as const }],
      detalle: 'La cuenta entra. Que pueda leer cada tienda depende de haberla invitado en Play Console y sumado en la Chrome Web Store.',
    };
  },
  async github(v) {
    const tk = v.GITHUB_TOKEN;
    if (!tk) return { ok: false, error: 'Falta el token.' };
    const repo = v.GITHUB_REPO || 'koncke/mako';
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`, {
        headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 401) return { ok: false, error: 'El token no es válido o venció.' };
      if (r.status === 403) return { ok: false, error: 'El token es válido pero no tiene permiso de lectura sobre ese repo.' };
      if (r.status === 404) return { ok: false, error: `No encuentro el repo «${repo}». Revisa el nombre y que el token lo tenga seleccionado.` };
      if (!r.ok) return { ok: false, error: `GitHub respondió ${r.status}.` };
      const j = await r.json() as Array<{ sha?: string; commit?: { message?: string; author?: { date?: string } } }>;
      const c = j[0];
      const facts = c ? [
        { k: 'Repo', v: repo, c: 'ok' as const },
        { k: 'Último commit', v: `${String(c.sha ?? '').slice(0, 8)} — ${String(c.commit?.message ?? '').split('\n')[0].slice(0, 60)}`, c: 'ok' as const },
      ] : [];
      return { ok: true, facts };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  /**
   * ⚠️ EJERCITA LAS DOS OPERACIONES REALES, Y NO GASTA UN SOLO CARÁCTER.
   *
   * El ping viejo miraba `/v1/user` y caía a `/v1/models`. Los dos son baratos y
   * los dos dan VERDE sobre una cuenta que no puede generar ni un segundo de
   * audio. Medido dos veces sobre la misma cuenta, con dos causas opuestas:
   *
   *   22/08/2026 · `/v1/voices` → 200 con las cinco voces clonadas, y
   *                `/v1/user/subscription` → 401 `payment_issue`. La factura
   *                estaba impaga: crear un clon SÍ funcionaba, convertir NO.
   *   02/09/2026 · `/v1/user/subscription` → 401 `missing_permissions`, y
   *                `/v1/models` → **200 con la lista VACÍA**. La cuenta estaba
   *                perfecta: la key no tenía esos dos permisos de lectura.
   *
   * ⚠️ El segundo es la trampa que casi cierra el tema al revés: 200 con lista
   * vacía se lee como «esta cuenta no puede hacer voice conversion». Cero
   * resultados es una respuesta, no un hecho.
   *
   * La técnica: se manda el pedido REAL a propósito SIN cuerpo. Si falta el
   * permiso, ElevenLabs contesta 401 antes de mirar el cuerpo; si está, contesta
   * **422 «Field required»**. O sea que se comprueba la operación que se va a
   * usar —la regla de la casa— sin crear una voz ni consumir cuota.
   */
  // Quién es esa cuenta: no corre ningún actor, así que comprobar la clave no gasta nada.
  async 'apify-instagram'(v) {
    const r = await fetchJson('https://api.apify.com/v2/users/me', { headers: { Authorization: `Bearer ${v.APIFY_INSTAGRAM_TOKEN}` } });
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'Ese token no entra a Apify.' };
    if (r.status !== 200) return { ok: false, error: `Apify respondió ${r.status}.` };
    return { ok: true };
  },
  async elevenlabs(v) {
    const h = { 'xi-api-key': v.ELEVENLABS_API_KEY };
    const json = { ...h, accept: 'application/json' };

    // Hace falta UNA voz para armar la ruta del speech-to-speech. Sirve cualquiera
    // de las premade: así la comprobación no depende de que ya exista un clon.
    const vs = await fetchJson('https://api.elevenlabs.io/v1/voices', { headers: json });
    if (vs.status === 401) return { ok: false, error: 'API key inválida.' };
    if (vs.status !== 200) return { ok: false, error: `ElevenLabs respondió ${vs.status} al listar las voces.` };
    const voces = ((vs.body as { voices?: { voice_id: string; category?: string; name?: string }[] }).voices) ?? [];
    const alguna = voces[0]?.voice_id;
    if (!alguna) return { ok: false, error: 'La cuenta de ElevenLabs no tiene ninguna voz.' };

    const sondear = async (url: string) => {
      const r = await fetch(url, { method: 'POST', headers: h, body: new FormData() });
      const t = await r.text();
      let d: Record<string, unknown> = {};
      try {
        const j = JSON.parse(t) as { detail?: unknown };
        if (j.detail && typeof j.detail === 'object' && !Array.isArray(j.detail)) d = j.detail as Record<string, unknown>;
      } catch { /* la respuesta útil de este sondeo es el STATUS */ }
      // 422 = «te falta el cuerpo», o sea que el permiso está.
      return { puede: r.status === 422, status: r.status, code: String(d.code ?? ''), tipo: String(d.type ?? '') };
    };

    const [clonar, convertir] = await Promise.all([
      sondear('https://api.elevenlabs.io/v1/voices/add'),
      sondear(`https://api.elevenlabs.io/v1/speech-to-speech/${alguna}`),
    ]);

    // ⚠️ SE LEE `detail.code`, NO EL STATUS: los dos 401 de arriba mandan a hacer
    // cosas opuestas —pagar una factura contra editar los permisos de la key— y
    // colapsarlos manda a arreglar lo que no era.
    const impago = [clonar, convertir].find((x) => /payment/i.test(x.code) || /payment/i.test(x.tipo));
    if (impago) {
      return { ok: false, error: 'La suscripción de ElevenLabs tiene un pago pendiente: la cuenta puede leer, pero no generar audio.' };
    }
    if (!convertir.puede) {
      return { ok: false, error: `La key no puede convertir voz (Speech to Speech): ElevenLabs respondió ${convertir.status}. Actívale ese permiso en elevenlabs.io.` };
    }
    if (!clonar.puede) {
      return { ok: false, error: `La key no puede crear clones de voz: ElevenLabs respondió ${clonar.status}. Actívale «Voices» con escritura.` };
    }

    // La recompensa es el dato real de la cuenta, no un tilde. Los clones que ya
    // están son lo que de verdad importa saber: son el techo del plan.
    const clonadas = voces.filter((x) => x.category === 'cloned').length;
    const facts: Fact[] = [
      { k: 'Puede clonar y convertir', v: 'Sí', c: 'var(--good)' },
      { k: 'Voces clonadas en la cuenta', v: String(clonadas) },
    ];
    const u = await fetchJson('https://api.elevenlabs.io/v1/user/subscription', { headers: json });
    if (u.status === 200) {
      const sub = u.body as { tier?: string; character_count?: number; character_limit?: number };
      if (sub.tier) facts.push({ k: 'Tu plan', v: sub.tier });
      if (typeof sub.character_count === 'number' && typeof sub.character_limit === 'number') {
        facts.push({ k: 'Caracteres del mes', v: `${sub.character_count.toLocaleString('es-MX')} / ${sub.character_limit.toLocaleString('es-MX')}` });
      }
    }
    return { ok: true, detalle: 'Key válida — MaKo puede clonar voces y convertir audio.', facts };
  },
  // Los otros grabadores de reuniones (26/10/2026, lib/grabadores): leer UNA reunión con la clave, como Fathom. Las respuestas
  // a una clave mala se midieron ese día contra las APIs reales (docs/hallazgos-integraciones.md).
  async tldv(v) {
    const { status, body } = await fetchJson('https://pasta.tldv.io/v1alpha1/meetings?limit=1', { headers: { 'x-api-key': v.TLDV_API_KEY, accept: 'application/json' } });
    // Medido: falta de key y key mala dan el MISMO 401 (AuthorizationRequiredError).
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida (¿tu plan de tl;dv es Pro o Business?).' };
    if (status >= 400 || !Array.isArray(body.results)) return { ok: false, error: `tl;dv respondió ${status}.` };
    const u = (body.results as Array<{ name?: string; happenedAt?: string }>)[0];
    const cuando = haceCuanto(u?.happenedAt);
    return { ok: true, detalle: 'Key válida.', facts: u?.name ? [{ k: 'Tu última reunión', v: cuando ? `${u.name} · ${cuando}` : u.name, c: 'var(--good)' }] : [{ k: 'Reuniones', v: 'Key válida, sin reuniones todavía', c: 'var(--warn)' }] };
  },

  async fireflies(v) {
    const { status, body } = await fetchJson('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${v.FIREFLIES_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ transcripts(limit: 1) { title date } }' }),
    });
    // ⚠️ Una key mala contesta 500 con `auth_failed`, no 401 (medido el 26/10/2026).
    const errores = Array.isArray(body.errors) ? (body.errors as Array<{ code?: string; message?: string }>) : [];
    if (status === 401 || status === 403 || errores.some((e) => e.code === 'auth_failed')) return { ok: false, error: 'API key inválida.' };
    if (status >= 400 || errores.length) return { ok: false, error: `Fireflies respondió ${status}${errores[0]?.message ? `: ${errores[0].message}` : ''}.` };
    const lista = ((body.data as { transcripts?: Array<{ title?: string; date?: number }> } | undefined)?.transcripts) ?? [];
    const u = lista[0];
    const cuando = u?.date ? haceCuanto(new Date(u.date).toISOString()) : null;
    return { ok: true, detalle: 'Key válida.', facts: u?.title ? [{ k: 'Tu última reunión', v: cuando ? `${u.title} · ${cuando}` : u.title, c: 'var(--good)' }] : [{ k: 'Reuniones', v: 'Key válida, sin reuniones todavía', c: 'var(--warn)' }] };
  },

  async zoom(v) {
    const cuenta = (v.ZOOM_ACCOUNT_ID ?? '').trim();
    const basic = Buffer.from(`${(v.ZOOM_CLIENT_ID ?? '').trim()}:${(v.ZOOM_CLIENT_SECRET ?? '').trim()}`).toString('base64');
    const tok = await fetchJson(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(cuenta)}`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
    // Medido: credenciales malas = 400 «Invalid client_id or client_secret»; una cuenta que no es = 400 también.
    if (tok.status >= 400 || typeof tok.body.access_token !== 'string') {
      return { ok: false, error: `Zoom no aceptó la app${typeof tok.body.reason === 'string' ? `: ${tok.body.reason}` : ''}. Revisa los tres datos y que la app esté activada.` };
    }
    const desde = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    const { status, body } = await fetchJson(`https://api.zoom.us/v2/users/me/recordings?from=${desde}&page_size=1`, { headers: { Authorization: `Bearer ${tok.body.access_token}` } });
    if (status === 401 || status === 403 || (status === 400 && /scope/i.test(String(body.message ?? '')))) {
      return { ok: false, error: 'La app entra, pero no tiene permiso de leer las grabaciones: suma los scopes de "cloud_recording".' };
    }
    if (status >= 400 || !Array.isArray(body.meetings)) return { ok: false, error: `Zoom respondió ${status}${body.message ? `: ${String(body.message)}` : ''}.` };
    const u = (body.meetings as Array<{ topic?: string; start_time?: string }>)[0];
    const cuando = haceCuanto(u?.start_time);
    return { ok: true, detalle: 'App válida.', facts: u?.topic ? [{ k: 'Tu última grabación en la nube', v: cuando ? `${u.topic} · ${cuando}` : u.topic, c: 'var(--good)' }] : [{ k: 'Grabaciones', v: 'Sin grabaciones en la nube en los últimos 30 días', c: 'var(--warn)' }] };
  },

  async otter(v) {
    const { status, body } = await fetchJson('https://api.otter.ai/v1/conversations?limit=1', { headers: { Authorization: `Bearer ${v.OTTER_API_KEY}`, accept: 'application/json' } });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida (la API de Otter es sólo del plan Enterprise).' };
    if (status >= 400) return { ok: false, error: `Otter respondió ${status}.` };
    const lista = Array.isArray(body.data) ? body.data : Array.isArray(body.conversations) ? body.conversations : null;
    // La forma de la lista no se pudo medir sin una cuenta Enterprise: si no es la esperada, se dice (no «sin reuniones»).
    if (!lista) return { ok: false, error: `Otter contestó con una forma que MaKo no conoce (${Object.keys(body).join(', ') || 'vacía'}). Avísanos.` };
    const u = (lista as Array<{ title?: string; created_at?: string }>)[0];
    const cuando = haceCuanto(u?.created_at);
    return { ok: true, detalle: 'Key válida.', facts: u?.title ? [{ k: 'Tu última conversación', v: cuando ? `${u.title} · ${cuando}` : u.title, c: 'var(--good)' }] : [{ k: 'Conversaciones', v: 'Key válida, sin conversaciones todavía', c: 'var(--warn)' }] };
  },

  async fathom(v) {
    const { status, body } = await fetchJson('https://api.fathom.ai/external/v1/meetings?limit=1', {
      headers: { 'X-Api-Key': v.FATHOM_API_KEY, accept: 'application/json' },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida (¿tu plan de Fathom incluye API?).' };
    if (status >= 400) return { ok: false, error: `Fathom respondió ${status}.` };
    // Ya teníamos la reunión en la mano y la tirábamos. Que vea el título de SU
    // última llamada confirma al toque que la key ve las grabaciones correctas.
    const items = (body.items as Array<{ title?: string; meeting_title?: string; created_at?: string; started_at?: string }> | undefined) ?? [];
    const u = items[0];
    const titulo = u?.title ?? u?.meeting_title;
    const cuando = haceCuanto(u?.created_at ?? u?.started_at);
    const facts: Fact[] = titulo
      ? [{ k: 'Tu última llamada grabada', v: cuando ? `${titulo} · ${cuando}` : titulo, c: 'var(--good)' }]
      : [{ k: 'Llamadas accesibles', v: 'Sí, pero todavía no hay ninguna grabada' , c: 'var(--warn)' }];
    return { ok: true, detalle: 'Key válida — llamadas accesibles.', facts };
  },

  async panda(v) {
    // OJO: Panda lleva la key PELADA en Authorization, sin "Bearer".
    const { status, body } = await fetchJson('https://api-v2.pandavideo.com/videos?limit=1', {
      headers: { Authorization: v.PANDA_API_KEY },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida.' };
    if (status >= 400 || !('videos' in body)) return { ok: false, error: `Panda respondió ${status}.` };
    const vids = (body.videos as Array<{ title?: string }> | undefined) ?? [];
    return {
      ok: true,
      detalle: 'Key válida.',
      facts: vids[0]?.title
        ? [{ k: 'Tu último video', v: vids[0].title!, c: 'var(--good)' }]
        : [{ k: 'Biblioteca', v: 'Key válida, sin videos todavía', c: 'var(--warn)' }],
    };
  },

  // Los otros alojadores de video (25/10/2026, lib/alojadores-video.ts): leer UN video de la lista con la clave.
  async vimeo(v) {
    const { status, body } = await fetchJson('https://api.vimeo.com/me/videos?per_page=1&fields=name', {
      headers: { Authorization: `bearer ${v.VIMEO_TOKEN}`, Accept: 'application/vnd.vimeo.*+json;version=3.4' },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'Token inválido, o sin permiso para ver tus videos ("Private").' };
    if (status >= 400 || !Array.isArray(body.data)) return { ok: false, error: `Vimeo respondió ${status}.` };
    const v0 = (body.data as Array<{ name?: string }>)[0];
    return { ok: true, detalle: 'Token válido.', facts: v0?.name ? [{ k: 'Tu último video', v: v0.name, c: 'var(--good)' }] : [{ k: 'Videos', v: 'Token válido, sin videos todavía', c: 'var(--warn)' }] };
  },

  async wistia(v) {
    const { status, body } = await fetchJson('https://api.wistia.com/v1/medias.json?per_page=1', { headers: { Authorization: `Bearer ${v.WISTIA_TOKEN}` } });
    if (status === 401 || status === 403) return { ok: false, error: 'Token inválido, o sin permiso de leer ("Read all data").' };
    const lista = body as unknown;
    if (status >= 400 || !Array.isArray(lista)) return { ok: false, error: `Wistia respondió ${status}.` };
    const m0 = (lista as Array<{ name?: string }>)[0];
    return { ok: true, detalle: 'Token válido.', facts: m0?.name ? [{ k: 'Tu último video', v: m0.name, c: 'var(--good)' }] : [{ k: 'Videos', v: 'Token válido, sin videos todavía', c: 'var(--warn)' }] };
  },

  async bunny(v) {
    const lib = (v.BUNNY_STREAM_LIBRARY ?? '').trim();
    if (!/^\d{1,12}$/.test(lib)) return { ok: false, error: 'El Library ID es un número (está en "API", en tu biblioteca).' };
    const { status, body } = await fetchJson(`https://video.bunnycdn.com/library/${lib}/videos?page=1&itemsPerPage=1`, { headers: { AccessKey: v.BUNNY_STREAM_KEY } });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida: va la de la BIBLIOTECA, no la de tu cuenta.' };
    if (status === 404) return { ok: false, error: 'No hay una biblioteca con ese Library ID.' };
    if (status >= 400 || !Array.isArray(body.items)) return { ok: false, error: `Bunny respondió ${status}.` };
    const i0 = (body.items as Array<{ title?: string }>)[0];
    return { ok: true, detalle: 'Clave válida.', facts: i0?.title ? [{ k: 'Tu último video', v: i0.title, c: 'var(--good)' }] : [{ k: 'Videos', v: 'Biblioteca vacía todavía', c: 'var(--warn)' }] };
  },

  async cloudflare(v) {
    const cuenta = (v.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
    if (!/^[0-9a-f]{32}$/i.test(cuenta)) return { ok: false, error: 'El Account ID son 32 letras y números (está en "Stream", a la derecha).' };
    const { status, body } = await fetchJson(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/stream?limit=1`, { headers: { Authorization: `Bearer ${v.CLOUDFLARE_STREAM_TOKEN}` } });
    // ⚠️ Un token con forma rara NO da 401: da 400 con el código 9106 «Authentication failed» (medido el 25/10/2026). Uno
    // con buena forma pero inexistente da 401 (10000). Los dos son «el token no sirve».
    const codigos = Array.isArray(body.errors) ? (body.errors as Array<{ code?: number }>).map((e) => e.code) : [];
    if (status === 401 || status === 403 || codigos.includes(9106) || codigos.includes(10000)) return { ok: false, error: 'Token inválido, o sin el permiso "Stream" → "Read" en esa cuenta.' };
    if (status >= 400 || body.success !== true || !Array.isArray(body.result)) return { ok: false, error: `Cloudflare respondió ${status}.` };
    const r0 = (body.result as Array<{ meta?: { name?: string } }>)[0];
    return { ok: true, detalle: 'Token válido.', facts: r0?.meta?.name ? [{ k: 'Tu último video', v: r0.meta.name, c: 'var(--good)' }] : [{ k: 'Videos', v: 'Token válido, sin videos todavía', c: 'var(--warn)' }] };
  },

  async youtube(v) {
    const id = v.YOUTUBE_VSL_VIDEO_ID || 'dQw4w9WgXcQ'; // cualquier video público valida la key
    // Sin clave propia (ya no se pide, 27/10/2026) se prueba el VIDEO con la de MaKo: lo que importa es que se encuentre.
    const { claveDeYoutube } = await import('./youtube');
    const clave = v.YOUTUBE_API_KEY || (await claveDeYoutube());
    if (!clave) return { ok: false, error: 'MaKo no tiene su clave de YouTube cargada. Avísale a Soporte.' };
    const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=${encodeURIComponent(id)}&key=${encodeURIComponent(clave)}`;
    const { status, body } = await fetchJson(url);
    if (status === 400 || status === 403) return { ok: false, error: 'API key inválida o sin la YouTube Data API habilitada.' };
    if (status >= 400) return { ok: false, error: `YouTube respondió ${status}.` };
    const items = (body.items as unknown[] | undefined) ?? [];
    if (v.YOUTUBE_VSL_VIDEO_ID && items.length === 0) {
      return { ok: false, error: 'Key válida, pero el video no se encontró — revisa el ID.' };
    }
    return { ok: true, detalle: 'Key válida.' };
  },

  async calendly(v) {
    const { status, body } = await fetchJson('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${v.CALENDLY_API_TOKEN}`, 'Content-Type': 'application/json' },
    });
    if (status === 401) return { ok: false, error: 'Token inválido.' };
    if (status >= 400) return { ok: false, error: `Calendly respondió ${status}.` };
    const r = body.resource as { name?: string; email?: string; scheduling_url?: string } | undefined;
    const facts: Fact[] = [];
    if (r?.name) facts.push({ k: 'Conectado como', v: r.name, c: 'var(--good)' });
    if (r?.email) facts.push({ k: 'Cuenta', v: r.email });
    if (r?.scheduling_url) facts.push({ k: 'Tu agenda', v: r.scheduling_url.replace(/^https?:\/\//, '') });
    return { ok: true, detalle: r?.name ? `Conectado como ${r.name}.` : 'Token válido.', facts };
  },

  // Instagram y Messenger por Zernio (volvió el 09/10/2026 como canal de las automatizaciones). El
  // ping SÓLO lee (GET /profiles): registrar el webhook y reclamar las cuentas lo hace el editor de
  // la tarjeta (POST /api/zernio, «estado»), que es donde se elige la cuenta.
  async zernio(v) {
    const key = (v.ZERNIO_API_KEY ?? '').trim();
    // La key es OBLIGATORIA desde el 23/10/2026 (sin respaldo de la plataforma): sin ella no hay Zernio, y el ping no puede
    // contestar «anda» (la API de MaKo reusa este ping para decir si la integración responde).
    if (!key) return { ok: false, error: 'Falta la API key de Zernio.' };
    // VARIAS CLAVES (29/10/2026): se prueba CADA una que vino (el servidor completa con las guardadas, así que pegar la 2 trae
    // también la 1) y se dice cuál falla. Probar sólo la 1 daba «anda» a una clave 2 rota.
    const claves = CLAVES_ZERNIO.map((env) => ({ env, valor: (v[env] ?? '').trim() })).filter((x) => x.valor);
    let body: Record<string, unknown> = {};
    for (const k of claves) {
      const r = await fetchJson('https://zernio.com/api/v1/profiles', {
        headers: { authorization: `Bearer ${k.valor}`, 'content-type': 'application/json' },
      });
      const cual = k.env === 'ZERNIO_API_KEY' ? 'Esa API key' : `La API key de Zernio ${slotDeClaveZernio(k.env)}`;
      if (r.status === 401 || r.status === 403) return { ok: false, error: `${cual} no es válida. Cópiala de nuevo desde Zernio.` };
      if (r.status >= 400) return { ok: false, error: `Zernio respondió ${r.status}${k.env === 'ZERNIO_API_KEY' ? '' : ` con la clave ${slotDeClaveZernio(k.env)}`}.` };
      if (k.env === 'ZERNIO_API_KEY') body = r.body;
    }
    const perfiles = (body.profiles as Array<{ name?: string }> | undefined) ?? [];
    return {
      ok: true,
      detalle: 'Key válida.',
      facts: perfiles.length
        ? [{ k: 'Perfiles', v: perfiles.map((x) => x.name).filter(Boolean).join(' · ') || String(perfiles.length), c: 'var(--good)' }]
        : [{ k: 'Perfiles', v: 'Ninguno todavía', c: 'var(--warn)' }],
    };
  },

  // ⚠️ ESTE ES EL TERCER REGISTRO, Y ME LO SALTEÉ. El aviso de más arriba lo dice
  // con todas las letras y aun así la integración de Cal.com salió a producción con
  // el catálogo y los campos puestos y SIN verificador: el tilde de cada campo
  // prueba antes de guardar, así que el cliente no podía guardar NADA y lo único
  // que veía era «servicio inválido No la guardé» — un mensaje que culpa al
  // servicio que él acaba de elegir bien.
  async calcom(v) {
    const key = (v.CALCOM_API_KEY ?? '').trim();
    const secret = (v.CALCOM_WEBHOOK_SECRET ?? '').trim();

    // ⚠️ EL SECRET NO SE PUEDE COMPROBAR CONTRA NADIE, y está bien que así sea: lo
    // ELIGE el cliente y se pega en los dos lados. No hay a quién preguntarle si es
    // correcto hasta que llegue la primera reserva. Rechazarlo por no poder
    // comprobarlo sería impedirle guardar justo el campo del que depende TODO —
    // sin secret no entra una sola reserva.
    if (!key) {
      if (!secret) return { ok: false, error: 'Falta el secret del webhook: sin eso no entra ninguna reserva.' };
      return {
        ok: true,
        // ⚠️ El detalle describe el ESTADO del servicio, no la acción que se acaba de
        // hacer: este mismo ping corre al guardar CUALQUIER campo, así que un
        // «secret guardado» aparecía también al guardar el tipo de evento.
        detalle: 'Tu contraseña está guardada. Las reservas empiezan a entrar en cuanto pegues la dirección dentro de Cal.com.',
        facts: [{ k: 'Reservas en vivo', v: 'Listas, cuando pegues la dirección en Cal.com', c: 'var(--good)' }],
      };
    }

    // Con API key sí hay a quién preguntarle. v2 obligatoria: la v1 se apagó el
    // 8/4/2026, así que una key válida contra v1 hoy devolvería 404 igual.
    const { status, body } = await fetchJson(`${CALCOM_API.base}/me`, { headers: calcomHeaders(key) });
    if (status === 401 || status === 403) return { ok: false, error: 'Esa API key no es válida. Cópiala de nuevo desde Settings → Developer → API keys.' };
    if (status >= 400) return { ok: false, error: `Cal.com respondió ${status}.` };
    // La forma de la respuesta cambió entre versiones: puede venir plana o
    // envuelta en `data`. Se prueban las dos antes de decir que no vino nada.
    const d = (body.data ?? body) as { username?: string; email?: string; name?: string } | undefined;
    const facts: Fact[] = [];
    const quien = d?.name || d?.username;
    if (quien) facts.push({ k: 'Conectado como', v: quien, c: 'var(--good)' });
    if (d?.email) facts.push({ k: 'Cuenta', v: d.email });
    if (d?.username) facts.push({ k: 'Tu agenda', v: `cal.com/${d.username}` });
    facts.push(secret
      ? { k: 'Reservas en vivo', v: 'Listas, cuando pegues la dirección en Cal.com', c: 'var(--good)' }
      : { k: 'Reservas en vivo', v: 'Falta el secret del webhook', c: 'var(--warn)' });
    return { ok: true, detalle: quien ? `Conectado como ${quien}.` : 'API key válida.', facts };
  },

  // ── La pasarela de pagos (11/10/2026) ──────────────────────────────────────
  // Le pegan al proveedor DE VERDAD (GET /v1/account, GET /users/me) y leen el estado en el
  // cuerpo, no sólo el status. Los textos de error y los facts viven en lib/cobros-conexion.ts,
  // que es lo que corre al guardar la clave: el tilde y el descubrimiento dicen lo mismo.
  //
  // ⚠️ Este ping NO corre al pegar la clave: el formulario la manda directo al descubrimiento,
  // porque con los campos derivados todavía vacíos `verificarServicio` contestaría «Falta
  // completar» y el tilde genérico la guardaría SIN probar. Corre al probar una conexión ya
  // hecha (el enchufe de la fila, la API de MaKo) y al guardar la clave del aviso de Mercado Pago.
  async stripe(v) {
    const r = await leerCuentaStripe(v.STRIPE_SECRET_KEY);
    if (!r.ok) return { ok: false, error: errorDeStripe(r, v.STRIPE_SECRET_KEY) };
    // La clave de OTRA cuenta con el ruteo de esta: los links se crearían en una cuenta y sus
    // avisos llegarían a nombre de otra. Se cambia de cuenta quitando la clave y pegando la nueva.
    if (v.STRIPE_ACCOUNT_ID && r.id !== v.STRIPE_ACCOUNT_ID) {
      return { ok: false, error: 'Esa clave es de otra cuenta de Stripe. Para cambiar de cuenta, quita la clave guardada y pega la nueva.' };
    }
    const facts = factsDeStripe(r, !!v.STRIPE_WEBHOOK_SECRET);
    const modo = r.modo === 'prueba' ? ' (modo prueba)' : '';
    return { ok: true, detalle: r.cobrosHabilitados ? `Conectada a tu cuenta de Stripe${modo}.` : `Clave válida${modo}, pero tu cuenta todavía no puede cobrar: termina de activarla en Stripe.`, facts };
  },

  async mercadopago(v) {
    const r = await leerCuentaMp(v.MERCADOPAGO_ACCESS_TOKEN);
    if (!r.ok) return { ok: false, error: errorDeMercadoPago(r) };
    if (v.MERCADOPAGO_USER_ID && r.id !== v.MERCADOPAGO_USER_ID) {
      return { ok: false, error: 'Ese access token es de otra cuenta de Mercado Pago. Para cambiar de cuenta, quita el token guardado y pega el nuevo.' };
    }
    // La clave del aviso NO se puede comprobar contra nadie (sólo existe en el panel de Mercado
    // Pago y no hay API que la devuelva): como el secret de Cal.com, se dice que está, no que anda.
    const facts = factsDeMercadoPago(r, !!v.MERCADOPAGO_WEBHOOK_SECRET);
    return { ok: true, detalle: `Conectada a tu cuenta de Mercado Pago${r.modo === 'prueba' ? ' (modo prueba)' : ''}.`, facts };
  },

  // Creem (31/10/2026). ⚠️ SU PING NO PUEDE PREGUNTAR «¿DE QUIÉN ES ESTA CLAVE?» como los dos de arriba: Creem no
  // tiene ningún endpoint que devuelva la identidad de la cuenta (Stripe tiene `GET /v1/account`, Mercado Pago
  // `GET /users/me`). Así que lo que se prueba es que la clave FUNCIONE, con una lectura inofensiva y vacía en una
  // cuenta nueva (`GET /v1/products/search`, verificado en producción el 31/10/2026: 200 con `items: []`).
  // Y lo que ata la clave a su cuenta no es un id que Creem nos dé: es el id del endpoint de aviso que MaKo registró
  // en ella (`CREEM_WEBHOOK_ID`), que es lo que rutea sus avisos.
  async creem(v) {
    const r = await probarClaveCreem(v.CREEM_API_KEY);
    if (!r.ok) return { ok: false, error: r.error };
    const facts = factsDeCreem({ modo: r.modo }, v.CREEM_WEBHOOK_ID ?? null, !!v.CREEM_WEBHOOK_SECRET);
    const modo = r.modo === 'prueba' ? ' (modo prueba)' : '';
    // Sin el secreto del aviso NO entra ningún pago: el webhook de Creem es fail-closed a propósito. Se dice.
    return v.CREEM_WEBHOOK_SECRET
      ? { ok: true, detalle: `Conectada a tu cuenta de Creem${modo}. Creem se encarga de los impuestos de cada país.`, facts }
      : { ok: false, error: 'La clave sirve, pero falta el aviso de pagos. Vuelve a guardar la clave para que MaKo lo registre: sin él, ningún pago entra a tu CRM.' };
  },

  // (Hotmart, Skool y Apify tenían su ping acá: salieron el 25/10/2026 con el Leads Scraper.)

  // google: NO tiene ping. Salió del catálogo (es la app OAuth de la agencia,
  // no una credencial que el cliente cargue) → verificarServicio('google') corta
  // antes, en servicioMetodo(). Su estado se mide en lib/integraciones.ts por
  // señal real: existe el refresh token del workspace.
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
  // ── Probar una cuenta EXTRA prueba ESA cuenta, no la primera ───────────────
  // Los pings leen la clave BASE (`v.GEMINI_API_KEY`). Sin esto, pegar la segunda
  // key y apretar el tilde pingueaba la PRIMERA —la que ya estaba guardada— y
  // devolvía "Key válida": una key rota entraba pintada de verde, que es el mismo
  // antipatrón de la credencial que se ve conectada y no se usa. La extra tipeada
  // pisa a la base SOLO para este ping; lo que se guarda sigue siendo su propia fila.
  const extra = servicio.campos.find((c) => (c.slot ?? 1) > 1 && typeof enviados[c.env] === 'string' && (enviados[c.env] as string).trim());
  if (extra) valores[claveBaseDe(extra.env)] = (enviados[extra.env] as string).trim();

  if (hostDelRequest && secretoDeStorage) {
    return { ok: false, error: 'Para probar con una URL nueva, completa también las credenciales secretas de este servicio.' };
  }
  // Meta por Zernio: la conexión reemplaza al token (`metaConectadaConCampos`). Sin esto, un negocio conectado por Zernio no
  // podía guardar ni su píxel: el tilde decía «Falta completar: Access token».
  const porZernio = servicio.key === 'meta' && !!valores.META_ZERNIO_CUENTA && !valores.META_ACCESS_TOKEN;
  const etiquetaToken = servicio.campos.find((c) => c.env === 'META_ACCESS_TOKEN')?.label;
  const faltanDeVerdad = porZernio ? faltan.filter((l) => l !== etiquetaToken) : faltan;
  if (faltanDeVerdad.length) {
    return { ok: false, error: `Falta completar: ${faltanDeVerdad.join(', ')}.` };
  }

  try {
    return await ping(valores);
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError'
      ? 'El servicio no respondió a tiempo (8s) — revisa la URL o prueba de nuevo.'
      : String(e instanceof Error ? e.message : e);
    return { ok: false, error: msg };
  }
}
