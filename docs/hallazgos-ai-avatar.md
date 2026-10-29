# Hallazgos — AI Avatar

**Vive en:** `app/ai-avatar`, `lib/ai-avatar`. Se apoya en el «Avatar de IA» del Video Editor
(`app/video-editor/avatar`) y en el motor del Video Generator (`app/video-generator/video-action.ts`,
el puente a Flow). Lo de Flow, ElevenLabs y el lip-sync de antes vive en `hallazgos-generativa.md`.

Pedido de Martín (17/10/2026, 04:55, desde el Centro de Operaciones): la tab «AI Avatar» de punta a
punta, «algo como Heygen», investigando clones y alternativas (`github.com/topics/heygen-alternative`,
`debpalash/VoiceStudio` para clonar la voz), con una «galería» de ejemplos o temas en imagen, video y voz.
Investigación con tres agentes de lectura el 17/10; lo que sigue es lo que conviene no volver a buscar.

**29/10/2026: la referencia pasó a ser HIGGSFIELD** («replica a higgsfield tal cual», con el diseño único de Create).
Las secciones de HeyGen se deprecaron; lo de abajo de HeyGen queda por las licencias y las trampas, que siguen valiendo.

## Higgsfield: qué se copió, de dónde, y el repo que NO sirve (29/10/2026)

- **Higgsfield SÍ se ve sin cuenta** (a diferencia de HeyGen): `higgsfield.ai/ai/image?model=soul` y
  `higgsfield.ai/ai-influencer-studio` cargan enteras sin login. Lo que se copió de ahí: la barra de prompt que flota
  abajo (`+`, el texto, Modelo, Formato, Cantidad «1/4», la ranura CHARACTER, la tarjeta del preset con «Change»,
  GENERATE con su costo), el selector de presets (`?style=all`: categorías a la izquierda, «Search presets», baldosas
  con el nombre arriba a la izquierda y «Use preset» al pasar) y el estudio AI Influencer (constructor por acordeones a
  la izquierda, «Motion», «Explore · History»). Capturas en la carpeta de notas del Cerebro, `capturas-ai-avatar-2910/`.
- **El banner de cookies de Higgsfield tapa la barra**: hay que rechazarlo («Reject Non-Essential Cookies») antes de
  mirarla. Las baldosas del selector cargan en ~2 s: un `get_page_text` inmediato devuelve los nombres sin imágenes.
- **El repo abierto que más se le parece NO sirve como base**: `Anil-matcha/Open-Generative-AI` (ex «Open-Higgsfield-AI»,
  MIT, ~31k estrellas) es un SELECTOR DE MODELOS sobre una API paga (Muapi): no tiene presets, ni personaje, ni
  historial por proyecto. Su `AiInfluencerStudio.jsx` es un constructor de rasgos (cara, cuerpo, estilo), que choca con
  la regla de la casa (la cara la pone la foto). Se estudió y no se copió una línea. `wide-trace/open-higgsfield` no
  tiene licencia: ni se mira el código. La API de GitHub contesta `license: null` para el viejo nombre: hay que ir al
  repo renombrado.
- **Sin categoría «Beauty»**: sus presets (maquillaje, cejas, piel) DESCRIBEN la cara, que es justo lo que el prompt de
  un preset no puede tocar (rompía el parecido, más abajo y en `hallazgos-generativa.md`).

## Trampas del estudio (29/10/2026)

- **«La pantalla anda» no es «el motor anda»: medirlo en la base antes de venderla.** El 29/10 el pedido fue abrirla a los
  clientes; la tabla `flow_puentes` (una fila por workspace con su extensión: `estado`, `version`, `ultimo_visto`) y
  `app_settings` (`ai-avatar.looks`) dijeron en una consulta que no había ni un look generado ni un puente con sesión. Se
  mide con un script suelto contra la base (`--env-file=C:/dev/mako-api/.env.local`, transacción `read only`), sin abrir
  ninguna pantalla. Y «Conectar» en el popup vincula el workspace que está ABIERTO en MaKo: para probar en el ws3 hay que
  entrar al ws3 antes de tocarlo.
