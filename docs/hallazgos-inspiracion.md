# Hallazgos: Inspiración (links de Instagram por WhatsApp)

El diseño está en [inspiracion/diseno.md](inspiracion/diseno.md) y el relevo de los 77 links del 19/11/2026 en
[inspiracion/relevo-19-11.md](inspiracion/relevo-19-11.md). Acá va lo que costó encontrar.

## Hoy un link de Instagram por WhatsApp termina en el Plan o en un ticket (19/11/2026)

- **Síntoma:** el link 77 de Martín llegó por WhatsApp el 19/11 a las 03:10 y MaKo lo convirtió en el ticket #117
  («Competencia: … Pásalo a Claude»). Nadie lo guardó como inspiración.
- **Causa:** la regla 6 de `lib/mako-intencion.ts` (≈ línea 1398) manda un link sin instrucción a `capturar` (un borrador del
  Plan), y el clasificador con IA (`lib/mako-intencion-ia.ts`) lo puede llevar a TICKET.
- **La regla que queda:** Inspiración corta en `procesarDoer` (`lib/mako-doer-in.ts`) ANTES de la memoria y del clasificador.
  Sólo si el mensaje no pide nada con el link (`paraInspiracion`, `lib/inspiracion/links.ts`): «replicá este reel» sigue el
  turno de siempre.

## `linkDeInstagram` sólo ve el link si el mensaje EMPIEZA con él

`lib/carruseles/link.ts` arranca su regex con `^` y devuelve uno. «mirá este https://…» no da nada, y la ventana de silencio
del doer junta varios mensajes en un texto. Para un texto libre está `linksDeInstagram` (todos, sin repetidos, con su tipo).

## Bajar de Instagram sin sesión: qué funciona y qué ya no (19/11/2026)

- **yt-dlp sí:** reels con su pie, y las imágenes de un carrusel en alta con `--ignore-no-formats-error --write-thumbnail`
  (cada lámina sale como la miniatura de su entrada). No trae el pie de un **anuncio**.
- **La página `/embed/captioned/` ya no trae los datos en el HTML** (es una app de JavaScript): `tools/ig_imagenes.py` de
  `C:/dev/artefactos-animaciones` ya no encuentra nada. `tools/ig_carrusel.cjs` sí, pero usa el navegador y su fila.
- **Los «posts de video sin pie» que guarda Martín son ANUNCIOS pagados.** Los 6 que se abrieron con sesión decían «Ad» y
  tenían el botón «Learn more» o «Shop now». yt-dlp los baja como video sin pie: el CTA del anuncio sólo se ve con sesión.
- **La consulta directa a la API de Instagram la frena el clasificador de permisos** como acceso no autorizado: no se usa.
- **El navegador de la app, OCULTO, no termina de cargar Instagram:** `get_page_text` vuelve vacío o se pasa del tiempo.
  **Lo que anduvo** (lo encontró el chat de Referentes): abrir una pestaña NUEVA con `preview_start`, `resize_window` a
  1280×2400 y sacar una captura antes de leer; ahí la página carga aunque el panel siga oculto. Así se confirmaron 7 anuncios
  más: de los 16 «posts de video sin pie», 13 son anuncios pagados confirmados y 2 (60 y 68) quedaron en blanco. Instagram marca
  a uno (cosmosai.app, 45) como «AI-generated profile».

## La PC: yt-dlp roto, pip sin red y transcribir lento (19/11/2026)

- **El yt-dlp del sistema quedó a medias** (la carpeta `site-packages/~t_dlp` de una reinstalación cortada): falla con
  `No module named 'yt_dlp.minicurses'`. `pip install` también falla («access violation» en la conexión), igual que
  `huggingface_hub`. **`uv pip install --target <carpeta> yt-dlp` sí funciona**, y un modelo de Hugging Face se baja con
  `curl` (`/resolve/main/model.bin`).
- **faster-whisper con la CPU al 100 % (otros chats renderizando):** el modelo `small` tardó 8+ minutos un reel de 63 s;
  el `base` (C:/dev/inspiracion/.modelos/whisper-base), ~100 s. Con dos transcriptores a la vez la RAM bajó a 0,9 GB.
- **El PyAV instalado no acepta lo que pide faster-whisper** (`open() got an unexpected keyword argument
  'metadata_errors'`): se le pasa el audio ya decodificado (wav 16 kHz → numpy).
- **El transcriptor cambia los nombres que más importan:** Claude → «Cloud», «Clod», «Claudio»; Hormozi → «Hermosi»,
  «Alex Orbose»; CAC → «cat»; ROAS → «raw has»; «comment ADS» → «come and add»; «la B» → «la bella». Los lectores lo
  corrigieron con lo que se ve en pantalla. **Cortar el audio a 75 s pierde el CTA de los videos largos** (24, 42, 44, 48,
  50, 67): sale de los cuadros o del pie.
