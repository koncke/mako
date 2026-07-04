# Snippet de tracking para la landing (Lovable)

Reemplaza **todo** el código de tracking actual de la landing por este bloque.
Pegalo una sola vez, al final del `<body>` (o como script global del proyecto
en Lovable). Es autosuficiente: crea la cookie del visitante, manda la visita
y escucha al player de Panda.

Qué agrega sobre la versión anterior:

- **pageview** con `landing_url` (URL exacta → pruebas A/B de landing) y `referrer`.
- **video_id + vsl_titulo** en cada evento del VSL (pruebas A/B de VSL en la
  misma landing; el título se lee del atributo `title` del iframe de Panda).
- **exit** con el % exacto donde estaba el video al salir (no el máximo visto).
- Camino 1 (`?l=<token>` del link de WhatsApp) se sigue mandando igual.
- Usa `fetch(..., { keepalive: true })` en vez de `sendBeacon` para que el JSON
  pase CORS y el evento de salida no se pierda.

Único paso manual: poné el dominio real del dashboard en `ENDPOINT`.

```html
<script>
(function () {
  var ENDPOINT = 'https://TU-DOMINIO/api/track/vsl'; // ← dominio del dashboard (Vercel)

  // ── visitor_id persistente (cookie de 1 año) ──────────────────────────────
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  var visitorId = getCookie('nqe_visitor_id');
  if (!visitorId) {
    visitorId = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    document.cookie = 'nqe_visitor_id=' + visitorId + '; max-age=31536000; path=/; SameSite=Lax';
  }

  // Camino 1: token de identidad del link de WhatsApp (?l=<meta_lead_id>)
  var leadToken = new URLSearchParams(location.search).get('l') || null;

  function enviar(data) {
    data.visitor_id = visitorId;
    if (leadToken) data.l = leadToken;
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true, // sobrevive a la navegación (evento exit)
      }).catch(function () {});
    } catch (e) { /* el tracking nunca rompe la landing */ }
  }

  // ── pageview: URL exacta (multi-landing) + referrer ───────────────────────
  enviar({
    tipo_evento: 'pageview',
    landing_url: location.href,
    referrer: document.referrer || null,
  });

  // ── VSL (Panda) ────────────────────────────────────────────────────────────
  // El título se lee del atributo title del iframe de Panda (si Lovable lo
  // renderiza sin title, agregale title="<nombre del VSL>" al embed y listo).
  function tituloVsl(videoId) {
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      var f = iframes[i];
      if (videoId && (f.src || '').indexOf(videoId) !== -1 && f.title) return f.title;
    }
    for (var j = 0; j < iframes.length; j++) {
      if (/pandavideo/i.test(iframes[j].src || '') && iframes[j].title) return iframes[j].title;
    }
    return null;
  }

  var yaPlay = false;
  var hitos = {};      // pNN ya enviados (cada 5%)
  var pctActual = 0;   // posición actual del video (para exit exacto)
  var duracion = 0;
  var lastVideoId = null;
  var lastTitulo = null;

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object' || String(d.message || '').indexOf('panda_') !== 0) return;
    if (d.video || d.videoId) {
      lastVideoId = d.video || d.videoId;
      lastTitulo = tituloVsl(lastVideoId) || lastTitulo;
    }

    if (d.message === 'panda_play' && !yaPlay) {
      yaPlay = true;
      enviar({ tipo_evento: 'play', porcentaje: 0, video_id: lastVideoId, vsl_titulo: lastTitulo });
    }

    if (d.message === 'panda_timeupdate' && d.currentTime != null) {
      if (d.duration) duracion = d.duration;
      if (!duracion) return;
      pctActual = Math.min(100, Math.round((d.currentTime / duracion) * 100));
      var hito = Math.floor(pctActual / 5) * 5; // hito de retención cada 5%
      if (hito >= 5 && !hitos[hito]) {
        hitos[hito] = true;
        enviar({ tipo_evento: 'p' + hito, porcentaje: pctActual, video_id: lastVideoId, vsl_titulo: lastTitulo });
      }
    }
  });

  // ── exit: punto exacto de abandono al salir de la página ──────────────────
  var exitEnviado = false;
  function alSalir() {
    if (exitEnviado || !yaPlay) return;
    exitEnviado = true;
    enviar({ tipo_evento: 'exit', porcentaje: pctActual, video_id: lastVideoId, vsl_titulo: lastTitulo });
  }
  window.addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') alSalir();
  });
})();
</script>
```

## Recomendado (opcional, del lado del dashboard)

En Vercel, setear `VSL_ALLOWED_ORIGINS` con el/los dominios de la landing
(separados por coma, ej. `https://landing.lovable.app,https://tudominio.com`)
para que nadie pueda envenenar las métricas desde otro sitio. Si no está
seteado, el endpoint acepta cualquier origen (comportamiento actual).
