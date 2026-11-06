# Relevo — «Video Editor: subtítulos, B-roll y clips» (nube, 6/11/2026)

Sesión en la nube `cli_e9e561bd-9357-538e-a412-924b21532f41`. Rama de trabajo `claude/cool-brown-5dq8yt`, se sube a
`punta/video-subtitulos-clips`. Se reescribe al cerrar cada tanda.

## Lo pedido (con sus palabras)

Lo pendiente del Video Editor que pidió Leila (clienta) en la llamada del 30/10/2026:
1. «Resaltar palabras clave automáticamente» (estaba en «Próximamente») y presets guardados por marca o por cliente.
2. B-roll y cambio de plano automáticos, al estilo de Submagic: MaKo propone dónde y qué, la persona acepta o saca cada uno,
   imágenes con licencia, propuesta visible en la línea de tiempo sin pisar lo editado.
3. Clips mágicos: de un video largo a varios cortos con la transcripción, subtítulos y 9:16; cada clip abre en el editor;
   investigación de OpusClip y un repo abierto en `docs/investigacion-video-clips.md`.
Cada negocio paga su IA; todo a la API de MaKo; sin tocar Flow, AI Avatar ni Motion.

## Lo hecho (las tres tandas, en `punta/video-subtitulos-clips`)

- **Tanda 1 (palabras clave y presets):** `9e2c1fc31`, `c53e77207`. Ver docs/hallazgos-video-editor.md → «Palabras clave
  automáticas y los presets de la marca». Test `tests/video-editor-subtitulos-claves.test.ts` (18 casos, 15 roturas). Sin
  migración (los presets van en app_settings).
- **Tanda 2 (B-roll y cambios de plano):** `277a7c0c5`. Multimedia › «B-roll de MaKo», fotos de Pexels con la clave del negocio
  (integración nueva «Pexels»), el efecto «Acercar», chat `broll` y API `proponer_broll_video`. Ver docs/hallazgos-video-editor.md
  → «B-roll y cambios de plano automáticos». Test `tests/video-editor-broll.test.ts` (20 casos, 19 roturas). Sin migración.
- **Tanda 3 (clips mágicos):** Multimedia › «Clips mágicos» («Buscar los mejores momentos» y «Abrir» cada uno en un proyecto
  nuevo, 9:16 y con subtítulos), chat `clips_magicos` y API `buscar_clips_video`. Ver docs/hallazgos-video-editor.md → «Clips
  mágicos» y docs/investigacion-video-clips.md (OpusClip y SamurAIGPT/AI-Youtube-Shorts-Generator, MIT). Test
  `tests/video-editor-clips.test.ts` (13 casos, 18 roturas). Sin migración.

Ninguna tanda escribe en la base de producción ni manda nada a terceros. Las rutas nuevas
(`/api/video-editor/{presets,broll,clips}`) quedan cortadas para la cuenta de revisión de las tiendas.

## Lo que quedó a medias

- Nada a medias. Queda sin hacer, a propósito: seguir la cara al pasar un clip a vertical (va al centro) y el «Trend» del
  puntaje de OpusClip (sin datos de afuera no se mide).

## Lo que falta verificar (en la PC)

- Nada se miró en un navegador: la nube no corre el editor (necesita WebGPU y el WASM).
- **Palabras clave:** Subtítulos automáticos con el interruptor prendido, el panel «Palabras clave», guardar un preset y verlo en
  Plantillas («De tu marca»).
- **B-roll:** `node --env-file=<.env.local> --import tsx --conditions=react-server scripts/probar-broll-ia.mts --ws 3` (gasta la
  IA del Cliente de Prueba). En el editor: conectar Pexels desde el panel, «Proponer» sobre un video con voz, ver el borde
  punteado, Dejar / Sacar y Ctrl+Z.
- **Clips:** `node --env-file=<.env.local> --import tsx --conditions=react-server scripts/probar-clips-ia.mts --ws 3`. En el
  editor, con un video de más de un minuto: «Buscar los mejores momentos», «Ver» (salta al tramo) y «Abrir» (tiene que quedar
  un proyecto nuevo con el título del clip, vertical, con subtítulos, y el original igual que antes). Probar también con un
  video largo (30 min o más): la copia pesa lo mismo que el original en el navegador.

## Lo que espera a Martín

- Nada. Pexels se conecta con la clave de cada negocio (gratis, en pexels.com/api): la pega cada cliente en el panel.