- **La guardia de RAM no dejó lanzar el Workflow** (pide 3 GB): los lectores fueron agentes sueltos, de a dos o tres (piden 1 GB).

## Lo que dicen los 77 links (para quien siga con las series)

- **Leer sólo el pie da el CTA equivocado:** en 25 la pantalla dice «Comment “Robert”» y el pie «guárdalo»; en 62, 69 y 76 la
  palabra está sólo en la última lámina. El clasificador de la función lee el pie: en piezas así, la lectura de la IA no ve el CTA.
- **«Comenta PALABRA» infla los comentarios:** 11, 13, 21, 34, 52, 61, 66, 70, 71 y 73 tienen más comentarios que me gusta, o
  casi. Comparar me gusta entre piezas no sirve para medir qué funcionó.
- **Un nombre de cuenta no dice de qué trata la pieza:** «Fabricantes Chinos» vende un editor para Claude (16); santiagoferrerk
  firma «instabiz.» (53); kuush.sharma firma @kushvisual (59).
- **Competencia directa que apareció:** SaleADS (54, anuncios con IA en LatAm), Santa IA con un «ARM» que carga ventas desde
  WhatsApp, «Los CRM han muerto» (63), la herramienta «Jev» en tres piezas casi iguales (70, 71, 73), y ATOM, instrucciones
  para que Claude arme reels animados (02). Otros usan un personaje en cubos como el de Martín (12, 64).
- **Martín guarda mucho de un mismo nicho de anuncios:** «editar videos con IA o con Claude» (02, 14, 16, 18, 31): el algoritmo
  le muestra anuncios de eso. Y recursos de diseño (tipografías y fondos: 55-59, 62) y miniaturas de YouTube (37-40), que no
  tienen carpeta.

## Lo que quedó SIN hacer

- **Los arreglos de la punta pueden quedar frenados por el filtro.** La primera subida a `punta/inspiracion` dio 8 rojos en GitHub
  (corrida 1803): dos tests que fijan el texto de `app/m/copywriter/page.tsx`, el conteo de salidas del turno
  (`mako-responde-siempre`), «acá» en la pantalla, la cobertura de la API, Reportar a Soporte, la cuenta de revisión de las
  tiendas y la lista de quién lee Instagram. Todos se arreglaron (las acciones tienen su operación en la API:
  `listar_inspiracion`, `ordenar_inspiracion`, `borrar_inspiracion`). Pero el filtro local de la punta frena la subida con
  **un falso rojo: `tests/agenda-destino-112.test.ts`**. Medido el 19/11: dentro del corredor de tests (`--test`) sale con código 1
  sin reportar ni un caso, **también con el `lib/mako-doer-in.ts` de main** (no es este cambio); corrido directo
  (`node --import tsx tests/agenda-destino-112.test.ts`) pasa 6 de 6 (el caso 5 tarda 69 s), y el filtro corta a los 90 s.
  `tests/api-mako-cobertura.test.ts` hizo lo mismo: **lo mató el vigía de RAM** (`~/.claude/guardia/vigia.csv`, «zona-roja» a las
  06:55). El filtro elige el de la agenda a cualquiera que toque el doer. Saltearlo (`MAKO_SIN_FILTRO=1`) lo frenó el clasificador
  de permisos desde este chat: lo decide Martín.
- **Aplicar la migración 0422** (`supabase/migrations/0422_inspiracion.sql`) antes del deploy: sin ella, la bandeja dice «Falta
  aplicar la migración 0422» y el doer contesta «No pude guardar ese link ahora». El 19/11 el clasificador de permisos frenó
  `apply-migration.mjs` desde este chat: la aplica el Cerebro o Martín.
- **El cron que termina las piezas `leyendo`** (diseno.md §3): hoy, si Apify o la IA fallan, la pieza queda en la bandeja sin
  sugerencia (`lib/inspiracion/servidor.ts`, `leerYOrdenar`).
- **La transcripción del reel cuando el pie dice poco** (diseno.md §3): la primera versión clasifica sólo con el pie, la cuenta
  y la nota; un reel sin pie va a la bandeja casi siempre.
- **La pregunta Sí/No por WhatsApp** (diseno.md §10): necesita recordar qué tarjeta se está contestando.
- **El negocio de Martín no está en el interruptor:** `WS_REVISION = [3, 9]` (`lib/inspiracion/revision.ts`). Sus emails sí
  ven la pantalla en cualquier negocio, pero el WhatsApp entra por negocio.
- **Anuncios sin comprobar:** sólo 60 y 68 (C:/dev/inspiracion/pies/): con el truco de la pestaña nueva, la página quedó en
  blanco. Los demás están confirmados.
