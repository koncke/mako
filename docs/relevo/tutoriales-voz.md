# Relevo: los tutoriales en video (voz de Martín + el Martín en cubos), 18/11/2026

## Qué está hecho

**47 videos en el manifiesto, en main.** Están en `public/tutoriales/<key>.mp4` + `<key>.jpg` + `manifiesto.json` (720p, ≤ 1,5 MB, con
`frases[]`: t_inicio, t_fin, sel, espera_clic, cierra_despues y, en el QR del día 2, espera_clic sobre «Instalar la app»).

- **Onboarding:** onboarding-bienvenida (el primer video, presenta al muñeco), onboarding-whatsapp, onboarding-seguir-pc,
  recorrido, offer-coach y funnel-coach.
  - El recorrido sigue al recorrido aprobado por Martín: el `GUION` V2 de `C:/dev/artefactos-onboarding/cuerpo.html`.
- **Reto:** reto-dia-1 a reto-dia-7, de `lib/reto/dias.ts`.
  - Los días 2 a 7 van paso a paso: una frase por cada lugar que marcan sus tareas. El día 3 tiene la automatización y no la
    difusión.
- **34 pestañas** (formato v5: gancho + «Te doy la bienvenida a X»): ops-center, offer, copilot, settings-integraciones, settings,
  crm, ticketera, calendar, automations, spy, copywriting, web, plan, dashboard, classroom, avatar, video, image, chats,
  classroom-community, classroom-clients, classroom-calendar, classroom-leaderboards, classroom-about, settings-seguridad,
  settings-notificaciones, settings-instalar, settings-equipo, settings-fiscal, settings-plan, partners, agency, api y
  report-problem.
  - partners ya dice el 30 % de cada pago, todos los meses.

**Dónde vive todo:**
- **Motor y guiones en el repo:** `scripts/tutorial-animado/`. Ahí están `guiones.json` (la fuente), `hacer.mjs`, `engine3.js`,
  `voxel-martin.mjs`, `render2.cjs`, `voces.mjs`, `renders.mjs`, `pagina.mjs`, `subir.mjs` y `LEEME.md`.
- **Carpeta de trabajo:** `C:/dev/tutoriales-video/` (motor/, guiones.json, trabajo/<key>/, public-tutoriales/).
- **Worktree para subir:** `C:/dev/wt-tutoriales-videos` → `punta/tutoriales-videos`. ⚠️ Su `node_modules` es una JUNCTION al del
  clon: antes de borrarlo, `cmd /c rmdir C:\dev\wt-tutoriales-videos\node_modules`.
- **1080p:** `OneDrive/Escritorio/MaKo-VSL/tutoriales/videos/`.
- **Cosecha:** `docs/hallazgos-video-pipeline.md`, secciones «Los 35 tutoriales del 18/11» y «v5».

**Cómo se hace una tanda (desde `C:/dev/tutoriales-video`):**
```
node motor/voces.mjs <keys>
node motor/renders.mjs <keys>
node motor/subir.mjs "<mensaje>" <keys>
```
- `voces.mjs` hace la voz, la compara con el guion (scribe_v1) y pide otra toma si dice algo distinto.
- `renders.mjs` mide la cabeza que tapa y deja `trabajo/<key>/hoja-video.jpg`, que hay que MIRAR.
- `subir.mjs` hace el commit por ruta y el push a la punta.

## La galería

https://claude.ai/artifact/GJAQbPZw2nC3uvy82X8WcX (privada). Son los 47, agrupados por sección: Onboarding, Reto de 7 días y las
pestañas. Se regenera con `node motor/pagina.mjs` y se publica desde `<scratchpad>/pub-tutoriales/` en dos tandas, porque pasa de
64 MB.

## Lo que falta o espera el OK

- **Esperan el OK del Cerebro antes de las voces:**
  - `offer-coach-clase` (~2:20, Offer Coach la manda después de la oferta);
  - el `funnel-coach` corto que nombra los seis funnels;
  - las clases `funnel-clase-anuncios-a-vsl` y `funnel-clase-anuncios-a-whatsapp`.
  Guiones en `C:/dev/tutoriales-video/guiones-v6.md`. Con el OK: voz y render de esas cuatro, y escribir las otras cuatro clases
  (`funnel-clase-anuncios`, `-organico`, `-youtube`, `-prospeccion-en-frio`), desde `docs/marketing-copilot/funnels/`.
- **Martín todavía no miró uno por uno.** Puede pedir una SERIE para las pestañas grandes, como Automations.

## La voz

- ElevenLabs `eleven_v4`, voz `I2d6BR9P2dAopVw1khNv` (el clon de Martín). Es `_para_texto_sin_video` de
  `C:/dev/reel-mentores/voz/LA-CONFIG.json`: acento rioplatense, porque v3 lo mexicaniza.
- La clave es `ELEVENLABS_API_KEY`, en el `.env.local` del repo.
- Cobra ~0,44 créditos por carácter (~200 por video).
- Se escribe como suena y `ver` lo muestra bien: «Máko» (MaKo), «Ei-Ai» (AI), «Ímich» (Image).
- Música: `C:/dev/reel-mentores/montaje/musica-eleven.mp3`, baja.
- Chequeo: `C:/dev/reel-mentores/voz/chequear-guion.mjs`. Una palabra «de más» también pide otra toma desde el 18/11.
