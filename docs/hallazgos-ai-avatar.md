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

## El preset decide si el avatar HABLA: 9 de 28 lo dejan mudo (29/10/2026)

- **Síntoma posible:** un anuncio a cámara sale con el guion en off y el avatar callado.
- **El diagnóstico obvio era el equivocado:** «falla el lip-sync».
- **Causa:** `generarPlanAction` reparte el guion con `ritmoDeClips(puesta)`, y las puestas `voz-en-off` y
  `trends-virales` tienen `habla: 'nunca'`. Son 9 presets: `calle-promo`, `cafe-un-dia`, `metro`, `cabina-fotos`,
  `selfie-gran-angular`, `ojo-de-pez`, `camara-seguridad`, `biblioteca` y `niebla`. El primer borrador asignaba justo
  `calle-promo`, `biblioteca` y `cafe-un-dia` a anuncios a cámara.
- **Regla:** una plantilla de venta a cámara usa un preset cuya puesta habla, y un test lo fija: `cafe-un-dia` en la
  plantilla 4 tiene que fallar.

**Vive en:** lib/ai-avatar/plantillas.ts · lib/puestas-data.ts · app/video-generator/actions.ts

## La guarda de cara caza vocabulario de cámara (29/10/2026)

- **Causa:** la regex de tests/ai-avatar.test.ts caza «eye-level» (`\beye\b`), «hair light» y «natural skin texture»,
  palabras estándar de las guías de cámara. Y describir al sujeto (la edad, la barba, el pelo) es justo lo que rompe el
  parecido.
- **Regla:** en los prompts de escena va «a person», con la ropa y la composición, nunca rasgos. El vocabulario de
  Google (CC BY 4.0) entra sin esas tres palabras.

**Vive en:** tests/ai-avatar.test.ts · lib/ai-avatar/plantillas.ts

## El prompt por toma no tiene dónde ir (29/10/2026)

- **Causa:**
  - el video es el plan del Video Generator con UN look para todas las tomas (`conAvatar`);
  - el prompt de cada clip lo escribe el código en español (lib/prompts-video.ts);
  - `conAcento` borra cualquier acento escrito y pone el del cliente;
  - los gestos de HeyGen no entran, porque el motor no los recibe.
- **Lo que no está medido:** la puesta `podcast` declara dos personas, y `conAvatar` fuerza una sola escena: hay que
  medirlo con un video de 2 tomas antes de ofrecer la plantilla 5.
- **Regla:** la plantilla fija el guion total, la escena y el detalle, no las tomas.

**Vive en:** lib/prompts-video.ts · app/video-generator/actions.ts

## Cuánto dura un guion: palabras medidas, y los dígitos achican (29/10/2026)

- **La densidad:** la investigación proponía 18 palabras por toma de 8 s (una estimación suya). La casa midió 3
  palabras por segundo a cámara («menos de 26 en 10 s tartamudea») y 2,1 en The Office. El motor reparte las tomas
  solo, desde el total (`cabidaDeGuion`).
- **Los dígitos:** `contarPalabras` cuenta «1,500» y «2027» como una palabra, pero se dicen con 2 o 3. El guion se
  planifica corto y la voz se apura. Por eso los números van con letras. Está deducido del código, no medido en Flow.

**Vive en:** app/video-generator/actions.ts (`cabidaDeGuion`) · lib/puestas-data.ts

## `sano()` es una lista blanca: un campo nuevo del look desaparece (29/10/2026)

- **Causa:** `sano()` (app/ai-avatar/looks.ts) copia solo los campos que conoce. `guion` o `plantillaVentaId`, si no se
  agregan ahí, se pierden en la primera lectura, sin error.
- **Regla:** cada campo nuevo de `Look` se suma a `sano` en el mismo commit, con su test.

**Vive en:** app/ai-avatar/looks.ts

## «Usar el ejemplo» filmaría el guion ficticio con créditos pagados (29/10/2026)

