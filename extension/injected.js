// Corre en el mundo de la PÁGINA de Flow (declarado con `world: MAIN` en el
// manifest), que es donde existen `window.grecaptcha`, las cookies del sitio y el
// `fetch` que usa la propia app.
//
// Hace tres cosas:
//
//   1. ESPÍA los pedidos que Flow hace a su API, y se guarda el último de cada
//      clase como PLANTILLA. Nada sale de la máquina: viven en memoria.
//   2. Pide el token de reCAPTCHA al widget que la página ya tiene cargado.
//   3. Hace nuestros pedidos **calcados de la plantilla**.
//
// ── Por qué se copia el pedido en vez de reconstruirlo ──────────────────────
// El contrato de esta API salió de la documentación de un tercero (useapi), y al
// compararlo contra el tráfico REAL de Flow apareció que le faltaba el `?key=` del
// proyecto. Ese fue un dato; los que no sabemos que nos faltan son el problema:
// headers `x-goog-*`, `x-client-data`, el `accept-language`, el shape exacto del
// cuerpo. Adivinarlos de a uno es lo que convirtió esto en cinco vueltas.
//
// Con la plantilla no hay nada que adivinar: se manda **lo mismo que manda Flow**,
// cambiando solo lo que tiene que cambiar. Y si Google cambia el contrato mañana,
// la plantilla cambia sola porque sale del tráfico de hoy.
//
// ⚠️ El envoltorio de `fetch` NO puede romper la app: todo lo que hace va dentro de
// try/catch y la promesa original se devuelve intacta, siempre. Si la captura
// falla, Flow sigue andando y nosotros nos quedamos sin plantilla — que es
// exactamente el orden de prioridades correcto.