- **Abrir AI Avatar a clientes toca más que su puerta**: sin `adminOnly`, la tab aparece en la sidebar del cliente y el
  teléfono necesita su fila de More (lib/movil-rutas.ts, como Video), o `movil-mas-secciones` falla «está en la sidebar y no
  en el teléfono»; la capa de la plataforma tiene keys EXPLÍCITAS (lib/capas.ts) y sin 'ai-avatar' el super admin la pierde
  en su propio workspace; y /planes la vuelve a ofrecer sólo si sale de `TABS_TODAVIA_CERRADAS` (el test de planes ata las
  dos cosas). Desde el 29/10 es para los TRES planes (Martín: «haz que AI-Avatar esté disponible para todos»): además sale de
  `TABS_SOLO_PRO` y de `NAV_SOLO_PRO`, y la puerta es la de toda tab (`requireRolWs([], { nav })`). La capa `pm` (la del
  project manager, que no es un plan que se vende) queda SIN AI Avatar a propósito. Rama: `ai-avatar-todos-2910`; las
  `ai-avatar-abrir-pro-2910` y `ai-avatar-para-todos-2910` quedaron viejas.
- **Sumar un renglón a la tarjeta de Esencial rompe un test que no habla de AI Avatar.** «El acompañamiento se ve DISTINTO y
  con más» (tests/planes-tres-bloques.test.ts) pide que el programa (el Acelerador) tenga MÁS renglones que el plan: con el
  renglón nuevo, Esencial llegó a 7, igual que el Acelerador. El avatar se dijo dentro del renglón de la oferta
  (lib/planes-mako.ts). Antes de sumar un renglón a Esencial, contar los del Acelerador.
- **«Antes de generar» se arma con lo que ve el SERVIDOR y lo que ve ESTE Chrome, y no son lo mismo.** El servidor sabe del
  puente (`flow_puentes`: estado, si late, versión); sólo la página sabe si la extensión está en este navegador
  (`data-mako-puente`). Una extensión conectada desde OTRO Chrome cuenta como instalada (genera ESE); en el teléfono no se sabe
  nada del navegador (`instalada: null`) y los pasos dicen «en tu computadora». El `detalle` del puente no se muestra: es texto
  libre del navegador. Vive en `lib/ai-avatar/requisitos.ts`, puro, para la computadora y el teléfono.

- **Sacar las secciones de una tab de nav.ts cierra la puerta del teléfono SIN error si la page sigue pidiendo la key
  vieja**: `requireMovil({ navKey })` busca la key en `TODOS_LOS_ITEMS` y, sin el ítem, no deja pasar a nadie. Al dejar
  AI Avatar como UN ítem ('ai-avatar'), las cuatro pages de `app/m/ai-avatar` pasaron a `navKey: 'ai-avatar'` en el MISMO
  commit, junto con `lib/funciones-mako.ts`, `lib/plan-esencial-reglas.ts` (las tabs de Pro) y sus tests.

- **El prompt validado de un formato GANA ENTERO sobre la escena del preset.** `promptFinal` (lib/flow-imagen.ts)
  devuelve `PROMPT_IMAGEN[puestaId]` sin mirar la escena: un preset con `puestaId: 'selfie-movimiento'` sale SIEMPRE en
  el auto, diga lo que diga su prompt. Sólo «Charla en el auto» puede usarlo (lo fija tests/ai-avatar.test.ts). Al
  sumar un formato con prompt validado, revisar qué presets lo usan.
- **Lo que la persona escribe en la barra va AL FINAL del prompt, no adentro ni como `propio`.** Pegado a la escena se
  perdía en el preset del auto (por la trampa de arriba); como `propio` reemplazaba TODO, identidad incluida («mantén a
  la persona inalterada»): «con campera roja» generaba a otra persona. Vive en `lib/ai-avatar/prompt-look.ts`.
- **El motor por interfaz hace UNA imagen vertical por pedido** (`pedidoImagenInterfaz`: un prompt, una cara,
  `vertical`). «1/4», 3:4, 16:9 y 2K de Higgsfield se VEN y dicen «no disponible todavía»
  (`SIN_MOTOR`, lib/ai-avatar/estudio.ts). 16:9 la interfaz lo haría, pero el video del avatar se filma vertical: un
  look horizontal saldría recortado al animarlo.
- **Los videos de un proyecto no viven en el look**: están en el historial del Video Generator y se cruzan por el
  `mediaId` de la imagen (`imagenes['1'].elegidaId`, que escribe `conAvatar`). El tope de 10 del historial sigue
  mordiendo: un proyecto puede «perder» un video viejo sin que nadie lo borre.
