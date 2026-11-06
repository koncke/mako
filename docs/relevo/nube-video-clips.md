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

- **Tanda 1 (palabras clave y presets):** ver docs/hallazgos-video-editor.md → «Palabras clave automáticas y los presets de la
  marca». Test `tests/video-editor-subtitulos-claves.test.ts` (18, 15 roturas). Sin migración (los presets van en app_settings).

## Lo que quedó a medias

- Tandas 2 (B-roll) y 3 (clips mágicos): en curso.

## Lo que falta verificar

- Nada se miró en un navegador: la nube no corre el editor (necesita WebGPU y el WASM). Lo primero en producción:
  Subtítulos automáticos con el interruptor prendido, el panel «Palabras clave», guardar un preset y verlo en Plantillas.

## Lo que espera a Martín

- Nada por ahora.