(function () {
  const API = 'aisandbox-pa.googleapis.com';

  /** Última plantilla vista por clase de pedido. Solo en memoria. */
  const plantillas = new Map();
  /** Última respuesta vista, por clase. Sirve para no repetir pedidos de lectura. */
  const respuestas = new Map();

  /** La clase de un pedido sale de su path: `/v1/credits` → `credits`. */
  function claseDe(url) {
    try {
      const p = new URL(url, location.origin).pathname;
      return p.split('/').filter(Boolean).pop() || '';
    } catch { return ''; }
  }

  function headersAObjeto(h) {
    const out = {};
    try {
      if (!h) return out;
      if (typeof h.forEach === 'function') h.forEach((v, k) => { out[k] = v; });
      else if (Array.isArray(h)) for (const [k, v] of h) out[k] = v;
      else Object.assign(out, h);
    } catch { /* una plantilla incompleta es mejor que romper la página */ }
    return out;
  }

  const fetchOriginal = window.fetch;

  window.fetch = function (entrada, init) {
    const promesa = fetchOriginal.apply(this, arguments);
    try {
      const esRequest = typeof Request !== 'undefined' && entrada instanceof Request;
      const url = esRequest ? entrada.url : String(entrada || '');
      if (!url.includes(API)) return promesa;

      const clase = claseDe(url);
      const metodo = String((init && init.method) || (esRequest && entrada.method) || 'GET').toUpperCase();
      const headers = headersAObjeto((init && init.headers) || (esRequest && entrada.headers));
      // El cuerpo solo se guarda si es un string: clonar un Request para leer un
      // stream tiene costo y puede alterar el pedido de la app.
      const cuerpo = init && typeof init.body === 'string' ? init.body : null;

      plantillas.set(clase, { url, metodo, headers, cuerpo, cuando: Date.now() });

      // La RESPUESTA se guarda clonada, y solo de lo que es una lectura barata:
      // con esto una consulta de créditos no necesita un pedido nuestro.
      if (metodo === 'GET' || clase === 'credits') {
        promesa.then((res) => {
          try {
            res.clone().text().then(
              (t) => respuestas.set(clase, { status: res.status, texto: t.slice(0, 20000), cuando: Date.now() }),
              () => {},
            );
          } catch { /* ignorar */ }
        }, () => {});
      }
    } catch { /* NUNCA romper la app de Flow por nuestra captura */ }
    return promesa;
  };

  // ── reCAPTCHA ─────────────────────────────────────────────────────────────
  async function esperarGrecaptcha(ms) {
    const hasta = Date.now() + ms;
    while (Date.now() < hasta) {
      const g = window.grecaptcha;
      if (g?.enterprise?.execute) return g.enterprise;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  const responder = (evento, id, detail) =>
    window.dispatchEvent(new CustomEvent(evento, { detail: { id, ...detail } }));

  window.addEventListener('MAKO_CAPTCHA_PIDO', async (ev) => {
    const { id, action, siteKey } = ev.detail || {};
    try {
      const g = await esperarGrecaptcha(10000);
      if (!g) return responder('MAKO_CAPTCHA_OK', id, { error: 'SIN_GRECAPTCHA' });
      responder('MAKO_CAPTCHA_OK', id, { token: await g.execute(siteKey, { action: action || 'generate' }) });
    } catch (e) {
      responder('MAKO_CAPTCHA_OK', id, { error: String(e?.message || e) });
    }
  });

  // ── Qué vimos: lo que el service worker necesita para decidir ─────────────
  window.addEventListener('MAKO_ESPIA_PIDO', (ev) => {
    const { id } = ev.detail || {};
    const visto = {};
    for (const [clase, p] of plantillas) {
      // Los headers van con el NOMBRE pero sin el VALOR de lo que autentica: para
      // decidir qué falta alcanza con saber cuáles son, y así no se transporta una
      // credencial a ningún lado.
      visto[clase] = {
        metodo: p.metodo,
        url: p.url.replace(/key=[^&]+/, 'key=<oculta>'),
        headers: Object.keys(p.headers).sort(),
        tieneCuerpo: p.cuerpo != null,
        cuerpoMuestra: p.cuerpo ? p.cuerpo.slice(0, 400) : null,
        edadMs: Date.now() - p.cuando,
      };
    }
    responder('MAKO_ESPIA_OK', id, { visto });
  });

  // ── Nuestro pedido, calcado de la plantilla ───────────────────────────────
  window.addEventListener('MAKO_FETCH_PIDO', async (ev) => {
    const { id, clase, cuerpo, url: urlPedida, bearer } = ev.detail || {};
    try {
      const plantilla = plantillas.get(clase);

      // Si Flow acaba de pedir esto mismo y no cambiamos nada, se devuelve SU
      // respuesta. Cero tráfico extra, cero riesgo: el pedido que la produjo lo
      // hizo la app, no nosotros.
      const cache = respuestas.get(clase);
      if (!cuerpo && cache && Date.now() - cache.cuando < 120000) {
        return responder('MAKO_FETCH_OK', id, { status: cache.status, texto: cache.texto, deCache: true });
      }

      if (!plantilla) {
        // Sin plantilla no se inventa: se dice que falta. Reconstruir el pedido a
        // mano es exactamente lo que no funcionó.
        return responder('MAKO_FETCH_OK', id, { error: `SIN_PLANTILLA:${clase}` });
      }

      const headers = { ...plantilla.headers };
      if (bearer) headers.authorization = `Bearer ${bearer}`;
      const metodo = plantilla.metodo;
      const llevaCuerpo = metodo !== 'GET' && metodo !== 'HEAD';

      const res = await fetchOriginal.call(window, urlPedida || plantilla.url, {
        method: metodo,
        headers,
        credentials: 'include',
        ...(llevaCuerpo ? { body: JSON.stringify(cuerpo || {}) } : {}),
      });
      // El texto crudo viaja tal cual: si Google contesta HTML en vez de JSON, eso
      // ES el dato — es lo que delata un bloqueo, y parsearlo acá lo perdería.
      responder('MAKO_FETCH_OK', id, {
        status: res.status, texto: (await res.text()).slice(0, 20000), metodo,
      });
    } catch (e) {
      responder('MAKO_FETCH_OK', id, { error: String(e?.message || e) });
    }
  });
})();
