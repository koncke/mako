# Hallazgos de MaKo (IA)

Lo que hay que saber antes de tocar los prompts (`lib/mako-prompts.ts`,
`lib/prompt-registry.ts`), el ruteo de modelos (`lib/model-registry.ts`), la cascada barata
(`lib/ai-cheap.ts`) o el doer (`lib/mako-doer-*.ts`). **No es un changelog.**

**Lo que más muerde acá:**

- El prompt que leés en el archivo **no es** el que recibe el modelo: `brandSystem` le
  antepone el núcleo de chat, y un override guardado en la base le gana al template del
  repo → [Prompts](#prompts).
- El modelo que corre una feature **no se deduce del catálogo**: el override es global del
  ws1 y la cascada barata ni lo lee → [Modelos y ruteo](#modelos-y-ruteo).
- La cascada "gratis" muchas veces **le pega cuatro veces al mismo Groq** y un `validar`
  flojo la corta en el primer proveedor → [La capa barata](#la-capa-barata).
- Un `0` por fuente desconectada entra al prompt como si fuera una medición, y la IA
  dictamina catástrofe → [Lo que le llega al modelo](#lo-que-le-llega-al-modelo).
- `effort: 'low'` **no apaga** el razonamiento de Claude, y los topes de cantidad están
  escritos dos veces (en el `.slice()` y en el texto del prompt) → [Topes](#topes).
- El saldo y el gasto son globales al ws1 aunque las keys ya sean por cliente →
  [Gasto y saldo](#gasto-y-saldo).
- **Nada corta una llamada por gasto**, y el gasto de Claude no se puede atribuir a un
  cliente: las dos cosas bloquean cualquier límite por plan →
  [Gasto y saldo](#gasto-y-saldo). El análisis completo, con los números reales de
  producción, está en [costos-ia-y-planes.md](costos-ia-y-planes.md).

Dos advertencias sobre el origen de este material. **Buena parte es de segunda mano:** sale
de lo que devolvieron los subagentes de las 261 corridas de junio-agosto 2026 (de las que
134 nunca habían escrito nada en el repo), no de una relectura del código de hoy — cada
entrada dice de qué corrida y fecha viene, y **antes de actuar sobre una, verificá contra
el código**; varias ya están arregladas y donde el rescate lo sabía, lo dice. El registro
completo de las corridas está en [corridas-multiagente.md](corridas-multiagente.md).
Y las reglas y decisiones del dueño salen de minar sus 1038 mensajes en 48 sesiones: son
sus palabras, con la fecha en que las dijo.

---

## Modelos y ruteo

### ✅ Un 429 de Gemini era suficiente para pagarle a Claude: el fallback saltaba cuatro proveedores gratis

**Síntoma (reportado con la pantalla de Operaciones de IA, 2026-08-08):** «el Perro
Guardián sigue cobrando dinero de Claude cuando ya había pedido que sea de Gemini para
ahorrar». Dos corridas seguidas — `Perro Guardián · priorización`, **Claude · Sonnet 5**,
US$0,162 y US$0,089, las dos con el motivo `⚠ fallback: gemini falló (chatCheap(gemini):
HTTP 429)`.

**El diagnóstico obvio era el equivocado.** No estaba mal configurado: `mako-guardian` está
ruteado a Gemini en `lib/model-registry.ts` desde hace meses, y `def` y `recomendado` son
los dos GEMINI. Lo que fallaba era el **fallback**, y fallaba de la peor forma posible: ante
un **HTTP 429** —o sea la cuota del minuto, el error más transitorio que existe y el más
previsible cuando el Perro corre en tandas— `chatClaude` hacía **un solo intento** y se iba
derecho a Sonnet. Sin reintentar Gemini, y sin probar los otros cuatro proveedores gratis
que estaban configurados y ociosos.

Lo irónico: la lógica correcta ya existía a un archivo de distancia. `chatCheapCascade`
reintenta el mismo proveedor ante 429/5xx, saltea a los que no les entra el prompt por su
techo de entrada y ordena por cuota disponible — pero el override de `chatClaude` llamaba a
`chatCheap` (singular). Ahora recorre la cascada entera, con el proveedor del registro
primero, y sólo paga si **ninguno** contestó (y ahí el motivo lo dice: «fallback pago:
fallaron los N proveedores gratis»).

De paso: el `esfuerzo` no viajaba dentro de la cascada, así que una feature con effort alto
que cambiara de proveedor corría en `minimal`. Mismo bug que [[effort-se-pierde-en-gemini]],
un nivel más abajo.

**Vive en:** lib/anthropic.ts (el bloque de override en `chatClaude`) · lib/ai-cheap.ts (`chatCheapCascade`, ahora con `esfuerzo`) · *2026-08-08*

### ⚠️ El override de modelo del dueño gobierna a TODOS los workspaces, y el del cliente no se lee nunca

**Síntoma:** `plan-fathom` figuraba como Sonnet en el catálogo y las 25 llamadas del ws 9
habían corrido en `gemini-flash-latest`. Además existía una fila de override en el ws 3 que
NUNCA se lee.

**Causa:** `leerOverrides()` hace `runWithWorkspace(OWNER_WS, () => getSetting('mako.modelos'))`:
siempre lee el override del workspace dueño, sin importar quién esté corriendo. Lo mismo
hace `setModeloFeature`. O sea que `mako.modelos` es un ajuste **global de plataforma**
aunque la tab se vea dentro de un workspace.

**Regla:** el modelo efectivo de una feature no se deduce del catálogo ni del workspace que
corre — hay que mirar `mako.modelos` del OWNER_WS. Y si algún día se quiere modelo por
cliente, esa línea es el bloqueo.

**Vive en:** lib/model-registry.ts:86-115 (`leerOverrides` :98, `setModeloFeature`) ·
setting `app_settings['mako.modelos']` · *2026-08-05 ~borrador-reunion-fathom-frentes +
2026-07-22 audit-ia-routing*

### ⚠️ El tag de `feature` es la unidad del override, y hay dos procesos compartiendo uno

`lib/retro-gate.ts:126` (`debatirGate`, el gate de fase de la Retro) llama con
`feature: 'mako-guardian'` en vez de una feature propia: cambiar el modelo del Perro
Guardián desde /modelos-ia mueve también, sin que nadie lo pida, el debate del gate de fase.
El error clásico documentado es el inverso —un tag que no existe en el catálogo y hace que
el override no aplique nunca—; este es el que sí aplica, **al proceso equivocado**.

**Vive en:** lib/retro-gate.ts:126 · *2026-07-22 audit-ia-routing*

### ⚠️ El override de /modelos-ia no re-rutea nada para las features que corren por la cascada barata

`modeloDeFeature()` lo consulta `lib/anthropic.ts` (chatClaude) y nadie más:
`chatCheapCascade` NO lo lee. Una entrada nueva en `CATALOGO_MODELOS` para una feature que
corre por la cascada es **decorativa**: se pinta en la pantalla y no cambia a dónde va la
llamada.

Matiz que agregó la verificación: `chatClaude(..., {feature})` **sí** re-rutea un ref
no-anthropic a `chatCheap` con fallback a Sonnet (así corren hoy mako-guardian y
checklist-coach en Gemini). O sea que hay dos caminos y solo uno respeta el registry. El
precedente para pinear el modelo en la cascada es `overrideDeFeature` en
lib/mako-doer-in.ts:529.

**Vive en:** lib/model-registry.ts:99 · lib/ai-cheap.ts:207 · *2026-08-05 cierre-ronda-mako*

### ⚠️ El pin de proveedor descarta también el `effort` que eligió el router

Con el pin de `mako-doer-in` a `gemini-flash-latest`, el pin no-anthropic descarta el modelo
**y** el effort elegido por el router. Flash cumple el CUÁNTO y no el CÓMO: el detalle subió
a 649 chars de mediana y el formato de 4 partes salió en **0 de 5** tareas (escribió
«Cita: …» en prosa). Ver también «A un modelo rápido no lo atás con más prompt», en [El doer](#el-doer).

**Vive en:** lib/mako-doer-in.ts (el pin no-anthropic) · *2026-08-06 contexto-de-todas-las-tareas*

### ⚠️ Pendiente: «menos Opus de más» no se ve en la tab Modelos de IA

El dueño lo marcó y sigue sin reflejarse: hay muchos procesos usando Opus donde no hace
falta. *(2026-07-15)* Su criterio: «Siento que estás utilizando MUCHÍSIMO a Opus 4.8, en
tareas que no es eficiente utilizarlo».

**Vive en:** lib/model-registry.ts (`CATALOGO_MODELOS`) · app/modelos-ia

### Regla: la cascada por costo es Gemini → Groq → OpenAI, y Claude no es default de nada

«Si hazlo, pero primero Gemini, luego Groq y por ultimo openai» (2026-07-29). «NO que jamás
caiga a Claude… Quiero EVITAR caer en el gasto con Claude» (2026-07-22). Claude queda
reservada para razonamiento complejo, y hay que **buscar activamente más IA gratuitas para
rotar**. Antes de meter Claude en un proceso, la pregunta es si no alcanza un modelo
barato o gratis: «me está consumiendo muchísimos tokens y dinero el MaKo en Whatsapp… no
podemos utilizar Groq que es gratuito? Se honesto» (2026-07-19). Y el modelo se elige por
tarea real: una petición simple no justifica el modelo caro.

### Decisión: cada cliente trae su propia Gemini y los procesos de Claude se migran a barato

Para eso se construyó todo el sistema de integraciones (BYOK). El costo de tokens de MaKo
en WhatsApp era insostenible: «por más de que entrene, no se paga nada y da 1M de tokens»;
«eso a escala con muchos clientes, son cientos o miles» de dólares. *(2026-07-22)*

### Decisión: tab de SuperAdmin para ver y editar qué modelo usa cada tarea

Más una sección de Saldo IA con las 3 IAs cargables a mano. Necesita controlar el gasto y
saber con qué corre cada cosa. *(2026-07-15)*

### Decisión (en tensión con el código): si falla la IA elegida, error explícito y no cascada

«Un fallback silencioso oculta que el proveedor configurado no está funcionando y ensucia el
costeo» *(2026-07-22)*. Ojo: hoy `chatCheapCascade` hace exactamente lo contrario, y encima
lo hace mal (ver [La capa barata](#la-capa-barata)). Cuando se toque la cascada, esta
decisión es la que manda: el usuario tiene que enterarse de que su proveedor no respondió.

---

## La capa barata

### ⚠️ La cascada no cae a otro lado: pedir un proveedor sin key devuelve Groq, y el log miente

**Síntoma:** el "fallback" no rescata nada y el registro de uso dice que probó Mistral.

**Causa:** `chatCheapCascade` recorre `provs` y llama a `chatCheap({ provider: prov })`;
`proveedor(pref)` hace `if (pref) { const p = await provDe(pref); if (p) return p; } return
provDe('groq') ?? provDe('openai')` — si el proveedor pedido no tiene key, **no falla ni se
saltea: corre en Groq**. Con `CASCADA_GRATIS = ['groq','cerebras','openrouter','mistral','openai']`
y solo GROQ/OPENAI/GEMINI cargadas, la cascada real es groq, groq, groq, groq, openai:
cuatro intentos contra el mismo modelo, con el mismo prompt y (salvo que el caller pase
`temperature`) la misma salida. Peor para el diagnóstico: el `motivo` que queda en el
registro de uso es `«… · fallback mistral»` aunque nunca se haya llamado a Mistral, y si el
caller pasó `modelos: { mistral: 'x' }`, ese nombre de modelo se le manda a Groq.

**La amplificación que nadie ve:** como `proveedor()` no corta rápido cuando falta la key,
si Groq está lento-colgado los slots de cerebras/openrouter/mistral vuelven a pegarle al
MISMO Groq y queman 30s cada uno — una sola cascada puede llegar a **150s**.

**Regla:** antes de suponer que un fallback probó otro proveedor, chequeá que la key exista;
y la cascada debería saltear los proveedores sin key en vez de colapsarlos en el default.

**Vive en:** lib/ai-cheap.ts:67-73 (`proveedor`), :84, :141-144 (`chatCheap`), :159-172,
:237-257 (`chatCheapCascade`) · *2026-08-02 ~chat-agent-ensayo-y-secuencias + 2026-07-29
review-onboarding-resto*

### ⚠️ Un `validar` que acepta el vacío corta la fila de proveedores gratis

**Síntoma:** «MaKo no armó preguntas» / «MaKo no devolvió avatares», aunque el proveedor
siguiente de la cascada hubiera funcionado.

**Causa:** el guard de `chatCheapCascade` es `if (t.trim() && (!opts.validar || opts.validar(t))) return t;`
y los validadores estaban escritos sobre la FORMA, no sobre el CONTENIDO:
`(t) => Array.isArray(parseJsonLoose(t).preguntas)` da true para `{"preguntas":[]}`, y
`tieneAvatares` daba true para `{"avatares":[]}` y para items sin `nombre`. El primer
proveedor devuelve un array vacío, la cascada lo da por bueno, **no prueba a nadie más**, y
el consumidor filtra y se queda sin nada — exactamente lo que `validar` existe para
rescatar.

**Regla:** el `validar` de una cascada tiene que usar el MISMO parser que consume el
resultado (`parseAvatares(t).length > 0`) y exigir el mínimo utilizable (`arr.length > 0` y
los campos que el consumidor va a leer). Un JSON que parsea pero es inútil debe caer al
próximo proveedor.

**Vive en:** lib/onboarding.ts:233 (`generarPreguntasCerradas` de El Archivero, **sigue
vivo**) · lib/avatares.ts:150 (`tieneAvatares`, ya corregido: es el patrón a copiar) ·
lib/ai-cheap.ts (`chatCheapCascade`) · *2026-07-28 ~review-tanda-avatares +
~review-avatares-angulos-onboarding*

### ⚠️ La cascada disfraza de «el proveedor falló» dos problemas que son nuestros

Cuando una llamada termina en «tu IA está conectada pero no pudo responder ahora mismo
(puede ser un límite de uso)», casi nunca es el proveedor.

1. **Timeout fijo.** `chatCheap` usa `AbortSignal.timeout(opts.timeoutMs ?? 30000)`,
   mientras que `chatClaude` sí escala el timeout con el pedido
   (`min(120000, max(30000, maxTokens*12))`). Una respuesta grande aborta a los 30s y la
   cascada lo anota como fallo del proveedor y prueba el siguiente.
2. **Truncación disfrazada de red.** Si la respuesta se corta por `maxTokens`,
   `parseJsonObject` hace `JSON.parse` estricto y **lanza adentro de `validar`**, que corre
   dentro del try del bucle: el throw del parser es indistinguible de un error de red y
   hasta dispara el reintento. La única señal real de truncación es un `console.warn` con
   `finish_reason`.

**Regla:** propagar `finish_reason='length'` hasta el envelope con un error que diga «se
cortó, bajá la cantidad», y usar un parser tolerante (ya existe: `parseJsonLoose` en
lib/secuencias-variantes.ts).

**Vive en:** lib/ai-cheap.ts:175, :187-188, :207-235 · lib/anthropic.ts:48 ·
lib/campaign-structurer.ts:205-210 · *2026-08-06 ~fabrica-creativos-y-ads-writer-research*

### ⚠️ El `maxDuration` de un route tiene que cubrir la cascada ENTERA, no una sola pierna

**Síntoma:** el usuario tocaba «Que MaKo la describa» y recibía un 504 pelado en vez del
mensaje amable que el código tenía escrito para ese caso.

**Causa:** `generarDescripcionPersona` llamaba a `leerDocumentoIA` sin pasar `timeoutMs`, y
cada pierna de `VISION_CASCADE` se auto-asigna 100s por defecto; las piernas corren
SECUENCIALMENTE, así que con Gemini colgado y OpenAI de respaldo el peor caso rondaba los
200s contra un `maxDuration` de 120 — Vercel mataba la función antes de que el
`{ ok: false, error }` llegara al cliente. El camino feliz nunca lo mostraba, y por eso no
se veía. El mismo patrón muerde en el onboarding: la acción 'guion' encadena DOS cascadas en
serie (`elegirAngulo` + `generarGuion`) contra un `maxDuration=120` → 504, y el guion
generado **se pierde** porque solo se persiste al final.

**Regla:** si un route llama a una cascada, su presupuesto tiene que ser mayor que
N × `timeoutMs`, y el timeout se pasa EXPLÍCITO desde el caller (como ya hacen
extract-deal-fiscal y extract-contract). Un timeout por-proveedor sin presupuesto total no
acota nada: degrada un error controlado en una caída dura.

**Vive en:** lib/ai-cheap.ts (`leerDocumentoIA` / `VISION_CASCADE`, default de 100s por
proveedor) · app/api/onboarding/persona/route.ts + lib/persona.ts (caso testigo) ·
app/api/onboarding/razones/route.ts:51-55 · *2026-07-29 ~audit-onboarding-persona +
review-onboarding-resto*

### La letra chica de los free tiers, que no avisa cuando muerde

Research de julio 2026 sobre los proveedores de `lib/ai-cheap.ts`. Cuatro cosas que no están
en ninguna doc del repo:

1. El free tier de **Gemini ENTRENA con tus datos** y tiene revisión humana, y la excepción
   EEA/CH/UK no aplica a MX ni AR — mandar PII de un CRM por ahí es un problema. El «billing
   trap»: al prender billing en el proyecto, el free tier desaparece.
2. Los límites de Gemini son **por proyecto, no por API key**: repartir más keys NO
   multiplica la cuota. Importa para BYOK.
3. **Cerebras** en free capa el contexto a **8.192 tokens FLAT**: un prompt largo no se
   degrada, falla.
4. Los modelos `:free` de **OpenRouter** exigen activar el toggle de logging/entrenamiento;
   sin eso responden «No endpoints found matching your data policy».

Groq y Cloudflare son los limpios en privacidad (no entrenan), pero el pool de **10.000
neurons/día de Cloudflare es COMPARTIDO** entre LLM y STT: transcribir mucho audio se come el
presupuesto de las clasificaciones.

**Vive en:** lib/ai-cheap.ts (`chatCheapCascade`, `transcribirAudio` y las constantes de
cascada) · *2026-07-14 research-free-ai-apis*

### ⚠️ Pendiente: dos STT hardcodeados a `whisper-1` no pasan por el choke point

`lib/ai-cheap.ts` ya elige proveedor por env (Groq `whisper-large-v3-turbo` si hay
`GROQ_API_KEY`, si no OpenAI), así que casi todo el STT se abarata sin tocar código. Pero
`transcribeMediaBuffer` (clases del portal de conocimiento) y `transcribeAd` (video de cada
anuncio de Meta) arman su propio form con `model: 'whisper-1'` y no llaman a
`transcribirAudio`: quedan clavados en OpenAI. Justo el de ads es el de más volumen, porque
corre en cron y en backfill sobre cientos de anuncios. Al migrarlos hay que conservar el tope
de 25 MB y `response_format: verbose_json` (se usa `duration` para calcular el costo).

**Vive en:** lib/transcribe.ts:171 y :257 · *2026-07-15 ~ruteo-ia-por-tarea*

### Decisión: NVIDIA build.nvidia.com queda descartado como proveedor

Se evaluó como capa gratis para ai-cheap. Los LLM son OpenAI-compatibles (baseURL
`integrate.api.nvidia.com/v1` + key `nvapi-`) y entrarían casi drop-in, pero hay dos frenos
duros: los Trial ToS dicen que NVIDIA puede usar tus inputs y outputs para entrenar y
**prohíben explícitamente subir PII** —que es exactamente lo que procesa la app: leads y
notas de voz de clientes—, y es un trial declarado «not intended for production», con 40 RPM
(~2.400 requests/día) y sin SLA. Además el STT NO es drop-in: los ASR hosteados (parakeet,
canary, whisper) corren por gRPC/Riva, no por `/audio/transcriptions`, así que habría que
reescribir `transcribirAudio` o meter un puente. La única vía privada, self-hostear NIM,
exige GPU y deja de ser gratis. **Decisión:** Groq sigue siendo el default para todo lo
productivo; NVIDIA, a lo sumo, como laboratorio para benchmarkear con datos que NO sean de
clientes.

**Vive en:** lib/ai-cheap.ts (resolución de proveedor por env) · *2026-07-14 research-nvidia-nim*

### Decisión: transcribir cursos largos va con audio, tier pago y trozos de 10 minutos

Research para bajar cientos de horas de cursos de Drive; **no está implementado** (hoy
/conocimiento transcribe con Whisper de OpenAI, tope 25 MB). Lo que decide el diseño si
alguna vez se construye:

1. Mandar el **AUDIO** extraído, nunca el video: 32 tokens/segundo contra ~300, casi 10x, y
   el video además topea en ~1h de contexto mientras el audio llega a 9,5h. Gemini
   downsamplea a 16 kbps mono igual, así que codificar mono/16k no pierde nada (~7 MB/hora).
2. El modelo **RESUME o limpia el habla si no se le prohíbe explícitamente**: hay que pedir
   verbatim, con muletillas y sin corregir gramática.
3. Los timestamps en audios largos **no son de fiar** (bug del foro oficial, 2026: deriva de
   hasta -157s en Flash) y arriba de ~15 min aparecen repeticiones y alucinaciones. Trozos de
   10 min con 30s de solape bajan la deriva a 5-10s y evitan el costo casi-cuadrático.
4. La Files API NO acepta URLs remotas y un link de Drive redirige al intersticial de
   virus-scan: hay que bajar los bytes, y para cientos de archivos conviene la Drive API v3
   `files.get?alt=media` con service account en vez de scrapear el `confirm`.
5. Tier **PAGO**, no free (el free entrena con tu contenido). Con Flash-Lite el costo es
   ~US$0,04/hora.

**Vive en:** lib/ai-cheap.ts (`transcribirAudio`, `MAX_INLINE_GEMINI=14MB`) ·
app/api/mako/knowledge/transcribe/route.ts (lo que hay hoy) · *2026-07-21
~research-transcribir-cursos-con-gemini*

---

### ⚠️ «MaKo» entra al sistema escrito «Maco», por la puerta del audio

El dueño manda una nota de voz por WhatsApp, Whisper transcribe **«Maco»** —que es como
suena—, esa cadena se convierte en el TÍTULO de una tarea («Configurar plantillas de funnels
por tipo (TOFU) en Maco») y desde ahí el Perro la repite en su razón de puntaje y en la
justificación del deadline. **Una marca mal escrita se propaga sola porque cada eslabón copia
el texto del anterior**, y para cuando se ve en pantalla ya está en cinco lugares.

Por eso hacen falta las dos capas: `REGLA_MARCA` en `MAKO_NUCLEO` (para lo que la IA escribe
de cero) y `corregirMarca()` determinista en la **entrada** — la transcripción y el saneo del
título/detalle de la tarea. El prompt no llega a lo que entra transcripto.

⚠️ La lista de variantes es CERRADA (`maco|mako|macko|makko`, palabra completa) y **«Marco» no
está**: es un nombre de persona, y convertir el nombre de alguien en el de la marca es peor
que dejar un «Maco» suelto.

**Vive en:** lib/mako-gramatica.ts (`corregirMarca`, `REGLA_MARCA`) · lib/ai-cheap.ts (`transcribirAudio`) · lib/plan-propuesta.ts (`limpiarTarea`) · *2026-08-08*

## Prompts

### ⚠️ El prompt que leés en el archivo NO es el que recibe el modelo: brandSystem le antepone MAKO_NUCLEO

`brandSystem()` arma `[persona, MAKO_NUCLEO, rendered]`, así que las reglas de CHAT
(«Markdown: negritas, viñetas», «Nada de muros de texto», «el PRIMER mensaje 2-4 líneas»,
«NUNCA termines con una pregunta») van en **posición de máxima autoridad** delante de ~20
llamadas que esperan JSON estricto: mako-guardian, checklist-coach, plan-fathom, retro-gate,
post-llamada, ad-copy, email/generar, campaign-suggest. Contradice de frente al «Devolvé
EXCLUSIVAMENTE un objeto JSON válido (sin markdown)» del propio prompt, y el costo ya se
paga: `parseJsonObject` tiene que limpiar ```json a mano y plan-fathom loguea «la IA no
devolvió JSON válido» con reintento.

El verificador **refutó** que esto explique la brevedad de las respuestas, pero confirmó la
contradicción de formato como problema real y sistémico. Fix propuesto: partir el núcleo en
reglas de sustancia (siempre) y de formato conversacional (solo chat), con un
`brandSystemJson`.

**Vive en:** lib/mako-prompts.ts (`MAKO_NUCLEO`) · lib/campaign-structurer.ts:200 ·
lib/landing-writer.ts:139 · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense*

### ⚠️ Editar el template en el repo no cambia el prompt si hay un override guardado en la base

Las entradas del registro declaradas con `source: 'override'` se resuelven con
`getPromptText(key, fallbackTpl)`: el texto guardado en `app_settings['mako.prompt-overrides']`
**gana** sobre el default del código. Si en prod hay un override, tocar el template y pushear
no cambia nada y no hay ningún aviso. Excepción a tener presente: el slot `{{jsonShape}}` se
rellena SIEMPRE con la constante del código, así que el esquema JSON sí se puede cambiar
desde el repo.

**Corolario:** renombrar una key de prompt deja huérfanos el override y sus hasta 30
versiones de historial, y la IA vuelve al texto de fábrica **en silencio**.

**Regla:** antes de dar por hecho un fix de prompt, mirá el store.

**Vive en:** lib/prompt-registry.ts · lib/prompt-render.ts (`getPromptText`) ·
`app_settings['mako.prompt-overrides']` · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense*

### ⚠️ Los prompts de la matriz de razones y de los ángulos nunca se registraron

`razones.system`, `razones.user`, `razones.guion`, `formatos.system` y `formatos.user` se
resuelven con `renderPrompt(key, TEMPLATE_DEFAULT)` —o sea, están escritos como si fueran
editables— pero ninguna de esas keys existe en `lib/prompt-registry.ts` (grep verificado
vacío el 7/8/2026). Resultado: corre siempre el template hardcodeado y el usuario no los ve
ni los puede tocar. Es el caso «prompt no listado» que caza la skill
`verify-prompt-registry-sync`. Registrarlos es aditivo y no cambia comportamiento (el default
es el mismo template). Lo mismo pasa con `avatares.system` y `entregable.system`.

**Vive en:** lib/razones.ts:121-122,152 (`GUION_SYSTEM_TEMPLATE`) · lib/angulos-formatos.ts:120-150 ·
lib/prompt-registry.ts · *2026-07-28 mapear-onboarding-ajustes*

### ⚠️ `mako.voz_guia` tiene dos escritores que se pisan sin merge

La guía de voz es un solo string en `app_settings` que **cinco** consumidores inyectan entero
en sus prompts (nutrición, plantillas, simulador, post-llamada, el editor manual). Pero la
escriben DOS caminos que no se conocen: `destilarVoz()` (que la deriva de las transcripciones
de anuncios, disparada desde /api/mako/voz) y el paso «Tu forma de escribir» del onboarding
del Chat Agent (que la compone desde la evidencia de los chats más lo que contestó el dueño).
El último que corre borra el trabajo del otro, sin aviso y sin historial.

**Regla:** si un slot de `app_settings` tiene más de un escritor, o se define cuál gana o se
guarda la estructura en una key aparte y se DERIVA la prosa final (el patrón de
`mako.archivero.manual`). Y si alguna vez se guarda JSON en `mako.voz_guia`, se rompen los
cinco consumidores y el editor manual de una.

**Vive en:** lib/nutricion-generator.ts:95 (`setVozGuia`) y :122 (`destilarVoz`) ·
app/api/chat-agent/onboarding/contexto/route.ts:79 y :158 · app/api/mako/voz/route.ts:58 ·
*2026-08-02 ~investigar-onboarding-chat-agent*

### Cuando un texto generado sale pobre, el culpable no es el prompt que lo genera: es el último que lo escribe

La queja era «Fathom resume demasiado y no cita a los invitados». Tres agentes independientes
le apuntaron a `lib/plan-fathom.ts` (el «1-3 frases» del JSON_SHAPE, los ejemplos con
`detalle:'…'`, los `slice(0,600)`). Los verificadores lo tumbaron: **ese detalle nunca llega
al tablero**. Apenas se crean las tarjetas corre el Perro, y `checklistsParaTareas`
REESCRIBÍA el detalle desde cero pisando el de MaKo, viendo como insumo solo los primeros
**220 caracteres**. O sea: el eslabón corto no era el que se medía, y arreglar el prompt de
extracción no habría cambiado nada visible.

**Regla:** seguí la cadena hasta lo que se PERSISTE, y medí sobre la tabla final, no sobre la
salida del primer modelo. (El fix ya está: `fusionarDetalle` + ventana de 4000, con el
comentario «4000, no 220: ACÁ estaba el cuello».)

**Vive en:** lib/plan-board.ts · lib/todo-guardian.ts · lib/checklist-coach.ts
(`checklistsParaTareas`) · lib/plan-fathom.ts · *2026-08-05
~fathom-preguntas-lote-whatsapp-forense*

### Un contrato que «no se cumple» puede que nunca haya corrido

Todo el diagnóstico de «Fathom ignora su propio piso de 600 caracteres» se hizo sobre tareas
extraídas ANTES de que el contrato existiera: el piso y el formato de 4 partes entraron el
5/8 a las 14:58 y la última extracción real en prod había sido el 3/8 a las 20:43. Los
77-226 chars medidos venían de corridas con el override a `gemini-flash-latest` y el
`reasoning_effort` minimal, las dos causas ya arregladas en ese mismo commit.

**Regla:** antes de reescribir un prompt por incumplimiento, comparar la fecha del último
dato de producción con la del commit que creó la regla, y recién después mirar qué modelo la
corrió de verdad. **Corolario:** la sonda barata (re-extraer una reunión ya cacheada con
`reanalizar:true`) decide si hace falta construir el reintento o no.

**Vive en:** lib/plan-fathom.ts:224 (piso) y :226 (formato) · cachés en `app_settings`
`mako.fathom.cache.<recordingId>` · *2026-08-06 contexto-de-todas-las-tareas*

### Decisión: todos los prompts hardcodeados pasan a /configuraciones, con su contexto explicado

«Todos los prompts impuestos en codigo, todos todos» *(2026-06-29)*: el dueño quiere poder
ajustar el comportamiento de MaKo él mismo, sin tocar código. Es la razón por la que existe
el registry — y por la que un prompt sin registrar (arriba) es una regresión, no una omisión
inofensiva.

### ⚠️ Pendiente: catálogos y definiciones que deberían ser editables y no lo son

- Sección en super admin para editar el **catálogo de causas/palancas** del diagnóstico y los
  **ángulos de guion con sus instrucciones por ángulo**. *(2026-07-11)*
- Definir bien `getSenalesRecon` **con ejemplos** (¿qué es una señal RECON? ¿qué es
  INTENCIÓN?) y detectar en el código otros conceptos que estén sin ejemplos. *(2026-07-11)*
- Aprovechar las skills de marketing de skills.sh (marketing-psychology, copywriting,
  email-sequence) para toda la redacción, más una vista de admin donde él vaya cargando
  ejemplos de emails que recibe. *(2026-07-10)*

---

## Topes

### ⚠️ `effort: 'low'` NO apaga el razonamiento de Claude: el único knob es `thinking: false`

Se elige `effort:'low'` creyendo que así la llamada sale rápida y barata, y el modelo sigue
razonando igual. En `chatClaude` el esfuerzo solo baja cuando thinking ya está apagado:
`thinkingOn = opts.thinking ?? true` y `effort = thinkingOn ? (opts.effort ?? DEFAULT_EFFORT) : 'low'`;
con `thinkingOn` se manda `payload.thinking = { type: 'adaptive' }` SIEMPRE y el `max_tokens`
por defecto salta a 16000. O sea: bajar el effort no reduce el pensamiento, y el pensamiento
se come el presupuesto de salida. Para una tarea chica (un título, una clasificación) hay que
pasar `thinking: false`, que además fuerza effort `'low'` y `max_tokens: 512`. **Verificado
vivo en el código de hoy.**

**Vive en:** lib/anthropic.ts:76-89 (`chatClaude`) · *2026-07-16 ~perro-ataja-duplicados-al-crear*

### ⚠️ El tope está escrito dos veces: en el `.slice()` y en el texto del prompt

Subir el `.slice(0, 3)` no cambia nada porque el modelo sigue devolviendo 3: el número está
literal en el system, en el user, en el ejemplo de forma del JSON y hasta en las reglas
conceptuales («los 3 tienen que ser genuinamente DISTINTOS»), además de los comentarios de
cabecera que quedan mintiendo. Y hay un corte que no está donde parece: en razones el slice
es **por avatar**, adentro del bucle de filas, no sobre el total. Encima ninguno de esos
prompts está dado de alta en el registry (ver [Prompts](#prompts)), y `renderPrompt` igual
honra un override guardado, así que un prompt viejo con el 3 le ganaría al código nuevo.

**Regla:** la cantidad va como constante exportada y como slot `{{cuantos}}` del template,
nunca como literal duplicado.

**Vive en:** lib/avatares.ts:99,107,118,124 · lib/razones.ts:122,132,141,155 ·
lib/entregable.ts:77,94,100 · lib/prompt-registry.ts · *2026-08-06
~fabrica-creativos-y-ads-writer-research*

### ⚠️ Si la Retro va justa de tiempo, publica sin verificar y no lo dice

El pipeline de la Retro son 8 fases con ~9 llamadas a Opus; la última es una verificación que
re-chequea los números del borrador del «cerebro». Cuando la corrida se acerca al límite de
**500s**, esa fase se SALTA y el borrador se publica igual, sin ninguna marca de que no pasó
el doble-chequeo. Un informe con la fuga en dólares que nadie verificó se lee exactamente
igual que uno verificado.

**Regla:** si se saltea la verificación, el resultado se rotula. Un degradado silencioso en
la pieza que dicta la tesis del negocio es peor que fallar.

**Vive en:** lib/retro.ts, lib/retro-reporte.ts (presupuesto de 500s) · *2026-07-19
~landing-24-features-auditoria*

### Regla: nunca le pongas un techo numérico a la IA

Ni cantidad de preguntas, ni de tareas, ni de opciones. Se le dan ejemplos y criterio, no
jaulas: la IA decide cuántas y si ninguna. «No le limites al perro para que genere de 0 a 3
preguntas, es una IA, que lo decida él cuántas preguntas tiene que generar o si no tiene que
generar ninguna»; «tengo miedo de estar metiendo muchas trabas y validaciones al flujo… para
eso es IA. Tal vez darle estos ejemplos, pero que pueda salirse»; «MaKo NO debería limitarse a
solo 4 preguntas» *(2026-07-11)*.

Lo mismo con los límites de producto: **no poner topes arbitrarios** (ni horas de agenda, ni
ventana de días de un público, ni cantidad de resultados). «No limites las horas, que se pueda
agendar a la madrugada si quieren» *(2026-08-07)*. **El tope lo pone la API, no nosotros.**

Y del otro lado: la IA genera **en cantidad** —100 avatares, razones o lead magnets, no 3—,
elige la mejor y deja el resto disponible para que el usuario la cambie: «aprovechemos la IA y
no la limitemos en la generación» *(2026-08-06)*.

### Regla: las transcripciones no se resumen nunca; se trocean

«No estarás resumiendo las transcripciones?… La transcripción no debería resumirse»
*(2026-07-24)*. El modelo resume solo si el techo de tokens lo aprieta: el troceado es la
respuesta, no un prompt que le pida ser más largo.

---

## Lo que le llega al modelo

### ⚠️ «No tiró» no es «hay dato»: los ceros estructurales entran al prompt como catástrofe

**Síntoma:** con solo Meta conectado, la Retro no sale flaca: sale **mentirosa**. «ROAS cash
0.00x: gastaste $X y facturaste $0» y «CUELLO del funnel: Formulario → Agenda 0.0%». El mismo
agujero está en /general: con cero fuentes comerciales el veredicto del semáforo cae al else
final y certifica «el negocio está sano, sin focos activos», cuando en realidad no sabe nada
— y eso es lo primero que ve un cliente en su primer login.

**Causa:** las áreas se omiten cuando su query tira o devuelve null, pero `getRevenuePeriod` y
`getFunnelEtapas` **no explotan** con `leads`/`pagos` vacíos: devuelven CEROS. `textoRevenue`
marca `hayAlgo=true` apenas la query no explota, y `roas_cash = spend>0 ? cash/spend : null`
da 0, no null. Con `MIN_MUESTRA=3` el cuello gana siempre con severidad 1.0. La Fase 6 de
verificación NO lo atrapa: su regla es «un número citado que no sale de datos», y el 0 **sí**
está en datos.

**El mecanismo de honestidad ya existe y está desconectado:** `getFunnelEtapas` acepta un
`sourceMap` para marcar `fuente_pendiente` y `retro-fuentes` simplemente no se lo pasa; y
`lib/sources.ts` ya separa conectada-y-fresca, conectada-sin-datos-recientes y desconectada,
pero ni los prompts ni el semáforo usan la distinción.

**Regla:** el gate de un área es la FUENTE conectada, no que la query no reviente. Todo
consumidor de métricas necesita el cuarto estado «sin datos suficientes para opinar, conectá
esto». **Corolario:** el catálogo de métricas que ve el cerebro tampoco se filtra por fuente,
así que pare experimentos sobre métricas estructuralmente nulas que jamás pueden concluir (la
Retro real #6 creó uno con `metrica=vsl_views` y objetivo 0).

**Vive en:** lib/retro-fuentes.ts:238 y :363 · lib/queries.ts:794 y :1278 ·
lib/retro-pipeline.ts:440 (`recolectarDatos` no recibe `areas`) · lib/sources.ts ·
app/general (semáforo) · *2026-07-16 mako-onboarding-solo-meta + 2026-08-05
~verificar-commits-contra-el-board*

### ⚠️ Quedan dos call-sites que colapsan el avance del VSL de NULL a 0

La regla «no medido ≠ no miró» ya está escrita y `getVslEngagement`/`getVslEngagementMap` se
arreglaron, pero la auditoría dejó dos consumidores sin tocar y ninguno avisa:
`lib/lead-insights.ts:267` hace `Math.max(0, ...eventos.map(e => e.porcentaje ?? 0))` y le
dice a la IA «retención máxima 0%» —es el único lugar donde el número se convierte en prosa—;
y `lib/nutricion.ts:340,358` usa `(max_pct ?? 0) >= 50`, así que mientras faltó el dato NADIE
cayó en la rama «vio el VSL» y toda la nutrición clasificó mal. Sumar: `lib/vsl-retencion.ts`
(`curvaRetencion`, `histogramaAbandono`) sigue sin un solo call-site, y `landingRecibioEventos`
(`lib/landing-token.ts:116`) mira `landing_visits`, que estaba sano, y por eso /integraciones
pintaba verde con la retención muerta.

**Vive en:** lib/lead-insights.ts:267 · lib/nutricion.ts:340,358 · lib/vsl-retencion.ts ·
lib/landing-token.ts:116 · *2026-08-06 crm-tracking-import-export-audit*

### ⚠️ El paso anterior del onboarding fabrica el dato que la Retro después denuncia

El wizard llama `seedNutricionTemplates()` en el paso 'funnel', y esas 5 secuencias nacen con
`activa:true` y 0 inscriptos (verificado en el ws3 de prod). Dos pasos después, la Retro las
lee y emite el finding «N secuencias activas con 0 inscriptos y 0 enviados» como anomalía del
negocio del cliente — un problema que creamos nosotros mismos, minutos antes, en el mismo
wizard. Y encima la regla 2 de cobertura («Nutrición sin secuencias activas») queda SUPRIMIDA
justamente porque las seedeadas están activas: el hueco real ni se declara.

**Regla:** un dato sembrado por default no puede alimentar un diagnóstico; o nace apagado, o
el diagnóstico lo distingue.

**Vive en:** app/api/onboarding/route.ts:179 (`seedNutricionTemplates`) ·
lib/retro-datos.ts:399-435 (`detectarCobertura`) · *2026-07-16 mako-onboarding-solo-meta*

### ⚠️ Cambiar la forma del modelo bajo la MISMA setting key es una migración silenciosa

El Avatar pasó de `{nombre,descripcion,dolor,deseo}` a
`{nombre,segmento,senalesMeta,situacion,dolor}` manteniendo `SETTING_KEY='mako.avatares'`, y
`getAvatares` seguía haciendo `(arr as Avatar[]).filter(a => a?.nombre)` sin normalizar.
Verificado contra prod: ws1 tenía 3 avatares guardados con la forma vieja, así que los campos
nuevos volvían `undefined` y se interpolaban al prompt de ángulos como texto literal
«Segmento: undefined · Situación: undefined», contaminando la entrada de Claude; además el
editor inline reventaba con TypeError al hacer `valor.trim()` sobre undefined. `tsc` no lo
caza porque el dato entra por un cast desde JSON.

**Regla:** si cambiás la forma de lo que guarda una key de `app_settings`, o cambiás la key o
normalizás al leer, con `''` por defecto para cada campo. El cast `as T[]` no es una
validación.

**Vive en:** lib/avatares.ts (`getAvatares`/`avataresTexto`) · app/onboarding/AvataresView.tsx ·
lib/angulos-venta.ts · *2026-07-28 ~review-avatares-angulos-onboarding*

### ⚠️ Un texto de fallback de la UI se cuela en el historial que ve el modelo

Cuando faltaba el audio, la burbuja de apertura se armaba con `texto: 'Tu nota de voz'`, y el
historial que se le manda al modelo se construye con `msgs.map(m => m.texto).filter(Boolean)`:
el primer turno que veía el lead simulado era literalmente «Tu nota de voz», una frase que
nadie dijo. En el camino bueno `texto` es `null` y se filtra solo. O sea: un bug de
reproducción degradaba también la calidad de la IA, sin que nada lo mostrara.

**Regla:** marcá los mensajes de chrome/fallback y excluilos SIEMPRE del historial del prompt;
no dependas de que el camino feliz los deje en null.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:604-613 y :643-645 · *2026-08-02
~diagnostico-audio-ensayo-chat-agent*

### Regla: la IA filtra, y si no es concluyente no concluye

«Es MUY importante que FILTRE la IA, y en caso de que NO sea concluyente, que no lo ponga»
*(2026-08-02)*: cuando la fuente no alcanza para concluir, no se inventa una conclusión — se
pasa a preguntas personalizadas, igual que el archivero. Y si la fuente externa no trajo el
dato, **se muestra que no lo trajo**: «No quiero que MaKo a la fuerza me de una respuesta si
Meta no trajo nada» *(2026-06-24)*.

### Regla: lo que dice el usuario es input, no verdad

«NO condicionar el análisis y tomar por ciencia cierta lo que te diga el usuario para el
análisis, se puede equivocar» *(2026-07-01)*. El dato del usuario entra como una fuente más,
no reemplaza el análisis ni lo condiciona. Su versión más dura, para el Perro: «Los clientes
MIENTEN, EXAGERAN, SON EMOCIONALES, NO SABEN PRIORIZAR».

### Regla: ningún dato cargado a mano es ley, y nunca se pregunta lo que ya está en la base

«Siempre si hay docs que traen mejor data se debe sobre escribir. Ningún dato a mano es ley»
*(2026-07-27)*. Del otro lado: «Si ya hay un token de Gemini NO me lo pidas nuevamente… no me
debe preguntar random si tengo otros documentos» *(2026-07-29)*. Si falta un documento
puntual, se pide **ESE**, no «¿tenés más?»; lo que se puede autocompletar con data previa, se
autocompleta. «La idea justamente es APROVECHAR la info, que la IA haga el trabajo, no hacer
que el usuario cargue todo nuevamente» *(2026-08-05)*.

### Regla: lo analizado no se re-analiza, y el feedback se guarda para reusar

«Cada vez que toco a analizar esa reunión para extraer la data, me consume créditos… Ese
análisis debe guardarse en algún lugar» *(2026-07-19)*. Y lo mismo con el aprendizaje:
«Tienes que ir guardando todos estos feedback para que nos sea más fácil crear los próximos»
*(2026-07-22)* — el feedback y los aprendizajes se guardan y se reusan en las próximas piezas
**y en todos los orígenes**, no se pierden en el chat. Su lugar es CONOCIMIENTOS, no un md
suelto: «mucho mejor si te guias de ahí y no vamos guardando en un md vacio las cosas
importantes» *(2026-07-24)*.

### Decisión: el contexto de MaKo se inyecta de forma ADITIVA

RAG + fases: si una pieza está vacía, MaKo se comporta exactamente como hoy. Los embeddings
reusan la `OPENAI_API_KEY` que ya está en el repo y solo se re-embebe cuando cambia el cuerpo
de la entrada. «No quiero romper el comportamiento actual ni tocar el resto del dashboard» /
«no sumar otro proveedor». *(2026-06-21)*

### Decisión: los cursos son el RAG de MaKo, pero la info no se carga cruda

Pasa por un proceso de razonamiento previo para adaptarla: «este curso de AvatarHype, está muy
para productos, debemos pasar por un proceso de razonamiento tu y yo para cargar esa info»
*(2026-07-21)*. Los cursos son **generales de MaKo** (no por workspace) y se clasifican por
área (imágenes y video con IA, oferta, nutrición…). La curación se hace **desde Claude Code**
y se guarda en /conocimientos para poder revisarla: «de hacerlo dentro de la app, me
consumiría muchísimos créditos de la API». El contenido de /conocimientos se puede compartir
por link público, sin login: «que yo le pueda pasar un link a cualquiera y pueda acceder a
eso» *(2026-07-27)*.

---

## El doer

### ⚠️ Los pasos de acción de un flujo son afordancia viva con dispatcher muerto

`crear_tarea` / `inscribir_nutricion` / `marcar_lead` existen como `AccionFlujo`
(lib/flujos-tipos.ts:34), se eligen HOY desde un dropdown de la UI
(app/agencia/FlujoEditor.tsx) y `lib/flujos.ts:75` encola un pendiente con
`tipo: \`flujo_${paso.accion}\`` (más `flujo_wa_lead` en la línea 62). Pero `ejecutarAccion`
solo tiene los casos `lead_etapa`, `nutricion_toggle`, `meta_nombre|presupuesto|estado` y
`tareas_plan`: **ningún `flujo_*` matchea**. El dueño confirma por WhatsApp y recibe «❌ No se
pudo: Acción desconocida: flujo_crear_tarea». La cañería proponer→confirmar-por-WhatsApp→
ejecutar ya está construida y probada; falta un `case`, no una arquitectura.

**Vive en:** lib/flujos.ts:62 y :75 vs el switch de `ejecutarAccion` en
lib/mako-doer-acciones.ts:100-170 · *2026-07-16 perro-guardian-captura*

### ⚠️ Pendiente: no hay tool que escriba las fechas, la asistencia ni los Deal Details

No existe tool para `fechaJ1`, `asistenciaR1/R2`, `calificado`, `fathom*` ni los `deal*`.
Mientras no exista, mover a una etapa de reunión o de cierre desde WhatsApp se registra con
`{ omitir }`: pasa, pero declarando qué quedó sin cargar. **Si se agrega la tool, sumar el
`StepId` a `REQUISITOS_PEDIBLES` en el mismo commit** — si no, el canal sabe cargarlo y sigue
sin pedirlo.

**Vive en:** lib/mako-doer-acciones.ts (input_schema de las 11 tools)

### ⚠️ Pendiente: `faltantesParaMover` decide con `hoyEnTijuana()` fijo

Acá no es una cohorte persistida sino **gating**: decide si una reunión «ya pasó» y por lo
tanto si se exige asistencia/Fathom. Para un workspace en Madrid el borde del día está ~9 h
corrido, y eso hoy **bloquea o destraba a MaKo** un día antes o después. Ver
[hallazgos-infra.md](hallazgos-infra.md) §2.

**Vive en:** lib/leads.ts:1570

### ⚠️ Pendiente: «Hola MaKo» no funciona y no recuerda la conversación

Reporte del dueño sin cerrar: «Hola MaKo» no funciona, los audios por WhatsApp tampoco, MaKo
no guarda los mensajes anteriores ni el histórico de la conversación, y sospecha que no
consulta de verdad los datos del dashboard. *(2026-07-15)*

**Vive en:** lib/mako-doer-in.ts · lib/mako-doer-acciones.ts

### Un validador hereda las capacidades del canal donde lo ponés

**Síntoma:** el dueño escribe «mové a Juan a Agendado» por WhatsApp. MaKo contesta «falta
cargar la Fecha de la Reunión 1, pedí ese dato». El dueño la dice. MaKo vuelve a contestar lo
mismo. Para siempre.

**Causa:** se cerró un agujero real —MaKo movía a Ganado sin monto— exigiendo **todos** los
requisitos del wizard del CRM. Pero las 11 tools del doer solo saben escribir `monto` y
`motivo`. La fecha de una reunión, la asistencia, el link de Fathom y los Deal Details viven
en Calendly/Fathom/la ficha, y **ninguna tool los carga**. El error hasta le mentía al modelo:
le decía «pedí ese dato» y no había dónde ponerlo.

**El diagnóstico obvio era el equivocado:** el bug no estaba en la validación (que es correcta
y sigue) sino en **de dónde se copió**. El wizard del CRM puede exigir la fecha de la R1
porque la carga en el mismo paso; WhatsApp no.

**Regla:** antes de exigir un dato, preguntá **por dónde se carga ese dato desde acá**. Si no
hay camino, no es una validación: es un callejón sin salida, y el usuario no tiene forma de
saber que está en uno. Se **pide** lo que el canal sabe cargar; lo que no puede cargar **no
bloquea pero tampoco se calla**: se mueve con `{ omitir }`, que deja en `lead_audit` qué quedó
sin cargar y por qué, y viaja en el resumen que el dueño lee antes de decir que sí.

**Vive en:** `REQUISITOS_PEDIBLES` + `veredictoRequisitos()` en lib/mako-doer-acciones.ts ·
*2026-08 validación de movimientos de etapa*

### Una acción diferida sobrevive al deploy que le cambia las reglas

Corolario del anterior, y se pasa por alto siempre: las `mako_pendientes` creadas **antes** de
la validación nueva se ejecutan **después**. Con la primera versión, el dueño apretaba «sí»
sobre una propuesta que él mismo había pedido y le rebotaba.

**Regla:** todo cambio en la validación de una acción diferida tiene que contestar **qué pasa
con las que ya están en la cola**. La cola es estado viejo corriendo con código nuevo.

**Vive en:** lib/mako-pendientes.ts · lib/mako-doer-acciones.ts

### Se valida al proponer *y* al ejecutar, y no es duplicación

- **Al proponer** (`proponer_cambio_etapa`): para que MaKo pida el monto o el motivo **en la
  misma respuesta**, en vez de proponer algo que rebota después del «sí».
- **Al ejecutar** (`ejecutarAccion`): porque entre la propuesta y el «sí» **pasan horas** y el
  dato pudo cargarse o borrarse en el medio.

Los dos caminos llaman al mismo `veredictoRequisitos()`; lo que no puede pasar es que
contesten distinto. Sin poder leer el lead se manda `'validar'`, así `setPipelineStage` **falla
cerrado** en vez de mover a ciegas.

**Vive en:** lib/mako-doer-acciones.ts

### La confirmación del doer no cruzaba turnos: el modelo proponía y confirmaba solo

El mecanismo «MaKo propone, el dueño confirma» existía en la prosa del preámbulo, no en el
código. `proponer_*` y `confirmar_accion` viven en el MISMO loop de tool-use (maxSteps 8): el
paso 0 creaba la pendiente en la base y el paso 1 la leía con `pendientesVigentes` y la
ejecutaba, sin ninguna guarda de edad mínima ni de turno distinto. Lo que el TTL y el scope por
`grupo_jid` sí garantizaban era que un «sí» viejo o de otra charla no dispare nada — pero no
que hubiera un humano. Importa porque el doer ingiere contenido inyectable (notas de leads,
historial de WhatsApp, PDFs e imágenes que entran como bloques nativos) en el mismo loop que
tiene `meta_presupuesto`, que es gasto real de la cuenta.

**Regla:** toda tool de confirmación tiene que rechazar la pendiente creada en el turno actual.
Hoy el guard compara `createdAt` contra el `turnStart` con 1,5 s de margen.

**Vive en:** lib/mako-doer-acciones.ts (case 'confirmar_accion') · lib/mako-pendientes.ts ·
lib/anthropic.ts (`chatClaudeTools`) · *2026-07-19 ~review-tareas-de-whatsapp-al-plan*

### ⚠️ A un modelo rápido no lo atás con más prompt: el candado va en la tool

El fix que intentó atar al modelo desde adentro del resultado de la tool **falló en
producción** tres horas después del deploy: MaKo volvió a anunciar «3 preguntas» sobre un
borrador que tenía cero. El único patrón de ese archivo que demostró atar al modelo es devolver
`{ok:false, error:'…'}` desde la tool y dejar que reintente (el candado `pareceConfirmacion`),
con tope de un reintento para no colgar el turno. **Dónde NO ponerlo:** en el preámbulo del
doer — ya está ahí y ya se ignora.

**Vive en:** lib/mako-doer-acciones.ts:438 (el molde que sí ata) y :467 · *2026-08-06
contexto-de-todas-las-tareas*

### El botón sin motivo dejaba el motivo de la pérdida anterior

`lib/mako-confirmaciones.ts`, rama `op:<key>`: «Marcar Perdido» no trae motivo, así que la
salida se registraba con el motivo de una pérdida **anterior** o sin ninguno. Es la misma
herencia que se arregló del lado del validador (ver [hallazgos-crm.md](hallazgos-crm.md) §3,
«El motivo de pérdida se heredaba»), un nivel más arriba: el validador ya distingue «motivo de
ESTE movimiento», pero solo sirve si el caller **manda uno**. Hoy siempre lleva el del `op` y,
si no hay, uno armado con la regla y el título de la confirmación.

**Regla:** cuando el validador aprende a distinguir un dato nuevo, revisá **quién lo manda**.
Un caller que no lo manda pasa la validación con el dato viejo.

**Vive en:** lib/mako-confirmaciones.ts

### La hora que MaKo repite es display

`lib/mako-tools.ts:243` formateaba la hora de la R1/R2 en `America/Tijuana` — o sea, un cliente
en otro huso escuchaba a MaKo decirle la hora **del dueño**. Es display puro y se migró a
`tzActual()`, resuelto **una vez por listado, no por fila**.

**Regla:** lo que la IA le dice al cliente es UI. Todo lo que pasa por un `toLocaleString` en
`lib/mako-*` se trata igual que una card.

**Vive en:** lib/mako-tools.ts:243

### Regla: si MaKo puede resolverlo, lo resuelve; y toda acción irreversible se previsualiza

«Si lo puede hacer MaKo, siempre debería, solo me debe preguntar en caso de NO encontrar
respuesta» *(2026-07-19)*. Pero antes de ejecutar: modal de confirmación que **previsualiza
exactamente lo que va a pasar** — «antes me confirmes que hay un modal de "confirmación" en
donde pueda previsualizar todas las tareas que le está por mandar a evaluar con el perro.
Porque de lo contrario, se van a crear muchas tareas que pueden estar mal» *(2026-07-17)*.

### Regla: todo lo que toca la IA queda en el historial, firmado por MaKo

«No actualizaste el HISTORIAL de cambios en cada tarea o proyecto… Eso es muy grave… Eso tiene
que ser regla siempre» *(2026-07-17)*. Sin excepción y sin demora, con el actor que lo hizo
(MaKo vs Claude Code) y su motivo. Si lo hizo la IA, firma **MaKo con ícono de IA**, no con
foto de usuario ni «vos» *(2026-07-14)*.

---

## Gasto y saldo

### ⚠️ Nada en `lib/` corta una llamada por gasto: `ia-cuotas` reordena, nunca bloquea

**Síntoma:** se asume que el sistema de cuotas ya frena algo. No frena nada.

**Causa:** `ordenarPorCuota` (`lib/ia-cuotas.ts:86-93`) devuelve
`[...no-agotados, ...agotados]` — la misma cantidad de proveedores que entró. El comentario
lo dice: «Nunca los saca: solo los manda al final». No hay en todo `lib/` una sola rama que
devuelva error por dinero gastado. Lo único que frena algo son presupuestos **por corrida**
(`closing.ts:704`, `ads-analyst.ts:502`): topean una invocación del cron, no a un cliente —
nada impide que corra de nuevo mañana. `saldo-ia-bajo` avisa, no corta; `lib/rate-limit.ts`
es en memoria por instancia y muere en el cold start.

**Regla:** un límite por plan hay que escribirlo entero, y el chequeo tiene que ser
**pre-flight**. Los `recordUsage` existentes son posteriores a la llamada y fire-and-forget:
sirven para contabilizar, no para gatear.

**Vive en:** lib/ia-cuotas.ts:86-93 · lib/closing.ts:704 · lib/ads-analyst.ts:502 ·
*2026-08-08 analisis-costos-ia-cobros*

### ⚠️ Tres módulos gastan sin registrar, y siempre contra la key de la agencia

**Síntoma:** el gasto medido en `anthropic_usage` no cierra con la factura de OpenAI.

**Causa:** `lib/embeddings.ts:27` (un `text-embedding-3-small` por **cada búsqueda del
RAG**, vía `mako-knowledge.ts:190`), `lib/transcribe.ts` (whisper-1 ×2, gpt-4o-mini y
gpt-4o visión en `:132,:174,:203,:260`) y `app/api/ads-manager/analyze-creatives/route.ts:44`
(gpt-4o, hasta 8 imágenes, **sin guard de rol**) llaman a la API sin pasar por
`lib/anthropic.ts` ni `lib/ai-cheap.ts`. `grep -c 'recordUsage\|recordSttUsage'` da **0** en
los tres. Además resuelven la key con `envCred` —que siempre cae a `OWNER_WS`— en vez de
`credWs`, así que **un cliente BYOK igual se lo paga la agencia**.

**Regla:** cualquier número de gasto sacado de `anthropic_usage` es un **piso**, no un
total. Al taparlo, whisper va con `recordSttUsage` (cobra por segundo, y `verbose_json` ya
devuelve `duration`), el resto con `recordUsage`.

**Vive en:** lib/embeddings.ts:24,27 · lib/transcribe.ts:54-63,132,174,203,260 ·
app/api/ads-manager/analyze-creatives/route.ts:30,44 · *2026-08-08 analisis-costos-ia-cobros*

### ⚠️ El registro de la IA barata es `void` sin `await`, y el insert nunca lee su `error`

**Síntoma:** faltan filas de consumo y no hay ningún log que lo explique.

**Causa:** dos agujeros distintos. (1) Los 6 registros de `lib/ai-cheap.ts`
(`:184,:359,:385,:467,:523,:560`) se disparan con `void` y no se esperan — en serverless la
instancia se puede congelar con el INSERT en vuelo. `lib/anthropic.ts:125,:256` sí awaitea,
así que el camino de Claude es el confiable y el barato el frágil. (2) `insertUsage`
(`lib/anthropic-usage.ts:76-87`) envuelve todo en try/catch con `console.warn` y **nunca lee
el `{ error }` que devuelve supabase-js**: como `.insert()` no lanza ante errores de base, un
rechazo de RLS (habilitada en la mig. 0118) o una violación de constraint se pierden **sin
ningún log**. El catch solo cubre lo que sí se tira (falta la service key, red, timeout).

**Regla:** antes de construir cuotas sobre esta tabla, el registro tiene que ser
verificable: leer el `error` del insert, envolver los 6 call-sites en `after()` de
`next/server` (patrón que el repo ya usa en `app/api/plan-fathom/route.ts:11`), y que un
fallo de **lectura** sea un error explícito y no un cero — hoy `getUsageSummary` deja
`rows = []` y `usoHoyProveedores` hace lo mismo, que es el sentido más caro del error.

**Vive en:** lib/ai-cheap.ts:184,359,385,467,523,560 · lib/anthropic-usage.ts:76-87,225-237 ·
lib/ia-cuotas.ts:47-61 · *2026-08-08 analisis-costos-ia-cobros*

### ⚠️ `cost_usd` no es una medición: es una tabla hardcodeada con dos sesgos

`PRICING` (`lib/anthropic-usage.ts:39-52`) lista 12 modelos y `DEFAULT_PRICE` es **precio de
Opus** (5/25): un modelo que no esté en la tabla se sobrefactura — ya pasó con
`claude-sonnet-5` (lo documenta el comentario de `:44`) y hoy le pasa a `gpt-4o`, que no está
(solo `gpt-4o-mini`). Y al revés: `costFor` devuelve 0 para groq/gemini/cerebras/mistral/
openrouter **por estar en una lista**, no por el tier real; el costo verdadero se recomputa
solo **al leer**, solo para Gemini y solo si hay saldo cargado (`:245-256`).

**Regla:** si los «MaKo Tokens» se derivan de `cost_usd`, heredan las dos distorsiones.

**Vive en:** lib/anthropic-usage.ts:39-74,245-256 · *2026-08-08 analisis-costos-ia-cobros*

### ⚠️ El saldo y el gasto de IA son globales a ws1 aunque la key sea BYOK por workspace

**Síntoma:** Mauricio (ws1) ve el saldo de Gemini y el historial de cargas que hizo Martín
desde ws9, en una tarjeta que a la vez dice «Por configurar».

**Causa:** el sospechoso obvio —la credencial de Gemini— está bien: `credWs('GEMINI_API_KEY')`
sí resuelve por workspace. La falla es la **contabilidad**: `getSaldo`/`setSaldo`/`agregarCarga`
usan el cliente crudo y clavan `.eq('workspace_id', OWNER_WS)` con una key que lleva el
proveedor pero no el workspace (existe UNA sola fila `saldo.gemini` en todo el sistema), y
`getUsageSummary` lee `anthropic_usage` sin filtro de workspace aunque esa tabla SÍ esté en
`TENANT_TABLES` — el archivo saltea `getTenantDb` a propósito, con comentario. Es el mundo
pre-BYOK: «una agencia, un pool de keys, dueño = ws1».

**Regla:** cuando una key pasa a ser por-cliente, su LIBRO (saldo, uso, cuotas) migra con ella.
Anthropic puede seguir global mientras sea la única prepaga de la agencia, así que el scoping
es **por proveedor**, no ciego.

**Vive en:** lib/anthropic-usage.ts:65-73, :135-188, :205-213 · lib/ia-cuotas.ts:44-48 ·
app/integraciones/IntegracionesBoard.tsx:934,1011 · *2026-07-23 trace-gemini-leak-ws*

### ⚠️ `costFor()` registra a costo cero todo lo que esté en PROVEEDORES_GRATIS

Devuelve 0 para gemini/groq/cerebras/mistral/openrouter **por estar en la lista**, no por el
tier real: esas llamadas se anotan gratis aunque el tier sea pago. Es el mismo módulo que
ignora el override de modelo (ver [Modelos y ruteo](#modelos-y-ruteo)).

**Vive en:** lib/anthropic-usage.ts:68 · *2026-08-05 cierre-ronda-mako*

### ⚠️ Pendiente: los números del saldo no cierran

Reportes del dueño sin cerrar, todos del mismo mes:

- El saldo de **Claude** aparece mal: **$-0.14** después de cargar 20 USD. *(2026-07-22)*
- El costo de **Gemini** se calcula mal: el dashboard de Gemini dice **$9.85** y MaKo dice otra
  cosa; y el historial marca como **pagos** tokens que fueron gratuitos, de antes de la fecha
  de carga de créditos. *(2026-07-22)*
- El saldo de **Groq** no se mide en dólares sino en cuántos tokens faltan para el límite.
  *(2026-07-15)*

**Vive en:** lib/anthropic-usage.ts · lib/ia-cuotas.ts · app/integraciones (Saldo de IA)

### ⚠️ Pendiente: mostrar lo que se gastó, en idioma humano

- Pop-up con los **tokens consumidos al final de cada operación**, con la descripción real de
  en qué se gastó: hoy dice cosas como «mako-doer-in». *(2026-07-15)*
- «Tokens restantes» al lado de cada funcionalidad que usa la API de Anthropic. *(2026-06-29)*

### Decisión: cada consumo deja toast e historial en Integraciones > Saldo de IA

Toast de 5 segundos por consumo, e historial dentro de Integraciones > Saldo de IA con **qué
IA y qué modelo** lo consumió, en lenguaje que entienda el cliente. «También debería
aparecerme que IA y que modelo consumió esos tokens»; el saldo **no va en la sidebar**, va a
Integraciones. *(2026-07-15)*

### Decisión: antes de una migración inicial grande, avisar que los tokens gratis no alcanzan

Se agregan las IA gratuitas con rotación y fallback, pero antes de la migración inicial se le
avisa al usuario y se le ofrece comprar la IA de mejor precio-calidad o un plan escalonado por
días: «normalmente esto va a pasar en el inicio de los clientes, cuando tengan que migrar
tooodos los datos» *(2026-07-22)*.

### Decisión: la repriorización del Perro no corre sobre todo cada 24hs

Solo si se detecta un cambio importante. Y toda operación que consuma tokens muestra cuánto
consumió. «No se si vale la pena repriorizar absolutamente todo cada 24 hs» *(2026-07-13)*.

### Regla: no gastar la API paga cuando el trabajo lo puede hacer Claude Code desde el repo

Curar contenido, auditar tareas, correr ensayos: «NO gastes creditos de CLAUDE en el ensayo,
saldrá carísimo, no tiene sentido» *(2026-08-02)*. Y del lado del desarrollo: agrupar los
cambios para que los pruebe todos juntos, no de a uno — «prefiero que hagas ahora el 7. Así lo
pruebo todo junto y no gasto tokens al pedo» *(2026-07-22)*.

---

## Cómo pregunta y responde MaKo

### Regla: la IA FACILITA — sugiere, completa, y si pregunta, pregunta CERRADO

«Se volvió super complejo crear un guion, me pide muchas preguntas abiertas, esa NO es la
idea… La idea es que la IA facilite» *(2026-07-31)*. Todo lo que se puede deducir se completa
solo. Si hace falta preguntar, la pregunta es **cerrada**, en cualquier lugar de la app. Nunca
preguntas abiertas.

### Regla: las preguntas son personalizadas, con formatos variados y una opción libre al final

«Todas multiple choise, cuando se podría aprovechar otros formatos de preguntas… Checklist, u
ordenar, o darle una puntuación» *(2026-07-22)*. El **tipo** se elige con criterio: «Mal la
primera pregunta, en lugar de multiple choise, debería haber sido multiple select»
*(2026-07-23)*. Y son **dinámicas**: la respuesta previa genera las preguntas siguientes —
«dependiendo de una respuesta previa, se pueden generar preguntas posteriores… Eso enriquece
el contexto que le doy al perro» *(2026-07-22)*. Nunca 3 preguntas genéricas de multiple
choice.

### ⚠️ Las preguntas dinámicas tienen que USAR el contexto ya subido

**Sigue reportado como roto.** «En avatares no pueden ser más genericas e inutiles las
preguntas que me hace… Mira que para eso le subimos antes los documentos y tiene ya info, para
poder hacerme preguntas bien puntuales, personalizadas y dinamicas… Corrigelo, hazlo bien»
*(2026-07-30)*. Si ya cargó documentos y la IA pregunta genérico, está mal hecho.

Dos síntomas más del mismo lote, también abiertos: con **1 de 4** respondidas ya genera los
avatares; y en «Tu entregable tangible», al responder «Si lo tengo claro», MaKo **no
repregunta** de qué es ni pide subirlo. El dueño ya avisó que van muchas vueltas y pidió
multiagentes si hace falta.

**Vive en:** lib/onboarding.ts (`generarPreguntasCerradas`) · lib/avatares.ts ·
lib/entregable.ts · app/onboarding

### ⚠️ El resumen del archivero falla y trae solo 2 apartados

«Eso no puede fallar» *(2026-07-30)*. Reportado y sin cerrar; el segundo apartado además sale
incompleto — mirá primero el `validar` de la cascada, que acepta salidas vacías (ver
[La capa barata](#la-capa-barata)).

**Vive en:** lib/onboarding.ts · El Archivero

### Regla: acento argentino solo al ASESORAR; lo que se produce para el cliente va en español plano

«Esta bien que MaKo tenga el acento Argentino al asesorar, pero no al crear cosas para el
cliente, como guiones o textos que van en los anuncios». «Cambia todos los textos a español
plano, no argentino. No pongas "¿Tenés algún otro documento para sumar?"». «No utilices acento
argentino, a veces no se te entiende… A que te referís conque los tableros "banquen"».
*(2026-06-30)*

### Regla: nada de jerga interna ni tecnicismos en lo que ve el cliente

«No quiero que tenga lenguaje complejo o que haga referencia a cosas internas de la app… Que
no ponga "La fabrica de creativos"». «"Vieron tus videos", nuevamente no se entiende. ¿Qué
videos? mis reels? mis ads? Sería, vieron tus anuncios». «Baja a tierra a un lenguaje simple…
no quiero tecnicismos como la matriz 3x3». *(2026-06-30)* Si el nombre no se entiende solo, se
cambia.

### Regla: el Perro Guardián no es complaciente y jamás pregunta qué prioridad poner

«El perro NO debe ser complaciente, y creo que con las preguntas que me hizo se saltó ese
filtro» *(2026-07-22)*: tiene que comparar el proyecto o la tarea nueva **contra los que ya
existen** y discutir la prioridad, no puntuar 97 porque el usuario lo pidió. Y priorizar es su
trabajo, no el del usuario: «el perro me está preguntando a mi que prioridad poner, cuando es
SU trabajo… Los clientes MIENTEN, EXAGERAN, SON EMOCIONALES, NO SABEN PRIORIZAR. Para eso
creamos el perro!» *(2026-07-22)*. Puede pedir una opinión, pero después razona y la contrasta.

### Regla: la IA vive DENTRO de la tab donde se trabaja, no en una pantalla aparte

«Una nueva tab con un nuevo chat, cuando ya existía un "Pregúntale a MaKo"» *(2026-07-10)*: no
se crea una tab ni un chat nuevo para algo que ya existe. La IA es funcionalidad de la tab, no
una pantalla.

### Regla: todo lo que se construye para el dueño se construye para los clientes, en la misma pasada

«Todo esto tiene que modificarse también para los clientes, que les aparezca lo mismo, hoy en
los clientes, sigue igual que antes» *(2026-07-12)*. «Los cambios que hacemos tienen que
impactar siempre para clientes también. Nunca razones que es solo para el dueño»
*(2026-07-22)*. Y donde la pantalla es la misma, es **la misma**: «no entiendo porque la vista
de superadmin y cliente son diferentes en la tab de Plan, deben ser lo mismo» *(2026-07-13)*.

### Decisión: el análisis de MaKo muestra su proceso en vivo y se puede auditar

«Analizando tab de X», «Analizando gráfico de Y», y un lugar para revisar cómo llegó a las
conclusiones. Sin ver el proceso no hay forma de confiar en que analizó todo a profundidad.
*(2026-07-01)*

### Decisión: todo se configura con prompts y botones

Nada de configuración manual en ninguna feature. El usuario no tiene que aprender a configurar
un software: la IA y los botones tienen que resolverlo por él. *(2026-06-30)*

---

## Analistas y fábrica de creativos

### ⚠️ El Closing Analyst tiene el equipo de Mauricio hardcodeado

Los emails y dominios que marcan una llamada como «interna» están escritos a mano en el código
(martinkoncke@gmail.com, tejadomartin@gmail.com, elevate.com.mx) y no son configurables por
workspace: en cualquier otro cliente la clasificación venta-vs-interna se equivoca **en
silencio** y contamina los promedios de score. En la misma línea, el prompt de análisis está
afinado a un negocio concreto —consultoría/coaching que vende mentoría, método SPIN, entrega
4DX/OKR, voz rioplatense—: no es un analizador de ventas genérico out-of-the-box.

**Regla:** toda lista de «los nuestros» sale de la config del workspace, no del archivo.

**Vive en:** lib/closing.ts:117-121 (internos) y `SYSTEM_ANALISIS`:215 (prompt) · *2026-07-19
~landing-24-features-auditoria*

### ⚠️ Fathom ignora el filtro por `recording_id`, y los action items llegan siempre vacíos

Dos trampas de la API de Fathom en el Closing Analyst. (1) El filtro por `recording_id` lo
ignora Fathom del lado servidor (está comentado en `analyzeOne`): re-analizar UNA llamada
obliga al barrido completo paginado de toda la cuenta. (2) `syncClosingCalls` llama
`fetchAllMeetings` sin `includeActionItems` y `fetchMeetingContent` tampoco los trae, así que
el slot de action items del prompt recibe **siempre** «(ninguno)» — el tipo `FathomActionItem`
existe en la lib y no se llena nunca, y Claude concluye que no hubo compromisos en la llamada.

**Regla:** un slot de prompt que llega siempre vacío es indistinguible de un dato real vacío; o
se loguea, o no se pone.

**Vive en:** lib/closing.ts (`analyzeOne`, `syncClosingCalls`) · lib/fathom-api.ts
(`FathomActionItem`) · *2026-07-02 audit-automatizaciones-lead*

### ⚠️ La Biblioteca de objeciones del Closing sigue bloqueada: `objections[].type` nunca se agregó

En el port de la vista «Métricas» se dejó explícitamente fuera de v1 el único bloque que no era
derivable: agrupar las objeciones por tipo (`socio | pensarlo | precio | presupuesto | tiempo |
ya_intente`) para mostrar cuántas veces apareció cada una y qué porcentaje se resolvió.
Verificado: `ClosingObjection` sigue siendo `{ quote, t_seconds, handled, note }`, sin `type`.
Mientras falte ese campo tampoco se pueden computar los insights que dependen de él («lo voy a
pensar 3× y perdió las 3», «decisor faltante sin trabajar»). Para habilitarlo hay tres pasos y
uno cuesta plata: (a) agregar `type` al tipo y al schema de `SYSTEM_ANALISIS`, (b) mapearlo en
`analyzedRow`, (c) **re-analizar el histórico**. La alternativa barata —tipificar por regex
sobre `quote`— se descartó a propósito: es el modelo el que ya está leyendo la llamada.

**Vive en:** lib/closing.ts:54 (`ClosingObjection`) + schema de `SYSTEM_ANALISIS` +
`analyzedRow` · app/closing/ClosingBrowser.tsx (el bloque del panorama sin renderizar) ·
*2026-06-25 ~closing-panorama-port*

### ⚠️ Tres formas de perder trabajo escrito en la fábrica de creativos

1. `preservarIds` empareja avatares viejos con nuevos **por índice**: si se regeneran en otro
   orden, las razones no quedan huérfanas — quedan colgando del avatar equivocado, que es peor
   porque nadie lo nota.
2. «Regenerar» la matriz **borra todos los guiones ya escritos**, porque el route pisa
   `setRazones(r.razones)` con celdas nuevas que traen `guiones: []`.
3. Los routes de onboarding reconstruyen el objeto campo por campo al guardar en vez de llamar
   a la normalizadora del módulo, así que cualquier campo que no esté nombrado ahí **se borra
   en la próxima escritura**: ya está pasando con `enlace` del lead magnet, que crea el wizard
   del Chat Agent y editar desde `EntregableView` le borra.

**Regla:** guardar con la función normalizadora del módulo (hay que exportarla) y emparejar por
id, nunca por posición.

**Vive en:** app/api/onboarding/entregable/route.ts:47, avatares/route.ts:86,
razones/route.ts:146 · lib/entregable.ts:34,44-50 · *2026-08-06
~fabrica-creativos-y-ads-writer-research*

### ⚠️ El shape de la celda de la matriz está duplicado en cuatro archivos y ya divergió

`RazonCelda` no vive en un solo lugar: se repite como object-literal en la acción 'guardar' del
route de razones y como `type` local en `MatrizView`, `RazonesView` y las vistas del
ads-writer. La trampa concreta: si agregás un campo al tipo pero no lo sumás al object-literal
de la acción 'guardar', el campo **se pierde en silencio** cada vez que el usuario edita y
guarda — el server reconstruye la celda campo por campo. Verificado el 7/8/2026: ya
divergieron, `RazonesView.tsx:17` sigue sin `guiones`, `anguloImagen` ni `anguloVideo`, que
`lib/razones.ts` sí tiene.

**Regla:** al tocar el shape, actualizar los cuatro en el mismo commit; o mejor, importar el
tipo en vez de re-declararlo.

**Vive en:** lib/razones.ts:47 (`RazonCelda`) + `normalizarRazon` + `parseRazones` ·
app/api/onboarding/razones/route.ts (acción 'guardar') · app/onboarding/MatrizView.tsx:37 ·
app/onboarding/RazonesView.tsx:17 · *2026-07-28 mapear-onboarding-ajustes*

### ⚠️ El ensayo del onboarding del Chat Agent es de SOLO ESCRITURA: no alimenta nada

El propio comentario de la ruta lo llama «el trabajo más caro del onboarding», y lo que el
dueño escribe practicando contra los casos se guarda en el setting `chat_agent.ensayo`. Grep en
todo el repo: las únicas referencias son la constante, el read y el write dentro de esa misma
ruta (más el barrido de datos-mau). **Nadie más lo lee.** Las secuencias las arma
`armarSecuenciasDeAudios` desde los AUDIOS, y las respuestas del ensayo no entran ahí — o sea
que el paso existe solo para pintar los puntitos verdes de progreso. El circuito natural está a
la vista: el caso «silencio» ES la secuencia de seguimiento y el caso «precio» ES la respuesta
a la objeción de precio; con el desenlace por caso se puede además priorizar las respuestas que
cerraron bien y descartar las que enfriaron al lead.

**Vive en:** app/api/chat-agent/onboarding/ensayo/route.ts:96-139 (`KEY_ENSAYO`/`leerEnsayo`) ·
consumidor esperado: lib/secuencias-audios.ts (`armarSecuenciasDeAudios`), llamado desde
app/api/chat-agent/onboarding/resumen/route.ts · *2026-08-02 ~chat-agent-ensayo-y-secuencias*

### ⚠️ Pendiente: cada entidad analizada necesita su ruta propia

Deep link para cada llamada de ventas analizada, cada anuncio ganador, cada retro, cada
task/proyecto: hoy viven en sub-tabs y no se pueden compartir ni linkear. Pidió además mapear
todo lo que se está quedando sin ruta. *(2026-07-15)*

### ⚠️ Pendiente: editar y revisar con MaKo las valoraciones del Closing

Poder corregir las valoraciones de las llamadas, con historial de cambios y con efecto sobre el
puntaje final. *(2026-06-25)*

### Decisión: la Retro se estructura Retro → Experiments → Conclusions / Planning

Con MaKo leyendo todas las demás tabs para generar la Retro, replicando el método SIMPLE de
«Nueva campaña». El diagnóstico del dueño en ese momento: «hoy parece una app barata y mal
desarrollada» *(2026-07-01)*. El **template se diseña LLENO**, contemplando todos los casos de
uso, y el «cerebro de MaKo» elige en cada corrida qué sección y qué gráfico usar; el análisis
compara y cruza datos entre tabs y detecta lo que el cliente todavía no mide. Data suelta no
sirve: hace falta un organizador que priorice y decida qué mueve la aguja. *(2026-07-01)*

### Decisión: primero volver DOER lo que ya existe, después features nuevas

La app quedó «Thinker» y tiene que ser «Doer»: se priorizaron gráficos y análisis por sobre las
funcionalidades prácticas. En vez de muchos gráficos por tab, **mostrar la conclusión/insight**
que corre un prompt sobre toda la tab, y automatizar lo que hoy depende de que el usuario
apriete ejecutar *(2026-07-09)*. La lista concreta: Retro que da veredictos y propone
experimentos con historial, To-do unificado con Experiments, semáforo vivo, y todo accionable
desde el WhatsApp del dueño — «lo que creo que hará muy "doer" a la app»; recién cuando sienta
«que la app está viva realmente» se pasa a features nuevas *(2026-07-10)*.

### Decisión: la app arranca en modo simple, con un botón para encender el Avanzado

El modo avanzado devuelve todas las tabs y gráficos actuales. El usuario es un infoproductor
que ejecuta: «es probable que como está hoy la app, no usen el 80% de funcionalidades. NO
porque no estén buenas, sino porque es mucho» *(2026-07-09)*.

### Decisión: «Tono y personalidad» pasa a ser «Personalidad», resuelta como quiz

Preguntas cerradas con **frases y fragmentos de guion reales del usuario**, «en lugar de
descripciones vagas como Directo o Cercano». Como se usa para guiones, hay que elegir entre
frases, no entre adjetivos. *(2026-07-31)*

### Decisión: los ensayos del Chat Agent cierran el bucle y corren con el contexto real

«Es como un bucle infinito, no se cierra el bucle nunca, es un eterno en objeciones», y además
planteaba casos fuera del avatar (leads de 3.000 usd para el avatar de Mauricio). El ensayo
tiene que cerrar —positivo o negativo— y correr con el contexto real del negocio y del avatar
del cliente. *(2026-08-03)*

### Decisión: la generación de guiones se apoya en lo ya construido en Ads Analyst

Ganadores, patrones y etiquetado (avatar/ángulo/razón) de los guiones publicados en Meta por
fuera de Ads Writer: «ya tenemos construida toda la funcionalidad de Ads Analyst, y no la
estamos aprovechando» *(2026-08-06)*.

### Decisión: se agrega IDEAS a la content machine

Un input único con animación de escritura donde el dueño tira ideas sueltas, que después se
guían y se expanden hasta convertirse en guiones y varias piezas de contenido. Es lo que le
falta a MaKo: **que se sienta como IA**, al estilo Mila, donde la IA es la base y no una barra
lateral. *(2026-08-07)*

### Decisión: Telegram se saca de toda la app

«Saquemos de todos lados telegram, no lo quiero». *(2026-07-26)*