- **Causa:** hoy «Usar el ejemplo» mete `preset.guion` en la caja, y «Generar video» lo filma.
- **Regla:** la guarda va en el server: `crearVideoAction` rechaza un guion que todavía tiene marcas del ejemplo. El
  botón de la pantalla no alcanza.

**Vive en:** app/ai-avatar/actions.ts

## Un avatar no testimonia, y no inventa el interior de una propiedad (29/10/2026)

- **El testimonio:** la regla de la FTC de 2024 prohíbe testimonios de personas que no existen, también hechos con IA, y
  la política de IA generativa de Google prohíbe suplantar sin aviso. «Testimonio en el sillón» salió, y el caso lo
  cuenta el dueño.
- **El interior:** generar a la asesora «en el departamento muestra» inventa un interior. La escena es una oficina de
  ventas neutra, y el departamento entra solo como material oficial, en las tomas en off.
- **Los retratos del elenco:** son de personas inexistentes, hechos en Flow y con el rótulo «Ejemplo». No se promete la
  voz de esa persona ni una voz clonada: el video habla con la voz de Flow, en el acento del negocio.

**Vive en:** lib/ai-avatar/plantillas-venta.ts (del plan) · public/ai-avatar/plantillas/

## El voseo depende del acento (29/10/2026)

- **Causa:** `marcasDeVoseo` aplicado siempre rechaza el guion correcto de un negocio rioplatense (el plan ya tiene
  `acentoEsVoseante`), y sin aplicarlo pasa «tenés» en uno mexicano. Además, la guarda no caza argentinismos (remera,
  campera, vereda, chomba), y la investigación los usaba.
- **Regla:** la guarda del guion se aplica según el acento del negocio. Los ejemplos del elenco, neutros, pasan además
  una lista de argentinismos, que incluye «dar vuelta» por invertir (`\b(dar|da|dé|darla|darlo)\s+vuelta\b`).

**Vive en:** lib/puestas-data.ts · tests/ai-avatar.test.ts

## Con el motor sin un solo look en producción, la tarjeta no puede depender de él (29/10/2026)

- **Contexto:** se integra en la entrada que midió que el motor nunca generó un look en producción.
- **Regla:**
  - la tarjeta muestra contenido real sin imagen: el marco con el texto en pantalla y la primera frase;
  - los loops no se prometen;
  - hay dos grillas (`NuevaCrear` y la galería del estudio): se separan las plantillas de venta de los presets.

**Vive en:** app/ai-avatar/Estudio.tsx · app/_crear/PantallaCrear.tsx

## Licencias que parecían copiables en AI Avatar (29/10/2026)

- fal-ai-community/skills dice «MIT» en el README, pero no tiene LICENSE (dos 404).
- El SKILL.md de Higgsfield no declara licencia, y la documentación de HeyGen es propietaria.
- Las métricas de Arcads no se copian: en un ejemplo ficticio serían inventadas.
- **Regla:** quedan como idea. Copiables, y con aviso, son motion-creative/skills (MIT, 2025 Motion), marketingskills
  (MIT) y la guía de Google (CC BY 4.0).

**Vive en:** lib/avisos/ (del plan) · docs/plantillas-reales/avatar.md (sección 4)

## La revisión de plata de «AI Avatar para todos»: la puerta entra (29/10/2026, Integración)

- **Qué se revisó:** `ai-avatar-todos-2910` (`4d66a5703`). El informe está en
  `C:/dev/revisiones/2910-revision-plata-ai-avatar-todos-4d66a5703.md`.
- **Verificado:**
  - Sacarla de `TABS_SOLO_PRO` y `NAV_SOLO_PRO` no abre nada más: Video Editor e Image Editor siguen con candado.
  - Las acciones piden sesión, rol admin, la tab en la capa y workspace.
  - **MaKo no paga IA.** El look no usa IA. El plan del video usa la del negocio:
    - el veto de Claude deja sólo `closing`;
    - `video-planner` no está en `CREDITO_HABILITADO_PARA`;
    - la red de la plataforma da `[]` para todo negocio que no sea el ws9.
