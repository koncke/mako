# Diseño — AI Avatar con los estudios de Open-Generative-AI (30/10/2026)

Pedido de Martín, textual: «quiero que en la tab de AI Avatar implementes end to end esto:
https://github.com/anil-matcha/open-generative-ai — Copialo todo».

Este documento decide **qué se copia, en qué orden, con qué clave, en qué pantalla y en qué archivos**.
El código de arriba está clonado en `C:/dev/_upstream-ogai/repo` (no es parte de nuestro árbol).

## 0. La decisión que esto REVIERTE (leer antes de tocar nada)

El 29/10/2026 se decidió lo contrario, y quedó escrito en dos lugares del repo:

- `docs/hallazgos-ai-avatar.md`: «El repo abierto que más se le parece NO sirve como base… Se estudió y
  no se copió una línea».
- `app/admin/dev/ai-avatar/bitacora.ts` (entrada del 29/10, 05:40): lo mismo, con el porqué (es un
  selector de modelos sobre una API paga, sin presets ni personaje).

El pedido del 30/10 es POSTERIOR y manda. Pero las dos frases de arriba siguen siendo **verdad
técnica**: el repo no tiene presets, ni personaje por foto, ni historial por proyecto. Lo que cambia
no es el diagnóstico, es la decisión: **se copia el MOTOR y los MODOS que MaKo no tiene (modelos
pagos, lip sync, audio, cámara), y no se copia su producto** (su shell de 16 tabs, su clave en el
navegador, su constructor de personaje).

⚠️ **Los dos archivos de arriba se corrigen en el MISMO commit que la primera línea de código.** Un
agente que lea `hallazgos-ai-avatar.md` mañana va a «arreglar» esto volviéndolo atrás.

### Lo que no me llegó

