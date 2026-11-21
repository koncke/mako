# Buscar referentes por sector (mapa de tendencias, ronda 2)

Mercado: coaches, mentores e infoproductores HISPANOS que venden cursos, mentorías y servicios por Instagram y YouTube.
Buscamos referentes que HOY (noviembre de 2026) publican en ESPAÑOL sobre un sector, para relevar sus publicaciones de los
últimos 90 días. Sólo lectura: no inicies sesión, no escribas en ningún sitio, no descargues archivos.

**Ya tenemos** (no los repitas): todos los de `C:/dev/tendencias/referentes.json` (campo `nombre`, `instagram`, `youtube`).

**Lo que aprendió la ronda 1 (úsalo):**
- Las búsquedas genéricas («mejores expertos en X») devuelven listas de consultoras inventadas. Rinde más buscar VIDEOS de
  YouTube en español sobre el tema con fecha 2026 y sacar el canal: `https://www.youtube.com/oembed?url=<url del video>&format=json`
  da `author_name` y `author_url` (con el @).
- Para el Instagram, busca `site:instagram.com "<nombre>"` o el nombre con su tema; confirma con la bio (que hable del tema) y
  los seguidores. El @ obvio casi nunca es el bueno (`juanads` era un privado; el real era `juan_adss`).
- Un canal de YouTube se verifica corriendo `node C:/dev/tendencias/herramientas/yt-chequeo.mjs C:/dev/tendencias/yt-candidatos.json @handle1 @handle2`
  (dice si existe, la fecha del último video y cuántos de sus últimos 15 son de los últimos 90 días). Descarta los que no
  publican hace más de 90 días.
- Descarta: portugués, inglés, revendedores de cursos pirateados, cuentas de menos de 5.000 seguidores salvo que sean muy
  específicas del sector y publiquen seguido.

**Para cada referente nuevo:** `{nombre, sector, subsector?, instagram, youtube, seguidores_ig, pais, por_que (una línea: de qué
habla), activo (fecha del último video o publicación que viste), confianza (alta/media/baja), fuente (URL)}`.