- **Venderlo en /planes es otra decisión.** Vive en la tabla de planes: ver «La tabla de /planes…» en
  `docs/hallazgos-planes-y-cobro.md`.
- **Storage sin tope ni limpieza (baja):**
  - Looks y tomas van a `video-generator/ai-avatar/…` del bucket público `video-clips`, sin el número de negocio en la ruta.
  - El reset (`lib/reset-workspace.ts`, que borra bajo `String(ws)`) no los borra, y «Eliminar» tampoco.
  - Son centavos, pero sólo crece, y ahora tiene una puerta visible para Esencial.
- **El freno de la prueba no es atómico (baja).** `crearLookAction` y `crearVideoAction` leen el tope, encolan y después suman.
  Dos «Generar video» a la vez pasan el tope de 1. No le cuesta a MaKo, porque los créditos son de Flow, del cliente.
- **Comentarios que mienten:**
  - `lib/movil-creacion.ts` dice «es de Pro».
  - `app/m/ai-avatar/puerta.ts` y `page.tsx` dicen «sólo el super admin».
  - `scripts/landing-principal-high-ticket.mts` espera para publicar la tarjeta a `ai-avatar-para-todos-2910`, una rama
    VIEJA. La que se despliega es `ai-avatar-todos-2910`.

**Vive en:** app/ai-avatar/actions.ts · lib/reset-workspace.ts · scripts/landing-principal-high-ticket.mts

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

## HeyGen no REPLICA el avatar: ANIMA la foto real. Son dos técnicas distintas (7/11/2026)

**Cómo se llegó acá.** Martín pidió clonar piezas de la competencia partiendo de una referencia. Generé un
anuncio de Mauricio tres veces y las tres me dijo que no era él. La tercera vez preguntó lo correcto: «fíjate
cómo hace el proceso HeyGen, que replica avatares».

**La respuesta, y explica los tres fracasos:** el Avatar IV de HeyGen es un motor **de foto a video**. Toma UNA
foto y le mueve la cara según el audio. **La cara nunca se vuelve a dibujar: son los píxeles reales de la
persona.** Por eso sale idéntica.

Lo que yo hacía era otra cosa: pedirle a un modelo de difusión que **redibujara** a la persona en una escena
nueva. Eso **siempre** reinterpreta la cara. **No es un problema de prompt ni de modelo: es la técnica
equivocada para ese objetivo**, y ninguna cantidad de ajuste del prompt lo arregla.

| Lo que se quiere | La técnica |
|---|---|
| Que la persona sea **ella** | **Animar** la foto real (foto→video, lip-sync). La identidad no se genera. |
| Una escena, un fondo, un B-roll | **Generar** (texto→imagen, imagen→imagen). Acá la deriva no importa. |

**Para MaKo:** la cara del cliente sale de su foto; todo lo demás se genera. Mezclarlos en una sola llamada es
pedirle al generador que haga las dos cosas, y la que pierde es siempre la cara. Es, además, exactamente el
método que enseña Avatar Hype: lip-sync para la parte hablada y generación para el resto.

**Las piezas que existen en ApiMart para esto** (el catálogo tiene 52 modelos de video): `seedance-2.0-face`,
`seedance-2.0-fast-face` y `MiniMax-H3-Context-IR`. Las variantes **`-face`** son otra familia que las de
generación libre: están hechas para preservar identidad. **Las que yo usaba no.**

### ⚠️ Y el error de fondo: tomé dos generaciones por fotos reales, dos veces seguidas

Usé `public/anuncios/anuncio-1.jpg` y después la foto de perfil del ws 1 como «la foto de Mauricio». Las dos
eran generadas. El clon salía pareciéndose al original porque **el original ya era un clon**: estaba midiendo
la deriva de una cadena, no el parecido con la persona. Es exactamente lo que el curso del avatar de Mauricio
marca como «el error más caro de toda la producción»: **«nunca referencies IA con IA»**.

