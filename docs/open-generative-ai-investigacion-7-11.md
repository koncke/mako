# Open-Generative-AI y el clonado de imágenes por referencia — investigación del 7/11/2026

**Qué se pidió.** Martín, 7/11: dejar «Image» listo para **clonar literalmente con prompting** una imagen a
partir del ejemplo de la competencia —carruseles, **anuncios y miniaturas**—, e investigar a fondo
[Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) porque «podemos reemplazar al
100% Flow y lo que hacemos con la extensión», hospedándolo en RunPod.

---

## 1. El repo es real, pero NO reemplaza a Flow

**Medido** (API de GitHub + su README, 7/11): 32.855 estrellas, licencia **MIT**, último push el 6/11/2026, 113 MB,
JavaScript. Está vivo y es serio. Pero lo que hace no es lo que promete el título.

Textual del README:

> «Local inference is only available in the desktop app.» · «**The hosted web version always uses cloud APIs.**»
> «Powered by **Muapi.ai**» · «Copy the generated key value into the app»

**Es un estudio (interfaz) sobre `Muapi.ai`, que es una API de terceros a la que se le paga por generación.** Los
«600+ modelos con Flux, Midjourney, Kling, Sora, Veo» son el **catálogo de Muapi**, no modelos que corran acá.

⚠️ **Sora, Veo y Midjourney no tienen pesos abiertos.** No se pueden auto-hospedar: ni en nuestra máquina, ni en
RunPod, ni en ningún lado. Si aparecen en una lista de «self-hosted», es porque detrás hay una llamada a la API
del dueño. **Cambiar Flow por esto es cambiar de proveedor, no dejar de pagar.**

Lo que sí corre local, y sólo en su app de escritorio, son dos motores:

| Motor | Qué pide | Lo que dice el README |
|---|---|---|
| `sd.cpp` | **CPU** | «Recommended for sd.cpp Z-Image: 16 GB RAM»; en una Mac M de 8 GB «Z-Image is known to hang the system» |
| `Wan2GP` | GPU NVIDIA/AMD, **instalado aparte** | «The app does not bundle Python or model weights for Wan2GP» · Wan 2.1 1.3B: «Lightest option, 480p, ~8 GB VRAM» |

## 2. Lo de RunPod, corregido

El pedido decía «Serverless vLLM / Worker Pods». **vLLM sirve para modelos de TEXTO**, no para difusión de imagen
o video. Para esto serían **Worker Pods con GPU** corriendo ComfyUI o Wan2GP. La idea de auto-hospedar se puede;
el camino nombrado no es ése, y confundirlos cuesta una noche de armado que no arranca.

## 3. ⛔ El choque con la pasarela de pago, que es lo más caro de todo esto

El repo se promociona, textual: **«No content filters, no prompt rejections, no guardrails — just full creative
freedom»**, y su tabla dice «Content filters: **None**».

El 5/11 **Creem nos rechazó**, y el motivo deducido en su momento fue que prohíbe «**Face-swap, deepfake, and
face-manipulation tools of any kind**». El 6/11 **dLocal cerró la cuenta**. Hay cuatro consultas en vuelo
pidiendo que nos tomen.

**Montar un generador sin filtros, y decirlo, es la forma más directa de garantizar el tercer rechazo.** Si se
adopta, se adopta **con filtros propios** y sin una línea de «sin restricciones» en ninguna parte de MaKo.
Ver [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md).

## 4. Lo que SÍ sirve de ese repo

Una cosa, y es justo lo primero que se pidió:

> «transform existing images (**55+ image-to-image models**)» · «Upload up to **14 reference images** for
> compatible edit models» · «Reference image uploaded → activa los modelos i2i, y el prompt es opcional»

Eso es literalmente «cloná esta imagen de la competencia». **No hace falta adoptar el repo para tenerlo**: es MIT,
y lo que vale es el patrón (varias referencias + prompt opcional + cambio automático a i2i al subir una imagen).

## 5. Qué hay HOY en MaKo, medido contra el código

**Los tres tipos ya replican, y eso ya está hecho:**

- `EjemploAReplicar = { que: 'carrusel' } | { que: 'thumbnail' }` (`lib/carruseles/replica-servidor.ts:132`).
- **Los anuncios ya entran**: son un carrusel con `clase === 'anuncio'` (línea 165), y hasta el archivo sale
  nombrado «anuncio» (línea 243). **No falta construirlos.**

**Y ya sabemos hacer imagen-a-imagen con referencia**, por el camino de Flow: `lib/flow-protocolo.ts`,
`lib/formato-prompt.ts`, `lib/prompts-video.ts`, `lib/video-planner.ts`, `lib/curso-avatar.ts`.

⚠️ **Con una lección ya pagada, que vale oro acá** (`lib/curso-avatar.ts:65`): «la descripción textual **COMPITE**
con la imagen de referencia, y el modelo prefiere el texto». O sea: **cuanto más se describe con palabras, menos
se parece a la referencia.** Quien implemente el clonado tiene que mandar la referencia y un prompt CORTO, no un
párrafo describiendo lo que la imagen ya muestra.

## 6. La diferencia real entre lo que hay y lo que se pidió

| | Hoy | Lo pedido |
|---|---|---|
| Qué devuelve «Editar» | **un diseño editable**: estructura + textos en JSON, reescritos con la voz del negocio | **una imagen parecida a la referencia** |
| Cómo | la IA de TEXTO del negocio mira las láminas y describe el diseño | la IA de IMAGEN recibe la referencia y genera |
| Las fotos | se generan las que faltan (`foto-lamina.ts`, rama `carruseles-persona`) | la estética entera sale de la referencia |

**No son lo mismo, y los dos sirven.** El de hoy da algo editable palabra por palabra —que es lo que Martín fijó
el 7/11 como el norte—. El pedido nuevo da el parecido visual. **El camino es sumar el segundo como una opción
del primero, no reemplazarlo.**

## 7. El plan, para ejecutar

1. **Una fuente de verdad para «clonar desde referencia»**: una función que reciba las imágenes del ejemplo (hasta
   14) + un prompt CORTO y pida la generación a la IA de imagen del negocio. Reusar `foto-lamina.ts`, que ya hace
   exactamente eso para una lámina.
2. **En la pantalla, al lado de «Editar»: «Clonar el diseño»**, que en vez de reconstruir con textos pida la
   imagen. El usuario elige cuál quiere.
3. **Los tres tipos entran por el mismo camino**, porque `replicarEjemplo` ya los distingue.
4. **Nada de «sin filtros»** en ninguna parte, por lo del punto 3.
5. **RunPod queda para después** y como ahorro de costos, no como habilitador: lo que se puede auto-hospedar es
   Flux o Wan, no Sora ni Veo.

**Sin hacer, y por qué:** la máquina quedó en **0,57 GB de RAM libres** la noche del 7/11, que no alcanza ni para
compilar. Y Actions está frenado por el pago de GitHub, así que nada llegaría a producción igual.
