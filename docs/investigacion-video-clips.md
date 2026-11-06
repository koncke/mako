# Clips mágicos: cómo lo hacen OpusClip y un repo abierto, y qué se tomó (6/11/2026)

Pedido de Leila (clienta, llamada del 30/10/2026): «de un video largo a varios cortos, eligiendo los mejores momentos con
la transcripción, con subtítulos y formato vertical; cada clip abre en el editor». Martín pidió mirar cómo lo hacen
OpusClip y un repo abierto, y dejar la fuente acá.

## OpusClip (la referencia de producto)

Fuente: su centro de ayuda, artículo «Virality score» — <https://help.opus.pro/docs/article/virality-score>. ⚠️ Desde la
sesión en la nube ese host no resuelve (está fuera de la red permitida): lo de abajo sale del resumen del buscador sobre
esa página, no de leerla entera. Conviene abrirla desde la PC antes de citar algo más fino.

- Cada clip lleva un **puntaje de 0 a 99** («Virality score»), y la lista sale ordenada del más alto al más bajo.
- El puntaje junta cuatro cosas: **Hook** (si el arranque atrapa), **Flow** (si avanza con lógica y cierra bien),
  **Value** (si sirve o mueve algo) y **Trend** (si toca un tema del momento).
- Es una predicción, no una garantía (lo dice la propia ayuda), y en su plan gratis no se ve.

## SamurAIGPT/AI-Youtube-Shorts-Generator (el repo abierto)

Fuente: <https://github.com/SamurAIGPT/AI-Youtube-Shorts-Generator> (su README, leído el 6/11/2026). Licencia **MIT**
(«Copyright (c) 2026 Anil Chandra Naidu Matcha», en su `LICENSE`). De ahí NO se copió código: se tomaron las reglas.

- El camino: baja el video, lo transcribe con Whisper (segmentos con tiempo), una IA clasifica el tipo de contenido, parte
  los videos largos, una IA **puntúa los momentos de 0 a 100** (ganchos, picos emocionales, opiniones fuertes,
  revelaciones, conflicto, frases citables, picos de una historia, valor práctico) con una línea de gancho y un porqué,
  **junta los que se pisan** y se queda con los mejores, y recorta a vertical.
- Por defecto, **3 clips** (`--num-clips`).
- **Si dos candidatos se pisan más del 50 %, queda el de más puntaje.**
- **Un video de más de 30 minutos va a la IA en pedazos de 20 minutos con 60 s de solape** (para no perder un momento que
  cruza el borde).
- El recorte a vertical, con ffmpeg y OpenCV siguiendo la cara (en local).

## Lo que se tomó, y lo que se decidió acá

| Qué | De dónde | En MaKo |
|---|---|---|
| Puntaje 0–99 en cuatro partes | OpusClip | GANCHO, VALOR, RITMO y CIERRE (`puntajeDeClip`, lib/editor-video/clips.ts). Trend no: necesita saber qué es tendencia hoy, y eso no se mide sin datos de afuera |
| La IA puntúa y explica | SamurAIGPT | La IA del NEGOCIO elige, con título, puntaje y motivo; sin IA, decide el puntaje por reglas |
| Solape > 50 % → queda el mejor | SamurAIGPT | `elegirSinSolape`, sobre el más corto de los dos |
| Pedazos de 20 min con 1 min de solape | SamurAIGPT | `bloquesParaIA` (hasta 6 pedazos: dos horas) |
| La lista ordenada por puntaje | OpusClip | La lista va en el orden del video, con el puntaje a la vista: así se ve qué parte del video sale |
| Duración | — (el repo no la fija) | De 15 a 60 s; el cierre premia de 20 a 45 s (lo que mejor anda en Reels y Shorts) |
| La IA nombra tiempos | El repo le pide tiempos al modelo | Acá la IA nombra FRASES por su número y el código pone los tiempos: un número que no está se descarta (la regla de la casa: un dato exacto no lo transporta un modelo) |
| Recorte vertical | OpenCV siguiendo la cara | El video se agranda y se recorta al CENTRO para llenar el 9:16 (`principalCubriendo`). Seguir la cara queda pendiente |
| Subtítulos | — | Se generan de nuevo para el vertical, con la plantilla y las palabras clave de Subtítulos automáticos |

Lo que no se hizo: seguir la cara al pasar a vertical; el «Trend»; mirar la ayuda de OpusClip entera (ver arriba).

*6/11/2026, sesión en la nube (`cli_e9e561bd-9357-538e-a412-924b21532f41`).*