**Cómo se distingue, que es lo que me faltaba:** Martín lo vio a simple vista por **el fondo**. Un retrato de
estudio con degradado gris parejo y recorte perfecto es casi siempre generado. Una foto real trae desorden:
ventanas, plantas, sillas, manos con reloj, luz despareja.

**DÓNDE ESTÁ LA FOTO REAL, y no es donde parece:**

- ✅ **`archivero/1/persona/…`** (bucket PRIVADO). Ahí están las fotos que cargó la persona. Cuál es la buena
  lo dice `app_settings` → **`flow.caras`**, que nombra la que está registrada en Flow como fuente de identidad.
- ❌ **`avatars/`** NO sirve para esto: ese bucket **no prefija por workspace**, así que mezcla los avatares de
  todos los negocios y además guarda los generados. Una consulta por nombre devuelve la cara de otra persona.
  Me pasó: bajé un avatar creyendo que era de Mauricio y era de otro.
- ❌ **`user_avatar_url`** del ws 1 apunta a una imagen GENERADA. Es la foto de perfil de la app, no una fuente
  de identidad.

**La regla:** antes de usar una imagen como referencia de identidad hay que saber **de dónde salió**. Si no se
puede decir quién la sacó y con qué, no sirve como ancla — y el resultado va a parecerse a algo que no es la
persona, sin que nada avise.

**Vive en:** `archivero/1/persona/` · `app_settings.flow.caras` (ws 1) ·
`app/conocimientos/curso-avatar-app.ts` (clase 1, «nunca referencies IA con IA») · `lib/curso-avatar.ts`.

## La identidad no la preserva el MODELO: la preserva el MÉTODO. Medido (7/11/2026)

Continúa la entrada de arriba («HeyGen no REPLICA el avatar: ANIMA la foto real»). Aquella explicaba por qué
tres intentos salieron con otra cara. Ésta mide qué hay que hacer, y **tira el modelo caro**.

**La hipótesis que había que probar:** si la clave es *animar* y no *generar*, entonces no hace falta un modelo
caro de la familia `-face`: cualquier **image-to-video** debería servir, porque ahí la foto **es el cuadro 0** y
la cara no se genera — se arrastra.

**Se midió, no se supuso.** Cuatro generaciones pagadas contra ApiMart, todas partiendo de la MISMA foto real de
Mauricio (`archivero/1/persona/…`, la que nombra `app_settings.flow.caras`), mismo prompt, y comparando el
**ÚLTIMO cuadro** de cada video, que es donde la deriva se nota:

| modelo                  | US$/s medido | formato que devolvió | ¿es Mauricio en el último cuadro? |
|-------------------------|--------------|----------------------|-----------------------------------|
| MiniMax-Hailuo-2.3-Fast | **0,0253**   | 768×1024 (3:4) ✗     | **sí**                            |
| **seedance-2.0-mini**   | **0,0384**   | **720×1280 (9:16)** ✓| **sí** ← el default               |
| seedance-2.0-fast-face  | 0,0836       | 720×1280 (9:16) ✓    | sí                                |
| wan2.6-i2v-flash        | —            | falló, **sin cargo** | —                                 |

**El resultado: la familia `-face` cuesta 2,2× y no compra nada.** Un modelo barato de i2v conserva la cara
igual de bien. Lo que fallaba antes no era el modelo: era pedirle al modelo que **redibujara** a la persona.

**El default es `seedance-2.0-mini`, no el más barato.** Hailuo sale un tercio menos pero devolvió **3:4**, y un
reel es 9:16. Un formato equivocado no se arregla recortando: recorta la cara. Hasta medir que Hailuo acepte el
formato, el default es el que ya lo devuelve bien.

**Qué cambió en el código:** `lib/mako-tokens-reglas.ts` → `USD_POR_SEGUNDO.normal` pasó de `0.030` a `0.0384`.
El 0,030 salía del **tarifario de un proveedor**, no de una medición nuestra: el medidor cobraba **28 % menos**
de lo que la generación costaba, y esa diferencia salía del margen en cada llamada.

