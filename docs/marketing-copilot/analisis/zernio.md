# Zernio: qué datos de Instagram y YouTube se pueden traer (11/11/2026)

Fuentes: código de MaKo (`C:/dev/wt-copilot-pruebas`) y documentación pública de Zernio (docs.zernio.com, leída hoy). No se llamó a la API ni se conectó nada. Zernio es API propia (no envuelve la Graph API a la vista, pero sus páginas dicen que las reglas de las métricas son las de Meta/YouTube).

## Las 7 respuestas

**1. Estadísticas por publicación de Instagram: SÍ, con una duda.**
`GET /v1/analytics` trae por post: impresiones, alcance, vistas, me gusta, comentarios, compartidos, guardados, `engagementRate`; para reels además `igReelsAvgWatchTime`, `igReelsVideoViewTotalTime`, `reelsSkipRate`, `mediaProductType` (docs.zernio.com/analytics/get-analytics.mdx). MaKo ya lo lee: `lib/zernio-organico.ts:74` y `lib/organico-reglas.ts:188-189`.
Duda: `source` acepta `external` (posts "sincronizados de la plataforma"), pero la doc no dice explícitamente que los reels publicados a mano en Instagram entren. La página de sync (analytics/sync-external-posts.mdx) acepta URLs `instagram.com/p/` y `/reel/`. Alcance e impresiones llegan con ~24 h de atraso y devuelven 0 hasta entonces; MaKo ya los marca como «pendiente», no cero (`zernio-organico.ts:109-110`). NO SE PUDO SABER (sin llamada real) si traen todo el historial o sólo lo reciente.

**2. Estadísticas de la cuenta de Instagram: SÍ.**
`/v1/analytics/instagram/account-insights`: alcance, vistas, cuentas que interactuaron, interacciones, likes, comentarios, guardados, compartidos, visitas al perfil, clics al sitio, toques a links del perfil, follows/unfollows; máximo 90 días (30 si se conectó con Facebook Login); atraso hasta 48 h (docs.zernio.com/analytics/get-instagram-account-insights.mdx). Seguidores: `/v1/analytics/instagram/follower-history` y `/v1/accounts/follower-stats` (se refresca 1 vez al día). MaKo: `zernio-organico.ts:72-73`.

**3. Historias de Instagram: SÍ, pero sólo desde que se conecta.**
`GET /v1/accounts/{id}/instagram/stories` lista las activas (24 h); con `includeExpired=true` devuelve también las vencidas, pero sólo las que Zernio archivó mientras estaban vivas, es decir las publicadas DESPUÉS de conectar. Las anteriores no se recuperan. Medición por hora, lectura final a las 23 h. Métricas: vistas, alcance, respuestas, compartidos, toques adelante, toques atrás, salidas, deslizamientos, visitas al perfil, follows, reposts, interacciones totales. Meta pone 0 si son menos de 5. Una vencida no archivada puede venir `unavailable` (docs.zernio.com/instagram/list-instagram-stories.mdx y get-instagram-story-insights.mdx). MaKo no usa estas rutas hoy (búsqueda en `lib` y `app`: ninguna coincidencia).

**4. Biografía y link de la bio: NO SE PUDO SABER.**
Ni la doc de Instagram ni la de analytics mencionan bio; en el índice de la doc no aparece ninguna ruta de perfil. No hay uso en el código (`grep` de bio/biography en `lib/zernio*.ts`: nada). Lo más cercano: «toques a links del perfil» y «clics al sitio» en account-insights (no es la bio ni el link).