Me pasaron cuatro mapas; llegaron tres, y el de la tab de MaKo viene cortado a mitad de una oración
(«Lo paga el NEGOCIO, no MaKo (el veto de Cla…»). Todo lo que dependía de esa cola está marcado
**falta medirlo** en la sección 7. No inventé nada para tapar ese agujero.

---

## 1. Qué entra, en qué orden, y cómo convive con el estudio que YA existe

### 1.1 El principio: no son tabs, son MODOS de la misma pantalla

`app/_components/nav.ts` lo dice en un comentario que no se negocia: **Create va SIN `secciones`**
(29/10, Martín: «para todas las secciones de "create" no quiero otras tabs… prefiero deprecar antes
que conservar»). El shell de upstream (`components/StandaloneShell.js`, 16 tabs en una barra lateral
colapsable) es exactamente lo que acá está prohibido.

Entonces: **cada estudio de upstream entra como un MODO de la barra de prompt que ya existe**
(`app/ai-avatar/Estudio.tsx`, `BarraImagen` y la barra de video de `Proyecto`), o como una plantilla
de «¿Qué vas a crear hoy?». Cero pestañas nuevas, cero rutas nuevas bajo `/ai-avatar`.

### 1.2 Los dos motores conviven: Flow sigue siendo el default

Hoy AI Avatar genera con **Google Flow por la extensión** (`lib/flow-cola.ts`): el que paga es el
navegador del cliente con su cuenta de Google, y para MaKo es **gratis**. Eso no se toca.

MuAPI entra como **segundo motor**, y su ventaja real no es tener 587 modelos: es que **corre en el
servidor**. O sea:

| | Flow (hoy) | MuAPI (nuevo) |
|---|---|---|
| Quién paga | la cuenta de Google del cliente (gratis para MaKo) | la cuenta de MuAPI del negocio |
| Qué hace falta | extensión de MaKo + Chrome abierto + sesión de Flow + créditos | **nada más que la clave** |
| ¿Desde el teléfono? | **no** (`lib/ai-avatar/requisitos.ts` dice «En tu computadora:») | **sí** |
| Si cierra la pestaña | el trabajo muere con el navegador | el trabajo sigue en MuAPI y se recupera |
| Lip sync, audio, 2K/4K | no existe | existe |

Eso convierte las líneas muertas de `lib/ai-avatar/estudio.ts` (`SIN_MOTOR.modelo`,
`SIN_MOTOR.calidad`, `SIN_MOTOR.voz`, `SIN_MOTOR.cantidad`) en opciones de verdad, una por tanda.
**`SIN_MOTOR` se achica a medida que entra cada modo; no se borra de golpe.**

**Sin clave de MuAPI cargada, la tab se ve y funciona EXACTAMENTE como hoy.** Los modos pagos no
aparecen apagados ni con candado: no aparecen. Lo único que aparece es un renglón en el menú
«Modelo»: «Otros modelos: conectá tu cuenta de MuAPI», que abre la tarjeta de la integración.

### 1.3 El orden, y por qué

El criterio es el del mapa: **lo más chico que se puede terminar y probar**, no lo más vistoso.
Las líneas son las del clon.

| # | Modo en MaKo | Upstream | Tamaño | Por qué ahí |
|---|---|---|---|---|
| 1 | **Cámara** | `CinemaStudio.jsx` | 1313 líneas, endpoint FIJO, prompt armado local, poll 60 | No toca `models.js`. El prompt se concatena en el navegador: es un módulo PURO con test, nuestra forma favorita de empezar. Y cae justo en una categoría que YA tenemos: `CATEGORIAS` de `lib/ai-avatar/plantillas.ts` incluye «Cámara» |
| 2 | **Que hable** | `LipSyncStudio.jsx` | 1341, 15 modelos, 3 uploaders, poll 900 | Es el agujero más grande del producto: hoy el avatar NO sincroniza labios, lee con la voz de Flow |
| 3 | **Voz** | `AudioStudio.jsx` | 1185, 23 modelos, formulario armado desde el schema | Alimenta al 2. Devuelve la sección «Voices» que se deprecó el 29/10 por no tener motor |
| 4 | **Mover el look** | `VideoStudio.jsx`, sólo el camino i2v | 3458 + ~2800 de helpers | Sólo i2v (184 modelos). t2v, v2v y el modo extend NO entran: ver 5 |
| 5 | **Retocar el look** | `ImageStudio.jsx`, sólo el camino i2i | 1945 | Sólo i2i sobre el look (88 modelos). El estudio de imagen general ya es la tab Image |
| — | AI Clipping | `ClippingStudio.jsx` | 1209 | **No va en AI Avatar.** Cortar un video largo en clips es la tab Video (`app/video-editor`). Va como plantilla de «Nuevo video», al final |

**Primero: Cámara.** Es el único que se puede terminar, mandar y medir en una tanda, y de regalo
deja parada toda la columna vertebral nueva (clave → action → tabla → sondeo), que después reusan
los cuatro siguientes.

### 1.4 El puente que nadie ve: un look de MuAPI no se puede animar con Flow

Esto es lo más importante de todo el diseño y es fácil que se descubra tarde.

`app/ai-avatar/actions.ts` (`crearVideoAction`) y `app/video-editor/avatar/avatares.ts` (`conAvatar`)
escriben `imagenes['1'] = { elegida: url, elegidaId: mediaId, confirmada: true }`. El `mediaId` es de
**Flow**. Hoy, un look sin `mediaId` se marca como error: «se ve pero no se puede animar».

Un look generado por MuAPI tiene `url` y **no tiene `mediaId`**. O sea: si no se resuelve, el modo
nuevo genera imágenes lindas que no se pueden convertir en video, que es el producto.

Dos salidas, y se implementan las dos:

- **(a) Con el puente vivo: meter la imagen de MuAPI en Flow.** `lib/flow-cola.ts` ya declara el tipo
  de trabajo `subir_imagen`. Se encola, vuelve el `mediaId`, y el video sigue siendo el de hoy
  (gratis, el plan del Video Generator). Es el camino por default.
  ⚠️ **Falta medirlo:** si `subir_imagen` acepta una URL nuestra o necesita los bytes, y qué devuelve.
  Verifiqué que el tipo existe (`lib/flow-cola.ts`, la unión `TipoTrabajo`); no leí su `pedido`.
- **(b) Sin puente (teléfono, o Chrome cerrado): animar con MuAPI i2v** (modo 4, pago). La cadena
  entera queda en MuAPI y nunca toca el Video Generator.

En los dos casos **la fila del historial queda con la misma forma**. Un look con dos procedencias que
guardan distinto es un bug garantizado seis semanas después.

---

## 2. La clave: BYOK por negocio, y el navegador NO la ve nunca

Upstream asume **una clave global**: `localStorage['muapi_key']` la escribe un modal, un interceptor
de axios la pega en toda request, y las siete rutas proxy de Next sólo reenvían el header
`x-api-key` que llega del navegador. No hay clave de servidor en todo el repo (el único
`process.env.MUAPI_KEY` está en un script de prueba suelto).

En MaKo eso es inaceptable por tres razones distintas, y cualquiera alcanza:

1. **Cada negocio paga SU IA.** Es la regla de la casa y ya está construida: `lib/credenciales.ts`
   (tablas 0053/0054/0055, AES-256-GCM, clave derivada por `(workspace, clave)` desde
   `CREDENCIALES_SECRET`). El motor de hoy ya cumple la regla por otra vía: Flow corre en el
   navegador del cliente, con su cuenta y sus créditos (`lib/flow-cola.ts`: «No hay una cuenta
   central que quemar»).
2. **El plan NUNCA paga la IA del cliente.** Una clave de MaKo con 587 modelos pagos detrás es una
   factura sin techo que crece con cada cliente nuevo.
3. **Una clave en `localStorage` es la clave del cliente expuesta en su navegador.** Y upstream la
   copia a dos lugares más (`localStorage['token']`, `sessionStorage['wl_workflow_token']`) y a una
   cookie **no HttpOnly** de un año.

### La decisión

- **Clave `MUAPI_API_KEY`, una fila por workspace en `credenciales`**, cifrada, como Meta o Resend.
  Se resuelve con `credWs('MUAPI_API_KEY')` **sólo en el servidor**.
- **Tarjeta de integración nueva** en `lib/integraciones-catalogo.ts`:
  `{ key: 'muapi', nombre: 'MuAPI', categoria: 'Inteligencia', oculto: true, envs: ['MUAPI_API_KEY'] }`.
  `oculto: true` porque las IA no son tarjetas de la grilla desde el 25/10 («elimina las IA dentro de
  las integraciones, para eso tenemos el bloque "Tus cuentas de IA"»); se conecta desde ese bloque,
  con el mismo modal (`getIntegracion` no mira `oculto`).
  ⚠️ **Falta medirlo:** de qué lista sale ese bloque. El candidato es `IA_DE_UNA_CUENTA` en
  `lib/ia-keys.ts` (hoy `OPENAI_API_KEY` y `ANTHROPIC_API_KEY`), que es lo que mira `esClaveDeIA` y
  lo que `lib/credenciales.ts` importa. No leí `app/admin/CuentasYDispositivos.tsx`.
- **El navegador nunca recibe la clave, ni enmascarada.** No se copia `ApiKeyModal.js`, ni la cookie,
  ni el interceptor de axios.
- **El servidor nunca acepta una clave del navegador.** Si llega un `x-api-key` en un request
  nuestro, se ignora (no se reenvía, no se loguea).
- **Sin respaldo de plataforma**, igual que Zernio desde el 23/10. La única excepción es la que
  `credWs` ya le da al dueño: el env como respaldo de arranque del ws1.
- **401/403 de MuAPI = «tu clave de MuAPI no sirve»**, con el botón que abre la tarjeta. Upstream
  dispara un evento `muapi:auth-required` que **nadie escucha en todo su repo** (un solo hit de grep,
  el del dispatch): el usuario ve un error genérico y la clave inválida sigue guardada.

### Cómo viajan las llamadas (y las siete rutas proxy que NO hacemos)

Upstream necesita cuatro rutas catch-all más un rewrite de `middleware.js` porque su cliente corre en
el navegador. **El nuestro corre en el servidor, así que no hace falta ninguna.**

- **Mandar y preguntar: server actions**, con la misma puerta que las de hoy (`const g = await
  puerta()`, que es `veAiAvatar` + workspace actual, `app/ai-avatar/actions.ts`).
- **No se copia el doble `/api/api/v1`.** Existe a propósito en upstream («the AiAgent library
  hardcodes a double /api/api»), y nosotros no copiamos la librería AiAgent. Sin ella, la ruta doble
  es una curiosidad.
- **Subir archivos: por nuestro camino, no por `/api/v1/upload_file`.** `uploadFile` de upstream sólo
  existe para convertir un archivo en una URL, y los payloads de MuAPI aceptan URLs
  (`image_url`, `audio_url`, `video_url`). Nosotros ya subimos archivos y ya tenemos la foto de la
  persona subida (`/api/onboarding/persona`). Ventaja de reojo: el medio del cliente queda en nuestro
  bucket y no en el de MuAPI.
  ⚠️ **Falta medirlo, y es un riesgo real:** que MuAPI pueda LEER esa URL (pública o firmada,
  alcanzable desde su infra), y el tope de cuerpo de las funciones de Vercel contra un video de
  50 MB o un audio de 10 MB. Si no cierra, la única ruta nueva del diseño es
  `app/api/muapi/subir/route.ts`.
- **CSP: verificado que no hace falta tocar nada.** El único `Content-Security-Policy` del árbol es
  el del HTML de landings (`lib/editor-landing/*`, `app/l/html/...`): no hay CSP global que haya que
  abrirle a `*.muapi.ai`, a diferencia de upstream, que la pone en `middleware.js`.

### Los trabajos no viven en el navegador: viven en una tabla

Upstream guarda el historial de cada estudio en `localStorage` (30 a 50 entradas, con la clave
hasheada en el nombre), y si cerrás la pestaña a mitad de un video de 30 minutos **el trabajo se
pagó y el resultado queda inalcanzable**. Tiene `getHistory` y `deleteMedia` escritos y nadie los
llama.

Nosotros ya resolvimos esto una vez, con Flow: la tabla `flow_trabajos` y un sondeo desde la pantalla
cada 6 s a una action (`estadoLookAction`). **Se copia ese patrón, no el de upstream.**

Tabla nueva **`muapi_trabajos`** (base del inquilino, con `workspace_id`, como `flow_trabajos`),
migración **`supabase/migrations/0351_muapi_trabajos.sql`** (la última aplicada es la 0350):

| columna | para qué |
|---|---|
| `id` | el id del trabajo que devuelve la action |
| `workspace_id` | el inquilino (`getTenantDb` filtra por acá) |
| `estudio` | `'camara'`, `'hablar'`, `'voz'`, `'mover'`, `'retocar'` |
| `endpoint` | el que se mandó, textual (la lista blanca de la sección 4) |
| `request_id` | **lo único que salva un trabajo pago si se cierra la pestaña** |
| `estado` | `'pendiente'` · `'listo'` · `'fallido'` |
| `url` | el resultado |
| `error` | la frase en español, sin el crudo |
| `pedido` | `jsonb` con lo que se mandó, **sin la clave** |
| `quien`, `created_at`, `updated_at` | auditoría y el abandono |

Índice por `(workspace_id, estado)`. El sondeo es el mismo de hoy: la pantalla llama
`estadoMuapiAction` cada 6 s, la action hace UN `GET /api/v1/predictions/{request_id}/result` y
escribe la fila. **Sin cron y sin infra nueva.** Lo que esto NO resuelve: si nadie abre la tab, nadie
se entera de que terminó (los avisos quedan para después — sección 7).

---

## 3. Qué pantalla ve el usuario

Sigue siendo **UNA** pantalla: `<PantallaCrear tab="AI Avatar" nuevo="Nuevo avatar">` con el chat de
MaKo fijo a la izquierda, los proyectos con su «←» y las tres vistas de hoy (`nueva` · `todos` ·
`proyecto`, `app/ai-avatar/Estudio.tsx:54`). **No se agrega ninguna vista.**

### 3.1 En «Nueva» (la barra de imagen, el look)

La barra flotante de hoy ya tiene las pastillas Modelo · Formato · Cantidad · Calidad · Personaje ·
Preset · Generar. Lo que cambia, pastilla por pastilla:

- **Modelo**: deja de ser una línea muerta. Arriba, «Nano Banana · Google Flow · Gratis» (el de hoy,
  elegido por default). Abajo, los de MuAPI que habilitamos, con su etiqueta de pago. Sin clave: un
  solo renglón que invita a conectarla.
- **Cámara** (pastilla NUEVA, modo 1): abre un overlay con cámaras, lentes, focales y aperturas, con
  miniaturas **servidas por nosotros** (`public/ai-avatar/camara/`). El prompt se arma local
  (`lib/ai-avatar/camara.ts`) y se **suma** al del preset, nunca lo reemplaza.
- **Calidad / Formato / Cantidad**: dejan de decir «no disponible todavía» sólo cuando el modo que
  las habilita entró. Con Flow elegido siguen diciéndolo.
- **Generar**: el botón dice de dónde sale la plata, nunca un número que no medimos.
  Flow → «Generar · Gratis» (como hoy). MuAPI → «Generar · Con tu cuenta de MuAPI».
- **`<Requisitos>`**, arriba de la barra: con MuAPI elegido, los pasos son **dos** (clave conectada,
  foto), no los cinco de Flow (extensión · conectar · actualizar · flow · foto). Para eso
  `lib/ai-avatar/requisitos.ts` toma un `motor` nuevo, además del `para: 'video'` que ya tiene.

### 3.2 En «Proyecto» (la barra de video)

Hoy: guion, «Usar el ejemplo», «Voz de Flow · <acento>», y dos pastillas que dicen «Pronto» («Tu
voz», «Motion»).

- **«Que hable»** (modo 2): con un look y un audio, genera el video con labios sincronizados. El
  segmented control imagen|video de upstream se queda: acá el look es siempre una imagen.
- **«Voz»** (modo 3): tres opciones donde hoy hay una y media — «Voz de Flow · <acento>» (hoy),
  «Generar la voz» (MuAPI, 23 modelos) y la línea de siempre para la voz clonada. La galería de 25
  voces de ElevenLabs (`lib/ai-avatar/voces-galeria.ts`) sigue siendo sólo dato para `vozSugerida`.
- **«Mover el look»** (modo 4): animar sin extensión y sin Flow.

### 3.3 En el teléfono

`app/m/ai-avatar/EstudioM.tsx` importa las actions de escritorio y no se rediseña («el teléfono
destila el escritorio»). **El modo MuAPI es lo primero que el teléfono puede generar de verdad**: hoy
`requisitos.ts` le dice «En tu computadora:» y se termina ahí. Eso es el titular del release, más que
los modelos.

### 3.4 Los topes de prueba

`lib/topes-plan.ts` ya tiene `prueba.imagenes` (20), `prueba.avatares` (1) y `prueba.tomas` (30), y
`page.tsx` los pinta con `<FranjaPrueba>`. **Lo pago con la clave del negocio igual suma al tope de
prueba**: el tope es de producto («cuánto se puede llevar alguien y después irse»), no de costo. Un
modo nuevo que no sume al tope es una puerta de atrás a la prueba gratis.

---

## 4. Dónde vive cada archivo nuevo

Nada en `app/ai-avatar/` que puedan usar dos tabs: el motor de MuAPI va a `lib/`, porque Video e
Image lo van a querer.

```
lib/muapi/cliente.ts          server-only. mandar(endpoint, payload) + estado(requestId). La clave sale
                              de credWs('MUAPI_API_KEY') y no sale de acá. Nada más.
lib/muapi/endpoints.ts        LISTA BLANCA endpoint → estudio. PURO, con test. Admite la barra interna
                              ('mmaudio-v2/text-to-audio').
lib/muapi/catalogo.ts         los modelos que OFRECEMOS, escritos a mano, con su `endpoint` EXPLÍCITO.
lib/muapi/trabajos.ts         la tabla muapi_trabajos (leer/crear/cerrar/abandonar).
lib/muapi/errores.ts          402 · 401/403 · 429 · timeout, en español, sin el crudo.
lib/ai-avatar/camara.ts       el prompt de «Cámara» (cámaras, lentes, focales, aperturas). PURO, con test.
lib/ai-avatar/motor.ts        'flow' | 'muapi': cuál genera, qué dice el botón, qué requisitos pide.
app/ai-avatar/muapi-actions.ts  crearConMuapiAction · estadoMuapiAction, con `const g = await puerta()`.
app/ai-avatar/Camara.tsx      el overlay de cámara (cliente), dentro de BarraImagen.
app/api/muapi/subir/route.ts  SÓLO si la medición de la sección 2 dice que hace falta.
supabase/migrations/0351_muapi_trabajos.sql
public/ai-avatar/camara/*.webp   las 20 miniaturas, SERVIDAS POR NOSOTROS (ver sección 5).
lib/avisos/LICENSE-OPEN-GENERATIVE-AI   la licencia literal (ver abajo).
tests/muapi-endpoints.test.ts · tests/ai-avatar-camara.test.ts
```

Se **modifican** (no se crean): `app/ai-avatar/Estudio.tsx` y `estudio.css` (las pastillas),
`app/ai-avatar/actions.ts` (el puente look↔video de 1.4), `lib/ai-avatar/estudio.ts` (`SIN_MOTOR` se
achica), `lib/ai-avatar/requisitos.ts` (el `motor`), `lib/integraciones-catalogo.ts` (la tarjeta),
`app/m/ai-avatar/EstudioM.tsx`, `lib/avisos/LEEME.md` (la fila de la tabla),
`docs/hallazgos-ai-avatar.md` y `app/admin/dev/ai-avatar/bitacora.ts` (la sección 0).

### La licencia, que es un requisito y no un trámite

El repo es **MIT** — verificado leyendo `C:/dev/_upstream-ogai/repo/LICENSE`: «MIT License,
Copyright (c) 2026 Open Generative AI Contributors». Copiar, modificar y vender está permitido **con
la condición de conservar el aviso**.

La regla de la casa (`lib/avisos/LEEME.md`, y `tests/avisos-licencias.test.ts` la hace cumplir):
- una copia **literal** por repo en `lib/avisos/LICENSE-<REPO>`, bajada del raw de GitHub;
- **la cabecera de cada archivo que toma algo nombra el aviso**;
- «un README que dice MIT no alcanza»: acá el LICENSE existe, así que esto sí se puede copiar.

→ `lib/avisos/LICENSE-OPEN-GENERATIVE-AI`, más una fila en la tabla de `LEEME.md`:
`https://github.com/Anil-matcha/Open-Generative-AI` · 2026 Open Generative AI Contributors ·
«AI Avatar (y Video e Image cuando lo usen)». Y `wide-trace/open-higgsfield` **no tiene licencia: ni
se mira** (ya estaba escrito en `hallazgos-ai-avatar.md`).

---

## 5. Qué NO se copia, y por qué

| Qué | Por qué |
|---|---|
| `components/StandaloneShell.js` (1214 líneas, 16 TABS, sidebar colapsable, notificaciones en `sessionStorage`) | Create va SIN secciones por decisión del 29/10. Y monta los 15 estudios a la vez escondiéndolos con `className="hidden"`: 15 componentes arrancando, cada uno con su `localStorage` con debounce de 500 ms y sus listeners de `window`. |
| `components/ApiKeyModal.js`, `localStorage['muapi_key']`, la cookie `muapi_key` **no HttpOnly** de un año, `localStorage['token']`, `sessionStorage['wl_workflow_token']`, el interceptor de axios | La clave es del negocio y vive cifrada en `credenciales`. La cookie, además, está muerta en su propio repo: todas sus rutas la borran citando CWE-522, y sólo aporta superficie de XSS. |
| Las 7 rutas proxy, el doble `/api/api/v1` y el rewrite + CSP de `middleware.js` | Nuestro cliente corre en el servidor. El doble `/api` existe porque «the AiAgent library hardcodes a double /api/api», y no copiamos esa librería. Encima sus handlers hacen `await response.json()` sin condición: con un 401 que devuelve HTML o vacío, el parse tira y el catch responde **500**, así que el «tu clave venció» nunca llega. |
| `packages/studio/src/models.js` (35.146 líneas, 1,1 MB, ~587 modelos) | Entra al bundle de los 6 estudios que lo importan. Ofrecemos un subconjunto escrito a mano. Aparte: formato inconsistente (2 entradas con claves **sin comillas**), mojibake en descripciones («MinimaxΓÇÖs») y `models_dump.json` de la raíz **no trae el campo `endpoint`**: 50 modelos tienen endpoint distinto del id y 82 no lo traen. |
| `WorkflowStudio.jsx`, `AgentStudio.jsx`, `DesignAgentStudio.jsx` y sus rutas `app/workflow/**`, `app/agents/**` | Tres razones y alcanza cualquiera: (1) sus paquetes son **submódulos VACÍOS** en el clon (`packages/Vibe-Workflow`, `Open-Poe-AI`, `Open-AI-Design-Agent`), declarados como dependencias `file:` — con eso `npm install` ni corre; (2) navegan FUERA del shell con `router.push('/agents/{id}')`, que acá sería salir de la tab; (3) MaKo ya tiene el chat del Cerebro y las Automations. |
| `LayersStudio` (4104), `MarketingStudio`, `MotionControlStudio`, `RecastStudio`, `VibeMotionStudio`, `AppsStudio`, `McpCliStudio` | No se pidieron. `McpCliStudio` ni tab tiene en su propio repo. `RecastStudio` se monta bajo el id `body-swap`. `LayersStudio` duplica la UI compartida y no persiste nada. |
| El constructor de personaje de `AiInfluencerStudio.jsx` | Choca con la regla de la casa: **la cara la pone la foto**, no un selector de rasgos (`lib/ai-avatar/prompt-look.ts`: el prompt del preset es la COMPOSICIÓN, «NUNCA la cara»). Lo que sí se usa de ahí es el seam: su prop `onGenerate` reemplaza la llamada entera. |
| Los 20 webp de cámara y las miniaturas hotlinkeadas a `https://cdn.muapi.ai/influencer/*.webp` | Se copian los archivos y se sirven desde `public/`. Hotlinkear un CDN de tercero deja el catálogo en blanco el día que cambie o bloquee referers, y «las miniaturas NUNCA en blanco» es regla. |
| Los highlights inventados de `ClippingStudio.jsx` (~línea 530) | Si la API no devuelve coordenadas, **fabrica** `num_highlights` entradas con `start_time = idx*15` y `score = 0.95 - idx*0.05`, y las pinta como análisis real. El comentario lo admite («Mock coordinates if…»), la UI no. En MaKo un dato que no existe no se muestra. |
| El textarea de prompt de Clipping | Se escribe y **no se manda**: `runClipping` sólo envía `video_url`, `num_highlights`, `aspect_ratio` y `return_coordinates_only`. Un campo que no viaja es una mentira de pantalla. |
| `processMotionControl` como está | Clampea la duración y hace `images_list.slice(0, 9)` **sin aviso**, y prefija un párrafo propio al prompt del usuario: lo que se manda no es lo que la persona escribió. |
| El historial en `localStorage` por estudio (30 a 50, con `persistKey` hasheando la clave) | Va a `muapi_trabajos`. Borrar en la UI de upstream no borra nada en el servidor ni en S3, y el hash de `persistKey` es `hash*31+char` de 32 bits: colisionable. |
| `getHistory`, `deleteMedia`, `calculateDynamicCost`, `estimateV2VCost` | Código muerto en su propio repo (nadie los llama). `deleteMedia` daría 405 porque la ruta sólo exporta GET y POST, y `estimateV2VCost` es la **única llamada del motor sin header `x-api-key`**. |
| El balance del header (`GET /api/v1/account/balance` cada 30 s) | Un comentario de su propio código avisa que devuelve **403 a usuarios white-label**. Y el saldo es de la cuenta del negocio: va en la tarjeta de la integración, no en nuestra barra. |
| `lib/locales.js`, `i18nUtils.js` y los 15 bundles `messages/zh/*` | MaKo habla español, siempre. Los textos se escriben, no se traducen del inglés. |
| `react-toastify`, `react-hot-toast`, `lucide-react`, `react-icons`, el Tailwind de `packages/studio/dist` | Tenemos `app/_components/icons`, el tema Nord y `estudio.css` con prefijo `.hf-`. Cinco dependencias nuevas para dibujar lo que ya está dibujado. |
| Todo `C:/dev/_upstream-ogai/repo/src/` (la app Vite/Electron) y `tests/*` (Wan2GP, inferencia local) | Es **otra aplicación**, la que no corre en la web. Y sus únicos tests no prueban ni una línea de los estudios React. |
| `project_knowledge.md` | Documenta la app equivocada (dice «Vite, Vanilla JavaScript» y apunta a `src/components/ImageStudio.js`). Leerlo primero es mapear el código viejo. |

---

## 6. Lo que puede salir muy mal, con nombre y apellido

1. **El look pago que no se puede animar.** `conAvatar` necesita `elegidaId` (el `mediaId` de Flow) y
   un look de MuAPI no lo tiene. Si se manda el modo 1 sin el puente de 1.4, el cliente paga una
   imagen y la tab le dice que no se puede animar. Es el riesgo número uno y hay que resolverlo en la
   misma tanda que Cámara.
2. **`pollForGenerationResult` espera ANTES del primer GET** (`utils/generationLifecycle.js`: el
   `await wait(interval)` abre el loop), **no acepta `AbortSignal` y no se cancela al desmontar.** Si
   se copia tal cual, el loop sigue corriendo contra la API después de cambiar de tab. Nuestro sondeo
   es desde la pantalla a la action, y la que corta es la fila `muapi_trabajos`, no un `setInterval`.
3. **El tope de 60 intentos de imagen pierde un resultado YA PAGADO.** 60 × 2 s = 2 minutos; un
   modelo que tarde 2:05 tira error con el `requestId` adjunto y el trabajo sigue vivo arriba. Por eso
   `request_id` se guarda **antes** de empezar a preguntar, no cuando llega el resultado.
4. **`nano-banana-pro-edit` no está en la lista donde Cinema lo busca.** `generateImage` resuelve con
   `getModelById`, que sólo recorre `t2iModels`, y ese modelo vive en `i2iModels` (línea 11461):
   `modelInfo` queda `undefined`, no valida nada y **funciona de casualidad** porque el endpoint cae
   al id crudo (`modelInfo?.endpoint || params.model`). Nuestro `lib/muapi/endpoints.ts` es lista
   blanca con el endpoint explícito justamente por esto: si el id no coincide con la ruta, el POST
   sale igual y falla recién en el servidor, con un error de ruta que no se parece a «modelo mal».
5. **El `negative_prompt` cableado de Cinema se descarta siempre** (`buildSupplementalInputPayload`
   sólo deja pasar claves declaradas en `model.inputs`, y `nano-banana-pro` no declara
   `negative_prompt`). Copiarlo es copiar una línea que no hace nada y que alguien va a defender.
6. **Una tabla con el `endpoint` como clave primaria pierde filas.** 15 endpoints están duplicados
   entre modelos distintos (los 3 `recastModels` apuntan a endpoints de i2v;
   `bytedance-seedream-v5.0` y `seedream-5.0` van al mismo). Y dos endpoints llevan **barra adentro**
   (`mmaudio-v2/text-to-audio`): rompen cualquier validación que asuma un slug plano.
7. **El batch de Image dispara hasta 4 llamadas pagas por click** (`Promise.all` sobre `batchSize`)
   con un catch único: si una falla, el toast tapa el resultado y nadie sabe cuántas se cobraron.
   Mientras «Cantidad» no tenga un techo nuestro, se queda en 1.
8. **«Descargar» se convierte en «abrir pestaña» en silencio.** `downloadImage` y
   `getClipboardPngBlob` hacen `fetch(url)` del CDN de MuAPI y, si CORS falla, caen a
   `window.open(url, '_blank')`. Copiar imagen además exige `isSecureContext` + `ClipboardItem`.
9. **El tope de cuerpo de una función de Vercel contra un video de 50 MB.** Si el audio y el video de
   Lip Sync suben por una ruta nuestra, el modo 2 se cae con archivos grandes y el error no va a
   hablar de tamaño. Medirlo antes de escribir `app/api/muapi/subir/route.ts`.
10. **Logs que filtran datos del cliente.** `app/api/workflow/[[...path]]/route.js` loguea con
    `console.log` el body parseado y los primeros 200 caracteres de cada respuesta. No copiamos esa
    ruta, pero el vicio se copia solo: nuestro cliente no loguea payloads.
11. **El `seed` de Lip Sync es código muerto en origen**: el estudio manda `seed = -1` y
    `processLipSync` descarta todo lo que sea `-1`. Los modelos con `hasSeed` **jamás** lo reciben.
    Si lo copiamos, vamos a «arreglar» tres veces un campo que nunca llegó.
12. **Audio manda strings vacíos.** Su init pone `""` cuando el schema no trae default y
    `generateAudio` copia todas las claves salteando sólo `undefined` y `null`. Segundo bug del mismo
    efecto: al cambiar de modelo conserva el valor anterior si la clave se llama igual, aunque el
    enum nuevo no lo acepte.
13. **El diagnóstico obvio es el equivocado, dos veces.** `project_knowledge.md` documenta la app
    Vite que no se usa, y el README dice «9 dedicated models» de Lip Sync cuando `lipsyncModels`
    tiene 15, y «600+ models across 14 studios» cuando el shell define 16 tabs. Nada de upstream se
    cita de su documentación: se cita del archivo.
14. **Alguien revierte esto por leer el repo.** Sección 0: si `docs/hallazgos-ai-avatar.md` y
    `app/admin/dev/ai-avatar/bitacora.ts` no se corrigen en el mismo commit, el próximo agente
    encuentra «se estudió y no se copió una línea» y lo toma como la decisión vigente.

---

## 7. Lo que falta medir (no está en ningún mapa)

1. **`subir_imagen` del puente**: qué `pedido` acepta (¿una URL nuestra o los bytes?) y qué devuelve.
   Sin esto, 1.4(a) es una intención. Vive en `lib/flow-cola.ts` + `lib/flow-interfaz.ts`.
2. **De qué lista sale el bloque «Tus cuentas de IA»** (candidato: `IA_DE_UNA_CUENTA` de
   `lib/ia-keys.ts`; la pantalla, `app/admin/CuentasYDispositivos.tsx`). Decide si la tarjeta `muapi`
   aparece ahí o queda invisible.
3. **Si MuAPI puede leer una URL de nuestro almacenamiento** (pública o firmada) y el tope de cuerpo
   de Vercel. Decide si existe `app/api/muapi/subir/route.ts`.
4. **Cuánto cuesta cada generación.** `calculateDynamicCost` y `estimateV2VCost` están escritos y
   nadie los llama (y el segundo va sin autenticar). Hasta medirlo con la cuenta de un negocio real,
   el botón dice «Con tu cuenta de MuAPI» y **ningún número**.
5. **Si `nano-banana-pro` de MuAPI da mejor resultado que el Nano Banana gratis de Flow**, con la
   misma foto y el mismo preset. Si no, el modo 1 se justifica sólo por correr sin extensión y desde
   el teléfono — que ya es suficiente, pero hay que decirlo así y no al revés.
6. **Qué avisa que un trabajo terminó si nadie tiene la tab abierta.** Hoy: nada. El camino natural
   son los avisos, y no está diseñado acá.
7. **La cola del mapa de la tab de MaKo** que llegó cortada («Lo paga el NEGOCIO, no MaKo (el veto de
   Cla…»). Faltan el final de cómo entra y sale la IA del plan de video y lo que venía después.