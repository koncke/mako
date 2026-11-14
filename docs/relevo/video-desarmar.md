# Relevo: «Desarmar» videos de la competencia (ticket 97)

Al 14/11/2026, cuenta claude5 al 95 %. Worktree `C:/dev/wt-video-desarmar`, rama `punta/video-desarmar` (último `0472f8543`).
Lo de la fase 1 está en main y desplegado salvo el CSS (ver abajo). La cosecha está en `docs/hallazgos-video-outliers.md` → «Desarmar, fase 1»,
y la fase 2, en `docs/diseno-desarmar-video.md`.

## Estado

- **Fase 1, en main:** el botón «Desarmar» en Outliers del Video Editor y en Competitor Spy, con el Gemini del negocio (YouTube
  por URL, reel o anuncio subido al File API), VIDEO.md + timeline guardados por negocio, «Abrir en el editor» como plantilla
  de toca-y-reemplaza (`/video-editor?ver=crear&desarme=…`), el desarme de carruseles e imágenes con «Replicar en Image», y
  «Hacer uno así» que lleva la receta de edición al Copywriter. Ruta: `app/api/desarmar/route.ts`.
- **El despliegue de las 05:53 UTC del 14/11 no compiló** por tres selectores sin clase en `app/video-editor/desarmar.module.css`.
  Lo arregló el Cerebro en `punta/arreglo-css-desarmar` (`1787ecaa5`, con `tests/css-modulos-puros.test.ts`). Verifiqué que
  cubre los dos usos de `data-origen`. Al mezclar main, quedarse con SU versión del archivo.

## Lo que falta de la fase 1

1. **Que el arreglo del CSS llegue a main y el despliegue quede READY** (`scripts/ver-deploy-vercel.mjs`).
2. **Probarlo en producción en el negocio de MaKo (ws 9), nunca en el de un cliente:** desarmar un reel subido (el de los
   pistachos: `C:/dev/reel-mentores/josep/josep-reel.mp4`) y un video de YouTube, abrir su plantilla en el editor y sacar
   capturas a 1440 y 375 para el Cerebro. El hito de la bitácora (`app/admin/dev/video-editor/bitacora.ts`, 14/11 01:05) tiene
   `faltaEnProduccion`: el deploy NO cierra el ticket 97 hasta esa prueba. **La plantilla armada en el editor nunca se vio en
   pantalla** (las capturas que hay son del banco; necesita el motor y WebGPU).
3. **Las claves de Gemini de ws 9:** las cuentas 1 y 4 dan 401; la 3 se queda sin la cuota gratis (20 por día por modelo). Si la
   prueba falla por eso, es la clave, no el código.
4. **Errores medidos que no se arreglaron:** en los pistachos Gemini dice que hay música de fondo y no la hay bajo la voz; en
   «palabra gigante» midió la palabra clave al 120 % amarilla y a mano es 3× y blanca. Son del modelo, anotados en la cosecha.
5. **Seguimiento sin asignar:** `guionDeYoutubeConGemini` en `lib/ai-cheap.ts` todavía salta de cuenta ante un 429 en vez de
   probar el modelo de respaldo en la misma cuenta (el desarme ya lo hace, ver `lib/video-desarmar-gemini.ts`).

## La fase 2 (sólo escrita, nada construido)

Todo en `docs/diseno-desarmar-video.md`. Un worker de Railway sin GPU: ffmpeg + PySceneDetect, faster-whisper int8, RapidOCR,
y python-audio-separator a pedido; rea-video sin SenseVoice, conservando su NOTICE. Medido en la PC: en reposo 22,1 MB y 0 CPU
(~US$0,22/mes); por reel ~260 s de CPU (~US$0,002). Falta medir audio-separator. **El contenedor lo prende Martín**; no se
construye ni se despliega sin su OK.

## Trampas para quien siga

- Las rutas bajo `/api/video-editor/*` llevan sólo el candado del editor; un módulo de servidor no importa del motor
  (`_opencut`); la página `[proyecto]` lee sólo `desde`, `plantilla` y `propuesta`. Las tres son tests de la casa.
- El banco de capturas (`scripts/banco-carruseles/`, esbuild) acepta CSS que `next build` rechaza: una captura no prueba el build.
- En Git Bash, un heredoc se come las barras invertidas: los scripts con regex se escriben con la herramienta Write.
- La RAM no da para el chequeo de tipos acotado en la PC (el vigía lo corta con 99): los tipos los dice la punta en GitHub.
