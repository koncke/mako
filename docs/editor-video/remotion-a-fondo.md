# Remotion para la pestaña Video de MaKo: edición sin RAM del cliente y catálogo completo de efectos

- **Fecha:** 11/11/2026.
- **Base revisada:** Remotion **4.0.542**. Leí el código del repo `remotion-dev/remotion` en el commit `841684051541d2d63efcc82744f5633f8bbe8919` (11/11/2026), la documentación de remotion.dev y fuentes externas. Todas tienen su enlace.
- **Cómo leer este informe:**
  - Todo lo que no lleva fuente es una **propuesta mía** y está marcada como tal.
  - No ejecuté código.
  - **No medí RAM** ni revisé el código del editor de MaKo (el port de OpenCut).

---

## 1. Respuesta corta para Martín

### ¿Se puede editar en Remotion con la carga fuera de la máquina del cliente?

**No del todo: es PARCIAL.** Estoy seguro de lo que dice la documentación oficial: **Remotion no ofrece ninguna forma de editar con la vista previa calculada en la nube.** Esto es lo que encontré:

1. **La vista previa siempre corre en el navegador del usuario.**
   - El `<Player>` es un componente de React que se monta en tu app ([Player](https://www.remotion.dev/docs/player)).
   - El Studio está construido sobre ese mismo Player. Remotion no permite incrustar el Studio en otra app ([¿Puedo incrustar el Studio?](https://www.remotion.dev/docs/miscellaneous/embed-studio)).
   - Incluso en un Studio desplegado, las herramientas de reproducción «corren localmente» y necesitan «una vista previa lista, no un servidor de Studio conectado» ([WebMCP](https://www.remotion.dev/docs/ai/webmcp)).
2. **Desplegar el Studio en un servidor no mueve la vista previa.**
   - Hay una guía para desplegar el Studio en un VPS (Fly.io, Render.com) ([Deploy to a VPS](https://www.remotion.dev/docs/studio/deploy-server)), y otra para desplegarlo como sitio estático ([Deploy as static site](https://www.remotion.dev/docs/studio/deploy-static)).
   - En ambos casos el servidor agrega el botón de **render**, pero la reproducción sigue en el navegador de quien lo abre.
   - El Studio es una herramienta para desarrolladores: su formato son archivos de código React, no un estado JSON por proyecto ([Editor Starter vs Studio](https://www.remotion.dev/docs/editor-starter/vs-studio)).
3. **Lo único que corre en la nube es el render, y tarda segundos.**
   - Hay APIs para videos (`renderMediaOnLambda`), cuadros sueltos (`renderStillOnLambda`) y secuencias de cuadros (`renderFramesOnLambda`, desde 4.0.535) ([renderFramesOnLambda](https://www.remotion.dev/docs/lambda/renderframesonlambda)).
   - El ejemplo oficial de costos muestra que el proyecto «Hello World» tarda **7,56 s con la Lambda caliente y 11,02 s en frío** ([Cost example](https://www.remotion.dev/docs/lambda/cost-example)).
   - Sirve para exportar o para una «vista previa renderizada» a pedido. No sirve para mover el cabezal en vivo, que necesita un cuadro cada ~33 ms.
4. **Remotion dice explícitamente que no está pensado para tiempo real.**
   - Su enfoque declarativo «no es adecuado» para transmisión en vivo ([Live streaming FAQ](https://www.remotion.dev/docs/miscellaneous/live-streaming)).
   - No hay paquete ni guía para transmitir por WebRTC o *pixel streaming* los cuadros que renderiza un servidor.
   - `@remotion/streaming` es un paquete interno para pasar datos entre procesos, no video ([README](https://github.com/remotion-dev/remotion/blob/main/packages/streaming/README.md)).
5. **Cloud Run no se está desarrollando** y nunca se marcó como listo para producción ([Cloud Run status](https://www.remotion.dev/docs/cloudrun/status)).
   - Lambda y Vercel Sandbox **no tienen GPU** ([Comparación SSR](https://www.remotion.dev/docs/compare-ssr), [GPU](https://www.remotion.dev/docs/gpu)).
6. **remotion.new no sirve como editor en la nube.**
   - Es un Studio que corre **entero en el navegador**: sistema de archivos virtual y compilación con Rspack ([remotion.new](https://www.remotion.dev/docs/studio/remotion-dev-new)).
   - Es lo contrario de lo que buscamos: todo el trabajo queda en la máquina del usuario.

### Lo que sí haría la edición súper fluida

La edición fluida no se logra moviendo el compositor a la nube. Se logra **haciendo que lo que compone el navegador sea liviano** y mandando a la nube todo lo demás. Es el modelo que describe Descript para su app web:

- Decodifica y compone en la GPU del usuario con WebCodecs.
- Un «Media Transform Server» en la nube, sin estado, le manda el medio **en pedazos chicos y a pedido**, adaptado a la capacidad de la máquina y al tamaño de la ventana.
- Los efectos de IA corren en GPUs de la nube y se preparan antes de reproducir ([Descript, 19/07/2024](https://www.descript.com/blog/article/the-new-descript-how-we-multiplied-the-apps-speed-and-performance)).

Descript también documenta los *proxies*:

- Los originales quedan en la nube.
- El usuario edita sobre copias livianas.
- La exportación siempre usa el original ([Descript: proxy files](https://help.descript.com/hc/en-us/articles/12792882150029)).

Con Remotion eso se arma así (detalle en §2.2 y §4):

1. **Proxies** de baja resolución generados en la nube.
2. `<Video>` de `@remotion/media` en la vista previa:
   - descarga parcial por rangos;
   - usa el proxy en la vista previa y el original solo en el render (`useRemotionEnvironment`).
3. Los controles documentados para bajar memoria:
   - `maxCanvasSinkFrameSize`;
   - `effectsOutputSize`;
   - no usar `prefetch()`;
   - un *premount* corto.
4. **Miniaturas y formas de onda** precalculadas en el servidor.
5. **Exportación en Lambda** con las credenciales AWS del cliente (BYOK).
6. Lo pesado como **trabajo aparte en la nube**:
   - quitar el fondo;
   - transcribir;
   - mostrar como «vista previa renderizada» las transiciones que el navegador del usuario no puede mostrar.

**Advertencia importante:** pasar de OpenCut al Player de Remotion **no baja la RAM por sí solo**. El Player también corre en el navegador. Lo que baja la RAM son los proxies, el streaming y los límites de arriba. No medí cuánto ahorra cada palanca (ver §5).

---

## 2. Edición en la nube: opciones, pros, contras y costos

### 2.1 Lo que Remotion ofrece oficialmente, y dónde corre cada cosa

| Mecanismo | Dónde corre | ¿Sirve para editar en vivo sin RAM del cliente? | Fuente |
|---|---|---|---|
| `<Player>` | Navegador del usuario | No: es justamente lo que consume RAM | [Player](https://www.remotion.dev/docs/player) |
| Remotion Studio local o desplegado (VPS o estático) | La vista previa en el navegador; el servidor solo empaqueta y renderiza | No | [deploy-server](https://www.remotion.dev/docs/studio/deploy-server), [deploy-static](https://www.remotion.dev/docs/studio/deploy-static), [WebMCP](https://www.remotion.dev/docs/ai/webmcp) |
| Incrustar el Studio en tu app | No está permitido | — | [embed-studio](https://www.remotion.dev/docs/miscellaneous/embed-studio) |
| remotion.new / `@remotion/browser-bundler` | Todo en el navegador; el bundler es borrador, «solo probado en Chrome» y pide aislamiento de origen cruzado (COOP/COEP) | No (es lo opuesto) | [remotion.new](https://www.remotion.dev/docs/studio/remotion-dev-new), [browser-bundler](https://www.remotion.dev/docs/browser-bundler) |
| `renderStillOnLambda` / `renderFramesOnLambda` / `renderMediaOnLambda` | AWS Lambda, sin GPU | Solo bajo pedido (segundos); no para mover el cabezal | [renderFramesOnLambda](https://www.remotion.dev/docs/lambda/renderframesonlambda), [Cost example](https://www.remotion.dev/docs/lambda/cost-example) |
| Vercel Sandbox, Node/Bun, Cloudflare Containers, Cloud Run | Servidor | Igual: render, no vista previa | [Comparación SSR](https://www.remotion.dev/docs/compare-ssr) |
| Render en el cliente (`@remotion/web-renderer`) | Navegador (WebCodecs) | No; además corre en la misma pestaña y puede trabar la UI | [Page responsiveness](https://www.remotion.dev/docs/client-side-rendering/page-responsiveness) |

### 2.2 Qué baja la RAM en el navegador con Remotion

Todo esto existe hoy en la versión 4.0.542.

1. **`<Video>` de `@remotion/media` descarga el archivo en partes.**
   - Según la comparación oficial, es el único tag con «Partial download of asset ✅» sin necesitar `muted`. En vista previa usa WebCodecs ([Comparación de tags](https://www.remotion.dev/docs/video-tags)).
   - En el código, la vista previa abre cada `src` con un `UrlSource` de Mediabunny.
   - Ese `UrlSource` tiene un caché de bytes con techo de **64 MiB por fuente distinta**. Con el presupuesto por defecto de 1 GB queda en 62,5 MiB, y las ventanas del mismo medio comparten una sola entrada ([get-shared-input.ts](https://github.com/remotion-dev/remotion/blob/main/packages/media/src/get-shared-input.ts), [max-cache-size.ts](https://github.com/remotion-dev/remotion/blob/main/packages/media/src/max-cache-size.ts)).
   - **Consecuencia práctica:** cuantas menos fuentes distintas tenga el proyecto (un proxy por asset, no varias versiones del mismo archivo), menos caché se acumula.
2. **El búfer de vista previa es chico.** El iterador de vista previa adelanta **3 cuadros** (`BUFFER_SIZE = 3`) ([canvas-ahead-of-time.ts](https://github.com/remotion-dev/remotion/blob/main/packages/media/src/canvas-ahead-of-time.ts)).
   - El caché grande que puede usar «hasta el 50 % de la RAM» es el del **render**, no el de la vista previa ([Cache](https://www.remotion.dev/docs/media/cache), [video-for-rendering.tsx](https://github.com/remotion-dev/remotion/blob/main/packages/media/src/video/video-for-rendering.tsx)).
3. **`maxCanvasSinkFrameSize` (desde 4.0.530):**
   - Limita el tamaño de los cuadros que entrega Mediabunny en la vista previa del Studio y del Player.
   - Según la documentación, «cuadros más chicos usan menos memoria cuando un video grande se muestra chico».
   - El video se sigue decodificando a tamaño completo, y el render no cambia.
   - La propia documentación sugiere elegirlo según el zoom con `useCurrentScale()`, con pocos tamaños fijos, porque cambiarlo recrea el reproductor ([`<Video>`](https://www.remotion.dev/docs/media/video)).
   - **Cuenta mía, solo para dar escala:** un cuadro RGBA de 1920×1080 ocupa 8,29 MB y uno de 960×540, 2,07 MB, cuatro veces menos.
4. **`effectsOutputSize` (desde 4.0.536):**
   - Fija la resolución a la que corre la cadena de efectos.
   - La documentación aclara que es útil «al alternar entre un video original y un proxy más chico».
   - También avisa que más resolución significa más procesamiento y más memoria de canvas ([@remotion/effects](https://www.remotion.dev/docs/effects/api)).
5. **Proxies en la vista previa y original en el render.**
   - `useRemotionEnvironment()` distingue `isPlayer`, `isRendering`, etc.
   - La documentación muestra el patrón de usar un componente en la vista previa y otro en el render ([useRemotionEnvironment](https://www.remotion.dev/docs/use-remotion-environment), [Comparación de tags](https://www.remotion.dev/docs/video-tags)).
   - El mismo patrón sirve para cambiar el `src` (aplicación mía del patrón).
   - `<Video>` también acepta **HLS (`.m3u8`)** ([`<Video>`](https://www.remotion.dev/docs/media/video)), así que los proxies pueden servirse como HLS.
6. **No usar `prefetch()`.** La documentación avisa que primero descarga el medio entero y **lo guarda en memoria**, y lo desaconseja ([Preloading](https://www.remotion.dev/docs/player/preloading), [prefetch](https://www.remotion.dev/docs/prefetch)).
7. **Premontar poco.**
   - El *premount* monta los componentes antes de que aparezcan. Hoy el Player no premonta por defecto; en Remotion 5.0 lo hará 2 s ([Premounting](https://www.remotion.dev/docs/player/premounting)).
   - Más premontaje significa más videos montados a la vez. Que eso suba la RAM es deducción mía, no un dato documentado.
8. **Memoria del caché en el Player.**
   - En el código existe el global `window.remotion_mediaCacheSizeInBytes` (mínimo 240 MB). De él se deriva el caché por fuente.
   - El Player **no lo expone como opción documentada**, así que sería un ajuste no oficial ([max-cache-size.ts](https://github.com/remotion-dev/remotion/blob/main/packages/media/src/max-cache-size.ts)).

### 2.3 Otros mecanismos del estado del arte (2025–2026)

#### A) *Pixel streaming*: el editor corre en una máquina con GPU en la nube y el navegador recibe video

- **Cómo funciona:**
  - **Runway (2021):** sus servidores decodificaban, aplicaban modelos y re-codificaban, y entregaban el resultado por **HLS** en segmentos de ~3 s, «compitiendo contra el cabezal». Una sola petición podía ocupar «una GPU NVIDIA entera» varios segundos. Bajaron la mediana de 433 ms a 285 ms con una cola de workers ([Runway, 01/11/2021](https://runway.com/research/distributing-work-adventures-queuing-and-autoscaling)).
  - **Escritorios remotos para edición:** Parsec, Amazon DCV (tiene cliente web HTML5) y otros. La latencia y la sincronía de audio y video son los problemas principales ([MASV](https://massive.io/gear-guides/remote-desktop-software-for-video-editing/), [Cloudzy](https://cloudzy.com/blog/after-hp-anyware-self-hosted-alternative/)).
- **Costo:** una máquina con GPU por cada usuario conectado. Referencia: g4dn.xlarge (T4), ~0,526 USD/h bajo demanda en us-east-1, según agregadores; no lo confirmé en la página de AWS ([Holori](https://calculator.holori.com/aws/ec2/g4dn.xlarge/us-east-1)).
- **Encaje para MaKo:** malo.
  - Costo por hora y por usuario.
  - Ancho de banda.
  - Latencia al mover el cabezal.
  - Remotion no lo soporta (§1).
  - El BYOK se complica: habría que levantar GPUs en la cuenta de cada cliente.
- **Qué copiar:** la idea de Runway de **renderizar en el servidor solo los tramos pesados** y reproducirlos como video normal.

#### B) Proxies: lo liviano en el cliente y lo completo en la nube

- **Cómo funciona:**
  - **Descript:** ver §1. Media Transform Server en la nube, composición en la GPU local con WebCodecs y efectos de IA en GPUs de la nube ([Descript](https://www.descript.com/blog/article/the-new-descript-how-we-multiplied-the-apps-speed-and-performance), [proxies](https://help.descript.com/hc/en-us/articles/12792882150029)).
  - **Blackbird:** editor en el navegador con un códec proxy propietario. Se edita sobre el proxy y el original queda en servidores Edge. Dicen que funciona con conexiones de 2 Mb/s, pero es dato del fabricante ([Wikipedia](https://en.wikipedia.org/wiki/Blackbird_(software)), [Blackbird](https://www.blackbird.video/product-focus/professional-video-editing-with-low-and-unpredictable-bandwidth/)).
  - **CapCut**, en una página general: un editor web «puede sentirse ágil cuando genera vistas previas livianas y manda el trabajo intensivo a servidores en la nube» ([CapCut](https://www.capcut.com/create/online-video-editor-vs-installed-app-trade-offs)).
- **Costo:** transcodificar una vez por asset, más almacenamiento del proxy, más el render final. Con BYOK puede correr en la cuenta de nube del cliente.
- **Encaje para MaKo:** **el mejor.** Ataca la RAM de raíz y funciona igual con OpenCut o con Remotion.
- **Qué copiar:** todo el patrón (ver §4).

#### C) Motores de línea de tiempo en el servidor con API

Las tres son plataformas de render con API. Ninguna saca la vista previa del navegador.

| Servicio | Precio oficial | Editor o vista previa | Fuente |
|---|---|---|---|
| Shotstack | PAYG 10 USD = 50 min (20 ¢/min); Starter 39 USD/mes = 250 min; Pro 99 USD = 750 min; Scale 199 USD = 2000 min; Volume 499 USD = 10 000 min | Editor de marca blanca incluido, *source-available* (PolyForm Shield), exporta con FFmpeg | [Shotstack pricing](https://shotstack.io/pricing/) |
| Creatomate | Essential 45 USD/mes (2000 créditos); Growth 108 USD; Beyond 274 USD; 1 crédito = 100 M píxeles de salida | «Embed & Preview SDK» solo desde Growth | [Pricing](https://creatomate.com/pricing), [créditos](https://creatomate.com/docs/account/how-are-credits-calculated) |
| JSON2Video | 1 crédito por segundo; Hobby 16,63 USD/mes (50 min); Professional 49,95 USD (200 min); Startup 99,95 USD (500 min); prepago 49,95 USD = 120 min | API JSON | [Pricing](https://json2video.com/pricing/) |

- **Encaje para MaKo:** bajo. Repite lo que Remotion Lambda ya hace gratis para MaKo, cobra por minuto y no es BYOK.
- **Qué copiar:** el **esquema JSON de la línea de tiempo** (pistas, clips, efectos y keyframes como datos). Es también lo que recomienda el Editor Starter de Remotion ([state management](https://www.remotion.dev/docs/editor-starter/state-management)).

#### D) SDKs de editor que corren en el cliente

- **IMG.LY CE.SDK:**
  - «Los videos se renderizan enteramente en el cliente vía WebCodecs», con WebGL.
  - Ofrece render opcional en servidor con Node.
  - Recomienda **al menos 4 GB de RAM**.
  - El precio es a cotizar ([IMG.LY video for web](https://img.ly/products/video-for-web.md)).
- **Rendley:**
  - Render en el dispositivo del usuario, con motor opcional autoalojado en servidor.
  - Keyframes, LUT, transiciones WebGL y Lottie.
  - Pro a **150 USD/mes** por un dominio ([Rendley SDK](https://rendley.com/sdk)).
- **Encaje para MaKo:** no resuelven la RAM, porque siguen siendo del lado del cliente. Además cuestan, mientras que Remotion es gratis para MaKo.
- **Qué copiar:** que el **mismo motor** haga la vista previa y el render, que es lo que ya da Remotion.

#### E) Editores livianos basados en WebCodecs

- **Clipchamp:**
  - Todo el proceso corre en el navegador: FFmpeg en WASM más WebCodecs, con workers.
  - Su propio ingeniero lista los **límites de memoria y almacenamiento** del navegador como desafío ([W3C 2021](https://www.w3.org/2021/03/media-production-workshop/talks/soeren-balko-clipchamp-webcodecs.html), [web.dev](https://web.dev/case-studies/clipchamp)).
- **CapCut web:** motor C++ compilado a WASM más WebCodecs ([web.dev](https://web.dev/case-studies/capcut)).
- **Descript:** WebCodecs con copia cero hacia WebGL/WebGPU. Antes, copiar los cuadros limitaba la reproducción a ~720p; un cuadro 4K decodificado ocupa ~33 MB ([Descript](https://www.descript.com/blog/article/the-new-descript-how-we-multiplied-the-apps-speed-and-performance)).
- **Remotion** ya está en esta familia: `@remotion/media` se apoya en Mediabunny y WebCodecs.
  - Remotion anunció que **dejará de mantener Media Parser y `@remotion/webcodecs`** a favor de Mediabunny ([Blog](https://remotion.dev/blog/mediabunny)).
  - Conviene no construir nada nuevo sobre esos dos paquetes.

### 2.4 Comparación rápida

| Opción | ¿Saca la RAM del cliente? | Costo variable | Encaje con BYOK | Esfuerzo |
|---|---|---|---|---|
| A. *Pixel streaming* | Sí, casi toda | Alto (GPU/h por usuario) | Malo | Muy alto, sin soporte de Remotion |
| B. Proxies + Remotion | Mucho (por resolución, streaming y límites) | Bajo (transcodificar una vez + render) | Bueno (S3/R2 + Lambda del cliente) | Medio |
| C. API de render (Shotstack y otras) | No (la vista previa sigue local) | Por minuto | Malo | Bajo, pero duplica Lambda |
| D. SDK de cliente | No | Licencia | Neutro | Medio |
| E. WebCodecs puro | No por sí solo | — | — | — |

---

## 3. Catálogo completo de efectos y elementos de Remotion

### 3.1 Reglas comunes de `@remotion/effects`

- **El número:** la home de Remotion dice «80 presets that apply to any Element» y «20 presets» de transiciones ([remotion.dev](https://www.remotion.dev/)). El catálogo actual del código tiene **91 efectos en 7 categorías** ([effect-catalog.ts](https://github.com/remotion-dev/remotion/blob/main/packages/studio-shared/src/effect-catalog.ts)), con 90 rutas exportadas en el paquete ([package.json](https://github.com/remotion-dev/remotion/blob/main/packages/effects/package.json)).
- **A qué se aplican:** se pasan en la prop `effects` de:
  - `<Video>` (de `@remotion/media`), `<Img>`, `<CanvasImage>`, `<AnimatedImage>`, `<Gif>`, `<Solid>`;
  - `<RemotionRiveCanvas>`;
  - los componentes de `@remotion/shapes`;
  - `<HtmlInCanvas>`.

  Se encadenan en orden ([Effects](https://www.remotion.dev/docs/effects), [@remotion/effects](https://www.remotion.dev/docs/effects/api)).
- **Dónde corren:** las 91 páginas tienen implementación WebGL2, todas tienen WebGPU y varias tienen Canvas 2D.
  - **Lambda usa WebGL2 o 2D**, así que todos se pueden renderizar ahí ([preferred effect backend](https://www.remotion.dev/docs/options/preferred-effect-backend)).
  - Lambda no tiene GPU, así que lo WebGL se dibuja por software y es más lento ([GPU](https://www.remotion.dev/docs/gpu)).
  - En el navegador hace falta WebGL2 o WebGPU.
  - Las páginas con tabla de compatibilidad marcan Chrome, Firefox, Safari, Player, Studio y render en cliente y servidor (por ejemplo [lut()](https://www.remotion.dev/docs/effects/lut)).
- **Ojo con el texto:** el texto de Remotion es DOM. Para aplicarle efectos hay que envolverlo en `<HtmlInCanvas>`, que en la vista previa **necesita Chrome 149+ con `chrome://flags/#canvas-draw-element` activado**.
  - Si no está disponible, el componente **lanza un error fatal**, así que hay que comprobar `HtmlInCanvas.isSupported()` antes de usarlo.
  - En el render del servidor funciona sin configurar nada ([HtmlInCanvas](https://www.remotion.dev/docs/remotion/html-in-canvas), [guía](https://www.remotion.dev/docs/html-in-canvas)).
- **Keyframes:** cada parámetro es un valor por cuadro, así que se puede animar con `interpolate()`. El Studio escribe esos keyframes como código ([updateEffectKeyframes](https://www.remotion.dev/docs/codemods/update-effect-keyframes)).
- **Efectos propios:** `createEffect()` admite Canvas 2D, WebGL2 y WebGPU ([Effects](https://www.remotion.dev/docs/effects)).
- **Licencia:**
  - Remotion License; el `package.json` dice `UNLICENSED` y el repo entero se rige por la licencia de Remotion. Es gratis para MaKo mientras tenga 3 personas o menos ([LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [@remotion/effects](https://www.remotion.dev/docs/effects/api)).
  - Algunos *shaders* están adaptados de EffectCraft, con licencia MIT ([THIRD_PARTY_LICENSES](https://github.com/remotion-dev/remotion/blob/main/packages/effects/THIRD_PARTY_LICENSES.md)).

Cada efecto tiene su página en `https://www.remotion.dev/docs/effects/<nombre-en-kebab>`, por ejemplo `/docs/effects/white-balance`.

#### Color (20) → «Ajustar» y «Filtros»

| Efecto | Qué hace | En el editor |
|---|---|---|
| `brightness()` | Brillo | Ajustar |
| `contrast()` | Contraste | Ajustar |
| `colorCorrection()` | Corrección primaria combinada (exposición, contraste, temperatura, vibrance…) | Ajustar (panel principal) |
| `colorKey()` | Quita un color clave (pantalla verde) | Eliminar fondo / Croma |
| `curves()` | Curvas RGB o por canal | Ajustar avanzado |
| `duotone()` | Umbral de dos colores | Filtros |
| `exposure()` | Exposición en pasos (stops) | Ajustar |
| `grayscale()` | Blanco y negro | Filtros |
| `hue()` | Rotación de tono | Ajustar |
| `invert()` | Negativo | Filtros |
| `levels()` | Punto negro, punto blanco y gamma | Ajustar avanzado |
| `lut()` | LUT 3D `.cube` en línea (tamaño 2 a 256; no admite 1D) | Filtros / LUT |
| `saturation()` | Saturación | Ajustar |
| `shadowsHighlights()` | Recupera sombras y luces | Ajustar |
| `tint()` | Tinte de color | Filtros |
| `whiteBalance()` | Temperatura y tinte | Ajustar |
| `vibrance()` | Saturación selectiva | Ajustar |
| `linearGradient()` | Degradado de dos paradas | Filtros / Fondos |
| `linearGradientTint()` | Tinte en degradado | Filtros |
| `thermalVision()` | Mapa de calor térmico | Filtros |

Fuentes: [catálogo](https://github.com/remotion-dev/remotion/blob/main/packages/studio-shared/src/effect-catalog.ts), [Color correction](https://www.remotion.dev/docs/color-correction), [lut()](https://www.remotion.dev/docs/effects/lut).

#### Desenfoque y sombra (11) → «Efectos»

| Efecto | Qué hace | En el editor |
|---|---|---|
| `blur()` | Desenfoque gaussiano (también direccional) | Efectos / fondo desenfocado |
| `lensBlur()` | Desenfoque de lente con bokeh | Efectos |
| `linearProgressiveBlur()` | Desenfoque controlado por degradado | Efectos |
| `radialProgressiveBlur()` | Desenfoque controlado por elipse | Efectos |
| `regionBlur()` | Desenfoca una región rectangular o redondeada | Censurar / difuminar |
| `zoomBlur()` | Desenfoque radial de zoom | Efectos |
| `dropShadow()` | Sombra por alfa | Texto / Stickers |
| `longShadows()` | Sombra larga o extrusión falsa | Texto |
| `glow()` | Halo suave | Efectos / Texto |
| `outline()` | Contorno sólido por alfa | Stickers / Texto |
| `lightTrail()` | Estela de luz direccional | Efectos |

#### Revelado (6) → «Animación de entrada y salida» y transiciones

| Efecto | Qué hace |
|---|---|
| `evolve()` | Revelado direccional con ángulo y borde suave |
| `tear()` | Desgarro en zigzag progresivo |
| `filmBurn()` | Quemado de película con bordes encendidos |
| `radialWipe()` | Barrido en cuña alrededor de un centro |
| `irisWipe()` | Apertura en polígono o estrella |
| `venetianBlinds()` | Persianas |

**Idea mía, sin probar:** como estos efectos son de canvas, animar su progreso sobre el clip saliente daría transiciones que se ven en la vista previa **sin** el flag de Chrome.

#### Transformación (5) → «Ajustar»

| Efecto | Qué hace |
|---|---|
| `mirror()` | Reflejo |
| `scale()` | Escala |
| `tile()` | Repite el contenido visible |
| `uvTranslate()` | Desplaza en coordenadas UV |
| `xyTranslate()` | Desplaza en píxeles |

#### Distorsión (11) → «Efectos»

| Efecto | Qué hace |
|---|---|
| `barrelDistortion()` | Distorsión de barril |
| `chromaticAberration()` | Separación de canales RGB (*glitch*) |
| `magnify()` | Lupa circular o cuadrada |
| `fisheye()` | Ojo de pez |
| `cornerPin()` | Fija las esquinas a un cuadrilátero (pantallas, mockups) |
| `pageTurn()` | Pasar página con pliegue |
| `sphere()` | Envuelve en una esfera giratoria |
| `cylinder()` | Envuelve en un cilindro giratorio |
| `wave()` | Ondas senoidales |
| `skew()` | Sesgo en dos ejes |
| `turbulentDisplace()` | Turbulencia, abultamiento y torsión |

#### Estilizar (20) → «Efectos» y «Filtros»

| Efecto | Qué hace |
|---|---|
| `burlap()` | Textura de arpillera |
| `bevelAlpha()` | Biselado de bordes de texto y formas |
| `emboss()` | Relieve |
| `dotGrid()` | Máscara de puntos con el color de la fuente |
| `halftone()` | Semitono |
| `noise()` | Grano |
| `noiseDisplacement()` | Desplazamiento con ruido localizado |
| `paper()` | Textura de papel |
| `roughenEdges()` | Bordes ásperos |
| `pattern()` | Mosaico repetido |
| `pixelDissolve()` | Disolución pixelada |
| `pixelate()` | Pixelado |
| `linearProgressivePixelate()` | Pixelado por degradado |
| `radialProgressivePixelate()` | Pixelado por elipse |
| `scanlines()` | Líneas de escaneo (VHS/CRT) |
| `speckle()` | Agujeros de alfa aleatorios |
| `shatter()` | Rompe en fragmentos que caen |
| `shine()` | Destello brillante que barre |
| `shrinkwrap()` | Plástico envolvente |
| `vignette()` | Viñeta |

#### Generar (18) → «Efectos» y «Fondos»

| Efecto | Qué hace |
|---|---|
| `lightning()` | Rayos con resplandor |
| `rainFall()` | Lluvia con viento y profundidad |
| `snowFall()` | Nieve |
| `fractalNoise()` | Ruido fractal que evoluciona |
| `contourLines()` | Curvas de nivel |
| `liquidContours()` | Fondo líquido de dos colores |
| `checkerboard()` | Damero |
| `flannel()` | Tela escocesa |
| `halftoneLinearGradient()` | Degradado de puntos |
| `gridlines()` | Cuadrícula |
| `whiteNoise()` | Estática gris |
| `tvSignalOff()` | Barras de color de TV |
| `lines()` | Rayas alternadas |
| `rings()` | Anillos concéntricos |
| `waves()` | Bandas onduladas |
| `zigzag()` | Bandas en zigzag |
| `lightLeak()` | Fuga de luz |
| `starburst()` | Rayos de estallido |

`@remotion/light-leaks` y `@remotion/starburst` están **en desuso**. Se dejarán de publicar en Remotion 5.0 y hay que migrar a `lightLeak()` y `starburst()` de `@remotion/effects` ([light-leaks](https://www.remotion.dev/docs/light-leaks/api), [starburst](https://www.remotion.dev/docs/starburst/api)).

### 3.2 Transiciones: `@remotion/transitions`, 21 presentaciones

- **Funcionan en cualquier navegador, en la vista previa y en el render (9):** `clockWipe`, `cube`, `fade`, `flip`, `iris`, `none`, `pushCut`, `slide`, `wipe`.
- **Necesitan HTML-in-canvas (12).** En la vista previa exigen Chrome con el flag activado; «no funciona en Firefox ni Safari». En el render del servidor funcionan:
  - `blurSlide`, `bookFlip`, `crossZoom`, `crosswarp`;
  - `dissolve`, `dreamyZoom`, `filmBurn`, `linearBlur`;
  - `ripple`, `swap`, `zoomBlur`, `zoomInOut`.

  Fuente: páginas de cada transición, por ejemplo [dissolve()](https://www.remotion.dev/docs/transitions/presentations/dissolve) e [índice](https://www.remotion.dev/docs/transitions/presentations).
- **Transiciones propias:** se pueden crear con `makeHtmlInCanvasPresentation()`. Las presentaciones con *shader* aceptan `effects` y `effectsOutputSize` ([@remotion/effects](https://www.remotion.dev/docs/effects/api)).
- **Licencia:** el `package.json` dice `UNLICENSED`; se rige por la Remotion License.

### 3.3 Elementos, texto y stickers

| Paquete o recurso | Qué da | Licencia | Player / Lambda | En el editor |
|---|---|---|---|---|
| Catálogo de Elements | **45 Elements en 11 categorías**: Audio (3), Fondos (6), Subtítulos (5), Gráficos (5), Efectos (4), Layouts (3), Mapas (3, incluye *Watercolor Map*), Overlays (3), Storytelling (4), Texto (6), YouTube (3). Al instalarse en el Studio se **copia el código** | No está publicada en la página | Son componentes React: Player sí; render sí | Plantillas / Elementos |
| Bibliotecas de terceros | Remocn, Lexington Themes, snapcn | Cada una la suya; no confirmé | — | Elementos |
| Template Element Library | Sitio para mostrar, instalar y crear Elements; `createElementPayload()` | Remotion License | — | Base para una galería propia |
| `@remotion/shapes` | rect, circle, ellipse, triangle, star, polygon, pie, heart, arrow, callout, spark; aceptan `effects` desde 4.0.474 | MIT | Sí / Sí | Stickers / Formas |
| `@remotion/rough-notation` | Subrayado, círculo, caja, corchete, tachado y resaltado dibujados a mano, con `progress` | MIT | Sí / Sí | Texto / Stickers |
| `@remotion/rounded-text-box` | Caja de texto multilínea con esquinas redondeadas estilo TikTok | MIT | Sí / Sí | Texto (fondo de subtítulo) |
| `@remotion/animated-emoji` | Emojis animados de Google (Noto) | Remotion License; los emojis son **CC BY 4.0 (piden atribución)** | Sí / Sí | Stickers |
| `@remotion/mac-cursors` | Cursores de macOS | Remotion License | Sí / Sí | Stickers (tutoriales) |
| `@remotion/lottie` | Animaciones de After Effects exportadas con Bodymovin | Remotion License | Sí / Sí | Stickers / Animaciones |
| `@remotion/rive` | Animaciones Rive en canvas; aceptan `effects` | Remotion License | Sí / Sí | Stickers |
| `@remotion/gif` | GIF sincronizado; acepta `effects` | Remotion License | Sí / Sí | Stickers |
| `@remotion/three`, `@remotion/skia` | 3D y gráficos con WebGL | MIT | Sí / Sí (sin GPU en Lambda, más lento) | Efectos 3D |
| `@remotion/svg-3d-engine` | Extrusiones 3D en SVG | Paquete interno, sin documentación | — | — |
| Mapas | Guía con MapLibre y Turf; la skill `/remotion-maps` cubre Mapbox, MapLibre, MapTiler y Cesium | Lo que pida cada proveedor | Sí / Sí | Elementos |
| `@remotion/layout-utils`, `@remotion/google-fonts`, `@remotion/fonts` | Medir y ajustar texto, y fuentes | MIT o licencia del repo | Sí / Sí | Texto |

Fuentes:
- [Elements](https://www.remotion.dev/elements), [libraries](https://www.remotion.dev/elements/libraries), [Creating Elements](https://www.remotion.dev/docs/elements), [Element Libraries](https://www.remotion.dev/docs/elements/libraries)
- [shapes](https://www.remotion.dev/docs/shapes), [rough-notation](https://www.remotion.dev/docs/rough-notation/api), [rounded-text-box](https://www.remotion.dev/docs/rounded-text-box), [animated-emoji](https://www.remotion.dev/docs/animated-emoji)
- [mac-cursors](https://www.remotion.dev/docs/mac-cursors), [After Effects → Lottie](https://www.remotion.dev/docs/after-effects), [Maps](https://www.remotion.dev/docs/maps)
- [skills README](https://github.com/remotion-dev/remotion/blob/main/packages/skills/README.md)
- Licencias según el `package.json` de cada paquete en `main`.

### 3.4 Audio y subtítulos

- **`@remotion/sfx`: 32 sonidos**, normalizados con el pico en −3 dB. El paquete npm es MIT, pero la licencia va **por sonido** ([sfx](https://www.remotion.dev/docs/sfx)):
  - **Solo 7 son CC0:** mouse-click, page-turn, shutter-modern, shutter-old, ui-switch, whip y whoosh.
  - **Los otros 25 salen de myinstants.com** (vine-boom, bruh, spongebob-fail, windows-xp-error…). La documentación dice que «no se publicaron explícitamente con licencia libre» y que Remotion no se hace responsable (por ejemplo [vine-boom](https://www.remotion.dev/docs/sfx/vine-boom)).
  - Para un SaaS comercial, **yo usaría solo los 7 CC0**.
- **`<Audio>` de `@remotion/media`:** volumen, velocidad, `preservePitch` y `toneFrequency` ([`<Audio>`](https://www.remotion.dev/docs/media/audio), [Comparación de tags](https://www.remotion.dev/docs/video-tags)).
- **Subtítulos:** `@remotion/captions` (MIT) incluye `createTikTokStyleCaptions` y lectura y escritura de SRT/VTT ([captions](https://www.remotion.dev/docs/captions)).
- **Transcripción en el navegador o en Node:** `@remotion/whisper-webgpu` usa Transformers.js con WebGPU ([whisper-webgpu](https://www.remotion.dev/docs/whisper-webgpu)). También existen `@remotion/whisper-web` (WASM), `@remotion/openai-whisper` y `@remotion/install-whisper-cpp` (servidor).
- **Forma de onda y miniaturas:** `@remotion/timeline-utils` (MIT, «interno», sin documentación) tiene `extractFrames`, `renderFrameStrip`, `loadWaveformPeaks` y `drawBars` ([index.ts](https://github.com/remotion-dev/remotion/blob/main/packages/timeline-utils/src/index.ts)).

### 3.5 Animación y keyframes

- **Las piezas base:**
  - `interpolate()` (con `outputType`, por ejemplo `font-weight`);
  - `Easing` (incluye `step1` para keyframes de mantener);
  - `spring()` y `measureSpring()`;
  - `interpolateColors()`.

  Fuentes: [interpolate](https://www.remotion.dev/docs/interpolate), [easing](https://www.remotion.dev/docs/easing), [spring](https://www.remotion.dev/docs/spring), [interactivity schema](https://www.remotion.dev/docs/interactivity-schema).
- **`@remotion/animation-utils` (MIT):** `interpolateStyles`, `makeTransform` ([animation-utils](https://www.remotion.dev/docs/animation-utils)).
- **`@remotion/paths` (MIT):** trazar líneas e interpolar formas.
- **`@remotion/noise` (MIT):** ruido 2D, 3D y 4D, para movimientos tipo *wiggle* ([noise](https://www.remotion.dev/docs/noise)).
- **`@remotion/gsap` (MIT, desde 4.0.517):** líneas de tiempo GSAP pausadas que se buscan por cuadro ([gsap](https://www.remotion.dev/docs/gsap)).
- **`@remotion/motion-blur` (MIT):**
  - `<CameraMotionBlur>` y `<Trail>` funcionan en cualquier navegador.
  - `<HtmlInCanvasMotionBlur>` necesita el flag en la vista previa ([Motion blur](https://www.remotion.dev/docs/motion-blur)).
- **Keyframes en el Studio:** escriben código. La home los describe como «editables de forma interactiva y se guardan en el código» ([remotion.dev](https://www.remotion.dev/)).
- **Para un editor de usuario final, Remotion recomienda** reemplazar el valor de cada propiedad por un **arreglo de keyframes** e interpolarlo con `interpolate` y `Easing` ([Features not included](https://www.remotion.dev/docs/editor-starter/features-not-included)).

### 3.6 Eliminar fondo: `@remotion/video-matting` (MIT, desde 4.0.523)

- **Qué hace:** separa el video en una capa base opaca y un frente transparente (**WebM VP9 con alfa**). Corre en el navegador o en Node con WebGPU, vía Transformers.js ([video-matting](https://www.remotion.dev/docs/video-matting), [guía](https://www.remotion.dev/docs/video-matting-guide)).
- **Modelos:**
  - `modnet`: para personas, 25,9 MB, Apache-2.0, es el modelo por defecto.
  - `ben2-base`: sujetos generales, 219,1 MB, MIT, experimental ([modelos](https://www.remotion.dev/docs/video-matting/get-available-models)).
- **Requisitos:**
  - **GPU**, que se comprueba con `canUseVideoMatting()`.
  - El navegador tiene que poder decodificar la entrada y codificar VP9 con alfa usando WebCodecs.
  - En Node necesita una GPU compatible; «un entorno *serverless* típico no tiene GPU», y no funciona en Linux arm64 ([Node](https://www.remotion.dev/docs/video-matting/node)).
  - **Lambda no sirve para esto.**
- **Usos documentados:** texto detrás del sujeto, fondo desenfocado y reemplazo de fondo.
- **Alternativa barata:** `colorKey()` para croma.

### 3.7 Mapa de un editor tipo CapCut

| Sección | Qué aporta Remotion | ¿Vista previa en el navegador común? | ¿Render en Lambda? |
|---|---|---|---|
| Efectos | 91 efectos (Desenfoque, Distorsión, Estilizar, Generar) | Sí, sobre video, imagen, formas, sólidos, GIF y Rive (WebGL2/WebGPU) | Sí (WebGL2/2D por software) |
| Transiciones | 9 transiciones normales + 12 HTML-in-canvas + efectos de Revelado | 9 sí; 12 solo con el flag de Chrome | Sí, las 21 |
| Texto | DOM + rough-notation, rounded-text-box, layout-utils, fuentes, Elements de texto | Sí; efectos sobre texto solo con el flag (`HtmlInCanvas`) | Sí |
| Stickers | shapes, animated-emoji, Lottie, Rive, GIF, mac-cursors | Sí | Sí |
| Audio | `<Audio>`, sfx (7 CC0), whisper-webgpu, captions | Sí | Sí |
| Ajustar / color | 20 efectos de Color + Transformación | Sí | Sí |
| Animación / keyframes | interpolate, Easing, spring, noise, GSAP, motion blur | Sí (motion blur HTML-in-canvas con flag) | Sí |
| Eliminar fondo | video-matting (paso previo), colorKey | Matting solo con GPU y WebCodecs; colorKey sí | Matting no (sin GPU); colorKey sí |

### 3.8 Tienda, complementos y otros

- **Tienda:** solo vende dos productos: **Editor Starter, 600 USD**, y **Timeline, 300 USD** ([remotion.pro/store](https://www.remotion.pro/store), [Buy Editor Starter](https://www.remotion.dev/docs/editor-starter/buy)).
  - No encontré un *marketplace* de efectos de pago. Los 91 efectos y los Elements vienen con Remotion.
- **Timeline** es un componente pago:
  - multipista con arrastrar y soltar, zoom, atajos;
  - `CanvasComposition` para el Player;
  - temas con Tailwind ([Timeline](https://www.remotion.dev/docs/timeline)).
- **Editor Starter no incluye:** keyframes, transiciones, gestión de proyectos, autoguardado, celular, varios fps, autenticación ni modo claro ([Features not included](https://www.remotion.dev/docs/editor-starter/features-not-included)).
- **Recorder:**
  - Plantilla para grabar cámara y pantalla, hasta 4 fuentes.
  - Misma licencia que Remotion; está incluido en la Company License ([Recorder](https://www.remotion.dev/docs/recorder), [¿Es para mí?](https://www.remotion.dev/docs/recorder/is-it-for-me)).
- **Watercolor Map** es un Element del catálogo, en la categoría Mapas, no un producto aparte ([Elements](https://www.remotion.dev/elements)).
- **Licencia:**
  - Gratis para empresas con fines de lucro de hasta 3 empleados, incluido un SaaS ([LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [FAQ](https://www.remotion.dev/docs/license/faq)).
  - No se permite copiar o modificar Remotion «para vender… tu propio derivado de Remotion».
  - En 5.0 la licencia cambia «ligeramente» ([v5.0 migration](https://www.remotion.dev/docs/5-0-migration)).

### 3.9 IA: de un prompt a un video

- **Agent Skills:** se instalan con `npx skills add remotion-dev/skills` ([skills README](https://github.com/remotion-dev/remotion/blob/main/packages/skills/README.md)). Son trece:
  - `/remotion-best-practices`, `/remotion-create`, `/remotion-markup` (efectos, matting, motion blur), `/remotion-studio`, `/remotion-render`;
  - `/remotion-maps`, `/remotion-captions`;
  - `/remotion-saas` (cómo armar apps con Remotion: Player, Lambda, Vercel…);
  - `/remotion-interactivity`, `/remotion-docs`, `/remotion-license`, `/remotion-upgrade`, `/remotion-multimedia`.
- **Plugins:** hay para Claude Code y Codex (y otros) que traen esas skills ([Claude Code plugin](https://www.remotion.dev/docs/ai/claude-code-plugin)). Son para **desarrolladores** con acceso al sistema de archivos.
- **Plantilla «Prompt to Motion Graphics SaaS»:**
  - Next.js con chat.
  - Genera el componente y lo previsualiza en tiempo real.
  - Pide `OPENAI_API_KEY`, lo que encaja con BYOK.
  - No tiene acceso al sistema de archivos ([AI SaaS template](https://www.remotion.dev/docs/ai/ai-saas-template)).
- **Compilación en el momento:** con Babel en el navegador y `new Function` ([Just-in-time compilation](https://www.remotion.dev/docs/ai/dynamic-compilation)).
- **WebMCP:** el Studio expone herramientas para que un agente lo controle, incluido quitar fondos y transcribir. Solo Codex lo soporta hoy ([WebMCP](https://www.remotion.dev/docs/ai/webmcp)).
- **Postura de Remotion:** no va a construir un «Lovable para motion graphics». Quiere que otros construyan los productos de consumo ([Lovable for Motion Graphics](https://www.remotion.dev/docs/lovable-for-motion-graphics)).

---

## 4. Recomendación concreta, en partes

Todo esto es **propuesta mía**. Va una cosa al 100 % y después la siguiente.

**Parte 0. Medir antes de migrar**
- No sé dónde se va hoy la RAM del port de OpenCut: archivos enteros en memoria desde IndexedDB u OPFS, el heap de WASM, las texturas de WebGPU, las miniaturas.
- Hay que medirlo con un proyecto real (el Administrador de tareas de Chrome y una captura del heap) **antes y después** de cada parte.
- Sin este número no se puede afirmar que algo «arregló la RAM».

**Parte 1. Proxies en la nube (vale para OpenCut y para Remotion)**
- Al subir un archivo, generar en la nube:
  1. un proxy H.264 de baja resolución, que puede ir como HLS;
  2. una tira de miniaturas;
  3. los picos de la forma de onda.
- Guardar todo en el bucket del cliente (BYOK: S3 o R2) o en el de MaKo.
- La vista previa lee **por URL**, nunca el archivo entero.
- **Dónde generarlos:** FFmpeg en una función propia, o un render de Lambda con la opción `scale` ([renderMediaOnLambda: scale](https://www.remotion.dev/docs/lambda/rendermediaonlambda), [Scale](https://www.remotion.dev/docs/options/scale)). No probé ninguna de las dos.

**Parte 2. Motor de vista previa = Player de Remotion, alimentado por JSON**
- Una sola composición genérica lee el estado del proyecto (pistas, clips, efectos, keyframes), igual que el Editor Starter ([state management](https://www.remotion.dev/docs/editor-starter/state-management)).
- Configuración del Player:
  - `<Video>` de `@remotion/media` con el proxy en la vista previa y el original en el render (`useRemotionEnvironment`);
  - `maxCanvasSinkFrameSize` según el zoom, con 2 o 3 tamaños fijos;
  - `effectsOutputSize` fijo y chico en la vista previa;
  - `defaultPremountInSeconds` corto;
  - nada de `prefetch()`.
- **La línea de tiempo:** mantener la de OpenCut como interfaz o comprar Timeline (300 USD).

**Parte 3. Efectos, color y keyframes**
- Mapear los 91 efectos a las secciones de §3.7.
- Los keyframes se guardan como arreglos en el JSON y se convierten con `interpolate` y `Easing`.
- Los efectos sobre texto quedan detrás de `HtmlInCanvas.isSupported()`.

**Parte 4. Transiciones**
- Las 9 normales van directo.
- Para las 12 HTML-in-canvas:
  - en la vista previa, una sustituta (fundido o un efecto de Revelado) o una «vista previa renderizada» del tramo en Lambda;
  - en la exportación, la transición real.
- **Nunca** montar `<HtmlInCanvas>` sin comprobarlo antes: lanza un error fatal.

**Parte 5. Eliminar fondo como trabajo aparte**
- Si `canUseVideoMatting()` da verdadero, correrlo en el navegador.
- Si no, mandarlo a una máquina con GPU del cliente (BYOK), porque Lambda no tiene GPU.
- El resultado es un WebM con alfa que entra al proyecto como un asset nuevo.

**Parte 6. Exportar**
- `renderMediaOnLambda` en la cuenta AWS del cliente.
- La función y el sitio están atados a la versión de Remotion: hay que volver a desplegarlos al actualizar ([remotion-saas/rendering.md](https://github.com/remotion-dev/remotion/blob/main/packages/skills/skills/remotion-saas/rendering.md)).
- Para videos cortos se puede exportar en el cliente como alternativa ([client-side rendering](https://www.remotion.dev/docs/client-side-rendering)).

**Parte 7 (opcional). «Vista previa renderizada» de tramos pesados**
- Copia del patrón de Runway: un botón que renderiza en Lambda, a escala baja, el tramo con transiciones o efectos que el navegador no puede mostrar, y lo reproduce como video.
- Tarda segundos; no es para mover el cabezal.

---

## 5. Lo que no pude confirmar

1. **Cuánta RAM ahorra cada palanca** (proxies, `maxCanvasSinkFrameSize`, `effectsOutputSize`, *premount*): no medí nada. Las cifras de 8,29 y 2,07 MB por cuadro son cuentas mías de RGBA sin comprimir. El decodificador real puede usar otro formato, como NV12.
2. **Dónde consume RAM hoy el editor de MaKo:** no revisé el port de OpenCut.
3. **Issues de GitHub sobre memoria en el Player:**
   - Las búsquedas web no encontraron un issue concreto.
   - No usé la API de GitHub (tiene límite de uso).
   - Solo vi notas de versiones viejas: el caché de render con límite de RAM en 4.0.24 ([release](https://newreleases.io/project/github/remotion-dev/remotion/release/v4.0.24)).
4. **`window.remotion_mediaCacheSizeInBytes` en el Player:** existe en el código, pero no está documentado para el Player. Usarlo es no oficial.
5. **Latencia real de `renderStillOnLambda` y `renderFramesOnLambda` con una composición como la de MaKo:** solo tengo los números del Hello World oficial (7,56 s caliente, 11,02 s fría).
6. **Proveedores externos:**
   - Que CapCut web componga en la nube no está confirmado oficialmente.
   - No encontré fuentes oficiales sobre la arquitectura de Canva ni de Adobe Express.
7. **Licencia de cada Element del catálogo** y de las bibliotecas de terceros: no está publicada en la página.
8. **Precios de IMG.LY** (se cotizan) y de **Rendley**: su FAQ se contradice sobre la marca de agua del plan gratis.
9. **El precio de la GPU de AWS** salió de agregadores, no de la página oficial de AWS.
10. **El flag de HTML-in-canvas:** no sé si Chrome lo va a activar por defecto ni cuándo.
11. **La licencia de Remotion 5.0:** no leí el detalle de los cambios. La licencia de cada paquete varía en su `package.json` (MIT, `UNLICENSED`, «SEE LICENSE»), pero todos dependen de `remotion`, que se rige por la Remotion License.
12. **`@remotion/svg-3d-engine`, `@remotion/timeline-utils` y `@remotion/streaming`** son paquetes internos sin documentación: no hay garantía de que su API se mantenga estable.