**5. YouTube: SÍ en parte.**
- Vistas por video y me gusta/comentarios: `/v1/analytics` (analytics/get-analytics.mdx).
- Retención por video: SÍ, `/v1/analytics/youtube/video-retention`, curva de hasta 100 puntos; atraso de 2-3 días, agregada sobre todo el rango (analytics/get-youtube-video-retention.mdx).
- Suscriptores: SÍ en el canal (ganados y perdidos), más vistas, minutos vistos y duración media, `/v1/analytics/youtube/channel-insights`, rango máximo 89 días; exige el permiso `yt-analytics.readonly` (si falta, 412 con link para reautorizar) (analytics/get-youtube-channel-insights.mdx). El total de suscriptores actual: NO SE PUDO SABER; sólo se documentan ganados/perdidos.
- CTR de miniatura e impresiones: NO. La doc dice que la API de YouTube Analytics v2 no los expone para ningún tipo de cuenta.
- Hay cuota diaria compartida del proyecto de Google de Zernio: un 429 puede llegar aunque uno haga pocas llamadas.
MaKo no llama a ninguna ruta de analytics de YouTube hoy; sólo lo lista como red conectable (`lib/zernio-redes.ts:52`).

**6. ¿Cuenta de empresa o creador? SÍ para Instagram.**
La página de Instagram dice «requires a Business or Creator account» (docs.zernio.com/platforms/instagram.mdx), y el listado de historias lo repite. La página de account-insights no menciona el requisito. Para YouTube sirve canal personal o Brand Account, y quien conecta debe ser dueño/manager (platforms/youtube.mdx).

**7. Límites y costos: SÍ conocidos, con una contradicción.**
- Precio (zernio.com/pricing): sin planes; 1-2 cuentas gratis, de la 3.ª a la 10.ª US$6/mes cada una, 11-100 US$3, 101+ US$1. La página dice que Analytics está incluido, sin complemento.
- La doc de la API dice: planes viejos (legacy) necesitan el complemento Analytics y sin él da 402 (los seguidores, 403); los planes por uso lo incluyen.
- CONTRADICCIÓN medida por MaKo: el 28/10 una clave dio 402 pidiendo el complemento (`lib/zernio-redes.ts:212`, `lib/organico-reglas.ts:17`). No se re-midió; hoy no se promete.
- Límites: `/analytics` hasta 366 días por llamada, 429 con ventana de 30 s y `Retry-After`; métricas sincronizadas ~1 vez por hora, caché de 60 min. No hay costo por llamada para Instagram/YouTube (el cobro por request es sólo de X).

## Qué YA usa MaKo de Zernio
- Conectar redes (`/v1/connect/{plataforma}`, `/v1/accounts`): `lib/zernio-redes.ts:11,26`, `lib/zernio-conectar.ts:17`.
- Orgánico de Instagram (tres rutas de la pregunta 1 y 2): `lib/zernio-organico.ts:72-74`; lo consume la operación `ver_rendimiento_redes` (`lib/api-mako/areas/contenido.run.ts:668`).
- Anuncios, insights de anuncios, leads, CAPI: `lib/zernio-ads.ts`, `lib/zernio-meta-cuerpo.ts:8-13`, `lib/zernio-lead.ts:16`.
- Comentarios y mensajes (inbox) y publicar: `lib/zernio.ts:556,582,600,626`. Facturación y uso: `lib/zernio-redes.ts:219`, `lib/zernio-uso.ts:9`.

## Qué cambia en el análisis si se conecta
Con el link pegado sólo hay lo público. Conectado se agrega: vistas, alcance, guardados y compartidos por reel (qué reel retiene: `reelsSkipRate`, tiempo medio), visitas al perfil y toques a links, crecimiento de seguidores por día, historias con toques/salidas/respuestas (sólo desde la conexión, y hay que capturarlas hasta las 24 h: no se reconstruyen), y en YouTube retención por video y suscriptores ganados/perdidos. Sigue sin haber CTR de miniatura. Hay que sumar al código las rutas de historias y YouTube, que hoy no existen.

## No se pudo confirmar
Bio y link de bio; si `source=external` trae reels publicados a mano y hasta qué antigüedad; total actual de suscriptores de YouTube; si hoy la clave de un negocio nuevo da 402 (contradicción precio vs. código); historias de Instagram con el login de Instagram (Meta manda el aviso final de forma más fiable con Facebook Login).