- **El marco es el de Create (app/_crear/PantallaCrear.tsx), y su «Nuevo …» tapaba lo que la plantilla abría.** Usar una
  plantilla (o escribir en su caja, si la tab lo toma) no cerraba «Nuevo …»: el centro seguía en «¿Qué vas a crear hoy?»
  con la pieza nueva escondida detrás. Se arregló en la pantalla compartida (`alPlantilla`, 29/10): una plantilla que se
  usó sin error cierra «Nuevo …», para todas las tabs. En AI Avatar usar un preset ahí NO genera: lo pone en la barra
  (como «Use preset» de Higgsfield), porque falta la foto y generar es con el botón.
- **Para VER la pantalla sin `next dev` ni sesión de super admin**: renderizar el componente real con
  `renderToStaticMarkup` en Node, con `module.registerHooks` (síncrono: cubre `require` y `import`; el `register`
  asíncrono no ve lo que tsx compila a CommonJS) desviando a stubs sólo lo que habla con el servidor (`./actions`,
  `./filmar`, MakoEnLaTab, `@/app/_ui/Link`). Se sirve con un `http.server` declarado en `.claude/launch.json` y se
  mira en el navegador integrado: el Chrome de Claude in Chrome de esta PC NO llega a `localhost` (es otra máquina o
  una política) ni abre `file://`. Ojo: el navegador cachea el `.css` entre renders; recargar la hoja con `?v=`.

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
- **Las imágenes de ejemplo de los presets** (29/10: 28 presets). Sólo «Charla en el auto» y «Presentador en
  la oficina» tienen imagen real; los otros 26 muestran el degradado de su categoría y el lugar escrito (y, en
  cuanto la persona genera uno, SU look pasa a ser la baldosa). Se generan gratis en Flow con el motor por
  interfaz cuando haya un navegador de super admin conectado. **Vive en:** `lib/ai-avatar/plantillas.ts` (`ejemplo`).
- **Probarla de punta a punta con un look real.** Martín la abrió a los tres planes el 29/10 SIN esa prueba («haz que
  AI-Avatar esté disponible para todos» le ganó a «no se vende hasta que ande»): el paso a paso de «Antes de generar» evita
  que falle callado, pero que el motor ande con la cuenta de Flow de un cliente sigue sin medirse. Medido el 29/10/2026 (base, sólo
  lectura): el motor de AI Avatar **nunca generó un look en producción** (`ai-avatar.looks` vacío en todos los workspaces),
  el ws3 (el de prueba) **nunca vinculó la extensión** (sin fila en `flow_puentes`) y ninguna extensión estaba lista: las de
  los ws 9, 1, 10 y 11 en «sin_sesion» (Google Flow sin una cuenta abierta). Lo que pide, y es de la persona: Chrome con la
  extensión de MaKo, sesión de Google Flow con SU cuenta (paga sus créditos: el look 0, cada toma del video ~15), «Conectar»
  desde el popup con el workspace abierto en MaKo, y una foto de su cara. Lo hace Martín: entrar al ws3, «Conectar», abrir
  Flow con una cuenta de Google, subir una foto y generar un look. **Vive en:** `app/ai-avatar/actions.ts` (`crearLookAction`)
  y el motor del Video Generator.
- **Crear y borrar un look por la API de MaKo.** `ver_avatares` lee (desde el 29/10 también el ajuste escrito y los
  presets nuevos), pero crear encola en Flow y el área de video es «sólo lecturas» por el veredicto §8
  (docs/api-mako-diseno.md); borrar es una escritura sin gasto que hoy vive en una action con sesión. Es un hueco de
  la regla «todo MaKo por la API». **Vive en:** `lib/api-mako/areas/video.def.ts`.
- **El chat de MaKo no sabe hacer nada de AI Avatar todavía.** Va fijo a la izquierda (la tarjeta de PantallaCrear), pero no tiene herramientas para elegir un preset ni generar, y la
  pantalla compartida no le pasa lo que se ve (`pantalla`): lo que se le pide lo reparte el Cerebro como cualquier mensaje. **Vive en:** `app/_chat/MakoEnLaTab.tsx` y el registro de la API.