### ⚠️ Y el agujero de método, que es lo que más vale de todo esto

**Ningún test lo cachó, y había 13.** Con `normal` mentido hacia abajo a `0,001` —38 veces por debajo del costo
real— los 13 seguían en verde: los que existían miraban que `normal < premium` (se cumple igual) y que el cupo
alcanzara para competir (alcanza de sobra, justamente porque el número es falso). **Un número mentido hacia
abajo no rompe ninguna invariante: hace que todo cierre mejor.**

La guarda que faltaba no puede ser «este precio es el correcto» —un test no lo sabe sin llamar al proveedor, y
entonces cuesta plata y se cae sin red—. Es **«este número está donde viven los precios de verdad»**: piso 0,010
y techo 0,200. Si el proveedor baja de golpe, se pone rojo y obliga a **medirlo y anotar la fecha**, que es
exactamente lo que faltó. Vive en `tests/mako-tokens.test.ts`.

**La regla que queda:** un precio copiado de un tarifario es un dato sin fecha y sin medición. Es el mismo error
que el `TOPE_REFERENCIAS = 14` sacado del README de un proveedor (`lib/carruseles/clon-reglas.ts`): **lo que una
API acepta no es lo que funciona, y lo que un tarifario publica no es lo que te cobran.** Las dos veces el
número venía de leer, no de medir, y las dos veces la realidad estaba peor.

**Vive en:** `lib/mako-tokens-reglas.ts` · `tests/mako-tokens.test.ts` · las piezas medidas quedaron en el
scratchpad de la sesión del 7/11.

## ⚠️ FLOW NO CLONA VOCES — y aun así el paso de sincronizar labios desaparece (9/11/2026)

Martín preguntó si Flow se conecta con ElevenLabs, para ahorrarse pasos. **Medido abriendo el
selector de assets de Flow → «Voices»: no.** Lo que hay es un **catálogo cerrado de voces sintéticas
de Google** (Achernar, Achird, Algenib, Algieba, Alnilam, Aoede, Autonoe, Callirrhoe, Charon,
Despina, Enceladus…), cada una con su timbre fijo descrito en una línea («Male, informative, lower
pitch»), un campo de «Sample dialogue» de 100 caracteres para escucharla y otro de «Customize
performance» para describir la interpretación. **No hay dónde subir una voz propia ni enlazar una de
ElevenLabs.** Así que el clon profesional sigue viviendo en ElevenLabs.

**Pero lo importante es lo otro, y cambia el orden del método:** Omni **genera audio** y dice la
frase que le escribas, **con los labios sincronizados**. O sea que el paso que más dolor costó —
sincronizar labios sobre un clip ya hecho, que es lo que llevó a wav2lip, a YuNet y a toda la noche
del 8/11 — **ya no hace falta**: se le escribe la frase, Omni la actúa, y después esa pista se pasa
por **voice-to-voice** a ElevenLabs con el clon profesional (`eleven_multilingual_sts_v2`, la config
de `scratchpad/walter/LA-CONFIG.json`). Como las palabras y los tiempos son los mismos, los labios
siguen coincidiendo.

⚠️ **Y LA TRAMPA QUE COSTÓ UN CLIP: SI NO LE ESCRIBÍS LA FRASE, LA INVENTA — Y EN INGLÉS.** El primer
clip se pidió con «speaks one short sentence» y Omni habló en inglés diciendo cualquier cosa. No es
un bug: es que a un modelo que genera audio hay que **darle el texto y el idioma**, igual que se le
da el encuadre. La frase va entre comillas en el prompt, con «IN SPANISH, exactly this and nothing
else», y conviene además describir el acento (rioplatense) y pedir «no subtitles».

Costo medido en Flow: un clip de **8 s, 720p, 9:16, Omni 1.2 Flash** sale **24 créditos en x1** y 48
en x2. Las imágenes, en cambio, dicen «Generating will use 0 credits»: son gratis de verdad.
