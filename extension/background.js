// =============================================================================
// El puente: pide trabajo a MaKo, lo ejecuta contra Flow, devuelve el resultado
// =============================================================================
// Corre en el navegador del CLIENTE, con SU cuenta de Google y SUS créditos. Por
// eso los medios no salen del presupuesto de MaKo y no hay una cuenta central
// que se pueda quemar.
//
// ⚠️ LO QUE ESTA EXTENSIÓN NO HACE, Y ES DELIBERADO
//
// FlowKit —de donde salió el protocolo— incluye un `sendTelemetry()` que cada
// 45-120 s le manda a Google eventos de uso INVENTADOS (latencias, scroll,
// aperturas de proyecto) con el comentario textual «to mimic normal browser
// behavior». Eso no es usar el mecanismo: es fabricar señales para que la
// detección de bots no vea la automatización.
//
// Acá no se replica. La contención es el RITMO, y lo dicta el server: MaKo manda
// `cooldownMs` en cada respuesta y esto lo respeta. A pulso de persona no hay
// nada que disimular.
//
// ⚠️ EL BEARER NUNCA SALE DE ESTA MÁQUINA. Se usa para llamar a Google y se
// guarda en `chrome.storage.local`. A MaKo solo le viaja el RESULTADO.

const MAKO = 'https://hola-mako.com';
const FLOW_BASE = 'https://aisandbox-pa.googleapis.com';
const SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

/** Lo pisa el server en cada respuesta. Este es solo el arranque. */
let cooldownMs = 10000;
let bearer = null;
let projectId = '';
let apiKey = '';
let corriendo = false;

chrome.storage.local.get(['bearer', 'projectId', 'apiKey'], (v) => {
  bearer = v.bearer || null;
  projectId = v.projectId || '';
  apiKey = v.apiKey || '';
});

// ── Capturar el token de la sesión ───────────────────────────────────────────
// No se "roba" nada: es el mismo Authorization que la página ya manda cuando el
// usuario aprieta generar en Flow. Se lee al pasar y se guarda para poder
// repetir la llamada sin que el usuario esté mirando.

