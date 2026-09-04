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
import { normalizarProjectId } from './clarity';
import { CALCOM_API, calcomHeaders } from './calcom';
import { credWs } from './credenciales';
import { claveBaseDe } from './ia-keys';
import { servicioMetodo } from './metodo-catalogo';
import { esCanalWhatsapp } from './chatwoot-canales';
import { normalizarCuentaMeta } from './meta-cuenta-id';

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

  async whatsapp(v) {
    const base = v.CHATWOOT_BASE_URL.replace(/\/$/, '');
    const { status, body } = await fetchJson(`${base}/api/v1/accounts/${v.CHATWOOT_ACCOUNT_ID}/inboxes`, {
      headers: { api_access_token: v.CHATWOOT_API_TOKEN, 'Content-Type': 'application/json' },
    });
    if (status === 401) return { ok: false, error: 'Access token inválido.' };
    if (status === 404) return { ok: false, error: 'Cuenta no encontrada — revisa la URL base y el ID de cuenta.' };
    if (status >= 400) return { ok: false, error: `Chatwoot respondió ${status}.` };
    const inboxes = (body.payload as Array<{ name?: string; channel_type?: string; phone_number?: string }> | undefined) ?? [];
    // El de WhatsApp es el que importa: es el que va a espejar los chats.
    // Chatwoot devuelve el nombre de la clase Ruby — 'Channel::Whatsapp', con W
    // mayúscula—, así que el `.includes('whatsapp')` que había acá NUNCA matcheaba
    // y se caía a `inboxes[0]`: con un solo inbox eso da la respuesta correcta por
    // casualidad, y con dos rotula «tu bandeja de WhatsApp» sobre la de Instagram.
    const wa = inboxes.find((i) => esCanalWhatsapp(i.channel_type)) ?? inboxes[0];
    const facts: Fact[] = [{ k: 'Bandejas', v: String(inboxes.length) }];
    if (wa?.name) facts.unshift({ k: 'Tu bandeja de WhatsApp', v: wa.name });
    if (wa?.phone_number) facts.push({ k: 'Número conectado', v: wa.phone_number });
    return { ok: true, detalle: `Conectado — ${inboxes.length} bandeja(s) de entrada.`, facts };
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

  async cerebras(v) {
    // Cerebras es OpenAI-compatible: /v1/models con Bearer valida la key.
    const { status } = await fetchJson('https://api.cerebras.ai/v1/models', {
      headers: { Authorization: `Bearer ${v.CEREBRAS_API_KEY}` },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Cerebras respondió ${status}.` };
    return { ok: true, detalle: 'Key válida — MaKo puede rotar a Cerebras.' };
  },

  async mistral(v) {
    // Mistral es OpenAI-compatible: /v1/models con Bearer valida la key.
    const { status } = await fetchJson('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${v.MISTRAL_API_KEY}` },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `Mistral respondió ${status}.` };
    return { ok: true, detalle: 'Key válida — MaKo puede rotar a Mistral.' };
  },

  async openrouter(v) {
    // OJO: en OpenRouter /models es PÚBLICO (no valida la key). Para validar de
    // verdad pegamos a /key, que devuelve la info de ESTA key y responde 401 si
    // es inválida. De paso mostramos el saldo/límite como fact.
    const { status, body } = await fetchJson('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${v.OPENROUTER_API_KEY}` },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida.' };
    if (status >= 400) return { ok: false, error: `OpenRouter respondió ${status}.` };
    const d = body.data as { label?: string; usage?: number; limit?: number | null } | undefined;
    const facts: Fact[] = [];
    if (d?.label) facts.push({ k: 'Tu key', v: d.label, c: 'var(--good)' });
    if (d && typeof d.usage === 'number') facts.push({ k: 'Uso', v: d.limit == null ? `$${d.usage} (sin tope)` : `$${d.usage} / $${d.limit}` });
    return { ok: true, detalle: 'Key válida — MaKo puede rotar a OpenRouter.', facts };
  },

  // La verificación NO puede mentir: pega contra el repo de verdad. Si el token venció
  // o no tiene permiso, se entera acá y no tres semanas después, cuando nadie note que
  // dejaron de llegar propuestas de cierre.
  async github(v) {
    const tk = v.GITHUB_TOKEN;
    if (!tk) return { ok: false, error: 'Falta el token.' };
    const repo = v.GITHUB_REPO || 'mbustos-digital/dashboard-marketing';
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

  async whop(v) {
    // /accounts/me es el único endpoint que la key identifica sola: todos los
    // demás exigen company_id, que justamente sale de acá.
    const { status, body } = await fetchJson('https://api.whop.com/api/v1/accounts/me', {
      headers: { Authorization: `Bearer ${v.WHOP_API_KEY}`, accept: 'application/json' },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'API key inválida o sin permisos.' };
    if (status >= 400) return { ok: false, error: `Whop respondió ${status}.` };
    const biz = body as { id?: string; title?: string };
    if (!biz.id) return { ok: false, error: 'Whop no devolvió a qué negocio pertenece la key.' };

    // Mostrar el NOMBRE del negocio es lo único que delata al toque haber pegado
    // la key de otra cuenta: un «válida» a secas se ve igual en los dos casos.
    const facts: Fact[] = [{ k: 'Tu negocio en Whop', v: biz.title || biz.id, c: 'var(--good)' }];

    // Cuántas clases hay cargadas. Una key válida sobre una cuenta vacía es el
    // estado más confuso posible: todo verde y nada que mostrarle al cliente.
    const cursos = await fetchJson(`https://api.whop.com/api/v1/courses?company_id=${encodeURIComponent(biz.id)}`, {
      headers: { Authorization: `Bearer ${v.WHOP_API_KEY}`, accept: 'application/json' },
    });
    const lista = (cursos.body?.data as Array<{ title?: string }> | undefined) ?? [];
    facts.push(lista.length
      ? { k: 'Programas cargados', v: lista.map(c => c.title).filter(Boolean).join(' · ') || String(lista.length), c: 'var(--good)' }
      : { k: 'Programas cargados', v: 'Ninguno todavía', c: 'var(--warn)' });

    return { ok: true, detalle: 'Key válida — Whop accesible.', facts };
  },

  // ⚠️ SIN ESTO LA BARRA DICE «servicio inválido». Es el TERCER registro que
  // necesita una integración: el catálogo de tarjetas, el del método (qué campos
  // pide) y este (cómo se comprueba). El tilde prueba ANTES de guardar, así que
  // faltando el verificador no se puede guardar nada — y el mensaje culpa al
  // servicio, no al verificador que falta.
  async clarity(v) {
    // ⚠️ SE ACEPTA LA URL ENTERA. El lugar donde todo el mundo tiene el id a mano
    // es la barra de direcciones del panel, no Settings → Overview — y antes eso
    // rebotaba con «eso no parece un ID». Un formulario que entiende lo que la
    // persona tenía a mano vale más que uno que exige el formato correcto.
    const pid = normalizarProjectId(v.CLARITY_PROJECT_ID);
    if (!pid) {
      return { ok: false, error: (v.CLARITY_PROJECT_ID ?? '').trim()
        ? 'No reconozco ese ID. Pega el código corto o la dirección completa del panel de Clarity.'
        : 'Falta el ID del proyecto.' };
    }
    const token = (v.CLARITY_API_TOKEN ?? '').trim();
    // Sin token todavía, el ID igual se guarda: el token se pega en el campo de
    // abajo y frenar acá obligaría a cargarlos en un orden que nadie adivina.
    if (!token) return { ok: true, detalle: 'ID válido. Falta el token para traer el resumen.' };

    const { status, body } = await fetchJson('https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (status === 401) return { ok: false, error: 'El token no es válido o venció.' };
    // ⚠️ El 402 es la CUOTA agotada (10 consultas por día), no un token malo. Sin
    // distinguirlo, el mensaje manda a regenerar un token que está perfecto.
    if (status === 402) return { ok: true, detalle: 'Guardado. Hoy ya se usaron las 10 consultas diarias de Clarity, así que el resumen llega mañana.' };
    if (status >= 400) return { ok: false, error: `Clarity respondió ${status}.` };
    const filas = Array.isArray(body) ? body : [];
    const traf = filas.find((x: Record<string, unknown>) => x.metricName === 'Traffic') as { information?: Array<Record<string, unknown>> } | undefined;
    const ses = Number(traf?.information?.[0]?.totalSessionCount);
    return {
      ok: true,
      detalle: 'Conectado.',
      facts: Number.isFinite(ses)
        ? [{ k: 'Sesiones ayer', v: String(ses), c: ses > 0 ? 'var(--good)' : 'var(--warn)' }]
        : undefined,
    };
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

  async youtube(v) {
    const id = v.YOUTUBE_VSL_VIDEO_ID || 'dQw4w9WgXcQ'; // cualquier video público valida la key
    const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=${encodeURIComponent(id)}&key=${encodeURIComponent(v.YOUTUBE_API_KEY)}`;
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

  // ⚠️ ZERNIO TAMPOCO TENÍA PING, y el bug ya estaba vivo: quien intentara conectar
  // Instagram veía «servicio inválido No la guardé» y no podía guardar la key. Lo
  // encontró el test de los tres registros (tests/integracion-tres-registros.test.ts),
  // escrito a raíz del mismo problema en Cal.com.
  async zernio(v) {
    const key = (v.ZERNIO_API_KEY ?? '').trim();
    // ⚠️ La key es OPCIONAL a propósito: sin key propia, lib/zernio.ts cae a la de
    // plataforma y el aislamiento lo da el profile por workspace. Así que «sin key»
    // NO es un error — es el modo normal, y decirle que falta algo sería mentirle.
    if (!key) {
      return { ok: true, detalle: 'Sin key propia: Instagram funciona con la cuenta de la agencia.',
        facts: [{ k: 'Cuenta', v: 'La de la agencia (compartida)' }] };
    }
    const { status, body } = await fetchJson('https://zernio.com/api/v1/profiles', {
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    });
    if (status === 401 || status === 403) return { ok: false, error: 'Esa API key no es válida. Cópiala de nuevo desde tu panel de Zernio.' };
    if (status >= 400) return { ok: false, error: `Zernio respondió ${status}.` };
    const perfiles = (body.profiles as Array<{ name?: string }> | undefined) ?? [];
    return {
      ok: true,
      detalle: 'Key válida — Zernio accesible.',
      facts: perfiles.length
        ? [{ k: 'Perfiles en tu cuenta', v: perfiles.map((x) => x.name).filter(Boolean).join(' · ') || String(perfiles.length), c: 'var(--good)' }]
        : [{ k: 'Perfiles en tu cuenta', v: 'Ninguno todavía', c: 'var(--warn)' }],
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
  if (faltan.length) {
    return { ok: false, error: `Falta completar: ${faltan.join(', ')}.` };
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
