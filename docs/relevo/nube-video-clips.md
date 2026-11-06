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

## Lo hecho

- **Tanda 1 (palabras clave y presets):** subida a `punta/video-subtitulos-clips` (`9e2c1fc31`, `c53e77207`). Ver
  docs/hallazgos-video-editor.md → «Palabras clave automáticas y los presets de la marca». Test
  `tests/video-editor-subtitulos-claves.test.ts` (18, 15 roturas). Sin migración (los presets van en app_settings).
- **Tanda 2 (B-roll y cambios de plano):** Multimedia › «B-roll de MaKo», fotos de Pexels con la clave del negocio (integración
  nueva «Pexels»), el efecto «Acercar», chat `broll` y API `proponer_broll_video`. Ver docs/hallazgos-video-editor.md → «B-roll y
  cambios de plano automáticos». Test `tests/video-editor-broll.test.ts` (20, 19 roturas). Sin migración.

## Lo que quedó a medias

- Tanda 3 (clips mágicos): en curso.

## Lo que falta verificar

- Nada se miró en un navegador: la nube no corre el editor (necesita WebGPU y el WASM). Lo primero en producción:
  Subtítulos automáticos con el interruptor prendido, el panel «Palabras clave», guardar un preset y verlo en Plantillas.
- El B-roll con la IA real: `node --env-file=<.env.local> --import tsx --conditions=react-server scripts/probar-broll-ia.mts --ws 3`
  (en la PC; gasta la IA del Cliente de Prueba). Y en el editor: conectar Pexels desde el panel, «Proponer» sobre un video con voz,
  ver el borde punteado, Dejar / Sacar y Ctrl+Z.

## Lo que espera a Martín

- Nada por ahora.