chrome.webRequest.onBeforeSendHeaders.addListener(
  (det) => {
    for (const h of det.requestHeaders || []) {
      if (h.name.toLowerCase() !== 'authorization') continue;
      const v = h.value || '';
      if (!v.startsWith('Bearer ya29.')) continue;
      const nuevo = v.slice('Bearer '.length);
      if (nuevo !== bearer) {
        bearer = nuevo;
        chrome.storage.local.set({ bearer });
      }
    }
    // Y de paso, el projectId sale de la propia URL de las llamadas de imagen.
    const m = det.url.match(/\/v1\/projects\/([^/]+)\//);
    if (m && m[1] && m[1] !== projectId) {
      projectId = m[1];
      chrome.storage.local.set({ projectId });
    }

    // La API key del proyecto de Google, que Flow manda en el query de CADA
    // llamada (`?key=AIza…`). No es un secreto —viaja en la URL de una app web y
    // se ve en cualquier DevTools—, pero es OBLIGATORIA: sin ella `googleapis.com`
    // no sabe a qué proyecto atribuir el pedido y lo manda al bucket de tráfico no
    // identificado, que contesta la página de bloqueo. Ese fue el bug: se llamaba
    // a `/v1/credits` pelado porque el path salió de la documentación de useapi y
    // nunca se comparó contra el tráfico REAL de Flow.
    //
    // Se lee al pasar en vez de hardcodearla: si Google la rota, el que la tiene
    // al día es el navegador del cliente, no nuestro código.
    const k = det.url.match(/[?&]key=(AIza[A-Za-z0-9_-]{20,})/);
    if (k && k[1] && k[1] !== apiKey) {
      apiKey = k[1];
      chrome.storage.local.set({ apiKey });
    }
  },
  { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*'] },
  ['requestHeaders'],
);

// ── El captcha ───────────────────────────────────────────────────────────────
// Se pide a la PÁGINA de Flow, que ya tiene el widget cargado. No hay ningún
// servicio de resolución de por medio: el token lo emite Google evaluando esta
// sesión, y si el comportamiento parece automatizado devuelve 403 — que es
// exactamente lo que tiene que pasar.

async function pestanaDeFlow() {
  // `discarded: false` importa: Chrome duerme las pestañas que no se miran, y una
  // pestaña dormida sigue apareciendo en `query` con su URL pero sin ningún script
  // vivo adentro. Sin este filtro se elige una pestaña muerta habiendo otra sana.
  const abiertas = await chrome.tabs.query({ url: 'https://labs.google/fx/*tools/flow*', discarded: false });
  const tab = abiertas.find((t) => t.status === 'complete') || abiertas[0];
  if (!tab) throw new Error('NO_FLOW_TAB');
  return tab;
}

async function pedirCaptcha(tabId, action) {
  const res = await chrome.tabs.sendMessage(tabId, { tipo: 'GET_CAPTCHA', action, siteKey: SITE_KEY });
  if (!res || !res.token) throw new Error(res?.error || 'CAPTCHA_FALLO');
  return res.token;
}

// ── Ejecutar un trabajo contra Flow ──────────────────────────────────────────

/**
 * Los trabajos que solo LEEN. No llevan cuerpo, no llevan captcha, y si la página
 * ya preguntó lo mismo hace poco se contestan con su respuesta, sin tráfico.
 */
const SOLO_LECTURA = new Set(['creditos', 'estado_clips']);

const ACCION = {
  subir_imagen: 'uploadImage',
  generar_imagen: 'batchGenerateImages',
  generar_clip: 'batchAsyncGenerateVideo',
  estado_clips: 'batchCheckAsyncVideoGenerationStatus',
  creditos: 'getCredits',
};

async function ejecutar(trabajo) {
  const { path, body } = trabajo.pedido || {};
  if (typeof path !== 'string' || !path.startsWith('/v1')) {
    return { id: trabajo.id, ok: false, motivo: 'transitorio', error: 'pedido sin path válido', reintentable: false };
  }

  const tab = await pestanaDeFlow();

  // Los pedidos de LECTURA no llevan cuerpo, así que no llevan `recaptchaContext`
  // — y por lo tanto no hay que minar un token para ellos. Medido: `/v1/credits`
  // es un GET pelado. Pedir un `grecaptcha.execute()` cada 15 s sin que nadie
  // toque nada es, además, una señal de automatización por sí sola; hacerlo para
  // algo que ni siquiera lo usa era gratis en riesgo y caro en score.
  const soloLectura = SOLO_LECTURA.has(trabajo.tipo);

  let cuerpo = null;
  if (!soloLectura) {
    const captcha = await pedirCaptcha(tab.id, ACCION[trabajo.tipo] || 'generate');
    cuerpo = { ...(body || {}) };
    cuerpo.clientContext = {
      projectId,
      tool: 'PINHOLE',
      ...(cuerpo.clientContext || {}),
      recaptchaContext: { token: captcha },
    };
  }

  // ⚠️ EL PEDIDO NO SALE DE ACÁ, Y NO LO ARMAMOS NOSOTROS.
  //
  // Lo hace la PÁGINA de Flow, calcado del último pedido de la misma clase que la
  // propia app hizo (ver extension/injected.js). Dos razones, y las dos costaron:
  //
  //   1. Un `fetch` desde el service worker viaja con `Origin:
  //      chrome-extension://<id>` y sin las cookies del sitio. Google le contesta
  //      su página de bloqueo mientras la misma persona genera a mano sin problema:
  //      lo que rechaza tiene la forma exacta de un token robado.
  //   2. Reconstruir el pedido a mano es adivinar. El contrato salió de la doc de
  //      un tercero y le faltaba el `?key=` del proyecto; los headers que NO
  //      sabemos que faltan son peores, porque no hay a quién preguntarle.
  //
  // Con la plantilla se manda lo mismo que manda Flow. La `clase` es cómo se
  // encuentra: sale del último tramo del path (`/v1/credits` → `credits`).
  // ⚠️ Ya NO se arma la URL acá. La arma injected.js a partir de la plantilla: de
  // ahí salen el origen, el query (`?key=` incluido, y solo donde Flow lo manda) y
  // el método. Armarla acá y pasarla hecha fue el agujero de la primera versión
  // del espejo: se copiaba todo menos lo único que importaba.
  const clase = path.split('?')[0].split('/').filter(Boolean).pop() || '';
  const r = await chrome.tabs.sendMessage(tab.id, {
    tipo: 'HACER_FETCH', clase, path: path.split('?')[0], cuerpo, soloLectura, bearer,
  });
  if (!r || r.error) throw new Error(r?.error || 'FETCH_FALLO');

  const texto = String(r.texto || '');
  const res = { ok: r.status >= 200 && r.status < 300, status: r.status };
  let data = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { /* lo trata el server */ }

  // ⚠️ La extensión NO clasifica el fallo: manda el crudo y el status. Quien
  // decide si se reintenta es el server (`clasificarFalla`), porque es quien
  // sabe cuántos créditos hay en juego. Si el navegador pudiera decidirlo,
  // estaría decidiendo cuántas veces le pegamos a Google.
  if (!res.ok || (data && (data.error || (data.data && data.data.error)))) {
    return { id: trabajo.id, ok: false, status: res.status, data, error: texto.slice(0, 400) };
  }
  return { id: trabajo.id, ok: true, data };
}

// ── El ciclo ─────────────────────────────────────────────────────────────────

async function ciclo() {
  if (corriendo) return;
  corriendo = true;
  try {
    const { token } = await chrome.storage.local.get('token');
    if (!token) return;

    let estado = 'listo';
    let detalle = '';
    if (!bearer) {
      // No es un error: es que el usuario todavía no abrió Flow en esta sesión.
      estado = 'sin_sesion';
      detalle = 'Abre labs.google/fx/tools/flow e inicia sesión.';
    } else if (!apiKey) {
      // El bearer se ve en la PRIMERA llamada; la `key` también, pero si la
      // sesión venía guardada de antes y el usuario no volvió a navegar Flow,
      // puede haber bearer sin key. Sin key el pedido llega sin proyecto
      // atribuido y Google contesta su página de bloqueo — así que esto NO puede
      // reportarse como «listo»: sería un verde sobre algo que va a fallar.
      estado = 'sin_sesion';
      detalle = 'Recarga la pestaña de Google Flow para completar la conexión.';
    }

    // Qué pedidos vio la página. Viaja en `detalle` para que un fallo se pueda
    // diagnosticar mirando la base, sin pedirle a nadie otra captura de pantalla.
    if (estado === 'listo') {
      try {
        const tab = await pestanaDeFlow();
        const espia = await chrome.tabs.sendMessage(tab.id, { tipo: 'VER_ESPIA' });
        if (espia && espia.visto) detalle = JSON.stringify(espia.visto).slice(0, 3800);
      } catch { /* si no se puede espiar, no es motivo para no trabajar */ }
    }

    const pendientes = (await chrome.storage.local.get('pendientes')).pendientes || [];

    const res = await fetch(`${MAKO}/api/flow/puente`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-flow-token': token },
      body: JSON.stringify({ token, projectId, estado, detalle, resultados: pendientes, cuantos: 1 }),
    });
    if (!res.ok) return;

    const out = await res.json();
    // Los resultados ya viajaron: recién ahora se limpian. Si la request falló,
    // quedan y se reintentan — perder un resultado deja al cliente mirando
    // «generando…» sobre algo que en realidad terminó.
    await chrome.storage.local.set({ pendientes: [] });

    if (typeof out.cooldownMs === 'number') cooldownMs = out.cooldownMs;
    if (out.pausado || estado !== 'listo') return;

    const nuevos = [];
    for (const t of out.trabajos || []) {
      try {
        nuevos.push(await ejecutar(t));
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        nuevos.push({
          id: t.id,
          ok: false,
          motivo: msg === 'NO_FLOW_TAB' ? 'sin_sesion' : 'transitorio',
          error: msg,
          reintentable: true,
        });
      }
      // El ritmo que reemplaza al simulador de actividad humana.
      await new Promise((r) => setTimeout(r, cooldownMs));
    }
    if (nuevos.length) await chrome.storage.local.set({ pendientes: nuevos });
  } catch { /* la próxima vuelta reintenta */ } finally {
    corriendo = false;
  }
}

// El service worker MV3 se duerme: el alarm es lo que lo despierta. Con
// setInterval solo, el puente deja de existir a los 30 segundos sin que nada
// avise.
chrome.alarms.create('ciclo', { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'ciclo') void ciclo(); });
chrome.runtime.onMessage.addListener((msg, _s, responder) => {
  if (msg?.tipo === 'ESTADO') {
    responder({ conectado: !!bearer, projectId });
  }
  return true;
});
