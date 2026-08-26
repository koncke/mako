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
let corriendo = false;

chrome.storage.local.get(['bearer', 'projectId'], (v) => {
  bearer = v.bearer || null;
  projectId = v.projectId || '';
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
  },
  { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*'] },
  ['requestHeaders'],
);

// ── El captcha ───────────────────────────────────────────────────────────────
// Se pide a la PÁGINA de Flow, que ya tiene el widget cargado. No hay ningún
// servicio de resolución de por medio: el token lo emite Google evaluando esta
// sesión, y si el comportamiento parece automatizado devuelve 403 — que es
// exactamente lo que tiene que pasar.

async function pedirCaptcha(action) {
  const [tab] = await chrome.tabs.query({ url: 'https://labs.google/fx/*tools/flow*' });
  if (!tab) throw new Error('NO_FLOW_TAB');
  const res = await chrome.tabs.sendMessage(tab.id, { tipo: 'GET_CAPTCHA', action, siteKey: SITE_KEY });
  if (!res || !res.token) throw new Error(res?.error || 'CAPTCHA_FALLO');
  return res.token;
}

// ── Ejecutar un trabajo contra Flow ──────────────────────────────────────────

const ACCION = {
  subir_imagen: 'uploadImage',
  generar_clip: 'batchAsyncGenerateVideo',
  estado_clips: 'batchCheckAsyncVideoGenerationStatus',
  creditos: 'getCredits',
};

async function ejecutar(trabajo) {
  const { path, body } = trabajo.pedido || {};
  if (typeof path !== 'string' || !path.startsWith('/v1')) {
    return { id: trabajo.id, ok: false, motivo: 'transitorio', error: 'pedido sin path válido', reintentable: false };
  }

  const captcha = await pedirCaptcha(ACCION[trabajo.tipo] || 'generate');
  const cuerpo = { ...(body || {}) };
  cuerpo.clientContext = {
    projectId,
    tool: 'PINHOLE',
    ...(cuerpo.clientContext || {}),
    recaptchaContext: { token: captcha },
  };

  const res = await fetch(`${FLOW_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    credentials: 'include',
    body: JSON.stringify(cuerpo),
  });

  const texto = await res.text();
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
