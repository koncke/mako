# Hallazgos — AI Avatar

**Vive en:** `app/ai-avatar`, `lib/ai-avatar`. Se apoya en el «Avatar de IA» del Video Editor
(`app/video-editor/avatar`) y en el motor del Video Generator (`app/video-generator/video-action.ts`,
el puente a Flow). Lo de Flow, ElevenLabs y el lip-sync de antes vive en `hallazgos-generativa.md`.

Pedido de Martín (17/10/2026, 04:55, desde el Centro de Operaciones): la tab «AI Avatar» de punta a
punta, «algo como Heygen», investigando clones y alternativas (`github.com/topics/heygen-alternative`,
`debpalash/VoiceStudio` para clonar la voz), con una «galería» de ejemplos o temas en imagen, video y voz.
Investigación con tres agentes de lectura el 17/10; lo que sigue es lo que conviene no volver a buscar.

## La referencia es HeyGen, y se miró por su documentación, no por la app

HeyGen pide cuenta y no había navegador conectado: la estructura se copió de su **documentación
oficial** (academy y help center) y de **38 capturas de 2026** publicadas en
https://www.saasui.design/application/heygen. Lo que importa de ahí:
- **Look = personaje + escena** (https://www.heygen.com/en-au/avatars/avatar-looks-new). Un look se
  genera desde la foto con un prompt o un «Look Pack» por tema (oficina, fitness, médico), y devuelve
  variantes. Es el método de dos pasos que la casa ya validó: composición primero, identidad después.
- **El anuncio de producto en mano de HeyGen corre sobre Veo 3.1**: hasta 8 escenas de 8 s, cada una
  con su diálogo y su gesto
  (https://www.heygen.com/en-ca/academy/more-about-avatars/how-to-add-products-to-your-avatar). Es el
  mismo motor que MaKo maneja por el puente a Flow.
- **Donde HeyGen gana de verdad es el guion LARGO con la voz propia** (Avatar IV hasta 180 s): eso pide
  un motor que mueva los labios a partir de un AUDIO, que MaKo no tiene. Ver «lo que quedó sin hacer».
- Las categorías de su galería de anuncios UGC: producto, respuesta directa, testimonio, demostración,
  comparación, temporada (https://www.heygen.com/business/marketing/ugc-video-ads).

## Licencias: lo que muerde aunque el repo diga MIT

- **La licencia cambia con la VERSIÓN y el TAMAÑO, no con la familia.** Qwen-Image y su Edit son Apache;
  **Qwen-Image-2.1 (20/09/2026) es «Qwen RESEARCH», no comercial**. FLUX.2 klein 4B es Apache; el 9B,
  no comercial. Se lee la model card de ESA versión.
- **Las tablas de los agregadores se equivocan.** `localai-studio` pone OmniVoice como MIT/Apache (sus
  pesos son CC-BY-NC) y Qwen-Image-2.1 como Apache.
- **«MIT» en el repo no alcanza.** MuseTalk trae adentro la carpeta `face_detection` de Wav2Lip y dos
  archivos «copy from wav2lip»; LatentSync usa en la inferencia los modelos de **InsightFace**
  (buffalo_l, antelopev2), cuyo código es MIT y cuyos **pesos son sólo para investigación**. A la
  búsqueda de la casa (`wav2lip|s3fd|syncnet|inswapper|codeformer`) hay que sumarle
  `insightface|buffalo_l|antelopev2`.
- **Que fal o Replicate hospeden un modelo no limpia su licencia**: F5-TTS (pesos CC-BY-NC) y XTTS-v2
  (CPML: no comercial, «y sus salidas») están en las dos.
- **VoiceStudio es AGPL-3.0** y su motor por defecto (OmniVoice) tiene pesos **CC-BY-NC**: no se copia ni
  se sirve. Lo que vale es su `backend/config/model_licenses.json`, un inventario de licencias por modelo
  con la evidencia: copiar el MÉTODO, no el archivo.
- **Duix-Avatar** (el «HeyGen offline») exige licencia comercial pasados los 1.000 usuarios activos.
- **HyperFrames** (de HeyGen, Apache) trae la galería de plantillas que pide Martín, pero 207 de sus 210
  bloques usan **GSAP**, cuya licencia prohíbe herramientas no-code de animación visual que compitan con
  Webflow: choca con el Video Editor y el Web Generator. Sólo como motor de render con plantillas fijas.

Limpios para uso comercial (con la URL de su licencia en el informe del agente, relevado el 17/10):
avatar por audio **InfiniteTalk, StableAvatar, EchoMimicV3, LongCat-Avatar, HuMo, Wan2.2-S2V**
(Apache/MIT, código y pesos); voz **Chatterbox Multilingual** (MIT, español), **Qwen3-TTS** (Apache),
Kokoro, OpenVoice V2, GPT-SoVITS; imagen **Z-Image-Turbo**, FLUX.2 klein 4B, Qwen-Image(-Edit) hasta la
2511. De los que entran en 8 GB, sólo **StableAvatar** tiene chance (sin medir).

## Trampas del entorno

- **Dos repos del topic `heygen-alternative` son señuelos de malware** (`Ultimatesiquest/heygen-zen`,
  `CementMerchant17/heygen`): piden bajar un .exe de un dominio externo con un badge «License-Free». El
  topic tiene sólo 8 repos y la mitad no son software.
- **`fal.ai/models/<id>` contesta 200 aunque el modelo no exista.** Para saberlo,
  `fal.ai/api/models?keywords=`. Replicate sí da 404.
- **La API de GitHub sin token (60 consultas por hora por IP) la gastan los otros chats**: estaba en 0.
  `search/repositories?q=repo:a/b+repo:c/d` tiene su propio cupo y trae licencia, estrellas y fecha.
- **La biblioteca pública de voces de ElevenLabs** (`/v1/shared-voices`) se lista sin clave, pero
  **filtrar por idioma o acento pide clave** («You must be logged in to use filters»). La muestra
  (`preview_url`) es pública y se escucha sin cuenta ni cuota.

## Lo que quedó SIN hacer

- **El video con la voz elegida o clonada.** El Video Generator anima con la voz que genera Flow, en el
  acento del cliente; el reemplazo por la voz clonada (STS + remux) existe sólo en `scripts/`, y
  `convertirVoz` de `lib/elevenlabs.ts` no tiene ningún llamador en `app/`. El remux puede hacerse en el
  navegador con `mediabunny` (ya es dependencia). **Vive en:** `lib/elevenlabs.ts` (`convertirVoz`) y
  `app/ai-avatar`.
- **El guion largo hablado (30 s a 3 min) con labios guiados por audio**, que es donde HeyGen gana: un
  motor de retrato + audio (InfiniteTalk o StableAvatar en RunPod, o por fal) pagado por MaKo. Es gasto
  de medios de la plataforma: decisión de precio de Martín, no del chat.
- **Cada video de avatar es un plan del historial del Video Generator**, igual que en el «Avatar de
  IA» del Video Editor, y ese historial tiene tope de 10 (`MAX_HISTORIAL`, `video-datos.ts`): hacer
  muchos videos de avatar empuja afuera anuncios viejos con el único puntero a sus clips. Los LOOKS no
  tienen ese problema (viven en `ai-avatar.looks`); los videos sí. **Vive en:** `app/ai-avatar/actions.ts`
  (`crearVideoAction`) y `app/video-editor/avatar/actions.ts`.
- **Las imágenes de ejemplo de la galería.** Sólo «Charla en el auto» y «Presentador en la oficina»
  tienen un video real (los del Video Generator). Las otras seis muestran el lugar escrito hasta que se
  genere su imagen en Flow (gratis) con el motor por interfaz, cuando haya un navegador conectado.
  **Vive en:** `lib/ai-avatar/plantillas.ts` (`ejemplo`).
- **Verla andando.** Se escribió sin poder abrirla: no había navegador conectado y la máquina no tenía
  memoria para un build local. La prueba es de Martín en producción, desde el Centro («revisar»).
